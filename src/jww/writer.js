import { getDefaultJwwSaveTemplatePrefix } from "./defaultJwwSaveTemplatePrefix.js";
import { parse } from "./parser.js";

const JWW_HEADER = [0x4a, 0x77, 0x77, 0x44, 0x61, 0x74, 0x61, 0x2e];
const DEFAULT_JWW_VERSION = 700;
const JWW_DEFAULT_MEMO = String.fromCharCode(13, 10);
const JWW_PAPER_CODES = new Set([0, 1, 2, 3, 4, 8, 9, 10, 11, 12, 13, 14]);

export const JWW_WRITE_VERSIONS = Object.freeze([600, 700]);

function isTemporaryPointEntity(item) {
  return Boolean(
    item &&
      (item.temporaryPoint ||
        item.isTemporaryPoint ||
        item.entity?.temporaryPoint ||
        item.entity?.isTemporaryPoint)
  );
}

class BinaryWriter {
  constructor(initialBytes = []) {
    this.bytes = Array.from(initialBytes, (value) => Number(value) & 0xff);
  }

  byte(value) {
    this.bytes.push(Number(value) & 0xff);
  }

  word(value) {
    const number = Number(value) || 0;
    this.bytes.push(number & 0xff, (number >>> 8) & 0xff);
  }

  dword(value) {
    const number = Number(value) || 0;
    this.bytes.push(
      number & 0xff,
      (number >>> 8) & 0xff,
      (number >>> 16) & 0xff,
      (number >>> 24) & 0xff
    );
  }

  double(value) {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(
      0,
      Number.isFinite(Number(value)) ? Number(value) : 0,
      true
    );
    this.bytes.push(...new Uint8Array(buffer));
  }

  ascii(value) {
    for (const char of String(value || "")) this.byte(char.charCodeAt(0));
  }

  raw(value) {
    for (const byte of value || []) this.byte(byte);
  }

  utf16String(value) {
    const text = String(value || "");
    if (!text) {
      this.byte(0);
      return;
    }
    const charLength = text.length;
    if (charLength > 500000) {
      throw new Error(`Unsupported JWW UTF-16 string length: ${charLength}`);
    }
    this.byte(255);
    this.word(0xfffe);
    if (charLength < 255) {
      this.byte(charLength);
    } else {
      this.byte(255);
      if (charLength < 0xffff) {
        this.word(charLength);
      } else {
        this.word(0xffff);
        this.dword(charLength);
      }
    }
    for (let index = 0; index < charLength; index += 1) {
      this.word(text.charCodeAt(index));
    }
  }

  toUint8Array() {
    return Uint8Array.from(this.bytes);
  }
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function degreesToRadians(value) {
  return finiteNumber(value, 0) * (Math.PI / 180);
}

function angleDifferenceDegrees(left, right) {
  return Math.abs(((Number(left) - Number(right) + 180) % 360 + 360) % 360 - 180);
}

function normalizedEmbeddedImageName(value) {
  return String(value || "")
    .replace(/^%temp%/i, "")
    .replace(/\\/g, "/")
    .replace(/\.gz$/i, "")
    .toLowerCase();
}

const JWW_IMAGE_NUMBER_SOURCE =
  "[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?";
const JWW_IMAGE_REFERENCE_PATTERN = new RegExp(
  `^(\\^@BM)(%temp%)?(.+?)(,\\s*(${JWW_IMAGE_NUMBER_SOURCE})\\s*,\\s*(${JWW_IMAGE_NUMBER_SOURCE}))((?:\\s*,.*)?)$`,
  "i"
);

function canonicalJwwImageAngle(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`JWW IMAGE rotation must be finite; received ${value}`);
  }
  return Object.is(number, -0) ? "0" : String(number);
}

export function parseJwwImageReferenceText(value) {
  const text = String(value || "");
  const match = JWW_IMAGE_REFERENCE_PATTERN.exec(text);
  if (!match) return null;
  const suffix = match[7] || "";
  const suffixFields = suffix
    ? suffix.replace(/^\s*,/, "").split(",")
    : [];
  const rotationValue = suffixFields.length >= 4 ? Number(suffixFields[3].trim()) : null;
  return {
    text,
    embedded: Boolean(match[2]),
    fileName: match[3],
    width: Number(match[5]),
    height: Number(match[6]),
    prefix: `${match[1]}${match[2] || ""}${match[3]}${match[4]}`,
    suffix,
    suffixFields,
    hasRotationField: suffixFields.length >= 4 && Number.isFinite(rotationValue),
    rotation: Number.isFinite(rotationValue) ? rotationValue : null,
  };
}

export function setJwwImageReferenceRotation(value, rotation) {
  const parsed = parseJwwImageReferenceText(value);
  if (!parsed) {
    throw new Error("JWW IMAGE reference text is not safely parseable");
  }
  const angleText = canonicalJwwImageAngle(rotation);
  const angle = Number(angleText);
  if (!parsed.suffixFields.length) {
    return Math.abs(angle) <= 1e-12
      ? parsed.text
      : `${parsed.prefix},0,0,1,${angleText}`;
  }
  if (parsed.suffixFields.length < 4) {
    throw new Error(
      "JWW IMAGE reference suffix is incomplete; rotation requires four transform fields"
    );
  }
  const transformValues = parsed.suffixFields.slice(0, 4).map((field) =>
    Number(field.trim())
  );
  if (transformValues.some((field) => !Number.isFinite(field))) {
    throw new Error("JWW IMAGE reference transform fields must be finite numbers");
  }
  if (Math.abs(transformValues[3] - angle) <= 1e-12) return parsed.text;
  const previous = parsed.suffixFields[3];
  const leading = previous.match(/^\s*/)?.[0] || "";
  const trailing = previous.match(/\s*$/)?.[0] || "";
  const fields = parsed.suffixFields.slice();
  fields[3] = `${leading}${angleText}${trailing}`;
  const separator = parsed.suffix.match(/^\s*,/)?.[0] || ",";
  return `${parsed.prefix}${separator}${fields.join(",")}`;
}

function embeddedImageNameSet(images = []) {
  return new Set(
    images
      .map((image) =>
        normalizedEmbeddedImageName(
          image?.fileName || image?.file_name || image?.name || ""
        )
      )
      .filter(Boolean)
  );
}

function imageReferenceText(
  entity,
  fileName,
  width,
  height,
  embeddedImageNames,
  { rotation = 0, rewriteRotation = false } = {}
) {
  const original = String(
    entity.jwwImageText || `^@BM${fileName},${width},${height}`
  );
  const parsed = parseJwwImageReferenceText(original);
  const referenceName = parsed?.fileName || fileName;
  const isEmbedded =
    embeddedImageNames?.has(normalizedEmbeddedImageName(fileName)) ||
    embeddedImageNames?.has(normalizedEmbeddedImageName(referenceName));
  let text = original;
  if (isEmbedded && parsed && !parsed.embedded) {
    text = original.replace(/^(\^@BM)/i, "$1%temp%");
  }
  return rewriteRotation ? setJwwImageReferenceRotation(text, rotation) : text;
}

