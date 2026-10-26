import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { registrationSubmitSchema, paymentSubmitSchema } from "../src/lib/validation/schemas.js";
import { escapeCsvField, formatCsv } from "../src/lib/csv/generator.js";
import { hashPassword, verifyPassword } from "../src/lib/auth/passwords.js";
import { detectProofType, guessProofType } from "../src/lib/registration/proof-file.js";
import { countByGender, isPersonalEmail } from "../src/lib/registration/contingent.js";
import { BUS_TERMINALS, CHENNAI_AIRPORT, RAILWAY_STATIONS, arrivalPointForMode } from "../src/lib/registration/arrival.js";

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
        arrivalDate: "2026-12-18",
        arrivalTime: "07:30",
        travelMode: "Train",
        arrivalPoint: "Tambaram (TBM)",
        departureDate: "2026-12-23",
        boysSecretaryName: "Ravi Kumar",
        boysSecretaryPhone: "+91 9000000011",
        boysSecretaryEmail: "ravi@iiitkota.ac.in",
        girlsSecretaryName: "Anita Rao",
        girlsSecretaryPhone: "+91 9000000012",
        girlsSecretaryEmail: "anita@iiitkota.ac.in",
        staffCount: 2,
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
      contactDetails: { contactName: "A", contactEmail: "a@b.in", contactPhone: "123456", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", arrivalPoint: "Tambaram (TBM)", departureDate: "2026-12-23", boysSecretaryName: "Ravi Kumar", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in", girlsSecretaryName: "Anita Rao", girlsSecretaryPhone: "+91 9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in", staffCount: 2, notes: "" },
      students: [{ rollNumber: "R1", name: "A", gender: "M" }],
      entries: [{ sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1" }],
    };
    assert.equal(registrationSubmitSchema.safeParse(base).success, true);
    assert.equal(registrationSubmitSchema.safeParse({ ...base, students: [] }).success, false);
    assert.equal(registrationSubmitSchema.safeParse({ ...base, entries: [] }).success, false);
    assert.equal(registrationSubmitSchema.safeParse({ ...base, contactDetails: { ...base.contactDetails, contactEmail: "nope" } }).success, false);
    assert.equal(registrationSubmitSchema.safeParse({ ...base, contactDetails: { ...base.contactDetails, contactPhone: "12" } }).success, false);
  });

  test("requires arrival date, time and mode of travel", () => {
    const base = {
      contactDetails: { contactName: "A", contactEmail: "a@b.in", contactPhone: "123456", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", arrivalPoint: "Tambaram (TBM)", departureDate: "2026-12-23", boysSecretaryName: "Ravi Kumar", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in", girlsSecretaryName: "Anita Rao", girlsSecretaryPhone: "+91 9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in", staffCount: 2 },
      students: [{ rollNumber: "R1", name: "A", gender: "M" }],
      entries: [{ sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1" }],
    };
    const accepts = (changes) => registrationSubmitSchema.safeParse({ ...base, contactDetails: { ...base.contactDetails, ...changes } }).success;
    assert.equal(accepts({}), true, "arriving-at and notes are optional");
    for (const field of ["arrivalDate", "arrivalTime", "travelMode", "departureDate"]) {
      assert.equal(accepts({ [field]: undefined }), false, `${field} missing`);
      assert.equal(accepts({ [field]: "" }), false, `${field} empty`);
    }
    assert.equal(accepts({ arrivalDate: "2026-12-14" }), false, "before the arrival window");
    assert.equal(accepts({ arrivalDate: "2026-12-24" }), false, "after the meet");
    assert.equal(accepts({ arrivalDate: "2026-12-15" }) && accepts({ arrivalDate: "2026-12-23" }), true, "window edges");
    assert.equal(accepts({ arrivalDate: "18-12-2026" }), false);
    assert.equal(accepts({ arrivalTime: "25:00" }), false);
    assert.equal(accepts({ arrivalTime: "7:30" }), false);
    assert.equal(accepts({ travelMode: "Rocket" }), false);
  });

  test("checks departure date and the Other travel mode", () => {
    const base = {
      contactDetails: { contactName: "A", contactEmail: "a@b.in", contactPhone: "123456", arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", arrivalPoint: "Tambaram (TBM)", departureDate: "2026-12-23", boysSecretaryName: "Ravi Kumar", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in", girlsSecretaryName: "Anita Rao", girlsSecretaryPhone: "+91 9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in", staffCount: 2 },
      students: [{ rollNumber: "R1", name: "A", gender: "M" }],
      entries: [{ sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1" }],
    };
    const parse = (changes) => registrationSubmitSchema.safeParse({ ...base, contactDetails: { ...base.contactDetails, ...changes } });
    assert.equal(parse({ departureDate: "2026-12-23" }).success, true);
    assert.equal(parse({ departureDate: "2026-12-27" }).success, false, "after the departure window");
    const early = parse({ arrivalDate: "2026-12-21", departureDate: "2026-12-20" });
    assert.equal(early.success, false);
    assert.deepEqual(early.error.issues[0].path, ["contactDetails", "departureDate"]);
    assert.equal(parse({ travelMode: "Other" }).success, false, "Other needs a description");
    assert.equal(parse({ travelMode: "Other", notes: "   " }).success, false);
    assert.equal(parse({ travelMode: "Other", notes: "Institute bus" }).success, true);
    assert.equal(parse({ arrivalPoint: "x".repeat(129) }).success, false);
    assert.equal(parse({ notes: "x".repeat(1001) }).success, false);
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

describe("arrival point by mode of travel", () => {
  const contact = {
    contactName: "A", contactEmail: "a@b.in", contactPhone: "123456",
    arrivalDate: "2026-12-18", arrivalTime: "07:30", departureDate: "2026-12-23",
    boysSecretaryName: "Ravi", boysSecretaryPhone: "9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in",
    girlsSecretaryName: "Anita", girlsSecretaryPhone: "9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in",
    staffCount: 2,
  };
  const base = { students: [{ rollNumber: "R1", name: "A", gender: "M" }], entries: [{ sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1" }] };
  const parse = (changes) => registrationSubmitSchema.safeParse({ ...base, contactDetails: { ...contact, ...changes } });

  test("train needs a station; listed or typed", () => {
    assert.equal(parse({ travelMode: "Train" }).success, false);
    assert.equal(parse({ travelMode: "Train", arrivalPoint: "  " }).success, false);
    assert.equal(parse({ travelMode: "Train", arrivalPoint: "Chennai Egmore (MS)" }).success, true);
    assert.equal(parse({ travelMode: "Train", arrivalPoint: "Katpadi Junction" }).success, true);
  });

  test("bus must arrive at Kilambakkam or CMBT", () => {
    assert.equal(parse({ travelMode: "Bus" }).success, false);
    assert.equal(parse({ travelMode: "Bus", arrivalPoint: "Madurai" }).success, false);
    for (const terminus of BUS_TERMINALS) assert.equal(parse({ travelMode: "Bus", arrivalPoint: terminus }).success, true);
  });

  test("flight always arrives at Chennai airport (MAA)", () => {
    assert.equal(parse({ travelMode: "Flight" }).data.contactDetails.arrivalPoint, CHENNAI_AIRPORT);
    assert.equal(parse({ travelMode: "Flight", arrivalPoint: "Bengaluru" }).data.contactDetails.arrivalPoint, CHENNAI_AIRPORT);
  });

  test("own vehicle keeps an optional free-text point", () => {
    assert.equal(parse({ travelMode: "Own vehicle" }).success, true);
    assert.equal(parse({ travelMode: "Own vehicle", arrivalPoint: "Main gate" }).data.contactDetails.arrivalPoint, "Main gate");
  });

  test("changing the mode keeps only a point that still fits", () => {
    assert.equal(arrivalPointForMode("Flight", "Tambaram (TBM)"), CHENNAI_AIRPORT);
    assert.equal(arrivalPointForMode("Bus", "Tambaram (TBM)"), "");
    assert.equal(arrivalPointForMode("Bus", BUS_TERMINALS[0]), BUS_TERMINALS[0]);
    assert.equal(arrivalPointForMode("Train", CHENNAI_AIRPORT), "");
    assert.equal(arrivalPointForMode("Train", "Tambaram (TBM)"), "Tambaram (TBM)");
    assert.equal(arrivalPointForMode("Own vehicle", BUS_TERMINALS[1]), "");
    assert.equal(arrivalPointForMode("Own vehicle", "Main gate"), "Main gate");
    assert.equal(RAILWAY_STATIONS[0], "Chennai Beach (MSB)");
    assert.equal(RAILWAY_STATIONS[RAILWAY_STATIONS.indexOf("Chengalpattu Junction (CGL)") - 1], "Paranur");
    for (const station of ["Chennai Park", "Chennai Egmore (MS)", "Tambaram (TBM)", "Vandalur", "Chennai Central (MAS)"]) assert.ok(RAILWAY_STATIONS.includes(station), station);
    assert.equal(new Set(RAILWAY_STATIONS).size, RAILWAY_STATIONS.length, "no duplicates");
  });
});

describe("sports secretaries and contingent", () => {
  const contact = {
    contactName: "A", contactEmail: "a@b.in", contactPhone: "123456",
    arrivalDate: "2026-12-18", arrivalTime: "07:30", travelMode: "Train", arrivalPoint: "Tambaram (TBM)", departureDate: "2026-12-23",
    boysSecretaryName: "Ravi", boysSecretaryPhone: "+91 9000000011", boysSecretaryEmail: "ravi@iiitkota.ac.in",
    girlsSecretaryName: "Anita", girlsSecretaryPhone: "9000000012", girlsSecretaryEmail: "anita@iiitkota.ac.in",
    staffCount: "2",
  };
  const base = { students: [{ rollNumber: "R1", name: "A", gender: "M" }], entries: [{ sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1" }] };
  const parse = (changes) => registrationSubmitSchema.safeParse({ ...base, contactDetails: { ...contact, ...changes } });

  test("every secretary field and the staff count are required", () => {
    assert.equal(parse({}).success, true);
    for (const field of ["boysSecretaryName", "boysSecretaryPhone", "boysSecretaryEmail", "girlsSecretaryName", "girlsSecretaryPhone", "girlsSecretaryEmail", "staffCount"]) {
      assert.equal(parse({ [field]: "" }).success, false, `${field} empty`);
      assert.equal(parse({ [field]: undefined }).success, false, `${field} missing`);
    }
  });

  test("secretaries must give an institute email and a phone number", () => {
    assert.equal(parse({ boysSecretaryEmail: "ravi@gmail.com" }).success, false);
    assert.equal(parse({ girlsSecretaryEmail: "anita@Yahoo.co.in" }).success, false);
    assert.equal(parse({ boysSecretaryEmail: "not-an-email" }).success, false);
    assert.equal(parse({ girlsSecretaryPhone: "12" }).success, false);
    assert.equal(isPersonalEmail("x@iiitdm.ac.in"), false);
    assert.equal(isPersonalEmail(" X@GMAIL.COM "), true);
  });

  test("accompanying staff is a whole number from 1 to 3", () => {
    assert.equal(parse({ staffCount: "1" }).data?.contactDetails.staffCount, 1);
    assert.equal(parse({ staffCount: 3 }).success, true);
    for (const bad of ["0", "4", "1.5", "two", -1]) assert.equal(parse({ staffCount: bad }).success, false, String(bad));
  });

  test("boys and girls are counted once per student", () => {
    assert.deepEqual(countByGender([{ gender: "M" }, { gender: "F" }, { gender: "M" }]), { boys: 2, girls: 1 });
    assert.deepEqual(countByGender([]), { boys: 0, girls: 0 });
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
