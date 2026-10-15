import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { openNativeJww, saveNativeJww } from "./native.js";
import { parseJwwDocumentHeader } from "./documentHeader.js";
import { buildJwwBytes, preflightJwwWrite } from "./writer.js";
import { buildJwwSemanticDiff } from "./semanticDiff.js";
import { convertJwwBytes } from "../../tools/jww-gateway.mjs";
import { decodeJwfBytes, encodeJwfText, parseJwfBytes, openJwfProfile, saveJwfProfile } from "./jwf.js";

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

const nativeFields = process.env.JWF_NATIVE_FIELDS_DIR;
for (const [field, sha256, labels, controls] of [
  [1, "e302acb151ad72eca7f20f47fb7b84e88a99e34ccdb07e9c494d6f21b15debe0", ["Q13}", "Q14}", "Q16}"], ["[1]", "[2]", "[3]", "[4]", "[5]"]],
  [2, "36177e75f8ec994396bde6c3b803c1d33c998641a8f153eff8a3e16cd96f75a3", ["{3Q2", "{4Q2", "{6Q2"], ["[1]", "[2]", "[3]", "[4]", "[5]"]],
  [4, "d57e6efcc5da761d8209f28170816bdf872fce780f5963761a1178236318d64e", ["(3Q4", "(4Q4", "(6Q4"], ["<1>", "<2>", "<3>", "<4>", "<5>"]],
  [5, "04b5fd631a2e2bc7f5d281a1f90f379ecae900dd71a4ca8b479b4c29943a3dca", ["Q51]", "Q52]", "Q53]", "Q54]", "Q55]"], ["{3}", "{4}", "{6}"]],
  [6, "7a13d11ec80b9c2bd90829244fcbd54f9f968d443b5a0a8e00503dcbdfd4d7e5", ["[1Q6", "[2Q6", "[3Q6", "[4Q6", "[5Q6"], ["{3}", "{4}", "{6}"]],
  [7, "5dc58560953f58f14b8aef4d86cbfe3d1a2cfa7107287d3810b1b36a3de36674", ["Q71>", "Q72>", "Q73>", "Q74>", "Q75>"], ["(3)", "(4)", "(6)"]],
  [8, "7a9ea3db594b647efa12cccf072fc3421c31b60bb8c5ca2035d5558613386e56", ["<1Q8", "<2Q8", "<3Q8", "<4Q8", "<5Q8"], ["(3)", "(4)", "(6)"]],
]) {
  test(`private TNKN field ${field}: native-saved text and Gateway round trip`, { skip: !nativeFields }, async () => {
    const source = new Uint8Array(readFileSync(`${nativeFields}/field-${field}/output.jww`));
    assert.equal(hash(source), sha256);
    const input = new Uint8Array(readFileSync(`${nativeFields}/field-${field}/input.jww`));
    assert.equal(hash(input), "a574ab02d25d5dcefb4ed4e0d18b192c45c6fa264f58769dedcd7a904d7afb8b");
    const inputCount = convertJwwBytes(input).entities.length;
    const drawing = convertJwwBytes(source);
    const texts = drawing.entities.slice(inputCount).filter(item => item.type === "TEXT").map(item => item.entity.text);
    for (const label of labels) assert.equal(texts.filter(text => text === label).length, 2, label);
    for (const label of controls) assert.equal(texts.filter(text => text === label).length, 2, label);
    assert.deepEqual(saveNativeJww(await openNativeJww(source)).bytes, source);
    const before = hash(JSON.stringify(drawing));
    const rebuilt = buildJwwBytes({ version: drawing.meta.jwwVersion, entities: drawing.entities, meta: drawing.meta });
    assert.equal(hash(JSON.stringify(drawing)), before);
    const diff = buildJwwSemanticDiff(drawing, convertJwwBytes(rebuilt));
    assert.equal(diff.parserClean, true);
    assert.equal(diff.roundTripCompatible, true);
    // A regression over saved bytes is not a native GUI reopen test.
  });
}