function readWordAt(bytes, offset) {
  if (offset < 0 || offset + 2 > bytes.length) {
    throw new Error("JWW template prefix ended while reading a word");
  }
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readDwordAt(bytes, offset) {
  if (offset < 0 || offset + 4 > bytes.length) {
    throw new Error("JWW template prefix ended while reading a dword");
  }
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function writeDwordAt(bytes, offset, value) {
  const number = Number(value) >>> 0;
  bytes[offset] = number & 0xff;
  bytes[offset + 1] = (number >>> 8) & 0xff;
  bytes[offset + 2] = (number >>> 16) & 0xff;
  bytes[offset + 3] = (number >>> 24) & 0xff;
}

function writeDoubleAt(bytes, offset, value) {
  if (offset < 0 || offset + 8 > bytes.length) {
    throw new Error("JWW template prefix ended while writing a double");
  }
  new DataView(bytes.buffer, bytes.byteOffset + offset, 8).setFloat64(
    0,
    value,
    true
  );
}

function readExtendedStringLength(bytes, offset) {
  const byteLength = bytes[offset];
  if (byteLength === undefined) {
    throw new Error("JWW template prefix ended while reading a string length");
  }
  if (byteLength !== 0xff) return { length: byteLength, nextOffset: offset + 1 };
  const wordLength = readWordAt(bytes, offset + 1);
  if (wordLength !== 0xffff) {
    return { length: wordLength, nextOffset: offset + 3 };
  }
  return { length: readDwordAt(bytes, offset + 3), nextOffset: offset + 7 };
}

function serializedStringEnd(bytes, offset) {
  const byteLength = bytes[offset];
  if (byteLength === undefined) {
    throw new Error("JWW template prefix ended before the memo");
  }
  if (byteLength !== 0xff) return offset + 1 + byteLength;

  const wordLength = readWordAt(bytes, offset + 1);
  if (wordLength === 0xfffe || wordLength === 0xfeff) {
    const extended = readExtendedStringLength(bytes, offset + 3);
    return extended.nextOffset + extended.length * 2;
  }
  if (wordLength !== 0xffff) return offset + 3 + wordLength;
  return offset + 7 + readDwordAt(bytes, offset + 3);
}

function normalizePaperCode(value) {
  if (value === null || value === undefined || value === "") return null;
  const code = Number(value);
  if (!Number.isInteger(code) || !JWW_PAPER_CODES.has(code)) {
    throw new Error(`Unsupported JWW paper size code: ${value}`);
  }
  return code;
}

function patchTemplatePaperSize(templatePrefix, paperSize) {
  const code = normalizePaperCode(paperSize);
  if (code === null) return templatePrefix;
  const bytes = templatePrefix.slice();
  const memoOffset = JWW_HEADER.length + 4;
  const paperOffset = serializedStringEnd(bytes, memoOffset);
  if (paperOffset + 4 > bytes.length) {
    throw new Error("JWW template prefix ended before the paper size field");
  }
  writeDwordAt(bytes, paperOffset, code);
  return bytes;
}

function patchTemplateWriteLayerGroup(templatePrefix, writeLayerGroup) {
  if (
    writeLayerGroup === null ||
    writeLayerGroup === undefined ||
    writeLayerGroup === ""
  ) {
    return templatePrefix;
  }
  const group = Number(writeLayerGroup);
  if (!Number.isInteger(group) || group < 0 || group > 15) {
    throw new Error(`Unsupported JWW write layer group: ${writeLayerGroup}`);
  }
  const bytes = templatePrefix.slice();
  const memoOffset = JWW_HEADER.length + 4;
  const paperOffset = serializedStringEnd(bytes, memoOffset);
  const writeLayerGroupOffset = paperOffset + 4;
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  if (
    writeLayerGroupOffset + 4 > bytes.length ||
    layerGroupsOffset + 16 * layerGroupStride > bytes.length
  ) {
    throw new Error("JWW template prefix ended before the write layer group field");
  }
  const previousGroup = readDwordAt(bytes, writeLayerGroupOffset);
  if (!Number.isInteger(previousGroup) || previousGroup < 0 || previousGroup > 15) {
    throw new Error(`Unsupported existing JWW write layer group: ${previousGroup}`);
  }
  if (previousGroup !== group) {
    const previousGroupOffset = layerGroupsOffset + previousGroup * layerGroupStride;
    const selectedGroupOffset = layerGroupsOffset + group * layerGroupStride;
    const previousState = readDwordAt(bytes, previousGroupOffset);
    const selectedState = readDwordAt(bytes, selectedGroupOffset);
    const selectedProtect = readDwordAt(bytes, selectedGroupOffset + 16);
    if (previousState !== 3) {
      throw new Error(
        `Existing JWW write layer group ${previousGroup} must have state 3; received ${previousState}`
      );
    }
    if (![0, 1, 2, 3].includes(selectedState)) {
      throw new Error(
        `JWW write layer group transition from state ${selectedState} is not verified: ${group}`
      );
    }
    if (selectedProtect !== 0) {
      throw new Error(`Protected JWW layer group cannot become the write group: ${group}`);
    }
    writeDwordAt(bytes, previousGroupOffset, 2);
    writeDwordAt(bytes, selectedGroupOffset, 3);
  }
  writeDwordAt(bytes, writeLayerGroupOffset, group);
  return bytes;
}

function layerGroupIndex(value) {
  const key = String(value ?? "").trim().toUpperCase();
  if (!/^[0-9A-F]$/.test(key)) return null;
  return Number.parseInt(key, 16);
}

function scaleDenominator(value) {
  if (value === null || value === undefined || value === "") return null;
  const match = String(value).trim().match(/^1\s*\/\s*(\d+(?:\.\d+)?)$/);
  const denominator = Number(match ? match[1] : value);
  if (!Number.isFinite(denominator) || denominator <= 0) {
    throw new Error(`Unsupported JWW layer group scale: ${value}`);
  }
  return denominator;
}

function normalizeLayerGroupScales(value) {
  if (value === null || value === undefined) return null;
  const scales = Array(16).fill(null);
  if (Array.isArray(value)) {
    value.slice(0, 16).forEach((item, index) => {
      scales[index] = scaleDenominator(item);
    });
    return scales;
  }
  if (typeof value !== "object") {
    throw new Error("JWW layer group scales must be an array or object");
  }
  Object.entries(value).forEach(([key, item]) => {
    const index = layerGroupIndex(key);
    if (index !== null) scales[index] = scaleDenominator(item);
  });
  return scales;
}

function writeLayerNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const layer = Number(value);
  if (!Number.isInteger(layer) || layer < 0 || layer > 15) {
    throw new Error(`Unsupported JWW write layer: ${value}`);
  }
  return layer;
}

function normalizeLayerGroupWriteLayers(value) {
  if (value === null || value === undefined) return null;
  const writeLayers = Array(16).fill(null);
  if (Array.isArray(value)) {
    value.slice(0, 16).forEach((item, index) => {
      writeLayers[index] = writeLayerNumber(item);
    });
    return writeLayers;
  }
  if (typeof value !== "object") {
    throw new Error("JWW layer group write layers must be an array or object");
  }
  Object.entries(value).forEach(([key, item]) => {
    const index = layerGroupIndex(key);
    if (index !== null) writeLayers[index] = writeLayerNumber(item);
  });
  return writeLayers;
}

function patchTemplateLayerGroupScales(templatePrefix, layerGroupScales) {
  const scales = normalizeLayerGroupScales(layerGroupScales);
  if (!scales) return templatePrefix;
  const bytes = templatePrefix.slice();
  const memoOffset = JWW_HEADER.length + 4;
  const paperOffset = serializedStringEnd(bytes, memoOffset);
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  scales.forEach((denominator, groupIndex) => {
    if (denominator === null) return;
    writeDoubleAt(
      bytes,
      layerGroupsOffset + groupIndex * layerGroupStride + 8,
      denominator
    );
  });
  return bytes;
}

function patchTemplateLayerGroupWriteLayers(
  templatePrefix,
  layerGroupWriteLayers
) {
  const writeLayers = normalizeLayerGroupWriteLayers(layerGroupWriteLayers);
  if (!writeLayers) return templatePrefix;
  const bytes = templatePrefix.slice();
  const memoOffset = JWW_HEADER.length + 4;
  const paperOffset = serializedStringEnd(bytes, memoOffset);
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  writeLayers.forEach((writeLayer, groupIndex) => {
    if (writeLayer === null) return;
    const groupOffset = layerGroupsOffset + groupIndex * layerGroupStride;
    const layersOffset = groupOffset + 20;
    if (layersOffset + 16 * 8 > bytes.length) {
      throw new Error(
        `JWW template prefix ended before layer group ${groupIndex}`
      );
    }
    const previousWriteLayer = readDwordAt(bytes, groupOffset + 4);
    if (writeLayer !== previousWriteLayer) {
      if (previousWriteLayer < 0 || previousWriteLayer > 15) {
        throw new Error(
          `Existing JWW write layer is invalid: ${groupIndex}.${previousWriteLayer}`
        );
      }
      const previousState = readDwordAt(
        bytes,
        layersOffset + previousWriteLayer * 8
      );
      if (previousState !== 3) {
        throw new Error(
          `Existing JWW write layer must have state 3: ${groupIndex}.${previousWriteLayer}`
        );
      }
      const selectedState = readDwordAt(bytes, layersOffset + writeLayer * 8);
      if (![0, 1, 2, 3].includes(selectedState)) {
        throw new Error(
          `JWW write layer transition from state ${selectedState} is not verified: ${groupIndex}.${writeLayer}`
        );
      }
      writeDwordAt(bytes, layersOffset + previousWriteLayer * 8, 2);
    }
    writeDwordAt(bytes, groupOffset + 4, writeLayer);
    writeDwordAt(bytes, layersOffset + writeLayer * 8, 3);
  });
  return bytes;
}

function layerStateCode(value) {
  if (value === null || value === undefined || value === "") return null;
  const state = Number(value);
  if (!Number.isInteger(state) || state < 0 || state > 3) {
    throw new Error(`Unsupported JWW layer state: ${value}`);
  }
  return state;
}

function layerProtectionCode(value) {
  if (value === null || value === undefined || value === "") return null;
  const protect = Number(value);
  if (!Number.isInteger(protect) || protect < 0 || protect > 2) {
    throw new Error(`Unsupported JWW layer protection: ${value}`);
  }
  return protect;
}

function normalizeLayerGroupStates(value) {
  if (value === null || value === undefined) return null;
  const states = Array(16).fill(null);
  if (Array.isArray(value)) {
    value.slice(0, 16).forEach((item, index) => {
      states[index] = layerStateCode(item);
    });
    return states;
  }
  if (typeof value !== "object") {
    throw new Error("JWW layer group states must be an array or object");
  }
  Object.entries(value).forEach(([key, item]) => {
    const index = layerGroupIndex(key);
    if (index !== null) states[index] = layerStateCode(item);
  });
  return states;
}

function normalizedLayerCoordinate(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (/^(?:[0-9]|1[0-5])$/.test(text)) return Number(text);
  if (/^[A-F]$/.test(text)) return Number.parseInt(text, 16);
  return null;
}

function normalizeLayerStates(value) {
  if (value === null || value === undefined) return null;
  const states = Array.from({ length: 16 }, () => Array(16).fill(null));
  if (Array.isArray(value)) {
    value.slice(0, 16).forEach((row, groupIndex) => {
      if (row === null || row === undefined) return;
      if (!Array.isArray(row) && typeof row !== "object") {
        throw new Error(`JWW layer states row must be an array or object: ${groupIndex}`);
      }
      Object.entries(row).forEach(([key, item]) => {
        const layerIndex = normalizedLayerCoordinate(key);
        if (layerIndex !== null) states[groupIndex][layerIndex] = layerStateCode(item);
      });
    });
    return states;
  }
  if (typeof value !== "object") {
    throw new Error("JWW layer states must be an array or object");
  }
  Object.entries(value).forEach(([key, item]) => {
    const match = key.match(/^([0-9A-F]+)\.([0-9A-F]+)$/i);
    if (!match) return;
    const groupIndex = normalizedLayerCoordinate(match[1]);
    const layerIndex = normalizedLayerCoordinate(match[2]);
    if (groupIndex !== null && layerIndex !== null) {
      states[groupIndex][layerIndex] = layerStateCode(item);
    }
  });
  return states;
}

function normalizeLayerGroupProtections(value) {
  if (value === null || value === undefined) return null;
  const protections = Array(16).fill(null);
  if (Array.isArray(value)) {
    value.slice(0, 16).forEach((item, index) => {
      protections[index] = layerProtectionCode(item);
    });
    return protections;
  }
  if (typeof value !== "object") {
    throw new Error("JWW layer group protections must be an array or object");
  }
  Object.entries(value).forEach(([key, item]) => {
    const index = layerGroupIndex(key);
    if (index !== null) protections[index] = layerProtectionCode(item);
  });
  return protections;
}

function normalizeLayerProtections(value) {
  if (value === null || value === undefined) return null;
  const protections = Array.from({ length: 16 }, () => Array(16).fill(null));
  if (Array.isArray(value)) {
    value.slice(0, 16).forEach((row, groupIndex) => {
      if (row === null || row === undefined) return;
      if (!Array.isArray(row) && typeof row !== "object") {
        throw new Error(
          `JWW layer protections row must be an array or object: ${groupIndex}`
        );
      }
      Object.entries(row).forEach(([key, item]) => {
        const layerIndex = normalizedLayerCoordinate(key);
        if (layerIndex !== null) {
          protections[groupIndex][layerIndex] = layerProtectionCode(item);
        }
      });
    });
    return protections;
  }
  if (typeof value !== "object") {
    throw new Error("JWW layer protections must be an array or object");
  }
  Object.entries(value).forEach(([key, item]) => {
    const match = key.match(/^([0-9A-F]+)\.([0-9A-F]+)$/i);
    if (!match) return;
    const groupIndex = normalizedLayerCoordinate(match[1]);
    const layerIndex = normalizedLayerCoordinate(match[2]);
    if (groupIndex !== null && layerIndex !== null) {
      protections[groupIndex][layerIndex] = layerProtectionCode(item);
    }
  });
  return protections;
}

function patchTemplateLayerGroupProtections(
  templatePrefix,
  layerGroupProtections
) {
  const protections = normalizeLayerGroupProtections(layerGroupProtections);
  if (!protections) return templatePrefix;
  const bytes = templatePrefix.slice();
  const memoOffset = JWW_HEADER.length + 4;
  const paperOffset = serializedStringEnd(bytes, memoOffset);
  const writeLayerGroup = readDwordAt(bytes, paperOffset + 4);
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  protections.forEach((protect, groupIndex) => {
    if (protect === null) return;
    const groupOffset = layerGroupsOffset + groupIndex * layerGroupStride;
    if (groupOffset + layerGroupStride > bytes.length) {
      throw new Error(`JWW template prefix ended before layer group ${groupIndex}`);
    }
    const previousProtect = readDwordAt(bytes, groupOffset + 16);
    if (protect === previousProtect) return;
    if (groupIndex === writeLayerGroup && protect !== 0) {
      throw new Error(
        `Current JWW layer group cannot be protected: ${groupIndex}`
      );
    }
    writeDwordAt(bytes, groupOffset + 16, protect);
  });
  return bytes;
}

function patchTemplateLayerProtections(templatePrefix, layerProtections) {
  const protections = normalizeLayerProtections(layerProtections);
  if (!protections) return templatePrefix;
  const bytes = templatePrefix.slice();
  const memoOffset = JWW_HEADER.length + 4;
  const paperOffset = serializedStringEnd(bytes, memoOffset);
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  protections.forEach((row, groupIndex) => {
    const groupOffset = layerGroupsOffset + groupIndex * layerGroupStride;
    const layersOffset = groupOffset + 20;
    if (layersOffset + 16 * 8 > bytes.length) {
      throw new Error(`JWW template prefix ended before layer group ${groupIndex}`);
    }
    const writeLayer = readDwordAt(bytes, groupOffset + 4);
    row.forEach((protect, layerIndex) => {
      if (protect === null) return;
      const layerOffset = layersOffset + layerIndex * 8;
      const previousProtect = readDwordAt(bytes, layerOffset + 4);
      if (protect === previousProtect) return;
      if (layerIndex === writeLayer && protect !== 0) {
        throw new Error(
          `Current JWW layer cannot be protected: ${groupIndex}.${layerIndex}`
        );
      }
      writeDwordAt(bytes, layerOffset + 4, protect);
    });
  });
  return bytes;
}

function patchTemplateLayerGroupStates(templatePrefix, layerGroupStates) {
  const states = normalizeLayerGroupStates(layerGroupStates);
  if (!states) return templatePrefix;
  const bytes = templatePrefix.slice();
  const memoOffset = JWW_HEADER.length + 4;
  const paperOffset = serializedStringEnd(bytes, memoOffset);
  const writeLayerGroup = readDwordAt(bytes, paperOffset + 4);
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  states.forEach((state, groupIndex) => {
    if (state === null) return;
    const groupOffset = layerGroupsOffset + groupIndex * layerGroupStride;
    if (groupOffset + layerGroupStride > bytes.length) {
      throw new Error(`JWW template prefix ended before layer group ${groupIndex}`);
    }
    const previousState = readDwordAt(bytes, groupOffset);
    if (state === previousState) return;
    if (groupIndex === writeLayerGroup ? state !== 3 : state === 3) {
      throw new Error(
        groupIndex === writeLayerGroup
          ? `Current JWW layer group must retain state 3: ${groupIndex}`
          : `Non-current JWW layer group cannot use state 3: ${groupIndex}`
      );
    }
    if (readDwordAt(bytes, groupOffset + 16) === 2) {
      throw new Error(`Display-fixed JWW layer group state cannot be changed: ${groupIndex}`);
    }
    writeDwordAt(bytes, groupOffset, state);
  });
  return bytes;
}

function patchTemplateLayerStates(templatePrefix, layerStates) {
  const states = normalizeLayerStates(layerStates);
  if (!states) return templatePrefix;
  const bytes = templatePrefix.slice();
  const memoOffset = JWW_HEADER.length + 4;
  const paperOffset = serializedStringEnd(bytes, memoOffset);
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  states.forEach((row, groupIndex) => {
    const groupOffset = layerGroupsOffset + groupIndex * layerGroupStride;
    const layersOffset = groupOffset + 20;
    if (layersOffset + 16 * 8 > bytes.length) {
      throw new Error(`JWW template prefix ended before layer group ${groupIndex}`);
    }
    const writeLayer = readDwordAt(bytes, groupOffset + 4);
    row.forEach((state, layerIndex) => {
      if (state === null) return;
      const layerOffset = layersOffset + layerIndex * 8;
      const previousState = readDwordAt(bytes, layerOffset);
      if (state === previousState) return;
      if (layerIndex === writeLayer ? state !== 3 : state === 3) {
        throw new Error(
          layerIndex === writeLayer
            ? `Current JWW layer must retain state 3: ${groupIndex}.${layerIndex}`
            : `Non-current JWW layer cannot use state 3: ${groupIndex}.${layerIndex}`
        );
      }
      if (readDwordAt(bytes, layerOffset + 4) === 2) {
        throw new Error(`Display-fixed JWW layer state cannot be changed: ${groupIndex}.${layerIndex}`);
      }
      writeDwordAt(bytes, layerOffset, state);
    });
  });
  return bytes;
}

export function patchJwwTemplatePrefixMetadata(
  templatePrefix,
  {
    paperSize = null,
    writeLayerGroup = null,
    layerGroupScales = null,
    layerGroupWriteLayers = null,
    layerGroupStates = null,
    layerStates = null,
    layerGroupProtections = null,
    layerProtections = null,
  } = {}
) {
  let bytes = Uint8Array.from(templatePrefix || []);
  bytes = patchTemplatePaperSize(bytes, paperSize);
  bytes = patchTemplateWriteLayerGroup(bytes, writeLayerGroup);
  bytes = patchTemplateLayerGroupScales(bytes, layerGroupScales);
  bytes = patchTemplateLayerGroupWriteLayers(bytes, layerGroupWriteLayers);
  bytes = patchTemplateLayerGroupProtections(bytes, layerGroupProtections);
  bytes = patchTemplateLayerProtections(bytes, layerProtections);
  bytes = patchTemplateLayerGroupStates(bytes, layerGroupStates);
  bytes = patchTemplateLayerStates(bytes, layerStates);
  return bytes;
}

function normalizeLayerNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number < 16
    ? number
    : fallback;
}

