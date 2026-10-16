import { decodeJwwRawString } from "./decoder.js";

export const JWW_HEADER_LAYOUT = "jwdatafmt-7.02-v600-v700";

// Declaration order in https://www.jwcad.net/jwdatafmt.txt, through m_DataList.
export function jwwHeaderFields() {
  const fields = [];
  const add = (type, ...names) => names.forEach((name) => fields.push({ name, type }));
  const array = (type, name, count, first = 0) => {
    for (let i = first; i < first + count; i += 1) add(type, `${name}[${i}]`);
  };
  add("u32", "JW_DATA_VERSION");
  add("string", "m_strMemo");
  add("u32", "m_nZumen", "m_nWriteGLay");
  for (let g = 0; g < 16; g += 1) {
    add("u32", `m_anGLay[${g}]`, `m_anWriteLay[${g}]`);
    add("f64", `m_adScale[${g}]`);
    add("u32", `m_anGLayProtect[${g}]`);
    for (let l = 0; l < 16; l += 1) add("u32", `m_aanLay[${g}][${l}]`, `m_aanLayProtect[${g}][${l}]`);
  }
  array("u32", "dummyBeforeSunpou", 14);
  add("u32", "m_lnSunpou1", "m_lnSunpou2", "m_lnSunpou3", "m_lnSunpou4", "m_lnSunpou5", "dummyAfterSunpou");
  add("i32", "m_nMaxDrawWid");
  add("f64", "m_DPPrtGenten.x", "m_DPPrtGenten.y", "m_dPrtBairitsu");
  add("u32", "m_nPrtSet");
  add("i32", "m_nMemoriMode");
  add("f64", "m_dMemoriHyoujiMin", "m_dMemoriX", "m_dMemoriY", "m_DpMemoriKijunTen.x", "m_DpMemoriKijunTen.y");
  for (let g = 0; g < 16; g += 1) array("string", `m_aStrLayName[${g}]`, 16);
  array("string", "m_aStrGLayName", 16);
  add("f64", "m_dKageLevel", "m_dKageIdo");
  add("u32", "m_nKage9_15JiFlg");
  add("f64", "m_dKabeKageLevel", "m_dTenkuuZuLevel", "m_dTenkuuZuDiameter");
  add("u32", "m_nMMTani3D");
  add("f64", "m_dBairitsu", "m_DPGenten.x", "m_DPGenten.y", "m_dHanniBairitsu", "m_DPHanniGenten.x", "m_DPHanniGenten.y");
  for (let i = 1; i <= 8; i += 1) {
    add("f64", `m_dZoomJumpBairitsu[${i}]`, `m_DPZoomJumpGenten[${i}].x`, `m_DPZoomJumpGenten[${i}].y`);
    add("u32", `m_nZoomJumpGLay[${i}]`);
  }
  add("f64", "dDm11", "dDm12", "dDm13");
  add("u32", "lnDm1");
  add("f64", "dDm21", "dDm22", "m_dMojiBG");
  add("u32", "m_nMojiBG");
  array("f64", "m_adFukusenSuuchi", 10);
  add("f64", "m_dRyoygawaFukusenTomeDe");
  for (let i = 0; i <= 9; i += 1) add("u32", `m_aPenColor[${i}]`, `m_anPenWidth[${i}]`);
  for (let i = 0; i <= 9; i += 1) {
    add("u32", `m_aPrtPenColor[${i}]`, `m_anPrtPenWidth[${i}]`);
    add("f64", `m_adPrtTenHankei[${i}]`);
  }
  const line = (i, random = false) => {
    add("u32", `m_alLType[${i}]`, `${random ? "m_anRandSenWide" : "m_anTokushuSenUintDot"}[${i}]`, `m_anTokushuSenPich[${i}]`);
    if (random) add("u32", `m_anPrtRandSenWide[${i}]`);
    add("u32", `m_anPrtTokushuSenPich[${i}]`);
  };
  for (let i = 2; i <= 9; i += 1) line(i);
  for (let i = 11; i <= 15; i += 1) line(i, true);
  for (let i = 16; i <= 19; i += 1) line(i);
  add("u32", "m_nDrawGamenTen", "m_nDrawPrtTen", "m_nBitMapFirstDraw", "m_nGyakuDraw", "m_nGyakuSearch", "m_nColorPrint", "m_nLayJunPrint", "m_nColJunPrint", "m_nPrtRenzoku", "m_nPrtKyoutsuuGray", "m_nPrtDispOnlyNonDraw", "m_lnDrawTime", "nEyeInit", "m_dEye_H_Ichi_1_x100", "m_dEye_H_Ichi_2_x100", "m_dEye_H_Ichi_3_x100");
  add("f64", "m_dEye_Z_Ichi_1", "m_dEye_Y_Ichi_1", "m_dEye_Z_Ichi_2", "m_dEye_Y_Ichi_2", "m_dEye_V_Ichi_3", "m_dSenNagasaSnpou", "m_dBoxSunpouX", "m_dBoxSunpouY", "m_dEnHankeiSnpou");
  add("u32", "m_nSolidNinniColor", "m_SolidColor");
  for (let i = 100; i <= 356; i += 1) add("u32", `m_aPenColor[${i}]`, `m_anPenWidth[${i}]`);
  for (let i = 0; i <= 256; i += 1) {
    add("string", `m_astrUDColorName[${i}]`);
    add("u32", `m_aPrtPenColor[${i + 100}]`, `m_anPrtPenWidth[${i + 100}]`);
    add("f64", `m_adPrtTenHankei[${i + 100}]`);
  }
  for (let i = 30; i <= 62; i += 1) line(i);
  for (let i = 0; i <= 32; i += 1) {
    add("string", `m_astrUDLTypeName[${i}]`);
    add("u32", `m_anUDLTypeSegment[${i}]`);
    for (let j = 1; j <= 10; j += 1) add("f64", `m_aadUDLTypePitch[${i}][${j}]`);
  }
  for (let i = 1; i <= 10; i += 1) {
    add("f64", `m_adMojiX[${i}]`, `m_adMojiY[${i}]`, `m_adMojiD[${i}]`);
    add("u32", `m_anMojiCol[${i}]`);
  }
  add("f64", "m_dMojiSizeX", "m_dMojiSizeY", "m_dMojiKankaku");
  add("u32", "m_nMojiColor", "m_nMojiShu");
  add("f64", "m_dMojiSeiriGyouKan", "m_dMojiSeiriSuu");
  add("u32", "m_nMojiKijunZureOn");
  array("f64", "m_adMojiKijunZureX", 3);
  array("f64", "m_adMojiKijunZureY", 3);
  return fields;
}

