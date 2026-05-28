import { buildJwwEnvironment } from "./environment.js";

describe("buildJwwEnvironment", () => {
  it("maps extracted JWW settings to JWF-like keys", () => {
    const environment = buildJwwEnvironment({
      version: 420,
      memo: "memo",
      paper_size: 2,
      write_layer_group: 3,
      print_settings: {
        origin_x: 10,
        origin_y: 20,
        scale: 100,
        rotation_setting: 1,
      },
      sunpou_settings: { max_line_width: 9 },
      color_settings: {
        screenColors: {
          1: { red: 120, green: 120, blue: 120, width: 1, hex: "#787878" },
        },
        printColors: {
          1: {
            red: 0,
            green: 0,
            blue: 0,
            width: 2,
            pointRadius: 0.3,
            hex: "#000000",
          },
        },
        backgroundColor: {
          red: 255,
          green: 255,
          blue: 255,
          width: 0,
          hex: "#ffffff",
        },
        specialColors: {
          S: { red: 255, green: 0, blue: 0, hex: "#ff0000" },
          K: { red: 255, green: 128, blue: 0, hex: "#ff8000" },
          Z: { red: 128, green: 128, blue: 128, hex: "#808080" },
        },
      },
      line_type_settings: {
        offset: 100,
        byteLength: 16,
        score: 90,
        rows: {
          LTYPE_02: {
            pattern: "99999999",
            params: [4, 1, 10],
            values: ["99999999", 4, 1, 10],
            offset: 100,
          },
        },
        tailCandidate: {
          key: "LTYPE_HC",
          offset: 116,
          byteLength: 24,
          u32: [0, 1, 2, 1, 0, 0],
          u32Semantic: {
            selectionTemporaryLineTypeNo: 0,
            crosslineCursorLineTypeNo: 1,
            dashPitchAutoAdjust: 2,
            rightClickBaseLineColorNo: 1,
            rightClickBaseLineTypeNo: 0,
            lineEndStyle: 0,
            lineEndStyleName: "round",
          },
          u16: [0, 0, 1, 0, 2, 0, 1, 0, 0, 0, 0, 0],
          note: "candidate",
        },
      },
      layer_groups: [
        {
          state: 1,
          write_layer: 2,
          scale: 100,
          protect: 0,
          name: "Group0",
          layers: [
            { state: 1, protect: 0, name: "Layer0" },
          ],
        },
      ],
    });

    expect(environment.paper.paperCode).toBe(2);
    expect(environment.layers.LAYSCALE["0"]).toBe(100);
    expect(environment.layers.LAYNAM_0[0]).toBe("Group0");
    expect(environment.layers.LAYNAM_0[1]).toBe("Layer0");
    expect(environment.colors.LCOLLOR_1.hex).toBe("#787878");
    expect(environment.colors.PCOLLOR_1.width).toBe(2);
    expect(environment.colors.PCOLLOR_1.pointRadius).toBe(0.3);
    expect(environment.colors.LCOLLOR_B.hex).toBe("#ffffff");
    expect(environment.colors.LCOLLOR_S.hex).toBe("#ff0000");
    expect(environment.colors.LCOLLOR_K.hex).toBe("#ff8000");
    expect(environment.colors.LCOLLOR_Z.hex).toBe("#808080");
    expect(environment.print.scale).toBe(100);
    expect(environment.lineTypes.LTYPE_02.pattern).toBe("99999999");
    expect(environment.lineTypes.LTYPE_HC_candidate.u32).toEqual([
      0,
      1,
      2,
      1,
      0,
      0,
    ]);
    expect(environment.lineTypes.LTYPE_HC_candidate.u32Semantic).toMatchObject({
      selectionTemporaryLineTypeNo: 0,
      crosslineCursorLineTypeNo: 1,
      dashPitchAutoAdjust: 2,
      rightClickBaseLineColorNo: 1,
      rightClickBaseLineTypeNo: 0,
      lineEndStyle: 0,
      lineEndStyleName: "round",
    });
    expect(environment.coverage.supportedKeys).toContain("LAYSCALE");
    expect(environment.coverage.supportedKeys).toContain("LCOLLOR_1");
    expect(environment.coverage.supportedKeys).toContain("LTYPE_02");
    expect(environment.coverage.supportedKeys).toContain("LCOLLOR_S");
    expect(environment.coverage.supportedKeys).toContain("LCOLLOR_K");
    expect(environment.coverage.supportedKeys).toContain("LCOLLOR_Z");
    expect(environment.coverage.missingJwfKeys).toContain("LTYPE_HC");
  });
});
