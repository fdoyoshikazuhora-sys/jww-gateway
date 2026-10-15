import assert from "node:assert/strict";
import { test } from "node:test";
import { auditJwfBytes, createJwfActivationProbe } from "./jwfAudit.js";
import { encodeJwfText, decodeJwfBytes, parseJwfBytes, parseJwfText, openJwfProfile, updateJwfProfileEntry, saveJwfProfile } from "./jwf.js";

test("JWF audit separates active, commented, END-blocked and documentation rows", () => {
  const source = encodeJwfText("# Explanation\r\nLCOLLOR_1 = 1 2 3 1\r\n# P_dpi = 600\r\nEND\r\n# R_STR0_00 = 303.03 1 1 1 0 ,unit,\r\nLCOLLOR_2 = 4 5 6 1\r\n#END\r\n100 = command catalog\r\n");
  const audit = auditJwfBytes(source);
  assert.equal(audit.firstEndLine, 4);
  assert.equal(audit.summary.activeRows, 1);
  assert.equal(audit.summary.commentedRows, 2);
  assert.equal(audit.summary.afterEndRows, 1);
  assert.deepEqual(audit.rows.map((row) => row.state), ["active-assignment", "commented-assignment", "commented-assignment", "after-END"]);
  assert.deepEqual(audit.controls.map((row) => row.kind), ["end", "commented-end"]);
  assert.equal(audit.otherLines[0].kind, "numeric-reference-row");
  assert.equal(parseJwfBytes(source).entryCount, 1);
  assert.equal(audit.lineCount, audit.rows.length + audit.controls.length + audit.summary.commentCount + audit.summary.blankCount + audit.otherLines.length);
});

test("JWF audit preserves duplicate and alternative rows instead of collapsing them", () => {
  const source = encodeJwfText("R_STR0_00 = 1000 0 0 0 0 ,m,\n#R_STR0_00 = 1000000 1 1 1 0 ,Km,\n#R_STR0_00 = 303.03 1 1 1 0 ,unit,\n");
  const audit = auditJwfBytes(source);
  assert.equal(audit.rows.length, 3);
  for (const row of audit.rows) assert.deepEqual(row.sameKeyLines, [1, 2, 3]);
  assert.equal(audit.summary.uniqueKeys, 1);
});

test("isolated activation changes only one comment byte and preserves Japanese source bytes", () => {
  const source = encodeJwfText("# documentation\r\nEND\r\n\t# R_STR0_00 = 303.03 1 1 1 0 ,\u5c3a, # keep\r\nLCOLLOR_2 = 1 2 3 1\r\n");
  const original = source.slice();
  const probe = createJwfActivationProbe(source, { line: 3, expectedKey: "R_STR0_00", reviewed: true, loadMode: "manual" });
  assert.deepEqual(source, original);
  const expected = Array.from(probe.inactiveBytes);
  assert.equal(expected.splice(probe.manifest.removedCommentByteOffset, 1)[0], 35);
  assert.deepEqual(probe.activeBytes, Uint8Array.from(expected));
  assert.deepEqual(parseJwfBytes(probe.inactiveBytes).keys, []);
  assert.deepEqual(parseJwfBytes(probe.activeBytes).keys, ["R_STR0_00"]);
  assert.match(decodeJwfBytes(probe.activeBytes), /\u5c3a/);
  assert.equal(probe.manifest.inactiveProfileResetsSetting, false);
  assert.equal(probe.manifest.restoreIdenticalBaselineBeforeEachArm, true);
});

test("probes require reviewed line identity and never remove END or explanation markers", () => {
  const source = encodeJwfText("# note\r\n#END\r\n# P_dpi = 600\r\n");
  const options = { expectedKey: "P_dpi", reviewed: true, loadMode: "manual" };
  for (const line of [1, 2, 99]) assert.throws(() => createJwfActivationProbe(source, { ...options, line }), /line\/key/);
  assert.throws(() => createJwfActivationProbe(source, { ...options, line: 3, reviewed: false }), /Review/);
  assert.throws(() => createJwfActivationProbe(source, { ...options, line: 3, expectedKey: "OTHER" }), /line\/key/);
});

test("unverified keys and external-reference examples are not automatically activated", () => {
  for (const key of ["UNKNOWN", "TNKZ_SET", "REF_FILE"]) {
    const source = encodeJwfText(`#${key}=1\r\n`);
    assert.throws(() => createJwfActivationProbe(source, { line: 1, expectedKey: key, reviewed: true, loadMode: "manual" }), /unverified/);
  }
});

