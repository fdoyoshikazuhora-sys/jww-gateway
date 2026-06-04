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
    expect(parsed.families.layerNames.LAYNAM_0).toEqual([
      "Group",
      "Layer0",
      "Layer1",
    ]);
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

  it("adds and normalizes public JWF layer default settings", () => {
    const parsed = parseJwfText(`
LAYCOL_F = 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3
LAYWID_F = -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1
LAYTYP_F = 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3
`);

    expect(parsed.entries.LAYCOL_F.definition.label).toBe("default layer color");
    expect(parsed.entries.LAYWID_F.definition.note).toContain(
      "-2 keeps current width"
    );
    expect(parsed.entries.LAYTYP_F.definition.note).toContain("except 10");
    expect(
      parsed.normalizedSettings.layerDefaults.groups.F.layers.F
    ).toMatchObject({
      colorNumber: 3,
      switchesColor: true,
      width: -1,
      mode: "currentColorWidth",
      lineTypeNumber: 3,
      switchesLineType: true,
      valid: true,
    });
    expect(parsed.normalizedSettings.layerDefaults.groupCount).toBe(1);
    expect(parsed.normalizedSettings.layerDefaults.presentKeyCount).toBe(3);
  });

  it("adds and normalizes public JWF text, dimension, hatch, and command settings", () => {
    const parsed = parseJwfText(`
MSET = 3 1 4 700 60 100 0 0 0
MHEN = 0 "MS Gothic"
MWIDE = 2.0 2.5 3.0 4.0 5.0 6.0 7.0 8.0 9.0 10.0
MHIGH = 3.0 3.5 4.0 5.0 6.0 7.0 8.0 9.0 10.0 11.0
MDIST = 0.0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9
MPEN = 1 2 3 4 5 6 7 8 1 2
S_STR1 = 2 1 0.5 0 0 "MS Gothic"
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
    expect(parsed.entries.S_SET1.definition.valueSchema).toContain(
      "dimensionLineColor"
    );
    expect(parsed.entries.HATCH_0.definition.note).toContain("one line");
    expect(parsed.entries.HATCH_1.definition.valueSchema).toEqual([
      "angle",
      "pitch",
      "lineSpacing",
      "realSizeMode",
    ]);
    expect(parsed.entries.COM_LAY01.definition.label).toBe(
      "command layer default"
    );
    expect(parsed.entries.COM_LAY01.definition.scope).toBe("operation");
    expect(parsed.entries.KEY_A.definition.label).toBe(
      "keyboard shortcut assignment"
    );
    expect(parsed.normalizedSettings.text.command).toMatchObject({
      textType: 3,
      direction: 1,
      alignment: 4,
      textDisplayLimit: 700,
    });
    expect(parsed.normalizedSettings.text.conversion.fontFamily).toBe("MS Gothic");
    expect(parsed.normalizedSettings.text.textTypes[0]).toEqual({
      type: 1,
      width: 2,
      height: 3,
      spacing: 0,
      colorNumber: 1,
    });
    expect(parsed.normalizedSettings.text.textTypes[9]).toMatchObject({
      type: 10,
      width: 10,
      height: 11,
      spacing: 0.9,
      colorNumber: 2,
    });
  });

  it("normalizes explicit JWF colors and unresolved core line type rows without promoting JWW extraction", () => {
    const parsed = parseJwfText(`
LCOLLOR_B = 2 6 23
LCOLLOR_Z = 64 128 192
LCOLLOR_M = 12 34 56
LCOLLOR_H = 80 255 255 1
PCOLLOR_1 = 0 0 0 13 0.2
LTYPE_HC = 1 1 0 2 1 0
`);

    expect(parsed.colorSettings.screenColors.B.hex).toBe("#020617");
    expect(parsed.normalizedSettings.colors.background.hex).toBe("#020617");
    expect(parsed.normalizedSettings.colors.zoomFrame.hex).toBe("#4080c0");
    expect(parsed.normalizedSettings.colors.zoomText.hex).toBe("#0c2238");
    expect(parsed.normalizedSettings.colors.auxiliary.width).toBe(1);
    expect(parsed.normalizedSettings.colors.printColors["1"]).toMatchObject({
      red: 0,
      green: 0,
      blue: 0,
      width: 13,
      pointRadius: 0.2,
    });
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
    expect(parsed.normalizedSettings.lineTypes.hatchCandidate).toEqual([
      1,
      1,
      0,
      2,
      1,
      0,
    ]);
  });
});