const nativeBoundaries = process.env.JWF_NATIVE_BOUNDARIES_DIR;
const boundaryCases = [
  ["ascii5", "465519f0c12d036345b7c02413851155b78eb0950867414c5a33bc9212e5dca1", "ABCDE", "ABCDE", false],
  ["ascii6", "abe3a5670ed4dd01848fc51fe29d1d9343ce9c1718a63b8381ceae60d8162b34", "ABCDEF", "ABCDEF", false],
  ["ascii7", "6ce01719f8b2fec41a2b0cf088e0fe3c1acf61f5925a362028cb03c583429bc4", "ABCDEFG", "ABCDEF", false],
  ["japanese6", "3a4167d339b37fb808bc5bfb2ba8639407099b76922cf292cb254a91d4e36382", "\u6771\u4eac\u90fd", "\u6771\u4eac\u90fd", false],
  ["mixed7", "47ef43a17992e15acb32da54c48080343fc9edfd70ac194f24ebc8b9636cd723", "ABCDE\u5efa", "ABCDE\u5efa", false],
  ["empty-reference", "8be31ff9b518e6e8a9c2eb6f7db4f242c6d087ef162ca8ed697a529facf9072a", null, "", true],
  ["empty-planned", "22d0cbb5e5eeb7e5bb2f96dc804b2596e8b25479f4c65f817e391f13e8211b29", null, "", false],
  ["decoration-reference", "c5e8d2973bb5a0bc80c4308b3569b4dbc4b754fb6676a1e7b1900343e2276c13", null, "\u25a1^w", true],
  ["decoration-planned", "f8c551ff86994a6fa76f189ac814e78908aff294ac708a63d698babf86447e90", null, "\u25cb^w", false],
];

for (const [id, sha256, inputPrefix, savedPrefix, reference] of boundaryCases) {
  test(`private TNKN boundary ${id}: native bytes, affixes and overlay rebuild`, { skip: !nativeBoundaries }, async () => {
    const folder = `${nativeBoundaries}/${id}`;
    const decorated = id.startsWith("decoration");
    const empty = id.startsWith("empty");
    const value = empty ? ",,,,,,," : decorated ? "\u25a1^w,,\u25cb^w,,[,],<,>" : `{,},${inputPrefix},),[,],<,>`;
    const on = readFileSync(`${folder}/on.jwf`);
    assert.equal(decodeJwfBytes(on), `TNKN_SET=${value}\r\nEND\r\n`);
    assert.equal(decodeJwfBytes(readFileSync(`${folder}/off.jwf`)), `#${decodeJwfBytes(on)}`);
    assert.deepEqual(parseJwfBytes(on).entries.TNKN_SET.values, value.split(","));
    assert.equal(parseJwfBytes(readFileSync(`${folder}/off.jwf`)).entryCount, 0);
    const input = new Uint8Array(readFileSync(`${folder}/input.jww`));
    assert.equal(hash(input), "a574ab02d25d5dcefb4ed4e0d18b192c45c6fa264f58769dedcd7a904d7afb8b");
    const inputCount = convertJwwBytes(input).entities.length;
    assert.equal(inputCount, 1740);
    const source = new Uint8Array(readFileSync(`${folder}/output.jww`));
    assert.equal(hash(source), sha256);
    const drawing = convertJwwBytes(source);
    assert.equal(drawing.meta.jwwVersion, 700);
    assert.equal(drawing.entities.length, reference ? 1955 : 1952);
    const texts = drawing.entities.slice(inputCount).filter(item => item.type === "TEXT").map(item => item.entity);
    const raw = texts.map(entity => entity.rawText ?? entity.text);
    const expected = [3, 4, 6].map(n => `${savedPrefix}${n}${empty || decorated ? "" : ")"}`);
    expected.push(...[1, 2, 3, 4, 5].map(n => empty ? String(n) : reference ? `[${n}]` : `<${n}>`));
    for (const label of new Set(expected)) {
      assert.equal(raw.filter(text => text === label).length, expected.filter(text => text === label).length * 2, label);
    }
    if (decorated) {
      const overlays = texts.filter(entity => entity.rawText?.startsWith(savedPrefix));
      assert.equal(overlays.length, 6);
      for (const entity of overlays) {
        const digit = entity.rawText.slice(savedPrefix.length);
        assert.equal(entity.text, `${savedPrefix[0]}${digit}`);
        assert.deepEqual(entity.jwwSpecialRuns, [{
          kind: "halfOverlay", marker: "^w", baseText: savedPrefix[0], overlayText: digit, start: 0, end: 2,
        }]);
      }
    }
    const saved = saveNativeJww(await openNativeJww(source));
    assert.deepEqual(saved.bytes, source);
    assert.equal(hash(saved.bytes), sha256);
    const snapshot = hash(JSON.stringify(drawing));
    const json = JSON.parse(JSON.stringify(drawing));
    const rebuilt = buildJwwBytes({ version: 700, entities: json.entities, meta: json.meta });
    assert.equal(hash(JSON.stringify(json)), snapshot);
    const reopened = convertJwwBytes(rebuilt);
    const diff = buildJwwSemanticDiff(drawing, reopened);
    assert.equal(diff.parserClean, true);
    assert.equal(diff.roundTripCompatible, true);
    const textMeaning = d => d.entities.filter(item => item.type === "TEXT").map(({ entity }) => ({
      text: entity.text, rawText: entity.rawText, runs: entity.jwwSpecialRuns, segments: entity.jwwTextSegments,
    }));
    assert.deepEqual(textMeaning(reopened), textMeaning(drawing));
  });
}

