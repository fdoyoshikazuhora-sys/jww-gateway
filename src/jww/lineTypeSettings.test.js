import { readFileSync } from "node:fs";

import {
  encodeJwwLineTypeSettings,
  hasOfficialJwwLineTypeSettingsLayout,
  JWW_LINE_TYPE_ROW_DEFINITIONS,
  normalizeJwwLineTypeSettingsRecord,
} from "./lineTypeSettings.js";
import { parse } from "./parser.js";

function fixtureSettings() {
  const bytes = readFileSync(
    new URL("../../samples/jwf-pairs/jwf-open-items-core.jww", import.meta.url)
  );
  return parse(bytes).line_type_settings;
}

describe("JWW official line type settings", () => {
  it("maps the exact 17-row, 292-byte table to named fields", () => {
    const settings = fixtureSettings();

    expect(hasOfficialJwwLineTypeSettingsLayout(settings)).toBe(true);
    expect(settings.sourceSpan).toEqual({
      start: 4344,
      end: 4636,
      byteLength: 292,
    });
    expect(Object.keys(settings.rows)).toEqual(
      JWW_LINE_TYPE_ROW_DEFINITIONS.map(({ key }) => key)
    );
    expect(settings.rows.LTYPE_02).toMatchObject({
      family: "ordinary",
      pattern: "99999999",
      unitDotCount: 4,
      screenPitch: 1,
      printPitch: 10,
      params: [4, 1, 10],
    });
    expect(settings.rows.LTYPE_R1).toMatchObject({
      family: "random",
      screenAmplitude: 1,
      screenPitch: 5,
      printAmplitude: 3,
      printPitch: 10,
    });
  });

  it("encodes ordinary, random, and doubled rows without changing source metadata", () => {
    const source = fixtureSettings();
    const revised = encodeJwwLineTypeSettings(source, {
      lineTypeRows: {
        LTYPE_02: {
          pattern: "aaaaaaaa",
          unitDotCount: 8,
          screenPitch: 2,
          printPitch: 10,
        },
        LTYPE_R1: {
          pattern: "12345678",
          screenAmplitude: 2,
          screenPitch: 4,
          printAmplitude: 3,
          printPitch: 20,
        },
        LTYPE_L4: { unitDotCount: 16, screenPitch: 8, printPitch: 160 },
      },
    });

    expect(revised.sourceSpan).toEqual(source.sourceSpan);
    expect(revised.rows.LTYPE_02).toMatchObject({
      pattern: "aaaaaaaa",
      params: [8, 2, 10],
    });
    expect(revised.rows.LTYPE_R1).toMatchObject({
      pattern: "12345678",
      params: [2, 4, 3, 20],
    });
    expect(revised.rows.LTYPE_L4.params).toEqual([16, 8, 160]);
  });

  it("rejects unverified layouts, unknown fields, and values outside Jw_cad ranges", () => {
    const source = fixtureSettings();
    const errorMessage = (callback) => {
      try {
        callback();
        return "";
      } catch (error) {
        return error?.message || String(error);
      }
    };
    for (const [edits, message] of [
      [{ lineTypeRows: { LTYPE_20: { pattern: "00000000" } } }, "Unknown JWW line type row"],
      [{ lineTypeRows: { LTYPE_02: { pattern: "abc" } } }, "eight hexadecimal digits"],
      [{ lineTypeRows: { LTYPE_02: { unitDotCount: 33 } } }, "1 to 32"],
      [{ lineTypeRows: { LTYPE_R1: { screenAmplitude: 17 } } }, "1 to 16"],
      [{ lineTypeRows: { LTYPE_R1: { printPitch: 161 } } }, "1 to 160"],
      [{ lineTypeRows: { LTYPE_R1: { unsupported: 1 } } }, "Unknown JWW line type field"],
    ]) {
      expect(errorMessage(() => encodeJwwLineTypeSettings(source, edits))).toContain(message);
    }
    expect(
      errorMessage(() =>
        encodeJwwLineTypeSettings(
          { ...source, sourceSpan: null },
          { lineTypeRows: { LTYPE_02: { printPitch: 10 } } }
        )
      )
    ).toContain("verified official 292-byte source span");
    expect(
      errorMessage(() =>
        normalizeJwwLineTypeSettingsRecord({
          ...source,
          rows: { ...source.rows, LTYPE_20: source.rows.LTYPE_02 },
        })
      )
    ).toContain("exactly the official 17 rows");
  });
});
