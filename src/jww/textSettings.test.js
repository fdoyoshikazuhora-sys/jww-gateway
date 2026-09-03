import { readFileSync } from "node:fs";

import { parse } from "./parser.js";
import {
  encodeJwwTextSettings,
  hasOfficialJwwTextSettingsLayout,
  JWW_TEXT_SETTINGS_ENTITY_LIST_DISTANCE,
} from "./textSettings.js";
import { buildJwwBytes, patchJwwTemplatePrefixMetadata } from "./writer.js";

const officialFixture = () =>
  readFileSync(
    new URL("../../samples/jwf-pairs/jwf-open-items-core.jww", import.meta.url)
  );

describe("JWW official text type settings", () => {
  it("parses the official ten-row table and current write-text values", () => {
    const parsed = parse(officialFixture());
    const settings = parsed.text_settings;

    expect(hasOfficialJwwTextSettingsLayout(settings)).toBe(true);
    expect(settings.sourceSpan).toEqual({
      start: parsed.entity_list_offset - JWW_TEXT_SETTINGS_ENTITY_LIST_DISTANCE,
      end: parsed.entity_list_offset - 68,
      byteLength: 312,
    });
    expect(settings.presets.length).toBe(10);
    expect(settings.presets[0]).toEqual({
      textType: 1,
      width: 2,
      height: 2,
      spacing: 0,
      colorNumber: 1,
    });
    expect(settings.current).toMatchObject({
      width: 3,
      height: 3,
      spacing: 0.5,
      colorNumber: 2,
      textType: 3,
    });
  });

  it("recognizes the same fixed layout in generated v600 and v700 prefixes", () => {
    for (const version of [600, 700]) {
      const parsed = parse(buildJwwBytes({ version, entities: [] }));
      expect(parsed.version).toBe(version);
      expect(hasOfficialJwwTextSettingsLayout(parsed.text_settings)).toBe(true);
      expect(parsed.text_settings.presets.length).toBe(10);
    }
  });

  it("patches only the selected preset fields and reparses them", () => {
    const bytes = officialFixture();
    const parsed = parse(bytes);
    const settings = encodeJwwTextSettings(parsed.text_settings, {
      textTypePresets: {
        2: { width: 2.75, height: 3.25, spacing: 0.75, colorNumber: 8 },
      },
    });
    const prefix = bytes.subarray(0, parsed.entity_list_offset);
    const revisedPrefix = patchJwwTemplatePrefixMetadata(prefix, {
      textSettings: settings,
    });
    const revised = Uint8Array.from(bytes);
    revised.set(revisedPrefix, 0);
    const reopened = parse(revised);

    expect(reopened.text_settings.presets[1]).toEqual({
      textType: 2,
      width: 2.75,
      height: 3.25,
      spacing: 0.75,
      colorNumber: 8,
    });
    expect(revised.slice(0, settings.presetSourceSpan.start)).toEqual(
      bytes.slice(0, settings.presetSourceSpan.start)
    );
    expect(revised.slice(settings.presetSourceSpan.end)).toEqual(
      bytes.slice(settings.presetSourceSpan.end)
    );
  });

  it("rejects missing spans, unknown fields and unsafe values", () => {
    const settings = parse(officialFixture()).text_settings;
    const message = (callback) => {
      try {
        callback();
        return "";
      } catch (error) {
        return error?.message || String(error);
      }
    };

    expect(
      message(() =>
        encodeJwwTextSettings({ ...settings, sourceSpan: null }, {
          textTypePresets: { 1: { width: 3 } },
        })
      )
    ).toContain("verified official 312-byte source span");
    expect(
      message(() =>
        encodeJwwTextSettings(settings, {
          textTypePresets: { 11: { width: 3 } },
        })
      )
    ).toContain("Unknown JWW text type preset");
    expect(
      message(() =>
        encodeJwwTextSettings(settings, {
          textTypePresets: { 1: { width: 0 } },
        })
      )
    ).toContain("Invalid JWW text type 1 width");
    expect(
      message(() =>
        encodeJwwTextSettings(settings, {
          textTypePresets: { 1: { colorNumber: 10 } },
        })
      )
    ).toContain("integer from 0 to 9");
  });
});