test("private native JWF export omits TNKN_SET and clean reimport uses default numbering", { skip: !nativeBoundaries }, async () => {
  const bytes = new Uint8Array(readFileSync(`${nativeBoundaries}/ascii6/native-export.jwf`));
  assert.equal(bytes.length, 10180);
  assert.equal(hash(bytes), "3fa686f3b4b84a4b4a4f7967d99e92fa4c1602992a5968d559d3c6ddb810f8bf");
  const profile = openJwfProfile(bytes);
  assert.equal(profile.validation.ok, true);
  assert.equal(profile.parsed.entryCount, 209);
  assert.equal(profile.parsed.entries.TNKN_SET, undefined);
  assert.equal(decodeJwfBytes(bytes).includes("TNKN_SET"), false);
  assert.deepEqual(saveJwfProfile(profile).bytes, bytes);
  const source = new Uint8Array(readFileSync(`${nativeBoundaries}/ascii6/reimport-output.jww`));
  assert.equal(hash(source), "36661afa8e9466128d0b74bd27059a5a4778d018f999d73d837e22afc21caff4");
  const drawing = convertJwwBytes(source);
  assert.equal(drawing.entities.length, 1952);
  const texts = drawing.entities.slice(1740).filter(item => item.type === "TEXT").map(item => item.entity.text);
  for (const label of ["(3)", "(4)", "(6)", "<1>", "<2>", "<3>", "<4>", "<5>"]) {
    assert.equal(texts.filter(text => text === label).length, 2, label);
  }
  assert.equal(texts.some(text => text.includes("ABCDEF")), false);
  assert.deepEqual(saveNativeJww(await openNativeJww(source)).bytes, source);
  const rebuilt = buildJwwBytes({ version: 700, entities: drawing.entities, meta: drawing.meta });
  const diff = buildJwwSemanticDiff(drawing, convertJwwBytes(rebuilt));
  assert.equal(diff.parserClean, true);
  assert.equal(diff.roundTripCompatible, true);
  // This pins the observed limitation, not successful environment round-trip preservation.
});

