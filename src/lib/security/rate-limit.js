import { sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { httpError } from "./request.js";

/**
 * Fixed-window rate limiting stored in PostgreSQL so limits hold across
 * restarts and multiple app instances.
 */
export const LIMITS = {
  loginPerIp: { limit: 30, windowSeconds: 15 * 60 },
  loginPerAccount: { limit: 8, windowSeconds: 15 * 60 },
  upload: { limit: 20, windowSeconds: 60 * 60 },
  draftSave: { limit: 1500, windowSeconds: 60 * 60 },
  submit: { limit: 10, windowSeconds: 60 * 60 },
  adminWrite: { limit: 120, windowSeconds: 60 * 60 },
  download: { limit: 300, windowSeconds: 60 * 60 },
};

/**
 * Counts one hit for `key` and reports whether it is within the limit.
 * Returns { ok, count, retryAfter } where retryAfter is in seconds.
 */
export async function hit(key, { limit, windowSeconds }) {
  const db = getDb();
  const { rows } = await db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds})
                   THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start <= now() - make_interval(secs => ${windowSeconds})
                          THEN now() ELSE rate_limits.window_start END
    RETURNING count,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_start + make_interval(secs => ${windowSeconds}) - now()))))::int AS retry_after
  `);
  const row = rows[0];
  // Occasionally clear windows that expired more than a day ago.
  if (Math.random() < 0.01) {
    db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`).catch(() => {});
  }
  return { ok: row.count <= limit, count: row.count, retryAfter: row.retry_after };
}

/** Current count for `key` without adding a hit. */
export async function peek(key, { limit, windowSeconds }) {
  const db = getDb();
  const { rows } = await db.execute(sql`
    SELECT count,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_start + make_interval(secs => ${windowSeconds}) - now()))))::int AS retry_after
    FROM rate_limits
    WHERE key = ${key} AND window_start > now() - make_interval(secs => ${windowSeconds})
  `);
  const row = rows[0];
  if (!row) return { ok: true, count: 0, retryAfter: 0 };
  return { ok: row.count < limit, count: row.count, retryAfter: row.retry_after };
}

export async function reset(key) {
  await getDb().execute(sql`DELETE FROM rate_limits WHERE key = ${key}`);
}

/** Adds a hit and throws a 429 error when the limit is exceeded. */
export async function enforce(key, rule, message = "Too many requests. Please wait and try again.") {
  const result = await hit(key, rule);
  if (!result.ok) throw httpError(429, message, { retryAfter: result.retryAfter });
  return result;
}