test("startup-only rows cannot be scheduled as manual-load probes", () => {
  for (const key of ["S_COMM_0", "S_MESH_0"]) {
    const source = encodeJwfText(`#${key}=0\r\n`);
    assert.throws(() => createJwfActivationProbe(source, { line: 1, expectedKey: key, reviewed: true, loadMode: "manual" }), /startup/);
    assert.equal(createJwfActivationProbe(source, { line: 1, expectedKey: key, reviewed: true, loadMode: "startup" }).manifest.loadMode, "startup");
  }
});

test("line offsets remain correct for CRLF, LF and CR input", () => {
  for (const separator of ["\r\n", "\n", "\r"]) {
    const bytes = encodeJwfText(["# comment", "#P_dpi = 600", "END"].join(separator), { preserveLineEndings: true });
    const audit = auditJwfBytes(bytes);
    assert.equal(audit.rows[0].line, 2);
    assert.equal(audit.firstEndLine, 3);
    const row = audit.rows[0];
    assert.equal(decodeJwfBytes(bytes.slice(row.start, row.contentEnd)), "#P_dpi = 600");
  }
});

test("malformed encodings are rejected instead of silently replacing characters", () => {
  const invalid = Uint8Array.from([...encodeJwfText("#P_dpi = 600\r\n#"), 0x81]);
  assert.throws(() => auditJwfBytes(invalid), /Invalid Shift_JIS.*2/);
  for (const prefix of [[0xef, 0xbb, 0xbf], [0xff, 0xfe], [0xfe, 0xff]]) {
    assert.throws(() => auditJwfBytes(Uint8Array.from([...prefix, ...encodeJwfText("#P_dpi=600")])), /Unicode BOM/);
  }
});

test("reference-backed definitions distinguish coordinate output, calculation and ten angle slots", () => {
  const parsed = parseJwfText("ZF_SET=3 -1 0 0 0 0\nCU_SET=1 0 3 2 1 1 0 1 11\nS_SET5=0 15 30 45 60 75 90 105 120 135\n");
  assert.equal(parsed.entries.ZF_SET.definition.label, "coordinate file input / output setting");
  assert.deepEqual(parsed.entries.ZF_SET.definition.valueSchema, ["coordinateDecimalPlaces", "angleDecimalPlaces", "meterUnits", "writeYX", "tabSeparator", "initializeReferenceFromFirstRecord"]);
  assert.equal(parsed.entries.CU_SET.definition.valueSchema[1], "angleUnit");
  assert.equal(parsed.entries.CU_SET.definition.valueSchema[6], "rounding");
  assert.equal(parsed.entries.CU_SET.definition.valueSchema[8], "calculationOptionsPacked");
  assert.equal(parsed.entries.S_SET5.definition.valueSchema.length, 10);
  assert.equal(parsed.entries.S_SET5.values.length, 10);
});

test("unit presets retain their mixed separators and Japanese content across edit/save/read", () => {
  for (const unit of ["Km", "\u5c3a", "\uff4d", ""]) {
    const bytes = encodeJwfText(`R_STR0_00 = 1000 0 0 0 0 ,${unit}, # \u5358\u4f4d\r\n#R_STR0_00 = 303.03 1 1 1 0 ,other,\r\nEND\r\n`);
    const profile = openJwfProfile(bytes);
    assert.deepEqual(saveJwfProfile(profile).bytes, bytes);
    assert.deepEqual(profile.parsed.entries.R_STR0_00.values, ["1000 0 0 0 0", unit, ""]);
    const edited = updateJwfProfileEntry(profile, "R_STR0_00", ["303.03 1 1 1 0", unit, ""]);
    const saved = saveJwfProfile(edited);
    assert.match(decodeJwfBytes(saved.bytes), /R_STR0_00 = 303\.03 1 1 1 0 ,/);
    assert.match(decodeJwfBytes(saved.bytes), /# \u5358\u4f4d\r\n#R_STR0_00/);
    assert.equal(openJwfProfile(saved.bytes).parsed.entryCount, 1);
    assert.deepEqual(openJwfProfile(saved.bytes).parsed.entries.R_STR0_00.values, ["303.03 1 1 1 0", unit, ""]);
  }
});

test("unit preset serialization rejects ambiguous layouts without modifying the profile", () => {
  const profile = openJwfProfile(encodeJwfText("R_STR0_00 = 1000 0 0 0 0\r\nEND\r\n"));
  const original = profile.text;
  assert.match(updateJwfProfileEntry(profile, "R_STR0_00", [303.03, 1, 1, 1, 0]).text, /303\.03 1 1 1 0/);
  for (const values of [["bad 1 1 1 0", "m", ""], ["1000 1 1 1 0", "m,other", ""], [1, 2], ["1000 1 1 1 0", "m", "extra"]]) {
    assert.throws(() => updateJwfProfileEntry(profile, "R_STR0_00", values), /Unverified R_STR0_00/);
  }
  assert.equal(profile.text, original);
});
