// Installed Jw_cad 10.02.1 Sample.jwf, SHA-256:
// c6ca97617d4f2b037cec4c4c280c1bb5c963aa106d44cef37caf3aac8a6b8f38.
// Source review is intentionally separate from native behavioral verification.
const REVIEW = {
  source: "Sample.jwf",
  sourceSha256: "c6ca97617d4f2b037cec4c4c280c1bb5c963aa106d44cef37caf3aac8a6b8f38",
  sourceVersion: "Jw_cad 10.02.1",
  nativeEvidence: "unverified",
};
const commands = {
  COM_RV01: ["reservedAuto", "line", "rectangle", "arc", "text", "point", "dimension", "doubleLine", "centerLine", "polyline"],
  COM_RV11: ["offset", "reservedCorner", "reservedStretch", "chamfer", "reservedErase", "copy", "move", "tangent", "tangentCircle", "planJoinery"],
  COM_RV21: ["sectionJoinery", "elevationJoinery", "polygon", "curve", "reservedWrap", "divide", "reservedSymbol", "reservedDeform", "parametric", "reservedExternal"],
  COM_RV31: ["reservedMeasure", "reservedRegisteredSelection", "reservedSelection", "reservedPaste", "hatch", "reservedCleanup", "reservedCoordinates", "tangentEllipse", "reservedSpreadsheet", "reservedDistance"],
  COM_RV41: ["reservedExpression", "attributeChange", "solid"],
};
const commandLines = { COM_RV01: 139, COM_RV11: 142, COM_RV21: 145, COM_RV31: 148, COM_RV41: 151 };

export const JWF_OPTIONAL_KEYS = Object.freeze([
  "LD2_RV", "RD2_RV", ...Object.keys(commands), "COM_RV_C",
  ...Array.from({ length: 6 }, (_, i) => `R_CROSS_ST${i + 1}`),
  "TNKZ_SET", "TNK3_NM1", "TNK3_NM2", "TNKN_SET", "REF_FILE",
]);

export function optionalJwfDefinition(key) {
  let definition;
  if (key === "LD2_RV" || key === "RD2_RV") {
    definition = { label: `${key === "LD2_RV" ? "left" : "right"} clock-menu attribute switching`,
      valueSchema: Array.from({ length: 12 }, (_, i) => `hour${i}Enabled`), sourceLines: [121, 128],
      note: "0 disables and 1 enables each hour. Requires negative AUTO clock-menu switching distance. Jw_cad does not export this key to JWF." };
  } else if (Object.hasOwn(commands, key)) {
    definition = { label: "per-command clock-menu attribute switching", valueSchema: [...commands[key]], sourceLines: [130, commandLines[key]],
      note: "1 left, 2 right, 3 both. Reserved commands do not support switching. Text/dimension additionally accept 4 for left-drag movement direction. Not exported by Jw_cad to JWF." };
  } else if (key === "COM_RV_C") {
    definition = { label: "clock-menu attribute text colors", valueSchema: ["leftTensRightOnesPacked"], sourceLines: [153, 159],
      note: "Decimal tens: left; ones: right. 0 normal, 1 red text, 2 green background, 3 cyan background, 4 blue background, 5 white text on black. Requires negative AUTO switching distance." };
  } else if (/^R_CROSS_ST[1-6]$/.test(key)) {
    definition = { label: "graduated crossline unit glyph stroke", valueSchema: ["startX", "startY", "endX", "endY"], sourceLines: [673, 697],
      note: "Origin is top left; positive Y points down. Requires real-size graduated crossline and active non-mm units; meter mode ignores strokes. Prose says CROSS_ST1..30 but examples say R_CROSS_ST1..6; aliases and slots 7..30 remain unverified." };
  } else if (key === "TNKZ_SET") {
    definition = { label: "sky diagram settings", sourceLines: [1650, 1717], valueSchema: [
      "circleRadiusMm", "displayPrecisionTablePacked", "buildingPositionTableMode", "pointAndSolarColorsPacked", "textTypesPacked",
      "hatchPitchTenthsDegree", "hatchAndFrameColorsPacked", "gridColorAndComparisonThresholdPacked", "triangulationRadiusMm"],
    note: "Nine integers. First two values are ignored when loaded during the sky command. Native 10.02.1 save/reopen confirms radius maps to JWW m_dTenkuuZuDiameter / 2. Other field persistence and implicit defaults in omitted color/text digits remain unverified. Not exported by Jw_cad to JWF." };
  } else if (/^TNK3_NM[12]$/.test(key)) {
    definition = { label: key === "TNK3_NM1" ? "reference building table name" : "planned building table name", valueSchema: ["name"],
      sourceLines: key === "TNK3_NM1" ? [1719, 1721] : [1723, 1725], note: "Text following equals, limited to 20 Shift_JIS bytes. Preserve source Japanese text." };
  } else if (key === "TNKN_SET") {
    definition = { label: "building and triangle number affixes", sourceLines: [1727, 1744], valueSchema: [
      "referenceBuildingPrefix", "referenceBuildingSuffix", "plannedBuildingPrefix", "plannedBuildingSuffix",
      "referenceTrianglePrefix", "referenceTriangleSuffix", "plannedTrianglePrefix", "plannedTriangleSuffix"],
    note: "Eight comma-delimited strings, including empty strings. The documented six-byte limit is conservatively applied per item; native truncation and ^w rendering remain unverified." };
  } else if (key === "REF_FILE") {
    definition = { label: "print text reference file", valueSchema: ["fileName"], sourceLines: [1764, 1778],
      note: "External text file: %%token, TAB, replacement text. A bare filename resolves relative to the drawing. Replacement is for printing. Never automatically open this path or activate the sample placeholder. Not exported by Jw_cad to JWF." };
  }
  return definition ? { ...definition, evidence: { ...REVIEW,
    nativeEvidence: ["TNKZ_SET", "TNK3_NM1"].includes(key) ? "partial" : "unverified",
    nativeReport: "docs/JWF_OPTIONAL_KEYS_NATIVE_AUDIT.md",
  }, scope: "unknown" } : null;
}

