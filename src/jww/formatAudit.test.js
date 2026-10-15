import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parse } from "./parser.js";
import { buildJwwBytes, buildJwwRecordPayload, preflightJwwWrite } from "./writer.js";
import { openNativeJww, saveNativeJww, preflightNativeJwwSave } from "./native.js";
import { convertJwwBytes } from "../../tools/jww-gateway.mjs";
import { buildJwwSemanticDiff } from "./semanticDiff.js";
import { decodeJwwTextDimensionFlags, encodeJwwTextDimensionFlags } from "./attributeFlags.js";
import { parseJwwDocumentHeader, encodeJwwDocumentHeader, decodeJwwMaxDrawWidth } from "./documentHeader.js";
import { JWW_INTERNAL_SETTING_KEYS } from "./internalSettings.js";
import { encodeJwwDimensionSettings } from "./dimensionSettings.js";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const line = (flag = 0) => ({ type: "LINE", entity: { start: { x: 1.25, y: -2.5 }, end: { x: 3.75, y: 4.5 }, jww: { group: 0xfedcba98, penStyle: 30, penColor: 356, penWidth: 500, layer: 3, layerGroup: 4, flag } } });
const text = (penWidth = 0, flag = 0) => ({ type: "TEXT", entity: { position: { x: 5, y: 6 }, endPoint: { x: 7, y: 8 }, text: "R1,234.00", paperTextWidth: 2.5, paperTextHeight: 3.5, paperTextSpacing: 0.25, rotation: 20, jwwTextType: 30001, fontFamily: "MS Gothic", jww: { penStyle: 9, penWidth, flag } } });
const point = (flag = 0) => ({ type: "POINT", entity: { position: { x: 1, y: 2 }, jww: { flag, penStyle: 100 }, jwwPointCode: 23, jwwPointAngle: 0.25, jwwPointScale: 0, jwwTemporaryFlag: 7, isTemporaryPoint: true } });
const circle = (flag = 0) => ({ type: "CIRCLE", entity: { center: { x: -1, y: 2 }, radius: 3, jwwStartAngle: 0.2, jwwArcAngle: 6.1, jwwTiltAngle: 0.4, jwwFlatness: 0.6, jwwFullCircleFlag: 9, jww: { flag } } });
const solid = (flag = 0) => ({ type: "SOLID", entity: { jwwSourceVertices: [{ x: 1, y: 2 }, { x: 7, y: 8 }, { x: 3, y: 4 }, { x: 5, y: 6 }], jwwSolidColor: 0xdeadbeef, jww: { flag, penColor: 10 } } });
const dimension = (flag = 0) => ({ type: "DIMENSION", entity: { jww: { flag }, jwwDimension: { base: { flag }, line: { base: { flag }, start_x: 1, start_y: 2, end_x: 3, end_y: 4 }, text: { base: { flag, pen_width: 0x3ffa }, start_x: 5, start_y: 6, end_x: 7, end_y: 8, size_x: 2, size_y: 3, raw_content: "P^bL", content: "PL", font_name: "MS Gothic" }, native: { sxf_mode: 1, extension_line_1: { base: { flag } }, extension_line_2: { base: { flag } }, ...Object.fromEntries(["dimension_point_1", "dimension_point_2", "extension_point_1", "extension_point_2"].map((name) => [name, { base: { flag, pen_style: 100 }, x: 1, y: 2, code: 24, angle: 0.2, scale: 0, temporary_flag: 5, is_temporary: true }])) } } } });

function rebuild(bytes) {
  const before = convertJwwBytes(bytes);
  const json = JSON.parse(JSON.stringify(before));
  const saved = buildJwwBytes({ entities: json.entities, meta: json.meta, version: json.meta.jwwVersion });
  const after = convertJwwBytes(saved);
  const diff = buildJwwSemanticDiff(before, after);
  assert.equal(diff.roundTripCompatible, true, JSON.stringify({ drawing: diff.drawing, metadataEqual: diff.documentMetadataEqual, settingsEqual: diff.internalSettingsEqual }));
  return saved;
}

