export const JWW_COLOR_SETTINGS_SOURCE_LAYOUT =
  "jwdatafmt-color-tables-v600-v700";

export const JWW_COLOR_EDIT_KEYS = Object.freeze([
  "backgroundColor",
  "backgroundLineWidth",
  "screenColors",
  "screenColorWidths",
  "printBackgroundColor",
  "printBackgroundLineWidth",
  "printBackgroundPointRadius",
  "printColors",
  "printColorWidths",
  "printPointRadii",
]);

function settingsError(message) {
  const error = new Error(message);
  error.code = "JWW_COLOR_SETTINGS_INVALID";
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

function normalizedRadius(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0.1 || number > 10) {
    throw settingsError(`${label} must be from 0.1 to 10: ${value}`);
  }
  return number;
}

export function jwwColorHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((value) => normalizedInteger(value, 0, 255, "JWW RGB component"))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function colorFromHex(value, label) {
  const text = String(value ?? "").trim().toLowerCase();
  const match = text.match(/^#?([0-9a-f]{6})$/);
  if (!match) throw settingsError(`${label} must use #RRGGBB: ${value}`);
  return {
    red: Number.parseInt(match[1].slice(0, 2), 16),
    green: Number.parseInt(match[1].slice(2, 4), 16),
    blue: Number.parseInt(match[1].slice(4, 6), 16),
    hex: `#${match[1]}`,
  };
}

function normalizeColorEntry(entry, label, { print = false } = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw settingsError(`${label} is unavailable`);
  }
  const red = normalizedInteger(entry.red, 0, 255, `${label} red`);
  const green = normalizedInteger(entry.green, 0, 255, `${label} green`);
  const blue = normalizedInteger(entry.blue, 0, 255, `${label} blue`);
  const hex = jwwColorHex(red, green, blue);
  if (entry.hex !== undefined && String(entry.hex).toLowerCase() !== hex) {
    throw settingsError(`${label} hex does not match its RGB components`);
  }
  const width = normalizedInteger(
    entry.width,
    1,
    print ? 500 : 16,
    `${label} width`
  );
  return {
    ...entry,
    red,
    green,
    blue,
    width,
    hex,
    ...(print
      ? { pointRadius: normalizedRadius(entry.pointRadius, `${label} point radius`) }
      : {}),
  };
}

function normalizeIndexedColors(value, label, options) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw settingsError(`${label} table is unavailable`);
  }
  const keys = Object.keys(value).sort((left, right) => Number(left) - Number(right));
  const expected = Array.from({ length: 9 }, (_, index) => String(index + 1));
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw settingsError(`${label} table must contain exactly color numbers 1 through 9`);
  }
  return Object.fromEntries(
    expected.map((key) => [
      key,
      normalizeColorEntry(value[key], `${label} ${key}`, options),
    ])
  );
}

export function hasOfficialJwwColorSettingsLayout(settings) {
  return Boolean(
    settings?.sourceLayout === JWW_COLOR_SETTINGS_SOURCE_LAYOUT &&
      Number.isInteger(settings?.sourceSpan?.start) &&
      Number.isInteger(settings?.sourceSpan?.end) &&
      settings.sourceSpan.end - settings.sourceSpan.start === 240 &&
      settings.sourceSpan.byteLength === 240
  );
}

export function normalizeJwwColorSettingsRecord(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw settingsError("JWW color settings must be an object");
  }
  return {
    ...settings,
    backgroundColor: normalizeColorEntry(
      settings.backgroundColor,
      "JWW screen background"
    ),
    screenColors: normalizeIndexedColors(
      settings.screenColors,
      "JWW screen color",
      { print: false }
    ),
    printBackgroundColor: normalizeColorEntry(
      settings.printBackgroundColor,
      "JWW print background",
      { print: true }
    ),
    printColors: normalizeIndexedColors(
      settings.printColors,
      "JWW print color",
      { print: true }
    ),
  };
}

function normalizedEditMap(value, label) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw settingsError(`${label} edits must be an object keyed by color number`);
  }
  for (const key of Object.keys(value)) {
    if (!/^[1-9]$/.test(key)) {
      throw settingsError(`${label} color number must be 1 through 9: ${key}`);
    }
  }
  return value;
}

function withEditedHex(entry, value, label) {
  return { ...entry, ...colorFromHex(value, label) };
}

export function encodeJwwColorSettings(settings, edits = {}) {
  if (!hasOfficialJwwColorSettingsLayout(settings)) {
    throw settingsError(
      "JWW color settings are not backed by the verified official 240-byte source span"
    );
  }
  let revised = normalizeJwwColorSettingsRecord(settings);
  if (Object.hasOwn(edits, "backgroundColor")) {
    revised = {
      ...revised,
      backgroundColor: withEditedHex(
        revised.backgroundColor,
        edits.backgroundColor,
        "JWW screen background"
      ),
    };
  }
  if (Object.hasOwn(edits, "backgroundLineWidth")) {
    revised = {
      ...revised,
      backgroundColor: {
        ...revised.backgroundColor,
        width: edits.backgroundLineWidth,
      },
    };
  }
  if (Object.hasOwn(edits, "printBackgroundColor")) {
    revised = {
      ...revised,
      printBackgroundColor: withEditedHex(
        revised.printBackgroundColor,
        edits.printBackgroundColor,
        "JWW print background"
      ),
    };
  }
  if (Object.hasOwn(edits, "printBackgroundLineWidth")) {
    revised = {
      ...revised,
      printBackgroundColor: {
        ...revised.printBackgroundColor,
        width: edits.printBackgroundLineWidth,
      },
    };
  }
  if (Object.hasOwn(edits, "printBackgroundPointRadius")) {
    revised = {
      ...revised,
      printBackgroundColor: {
        ...revised.printBackgroundColor,
        pointRadius: edits.printBackgroundPointRadius,
      },
    };
  }

  const screenColors = { ...revised.screenColors };
  for (const [key, value] of Object.entries(
    normalizedEditMap(edits.screenColors, "JWW screen color")
  )) {
    screenColors[key] = withEditedHex(
      screenColors[key],
      value,
      `JWW screen color ${key}`
    );
  }
  for (const [key, value] of Object.entries(
    normalizedEditMap(edits.screenColorWidths, "JWW screen width")
  )) {
    screenColors[key] = { ...screenColors[key], width: value };
  }

  const printColors = { ...revised.printColors };
  for (const [key, value] of Object.entries(
    normalizedEditMap(edits.printColors, "JWW print color")
  )) {
    printColors[key] = withEditedHex(
      printColors[key],
      value,
      `JWW print color ${key}`
    );
  }
  for (const [key, value] of Object.entries(
    normalizedEditMap(edits.printColorWidths, "JWW print width")
  )) {
    printColors[key] = { ...printColors[key], width: value };
  }
  for (const [key, value] of Object.entries(
    normalizedEditMap(edits.printPointRadii, "JWW print point radius")
  )) {
    printColors[key] = { ...printColors[key], pointRadius: value };
  }

  return normalizeJwwColorSettingsRecord({
    ...revised,
    screenColors,
    printColors,
  });
}
