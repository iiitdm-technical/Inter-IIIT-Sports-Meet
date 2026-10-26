import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import dotenv from "dotenv";
import { sameDatabase } from "./database-target.mjs";

dotenv.config({ path: ".env.local", quiet: true });

const testDatabaseUrl = process.env.API_TEST_DATABASE_URL;
const testStorageEndpoint = process.env.API_TEST_AWS_ENDPOINT_URL_S3;
if (!testDatabaseUrl || !testStorageEndpoint) {
  throw new Error("Set API_TEST_DATABASE_URL to an isolated MySQL database and API_TEST_AWS_ENDPOINT_URL_S3 to isolated test storage");
}
if (sameDatabase(testDatabaseUrl, process.env.DATABASE_URL) ||
    (process.env.AWS_ENDPOINT_URL_S3 && new URL(testStorageEndpoint).hostname === new URL(process.env.AWS_ENDPOINT_URL_S3).hostname)) {
  throw new Error("API smoke test requires a different database and storage endpoint from production");
}

const credentialsPath = process.env.API_TEST_CREDENTIALS_PATH || ".private/seed-credentials.json";
const accounts = JSON.parse(readFileSync(credentialsPath, "utf8"));
// The organizer admin is not in the seed file; pass its sign-in for the test branch.
const admin = process.env.API_TEST_ADMIN_EMAIL && process.env.API_TEST_ADMIN_PASSWORD
  ? { role: "admin", username: process.env.API_TEST_ADMIN_EMAIL, email: process.env.API_TEST_ADMIN_EMAIL, password: process.env.API_TEST_ADMIN_PASSWORD }
  : accounts.find((account) => account.role === "admin");
const allIIITs = accounts.filter((account) => account.role === "iiit");
const targetIndex = Number(process.env.API_TEST_IIIT_INDEX || 0);
assert(Number.isInteger(targetIndex) && targetIndex >= 0 && targetIndex < allIIITs.length, "Invalid API_TEST_IIIT_INDEX");
const iiits = [allIIITs[targetIndex], ...allIIITs.filter((_, index) => index !== targetIndex)];
assert(admin && iiits.length >= 2, "Set API_TEST_ADMIN_EMAIL and API_TEST_ADMIN_PASSWORD, and provide two IIIT credentials");

const port = Number(process.env.API_TEST_PORT || 3107);
const base = `http://127.0.0.1:${port}`;
const child = spawn("./node_modules/.bin/next", ["start", "--port", String(port)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: testDatabaseUrl,
    AWS_ENDPOINT_URL_S3: testStorageEndpoint,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
child.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
child.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Next.js exited early: ${serverOutput}`);
    try {
      const response = await fetch(`${base}/api/auth/me`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Next.js did not become ready: ${serverOutput}`);
}

async function request(path, { cookie, ...options } = {}) {
  const headers = { ...options.headers };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

function expectStatus(result, status, label) {
  assert.equal(result.response.status, status, `${label}: ${JSON.stringify(result.body).slice(0, 400)}`);
  console.log(`PASS ${label} (${status})`);
}

async function login(account) {
  const result = await request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: account.username, password: account.password }),
  });
  expectStatus(result, 200, `${account.role} login`);
  if (!account.email) assert.equal(result.body.user.username, account.username);
  const cookie = result.response.headers.get("set-cookie")?.split(";")[0];
  assert(cookie, "Login did not set a session cookie");
  return cookie;
}

