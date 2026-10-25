import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

let dir;
let storage;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "proofs-"));
  process.env.PROOF_STORAGE = "local";
  process.env.PROOF_STORAGE_DIR = dir;
  storage = await import("../src/lib/storage/index.js");
});

after(async () => {
  delete process.env.PROOF_STORAGE;
  delete process.env.PROOF_STORAGE_DIR;
  await rm(dir, { recursive: true, force: true });
});

const key = (code = "iiit-kota", ext = "pdf") => `payment-proofs/${code}/${randomUUID()}.${ext}`;
const readStream = async (stream) => Buffer.from(await new Response(stream).arrayBuffer());

describe("local proof storage", () => {
  test("stores, reads back, lists and deletes a proof", async () => {
    const k = key();
    const bytes = Buffer.from("%PDF-1.4 receipt");
    await storage.putProof(k, bytes, "application/pdf");

    assert.deepEqual(await storage.headProof(k), { pathname: k, contentType: "application/pdf", size: bytes.length });
    const proof = await storage.getProof(k);
    assert.equal(proof.contentType, "application/pdf");
    assert.deepEqual(await readStream(proof.body), bytes);
    assert.deepEqual(await storage.listProofs("payment-proofs/iiit-kota/"), [k]);

    await storage.deleteProof(k);
    assert.deepEqual(await storage.listProofs("payment-proofs/iiit-kota/"), []);
    await storage.deleteProof(k); // deleting twice is harmless
  });

  test("files are private to the server user", async () => {
    const k = key("iiit-una", "png");
    await storage.putProof(k, Buffer.from([137, 80, 78, 71]), "image/png");
    const file = path.join(dir, ...k.split("/"));
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.equal((await stat(path.dirname(file))).mode & 0o777, 0o700);
    assert.equal((await storage.headProof(k)).contentType, "image/png");
  });

  test("missing proofs are reported as not found", async () => {
    await assert.rejects(storage.headProof(key()), (error) => error.statusCode === 404);
    await assert.rejects(storage.getProof(key()), (error) => error.statusCode === 404);
    assert.deepEqual(await storage.listProofs("payment-proofs/never-uploaded/"), []);
  });

  test("keys cannot escape the storage folder", async () => {
    await writeFile(path.join(dir, "..", `outside-${path.basename(dir)}.pdf`), "secret").catch(() => {});
    for (const bad of [
      "../etc/passwd",
      "payment-proofs/../../etc/passwd",
      `payment-proofs/iiit-kota/../../${randomUUID()}.pdf`,
      "payment-proofs/iiit-kota/%2e%2e.pdf",
      `/etc/${randomUUID()}.pdf`,
      `payment-proofs/IIIT-KOTA/${randomUUID()}.pdf`,
      `payment-proofs/iiit-kota/${randomUUID()}.html`,
      "",
      null,
    ]) {
      await assert.rejects(storage.headProof(bad), (error) => error.statusCode === 404, String(bad));
      await assert.rejects(storage.putProof(bad, Buffer.from("x")), (error) => error.statusCode === 404, String(bad));
    }
    assert.deepEqual(await storage.listProofs("payment-proofs/../"), []);
    assert.deepEqual(await storage.listProofs("../"), []);
  });

  test("a failed write leaves no partial or temporary file", async () => {
    const k = key("iiit-pune");
    await storage.putProof(k, Buffer.from("first"));
    await storage.putProof(k, Buffer.from("second"));
    const files = await readdir(path.join(dir, "payment-proofs", "iiit-pune"));
    assert.deepEqual(files, [path.basename(k)]);
    assert.equal((await readStream((await storage.getProof(k)).body)).toString(), "second");
  });

  test("preflight refuses a folder inside the app, where deploys would delete it", async () => {
    process.env.PROOF_STORAGE_DIR = path.join(process.cwd(), "uploads-inside-app");
    try {
      await assert.rejects(storage.checkStorage(), /outside the app folder/);
    } finally {
      process.env.PROOF_STORAGE_DIR = dir;
    }
    assert.match(await storage.checkStorage(), /server folder/);
    assert.deepEqual((await readdir(dir)).filter((name) => name.startsWith(".env-check")), []);
  });

  test("rejects an unknown storage mode", () => {
    process.env.PROOF_STORAGE = "ftp";
    try {
      assert.throws(() => storage.storageMode(), /must be "local" or "neon"/);
    } finally {
      process.env.PROOF_STORAGE = "local";
    }
  });
});
