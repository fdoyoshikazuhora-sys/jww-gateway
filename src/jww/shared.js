export const JWW_LINE_TYPE_NAMES = {
  1: "CONTINUOUS",
  2: "DASHED",
  3: "DASHED",
  4: "CENTER",
  5: "DASHDOT",
  6: "DOT",
  7: "DASHDOT",
  8: "PHANTOM",
  9: "CENTER",
};

export const JWW_PAPER_SIZE_NAMES = {
  0: "A0",
  1: "A1",
  2: "A2",
  3: "A3",
  4: "A4",
};

export const JWW_SCREEN_COLOR_HEX = {
  1: "#00c0c0",
  2: "#111111",
  3: "#00c000",
  4: "#0000ff",
  5: "#ff0000",
  6: "#c000c0",
  7: "#c0c000",
  8: "#666666",
  9: "#80ffff",
  10: "#80ffff",
};

export const JWW_SXF_COLOR_HEX = {
  101: "#000000",
  102: "#ff0000",
  103: "#00ff00",
  104: "#0000ff",
  105: "#ffff00",
  106: "#ff00ff",
  107: "#00ffff",
  108: "#ffffff",
  109: "#ff1493",
  110: "#a52a2a",
  111: "#ffa500",
  112: "#90ee90",
};

export function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((value) =>
      Math.max(0, Math.min(255, Number(value) || 0))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

export function jwwColorDwordToEntry(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  const color = numeric >>> 0;
  const red = color & 0xff;
  const green = (color >>> 8) & 0xff;
  const blue = (color >>> 16) & 0xff;
  return {
    red,
    green,
    blue,
    width: 1,
    hex: rgbToHex(red, green, blue),
    source: "direct",
    raw: color,
  };
}

function hexToColorEntry(hex, extra = {}) {
  const match = String(hex || "").match(/^#?([0-9a-f]{6})$/i);
  if (!match) return null;
  const value = match[1];
  return {
    red: parseInt(value.slice(0, 2), 16),
    green: parseInt(value.slice(2, 4), 16),
    blue: parseInt(value.slice(4, 6), 16),
    width: 1,
    hex: `#${value.toLowerCase()}`,
    ...extra,
  };
}

function getColorLuminance(color = {}) {
  if (!color || typeof color !== "object") return null;
  const red = Number(color.red);
  const green = Number(color.green);
  const blue = Number(color.blue);
  if (![red, green, blue].every(Number.isFinite)) return null;
  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

function shouldInvertBlackWhite(color = {}, backgroundColor = null) {
  const colorLuminance = getColorLuminance(color);
  const backgroundLuminance = getColorLuminance(backgroundColor);
  if (colorLuminance === null || backgroundLuminance === null) return null;
  if (backgroundLuminance < 96 && colorLuminance < 48) return "#ffffff";
  if (backgroundLuminance > 192 && colorLuminance > 240) return "#111111";
  return null;
}

export function getJwwScreenColorHex(
  penColor,
  screenColors = null,
  fallback = "#111111",
  backgroundColor = null
) {
  const color = Math.abs(Number(penColor) || 0);
  const fileColor = screenColors?.[color];
  const inverted = shouldInvertBlackWhite(fileColor, backgroundColor);
  if (inverted) return inverted;
  if (fileColor?.hex) return fileColor.hex;
  return JWW_SCREEN_COLOR_HEX[color] || fallback;
}

export function resolveJwwColorEntry(value = {}, colorSettings = {}) {
  const base = value.base || {};
  const penColor = Math.abs(Number(base.pen_color) || 0);
  const directColor = jwwColorDwordToEntry(value.color);
  if (directColor) return directColor;
  const fileColor = colorSettings.screenColors?.[penColor];
  if (fileColor) return { ...fileColor, source: "file" };
  const sxfColor = hexToColorEntry(JWW_SXF_COLOR_HEX[penColor], {
    source: "sxf",
    penColor,
  });
  if (sxfColor) return sxfColor;
  return null;
}

export function getJwwScreenLineWidth(penColor, screenColors = null, fallback = 1) {
  const color = Math.abs(Number(penColor) || 0);
  const width = Number(screenColors?.[color]?.width);
  return Number.isFinite(width) && width > 0 ? width : fallback;
}

export function unwrapJwwEntity(entity) {
  if (!entity || typeof entity !== "object") return null;
  if (entity.value && typeof entity.value === "object") return entity.value;
  const key = Object.keys(entity)[0];
  return key ? entity[key] : null;
}

export function jwwKey(value) {
  const n = Math.max(0, Math.min(15, Number(value) || 0));
  return n.toString(16).toUpperCase();
}

export function cleanJwwName(value) {
  return String(value || "")
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127 && code !== 0xfffd;
    })
    .join("")
    .trim();
}

export function getJwwPaperSizeName(paperSize) {
  return JWW_PAPER_SIZE_NAMES[Number(paperSize)] || null;
}

export function inferJwwPaperSizeNameFromEntities(rawEntities = []) {
  for (const source of rawEntities) {
    const value = unwrapJwwEntity(source);
    const content = String(value?.content || "");
    const match = content.match(/[\u0041\uFF21][-\uFF0D]?\s*([0-4\uFF10-\uFF14])/i);
    if (!match) continue;
    const digit = match[1].replace(/[\uFF10-\uFF14]/g, (char) =>
      String(char.charCodeAt(0) - 0xff10)
    );
    return `A${digit}`;
  }
  return null;
}

export function getJwwGroupScaleLabels(doc) {
  return Object.fromEntries(
    (doc.layer_groups || []).map((group, index) => {
      const denominator = Number(group?.scale || 0);
      return [
        jwwKey(index),
        denominator > 0 ? `1/${Math.round(denominator)}` : "-",
      ];
    })
  );
}

export function getJwwLayerName(doc, base = {}) {
  const group = Math.max(0, Math.min(15, Number(base.layer_group) || 0));
  const layer = Math.max(0, Math.min(15, Number(base.layer) || 0));
  const groupKey = jwwKey(group);
  const layerKey = jwwKey(layer);
  const name = cleanJwwName(doc.layer_groups?.[group]?.layers?.[layer]?.name);
  return name ? `${groupKey}-${layerKey}_${name}` : `${groupKey}-${layerKey}`;
}