function defaultTemplateLayerSelection(entities = [], options = {}) {
  const usedLayers = new Map();
  for (const item of Array.isArray(entities) ? entities : []) {
    const base = jwwBase(item);
    const group = normalizeLayerNumber(base.layer_group);
    const layer = normalizeLayerNumber(base.layer);
    if (!usedLayers.has(group)) usedLayers.set(group, layer);
  }
  const firstUsedGroup = usedLayers.keys().next().value;
  const writeLayerGroup = normalizeLayerNumber(
    options.writeLayerGroup,
    firstUsedGroup ?? 0
  );
  const writeLayer = normalizeLayerNumber(
    options.writeLayer,
    usedLayers.get(writeLayerGroup) ?? 0
  );
  usedLayers.set(writeLayerGroup, writeLayer);
  return { usedLayers, writeLayerGroup };
}

function patchDefaultTemplateLayerState(templatePrefix, entities, options = {}) {
  const bytes = templatePrefix.slice();
  const memoOffset = JWW_HEADER.length + 4;
  const paperOffset = serializedStringEnd(bytes, memoOffset);
  const writeLayerGroupOffset = paperOffset + 4;
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  const { usedLayers, writeLayerGroup } = defaultTemplateLayerSelection(
    entities,
    options
  );
  writeDwordAt(bytes, writeLayerGroupOffset, writeLayerGroup);
  for (let group = 0; group < 16; group += 1) {
    const groupOffset = layerGroupsOffset + group * layerGroupStride;
    const writeLayer = usedLayers.get(group) ?? 0;
    writeDwordAt(bytes, groupOffset, group === writeLayerGroup ? 3 : 2);
    writeDwordAt(bytes, groupOffset + 4, writeLayer);
    writeDwordAt(bytes, groupOffset + 16, 0);
    const layersOffset = groupOffset + 20;
    for (let layer = 0; layer < 16; layer += 1) {
      const layerOffset = layersOffset + layer * 8;
      writeDwordAt(bytes, layerOffset, layer === writeLayer ? 3 : 2);
      writeDwordAt(bytes, layerOffset + 4, 0);
    }
  }
  return bytes;
}