for (const version of [600, 700]) {
  test(`v${version}: every base attribute bit and text dimension flag survives JSON and source save`, async () => {
    const entities = [];
    for (const flag of [...Array.from({ length: 16 }, (_, i) => 1 << i), 0xffff]) entities.push(line(flag), text(0xffff, flag), point(flag), circle(flag), solid(flag), dimension(flag));
    for (const mask of [0x0002, 0x0008, 0x0010, 0x0020, 0x0040, 0x0080, 0x0100, 0x0200, 0x0400, 0x0800, 0x1000, 0x2000, 0x3000, 0xc005]) entities.push(text(mask));
    const bytes = buildJwwBytes({ entities, version });
    const saved = rebuild(bytes);
    assert.deepEqual(saved, bytes);
    const native = await openNativeJww(bytes);
    const unchanged = saveNativeJww(native);
    assert.equal(unchanged.byteIdentical, true);
    assert.equal(unchanged.savedSha256, hash(bytes));
    assert.deepEqual(unchanged.bytes, bytes);
    const target = native.nativeEntities[0];
    const changed = structuredClone(target.value);
    changed.base.flag = 0xabcd;
    const patched = saveNativeJww(native, { patches: [{ op: "replace", targetId: target.id, record: changed }] });
    const flagOffset = target.sourceSpan.payloadStart + 13;
    assert.deepEqual(patched.bytes.slice(0, flagOffset), bytes.slice(0, flagOffset));
    assert.deepEqual(patched.bytes.slice(flagOffset + 2), bytes.slice(flagOffset + 2));
    assert.equal(new DataView(patched.bytes.buffer).getUint16(flagOffset, true), 0xabcd);
  });

  test(`v${version}: all ten documented circular solid variants retain parameter bytes`, () => {
    const variants = [[101, -1, 1.1], [101, 0, 2], [101, 5, 2], [101, 100, Math.PI * 2], [105, 4, 2], [105, 4, Math.PI * 2], [106, 4, 2], [106, 4, Math.PI * 2], [111, 0, 2], [111, 100, Math.PI * 2]];
    const entities = variants.map(([penStyle, parameter, arcAngle]) => ({ type: "JWW_CIRCULAR_SOLID", entity: { jww: { penStyle, penColor: 10, flag: 0xffff }, jwwSolidColor: 0x123456, jwwCircularSolid: { penStyle, center: { x: 12.5, y: -4.25 }, radius: 10, flatness: 0.6, tiltAngle: 0.2, startAngle: -0.3, arcAngle, parameter } } }));
    const bytes = buildJwwBytes({ version, entities });
    assert.deepEqual(rebuild(bytes), bytes);
    const doc = parse(bytes);
    variants.forEach(([penStyle, parameter, arcAngle], i) => {
      const span = doc.entity_records[i].sourceSpan;
      assert.equal(span.end - span.payloadStart, 83);
      const payload = new DataView(bytes.buffer, bytes.byteOffset + span.payloadStart, 83);
      assert.equal(payload.getUint8(4), penStyle);
      [12.5, -4.25, 10, 0.6, 0.2, -0.3, arcAngle, parameter].forEach((value, j) => assert.equal(payload.getFloat64(15 + j * 8, true), value));
    });
  });

  test(`v${version}: all header fields and SXF tables survive JSON without an external template`, () => {
    const initial = buildJwwBytes({ version, entities: [line()] });
    const header = parseJwwDocumentHeader(initial);
    assert.equal(header.fields.length, 3221);
    let offset = 8;
    for (const field of header.fields) { assert.equal(field.offset, offset, field.name); offset += field.byteLength; }
    assert.equal(offset, header.byteLength);
    const changes = { m_nMaxDrawWid: -423, m_nMemoriMode: -11, m_nPrtKyoutsuuGray: 1, m_nPrtDispOnlyNonDraw: 21, "m_aPenColor[356]": 0x123456, "m_anPenWidth[356]": 13, "m_astrUDColorName[256]": "SXF \u7dda\u8272", "m_aPrtPenColor[356]": 0x654321, "m_anPrtPenWidth[356]": 321, "m_adPrtTenHankei[356]": 1.2, "m_alLType[62]": 0xfedcba98, "m_anTokushuSenUintDot[62]": 24, "m_anTokushuSenPich[62]": 3, "m_anPrtTokushuSenPich[62]": 13, "m_astrUDLTypeName[32]": "SXF line", "m_anUDLTypeSegment[32]": 10, m_dMojiBG: 0.3, m_nMojiBG: 13, m_strMemo: "CDataSen and CDataList are plain memo text" };
    for (let i = 1; i <= 10; i += 1) changes[`m_aadUDLTypePitch[32][${i}]`] = i * 0.125;
    for (const field of header.fields) if (Object.hasOwn(changes, field.name)) field.value = changes[field.name];
    const prefix = encodeJwwDocumentHeader(header);
    const bytes = new Uint8Array(prefix.length + initial.length - header.byteLength);
    bytes.set(prefix); bytes.set(initial.slice(header.byteLength), prefix.length);
    assert.deepEqual(rebuild(bytes), bytes);
    const parsed = parse(bytes);
    assert.equal(parsed.sunpou_settings.max_line_width, -423);
    assert.equal(parsed.grid_settings.mode, -11);
    for (const [name, value] of Object.entries(changes)) assert.equal(parsed.document_header.fields.find((field) => field.name === name).value, value);
  });

  test(`v${version}: sentinel order, all attributes, and ordinary metadata-like text are retained`, () => {
    const entities = [line()];
    for (const [i, key] of JWW_INTERNAL_SETTING_KEYS.entries()) {
      const setting = text(0x3ffa, 0xffff);
      Object.assign(setting.entity, { position: { x: 0, y: -1000 }, endPoint: { x: 0, y: -1000 }, text: `${key} = ${i}` });
      entities.push(setting, line(i));
    }
    entities.push(...["jww_private", "hqb_keep", "hqd_keep"].map((value) => ({ ...text(), entity: { ...text().entity, text: value } })));
    const bytes = buildJwwBytes({ version, entities });
    const gateway = convertJwwBytes(bytes);
    assert.equal(gateway.meta.jwwInternalSettings.records.length, 6);
    assert.equal(gateway.entities.length, entities.length - 6);
    assert.deepEqual(rebuild(bytes), bytes);
  });
}