const FIELDS = jwwHeaderFields();

export function parseJwwDocumentHeader(bytes, encoding = "shift_jis") {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 8;
  const need = (size) => {
    if (!Number.isSafeInteger(size) || size < 0 || cursor + size > bytes.length) throw new Error(`Truncated JWW header at byte ${cursor}`);
  };
  const uint = (size) => {
    need(size);
    const result = size === 1 ? view.getUint8(cursor) : size === 2 ? view.getUint16(cursor, true) : view.getUint32(cursor, true);
    cursor += size;
    return result;
  };
  const string = () => {
    let length = uint(1);
    let label = encoding;
    if (length === 255) {
      length = uint(2);
      if (length === 0xfffe || length === 0xfeff) {
        label = length === 0xfffe ? "utf-16le" : "utf-16be";
        length = uint(1);
        if (length === 255) { length = uint(2); if (length === 65535) length = uint(4); }
        length *= 2;
      } else if (length === 65535) length = uint(4);
    }
    need(length);
    const value = decodeJwwRawString(bytes.slice(cursor, cursor + length), label);
    cursor += length;
    return value;
  };
  const fields = FIELDS.map(({ name, type }) => {
    const start = cursor;
    let value;
    if (type === "string") value = string();
    else {
      need(type === "f64" ? 8 : 4);
      value = type === "f64" ? view.getFloat64(cursor, true) : type === "i32" ? view.getInt32(cursor, true) : view.getUint32(cursor, true);
      cursor += type === "f64" ? 8 : 4;
      if (!Number.isFinite(value)) throw new Error(`Non-finite JWW header field ${name}`);
    }
    return { name, type, value, offset: start, byteLength: cursor - start };
  });
  if (![600, 700].includes(fields[0].value) || String.fromCharCode(...bytes.slice(0, 8)) !== "JwwData.") throw new Error("Unsupported JWW header/version");
  return { sourceLayout: JWW_HEADER_LAYOUT, byteLength: cursor, fields, sourceBytes: Array.from(bytes.slice(0, cursor)) };
}