function point(value, fallback = { x: 0, y: 0 }) {
  const safeFallback = fallback || { x: 0, y: 0 };
  if (!value || typeof value !== "object") return safeFallback;
  return {
    x: finiteNumber(value.x, safeFallback.x),
    y: finiteNumber(value.y, safeFallback.y),
  };
}

function itemType(item = {}) {
  return String(item.type || item.entity?.type || "").toUpperCase();
}

function itemEntity(item = {}) {
  return item.entity || item || {};
}

function jwwBase(item = {}) {
  const source = item.entity?.jww || item.jww || {};
  return {
    group: finiteNumber(source.group, 0),
    pen_style: finiteNumber(source.penStyle ?? source.pen_style, 1),
    pen_color: finiteNumber(source.penColor ?? source.pen_color ?? item.colorNumber, 2),
    pen_width: finiteNumber(source.penWidth ?? source.pen_width, 0),
    layer: finiteNumber(source.layer, 0),
    layer_group: finiteNumber(source.layerGroup ?? source.layer_group, 0),
    flag: finiteNumber(source.flag, 0),
  };
}

function normalizedBase(source = {}, fallback = {}) {
  return {
    group: finiteNumber(source.group, fallback.group || 0),
    pen_style: finiteNumber(
      source.penStyle ?? source.pen_style,
      fallback.pen_style || 1
    ),
    pen_color: finiteNumber(
      source.penColor ?? source.pen_color,
      fallback.pen_color || 2
    ),
    pen_width: finiteNumber(
      source.penWidth ?? source.pen_width,
      fallback.pen_width || 0
    ),
    layer: finiteNumber(source.layer, fallback.layer || 0),
    layer_group: finiteNumber(
      source.layerGroup ?? source.layer_group,
      fallback.layer_group || 0
    ),
    flag: finiteNumber(source.flag, fallback.flag || 0),
  };
}

function writeBase(writer, base) {
  writer.dword(base.group);
  writer.byte(base.pen_style);
  writer.word(base.pen_color);
  writer.word(base.pen_width);
  writer.word(base.layer);
  writer.word(base.layer_group);
  writer.word(base.flag);
}

function writeClassHeader(writer, className, classIds) {
  const existingId = classIds.get(className);
  if (existingId) {
    writer.word(0x8000 | existingId);
    classIds.nextId += 1;
    return;
  }

  writer.word(0xffff);
  writer.word(classIds.version);
  writer.word(className.length);
  writer.ascii(className);
  classIds.set(className, classIds.nextId);
  classIds.nextId += 2;
}

function lineEndpoints(item = {}) {
  const entity = item.entity || {};
  return {
    start: point(entity.start || entity.startPoint || entity.position),
    end: point(entity.end || entity.endPoint || entity.position),
  };
}

function transformPointForInsert(sourcePoint, insertEntity = {}, blockBase = { x: 0, y: 0 }) {
  const source = point(sourcePoint);
  const base = point(blockBase);
  const insert = point(insertEntity.position || insertEntity.insert || insertEntity.startPoint);
  const sx = finiteNumber(insertEntity.xScale ?? insertEntity.scaleX, 1) || 1;
  const sy = finiteNumber(insertEntity.yScale ?? insertEntity.scaleY, sx) || sx;
  const rotation =
    finiteNumber(insertEntity.rotation, 0) * (Math.PI / 180);
  const localX = (source.x - base.x) * sx;
  const localY = (source.y - base.y) * sy;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: insert.x + localX * cos - localY * sin,
    y: insert.y + localX * sin + localY * cos,
  };
}

function transformVectorForInsert(sourceVector, insertEntity = {}) {
  const source = point(sourceVector);
  const sx = finiteNumber(insertEntity.xScale ?? insertEntity.scaleX, 1) || 1;
  const sy = finiteNumber(insertEntity.yScale ?? insertEntity.scaleY, sx) || sx;
  const rotation = finiteNumber(insertEntity.rotation, 0) * (Math.PI / 180);
  const localX = source.x * sx;
  const localY = source.y * sy;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: localX * cos - localY * sin,
    y: localX * sin + localY * cos,
  };
}

function transformEntityForInsert(entity = {}, insertEntity = {}, blockBase = { x: 0, y: 0 }) {
  const transformPoint = (value) =>
    value && typeof value === "object"
      ? transformPointForInsert(value, insertEntity, blockBase)
      : value;
  const transformVector = (value) =>
    value && typeof value === "object"
      ? transformVectorForInsert(value, insertEntity)
      : value;
  const transformPoints = (values) =>
    Array.isArray(values) ? values.map(transformPoint) : values;
  return {
    ...entity,
    start: transformPoint(entity.start),
    end: transformPoint(entity.end),
    startPoint: transformPoint(entity.startPoint),
    endPoint: transformPoint(entity.endPoint),
    position: transformPoint(entity.position),
    insert: transformPoint(entity.insert),
    center: transformPoint(entity.center),
    majorAxisEndPoint: transformVector(entity.majorAxisEndPoint),
    majorAxis: transformVector(entity.majorAxis),
    majorAxisEndpoint: transformVector(entity.majorAxisEndpoint),
    vertices: transformPoints(entity.vertices),
    points: transformPoints(entity.points),
    fitPoints: transformPoints(entity.fitPoints),
    controlPoints: transformPoints(entity.controlPoints),
  };
}

function normalizeSweepAngle(value, fallback = Math.PI * 2) {
  const number = finiteNumber(value, fallback);
  if (!Number.isFinite(number) || number === 0) return fallback;
  return number;
}

function isFullSweep(value) {
  return Math.abs(Math.abs(value) - Math.PI * 2) < 1e-7;
}

function ellipseGeometry(entity = {}) {
  const majorAxis = point(
    entity.majorAxisEndPoint ||
      entity.majorAxis ||
      entity.majorAxisEndpoint ||
      entity.endPoint ||
      entity.end,
    { x: 0, y: 0 }
  );
  const explicitRadius = finiteNumber(
    entity.majorRadius ?? entity.radius ?? entity.r,
    NaN
  );
  const radius = Math.abs(
    Number.isFinite(explicitRadius)
      ? explicitRadius
      : Math.hypot(majorAxis.x, majorAxis.y)
  );
  const rotation = Number.isFinite(Number(entity.jwwTiltAngle))
    ? Number(entity.jwwTiltAngle)
    : Number.isFinite(Number(entity.rotation))
      ? Number(entity.rotation)
      : Number.isFinite(Number(entity.rotationDegrees))
        ? Number(entity.rotationDegrees) * (Math.PI / 180)
        : Math.atan2(majorAxis.y, majorAxis.x);
  const flatness = Math.abs(
    finiteNumber(
      entity.jwwFlatness ??
        entity.axisRatio ??
        entity.minorToMajorRatio ??
        entity.jwcFlatness,
      1
    )
  );
  const startAngle = finiteNumber(entity.jwwStartAngle ?? entity.startAngle, 0);
  const arcAngle = normalizeSweepAngle(
    entity.jwwArcAngle ??
      (finiteNumber(entity.endAngle, Math.PI * 2) -
        finiteNumber(entity.startAngle, 0)),
    Math.PI * 2
  );
  return {
    center: point(entity.center),
    radius,
    startAngle,
    arcAngle,
    tiltAngle: rotation,
    flatness,
    isFullCircle: isFullSweep(arcAngle),
  };
}

function polylineItems(item = {}) {
  const entity = itemEntity(item);
  const vertices = Array.isArray(entity.vertices)
    ? entity.vertices
    : Array.isArray(entity.points)
      ? entity.points
      : [];
  const out = [];
  for (let index = 1; index < vertices.length; index += 1) {
    out.push({
      ...item,
      type: "LINE",
      entity: {
        ...entity,
        type: "LINE",
        start: vertices[index - 1],
        end: vertices[index],
      },
    });
  }
  if ((entity.closed || entity.shape) && vertices.length > 2) {
    out.push({
      ...item,
      type: "LINE",
      entity: {
        ...entity,
        type: "LINE",
        start: vertices[vertices.length - 1],
        end: vertices[0],
      },
    });
  }
  return out;
}

