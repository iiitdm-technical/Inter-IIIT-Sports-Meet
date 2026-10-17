import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import assert from "assert";
import { hashPassword, verifyPassword } from "../src/lib/auth/passwords.js";
import { signSessionToken, verifySessionToken } from "../src/lib/auth/session.js";
import { validateRegistrationRules } from "../src/lib/validation/rules.js";
import { registrationSubmitSchema, paymentSubmitSchema } from "../src/lib/validation/schemas.js";
import { SPORTS_CONFIG, GLOBAL_RULES, getSportConfig } from "../src/lib/sports/config.js";
import { formatCsv } from "../src/lib/csv/generator.js";

async function runTests() {
  console.log("=========================================");
  console.log("ðŸ§ª RUNNING BACKEND FOUNDATION TESTS");
  console.log("=========================================\n");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`âœ… PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`âŒ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`âœ… PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`âŒ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Password Tests
  await testAsync("bcrypt password hashing and verification", async () => {
    const raw = "super_secure_pass_123";
    const hash = await hashPassword(raw);
    assert.strictEqual(typeof hash, "string");
    assert.ok(hash.startsWith("$2"));

    const isValid = await verifyPassword(raw, hash);
    assert.strictEqual(isValid, true);

    const isInvalid = await verifyPassword("wrong_pass", hash);
    assert.strictEqual(isInvalid, false);
  });

  // 2. Session HMAC Token Tests
  test("Session token signing, verification, and tamper detection", () => {
    const payload = {
      userId: 1,
      username: "iiitdm-kancheepuram",
      role: "iiit",
      iiitCode: "iiitdm-kancheepuram",
      iiitName: "IIITDM Kancheepuram",
      exp: Date.now() + 60000,
    };

    const token = signSessionToken(payload);
    assert.ok(token.includes("."));

    const decoded = verifySessionToken(token);
    assert.strictEqual(decoded.username, "iiitdm-kancheepuram");
    assert.strictEqual(decoded.role, "iiit");

    // Tampered token test
    const tampered = token.slice(0, -4) + "abcd";
    const tamperedDecoded = verifySessionToken(tampered);
    assert.strictEqual(tamperedDecoded, null);

    // Expired token test
    const expiredPayload = { ...payload, exp: Date.now() - 1000 };
    const expiredToken = signSessionToken(expiredPayload);
    assert.strictEqual(verifySessionToken(expiredToken), null);
  });

  // 3. Sport Catalog Sanity
  test("Sport catalog integrity & official rulebook parameters", () => {
    assert.strictEqual(GLOBAL_RULES.MAX_UNIQUE_STUDENTS_PER_IIIT, 150);
    assert.strictEqual(GLOBAL_RULES.MAX_NORMAL_SPORTS_PER_STUDENT, 2);
    assert.strictEqual(GLOBAL_RULES.MAX_ATHLETICS_INDIVIDUAL_EVENTS, 3);
    assert.strictEqual(GLOBAL_RULES.MAX_AQUATICS_INDIVIDUAL_EVENTS, 3);

    // Athletics
    const athletics = getSportConfig("athletics");
    assert.ok(athletics);
    assert.strictEqual(athletics.events.M.length, 15);
    assert.strictEqual(athletics.events.F.length, 12);

    // Aquatics
    const aquatics = getSportConfig("aquatics");
    assert.ok(aquatics);
    assert.strictEqual(aquatics.events.M.length, 15);
    assert.strictEqual(aquatics.events.F.length, 11);

    // Cricket
    const cricket = getSportConfig("cricket");
    assert.strictEqual(cricket.teamLimits.M, 15);

    // Chess
    const chess = getSportConfig("chess");
    assert.strictEqual(chess.teamLimits.mixed, 4);
  });

  // 4. TEST 2 - NORMAL SPORTS: 1, 2 pass
  test("TEST 2: Normal Sports - 1 or 2 normal sports pass", () => {
    const students = [
      { rollNumber: "2023BCS001", name: "ALOK KUMAR", gender: "M" },
    ];
    const entries = [
      { sportId: "cricket", eventId: "team", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "volleyball", eventId: "team", gender: "M", rollNumber: "2023BCS001", isReserve: false },
    ];
    const result = validateRegistrationRules({ students, entries });
    assert.strictEqual(result.isValid, true, `Expected valid, got errors: ${result.errors.join("; ")}`);
  });

  // TEST 3 - ATHLETICS: Valid Multi-Sport Case
  test("TEST 3: Athletics - Cricket + Volleyball + Athletics pass", () => {
    const students = [
      { rollNumber: "2023BCS001", name: "ALOK KUMAR", gender: "M" },
      { rollNumber: "2023BCS002", name: "PRIYA SHARMA", gender: "F" },
    ];

    const entries = [
      // Alok in Cricket (Normal Sport 1)
      { sportId: "cricket", eventId: "team", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      // Alok in Volleyball (Normal Sport 2)
      { sportId: "volleyball", eventId: "team", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      // Alok in Athletics 100m, 200m, Long Jump (Athletics individual limit: 3)
      { sportId: "athletics", eventId: "100m", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "athletics", eventId: "200m", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "athletics", eventId: "long_jump", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      // Alok in Athletics Relay (Relay does not count towards the 3 individual events)
      { sportId: "athletics", eventId: "4x100m_relay", gender: "M", rollNumber: "2023BCS001", isReserve: false },

      // Priya in Badminton (Normal Sport 1)
      { sportId: "badminton", eventId: "team", gender: "F", rollNumber: "2023BCS002", isReserve: false },
      // Priya in Table Tennis (Normal Sport 2)
      { sportId: "table_tennis", eventId: "team", gender: "F", rollNumber: "2023BCS002", isReserve: false },
    ];

    const result = validateRegistrationRules({ students, entries });
    assert.strictEqual(result.isValid, true, `Expected valid, got errors: ${result.errors.join("; ")}`);
    assert.strictEqual(result.errors.length, 0);
  });

  // TEST 2 - NORMAL SPORTS: > 2 reject
  test("TEST 2: Normal Sports - 3 normal sports reject", () => {
    const students = [
      { rollNumber: "2023BCS001", name: "ALOK KUMAR", gender: "M" },
    ];

    const entries = [
      { sportId: "cricket", eventId: "team", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "volleyball", eventId: "team", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "basketball", eventId: "team", gender: "M", rollNumber: "2023BCS001", isReserve: false }, // 3rd normal sport!
    ];

    const result = validateRegistrationRules({ students, entries });
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes("Multi-sport rule violated")));
  });

  // TEST 3 - ATHLETICS: 4 individual reject
  test("TEST 3: Athletics - 4 individual athletics events reject", () => {
    const students = [
      { rollNumber: "2023BCS001", name: "ALOK KUMAR", gender: "M" },
    ];

    const entries = [
      { sportId: "athletics", eventId: "100m", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "athletics", eventId: "200m", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "athletics", eventId: "400m", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "athletics", eventId: "shot_put", gender: "M", rollNumber: "2023BCS001", isReserve: false }, // 4th individual event!
    ];

    const result = validateRegistrationRules({ students, entries });
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes("Athletics event limit violated")));
  });

  // TEST 4 - AQUATICS: Valid pass
  test("TEST 4: Aquatics - Cricket + Volleyball + 3 Aquatics events pass", () => {
    const students = [{ rollNumber: "2023BCS001", name: "ALOK KUMAR", gender: "M" }];
    const entries = [
      { sportId: "cricket", eventId: "team", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "volleyball", eventId: "team", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "aquatics", eventId: "50m_freestyle", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "aquatics", eventId: "100m_freestyle", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "aquatics", eventId: "50m_breaststroke", gender: "M", rollNumber: "2023BCS001", isReserve: false },
    ];
    const result = validateRegistrationRules({ students, entries });
    assert.strictEqual(result.isValid, true);
  });

  // TEST 4 - AQUATICS: 4 events reject
  test("TEST 4: Aquatics - 4 aquatics events reject", () => {
    const students = [{ rollNumber: "2023BCS001", name: "ALOK KUMAR", gender: "M" }];
    const entries = [
      { sportId: "aquatics", eventId: "50m_freestyle", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "aquatics", eventId: "100m_freestyle", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "aquatics", eventId: "50m_breaststroke", gender: "M", rollNumber: "2023BCS001", isReserve: false },
      { sportId: "aquatics", eventId: "100m_breaststroke", gender: "M", rollNumber: "2023BCS001", isReserve: false },
    ];
    const result = validateRegistrationRules({ students, entries });
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some((e) => e.includes("Aquatics event limit violated")));
  });

  // TEST 8 - GENDER: Mismatch rejection
  test("TEST 8: Gender - Men+M pass, Men+F reject, Women+F pass, Women+M reject", () => {
    // 1. Men + M (pass)
    assert.strictEqual(
      validateRegistrationRules({
        students: [{ rollNumber: "R1", name: "S1", gender: "M" }],
        entries: [{ sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1", isReserve: false }]
      }).isValid, true
    );
    // 2. Men + F (reject)
    assert.strictEqual(
      validateRegistrationRules({
        students: [{ rollNumber: "R2", name: "S2", gender: "F" }],
        entries: [{ sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R2", isReserve: false }]
      }).isValid, false
    );
    // 3. Women + F (pass)
    assert.strictEqual(
      validateRegistrationRules({
        students: [{ rollNumber: "R3", name: "S3", gender: "F" }],
        entries: [{ sportId: "volleyball", eventId: "team", gender: "F", rollNumber: "R3", isReserve: false }]
      }).isValid, true
    );
    // 4. Women + M (reject)
    assert.strictEqual(
      validateRegistrationRules({
        students: [{ rollNumber: "R4", name: "S4", gender: "M" }],
        entries: [{ sportId: "volleyball", eventId: "team", gender: "F", rollNumber: "R4", isReserve: false }]
      }).isValid, false
    );
    // 5. Combined + M (pass)
    assert.strictEqual(
      validateRegistrationRules({
        students: [{ rollNumber: "R5", name: "S5", gender: "M" }],
        entries: [{ sportId: "chess", eventId: "team", gender: "mixed", rollNumber: "R5", isReserve: false }]
      }).isValid, true
    );
    // 6. Combined + F (pass)
    assert.strictEqual(
      validateRegistrationRules({
        students: [{ rollNumber: "R6", name: "S6", gender: "F" }],
        entries: [{ sportId: "chess", eventId: "team", gender: "mixed", rollNumber: "R6", isReserve: false }]
      }).isValid, true
    );
  });

  // TEST 5 - EVENT CAPACITY: Athletics individual capacity is 2 per IIIT
  test("TEST 5: Event Capacity - 1 pass, 2 pass, 3 reject", () => {
    const students = [
      { rollNumber: "R1", name: "STUDENT 1", gender: "M" },
      { rollNumber: "R2", name: "STUDENT 2", gender: "M" },
      { rollNumber: "R3", name: "STUDENT 3", gender: "M" },
    ];

    // 2 participants -> pass
    const passResult = validateRegistrationRules({
      students: students.slice(0, 2),
      entries: [
        { sportId: "athletics", eventId: "100m", gender: "M", rollNumber: "R1", isReserve: false },
        { sportId: "athletics", eventId: "100m", gender: "M", rollNumber: "R2", isReserve: false },
      ]
    });
    assert.strictEqual(passResult.isValid, true);

    // 3 participants -> reject (limit is 2 for Athletics 100m)
    const rejectResult = validateRegistrationRules({
      students,
      entries: [
        { sportId: "athletics", eventId: "100m", gender: "M", rollNumber: "R1", isReserve: false },
        { sportId: "athletics", eventId: "100m", gender: "M", rollNumber: "R2", isReserve: false },
        { sportId: "athletics", eventId: "100m", gender: "M", rollNumber: "R3", isReserve: false },
      ]
    });
    assert.strictEqual(rejectResult.isValid, false);
    assert.ok(rejectResult.errors.some(e => e.includes("Competitor limit exceeded")));
  });

  // TEST 1 - MAXIMUM UNIQUE STUDENTS: 150 pass, 151 reject, multiple events counts as 1
  test("TEST 1: Maximum Unique Students - 150 pass, 151 reject", () => {
    const students150 = [];
    const entries150 = [];
    for (let i = 1; i <= 150; i++) {
      const roll = `R${i}`;
      students150.push({ rollNumber: roll, name: `STUDENT ${i}`, gender: "M" });
      entries150.push({ sportId: "cricket", eventId: "team", gender: "M", rollNumber: roll, isReserve: false });
      // Duplicate entry for same roll but different event to prove it counts as 1 unique student
      entries150.push({ sportId: "athletics", eventId: "100m", gender: "M", rollNumber: roll, isReserve: false });
    }
    const result150 = validateRegistrationRules({ students: students150, entries: entries150 });
    // Valid combination, only 150 students, although 300 entries. It will fail on squad size/event capacity,
    // so we just check it doesn't fail on "Maximum unique students limit exceeded".
    assert.strictEqual(result150.errors.some(e => e.includes("Maximum unique students limit exceeded")), false);

    const students151 = [...students150, { rollNumber: "R151", name: "STUDENT 151", gender: "M" }];
    const result151 = validateRegistrationRules({ students: students151, entries: [] });
    assert.strictEqual(result151.isValid, false);
    assert.ok(result151.errors.some(e => e.includes("Maximum unique students limit exceeded")));
  });

  // TEST 6 - DUPLICATE EVENT: Same student + same sport/event twice
  test("TEST 6: Duplicate Event - Reject same student in same event twice", () => {
    const students = [{ rollNumber: "R1", name: "STUDENT 1", gender: "M" }];
    const entries = [
      { sportId: "athletics", eventId: "100m", gender: "M", rollNumber: "R1", isReserve: false },
      { sportId: "athletics", eventId: "100m", gender: "M", rollNumber: "R1", isReserve: false },
    ];
    const result = validateRegistrationRules({ students, entries });
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some(e => e.includes("entered multiple times in athletics - 100m")));
  });

  // TEST 7 - CONFLICTING IDENTITY: Same roll + different name
  test("TEST 7: Conflicting Identity - Same roll + different name reject", () => {
    const students = [
      { rollNumber: "R1", name: "STUDENT A", gender: "M" },
      { rollNumber: "R1", name: "STUDENT B", gender: "M" }, // Same roll, different name
    ];
    const result = validateRegistrationRules({ students, entries: [] });
    assert.strictEqual(result.isValid, false);
    assert.ok(result.errors.some(e => e.includes("Duplicate student roll number detected")));
  });

  // TEST 9 - NO MINIMUM SPORTS
  test("TEST 9: No Minimum Sports - 1 valid sport or 2 valid sports pass", () => {
    const students = [{ rollNumber: "R1", name: "STUDENT 1", gender: "M" }];
    // 1 valid sport
    assert.strictEqual(
      validateRegistrationRules({
        students,
        entries: [{ sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1", isReserve: false }]
      }).isValid, true
    );
    // 2 valid sports
    assert.strictEqual(
      validateRegistrationRules({
        students,
        entries: [
          { sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1", isReserve: false },
          { sportId: "volleyball", eventId: "team", gender: "M", rollNumber: "R1", isReserve: false }
        ]
      }).isValid, true
    );
  });

  // 10. Zod Payload Schema Normalization
  test("Zod Schema: Normalizes roll number and names to uppercase", () => {
    const rawPayload = {
      contactDetails: {
        contactName: "Prof. Rajesh Sharma",
        contactEmail: "sports@iiitdm.ac.in",
        contactPhone: "9876543210",
        notes: "Contingent arrives 18th Dec",
      },
      students: [
        { rollNumber: "  2023bcs001  ", name: "  rahul sharma  ", gender: "M" },
      ],
      entries: [
        { sportId: "CRICKET", eventId: "TEAM", gender: "M", rollNumber: "  2023bcs001  ", isReserve: false },
      ]
    };

    const parsed = registrationSubmitSchema.parse(rawPayload);
    assert.strictEqual(parsed.students[0].rollNumber, "2023BCS001");
    assert.strictEqual(parsed.students[0].name, "RAHUL SHARMA");
    assert.strictEqual(parsed.entries[0].rollNumber, "2023BCS001");
    assert.strictEqual(parsed.entries[0].sportId, "cricket");
    assert.strictEqual(parsed.entries[0].eventId, "team");
  });

  // 11. CSV Escaping and Formatting Test
  test("CSV Generator: Proper RFC 4180 escaping for quotes and commas", () => {
    const headers = ["IIIT Name", "Student Name", "Notes"];
    const rows = [
      ['IIITDM Kancheepuram', 'RAHUL "THE FLASH" SHARMA', 'Arrives early, needs coach pass'],
      ['IIIT Allahabad', 'PRIYA VERMA', 'Normal arrival'],
    ];

    const csv = formatCsv(headers, rows);
    assert.ok(csv.includes('"RAHUL ""THE FLASH"" SHARMA"'));
    assert.ok(csv.includes('"Arrives early, needs coach pass"'));
    assert.ok(csv.includes("IIIT Allahabad,PRIYA VERMA,Normal arrival"));
  });

  // 12. Payment Validation Zod Tests
  test("TEST PAYMENT SCHEMA: Valid details accepted, missing rejected", () => {
    const basePayload = {
      paymentDetails: {
        transactionDate: new Date().toISOString().split("T")[0],
        transactionId: "TX123",
        paymentMode: "NEFT",
        proofPathname: "payment-proofs/test/1.pdf",
      }
    };

    // Valid details accepted
    assert.strictEqual(paymentSubmitSchema.safeParse(basePayload).success, true, "Valid payment details accepted");

    // Bank name optional
    const withBank = JSON.parse(JSON.stringify(basePayload));
    withBank.paymentDetails.bankName = "SBI";
    assert.strictEqual(paymentSubmitSchema.safeParse(withBank).success, true, "Bank name optional");

    // Missing TX ID rejected
    const noTx = JSON.parse(JSON.stringify(basePayload));
    delete noTx.paymentDetails.transactionId;
    assert.strictEqual(paymentSubmitSchema.safeParse(noTx).success, false, "Missing transaction ID rejected");

    // Missing paymentMode rejected
    const noMode = JSON.parse(JSON.stringify(basePayload));
    delete noMode.paymentDetails.paymentMode;
    assert.strictEqual(paymentSubmitSchema.safeParse(noMode).success, false, "Missing payment mode rejected");

    // Invalid paymentMode rejected
    const invalidMode = JSON.parse(JSON.stringify(basePayload));
    invalidMode.paymentDetails.paymentMode = "CASH";
    assert.strictEqual(paymentSubmitSchema.safeParse(invalidMode).success, false, "Invalid payment mode rejected");

    // OTHER with otherPaymentMode succeeds
    const otherModeSuccess = JSON.parse(JSON.stringify(basePayload));
    otherModeSuccess.paymentDetails.paymentMode = "OTHER";
    otherModeSuccess.paymentDetails.otherPaymentMode = "Demand Draft";
    assert.strictEqual(paymentSubmitSchema.safeParse(otherModeSuccess).success, true, "OTHER with otherPaymentMode succeeds");

    // OTHER without otherPaymentMode fails
    const otherModeFail = JSON.parse(JSON.stringify(basePayload));
    otherModeFail.paymentDetails.paymentMode = "OTHER";
    assert.strictEqual(paymentSubmitSchema.safeParse(otherModeFail).success, false, "OTHER without otherPaymentMode fails");

    // Missing Date rejected
    const noDate = JSON.parse(JSON.stringify(basePayload));
    delete noDate.paymentDetails.transactionDate;
    assert.strictEqual(paymentSubmitSchema.safeParse(noDate).success, false, "Missing transaction date rejected");

    // Future Date rejected
    const futureDate = JSON.parse(JSON.stringify(basePayload));
    futureDate.paymentDetails.transactionDate = new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0]; // 2 days future
    assert.strictEqual(paymentSubmitSchema.safeParse(futureDate).success, false, "Future transaction date rejected");

    // Invalid Calendar Date rejected
    const invalidDate = JSON.parse(JSON.stringify(basePayload));
    invalidDate.paymentDetails.transactionDate = "2026-99-99";
    assert.strictEqual(paymentSubmitSchema.safeParse(invalidDate).success, false, "Invalid calendar date rejected");

    // Missing Proof rejected
    const noProof = JSON.parse(JSON.stringify(basePayload));
    delete noProof.paymentDetails.proofPathname;
    assert.strictEqual(paymentSubmitSchema.safeParse(noProof).success, false, "Missing proof rejected");
  });

  // Database Integration Tests
  await testAsync("DATABASE TESTS: Submit Registration and Payment", async () => {
    process.env.NODE_ENV = "test";

    const { submitRegistration, submitPayment } = await import("../src/lib/registration/service.js");
    const { getDb } = await import("../src/db/index.js");
    const { registrations, users } = await import("../src/db/schema.js");
    const { eq } = await import("drizzle-orm");

    const db = getDb();

    // Ensure test user exists
    await db.insert(users).values({ username: "test-payment-iiit", iiitCode: "test-payment-iiit", iiitName: "Test Payment IIIT", passwordHash: "dummy", role: "iiit" }).onConflictDoNothing();

    // Cleanup prior test run data
    await db.delete(registrations).where(eq(registrations.iiitCode, "test-payment-iiit"));

    const regPayload = {
      contactDetails: { contactName: "A", contactEmail: "a@a.com", contactPhone: "123456" },
      students: [
        { rollNumber: "R1", name: "STUDENT 1", gender: "M" },
        { rollNumber: "R2", name: "STUDENT 2", gender: "M" }
      ],
      entries: [
        { sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R1", isReserve: false },
        { sportId: "volleyball", eventId: "team", gender: "M", rollNumber: "R1", isReserve: false }, // Same student, multiple events
        { sportId: "cricket", eventId: "team", gender: "M", rollNumber: "R2", isReserve: false },
      ]
    };

    const paymentPayload = {
      paymentDetails: {
        transactionDate: new Date().toISOString().split("T")[0],
        transactionId: "TX123",
        paymentMode: "UPI",
        proofPathname: "payment-proofs/test-payment-iiit/proof.pdf",
      }
    };

    // First submit registration
    const regResult = await submitRegistration("test-payment-iiit", regPayload, "admin");
    assert.strictEqual(regResult.status, "payment_pending", "Registration should be payment_pending");

    // Invalid Proof (Type) during payment
    const invalidType = JSON.parse(JSON.stringify(paymentPayload));
    invalidType.paymentDetails.proofPathname = "payment-proofs/test-payment-iiit/invalid-type.txt";
    try {
      await submitPayment("test-payment-iiit", invalidType, "admin");
      throw new Error("Should have rejected");
    } catch (e) {
      if (!e.message.match(/Payment proof must be a PDF, JPG, or PNG/)) {
        console.error("ACTUAL ERROR:", e.message);
        throw e;
      }
    }

    // Too Large
    const tooLarge = JSON.parse(JSON.stringify(paymentPayload));
    tooLarge.paymentDetails.proofPathname = "payment-proofs/test-payment-iiit/too-large.pdf";
    await assert.rejects(submitPayment("test-payment-iiit", tooLarge, "admin"), /exceeds 5MB limit/, ">5 MB proof rejected");

    // Cross-IIIT tampering
    const crossIiit = JSON.parse(JSON.stringify(paymentPayload));
    crossIiit.paymentDetails.proofPathname = "payment-proofs/other-iiit/proof.pdf";
    await assert.rejects(submitPayment("test-payment-iiit", crossIiit, "admin"), /does not belong to your IIIT/, "IIIT cannot access another IIIT's proof during submit");

    // Successful Submit Payment
    const result = await submitPayment("test-payment-iiit", paymentPayload, "admin");
    assert.strictEqual(result.amountPaid, 5000, "Amount calculated correctly from saved registration");
    assert.strictEqual(result.status, "submitted", "Payment should permanently lock to submitted");

    // Duplicate Payment Rejected
    await assert.rejects(submitPayment("test-payment-iiit", paymentPayload, "admin"), /Payment has already been submitted/, "Duplicate final submission rejected");

    // Cleanup
    await db.delete(registrations).where(eq(registrations.iiitCode, "test-payment-iiit"));
    process.env.NODE_ENV = "development";
  });

  console.log("\n=========================================");
  console.log(`ðŸ TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
