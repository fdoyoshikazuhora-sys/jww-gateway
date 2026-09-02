import {
  buildJwwBasicSettingsProjection,
  JWW_BASIC_SETTINGS_PROJECTION_FORMAT,
} from "./basicSettingsProjection.js";
import { JWW_LINE_TYPE_ROW_DEFINITIONS } from "./lineTypeSettings.js";

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
      { id: "jww:entity:2", kind: "IMAGE", value: { raw_content: "^@BMexternal.bmp,20,10" } },
    ],
    blockDefinitions: [
      {
        id: "jww:block:0",
        value: {
          entities: [
            { id: "jww:block:0:record:0", kind: "IMAGE", value: { raw_content: "^@BMblock.bmp,10,5" } },
          ],
        },
      },
    ],
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
      print: {
        id: "jww:print-settings",
        origin_x: 1,
        origin_y: 2,
        scale: 0.5,
        rotation_setting: 1,
      },
      dimension: {
        id: "jww:dimension-settings",
        sunpou1: 2001422,
        sunpou2: 3,
        sunpou3: 50150025,
        sunpou4: 11000000,
        sunpou5: 4100,
        max_line_width: -300,
        sourceSpan: { start: 100, end: 184, byteLength: 84 },
      },
      grid: {
        id: "jww:grid-settings",
        mode: 11,
        minimum_display_spacing: 10,
        spacing_x: 100,
        spacing_y: 200,
        base_x: 3.5,
        base_y: -4.5,
        sourceSpan: { start: 212, end: 256, byteLength: 44 },
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
      formatVersion: 12,
      readOnly: false,
      saveAsOnly: true,
      editContract: {
        version: 9,
        mode: "native-metadata-safe",
        writablePaths: [
          "header.memo",
          "header.paperSize",
          "header.writeLayerGroup",
          "layerGroups[].scale",
          "layerGroups[].write_layer",
          "layerGroups[].state",
          "layerGroups[].protect",
          "layerGroups[].layers[].state",
          "layerGroups[].layers[].protect",
          "settings.print.origin_x",
          "settings.print.origin_y",
          "settings.print.scale",
          "settings.print.rotation_setting",
          "settings.dimension.sunpou1",
          "settings.dimension.sunpou2",
          "settings.dimension.sunpou3",
          "settings.dimension.sunpou4",
          "settings.dimension.sunpou5",
          "settings.grid.mode",
          "settings.grid.minimum_display_spacing",
          "settings.grid.spacing_x",
          "settings.grid.spacing_y",
          "settings.grid.base_x",
          "settings.grid.base_y",
          "settings.color.backgroundColor",
          "settings.color.screenColors[1..9]",
          "settings.color.printBackgroundColor",
          "settings.color.printColors[1..9]",
          "settings.lineType.rows.LTYPE_02..LTYPE_09",
          "settings.lineType.rows.LTYPE_R1..LTYPE_R5",
          "settings.lineType.rows.LTYPE_L1..LTYPE_L4",
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
      "grid",
      "layers",
      "print",
      "diagnostics",
    ]);
    const byId = Object.fromEntries(fields(projection).map((row) => [row.id, row]));
    expect(byId["paper-summary"].value).toBe("A3 (code 3)");
    expect(byId.background.value).toContain("#FFFFFF");
    expect(byId["text-fonts"].value).toBe("MS Gothic");
    expect(byId["dimension-count"].value).toBe("1");
    expect(byId["image-entities"]).toMatchObject({
      label: "Image entities",
      value: "2",
      source: "nativeEntities + blockDefinitions[].value.entities [kind=IMAGE]",
    });
    expect(byId["embedded-images"]).toMatchObject({
      label: "Embedded images",
      value: "1",
      source: "embeddedImages.length",
    });
    expect(byId["dimension-line-color"].edit).toMatchObject({
      key: "dimensionLineColor",
      control: "select",
      value: 2,
    });
    expect(byId["dimension-value-offset"].edit).toMatchObject({
      key: "dimensionValueOffset",
      control: "number",
      value: 0.3,
    });
    expect(byId["dimension-arrow-angle"].edit).toMatchObject({
      key: "dimensionArrowAngle",
      value: 15,
    });
    expect(byId["dimension-max-line-width"]).toMatchObject({
      value: "-300",
      edit: null,
    });
    expect(byId["grid-mode-value"].edit).toMatchObject({
      key: "gridMode",
      control: "select",
      value: 11,
    });
    expect(byId["grid-display"].value).toBe("Displayed");
    expect(byId["grid-units"].value).toBe("Real-size units");
    expect(byId["grid-snapping"].value).toBe("Enabled");
    expect(byId["grid-spacing-x"].edit).toMatchObject({
      key: "gridSpacingX",
      control: "number",
      value: 100,
    });
    expect(byId["grid-base-y"].edit).toMatchObject({
      key: "gridBaseY",
      value: -4.5,
    });
    expect(byId.memo.edit).toMatchObject({
      key: "memo",
      control: "textarea",
      value: "Fixture memo",
      rows: 3,
    });
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
    expect(byId["print-origin-x"].edit).toMatchObject({
      key: "printOriginX",
      control: "number",
      value: 1,
    });
    expect(byId["print-scale"].edit).toMatchObject({
      key: "printScale",
      control: "number",
      value: 0.5,
    });
    expect(byId["print-rotation"].edit).toMatchObject({
      key: "printRotationSetting",
      control: "select",
      value: 1,
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

  it("exposes only the official 0-9 color tables as native-editable controls", () => {
    const document = nativeDocument();
    const screenEntry = (number) => ({
      red: number * 10,
      green: number * 10,
      blue: number * 10,
      width: 1,
      hex: `#${(number * 10).toString(16).padStart(2, "0").repeat(3)}`,
    });
    const printEntry = (number) => ({
      ...screenEntry(number),
      width: number + 1,
      pointRadius: 0.1 + number / 10,
    });
    document.settings.color = {
      ...document.settings.color,
      id: "jww:color-settings",
      sourceLayout: "jwdatafmt-color-tables-v600-v700",
      sourceSpan: { start: 1000, end: 1240, byteLength: 240 },
      backgroundColor: screenEntry(0),
      screenColors: Object.fromEntries(
        Array.from({ length: 9 }, (_, index) => [index + 1, screenEntry(index + 1)])
      ),
      printBackgroundColor: printEntry(0),
      printColors: Object.fromEntries(
        Array.from({ length: 9 }, (_, index) => [index + 1, printEntry(index + 1)])
      ),
    };
    const projection = buildJwwBasicSettingsProjection(document);
    const colorTab = projection.tabs.find((tab) => tab.id === "colors");
    const screenRows = colorTab.sections.find(
      (section) => section.id === "screen-colors"
    ).rows;
    const printRows = colorTab.sections.find(
      (section) => section.id === "print-colors"
    ).rows;

    expect(screenRows.map((row) => row.id)).toEqual(
      Array.from({ length: 10 }, (_, number) => `screen-${number}`)
    );
    expect(printRows.map((row) => row.id)).toEqual(
      Array.from({ length: 10 }, (_, number) => `print-${number}`)
    );
    expect(screenRows[0].edits[2]).toMatchObject({
      key: "backgroundColor",
      control: "color",
    });
    expect(screenRows[1].edits[4]).toMatchObject({
      key: "screenColorWidths.1",
      min: 1,
      max: 16,
    });
    expect(printRows[0].edits[5]).toMatchObject({
      key: "printBackgroundPointRadius",
      min: 0.1,
      max: 10,
    });
    expect(printRows[9].edits[2]).toMatchObject({
      key: "printColors.9",
      control: "color",
    });
    expect(printRows[9].edits[4]).toMatchObject({
      key: "printColorWidths.9",
      max: 500,
    });
    expect(screenRows.some((row) => row.id === "screen-10")).toBe(false);
  });

  it("exposes only the official 17-row line type table as named native-editable controls", () => {
    const document = nativeDocument();
    document.settings.lineType = {
      id: "jww:line-type-settings",
      offset: 1240,
      byteLength: 292,
      score: 102,
      sourceLayout: "jwdatafmt-line-type-tables-v600-v700",
      sourceSpan: { start: 1240, end: 1532, byteLength: 292 },
      rows: Object.fromEntries(
        JWW_LINE_TYPE_ROW_DEFINITIONS.map((definition, index) => {
          const params = definition.fields.map((field) => field.minimum);
          return [
            definition.key,
            {
              pattern: "99999999",
              family: definition.family,
              ...Object.fromEntries(
                definition.fields.map((field, fieldIndex) => [
                  field.key,
                  params[fieldIndex],
                ])
              ),
              params,
              values: ["99999999", ...params],
              offset: 1240 + index * 16,
            },
          ];
        })
      ),
    };
    const projection = buildJwwBasicSettingsProjection(document);
    const section = projection.tabs
      .find((tab) => tab.id === "line-types")
      .sections.find((candidate) => candidate.id === "line-type-table");

    expect(section.columns).toEqual([
      "Key",
      "Pattern",
      "Unit dots",
      "Screen amplitude",
      "Screen pitch",
      "Print amplitude",
      "Print pitch",
    ]);
    expect(section.rows.length).toBe(17);
    expect(section.rows[0].edits[1]).toMatchObject({
      key: "lineTypeRows.LTYPE_02.pattern",
      control: "text",
      maxLength: 8,
    });
    expect(section.rows[0].edits[2]).toMatchObject({
      key: "lineTypeRows.LTYPE_02.unitDotCount",
      min: 1,
      max: 32,
    });
    expect(section.rows[8].edits[3]).toMatchObject({
      key: "lineTypeRows.LTYPE_R1.screenAmplitude",
      min: 1,
      max: 16,
    });
    expect(section.rows[8].edits[5]).toMatchObject({
      key: "lineTypeRows.LTYPE_R1.printAmplitude",
      min: 1,
      max: 16,
    });
    expect(section.rows[16].edits[6]).toMatchObject({
      key: "lineTypeRows.LTYPE_L4.printPitch",
      max: 160,
    });
    expect(section.rows.some((row) => row.id === "ltype_hc")).toBe(false);
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
