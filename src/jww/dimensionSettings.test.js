import {
  decodeJwwDimensionSettings,
  encodeJwwDimensionSettings,
} from "./dimensionSettings.js";

describe("JWW packed dimension settings", () => {
  const source = {
    sunpou1: 2001422,
    sunpou2: 3,
    sunpou3: 50150025,
    sunpou4: 11000000,
    sunpou5: 4100,
  };

  it("decodes the official decimal-digit fields and reproduces them exactly", () => {
    const decoded = decodeJwwDimensionSettings(source);

    expect(decoded).toMatchObject({
      lineColor: 2,
      extensionLineColor: 2,
      pointColor: 4,
      decimalPlaces: 1,
      unit: 0,
      endpointStyle: 0,
      textType: 2,
      valueOffset: 0.3,
      extensionProjection: 0,
      arrowLength: 2.5,
      arrowAngle: 15,
      reverseArrowProjection: 5,
      radiusMarkPosition: 1,
      radiusComma: 1,
      angleUnit: 1,
      angleDecimalPlaces: 4,
    });
    expect(encodeJwwDimensionSettings(source, {})).toEqual(source);
  });

  it("encodes negative offsets and every documented packed group", () => {
    const encoded = encodeJwwDimensionSettings(source, {
      dimensionLineColor: 3,
      dimensionDecimalPlaces: 2,
      dimensionUnit: 1,
      dimensionEndpointStyle: 2,
      dimensionTextType: 10,
      dimensionValueOffset: -2.5,
      dimensionExtensionProjection: -1.5,
      dimensionArrowLength: 3.5,
      dimensionArrowAngle: 20,
      dimensionReverseArrowProjection: 6,
      dimensionBoldText: 1,
      dimensionCreateEntity: 1,
      dimensionDecimalHandling: 2,
    });
    const decoded = decodeJwwDimensionSettings(encoded);

    expect(decoded).toMatchObject({
      lineColor: 3,
      decimalPlaces: 2,
      unit: 1,
      endpointStyle: 2,
      textType: 10,
      valueOffset: -2.5,
      extensionProjection: -1.5,
      arrowLength: 3.5,
      arrowAngle: 20,
      reverseArrowProjection: 6,
      boldText: 1,
      createEntity: 1,
      decimalHandling: 2,
    });
  });

  it("rejects invalid edits and undocumented packed digits", () => {
    let invalidAngle = "";
    let undocumentedDigits = "";
    try {
      encodeJwwDimensionSettings(source, { dimensionArrowAngle: 80.1 });
    } catch (error) {
      invalidAngle = error.message;
    }
    try {
      encodeJwwDimensionSettings(
        { ...source, sunpou4: source.sunpou4 + 300000000 },
        { dimensionLineColor: 3 }
      );
    } catch (error) {
      undocumentedDigits = error.message;
    }
    expect(invalidAngle).toContain("0.1 increments");
    expect(undocumentedDigits).toContain("outside the documented range");
  });
});
