import {
  createJwfProfile,
  decodeJwfBytes,
  editJwfProfile,
  encodeJwfText,
  openJwfProfile,
  parseJwfText,
  preflightJwfProfileSave,
  saveJwfProfile,
  removeJwfProfileEntry,
  updateJwfProfileEntry,
  validateJwfText,
} from "./jwf.js";

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
    expect(parsed.entries.LAYCOL_F.definition.scope).toBe("operation");
    expect(parsed.entries.LAYCOL_F.definition.note).toContain(
      "not serialized into JWW"
    );
    expect(parsed.entries.LAYWID_F.definition.scope).toBe("operation");
    expect(parsed.entries.LAYTYP_F.definition.scope).toBe("operation");
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

  it("normalizes JWF-only zoom text and helper/endpoint operation settings", () => {
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
      "selection/crossline helper and endpoint setting"
    );
    expect(parsed.entries.LTYPE_HC.definition.scope).toBe("operation");
    expect(parsed.entries.LCOLLOR_M.definition.scope).toBe("operation");
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
    expect(parsed.normalizedSettings.lineTypes.helperEndpoint).toEqual(
      parsed.normalizedSettings.lineTypes.hatchCandidate
    );
  });

  it("normalizes operation-only JWF settings for connected app persistence", () => {
    const parsed = parseJwfText(`
S_COMM_0 = 1 2 3
S_MESH_0 = 1 0 455 455 5 0
ZOOM = 0 1 2 3 4 5 6 7 8
R_CROSS_SET = 1 2 3
LD_AM = 26 4 1 0 11 30 20 0 21 48 47 45
LD_PM = 25 22 6 0 5 66 10 0 27 24 10 10
RD_AM = 31 64 14 0 59 75 28 0 7 0 29 0
RD_PM = 48 63 50 0 54 51 53 0 52 65 49 62
LD2_AM = 1 2 3 4 5 6 7 8 9 10 11 12
RD2_PM = 12 11 10 9 8 7 6 5 4 3 2 1
COM_LAY01 = 0 1 2
GCOM_100 = LINE RECT CIRCLE
AC_COM = 1 2 3
WD_COM = 4 5 6
N_KEY = 1
KEY_A = 1 2 3
KEYF2 = 39 40
`);

    expect(parsed.entries.LD_AM.definition.scope).toBe("operation");
    expect(parsed.normalizedSettings.operation).toMatchObject({
      source: "jwf",
      clockMenus: {
        LD_AM: { side: "left", mode: "auto", page: 1, meridiem: "AM" },
        LD2_AM: { side: "left", mode: "auto", page: 2, meridiem: "AM" },
        RD2_PM: { side: "right", mode: "auto", page: 2, meridiem: "PM" },
      },
      commandLayers: { COM_LAY01: [0, 1, 2] },
      commandGroups: { GCOM_100: ["LINE", "RECT", "CIRCLE"] },
      autoMode: { raw: [1, 2, 3] },
      windowCommands: { raw: [4, 5, 6] },
      keyboard: { mode: 1 },
    });
    expect(parsed.normalizedSettings.operation.clockMenus.LD_AM.assignments.length).toBe(12);
    expect(parsed.normalizedSettings.operation.clockMenus.LD_AM.assignments[0]).toEqual({
      hour: 0,
      commandNumber: 26,
    });
    expect(parsed.normalizedSettings.operation.clockMenus.LD_AM.assignments[11]).toEqual({
      hour: 11,
      commandNumber: 45,
    });
    expect(parsed.normalizedSettings.operation.keyboard.shortcuts.A).toEqual({
      key: "KEY_A",
      commandNumbers: [1, 2, 3],
      raw: [1, 2, 3],
    });
    expect(parsed.normalizedSettings.operation.keyboard.shortcuts.F2).toMatchObject({
      key: "KEYF2",
      commandNumbers: [39, 40],
    });
  });
});

