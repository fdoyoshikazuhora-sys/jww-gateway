import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { openNativeJww, saveNativeJww } from "./native.js";
import { parseJwwDocumentHeader } from "./documentHeader.js";
import { buildJwwBytes, preflightJwwWrite } from "./writer.js";
import { buildJwwSemanticDiff } from "./semanticDiff.js";
import { convertJwwBytes } from "../../tools/jww-gateway.mjs";

const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const diameter = bytes => parseJwwDocumentHeader(bytes).fields.find(field => field.name === "m_dTenkuuZuDiameter").value;
const fixture = radius => new Uint8Array(readFileSync(new URL(`../../samples/jwf-pairs/native-tnkz-radius${radius}.jww`, import.meta.url)));
const hashes = {
  25: "e24fd16ebd8c64e516b46ef8bdbd99f4dd1fb4f87048da7fc56ddf5e562f92d0",
  50: "15e88b0a2e61c58d65b03bdfc6c08155f8612da6c281add5070eac21f298af28",
};

for (const radius of [25, 50]) {
  test(`native TNKZ radius ${radius}: pinned source, byte-identical no-op and JSON rebuild`, async () => {
    const source = fixture(radius);
    assert.equal(hash(source), hashes[radius]);
    assert.equal(diameter(source), radius * 2);
    const document = await openNativeJww(source);
    const saved = saveNativeJww(document);
    assert.deepEqual(saved.bytes, source);
    assert.equal(hash(saved.bytes), hashes[radius]);
    const before = convertJwwBytes(source);
    const json = JSON.parse(JSON.stringify(before));
    const rebuilt = buildJwwBytes({ version: json.meta.jwwVersion, entities: json.entities, meta: json.meta });
    assert.equal(diameter(rebuilt), radius * 2);
    const diff = buildJwwSemanticDiff(before, convertJwwBytes(rebuilt));
    assert.equal(diff.parserClean, true);
    assert.equal(diff.roundTripCompatible, true);
  });
}

test("native radius contrast changes metadata, not blank-drawing geometry", () => {
  const before = convertJwwBytes(fixture(25)), after = convertJwwBytes(fixture(50));
  const diff = buildJwwSemanticDiff(before, after);
  assert.equal(diff.parserClean, true);
  assert.equal(diff.drawingSemanticEqual, true);
  assert.equal(diff.documentMetadataEqual, false);
  assert.equal(diff.roundTripCompatible, false);
  // These are two deliberate native saves, not a byte-identity round trip.
  assert.notEqual(hash(fixture(25)), hash(fixture(50)));
});

test("preflight and repeated writes do not insert sentinel records into caller entities", () => {
  const drawing = convertJwwBytes(fixture(25));
  assert.equal(drawing.meta.jwwInternalSettings.records.length, 6);
  const before = hash(JSON.stringify(drawing));
  const options = { version: 700, entities: drawing.entities, meta: drawing.meta };
  assert.equal(preflightJwwWrite(options).ok, true);
  assert.equal(hash(JSON.stringify(drawing)), before);
  Object.freeze(drawing.entities);
  const first = buildJwwBytes(options), second = buildJwwBytes(options);
  assert.deepEqual(first, second);
  assert.equal(hash(JSON.stringify(drawing)), before);
  const reopened = convertJwwBytes(second);
  assert.equal(reopened.meta.jwwInternalSettings.records.length, 6);
  assert.equal(buildJwwSemanticDiff(drawing, reopened).roundTripCompatible, true);
});

const nativePack = process.env.JWF_NATIVE_EVIDENCE_DIR;
for (const [path, sha256, expected] of [
  ["TNK3_NM2/planned-name-output.jww", "29e0b32070c6e3de8c90bbf8ce19e2c88d3a1c35e8e852486c216fc63189c8d8", "AuditPlanned"],
  ["TNKN_SET/planned-prefix-output.jww", "c3259a3089a2423bbf8744f200bce8772512ee2630e0602d060fb79725a8b5cb", "Q33)"],
]) {
  const file = nativePack && `${nativePack}/${path}`;
  test(`private native evidence ${path}: no-op bytes and rebuilt meaning`, { skip: !file }, async () => {
    const source = new Uint8Array(readFileSync(file));
    assert.equal(hash(source), sha256);
    assert.deepEqual(saveNativeJww(await openNativeJww(source)).bytes, source);
    const drawing = convertJwwBytes(source);
    assert.ok(drawing.entities.some(item => item.type === "TEXT" && item.entity.text.includes(expected)));
    const snapshot = hash(JSON.stringify(drawing));
    const rebuilt = buildJwwBytes({ version: drawing.meta.jwwVersion, entities: drawing.entities, meta: drawing.meta });
    assert.equal(hash(JSON.stringify(drawing)), snapshot);
    const diff = buildJwwSemanticDiff(drawing, convertJwwBytes(rebuilt));
    assert.equal(diff.parserClean, true);
    assert.equal(diff.roundTripCompatible, true);
  });
}
