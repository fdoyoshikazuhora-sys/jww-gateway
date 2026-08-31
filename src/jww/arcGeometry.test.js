import { buildJwwArcGeometry, jwwEllipsePoint } from "./arcGeometry.js";
import { buildJwwBytes } from "./writer.js";
import { convertJwwBytes } from "../../tools/jww-gateway.mjs";

function roundedPoint(point) {
  return {
    x: Math.round(point.x * 1e9) / 1e9,
    y: Math.round(point.y * 1e9) / 1e9,
  };
}

function roundedBounds(bounds) {
  return Object.fromEntries(
    Object.entries(bounds).map(([key, value]) => [
      key,
      Math.round(value * 1e9) / 1e9,
    ])
  );
}

describe("JWW arc geometry", () => {
  it("keeps the existing tilted-circle endpoint construction", () => {
    const geometry = buildJwwArcGeometry({
      center_x: 0,
      center_y: 0,
      radius: 10,
      start_angle: 0.25,
      arc_angle: 1.5,
      tilt_angle: 0.5,
      flatness: 1,
    });

    expect(geometry.kind).toBe("circle-arc");
    expect(roundedPoint(geometry.startPoint)).toEqual({
      x: 7.316888689,
      y: 6.8163876,
    });
    expect(roundedPoint(geometry.endPoint)).toEqual({
      x: -6.281736227,
      y: 7.780731969,
    });
  });

  it("applies flatness before tilt for partial ellipse parameter angles", () => {
    const geometry = buildJwwArcGeometry({
      center_x: 50,
      center_y: 0,
      radius: 8,
      start_angle: 0.25,
      arc_angle: 1.5,
      tilt_angle: 0.4,
      flatness: 0.5,
    });

    expect(geometry.kind).toBe("ellipse-arc");
    expect(geometry.majorRadius).toBe(8);
    expect(geometry.minorRadius).toBe(4);
    expect(roundedPoint(geometry.startPoint)).toEqual({
      x: 56.754044947,
      y: 3.929994699,
    });
    expect(roundedPoint(geometry.endPoint)).toEqual({
      x: 47.153867381,
      y: 3.069946029,
    });
    expect(roundedBounds(geometry.bounds)).toEqual({
      minX: 47.153867381,
      maxX: 56.754044947,
      minY: 3.069946029,
      maxY: 4.824835642,
    });
  });

  it("uses both rotated ellipse extrema for a full ellipse", () => {
    const geometry = buildJwwArcGeometry({
      center: { x: 5, y: -3 },
      radius: 8,
      jwwFlatness: 0.5,
      jwwTiltAngle: 0.4,
      jwwArcAngle: Math.PI * 2,
      isFullCircle: true,
    });

    expect(geometry.kind).toBe("ellipse");
    expect(roundedBounds(geometry.bounds)).toEqual({
      minX: -2.531331956,
      maxX: 12.531331956,
      minY: -7.824835642,
      maxY: 1.824835642,
    });
  });

  it("supports signed sweeps without replacing native parameters", () => {
    const geometry = buildJwwArcGeometry({
      center: { x: 0, y: 0 },
      radius: 4,
      jwwFlatness: 0.5,
      jwwTiltAngle: 0,
      jwwStartAngle: Math.PI / 2,
      jwwArcAngle: -Math.PI / 2,
    });

    expect(geometry.parameterStart).toBe(Math.PI / 2);
    expect(geometry.parameterSweep).toBe(-Math.PI / 2);
    expect(roundedPoint(geometry.startPoint)).toEqual({ x: 0, y: 2 });
    expect(roundedPoint(geometry.endPoint)).toEqual({ x: 4, y: 0 });
    expect(
      roundedPoint(
        jwwEllipsePoint({
          center: { x: 0, y: 0 },
          radius: 4,
          flatness: 0.5,
          parameter: Math.PI / 2,
        })
      )
    ).toEqual({ x: 0, y: 2 });
  });

  it("exports explicit ellipse-arc geometry and exact document bounds", () => {
    const bytes = buildJwwBytes({
      version: 700,
      entities: [
        {
          type: "ELLIPSE",
          entity: {
            center: { x: 50, y: 0 },
            majorRadius: 8,
            jwwFlatness: 0.5,
            jwwTiltAngle: 0.4,
            jwwStartAngle: 0.25,
            jwwArcAngle: 1.5,
          },
        },
      ],
    });
    const converted = convertJwwBytes(bytes);
    const entity = converted.entities[0].entity;

    expect(entity.jwwStartAngle).toBe(0.25);
    expect(entity.jwwArcAngle).toBe(1.5);
    expect(entity.jwwTiltAngle).toBe(0.4);
    expect(entity.jwwFlatness).toBe(0.5);
    expect(entity.jwwArcGeometry.kind).toBe("ellipse-arc");
    expect(roundedPoint(entity.jwwStartPoint)).toEqual({
      x: 56.754044947,
      y: 3.929994699,
    });
    expect(roundedPoint(entity.jwwEndPoint)).toEqual({
      x: 47.153867381,
      y: 3.069946029,
    });
    expect(roundedBounds(converted.bounds)).toEqual({
      minX: 47.153867381,
      maxX: 56.754044947,
      minY: 3.069946029,
      maxY: 4.824835642,
    });
    expect(converted.meta.arcDiagnostics.ellipseLike).toBe(1);
    expect(converted.meta.arcDiagnostics.rows[0].geometryKind).toBe("ellipse-arc");
  });
});
