import {
  buildJwwBasicSettingsProjection,
  JWW_BASIC_SETTINGS_PROJECTION_FORMAT,
} from "./basicSettingsProjection.js";

function nativeDocument() {
  return {
    kind: "jww-native",
    version: 700,
    originalBytes: Uint8Array.from([1, 2, 3, 4]),
    originalSha256: "abc123",
    header: {
      id: "jww:header",
      version: 700,
      memo: "Fixture memo",
      paperSize: 3,
      writeLayerGroup: 1,
    },
    layerGroups: Array.from({ length: 2 }, (_, groupIndex) => ({
      id: `jww:layer-group:${groupIndex}`,
      index: groupIndex,
      name: `Group ${groupIndex}`,
      state: groupIndex,
      protect: 0,
      scale: groupIndex ? 50 : 100,
      write_layer: groupIndex ? 3 : 0,
      layers: Array.from({ length: 2 }, (_, layerIndex) => ({
        name: `Layer ${groupIndex}-${layerIndex}`,
        state: layerIndex,
        protect: 0,
      })),
    })),
    nativeEntities: [
      {
        id: "jww:entity:0",
        kind: "TEXT",
        value: {
          font_name: "MS Gothic",
          text_type: 2,
          size_x: 2.5,
          size_y: 3.5,
          spacing: 0.2,
          angle: 0.5,
        },
      },
      { id: "jww:entity:1", kind: "DIMENSION", value: {} },
    ],
    blockDefinitions: [{ id: "jww:block:0" }],
    embeddedImages: [{ id: "jww:image:0" }],
    settings: {
      color: {
        backgroundColor: { red: 255, green: 255, blue: 255, width: 1, hex: "#ffffff" },
        screenColors: {
          1: { red: 0, green: 192, blue: 192, width: 2, hex: "#00c0c0" },
        },
        printColors: {
          1: { red: 0, green: 0, blue: 0, width: 3, pointRadius: 0.2, hex: "#000000" },
        },
        specialColors: {
          S: { red: 255, green: 0, blue: 255, hex: "#ff00ff" },
          K: { red: 0, green: 255, blue: 255, hex: "#00ffff" },
          Z: { red: 128, green: 128, blue: 128, hex: "#808080" },
        },
      },
      lineType: {
        offset: 4096,
        score: 91,
        rows: {
          LTYPE_02: { pattern: "00ff00ff", params: [1, 2, 3] },
        },
      },
      print: { origin_x: 1, origin_y: 2, scale: 0.5, rotation_setting: 1 },
      dimension: {
        sunpou1: 1,
        sunpou2: 2,
        sunpou3: 3,
        sunpou4: 4,
        sunpou5: 5,
        max_line_width: 30,
      },
    },
    diagnostics: {
      clean: true,
      originalByteLength: 4,
      unsupportedCount: 0,
      skippedCount: 0,
      trailingByteLength: 0,
      recordSourceSpansAvailable: true,
      preservedUnknownRegions: [],
    },
    revision: 0,
    dirty: false,
  };
}

function fields(projection) {
  return projection.tabs.flatMap((tab) =>
    tab.sections.flatMap((section) => section.type === "fields" ? section.rows : [])
  );
}

describe("buildJwwBasicSettingsProjection", () => {
  it("maps native JWW settings into an English read-only child-app contract", () => {
    const projection = buildJwwBasicSettingsProjection(nativeDocument(), {
      fileName: "fixture.jww",
    });

    expect(projection).toMatchObject({
      format: JWW_BASIC_SETTINGS_PROJECTION_FORMAT,
      formatVersion: 1,
      readOnly: true,
      source: {
        fileName: "fixture.jww",
        kind: "jww-native",
        version: 700,
        byteLength: 4,
        sha256: "abc123",
        clean: true,
        revision: 0,
        dirty: false,
      },
    });
    expect(projection.tabs.map((tab) => tab.id)).toEqual([
      "general",
      "paper-scale",
      "colors",
      "line-types",
      "text",
      "dimensions",
      "layers",
      "print",
      "diagnostics",
    ]);
    const byId = Object.fromEntries(fields(projection).map((row) => [row.id, row]));
    expect(byId["paper-summary"].value).toBe("A3 (code 3)");
    expect(byId.background.value).toContain("#FFFFFF");
    expect(byId["text-fonts"].value).toBe("MS Gothic");
    expect(byId["dimension-count"].value).toBe("1");
  });

  it("marks JWF-only settings as absent instead of inventing JWW values", () => {
    const projection = buildJwwBasicSettingsProjection(nativeDocument());
    const byId = Object.fromEntries(fields(projection).map((row) => [row.id, row]));

    for (const id of ["lcollor-m", "ltype-hc", "laycol", "laywid", "laytyp"]) {
      expect(byId[id]).toMatchObject({
        value: "Not stored in JWW",
        status: "not-stored",
        source: "JWF environment profile",
      });
    }
  });

  it("does not copy original JWW bytes into the UI projection", () => {
    const projection = buildJwwBasicSettingsProjection(nativeDocument());
    const serialized = JSON.stringify(projection);

    expect(serialized.includes("originalBytes")).toBe(false);
    expect(projection.source.byteLength).toBe(4);
  });

  it("rejects non-native documents", () => {
    let message = "";
    try {
      buildJwwBasicSettingsProjection({ kind: "dxf" });
    } catch (error) {
      message = error.message;
    }
    expect(message).toContain("JwwNativeDocument");
  });
});
