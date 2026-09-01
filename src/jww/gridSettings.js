export const JWW_GRID_EDIT_KEYS = Object.freeze([
  "gridMode",
  "gridMinimumDisplaySpacing",
  "gridSpacingX",
  "gridSpacingY",
  "gridBaseX",
  "gridBaseY",
]);

export const JWW_GRID_MODE_OPTIONS = Object.freeze([
  {
    value: 0,
    label: "Hidden · drawing units · snapping enabled (0)",
  },
  {
    value: 1,
    label: "Displayed · drawing units · snapping enabled (1)",
  },
  {
    value: 10,
    label: "Hidden · real-size units · snapping enabled (10)",
  },
  {
    value: 11,
    label: "Displayed · real-size units · snapping enabled (11)",
  },
  {
    value: -1,
    label: "Displayed · drawing units · snapping disabled (-1)",
  },
  {
    value: -10,
    label: "Hidden · real-size units · snapping disabled (-10)",
  },
  {
    value: -11,
    label: "Displayed · real-size units · snapping disabled (-11)",
  },
]);

const GRID_MODES = new Set(JWW_GRID_MODE_OPTIONS.map((option) => option.value));

function gridError(message) {
  const error = new Error(message);
  error.code = "JWW_GRID_SETTINGS_INVALID";
  return error;
}

function normalizedMode(value) {
  const mode = Number(value);
  if (!Number.isInteger(mode) || !GRID_MODES.has(mode)) {
    throw gridError(`Unsupported JWW grid mode: ${value}`);
  }
  return mode;
}

function finiteNumber(value, label, { nonNegative = false, positive = false } = {}) {
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    (nonNegative && number < 0) ||
    (positive && number <= 0)
  ) {
    const suffix = positive
      ? " must be greater than zero"
      : nonNegative
        ? " must be zero or greater"
        : " must be finite";
    throw gridError(`JWW ${label}${suffix}: ${value}`);
  }
  return number;
}

export function normalizeJwwGridSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw gridError("JWW grid settings must be an object");
  }
  const minimumDisplaySpacing = finiteNumber(
    value.minimum_display_spacing,
    "minimum grid display spacing"
  );
  if (minimumDisplaySpacing < 5 || minimumDisplaySpacing > 100) {
    throw gridError(
      `JWW minimum grid display spacing must be between 5 and 100 dots: ${value.minimum_display_spacing}`
    );
  }
  return {
    mode: normalizedMode(value.mode),
    minimum_display_spacing: minimumDisplaySpacing,
    spacing_x: finiteNumber(value.spacing_x, "grid spacing X", {
      positive: true,
    }),
    spacing_y: finiteNumber(value.spacing_y, "grid spacing Y", {
      positive: true,
    }),
    base_x: finiteNumber(value.base_x, "grid base X"),
    base_y: finiteNumber(value.base_y, "grid base Y"),
  };
}

export function decodeJwwGridSettings(value) {
  const settings = normalizeJwwGridSettings(value);
  const absoluteMode = Math.abs(settings.mode);
  return {
    ...settings,
    display: absoluteMode % 10 === 1,
    realSizeUnits: Math.floor(absoluteMode / 10) === 1,
    snapping: settings.mode >= 0,
  };
}

export function encodeJwwGridSettings(settings, edits = {}) {
  const current = normalizeJwwGridSettings(settings);
  const next = {
    mode: Object.hasOwn(edits, "gridMode") ? edits.gridMode : current.mode,
    minimum_display_spacing: Object.hasOwn(edits, "gridMinimumDisplaySpacing")
      ? edits.gridMinimumDisplaySpacing
      : current.minimum_display_spacing,
    spacing_x: Object.hasOwn(edits, "gridSpacingX")
      ? edits.gridSpacingX
      : current.spacing_x,
    spacing_y: Object.hasOwn(edits, "gridSpacingY")
      ? edits.gridSpacingY
      : current.spacing_y,
    base_x: Object.hasOwn(edits, "gridBaseX") ? edits.gridBaseX : current.base_x,
    base_y: Object.hasOwn(edits, "gridBaseY") ? edits.gridBaseY : current.base_y,
  };
  return { ...settings, ...normalizeJwwGridSettings(next) };
}
