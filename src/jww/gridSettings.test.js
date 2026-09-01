import {
  decodeJwwGridSettings,
  encodeJwwGridSettings,
  JWW_GRID_MODE_OPTIONS,
} from "./gridSettings.js";

describe("JWW grid settings", () => {
  const settings = {
    id: "jww:grid-settings",
    mode: 11,
    minimum_display_spacing: 10,
    spacing_x: 100,
    spacing_y: 200,
    base_x: 3.5,
    base_y: -4.5,
    sourceSpan: { start: 200, end: 244, byteLength: 44 },
  };

  it("decodes the official mode digits and sign", () => {
    expect(decodeJwwGridSettings(settings)).toMatchObject({
      mode: 11,
      display: true,
      realSizeUnits: true,
      snapping: true,
    });
    expect(decodeJwwGridSettings({ ...settings, mode: -1 })).toMatchObject({
      display: true,
      realSizeUnits: false,
      snapping: false,
    });
  });

  it("encodes named edits without removing native metadata", () => {
    expect(
      encodeJwwGridSettings(settings, {
        gridMode: -11,
        gridMinimumDisplaySpacing: 12,
        gridSpacingX: 250,
        gridSpacingY: 500,
        gridBaseX: 1.25,
        gridBaseY: -2.5,
      })
    ).toEqual({
      ...settings,
      mode: -11,
      minimum_display_spacing: 12,
      spacing_x: 250,
      spacing_y: 500,
      base_x: 1.25,
      base_y: -2.5,
    });
  });

  it("publishes only documented, representable mode encodings", () => {
    expect(JWW_GRID_MODE_OPTIONS.map((option) => option.value)).toEqual([
      0, 1, 10, 11, -1, -10, -11,
    ]);
  });

  it("rejects undocumented modes and invalid geometry", () => {
    const messages = [
      { edits: { gridMode: -2 }, expected: "Unsupported JWW grid mode" },
      { edits: { gridSpacingX: 0 }, expected: "greater than zero" },
      {
        edits: { gridMinimumDisplaySpacing: 4 },
        expected: "between 5 and 100 dots",
      },
      {
        edits: { gridMinimumDisplaySpacing: 101 },
        expected: "between 5 and 100 dots",
      },
    ].map(({ edits, expected }) => {
      let message = "";
      try {
        encodeJwwGridSettings(settings, edits);
      } catch (error) {
        message = error.message;
      }
      return { message, expected };
    });
    for (const { message, expected } of messages) {
      expect(message).toContain(expected);
    }
  });
});
