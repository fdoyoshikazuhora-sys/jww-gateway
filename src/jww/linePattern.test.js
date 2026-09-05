import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeLinePattern, encodeLinePattern } from "../../apps/jww-basic-settings/line-pattern.js";
import { encodeJwfText, openJwfProfile, saveJwfProfile, updateJwfProfileEntry } from "./jwf.js";

test("32 editable positions round-trip without reversing bits or losing leading zeroes", () => {
  for (const random of [false, true]) {
    for (const hex of ["00000000", "00000001", "80000000", "ffffffff", "99999999", "ccb2b32a"]) {
      const pattern = decodeLinePattern(hex, random);
      assert.equal(pattern.length, 32);
      assert.equal(encodeLinePattern(pattern, random), hex);
    }
  }
  assert.equal(decodeLinePattern("80000000"), "-" + " ".repeat(31));
  assert.equal(decodeLinePattern("80000000", true), "'" + ",".repeat(31));
  for (const pattern of ["-", "-".repeat(33), "x".repeat(32)]) {
    assert.throws(() => encodeLinePattern(pattern));
  }
  assert.throws(() => encodeLinePattern("-".repeat(32), true));
});

test("edited ordinary and five random patterns survive JWF export and reopen", () => {
  const keys = ["LTYPE_02", ...Array.from({ length: 5 }, (_, i) => `LTYPE_R${i + 1}`)];
  const source = keys.map((key, i) => `${key} = ccb2b32a ${i ? "1 5 3 10" : "4 1 10"}`).join("\r\n") + "\r\nEND\r\n";
  let profile = openJwfProfile(encodeJwfText(source));
  const before = keys.map(key => profile.parsed.entries[key].values.slice(1));
  keys.forEach((key, i) => {
    const pattern = i ? "',".repeat(16) : "- ".repeat(16);
    profile = updateJwfProfileEntry(profile, key, [encodeLinePattern(pattern, i > 0), ...before[i]]);
  });
  const reopened = openJwfProfile(saveJwfProfile(profile).bytes);
  keys.forEach((key, i) => {
    assert.equal(decodeLinePattern(reopened.parsed.entries[key].values[0], i > 0), i ? "',".repeat(16) : "- ".repeat(16));
    assert.deepEqual(reopened.parsed.entries[key].values.slice(1), before[i]);
  });
});
