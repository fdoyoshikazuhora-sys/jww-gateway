import { parse } from "./parser.js";
import {
  buildJwwRecordPayload,
  buildJwwWriteResult,
  patchJwwTemplatePrefixMetadata,
  parseJwwImageReferenceText,
  preflightJwwWrite,
  setJwwImageReferenceRotation,
} from "./writer.js";

export const JWW_NATIVE_DOCUMENT_KIND = "jww-native";
export const JWW_NATIVE_CONTRACT_VERSION = 1;
export const JWW_NATIVE_HEADER_ID = "jww:header";

export function jwwNativeLayerGroupId(index) {
  return `jww:layer-group:${Number(index)}`;
}

function toBytes(input) {
  return input instanceof Uint8Array
    ? Uint8Array.from(input)
    : Uint8Array.from(input || []);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function sha256HexSync(bytes) {
  // CRA's jsdom test runtime does not expose SubtleCrypto. Keep the public API
  // browser-only by using the same SHA-256 algorithm locally instead of pulling
  // Node's crypto module into the Gateway package. Saved documents also need a
  // synchronous digest because saveNativeJww() is intentionally synchronous.
  const initialHash = [
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ];
  const roundConstants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotateRight = (value, amount) =>
    (value >>> amount) | (value << (32 - amount));
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  view.setUint32(paddedLength - 8, high, false);
  view.setUint32(paddedLength - 4, low, false);
  const hash = initialHash.slice();
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(words[index - 15], 7) ^
        rotateRight(words[index - 15], 18) ^
        (words[index - 15] >>> 3);
      const s1 =
        rotateRight(words[index - 2], 17) ^
        rotateRight(words[index - 2], 19) ^
        (words[index - 2] >>> 10);
      words[index] =
        (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + choice + roundConstants[index] + words[index]) >>> 0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map((value) => value.toString(16).padStart(8, "0")).join("");
}

async function sha256Hex(bytes) {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return bytesToHex(new Uint8Array(digest));
  }
  return sha256HexSync(bytes);
}

function cloneValue(value) {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneValue(item)])
  );
}

function unwrap(record) {
  return record?.value && typeof record.value === "object" ? record.value : record;
}

export function getJwwNativeRecordKind(record) {
  const value = unwrap(record);
  if (!value || typeof value !== "object") return "UNKNOWN";
  if (value.jww_dimension) return "DIMENSION";
  if ("def_number" in value && "ref_x" in value) return "INSERT";
  if ("content" in value) {
    return /^\^@BM/i.test(String(value.raw_content || value.content || ""))
      ? "IMAGE"
      : "TEXT";
  }
  if ("center_x" in value) return value.is_full_circle ? "CIRCLE" : "ARC";
  if ("point1_x" in value) return "SOLID";
  if ("start_x" in value && "end_x" in value) return "LINE";
  if ("x" in value && "y" in value) return "POINT";
  return "UNKNOWN";
}

function nativeRecord(section, index, source, sourceRecord = null) {
  const value = unwrap(source);
  const kind = getJwwNativeRecordKind(value);
  const sourceIndex = Number.isInteger(sourceRecord?.index)
    ? sourceRecord.index
    : index;
  return {
    id: `jww:${section}:${sourceIndex}`,
    section,
    index,
    sourceIndex,
    kind,
    archiveKind: sourceRecord?.kind || null,
    className: sourceRecord?.className || null,
    sourceSpan: sourceRecord?.sourceSpan
      ? { ...sourceRecord.sourceSpan }
      : null,
    value,
  };
}

function recordsByEntityIndex(records = []) {
  return new Map(
    records
      .filter((record) => Number.isInteger(record?.entityIndex))
      .map((record) => [record.entityIndex, record])
  );
}

function blockDefinition(source, index, sourceRecord = null) {
  const definition = unwrap(source) || {};
  const sourceIndex = Number.isInteger(sourceRecord?.index)
    ? sourceRecord.index
    : index;
  const entityRecords = Array.isArray(definition.entity_records)
    ? definition.entity_records
    : [];
  const recordByEntityIndex = recordsByEntityIndex(entityRecords);
  return {
    id: `jww:block-definition:${sourceIndex}`,
    index,
    sourceIndex,
    className: sourceRecord?.className || "CDataList",
    sourceSpan: sourceRecord?.sourceSpan
      ? { ...sourceRecord.sourceSpan }
      : null,
    value: {
      ...definition,
      entities: (definition.entities || []).map((item, entityIndex) =>
        nativeRecord(
          `block-${sourceIndex}`,
          entityIndex,
          item,
          recordByEntityIndex.get(entityIndex)
        )
      ),
    },
  };
}

function section(start, byteLength, totalLength) {
  if (!Number.isInteger(start) || start < 0) return null;
  const length = Math.max(0, Number(byteLength) || 0);
  return { start, end: Math.min(totalLength, start + length), byteLength: length };
}

function buildPreservedRegions(parsed, bytes) {
  const entity = section(parsed.entity_list_offset, parsed.entity_bytes_consumed, bytes.length);
  const blocks = section(parsed.block_list_offset, parsed.block_bytes_consumed, bytes.length);
  const images = section(
    parsed.embedded_image_offset,
    parsed.embedded_image_bytes_consumed,
    bytes.length
  );
  const parsedEnd = images?.end ?? blocks?.end ?? entity?.end ?? 0;
  return {
    prefix: {
      start: 0,
      end: Number(parsed.entity_list_offset) || 0,
      byteLength: Number(parsed.entity_list_offset) || 0,
    },
    entityList: entity,
    blockList: blocks,
    embeddedImages: images,
    trailing: {
      start: parsedEnd,
      end: bytes.length,
      byteLength: Math.max(0, bytes.length - parsedEnd),
    },
  };
}

const RETAINED_PARSE_OPTION_KEYS = [
  "encoding",
  "sourceName",
  "fileName",
  "sourcePath",
  "filePath",
  "lastModified",
  "fileModifiedAt",
  "now",
];

function retainNativeParseOptions(options = {}) {
  const retained = {};
  for (const key of RETAINED_PARSE_OPTION_KEYS) {
    if (options[key] !== undefined) retained[key] = options[key];
  }
  if (options.textContext && typeof options.textContext === "object") {
    retained.textContext = { ...options.textContext };
  }
  return retained;
}

function buildNativeDocument(
  originalBytes,
  originalSha256,
  parsed,
  parseOptions = {},
  { revision = 0, dirty = false } = {}
) {
  const preservedRegions = buildPreservedRegions(parsed, originalBytes);
  const parserDiagnostics = parsed.diagnostics || {};
  const trailingByteLength = preservedRegions.trailing.byteLength;
  const drawingRecords = Array.isArray(parsed.entity_records)
    ? parsed.entity_records
    : [];
  const drawingRecordByEntityIndex = recordsByEntityIndex(drawingRecords);
  const nativeEntities = (parsed.entities || []).map((item, index) =>
    nativeRecord(
      "drawing",
      index,
      item,
      drawingRecordByEntityIndex.get(index)
    )
  );
  const blockRecords = Array.isArray(parsed.block_records) ? parsed.block_records : [];
  const blockRecordByEntityIndex = recordsByEntityIndex(blockRecords);
  const blockDefinitions = (parsed.block_defs || []).map((definition, index) =>
    blockDefinition(definition, index, blockRecordByEntityIndex.get(index))
  );
  const embeddedImages = (parsed.embedded_images || []).map((image, index) => ({
    id: `jww:embedded-image:${index}`,
    index,
    sourceIndex: index,
    fileName: image.file_name || `image-${index}.bmp`,
    declaredSize: Number(image.declared_size ?? image.bytes?.length ?? 0),
    bytes: toBytes(image.bytes),
    truncated: Boolean(image.truncated),
    sourceSpan: image.sourceSpan ? { ...image.sourceSpan } : null,
  }));
  const allNativeRecords = [
    ...nativeEntities,
    ...blockDefinitions,
    ...blockDefinitions.flatMap((definition) => definition.value.entities || []),
    ...embeddedImages,
  ];
  const recordSourceSpansAvailable = allNativeRecords.every(
    (record) =>
      Number.isInteger(record.sourceSpan?.start) &&
      Number.isInteger(record.sourceSpan?.end)
  );
  const unsupportedRegions = (parserDiagnostics.unsupportedRecords || [])
    .filter((record) => Number.isInteger(record?.start))
    .map((record) => ({
      start: record.start,
      end: originalBytes.length,
      byteLength: originalBytes.length - record.start,
      reason: record.reason || "unsupported-record-boundary-unknown",
      section: record.section,
      index: record.index,
      className: record.className || "",
      classPid: record.classPid,
      tag: record.tag,
    }));
  const embeddedImageRegions = (parserDiagnostics.embeddedImageIssues || [])
    .filter((issue) => Number.isInteger(issue?.sourceSpan?.start))
    .map((issue) => ({
      ...issue.sourceSpan,
      reason: issue.reason || "embedded-image-boundary-invalid",
      section: issue.section || "embedded-images",
      index: issue.index,
      declaredByteLength: issue.declaredByteLength,
      bytesRead: issue.bytesRead,
    }));
  const diagnostics = {
    ...parserDiagnostics,
    clean:
      Number(parserDiagnostics.unsupportedCount || 0) === 0 &&
      Number(parserDiagnostics.skippedCount || 0) === 0 &&
      Number(parserDiagnostics.embeddedImageTruncatedCount || 0) === 0 &&
      (parserDiagnostics.embeddedImageIssues || []).length === 0 &&
      trailingByteLength === 0,
    originalByteLength: originalBytes.length,
    trailingByteLength,
    recordSourceSpansAvailable,
    preservedUnknownRegions: [
      ...unsupportedRegions,
      ...embeddedImageRegions,
      ...(trailingByteLength
        ? [{ ...preservedRegions.trailing, reason: "trailing-unparsed-bytes" }]
        : []),
    ],
  };

  return {
    kind: JWW_NATIVE_DOCUMENT_KIND,
    contractVersion: JWW_NATIVE_CONTRACT_VERSION,
    version: Number(parsed.version || 0),
    originalBytes,
    originalSha256,
    header: {
      id: JWW_NATIVE_HEADER_ID,
      magic: "JwwData.",
      version: Number(parsed.version || 0),
      memo: parsed.memo || "",
      paperSize: Number(parsed.paper_size),
      writeLayerGroup: Number(parsed.write_layer_group),
    },
    layerGroups: (parsed.layer_groups || []).map((group, index) => ({
      ...group,
      id: jwwNativeLayerGroupId(index),
      index,
    })),
    nativeEntities,
    blockDefinitions,
    embeddedImages,
    settings: {
      color: parsed.color_settings || { screenColors: {} },
      lineType: parsed.line_type_settings || null,
      print: parsed.print_settings || null,
      dimension: parsed.sunpou_settings || null,
      environmentRegion: parsed.environment_region || null,
      layerNamesExtracted: parsed.layer_names_extracted !== false,
      layerNameFallbacks: parsed.layer_name_fallbacks || [],
    },
    preservedRegions,
    diagnostics,
    parseOptions: retainNativeParseOptions(parseOptions),
    revision,
    dirty,
  };
}

