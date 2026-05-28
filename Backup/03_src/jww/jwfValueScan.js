function numericValues(values) {
  return (values || []).filter(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
}

function packU32(values) {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint32(index * 4, value, true));
  return bytes;
}

function packU16(values) {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint16(index * 2, value, true));
  return bytes;
}

function packI16(values) {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setInt16(index * 2, value, true));
  return bytes;
}

function packU8(values) {
  return Uint8Array.from(values);
}

function packI32(values) {
  const bytes = new Uint8Array(values.length * 4);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setInt32(index * 4, value, true));
  return bytes;
}

function packF64(values) {
  const bytes = new Uint8Array(values.length * 8);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setFloat64(index * 8, value, true));
  return bytes;
}

function packColor(values) {
  if (values.length < 4) return null;
  const [red, green, blue, width] = values.map(Number);
  if (![red, green, blue, width].every(Number.isFinite)) return null;
  if ([red, green, blue].some((value) => value < 0 || value > 255)) return null;
  return Uint8Array.from([
    red,
    green,
    blue,
    0,
    width & 255,
    (width >>> 8) & 255,
    (width >>> 16) & 255,
    (width >>> 24) & 255,
  ]);
}

function packRgb(values) {
  if (values.length < 3) return null;
  const [red, green, blue] = values.map(Number);
  if (![red, green, blue].every(Number.isFinite)) return null;
  if ([red, green, blue].some((value) => value < 0 || value > 255)) return null;
  return Uint8Array.from([red, green, blue]);
}

export function candidatePatterns(entry) {
  const values = numericValues(entry.values);
  const patterns = [];
  if (/^(LCOLLOR_|PCOLLOR_)/.test(entry.key)) {
    patterns.push({ kind: "color-rgb-width-u32", bytes: packColor(values) });
    patterns.push({ kind: "rgb-triplet", bytes: packRgb(values) });
  }
  if (
    values.length >= 3 &&
    values.every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 255
    )
  ) {
    patterns.push({ kind: "u8-sequence", bytes: packU8(values) });
  }
  if (
    values.length >= 2 &&
    values.every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 65535
    )
  ) {
    patterns.push({ kind: "u16-sequence", bytes: packU16(values) });
  }
  if (
    values.length >= 2 &&
    values.every(
      (value) => Number.isInteger(value) && value >= -32768 && value <= 32767
    )
  ) {
    patterns.push({ kind: "i16-sequence", bytes: packI16(values) });
  }
  if (
    values.length >= 2 &&
    values.every((value) => Number.isInteger(value) && value >= 0)
  ) {
    patterns.push({ kind: "u32-sequence", bytes: packU32(values) });
  }
  if (values.length >= 2 && values.every((value) => Number.isInteger(value))) {
    patterns.push({ kind: "i32-sequence", bytes: packI32(values) });
  }
  if (values.length >= 2) {
    patterns.push({ kind: "f64-sequence", bytes: packF64(values) });
  }
  return patterns.filter((pattern) => {
    if (!pattern.bytes) return false;
    if (pattern.kind === "rgb-triplet") return pattern.bytes.length === 3;
    return pattern.bytes.length >= 8;
  });
}

export function isLowInformationNumericSequence(values) {
  const numeric = numericValues(values);
  if (numeric.length > 0 && numeric.length <= 2) return true;
  if (numeric.length < 3) return false;
  const uniqueValues = new Set(numeric.map((value) => String(value)));
  if (uniqueValues.size <= 1) return true;
  const zeroCount = numeric.filter((value) => value === 0).length;
  if (uniqueValues.size <= 2 && zeroCount / numeric.length >= 0.75) return true;
  const compactDefaultValues = numeric.every(
    (value) => Number.isInteger(value) && Math.abs(value) <= 1
  );
  const dominantCount = Math.max(
    ...Array.from(
      uniqueValues,
      (value) => numeric.filter((item) => String(item) === value).length
    )
  );
  if (
    compactDefaultValues &&
    uniqueValues.size <= 2 &&
    dominantCount / numeric.length >= 0.66
  ) {
    return true;
  }
  return (
    numeric.length <= 5 &&
    uniqueValues.size <= 2 &&
    numeric.every((value) => Number.isInteger(value) && Math.abs(value) <= 1)
  );
}
