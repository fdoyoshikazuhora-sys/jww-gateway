import { BinaryReader } from "./BinaryReader.js";
import {
  decodeAsciiClassName,
  decodeJwwString,
  decodeJwwStringWithMetadata,
} from "./decoder.js";
import { rgbToHex } from "./shared.js";

const HEADER = [0x4a, 0x77, 0x77, 0x44, 0x61, 0x74, 0x61, 0x2e];
const LINE_TYPE_ROWS = [
  ...Array.from({ length: 8 }, (_, index) => ({
    key: `LTYPE_${String(index + 2).padStart(2, "0")}`,
    paramCount: 3,
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    key: `LTYPE_R${index + 1}`,
    paramCount: 4,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    key: `LTYPE_L${index + 1}`,
    paramCount: 3,
  })),
];

function emptyLayerGroups() {
  return Array.from({ length: 16 }, (_, groupIndex) => ({
    state: 0,
    write_layer: 0,
    scale: 1,
    protect: 0,
    name: `Group${groupIndex}`,
    layers: Array.from({ length: 16 }, (_, layerIndex) => ({
      state: 0,
      protect: 0,
      name: `${groupIndex}-${layerIndex}`,
    })),
  }));
}

function emptyDocument() {
  return {
    version: 0,
    memo: "",
    paper_size: 0,
    write_layer_group: 0,
    layer_groups: emptyLayerGroups(),
    entities: [],
    block_defs: [],
    embedded_images: [],
    color_settings: { screenColors: {} },
    print_settings: {},
    sunpou_settings: {},
    diagnostics: {
      unsupportedClasses: {},
      unsupportedCount: 0,
      skippedCount: 0,
    },
  };
}

function hasHeader(data) {
  return HEADER.every((byte, index) => data[index] === byte);
}

function readCString(reader, encoding, textContext = {}) {
  const { length, stringEncoding } = readJwwStringLength(reader, encoding);
  if (length <= 0 || length > 1000000) return "";
  return decodeJwwString(reader.readBytes(length), stringEncoding, textContext);
}

function readCStringWithMetadata(reader, encoding, textContext = {}) {
  const { length, stringEncoding } = readJwwStringLength(reader, encoding);
  if (length <= 0 || length > 1000000) {
    return {
      rawText: "",
      resolvedText: "",
      text: "",
      specialRuns: [],
      textSegments: [],
    };
  }
  return decodeJwwStringWithMetadata(
    reader.readBytes(length),
    stringEncoding,
    textContext
  );
}

function readJwwStringLength(reader, encoding) {
  const lenByte = reader.readByte();
  if (lenByte !== 255) {
    return { length: lenByte, stringEncoding: encoding };
  }

  const lenWord = reader.readWord();
  if (lenWord === 0xfffe || lenWord === 0xfeff) {
    const charLength = readJwwExtendedLength(reader);
    return {
      length: charLength * 2,
      stringEncoding: lenWord === 0xfffe ? "utf-16le" : "utf-16be",
    };
  }

  return {
    length: lenWord < 65535 ? lenWord : reader.readDword(),
    stringEncoding: encoding,
  };
}

function readJwwExtendedLength(reader) {
  const lenByte = reader.readByte();
  if (lenByte !== 255) return lenByte;
  const lenWord = reader.readWord();
  return lenWord < 65535 ? lenWord : reader.readDword();
}

function readEntityBase(reader, version) {
  return {
    group: reader.readDword(),
    pen_style: reader.readByte(),
    pen_color: reader.readWord(),
    pen_width: version >= 351 ? reader.readWord() : 0,
    layer: reader.readWord(),
    layer_group: reader.readWord(),
    flag: reader.readWord(),
  };
}

function parsePrintSettings(reader) {
  return {
    origin_x: reader.readDouble(),
    origin_y: reader.readDouble(),
    scale: reader.readDouble(),
    rotation_setting: reader.readDword(),
  };
}

function parseSunpouSettings(reader) {
  for (let i = 0; i < 14; i += 1) reader.readDword();
  return {
    sunpou1: reader.readDword(),
    sunpou2: reader.readDword(),
    sunpou3: reader.readDword(),
    sunpou4: reader.readDword(),
    sunpou5: reader.readDword(),
    dummy: reader.readDword(),
    max_line_width: reader.readDword(),
  };
}

