import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../db/index.js";
import { eventPlacings, matchPhotos, matches } from "../../db/schema.js";
import { httpError } from "../security/request.js";
import { getSportName } from "../registration/labels.js";
import { deleteProof, getProof, putProof } from "../storage/index.js";
import { LIVE_IIITS, PHOTOS_PER_MATCH, eventName, iiitName } from "./catalog.js";
import { genderLabel, toIstInput } from "./format.js";
import { scopeAllows } from "./service.js";

/**
 * Match photos. A coordinator uploads PHOTOS_PER_MATCH photos while a match
 * is live and cannot finish it without them. Each photo belongs to every
 * IIIT in its match (both sides, or every IIIT in an event's placings), so
 * the Sports SAC sees and downloads one folder per IIIT. Photos are private:
 * only the Sports SAC and coordinators of that sport can open them.
 *
 * The browser shrinks each photo before upload (longest side 1600 px) and
 * sends a small thumbnail with it; the server checks both by their bytes.
 */

const MB = 1024 * 1024;
export const MAX_PHOTO_BYTES = 4 * MB;
export const MAX_THUMB_BYTES = 512 * 1024;
export const PHOTO_STORAGE_MAX_BYTES = (Number(process.env.PHOTO_STORAGE_MAX_MB) || 1400) * MB;

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png" };

/** "image/jpeg" or "image/png" from the file's own bytes, otherwise null. */
export function detectImageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((part, index) => bytes[index] === part)) return "image/png";
  return null;
}

/** IIIT codes whose folder a match's photos go into. */
export function photoBuckets(match, placings = []) {
  const codes = match.kind === "event"
    ? placings.map((p) => p.iiitCode)
    : [match.sideA, match.sideB];
  return [...new Set(codes.filter(Boolean))];
}

function describeMatch(row) {
  return {
    id: row.id,
    sportId: row.sportId,
    sportName: getSportName(row.sportId),
    gender: row.gender,
    kind: row.kind,
    eventName: row.eventId ? eventName(row.sportId, row.gender, row.eventId) : null,
    sideA: row.sideA ? { code: row.sideA, name: iiitName(row.sideA) } : null,
    sideB: row.sideB ? { code: row.sideB, name: iiitName(row.sideB) } : null,
    round: row.round,
    pool: row.pool || "",
    status: row.status,
    scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
  };
}

