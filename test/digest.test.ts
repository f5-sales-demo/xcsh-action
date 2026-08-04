import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  normalizeSha256,
  sha256File,
  verifyFileSha256,
} from "../src/digest.js";

test("hashes and verifies downloaded bytes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "xcsh-digest-test-"));
  const file = path.join(directory, "asset");
  await writeFile(file, "xcsh\n", "utf8");
  const digest =
    "22b5658643265117773235934c1b8903f1329debe2d776d742e3fcb399c08f64";
  assert.equal(await sha256File(file), digest);
  await verifyFileSha256(file, `sha256:${digest}`);
  await assert.rejects(
    verifyFileSha256(file, "0".repeat(64)),
    /SHA-256 mismatch/u,
  );
});

test("rejects malformed SHA-256 metadata", () => {
  assert.throws(() => normalizeSha256("sha256:abc"), /Invalid SHA-256/u);
});