// These expectations record 10.02.1 observations, not new valid JWF lengths.
for (const [id, sha256, inputName, inputBytes, savedName] of [
  ["ascii19", "23e2562d8a792071e04d04c4a02926e87f28cc9d9478560bf66f77418a1a7625", "1234567890123456789", 19, "1234567890123456789"],
  ["ascii20", "d27c0826082bd6ca679f40642efc36f4b25cc22031f98e107383c760ca5aef53", "12345678901234567890", 20, "12345678901234567890"],
  ["ascii21", "7243af65a8cbf106310d2233c79a3b3cbfad820cfa0366c1c0a052cc0ad175e1", "123456789012345678901", 21, "12345678901234567890"],
  ["japanese-name", "707cd46a6f87ba9507f68fd9cf54afc0053b2071776b365df917a1fe28d615af", "\u8a08\u753b\u5efa\u7269\u691c\u8a3c", 12, "\u8a08\u753b\u5efa\u7269\u691c\u8a3c"],
  ["japanese20", "1e5b2208621f9cc558bac1648f13a3040cb7471eff2fc9c5397addf45a576772", "\u6771\u4eac\u8a08\u753b\u5efa\u7269\u78ba\u8a8d\u8a66\u9a13", 20, "\u6771\u4eac\u8a08\u753b\u5efa\u7269\u78ba\u8a8d\u8a66\u9a13"],
  ["mixed21", "0f9e920752eb5449c8fcf6ddaa06455d5faed059348179c3421bd2fb031693de", "1234567890123456789\u5efa", 21, "1234567890123456789\u5efa"],
]) {
  test(`private TNK3_NM2 ${id}: observed native text, no-op bytes and rebuilt meaning`, { skip: !nativeFields }, async () => {
    const folder = `${nativeFields}/${id}`;
    const profile = readFileSync(`${folder}/on.jwf`);
    assert.equal(decodeJwfBytes(profile), `TNK3_NM2=${inputName}\r\nEND\r\n`);
    assert.equal(encodeJwfText(inputName).length, inputBytes);
    assert.equal(decodeJwfBytes(readFileSync(`${folder}/off.jwf`)), `#${decodeJwfBytes(profile)}`);
    assert.deepEqual(parseJwfBytes(profile).keys, ["TNK3_NM2"]);
    assert.equal(parseJwfBytes(readFileSync(`${folder}/off.jwf`)).entryCount, 0);
    const input = new Uint8Array(readFileSync(`${folder}/input.jww`));
    assert.equal(hash(input), "a574ab02d25d5dcefb4ed4e0d18b192c45c6fa264f58769dedcd7a904d7afb8b");
    const inputCount = convertJwwBytes(input).entities.length;
    assert.equal(inputCount, 1740);
    const source = new Uint8Array(readFileSync(`${folder}/output.jww`));
    assert.equal(hash(source), sha256);
    const drawing = convertJwwBytes(source);
    assert.equal(drawing.meta.jwwVersion, 700);
    assert.equal(drawing.entities.length, 1952);
    const texts = drawing.entities.slice(inputCount).filter(item => item.type === "TEXT").map(item => item.entity.text);
    const heading = `\u300a${savedName}\u300b`;
    assert.equal(texts.filter(text => text.startsWith(heading)).length, 3);
    assert.equal(texts.filter(text => text === heading).length, 1);
    assert.equal(texts.some(text => text.includes("\ufffd")), false);
    if (inputName !== savedName) assert.equal(texts.some(text => text.includes(inputName)), false);
    for (const label of ["(3)", "(4)", "(6)", "<1>", "<2>", "<3>", "<4>", "<5>"]) {
      assert.equal(texts.filter(text => text === label).length, 2, label);
    }
    const saved = saveNativeJww(await openNativeJww(source));
    assert.deepEqual(saved.bytes, source);
    assert.equal(hash(saved.bytes), sha256);
    const snapshot = hash(JSON.stringify(drawing));
    const rebuilt = buildJwwBytes({ version: 700, entities: drawing.entities, meta: drawing.meta });
    assert.equal(hash(JSON.stringify(drawing)), snapshot);
    const reopened = convertJwwBytes(rebuilt);
    const diff = buildJwwSemanticDiff(drawing, reopened);
    assert.equal(diff.parserClean, true);
    assert.equal(diff.roundTripCompatible, true);
    assert.deepEqual(reopened.entities.filter(item => item.type === "TEXT").map(item => item.entity.text),
      drawing.entities.filter(item => item.type === "TEXT").map(item => item.entity.text));
  });
}
