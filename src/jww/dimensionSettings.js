export const JWW_DIMENSION_EDIT_KEYS = Object.freeze([
  "dimensionLineColor",
  "dimensionExtensionLineColor",
  "dimensionPointColor",
  "dimensionDecimalPlaces",
  "dimensionUnit",
  "dimensionEndpointStyle",
  "dimensionTextType",
  "dimensionValueOffset",
  "dimensionExtensionProjection",
  "dimensionArrowLength",
  "dimensionArrowAngle",
  "dimensionReverseArrowProjection",
  "dimensionDirectionCorrection",
  "dimensionFullWidthText",
  "dimensionCommaAsSpace",
  "dimensionFullWidthComma",
  "dimensionFullWidthDecimalPoint",
  "dimensionShowUnit",
  "dimensionRadiusMarkPosition",
  "dimensionRadiusComma",
  "dimensionRadiusTrailingZero",
  "dimensionItalicText",
  "dimensionBoldText",
  "dimensionAngleUnit",
  "dimensionAngleDecimalPlaces",
  "dimensionCreateEntity",
  "dimensionSelectByLineAttributes",
  "dimensionDecimalHandling",
]);

const PACKED_KEYS = Object.freeze([
  "sunpou1",
  "sunpou2",
  "sunpou3",
  "sunpou4",
  "sunpou5",
]);

function packedInteger(value, key) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 0xffffffff) {
    throw new Error(`JWW ${key} must be an unsigned 32-bit integer: ${value}`);
  }
  return number;
}

function digit(value, power) {
  return Math.floor(value / 10 ** power) % 10;
}

function decodedSignedTenths(value) {
  return value >= 1000 ? -(value - 1000) / 10 : value / 10;
}

function encodedSignedTenths(value, label) {
  const number = decimalStep(value, label, -99.9, 99.9);
  const tenths = Math.round(Math.abs(number) * 10);
  return number < 0 ? 1000 + tenths : tenths;
}

function rangedInteger(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(
      `JWW ${label} must be an integer from ${minimum} through ${maximum}: ${value}`
    );
  }
  return number;
}

function decimalStep(value, label, minimum, maximum) {
  const number = Number(value);
  const tenths = Math.round(number * 10);
  if (
    !Number.isFinite(number) ||
    number < minimum ||
    number > maximum ||
    Math.abs(number * 10 - tenths) > 1e-9
  ) {
    throw new Error(
      `JWW ${label} must be from ${minimum} through ${maximum} in 0.1 increments: ${value}`
    );
  }
  return tenths / 10;
}

function editValue(edits, key, fallback, normalize) {
  return Object.hasOwn(edits, key) ? normalize(edits[key]) : fallback;
}

function packDecodedDimensionSettings(value) {
  const sunpou1 =
    value.lineColor +
    value.extensionLineColor * 10 +
    value.pointColor * 100 +
    value.decimalPlaces * 1000 +
    value.unit * 10000 +
    value.endpointStyle * 100000 +
    value.textType * 1000000;
  const sunpou2 =
    encodedSignedTenths(value.valueOffset, "dimension value offset") +
    encodedSignedTenths(
      value.extensionProjection,
      "dimension extension-line projection"
    ) *
      10000;
  const sunpou3 =
    Math.round(value.arrowLength * 10) +
    Math.round(value.arrowAngle * 10) * 1000 +
    Math.round(value.reverseArrowProjection * 10) * 1000000;
  const sunpou4 =
    value.directionCorrection +
    value.fullWidthText * 10 +
    value.commaAsSpace * 100 +
    value.fullWidthComma * 1000 +
    value.fullWidthDecimalPoint * 10000 +
    value.showUnit * 100000 +
    value.radiusMarkPosition * 1000000 +
    value.radiusComma * 10000000 +
    value.radiusTrailingZero * 100000000;
  const sunpou5 =
    value.italicText +
    value.boldText * 10 +
    value.angleUnit * 100 +
    value.angleDecimalPlaces * 1000 +
    value.createEntity * 10000 +
    value.selectByLineAttributes * 100000 +
    value.decimalHandling * 1000000;
  return { sunpou1, sunpou2, sunpou3, sunpou4, sunpou5 };
}