export function encodeJwwDocumentHeader(header) {
  if (header?.sourceLayout !== JWW_HEADER_LAYOUT || !Array.isArray(header.sourceBytes)) throw new Error("Verified JWW document header is required");
  if (!header.sourceBytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) throw new Error("Invalid JWW document source byte");
  const original = Uint8Array.from(header.sourceBytes);
  const parsed = parseJwwDocumentHeader(original);
  if (parsed.byteLength !== original.length || header.fields?.length !== parsed.fields.length) throw new Error("JWW document header layout mismatch");
  const chunks = [original.slice(0, 8)];
  for (let i = 0; i < parsed.fields.length; i += 1) {
    const before = parsed.fields[i];
    const after = header.fields[i];
    if (after.name !== before.name || after.type !== before.type) throw new Error(`JWW header field mismatch at ${i}`);
    // JSON normalizes -0 to 0; an unchanged numeric value retains its source bits.
    if (before.value === after.value) { chunks.push(original.slice(before.offset, before.offset + before.byteLength)); continue; }
    if (before.name === "JW_DATA_VERSION") throw new Error("Use the writer version option to change JWW version");
    if (before.type === "string") {
      if (typeof after.value !== "string" || after.value.length > 1_000_000) throw new Error(`Invalid JWW string ${before.name}`);
      const length = after.value.length;
      const size = length < 255 ? 1 : length < 65535 ? 3 : 7;
      const bytes = new Uint8Array(3 + size + length * 2);
      const view = new DataView(bytes.buffer);
      bytes.set([255, 254, 255]);
      if (size === 1) bytes[3] = length;
      else { bytes[3] = 255; view.setUint16(4, size === 3 ? length : 65535, true); if (size === 7) view.setUint32(6, length, true); }
      for (let j = 0; j < length; j += 1) view.setUint16(3 + size + j * 2, after.value.charCodeAt(j), true);
      chunks.push(bytes);
    } else {
      const value = after.value;
      const signed = before.type === "i32";
      if (typeof value !== "number" || !Number.isFinite(value) || (before.type !== "f64" && (!Number.isInteger(value) || value < (signed ? -2147483648 : 0) || value > (signed ? 2147483647 : 4294967295)))) throw new Error(`Invalid JWW header value ${before.name}`);
      const bytes = new Uint8Array(before.type === "f64" ? 8 : 4);
      const view = new DataView(bytes.buffer);
      if (before.type === "f64") view.setFloat64(0, value, true);
      else if (signed) view.setInt32(0, value, true);
      else view.setUint32(0, value, true);
      chunks.push(bytes);
    }
  }
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export function decodeJwwMaxDrawWidth(value) {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) throw new Error("Invalid JWW maximum draw width");
  if (value === -101) return { raw: value, hundredthMillimeter: true, previousMaximum: null };
  if (value <= -201 && value >= -300) return { raw: value, hundredthMillimeter: true, previousMaximum: -value - 200 };
  if (value <= -401 && value >= -500) return { raw: value, hundredthMillimeter: true, previousMaximum: value + 400 };
  if (value < -100) return { raw: value, hundredthMillimeter: null, previousMaximum: null, verified: false };
  return { raw: value, hundredthMillimeter: false, previousMaximum: value };
}
