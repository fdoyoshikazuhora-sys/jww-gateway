const DECODER_LABELS = ["shift_jis", "windows-31j", "ms932"];

const SHIFT_JIS_COMPATIBILITY_MAP = new Map([
  ["875F", "\u3349"], // square miri
  ["8761", "\u3322"], // square senti
  ["8762", "\u334D"], // square meetoru
  ["8763", "\u3314"], // square kiro
  ["8764", "\u3318"], // square guramu
  ["8765", "\u3327"], // square ton
  ["8766", "\u3303"], // square aaru
  ["8767", "\u3336"], // square hekutaru
  ["8768", "\u3351"], // square rittoru
  ["8769", "\u3357"], // square watto
  ["876A", "\u330D"], // square karorii
  ["876B", "\u3326"], // square doru
  ["876C", "\u3323"], // square sento
  ["876D", "\u332B"], // square paasento
  ["876E", "\u334A"], // square miribaaru
  ["876F", "\u339C"], // square mm
  ["8770", "\u339D"], // square cm
  ["8771", "\u339E"], // square km
  ["8772", "\u338E"], // square mg
  ["8773", "\u338F"], // square kg
  ["8774", "\u33C4"], // square cc
  ["8775", "\u33A1"], // square m squared
]);

const SUPERSCRIPT_MAP = new Map([
  ["0", "\u2070"],
  ["1", "\u00B9"],
  ["2", "\u00B2"],
  ["3", "\u00B3"],
  ["4", "\u2074"],
  ["5", "\u2075"],
  ["6", "\u2076"],
  ["7", "\u2077"],
  ["8", "\u2078"],
  ["9", "\u2079"],
  ["+", "\u207A"],
  ["-", "\u207B"],
]);

const SUBSCRIPT_MAP = new Map([
  ["0", "\u2080"],
  ["1", "\u2081"],
  ["2", "\u2082"],
  ["3", "\u2083"],
  ["4", "\u2084"],
  ["5", "\u2085"],
  ["6", "\u2086"],
  ["7", "\u2087"],
  ["8", "\u2088"],
  ["9", "\u2089"],
  ["+", "\u208A"],
  ["-", "\u208B"],
]);

function bytesToStringFallback(bytes) {
  let text = "";
  for (const byte of bytes) {
    text += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : "\ufffd";
  }
  return text;
}

function normalizeEncodingLabel(encoding) {
  const value = String(encoding || "").trim().toLowerCase();
  if (!value || value === "auto" || value === "jww") return null;
  if (value === "sjis" || value === "shift-jis") return "shift_jis";
  return value;
}

function isShiftJisEncoding(encoding) {
  const label = normalizeEncodingLabel(encoding) || "shift_jis";
  return label === "shift_jis" || label === "windows-31j" || label === "ms932";
}

export function buildJwwDecoderLabels(encoding) {
  const preferred = normalizeEncodingLabel(encoding);
  return [
    ...(preferred ? [preferred] : []),
    ...DECODER_LABELS.filter((label) => label !== preferred),
  ];
}

function decodeWithLabel(bytes, label) {
  if (typeof TextDecoder !== "function") return bytesToStringFallback(bytes);
  return new TextDecoder(label, { fatal: false }).decode(bytes);
}

function decodeShiftJisChunk(bytes) {
  for (const label of DECODER_LABELS) {
    try {
      return decodeWithLabel(bytes, label);
    } catch (_) {
      // Try the next Shift_JIS-compatible runtime label.
    }
  }
  return bytesToStringFallback(bytes);
}

function decodeShiftJisWithJwwMap(bytes, encoding) {
  if (!isShiftJisEncoding(encoding)) return null;

  let text = "";
  let chunk = [];
  const flushChunk = () => {
    if (!chunk.length) return;
    text += decodeShiftJisChunk(Uint8Array.from(chunk));
    chunk = [];
  };

  for (let index = 0; index < bytes.length; index += 1) {
    const current = bytes[index];
    const next = bytes[index + 1];
    if (next !== undefined) {
      const key = `${current.toString(16).padStart(2, "0")}${next
        .toString(16)
        .padStart(2, "0")}`.toUpperCase();
      const mapped = SHIFT_JIS_COMPATIBILITY_MAP.get(key);
      if (mapped) {
        flushChunk();
        text += mapped;
        index += 1;
        continue;
      }
    }
    chunk.push(current);
  }

  flushChunk();
  return text;
}