function readColorEntry(data, offset) {
  if (offset < 0 || offset + 8 > data.length) return null;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const reserved = data[offset + 3];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = view.getUint32(offset + 4, true);
  if (reserved !== 0 || width > 1000) return null;
  return {
    red,
    green,
    blue,
    width,
    hex: rgbToHex(red, green, blue),
  };
}

function readRgbEntry(data, offset) {
  if (offset < 0 || offset + 3 > data.length) return null;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  return {
    red,
    green,
    blue,
    hex: rgbToHex(red, green, blue),
  };
}

function addPointRadii(data, colors, offset) {
  if (!colors || !offset) return colors;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return colors.map((entry, index) => {
    const radiusOffset = offset + 80 + index * 8;
    if (radiusOffset + 8 > data.length) return entry;
    const pointRadius = view.getFloat64(radiusOffset, true);
    if (!Number.isFinite(pointRadius) || pointRadius < 0.001 || pointRadius > 100) {
      return entry;
    }
    return {
      ...entry,
      pointRadius,
    };
  });
}

function readPrintColorEntry(data, offset, hasPointRadius = true) {
  const entry = readColorEntry(data, offset);
  if (!entry) return null;
  if (!hasPointRadius) return entry;
  const pointRadius = readFloat64(data, offset + 8);
  if (!Number.isFinite(pointRadius) || pointRadius < 0 || pointRadius > 100) {
    return null;
  }
  return {
    ...entry,
    pointRadius,
  };
}

function scoreColorTable(data, offset) {
  let score = 0;
  const colors = [];
  const widths = [];
  for (let index = 0; index < 10; index += 1) {
    const entry = readColorEntry(data, offset + index * 8);
    if (!entry) return null;
    colors.push(entry);
    widths.push(entry.width);
    if (entry.width > 0 && entry.width <= 64) score += 3;
    else if (entry.width <= 1000) score += 1;
    if (entry.red !== entry.green || entry.green !== entry.blue) score += 1;
  }
  const distinctColors = new Set(
    colors.map((color) => `${color.red}/${color.green}/${color.blue}`)
  ).size;
  if (distinctColors < 5) return null;
  const isGray = (color) =>
    color && color.red === color.green && color.green === color.blue;
  if (isGray(colors[8])) score += 10;
  if (!isGray(colors[8]) && isGray(colors[9])) score -= 8;
  const repeatedWidth = widths.every((width) => width === widths[0]);
  if (repeatedWidth && widths[0] > 16) score -= 12;
  if (widths.filter((width) => width > 0 && width <= 16).length >= 8) score += 8;
  return { score, colors };
}

function scorePrintColorTable(data, offset) {
  const colors = [];
  let score = 0;
  for (let index = 0; index < 8; index += 1) {
    const entry = readPrintColorEntry(data, offset + index * 16, true);
    if (!entry) return null;
    colors.push(entry);
    if (entry.width > 0 && entry.width <= 100) score += 4;
    if (entry.pointRadius >= 0.01 && entry.pointRadius <= 10) score += 4;
    if (entry.red !== entry.green || entry.green !== entry.blue) score += 1;
  }
  const gray = readColorEntry(data, offset + 8 * 16);
  if (gray) {
    colors.push(gray);
    if (gray.red === gray.green && gray.green === gray.blue) score += 12;
  }
  const distinctColors = new Set(
    colors.map((color) => `${color.red}/${color.green}/${color.blue}/${color.width}`)
  ).size;
  if (distinctColors < 3) score -= 8;
  return { score, colors };
}