function polygonPointsFromEntity(entity = {}) {
  const sources = [
    entity.jwwSourceVertices,
    entity.vertices,
    entity.points,
    entity.solidPolygons,
    entity.boundaryPaths,
  ];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    const first = source[0];
    const points = Array.isArray(first) ? first : source;
    const valid = points
      .map((point) => ({
        x: finiteNumber(point?.x, NaN),
        y: finiteNumber(point?.y, NaN),
      }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    if (valid.length >= 3) return valid;
  }
  const keyed = [entity.point1, entity.point2, entity.point3, entity.point4]
    .map((value) => point(value, null))
    .filter(Boolean);
  return keyed.length >= 3 ? keyed : [];
}

function solidRecordsFromPolygon(item, points) {
  const out = [];
  if (!Array.isArray(points) || points.length < 3) return out;
  for (let index = 1; index < points.length - 1; index += 1) {
    const triangle = [points[0], points[index], points[index + 1]];
    out.push({
      className: "CDataSolid",
      item,
      points: [triangle[0], triangle[1], triangle[2], triangle[2]],
    });
  }
  return out;
}

function dimensionBlockItems(item = {}, dxfMeta = {}) {
  const entity = itemEntity(item);
  const blockName = String(entity.block || item.blockName || "").trim();
  const block =
    dxfMeta?.blocks?.[blockName] ||
    dxfMeta?.blocks?.[blockName.toUpperCase?.()] ||
    null;
  const blockEntities = Array.isArray(block?.entities) ? block.entities : [];
  return blockEntities.map((blockEntity, blockIndex) => {
    const childLayer =
      String(blockEntity?.layer || "0") === "0"
        ? item.layer
        : blockEntity.layer || item.layer;
    return {
      ...item,
      id: `${item.id || "dimension"}::${blockIndex}`,
      type: String(blockEntity?.type || "UNKNOWN").toUpperCase(),
      layer: childLayer,
      colorNumber: blockEntity?.colorNumber ?? item.colorNumber,
      entity: {
        ...blockEntity,
        layer: childLayer,
        jww: blockEntity?.jww || entity.jww,
      },
    };
  });
}

function formatFallbackDimensionMeasurement(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Number(number.toFixed(6)).toString();
}

function dimensionFallbackTextItem(item = {}) {
  const entity = itemEntity(item);
  const rawText = String(
    entity.text ??
      entity.dimensionText ??
      entity.userText ??
      entity.value ??
      ""
  ).trim();
  const measurementText = formatFallbackDimensionMeasurement(
    entity.actualMeasurement ??
      entity.measurement ??
      entity.measuredValue ??
      entity.dimensionValue
  );
  const text =
    !rawText || rawText === "<>" || rawText === "\\X<>"
      ? measurementText
      : rawText.replace(/<>/g, measurementText);
  if (!text) return null;
  const start =
    point(
      entity.textMidPoint ||
        entity.textPosition ||
        entity.textPoint ||
        entity.middlePoint ||
        entity.position ||
        entity.defPoint ||
        entity.definitionPoint ||
        entity.startPoint,
      null
    ) || { x: 0, y: 0 };
  return {
    ...item,
    id: `${item.id || "dimension"}::fallback-text`,
    type: "TEXT",
    colorNumber: entity.textColorNumber ?? entity.colorNumber ?? item.colorNumber,
    entity: {
      type: "TEXT",
      layer: entity.layer || item.layer,
      jww: entity.jww,
      position: start,
      startPoint: start,
      text,
      paperTextWidth: entity.paperTextWidth ?? entity.textWidth ?? 2.5,
      paperTextHeight: entity.paperTextHeight ?? entity.textHeight ?? entity.height ?? 2.5,
      paperTextSpacing: entity.paperTextSpacing ?? entity.textSpacing ?? 0.5,
      rotation: finiteNumber(entity.textRotation ?? entity.rotation, 0),
      fontFamily: entity.fontFamily || "MS Gothic",
    },
  };
}

function insertBlockItems(item = {}, dxfMeta = {}) {
  const entity = itemEntity(item);
  const blockName = String(item.blockName || entity.name || "").trim();
  const block =
    dxfMeta?.blocks?.[blockName] ||
    dxfMeta?.blocks?.[blockName.toUpperCase?.()] ||
    null;
  const blockEntities = Array.isArray(block?.entities) ? block.entities : [];
  const blockBase = block?.position || block?.basePoint || block?.origin || { x: 0, y: 0 };
  return blockEntities.map((blockEntity, blockIndex) => {
    const childLayer =
      String(blockEntity?.layer || "0") === "0"
        ? item.layer
        : blockEntity.layer || item.layer;
    return {
      ...item,
      id: `${item.id || "insert"}::${blockIndex}`,
      type: String(blockEntity?.type || "UNKNOWN").toUpperCase(),
      layer: childLayer,
      colorNumber: blockEntity?.colorNumber ?? item.colorNumber,
      entity: {
        ...transformEntityForInsert(blockEntity, entity, blockBase),
        layer: childLayer,
        jww: blockEntity?.jww || entity.jww,
      },
    };
  });
}

function collectEntities(items = [], options = {}) {
  const out = [];
  const unsupported = options.unsupported || [];
  for (const item of Array.isArray(items) ? items : []) {
    const entity = item.entity || {};
    const type = itemType(item);
    if (type === "LINE") {
      const { start, end } = lineEndpoints(item);
      out.push({ className: "CDataSen", item, start, end });
    } else if (type === "LWPOLYLINE" || type === "POLYLINE" || type === "SPLINE") {
      out.push(...collectEntities(polylineItems(item), { ...options, unsupported }));
    } else if (type === "CIRCLE" || type === "ARC") {
      const arcAngle = finiteNumber(
        entity.jwwArcAngle ??
          ((finiteNumber(entity.endAngle, Math.PI * 2) -
            finiteNumber(entity.startAngle, 0)) ||
            Math.PI * 2),
        Math.PI * 2
      );
      out.push({
        className: "CDataEnko",
        item,
        center: point(entity.center),
        radius: Math.abs(finiteNumber(entity.radius || entity.r, 0)),
        startAngle: finiteNumber(entity.jwwStartAngle ?? entity.startAngle, 0),
        arcAngle,
        tiltAngle: finiteNumber(entity.jwwTiltAngle, 0),
        flatness: finiteNumber(entity.jwwFlatness, 1),
        isFullCircle: type === "CIRCLE",
      });
    } else if (type === "ELLIPSE") {
      out.push({
        className: "CDataEnko",
        item,
        ...ellipseGeometry(entity),
      });
    } else if (type === "IMAGE") {
      const start = point(entity.position || entity.startPoint || entity.insert);
      const width = Math.abs(finiteNumber(entity.width ?? entity.paperWidth, 1));
      const height = Math.abs(finiteNumber(entity.height ?? entity.paperHeight, 1));
      const fileName = String(entity.fileName || entity.name || "image.bmp");
      const sourceReference = parseJwwImageReferenceText(entity.jwwImageText);
      const angle = finiteNumber(entity.rotation ?? sourceReference?.rotation, 0);
      const rewriteRotation = Boolean(
        entity.jwwImageRotationExplicit ??
          Object.prototype.hasOwnProperty.call(entity, "rotation")
      );
      const changesReferenceRotation = Boolean(
        rewriteRotation &&
          sourceReference?.hasRotationField &&
          Math.abs(sourceReference.rotation - angle) > 1e-12
      );
      if (
        (Math.abs(angle) > 1e-12 || changesReferenceRotation) &&
        !options.allowImageRotation
      ) {
        unsupported.push({ item, type: "IMAGE_ROTATION" });
        continue;
      }
      const angleRadians = degreesToRadians(angle);
      const end = point(entity.endPoint, {
        x: start.x + Math.cos(angleRadians) * width,
        y: start.y + Math.sin(angleRadians) * width,
      });
      if (rewriteRotation && options.allowImageRotation) {
        const deltaX = end.x - start.x;
        const deltaY = end.y - start.y;
        const endpointAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        if (
          Math.hypot(deltaX, deltaY) <= 1e-12 ||
          angleDifferenceDegrees(endpointAngle, angle) > 1e-7
        ) {
          unsupported.push({ item, type: "IMAGE_ROTATION_GEOMETRY" });
          continue;
        }
      }
      out.push({
        className: "CDataMoji",
        item,
        start,
        end,
        textType: finiteNumber(entity.jwwTextType ?? entity.textType, 0),
        sizeX: Math.abs(
          finiteNumber(entity.paperTextWidth ?? entity.jwwTextWidth, width)
        ),
        sizeY: Math.abs(finiteNumber(entity.paperTextHeight, 2.5)),
        spacing: finiteNumber(entity.paperTextSpacing, 0),
        angle,
        fontName: entity.fontFamily || "MS Gothic",
        text: imageReferenceText(
          entity,
          fileName,
          width,
          height,
          options.embeddedImageNames,
          {
            rotation: angle,
            rewriteRotation: rewriteRotation && options.allowImageRotation,
          }
        ),
      });
    } else if (type === "TEXT" || type === "MTEXT" || type === "ATTRIB") {
      const start = point(entity.position || entity.startPoint || entity.insert);
      const height = Math.abs(
        finiteNumber(entity.paperTextHeight ?? entity.textHeight ?? entity.height, 2.5)
      );
      const width = Math.abs(
        finiteNumber(entity.paperTextWidth ?? entity.width, height)
      );
      const rotation = finiteNumber(entity.rotation, 0);
      const rotationRadians = degreesToRadians(rotation);
      out.push({
        className: "CDataMoji",
        item,
        start,
        end: point(entity.endPoint || entity.end, {
          x: start.x + Math.cos(rotationRadians) * width,
          y: start.y + Math.sin(rotationRadians) * width,
        }),
        textType: finiteNumber(entity.jwwTextType ?? entity.textType, 0),
        sizeX: width,
        sizeY: height,
        spacing: finiteNumber(entity.paperTextSpacing ?? entity.spacing, 0),
        angle: rotation,
        fontName: entity.fontFamily || "MS Gothic",
        // Gateway JSON keeps the display-normalized text and the original JWW
        // control string separately. The binary writer must preserve the raw
        // control string so overlay/superscript/subscript semantics survive a
        // JSON round trip.
        text: entity.rawText ?? entity.text ?? entity.content ?? "",
      });
    } else if (type === "POINT") {
      out.push({
        className: "CDataTen",
        item,
        position: point(entity.position || entity.point),
        isTemporary: isTemporaryPointEntity(item),
        code: finiteNumber(entity.jwwPointCode ?? entity.code, 0),
        angle: finiteNumber(entity.jwwPointAngle ?? entity.angle, 0),
        scale: finiteNumber(entity.jwwPointScale ?? entity.scale, 1),
      });
    } else if (type === "SOLID" || type === "TRACE" || type === "3DFACE") {
      const points = polygonPointsFromEntity(entity);
      if (type === "SOLID" && points.length === 4) {
        out.push({ className: "CDataSolid", item, points });
      } else {
        out.push(...solidRecordsFromPolygon(item, points));
      }
    } else if (type === "JWW_SOLID_PATH") {
      const polygons = Array.isArray(entity.solidPolygons)
        ? entity.solidPolygons
        : Array.isArray(entity.boundaryPaths)
          ? entity.boundaryPaths
          : [];
      polygons.forEach((polygon) => {
        out.push(...solidRecordsFromPolygon(item, polygon));
      });
    } else if (type === "HATCH") {
      out.push(...solidRecordsFromPolygon(item, polygonPointsFromEntity(entity)));
    } else if (type === "DIMENSION") {
      if (entity.jwwDimension) {
        out.push({
          className: "CDataSunpou",
          item,
          dimension: entity.jwwDimension,
        });
      } else {
        const blockItems = dimensionBlockItems(item, options.dxfMeta);
        if (blockItems.length) {
        out.push(...collectEntities(blockItems, { ...options, unsupported }));
        } else {
          out.push(
            ...collectEntities([dimensionFallbackTextItem(item)].filter(Boolean), {
              ...options,
              unsupported,
            })
          );
        }
      }
    } else if (type === "INSERT") {
      if (entity.jwwBlock) {
        out.push({
          className: "CDataBlock",
          item,
          block: entity.jwwBlock,
        });
      } else {
        out.push(
          ...collectEntities(insertBlockItems(item, options.dxfMeta), {
            ...options,
            unsupported,
          })
        );
      }
    } else if (type) {
      unsupported.push({
        id: String(item.id || ""),
        type,
      });
    }
  }
  return out;
}

function writePreamble(writer, options = {}) {
  const layerGroupScales = normalizeLayerGroupScales(options.layerGroupScales);
  const layerGroupWriteLayers = normalizeLayerGroupWriteLayers(
    options.layerGroupWriteLayers
  );
  JWW_HEADER.forEach((byte) => writer.byte(byte));
  writer.dword(options.version || DEFAULT_JWW_VERSION);
  writer.utf16String(options.memo || JWW_DEFAULT_MEMO);
  writer.dword(finiteNumber(options.paperSize, 3));
  writer.dword(normalizeLayerNumber(options.writeLayerGroup, 1));
  for (let group = 0; group < 16; group += 1) {
    const writeLayer = layerGroupWriteLayers?.[group] ?? 0;
    writer.dword(group === 0 ? 1 : 0);
    writer.dword(writeLayer);
    writer.double(layerGroupScales?.[group] ?? (group === 0 ? 50 : 1));
    writer.dword(0);
    for (let layer = 0; layer < 16; layer += 1) {
      writer.dword(
        layerGroupWriteLayers?.[group] !== null &&
          layerGroupWriteLayers?.[group] !== undefined
          ? layer === writeLayer
            ? 3
            : 2
          : layer === 0
            ? 1
            : 0
      );
      writer.dword(0);
    }
  }
  for (let i = 0; i < 21; i += 1) writer.dword(0);
  writer.double(0);
  writer.double(0);
  writer.double(1);
  writer.dword(0);
  writer.dword(0);
  for (let i = 0; i < 5; i += 1) writer.double(0);
  for (let group = 0; group < 16; group += 1) {
    for (let layer = 0; layer < 16; layer += 1) {
      writer.utf16String(layer === 0 ? `${group}-0` : "");
    }
  }
  for (let group = 0; group < 16; group += 1) {
    writer.utf16String(`Group${group}`);
  }
}

function writeArchiveCount(writer, value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0 || count > 0xffffffff) {
    throw new Error(`Unsupported JWW archive collection count: ${value}`);
  }
  if (count < 0xffff) {
    writer.word(count);
    return;
  }
  writer.word(0xffff);
  writer.dword(count);
}

