export const JWW_TEXT_SETTINGS_SOURCE_LAYOUT =
  "jwdatafmt-text-type-table-v600-v700";

export const JWW_TEXT_TYPE_COUNT = 10;
export const JWW_TEXT_TYPE_ROW_BYTE_LENGTH = 28;
export const JWW_TEXT_TYPE_TABLE_BYTE_LENGTH =
  JWW_TEXT_TYPE_COUNT * JWW_TEXT_TYPE_ROW_BYTE_LENGTH;
export const JWW_CURRENT_TEXT_SETTINGS_BYTE_LENGTH = 32;
export const JWW_TEXT_SETTINGS_BYTE_LENGTH =
  JWW_TEXT_TYPE_TABLE_BYTE_LENGTH + JWW_CURRENT_TEXT_SETTINGS_BYTE_LENGTH;

// In the official v600/v700 layout, 68 bytes of other environment settings
// follow the text table/current-text fields before the drawing entity list.
export const JWW_TEXT_SETTINGS_ENTITY_LIST_TAIL_BYTE_LENGTH = 68;
export const JWW_TEXT_SETTINGS_ENTITY_LIST_DISTANCE =
  JWW_TEXT_SETTINGS_BYTE_LENGTH +
  JWW_TEXT_SETTINGS_ENTITY_LIST_TAIL_BYTE_LENGTH;

export const JWW_TEXT_TYPE_EDIT_KEYS = Object.freeze(["textTypePresets"]);

function settingsError(message) {
  const error = new Error(message);
  error.code = "JWW_TEXT_SETTINGS_INVALID";
  return error;
}

function finiteNumber(value, label, { positive = false, minimum = null } = {}) {
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    (positive && number <= 0) ||
    (minimum !== null && number < minimum) ||
    Math.abs(number) > 1_000_000
  ) {
    throw settingsError(`Invalid JWW ${label}: ${value}`);
  }
  return number;
}

function colorNumber(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 9) {
    throw settingsError(`${label} must be an integer from 0 to 9: ${value}`);
  }
  return number;
}

function normalizePreset(preset, textType) {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
    throw settingsError(`JWW text type preset is unavailable: ${textType}`);
  }
  if (Number(preset.textType) !== textType) {
    throw settingsError(`JWW text type preset number does not match row ${textType}`);
  }
  return {
    ...preset,
    textType,
    width: finiteNumber(preset.width, `text type ${textType} width`, {
      positive: true,
    }),
    height: finiteNumber(preset.height, `text type ${textType} height`, {
      positive: true,
    }),
    spacing: finiteNumber(preset.spacing, `text type ${textType} spacing`, {
      minimum: 0,
    }),
    colorNumber: colorNumber(
      preset.colorNumber,
      `JWW text type ${textType} color number`
    ),
  };
}

export function hasOfficialJwwTextSettingsLayout(settings) {
  return Boolean(
    settings?.sourceLayout === JWW_TEXT_SETTINGS_SOURCE_LAYOUT &&
      Number.isInteger(settings?.sourceSpan?.start) &&
      Number.isInteger(settings?.sourceSpan?.end) &&
      settings.sourceSpan.end - settings.sourceSpan.start ===
        JWW_TEXT_SETTINGS_BYTE_LENGTH &&
      settings.sourceSpan.byteLength === JWW_TEXT_SETTINGS_BYTE_LENGTH &&
      Number.isInteger(settings?.presetSourceSpan?.start) &&
      Number.isInteger(settings?.presetSourceSpan?.end) &&
      settings.presetSourceSpan.end - settings.presetSourceSpan.start ===
        JWW_TEXT_TYPE_TABLE_BYTE_LENGTH &&
      settings.presetSourceSpan.byteLength === JWW_TEXT_TYPE_TABLE_BYTE_LENGTH
  );
}

export function normalizeJwwTextSettingsRecord(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw settingsError("JWW text settings must be an object");
  }
  if (!Array.isArray(settings.presets) || settings.presets.length !== 10) {
    throw settingsError("JWW text type table must contain exactly 10 presets");
  }
  return {
    ...settings,
    presets: settings.presets.map((preset, index) =>
      normalizePreset(preset, index + 1)
    ),
  };
}

