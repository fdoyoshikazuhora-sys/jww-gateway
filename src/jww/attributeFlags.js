const FLAGS = Object.freeze({
  configured: 0x0002, fullWidth: 0x0008, unit: 0x0010, appendUnit: 0x0020,
  comma: 0x0040, trailingZero: 0x0080, truncate: 0x0100, roundUp: 0x0200,
  symbolPrefix: 0x0400, symbolSuffix: 0x0800,
});
const KNOWN_MASK = 0x3ffa;

function word(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) throw new Error("JWW flag must be an unsigned WORD");
  return value;
}

// CDataMoji stores m_nSunpouFlg in the base pen-width WORD, not m_sFlg.
export function decodeJwwTextDimensionFlags(value) {
  const raw = word(value);
  return {
    raw,
    ...Object.fromEntries(Object.entries(FLAGS).map(([name, mask]) => [name, Boolean(raw & mask)])),
    decimalPlaces: (raw & 0x3000) >>> 12,
    unknownBits: raw & ~KNOWN_MASK,
  };
}

export function encodeJwwTextDimensionFlags(value, edits = {}) {
  let raw = word(value);
  for (const [name, flag] of Object.entries(edits)) {
    if (name === "decimalPlaces") {
      if (!Number.isInteger(flag) || flag < 0 || flag > 3) throw new Error("JWW dimension decimalPlaces must be 0..3");
      raw = (raw & ~0x3000) | (flag << 12);
    } else {
      if (!Object.hasOwn(FLAGS, name) || typeof flag !== "boolean") throw new Error(`Invalid JWW dimension flag edit: ${name}`);
      raw = flag ? raw | FLAGS[name] : raw & ~FLAGS[name];
    }
  }
  return raw;
}