function linePayload(value = {}) {
  return {
    base: normalizedBase(value.base || value.jww || {}),
    start: point(value.start || value.startPoint, {
      x: finiteNumber(value.start_x),
      y: finiteNumber(value.start_y),
    }),
    end: point(value.end || value.endPoint, {
      x: finiteNumber(value.end_x),
      y: finiteNumber(value.end_y),
    }),
  };
}

function semanticDimensionId(item = {}) {
  return item.dimensionId || item.entity?.dimensionId || null;
}

function isSemanticDimensionItem(item = {}) {
  return Boolean(
    semanticDimensionId(item) &&
      (item.isDimension ||
        item.entity?.isDimension ||
        item.dimensionAttributeProfile?.dimensionFigure ||
        item.entity?.dimensionAttributeProfile?.dimensionFigure)
  );
}

function pointDistance(a, b) {
  return Math.hypot(Number(a?.x) - Number(b?.x), Number(a?.y) - Number(b?.y));
}

function pointsEqual(a, b, tolerance = 1e-6) {
  return pointDistance(a, b) <= tolerance;
}

function pointPosition(item = {}) {
  const entity = itemEntity(item);
  return point(entity.position || entity.point, null);
}

function lineForDimensionEndpoint(lines, endpoint) {
  const matches = lines.filter((item) => {
    const endpoints = lineEndpoints(item);
    return pointsEqual(endpoints.start, endpoint) || pointsEqual(endpoints.end, endpoint);
  });
  return matches.length === 1 ? matches[0] : null;
}

function oppositeLineEndpoint(item, endpoint) {
  const endpoints = lineEndpoints(item);
  if (pointsEqual(endpoints.start, endpoint)) return endpoints.end;
  if (pointsEqual(endpoints.end, endpoint)) return endpoints.start;
  return null;
}

function nativeLinearDimensionItem(items = []) {
  const lines = items.filter((item) => itemType(item) === "LINE");
  const texts = items.filter((item) => itemType(item) === "TEXT");
  const points = items.filter((item) => itemType(item) === "POINT");
  if (
    items.length !== 6 ||
    lines.length !== 3 ||
    texts.length !== 1 ||
    points.length !== 2
  ) {
    return null;
  }
  const pointRows = points.map((item) => ({ item, position: pointPosition(item) }));
  if (pointRows.some((row) => !row.position)) return null;
  const dimensionLine = lines.find((item) => {
    const endpoints = lineEndpoints(item);
    return pointRows.every((row) =>
      [endpoints.start, endpoints.end].some((value) =>
        pointsEqual(value, row.position)
      )
    );
  });
  if (!dimensionLine) return null;
  const dimensionEndpoints = lineEndpoints(dimensionLine);
  const orderedPoints = [dimensionEndpoints.start, dimensionEndpoints.end].map(
    (endpoint) => pointRows.find((row) => pointsEqual(row.position, endpoint))
  );
  if (orderedPoints.some((row) => !row)) return null;
  const extensionCandidates = lines.filter((item) => item !== dimensionLine);
  const extensionLines = [dimensionEndpoints.start, dimensionEndpoints.end].map(
    (endpoint) => lineForDimensionEndpoint(extensionCandidates, endpoint)
  );
  if (
    extensionLines.some((item) => !item) ||
    extensionLines[0] === extensionLines[1]
  ) {
    return null;
  }
  const referencePoints = extensionLines.map((item, index) =>
    oppositeLineEndpoint(item, [dimensionEndpoints.start, dimensionEndpoints.end][index])
  );
  if (referencePoints.some((value) => !value)) return null;
  const dimensionId = String(semanticDimensionId(items[0]));
  const toLine = (item) => ({
    jww: jwwBase(item),
    ...lineEndpoints(item),
  });
  const toPoint = (item, position = pointPosition(item)) => ({
    jww: jwwBase(item),
    position,
    isTemporary: isTemporaryPointEntity(item),
  });
  const textEntity = itemEntity(texts[0]);
  return {
    ...dimensionLine,
    id: `${dimensionId}::jww-native-dimension`,
    type: "DIMENSION",
    entity: {
      ...itemEntity(dimensionLine),
      type: "DIMENSION",
      jwwDimension: {
        base: jwwBase(dimensionLine),
        line: toLine(dimensionLine),
        text: {
          ...textEntity,
          jww: jwwBase(texts[0]),
        },
        native: {
          sxfMode: 0,
          extensionLines: extensionLines.map(toLine),
          points: [
            ...orderedPoints.map((row) => toPoint(row.item)),
            ...referencePoints.map((position, index) =>
              toPoint(extensionLines[index], position)
            ),
          ],
        },
      },
    },
  };
}

function collapseNativeDimensionGroups(items = [], unsupported = []) {
  const groups = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!isSemanticDimensionItem(item)) continue;
    const id = String(semanticDimensionId(item));
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(item);
  }
  if (!groups.size) return Array.isArray(items) ? items : [];
  const replacements = new Map();
  const removed = new Set();
  groups.forEach((groupItems, id) => {
    const nativeItem = nativeLinearDimensionItem(groupItems);
    if (!nativeItem) {
      unsupported.push({ id, type: "DIMENSION_GROUP" });
      return;
    }
    replacements.set(groupItems[0], nativeItem);
    groupItems.slice(1).forEach((item) => removed.add(item));
  });
  return items.flatMap((item) => {
    if (removed.has(item)) return [];
    return [replacements.get(item) || item];
  });
}

