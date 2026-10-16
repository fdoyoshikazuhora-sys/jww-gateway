import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildNativeProbePack, REMAINING_KEYS } from "../../tools/jwf-native-probe-pack.mjs";
import { parseJwfBytes, openJwfProfile, saveJwfProfile } from "./jwf.js";

test("native pack fails closed for unreviewed sources", () => {
  assert.throws(() => buildNativeProbePack(Buffer.from("#LD2_RV=1\r\nEND\r\n")), /Unreviewed/);
  assert.equal(REMAINING_KEYS.length, 17);
  assert.equal(new Set(REMAINING_KEYS).size, 17);
});

// The installed copyrighted sample is not bundled. Source-specific integration
// checks are explicit skips on machines without the reviewed source path.
const sourcePath = process.env.JWF_REVIEWED_SAMPLE;
test("reviewed native pack: one-key isolation, dependencies, hashes and unchanged exports", { skip: !sourcePath }, () => {
  const source = readFileSync(sourcePath);
  const sourceCopy = Buffer.from(source);
  const { files, manifest } = buildNativeProbePack(source);
  assert.deepEqual(source, sourceCopy);
  assert.equal(manifest.keyCount, 17);
  for (const record of manifest.files) {
    assert.equal(createHash("sha256").update(files.get(record.path)).digest("hex"), record.sha256);
  }
  for (const item of manifest.cases) {
    const offBytes = files.get(`${item.key}/off.jwf`), onBytes = files.get(`${item.key}/on.jwf`);
    const off = parseJwfBytes(offBytes), on = parseJwfBytes(onBytes);
    assert.equal(off.entries[item.key], undefined);
    assert.ok(on.entries[item.key]);
    assert.equal(offBytes.length, onBytes.length + 1);
    const offText = new TextDecoder("shift_jis").decode(offBytes);
    assert.equal(offText.replace(`#${item.arms[0].targetAssignment}`, item.arms[0].targetAssignment), new TextDecoder("shift_jis").decode(onBytes));
    for (const key of off.keys) assert.deepEqual(off.entries[key].values, on.entries[key].values);
    if (item.key.startsWith("R_CROSS_ST")) {
      assert.equal(off.keys.filter(k => k.startsWith("R_CROSS_ST")).length, 5);
      assert.equal(on.entries.R_STR0_00.values[0], "303.03  1   1   1   0");
    }
    for (const arm of item.arms) {
      const bytes = files.get(arm.path), profile = openJwfProfile(bytes);
      assert.equal(profile.validation.ok, true, arm.path);
      assert.deepEqual(saveJwfProfile(profile).bytes, new Uint8Array(bytes));
      assert.equal(arm.nativeStatus, "not-run");
      if (arm.name.startsWith("km-")) continue;
      for (const key of off.keys) assert.deepEqual(profile.parsed.entries[key].values, off.entries[key].values, arm.path);
    }
  }
  assert.ok(files.get("REF_FILE/reference.txt").includes(9));
  assert.equal(files.has("REF_FILE/missing-reference.txt"), false);
});