test("all 65536 dimension flag WORDs decode and encode without clearing reserved bits", () => {
  for (let raw = 0; raw <= 0xffff; raw += 1) {
    const { raw: ignoredRaw, unknownBits, ...edits } = decodeJwwTextDimensionFlags(raw);
    assert.equal(encodeJwwTextDimensionFlags(raw, edits), raw);
    assert.equal(unknownBits, raw & 0xc005);
  }
  assert.equal(encodeJwwTextDimensionFlags(0xffff, { decimalPlaces: 0, symbolPrefix: false }), 0xcbff);
});

test("every header descriptor round-trips its declared primitive width independently of presentation validation", () => {
  const bytes = buildJwwBytes({ entities: [] });
  const header = parseJwwDocumentHeader(bytes);
  for (const [index, field] of header.fields.entries()) {
    if (field.name === "JW_DATA_VERSION") continue;
    field.value = field.type === "string" ? `field-${index}` : field.type === "f64" ? index + 0.125 : index;
  }
  const saved = encodeJwwDocumentHeader(header);
  const parsed = parseJwwDocumentHeader(saved);
  assert.deepEqual(parsed.fields.map(({ name, type, value }) => ({ name, type, value })), header.fields.map(({ name, type, value }) => ({ name, type, value })));
  assert.deepEqual(encodeJwwDocumentHeader(parsed), saved);
});

test("real Jw_cad sample header retains original ANSI/UTF16 string bytes", () => {
  const bytes = readFileSync(new URL("../../samples/jwf-pairs/jwf-open-items-core.jww", import.meta.url));
  const header = parseJwwDocumentHeader(bytes);
  assert.equal(header.byteLength, parse(bytes).entity_list_offset);
  assert.deepEqual(Buffer.from(encodeJwwDocumentHeader(header)), bytes.subarray(0, header.byteLength));
});

test("maximum draw width branches preserve signed backup magnitudes", () => {
  for (const raw of [-101, -201, -300, -401, -500, 1, -100]) {
    const decoded = decodeJwwMaxDrawWidth(raw);
    assert.equal(decoded.raw, raw);
    assert.equal(decoded.hundredthMillimeter, raw <= -101);
  }
  assert.equal(decodeJwwMaxDrawWidth(-201).previousMaximum, 1);
  assert.equal(decodeJwwMaxDrawWidth(-300).previousMaximum, 100);
  assert.equal(decodeJwwMaxDrawWidth(-401).previousMaximum, -1);
  assert.equal(decodeJwwMaxDrawWidth(-500).previousMaximum, -100);
});