function textPayload(value = {}) {
  return {
    base: normalizedBase(value.base || value.jww || {}),
    start: point(value.position || value.start || value.startPoint, {
      x: finiteNumber(value.start_x),
      y: finiteNumber(value.start_y),
    }),
    end: point(value.end || value.endPoint, {
      x: finiteNumber(value.end_x),
      y: finiteNumber(value.end_y),
    }),
    textType: finiteNumber(value.textType ?? value.text_type),
    sizeX: finiteNumber(value.sizeX ?? value.size_x ?? value.paperTextWidth),
    sizeY: finiteNumber(value.sizeY ?? value.size_y ?? value.paperTextHeight),
    spacing: finiteNumber(value.spacing ?? value.paperTextSpacing),
    angle: finiteNumber(value.angle ?? value.rotation),
    fontName: value.fontName || value.font_name || value.fontFamily || "MS Gothic",
    text: value.rawText || value.text || value.content || "",
  };
}

function pointPayload(value = {}) {
  const base = normalizedBase(value.base || value.jww || {});
  const position = point(value.position || value.point, {
    x: finiteNumber(value.x),
    y: finiteNumber(value.y),
  });
  return {
    base,
    position,
    isTemporary: Boolean(value.isTemporary ?? value.is_temporary),
    code: finiteNumber(value.code),
    angle: finiteNumber(value.angle),
    scale: finiteNumber(value.scale, 1),
  };
}

function writeLinePayload(writer, value) {
  const line = linePayload(value);
  writeBase(writer, line.base);
  writer.double(line.start.x);
  writer.double(line.start.y);
  writer.double(line.end.x);
  writer.double(line.end.y);
}

function writeTextPayload(writer, value) {
  const text = textPayload(value);
  writeBase(writer, text.base);
  writer.double(text.start.x);
  writer.double(text.start.y);
  writer.double(text.end.x);
  writer.double(text.end.y);
  writer.dword(text.textType);
  writer.double(text.sizeX);
  writer.double(text.sizeY);
  writer.double(text.spacing);
  writer.double(text.angle);
  writer.utf16String(text.fontName);
  writer.utf16String(text.text);
}

function writePointPayload(writer, value) {
  const pointValue = pointPayload(value);
  writeBase(writer, pointValue.base);
  writer.double(pointValue.position.x);
  writer.double(pointValue.position.y);
  writer.dword(pointValue.isTemporary ? 1 : 0);
  if (pointValue.base.pen_style === 100) {
    writer.dword(pointValue.code);
    writer.double(pointValue.angle);
    writer.double(pointValue.scale);
  }
}

function writeEntityPayload(writer, record, version) {
  const fallbackBase = jwwBase(record.item);
  const base =
    record.className === "CDataSunpou"
      ? normalizedBase(record.dimension?.base || {}, fallbackBase)
      : fallbackBase;
  writeBase(writer, base);
  if (record.className === "CDataSen") {
    writer.double(record.start.x);
    writer.double(record.start.y);
    writer.double(record.end.x);
    writer.double(record.end.y);
  } else if (record.className === "CDataEnko") {
    writer.double(record.center.x);
    writer.double(record.center.y);
    writer.double(record.radius);
    writer.double(record.startAngle);
    writer.double(record.arcAngle);
    writer.double(record.tiltAngle);
    writer.double(record.flatness);
    writer.dword(record.isFullCircle ? 1 : 0);
  } else if (record.className === "CDataMoji") {
    writer.double(record.start.x);
    writer.double(record.start.y);
    writer.double(record.end.x);
    writer.double(record.end.y);
    writer.dword(record.textType);
    writer.double(record.sizeX);
    writer.double(record.sizeY);
    writer.double(record.spacing);
    writer.double(record.angle);
    writer.utf16String(record.fontName);
    writer.utf16String(record.text);
  } else if (record.className === "CDataTen") {
    writer.double(record.position.x);
    writer.double(record.position.y);
    writer.dword(record.isTemporary ? 1 : 0);
    if (base.pen_style === 100) {
      writer.dword(record.code);
      writer.double(record.angle);
      writer.double(record.scale);
    }
  } else if (record.className === "CDataSolid") {
    const points = record.points || [];
    points.forEach((solidPoint) => {
      writer.double(point(solidPoint).x);
      writer.double(point(solidPoint).y);
    });
    if (base.pen_color === 10) {
      writer.dword(
        finiteNumber(
          record.item?.entity?.jwwSolidColor ?? record.item?.jwwSolidColor,
          0
        )
      );
    }
  } else if (record.className === "CDataBlock") {
    const block = record.block || {};
    const reference = point(block.reference || block.position, {
      x: finiteNumber(block.refX ?? block.ref_x),
      y: finiteNumber(block.refY ?? block.ref_y),
    });
    writer.double(reference.x);
    writer.double(reference.y);
    writer.double(finiteNumber(block.scaleX ?? block.scale_x, 1));
    writer.double(finiteNumber(block.scaleY ?? block.scale_y, 1));
    writer.double(finiteNumber(block.rotation));
    writer.dword(finiteNumber(block.definitionNumber ?? block.def_number));
  } else if (record.className === "CDataSunpou") {
    const dimension = record.dimension || {};
    const native = dimension.native || dimension;
    writeLinePayload(writer, dimension.line || dimension.dimensionLine || {});
    writeTextPayload(writer, dimension.text || {});
    if (version >= 420) {
      writer.word(finiteNumber(native.sxfMode ?? native.sxf_mode));
      const extensionLines = native.extensionLines || [
        native.extension_line_1,
        native.extension_line_2,
      ];
      const points = native.points || [
        native.dimension_point_1,
        native.dimension_point_2,
        native.extension_point_1,
        native.extension_point_2,
      ];
      writeLinePayload(writer, extensionLines[0] || {});
      writeLinePayload(writer, extensionLines[1] || {});
      for (let index = 0; index < 4; index += 1) {
        writePointPayload(writer, points[index] || {});
      }
    }
  }
}

function writeEntity(writer, record, classIds) {
  writeClassHeader(writer, record.className, classIds);
  writeEntityPayload(writer, record, classIds.version);
}

function blockDefinitionsFromMeta(meta = {}) {
  const source = meta.jwwBlockDefinitions || meta.blockDefinitions || [];
  return Array.isArray(source) ? source : [];
}

function writeBlockDefinitionList(
  writer,
  definitions,
  version,
  strict,
  classIds,
  embeddedImageNames,
  allowImageRotation
) {
  writeArchiveCount(writer, definitions.length);
  for (const definition of definitions) {
    writeClassHeader(writer, "CDataList", classIds);
    writeBase(writer, normalizedBase(definition.base || definition.jww || {}));
    writer.dword(finiteNumber(definition.number));
    writer.dword(definition.referred === false ? 0 : 1);
    writer.dword(finiteNumber(definition.createdAt ?? definition.created_at));
    writer.utf16String(definition.rawName || definition.name || "Block");
    const unsupported = [];
    const records = collectEntities(definition.entities || [], {
      unsupported,
      embeddedImageNames,
      allowImageRotation,
    });
    if (strict && unsupported.length) {
      const types = [...new Set(unsupported.map((item) => item.type))];
      throw new Error(
        `Unsupported JWW block definition entity types: ${types.join(", ")}`
      );
    }
    writeArchiveCount(writer, records.length);
    records.forEach((record) => writeEntity(writer, record, classIds));
  }
}

function bytesFromEmbeddedImage(image = {}) {
  if (image.bytes instanceof Uint8Array) return image.bytes;
  if (Array.isArray(image.bytes)) return Uint8Array.from(image.bytes);
  const base64 = String(image.dataBase64 || image.base64 || "");
  if (!base64) return new Uint8Array();
  if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(base64, "base64"));
  const decoded = atob(base64);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

function embeddedImagesFromMeta(meta = {}) {
  const source = meta.jwwEmbeddedImages || meta.embeddedImages || [];
  return Array.isArray(source) ? source : [];
}

function assertCompleteEmbeddedImages(images = []) {
  for (const image of images) {
    const bytes = bytesFromEmbeddedImage(image);
    const declaredValue = image.declaredSize ?? image.declared_size;
    const hasDeclaredSize = declaredValue !== undefined && declaredValue !== null;
    const declaredSize = Number(declaredValue);
    if (
      image.truncated ||
      (hasDeclaredSize &&
        (!Number.isSafeInteger(declaredSize) ||
          declaredSize < 0 ||
          declaredSize !== bytes.length))
    ) {
      const fileName = image.fileName || image.file_name || image.name || "image.bmp";
      throw new Error(
        `Incomplete embedded JWW image payload: ${fileName} (declared ${hasDeclaredSize ? declaredValue : "unknown"}, actual ${bytes.length})`
      );
    }
  }
}

function writeEmbeddedImages(writer, images, version) {
  if (version < 700) return;
  writer.dword(images.length);
  for (const image of images) {
    const bytes = bytesFromEmbeddedImage(image);
    writer.utf16String(image.fileName || image.file_name || image.name || "image.bmp");
    writer.dword(bytes.length);
    writer.raw(bytes);
  }
}

function normalizeTemplatePrefix(templatePrefix) {
  if (!templatePrefix) return null;
  const bytes = templatePrefix instanceof Uint8Array
    ? templatePrefix
    : Uint8Array.from(templatePrefix);
  if (bytes.length < JWW_HEADER.length) return null;
  return bytes;
}

function hasJwwHeader(bytes) {
  return JWW_HEADER.every((byte, index) => bytes[index] === byte);
}

function readTemplateVersion(bytes) {
  if (!bytes || bytes.length < 12 || !hasJwwHeader(bytes)) return null;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    8,
    true
  );
}

