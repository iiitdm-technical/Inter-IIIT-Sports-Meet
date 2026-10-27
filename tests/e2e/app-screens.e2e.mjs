/**
 * Layout, copy and accessibility checks for the registration, payment,
 * login and admin screens. Every /api call is mocked; nothing reaches the
 * database or storage. Needs a running server: E2E_BASE_URL
 * (default http://localhost:3000).
 */
import { BASE_URL, blockApi, createReporter, json, launchBrowser, screenshotPath } from "./helpers.mjs";

const browser = await launchBrowser();
const { check, axe, finish } = createReporter("app-screens");
const iiitUser = { id: 1, username: "iiit-kota", role: "iiit", iiitName: "IIIT Kota", iiitCode: "iiit-kota" };
const rosterVersion = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const pendingEditableDraft = {
  contactDetails: { contactName: "Dr A", contactEmail: "a@x.in" },
  slotsMap: {
    "athletics|100m|M|main|0": { rollNumber: "R1", name: "RAVI", gender: "M" },
    "athletics|100m|M|reserve|0": { rollNumber: "R2", name: "ARUN", gender: "M" },
    "chess|team|mixed|main|0": { rollNumber: "R3", name: "ANITA", gender: "F" },
  },
};
const entries = [
  { id: 1, sportId: "athletics", eventId: "100m", gender: "M", isReserve: false, studentName: "RAVI", rollNumber: "R1" },
  { id: 2, sportId: "athletics", eventId: "100m", gender: "M", isReserve: true, studentName: "ARUN", rollNumber: "R2" },
  { id: 3, sportId: "chess", eventId: "team", gender: "mixed", isReserve: false, studentName: "ANITA", rollNumber: "R3" },
];

