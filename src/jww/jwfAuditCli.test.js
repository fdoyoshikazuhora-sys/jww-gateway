import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, mkdir, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { encodeJwfText } from "./jwf.js";

const cli = fileURLToPath(new URL("../../tools/jwf-activation-audit.mjs", import.meta.url));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "jwf-audit-test-"));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("jwf-audit-test-"));
    await rm(directory, { recursive: true, force: true });
  });
  const source = encodeJwfText("# note\r\nEND\r\n#R_STR0_00 = 303.03 1 1 1 0 ,\u5c3a,\r\n");
  const input = path.join(directory, "input.jwf");
  const output = path.join(directory, "probe");
  await writeFile(input, source, { flag: "wx" });
  const args = [input, "--probe-line", "3", "--expect-key", "R_STR0_00", "--expect-sha256", digest(source), "--probe-dir", output, "--load-mode", "manual", "--reviewed"];
  return { directory, input, source, output, args, run: (argv) => spawnSync(process.execPath, [cli, ...argv], { encoding: "utf8" }) };
}

test("activation CLI pins source and output hashes and preserves the source", async (t) => {
  const f = await fixture(t);
  const result = f.run(f.args);
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(path.join(f.output, "manifest.json"), "utf8"));
  const inactive = await readFile(path.join(f.output, "inactive.jwf"));
  const active = await readFile(path.join(f.output, "active.jwf"));
  assert.equal(manifest.sourceSha256, digest(f.source));
  assert.equal(manifest.activeSha256, digest(active));
  assert.equal(manifest.inactiveSha256, digest(inactive));
  assert.deepEqual(active, Buffer.concat([inactive.subarray(0, manifest.removedCommentByteOffset), inactive.subarray(manifest.removedCommentByteOffset + 1)]));
  assert.deepEqual(await readFile(f.input), Buffer.from(f.source));
  assert.equal(manifest.nativeEvidence, "not-run");
});

test("activation CLI refuses changed source hashes and missing review before writing", async (t) => {
  const f = await fixture(t);
  const wrong = f.args.map((value) => value === digest(f.source) ? "0".repeat(64) : value);
  for (const args of [wrong, f.args.filter((value) => value !== "--reviewed")]) {
    const result = f.run(args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /hash differs|Review the source/);
    await assert.rejects(access(f.output), { code: "ENOENT" });
  }
});

test("activation CLI does not overwrite existing probe or report files", async (t) => {
  const f = await fixture(t);
  await mkdir(f.output);
  const active = path.join(f.output, "active.jwf");
  await writeFile(active, "protected content");
  assert.notEqual(f.run(f.args).status, 0);
  assert.equal(await readFile(active, "utf8"), "protected content");
  const result = f.run([f.input, "--output", f.input]);
  assert.notEqual(result.status, 0);
  assert.deepEqual(await readFile(f.input), Buffer.from(f.source));
});

test("activation CLI emits a complete row inventory without applying settings", async (t) => {
  const f = await fixture(t);
  const json = path.join(f.directory, "audit.json");
  const markdown = path.join(f.directory, "audit.md");
  assert.equal(f.run([f.input, "--output", json, "--markdown", markdown]).status, 0);
  const audit = JSON.parse(await readFile(json, "utf8"));
  assert.equal(audit.summary.commentedRows, 1);
  assert.equal(audit.firstEndLine, 2);
  assert.equal(audit.nativeEvidence, "not-run");
  assert.match(await readFile(markdown, "utf8"), /R_STR0_00/);
  await assert.rejects(access(f.output), { code: "ENOENT" });
});
