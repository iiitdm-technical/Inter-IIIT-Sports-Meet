import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { generateStudentIdCardPdf, sanitizeCardText } from "../src/lib/admin/id-card.js";

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

test("generateStudentIdCardPdf handles long names without throwing", async () => {
  const bytes = await generateStudentIdCardPdf({
    name: "Venkata Subrahmanya Narayana Rao",
    institute: "IIIT Tiruchirappalli",
  });
  assert.ok(bytes.length > 10000);
});
