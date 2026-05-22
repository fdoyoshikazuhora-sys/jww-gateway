import { parseJwfText } from "./jwf.js";

describe("parseJwfText", () => {
  it("parses active JWF key value rows before END", () => {
    const parsed = parseJwfText(`
LCOLLOR_1 = 120 120 120 1
PCOLLOR_1 = 0 0 0 2 0.3
LAYNAM_0 =Group,Layer0,Layer1
END
LCOLLOR_2 = 255 255 255 1
`);

    expect(parsed.entryCount).toBe(3);
    expect(parsed.keys).toContain("LCOLLOR_1");
    expect(parsed.keys).not.toContain("LCOLLOR_2");
    expect(parsed.colorSettings.screenColors["1"].hex).toBe("#787878");
    expect(parsed.colorSettings.printColors["1"].pointRadius).toBe(0.3);
    expect(parsed.families.layerNames.LAYNAM_0).toEqual(["Group", "Layer0", "Layer1"]);
    expect(parsed.entries.LCOLLOR_1.definition.label).toBe("screen line color");
    expect(parsed.entries.LCOLLOR_1.definition.scope).toBe("drawing");
    expect(parsed.entries.PCOLLOR_1.definition.valueSchema).toEqual([
      "red",
      "green",
      "blue",
      "printWidth",
      "pointRadius",
    ]);
  });

  it("can include sample documentation rows after END", () => {
    const parsed = parseJwfText("END\nLCOLLOR_2 = 255 255 255 1", {
      includeAfterEnd: true,
    });

    expect(parsed.stoppedAtEnd).toBe(true);
    expect(parsed.keys).toContain("LCOLLOR_2");
  });

  it("adds public JWF definitions for layer default settings", () => {
    const parsed = parseJwfText(`
LAYCOL_F = 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3
LAYWID_F = -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1
LAYTYP_F = 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3
`);

    expect(parsed.entries.LAYCOL_F.definition.label).toBe("default layer color");
    expect(parsed.entries.LAYWID_F.definition.note).toContain("-2 keeps current width");
    expect(parsed.entries.LAYTYP_F.definition.note).toContain("except 10");
  });

  it("adds public JWF definitions for LTYPE_HC and LCOLLOR_M", () => {
    const parsed = parseJwfText(`
LTYPE_HC = 1 1 0 2 1 0
LCOLLOR_M = 200 200 200
`);

    expect(parsed.entries.LTYPE_HC.definition.label).toBe(
      "line type helper / endpoint setting"
    );
    expect(parsed.entries.LTYPE_HC.definition.valueSchema).toEqual([
      "selectionTemporaryLineTypeNo",
      "crosslineCursorLineTypeNo",
      "dashPitchAutoAdjust",
      "rightClickBaseLineColorNo",
      "rightClickBaseLineTypeNo",
      "lineEndStyle",
    ]);
    expect(parsed.entries.LCOLLOR_M.definition.label).toBe("zoom text color");
    expect(parsed.entries.LCOLLOR_M.definition.valueSchema).toEqual([
      "red",
      "green",
      "blue",
    ]);
  });

  it("adds public JWF definitions for text, dimension, hatch, and command settings", () => {
    const parsed = parseJwfText(`
MSET = 3 1 4 700 60 100 0 0 0
MWIDE = 2.0 2.5 3.0 4.0 5.0 6.0 7.0 8.0 9.0 10.0
S_STR1 = 2 1 0.5 0 0 "$<ＭＳ ゴシック>
S_SET1 = 2 1 1 0 0.0
HATCH_0 = 1
HATCH_1 = 45.00 10.00 1.00 0
COM_LAY01 = 0 0 0
KEY_A = 1 2 3
`);

    expect(parsed.entries.MSET.definition.label).toBe("text command setting");
    expect(parsed.entries.MSET.definition.scope).toBe("document");
    expect(parsed.entries.MWIDE.definition.label).toBe("text type width table");
    expect(parsed.entries.S_STR1.definition.label).toBe("dimension text setting");
    expect(parsed.entries.S_SET1.definition.valueSchema).toContain("dimensionLineColor");
    expect(parsed.entries.HATCH_0.definition.note).toContain("one line");
    expect(parsed.entries.HATCH_1.definition.valueSchema).toEqual([
      "angle",
      "pitch",
      "lineSpacing",
      "realSizeMode",
    ]);
    expect(parsed.entries.COM_LAY01.definition.label).toBe("command layer default");
    expect(parsed.entries.COM_LAY01.definition.scope).toBe("operation");
    expect(parsed.entries.KEY_A.definition.label).toBe("keyboard shortcut assignment");
  });
});
