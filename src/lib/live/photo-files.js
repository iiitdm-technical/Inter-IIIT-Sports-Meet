import { inArray, isNull } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { matchPhotos } from "../../db/schema.js";
import { deleteProof } from "../storage/index.js";

/**
 * Removes the files of photos whose match was deleted. Deleting a match (one
 * by one, with a tournament, or with the sample data) sets match_id to NULL
 * on its photos; this sweep then deletes their files and rows. It runs in the
 * background after every live-results change and never throws.
 */
let running = false;
let again = false;

async function sweepOnce() {
  const db = getDb();
  const rows = await db.select({ id: matchPhotos.id, storageKey: matchPhotos.storageKey, thumbKey: matchPhotos.thumbKey })
    .from(matchPhotos).where(isNull(matchPhotos.matchId)).limit(500);
  for (const row of rows) {
    await deleteProof(row.storageKey);
    if (row.thumbKey !== row.storageKey) await deleteProof(row.thumbKey);
  }
  if (rows.length) {
    await db.delete(matchPhotos).where(inArray(matchPhotos.id, rows.map((row) => row.id)));
  }
  return rows.length;
}

export function sweepDetachedPhotos() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  (async () => {
    try {
      do {
        again = false;
        // A full batch means more may be waiting.
        if ((await sweepOnce()) === 500) again = true;
      } while (again);
    } catch (error) {
      console.error("Could not remove photos of deleted matches:", error.message);
    } finally {
      running = false;
    }
  })();
}
