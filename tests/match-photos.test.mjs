import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { detectImageType, photoBuckets, photoFileName } from "../src/lib/live/photos.js";
import { zipStream } from "../src/lib/live/zip.js";

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

test("photos are accepted only as JPEG or PNG, judged by their bytes", () => {
  assert.equal(detectImageType(JPEG), "image/jpeg");
  assert.equal(detectImageType(PNG), "image/png");
  assert.equal(detectImageType(new TextEncoder().encode("%PDF-1.7")), null);
  assert.equal(detectImageType(new TextEncoder().encode("<svg></svg>")), null);
  assert.equal(detectImageType(new Uint8Array()), null);
});

test("a match's photos go to both IIITs; an event's to every placed IIIT", () => {
  assert.deepEqual(photoBuckets({ kind: "versus", sideA: "iiitdm-kancheepuram", sideB: "iiit-allahabad" }), ["iiitdm-kancheepuram", "iiit-allahabad"]);
  assert.deepEqual(photoBuckets({ kind: "versus", sideA: "iiit-kota", sideB: null }), ["iiit-kota"]);
  assert.deepEqual(photoBuckets({ kind: "event" }, [{ iiitCode: "iiit-una" }, { iiitCode: "iiit-kota" }, { iiitCode: "iiit-una" }]), ["iiit-una", "iiit-kota"]);
  assert.deepEqual(photoBuckets({ kind: "event" }, []), []);
});

test("zip file names say when, what and who", () => {
  const match = {
    id: 12, kind: "versus", sportName: "Table Tennis", gender: "M", scheduledAt: "2026-12-19T03:30:00.000Z",
    sideA: { code: "iiitdm-kancheepuram" }, sideB: { code: "iiit-allahabad" },
  };
  assert.equal(photoFileName(match, 1, "image/jpeg"), "2026-12-19_table-tennis-men_iiitdm-kancheepuram-vs-iiit-allahabad_m12_1.jpg");
  // 23:00 UTC is the next day in IST.
  assert.equal(photoFileName({ ...match, kind: "event", eventName: "100 m", scheduledAt: "2026-12-19T23:00:00.000Z" }, 5, "image/png"), "2026-12-20_table-tennis-men_100-m_m12_5.png");
  assert.equal(photoFileName({ ...match, scheduledAt: null }, 2, "image/jpeg").slice(0, 8), "no-date_");
});

test("the zip opens in standard tools and holds the exact bytes", async () => {
  const one = new Uint8Array(70_000).map((_, i) => (i * 7) % 256);
  const entries = [
    { name: "a_1.jpg", date: new Date(2026, 11, 19, 9, 30), read: async () => JPEG },
    { name: "b_2.jpg", date: new Date(2026, 11, 19, 10, 0), read: async () => one },
    { name: "lost_3.jpg", date: new Date(), read: async () => { throw new Error("gone"); } },
  ];
  const bytes = new Uint8Array(await new Response(zipStream(entries)).arrayBuffer());
  const dir = mkdtempSync(path.join(tmpdir(), "zip-test-"));
  const file = path.join(dir, "photos.zip");
  writeFileSync(file, bytes);
  const script = `
import json, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
print(json.dumps({i.filename: [i.file_size, i.date_time[:5], list(z.read(i.filename)[:4])] for i in z.infolist()}))
`;
  const listing = JSON.parse(execFileSync("python3", ["-I", "-c", script, file], { encoding: "utf8" }));
  assert.deepEqual(Object.keys(listing), ["a_1.jpg", "b_2.jpg", "missing-files.txt"]);
  assert.deepEqual(listing["a_1.jpg"], [JPEG.length, [2026, 12, 19, 9, 30], [0xff, 0xd8, 0xff, 0xe0]]);
  assert.equal(listing["b_2.jpg"][0], one.length);
  assert.deepEqual(listing["b_2.jpg"][2], [...one.slice(0, 4)]);
});
