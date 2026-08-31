import { preflightNativeJwwSave, saveNativeJww } from "./native.js";

export const JWW_BASIC_SETTINGS_EDIT_CONTRACT_VERSION = 1;

export const JWW_BASIC_SETTINGS_PAPER_OPTIONS = Object.freeze([
  { value: 0, label: "A0" },
  { value: 1, label: "A1" },
  { value: 2, label: "A2" },
  { value: 3, label: "A3" },
  { value: 4, label: "A4" },
  { value: 8, label: "Extended / custom (code 8)" },
  { value: 9, label: "Extended / custom (code 9)" },
  { value: 10, label: "Extended / custom (code 10)" },
  { value: 11, label: "Extended / custom (code 11)" },
  { value: 12, label: "Extended / custom (code 12)" },
  { value: 13, label: "Extended / custom (code 13)" },
  { value: 14, label: "Extended / custom (code 14)" },
]);

const PAPER_CODES = new Set(
  JWW_BASIC_SETTINGS_PAPER_OPTIONS.map((option) => option.value)
);
const EDIT_KEYS = new Set([
  "paperSize",
  "writeLayerGroup",
  "layerGroupScales",
  "layerGroupWriteLayers",
]);

function editError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertNativeDocument(document) {
  if (document?.kind !== "jww-native") {
    throw new TypeError("JwwNativeDocument is required");
  }
}

function assertKnownEditKeys(edits) {
  if (!edits || typeof edits !== "object" || Array.isArray(edits)) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      "Basic Settings edits must be an object"
    );
  }
  for (const key of Object.keys(edits)) {
    if (!EDIT_KEYS.has(key)) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_UNSUPPORTED",
        `Basic Settings field is not native-editable: ${key}`
      );
    }
  }
}

function normalizedPaperSize(value) {
  const paperSize = Number(value);
  if (!Number.isInteger(paperSize) || !PAPER_CODES.has(paperSize)) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      `Unsupported JWW paper size code: ${value}`
    );
  }
  return paperSize;
}

function normalizedWriteLayerGroup(value) {
  const writeLayerGroup = Number(value);
  if (
    !Number.isInteger(writeLayerGroup) ||
    writeLayerGroup < 0 ||
    writeLayerGroup > 15
  ) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      `Unsupported JWW write layer group: ${value}`
    );
  }
  return writeLayerGroup;
}

function normalizedLayerGroupScales(document, value) {
  if (value === undefined) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      "Layer group scale edits must be an object keyed by group index"
    );
  }
  const rows = [];
  for (const [key, rawScale] of Object.entries(value)) {
    if (!/^(?:0|[1-9]\d*)$/.test(key)) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `Invalid JWW layer group index: ${key}`
      );
    }
    const index = Number(key);
    const group = document.layerGroups?.[index];
    if (!group) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `JWW layer group does not exist: ${index}`
      );
    }
    const scale = Number(rawScale);
    if (!Number.isFinite(scale) || scale <= 0) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `JWW layer group scale must be greater than zero: ${rawScale}`
      );
    }
    rows.push({ index, group, scale });
  }
  return rows.sort((left, right) => left.index - right.index);
}

function normalizedLayerGroupWriteLayers(document, value) {
  if (value === undefined) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      "Layer group write-layer edits must be an object keyed by group index"
    );
  }
  const rows = [];
  for (const [key, rawWriteLayer] of Object.entries(value)) {
    if (!/^(?:0|[1-9]\d*)$/.test(key)) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `Invalid JWW layer group index: ${key}`
      );
    }
    const index = Number(key);
    const group = document.layerGroups?.[index];
    if (!group) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `JWW layer group does not exist: ${index}`
      );
    }
    const writeLayer = Number(rawWriteLayer);
    if (!Number.isInteger(writeLayer) || writeLayer < 0 || writeLayer > 15) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `Unsupported JWW write layer: ${rawWriteLayer}`
      );
    }
    if (!group.layers?.[writeLayer]) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `JWW layer does not exist: ${index}.${writeLayer}`
      );
    }
    if (
      Number(group.protect || 0) !== 0 ||
      Number(group.layers[writeLayer].protect || 0) !== 0
    ) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `Protected JWW layer group or layer cannot become current: ${index}.${writeLayer}`
      );
    }
    rows.push({ index, group, writeLayer });
  }
  return rows.sort((left, right) => left.index - right.index);
}

function withWriteLayer(group, writeLayer) {
  if (writeLayer === Number(group.write_layer)) return group;
  const layers = group.layers.map((layer) => ({ ...layer }));
  const previousWriteLayer = Number(group.write_layer);
  if (Number.isInteger(previousWriteLayer) && layers[previousWriteLayer]) {
    layers[previousWriteLayer].state = 2;
  }
  layers[writeLayer].state = 3;
  return { ...group, write_layer: writeLayer, layers };
}

export function buildJwwBasicSettingsPatches(document, edits = {}) {
  assertNativeDocument(document);
  assertKnownEditKeys(edits);
  const patches = [];
  const header = document.header;
  if (!header?.id) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      "JWW native header patch target is unavailable"
    );
  }

  const paperSize = Object.hasOwn(edits, "paperSize")
    ? normalizedPaperSize(edits.paperSize)
    : Number(header.paperSize);
  const writeLayerGroup = Object.hasOwn(edits, "writeLayerGroup")
    ? normalizedWriteLayerGroup(edits.writeLayerGroup)
    : Number(header.writeLayerGroup);
  if (
    paperSize !== Number(header.paperSize) ||
    writeLayerGroup !== Number(header.writeLayerGroup)
  ) {
    patches.push({
      op: "replace",
      targetId: header.id,
      record: { ...header, paperSize, writeLayerGroup },
    });
  }

  const layerGroupUpdates = new Map();
  for (const { index, group, scale } of normalizedLayerGroupScales(
    document,
    edits.layerGroupScales
  )) {
    if (scale === Number(group.scale)) continue;
    layerGroupUpdates.set(index, { ...group, scale });
  }
  for (const { index, group, writeLayer } of normalizedLayerGroupWriteLayers(
    document,
    edits.layerGroupWriteLayers
  )) {
    if (writeLayer === Number(group.write_layer)) continue;
    const current = layerGroupUpdates.get(index) || group;
    layerGroupUpdates.set(index, withWriteLayer(current, writeLayer));
  }
  for (const [index, record] of [...layerGroupUpdates.entries()].sort(
    (left, right) => left[0] - right[0]
  )) {
    patches.push({
      op: "replace",
      targetId: document.layerGroups[index].id,
      record,
    });
  }
  return patches;
}

export function preflightJwwBasicSettingsSave(document, edits = {}) {
  try {
    const patches = buildJwwBasicSettingsPatches(document, edits);
    const preflight = preflightNativeJwwSave(document, { patches });
    return { ...preflight, patchCount: patches.length, patches };
  } catch (error) {
    return {
      ok: false,
      code: error?.code || "JWW_BASIC_SETTINGS_EDIT_INVALID",
      strategy: "blocked",
      reasons: [error?.message || String(error)],
      byteIdentical: false,
      preservesUnsupportedBytes: true,
      willWriteBytes: false,
      patchCount: 0,
      patches: [],
    };
  }
}

export function saveJwwBasicSettings(document, edits = {}) {
  const patches = buildJwwBasicSettingsPatches(document, edits);
  return saveNativeJww(document, { patches });
}