export async function openNativeJww(input, options = {}) {
  const originalBytes = toBytes(input);
  const originalSha256 = await sha256Hex(originalBytes);
  const parseOptions = retainNativeParseOptions(options);
  const parsed = parse(originalBytes, parseOptions);
  return buildNativeDocument(
    originalBytes,
    originalSha256,
    parsed,
    parseOptions
  );
}

function cloneNativeDocument(document) {
  return {
    ...document,
    header: { ...document.header },
    layerGroups: document.layerGroups.map((group) => ({ ...group })),
    nativeEntities: document.nativeEntities.slice(),
    blockDefinitions: document.blockDefinitions.slice(),
    embeddedImages: document.embeddedImages.slice(),
  };
}

function nestedBlockRecordLocation(document, targetId) {
  for (
    let definitionIndex = 0;
    definitionIndex < (document.blockDefinitions || []).length;
    definitionIndex += 1
  ) {
    const records = document.blockDefinitions[definitionIndex]?.value?.entities || [];
    const entityIndex = records.findIndex((record) => record.id === targetId);
    if (entityIndex >= 0) {
      return { definitionIndex, entityIndex, record: records[entityIndex] };
    }
  }
  return null;
}

function nativeRecordById(document, targetId) {
  return (
    (document.nativeEntities || []).find((record) => record.id === targetId) ||
    nestedBlockRecordLocation(document, targetId)?.record ||
    null
  );
}

function nativeTargetIdExists(document, targetId) {
  return Boolean(
    targetId === document.header?.id ||
      (document.layerGroups || []).some((item) => item.id === targetId) ||
      nativeRecordById(document, targetId) ||
      (document.blockDefinitions || []).some((item) => item.id === targetId) ||
      (document.embeddedImages || []).some((item) => item.id === targetId)
  );
}

function nativePatchError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

const JWW_NATIVE_PAPER_CODES = new Set([
  0, 1, 2, 3, 4, 8, 9, 10, 11, 12, 13, 14,
]);

function sameNativeMetadataValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function rejectChangedMetadataFields(previous, value, allowedKeys, targetId) {
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(value || {})]);
  for (const key of keys) {
    if (allowedKeys.has(key)) continue;
    if (!sameNativeMetadataValue(previous?.[key], value?.[key])) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_STRUCTURE_CHANGE_UNSUPPORTED",
        `JWW native metadata field cannot be changed by this patch: ${targetId}.${key}`
      );
    }
  }
}

function replaceNativeHeader(next, patch) {
  const previous = next.header;
  const value = cloneValue(unwrap(patch.record));
  if (!value || typeof value !== "object") {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      "JWW native header replacement requires a metadata object"
    );
  }
  rejectChangedMetadataFields(
    previous,
    value,
    new Set(["paperSize", "writeLayerGroup"]),
    previous.id
  );
  const paperSize = Number(value.paperSize);
  const writeLayerGroup = Number(value.writeLayerGroup);
  if (!JWW_NATIVE_PAPER_CODES.has(paperSize)) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `Unsupported JWW paper size code: ${value.paperSize}`
    );
  }
  if (!Number.isInteger(writeLayerGroup) || writeLayerGroup < 0 || writeLayerGroup > 15) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `Unsupported JWW write layer group: ${value.writeLayerGroup}`
    );
  }
  const previousWriteLayerGroup = Number(previous.writeLayerGroup);
  if (writeLayerGroup !== previousWriteLayerGroup) {
    const previousGroup = next.layerGroups[previousWriteLayerGroup];
    const selectedGroup = next.layerGroups[writeLayerGroup];
    if (!previousGroup || !selectedGroup) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `JWW write layer group metadata is unavailable: ${previousWriteLayerGroup} -> ${writeLayerGroup}`
      );
    }
    if (Number(previousGroup.state) !== 3) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `Existing JWW write layer group must have state 3: ${previousWriteLayerGroup}`
      );
    }
    if (![0, 1, 2, 3].includes(Number(selectedGroup.state))) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `JWW write layer group transition from state ${selectedGroup.state} is not verified: ${writeLayerGroup}`
      );
    }
    if (Number(selectedGroup.protect || 0) !== 0) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `Protected JWW layer group cannot become the write group: ${writeLayerGroup}`
      );
    }
    next.layerGroups[previousWriteLayerGroup] = {
      ...previousGroup,
      state: 2,
    };
    next.layerGroups[writeLayerGroup] = {
      ...selectedGroup,
      state: 3,
    };
  }
  next.header = { ...previous, paperSize, writeLayerGroup };
}

function replaceNativeLayerGroup(next, index, patch) {
  const previous = next.layerGroups[index];
  const value = cloneValue(unwrap(patch.record));
  if (!value || typeof value !== "object") {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `JWW native layer group replacement requires a metadata object: ${patch.targetId}`
    );
  }
  rejectChangedMetadataFields(
    previous,
    value,
    new Set(["state", "protect", "scale", "write_layer", "layers"]),
    previous.id
  );
  const protect = Number(value.protect);
  if (!Number.isInteger(protect) || protect < 0 || protect > 2) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `Unsupported JWW layer group protection: ${value.protect}`
    );
  }
  if (
    protect !== Number(previous.protect) &&
    index === Number(next.header?.writeLayerGroup) &&
    protect !== 0
  ) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `Current JWW layer group cannot be protected: ${index}`
    );
  }
  const state = Number(value.state);
  if (state !== Number(previous.state)) {
    const writeLayerGroup = Number(next.header?.writeLayerGroup);
    const allowed = index === writeLayerGroup ? [3] : [0, 1, 2];
    if (!Number.isInteger(state) || !allowed.includes(state)) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        index === writeLayerGroup
          ? `Current JWW layer group must retain state 3: ${index}`
          : `Non-current JWW layer group state must be 0, 1, or 2: ${index}.${value.state}`
      );
    }
    if (protect === 2) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `Display-fixed JWW layer group state cannot be changed: ${index}`
      );
    }
  }
  const scale = Number(value.scale);
  if (!Number.isFinite(scale) || scale <= 0) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `Unsupported JWW layer group scale: ${value.scale}`
    );
  }
  const writeLayer = Number(value.write_layer);
  if (!Number.isInteger(writeLayer) || writeLayer < 0 || writeLayer > 15) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `Unsupported JWW layer group write layer: ${value.write_layer}`
    );
  }
  if (!Array.isArray(value.layers) || value.layers.length !== previous.layers.length) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `JWW layer metadata count cannot change: ${previous.id}`
    );
  }
  const expectedLayers = cloneValue(previous.layers);
  if (writeLayer !== Number(previous.write_layer)) {
    const previousWriteLayer = Number(previous.write_layer);
    if (
      !Number.isInteger(previousWriteLayer) ||
      previousWriteLayer < 0 ||
      previousWriteLayer > 15 ||
      !expectedLayers[previousWriteLayer]
    ) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `Existing JWW write layer metadata is unavailable: ${previous.id}.${previous.write_layer}`
      );
    }
    if (Number(expectedLayers[previousWriteLayer].state) !== 3) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `Existing JWW write layer must have state 3: ${previous.id}.${previousWriteLayer}`
      );
    }
    if (![0, 1, 2, 3].includes(Number(expectedLayers[writeLayer]?.state))) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `JWW write layer transition from state ${expectedLayers[writeLayer]?.state} is not verified: ${previous.id}.${writeLayer}`
      );
    }
    if (
      Number(previous.protect || 0) !== 0 ||
      Number(previous.layers[writeLayer]?.protect || 0) !== 0
    ) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `Protected JWW layer group or layer cannot become the write layer: ${previous.id}.${writeLayer}`
      );
    }
    expectedLayers[previousWriteLayer] = {
      ...expectedLayers[previousWriteLayer],
      state: 2,
    };
    expectedLayers[writeLayer] = {
      ...expectedLayers[writeLayer],
      state: 3,
    };
  }
  for (let layerIndex = 0; layerIndex < expectedLayers.length; layerIndex += 1) {
    const expectedLayer = expectedLayers[layerIndex];
    const revisedLayer = value.layers[layerIndex];
    rejectChangedMetadataFields(
      expectedLayer,
      revisedLayer,
      new Set(["state", "protect"]),
      `${previous.id}.layers.${layerIndex}`
    );
    const revisedProtect = Number(revisedLayer.protect);
    if (
      !Number.isInteger(revisedProtect) ||
      revisedProtect < 0 ||
      revisedProtect > 2
    ) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `Unsupported JWW layer protection: ${index}.${layerIndex}.${revisedLayer.protect}`
      );
    }
    if (
      revisedProtect !== Number(expectedLayer.protect) &&
      layerIndex === writeLayer &&
      revisedProtect !== 0
    ) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_PATCH_INVALID",
        `Current JWW layer cannot be protected: ${index}.${layerIndex}`
      );
    }
    const revisedState = Number(revisedLayer.state);
    if (revisedState !== Number(expectedLayer.state)) {
      const allowed = layerIndex === writeLayer ? [3] : [0, 1, 2];
      if (!Number.isInteger(revisedState) || !allowed.includes(revisedState)) {
        throw nativePatchError(
          "JWW_NATIVE_METADATA_PATCH_INVALID",
          layerIndex === writeLayer
            ? `Current JWW layer must retain state 3: ${index}.${layerIndex}`
            : `Non-current JWW layer state must be 0, 1, or 2: ${index}.${layerIndex}.${revisedLayer.state}`
        );
      }
      if (revisedProtect === 2) {
        throw nativePatchError(
          "JWW_NATIVE_METADATA_PATCH_INVALID",
          `Display-fixed JWW layer state cannot be changed: ${index}.${layerIndex}`
        );
      }
    }
    expectedLayers[layerIndex] = {
      ...expectedLayer,
      state: revisedState,
      protect: revisedProtect,
    };
  }
  next.layerGroups[index] = {
    ...previous,
    state,
    protect,
    scale,
    write_layer: writeLayer,
    layers: expectedLayers,
  };
}