function templateForVersion(templatePrefix, requestedVersion) {
  const source = normalizeTemplatePrefix(templatePrefix);
  if (!source || !hasJwwHeader(source)) {
    throw new Error("JWW template prefix must start with the JwwData. header");
  }
  const version = Number(requestedVersion || readTemplateVersion(source));
  if (!JWW_WRITE_VERSIONS.includes(version)) {
    throw new Error(
      `JWW writer supports template versions ${JWW_WRITE_VERSIONS.join(", ")}; received ${version || "unknown"}`
    );
  }
  const bytes = Uint8Array.from(source);
  new DataView(bytes.buffer).setUint32(8, version, true);
  return { bytes, version };
}

function internalSettingEntities(meta = {}) {
  const records = meta?.jwwInternalSettings?.records || [];
  return records.map((record) => ({
    id: record.id,
    type: "TEXT",
    layer: record.layer,
    entity: {
      type: "TEXT",
      text: record.rawText || record.text || "",
      position: record.startPoint,
      startPoint: record.startPoint,
      endPoint: record.endPoint,
      paperTextWidth: record.sizeX,
      paperTextHeight: record.sizeY,
      paperTextSpacing: record.spacing,
      rotation: record.angle,
      fontFamily: record.fontFamily,
      jwwTextType: record.textType,
      jww: record.jww,
    },
  }));
}

export function extractJwwTemplatePrefix(input, options = {}) {
  const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input || []);
  const doc = parse(bytes, { encoding: options.encoding || "shift_jis" });
  const entityListOffset = Number(doc?.entity_list_offset);
  if (!Number.isInteger(entityListOffset) || entityListOffset <= 12) {
    throw new Error("JWW entity list offset was not found for template extraction");
  }
  if (!JWW_WRITE_VERSIONS.includes(Number(doc.version))) {
    throw new Error(
      `JWW writer template must be version ${JWW_WRITE_VERSIONS.join(" or ")}; received ${doc.version}`
    );
  }
  return {
    prefixBytes: bytes.slice(0, entityListOffset),
    entityListOffset,
    version: Number(doc.version),
    paperSize: Number(doc.paper_size),
  };
}

export function buildJwwRecordPayload(
  item,
  {
    version = DEFAULT_JWW_VERSION,
    dxfMeta = {},
    embeddedImages = [],
    allowImageRotation = false,
  } = {}
) {
  const normalizedVersion = Number(version);
  if (!JWW_WRITE_VERSIONS.includes(normalizedVersion)) {
    throw new Error(
      `JWW record writer supports versions ${JWW_WRITE_VERSIONS.join(", ")}; received ${normalizedVersion}`
    );
  }
  const unsupported = [];
  const records = collectEntities([item], {
    dxfMeta,
    unsupported,
    embeddedImageNames: embeddedImageNameSet(embeddedImages),
    allowImageRotation,
  });
  if (unsupported.length || records.length !== 1) {
    const types = [...new Set(unsupported.map((entry) => entry.type))];
    throw new Error(
      `Expected one supported JWW record${types.length ? `; unsupported: ${types.join(", ")}` : ""}`
    );
  }
  const writer = new BinaryWriter();
  writeEntityPayload(writer, records[0], normalizedVersion);
  return {
    bytes: writer.toUint8Array(),
    className: records[0].className,
    version: normalizedVersion,
  };
}

export function preflightJwwWrite({
  entities,
  templatePrefix = null,
  dxfMeta = {},
  meta = {},
  version = null,
  allowImageRotation = false,
} = {}) {
  try {
    const unsupportedEntities = [];
    const blockDefinitions = blockDefinitionsFromMeta(meta);
    const embeddedImages = embeddedImagesFromMeta(meta);
    const embeddedImageNames = embeddedImageNameSet(embeddedImages);
    assertCompleteEmbeddedImages(embeddedImages);
    const sourceEntities = [
      ...collapseNativeDimensionGroups(entities, unsupportedEntities),
      ...internalSettingEntities(meta),
    ];
    const records = collectEntities(sourceEntities, {
      dxfMeta,
      unsupported: unsupportedEntities,
      embeddedImageNames,
      allowImageRotation,
    });
    if (unsupportedEntities.length) {
      const types = [...new Set(unsupportedEntities.map((item) => item.type))];
      throw new Error(`Unsupported JWW write entity types: ${types.join(", ")}`);
    }

    for (const definition of blockDefinitions) {
      const unsupported = [];
      collectEntities(definition.entities || [], {
        unsupported,
        embeddedImageNames,
        allowImageRotation,
      });
      if (unsupported.length) {
        const types = [...new Set(unsupported.map((item) => item.type))];
        throw new Error(
          `Unsupported JWW block definition entity types: ${types.join(", ")}`
        );
      }
    }

    const explicitTemplatePrefix = normalizeTemplatePrefix(templatePrefix);
    const rawPrefix =
      explicitTemplatePrefix || normalizeTemplatePrefix(getDefaultJwwSaveTemplatePrefix());
    const template = rawPrefix
      ? templateForVersion(rawPrefix, version)
      : { version: Number(version || DEFAULT_JWW_VERSION) };
    if (!JWW_WRITE_VERSIONS.includes(template.version)) {
      throw new Error(
        `JWW writer supports versions ${JWW_WRITE_VERSIONS.join(", ")}; received ${template.version}`
      );
    }
    if (template.version < 700 && embeddedImages.length) {
      throw new Error("Embedded JWW images require version 700");
    }

    return {
      ok: true,
      code: null,
      reasons: [],
      version: template.version,
      recordsWritten: records.length,
      blockDefinitionsWritten: blockDefinitions.length,
      embeddedImagesWritten: embeddedImages.length,
    };
  } catch (error) {
    return {
      ok: false,
      code: "JWW_WRITE_PREFLIGHT_FAILED",
      reasons: [error?.message || String(error)],
    };
  }
}

export function buildJwwWriteResult({
  entities,
  memo = JWW_DEFAULT_MEMO,
  paperSize = null,
  layerGroupScales = null,
  layerGroupWriteLayers = null,
  layerGroupStates = null,
  layerStates = null,
  layerGroupProtections = null,
  layerProtections = null,
  templatePrefix = null,
  dxfMeta = {},
  meta = {},
  version = null,
  strict = true,
  writeLayerGroup = null,
  writeLayer = null,
  allowImageRotation = false,
} = {}) {
  const unsupportedEntities = [];
  const blockDefinitions = blockDefinitionsFromMeta(meta);
  const embeddedImages = embeddedImagesFromMeta(meta);
  const embeddedImageNames = embeddedImageNameSet(embeddedImages);
  assertCompleteEmbeddedImages(embeddedImages);
  const sourceEntities = [
    ...collapseNativeDimensionGroups(entities, unsupportedEntities),
    ...internalSettingEntities(meta),
  ];
  const records = collectEntities(sourceEntities, {
    dxfMeta,
    unsupported: unsupportedEntities,
    embeddedImageNames,
    allowImageRotation,
  });
  if (strict && unsupportedEntities.length) {
    const types = [...new Set(unsupportedEntities.map((item) => item.type))];
    throw new Error(`Unsupported JWW write entity types: ${types.join(", ")}`);
  }
  const explicitTemplatePrefix = normalizeTemplatePrefix(templatePrefix);
  const rawPrefix =
    explicitTemplatePrefix || normalizeTemplatePrefix(getDefaultJwwSaveTemplatePrefix());
  const template = rawPrefix
    ? templateForVersion(rawPrefix, version)
    : { bytes: null, version: Number(version || DEFAULT_JWW_VERSION) };
  if (!JWW_WRITE_VERSIONS.includes(template.version)) {
    throw new Error(
      `JWW writer supports versions ${JWW_WRITE_VERSIONS.join(", ")}; received ${template.version}`
    );
  }
  const templateBytes = template.bytes
    ? patchJwwTemplatePrefixMetadata(
        explicitTemplatePrefix
          ? template.bytes
          : patchDefaultTemplateLayerState(template.bytes, entities, {
              writeLayerGroup,
              writeLayer,
            }),
        {
          paperSize,
          writeLayerGroup,
          layerGroupScales,
          layerGroupWriteLayers,
          layerGroupStates,
          layerStates,
          layerGroupProtections,
          layerProtections,
        }
      )
    : null;
  const writer = new BinaryWriter(templateBytes || []);
  if (!templateBytes) {
    writePreamble(writer, {
      memo,
      paperSize: normalizePaperCode(paperSize) ?? 3,
      writeLayerGroup,
      layerGroupScales,
      layerGroupWriteLayers,
      version: template.version,
    });
  }
  writeArchiveCount(writer, records.length);
  const classIds = new Map();
  classIds.nextId = 1;
  classIds.version = template.version;
  records.forEach((record) => writeEntity(writer, record, classIds));
  if (strict && template.version < 700 && embeddedImages.length) {
    throw new Error("Embedded JWW images require version 700");
  }
  writeBlockDefinitionList(
    writer,
    blockDefinitions,
    template.version,
    strict,
    classIds,
    embeddedImageNames,
    allowImageRotation
  );
  writeEmbeddedImages(writer, embeddedImages, template.version);
  return {
    bytes: writer.toUint8Array(),
    version: template.version,
    recordsWritten: records.length,
    unsupportedEntities,
    blockDefinitionsWritten: blockDefinitions.length,
    embeddedImagesWritten: embeddedImages.length,
    usedTemplatePrefix: Boolean(templateBytes),
    usedDefaultTemplatePrefix: Boolean(templateBytes && !explicitTemplatePrefix),
  };
}

export function buildJwwBytes(options = {}) {
  return buildJwwWriteResult(options).bytes;
}
