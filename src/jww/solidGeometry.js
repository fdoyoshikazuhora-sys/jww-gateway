export function jwwCircularSolid(value) {
  const style = Number(value.base?.pen_style);
  if (!(style >= 101)) return null;
  return {
    penStyle: style,
    center: { x: value.point1_x, y: value.point1_y },
    radius: value.point4_x,
    flatness: value.point4_y,
    tiltAngle: value.point2_x,
    startAngle: value.point2_y,
    arcAngle: value.point3_x,
    parameter: value.point3_y,
  };
}

export function circularSolidPayload(value) {
  if (![101, 105, 106, 111].includes(value?.penStyle)) throw new Error(`Unverified circular solid pen style: ${value?.penStyle}`);
  const numbers = [value.center?.x, value.center?.y, value.radius, value.flatness, value.tiltAngle, value.startAngle, value.arcAngle, value.parameter];
  if (!numbers.every((n) => typeof n === "number" && Number.isFinite(n))) throw new Error("Circular solid parameters must be finite numbers");
  if (value.radius < 0 || value.flatness <= 0) throw new Error("Invalid circular solid radius/flatness");
  if (value.penStyle === 101 && ![-1, 0, 5, 100].includes(value.parameter)) throw new Error("Unverified circular solid shape parameter");
  if (value.penStyle === 101 && value.parameter === -1 && Math.abs(value.arcAngle) > Math.PI / 2 + 1e-12) throw new Error("Outside-arc solid sweep must not exceed pi/2");
  if (value.penStyle === 111 && ![0, 100].includes(value.parameter)) throw new Error("Unverified circumference solid shape parameter");
  if ([105, 106].includes(value.penStyle) && (value.parameter < 0 || value.parameter > value.radius)) throw new Error("Invalid annular solid inner radius");
  return [0, 2, 4, 6].map((index) => ({ x: numbers[index], y: numbers[index + 1] }));
}