function parseColorSettings(data, entityOffset) {
  const searchEnd = Math.max(0, Math.min(entityOffset || data.length, data.length - 80));
  const candidates = [];
  for (let offset = HEADER.length; offset < searchEnd; offset += 1) {
    const candidate = scoreColorTable(data, offset);
    if (!candidate) continue;
    candidates.push({ ...candidate, offset });
  }
  const rankedCandidates = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  const best = rankedCandidates[0] || null;
  if (!best) return { screenColors: {} };
  const screenColors = {};
  best.colors.forEach((entry, index) => {
    screenColors[index + 1] = entry;
  });
  const backgroundColor = readColorEntry(data, best.offset - 8);
  const specialColors = parseSpecialScreenColors(data, best.offset);
  const printCandidates = [];
  const printSearchEnd = Math.min(
    entityOffset || data.length,
    best.offset + 1024,
    data.length - 136
  );
  for (let offset = best.offset + 80; offset <= printSearchEnd; offset += 1) {
    const candidate = scorePrintColorTable(data, offset);
    if (!candidate) continue;
    printCandidates.push({ ...candidate, offset, kind: "print-rgb-width-radius" });
  }
  const bestPrintColorTable = printCandidates.sort((a, b) => b.score - a.score)[0] || null;
  const printCandidate =
    bestPrintColorTable ||
    rankedCandidates.find(
      (candidate) =>
        candidate.offset >= best.offset + 80 &&
        candidate.offset <= best.offset + 1024
    ) || null;
  const printColors = {};
  if (printCandidate) {
    const colorsWithPointRadii =
      printCandidate.kind === "print-rgb-width-radius"
        ? printCandidate.colors
        : addPointRadii(data, printCandidate.colors, printCandidate.offset);
    colorsWithPointRadii.forEach((entry, index) => {
      printColors[index + 1] = entry;
    });
  }
  return {
    screenColors,
    ...(printCandidate
      ? {
          printColors,
          printColorTableOffset: printCandidate.offset,
          printColorTableScore: printCandidate.score,
          printColorTableKind: printCandidate.kind || "rgb-width",
        }
      : {}),
    backgroundColor,
    specialColors,
    offset: best.offset,
    colorTableCandidates: rankedCandidates.map((candidate) => ({
      offset: candidate.offset,
      score: candidate.score,
      role:
        candidate.offset === best.offset
          ? "screen"
            : printCandidate && candidate.offset === printCandidate.offset
              ? "print"
              : "candidate",
    })),
    printColorTableCandidates: [
      ...printCandidates.slice(0, 8).map((candidate) => ({
        offset: candidate.offset,
        score: candidate.score,
        role: printCandidate && candidate.offset === printCandidate.offset ? "print" : "candidate",
        kind: candidate.kind,
      })),
    ],
  };
}

function parseSpecialScreenColors(data, colorTableOffset) {
  if (!colorTableOffset) return {};
  const definitions = {
    S: { key: "LCOLLOR_S", label: "selection", relativeOffset: 200 },
    K: { key: "LCOLLOR_K", label: "temporary", relativeOffset: 756 },
    Z: { key: "LCOLLOR_Z", label: "zoomFrame", relativeOffset: 216 },
  };
  return Object.fromEntries(
    Object.entries(definitions)
      .map(([suffix, definition]) => {
        const offset = colorTableOffset + definition.relativeOffset;
        const entry = readRgbEntry(data, offset);
        if (!entry) return null;
        return [
          suffix,
          {
            ...entry,
            key: definition.key,
            label: definition.label,
            offset,
            relativeOffset: definition.relativeOffset,
            source: "jww-special-screen-color-candidate",
          },
        ];
      })
      .filter(Boolean)
  );
}