export function decodeJwwDimensionSettings(settings = {}) {
  const sunpou1 = packedInteger(settings.sunpou1 ?? 0, "sunpou1");
  const sunpou2 = packedInteger(settings.sunpou2 ?? 0, "sunpou2");
  const sunpou3 = packedInteger(settings.sunpou3 ?? 0, "sunpou3");
  const sunpou4 = packedInteger(settings.sunpou4 ?? 0, "sunpou4");
  const sunpou5 = packedInteger(settings.sunpou5 ?? 0, "sunpou5");
  return {
    lineColor: digit(sunpou1, 0),
    extensionLineColor: digit(sunpou1, 1),
    pointColor: digit(sunpou1, 2),
    decimalPlaces: digit(sunpou1, 3),
    unit: digit(sunpou1, 4),
    endpointStyle: digit(sunpou1, 5),
    textType: Math.floor(sunpou1 / 1000000),
    valueOffset: decodedSignedTenths(sunpou2 % 10000),
    extensionProjection: decodedSignedTenths(
      Math.floor(sunpou2 / 10000) % 10000
    ),
    arrowLength: (sunpou3 % 1000) / 10,
    arrowAngle: (Math.floor(sunpou3 / 1000) % 1000) / 10,
    reverseArrowProjection: Math.floor(sunpou3 / 1000000) / 10,
    directionCorrection: digit(sunpou4, 0),
    fullWidthText: digit(sunpou4, 1),
    commaAsSpace: digit(sunpou4, 2),
    fullWidthComma: digit(sunpou4, 3),
    fullWidthDecimalPoint: digit(sunpou4, 4),
    showUnit: digit(sunpou4, 5),
    radiusMarkPosition: digit(sunpou4, 6),
    radiusComma: digit(sunpou4, 7),
    radiusTrailingZero: digit(sunpou4, 8),
    italicText: digit(sunpou5, 0),
    boldText: digit(sunpou5, 1),
    angleUnit: digit(sunpou5, 2),
    angleDecimalPlaces: digit(sunpou5, 3),
    createEntity: digit(sunpou5, 4),
    selectByLineAttributes: digit(sunpou5, 5),
    decimalHandling: digit(sunpou5, 6),
  };
}

function assertDocumentedEncoding(settings, decoded) {
  const integerRanges = [
    ["lineColor", 0, 9],
    ["extensionLineColor", 0, 9],
    ["pointColor", 0, 9],
    ["decimalPlaces", 0, 3],
    ["unit", 0, 1],
    ["endpointStyle", 0, 2],
    ["textType", 0, 10],
    ["directionCorrection", 0, 1],
    ["fullWidthText", 0, 1],
    ["commaAsSpace", 0, 1],
    ["fullWidthComma", 0, 1],
    ["fullWidthDecimalPoint", 0, 1],
    ["showUnit", 0, 1],
    ["radiusMarkPosition", 0, 2],
    ["radiusComma", 0, 1],
    ["radiusTrailingZero", 0, 1],
    ["italicText", 0, 1],
    ["boldText", 0, 1],
    ["angleUnit", 0, 2],
    ["angleDecimalPlaces", 0, 6],
    ["createEntity", 0, 1],
    ["selectByLineAttributes", 0, 1],
    ["decimalHandling", 0, 2],
  ];
  for (const [key, minimum, maximum] of integerRanges) {
    if (decoded[key] < minimum || decoded[key] > maximum) {
      throw new Error(
        `JWW dimension setting ${key} is outside the documented range: ${decoded[key]}`
      );
    }
  }
  if (
    decoded.arrowLength < 0 ||
    decoded.arrowLength > 99.9 ||
    decoded.arrowAngle < 0 ||
    decoded.arrowAngle > 80 ||
    decoded.reverseArrowProjection < 0 ||
    decoded.reverseArrowProjection > 99.9
  ) {
    throw new Error("JWW dimension arrow settings are outside the documented ranges");
  }
  const repacked = packDecodedDimensionSettings(decoded);
  for (const key of PACKED_KEYS) {
    if (repacked[key] !== Number(settings[key] ?? 0)) {
      throw new Error(
        `JWW ${key} contains undocumented packed digits and cannot be edited safely`
      );
    }
  }
}

