import { preflightNativeJwwSave, saveNativeJww } from "./native.js";

export const JWW_BASIC_SETTINGS_EDIT_CONTRACT_VERSION = 5;

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
  "memo",
  "paperSize",
  "writeLayerGroup",
  "layerGroupScales",
  "layerGroupWriteLayers",
  "layerGroupStates",
  "layerStates",
  "layerGroupProtections",
  "layerProtections",
  "printOriginX",
  "printOriginY",
  "printScale",
  "printRotationSetting",
]);

function normalizedMemo(value) {
  if (typeof value !== "string" || value.length > 500000) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      "JWW memo must be a string no longer than 500000 UTF-16 code units"
    );
  }
  return value;
}

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

function normalizedPrintNumber(value, label, { positive = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || (positive && number <= 0)) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      positive
        ? `JWW ${label} must be greater than zero: ${value}`
        : `JWW ${label} must be finite: ${value}`
    );
  }
  return number;
}

function normalizedPrintRotationSetting(value) {
  const setting = Number(value);
  const rotation = setting % 10;
  const referencePosition = Math.floor(setting / 10);
  if (
    !Number.isInteger(setting) ||
    setting < 0 ||
    setting > 91 ||
    ![0, 1].includes(rotation) ||
    referencePosition < 0 ||
    referencePosition > 9
  ) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      `Unsupported JWW print rotation/reference setting: ${value}`
    );
  }
  return setting;
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
    const previousWriteLayer = Number(group.write_layer);
    if (writeLayer !== previousWriteLayer) {
      if (
        !Number.isInteger(previousWriteLayer) ||
        previousWriteLayer < 0 ||
        previousWriteLayer > 15 ||
        !group.layers[previousWriteLayer]
      ) {
        throw editError(
          "JWW_BASIC_SETTINGS_EDIT_INVALID",
          `Existing JWW write layer metadata is unavailable: ${index}.${group.write_layer}`
        );
      }
      if (Number(group.layers[previousWriteLayer].state) !== 3) {
        throw editError(
          "JWW_BASIC_SETTINGS_EDIT_INVALID",
          `Existing JWW write layer must have state 3: ${index}.${previousWriteLayer}`
        );
      }
      if (![0, 1, 2, 3].includes(Number(group.layers[writeLayer].state))) {
        throw editError(
          "JWW_BASIC_SETTINGS_EDIT_INVALID",
          `JWW write layer transition from state ${group.layers[writeLayer].state} is not verified: ${index}.${writeLayer}`
        );
      }
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

function normalizedLayerGroupStates(
  document,
  value,
  writeLayerGroup,
  protections = new Map()
) {
  if (value === undefined) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      "Layer group state edits must be an object keyed by group index"
    );
  }
  const rows = [];
  for (const [key, rawState] of Object.entries(value)) {
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
    const state = Number(rawState);
    const allowed = index === writeLayerGroup ? [3] : [0, 1, 2];
    if (!Number.isInteger(state) || !allowed.includes(state)) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        index === writeLayerGroup
          ? `Current JWW layer group must retain state 3: ${index}`
          : `Non-current JWW layer group state must be 0, 1, or 2: ${index}.${rawState}`
      );
    }
    const protect = protections.get(index) ?? Number(group.protect || 0);
    if (state !== Number(group.state) && protect === 2) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `Display-fixed JWW layer group state cannot be changed: ${index}`
      );
    }
    rows.push({ index, group, state });
  }
  return rows.sort((left, right) => left.index - right.index);
}

function normalizedLayerStates(
  document,
  value,
  writeLayers,
  protections = new Map()
) {
  if (value === undefined) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      "Layer state edits must be an object keyed by group.layer"
    );
  }
  const rows = [];
  for (const [key, rawState] of Object.entries(value)) {
    const match = key.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
    if (!match) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `Invalid JWW layer state target: ${key}`
      );
    }
    const groupIndex = Number(match[1]);
    const layerIndex = Number(match[2]);
    const group = document.layerGroups?.[groupIndex];
    const layer = group?.layers?.[layerIndex];
    if (!group || !layer) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `JWW layer does not exist: ${groupIndex}.${layerIndex}`
      );
    }
    const writeLayer = writeLayers.get(groupIndex) ?? Number(group.write_layer);
    const state = Number(rawState);
    const allowed = layerIndex === writeLayer ? [3] : [0, 1, 2];
    if (!Number.isInteger(state) || !allowed.includes(state)) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        layerIndex === writeLayer
          ? `Current JWW layer must retain state 3: ${groupIndex}.${layerIndex}`
          : `Non-current JWW layer state must be 0, 1, or 2: ${groupIndex}.${layerIndex}.${rawState}`
      );
    }
    const protect =
      protections.get(`${groupIndex}.${layerIndex}`) ??
      Number(layer.protect || 0);
    if (state !== Number(layer.state) && protect === 2) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `Display-fixed JWW layer state cannot be changed: ${groupIndex}.${layerIndex}`
      );
    }
    rows.push({ groupIndex, layerIndex, group, state });
  }
  return rows.sort(
    (left, right) =>
      left.groupIndex - right.groupIndex || left.layerIndex - right.layerIndex
  );
}

