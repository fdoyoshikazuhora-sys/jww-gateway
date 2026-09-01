import { BinaryReader } from "./BinaryReader.js";
import {
  decodeAsciiClassName,
  decodeJwwRawString,
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
    entity_records: [],
    entity_list_complete: false,
    block_defs: [],
    block_records: [],
    block_list_complete: false,
    embedded_images: [],
    color_settings: { screenColors: {} },
    print_settings: {},
    grid_settings: {},
    sunpou_settings: {},
    diagnostics: createDiagnostics(),
  };
}

function hasHeader(data) {
  return HEADER.every((byte, index) => data[index] === byte);
}

function readCString(reader, encoding) {
  const { length, stringEncoding } = readJwwStringLength(reader, encoding);
  if (length <= 0 || length > 1000000) return "";
  return decodeJwwRawString(reader.readBytes(length), stringEncoding);
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

function readEmbeddedImageName(reader, encoding) {
  const start = reader.pos;
  const fail = (reason, declaredByteLength = null, stringEncoding = encoding) => ({
    ok: false,
    reason,
    text: "",
    declaredByteLength,
    bytesRead: 0,
    stringEncoding,
    start,
    end: reader.pos,
  });
  if (reader.remaining() < 1) return fail("truncated-file-name-length");

  const lenByte = reader.readByte();
  let length = lenByte;
  let stringEncoding = encoding;
  if (lenByte === 255) {
    if (reader.remaining() < 2) return fail("truncated-file-name-length");
    const lenWord = reader.readWord();
    if (lenWord === 0xfffe || lenWord === 0xfeff) {
      stringEncoding = lenWord === 0xfffe ? "utf-16le" : "utf-16be";
      if (reader.remaining() < 1) return fail("truncated-file-name-length", null, stringEncoding);
      const charLenByte = reader.readByte();
      let charLength = charLenByte;
      if (charLenByte === 255) {
        if (reader.remaining() < 2) return fail("truncated-file-name-length", null, stringEncoding);
        const charLenWord = reader.readWord();
        if (charLenWord < 65535) charLength = charLenWord;
        else {
          if (reader.remaining() < 4) return fail("truncated-file-name-length", null, stringEncoding);
          charLength = reader.readDword();
        }
      }
      length = charLength * 2;
    } else if (lenWord < 65535) length = lenWord;
    else {
      if (reader.remaining() < 4) return fail("truncated-file-name-length");
      length = reader.readDword();
    }
  }

  if (!Number.isSafeInteger(length) || length < 0 || length > 1000000) {
    return fail("invalid-file-name-length", length, stringEncoding);
  }
  const raw = reader.readBytes(length);
  return {
    ok: raw.length === length,
    reason: raw.length === length ? null : "truncated-file-name",
    text: decodeJwwRawString(raw, stringEncoding),
    declaredByteLength: length,
    bytesRead: raw.length,
    stringEncoding,
    start,
    end: reader.pos,
  };
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
    max_line_width: reader.readDword() | 0,
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

const OFFICIAL_SCREEN_COLOR_COUNT = 10;
const OFFICIAL_PRINT_COLOR_COUNT = 10;
const OFFICIAL_SCREEN_COLOR_BYTES = OFFICIAL_SCREEN_COLOR_COUNT * 8;
const OFFICIAL_PRINT_COLOR_BYTES = OFFICIAL_PRINT_COLOR_COUNT * 16;
const OFFICIAL_COLOR_SETTINGS_BYTES =
  OFFICIAL_SCREEN_COLOR_BYTES + OFFICIAL_PRINT_COLOR_BYTES;

function scoreOfficialColorSettings(data, offset) {
  if (offset < 0 || offset + OFFICIAL_COLOR_SETTINGS_BYTES > data.length) {
    return null;
  }
  const screen = [];
  const print = [];
  let score = 0;
  for (let index = 0; index < OFFICIAL_SCREEN_COLOR_COUNT; index += 1) {
    const entry = readColorEntry(data, offset + index * 8);
    if (!entry || entry.width < 1 || entry.width > 16) return null;
    screen.push(entry);
    score += 4;
  }
  const printOffset = offset + OFFICIAL_SCREEN_COLOR_BYTES;
  for (let index = 0; index < OFFICIAL_PRINT_COLOR_COUNT; index += 1) {
    const entry = readPrintColorEntry(data, printOffset + index * 16, true);
    if (
      !entry ||
      entry.width < 1 ||
      entry.width > 500 ||
      entry.pointRadius < 0.1 ||
      entry.pointRadius > 10
    ) {
      return null;
    }
    print.push(entry);
    score += 6;
  }
  const distinctScreenColors = new Set(
    screen.map((entry) => `${entry.red}/${entry.green}/${entry.blue}`)
  ).size;
  const distinctPrintColors = new Set(
    print.map((entry) => `${entry.red}/${entry.green}/${entry.blue}`)
  ).size;
  if (distinctScreenColors < 5 || distinctPrintColors < 3) return null;
  const isGray = (entry) =>
    entry.red === entry.green && entry.green === entry.blue;
  // Color 9 is named the gray slot by the format, but Jw_cad lets its RGB
  // value be customized. Gray values improve candidate ranking; they are not
  // a validity requirement for a saved edit.
  if (isGray(screen[9])) score += 10;
  if (isGray(print[9])) score += 10;
  const lineType = readLineTypeCandidate(data, offset + OFFICIAL_COLOR_SETTINGS_BYTES);
  if (lineType?.score >= 70) score += 30;
  return {
    offset,
    score,
    screen,
    print,
    lineTypeScore: lineType?.score ?? null,
  };
}

function parseLegacyColorSettings(data, entityOffset, searchStart) {
  const searchEnd = Math.max(0, Math.min(entityOffset || data.length, data.length - 80));
  const candidates = [];
  for (let offset = searchStart; offset < searchEnd; offset += 1) {
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
  best.colors.slice(0, 9).forEach((entry, index) => {
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
    sourceLayout: "heuristic-unverified",
    sourceSpan: null,
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

function parseColorSettings(data, entityOffset, environmentStart = HEADER.length) {
  const searchStart = Math.max(
    HEADER.length,
    Math.min(Number(environmentStart) || HEADER.length, data.length)
  );
  const searchEnd = Math.max(
    searchStart,
    Math.min(
      entityOffset || data.length,
      data.length - OFFICIAL_COLOR_SETTINGS_BYTES
    )
  );
  const candidates = [];
  for (let offset = searchStart; offset <= searchEnd; offset += 1) {
    const candidate = scoreOfficialColorSettings(data, offset);
    if (candidate) candidates.push(candidate);
  }
  const rankedCandidates = candidates
    .sort((left, right) => right.score - left.score || left.offset - right.offset)
    .slice(0, 12);
  const best = rankedCandidates[0] || null;
  if (!best) return parseLegacyColorSettings(data, entityOffset, searchStart);

  const sourceSpan = {
    start: best.offset,
    end: best.offset + OFFICIAL_COLOR_SETTINGS_BYTES,
    byteLength: OFFICIAL_COLOR_SETTINGS_BYTES,
  };
  const screenColorTableSourceSpan = {
    start: best.offset,
    end: best.offset + OFFICIAL_SCREEN_COLOR_BYTES,
    byteLength: OFFICIAL_SCREEN_COLOR_BYTES,
  };
  const printColorTableSourceSpan = {
    start: screenColorTableSourceSpan.end,
    end: sourceSpan.end,
    byteLength: OFFICIAL_PRINT_COLOR_BYTES,
  };
  const screenColors = Object.fromEntries(
    best.screen.slice(1).map((entry, index) => [index + 1, entry])
  );
  const printColors = Object.fromEntries(
    best.print.slice(1).map((entry, index) => [index + 1, entry])
  );
  const colorOneOffset = best.offset + 8;
  const printColorOneOffset = printColorTableSourceSpan.start + 16;
  return {
    screenColors,
    printColors,
    backgroundColor: best.screen[0],
    printBackgroundColor: best.print[0],
    // The former S/Z offsets land exactly on official print entries 8/9.
    // Do not expose those aliases as operation colors. K remains a clearly
    // labelled compatibility candidate outside the verified color span.
    specialColors: parseSpecialScreenColors(data, colorOneOffset, ["S", "Z"]),
    offset: colorOneOffset,
    screenColorTableOffset: best.offset,
    printColorTableOffset: printColorOneOffset,
    printColorTableScore: best.score,
    printColorTableKind: "print-rgb-width-radius",
    sourceLayout: "jwdatafmt-color-tables-v600-v700",
    sourceSpan,
    screenColorTableSourceSpan,
    printColorTableSourceSpan,
    colorTableCandidates: rankedCandidates.map((candidate) => ({
      offset: candidate.offset + 8,
      tableStart: candidate.offset,
      score: candidate.score,
      lineTypeScore: candidate.lineTypeScore,
      role: candidate.offset === best.offset ? "screen" : "candidate",
      kind: "jwdatafmt-color-tables-v600-v700",
    })),
    printColorTableCandidates: rankedCandidates.map((candidate) => ({
      offset: candidate.offset + OFFICIAL_SCREEN_COLOR_BYTES + 16,
      tableStart: candidate.offset + OFFICIAL_SCREEN_COLOR_BYTES,
      score: candidate.score,
      role: candidate.offset === best.offset ? "print" : "candidate",
      kind: "print-rgb-width-radius",
    })),
  };
}

function parseSpecialScreenColors(data, colorTableOffset, excludedKeys = []) {
  if (!colorTableOffset) return {};
  const excluded = new Set(excludedKeys);
  const definitions = {
    S: { key: "LCOLLOR_S", label: "selection", relativeOffset: 200 },
    K: { key: "LCOLLOR_K", label: "temporary", relativeOffset: 756 },
    Z: { key: "LCOLLOR_Z", label: "zoomFrame", relativeOffset: 216 },
  };
  return Object.fromEntries(
    Object.entries(definitions)
      .filter(([suffix]) => !excluded.has(suffix))
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
    key: "POST_LINE_TYPE_TAIL",
    offset,
    byteLength: 24,
    u32,
    u16,
    note: "diagnostic bytes after LTYPE_L4; controlled Jw_cad 10.02.1 Save As tests prove that this region is not the JWF-only LTYPE_HC setting",
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
    const className = String.fromCharCode(...data.slice(i + 6, i + 6 + nameLen));
    if (className.startsWith("CData")) {
      const extendedCount = readUint32(data, i - 4);
      let offset;
      if (
        readUint16(data, i - 6) === 0xffff &&
        extendedCount !== null &&
        extendedCount >= 0xffff
      ) {
        offset = i - 6;
      } else {
        offset = i - 2;
      }
      if (className === "CDataList" && readUint16(data, offset - 2) === 0) {
        return offset - 2;
      }
      return offset;
    }
  }
  return undefined;
}

function findEmptyEntityListOffset(data, searchStart, version, encoding, textContext) {
  const start = Math.max(0, Number(searchStart) || 0);
  for (let offset = start; offset + 4 <= data.length; offset += 1) {
    if (readUint16(data, offset) !== 0 || readUint16(data, offset + 2) !== 0) {
      continue;
    }
    const tailOffset = offset + 4;
    if (version < 700) {
      if (tailOffset === data.length) return offset;
      continue;
    }
    const images = parseEmbeddedImages(
      data,
      tailOffset,
      version,
      encoding,
      textContext
    );
    if (images.complete && tailOffset + images.bytes_consumed === data.length) {
      return offset;
    }
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
    jww_equal_spacing_controls: contentResult.equalSpacingControls,
  };
}

function parseLinePayload(reader, version) {
  return {
    base: readEntityBase(reader, version),
    start_x: reader.readDouble(),
    start_y: reader.readDouble(),
    end_x: reader.readDouble(),
    end_y: reader.readDouble(),
  };
}

function parseGridSettings(reader) {
  return {
    mode: reader.readDword() | 0,
    minimum_display_spacing: reader.readDouble(),
    spacing_x: reader.readDouble(),
    spacing_y: reader.readDouble(),
    base_x: reader.readDouble(),
    base_y: reader.readDouble(),
  };
}

function parsePointPayload(reader, version) {
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
  return value;
}

function parseSunpouExtra(reader, version) {
  if (version < 420) return null;
  return {
    sxf_mode: reader.readWord(),
    extension_line_1: parseLinePayload(reader, version),
    extension_line_2: parseLinePayload(reader, version),
    dimension_point_1: parsePointPayload(reader, version),
    dimension_point_2: parsePointPayload(reader, version),
    extension_point_1: parsePointPayload(reader, version),
    extension_point_2: parsePointPayload(reader, version),
  };
}

function createDiagnostics() {
  return {
    unsupportedClasses: {},
    unsupportedCount: 0,
    skippedCount: 0,
    unsupportedRecords: [],
    nullRecordCount: 0,
    objectReferenceCount: 0,
    embeddedImageCountDeclared: 0,
    embeddedImageCountParsed: 0,
    embeddedImageTruncatedCount: 0,
    embeddedImageIssues: [],
  };
}

const FILTERED_ENTITY = Symbol("filtered-jww-entity");
const UNSUPPORTED_ENTITY = Symbol("unsupported-jww-entity");

function addUnsupportedClass(diagnostics, className, record = null) {
  const key = className || "(unknown)";
  diagnostics.unsupportedClasses[key] =
    (diagnostics.unsupportedClasses[key] || 0) + 1;
  diagnostics.unsupportedCount += 1;
  if (record) diagnostics.unsupportedRecords.push(record);
}

function createArchiveTrackingState() {
  return {
    nextPid: 1,
    classByPid: new Map(),
    objectByPid: new Map(),
  };
}

function readArchiveCount(reader) {
  const wordCount = reader.readWord();
  if (wordCount !== 0xffff) {
    return { count: wordCount, byteLength: 2 };
  }
  return { count: reader.readDword(), byteLength: 6 };
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
  textContext = {},
  archiveState = null,
  recordContext = {}
) {
  if (className === "CDataSen") {
    return wrap(parseLinePayload(reader, version));
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
    return wrap(parsePointPayload(reader, version));
  }

  if (className === "CDataMoji") {
    const base = readEntityBase(reader, version);
    const text = {
      base,
      ...parseTextPayload(reader, encoding, textContextForBase(textContext, base)),
    };
    if (isMetadataText(text.content)) return FILTERED_ENTITY;
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
    const dimensionBase = readEntityBase(reader, version);
    const dimensionLine = parseLinePayload(reader, version);
    const textBase = readEntityBase(reader, version);
    const text = {
      base: textBase,
      ...parseTextPayload(
        reader,
        encoding,
        textContextForBase(textContext, textBase)
      ),
    };
    const native = parseSunpouExtra(reader, version);
    if (!text.content) {
      return wrap({
        ...dimensionLine,
        jww_dimension: {
          base: dimensionBase,
          line: dimensionLine,
          text,
          native,
        },
      });
    }
    return wrap({
      ...text,
      dimension_line: dimensionLine,
      jww_dimension: {
        base: dimensionBase,
        line: dimensionLine,
        text,
        native,
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

  if (className === "CDataList") {
    const base = readEntityBase(reader, version);
    const number = reader.readDword();
    const referred = reader.readDword() !== 0;
    const created_at = reader.readDword();
    const name = readCString(reader, encoding, textContext);
    const nested = parseEntityList(
      reader.data,
      reader.pos,
      version,
      encoding,
      diagnostics,
      textContext,
      archiveState,
      {
        section: `block-${recordContext.index ?? 0}`,
        path: `${recordContext.path || recordContext.section || "block"}.entities`,
      }
    );
    reader.pos += nested.bytes_consumed;
    return wrap({
      base,
      number,
      referred,
      created_at,
      name,
      entities: nested.entities,
      entity_records: nested.records,
      entity_list_complete: nested.complete,
    });
  }

  return UNSUPPORTED_ENTITY;
}

function parseEntityWithClassTracking(
  reader,
  version,
  archiveState,
  encoding,
  diagnostics,
  textContext = {},
  recordContext = {}
) {
  const start = reader.pos;
  const wordTag = reader.readWord();
  let classId = wordTag;
  let extendedTag = false;
  if (wordTag === 0x7fff) {
    classId = reader.readDword();
    extendedTag = true;
  }
  let className = "";
  let classPid = null;
  let objectPid = null;
  let kind = "object";

  if (!extendedTag && classId === 0) {
    diagnostics.nullRecordCount += 1;
    return {
      entity: undefined,
      record: {
        ...recordContext,
        kind: "null",
        tag: classId,
        className: "",
        classPid: null,
        objectPid: null,
        sourceSpan: {
          start,
          headerEnd: reader.pos,
          payloadStart: reader.pos,
          end: reader.pos,
          byteLength: reader.pos - start,
        },
      },
      stop: false,
    };
  }

  if (!extendedTag && classId === 0xffff) {
    const schema = reader.readWord();
    className = decodeAsciiClassName(reader.readBytes(reader.readWord()));
    classPid = archiveState.nextPid;
    archiveState.classByPid.set(classPid, { className, schema });
    archiveState.nextPid += 1;
    objectPid = archiveState.nextPid;
    archiveState.nextPid += 1;
    kind = "new-class-object";
  } else {
    const oldClassMask = extendedTag ? 0x80000000 : 0x8000;
    const oldClass = (classId & oldClassMask) !== 0;
    if (!oldClass) {
      const referenced = archiveState.objectByPid.get(classId);
      if (!referenced) {
        const unsupported = {
          ...recordContext,
          reason: "unregistered-object-pid",
          tag: classId,
          extendedTag,
          className: "",
          classPid: null,
          objectPid: classId,
          start,
          headerEnd: reader.pos,
          payloadStart: reader.pos,
          end: null,
        };
        addUnsupportedClass(diagnostics, "", unsupported);
        diagnostics.skippedCount += 1;
        return {
          entity: undefined,
          record: { ...unsupported, kind: "unsupported", sourceSpan: null },
          stop: true,
        };
      }
      diagnostics.objectReferenceCount += 1;
      return {
        entity: referenced.entity,
        record: {
          ...recordContext,
          kind: "object-reference",
          tag: classId,
          extendedTag,
          className: referenced.className,
          classPid: referenced.classPid,
          objectPid: classId,
          sourceSpan: {
            start,
            headerEnd: reader.pos,
            payloadStart: reader.pos,
            end: reader.pos,
            byteLength: reader.pos - start,
          },
        },
        stop: false,
      };
    }

    classPid = classId & ~oldClassMask;
    const registered = archiveState.classByPid.get(classPid);
    className = registered?.className || "";
    if (!className) {
      const unsupported = {
        ...recordContext,
        reason: classPid === 0 ? "invalid-old-class-pid-zero" : "unregistered-class-pid",
        tag: classId,
        extendedTag,
        className: "",
        classPid,
        objectPid: null,
        start,
        headerEnd: reader.pos,
        payloadStart: reader.pos,
        end: null,
      };
      addUnsupportedClass(diagnostics, "", unsupported);
      diagnostics.skippedCount += 1;
      return {
        entity: undefined,
        record: { ...unsupported, kind: "unsupported", sourceSpan: null },
        stop: true,
      };
    }
    objectPid = archiveState.nextPid;
    archiveState.nextPid += 1;
    kind = "old-class-object";
  }

  const payloadStart = reader.pos;
  const parsedEntity = parseEntityByClass(
    className,
    reader,
    version,
    encoding,
    diagnostics,
    textContext,
    archiveState,
    recordContext
  );
  if (parsedEntity === UNSUPPORTED_ENTITY) {
    const unsupported = {
      ...recordContext,
      reason: "unsupported-class-payload-boundary-unknown",
      tag: classId,
      extendedTag,
      className,
      classPid,
      objectPid,
      start,
      headerEnd: payloadStart,
      payloadStart,
      end: null,
    };
    addUnsupportedClass(diagnostics, className, unsupported);
    diagnostics.skippedCount += 1;
    archiveState.objectByPid.set(objectPid, {
      entity: undefined,
      className,
      classPid,
    });
    return {
      entity: undefined,
      record: { ...unsupported, kind: "unsupported", sourceSpan: null },
      stop: true,
    };
  }

  const entity = parsedEntity === FILTERED_ENTITY ? undefined : parsedEntity;
  archiveState.objectByPid.set(objectPid, { entity, className, classPid });
  const sourceSpan = {
    start,
    headerEnd: payloadStart,
    payloadStart,
    end: reader.pos,
    byteLength: reader.pos - start,
  };
  return {
    entity,
    record: {
      ...recordContext,
      kind,
      tag: classId,
      extendedTag,
      className,
      classPid,
      objectPid,
      filtered: parsedEntity === FILTERED_ENTITY,
      sourceSpan,
    },
    stop: false,
  };
}

function parseEntityList(
  data,
  offset,
  version,
  encoding,
  diagnostics,
  textContext = {},
  archiveState = null,
  listContext = {}
) {
  const reader = new BinaryReader(data, offset);
  const startPos = reader.pos;
  const archiveCount = readArchiveCount(reader);
  const count = archiveCount.count;
  const entities = [];
  const records = [];
  const tracking = archiveState || createArchiveTrackingState();
  const section = listContext.section || "drawing";
  const path = listContext.path || section;

  for (let i = 0; i < count && reader.remaining() >= 4; i += 1) {
    const result = parseEntityWithClassTracking(
      reader,
      version,
      tracking,
      encoding,
      diagnostics,
      textContext,
      { section, path, index: i }
    );
    if (result.entity) {
      result.record.entityIndex = entities.length;
      entities.push(result.entity);
    }
    records.push(result.record);
    if (result.stop) break;
  }

  return {
    entities,
    records,
    declared_count: count,
    count_bytes: archiveCount.byteLength,
    complete: records.length === count && !records.some((record) => record?.kind === "unsupported"),
    bytes_consumed: reader.pos - startPos,
    archive_state: tracking,
  };
}

function parseEmbeddedImages(data, offset, version, encoding, textContext = {}) {
  if (version < 700 || !Number.isInteger(offset) || offset + 4 > data.length) {
    return {
      images: [],
      declared_count: 0,
      complete: version < 700,
      issues: [],
      bytes_consumed: 0,
    };
  }
  const reader = new BinaryReader(data, offset);
  const startPos = reader.pos;
  const count = reader.readDword();
  const images = [];
  const issues = [];
  for (let index = 0; index < count && reader.remaining() > 0; index += 1) {
    const recordStart = reader.pos;
    const name = readEmbeddedImageName(reader, encoding, textContext);
    if (!name.ok) {
      const sourceSpan = {
        start: recordStart,
        headerEnd: reader.pos,
        payloadStart: reader.pos,
        end: reader.pos,
        byteLength: reader.pos - recordStart,
      };
      images.push({
        file_name: name.text,
        declared_size: null,
        bytes: new Uint8Array(),
        truncated: true,
        sourceSpan,
      });
      issues.push({
        section: "embedded-images",
        index,
        reason: name.reason,
        declaredByteLength: name.declaredByteLength,
        bytesRead: name.bytesRead,
        sourceSpan,
      });
      break;
    }
    if (reader.remaining() < 4) {
      const sourceSpan = {
        start: recordStart,
        headerEnd: reader.pos,
        payloadStart: reader.pos,
        end: data.length,
        byteLength: data.length - recordStart,
      };
      reader.pos = data.length;
      images.push({
        file_name: name.text,
        declared_size: null,
        bytes: new Uint8Array(),
        truncated: true,
        sourceSpan,
      });
      issues.push({
        section: "embedded-images",
        index,
        reason: "truncated-size-field",
        sourceSpan,
      });
      break;
    }
    const sizeStart = reader.pos;
    const declared_size = reader.readDword();
    const payloadStart = reader.pos;
    const bytes = reader.readBytes(declared_size);
    const sourceSpan = {
      start: recordStart,
      nameEnd: sizeStart,
      headerEnd: payloadStart,
      payloadStart,
      end: reader.pos,
      byteLength: reader.pos - recordStart,
    };
    const truncated = bytes.length !== declared_size;
    images.push({
      file_name: name.text,
      declared_size,
      bytes,
      truncated,
      sourceSpan,
    });
    if (truncated) {
      issues.push({
        section: "embedded-images",
        index,
        reason: "truncated-payload",
        declaredByteLength: declared_size,
        bytesRead: bytes.length,
        sourceSpan,
      });
      break;
    }
  }
  if (images.length !== count && !issues.length) {
    issues.push({
      section: "embedded-images",
      index: images.length,
      reason: "record-count-mismatch",
      declaredCount: count,
      parsedCount: images.length,
      sourceSpan: {
        start: reader.pos,
        headerEnd: reader.pos,
        payloadStart: reader.pos,
        end: reader.pos,
        byteLength: 0,
      },
    });
  }
  return {
    images,
    declared_count: count,
    complete: images.length === count && issues.length === 0,
    issues,
    bytes_consumed: reader.pos - startPos,
  };
}

export function parse(input, options = {}) {
  const encoding = options.encoding || "shift_jis";
  const baseTextContext = {
    sourceName: options.sourceName,
    fileName: options.fileName,
    sourcePath: options.sourcePath,
    filePath: options.filePath,
    lastModified: options.lastModified,
    fileModifiedAt: options.fileModifiedAt,
    now: options.now,
    ...(options.textContext || {}),
  };
  const data = input instanceof Uint8Array ? input : Uint8Array.from(input || []);
  if (data.length < HEADER.length || !hasHeader(data)) return emptyDocument();

  const reader = new BinaryReader(data, HEADER.length);
  const diagnostics = createDiagnostics();
  const version = reader.readDword();
  const memo = readCString(reader, encoding, baseTextContext);
  const paper_size = reader.readDword();
  const write_layer_group = reader.readDword();
  let layer_groups = parseLayerGroups(reader);
  const sunpouSettingsStart = reader.pos;
  const sunpou_settings = parseSunpouSettings(reader);
  const sunpou_settings_source_span = {
    start: sunpouSettingsStart,
    end: reader.pos,
    byteLength: reader.pos - sunpouSettingsStart,
  };
  const printSettingsStart = reader.pos;
  const print_settings = parsePrintSettings(reader);
  const print_settings_source_span = {
    start: printSettingsStart,
    end: reader.pos,
    byteLength: reader.pos - printSettingsStart,
  };
  const gridSettingsStart = reader.pos;
  const grid_settings = parseGridSettings(reader);
  const grid_settings_source_span = {
    start: gridSettingsStart,
    end: reader.pos,
    byteLength: reader.pos - gridSettingsStart,
  };
  const textContext = {
    ...baseTextContext,
    memo,
    layerGroups: layer_groups,
  };
  let entityOffset = findEntityListOffset(data, version);
  const layerNamesOffset = reader.pos;
  if (entityOffset !== undefined && layerNamesOffset >= entityOffset) {
    layer_groups = withDefaultLayerNames(layer_groups);
  } else {
    const parsedLayerGroups = parseLayerNames(
      reader,
      layer_groups,
      encoding,
      textContext
    );
    if (
      parsedLayerGroups.namesExtracted === false ||
      (entityOffset !== undefined && reader.pos > entityOffset)
    ) {
      reader.pos = layerNamesOffset;
      layer_groups = withDefaultLayerNames(layer_groups);
    } else {
      layer_groups = parsedLayerGroups;
    }
  }
  const layer_names_extracted = layer_groups.namesExtracted !== false;
  const layer_name_fallbacks = layer_groups.nameFallbacks || [];
  const afterLayerNamesOffset = reader.pos;
  textContext.layerGroups = layer_groups;
  if (entityOffset === undefined) {
    entityOffset = findEmptyEntityListOffset(
      data,
      afterLayerNamesOffset,
      version,
      encoding,
      textContext
    );
  }

  const color_settings = parseColorSettings(
    data,
    entityOffset,
    afterLayerNamesOffset
  );
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
  const archiveState = createArchiveTrackingState();
  const entityResult =
    entityOffset === undefined
      ? { entities: [], records: [], bytes_consumed: 0, complete: false }
      : parseEntityList(
          data,
          entityOffset,
          version,
          encoding,
          diagnostics,
          textContext,
          archiveState,
          { section: "drawing", path: "drawing" }
        );
  const blockListOffset =
    entityOffset === undefined
      ? undefined
      : entityOffset + entityResult.bytes_consumed;
  const blockResult =
    blockListOffset === undefined || blockListOffset + 2 > data.length
      ? { entities: [], records: [], bytes_consumed: 0, complete: false }
      : parseEntityList(
          data,
          blockListOffset,
          version,
          encoding,
          diagnostics,
          textContext,
          archiveState,
          { section: "block-definitions", path: "blockDefinitions" }
        );
  const embeddedImageOffset =
    blockListOffset === undefined
      ? undefined
      : blockListOffset + blockResult.bytes_consumed;
  const embeddedImageResult = parseEmbeddedImages(
    data,
    embeddedImageOffset,
    version,
    encoding,
    textContext
  );
  diagnostics.embeddedImageCountDeclared = embeddedImageResult.declared_count;
  diagnostics.embeddedImageCountParsed = embeddedImageResult.images.length;
  diagnostics.embeddedImageTruncatedCount = embeddedImageResult.images.filter(
    (image) => image.truncated
  ).length;
  diagnostics.embeddedImageIssues = embeddedImageResult.issues;

  return {
    version,
    memo,
    paper_size,
    write_layer_group,
    layer_groups,
    layer_names_extracted,
    layer_name_fallbacks,
    entities: entityResult.entities,
    entity_records: entityResult.records || [],
    entity_list_complete: entityResult.complete !== false,
    entity_list_offset: entityOffset,
    entity_bytes_consumed: entityResult.bytes_consumed,
    block_defs: blockResult.entities
      .map((item) => item?.value)
      .filter((item) => item && Array.isArray(item.entities)),
    block_records: blockResult.records || [],
    block_list_complete: blockResult.complete !== false,
    block_list_offset: blockListOffset,
    block_bytes_consumed: blockResult.bytes_consumed,
    embedded_images: embeddedImageResult.images,
    embedded_image_list_complete: embeddedImageResult.complete,
    embedded_image_offset: embeddedImageOffset,
    embedded_image_bytes_consumed: embeddedImageResult.bytes_consumed,
    color_settings,
    line_type_settings,
    environment_region,
    print_settings,
    print_settings_source_span,
    grid_settings,
    grid_settings_source_span,
    sunpou_settings,
    sunpou_settings_source_span,
    diagnostics,
  };
}

export function to_json_string(doc) {
  return JSON.stringify({ version: doc?.version || 0 });
}
