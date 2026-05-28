import {
  candidatePatterns,
  isLowInformationNumericSequence,
} from "./jwfValueScan.js";

describe("candidatePatterns", () => {
  it("keeps RGB triplets for three-value JWF colors", () => {
    const patterns = candidatePatterns({
      key: "LCOLLOR_M",
      values: [200, 200, 200],
    });

    expect(patterns.map((pattern) => pattern.kind)).toContain("rgb-triplet");
    expect(
      patterns.find((pattern) => pattern.kind === "rgb-triplet").bytes
    ).toEqual(Uint8Array.from([200, 200, 200]));
  });

  it("checks compact integer forms for layer default tables", () => {
    const patterns = candidatePatterns({
      key: "LAYCOL_0",
      values: [1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 8, 8, 2, 2, 8],
    });

    expect(patterns.map((pattern) => pattern.kind)).toEqual(
      expect.arrayContaining([
        "u8-sequence",
        "u16-sequence",
        "i16-sequence",
        "u32-sequence",
        "i32-sequence",
        "f64-sequence",
      ])
    );
  });
});

describe("isLowInformationNumericSequence", () => {
  it("treats short all-zero and short 0/1 setting rows as ambiguous candidates", () => {
    expect(isLowInformationNumericSequence([0, 0, 0, 0, 0])).toBe(true);
    expect(isLowInformationNumericSequence([1, 0, 1, 1, 0])).toBe(true);
    expect(
      isLowInformationNumericSequence([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0])
    ).toBe(true);
    expect(isLowInformationNumericSequence([-1, -1, 0, 0, 0, 0])).toBe(true);
  });

  it("keeps more distinctive numeric rows eligible for direct matching", () => {
    expect(isLowInformationNumericSequence([0, 3, 6, 0])).toBe(false);
    expect(isLowInformationNumericSequence([1, 4, 7, 9, 12, 15])).toBe(false);
  });

  it("treats very short numeric rows as ambiguous because they match too easily", () => {
    expect(isLowInformationNumericSequence([1, 4])).toBe(true);
  });
});
