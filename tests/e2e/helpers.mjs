import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

export const BASE_URL = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
export const OUTPUT_DIR = fileURLToPath(new URL("./output/", import.meta.url));
mkdirSync(OUTPUT_DIR, { recursive: true });

/** Bundled Chromium when installed, otherwise the local Chrome. */
export async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: "chrome" });
  }
}

export function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/**
 * Answers every /api request with an error unless a later route overrides it,
 * so a suite can never reach a real database or storage bucket.
 * Routes registered later take precedence.
 */
export async function blockApi(page, user) {
  await page.route("**/api/**", (route) => json(route, { error: `unmocked ${route.request().url()}` }, 599));
  await page.route("**/api/auth/me", (route) => json(route, { user }));
}

export function createReporter(suite) {
  const results = [];
  return {
    check(name, ok, extra = "") {
      results.push({ name, ok: Boolean(ok), extra });
    },
    async axe(page, name) {
      const violations = (await new AxeBuilder({ page }).analyze()).violations;
      results.push({
        name: `axe ${name}`,
        ok: violations.length === 0,
        extra: violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`).join("; "),
      });
    },
    finish() {
      for (const { name, ok, extra } of results) console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` ${extra}` : ""}`);
      const failed = results.filter((r) => !r.ok).length;
      console.log(`\n${suite}: ${results.length - failed} passed, ${failed} failed`);
      if (failed > 0) process.exitCode = 1;
    },
  };
}

export const screenshotPath = (name) => `${OUTPUT_DIR}${name}.png`;
