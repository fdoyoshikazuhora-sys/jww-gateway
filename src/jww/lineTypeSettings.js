export const JWW_LINE_TYPE_SETTINGS_SOURCE_LAYOUT =
  "jwdatafmt-line-type-tables-v600-v700";

export const JWW_LINE_TYPE_SETTINGS_BYTE_LENGTH = 292;

const ordinaryFields = Object.freeze([
  Object.freeze({ key: "unitDotCount", minimum: 1, maximum: 32 }),
  Object.freeze({ key: "screenPitch", minimum: 1, maximum: 16 }),
  Object.freeze({ key: "printPitch", minimum: 1, maximum: 160 }),
]);

const randomFields = Object.freeze([
  Object.freeze({ key: "screenAmplitude", minimum: 1, maximum: 16 }),
  Object.freeze({ key: "screenPitch", minimum: 1, maximum: 16 }),
  Object.freeze({ key: "printAmplitude", minimum: 1, maximum: 16 }),
  Object.freeze({ key: "printPitch", minimum: 1, maximum: 160 }),
]);

export const JWW_LINE_TYPE_ROW_DEFINITIONS = Object.freeze([
  ...Array.from({ length: 8 }, (_, index) =>
    Object.freeze({
      key: `LTYPE_${String(index + 2).padStart(2, "0")}`,
      family: "ordinary",
      fields: ordinaryFields,
    })
  ),
  ...Array.from({ length: 5 }, (_, index) =>
    Object.freeze({
      key: `LTYPE_R${index + 1}`,
      family: "random",
      fields: randomFields,
    })
  ),
  ...Array.from({ length: 4 }, (_, index) =>
    Object.freeze({
      key: `LTYPE_L${index + 1}`,
      family: "doubled",
      fields: ordinaryFields,
    })
  ),
]);

export const JWW_LINE_TYPE_EDIT_KEYS = Object.freeze(["lineTypeRows"]);

function settingsError(message) {
  const error = new Error(message);
  error.code = "JWW_LINE_TYPE_SETTINGS_INVALID";
  return error;
}

function normalizedInteger(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw settingsError(
      `${label} must be an integer from ${minimum} to ${maximum}: ${value}`
    );
  }
  return number;
}

function normalizedPattern(value, label) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(text)) {
    throw settingsError(`${label} must use exactly eight hexadecimal digits: ${value}`);
  }
  return text;
}

function definitionMap() {
  return new Map(
    JWW_LINE_TYPE_ROW_DEFINITIONS.map((definition) => [definition.key, definition])
  );
}

function normalizeRow(entry, definition) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw settingsError(`JWW line type row is unavailable: ${definition.key}`);
  }
  const pattern = normalizedPattern(entry.pattern, `${definition.key} pattern`);
  const params = definition.fields.map((field) =>
    normalizedInteger(
      entry[field.key],
      field.minimum,
      field.maximum,
      `${definition.key} ${field.key}`
    )
  );
  if (
    entry.params !== undefined &&
    (!Array.isArray(entry.params) ||
      entry.params.length !== params.length ||
      entry.params.some((value, index) => Number(value) !== params[index]))
  ) {
    throw settingsError(`${definition.key} params do not match its named fields`);
  }
  if (
    entry.values !== undefined &&
    (!Array.isArray(entry.values) ||
      entry.values.length !== params.length + 1 ||
      String(entry.values[0]).toLowerCase() !== pattern ||
      entry.values.slice(1).some((value, index) => Number(value) !== params[index]))
  ) {
    throw settingsError(`${definition.key} values do not match its named fields`);
  }
  return {
    ...entry,
    pattern,
    ...Object.fromEntries(
      definition.fields.map((field, index) => [field.key, params[index]])
    ),
    params,
    values: [pattern, ...params],
  };
}

export function hasOfficialJwwLineTypeSettingsLayout(settings) {
  return Boolean(
    settings?.sourceLayout === JWW_LINE_TYPE_SETTINGS_SOURCE_LAYOUT &&
      Number.isInteger(settings?.sourceSpan?.start) &&
      Number.isInteger(settings?.sourceSpan?.end) &&
      settings.sourceSpan.end - settings.sourceSpan.start ===
        JWW_LINE_TYPE_SETTINGS_BYTE_LENGTH &&
      settings.sourceSpan.byteLength === JWW_LINE_TYPE_SETTINGS_BYTE_LENGTH
  );
}

export function normalizeJwwLineTypeSettingsRecord(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw settingsError("JWW line type settings must be an object");
  }
  const rows = settings.rows;
  if (!rows || typeof rows !== "object" || Array.isArray(rows)) {
    throw settingsError("JWW line type rows are unavailable");
  }
  const expectedKeys = JWW_LINE_TYPE_ROW_DEFINITIONS.map(({ key }) => key);
  const actualKeys = Object.keys(rows);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key) => !expectedKeys.includes(key))
  ) {
    throw settingsError("JWW line type table must contain exactly the official 17 rows");
  }
  return {
    ...settings,
    rows: Object.fromEntries(
      JWW_LINE_TYPE_ROW_DEFINITIONS.map((definition) => [
        definition.key,
        normalizeRow(rows[definition.key], definition),
      ])
    ),
  };
}

function normalizedRowEdits(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw settingsError("JWW line type edits must be an object keyed by row name");
  }
  const definitions = definitionMap();
  for (const [key, rowEdits] of Object.entries(value)) {
    const definition = definitions.get(key);
    if (!definition) throw settingsError(`Unknown JWW line type row: ${key}`);
    if (!rowEdits || typeof rowEdits !== "object" || Array.isArray(rowEdits)) {
      throw settingsError(`JWW line type row edits must be an object: ${key}`);
    }
    const allowedFields = new Set([
      "pattern",
      ...definition.fields.map((field) => field.key),
    ]);
    for (const field of Object.keys(rowEdits)) {
      if (!allowedFields.has(field)) {
        throw settingsError(`Unknown JWW line type field: ${key}.${field}`);
      }
    }
  }
  return value;
}

export function encodeJwwLineTypeSettings(settings, edits = {}) {
  if (!hasOfficialJwwLineTypeSettingsLayout(settings)) {
    throw settingsError(
      "JWW line type settings are not backed by the verified official 292-byte source span"
    );
  }
  const revised = normalizeJwwLineTypeSettingsRecord(settings);
  const rowEdits = normalizedRowEdits(edits.lineTypeRows);
  const rows = { ...revised.rows };
  for (const [key, changes] of Object.entries(rowEdits)) {
    const { params: _params, values: _values, ...row } = rows[key];
    rows[key] = { ...row, ...changes };
  }
  return normalizeJwwLineTypeSettingsRecord({ ...revised, rows });
}
