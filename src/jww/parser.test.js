import { parse } from "./parser.js";

function pushDword(bytes, value) {
  bytes.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

function pushDouble(bytes, value) {
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, value, true);
  bytes.push(...new Uint8Array(buffer));
}

function pushEmptyCString(bytes) {
  bytes.push(0);
}

function pushCStringBytes(bytes, value = []) {
  bytes.push(value.length, ...value);
}

function asciiBytes(value) {
  return Array.from(String(value || ""), (char) => char.charCodeAt(0) & 255);
}

function minimalJwwBytesWithUnicodeMemo(options = {}) {
  const bytes = [0x4a, 0x77, 0x77, 0x44, 0x61, 0x74, 0x61, 0x2e];
  pushDword(bytes, 700);
  bytes.push(255, 254, 255, 2, 13, 0, 10, 0);
  pushDword(bytes, 2);
  pushDword(bytes, 0);

  for (let groupIndex = 0; groupIndex < 16; groupIndex += 1) {
    pushDword(bytes, 0);
    pushDword(bytes, 0);
    pushDouble(bytes, 1);
    pushDword(bytes, 0);
    for (let layerIndex = 0; layerIndex < 16; layerIndex += 1) {
      pushDword(bytes, 0);
      pushDword(bytes, 0);
    }
  }

  pushDouble(bytes, 0);
  pushDouble(bytes, 0);
  pushDouble(bytes, 1);
  pushDword(bytes, 0);

  for (let index = 0; index < 21; index += 1) {
    pushDword(bytes, 0);
  }

  for (let groupIndex = 0; groupIndex < 16; groupIndex += 1) {
    for (let layerIndex = 0; layerIndex < 16; layerIndex += 1) {
      const layerName = options.layerNames?.[groupIndex]?.[layerIndex];
      if (layerName) pushCStringBytes(bytes, layerName);
      else pushEmptyCString(bytes);
    }
  }

  for (let groupIndex = 0; groupIndex < 16; groupIndex += 1) {
    const groupName = options.groupNames?.[groupIndex];
    if (groupName) pushCStringBytes(bytes, groupName);
    else pushEmptyCString(bytes);
  }

  return Uint8Array.from(bytes);
}

describe("parse", () => {
  it("reads JWW UTF-16LE inline strings without shifting following fields", () => {
    const doc = parse(minimalJwwBytesWithUnicodeMemo(), {
      encoding: "shift_jis",
    });

    expect(doc.version).toBe(700);
    expect(doc.memo).toBe("\r\n");
    expect(doc.paper_size).toBe(2);
    expect(doc.write_layer_group).toBe(0);
  });

  it("keeps valid layer names and falls back only suspicious names", () => {
    const doc = parse(
      minimalJwwBytesWithUnicodeMemo({
        groupNames: {
          0: asciiBytes("Plan"),
          13: [1],
        },
        layerNames: {
          0: {
            2: asciiBytes("Walls"),
          },
        },
      }),
      { encoding: "shift_jis" }
    );

    expect(doc.layer_names_extracted).toBe(true);
    expect(doc.layer_groups[0].name).toBe("Plan");
    expect(doc.layer_groups[0].layers[2].name).toBe("Walls");
    expect(doc.layer_groups[13].name).toBe("Group13");
    expect(doc.layer_name_fallbacks).toEqual([
      {
        kind: "group",
        group: 13,
        original: "\ufffd",
        fallback: "Group13",
      },
    ]);
  });
});
