import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { registrationSubmitSchema, paymentSubmitSchema } from "../src/lib/validation/schemas.js";
import { escapeCsvField, formatCsv } from "../src/lib/csv/generator.js";
import { hashPassword, verifyPassword } from "../src/lib/auth/passwords.js";
import { detectProofType, guessProofType } from "../src/lib/registration/proof-file.js";

const today = () => new Date().toISOString().slice(0, 10);
const payment = (overrides = {}) => ({
  paymentDetails: {
    transactionDate: today(),
    transactionId: "TX12345",
    paymentMode: "NEFT",
    proofPathname: "payment-proofs/test/1.pdf",
    ...overrides,
  },
});
const without = (field) => {
  const value = payment();
  delete value.paymentDetails[field];
  return value;
};
const accepts = (value) => paymentSubmitSchema.safeParse(value).success;

describe("registrationSubmitSchema", () => {
  test("trims and upper-cases roll numbers, names and ids", () => {
    const parsed = registrationSubmitSchema.parse({
      contactDetails: {
        contactName: "Prof. Rajesh Sharma",
        contactEmail: "sports@iiitdm.ac.in",
        contactPhone: "9876543210",
        notes: "Arrives 18 December",
      },
      students: [{ rollNumber: "  2023bcs001  ", name: "  rahul sharma  ", gender: "M" }],
      entries: [{ sportId: "CRICKET", eventId: "TEAM", gender: "M", rollNumber: "  2023bcs001 ", isReserve: false }],
    });
    assert.equal(parsed.students[0].rollNumber, "2023BCS001");
    assert.equal(parsed.students[0].name, "RAHUL SHARMA");
    assert.equal(parsed.entries[0].rollNumber, "2023BCS001");
    assert.equal(parsed.entries[0].sportId, "cricket");
    assert.equal(parsed.entries[0].eventId, "team");
  });

  test("requires valid contact details and at least one student and entry", () => {
    const base = {
      contactDetails: { contactName: "A", contactEmail: "a@b.in", contactPhone: "123456" },
      students: [{ rollNumber: "R1", name: "A", gender: "M" }],
      entries: [{ sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1" }],
    };
    assert.equal(registrationSubmitSchema.safeParse(base).success, true);
    assert.equal(registrationSubmitSchema.safeParse({ ...base, students: [] }).success, false);
    assert.equal(registrationSubmitSchema.safeParse({ ...base, entries: [] }).success, false);
    assert.equal(registrationSubmitSchema.safeParse({ ...base, contactDetails: { ...base.contactDetails, contactEmail: "nope" } }).success, false);
    assert.equal(registrationSubmitSchema.safeParse({ ...base, contactDetails: { ...base.contactDetails, contactPhone: "12" } }).success, false);
  });
});

describe("paymentSubmitSchema", () => {
  test("accepts valid details, with or without a bank name", () => {
    assert.equal(accepts(payment()), true);
    assert.equal(accepts(payment({ bankName: "SBI" })), true);
  });

  test("requires transaction id, mode, date and proof", () => {
    for (const field of ["transactionId", "paymentMode", "transactionDate", "proofPathname"]) {
      assert.equal(accepts(without(field)), false, `missing ${field} should be rejected`);
    }
  });

  test("rejects unknown modes and requires a description for OTHER", () => {
    assert.equal(accepts(payment({ paymentMode: "CASH" })), false);
    assert.equal(accepts(payment({ paymentMode: "OTHER" })), false);
    assert.equal(accepts(payment({ paymentMode: "OTHER", otherPaymentMode: "Demand Draft" })), true);
  });

  test("rejects future and impossible dates", () => {
    const future = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    assert.equal(accepts(payment({ transactionDate: future })), false);
    assert.equal(accepts(payment({ transactionDate: "2026-99-99" })), false);
    assert.equal(accepts(payment({ transactionDate: "2026-02-30" })), false);
    assert.equal(accepts(payment({ transactionDate: "2002-10-25" })), false);
  });

  test("accepts today's date in India even while UTC is still on yesterday", () => {
    const realNow = Date.now;
    // 00:30 IST on 26 Oct 2026 is 19:00 UTC on 25 Oct.
    Date.now = () => Date.parse("2026-10-25T19:00:00Z");
    try {
      assert.equal(accepts(payment({ transactionDate: "2026-10-26" })), true);
      assert.equal(accepts(payment({ transactionDate: "2026-10-27" })), false);
    } finally {
      Date.now = realNow;
    }
  });

  test("trims the transaction reference", () => {
    const parsed = paymentSubmitSchema.safeParse(payment({ transactionId: "  UTR987654 \n" }));
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.paymentDetails.transactionId, "UTR987654");
  });

  test("bounds the UTR length", () => {
    assert.equal(accepts(payment({ transactionId: "1234" })), false);
    assert.equal(accepts(payment({ transactionId: "X".repeat(65) })), false);
  });
});

describe("CSV export", () => {
  test("escapes quotes, commas and line breaks per RFC 4180", () => {
    const csv = formatCsv(["IIIT", "Student", "Notes"], [
      ["IIITDM Kancheepuram", 'RAHUL "THE FLASH" SHARMA', "Arrives early, needs a pass"],
      ["IIIT Allahabad", "PRIYA VERMA", "Line one\nline two"],
    ]);
    assert.ok(csv.includes('"RAHUL ""THE FLASH"" SHARMA"'));
    assert.ok(csv.includes('"Arrives early, needs a pass"'));
    assert.ok(csv.includes('"Line one\nline two"'));
    assert.ok(csv.split("\r\n")[0] === "IIIT,Student,Notes");
  });

  test("neutralises spreadsheet formulas", () => {
    for (const value of ["=HYPERLINK(1)", "+1", "-2+3", "@SUM(A1)", "  =cmd"]) {
      assert.ok(escapeCsvField(value).replace(/^"/, "").startsWith("'"), value);
    }
    assert.equal(escapeCsvField("plain"), "plain");
    assert.equal(escapeCsvField(null), "");
  });
});

describe("password hashing", () => {
  test("hashes with bcrypt and verifies only the right password", async () => {
    const hash = await hashPassword("super_secure_pass_123");
    assert.ok(hash.startsWith("$2"));
    assert.equal(await verifyPassword("super_secure_pass_123", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
    assert.equal(await verifyPassword("", hash), false);
  });
});

describe("payment proof file types", () => {
  const bytes = (text) => new TextEncoder().encode(text);

  test("detects PDF, JPEG and PNG from content", () => {
    assert.equal(detectProofType(bytes("%PDF-1.7 ...")), "application/pdf");
    assert.equal(detectProofType(bytes("\n\n  %PDF-1.4 header after junk")), "application/pdf");
    assert.equal(detectProofType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "image/jpeg");
    assert.equal(detectProofType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])), "image/png");
  });

  test("rejects other content", () => {
    assert.equal(detectProofType(bytes("<html><script>alert(1)</script>")), null);
    assert.equal(detectProofType(bytes("GIF89a")), null);
    assert.equal(detectProofType(new Uint8Array()), null);
  });

  test("guesses the type when the browser reports it oddly", () => {
    assert.equal(guessProofType({ type: "", name: "Receipt.PDF" }), "application/pdf");
    assert.equal(guessProofType({ type: "image/jpg", name: "x" }), "image/jpeg");
    assert.equal(guessProofType({ type: "application/x-pdf", name: "x" }), "application/pdf");
    assert.equal(guessProofType({ type: "image/heic", name: "IMG_1.HEIC" }), null);
    assert.equal(guessProofType({ type: "", name: "receipt.docx" }), null);
  });
});