function parseLineTypeSettings(data, colorSettings = {}, entityOffset) {
  if (!colorSettings.offset) return null;
  const searchStart = Math.max(0, colorSettings.offset + 120);
  const searchEnd = Math.min(
    entityOffset || data.length,
    colorSettings.offset + 900,
    data.length
  );
  let best = null;
  for (let offset = searchStart; offset < searchEnd; offset += 2) {
    const candidate = readLineTypeCandidate(data, offset);
    if (!candidate) continue;
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best && best.score >= 70 ? best : null;
}

function readLineTypeCandidate(data, offset) {
  let cursor = offset;
  let score = 0;
  const rows = {};
  for (const definition of LINE_TYPE_ROWS) {
    if (cursor + 4 * (1 + definition.paramCount) > data.length) return null;
    const pattern = readUint32(data, cursor);
    const params = [];
    for (let index = 0; index < definition.paramCount; index += 1) {
      params.push(readUint32(data, cursor + 4 * (index + 1)));
    }
    if (pattern === null || params.some((value) => value === null)) return null;
    if (pattern !== 0) score += 2;
    if (params.every((value) => value >= 0 && value <= 1000)) score += 4;
    if (params.some((value) => value > 100000)) score -= 12;
    rows[definition.key] = {
      pattern: pattern.toString(16).padStart(8, "0"),
      params,
      values: [pattern.toString(16).padStart(8, "0"), ...params],
      offset: cursor,
    };
    cursor += 4 * (1 + definition.paramCount);
  }
  return {
    offset,
    byteLength: cursor - offset,
    score,
    rows,
    tailCandidate: readLineTypeTailCandidate(data, cursor),
  };
}

function readLineTypeTailCandidate(data, offset) {
  if (offset < 0 || offset + 24 > data.length) return null;
  const u32 = [];
  const u16 = [];
  for (let index = 0; index < 6; index += 1) {
    const value = readUint32(data, offset + index * 4);
    if (value === null) return null;
    u32.push(value);
  }
  for (let index = 0; index < 12; index += 1) {
    const value = readUint16(data, offset + index * 2);
    if (value === null) return null;
    u16.push(value);
  }
  return {
    key: "LTYPE_HC",
    offset,
    byteLength: 24,
    u32,
    u32Semantic: lineTypeHcSemantic(u32),
    u16,
    valueSchema: [
      "selectionTemporaryLineTypeNo",
      "crosslineCursorLineTypeNo",
      "dashPitchAutoAdjust",
      "rightClickBaseLineColorNo",
      "rightClickBaseLineTypeNo",
      "lineEndStyle",
    ],
    note: "candidate bytes after LTYPE_L4; public JWF docs define the six LTYPE_HC fields, but this candidate is not promoted because sample files do not match JWF LTYPE_HC values directly",
  };
}

function lineTypeHcSemantic(values = []) {
  const [
    selectionTemporaryLineTypeNo,
    crosslineCursorLineTypeNo,
    dashPitchAutoAdjust,
    rightClickBaseLineColorNo,
    rightClickBaseLineTypeNo,
    lineEndStyle,
  ] = values.map((value) => Number(value));
  if (
    ![
      selectionTemporaryLineTypeNo,
      crosslineCursorLineTypeNo,
      dashPitchAutoAdjust,
      rightClickBaseLineColorNo,
      rightClickBaseLineTypeNo,
      lineEndStyle,
    ].every(Number.isFinite)
  ) {
    return null;
  }
  const lineEndStyleNames = {
    0: "round",
    1: "square",
    2: "flat",
  };
  return {
    selectionTemporaryLineTypeNo,
    crosslineCursorLineTypeNo,
    dashPitchAutoAdjust,
    rightClickBaseLineColorNo,
    rightClickBaseLineTypeNo,
    lineEndStyle,
    lineEndStyleName: lineEndStyleNames[lineEndStyle] || "unknown",
  };
}

function parseLayerGroups(reader) {
  const layerGroups = [];
  for (let groupIndex = 0; groupIndex < 16; groupIndex += 1) {
    const state = reader.readDword();
    const writeLayer = reader.readDword();
    const scale = reader.readDouble();
    const protect = reader.readDword();
    const layers = [];
    for (let layerIndex = 0; layerIndex < 16; layerIndex += 1) {
      layers.push({
        state: reader.readDword(),
        protect: reader.readDword(),
        name: "",
      });
    }
    layerGroups.push({
      state,
      write_layer: writeLayer,
      scale,
      protect,
      layers,
      name: "",
    });
  }
  return layerGroups;
}

function parseLayerNames(reader, layerGroups, encoding, textContext = {}) {
  const layerNames = [];
  for (let groupIndex = 0; groupIndex < 16; groupIndex += 1) {
    const names = [];
    for (let layerIndex = 0; layerIndex < 16; layerIndex += 1) {
      names.push(readCString(reader, encoding, textContext));
    }
    layerNames.push(names);
  }

  const groupNames = [];
  for (let groupIndex = 0; groupIndex < 16; groupIndex += 1) {
    groupNames.push(readCString(reader, encoding, textContext));
  }

  if (isSuspiciousLayerNameBlock(layerNames, groupNames)) {
    return withDefaultLayerNames(layerGroups);
  }

  return withLayerNameStatus(
    layerGroups.map((group, groupIndex) => ({
      ...group,
      name: safeLayerName(
        groupNames[groupIndex],
        defaultGroupName(groupIndex)
      ),
      layers: group.layers.map((layer, layerIndex) => ({
        ...layer,
        name: safeLayerName(
          layerNames[groupIndex]?.[layerIndex],
          defaultLayerName(groupIndex, layerIndex)
        ),
      })),
    })),
    true,
    collectLayerNameFallbacks(layerNames, groupNames)
  );
}

function withDefaultLayerNames(layerGroups) {
  return withLayerNameStatus(
    layerGroups.map((group, groupIndex) => ({
      ...group,
      name: defaultGroupName(groupIndex),
      layers: group.layers.map((layer, layerIndex) => ({
        ...layer,
        name: defaultLayerName(groupIndex, layerIndex),
      })),
    })),
    false
  );
}

function withLayerNameStatus(layerGroups, namesExtracted, nameFallbacks = []) {
  Object.defineProperty(layerGroups, "namesExtracted", {
    value: namesExtracted,
    enumerable: false,
  });
  Object.defineProperty(layerGroups, "nameFallbacks", {
    value: nameFallbacks,
    enumerable: false,
  });
  return layerGroups;
}

function defaultGroupName(groupIndex) {
  return `Group${groupIndex}`;
}

function defaultLayerName(groupIndex, layerIndex) {
  return `${groupIndex}-${layerIndex}`;
}

function safeLayerName(name, fallback) {
  const text = String(name || "").trim();
  return text && !isSuspiciousLayerName(text) ? text : fallback;
}

function collectLayerNameFallbacks(layerNames, groupNames) {
  const fallbacks = [];
  for (let groupIndex = 0; groupIndex < 16; groupIndex += 1) {
    const groupName = String(groupNames[groupIndex] || "").trim();
    if (groupName && isSuspiciousLayerName(groupName)) {
      fallbacks.push({
        kind: "group",
        group: groupIndex,
        original: diagnosticLayerName(groupName),
        fallback: defaultGroupName(groupIndex),
      });
    }
    for (let layerIndex = 0; layerIndex < 16; layerIndex += 1) {
      const layerName = String(layerNames[groupIndex]?.[layerIndex] || "").trim();
      if (layerName && isSuspiciousLayerName(layerName)) {
        fallbacks.push({
          kind: "layer",
          group: groupIndex,
          layer: layerIndex,
          original: diagnosticLayerName(layerName),
          fallback: defaultLayerName(groupIndex, layerIndex),
        });
      }
    }
  }
  return fallbacks;
}

function diagnosticLayerName(name) {
  return String(name || "")
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13
        ? "\ufffd"
        : char;
    })
    .join("");
}

