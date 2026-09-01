import { readFileSync } from "node:fs";

import {
  encodeJwwColorSettings,
  hasOfficialJwwColorSettingsLayout,
  normalizeJwwColorSettingsRecord,
} from "./colorSettings.js";
import { parse } from "./parser.js";

function fixtureSettings() {
  const bytes = readFileSync(
    new URL("../../samples/jwf-pairs/jwf-open-items-core.jww", import.meta.url)
  );
  return parse(bytes).color_settings;
}

describe("JWW official color settings", () => {
  it("encodes named screen and print edits without removing source metadata", () => {
    const source = fixtureSettings();
    const revised = encodeJwwColorSettings(source, {
      backgroundColor: "#102030",
      backgroundLineWidth: 16,
      screenColors: { 1: "#123456" },
      screenColorWidths: { 1: 4 },
      printBackgroundColor: "#fefdfc",
      printBackgroundLineWidth: 500,
      printBackgroundPointRadius: 10,
      printColors: { 9: "#654321" },
      printColorWidths: { 9: 25 },
      printPointRadii: { 9: 0.7 },
    });

    expect(hasOfficialJwwColorSettingsLayout(revised)).toBe(true);
    expect(revised.sourceSpan).toEqual(source.sourceSpan);
    expect(revised.backgroundColor).toMatchObject({
      hex: "#102030",
      width: 16,
    });
    expect(revised.screenColors[1]).toMatchObject({
      red: 18,
      green: 52,
      blue: 86,
      width: 4,
      hex: "#123456",
    });
    expect(revised.printBackgroundColor).toMatchObject({
      hex: "#fefdfc",
      width: 500,
      pointRadius: 10,
    });
    expect(revised.printColors[9]).toMatchObject({
      hex: "#654321",
      width: 25,
      pointRadius: 0.7,
    });
    expect(revised.specialColors).toEqual(source.specialColors);
  });

  it("rejects unverified layouts and out-of-range official values", () => {
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
      [{ screenColors: { 10: "#000000" } }, "1 through 9"],
      [{ screenColorWidths: { 1: 17 } }, "1 to 16"],
      [{ printColorWidths: { 1: 501 } }, "1 to 500"],
      [{ printPointRadii: { 1: 0 } }, "0.1 to 10"],
      [{ screenColors: { 1: "not-a-color" } }, "#RRGGBB"],
    ]) {
      expect(errorMessage(() => encodeJwwColorSettings(source, edits))).toContain(message);
    }
    expect(errorMessage(() =>
      encodeJwwColorSettings({ ...source, sourceSpan: null }, { screenColors: { 1: "#000000" } })
    )).toContain("verified official 240-byte source span");
    expect(errorMessage(() =>
      normalizeJwwColorSettingsRecord({
        ...source,
        screenColors: { ...source.screenColors, 10: source.screenColors[9] },
      })
    )).toContain("exactly color numbers 1 through 9");
  });
});