export function encodeJwwDimensionSettings(settings = {}, edits = {}) {
  const decoded = decodeJwwDimensionSettings(settings);
  assertDocumentedEncoding(settings, decoded);
  const revised = {
    lineColor: editValue(edits, "dimensionLineColor", decoded.lineColor, (value) =>
      rangedInteger(value, "dimension line color", 0, 9)
    ),
    extensionLineColor: editValue(
      edits,
      "dimensionExtensionLineColor",
      decoded.extensionLineColor,
      (value) => rangedInteger(value, "dimension extension-line color", 0, 9)
    ),
    pointColor: editValue(edits, "dimensionPointColor", decoded.pointColor, (value) =>
      rangedInteger(value, "dimension point color", 0, 9)
    ),
    decimalPlaces: editValue(
      edits,
      "dimensionDecimalPlaces",
      decoded.decimalPlaces,
      (value) => rangedInteger(value, "dimension decimal places", 0, 3)
    ),
    unit: editValue(edits, "dimensionUnit", decoded.unit, (value) =>
      rangedInteger(value, "dimension unit", 0, 1)
    ),
    endpointStyle: editValue(
      edits,
      "dimensionEndpointStyle",
      decoded.endpointStyle,
      (value) => rangedInteger(value, "dimension endpoint style", 0, 2)
    ),
    textType: editValue(edits, "dimensionTextType", decoded.textType, (value) =>
      rangedInteger(value, "dimension text type", 0, 10)
    ),
    valueOffset: editValue(
      edits,
      "dimensionValueOffset",
      decoded.valueOffset,
      (value) => decimalStep(value, "dimension value offset", -99.9, 99.9)
    ),
    extensionProjection: editValue(
      edits,
      "dimensionExtensionProjection",
      decoded.extensionProjection,
      (value) =>
        decimalStep(value, "dimension extension-line projection", -99.9, 99.9)
    ),
    arrowLength: editValue(
      edits,
      "dimensionArrowLength",
      decoded.arrowLength,
      (value) => decimalStep(value, "dimension arrow length", 0, 99.9)
    ),
    arrowAngle: editValue(edits, "dimensionArrowAngle", decoded.arrowAngle, (value) =>
      decimalStep(value, "dimension arrow angle", 0.1, 80)
    ),
    reverseArrowProjection: editValue(
      edits,
      "dimensionReverseArrowProjection",
      decoded.reverseArrowProjection,
      (value) => decimalStep(value, "reverse-arrow projection", 0, 99.9)
    ),
    directionCorrection: editValue(
      edits,
      "dimensionDirectionCorrection",
      decoded.directionCorrection,
      (value) => rangedInteger(value, "dimension direction-correction flag", 0, 1)
    ),
    fullWidthText: editValue(
      edits,
      "dimensionFullWidthText",
      decoded.fullWidthText,
      (value) => rangedInteger(value, "dimension full-width text flag", 0, 1)
    ),
    commaAsSpace: editValue(
      edits,
      "dimensionCommaAsSpace",
      decoded.commaAsSpace,
      (value) => rangedInteger(value, "dimension comma-as-space flag", 0, 1)
    ),
    fullWidthComma: editValue(
      edits,
      "dimensionFullWidthComma",
      decoded.fullWidthComma,
      (value) => rangedInteger(value, "dimension full-width comma flag", 0, 1)
    ),
    fullWidthDecimalPoint: editValue(
      edits,
      "dimensionFullWidthDecimalPoint",
      decoded.fullWidthDecimalPoint,
      (value) => rangedInteger(value, "dimension full-width decimal-point flag", 0, 1)
    ),
    showUnit: editValue(edits, "dimensionShowUnit", decoded.showUnit, (value) =>
      rangedInteger(value, "dimension show-unit flag", 0, 1)
    ),
    radiusMarkPosition: editValue(
      edits,
      "dimensionRadiusMarkPosition",
      decoded.radiusMarkPosition,
      (value) => rangedInteger(value, "dimension radius-mark position", 0, 2)
    ),
    radiusComma: editValue(
      edits,
      "dimensionRadiusComma",
      decoded.radiusComma,
      (value) => rangedInteger(value, "dimension radius comma flag", 0, 1)
    ),
    radiusTrailingZero: editValue(
      edits,
      "dimensionRadiusTrailingZero",
      decoded.radiusTrailingZero,
      (value) => rangedInteger(value, "dimension radius trailing-zero flag", 0, 1)
    ),
    italicText: editValue(
      edits,
      "dimensionItalicText",
      decoded.italicText,
      (value) => rangedInteger(value, "dimension italic-text flag", 0, 1)
    ),
    boldText: editValue(edits, "dimensionBoldText", decoded.boldText, (value) =>
      rangedInteger(value, "dimension bold-text flag", 0, 1)
    ),
    angleUnit: editValue(edits, "dimensionAngleUnit", decoded.angleUnit, (value) =>
      rangedInteger(value, "dimension angle unit", 0, 2)
    ),
    angleDecimalPlaces: editValue(
      edits,
      "dimensionAngleDecimalPlaces",
      decoded.angleDecimalPlaces,
      (value) => rangedInteger(value, "dimension angle decimal places", 0, 6)
    ),
    createEntity: editValue(
      edits,
      "dimensionCreateEntity",
      decoded.createEntity,
      (value) => rangedInteger(value, "dimension-entity flag", 0, 1)
    ),
    selectByLineAttributes: editValue(
      edits,
      "dimensionSelectByLineAttributes",
      decoded.selectByLineAttributes,
      (value) => rangedInteger(value, "dimension attribute-selection flag", 0, 1)
    ),
    decimalHandling: editValue(
      edits,
      "dimensionDecimalHandling",
      decoded.decimalHandling,
      (value) => rangedInteger(value, "dimension decimal handling", 0, 2)
    ),
  };
  return { ...settings, ...packDecodedDimensionSettings(revised) };
}
