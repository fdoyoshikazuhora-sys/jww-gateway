import { parse } from "./parser.js";
import { readFileSync } from "node:fs";

function pushDword(bytes, value) {
  bytes.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

function pushWord(bytes, value) {
  bytes.push(value & 255, (value >>> 8) & 255);
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

  for (let index = 0; index < 21; index += 1) {
    pushDword(bytes, 0);
  }

  pushDouble(bytes, 0);
  pushDouble(bytes, 0);
  pushDouble(bytes, 1);
  pushDword(bytes, 0);
  pushDword(bytes, 0);
  for (let index = 0; index < 5; index += 1) {
    pushDouble(bytes, 0);
  }

  if (!options.omitLayerNames) {
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
  }

  if (options.appendLineEntity) {
    pushWord(bytes, 1);
    pushWord(bytes, 0xffff);
    pushWord(bytes, 700);
    pushWord(bytes, 8);
    bytes.push(...asciiBytes("CDataSen"));
    pushDword(bytes, 0);
    bytes.push(1);
    pushWord(bytes, 2);
    pushWord(bytes, 0);
    pushWord(bytes, 0);
    pushWord(bytes, 0);
    pushWord(bytes, 0);
    pushDouble(bytes, 1);
    pushDouble(bytes, 2);
    pushDouble(bytes, 3);
    pushDouble(bytes, 4);
    pushWord(bytes, 0);
    pushWord(bytes, 0);
    pushDword(bytes, 0);
  }

  return Uint8Array.from(bytes);
}

describe("parse", () => {
  it("maps the official contiguous screen and print color tables as 0 through 9", () => {
    const bytes = readFileSync(
      new URL("../../samples/jwf-pairs/jwf-open-items-core.jww", import.meta.url)
    );
    const doc = parse(bytes);
    const color = doc.color_settings;

    expect(color).toMatchObject({
      sourceLayout: "jwdatafmt-color-tables-v600-v700",
      sourceSpan: { start: 4104, end: 4344, byteLength: 240 },
      screenColorTableSourceSpan: { byteLength: 80 },
      printColorTableSourceSpan: { byteLength: 160 },
      backgroundColor: { hex: "#000000", width: 1 },
      printBackgroundColor: {
        hex: "#ffffff",
        width: 1,
        pointRadius: 0.1,
      },
    });
    expect(Object.keys(color.screenColors)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9",
    ]);
    expect(Object.keys(color.printColors)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9",
    ]);
    expect(color.screenColors[10]).toBe(undefined);
    expect(color.screenColors[9]).toMatchObject({ hex: "#6e6e6e", width: 1 });
    expect(color.printColors[9]).toMatchObject({
      hex: "#808080",
      width: 1,
      pointRadius: 0.1,
    });
    expect(doc.line_type_settings.offset).toBe(color.sourceSpan.end);
  });

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

  it("does not consume an entity list while probing absent layer names", () => {
    const doc = parse(
      minimalJwwBytesWithUnicodeMemo({
        omitLayerNames: true,
        appendLineEntity: true,
      }),
      { encoding: "shift_jis" }
    );

    expect(doc.layer_names_extracted).toBe(false);
    expect(
      doc.environment_region.afterLayerNamesOffset <= doc.entity_list_offset
    ).toBe(true);
    expect(doc.entities.length).toBe(1);
    expect(doc.entities[0].value).toMatchObject({
      start_x: 1,
      start_y: 2,
      end_x: 3,
      end_y: 4,
    });
  });
});