function decodeUtf16Fallback(bytes, encoding) {
  const label = normalizeEncodingLabel(encoding);
  if (label !== "utf-16le" && label !== "utf-16be") return null;
  let text = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const codeUnit =
      label === "utf-16be"
        ? (bytes[index] << 8) | bytes[index + 1]
        : bytes[index] | (bytes[index + 1] << 8);
    if (codeUnit === 0) continue;
    text += String.fromCharCode(codeUnit);
  }
  return text;
}

function overlayKind(marker) {
  switch (marker) {
    case "c":
      return "middle";
    case "o":
    case "O":
      return "centerOverlay";
    case "w":
      return "halfOverlay";
    case "b":
      return "overlay";
    case "B":
      return "strongOverlay";
    case "n":
      return "narrowOverlay";
    default:
      return "";
  }
}

const DXF_SPECIAL_TEXT_MAP = new Map([
  ["c", "\u03C6"],
  ["C", "\u03C6"],
  ["d", "\u00B0"],
  ["D", "\u00B0"],
  ["p", "\u00B1"],
  ["P", "\u00B1"],
]);

function normalizeDxfControlText(text) {
  return String(text || "").replace(/%%(.)/g, (match, marker) => {
    if (marker === "%") return "%";
    return DXF_SPECIAL_TEXT_MAP.get(marker) || match;
  });
}

function normalizeJwwControlText(text) {
  let output = "";
  const specialRuns = [];
  let controlsEnabled = true;
  const styleControls = new Set([
    "!",
    "/",
    "_",
    "-",
    "\u0023",
    "\\",
    "\u00A5",
    "\uFFE5",
    "&",
    "%",
  ]);
  const overlayControls = new Set(["c", "o", "O", "b", "B", "n", "w"]);

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const marker = text[index + 1];
    if (char !== "^" || !marker) {
      output += char;
      continue;
    }

    if (marker === "*") {
      controlsEnabled = false;
      index += 1;
      continue;
    }
    if (marker === "^") {
      controlsEnabled = true;
      index += 1;
      continue;
    }
    if (!controlsEnabled) {
      output += char;
      continue;
    }

    if (marker === "u" || marker === "d") {
      const target = text[index + 2];
      if (target) {
        const map = marker === "u" ? SUPERSCRIPT_MAP : SUBSCRIPT_MAP;
        const replacement = map.get(target) || target;
        specialRuns.push({
          kind: marker === "u" ? "superscript" : "subscript",
          marker: `^${marker}`,
          sourceText: target,
          text: replacement,
          start: output.length,
          end: output.length + replacement.length,
        });
        output += replacement;
        index += 2;
        continue;
      }
    }

    if (marker === "$" && /^[1-9]$/.test(text[index + 2] || "")) {
      index += 2;
      continue;
    }
    if (overlayControls.has(marker)) {
      const width = marker === "w" ? 2 : 1;
      const overlayText = text.slice(index + 2, index + 2 + width);
      specialRuns.push({
        kind: overlayKind(marker),
        marker: `^${marker}`,
        baseText: output.slice(-1),
        overlayText,
        start: Math.max(0, output.length - 1),
        end: output.length + overlayText.length,
      });
      index += 1;
      continue;
    }
    if (styleControls.has(marker) || /^[1-9]$/.test(marker)) {
      index += 1;
      continue;
    }

    output += char;
  }

  return {
    text: output,
    specialRuns,
  };
}