function isSuspiciousLayerNameBlock(layerNames, groupNames) {
  const names = [...groupNames, ...layerNames.flat()].filter(Boolean);
  if (!names.length) return false;
  let suspicious = 0;
  for (const name of names) {
    if (isSuspiciousLayerName(name)) suspicious += 1;
  }
  return suspicious >= 8 || (names.length >= 32 && suspicious / names.length > 0.15);
}

function isSuspiciousLayerName(name) {
  const text = String(name || "");
  if (!text) return false;
  if (text.length > 40) return true;
  if (text.includes("\ufffd")) return true;
  if (
    Array.from(text).some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 && code !== 9 && code !== 10 && code !== 13;
    })
  ) {
    return true;
  }
  return false;
}

function readUint32(data, offset) {
  if (offset < 0 || offset + 4 > data.length) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getUint32(offset, true);
}

function readUint16(data, offset) {
  if (offset < 0 || offset + 2 > data.length) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getUint16(offset, true);
}

function readFloat64(data, offset) {
  if (offset < 0 || offset + 8 > data.length) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getFloat64(offset, true);
}

function summarizeU32Pairs(data, start, end) {
  const pairs = new Map();
  for (let offset = start; offset + 8 <= end; offset += 8) {
    const first = readUint32(data, offset);
    const second = readUint32(data, offset + 4);
    if (first === null || second === null) continue;
    if (first > 1000000 || second > 1000000) continue;
    const key = `${first}/${second}`;
    const current = pairs.get(key) || {
      first,
      second,
      count: 0,
      firstOffset: offset,
      lastOffset: offset,
    };
    current.count += 1;
    current.lastOffset = offset;
    pairs.set(key, current);
  }
  return Array.from(pairs.values())
    .filter((row) => row.count >= 2)
    .sort((a, b) => b.count - a.count || a.firstOffset - b.firstOffset)
    .slice(0, 16);
}