describe("JWF environment profile read, write, edit, and create", () => {
  it("preserves untouched source bytes exactly", () => {
    const bytes = encodeJwfText("# 設備設定\r\nMSET = 2 0 0 500 60 100 0 0 0\r\nEND\r\n", {
      preserveLineEndings: true,
    });
    const profile = openJwfProfile(bytes, { sourceName: "equipment.jwf" });
    const preflight = preflightJwfProfileSave(profile);
    const saved = saveJwfProfile(profile);

    expect(profile.sourceName).toBe("equipment.jwf");
    expect(profile.dirty).toBe(false);
    expect(preflight).toMatchObject({ ok: true, strategy: "original-bytes" });
    expect(Array.from(saved.bytes)).toEqual(Array.from(bytes));
    expect(decodeJwfBytes(saved.bytes)).toContain("# 設備設定");
  });

  it("re-encodes edited profiles as Shift_JIS and reparses the changes", () => {
    const source = encodeJwfText("MSET = 1 0 0 500 60 100 0 0 0\r\nEND\r\n");
    const profile = openJwfProfile(source);
    const edited = editJwfProfile(
      profile,
      "# 日本語\nMSET = 7 0 0 500 60 100 0 0 0\nEND\n"
    );
    const saved = saveJwfProfile(edited);

    expect(edited.dirty).toBe(true);
    expect(saved.strategy).toBe("shift-jis-reencode");
    expect(decodeJwfBytes(saved.bytes)).toContain("# 日本語\r\nMSET = 7");
    expect(parseJwfText(decodeJwfBytes(saved.bytes)).entries.MSET.values[0]).toBe(7);
  });

  it("creates a valid separate environment profile template", () => {
    const profile = createJwfProfile({ title: "Office profile" });
    expect(profile.kind).toBe("jwf-environment-profile");
    expect(profile.dirty).toBe(true);
    expect(profile.text).toContain("# Office profile");
    expect(profile.text).toContain("\r\nEND\r\n");
    expect(preflightJwfProfileSave(profile).ok).toBe(true);
  });

  it("blocks malformed rows before export", () => {
    const profile = createJwfProfile();
    const edited = editJwfProfile(profile, "MSET 1 2 3\nEND\n");
    const validation = validateJwfText(edited.text);
    const preflight = preflightJwfProfileSave(edited);

    expect(validation.ok).toBe(false);
    expect(validation.errors[0].code).toBe("JWF_INVALID_LINE");
    expect(preflight.ok).toBe(false);
    let saveError = null;
    try {
      saveJwfProfile(edited);
    } catch (error) {
      saveError = error;
    }
    expect(saveError?.message).toEqual(
      expect.stringMatching(/Expected KEY = value/)
    );
  });

  it("blocks characters that cannot be represented in Shift_JIS", () => {
    const validation = validateJwfText("# emoji 😀\nEND\n");
    expect(validation.ok).toBe(false);
    expect(validation.errors.some((item) => item.code === "JWF_SHIFT_JIS_ENCODING_FAILED")).toBe(true);
    let encodingError = null;
    try {
      encodeJwfText("😀");
    } catch (error) {
      encodingError = error;
    }
    expect(encodingError?.message).toEqual(
      expect.stringMatching(/cannot be encoded as Shift_JIS/)
    );
  });

  it("warns for duplicate keys and inactive rows after END", () => {
    const validation = validateJwfText(
      "MSET = 1\nMSET = 2\nEND\n97 = documentation text\nKEY_A = 1\n"
    );
    expect(validation.ok).toBe(true);
    expect(validation.keyCount).toBe(1);
    expect(validation.inactiveKeyCount).toBe(1);
    expect(validation.warnings.map((item) => item.code)).toEqual([
      "JWF_DUPLICATE_KEY",
      "JWF_ENTRY_AFTER_END",
    ]);
  });

  it("accepts the double-slash annotation form present in the Jw_cad sample", () => {
    const validation = validateJwfText(
      "KEY76 = 0 90\r\n\t//(72) paste and shape rotation note\r\nEND\r\n"
    );

    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.keyCount).toBe(1);
  });

  it("updates one active setting while preserving comments and other rows", () => {
    const profile = openJwfProfile(encodeJwfText(
      "# header\r\nMSET = 1 0 0 # keep this comment\r\nKEY_A = 5 6\r\nEND\r\n"
    ));
    const edited = updateJwfProfileEntry(profile, "MSET", [3, 1, 0]);

    expect(edited.text).toContain("# header\r\n");
    expect(edited.text).toContain("MSET = 3 1 0 # keep this comment");
    expect(edited.text).toContain("KEY_A = 5 6");
    expect(edited.parsed.entries.MSET.values).toEqual([3, 1, 0]);
  });

  it("adds a setting before END and removes only its active row", () => {
    const profile = createJwfProfile();
    const added = updateJwfProfileEntry(profile, "LCOLLOR_M", [12, 34, 56]);
    const removed = removeJwfProfileEntry(added, "LCOLLOR_M");

    expect(added.text.indexOf("LCOLLOR_M")).toBeGreaterThan(0);
    expect(added.text.indexOf("LCOLLOR_M")).toBeGreaterThan(
      added.text.indexOf("# This profile")
    );
    expect(added.text.indexOf("END")).toBeGreaterThan(
      added.text.indexOf("LCOLLOR_M")
    );
    expect(removed.text.includes("LCOLLOR_M")).toBe(false);
    expect(removed.text).toContain("END");
  });
});
