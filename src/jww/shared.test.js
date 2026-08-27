import {
  getJwwScreenColorHex,
  resolveColorHexForBackground,
} from "./shared.js";

describe("resolveColorHexForBackground", () => {
  it("draws white-like colors as dark on a light background", () => {
    expect(
      resolveColorHexForBackground("#f8fafc", {
        red: 255,
        green: 255,
        blue: 255,
      })
    ).toBe("#111111");
  });

  it("draws black-like colors as white on a dark background", () => {
    expect(
      resolveColorHexForBackground("#000000", {
        red: 0,
        green: 0,
        blue: 0,
      })
    ).toBe("#ffffff");
  });

  it("keeps visible colors unchanged", () => {
    expect(
      resolveColorHexForBackground("#00c0c0", {
        red: 255,
        green: 255,
        blue: 255,
      })
    ).toBe("#00c0c0");
  });

  it("applies the same reversal to built-in JWW screen colors", () => {
    expect(
      getJwwScreenColorHex(2, null, "#111111", {
        red: 0,
        green: 0,
        blue: 0,
      })
    ).toBe("#ffffff");
  });
});