function replaceBlockDefinition(next, index, patch) {
  const previous = next.blockDefinitions[index];
  const value = cloneValue(unwrap(patch.record));
  if (!value || !Array.isArray(value.entities)) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `JWW block definition replacement requires its native entity list: ${patch.targetId}`
    );
  }
  const number = Number(value.number);
  if (!Number.isSafeInteger(number) || number < 0 || number > 0xffffffff) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `JWW block definition number must be an unsigned 32-bit integer: ${patch.targetId}`
    );
  }
  const previousEntities = previous.value?.entities || [];
  if (
    value.entities.length !== previousEntities.length ||
    value.entities.some((record, entityIndex) => record?.id !== previousEntities[entityIndex]?.id)
  ) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_STRUCTURE_CHANGE_UNSUPPORTED",
      `JWW block definition replacement must retain nested record count and order: ${patch.targetId}`
    );
  }
  const previousNumber = Number(previous.value?.number);
  value.number = number;
  next.blockDefinitions[index] = { ...previous, value };
  return previousNumber === number
    ? null
    : { id: previous.id, previousNumber, number };
}

function replaceNestedBlockRecord(next, location, patch) {
  const definition = next.blockDefinitions[location.definitionIndex];
  const entities = definition.value.entities.slice();
  const previous = entities[location.entityIndex];
  const value = cloneValue(unwrap(patch.record));
  entities[location.entityIndex] = {
    ...previous,
    kind: getJwwNativeRecordKind(value),
    value,
  };
  next.blockDefinitions[location.definitionIndex] = {
    ...definition,
    value: { ...definition.value, entities },
  };
}

function replaceEmbeddedImage(next, index, patch) {
  const previous = next.embeddedImages[index];
  const value = cloneValue(unwrap(patch.record));
  const fileName = String(
    value?.fileName ?? value?.file_name ?? previous.fileName
  ).trim();
  if (!fileName) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `Embedded JWW image replacement requires a file name: ${patch.targetId}`
    );
  }
  const bytes = toBytes(value?.bytes ?? previous.bytes);
  next.embeddedImages[index] = {
    ...previous,
    ...value,
    id: previous.id,
    index: previous.index,
    sourceIndex: previous.sourceIndex,
    fileName,
    declaredSize: Number(
      value?.declaredSize ?? value?.declared_size ?? previous.declaredSize
    ),
    bytes,
    truncated: Boolean(value?.truncated ?? previous.truncated),
    sourceSpan: previous.sourceSpan,
  };
  const previousNormalizedName = normalizedEmbeddedImageName(previous.fileName);
  const normalizedName = normalizedEmbeddedImageName(fileName);
  return previousNormalizedName === normalizedName
    ? null
    : {
        id: previous.id,
        previousFileName: previous.fileName,
        previousNormalizedName,
        fileName,
        normalizedName,
      };
}

function requiredMetadataPatchId(patch, section) {
  const targetId = String(patch.targetId || "");
  if (!targetId) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `JWW ${section} create requires a stable targetId`
    );
  }
  return targetId;
}

function normalizedEmbeddedImageName(value) {
  return String(value || "")
    .trim()
    .replace(/^%temp%/i, "")
    .replace(/\\/g, "/")
    .replace(/\.gz$/i, "")
    .toLowerCase();
}

function imageReference(value) {
  if (getJwwNativeRecordKind(value) !== "IMAGE") return null;
  const text = String(value?.raw_content ?? value?.content ?? "");
  const parsed = parseJwwImageReferenceText(text);
  if (!parsed) return null;
  return {
    ...parsed,
    normalizedName: normalizedEmbeddedImageName(parsed.fileName),
  };
}

function normalizedAngleDifference(left, right) {
  const difference = ((Number(left) - Number(right) + 180) % 360 + 360) % 360 - 180;
  return Math.abs(difference);
}

function nativeImageRotationChanged(previous, next) {
  const previousKind = getJwwNativeRecordKind(previous);
  const nextKind = getJwwNativeRecordKind(next);
  if (previousKind !== "IMAGE" && nextKind !== "IMAGE") return false;
  const previousAngle = Number(unwrap(previous)?.angle || 0);
  const nextAngle = Number(unwrap(next)?.angle || 0);
  const previousReference = imageReference(unwrap(previous));
  const nextReference = imageReference(unwrap(next));
  return (
    !Number.isFinite(nextAngle) ||
    normalizedAngleDifference(previousAngle, nextAngle) > 1e-9 ||
    previousReference?.hasRotationField !== nextReference?.hasRotationField ||
    (previousReference?.hasRotationField &&
      nextReference?.hasRotationField &&
      normalizedAngleDifference(previousReference.rotation, nextReference.rotation) > 1e-9)
  );
}

function createdNativeImageUsesRotation(value) {
  if (getJwwNativeRecordKind(value) !== "IMAGE") return false;
  const angle = Number(unwrap(value)?.angle || 0);
  const reference = imageReference(unwrap(value));
  return (
    !Number.isFinite(angle) ||
    normalizedAngleDifference(angle, 0) > 1e-9 ||
    (reference?.hasRotationField &&
      normalizedAngleDifference(reference.rotation, 0) > 1e-9)
  );
}

function validateNativeImageRotationRecord(record) {
  const value = unwrap(record);
  const angle = Number(value?.angle);
  if (!Number.isFinite(angle)) {
    return { ok: false, reason: `JWW IMAGE ${record.id} angle must be finite` };
  }
  const reference = imageReference(value);
  if (!reference) {
    return {
      ok: false,
      reason: `JWW IMAGE ${record.id} reference text is not safely parseable`,
    };
  }
  if (
    !reference.hasRotationField ||
    normalizedAngleDifference(reference.rotation, angle) > 1e-9
  ) {
    return {
      ok: false,
      reason: `JWW IMAGE ${record.id} reference rotation must equal CDataMoji angle`,
    };
  }
  const startX = Number(value.start_x);
  const startY = Number(value.start_y);
  const endX = Number(value.end_x);
  const endY = Number(value.end_y);
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  if (
    ![startX, startY, endX, endY].every(Number.isFinite) ||
    Math.hypot(deltaX, deltaY) <= 1e-12
  ) {
    return {
      ok: false,
      reason: `JWW IMAGE ${record.id} CDataMoji endpoint vector is unavailable`,
    };
  }
  const endpointAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  if (normalizedAngleDifference(endpointAngle, angle) > 1e-7) {
    return {
      ok: false,
      reason: `JWW IMAGE ${record.id} endpoint angle must equal CDataMoji angle`,
    };
  }
  return { ok: true, reference, endpointAngle };
}

export function createNativeJwwImageRotationPatch(document, targetId, rotation) {
  if (document?.kind !== JWW_NATIVE_DOCUMENT_KIND) {
    throw new TypeError("Expected a JwwNativeDocument");
  }
  const target = nativeRecordById(document, targetId);
  if (!target || getJwwNativeRecordKind(target) !== "IMAGE") {
    throw nativePatchError(
      "JWW_NATIVE_IMAGE_REQUIRED",
      `JWW native IMAGE target was not found: ${targetId}`
    );
  }
  const angle = Number(rotation);
  if (!Number.isFinite(angle)) {
    throw nativePatchError(
      "JWW_NATIVE_IMAGE_ROTATION_INVALID",
      `JWW IMAGE rotation must be finite; received ${rotation}`
    );
  }
  const value = cloneValue(unwrap(target));
  const previousAngle = Number(value.angle || 0);
  const deltaRadians = (angle - previousAngle) * (Math.PI / 180);
  const deltaX = Number(value.end_x) - Number(value.start_x);
  const deltaY = Number(value.end_y) - Number(value.start_y);
  if (
    ![value.start_x, value.start_y, value.end_x, value.end_y]
      .map(Number)
      .every(Number.isFinite) ||
    Math.hypot(deltaX, deltaY) <= 1e-12
  ) {
    throw nativePatchError(
      "JWW_NATIVE_IMAGE_ROTATION_INVALID",
      `JWW IMAGE ${targetId} endpoint vector is unavailable`
    );
  }
  value.angle = angle;
  value.end_x =
    Number(value.start_x) + deltaX * Math.cos(deltaRadians) - deltaY * Math.sin(deltaRadians);
  value.end_y =
    Number(value.start_y) + deltaX * Math.sin(deltaRadians) + deltaY * Math.cos(deltaRadians);
  const text = setJwwImageReferenceRotation(
    String(value.raw_content ?? value.content ?? ""),
    angle
  );
  value.raw_content = text;
  value.content = text;
  return { op: "replace", targetId, record: value };
}