try {
  await waitForServer();
  const unauthenticated = await request("/api/auth/me");
  expectStatus(unauthenticated, 200, "unauthenticated session lookup");
  assert.equal(unauthenticated.body.authenticated, false);
  expectStatus(await request("/api/registration"), 401, "registration requires login");
  expectStatus(await request("/api/admin/stats"), 401, "admin stats require login");
  expectStatus(await request("/api/admin/accounts"), 401, "admin accounts require login");
  expectStatus(await request("/api/payment/status"), 401, "payment status requires login");
  expectStatus(await request("/api/payment/upi"), 401, "payment QR requires login");

  const iiitCookie = await login(iiits[0]);
  const otherCookie = await login(iiits[1]);
  const adminCookie = await login(admin);
  const me = await request("/api/auth/me", { cookie: iiitCookie });
  expectStatus(me, 200, "authenticated session lookup");
  assert.equal(me.body.user.iiitCode, iiits[0].iiitCode);
  expectStatus(await request("/api/admin/stats", { cookie: iiitCookie }), 403, "IIIT cannot read admin stats");
  expectStatus(await request("/api/admin/accounts", { cookie: iiitCookie }), 403, "IIIT cannot read admin accounts");
  expectStatus(await request("/api/payment/status", { cookie: iiitCookie }), 404, "payment status unavailable before submission");

  const before = await request("/api/registration", { cookie: iiitCookie });
  expectStatus(before, 200, "empty registration lookup");
  assert.equal(before.body.data.submitted, false, "Test branch account already has a registration");
  const emptyDraft = await request("/api/registration/draft", { cookie: iiitCookie });
  expectStatus(emptyDraft, 200, "empty cloud draft lookup");
  assert.equal(emptyDraft.body.data, null);
  const draft = {
    revision: 0,
    contactDetails: { contactName: "Draft Coordinator", contactEmail: "", contactPhone: "", notes: "" },
    slotsMap: { "athletics|100m|M|main|0": { rollNumber: "API-TEST-001", name: "API TEST STUDENT", gender: "M" } },
  };
  const draftRequest = { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) };
  expectStatus(await request("/api/registration/draft", draftRequest), 401, "draft save requires login");
  expectStatus(await request("/api/registration/draft", { cookie: adminCookie, ...draftRequest }), 403, "admin cannot save IIIT draft");
  const firstSaves = await Promise.all(Array.from({ length: 2 }, () => request("/api/registration/draft", { cookie: iiitCookie, ...draftRequest })));
  assert.deepEqual(firstSaves.map((result) => result.response.status).sort(), [200, 409], "concurrent first saves must not overwrite each other");
  const savedDraft = firstSaves.find((result) => result.response.status === 200);
  expectStatus(savedDraft, 200, "cloud draft saved");
  assert.equal(savedDraft.body.data.revision, 1);
  const otherDraft = await request("/api/registration/draft", { cookie: otherCookie });
  expectStatus(otherDraft, 200, "other IIIT draft lookup");
  assert.equal(otherDraft.body.data, null);
  const updatedDraft = await request("/api/registration/draft", { cookie: iiitCookie, method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, revision: 1 }) });
  expectStatus(updatedDraft, 200, "cloud draft updated");
  assert.equal(updatedDraft.body.data.revision, 2);
  const concurrentUpdates = await Promise.all(Array.from({ length: 2 }, () => request("/api/registration/draft", {
    cookie: iiitCookie, method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, revision: 2 }),
  })));
  assert.deepEqual(concurrentUpdates.map((result) => result.response.status).sort(), [200, 409], "only one concurrent revision update may succeed");
  assert.equal(concurrentUpdates.find((result) => result.response.status === 200).body.data.revision, 3);
  const staleDraft = await request("/api/registration/draft", { cookie: iiitCookie, method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, revision: 1 }) });
  expectStatus(staleDraft, 409, "stale cloud draft rejected");
  assert.equal(staleDraft.body.data.revision, 3);
  expectStatus(await request("/api/registration/csv", { cookie: iiitCookie }), 400, "CSV unavailable before registration");
  expectStatus(await request("/api/upload", { cookie: iiitCookie, method: "POST", body: new FormData() }), 403, "proof unavailable before roster lock");

  const payload = {
    contactDetails: { contactName: "API Test Coordinator", contactEmail: "test@example.org", contactPhone: "9876543210", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", arrivalPoint: "Tambaram (TBM)", departureDate: "2026-12-23", boysSecretaryName: "Ravi Kumar", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in", girlsSecretaryName: "Anita Rao", girlsSecretaryPhone: "+91 9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in", staffCount: 2 },
    students: [{ rollNumber: "API-TEST-001", name: "API TEST STUDENT", gender: "M" }],
    entries: [{ sportId: "athletics", eventId: "100m", gender: "M", rollNumber: "API-TEST-001", isReserve: false }],
  };
  const invalid = structuredClone(payload);
  invalid.entries[0].eventId = "invalid-event";
  expectStatus(await request("/api/registration/submit", { cookie: iiitCookie, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(invalid) }), 422, "invalid event rejected");
  expectStatus(await request("/api/registration/submit", { cookie: iiitCookie, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }), 200, "registration submitted");
  const clearedDraft = await request("/api/registration/draft", { cookie: iiitCookie });
  expectStatus(clearedDraft, 200, "cloud draft lookup after lock");
  assert.equal(clearedDraft.body.data, null);
  expectStatus(await request("/api/registration/draft", { cookie: iiitCookie, method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, revision: 0 }) }), 409, "draft save blocked after lock");
  expectStatus(await request("/api/registration/submit", { cookie: iiitCookie, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }), 403, "duplicate registration rejected");

  const registration = await request("/api/registration", { cookie: iiitCookie });
  expectStatus(registration, 200, "locked registration lookup");
  assert.equal(registration.body.data.students.length, 1);
  assert.equal(registration.body.data.entries.length, 1);
  assert.equal(registration.body.data.registration.status, "payment_pending");
  const upi = await request("/api/payment/upi", { cookie: iiitCookie });
  expectStatus(upi, 200, "registration UPI QR");
  assert.equal(upi.body.configured, true, "UPI settings must be configured in the test environment");
  assert.equal(upi.body.amount, 2500);
  assert(upi.body.qrDataUrl.startsWith("data:image/png;base64,"));
  const csv = await request("/api/registration/csv", { cookie: iiitCookie });
  expectStatus(csv, 200, "IIIT roster CSV");
  assert(csv.body.includes("API-TEST-001"));
  expectStatus(await request("/api/registration?iiitCode=" + iiits[0].iiitCode, { cookie: otherCookie }), 200, "other IIIT registration lookup stays scoped");
  expectStatus(await request("/api/payment/proof?iiitCode=" + iiits[0].iiitCode, { cookie: otherCookie }), 403, "proof ownership enforced");

  const invalidProof = new FormData();
  invalidProof.append("file", new Blob(["not a PDF"], { type: "application/pdf" }), "invalid.pdf");
  expectStatus(await request("/api/upload", { cookie: iiitCookie, method: "POST", body: invalidProof }), 400, "invalid proof content rejected");
  const proof = new FormData();
  proof.append("file", new Blob(["%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"], { type: "application/pdf" }), "test-proof.pdf");
  const uploaded = await request("/api/upload", { cookie: iiitCookie, method: "POST", body: proof });
  expectStatus(uploaded, 200, "private Neon proof upload");
  assert(uploaded.body.pathname.startsWith(`payment-proofs/${iiits[0].iiitCode}/`));

  const paymentDetails = {
    transactionDate: new Date().toISOString().slice(0, 10),
    transactionId: "API-TEST-UTR-001",
    paymentMode: "UPI",
    bankName: "Test Bank",
    proofPathname: uploaded.body.pathname,
  };
  expectStatus(await request("/api/payment/submit", { cookie: iiitCookie, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentDetails }) }), 200, "payment proof submitted");
  expectStatus(await request("/api/payment/submit", { cookie: iiitCookie, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentDetails }) }), 403, "duplicate payment rejected");
  const pendingStatus = await request("/api/payment/status", { cookie: iiitCookie });
  expectStatus(pendingStatus, 200, "payment status after proof submission");
  assert.equal(pendingStatus.body.data.verificationStatus, "pending");
  const returnedProof = await request("/api/payment/proof?iiitCode=" + iiits[0].iiitCode, { cookie: iiitCookie });
  expectStatus(returnedProof, 200, "private proof retrieval");
  assert(returnedProof.body.startsWith("%PDF-"));
  expectStatus(await request("/api/payment/proof?iiitCode=" + iiits[0].iiitCode, { cookie: otherCookie }), 403, "other IIIT cannot view proof");

  const adminRegistration = await request("/api/registration?iiitCode=" + iiits[0].iiitCode, { cookie: adminCookie });
  expectStatus(adminRegistration, 200, "admin registration lookup");
  assert.equal(adminRegistration.body.data.registration.status, "submitted");
  const adminOverview = await request("/api/admin/registrations", { cookie: adminCookie });
  expectStatus(adminOverview, 200, "admin registrations overview");
  assert(adminOverview.body.data.some((row) => row.iiitCode === iiits[0].iiitCode && row.status === "submitted"));
  const adminAccounts = await request("/api/admin/accounts", { cookie: adminCookie });
  expectStatus(adminAccounts, 200, "admin accounts overview");
  assert(adminAccounts.body.data.some((row) => row.username === admin.username || row.email === admin.email));
  assert(adminAccounts.body.data.every((row) => !("passwordHash" in row)));
  const entries = await request(`/api/admin/entries?iiit=${encodeURIComponent(iiits[0].iiitCode)}&name=API%20TEST&page=1&limit=25`, { cookie: adminCookie });
  expectStatus(entries, 200, "admin filtered entries");
  assert.equal(entries.body.data.total, 1);
  const masterCsv = await request("/api/admin/csv?rollNumber=API-TEST-001", { cookie: adminCookie });
  expectStatus(masterCsv, 200, "admin filtered CSV");
  assert(masterCsv.body.includes("API-TEST-001"));
  expectStatus(await request("/api/admin/stats", { cookie: adminCookie }), 200, "admin stats");
  expectStatus(await request("/api/payment/proof?iiitCode=" + iiits[0].iiitCode, { cookie: adminCookie }), 200, "admin proof retrieval");
  const verifyPath = "/api/admin/payments/verify";
  const verifyBody = (transactionId, bankConfirmed = true) => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ iiitCode: iiits[0].iiitCode, transactionId, amount: 2500, bankConfirmed }),
  });
  expectStatus(await request(verifyPath, { cookie: iiitCookie, ...verifyBody(paymentDetails.transactionId) }), 403, "IIIT cannot verify payment");
  expectStatus(await request(verifyPath, { cookie: adminCookie, ...verifyBody(paymentDetails.transactionId, false) }), 400, "bank confirmation required");
  expectStatus(await request(verifyPath, { cookie: adminCookie, ...verifyBody("WRONG-UTR") }), 422, "wrong UTR rejected");
  expectStatus(await request(verifyPath, { cookie: adminCookie, ...verifyBody(paymentDetails.transactionId) }), 200, "admin payment approval");
  const verifiedStatus = await request("/api/payment/status", { cookie: iiitCookie });
  expectStatus(verifiedStatus, 200, "student sees verified payment");
  assert.equal(verifiedStatus.body.data.verificationStatus, "verified");
  expectStatus(await request(verifyPath, { cookie: adminCookie, ...verifyBody(paymentDetails.transactionId) }), 409, "duplicate approval rejected");
  const reopenPath = "/api/admin/registrations/reopen";
  const reopenOptions = (iiitCode) => ({ cookie: adminCookie, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ iiitCode, confirmIiitCode: iiitCode }) });
  expectStatus(await request(reopenPath, reopenOptions(iiits[0].iiitCode)), 409, "verified roster cannot be reopened");
  if (iiits.length >= 3) {
    const correctionCookie = await login(iiits[2]);
    expectStatus(await request("/api/registration/submit", { cookie: correctionCookie, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }), 200, "correction roster submitted");
    expectStatus(await request(reopenPath, reopenOptions(iiits[2].iiitCode)), 200, "unverified roster reopened");
    const reopenedDraft = await request("/api/registration/draft", { cookie: correctionCookie });
    expectStatus(reopenedDraft, 200, "reopened roster becomes JSON draft");
    assert.equal(Object.keys(reopenedDraft.body.data.slotsMap).length, 1);
    assert.equal(reopenedDraft.body.data.revision, 1);
  }
  expectStatus(await request("/api/auth/logout", { cookie: iiitCookie, method: "POST" }), 200, "logout");
  const afterLogout = await request("/api/auth/me", { cookie: iiitCookie });
  assert.equal(afterLogout.body.authenticated, false, "signed-out session cookie must stop working");
  expectStatus(await request("/api/auth/me", { cookie: otherCookie }), 200, "other device stays signed in");

  expectStatus(await request("/api/registration/draft", {
    cookie: otherCookie, method: "PUT",
    headers: { "content-type": "application/json", origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
    body: JSON.stringify({ ...draft, revision: 0 }),
  }), 403, "cross-site write blocked");

  const home = await fetch(`${base}/`);
  for (const header of ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "strict-transport-security"]) {
    assert(home.headers.get(header), `missing security header ${header}`);
  }

  const fakeAccount = { username: `nobody-${Date.now()}`, password: "wrong-password" };
  let lastStatus = 0;
  for (let attempt = 0; attempt < 9; attempt += 1) {
    lastStatus = (await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fakeAccount) })).response.status;
  }
  assert.equal(lastStatus, 429, "repeated failed sign-ins are rate limited");
  console.log("All API route smoke checks passed on isolated MySQL and test storage.");
} finally {
  child.kill("SIGTERM");
}
