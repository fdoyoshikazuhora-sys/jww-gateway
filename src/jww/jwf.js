const DEFAULT_ENCODING = "shift_jis";
const JWF_HEX_KEYS = "0123456789ABCDEF".split("");

export const JWF_ONLY_OPERATION_KEYS = [
  "LTYPE_HC",
  "LCOLLOR_M",
  ...JWF_HEX_KEYS.flatMap((groupKey) => [
    `LAYCOL_${groupKey}`,
    `LAYWID_${groupKey}`,
    `LAYTYP_${groupKey}`,
  ]),
];

export function isJwfOnlyOperationKey(key) {
  return JWF_ONLY_OPERATION_KEYS.includes(key);
}

function decodeBytes(bytes, encoding = DEFAULT_ENCODING) {
  const data = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
  try {
    return new TextDecoder(encoding).decode(data);
  } catch {
    return new TextDecoder(DEFAULT_ENCODING).decode(data);
  }
}

function stripInlineComment(value) {
  const text = String(value || "");
  let inQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\"") inQuote = !inQuote;
    if (!inQuote && char === "#") return text.slice(0, index).trimEnd();
  }
  return text.trimEnd();
}

function parseToken(token) {
  const text = String(token || "").trim();
  if (!text) return "";
  if (/^[-+]?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (/^[0-9A-Fa-f]{2}$/.test(text)) return text.toUpperCase();
  return text;
}

function parseValue(rawValue) {
  const value = stripInlineComment(rawValue).trim();
  if (!value) return [];
  if (value.includes(",")) {
    return value.split(",").map((item) => parseToken(item));
  }
  const matches = value.match(/"[^"]*"|\S+/g) || [];
  return matches.map((item) => {
    const text = item.replace(/^"|"$/g, "");
    return parseToken(text);
  });
}

function familyForKey(key) {
  if (/^S_COMM_/.test(key)) return "general";
  if (/^LCOLLOR_/.test(key)) return "screenColors";
  if (/^PCOLLOR_/.test(key)) return "printColors";
  if (/^LTYPE_/.test(key)) return "lineTypes";
  if (/^LAYNAM_/.test(key)) return "layerNames";
  if (/^LAYCOL_/.test(key)) return "layerColors";
  if (/^LAYWID_/.test(key)) return "layerWidths";
  if (/^LAYTYP_/.test(key)) return "layerLineTypes";
  if (/^(MSET|MHEN|MWIDE|MHIGH|MDIST|MPEN|MOFST)/.test(key)) return "text";
  if (/^(S_STR|S_SET)/.test(key)) return "dimensions";
  if (/^HATCH_/.test(key)) return "hatch";
  if (/^(KEY|N_KEY)/.test(key)) return "keys";
  if (/^(LD|RD|COM|GCOM|AC_COM|WD_COM)/.test(key)) return "commands";
  return "other";
}

function scopeForKey(key) {
  if (isJwfOnlyOperationKey(key)) {
    return "operation";
  }
  if (/^(LCOLLOR_|PCOLLOR_|LTYPE_|LAYNAM_|LAYCOL_|LAYWID_|LAYTYP_|LAYSCALE$)/.test(key)) {
    return "drawing";
  }
  if (/^(MSET|MHEN|MWIDE|MHIGH|MDIST|MPEN|MOFST|S_STR|S_SET|HATCH_|ZF_SET|SL_SET|CU_SET|MS_SET|R_STR0_00|P_dpi$)/.test(key)) {
    return "document";
  }
  if (/^(S_COMM_|S_MESH_0$|ZOOM$|R_CROSS_SET$|KEY|N_KEY|LD|RD|COM|GCOM|AC_COM|WD_COM)/.test(key)) {
    return "operation";
  }
  return "unknown";
}

function definitionWithScope(key, definition) {
  return definition ? { ...definition, scope: scopeForKey(key) } : null;
}

function definitionForKey(key) {
  if (/^LCOLLOR_[1-8]$/.test(key)) {
    return {
      label: "screen line color",
      valueSchema: ["red", "green", "blue", "screenWidth"],
      note: "Screen display color and display width for basic JWW line colors 1..8.",
    };
  }
  const screenSpecials = {
    LCOLLOR_G: ["screen gray", ["red", "green", "blue"]],
    LCOLLOR_H: ["auxiliary line color", ["red", "green", "blue", "screenWidth"]],
    LCOLLOR_S: ["selection color", ["red", "green", "blue"]],
    LCOLLOR_K: ["temporary line color", ["red", "green", "blue"]],
    LCOLLOR_B: ["background color", ["red", "green", "blue"]],
    LCOLLOR_Z: ["zoom frame / crossline color", ["red", "green", "blue"]],
    LCOLLOR_M: ["zoom text color", ["red", "green", "blue"]],
  };
  if (screenSpecials[key]) {
    const [label, valueSchema] = screenSpecials[key];
    return {
      label,
      valueSchema,
      ...(key === "LCOLLOR_M"
        ? {
            note:
              "JWF-only zoom-operation text color. Controlled Jw_cad 10.02.1 Save As tests show that this value is not serialized into JWW.",
          }
        : {}),
    };
  }
  if (/^PCOLLOR_[1-8]$/.test(key)) {
    return {
      label: "print line color",
      valueSchema: ["red", "green", "blue", "printWidth", "pointRadius"],
      note: "Point diameter is pointRadius * 2 + printWidth.",
    };
  }
  if (key === "PCOLLOR_G") {
    return {
      label: "print gray color",
      valueSchema: ["red", "green", "blue"],
    };
  }
  if (/^LTYPE_(0[2-9]|R[1-5]|L[1-4])$/.test(key)) {
    return {
      label: "line type pattern",
      valueSchema: ["patternBits", "parameters..."],
    };
  }
  if (key === "LTYPE_HC") {
    return {
      label: "selection/crossline helper and endpoint setting",
      valueSchema: [
        "selectionTemporaryLineTypeNo",
        "crosslineCursorLineTypeNo",
        "dashPitchAutoAdjust",
        "rightClickBaseLineColorNo",
        "rightClickBaseLineTypeNo",
        "lineEndStyle",
      ],
      note:
        "JWF-only operation/display setting. Controlled Jw_cad 10.02.1 Save As tests show that these six values are not serialized into JWW.",
    };
  }
  if (key === "LAYNAM_N") {
    return {
      label: "blank layer name behavior",
      valueSchema: ["mode"],
      note: "Controls whether consecutive commas keep existing names or clear them.",
    };
  }
  if (/^LAYNAM_[0-9A-F]$/.test(key)) {
    return {
      label: "layer group and layer names",
      valueSchema: ["groupName", "layer0", "layer1", "...", "layerF"],
    };
  }
  if (/^LAYCOL_[0-9A-F]$/.test(key)) {
    return {
      label: "default layer color",
      valueSchema: ["layer0", "layer1", "...", "layerF"],
      note: "JWF-only write-layer operation default; not serialized into JWW. 0 means no color switch; 1..9 are JWW line colors, with 9 for auxiliary line.",
    };
  }
  if (/^LAYWID_[0-9A-F]$/.test(key)) {
    return {
      label: "default layer width",
      valueSchema: ["layer0", "layer1", "...", "layerF"],
      note: "JWF-only write-layer operation default; not serialized into JWW. -2 keeps current width, -1 uses the current color width, 0..30000 sets width.",
    };
  }
  if (/^LAYTYP_[0-9A-F]$/.test(key)) {
    return {
      label: "default layer line type",
      valueSchema: ["layer0", "layer1", "...", "layerF"],
      note: "JWF-only write-layer operation default; not serialized into JWW. 0 means no line type switch; valid line types are 0..19 except 10.",
    };
  }
  if (key === "P_dpi") {
    return {
      label: "printer dpi",
      valueSchema: ["dpi"],
      note: "Documented as 300 or 600 and not written back to JWF in some versions.",
    };
  }
  if (/^S_COMM_[0-9]$/.test(key)) {
    return {
      label: "general setting block",
      valueSchema: ["values..."],
      note: "General Jw_cad settings; individual flags are documented in Sample.jwf.",
    };
  }
  if (key === "R_STR0_00") {
    return {
      label: "numeric input unit preset",
      valueSchema: ["scale", "flags...", "unitText"],
      note: "Sample.jwf uses this for unit conversion presets such as m, Km, or shaku.",
    };
  }
  if (key === "R_CROSS_SET") {
    return {
      label: "crossline cursor setting",
      valueSchema: ["values..."],
      note: "Enables manual on/off control for the graduated crossline cursor.",
    };
  }
  if (key === "S_MESH_0") {
    return {
      label: "grid setting",
      valueSchema: [
        "gridMode",
        "disableGridPointSnap",
        "xInterval",
        "yInterval",
        "minDisplayDotInterval",
        "realSizeMode",
      ],
    };
  }
  if (key === "ZOOM") {
    return {
      label: "zoom operation setting",
      valueSchema: [
        "drag0",
        "drag3",
        "drag6",
        "drag9",
        "moveRange",
        "arrowMoveRatio",
        "zoomRatio",
        "markJumpDistance",
        "layerListCurrentView",
      ],
    };
  }
  if (key === "LAYSCALE") {
    return {
      label: "layer group scale",
      valueSchema: Array.from({ length: 16 }, (_, index) => `group${index.toString(16).toUpperCase()}`),
    };
  }
  const textDefinitions = {
    MSET: [
      "text command setting",
      ["textType", "horizontalVertical", "alignment", "textDisplayLimit", "fontDisplayRatio", "inputBoxSize", "wordWrap", "lineSpacing", "keepAngle"],
    ],
    MHEN: [
      "existing text conversion / default font",
      ["resizeAnchor", "fontName"],
    ],
    MWIDE: [
      "text type width table",
      ["type1", "type2", "type3", "type4", "type5", "type6", "type7", "type8", "type9", "type10"],
    ],
    MHIGH: [
      "text type height table",
      ["type1", "type2", "type3", "type4", "type5", "type6", "type7", "type8", "type9", "type10"],
    ],
    MDIST: [
      "text type character spacing table",
      ["type1", "type2", "type3", "type4", "type5", "type6", "type7", "type8", "type9", "type10"],
    ],
    MPEN: [
      "text type pen table",
      ["type1", "type2", "type3", "type4", "type5", "type6", "type7", "type8", "type9", "type10"],
    ],
    MOFST: [
      "text reference point offset",
      ["enabled", "xLower", "xMiddle", "xUpper", "yLower", "yMiddle", "yUpper", "applyToJwcDxf"],
    ],
  };
  if (textDefinitions[key]) {
    const [label, valueSchema] = textDefinitions[key];
    return { label, valueSchema };
  }
  const dimensionDefinitions = {
    S_STR1: [
      "dimension text setting",
      ["textType", "decimalPlaces", "lineValueGap", "unit", "showUnit", "fontName"],
    ],
    S_STR2: [
      "dimension value display setting",
      ["values..."],
    ],
    S_STR3: [
      "dimension tolerance / text setting",
      ["values..."],
    ],
    S_SET1: [
      "dimension line color and end setting",
      ["dimensionLineColor", "extensionLineColor", "arrowPointColor", "lineEndType", "extensionProtrusion"],
    ],
    S_SET2: [
      "dimension arrow / progressive dimension setting",
      ["arrowLength", "arrowAngle", "progressiveBaseType", "progressiveBaseRadius", "progressiveTextVerticalBase"],
    ],
    S_SET3: [
      "dimension extension position setting",
      ["values..."],
    ],
    S_SET4: [
      "dimension option setting",
      ["values..."],
    ],
    S_SET5: [
      "dimension angle preset setting",
      ["angle1", "angle2", "angle3", "angle4"],
    ],
  };
  if (dimensionDefinitions[key]) {
    const [label, valueSchema] = dimensionDefinitions[key];
    return { label, valueSchema };
  }
  if (key === "ZF_SET") {
    return {
      label: "shape setting",
      valueSchema: ["values..."],
    };
  }
  if (key === "SL_SET") {
    return {
      label: "selection / copy / move setting",
      valueSchema: ["attributeSelection", "values..."],
    };
  }
  if (key === "CU_SET") {
    return {
      label: "measurement / calculation setting",
      valueSchema: ["unit", "decimalPlaces", "rounding", "values..."],
    };
  }
  if (key === "MS_SET") {
    return {
      label: "text counting setting",
      valueSchema: ["values...", "prefix", "suffix"],
    };
  }
  if (key === "HATCH_0") {
    return {
      label: "hatch type default",
      valueSchema: ["hatchType"],
      note: "1: one line, 2: two lines, 3: three lines, 4: brick joint, 5: shape.",
    };
  }
  if (/^HATCH_[1-5]$/.test(key)) {
    return {
      label: "hatch pattern setting",
      valueSchema: ["angle", "pitch", "lineSpacing", "realSizeMode"],
      note: "For brick joint and shape hatches, pitch and lineSpacing act as vertical/horizontal pitch.",
    };
  }
  if (/^COM_LAY/.test(key)) {
    return {
      label: "command layer default",
      valueSchema: ["commandLayerValues..."],
      note: "Switches layer group/layer when changing commands.",
    };
  }
  if (/^(LD|RD|LD2|RD2)_(AM|PM)$/.test(key)) {
    return {
      label: "clock menu command assignment",
      valueSchema: ["hour0", "hour1", "...", "hour11"],
    };
  }
  if (/^GCOM_/.test(key)) {
    return {
      label: "command group assignment",
      valueSchema: ["commandNames..."],
    };
  }
  if (/^(WD_COM|AC_COM)$/.test(key)) {
    return {
      label: key === "WD_COM" ? "window command setting" : "AUTO mode command setting",
      valueSchema: ["values..."],
    };
  }
  if (key === "N_KEY") {
    return {
      label: "keyboard command mode",
      valueSchema: ["mode"],
    };
  }
  if (/^KEY/.test(key)) {
    return {
      label: "keyboard shortcut assignment",
      valueSchema: ["commandValues..."],
    };
  }
  return null;
}

function colorFromValues(values, hasPointRadius = false) {
  const red = Number(values[0]);
  const green = Number(values[1]);
  const blue = Number(values[2]);
  if (![red, green, blue].every(Number.isFinite)) return null;
  return {
    red,
    green,
    blue,
    width: Number(values[3]) || 0,
    ...(hasPointRadius ? { pointRadius: Number(values[4]) || 0 } : {}),
    hex: `#${[red, green, blue]
      .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
      .join("")}`,
  };
}

function numericValue(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function keyValues(entries, key) {
  return Array.isArray(entries?.[key]?.values) ? entries[key].values : [];
}

function layerColorSetting(value) {
  const colorNumber = numericValue(value, null);
  return {
    colorNumber,
    switchesColor: colorNumber !== null && colorNumber !== 0,
    isAuxiliary: colorNumber === 9,
  };
}

function layerWidthSetting(value) {
  const width = numericValue(value, null);
  const mode =
    width === -2
      ? "keep"
      : width === -1
        ? "currentColorWidth"
        : width !== null && width >= 0
          ? "fixed"
          : "unknown";
  return {
    width,
    mode,
  };
}

function layerLineTypeSetting(value) {
  const lineTypeNumber = numericValue(value, null);
  return {
    lineTypeNumber,
    switchesLineType: lineTypeNumber !== null && lineTypeNumber !== 0,
    valid:
      lineTypeNumber !== null &&
      lineTypeNumber >= 0 &&
      lineTypeNumber <= 19 &&
      lineTypeNumber !== 10,
  };
}

function buildLayerDefaults(entries) {
  const groups = {};
  let groupCount = 0;
  let presentKeyCount = 0;
  for (const groupKey of JWF_HEX_KEYS) {
    const colorValues = keyValues(entries, `LAYCOL_${groupKey}`);
    const widthValues = keyValues(entries, `LAYWID_${groupKey}`);
    const lineTypeValues = keyValues(entries, `LAYTYP_${groupKey}`);
    if (!colorValues.length && !widthValues.length && !lineTypeValues.length) {
      continue;
    }
    presentKeyCount += [colorValues, widthValues, lineTypeValues].filter(
      (values) => values.length
    ).length;
    groupCount += 1;
    groups[groupKey] = {
      groupKey,
      layers: Object.fromEntries(
        JWF_HEX_KEYS.map((layerKey, layerIndex) => [
          layerKey,
          {
            layerKey,
            ...layerColorSetting(colorValues[layerIndex]),
            ...layerWidthSetting(widthValues[layerIndex]),
            ...layerLineTypeSetting(lineTypeValues[layerIndex]),
          },
        ])
      ),
    };
  }
  if (!presentKeyCount) return null;
  return {
    source: "jwf",
    note:
      "JWF layer defaults apply when the write layer changes; they do not rewrite existing entity attributes.",
    groupCount,
    presentKeyCount,
    groups,
  };
}

function buildTextSettings(entries) {
  const widths = keyValues(entries, "MWIDE");
  const heights = keyValues(entries, "MHIGH");
  const spacings = keyValues(entries, "MDIST");
  const pens = keyValues(entries, "MPEN");
  const mset = keyValues(entries, "MSET");
  const mhen = keyValues(entries, "MHEN");
  const mofst = keyValues(entries, "MOFST");
  const present = [widths, heights, spacings, pens, mset, mhen, mofst].some(
    (values) => values.length
  );
  if (!present) return null;
  return {
    source: "jwf",
    command: mset.length
      ? {
          textType: numericValue(mset[0]),
          direction: numericValue(mset[1]),
          alignment: numericValue(mset[2]),
          textDisplayLimit: numericValue(mset[3]),
          fontDisplayRatio: numericValue(mset[4]),
          inputBoxSize: numericValue(mset[5]),
          wordWrap: numericValue(mset[6]),
          lineSpacing: numericValue(mset[7]),
          keepAngle: numericValue(mset[8]),
          raw: mset,
        }
      : null,
    conversion: mhen.length
      ? {
          resizeAnchor: numericValue(mhen[0]),
          fontFamily: typeof mhen[1] === "string" ? mhen[1] : "",
          raw: mhen,
        }
      : null,
    offset: mofst.length ? { raw: mofst } : null,
    textTypes: Array.from({ length: 10 }, (_, index) => ({
      type: index + 1,
      width: numericValue(widths[index]),
      height: numericValue(heights[index]),
      spacing: numericValue(spacings[index]),
      colorNumber: numericValue(pens[index]),
    })).filter((row) =>
      ["width", "height", "spacing", "colorNumber"].some(
        (field) => row[field] !== null
      )
    ),
  };
}

function buildColorSettings(entries, screenColors, printColors) {
  const background = screenColors.B || null;
  const zoomFrame = screenColors.Z || null;
  const zoomText = screenColors.M || null;
  const selection = screenColors.S || null;
  const temporary = screenColors.K || null;
  const auxiliary = screenColors.H || null;
  const gray = screenColors.G || null;
  const present = [
    background,
    zoomFrame,
    zoomText,
    selection,
    temporary,
    auxiliary,
    gray,
  ].some(Boolean);
  const hasColorTables =
    Object.keys(screenColors || {}).length || Object.keys(printColors || {}).length;
  if (!present && !hasColorTables) return null;
  return {
    source: "jwf",
    screenColors,
    printColors,
    background,
    zoomFrame,
    zoomText,
    selection,
    temporary,
    auxiliary,
    gray,
    parsedKeys: Object.keys(entries || {}).filter((key) =>
      /^(LCOLLOR_|PCOLLOR_)/.test(key)
    ),
  };
}

function buildLineTypeSettings(entries) {
  const rows = {};
  for (const key of Object.keys(entries || {})) {
    if (/^LTYPE_/.test(key)) rows[key] = keyValues(entries, key);
  }
  if (!Object.keys(rows).length) return null;
  return {
    source: "jwf",
    rows,
    helperEndpoint: rows.LTYPE_HC || null,
    hatchCandidate: rows.LTYPE_HC || null,
  };
}

function commandNumber(value) {
  const number = numericValue(value, null);
  return number === null ? null : number;
}

function clockMenu(values) {
  return Array.from({ length: 12 }, (_, hour) => ({
    hour,
    commandNumber: commandNumber(values[hour]),
  }));
}

function keyedRows(entries, pattern) {
  return Object.fromEntries(
    Object.keys(entries || {})
      .filter((key) => pattern.test(key))
      .sort()
      .map((key) => [key, keyValues(entries, key)])
  );
}

function buildKeyboardSettings(entries) {
  const rows = keyedRows(entries, /^(KEY|N_KEY)/);
  if (!Object.keys(rows).length) return null;
  return {
    mode: rows.N_KEY?.[0] ?? null,
    shortcuts: Object.fromEntries(
      Object.entries(rows)
        .filter(([key]) => key !== "N_KEY")
        .map(([key, values]) => [
          key.replace(/^KEY_?/, "") || key,
          {
            key,
            commandNumbers: values.map(commandNumber),
            raw: values,
          },
        ])
    ),
    raw: rows,
  };
}

function buildOperationSettings(entries) {
  const clockRows = keyedRows(entries, /^(LD|RD|LD2|RD2)_(AM|PM)$/);
  const commandLayerRows = keyedRows(entries, /^COM_LAY/);
  const groupCommandRows = keyedRows(entries, /^GCOM_/);
  const generalRows = keyedRows(entries, /^S_COMM_/);
  const keyboard = buildKeyboardSettings(entries);
  const autoMode = keyValues(entries, "AC_COM");
  const windowCommands = keyValues(entries, "WD_COM");
  const mesh = keyValues(entries, "S_MESH_0");
  const zoom = keyValues(entries, "ZOOM");
  const crossline = keyValues(entries, "R_CROSS_SET");
  const present = [
    clockRows,
    commandLayerRows,
    groupCommandRows,
    generalRows,
  ].some((rows) => Object.keys(rows).length) ||
    !!keyboard ||
    autoMode.length ||
    windowCommands.length ||
    mesh.length ||
    zoom.length ||
    crossline.length;
  if (!present) return null;
  return {
    source: "jwf",
    note:
      "JWF operation settings are parsed from the environment file for connected app persistence; JWW binary extraction remains separate.",
    general: {
      rows: generalRows,
      mesh: mesh.length ? { raw: mesh } : null,
      zoom: zoom.length ? { raw: zoom } : null,
      crossline: crossline.length ? { raw: crossline } : null,
    },
    clockMenus: Object.fromEntries(
      Object.entries(clockRows).map(([key, values]) => [
        key,
        {
          key,
          side: key.startsWith("L") ? "left" : "right",
          mode: "auto",
          page: key.startsWith("LD2") || key.startsWith("RD2") ? 2 : 1,
          meridiem: key.endsWith("_AM") ? "AM" : "PM",
          assignments: clockMenu(values),
          raw: values,
        },
      ])
    ),
    commandLayers: commandLayerRows,
    commandGroups: groupCommandRows,
    autoMode: autoMode.length ? { raw: autoMode } : null,
    windowCommands: windowCommands.length ? { raw: windowCommands } : null,
    keyboard,
  };
}

export function parseJwfText(text, options = {}) {
  const includeAfterEnd = !!options.includeAfterEnd;
  const entries = {};
  const order = [];
  const families = {};
  const comments = [];
  let stoppedAtEnd = false;

  String(text || "")
    .split(/\r?\n/)
    .forEach((line, index) => {
      const raw = line.replace(/\uFEFF/g, "");
      const trimmed = raw.trim();
      if (!trimmed) return;
      if (/^#/.test(trimmed)) {
        if (comments.length < 40) comments.push(trimmed);
        return;
      }
      if (/^END\b/i.test(trimmed)) {
        stoppedAtEnd = true;
        if (!includeAfterEnd) return;
      }
      if (stoppedAtEnd && !includeAfterEnd) return;

      const match = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) return;
      const key = match[1].trim();
      const values = parseValue(match[2]);
      const family = familyForKey(key);
      entries[key] = {
        key,
        values,
        rawValue: stripInlineComment(match[2]).trim(),
        family,
        definition: definitionWithScope(key, definitionForKey(key)),
        line: index + 1,
      };
      order.push(key);
      if (!families[family]) families[family] = {};
      families[family][key] = values;
    });

  const screenColors = {};
  const printColors = {};
  for (const [key, entry] of Object.entries(entries)) {
    const screenMatch = key.match(/^LCOLLOR_([1-8GHBZMSK])$/);
    const printMatch = key.match(/^PCOLLOR_([1-8G])$/);
    if (screenMatch) {
      screenColors[screenMatch[1]] = colorFromValues(entry.values);
    }
    if (printMatch) {
      printColors[printMatch[1]] = colorFromValues(entry.values, /^PCOLLOR_[1-8]$/.test(key));
    }
  }
  const normalizedSettings = {
    colors: buildColorSettings(entries, screenColors, printColors),
    lineTypes: buildLineTypeSettings(entries),
    layerDefaults: buildLayerDefaults(entries),
    text: buildTextSettings(entries),
    operation: buildOperationSettings(entries),
  };

  return {
    format: "jwf-environment",
    sourceFormat: "JWF",
    stoppedAtEnd,
    entryCount: order.length,
    keys: order,
    entries,
    families,
    colorSettings: {
      screenColors,
      printColors,
    },
    normalizedSettings,
    comments,
  };
}

export function parseJwfBytes(bytes, options = {}) {
  const encoding = options.encoding || DEFAULT_ENCODING;
  return parseJwfText(decodeBytes(bytes, encoding), options);
}
