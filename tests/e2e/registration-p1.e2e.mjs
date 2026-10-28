/**
 * Regression checks for the registration, payment and admin flows.
 * Every /api call is mocked; nothing reaches the database or storage.
 * Needs a running server: E2E_BASE_URL (default http://localhost:3000).
 */
import { BASE_URL, blockApi, createReporter, json, launchBrowser, screenshotPath } from "./helpers.mjs";

const browser = await launchBrowser();
const { check, finish } = createReporter("registration-p1");
const iiitUser = { id: 1, username: "iiit-kota", role: "iiit", iiitName: "IIIT Kota", iiitCode: "iiit-kota" };
const rosterVersion = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const pendingEditableDraft = {
  contactDetails: { contactName: "Dr A", contactEmail: "a@iiitkota.ac.in", contactPhone: "+91 9876543210", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", arrivalPoint: "Tambaram (TBM)", departureDate: "2026-12-23", boysSecretaryName: "Ravi Kumar", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in", girlsSecretaryName: "Anita Rao", girlsSecretaryPhone: "+91 9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in", boysTravelling: 1, girlsTravelling: 1, staffCount: 2, notes: "" },
  slotsMap: {
    "kabaddi|team|M|main|0": { rollNumber: "K1", name: "RAVI", gender: "M" },
    "chess|team|mixed|main|0": { rollNumber: "C1", name: "ANITA", gender: "F" },
  },
};