test("each truncated record byte is rejected instead of returning zero-filled clean geometry", () => {
  for (const entity of [line(), circle(), point(), text(), solid(), dimension()]) {
    const bytes = buildJwwBytes({ entities: [entity] });
    const record = parse(bytes).entity_records[0];
    for (let end = record.sourceSpan.payloadStart; end < record.sourceSpan.end; end += 1) {
      const truncated = bytes.slice(0, end);
      const parsed = parse(truncated);
      assert.equal(parsed.entity_list_complete, false, `${entity.type} at ${end}`);
      assert.equal(parsed.entities.length, 0);
      assert.throws(() => convertJwwBytes(truncated), /blocked/);
    }
  }
});

test("unknown source regions require explicit permission and still cannot be rebuilt natively", async () => {
  const clean = buildJwwBytes({ entities: [line()] });
  const bytes = new Uint8Array([...clean, 0xde, 0xad]);
  assert.throws(() => convertJwwBytes(bytes), /allow-unsupported/);
  const gateway = convertJwwBytes(bytes, { allowUnsupported: true });
  assert.equal(gateway.meta.diagnostics.trailingByteLength, 2);
  assert.throws(() => buildJwwBytes({ entities: gateway.entities, meta: gateway.meta }), /allow-unsupported/);
  assert.equal(preflightJwwWrite({ entities: gateway.entities, meta: gateway.meta }).ok, false);
  const native = await openNativeJww(bytes);
  const target = native.nativeEntities[0];
  const replacement = { ...target.value, end_x: 12 };
  const patches = [{ op: "replace", targetId: target.id, record: replacement }];
  assert.equal(preflightNativeJwwSave(native, { patches }).code, "JWW_NATIVE_UNSUPPORTED_SOURCE");
  assert.throws(() => saveNativeJww(native, { patches }), /allowUnsupported/);
  assert.deepEqual(saveNativeJww(native, { patches, allowUnsupported: true }).bytes.slice(-2), bytes.slice(-2));
  assert.equal(preflightNativeJwwSave(native, { patches: [{ op: "create", targetId: "created", record: replacement }], allowUnsupported: true }).ok, false);
  assert.equal(saveNativeJww(native).savedSha256, hash(bytes));
});

test("unsupported solid modes, out-of-range flag words and unverified CTime fail explicitly", () => {
  assert.throws(() => buildJwwRecordPayload(line(65536)), /serialized range/);
  assert.throws(() => buildJwwRecordPayload(line(NaN)), /serialized range/);
  assert.throws(() => buildJwwBytes({ entities: [], meta: { jwwBlockDefinitions: [{ number: 1, createdAt: 0x80000000, entities: [] }] } }), /Unverified CTime/);
  assert.throws(() => buildJwwRecordPayload({ type: "JWW_CIRCULAR_SOLID", entity: { jww: { penStyle: 102 }, jwwCircularSolid: { penStyle: 102 } } }), /Unverified circular/);
});

test("fixed entity payload offsets match the documented primitive widths", () => {
  const bytes = buildJwwBytes({ entities: [line(), point(), circle(), solid(), text()] });
  const records = parse(bytes).entity_records;
  const view = (i) => new DataView(bytes.buffer, records[i].sourceSpan.payloadStart, records[i].sourceSpan.end - records[i].sourceSpan.payloadStart);
  const base = view(0);
  assert.equal(base.byteLength, 47);
  assert.equal(base.getUint32(0, true), 0xfedcba98);
  assert.equal(base.getUint8(4), 30);
  [[5, 356], [7, 500], [9, 3], [11, 4], [13, 0]].forEach(([offset, value]) => assert.equal(base.getUint16(offset, true), value));
  [1.25, -2.5, 3.75, 4.5].forEach((value, i) => assert.equal(base.getFloat64(15 + i * 8, true), value));
  assert.equal(view(1).byteLength, 55);
  assert.equal(view(1).getUint32(31, true), 7);
  assert.equal(view(1).getUint32(35, true), 23);
  assert.equal(view(1).getFloat64(39, true), 0.25);
  assert.equal(view(1).getFloat64(47, true), 0);
  assert.equal(view(2).byteLength, 75);
  [-1, 2, 3, 0.2, 6.1, 0.4, 0.6].forEach((value, i) => assert.equal(view(2).getFloat64(15 + i * 8, true), value));
  assert.equal(view(2).getUint32(71, true), 9);
  assert.equal(view(3).byteLength, 83);
  [1, 2, 7, 8, 3, 4, 5, 6].forEach((value, i) => assert.equal(view(3).getFloat64(15 + i * 8, true), value));
  assert.equal(view(3).getUint32(79, true), 0xdeadbeef);
  assert.equal(view(4).getUint32(47, true), 30001);
  [2.5, 3.5, 0.25, 20].forEach((value, i) => assert.equal(view(4).getFloat64(51 + i * 8, true), value));
});