function allEntityRecords(document) {
  return [
    ...(document.nativeEntities || []),
    ...(document.blockDefinitions || []).flatMap(
      (definition) => definition.value?.entities || []
    ),
  ];
}

function allNativeRecords(document) {
  return [
    ...(document.nativeEntities || []),
    ...(document.blockDefinitions || []),
    ...(document.blockDefinitions || []).flatMap(
      (definition) => definition.value?.entities || []
    ),
    ...(document.embeddedImages || []),
  ];
}

function createBlockDefinition(next, patch) {
  const targetId = requiredMetadataPatchId(patch, "block definition");
  const value = cloneValue(unwrap(patch.record));
  if (!value || !Array.isArray(value.entities)) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `JWW block definition create requires its native entity list: ${targetId}`
    );
  }
  const number = Number(value.number);
  if (!Number.isSafeInteger(number) || number < 0 || number > 0xffffffff) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `JWW block definition number must be an unsigned 32-bit integer: ${targetId}`
    );
  }
  const nestedIds = new Set();
  const entities = value.entities.map((source, index) => {
    const recordValue = cloneValue(unwrap(source));
    const id = String(source?.id || `${targetId}:record:${index}`);
    if (
      !id ||
      nestedIds.has(id) ||
      id === targetId ||
      nativeTargetIdExists(next, id)
    ) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_REFERENCE_CONFLICT",
        `JWW block definition nested record id already exists: ${id || "(empty)"}`
      );
    }
    nestedIds.add(id);
    const record = nativeRecord("block-created", index, recordValue);
    record.id = id;
    record.className = source?.className || null;
    record.sourceSpan = null;
    return record;
  });
  delete value.entity_records;
  value.number = number;
  value.entities = entities;
  const index = next.blockDefinitions.length;
  const definition = {
    id: targetId,
    index,
    sourceIndex: index,
    className: "CDataList",
    sourceSpan: null,
    value,
  };
  next.blockDefinitions.push(definition);
  return definition;
}

function requiredBlockRecordParent(next, patch) {
  const parentId = String(patch.parentId || "");
  if (!parentId) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      "JWW nested block record create requires a parentId"
    );
  }
  const definitionIndex = next.blockDefinitions.findIndex(
    (definition) => definition.id === parentId
  );
  if (definitionIndex < 0) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `JWW nested block record parent was not found: ${parentId}`
    );
  }
  return { parentId, definitionIndex };
}

function createNestedBlockRecord(next, patch) {
  const targetId = requiredMetadataPatchId(patch, "nested block record");
  const { definitionIndex } = requiredBlockRecordParent(next, patch);
  const definition = next.blockDefinitions[definitionIndex];
  const entities = (definition.value?.entities || []).slice();
  const insertionIndex =
    patch.index === undefined || patch.index === null
      ? entities.length
      : Number(patch.index);
  if (
    !Number.isSafeInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > entities.length
  ) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `JWW nested block record index is outside 0..${entities.length}: ${patch.index}`
    );
  }
  const value = cloneValue(unwrap(patch.record));
  const record = nativeRecord("block-created", insertionIndex, value);
  record.id = targetId;
  record.className = patch.record?.className || null;
  record.sourceSpan = null;
  entities.splice(insertionIndex, 0, record);
  next.blockDefinitions[definitionIndex] = {
    ...definition,
    value: { ...definition.value, entities },
  };
  return record;
}

function deleteNestedBlockRecord(next, location, patch) {
  const definition = next.blockDefinitions[location.definitionIndex];
  if (patch.parentId && String(patch.parentId) !== definition.id) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `JWW nested block record ${patch.targetId} does not belong to ${patch.parentId}`
    );
  }
  const entities = definition.value.entities.slice();
  const [record] = entities.splice(location.entityIndex, 1);
  next.blockDefinitions[location.definitionIndex] = {
    ...definition,
    value: { ...definition.value, entities },
  };
  return record;
}

function createEmbeddedImage(next, patch) {
  const targetId = requiredMetadataPatchId(patch, "embedded image");
  const value = cloneValue(unwrap(patch.record)) || {};
  const fileName = String(value.fileName ?? value.file_name ?? "").trim();
  if (!fileName) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `Embedded JWW image create requires a file name: ${targetId}`
    );
  }
  const normalizedName = normalizedEmbeddedImageName(fileName);
  const bytes = toBytes(value.bytes);
  const declaredSize = Number(
    value.declaredSize ?? value.declared_size ?? bytes.length
  );
  if (
    value.truncated ||
    !Number.isSafeInteger(declaredSize) ||
    declaredSize < 0 ||
    declaredSize !== bytes.length
  ) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_PATCH_INVALID",
      `Embedded JWW image payload size is invalid: ${fileName}`
    );
  }
  const index = next.embeddedImages.length;
  const image = {
    ...value,
    id: targetId,
    index,
    sourceIndex: index,
    fileName,
    declaredSize,
    bytes,
    truncated: false,
    sourceSpan: null,
  };
  next.embeddedImages.push(image);
  return image;
}

function validateMetadataPatchReferences(
  next,
  {
    deletedBlockDefinitions,
    deletedEmbeddedImages,
    renamedBlockDefinitions,
    renamedEmbeddedImages,
    touchedRecordIds,
  }
) {
  const records = allEntityRecords(next);
  const definitionNumberCounts = new Map();
  for (const definition of next.blockDefinitions) {
    const number = Number(definition.value?.number);
    definitionNumberCounts.set(number, (definitionNumberCounts.get(number) || 0) + 1);
  }
  const duplicateDefinitionNumber = [...definitionNumberCounts].find(
    ([, count]) => count > 1
  )?.[0];
  if (duplicateDefinitionNumber !== undefined) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_REFERENCE_CONFLICT",
      `JWW block definition number already exists: ${duplicateDefinitionNumber}`
    );
  }
  const definitionNumbers = new Set(definitionNumberCounts.keys());
  const embeddedImageNameCounts = new Map();
  for (const image of next.embeddedImages) {
    const name = normalizedEmbeddedImageName(image.fileName);
    embeddedImageNameCounts.set(name, (embeddedImageNameCounts.get(name) || 0) + 1);
  }
  const duplicateEmbeddedImageName = [...embeddedImageNameCounts].find(
    ([, count]) => count > 1
  )?.[0];
  if (duplicateEmbeddedImageName !== undefined) {
    throw nativePatchError(
      "JWW_NATIVE_METADATA_REFERENCE_CONFLICT",
      `Embedded JWW image name already exists: ${duplicateEmbeddedImageName}`
    );
  }
  const embeddedImageNames = new Set(embeddedImageNameCounts.keys());

  for (const deleted of deletedBlockDefinitions) {
    const reference = records.find(
      (record) =>
        getJwwNativeRecordKind(record) === "INSERT" &&
        Number(unwrap(record)?.def_number) === deleted.number
    );
    if (reference) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_REFERENCE_IN_USE",
        `JWW block definition ${deleted.number} is still referenced by ${reference.id}`
      );
    }
  }

  for (const deleted of deletedEmbeddedImages) {
    const reference = records.find((record) => {
      const image = imageReference(unwrap(record));
      return image?.embedded && image.normalizedName === deleted.normalizedName;
    });
    if (reference) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_REFERENCE_IN_USE",
        `Embedded JWW image ${deleted.fileName} is still referenced by ${reference.id}`
      );
    }
  }

  for (const renamed of renamedBlockDefinitions) {
    if (definitionNumbers.has(renamed.previousNumber)) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_REFERENCE_CONFLICT",
        `Renamed JWW block definition number cannot be reused in the same transaction: ${renamed.previousNumber}`
      );
    }
    const reference = records.find(
      (record) =>
        getJwwNativeRecordKind(record) === "INSERT" &&
        Number(unwrap(record)?.def_number) === renamed.previousNumber
    );
    if (reference) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_REFERENCE_IN_USE",
        `JWW block definition ${renamed.previousNumber} was renumbered but is still referenced by ${reference.id}`
      );
    }
  }

  for (const renamed of renamedEmbeddedImages) {
    if (embeddedImageNames.has(renamed.previousNormalizedName)) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_REFERENCE_CONFLICT",
        `Renamed embedded JWW image name cannot be reused in the same transaction: ${renamed.previousFileName}`
      );
    }
    const reference = records.find((record) => {
      const image = imageReference(unwrap(record));
      return (
        image?.embedded &&
        image.normalizedName === renamed.previousNormalizedName
      );
    });
    if (reference) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_REFERENCE_IN_USE",
        `Embedded JWW image ${renamed.previousFileName} was renamed but is still referenced by ${reference.id}`
      );
    }
  }

  for (const record of records) {
    if (!touchedRecordIds.has(record.id)) continue;
    const value = unwrap(record);
    if (
      getJwwNativeRecordKind(value) === "INSERT" &&
      !definitionNumbers.has(Number(value.def_number))
    ) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_REFERENCE_MISSING",
        `JWW INSERT ${record.id} references missing block definition ${value.def_number}`
      );
    }
    const image = imageReference(value);
    if (
      image?.embedded &&
      !embeddedImageNames.has(image.normalizedName)
    ) {
      throw nativePatchError(
        "JWW_NATIVE_METADATA_REFERENCE_MISSING",
        `JWW IMAGE ${record.id} references missing embedded payload ${image.fileName}`
      );
    }
  }
}