export function parseOptionalJwfValue(key, value) {
  if (/^TNK3_NM[12]$/.test(key) || key === "REF_FILE") return [value];
  if (key === "TNKN_SET") return value.split(",").map((item) => item.trim());
  return undefined;
}

export function validateOptionalJwfValues(key, values, byteLength) {
  const definition = optionalJwfDefinition(key);
  if (!definition) return [];
  if (values.length !== definition.valueSchema.length) return [`${key} requires ${definition.valueSchema.length} values.`];
  const errors = [];
  const fail = (message) => errors.push(`${key}: ${message}`);
  if (/^TNK3_NM[12]$/.test(key) || key === "REF_FILE" || key === "TNKN_SET") {
    const limit = key === "TNKN_SET" ? 6 : key === "REF_FILE" ? null : 20;
    for (const value of values) {
      if (typeof value !== "string" || /[\r\n\t#"]/u.test(value) || (key === "TNKN_SET" && value.includes(","))) {
        fail("Unsupported text delimiter; no quoting or escaping is assumed.");
      } else if (limit !== null && byteLength(value) > limit) {
        fail(`Text exceeds the reviewed ${limit}-byte Shift_JIS limit.`);
      }
    }
    if (key === "REF_FILE" && !values[0]) fail("A reference filename is required.");
    return errors;
  }
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) return [`${key}: Finite numeric values are required.`];
  if (/^R_CROSS_ST/.test(key)) {
    // No undocumented coordinate bounds or integer-only restriction.
    return errors;
  }
  if (values.some((value) => !Number.isSafeInteger(value))) return [`${key}: Integer values are required.`];
  if (key === "LD2_RV" || key === "RD2_RV") {
    if (values.some((value) => value !== 0 && value !== 1)) fail("Hour switches must be 0 or 1.");
  } else if (Object.hasOwn(commands, key)) {
    commands[key].forEach((command, i) => {
      const allowed = command.startsWith("reserved") ? [0] : command === "text" || command === "dimension" ? [1, 2, 3, 4] : [1, 2, 3];
      if (!allowed.includes(values[i])) fail(`Unverified value for ${command}.`);
    });
  } else if (key === "COM_RV_C") {
    if (values[0] < 0 || values[0] > 55 || values[0] % 10 > 5) fail("Both packed color digits must be 0..5.");
  } else if (key === "TNKZ_SET") {
    if (!(values[0] === 0 || (values[0] >= 10 && values[0] <= 500))) fail("Circle radius must be 0 or 10..500 mm.");
    if (!/^[01]{1,4}$/.test(String(values[1]))) fail("The four packed display flags must be 0 or 1.");
    if (![0, 1].includes(values[2])) fail("Building-position table mode must be 0 or 1.");
    if (values[3] < 0 || values[3] > 999) fail("Point/solar color packing must fit three decimal digits.");
    if (values[4] < 1 || values[4] > 1010 || values[4] % 100 > 10) fail("Text type packing is outside the reviewed range.");
    if (values[5] < 1 || values[5] > 100) fail("Hatch pitch must be 1..100 tenths of a degree.");
    if (values[6] < 0 || values[6] > 99) fail("Hatch/frame color packing must fit two decimal digits.");
    if (values[7] < 0 || values[7] > 10009) fail("Grid/threshold packing is outside the reviewed range.");
    if (values[8] < 10 || values[8] > 500) fail("Triangulation radius must be 10..500 mm.");
  }
  return errors;
}

export function formatOptionalJwfValues(key, values, byteLength) {
  if (!optionalJwfDefinition(key)) return undefined;
  const errors = validateOptionalJwfValues(key, values, byteLength);
  if (errors.length) throw new Error(errors.join(" "));
  if (key === "TNKN_SET") return values.join(",");
  return values.join(" ");
}