export function buildJwwTextSegments(text, specialRuns = []) {
  const normalizedText = String(text || "");
  const runs = (specialRuns || [])
    .filter((run) => Number.isFinite(run?.start) && Number.isFinite(run?.end))
    .map((run) => ({
      ...run,
      start: Math.max(0, Math.min(normalizedText.length, Number(run.start))),
      end: Math.max(0, Math.min(normalizedText.length, Number(run.end))),
    }))
    .filter((run) => run.end > run.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const segments = [];
  let cursor = 0;

  for (const run of runs) {
    if (run.start > cursor) {
      segments.push({
        kind: "text",
        text: normalizedText.slice(cursor, run.start),
        start: cursor,
        end: run.start,
      });
    }
    segments.push({
      kind: run.kind || "special",
      marker: run.marker || "",
      text: normalizedText.slice(run.start, run.end),
      baseText: run.baseText || "",
      overlayText: run.overlayText || run.sourceText || "",
      start: run.start,
      end: run.end,
      overlapsPrevious: run.start < cursor,
    });
    cursor = Math.max(cursor, run.end);
  }

  if (cursor < normalizedText.length) {
    segments.push({
      kind: "text",
      text: normalizedText.slice(cursor),
      start: cursor,
      end: normalizedText.length,
    });
  }

  return segments;
}

function pathParts(value) {
  return String(value || "")
    .split(/[\\/]+/)
    .filter(Boolean);
}

function sourceFileName(context = {}) {
  const explicit = context.sourceName || context.fileName;
  if (explicit) return String(explicit);
  const parts = pathParts(context.sourcePath || context.filePath);
  return parts.length ? parts[parts.length - 1] : "";
}

function sourceFullPath(context = {}) {
  return String(context.sourcePath || context.filePath || sourceFileName(context));
}

function sourceNameWithoutExtension(context = {}) {
  const name = sourceFileName(context);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function sourceParentFolder(context = {}, depth = 1) {
  const parts = pathParts(context.sourcePath || context.filePath);
  if (parts.length <= 1) return "";
  const folderParts = parts.slice(0, -1);
  return folderParts[folderParts.length - depth] || "";
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function dateFromContext(value, fallback = new Date()) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }
  return fallback;
}

function dateContext(context = {}, kind) {
  if (kind === "=" || kind === "_") {
    return dateFromContext(context.fileModifiedAt || context.lastModified);
  }
  return dateFromContext(context.now);
}

function eraInfo(date) {
  const year = date.getFullYear();
  if (year >= 2019) return { name: "\u4EE4\u548C", year: year - 2018 };
  if (year >= 1989) return { name: "\u5E73\u6210", year: year - 1988 };
  if (year >= 1926) return { name: "\u662D\u548C", year: year - 1925 };
  if (year >= 1912) return { name: "\u5927\u6B63", year: year - 1911 };
  if (year >= 1868) return { name: "\u660E\u6CBB", year: year - 1867 };
  return { name: String(year), year };
}

function eraYearText(date) {
  const era = eraInfo(date);
  return era.year === 1 ? "\u5143" : String(era.year);
}

function padJwwNumber(value, prefix) {
  const text = String(value);
  if (text.length !== 1 || !/^\d$/.test(text)) return text;
  if (prefix === "_" || prefix === "&") return ` ${text}`;
  if (prefix === "=" || prefix === "%") return `0${text}`;
  if (prefix === "$") return `${text} `;
  return text;
}

function formatDateToken(date, token, prefix = "") {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const hour12 = hour % 12 || 12;
  const minute = date.getMinutes();
  const second = date.getSeconds();

  switch (token) {
    case "F":
      return `${year}/${pad2(month)}/${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
    case "f":
      return `${year}/${pad2(month)}/${pad2(day)}`;
    case "y":
      return pad2(year % 100);
    case "Y":
    case "E":
      return padJwwNumber(eraYearText(date), prefix);
    case "m":
      return padJwwNumber(month, prefix);
    case "d":
      return padJwwNumber(day, prefix);
    case "h":
      return padJwwNumber(hour12, prefix);
    case "H":
      return padJwwNumber(hour, prefix);
    case "M":
      return padJwwNumber(minute, prefix);
    case "S":
      return padJwwNumber(second, prefix);
    case "n":
      return hour < 12 ? "AM" : "PM";
    case "N":
      return hour < 12 ? "\u524D" : "\u5F8C";
    case "J":
      return `${eraInfo(date).name}${eraYearText(date)}\u5E74${month}\u6708${day}\u65E5`;
    case "w":
      return padJwwNumber(date.getDay(), prefix);
    default:
      return "";
  }
}

function replaceEraLongTokens(value, prefix, date) {
  const era = eraInfo(date);
  const yearText = padJwwNumber(eraYearText(date), prefix);
  return value
    .replace(new RegExp(`\\${prefix}G\uFF27\uFF25\uFF25`, "g"), (match, offset) =>
      value[offset - 1] === "^" ? match : `${era.name}${yearText}\u5E74`
    )
    .replace(new RegExp(`\\${prefix}G\uFF27\uFF25`, "g"), (match, offset) =>
      value[offset - 1] === "^" ? match : `${era.name}${yearText}`
    )
    .replace(new RegExp(`\\${prefix}G\uFF27`, "g"), (match, offset) =>
      value[offset - 1] === "^" ? match : era.name
    );
}

function replaceQuotedListToken(value, prefix, marker, index, fallback) {
  const pattern = new RegExp(`\\${prefix}${marker}((?:"[^"]*")+|"(?:[^"]*)"(?:\\s*"[^"]*")*)`, "g");
  return value.replace(pattern, (match, list, offset) => {
    if (value[offset - 1] === "^") return match;
    const items = Array.from(String(list).matchAll(/"([^"]*)"/g)).map(
      (match) => match[1]
    );
    return items[index] || fallback;
  });
}

function replaceEmbeddedToken(value, pattern, replacement) {
  return value.replace(pattern, (match, ...args) => {
    const offset = args[args.length - 2];
    if (value[offset - 1] === "^") return match;
    return typeof replacement === "function"
      ? replacement(match, ...args)
      : replacement;
  });
}

function collectJwwEqualSpacingControls(text) {
  const controls = [];
  String(text || "").replace(/&J([1-9])/g, (match, count, offset) => {
    if (String(text || "")[offset - 1] === "^") return match;
    controls.push({
      kind: "equalSpacing",
      marker: "&J",
      count: Number(count),
      sourceText: match,
      start: offset,
      end: offset + match.length,
    });
    return match;
  });
  return controls;
}

export function resolveJwwEmbeddedText(text, context = {}) {
  let value = String(text || "");
  const fileName = sourceFileName(context);
  const nameWithoutExtension = sourceNameWithoutExtension(context);
  const memoLines = String(context.memo || "").split(/\r?\n/);
  const scaleLabel = context.scaleLabel || "-";
  const scaleDenominator = Number(context.scaleDenominator || 0);

  value = value
    .replace(/[&]F([1-9])/g, (match, depth, offset) =>
      value[offset - 1] === "^" ? match : sourceParentFolder(context, Number(depth))
    )
    .replace(/&fs([1-9])/g, (match, index, offset) => {
      if (value[offset - 1] === "^") return match;
      const tokens = nameWithoutExtension.split(/\s+/).filter(Boolean);
      return tokens[Number(index) - 1] || "";
    })
    .replace(/&F/g, (match, offset) =>
      value[offset - 1] === "^" ? match : sourceFullPath(context)
    )
    .replace(/&f/g, (match, offset) =>
      value[offset - 1] === "^" ? match : nameWithoutExtension
    )
    .replace(/%f([1-9][0-9]*)/g, (match, length, offset) =>
      value[offset - 1] === "^" ? match : fileName.slice(0, Number(length))
    )
    .replace(/%f/g, (match, offset) =>
      value[offset - 1] === "^" ? match : fileName
    )
    .replace(/\$F/g, (match, offset) =>
      value[offset - 1] === "^" ? match : sourceFullPath(context)
    )
    .replace(/\$f/g, (match, offset) =>
      value[offset - 1] === "^" ? match : nameWithoutExtension
    )
    .replace(/%mm/g, (match, offset) =>
      value[offset - 1] === "^" ? match : String(context.memo || "")
    )
    .replace(/%m1/g, (match, offset) =>
      value[offset - 1] === "^" ? match : memoLines[0] || ""
    )
    .replace(/%m2/g, (match, offset) =>
      value[offset - 1] === "^" ? match : memoLines[1] || ""
    )
    .replace(/%SS/g, (match, offset) =>
      value[offset - 1] === "^" ? match : scaleLabel
    )
    .replace(/%ss/g, (match, offset) =>
      value[offset - 1] === "^"
        ? match
        : scaleDenominator > 0
          ? String(Math.round(scaleDenominator))
          : ""
    )
    .replace(/%SP|%sp/g, (match, offset) =>
      value[offset - 1] === "^" ? match : scaleLabel
    )
    .replace(/%T/g, (match, offset) =>
      value[offset - 1] === "^" ? match : String(context.drawingTime || "")
    );

  for (const prefix of ["=", "_", "&", "%", "$"]) {
    const date = dateContext(context, prefix);
    value = replaceEraLongTokens(value, prefix, date);
    value = replaceQuotedListToken(
      value,
      prefix,
      "ma",
      date.getMonth(),
      String(date.getMonth() + 1)
    );
    value = replaceQuotedListToken(
      value,
      prefix,
      "wa",
      date.getDay(),
      String(date.getDay())
    );
    if (prefix === "&") {
      value = replaceEmbeddedToken(value, /&J[1-9]/g, "");
    }
    value = replaceEmbeddedToken(
      value,
      new RegExp(`\\${prefix}([FfyYEmdhHMSnNJw])`, "g"),
      (_, token) => formatDateToken(date, token, prefix)
    );
    value = replaceEmbeddedToken(
      value,
      new RegExp(`\\${prefix}J[1-9]`, "g"),
      () => formatDateToken(date, "J", prefix)
    );
  }

  return value;
}

export function normalizeJwwSpecialText(text, context = {}) {
  let value = normalizeDxfControlText(text);
  value = resolveJwwEmbeddedText(value, context);
  return normalizeJwwControlText(value).text;
}

export function analyzeJwwSpecialText(text, context = {}) {
  const rawText = String(text || "");
  const resolvedText = resolveJwwEmbeddedText(
    normalizeDxfControlText(rawText),
    context
  );
  const normalized = normalizeJwwControlText(resolvedText);
  return {
    rawText,
    resolvedText,
    text: normalized.text,
    specialRuns: normalized.specialRuns,
    equalSpacingControls: collectJwwEqualSpacingControls(rawText),
    textSegments: buildJwwTextSegments(
      normalized.text,
      normalized.specialRuns
    ),
  };
}

export function decodeJwwString(bytes, encoding = "shift_jis", context = {}) {
  return decodeJwwStringWithMetadata(bytes, encoding, context).text;
}

export function decodeJwwRawString(bytes, encoding = "shift_jis") {
  const data = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
  const jwwMapped = decodeShiftJisWithJwwMap(data, encoding);
  if (jwwMapped !== null) return jwwMapped;
  const utf16Fallback = decodeUtf16Fallback(data, encoding);
  if (utf16Fallback !== null) {
    return utf16Fallback;
  }
  if (typeof TextDecoder === "function") {
    for (const label of buildJwwDecoderLabels(encoding)) {
      try {
        return decodeWithLabel(data, label);
      } catch (_) {
        // Try the next label. Browser support differs by runtime.
      }
    }
  }
  return bytesToStringFallback(data);
}

export function decodeJwwStringWithMetadata(
  bytes,
  encoding = "shift_jis",
  context = {}
) {
  return analyzeJwwSpecialText(decodeJwwRawString(bytes, encoding), context);
}

export function decodeAsciiClassName(bytes) {
  let text = "";
  for (const byte of bytes || []) {
    if (byte === 0) continue;
    text += String.fromCharCode(byte);
  }
  return text;
}