export function applyNativeJwwPatches(document, patches = []) {
  if (document?.kind !== JWW_NATIVE_DOCUMENT_KIND) {
    throw new TypeError("Expected a JwwNativeDocument");
  }
  if (!patches.length) return document;
  const next = cloneNativeDocument(document);
  const pendingCreatedRecordIds = new Set(document.pendingCreatedRecordIds || []);
  const pendingDeletedRecordIds = new Set(document.pendingDeletedRecordIds || []);
  const pendingImageRotationRecordIds = new Set(
    document.pendingImageRotationRecordIds || []
  );
  const pendingReplacementRecordIds = new Set(
    document.pendingReplacementRecordIds || []
  );
  const pendingPrefixMetadataTargetIds = new Set(
    document.pendingPrefixMetadataTargetIds || []
  );
  let pendingRequiresRebuild = Boolean(document.pendingRequiresRebuild);
  const deletedBlockDefinitions = [];
  const deletedEmbeddedImages = [];
  const renamedBlockDefinitions = [];
  const renamedEmbeddedImages = [];
  const touchedRecordIds = new Set();
  for (const patch of patches) {
    const index = next.nativeEntities.findIndex((item) => item.id === patch.targetId);
    const blockDefinitionIndex = next.blockDefinitions.findIndex(
      (item) => item.id === patch.targetId
    );
    const embeddedImageIndex = next.embeddedImages.findIndex(
      (item) => item.id === patch.targetId
    );
    const nestedLocation = nestedBlockRecordLocation(next, patch.targetId);
    const headerTarget = patch.targetId === next.header?.id;
    const layerGroupIndex = next.layerGroups.findIndex(
      (item) => item.id === patch.targetId
    );
    if (patch.op === "delete") {
      if (headerTarget || layerGroupIndex >= 0) {
        throw nativePatchError(
          "JWW_NATIVE_METADATA_STRUCTURE_CHANGE_UNSUPPORTED",
          `JWW native fixed metadata cannot be deleted: ${patch.targetId}`
        );
      }
      if (blockDefinitionIndex >= 0) {
        pendingRequiresRebuild = true;
        const [definition] = next.blockDefinitions.splice(blockDefinitionIndex, 1);
        deletedBlockDefinitions.push({
          id: definition.id,
          number: Number(definition.value?.number),
        });
        for (const id of [
          definition.id,
          ...(definition.value?.entities || []).map((record) => record.id),
        ]) {
          if (!pendingCreatedRecordIds.delete(id)) pendingDeletedRecordIds.add(id);
          pendingImageRotationRecordIds.delete(id);
          pendingReplacementRecordIds.delete(id);
        }
        continue;
      }
      if (embeddedImageIndex >= 0) {
        pendingRequiresRebuild = true;
        const [image] = next.embeddedImages.splice(embeddedImageIndex, 1);
        deletedEmbeddedImages.push({
          id: image.id,
          fileName: image.fileName,
          normalizedName: normalizedEmbeddedImageName(image.fileName),
        });
        if (!pendingCreatedRecordIds.delete(image.id)) {
          pendingDeletedRecordIds.add(image.id);
        }
        continue;
      }
      if (nestedLocation) {
        pendingRequiresRebuild = true;
        const deleted = deleteNestedBlockRecord(next, nestedLocation, patch);
        if (!pendingCreatedRecordIds.delete(deleted.id)) {
          pendingDeletedRecordIds.add(deleted.id);
        }
        pendingImageRotationRecordIds.delete(deleted.id);
        pendingReplacementRecordIds.delete(deleted.id);
        continue;
      }
      if (index < 0) throw new Error(`JWW native patch target was not found: ${patch.targetId}`);
      next.nativeEntities.splice(index, 1);
      pendingRequiresRebuild = true;
      if (!pendingCreatedRecordIds.delete(patch.targetId)) {
        pendingDeletedRecordIds.add(patch.targetId);
      }
      pendingImageRotationRecordIds.delete(patch.targetId);
      pendingReplacementRecordIds.delete(patch.targetId);
      continue;
    }
    if (patch.op === "replace") {
      if (headerTarget) {
        replaceNativeHeader(next, patch);
        pendingPrefixMetadataTargetIds.add(patch.targetId);
      } else if (layerGroupIndex >= 0) {
        replaceNativeLayerGroup(next, layerGroupIndex, patch);
        pendingPrefixMetadataTargetIds.add(patch.targetId);
      } else if (index >= 0) {
        const previousValue = next.nativeEntities[index].value;
        const value = cloneValue(unwrap(patch.record));
        next.nativeEntities[index] = {
          ...next.nativeEntities[index],
          kind: getJwwNativeRecordKind(value),
          value,
        };
        if (nativeImageRotationChanged(previousValue, value)) {
          pendingImageRotationRecordIds.add(patch.targetId);
        }
        touchedRecordIds.add(patch.targetId);
        pendingReplacementRecordIds.add(patch.targetId);
      } else if (blockDefinitionIndex >= 0) {
        pendingRequiresRebuild = true;
        const previousEntities =
          next.blockDefinitions[blockDefinitionIndex].value.entities || [];
        const renamed = replaceBlockDefinition(next, blockDefinitionIndex, patch);
        if (renamed) renamedBlockDefinitions.push(renamed);
        const revisedEntities =
          next.blockDefinitions[blockDefinitionIndex].value.entities || [];
        for (let entityIndex = 0; entityIndex < revisedEntities.length; entityIndex += 1) {
          if (
            JSON.stringify(unwrap(previousEntities[entityIndex])) !==
            JSON.stringify(unwrap(revisedEntities[entityIndex]))
          ) {
            touchedRecordIds.add(revisedEntities[entityIndex].id);
          }
          if (
            nativeImageRotationChanged(
              previousEntities[entityIndex],
              revisedEntities[entityIndex]
            )
          ) {
            pendingImageRotationRecordIds.add(revisedEntities[entityIndex].id);
          }
        }
      } else if (nestedLocation) {
        const previousValue = nestedLocation.record.value;
        replaceNestedBlockRecord(next, nestedLocation, patch);
        const revisedRecord = nativeRecordById(next, patch.targetId);
        if (nativeImageRotationChanged(previousValue, revisedRecord)) {
          pendingImageRotationRecordIds.add(patch.targetId);
        }
        touchedRecordIds.add(patch.targetId);
        pendingReplacementRecordIds.add(patch.targetId);
      } else if (embeddedImageIndex >= 0) {
        pendingRequiresRebuild = true;
        const renamed = replaceEmbeddedImage(next, embeddedImageIndex, patch);
        if (renamed) renamedEmbeddedImages.push(renamed);
      } else {
        throw new Error(`JWW native patch target was not found: ${patch.targetId}`);
      }
      continue;
    }
    if (patch.op === "create") {
      pendingRequiresRebuild = true;
      const section = patch.section || "drawing";
      if (
        patch.targetId &&
        (pendingDeletedRecordIds.has(patch.targetId) || nativeTargetIdExists(next, patch.targetId))
      ) {
        throw new Error(`JWW native patch target already exists: ${patch.targetId}`);
      }
      if (section === "block-definitions") {
        const definition = createBlockDefinition(next, patch);
        pendingCreatedRecordIds.add(definition.id);
        for (const record of definition.value.entities || []) {
          pendingCreatedRecordIds.add(record.id);
          touchedRecordIds.add(record.id);
          if (createdNativeImageUsesRotation(record)) {
            pendingImageRotationRecordIds.add(record.id);
          }
        }
        continue;
      }
      if (section === "block-records") {
        const record = createNestedBlockRecord(next, patch);
        pendingCreatedRecordIds.add(record.id);
        touchedRecordIds.add(record.id);
        if (createdNativeImageUsesRotation(record)) {
          pendingImageRotationRecordIds.add(record.id);
        }
        continue;
      }
      if (section === "embedded-images") {
        const image = createEmbeddedImage(next, patch);
        pendingCreatedRecordIds.add(image.id);
        continue;
      }
      if (section !== "drawing") {
        throw nativePatchError(
          "JWW_NATIVE_METADATA_PATCH_UNSUPPORTED",
          `Unsupported JWW native patch section: ${section}`
        );
      }
      const value = cloneValue(unwrap(patch.record));
      const created = nativeRecord("drawing-created", next.nativeEntities.length, value);
      created.id = patch.targetId || created.id;
      next.nativeEntities.push(created);
      pendingCreatedRecordIds.add(created.id);
      touchedRecordIds.add(created.id);
      if (createdNativeImageUsesRotation(created)) {
        pendingImageRotationRecordIds.add(created.id);
      }
      continue;
    }
    throw new Error(`Unsupported JWW native patch operation: ${patch.op}`);
  }
  validateMetadataPatchReferences(next, {
    deletedBlockDefinitions,
    deletedEmbeddedImages,
    renamedBlockDefinitions,
    renamedEmbeddedImages,
    touchedRecordIds,
  });
  next.dirty = true;
  next.revision = Number(document.revision || 0) + 1;
  next.pendingCreatedRecordIds = [...pendingCreatedRecordIds];
  next.pendingDeletedRecordIds = [...pendingDeletedRecordIds];
  next.pendingImageRotationRecordIds = [...pendingImageRotationRecordIds];
  next.pendingReplacementRecordIds = [...pendingReplacementRecordIds];
  next.pendingPrefixMetadataTargetIds = [...pendingPrefixMetadataTargetIds];
  next.pendingRequiresRebuild = pendingRequiresRebuild;
  return next;
}

function itemBase(value) {
  return { ...(value?.base || {}) };
}