function normalizedPresetEdits(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw settingsError("JWW text type edits must be an object keyed by text type");
  }
  const allowed = new Set(["width", "height", "spacing", "colorNumber"]);
  for (const [key, changes] of Object.entries(value)) {
    const textType = Number(key);
    if (!/^(?:[1-9]|10)$/.test(key) || textType < 1 || textType > 10) {
      throw settingsError(`Unknown JWW text type preset: ${key}`);
    }
    if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
      throw settingsError(`JWW text type edits must be an object: ${key}`);
    }
    for (const field of Object.keys(changes)) {
      if (!allowed.has(field)) {
        throw settingsError(`Unknown JWW text type field: ${key}.${field}`);
      }
    }
  }
  return value;
}

export function encodeJwwTextSettings(settings, edits = {}) {
  if (!hasOfficialJwwTextSettingsLayout(settings)) {
    throw settingsError(
      "JWW text settings are not backed by the verified official 312-byte source span"
    );
  }
  const revised = normalizeJwwTextSettingsRecord(settings);
  const presetEdits = normalizedPresetEdits(edits.textTypePresets);
  const presets = revised.presets.map((preset) => ({
    ...preset,
    ...(presetEdits[preset.textType] || {}),
  }));
  return normalizeJwwTextSettingsRecord({ ...revised, presets });
}

export function parseJwwTextSettings(
  data,
  { version, afterLayerNamesOffset = 0, entityListOffset } = {}
) {
  if (![600, 700].includes(Number(version))) return null;
  if (!Number.isInteger(entityListOffset)) return null;
  const start = entityListOffset - JWW_TEXT_SETTINGS_ENTITY_LIST_DISTANCE;
  const end = start + JWW_TEXT_SETTINGS_BYTE_LENGTH;
  if (
    start < Number(afterLayerNamesOffset || 0) ||
    start < 0 ||
    end > data.length
  ) {
    return null;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const presets = [];
  let cursor = start;
  try {
    for (let index = 0; index < JWW_TEXT_TYPE_COUNT; index += 1) {
      const textType = index + 1;
      presets.push(
        normalizePreset(
          {
            textType,
            width: view.getFloat64(cursor, true),
            height: view.getFloat64(cursor + 8, true),
            spacing: view.getFloat64(cursor + 16, true),
            colorNumber: view.getUint32(cursor + 24, true),
          },
          textType
        )
      );
      cursor += JWW_TEXT_TYPE_ROW_BYTE_LENGTH;
    }
    const rawTextType = view.getUint32(cursor + 28, true);
    const styleFlags = Math.floor(rawTextType / 10000);
    const current = {
      width: finiteNumber(view.getFloat64(cursor, true), "current text width", {
        positive: true,
      }),
      height: finiteNumber(view.getFloat64(cursor + 8, true), "current text height", {
        positive: true,
      }),
      spacing: finiteNumber(
        view.getFloat64(cursor + 16, true),
        "current text spacing",
        { minimum: 0 }
      ),
      colorNumber: colorNumber(
        view.getUint32(cursor + 24, true),
        "JWW current text color number"
      ),
      rawTextType,
      textType: rawTextType % 10000,
      italic: styleFlags === 1 || styleFlags === 3,
      bold: styleFlags === 2 || styleFlags === 3,
    };
    if (current.textType < 0 || current.textType > 10 || styleFlags > 3) {
      return null;
    }
    return normalizeJwwTextSettingsRecord({
      sourceLayout: JWW_TEXT_SETTINGS_SOURCE_LAYOUT,
      offset: start,
      byteLength: JWW_TEXT_SETTINGS_BYTE_LENGTH,
      presets,
      current,
      sourceSpan: {
        start,
        end,
        byteLength: JWW_TEXT_SETTINGS_BYTE_LENGTH,
      },
      presetSourceSpan: {
        start,
        end: start + JWW_TEXT_TYPE_TABLE_BYTE_LENGTH,
        byteLength: JWW_TEXT_TYPE_TABLE_BYTE_LENGTH,
      },
      currentSourceSpan: {
        start: start + JWW_TEXT_TYPE_TABLE_BYTE_LENGTH,
        end,
        byteLength: JWW_CURRENT_TEXT_SETTINGS_BYTE_LENGTH,
      },
    });
  } catch {
    return null;
  }
}
