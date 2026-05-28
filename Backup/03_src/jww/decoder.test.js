import {
  analyzeJwwSpecialText,
  buildJwwTextSegments,
  buildJwwDecoderLabels,
  decodeJwwString,
  decodeJwwStringWithMetadata,
  normalizeJwwSpecialText,
} from "./decoder.js";

describe("JWW decoder", () => {
  it("prefers Shift_JIS compatible labels for JWW text", () => {
    expect(buildJwwDecoderLabels("shift-jis")).toEqual([
      "shift_jis",
      "windows-31j",
      "ms932",
    ]);
  });

  it("applies JWW Shift_JIS compatibility replacements for unit symbols", () => {
    const bytes = Uint8Array.from([0x32, 0x30, 0x87, 0x6f]);

    expect(decodeJwwString(bytes, "shift_jis")).toBe("20\u339C");
  });

  it("keeps compatibility replacements scoped to Shift_JIS-style encodings", () => {
    const bytes = Uint8Array.from([0x32, 0x30, 0x87, 0x6f]);

    expect(decodeJwwString(bytes, "utf-8")).not.toBe("20\u339C");
  });

  it("normalizes JWW superscript and subscript markers for display", () => {
    expect(normalizeJwwSpecialText("m^u2 O^d2")).toBe("m\u00B2 O\u2082");
  });

  it("removes JWW text style and overlay markers while keeping readable text", () => {
    expect(normalizeJwwSpecialText("^!太字^% □^w99 P^bL")).toBe(
      "太字 □99 PL"
    );
  });

  it("honors JWW control disable and re-enable markers", () => {
    expect(normalizeJwwSpecialText("^*^!そのまま^^^!太字")).toBe(
      "^!そのまま太字"
    );
  });

  it("keeps JWW overlay commands as special run metadata", () => {
    const result = analyzeJwwSpecialText("□^w99 P^bL ○^oア ^cC^BL");

    expect(result.text).toBe("□99 PL ○ア CL");
    expect(result.specialRuns).toEqual([
      {
        kind: "halfOverlay",
        marker: "^w",
        baseText: "□",
        overlayText: "99",
        start: 0,
        end: 3,
      },
      {
        kind: "overlay",
        marker: "^b",
        baseText: "P",
        overlayText: "L",
        start: 4,
        end: 6,
      },
      {
        kind: "centerOverlay",
        marker: "^o",
        baseText: "○",
        overlayText: "ア",
        start: 7,
        end: 9,
      },
      {
        kind: "middle",
        marker: "^c",
        baseText: " ",
        overlayText: "C",
        start: 9,
        end: 11,
      },
      {
        kind: "strongOverlay",
        marker: "^B",
        baseText: "C",
        overlayText: "L",
        start: 10,
        end: 12,
      },
    ]);
  });

  it("returns raw, resolved, and normalized text metadata when decoding", () => {
    const bytes = Uint8Array.from([0x50, 0x5e, 0x62, 0x4c]);
    const result = decodeJwwStringWithMetadata(bytes, "shift_jis");

    expect(result).toMatchObject({
      rawText: "P^bL",
      resolvedText: "P^bL",
      text: "PL",
      specialRuns: [
        {
          kind: "overlay",
          marker: "^b",
          baseText: "P",
          overlayText: "L",
        },
      ],
    });
    expect(result.textSegments).toEqual([
      {
        kind: "overlay",
        marker: "^b",
        text: "PL",
        baseText: "P",
        overlayText: "L",
        start: 0,
        end: 2,
        overlapsPrevious: false,
      },
    ]);
  });

  it("builds normal and decorated JWW text segments", () => {
    expect(
      buildJwwTextSegments("A PL Z", [
        {
          kind: "overlay",
          marker: "^b",
          baseText: "P",
          overlayText: "L",
          start: 2,
          end: 4,
        },
      ])
    ).toEqual([
      { kind: "text", text: "A ", start: 0, end: 2 },
      {
        kind: "overlay",
        marker: "^b",
        text: "PL",
        baseText: "P",
        overlayText: "L",
        start: 2,
        end: 4,
        overlapsPrevious: false,
      },
      { kind: "text", text: " Z", start: 4, end: 6 },
    ]);
  });

  it("resolves JWW print-time embedded file and memo tokens to text", () => {
    const context = {
      sourcePath: "C:\\work\\plans\\A-01 sample.jww",
      memo: "memo line 1\nmemo line 2",
    };

    expect(normalizeJwwSpecialText("%f / &f / &F1 / %m2", context)).toBe(
      "A-01 sample.jww / A-01 sample / plans / memo line 2"
    );
  });

  it("resolves JWW print-time embedded date and scale tokens to text", () => {
    const context = {
      lastModified: new Date("2026-05-11T08:09:10"),
      scaleLabel: "1/100",
      scaleDenominator: 100,
    };

    expect(normalizeJwwSpecialText("=f =H:=M:=S %SS %ss", context)).toBe(
      "2026/05/11 08:09:10 1/100 100"
    );
  });

  it("applies JWW embedded date prefix padding rules", () => {
    const context = {
      now: new Date("2026-05-07T08:09:10"),
      lastModified: new Date("2026-05-07T08:09:10"),
    };

    expect(normalizeJwwSpecialText("$m|&m|%m|=m|_m", context)).toBe(
      "5 | 5|05|05| 5"
    );
  });

  it("resolves JWW embedded era and quoted list tokens", () => {
    const context = {
      now: new Date("2026-05-11T08:09:10"),
      lastModified: new Date("2026-05-11T08:09:10"),
    };

    expect(
      normalizeJwwSpecialText('&GＧＥＥ &ma"JAN""FEB""MAR""APR""MAY" &wa"SUN""MON"', context)
    ).toBe("令和 8年 MAY MON");
  });

  it("resolves JWW embedded file-name variants", () => {
    const context = {
      sourcePath: "C:\\work\\plans\\A-01 sample.jww",
    };

    expect(normalizeJwwSpecialText("%f / %f4 / $f / $F", context)).toBe(
      "A-01 sample.jww / A-01 / A-01 sample / C:\\work\\plans\\A-01 sample.jww"
    );
  });
});