function describePhoto(row) {
  return {
    id: row.id,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

async function loadMatch(matchId) {
  const [row] = await getDb().select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!row) throw httpError(404, "Match not found");
  return row;
}

function checkScope(scope, row) {
  if (!scopeAllows(scope, row)) throw httpError(403, "You can only see photos of your own sports");
}

/** Photos of one match, oldest first. */
export async function listMatchPhotos(matchId, { scope }) {
  checkScope(scope, await loadMatch(matchId));
  const rows = await getDb().select().from(matchPhotos).where(eq(matchPhotos.matchId, matchId)).orderBy(asc(matchPhotos.id));
  return { photos: rows.map(describePhoto), required: PHOTOS_PER_MATCH };
}

/** Bytes used by all match photos, from the database. */
export async function photoStorageUsed() {
  const [row] = await getDb().select({ bytes: sql`COALESCE(SUM(${matchPhotos.sizeBytes}), 0)`, count: sql`COUNT(*)` }).from(matchPhotos);
  return { bytes: Number(row?.bytes || 0), count: Number(row?.count || 0) };
}

/**
 * Stores one photo (and its thumbnail) for a match. Coordinators add photos
 * while the match is live; the Sports SAC also after it has finished.
 */
export async function addMatchPhoto(matchId, { photo, thumb }, { actor, scope, isSuper }) {
  const match = await loadMatch(matchId);
  checkScope(scope, match);
  const allowed = match.status === "live" || (isSuper && match.status === "completed");
  if (!allowed) {
    throw httpError(400, isSuper ? "Add photos once the match has started" : "Photos can be added while the match is live");
  }

  if (!photo?.length) throw httpError(400, "Choose a photo");
  if (photo.length > MAX_PHOTO_BYTES) throw httpError(413, "The photo is too large; take it again or choose a smaller one");
  const type = detectImageType(photo);
  if (!type) throw httpError(400, "Upload the photo as a JPG or PNG");
  let thumbBytes = thumb?.length ? thumb : null;
  if (thumbBytes && (thumbBytes.length > MAX_THUMB_BYTES || detectImageType(thumbBytes) !== "image/jpeg")) thumbBytes = null;

  const size = photo.length + (thumbBytes?.length || 0);
  const used = await photoStorageUsed();
  if (used.bytes + size > PHOTO_STORAGE_MAX_BYTES) {
    console.error(`Match photo storage cap reached: ${used.bytes} bytes used of ${PHOTO_STORAGE_MAX_BYTES}`);
    throw httpError(409, "Photo storage is full. Tell the Sports SAC.");
  }

  // Quick check before writing files; the transaction below re-checks under a lock.
  const [{ count: before }] = await getDb().select({ count: sql`COUNT(*)` }).from(matchPhotos).where(eq(matchPhotos.matchId, matchId));
  if (Number(before) >= PHOTOS_PER_MATCH) throw httpError(409, `This match already has ${PHOTOS_PER_MATCH} photos. Remove one to add another.`);

  const id = randomUUID();
  const storageKey = `match-photos/${matchId}/${id}.${EXTENSIONS[type]}`;
  const thumbKey = thumbBytes ? `match-photos/${matchId}/${id}-t.jpg` : storageKey;
  await putProof(storageKey, photo, type);
  if (thumbBytes) await putProof(thumbKey, thumbBytes, "image/jpeg");

  try {
    const inserted = await getDb().transaction(async (tx) => {
      const [locked] = await tx.select({ id: matches.id, status: matches.status }).from(matches).where(eq(matches.id, matchId)).limit(1).for("update");
      if (!locked) throw httpError(404, "Match not found");
      if (!(locked.status === "live" || (isSuper && locked.status === "completed"))) throw httpError(400, "The match is no longer live");
      const [{ count }] = await tx.select({ count: sql`COUNT(*)` }).from(matchPhotos).where(eq(matchPhotos.matchId, matchId));
      if (Number(count) >= PHOTOS_PER_MATCH) throw httpError(409, `This match already has ${PHOTOS_PER_MATCH} photos. Remove one to add another.`);
      const [row] = await tx.insert(matchPhotos).values({ matchId, storageKey, thumbKey, contentType: type, sizeBytes: size, uploadedBy: actor }).$returningId();
      return { id: row.id, count: Number(count) + 1 };
    });
    return { photo: { id: inserted.id, sizeBytes: size, uploadedBy: actor, createdAt: new Date().toISOString() }, count: inserted.count, required: PHOTOS_PER_MATCH };
  } catch (error) {
    await deleteProof(storageKey).catch(() => {});
    if (thumbKey !== storageKey) await deleteProof(thumbKey).catch(() => {});
    throw error;
  }
}

async function loadPhoto(photoId) {
  const [row] = await getDb().select().from(matchPhotos).where(eq(matchPhotos.id, photoId)).limit(1);
  if (!row || !row.matchId) throw httpError(404, "Photo not found");
  return row;
}

/** Removes a photo: coordinators while the match is live, the Sports SAC any time. */
export async function deleteMatchPhoto(photoId, { scope, isSuper }) {
  const photo = await loadPhoto(photoId);
  const match = await loadMatch(photo.matchId);
  checkScope(scope, match);
  if (!isSuper && match.status !== "live") throw httpError(403, "Only the Sports SAC can remove photos of a finished match");
  await getDb().delete(matchPhotos).where(eq(matchPhotos.id, photoId));
  await deleteProof(photo.storageKey);
  if (photo.thumbKey !== photo.storageKey) await deleteProof(photo.thumbKey);
  return { id: photoId, matchId: photo.matchId };
}

/** The photo (or its thumbnail) as { body, contentType, size }, for someone allowed to see it. */
export async function readMatchPhoto(photoId, { scope, thumb = false }) {
  const photo = await loadPhoto(photoId);
  checkScope(scope, await loadMatch(photo.matchId));
  const file = await getProof(thumb ? photo.thumbKey : photo.storageKey);
  return { ...file, contentType: thumb && photo.thumbKey !== photo.storageKey ? "image/jpeg" : photo.contentType, photo };
}

/** Every photographed match with its photos and the IIITs it belongs to. */
async function photographedMatches() {
  const db = getDb();
  const photos = await db.select().from(matchPhotos).where(isNotNull(matchPhotos.matchId)).orderBy(asc(matchPhotos.id));
  if (!photos.length) return [];
  const ids = [...new Set(photos.map((p) => p.matchId))];
  const [rows, placings] = await Promise.all([
    db.select().from(matches).where(inArray(matches.id, ids)),
    db.select({ matchId: eventPlacings.matchId, iiitCode: eventPlacings.iiitCode }).from(eventPlacings).where(inArray(eventPlacings.matchId, ids)),
  ]);
  return rows
    .map((row) => ({
      row,
      buckets: photoBuckets(row, placings.filter((p) => p.matchId === row.id)),
      photos: photos.filter((p) => p.matchId === row.id),
    }))
    .sort((a, b) => (a.row.scheduledAt ? new Date(a.row.scheduledAt).getTime() : Infinity) - (b.row.scheduledAt ? new Date(b.row.scheduledAt).getTime() : Infinity) || a.row.id - b.row.id);
}

/** Folder per IIIT (all IIITs, empty ones too), with storage use. Sports SAC only. */
export async function photoFolders() {
  const list = await photographedMatches();
  const folders = LIVE_IIITS.map((iiit) => {
    const mine = list.filter((item) => item.buckets.includes(iiit.code));
    return { iiitCode: iiit.code, iiitName: iiit.name, matches: mine.length, photos: mine.reduce((sum, item) => sum + item.photos.length, 0) };
  });
  const used = await photoStorageUsed();
  const unassigned = list.filter((item) => item.buckets.length === 0).reduce((sum, item) => sum + item.photos.length, 0);
  return { folders, totalPhotos: used.count, totalBytes: used.bytes, capBytes: PHOTO_STORAGE_MAX_BYTES, unassigned, required: PHOTOS_PER_MATCH };
}

/** One IIIT's folder: its photographed matches, in play order. */
export async function folderContents(iiitCode) {
  if (!LIVE_IIITS.some((iiit) => iiit.code === iiitCode)) throw httpError(404, "Unknown IIIT");
  const list = await photographedMatches();
  return {
    iiitCode,
    iiitName: iiitName(iiitCode),
    matches: list.filter((item) => item.buckets.includes(iiitCode)).map((item) => ({ match: describeMatch(item.row), photos: item.photos.map(describePhoto) })),
  };
}

function slug(text) {
  return String(text || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";
}

/** File name inside a zip, e.g. 2026-12-19_football-men_iiitdm-kancheepuram-vs-iiit-allahabad_m12_1.jpg */
export function photoFileName(match, index, contentType) {
  const day = match.scheduledAt ? toIstInput(match.scheduledAt).slice(0, 10) : "no-date";
  const what = match.kind === "event"
    ? slug(match.eventName)
    : `${slug(match.sideA?.code || "tbd")}-vs-${slug(match.sideB?.code || "tbd")}`;
  return `${day}_${slug(match.sportName)}-${slug(genderLabel(match.gender))}_${what}_m${match.id}_${index}.${EXTENSIONS[contentType] || "jpg"}`;
}

/** Entries for zipStream: every photo in one IIIT's folder. */
export async function folderZipEntries(iiitCode) {
  if (!LIVE_IIITS.some((iiit) => iiit.code === iiitCode)) throw httpError(404, "Unknown IIIT");
  const list = (await photographedMatches()).filter((item) => item.buckets.includes(iiitCode));
  const entries = [];
  for (const item of list) {
    const match = describeMatch(item.row);
    item.photos.forEach((photo, index) => {
      entries.push({
        name: photoFileName(match, index + 1, photo.contentType),
        date: photo.createdAt ? new Date(photo.createdAt) : new Date(),
        read: async () => new Uint8Array(await new Response((await getProof(photo.storageKey)).body).arrayBuffer()),
      });
    });
  }
  return entries;
}

/** Photo counts for the given matches, for the scoring screen. */
export async function photoCounts(matchIds) {
  if (!matchIds.length) return {};
  const rows = await getDb().select({ matchId: matchPhotos.matchId, count: sql`COUNT(*)` })
    .from(matchPhotos).where(and(inArray(matchPhotos.matchId, matchIds))).groupBy(matchPhotos.matchId);
  return Object.fromEntries(rows.map((row) => [row.matchId, Number(row.count)]));
}
