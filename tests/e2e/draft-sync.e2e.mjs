/**
 * Draft autosave: opening the form must not save, so a second device never
 * causes a false "newer draft" conflict; a real change saves once.
 * Every /api call is mocked. Needs E2E_BASE_URL (default http://localhost:3000).
 */
import { BASE_URL, blockApi, createReporter, json, launchBrowser } from "./helpers.mjs";

const browser = await launchBrowser();
const { check, finish } = createReporter("draft-sync");
const user = { id: 1, username: "iiit-kota", role: "iiit", iiitName: "IIIT Kota", iiitCode: "iiit-kota" };

/** A fake draft API shared by several "devices", like the real server. */
function draftServer(initial) {
  const state = { draft: initial, puts: [] };
  return {
    state,
    async attach(page) {
      await blockApi(page, user);
      await page.route("**/api/registration", (r) => json(r, { data: { submitted: false } }));
      await page.route("**/api/registration/draft", (r) => {
        if (r.request().method() !== "PUT") return json(r, { data: state.draft });
        const body = r.request().postDataJSON();
        state.puts.push(body);
        const current = state.draft?.revision || 0;
        if (body.revision !== current) return json(r, { error: "A newer draft exists in another session", data: state.draft }, 409);
        state.draft = { ...body, revision: current + 1, updatedAt: new Date().toISOString() };
        return json(r, { data: state.draft });
      });
    },
  };
}

async function openDevice(server) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await server.attach(page);
  await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle" });
  await page.waitForSelector("#category-panel h3");
  return { ctx, page };
}

try {
  // A fresh IIIT opening the form stores nothing until it types.
  {
    const server = draftServer(null);
    const { ctx, page } = await openDevice(server);
    await page.waitForTimeout(2500);
    check("first visit does not save an empty draft", server.state.puts.length === 0, `PUTs=${server.state.puts.length}`);
    check("header says drafts save automatically", (await page.locator("header").getByText("Saves automatically").count()) === 1);
    await page.fill("#contact-name", "Dr A");
    await page.waitForTimeout(2000);
    check("a real change saves once", server.state.puts.length === 1 && server.state.puts[0].contactDetails.contactName === "Dr A", `PUTs=${server.state.puts.length}`);
    check("header shows Saved after the save", (await page.locator("header").getByText(/^Saved/).count()) >= 1);
    await ctx.close();
  }

  // Two devices: opening the form on the second must not break the first.
  {
    const server = draftServer({
      revision: 4,
      updatedAt: new Date().toISOString(),
      contactDetails: { contactName: "Dr A", contactEmail: "a@iiitkota.ac.in", contactPhone: "+91 9876543210", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", departureDate: "2026-12-23", boysSecretaryName: "Ravi Kumar", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in", girlsSecretaryName: "Anita Rao", girlsSecretaryPhone: "+91 9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in", staffCount: 2, notes: "" },
      slotsMap: { "handball|team|M|main|0": { rollNumber: "H1", name: "ONE", gender: "M" } },
    });
    const laptop = await openDevice(server);
    const phone = await openDevice(server);
    await phone.page.waitForTimeout(2500);
    check("opening a saved draft does not save it again", server.state.puts.length === 0, `PUTs=${server.state.puts.length}, revision=${server.state.draft.revision}`);

    await laptop.page.fill("#contact-notes", "Arriving 18 Dec");
    await laptop.page.waitForTimeout(2000);
    const conflictShown = (await laptop.page.getByText(/newer draft was saved in another session/i).count()) > 0;
    check("laptop saves after the phone opened the form, with no false conflict", !conflictShown && server.state.draft.revision === 5 && server.state.draft.contactDetails.notes === "Arriving 18 Dec", `revision=${server.state.draft.revision} conflict=${conflictShown}`);

    // A genuine edit on the other device still raises the conflict prompt.
    await phone.page.fill("#contact-name", "Dr B");
    await phone.page.waitForTimeout(2000);
    check("a real edit from a stale device still asks which version to keep", (await phone.page.getByText(/newer draft was saved in another session/i).count()) > 0);
    await laptop.ctx.close();
    await phone.ctx.close();
  }
} finally {
  await browser.close();
  finish();
}
