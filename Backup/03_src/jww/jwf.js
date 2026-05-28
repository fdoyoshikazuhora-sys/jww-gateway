const DEFAULT_ENCODING = "shift_jis";

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
    return { label, valueSchema };
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
      label: "line type helper / endpoint setting",
      valueSchema: [
        "selectionTemporaryLineTypeNo",
        "crosslineCursorLineTypeNo",
        "dashPitchAutoAdjust",
        "rightClickBaseLineColorNo",
        "rightClickBaseLineTypeNo",
        "lineEndStyle",
      ],
      note:
        "JWF meaning is documented in Sample.jwf; JWW binary extraction remains candidate-only until real files direct-match.",
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
      note: "0 means no color switch; 1..9 are JWW line colors, with 9 for auxiliary line.",
    };
  }
  if (/^LAYWID_[0-9A-F]$/.test(key)) {
    return {
      label: "default layer width",
      valueSchema: ["layer0", "layer1", "...", "layerF"],
      note: "-2 keeps current width, -1 uses the current color width, 0..30000 sets width.",
    };
  }
  if (/^LAYTYP_[0-9A-F]$/.test(key)) {
    return {
      label: "default layer line type",
      valueSchema: ["layer0", "layer1", "...", "layerF"],
      note: "0 means no line type switch; valid line types are 0..19 except 10.",
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
    comments,
  };
}

export function parseJwfBytes(bytes, options = {}) {
  const encoding = options.encoding || DEFAULT_ENCODING;
  return parseJwfText(decodeBytes(bytes, encoding), options);
}