function summarizeDoubleCandidates(data, start, end) {
  const samples = [];
  for (let offset = start; offset + 8 <= end; offset += 8) {
    const value = readFloat64(data, offset);
    if (!Number.isFinite(value)) continue;
    if (Math.abs(value) < 0.000001 || Math.abs(value) > 1000000) continue;
    samples.push({ offset, value });
    if (samples.length >= 32) break;
  }
  return samples;
}

function scanEnvironmentRegion(data, start, end) {
  const safeStart = Math.max(0, Math.min(start || 0, data.length));
  const safeEnd = Math.max(safeStart, Math.min(end || data.length, data.length));
  return {
    afterLayerNamesOffset: safeStart,
    entityListOffset: safeEnd || null,
    byteLength: safeEnd - safeStart,
    u32PairRuns: summarizeU32Pairs(data, safeStart, safeEnd),
    doubleSamples: summarizeDoubleCandidates(data, safeStart, safeEnd),
  };
}

function findEntityListOffset(data, version) {
  const schemaLow = version & 255;
  const schemaHigh = (version >>> 8) & 255;
  const searchEnd = data.length - 20;
  for (let i = 100; i < searchEnd; i += 1) {
    if (data[i] !== 255 || data[i + 1] !== 255) continue;
    if (data[i + 2] !== schemaLow || data[i + 3] !== schemaHigh) continue;
    const nameLen = data[i + 4] | (data[i + 5] << 8);
    if (nameLen < 8 || nameLen > 20 || i + 6 + nameLen > data.length) continue;
    const marker = String.fromCharCode(
      data[i + 6],
      data[i + 7],
      data[i + 8],
      data[i + 9],
      data[i + 10]
    );
    if (marker === "CData") return i - 2;
  }
  return undefined;
}

function wrap(value) {
  return value ? { value } : undefined;
}

function isMetadataText(content) {
  return /^hq[bd]/.test(content || "") || /^jww_/.test(content || "");
}

function parseTextPayload(reader, encoding, textContext = {}) {
  const start_x = reader.readDouble();
  const start_y = reader.readDouble();
  const end_x = reader.readDouble();
  const end_y = reader.readDouble();
  const text_type = reader.readDword();
  const size_x = reader.readDouble();
  const size_y = reader.readDouble();
  const spacing = reader.readDouble();
  const angle = reader.readDouble();
  const font_name = readCString(reader, encoding, textContext);
  const contentResult = readCStringWithMetadata(reader, encoding, textContext);
  return {
    start_x,
    start_y,
    end_x,
    end_y,
    text_type,
    size_x,
    size_y,
    spacing,
    angle,
    font_name,
    content: contentResult.text,
    raw_content: contentResult.rawText,
    resolved_content: contentResult.resolvedText,
    jww_special_runs: contentResult.specialRuns,
    jww_text_segments: contentResult.textSegments,
  };
}

function skipSunpouExtra(reader, version) {
  if (version < 420) return;
  reader.readWord();
  for (let i = 0; i < 2; i += 1) {
    readEntityBase(reader, version);
    reader.readDouble();
    reader.readDouble();
    reader.readDouble();
    reader.readDouble();
  }
  for (let i = 0; i < 4; i += 1) {
    readEntityBase(reader, version);
    reader.readDouble();
    reader.readDouble();
    reader.readDword();
  }
}

function createDiagnostics() {
  return {
    unsupportedClasses: {},
    unsupportedCount: 0,
    skippedCount: 0,
  };
}

function addUnsupportedClass(diagnostics, className) {
  const key = className || "(unknown)";
  diagnostics.unsupportedClasses[key] =
    (diagnostics.unsupportedClasses[key] || 0) + 1;
  diagnostics.unsupportedCount += 1;
}