function normalizedProtection(value, target) {
  const protect = Number(value);
  if (!Number.isInteger(protect) || protect < 0 || protect > 2) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      `JWW protection must be 0, 1, or 2: ${target}.${value}`
    );
  }
  return protect;
}

function normalizedLayerGroupProtections(document, value) {
  if (value === undefined) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      "Layer group protection edits must be an object keyed by group index"
    );
  }
  const rows = [];
  for (const [key, rawProtect] of Object.entries(value)) {
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
    const protect = normalizedProtection(rawProtect, String(index));
    rows.push({ index, group, protect });
  }
  return rows.sort((left, right) => left.index - right.index);
}

function normalizedLayerProtections(document, value) {
  if (value === undefined) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw editError(
      "JWW_BASIC_SETTINGS_EDIT_INVALID",
      "Layer protection edits must be an object keyed by group.layer"
    );
  }
  const rows = [];
  for (const [key, rawProtect] of Object.entries(value)) {
    const match = key.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
    if (!match) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `Invalid JWW layer protection target: ${key}`
      );
    }
    const groupIndex = Number(match[1]);
    const layerIndex = Number(match[2]);
    const group = document.layerGroups?.[groupIndex];
    const layer = group?.layers?.[layerIndex];
    if (!group || !layer) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        `JWW layer does not exist: ${groupIndex}.${layerIndex}`
      );
    }
    const protect = normalizedProtection(
      rawProtect,
      `${groupIndex}.${layerIndex}`
    );
    rows.push({ groupIndex, layerIndex, group, protect });
  }
  return rows.sort(
    (left, right) =>
      left.groupIndex - right.groupIndex || left.layerIndex - right.layerIndex
  );
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

function withLayerState(group, layerIndex, state) {
  if (state === Number(group.layers[layerIndex].state)) return group;
  const layers = group.layers.map((layer) => ({ ...layer }));
  layers[layerIndex].state = state;
  return { ...group, layers };
}

function withLayerProtection(group, layerIndex, protect) {
  if (protect === Number(group.layers[layerIndex].protect)) return group;
  const layers = group.layers.map((layer) => ({ ...layer }));
  layers[layerIndex].protect = protect;
  return { ...group, layers };
}

