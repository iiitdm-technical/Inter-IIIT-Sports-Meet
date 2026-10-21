import { getDb } from "../../db/index.js";
import { auditLog } from "../../db/schema.js";

/**
 * Records a security-relevant action. Never throws: auditing must not break
 * the request it describes.
 */
export async function audit({ actor = null, role = null, action, target = null, ip = null, details = null }) {
  try {
    await getDb().insert(auditLog).values({
      actor: actor ? String(actor).slice(0, 254) : null,
      role,
      action,
      target: target ? String(target).slice(0, 128) : null,
      ip,
      details,
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}
