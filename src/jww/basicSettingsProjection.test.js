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
      layers: Array.from({ length: 16 }, (_, layerIndex) => ({
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
  it("maps native JWW settings into an English native-safe child-app contract", () => {
    const projection = buildJwwBasicSettingsProjection(nativeDocument(), {
      fileName: "fixture.jww",
    });

    expect(projection).toMatchObject({
      format: JWW_BASIC_SETTINGS_PROJECTION_FORMAT,
      formatVersion: 5,
      readOnly: false,
      saveAsOnly: true,
      editContract: {
        version: 3,
        mode: "native-metadata-safe",
        writablePaths: [
          "header.paperSize",
          "header.writeLayerGroup",
          "layerGroups[].scale",
          "layerGroups[].write_layer",
          "layerGroups[].state",
          "layerGroups[].protect",
          "layerGroups[].layers[].state",
          "layerGroups[].layers[].protect",
        ],
        managedInvariantPaths: ["layerGroups[].layers[].state"],
      },
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
    expect(byId["write-group"].edit).toMatchObject({
      key: "writeLayerGroup",
      control: "select",
      value: 1,
    });
    expect(byId["paper-code"].edit).toMatchObject({
      key: "paperSize",
      control: "select",
      value: 3,
    });
    const scaleRow = projection.tabs
      .find((tab) => tab.id === "paper-scale")
      .sections.find((section) => section.id === "group-scales")
      .rows[1];
    expect(scaleRow.edits[2]).toMatchObject({
      key: "layerGroupScales.1",
      control: "number",
      value: 50,
    });
    expect(scaleRow.edits[3]).toMatchObject({
      key: "layerGroupWriteLayers.1",
      control: "select",
      value: 3,
    });
    const layerGroupRow = projection.tabs
      .find((tab) => tab.id === "layers")
      .sections.find((section) => section.id === "layer-groups")
      .rows[1];
    expect(layerGroupRow.edits[5]).toMatchObject({
      key: "layerGroupWriteLayers.1",
      value: 3,
    });
    expect(layerGroupRow.cells[2]).toBe("Visible only (1)");
    expect(layerGroupRow.cells[3]).toBe("None (0)");
    expect(layerGroupRow.edits[2]).toBe(undefined);
    expect(layerGroupRow.edits[3]).toMatchObject({
      key: "layerGroupProtections.1",
      value: 0,
    });

    const nonCurrentGroupRow = projection.tabs
      .find((tab) => tab.id === "layers")
      .sections.find((section) => section.id === "layer-groups")
      .rows[0];
    expect(nonCurrentGroupRow.cells[2]).toBe("Hidden (0)");
    expect(nonCurrentGroupRow.edits[2]).toMatchObject({
      key: "layerGroupStates.0",
      value: 0,
    });
    expect(nonCurrentGroupRow.edits[3]).toMatchObject({
      key: "layerGroupProtections.0",
      value: 0,
    });

    const layerRows = projection.tabs
      .find((tab) => tab.id === "layers")
      .sections.find((section) => section.id === "layers-1").rows;
    expect(layerRows[3].cells[2]).toBe("Current (3)");
    expect(layerRows[3].edits[2]).toBe(undefined);
    expect(layerRows[3].edits[3]).toMatchObject({
      key: "layerProtections.1.3",
      value: 0,
    });
    expect(layerRows[1].cells[2]).toBe("Visible only (1)");
    expect(layerRows[1].edits[2]).toMatchObject({
      key: "layerStates.1.1",
      value: 1,
    });
    expect(layerRows[1].edits[3]).toMatchObject({
      key: "layerProtections.1.1",
      value: 0,
    });
  });

  it("shows protection 1 and 2 controls while locking state 2 rows", () => {
    const document = nativeDocument();
    document.layerGroups[0].protect = 1;
    document.layerGroups[0].layers[1].protect = 2;
    const projection = buildJwwBasicSettingsProjection(document);
    const groupRow = projection.tabs
      .find((tab) => tab.id === "layers")
      .sections.find((section) => section.id === "layer-groups")
      .rows[0];
    const layerRow = projection.tabs
      .find((tab) => tab.id === "layers")
      .sections.find((section) => section.id === "layers-0")
      .rows[1];

    expect(groupRow.cells[3]).toBe("Protected; display state can change (1)");
    expect(Boolean(groupRow.edits[2])).toBe(true);
    expect(groupRow.edits[3]).toMatchObject({
      key: "layerGroupProtections.0",
      value: 1,
    });
    expect(layerRow.cells[3]).toBe("Protected; display state fixed (2)");
    expect(layerRow.edits[2]).toBe(undefined);
    expect(layerRow.edits[3]).toMatchObject({
      key: "layerProtections.0.1",
      value: 2,
    });
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