function textContextForBase(textContext = {}, base = {}) {
  const layerGroupIndex = Math.max(0, Math.min(15, Number(base.layer_group) || 0));
  const denominator = Number(textContext.layerGroups?.[layerGroupIndex]?.scale || 0);
  return {
    ...textContext,
    layerGroupIndex,
    scaleDenominator: denominator,
    scaleLabel: denominator > 0 ? `1/${Math.round(denominator)}` : textContext.scaleLabel,
  };
}

function parseEntityByClass(
  className,
  reader,
  version,
  encoding,
  diagnostics,
  textContext = {}
) {
  if (className === "CDataSen") {
    return wrap({
      base: readEntityBase(reader, version),
      start_x: reader.readDouble(),
      start_y: reader.readDouble(),
      end_x: reader.readDouble(),
      end_y: reader.readDouble(),
    });
  }

  if (className === "CDataEnko") {
    return wrap({
      base: readEntityBase(reader, version),
      center_x: reader.readDouble(),
      center_y: reader.readDouble(),
      radius: reader.readDouble(),
      start_angle: reader.readDouble(),
      arc_angle: reader.readDouble(),
      tilt_angle: reader.readDouble(),
      flatness: reader.readDouble(),
      is_full_circle: reader.readDword() !== 0,
    });
  }

  if (className === "CDataTen") {
    const base = readEntityBase(reader, version);
    const value = {
      base,
      x: reader.readDouble(),
      y: reader.readDouble(),
      is_temporary: reader.readDword() !== 0,
      code: 0,
      angle: 0,
      scale: 1,
    };
    if (base.pen_style === 100) {
      value.code = reader.readDword();
      value.angle = reader.readDouble();
      value.scale = reader.readDouble();
    }
    return wrap(value);
  }

  if (className === "CDataMoji") {
    const base = readEntityBase(reader, version);
    const text = {
      base,
      ...parseTextPayload(reader, encoding, textContextForBase(textContext, base)),
    };
    if (isMetadataText(text.content)) return undefined;
    return wrap(text);
  }

  if (className === "CDataSolid") {
    const base = readEntityBase(reader, version);
    const point1_x = reader.readDouble();
    const point1_y = reader.readDouble();
    const point4_x = reader.readDouble();
    const point4_y = reader.readDouble();
    const point2_x = reader.readDouble();
    const point2_y = reader.readDouble();
    const point3_x = reader.readDouble();
    const point3_y = reader.readDouble();
    return wrap({
      base,
      point1_x,
      point1_y,
      point2_x,
      point2_y,
      point3_x,
      point3_y,
      point4_x,
      point4_y,
      color: base.pen_color === 10 ? reader.readDword() : 0,
    });
  }

  if (className === "CDataSunpou") {
    readEntityBase(reader, version);
    const lineBase = readEntityBase(reader, version);
    const start_x = reader.readDouble();
    const start_y = reader.readDouble();
    const end_x = reader.readDouble();
    const end_y = reader.readDouble();
    const textBase = readEntityBase(reader, version);
    const text = {
      base: textBase,
      ...parseTextPayload(
        reader,
        encoding,
        textContextForBase(textContext, textBase)
      ),
    };
    skipSunpouExtra(reader, version);
    if (!text.content) {
      return wrap({ base: lineBase, start_x, start_y, end_x, end_y });
    }
    return wrap({
      ...text,
      dimension_line: {
        base: lineBase,
        start_x,
        start_y,
        end_x,
        end_y,
      },
    });
  }

  if (className === "CDataBlock") {
    return wrap({
      base: readEntityBase(reader, version),
      ref_x: reader.readDouble(),
      ref_y: reader.readDouble(),
      scale_x: reader.readDouble(),
      scale_y: reader.readDouble(),
      rotation: reader.readDouble(),
      def_number: reader.readDword(),
    });
  }

  addUnsupportedClass(diagnostics, className);
  readEntityBase(reader, version);
  reader.readDouble();
  reader.readDouble();
  reader.readDouble();
  reader.readDouble();
  return undefined;
}