try {
  // Draft form, mobile
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await blockApi(page, iiitUser);
    await page.route("**/api/registration", (r) => json(r, { data: { submitted: false } }));
    await page.route("**/api/registration/draft", (r) => (r.request().method() === "PUT"
      ? json(r, { data: { ...r.request().postDataJSON(), revision: 2, updatedAt: new Date().toISOString() } })
      : json(r, { data: {
        revision: 1,
        updatedAt: new Date().toISOString(),
        contactDetails: { contactName: "Dr A", contactEmail: "a@x.in", contactPhone: "+91 9876543210", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", arrivalPoint: "Tambaram (TBM)", departureDate: "2026-12-23", boysSecretaryName: "Ravi Kumar", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in", girlsSecretaryName: "Anita Rao", girlsSecretaryPhone: "+91 9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in", staffCount: 2, notes: "" },
        slotsMap: { "kabaddi|team|M|main|0": { rollNumber: "K1", name: "ANITA", gender: "F" } },
      } })));
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Kabaddi");
    check("site navbar hidden on /register", (await page.locator("nav").count()) === 0 && (await page.locator("footer").count()) === 0);
    check("home link in registration header", (await page.getByRole("link", { name: /Home/ }).count()) === 1);
    check("logout has accessible name on mobile", (await page.getByRole("button", { name: "Log out" }).count()) === 1);
    await page.waitForTimeout(1500);
    check("save status visible on mobile", await page.locator("header").getByText("Saved", { exact: true }).isVisible());
    await page.getByRole("button", { name: /Kabaddi/ }).click();
    await page.screenshot({ path: screenshotPath("draft-mobile") });
    await axe(page, "draft form");
    await ctx.close();
  }

  // Payment pending, mobile
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await blockApi(page, iiitUser);
    await page.route("**/api/registration", (r) => json(r, { data: {
      submitted: true,
      rosterVersion,
      editableDraft: pendingEditableDraft,
      registration: { status: "payment_pending", iiitName: "IIIT Kota", iiitCode: "iiit-kota", totalStudentsCount: 3 },
      students: [],
      entries,
    } }));
    await page.route("**/api/registration/draft", (r) => json(r, { data: null }));
    await page.route("**/api/payment/upi", (r) => json(r, { configured: false }));
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Roster saved — payment pending");
    const progressSteps = page.locator("[aria-label='Registration progress'] li");
    check("first progress step is roster saved", (await progressSteps.nth(0).innerText()).includes("Roster saved"));
    check("payment submitted is the current step", (await page.locator("[aria-current=step]").innerText()).includes("Payment submitted"));
    await page.getByText(/Check your saved roster/).click();
    check("roster summary lists names", await page.getByText("ARUN").isVisible() && await page.getByText("Athletics · 100 M").isVisible());
    await page.getByRole("button", { name: "Submit payment" }).click();
    await page.waitForTimeout(200);
    check("submit with errors focuses first invalid field", (await page.evaluate(() => document.activeElement?.getAttribute("aria-invalid"))) === "true");
    await page.fill("#payment-transaction-id", "AB");
    check("UTR length error live", await page.getByText("must be 5 to 64 characters").isVisible());
    await page.fill("#payment-transaction-id", "ABCDEF123");
    check("UTR error clears when fixed", (await page.getByText("must be 5 to 64 characters").count()) === 0);
    await page.screenshot({ path: screenshotPath("payment-pending-mobile"), fullPage: true });
    await axe(page, "payment pending");
    await page.getByRole("button", { name: "Edit roster / teams" }).click();
    await page.waitForSelector("#contact-name");
    await page.getByRole("button", { name: /Athletics/ }).click();
    const restoredContactName = await page.inputValue("#contact-name");
    const restoredRollNumbers = await page.locator("#category-panel input").evaluateAll((inputs) => inputs.map((input) => input.value));
    check("editing pending roster opens with saved contact and teams", restoredContactName === "Dr A" && restoredRollNumbers.includes("R1") && restoredRollNumbers.includes("R2"), `${restoredContactName}/${restoredRollNumbers.join(",")}`);
    await ctx.close();
  }

  // Locked and verified
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await blockApi(page, iiitUser);
    await page.route("**/api/registration", (r) => json(r, { data: {
      submitted: true,
      registration: { status: "submitted", iiitName: "IIIT Kota", iiitCode: "iiit-kota", totalStudentsCount: 3, contactName: "Dr A", submittedAt: new Date().toISOString() },
      students: [{}, {}, {}],
      entries,
      payment: { uniqueStudentCount: 3, amount: 7500, transactionId: "UTR1", paymentMode: "UPI", proofPathname: "p", verificationStatus: "verified", verifiedAt: new Date().toISOString() },
    } }));
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Registration complete");
    check("amount labelled paid", await page.getByText("Amount paid").isVisible() && (await page.getByText("Amount Payable").count()) === 0);
    check("locked roster visible", await page.getByText("Locked roster").isVisible() && await page.getByText("ANITA").isVisible());
    await page.screenshot({ path: screenshotPath("locked-verified"), fullPage: true });
    await axe(page, "locked");
    await ctx.close();
  }

  // Login
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.route("**/api/**", (r) => json(r, { error: "unmocked" }, 599));
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
    check("login heading", (await page.locator("h1").textContent()).trim() === "Sign in");
    check("one main landmark", (await page.locator("main").count()) === 1);
    check("skip link present", (await page.getByRole("link", { name: "Skip to content" }).count()) === 1);
    await page.screenshot({ path: screenshotPath("login-mobile") });
    await axe(page, "login");
    await ctx.close();
  }

  // Admin
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await blockApi(page, { id: 9, username: "organizer", role: "admin", displayName: "Organizer" });
    await page.route("**/api/admin/stats", (r) => json(r, { data: { totalIIITs: 25, lockedIIITs: 3, paymentsSubmitted: 2, paymentsVerified: 1, totalStudents: 40, totalEventEntries: 60 } }));
    await page.route("**/api/admin/accounts", (r) => json(r, { error: "x" }, 500));
    await page.route("**/api/admin/registrations", (r) => json(r, { data: [
      { iiitCode: "iiit-kota", iiitName: "IIIT Kota", isSubmitted: true, status: "submitted", totalStudentsCount: 4, contactName: "Dr A", contactEmail: "a@x.in", contactPhone: "123456", paymentAmount: 10000, paymentTransactionId: "UTR1", paymentProofPathname: "p", paymentVerificationStatus: "pending" },
      { iiitCode: "iiit-una", iiitName: "IIIT Una", isSubmitted: true, status: "submitted", totalStudentsCount: 2, paymentAmount: 5000, paymentProofPathname: "p", paymentVerificationStatus: "verified" },
      { iiitCode: "iiit-pune", iiitName: "IIIT Pune", isSubmitted: true, status: "payment_pending", totalStudentsCount: 2 },
      { iiitCode: "iiit-surat", iiitName: "IIIT Surat", isSubmitted: false, status: null },
    ] }));
    await page.route("**/api/admin/entries?*", (r) => json(r, { data: { rows: [
      { id: 1, iiitName: "IIIT Kota", rollNumber: "R1", studentName: "RAVI", studentGender: "M", sportId: "table_tennis", eventId: "team", eventGender: "M", isReserve: false },
      { id: 2, iiitName: "IIIT Kota", rollNumber: "R2", studentName: "ARUN", studentGender: "M", sportId: "athletics", eventId: "4x100m_relay", eventGender: "M", isReserve: true },
    ], total: 2, page: 1, totalPages: 1 } }));
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Rosters saved");
    check("partial load error shown", await page.getByRole("alert").filter({ hasText: "admin accounts" }).isVisible());
    check("KPI shows awaiting verification", await page.getByText("1 awaiting verification", { exact: false }).isVisible());
    check("entries use names", await page.getByRole("cell", { name: "Table Tennis" }).isVisible()
      && await page.getByRole("cell", { name: "4x100 M Relay" }).isVisible()
      && await page.getByText("Reserve", { exact: true }).first().isVisible());
    check("filter labels associated", (await page.getByLabel("Roll Number", { exact: false }).count()) === 1);
    await page.screenshot({ path: screenshotPath("admin-entries") });
    await page.getByRole("tab", { name: "IIITs & Payments" }).click();
    const pendingRow = page.locator("tbody tr").filter({ hasText: "IIIT Pune" });
    check("payment-pending roster is marked editable", await pendingRow.getByText("Roster editable", { exact: true }).isVisible());
    const submittedRow = page.locator("tbody tr").filter({ hasText: "IIIT Kota" });
    check("submitted roster remains marked locked", await submittedRow.getByText("Roster locked", { exact: true }).isVisible());
    await page.selectOption("#payment-filter", "awaiting_verification");
    const rows = await page.locator("tbody tr").count();
    check("payment filter narrows rows", rows === 1, String(rows));
    await page.selectOption("#payment-filter", "not_submitted");
    check("not-submitted label", await page.getByText("Not submitted", { exact: true }).first().isVisible());
    await page.selectOption("#payment-filter", "all");
    await page.screenshot({ path: screenshotPath("admin-payments-all") });
    await axe(page, "admin payments");
    await ctx.close();
  }
} finally {
  await browser.close();
  finish();
}