function nativeRecordToWriterItem(record, imageRotationRecordIds = new Set()) {
  const value = unwrap(record) || {};
  const type = getJwwNativeRecordKind(value);
  const item = {
    id: record.id,
    type,
    layer: `${Number(value.base?.layer_group || 0).toString(16).toUpperCase()}-${Number(
      value.base?.layer || 0
    ).toString(16).toUpperCase()}`,
    colorNumber: Number(value.base?.pen_color || 0),
    entity: { type, jww: itemBase(value) },
  };
  const entity = item.entity;
  if (type === "LINE") {
    entity.start = { x: value.start_x, y: value.start_y };
    entity.end = { x: value.end_x, y: value.end_y };
  } else if (type === "CIRCLE" || type === "ARC") {
    entity.center = { x: value.center_x, y: value.center_y };
    entity.radius = value.radius;
    entity.jwwStartAngle = value.start_angle;
    entity.jwwArcAngle = value.arc_angle;
    entity.jwwTiltAngle = value.tilt_angle;
    entity.jwwFlatness = value.flatness;
  } else if (type === "TEXT" || type === "IMAGE") {
    entity.position = { x: value.start_x, y: value.start_y };
    entity.endPoint = { x: value.end_x, y: value.end_y };
    entity.text = value.raw_content ?? value.content ?? "";
    entity.paperTextWidth = value.size_x;
    entity.paperTextHeight = value.size_y;
    entity.paperTextSpacing = value.spacing;
    entity.rotation = value.angle;
    entity.fontFamily = value.font_name;
    entity.jwwTextType = value.text_type;
    if (type === "IMAGE") {
      const reference = parseJwwImageReferenceText(entity.text);
      entity.fileName = reference
        ? `${reference.embedded ? "%temp%" : ""}${reference.fileName}`
        : "image.bmp";
      entity.width = Math.abs(Number(reference?.width || value.size_x || 1));
      entity.height = Math.abs(Number(reference?.height || value.size_y || 1));
      entity.jwwImageText = entity.text;
      entity.jwwImageRotationExplicit = imageRotationRecordIds.has(record.id);
    }
  } else if (type === "POINT") {
    entity.position = { x: value.x, y: value.y };
    entity.temporaryPoint = Boolean(value.is_temporary);
    entity.jwwPointCode = value.code;
    entity.jwwPointAngle = value.angle;
    entity.jwwPointScale = value.scale;
  } else if (type === "SOLID") {
    // CDataSolid is serialized in the boundary order point1, point4,
    // point2, point3 even though the parser exposes the named fields in
    // numeric order. Keep the writer-facing geometry in boundary order.
    entity.vertices = [1, 4, 2, 3].map((index) => ({
      x: value[`point${index}_x`],
      y: value[`point${index}_y`],
    }));
    entity.jwwSolidColor = value.color;
  } else if (type === "INSERT") {
    entity.position = { x: value.ref_x, y: value.ref_y };
    entity.jwwBlock = {
      reference: entity.position,
      scaleX: value.scale_x,
      scaleY: value.scale_y,
      rotation: value.rotation,
      definitionNumber: value.def_number,
    };
  } else if (type === "DIMENSION") {
    const dimension = value.jww_dimension;
    entity.text = dimension?.text?.raw_content ?? dimension?.text?.content ?? "";
    entity.position = {
      x: dimension?.text?.start_x ?? value.start_x,
      y: dimension?.text?.start_y ?? value.start_y,
    };
    entity.endPoint = {
      x: dimension?.text?.end_x ?? value.end_x,
      y: dimension?.text?.end_y ?? value.end_y,
    };
    entity.jwwDimension = dimension;
  }
  return item;
}

function nativeBlockDefinitionToWriter(definition, imageRotationRecordIds = new Set()) {
  const value = definition.value || {};
  return {
    base: value.base,
    number: value.number,
    referred: value.referred,
    createdAt: value.created_at,
    rawName: value.name,
    entities: (value.entities || []).map((record) =>
      nativeRecordToWriterItem(record, imageRotationRecordIds)
    ),
  };
}

function concatBytes(left, right) {
  if (!right?.length) return left;
  const bytes = new Uint8Array(left.length + right.length);
  bytes.set(left, 0);
  bytes.set(right, left.length);
  return bytes;
}

function spliceBytes(source, start, end, replacement) {
  const bytes = new Uint8Array(source.length - (end - start) + replacement.length);
  bytes.set(source.slice(0, start), 0);
  bytes.set(replacement, start);
  bytes.set(source.slice(end), start + replacement.length);
  return bytes;
}

function hasParserLoss(document) {
  return (
    Number(document.diagnostics?.unsupportedCount || 0) > 0 ||
    Number(document.diagnostics?.skippedCount || 0) > 0 ||
    Number(document.diagnostics?.embeddedImageTruncatedCount || 0) > 0 ||
    (document.diagnostics?.embeddedImageIssues || []).length > 0 ||
    Number(
      document.diagnostics?.trailingByteLength ||
        document.preservedRegions?.trailing?.byteLength ||
        0
    ) > 0
  );
}

function nativeRebuildWriteOptions(
  document,
  revised,
  imageRotationRecordIds = new Set()
) {
  const prefixEnd = Number(document.preservedRegions?.prefix?.end || 0);
  return {
    entities: revised.nativeEntities.map((record) =>
      nativeRecordToWriterItem(record, imageRotationRecordIds)
    ),
    memo: revised.header.memo,
    paperSize: revised.header.paperSize,
    writeLayerGroup: revised.header.writeLayerGroup,
    layerGroupScales: (revised.layerGroups || []).map((group) =>
      Number(group?.scale || 1)
    ),
    layerGroupWriteLayers: (revised.layerGroups || []).map((group) =>
      Number(group?.write_layer || 0)
    ),
    layerGroupStates: (revised.layerGroups || []).map((group, index) =>
      Number(group?.state) === Number(document.layerGroups?.[index]?.state)
        ? null
        : Number(group?.state)
    ),
    layerStates: (revised.layerGroups || []).map((group, groupIndex) =>
      (group.layers || []).map((layer, layerIndex) =>
        Number(layer?.state) ===
        Number(document.layerGroups?.[groupIndex]?.layers?.[layerIndex]?.state)
          ? null
          : Number(layer?.state)
      )
    ),
    layerGroupProtections: (revised.layerGroups || []).map((group, index) =>
      Number(group?.protect) === Number(document.layerGroups?.[index]?.protect)
        ? null
        : Number(group?.protect)
    ),
    layerProtections: (revised.layerGroups || []).map((group, groupIndex) =>
      (group.layers || []).map((layer, layerIndex) =>
        Number(layer?.protect) ===
        Number(document.layerGroups?.[groupIndex]?.layers?.[layerIndex]?.protect)
          ? null
          : Number(layer?.protect)
      )
    ),
    templatePrefix: document.originalBytes.slice(0, prefixEnd),
    meta: {
      jwwBlockDefinitions: revised.blockDefinitions.map((definition) =>
        nativeBlockDefinitionToWriter(definition, imageRotationRecordIds)
      ),
      jwwEmbeddedImages: revised.embeddedImages.map((image) => ({
        fileName: image.fileName,
        declaredSize: image.declaredSize,
        bytes: image.bytes,
        truncated: image.truncated,
      })),
    },
    version: document.version,
    strict: true,
    // The native preflight owns edit permission. The writer must still preserve
    // already-rotated source records during unrelated rebuilds.
    allowImageRotation: true,
  };
}

function prepareRecordReplacements(
  document,
  revised,
  targetIds,
  imageRotationRecordIds = new Set()
) {
  const replacements = [];
  for (const targetId of targetIds) {
    const target = nativeRecordById(document, targetId);
    if (!target) {
      return { ok: false, reason: `JWW native patch target was not found: ${targetId}` };
    }
    const revisedTarget = nativeRecordById(revised, targetId);
    if (!revisedTarget) {
      return { ok: false, reason: `Revised JWW native patch target was not found: ${targetId}` };
    }
    if (
      target.archiveKind !== "new-class-object" &&
      target.archiveKind !== "old-class-object"
    ) {
      return {
        ok: false,
        reason: `Archive record kind is not safe for raw replacement: ${target.archiveKind || "(unknown)"} (${targetId})`,
      };
    }
    const span = target.sourceSpan;
    if (
      !Number.isInteger(span?.payloadStart) ||
      !Number.isInteger(span?.end) ||
      span.payloadStart < 0 ||
      span.end < span.payloadStart ||
      span.end > document.originalBytes.length
    ) {
      return { ok: false, reason: `Source payload span is unavailable: ${targetId}` };
    }
    let encoded;
    try {
      encoded = buildJwwRecordPayload(
        nativeRecordToWriterItem(revisedTarget, imageRotationRecordIds),
        {
          version: document.version,
          embeddedImages: revised.embeddedImages,
          allowImageRotation: true,
        }
      );
    } catch (error) {
      return { ok: false, reason: error.message };
    }
    if (!target.className || encoded.className !== target.className) {
      return {
        ok: false,
        reason: `Record class change is not safe for raw replacement: ${target.className || "(unknown)"} -> ${encoded.className}`,
      };
    }
    const sourcePayloadLength = span.end - span.payloadStart;
    if (
      Number(
        document.diagnostics?.trailingByteLength ||
          document.preservedRegions?.trailing?.byteLength ||
          0
      ) > 0 &&
      encoded.bytes.length !== sourcePayloadLength
    ) {
      return {
        ok: false,
        reason: `Record replacement would move an unparsed trailing region: ${targetId}`,
      };
    }
    replacements.push({
      targetId: target.id,
      start: span.payloadStart,
      end: span.end,
      bytes: encoded.bytes,
      className: encoded.className,
    });
  }
  return { ok: true, replacements };
}

