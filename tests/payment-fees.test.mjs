import { test } from "node:test";
import assert from "node:assert/strict";
import { getRegistrationFee, getRegistrationFeeBreakdown } from "../src/lib/registration/labels.js";

test("matches the CCAvenue fee example for one student", () => {
  assert.deepEqual(getRegistrationFeeBreakdown(1), {
    registrationFee: 2500,
    gst: 450,
    registrationWithGst: 2950,
    cautionDeposit: 25000,
    total: 27950,
  });
  assert.equal(getRegistrationFee(1), 27950);
});

test("applies GST to registration only and adds the deposit once per IIIT", () => {
  assert.equal(getRegistrationFee(2), 30900);
  assert.equal(getRegistrationFee(150), 467500);
  assert.equal(getRegistrationFeeBreakdown(150).cautionDeposit, 25000);
});