function withWriteGroupState(group, index, previousWriteGroup, writeLayerGroup) {
  if (previousWriteGroup === writeLayerGroup) return group;
  if (index === previousWriteGroup) return { ...group, state: 2 };
  if (index === writeLayerGroup) return { ...group, state: 3 };
  return group;
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
  const memo = Object.hasOwn(edits, "memo")
    ? normalizedMemo(edits.memo)
    : String(header.memo || "");
  if (
    memo !== String(header.memo || "") ||
    paperSize !== Number(header.paperSize) ||
    writeLayerGroup !== Number(header.writeLayerGroup)
  ) {
    patches.push({
      op: "replace",
      targetId: header.id,
      record: { ...header, memo, paperSize, writeLayerGroup },
    });
  }

  const printEditRequested = [
    "printOriginX",
    "printOriginY",
    "printScale",
    "printRotationSetting",
  ].some((key) => Object.hasOwn(edits, key));
  if (printEditRequested) {
    const print = document.settings?.print;
    if (!print?.id) {
      throw editError(
        "JWW_BASIC_SETTINGS_EDIT_INVALID",
        "JWW native print settings patch target is unavailable"
      );
    }
    const originX = Object.hasOwn(edits, "printOriginX")
      ? normalizedPrintNumber(edits.printOriginX, "print origin X")
      : Number(print.origin_x);
    const originY = Object.hasOwn(edits, "printOriginY")
      ? normalizedPrintNumber(edits.printOriginY, "print origin Y")
      : Number(print.origin_y);
    const scale = Object.hasOwn(edits, "printScale")
      ? normalizedPrintNumber(edits.printScale, "print scale", { positive: true })
      : Number(print.scale);
    const rotationSetting = Object.hasOwn(edits, "printRotationSetting")
      ? normalizedPrintRotationSetting(edits.printRotationSetting)
      : Number(print.rotation_setting);
    if (
      originX !== Number(print.origin_x) ||
      originY !== Number(print.origin_y) ||
      scale !== Number(print.scale) ||
      rotationSetting !== Number(print.rotation_setting)
    ) {
      patches.push({
        op: "replace",
        targetId: print.id,
        record: { ...print, origin_x: originX, origin_y: originY, scale, rotation_setting: rotationSetting },
      });
    }
  }

  const layerGroupUpdates = new Map();
  const writeLayerRows = normalizedLayerGroupWriteLayers(
    document,
    edits.layerGroupWriteLayers
  );
  const writeLayers = new Map(
    writeLayerRows.map(({ index, writeLayer }) => [index, writeLayer])
  );
  const layerGroupProtectionRows = normalizedLayerGroupProtections(
    document,
    edits.layerGroupProtections
  );
  const layerProtectionRows = normalizedLayerProtections(
    document,
    edits.layerProtections
  );
  const layerGroupProtections = new Map(
    layerGroupProtectionRows.map(({ index, protect }) => [index, protect])
  );
  const layerProtections = new Map(
    layerProtectionRows.map(({ groupIndex, layerIndex, protect }) => [
      `${groupIndex}.${layerIndex}`,
      protect,
    ])
  );
  for (const { index, group, scale } of normalizedLayerGroupScales(
    document,
    edits.layerGroupScales
  )) {
    if (scale === Number(group.scale)) continue;
    const current = withWriteGroupState(
      group,
      index,
      Number(header.writeLayerGroup),
      writeLayerGroup
    );
    layerGroupUpdates.set(index, { ...current, scale });
  }
  for (const { index, group, writeLayer } of writeLayerRows) {
    if (writeLayer === Number(group.write_layer)) continue;
    const current =
      layerGroupUpdates.get(index) ||
      withWriteGroupState(
        group,
        index,
        Number(header.writeLayerGroup),
        writeLayerGroup
      );
    layerGroupUpdates.set(index, withWriteLayer(current, writeLayer));
  }
  for (const { index, group, protect } of layerGroupProtectionRows) {
    if (protect === Number(group.protect)) continue;
    const current =
      layerGroupUpdates.get(index) ||
      withWriteGroupState(
        group,
        index,
        Number(header.writeLayerGroup),
        writeLayerGroup
      );
    layerGroupUpdates.set(index, { ...current, protect });
  }
  for (const { groupIndex, layerIndex, group, protect } of layerProtectionRows) {
    const current =
      layerGroupUpdates.get(groupIndex) ||
      withWriteGroupState(
        group,
        groupIndex,
        Number(header.writeLayerGroup),
        writeLayerGroup
      );
    const revised = withLayerProtection(current, layerIndex, protect);
    if (revised !== current) layerGroupUpdates.set(groupIndex, revised);
  }
  for (const { index, group, state } of normalizedLayerGroupStates(
    document,
    edits.layerGroupStates,
    writeLayerGroup,
    layerGroupProtections
  )) {
    const current =
      layerGroupUpdates.get(index) ||
      withWriteGroupState(
        group,
        index,
        Number(header.writeLayerGroup),
        writeLayerGroup
      );
    if (state !== Number(current.state)) {
      layerGroupUpdates.set(index, { ...current, state });
    }
  }
  for (const { groupIndex, layerIndex, group, state } of normalizedLayerStates(
    document,
    edits.layerStates,
    writeLayers,
    layerProtections
  )) {
    const current =
      layerGroupUpdates.get(groupIndex) ||
      withWriteGroupState(
        group,
        groupIndex,
        Number(header.writeLayerGroup),
        writeLayerGroup
      );
    const revised = withLayerState(current, layerIndex, state);
    if (revised !== current) layerGroupUpdates.set(groupIndex, revised);
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