test("official header offsets locate monochrome tables without heuristic guesses", () => {
  const original = buildJwwBytes({ entities: [] });
  const header = parseJwwDocumentHeader(original);
  for (const field of header.fields) {
    if (/^m_a(?:Prt)?PenColor\[[0-9]\]$/.test(field.name)) field.value = 0;
    if (/^m_an(?:Prt)?PenWidth\[[0-9]\]$/.test(field.name)) field.value = 0;
    if (/^m_adPrtTenHankei\[[0-9]\]$/.test(field.name)) field.value = 0;
  }
  const bytes = buildJwwBytes({ entities: [], meta: { jwwInternalSettings: { document: header } } });
  const parsed = parse(bytes);
  assert.equal(parsed.color_settings.screenColorTableSourceSpan.start, header.fields.find((f) => f.name === "m_aPenColor[0]").offset);
  assert.equal(parsed.color_settings.screenColors[1].width, 0);
  assert.equal(parsed.color_settings.printColors[1].pointRadius, 0);
  assert.deepEqual(rebuild(bytes), bytes);
});

test("empty source names and font strings are not replaced with defaults", () => {
  const item = text(); item.entity.fontFamily = "";
  const bytes = buildJwwBytes({ entities: [item], meta: { jwwBlockDefinitions: [{ number: 1, name: "", referred: false, createdAt: 0, entities: [] }] } });
  const converted = convertJwwBytes(bytes);
  assert.equal(converted.entities[0].entity.fontFamily, "");
  assert.equal(converted.meta.jwwBlockDefinitions[0].rawName, "");
  assert.deepEqual(rebuild(bytes), bytes);
});

test("source hash mismatch blocks both unchanged saving and source splices", async () => {
  const doc = await openNativeJww(buildJwwBytes({ entities: [line()] }));
  doc.originalBytes[20] ^= 1;
  assert.equal(preflightNativeJwwSave(doc).code, "JWW_NATIVE_SOURCE_HASH_MISMATCH");
  assert.throws(() => saveNativeJww(doc), /source bytes changed/);
});

test("sentinel attribute and source-order changes invalidate full compatibility", () => {
  const item = text();
  Object.assign(item.entity, { position: { x: 0, y: -1000 }, endPoint: { x: 0, y: -1000 }, text: `${JWW_INTERNAL_SETTING_KEYS[0]} = 1` });
  const first = convertJwwBytes(buildJwwBytes({ entities: [line(), item] }));
  for (const update of [(row) => row.jww.flag ^= 1, (row) => row.sourceIndex += 1]) {
    const second = structuredClone(first);
    update(second.meta.jwwInternalSettings.records[0]);
    const diff = buildJwwSemanticDiff(first, second);
    assert.equal(diff.drawingSemanticEqual, true);
    assert.equal(diff.internalSettingsEqual, false);
    assert.equal(diff.roundTripCompatible, false);
  }
});

test("a drawing object referenced as CDataList is explicitly rejected", () => {
  const original = buildJwwBytes({ version: 600, entities: [line()] });
  const bytes = new Uint8Array(original.length + 2);
  bytes.set(original);
  const view = new DataView(bytes.buffer);
  view.setUint16(original.length - 2, 1, true);
  view.setUint16(original.length, 2, true);
  const parsed = parse(bytes);
  assert.equal(parsed.block_list_complete, false);
  assert.throws(() => convertJwwBytes(bytes), /blocked/);
});