function parseEntityWithClassTracking(
  reader,
  version,
  pidToClass,
  nextPid,
  encoding,
  diagnostics,
  textContext = {}
) {
  const classId = reader.readWord();
  let className = "";
  let updatedNextPid = nextPid;

  if (classId === 65535) {
    reader.readWord();
    className = decodeAsciiClassName(reader.readBytes(reader.readWord()));
    if (updatedNextPid < pidToClass.length) pidToClass[updatedNextPid] = className;
    updatedNextPid = (updatedNextPid + 1) & 65535;
  } else if (classId === 32768) {
    return { entity: undefined, pidToClass, nextPid: (nextPid + 1) & 65535 };
  } else {
    className = pidToClass[classId & 32767] || "";
    if (!className) {
      parseEntityByClass("", reader, version, encoding, diagnostics, textContext);
      return { entity: undefined, pidToClass, nextPid: (nextPid + 1) & 65535 };
    }
  }

  return {
    entity: parseEntityByClass(
      className,
      reader,
      version,
      encoding,
      diagnostics,
      textContext
    ),
    pidToClass,
    nextPid: (updatedNextPid + 1) & 65535,
  };
}

function parseEntityList(
  data,
  offset,
  version,
  encoding,
  diagnostics,
  textContext = {}
) {
  const reader = new BinaryReader(data, offset);
  const startPos = reader.pos;
  const count = reader.readWord();
  const entities = [];
  let pidToClass = Array.from({ length: 65536 }, () => "");
  let nextPid = 1;

  for (let i = 0; i < count && reader.remaining() >= 4; i += 1) {
    const result = parseEntityWithClassTracking(
      reader,
      version,
      pidToClass,
      nextPid,
      encoding,
      diagnostics,
      textContext
    );
    if (result.entity) entities.push(result.entity);
    else diagnostics.skippedCount += 1;
    pidToClass = result.pidToClass;
    nextPid = result.nextPid;
  }

  return {
    entities,
    bytes_consumed: reader.pos - startPos,
  };
}

export function parse(input, options = {}) {
  const encoding = options.encoding || "shift_jis";
  const baseTextContext = options.textContext || {};
  const data = input instanceof Uint8Array ? input : Uint8Array.from(input || []);
  if (data.length < HEADER.length || !hasHeader(data)) return emptyDocument();

  const reader = new BinaryReader(data, HEADER.length);
  const diagnostics = createDiagnostics();
  const version = reader.readDword();
  const memo = readCString(reader, encoding, baseTextContext);
  const paper_size = reader.readDword();
  const write_layer_group = reader.readDword();
  let layer_groups = parseLayerGroups(reader);
  const print_settings = parsePrintSettings(reader);
  const sunpou_settings = parseSunpouSettings(reader);
  const textContext = {
    ...baseTextContext,
    memo,
    layerGroups: layer_groups,
  };
  layer_groups = parseLayerNames(reader, layer_groups, encoding, textContext);
  const layer_names_extracted = layer_groups.namesExtracted !== false;
  const layer_name_fallbacks = layer_groups.nameFallbacks || [];
  const afterLayerNamesOffset = reader.pos;
  textContext.layerGroups = layer_groups;

  const entityOffset = findEntityListOffset(data, version);
  const color_settings = parseColorSettings(data, entityOffset);
  const line_type_settings = parseLineTypeSettings(
    data,
    color_settings,
    entityOffset
  );
  const environment_region = scanEnvironmentRegion(
    data,
    afterLayerNamesOffset,
    entityOffset || afterLayerNamesOffset
  );
  const entityResult =
    entityOffset === undefined
      ? { entities: [], bytes_consumed: 0 }
      : parseEntityList(
          data,
          entityOffset,
          version,
          encoding,
          diagnostics,
          textContext
        );

  return {
    version,
    memo,
    paper_size,
    write_layer_group,
    layer_groups,
    layer_names_extracted,
    layer_name_fallbacks,
    entities: entityResult.entities,
    block_defs: [],
    embedded_images: [],
    color_settings,
    line_type_settings,
    environment_region,
    print_settings,
    sunpou_settings,
    diagnostics,
  };
}

export function to_json_string(doc) {
  return JSON.stringify({ version: doc?.version || 0 });
}