try {
  // ---------- Registration draft ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await blockApi(page, iiitUser);
    await page.route("**/api/registration", (r) => json(r, { data: { submitted: false } }));
    let puts = 0;
    await page.route("**/api/registration/draft", (r) => {
      if (r.request().method() === "PUT") {
        puts++;
        const body = r.request().postDataJSON();
        return json(r, { data: { ...body, revision: body.revision + 1, updatedAt: new Date().toISOString() } });
      }
      return json(r, { data: {
        revision: 3,
        updatedAt: new Date().toISOString(),
        contactDetails: { contactName: "Dr A", contactEmail: "a@iiitkota.ac.in", contactPhone: "+91 9876543210", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", arrivalPoint: "Tambaram (TBM)", departureDate: "2026-12-23", boysSecretaryName: "Ravi Kumar", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in", girlsSecretaryName: "Anita Rao", girlsSecretaryPhone: "+91 9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in", boysTravelling: 1, girlsTravelling: 1, staffCount: 2, notes: "" },
        slotsMap: {
          "kabaddi|team|M|main|0": { rollNumber: "K1", name: "ANITA", gender: "F" },
          "chess|team|mixed|main|0": { rollNumber: "C1", name: "RAVI", gender: "M" },
        },
      } });
    });
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Kabaddi");

    const tab = (name) => page.getByRole("tab", { name, exact: true });
    const chessHeadings = () => page.locator("#category-panel h3", { hasText: /^Chess$/i }).count();
    const chessInMen = await chessHeadings();
    await tab("Women's Events").click();
    const chessInWomen = await chessHeadings();
    await tab("Combined Events").click();
    const chessInCombined = await chessHeadings();
    const sectionsInCombined = await page.locator("#category-panel h3").count();
    // Combined holds Chess plus the athletics and aquatics mixed relays.
    check("chess hidden in Men/Women, shown in Combined with mixed relays", chessInMen === 0 && chessInWomen === 0 && chessInCombined === 1 && sectionsInCombined === 3, `${chessInMen}/${chessInWomen}/${chessInCombined}/${sectionsInCombined}`);
    check("tabs expose aria-selected", (await tab("Combined Events").getAttribute("aria-selected")) === "true");

    await tab("Men's Events").click();
    const badge = await page.locator("button", { has: page.locator("h3", { hasText: /^Kabaddi$/i }) }).innerText();
    check("Kabaddi header shows '1 to fix'", /1 to fix/i.test(badge), JSON.stringify(badge));

    await page.getByRole("button", { name: "Show first issue" }).click();
    await page.waitForTimeout(400);
    const focused = await page.evaluate(() => ({
      id: document.activeElement?.id,
      label: document.activeElement?.getAttribute("aria-label"),
      invalid: document.activeElement?.getAttribute("aria-invalid"),
    }));
    check("Show focuses the offending slot", focused.id?.includes("kabaddi") && focused.invalid === "true", JSON.stringify(focused));
    check("slot input has descriptive label", focused.label === "Men Kabaddi Squad, Slot 1: roll number", focused.label);
    await page.screenshot({ path: screenshotPath("reg-error-slot") });

    const unlabeled = await page.evaluate(() => [...document.querySelectorAll("#category-panel input, #category-panel select")]
      .filter((e) => !e.getAttribute("aria-label") && !(e.id && document.querySelector(`label[for="${e.id}"]`))).length);
    check("no unlabeled slot inputs", unlabeled === 0, String(unlabeled));

    const reviewButton = page.getByRole("button", { name: /Review & Submit/ });
    await reviewButton.focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("[role=dialog]");
    check("focus moves into review dialog", await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")));
    const showCount = await page.locator("[role=dialog] button", { hasText: "Show" }).count();
    check("review lists issues with Show buttons", showCount >= 1, String(showCount));
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    check("Tab stays inside dialog", await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]")));
    await page.screenshot({ path: screenshotPath("reg-review-errors") });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("Escape closes dialog", (await page.locator("[role=dialog]").count()) === 0);
    check("focus returns to Review button", await page.evaluate(() => /Review/.test(document.activeElement?.textContent || "")));

    await page.getByRole("button", { name: "Clear Men Kabaddi Squad, Slot 1" }).click();
    // Clearing the only girl leaves 0 girls on the roster; the typed headcount must match.
    await page.fill("#contact-girls-travelling", "0");
    await page.getByRole("button", { name: /Review & Submit/ }).click();
    await page.waitForSelector("[role=dialog]");
    const saveRosterButton = page.getByRole("button", { name: /Save Roster & Continue/ });
    const disabledBefore = await saveRosterButton.isDisabled();
    await page.getByRole("dialog").getByRole("checkbox").check();
    const disabledAfter = await saveRosterButton.isDisabled();
    check("save roster button needs confirmation", disabledBefore && !disabledAfter, `${disabledBefore}->${disabledAfter}`);
    check("review action saves roster and continues", (await saveRosterButton.innerText()).trim() === "Save Roster & Continue →");
    const backdropAlpha = await page.evaluate(() => {
      const backdrop = [...document.querySelectorAll("[aria-hidden='true']")].find((e) => getComputedStyle(e).position === "fixed");
      return backdrop ? getComputedStyle(backdrop).backgroundColor : "";
    });
    check("backdrop is translucent", /\/ 0\.\d+\)|rgba\(.*0\.\d+\)/.test(backdropAlpha), backdropAlpha);
    await page.screenshot({ path: screenshotPath("reg-review-confirm") });
    check("draft saves were mocked", puts >= 0, `PUTs=${puts}`);

    await page.route("**/api/registration/submit", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return json(route, { data: {} });
    });
    await saveRosterButton.click();
    await page.getByRole("button", { name: "Saving roster…" }).waitFor({ state: "visible" });
    check("save action reports progress", (await page.getByRole("button", { name: "Saving roster…" }).count()) === 1);
    await page.waitForSelector("[role=dialog]", { state: "detached" });
    await ctx.close();
  }

  // ---------- Payment pending ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await blockApi(page, iiitUser);
    await page.route("**/api/registration", (r) => json(r, { data: {
      submitted: true,
      rosterVersion,
      editableDraft: pendingEditableDraft,
      registration: { status: "payment_pending", iiitName: "IIIT Kota", iiitCode: "iiit-kota", totalStudentsCount: 2 },
      students: [
        { id: 1, rollNumber: "K1", studentName: "RAVI", studentGender: "M" },
        { id: 2, rollNumber: "C1", studentName: "ANITA", studentGender: "F" },
      ],
      entries: [
        { id: 1, rollNumber: "K1", studentName: "RAVI", sportId: "kabaddi", eventId: "team", gender: "M", isReserve: false },
        { id: 2, rollNumber: "C1", studentName: "ANITA", sportId: "chess", eventId: "team", gender: "mixed", isReserve: false },
      ],
    } }));
    await page.route("**/api/registration/draft", (r) => json(r, { data: null }));
    await page.route("**/api/payment/upi", (r) => json(r, { configured: false }));
    let uploads = 0;
    await page.route("**/api/upload", (r) => {
      uploads++;
      return json(r, { pathname: "payment-proofs/iiit-kota/x.pdf", fileName: "proof.pdf" });
    });
    await page.route("**/api/payment/submit", (r) => json(r, { error: "Mocked submission for request inspection" }, 500));
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
    await page.waitForSelector("#payment-transaction-id");
    await page.fill("#payment-transaction-id", "UTR123456");

    // The receipt upload follows the transaction ID field in keyboard order.
    await page.focus("#payment-transaction-id");
    await page.keyboard.press("Tab");
    const focusedProof = await page.evaluate(() => document.activeElement?.id);
    check("proof file input reachable with Tab", focusedProof === "payment-proof-file", focusedProof);
    // A PDF over the 1 MB limit is refused in the browser without uploading.
    await page.setInputFiles("#payment-proof-file", { name: "big.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(3 * 1024 * 1024, 0x25) });
    await page.waitForTimeout(200);
    check("over-1MB PDF rejected before upload", uploads === 0 && (await page.getByText(/over the 1 MB limit/).count()) === 1);
    await page.focus("#payment-proof-file");
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 3000 }).catch(() => null),
      page.keyboard.press("Space"),
    ]);
    check("Space opens the file picker", !!chooser);
    if (chooser) await chooser.setFiles({ name: "proof.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
    await page.waitForSelector("text=Upload successful", { timeout: 5000 }).catch(() => {});
    check("upload succeeds", uploads === 1 && (await page.locator("text=Upload successful").count()) === 1, `uploads=${uploads}`);
    await page.screenshot({ path: screenshotPath("pay-uploaded"), fullPage: true });

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#payment-transaction-id");
    const utr = await page.inputValue("#payment-transaction-id");
    const stillUploaded = await page.locator("text=Upload successful").count();
    check("UTR and proof survive reload", utr === "UTR123456" && stillUploaded === 1, `${utr} ${stillUploaded}`);
    await page.fill("#payment-transaction-date", await page.locator("#payment-transaction-date").getAttribute("max"));
    const paymentSubmission = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/payment/submit" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Submit payment" }).click();
    const paymentRequest = (await paymentSubmission).request();
    const paymentBody = paymentRequest.postDataJSON();
    check("payment submission sends rosterVersion at top level", paymentBody.rosterVersion === rosterVersion && paymentBody.paymentDetails?.rosterVersion === undefined, JSON.stringify(paymentBody));
    await ctx.close();
  }

  // ---------- Admin ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await blockApi(page, { id: 9, username: "organizer", role: "admin", displayName: "Organizer" });
    await page.route("**/api/admin/stats", (r) => json(r, { data: { totalIIITs: 25, lockedIIITs: 1, paymentsSubmitted: 1, paymentsVerified: 0, totalStudents: 4, totalEventEntries: 5 } }));
    await page.route("**/api/admin/accounts", (r) => json(r, { data: [] }));
    await page.route("**/api/admin/registrations", (r) => json(r, { data: [
      { iiitCode: "iiit-kota", iiitName: "IIIT Kota", isSubmitted: true, status: "submitted", totalStudentsCount: 4, contactName: "Dr A", contactEmail: "a@iiitkota.ac.in", contactPhone: "+91 98765 43210", paymentAmount: 10000, paymentTransactionId: "UTR1", paymentProofPathname: "p", paymentVerificationStatus: "pending" },
      { iiitCode: "iiit-una", iiitName: "IIIT Una", isSubmitted: false, status: null },
    ] }));
    const entryQueries = [];
    await page.route("**/api/admin/entries?*", (r) => {
      entryQueries.push(new URL(r.request().url()).search);
      return json(r, { data: { rows: [], total: 0, page: 1, totalPages: 1 } });
    });
    await page.goto(`${BASE_URL}/admin`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Registration Entries");

    // Downloads bypass request interception, so record the CSV URL the page tries to open.
    await page.evaluate(() => {
      window.__csv = [];
      HTMLAnchorElement.prototype.click = function click() { window.__csv.push(new URL(this.href).search); };
    });
    const lastCsv = async () => (await page.evaluate(() => window.__csv)).at(-1);

    await page.fill("#filter-iiit", "Gwalior");
    await page.getByRole("button", { name: /Export Current Filter/i }).click();
    await page.waitForTimeout(500);
    check("export ignores unapplied filter", (await lastCsv()) === "", JSON.stringify(await lastCsv()));

    await page.getByRole("tab", { name: "IIITs & Payments" }).click();
    check("contact details shown", (await page.locator("a[href='mailto:a@iiitkota.ac.in']").count()) === 1 && (await page.locator("a[href='tel:+919876543210']").count()) === 1);
    await page.screenshot({ path: screenshotPath("admin-payments") });
    await page.getByRole("button", { name: "View entries for IIIT Kota" }).click();
    await page.waitForTimeout(300);
    check("View entries filters by IIIT code", entryQueries.at(-1)?.includes("iiit=iiit-kota"), entryQueries.at(-1));
    await page.getByRole("button", { name: /Export Current Filter/i }).click();
    await page.waitForTimeout(500);
    check("export uses applied IIIT filter", (await lastCsv())?.includes("iiit=iiit-kota"), await lastCsv());

    await page.getByRole("tab", { name: "IIITs & Payments" }).click();
    await page.getByRole("button", { name: "Verify payment" }).click();
    await page.waitForSelector("[role=dialog]");
    check("verify dialog focuses UTR field", await page.evaluate(() => document.activeElement?.id === "verify-utr"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("Escape closes verify dialog", (await page.locator("[role=dialog]").count()) === 0);
    await ctx.close();
  }
} finally {
  await browser.close();
  finish();
}