function preparePrefixMetadataReplacement(document, revised, targetIds) {
  if (!targetIds.length) return { ok: true, replacement: null };
  const targetIdSet = new Set(targetIds);
  const allowedIds = new Set([
    document.header?.id,
    ...(document.layerGroups || []).map((group) => group.id),
  ]);
  const invalidTargetId = targetIds.find((targetId) => !allowedIds.has(targetId));
  if (invalidTargetId) {
    return {
      ok: false,
      reason: `JWW native prefix metadata target was not found: ${invalidTargetId}`,
    };
  }
  const prefixEnd = Number(document.preservedRegions?.prefix?.end || 0);
  if (!Number.isInteger(prefixEnd) || prefixEnd <= 0 || prefixEnd > document.originalBytes.length) {
    return { ok: false, reason: "JWW native prefix source span is unavailable" };
  }
  const layerGroupScales = Array(16).fill(null);
  const layerGroupWriteLayers = Array(16).fill(null);
  const layerGroupStates = Array(16).fill(null);
  const layerStates = Array.from({ length: 16 }, () => Array(16).fill(null));
  const layerGroupProtections = Array(16).fill(null);
  const layerProtections = Array.from({ length: 16 }, () =>
    Array(16).fill(null)
  );
  for (let index = 0; index < revised.layerGroups.length; index += 1) {
    const group = revised.layerGroups[index];
    if (targetIdSet.has(group.id)) {
      layerGroupScales[index] = group.scale;
      layerGroupWriteLayers[index] = group.write_layer;
      layerGroupStates[index] = group.state;
      layerGroupProtections[index] = group.protect;
      for (let layerIndex = 0; layerIndex < group.layers.length; layerIndex += 1) {
        layerStates[index][layerIndex] = group.layers[layerIndex].state;
        layerProtections[index][layerIndex] = group.layers[layerIndex].protect;
      }
    }
  }
  let bytes;
  try {
    bytes = patchJwwTemplatePrefixMetadata(
      document.originalBytes.slice(0, prefixEnd),
      {
        paperSize: targetIdSet.has(revised.header.id)
          ? revised.header.paperSize
          : null,
        writeLayerGroup: targetIdSet.has(revised.header.id)
          ? revised.header.writeLayerGroup
          : null,
        layerGroupScales,
        layerGroupWriteLayers,
        layerGroupStates,
        layerStates,
        layerGroupProtections,
        layerProtections,
      }
    );
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  if (bytes.length !== prefixEnd) {
    return {
      ok: false,
      reason: `JWW native prefix metadata changed byte length: ${prefixEnd} -> ${bytes.length}`,
    };
  }
  return {
    ok: true,
    replacement: {
      targetId: "jww:prefix-metadata",
      start: 0,
      end: prefixEnd,
      bytes,
      className: null,
    },
  };
}

function prepareNativeSourceSplices(
  document,
  revised,
  replacementRecordIds,
  prefixMetadataTargetIds,
  imageRotationRecordIds = new Set()
) {
  const records = prepareRecordReplacements(
    document,
    revised,
    replacementRecordIds,
    imageRotationRecordIds
  );
  if (!records.ok) return records;
  const prefix = preparePrefixMetadataReplacement(
    document,
    revised,
    prefixMetadataTargetIds
  );
  if (!prefix.ok) return prefix;
  return {
    ok: true,
    replacements: [
      ...(prefix.replacement ? [prefix.replacement] : []),
      ...records.replacements,
    ],
    replacementCount: records.replacements.length,
    prefixMetadataUpdated: Boolean(prefix.replacement),
  };
}

function equalBytes(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function assertRecordReplacementEffects(bytes, savedDocument, replacements) {
  for (const replacement of replacements) {
    const savedRecord = nativeRecordById(savedDocument, replacement.targetId);
    const span = savedRecord?.sourceSpan;
    const savedPayload =
      Number.isInteger(span?.payloadStart) &&
      Number.isInteger(span?.end) &&
      span.payloadStart >= 0 &&
      span.end >= span.payloadStart &&
      span.end <= bytes.length
        ? bytes.slice(span.payloadStart, span.end)
        : null;
    if (
      !savedPayload ||
      savedRecord.className !== replacement.className ||
      !equalBytes(savedPayload, replacement.bytes)
    ) {
      const error = new Error(
        `Saved JWW record replacement was not retained after reparse: ${replacement.targetId}`
      );
      error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
      throw error;
    }
  }
}

function assertPrefixMetadataEffects(savedDocument, revisedDocument, targetIds) {
  const targetIdSet = new Set(targetIds);
  if (targetIdSet.has(revisedDocument.header.id)) {
    if (
      savedDocument.header.paperSize !== revisedDocument.header.paperSize ||
      savedDocument.header.writeLayerGroup !== revisedDocument.header.writeLayerGroup ||
      !sameNativeMetadataValue(
        savedDocument.layerGroups.map((group) => group.state),
        revisedDocument.layerGroups.map((group) => group.state)
      )
    ) {
      const error = new Error(
        "Saved JWW header metadata was not retained after reparse"
      );
      error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
      throw error;
    }
  }
  for (let index = 0; index < revisedDocument.layerGroups.length; index += 1) {
    const revisedGroup = revisedDocument.layerGroups[index];
    if (!targetIdSet.has(revisedGroup.id)) continue;
    const savedGroup = savedDocument.layerGroups[index];
    const metadataMatches =
      savedGroup?.scale === revisedGroup.scale &&
      savedGroup?.write_layer === revisedGroup.write_layer &&
      savedGroup?.protect === revisedGroup.protect &&
      sameNativeMetadataValue(savedGroup?.layers, revisedGroup.layers);
    if (!metadataMatches) {
      const error = new Error(
        `Saved JWW layer group metadata was not retained after reparse: ${revisedGroup.id}`
      );
      error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
      throw error;
    }
  }
}

export function preflightNativeJwwSave(
  document,
  { patches = [], strict = true, allowImageRotation = false } = {}
) {
  if (document?.kind !== JWW_NATIVE_DOCUMENT_KIND) {
    return {
      ok: false,
      code: "JWW_NATIVE_DOCUMENT_REQUIRED",
      strategy: "blocked",
      reasons: ["Expected a JwwNativeDocument"],
      willWriteBytes: false,
    };
  }
  if (!patches.length && !document.dirty) {
    return {
      ok: true,
      code: null,
      strategy: "byte-identical",
      reasons: [],
      byteIdentical: true,
      preservesUnsupportedBytes: true,
      willWriteBytes: true,
    };
  }

  let revised;
  try {
    revised = applyNativeJwwPatches(document, patches);
  } catch (error) {
    return {
      ok: false,
      code: error?.code || "JWW_NATIVE_PATCH_INVALID",
      strategy: "blocked",
      reasons: [error?.message || String(error)],
      byteIdentical: false,
      preservesUnsupportedBytes: true,
      willWriteBytes: false,
    };
  }
  const imageRotationRecordIds = [
    ...new Set(revised.pendingImageRotationRecordIds || []),
  ];
  const imageRotationRecordIdSet = new Set(imageRotationRecordIds);
  if (imageRotationRecordIds.length && !allowImageRotation) {
    return {
      ok: false,
      code: "JWW_NATIVE_IMAGE_ROTATION_PERMISSION_REQUIRED",
      strategy: "blocked",
      reasons: [
        "IMAGE rotation changes require allowImageRotation: true after CDataMoji and ^@BM rotation fields are reviewed",
      ],
      byteIdentical: false,
      preservesUnsupportedBytes: true,
      imageRotationRecordIds,
      imageRotationApproved: false,
      willWriteBytes: false,
    };
  }
  for (const targetId of imageRotationRecordIds) {
    const record = nativeRecordById(revised, targetId);
    if (!record) continue;
    const validation = validateNativeImageRotationRecord(record);
    if (!validation.ok) {
      return {
        ok: false,
        code: "JWW_NATIVE_IMAGE_ROTATION_INVALID",
        strategy: "blocked",
        reasons: [validation.reason],
        byteIdentical: false,
        preservesUnsupportedBytes: true,
        imageRotationRecordIds,
        imageRotationApproved: Boolean(allowImageRotation),
        willWriteBytes: false,
      };
    }
  }

  const replacementRecordIds = [
    ...new Set(revised.pendingReplacementRecordIds || []),
  ];
  const prefixMetadataTargetIds = [
    ...new Set(revised.pendingPrefixMetadataTargetIds || []),
  ];
  if (
    !revised.pendingRequiresRebuild &&
    (replacementRecordIds.length || prefixMetadataTargetIds.length)
  ) {
    const prepared = prepareNativeSourceSplices(
      document,
      revised,
      replacementRecordIds,
      prefixMetadataTargetIds,
      imageRotationRecordIdSet
    );
    if (prepared.ok) {
      return {
        ok: true,
        code: null,
        strategy: replacementRecordIds.length ? "record-splice" : "prefix-splice",
        reasons: [],
        byteIdentical: false,
        preservesUnsupportedBytes: true,
        replacementCount: prepared.replacementCount,
        prefixMetadataUpdated: prepared.prefixMetadataUpdated,
        replacementRecordIds,
        prefixMetadataTargetIds,
        imageRotationRecordIds,
        imageRotationApproved: Boolean(
          imageRotationRecordIds.length && allowImageRotation
        ),
        willWriteBytes: true,
      };
    }
    if (hasParserLoss(document)) {
      return {
        ok: false,
        code: "JWW_NATIVE_LOSSY_SAVE_BLOCKED",
        strategy: "blocked",
        reasons: [prepared.reason],
        byteIdentical: false,
        preservesUnsupportedBytes: false,
        willWriteBytes: false,
      };
    }
  }

  if (hasParserLoss(document)) {
    return {
      ok: false,
      code: "JWW_NATIVE_LOSSY_SAVE_BLOCKED",
      strategy: "blocked",
      reasons: [
        "Unsupported, skipped, or unparsed regions require byte-identical save or source-spanned same-class replacements",
      ],
      byteIdentical: false,
      preservesUnsupportedBytes: false,
      willWriteBytes: false,
    };
  }

  if (strict === false) {
    return {
      ok: false,
      code: "JWW_NATIVE_STRICT_SAVE_REQUIRED",
      strategy: "blocked",
      reasons: ["Native JWW rebuilds cannot disable loss-prevention checks"],
      byteIdentical: false,
      preservesUnsupportedBytes: true,
      willWriteBytes: false,
    };
  }

  const writerPreflight = preflightJwwWrite(
    nativeRebuildWriteOptions(document, revised, imageRotationRecordIdSet)
  );
  if (!writerPreflight.ok) {
    return {
      ok: false,
      code: "JWW_NATIVE_UNSUPPORTED_CHANGE",
      strategy: "blocked",
      reasons: writerPreflight.reasons,
      byteIdentical: false,
      preservesUnsupportedBytes: true,
      willWriteBytes: false,
      writerPreflight,
    };
  }

  return {
    ok: true,
    code: null,
    strategy: "rebuild",
    reasons: [],
    byteIdentical: false,
    preservesUnsupportedBytes: true,
    strict: true,
    recordsWritten: writerPreflight.recordsWritten,
    blockDefinitionsWritten: writerPreflight.blockDefinitionsWritten,
    embeddedImagesWritten: writerPreflight.embeddedImagesWritten,
    imageRotationRecordIds,
    imageRotationApproved: Boolean(
      imageRotationRecordIds.length && allowImageRotation
    ),
    willWriteBytes: true,
  };
}

function rebaseSavedNativeDocument(bytes, sourceDocument, revisedDocument) {
  const savedBytes = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
  const parseOptions = retainNativeParseOptions(sourceDocument.parseOptions || {});
  const parsed = parse(savedBytes, parseOptions);
  return buildNativeDocument(
    savedBytes,
    sha256HexSync(savedBytes),
    parsed,
    parseOptions,
    {
      revision: Number(revisedDocument.revision || 0),
      dirty: false,
    }
  );
}

function savedRecordIdTransition(sourceDocument, revisedDocument, savedDocument) {
  const revisedRecords = revisedDocument.nativeEntities || [];
  const savedRecords = savedDocument.nativeEntities || [];
  if (revisedRecords.length !== savedRecords.length) {
    const error = new Error(
      `Saved JWW record count changed during reparse: ${revisedRecords.length} -> ${savedRecords.length}`
    );
    error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
    throw error;
  }

  const revisedAllRecords = allNativeRecords(revisedDocument);
  const revisedIds = new Set(revisedAllRecords.map((record) => record.id));
  if (revisedIds.size !== revisedAllRecords.length) {
    const error = new Error("Saved JWW rebase received duplicate native record IDs");
    error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
    throw error;
  }

  const recordIdMap = {};
  const mapChangedId = (previous, saved) => {
    if (previous.id === saved.id) return;
    Object.defineProperty(recordIdMap, previous.id, {
      value: saved.id,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  };
  for (let index = 0; index < revisedRecords.length; index += 1) {
    const previous = revisedRecords[index];
    const saved = savedRecords[index];
    if (previous.kind !== saved.kind) {
      const error = new Error(
        `Saved JWW record kind changed during reparse at index ${index}: ${previous.kind} -> ${saved.kind}`
      );
      error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
      throw error;
    }
    mapChangedId(previous, saved);
  }

  const revisedDefinitions = revisedDocument.blockDefinitions || [];
  const savedDefinitions = savedDocument.blockDefinitions || [];
  if (revisedDefinitions.length !== savedDefinitions.length) {
    const error = new Error(
      `Saved JWW block definition count changed during reparse: ${revisedDefinitions.length} -> ${savedDefinitions.length}`
    );
    error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
    throw error;
  }
  for (let index = 0; index < revisedDefinitions.length; index += 1) {
    const previous = revisedDefinitions[index];
    const saved = savedDefinitions[index];
    if (Number(previous.value?.number) !== Number(saved.value?.number)) {
      const error = new Error(
        `Saved JWW block definition number changed during reparse at index ${index}`
      );
      error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
      throw error;
    }
    mapChangedId(previous, saved);
    const previousEntities = previous.value?.entities || [];
    const savedEntities = saved.value?.entities || [];
    if (previousEntities.length !== savedEntities.length) {
      const error = new Error(
        `Saved JWW nested block record count changed during reparse at index ${index}: ${previousEntities.length} -> ${savedEntities.length}`
      );
      error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
      throw error;
    }
    for (let entityIndex = 0; entityIndex < previousEntities.length; entityIndex += 1) {
      if (previousEntities[entityIndex].kind !== savedEntities[entityIndex].kind) {
        const error = new Error(
          `Saved JWW nested block record kind changed during reparse at ${index}:${entityIndex}`
        );
        error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
        throw error;
      }
      mapChangedId(previousEntities[entityIndex], savedEntities[entityIndex]);
    }
  }

  const revisedImages = revisedDocument.embeddedImages || [];
  const savedImages = savedDocument.embeddedImages || [];
  if (revisedImages.length !== savedImages.length) {
    const error = new Error(
      `Saved JWW embedded image count changed during reparse: ${revisedImages.length} -> ${savedImages.length}`
    );
    error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
    throw error;
  }
  for (let index = 0; index < revisedImages.length; index += 1) {
    const previous = revisedImages[index];
    const saved = savedImages[index];
    if (previous.fileName !== saved.fileName) {
      const error = new Error(
        `Saved JWW embedded image name changed during reparse at index ${index}`
      );
      error.code = "JWW_NATIVE_SAVE_REBASE_MISMATCH";
      throw error;
    }
    mapChangedId(previous, saved);
  }

  const deletedRecordIdSet = new Set(revisedDocument.pendingDeletedRecordIds || []);
  for (const record of allNativeRecords(sourceDocument)) {
    if (!revisedIds.has(record.id)) deletedRecordIdSet.add(record.id);
  }
  const deletedRecordIds = [...deletedRecordIdSet];
  return {
    recordIdMap,
    deletedRecordIds,
    recordIdsChanged:
      Object.keys(recordIdMap).length > 0 || deletedRecordIds.length > 0,
  };
}

export function saveNativeJww(
  document,
  { patches = [], strict = true, allowImageRotation = false } = {}
) {
  if (document?.kind !== JWW_NATIVE_DOCUMENT_KIND) {
    throw new TypeError("Expected a JwwNativeDocument");
  }
  const preflight = preflightNativeJwwSave(document, {
    patches,
    strict,
    allowImageRotation,
  });
  if (!preflight.ok) {
    const error = new Error(preflight.reasons.join("; "));
    error.code = preflight.code;
    error.preflight = preflight;
    throw error;
  }
  if (preflight.strategy === "byte-identical") {
    return {
      bytes: Uint8Array.from(document.originalBytes),
      byteIdentical: true,
      originalSha256: document.originalSha256,
      savedSha256: document.originalSha256,
      document,
      recordIdMap: {},
      deletedRecordIds: [],
      recordIdsChanged: false,
      strategy: preflight.strategy,
      preflight,
    };
  }
  const revised = applyNativeJwwPatches(document, patches);
  const imageRotationRecordIdSet = new Set(preflight.imageRotationRecordIds || []);
  if (
    preflight.strategy === "record-splice" ||
    preflight.strategy === "prefix-splice"
  ) {
    const prepared = prepareNativeSourceSplices(
      document,
      revised,
      preflight.replacementRecordIds || [],
      preflight.prefixMetadataTargetIds || [],
      imageRotationRecordIdSet
    );
    let bytes = Uint8Array.from(document.originalBytes);
    for (const replacement of prepared.replacements
      .slice()
      .sort((left, right) => right.start - left.start)) {
      bytes = spliceBytes(bytes, replacement.start, replacement.end, replacement.bytes);
    }
    const savedDocument = rebaseSavedNativeDocument(bytes, document, revised);
    const recordReplacements = prepared.replacements.filter(
      (replacement) => replacement.className
    );
    assertRecordReplacementEffects(bytes, savedDocument, recordReplacements);
    assertPrefixMetadataEffects(
      savedDocument,
      revised,
      preflight.prefixMetadataTargetIds || []
    );
    return {
      bytes,
      byteIdentical: false,
      originalSha256: document.originalSha256,
      savedSha256: savedDocument.originalSha256,
      document: savedDocument,
      recordIdMap: {},
      deletedRecordIds: [],
      recordIdsChanged: false,
      strategy: preflight.strategy,
      recordsWritten: recordReplacements.length,
      prefixMetadataUpdated: prepared.prefixMetadataUpdated,
      unsupportedEntities: [],
      blockDefinitionsWritten: 0,
      embeddedImagesWritten: 0,
      usedTemplatePrefix: true,
      preflight,
    };
  }
  const result = buildJwwWriteResult(
    nativeRebuildWriteOptions(document, revised, imageRotationRecordIdSet)
  );
  const trailing = document.preservedRegions?.trailing;
  const trailingBytes = trailing?.byteLength
    ? document.originalBytes.slice(trailing.start, trailing.end)
    : null;
  const bytes = concatBytes(result.bytes, trailingBytes);
  const savedDocument = rebaseSavedNativeDocument(bytes, document, revised);
  const recordIdTransition = savedRecordIdTransition(
    document,
    revised,
    savedDocument
  );
  return {
    ...result,
    bytes,
    byteIdentical: false,
    originalSha256: document.originalSha256,
    savedSha256: savedDocument.originalSha256,
    document: savedDocument,
    ...recordIdTransition,
    strategy: preflight.strategy,
    preflight,
  };
}