test("all five packed dimension DWORDs use documented decimal positions", () => {
  const values = encodeJwwDimensionSettings({}, {
    dimensionLineColor: 9, dimensionExtensionLineColor: 8, dimensionPointColor: 7,
    dimensionDecimalPlaces: 3, dimensionUnit: 1, dimensionEndpointStyle: 2, dimensionTextType: 10,
    dimensionValueOffset: -99.9, dimensionExtensionProjection: 99.9,
    dimensionArrowLength: 99.9, dimensionArrowAngle: 80, dimensionReverseArrowProjection: 99.9,
    dimensionDirectionCorrection: 1, dimensionFullWidthText: 1, dimensionCommaAsSpace: 1,
    dimensionFullWidthComma: 1, dimensionFullWidthDecimalPoint: 1, dimensionShowUnit: 1,
    dimensionRadiusMarkPosition: 2, dimensionRadiusComma: 1, dimensionRadiusTrailingZero: 1,
    dimensionItalicText: 1, dimensionBoldText: 1, dimensionAngleUnit: 2,
    dimensionAngleDecimalPlaces: 6, dimensionCreateEntity: 1, dimensionSelectByLineAttributes: 1,
    dimensionDecimalHandling: 2,
  });
  assert.deepEqual(values, { sunpou1: 10213789, sunpou2: 9991999, sunpou3: 999800999, sunpou4: 112111111, sunpou5: 2116211 });
  for (const version of [600, 700]) {
    const bytes = buildJwwBytes({ version, entities: [], dimensionSettings: { ...values, max_line_width: -423 } });
    assert.deepEqual(rebuild(bytes), bytes);
    const header = parseJwwDocumentHeader(bytes);
    const view = new DataView(bytes.buffer);
    for (let i = 1; i <= 5; i += 1) {
      const field = header.fields.find((f) => f.name === `m_lnSunpou${i}`);
      assert.equal(view.getUint32(field.offset, true), values[`sunpou${i}`]);
    }
  }
});

test("unverified circular solid input requires explicit salvage permission", async () => {
  const bytes = buildJwwBytes({ entities: [solid()] });
  bytes[parse(bytes).entity_records[0].sourceSpan.payloadStart + 4] = 102;
  assert.equal(parse(bytes).diagnostics.unverifiedValues.length, 1);
  assert.throws(() => convertJwwBytes(bytes), /unverified entity/);
  assert.equal(convertJwwBytes(bytes, { allowUnsupported: true }).entities.length, 1);
  const native = await openNativeJww(bytes);
  assert.deepEqual(saveNativeJww(native).bytes, bytes);
});

test("CLI refusal, opt-in warnings and complete semantic-diff exit codes are enforced", () => {
  const directory = new URL("../../.work/format-audit-cli/", import.meta.url);
  mkdirSync(directory, { recursive: true });
  const file = (name) => fileURLToPath(new URL(name, directory));
  const run = (tool, ...args) => spawnSync(process.execPath, [fileURLToPath(new URL(`../../tools/${tool}.mjs`, import.meta.url)), ...args], { encoding: "utf8" });
  const clean = buildJwwBytes({ entities: [line()] });
  writeFileSync(file("unsupported.jww"), new Uint8Array([...clean, 0xde, 0xad]));
  const convertArgs = [file("unsupported.jww"), "-o", file("unsupported.json")];
  assert.notEqual(run("jww-gateway", ...convertArgs).status, 0);
  const salvage = run("jww-gateway", ...convertArgs, "--allow-unsupported");
  assert.equal(salvage.status, 0, salvage.stderr);
  assert.match(salvage.stderr, /WARNING/);
  const writeArgs = [file("unsupported.json"), "-o", file("salvage.jww")];
  assert.notEqual(run("jww-writer", ...writeArgs).status, 0);
  const written = run("jww-writer", ...writeArgs, "--allow-unsupported");
  assert.equal(written.status, 0, written.stderr);
  assert.match(written.stderr, /WARNING/);
  const setting = text();
  Object.assign(setting.entity, { position: { x: 0, y: -1000 }, endPoint: { x: 0, y: -1000 }, text: `${JWW_INTERNAL_SETTING_KEYS[0]} = 1` });
  writeFileSync(file("before.jww"), buildJwwBytes({ entities: [line(), setting] }));
  setting.entity.text = `${JWW_INTERNAL_SETTING_KEYS[0]} = 2`;
  writeFileSync(file("after.jww"), buildJwwBytes({ entities: [line(), setting] }));
  const diffArgs = [file("before.jww"), file("after.jww")];
  assert.equal(run("jww-semantic-diff", ...diffArgs, "--fail-on-drawing-difference").status, 0);
  assert.equal(run("jww-semantic-diff", ...diffArgs, "--fail-on-difference").status, 2);
});
