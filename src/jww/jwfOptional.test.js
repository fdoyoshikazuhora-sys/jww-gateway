import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { JWF_OPTIONAL_KEYS } from "./jwfOptional.js";
import { encodeJwfText, decodeJwfBytes, parseJwfText, parseJwfBytes, openJwfProfile, updateJwfProfileEntry, saveJwfProfile, validateJwfText } from "./jwf.js";
import { auditJwfBytes, createJwfActivationProbe } from "./jwfAudit.js";

const cases = {
  LD2_RV: "1 1 1 1 1 1 1 1 1 1 1 1",
  RD2_RV: "1 1 1 1 1 1 1 1 1 1 1 1",
  COM_RV01: "0 3 3 3 3 3 3 3 3 3", COM_RV11: "3 0 0 3 0 3 3 3 3 3",
  COM_RV21: "3 3 3 3 0 3 0 0 3 0", COM_RV31: "0 0 0 0 3 0 0 3 0 0", COM_RV41: "0 3 3", COM_RV_C: "23",
  R_CROSS_ST1: "0 0 7 0", R_CROSS_ST2: "0 1 0 5", R_CROSS_ST3: "0 5 -2 7",
  R_CROSS_ST4: "6 1 6 4", R_CROSS_ST5: "1 3 6 3", R_CROSS_ST6: "4 4 7 7",
  TNKZ_SET: "25 1 0 3 302 20 11 201 100",
  TNK3_NM1: "\u57fa\u6e96\u5efa\u7269\u7528", TNK3_NM2: "\u8a08\u753b\u5efa\u7269\u7528",
  TNKN_SET: "\u25a1^w,,\u25cb^w,,[,],<,>", REF_FILE: "test reference.txt",
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("the optional audit explicitly tracks exactly nineteen reviewed keys", () => {
  assert.equal(JWF_OPTIONAL_KEYS.length, 19);
  assert.deepEqual(new Set(Object.keys(cases)), new Set(JWF_OPTIONAL_KEYS));
});
for (const [key, raw] of Object.entries(cases)) {
  test(`${key}: definition, no-op bytes/hash, edit/export/parse and inactive isolation`, () => {
    const source = encodeJwfText(`# keep\r\n${key} = ${raw}\r\n#${key} = ${raw}\r\nEND\r\n${key} = inactive\r\n`);
    const profile = openJwfProfile(source);
    assert.equal(profile.validation.ok, true);
    assert.deepEqual(saveJwfProfile(profile).bytes, source);
    assert.equal(hash(saveJwfProfile(profile).bytes), hash(source));
    const entry = profile.parsed.entries[key];
    assert.equal(entry.definition.evidence.nativeEvidence, ["TNKZ_SET", "TNK3_NM1", "TNK3_NM2", "TNKN_SET"].includes(key) ? "partial" : "unverified");
    assert.equal(entry.definition.scope, "unknown");
    const changedValues = [...entry.values];
    if (key === "TNKZ_SET") changedValues[0] = 50;
    else if (key === "REF_FILE") changedValues[0] = "changed reference.txt";
    else if (/^TNK3_NM/.test(key)) changedValues[0] = "Building 001";
    else if (key === "TNKN_SET") changedValues[0] = "R";
    else if (/^COM_RV\d/.test(key)) changedValues[changedValues.indexOf(3)] = 1;
    else if (key === "COM_RV_C") changedValues[0] = 15;
    else if (/^R_CROSS_ST/.test(key)) changedValues[0] += 1;
    else changedValues[0] = 0;
    const revised = updateJwfProfileEntry(profile, key, changedValues);
    assert.notDeepEqual(changedValues, entry.values);
    assert.deepEqual(parseJwfBytes(saveJwfProfile(revised).bytes).entries[key].values, changedValues);
    assert.ok(revised.text.includes(`#${key} = ${raw}`));
    const audit = auditJwfBytes(source);
    assert.equal(audit.rows[0].definitionEvidence.sourceVersion, "Jw_cad 10.02.1");
    const options = { line: 3, expectedKey: key, reviewed: true, loadMode: "manual" };
    if (key === "REF_FILE") {
      assert.throws(() => createJwfActivationProbe(source, options), /unverified/);
    } else {
      const probe = createJwfActivationProbe(source, options);
      assert.equal(parseJwfBytes(probe.inactiveBytes).entryCount, 0);
      assert.deepEqual(parseJwfBytes(probe.activeBytes).keys, [key]);
      assert.equal(probe.manifest.nativeEvidence, "not-run");
      const expected = Array.from(probe.inactiveBytes);
      expected.splice(probe.manifest.removedCommentByteOffset, 1);
      assert.deepEqual(Array.from(probe.activeBytes), expected);
    }
    assert.equal(hash(source), hash(profile.originalBytes));
  });
}

test("optional strings preserve numeric-looking names, spaces, case and empty affixes", () => {
  for (const [key, value, expected] of [
    ["TNK3_NM1", "001", ["001"]], ["TNK3_NM2", "Building A", ["Building A"]],
    ["REF_FILE", "C:\\test folder\\a,b.txt", ["C:\\test folder\\a,b.txt"]],
    ["TNKN_SET", "01,,ab,,[,],<,>", ["01", "", "ab", "", "[", "]", "<", ">"]],
  ]) {
    const profile = openJwfProfile(encodeJwfText(`${key}=${value}\nEND\n`));
    assert.deepEqual(profile.parsed.entries[key].values, expected);
    const edited = updateJwfProfileEntry(profile, key, expected);
    assert.deepEqual(parseJwfBytes(saveJwfProfile(edited).bytes).entries[key].values, expected);
    assert.ok(decodeJwfBytes(saveJwfProfile(edited).bytes).includes(`${key}=${value}`));
  }
});

test("invalid active optional settings fail before export or activation", () => {
  for (const row of [
    "LD2_RV=1 1", "RD2_RV=2 1 1 1 1 1 1 1 1 1 1 1", "COM_RV_C=26",
    "COM_RV41=1 3 3", "COM_RV01=0 4 3 3 3 3 3 3 3 3", "R_CROSS_ST1=0 0 x 7",
    "TNKZ_SET=9 1 0 3 302 20 11 201 100", "TNKZ_SET=25 12 0 3 302 20 11 201 100",
    "TNKZ_SET=25 1 0 3 302 0 11 201 100", "TNKN_SET=a,b", "REF_FILE=",
    `TNK3_NM1=${"\u5efa".repeat(11)}`, "TNKN_SET=1234567,,a,,b,,c,",
  ]) {
    assert.equal(validateJwfText(`${row}\nEND`).ok, false, row);
    assert.equal(validateJwfText(`#${row}\nEND`).ok, true, row);
    assert.equal(validateJwfText(`END\n${row}`).ok, true, row);
  }
  assert.throws(() => createJwfActivationProbe(encodeJwfText("#TNKZ_SET=1"), { line: 1, expectedKey: "TNKZ_SET", reviewed: true, loadMode: "manual" }), /Invalid activation values/);
});

test("unsupported escaping is rejected and unverified aliases remain undefined", () => {
  const profile = openJwfProfile(encodeJwfText("TNK3_NM1=old\nEND\n"));
  for (const value of ['a"b', "a#b", "a\nb"]) assert.throws(() => updateJwfProfileEntry(profile, "TNK3_NM1", [value]), /delimiter/);
  for (const key of ["CROSS_ST1", "R_CROSS_ST7", "R_CROSS_ST30"]) assert.equal(parseJwfText(`${key}=0 0 0 7`).entries[key].definition, null);
  const entry = parseJwfText("COM_RV41=0 3 3").entries.COM_RV41;
  entry.definition.valueSchema[0] = "line";
  assert.equal(validateJwfText("COM_RV41=1 3 3").ok, false);
});

test("TNK3_NM2 uses Shift_JIS bytes at the documented name boundary", () => {
  for (const [name, length] of [
    ["1234567890123456789", 19], ["12345678901234567890", 20], ["123456789012345678901", 21],
    ["\u8a08\u753b\u5efa\u7269\u691c\u8a3c", 12],
    ["\u6771\u4eac\u8a08\u753b\u5efa\u7269\u78ba\u8a8d\u8a66\u9a13", 20],
    ["1234567890123456789\u5efa", 21],
  ]) {
    assert.equal(encodeJwfText(name).length, length);
    const profile = openJwfProfile(encodeJwfText(`TNK3_NM2=${name}\r\nEND\r\n`));
    assert.equal(profile.validation.ok, length <= 20);
    assert.equal(profile.parsed.entries.TNK3_NM2.values[0], name);
    assert.equal(validateJwfText(`#TNK3_NM2=${name}\r\nEND\r\n`).ok, true);
    const baseline = openJwfProfile(encodeJwfText("TNK3_NM2=old\r\nEND\r\n"));
    if (length <= 20) {
      assert.deepEqual(saveJwfProfile(profile).bytes, profile.originalBytes);
      const changed = updateJwfProfileEntry(baseline, "TNK3_NM2", [name]);
      assert.equal(parseJwfBytes(saveJwfProfile(changed).bytes).entries.TNK3_NM2.values[0], name);
    } else {
      assert.throws(() => updateJwfProfileEntry(baseline, "TNK3_NM2", [name]));
    }
  }
});
