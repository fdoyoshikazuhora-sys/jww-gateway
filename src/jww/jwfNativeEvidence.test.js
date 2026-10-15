import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { openNativeJww, saveNativeJww } from "./native.js";
import { parseJwwDocumentHeader } from "./documentHeader.js";
import { buildJwwBytes } from "./writer.js";
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
