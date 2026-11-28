import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  A4_SHEET_LAYOUT,
  cacheGeneratedSheet,
  generateIdCardSheetPdf,
  generateStudentIdCardPdf,
  getCachedSheet,
  sanitizeCardText,
} from "../src/lib/admin/id-card.js";

test("sanitizeCardText collapses whitespace and strips control characters", () => {
  assert.equal(sanitizeCardText("  Aarav\n\tSharma  "), "Aarav Sharma");
  assert.equal(sanitizeCardText("IIITDM\r\nKancheepuram"), "IIITDM Kancheepuram");
});

test("generateStudentIdCardPdf produces a valid 2-page PDF preserving template dimensions", async () => {
  const bytes = await generateStudentIdCardPdf({
    name: "Aarav Sharma",
    institute: "IIITDM Kancheepuram",
  });
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 10000);

  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 2);
  const { width, height } = doc.getPage(0).getSize();
  assert.ok(Math.abs(width - 446.88) < 1);
  assert.ok(Math.abs(height - 675.75) < 1);
});

test("generateIdCardSheetPdf places 1 to 3 students on a single Portrait A4 page", async () => {
  const bytes = await generateIdCardSheetPdf([
    { name: "Saurabh Gupta", institute: "IIIT Agartala" },
    { name: "Aarav Sharma", institute: "IIITDM Kancheepuram" },
    { name: "Venkata Subrahmanya Rao", institute: "IIIT Tiruchirappalli" },
  ]);
  assert.ok(bytes instanceof Uint8Array);

  const doc = await PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 1);
  const { width, height } = doc.getPage(0).getSize();
  assert.ok(Math.abs(width - A4_SHEET_LAYOUT.pageWidthPt) < 1);
  assert.ok(Math.abs(height - A4_SHEET_LAYOUT.pageHeightPt) < 1);
});

test("sheet memory cache stores and retrieves generated sheets", () => {
  const sample = new Uint8Array([1, 2, 3, 4]);
  const { key, expiresAt } = cacheGeneratedSheet({
    pdfBytes: sample,
    filename: "test.pdf",
    studentIds: [10, 20],
  });
  assert.ok(expiresAt > Date.now());
  const hit = getCachedSheet(key);
  assert.ok(hit);
  assert.equal(hit.filename, "test.pdf");
  assert.deepEqual(hit.pdfBytes, sample);
});
