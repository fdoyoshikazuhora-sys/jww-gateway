const TAU = Math.PI * 2;
const ANGLE_EPSILON = 1e-10;
const FLATNESS_EPSILON = 1e-9;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function firstFinite(values, fallback = 0) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return fallback;
}

function normalizePositiveAngle(value) {
  const normalized = value % TAU;
  return normalized < 0 ? normalized + TAU : normalized;
}

function parameterIsWithinSweep(parameter, start, sweep, full) {
  if (full) return true;
  if (sweep >= 0) {
    return normalizePositiveAngle(parameter - start) <= sweep + ANGLE_EPSILON;
  }
  return normalizePositiveAngle(start - parameter) <= -sweep + ANGLE_EPSILON;
}

export function jwwEllipsePoint({
  center = { x: 0, y: 0 },
  radius = 0,
  flatness = 1,
  tiltAngle = 0,
  parameter = 0,
} = {}) {
  const resolvedRadius = Math.abs(finiteNumber(radius, 0));
  const resolvedFlatness = finiteNumber(flatness, 1);
  const resolvedTilt = finiteNumber(tiltAngle, 0);
  const resolvedParameter = finiteNumber(parameter, 0);
  const localX = resolvedRadius * Math.cos(resolvedParameter);
  const localY = resolvedRadius * resolvedFlatness * Math.sin(resolvedParameter);
  const cosTilt = Math.cos(resolvedTilt);
  const sinTilt = Math.sin(resolvedTilt);
  return {
    x:
      finiteNumber(center.x, 0) +
      localX * cosTilt -
      localY * sinTilt,
    y:
      finiteNumber(center.y, 0) +
      localX * sinTilt +
      localY * cosTilt,
  };
}

function arcBounds(geometry) {
  const {
    center,
    radius,
    flatness,
    tiltAngle,
    parameterStart,
    parameterSweep,
    parameterEnd,
    isFullCircle,
  } = geometry;
  const minorRadius = radius * flatness;
  const candidates = [parameterStart, parameterEnd];
  const xCritical = Math.atan2(
    -minorRadius * Math.sin(tiltAngle),
    radius * Math.cos(tiltAngle)
  );
  const yCritical = Math.atan2(
    minorRadius * Math.cos(tiltAngle),
    radius * Math.sin(tiltAngle)
  );
  for (const parameter of [
    xCritical,
    xCritical + Math.PI,
    yCritical,
    yCritical + Math.PI,
  ]) {
    if (
      parameterIsWithinSweep(
        parameter,
        parameterStart,
        parameterSweep,
        isFullCircle
      )
    ) {
      candidates.push(parameter);
    }
  }
  const points = candidates.map((parameter) =>
    jwwEllipsePoint({ center, radius, flatness, tiltAngle, parameter })
  );
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

export function buildJwwArcGeometry(value = {}) {
  const center = {
    x: firstFinite([value.center_x, value.center?.x], 0),
    y: firstFinite([value.center_y, value.center?.y], 0),
  };
  const radius = Math.abs(firstFinite([value.radius, value.majorRadius], 0));
  const flatness = firstFinite(
    [value.flatness, value.jwwFlatness, value.axisRatio],
    1
  );
  const tiltAngle = firstFinite(
    [value.tilt_angle, value.jwwTiltAngle, value.rotation],
    0
  );
  const parameterStart = firstFinite(
    [value.start_angle, value.jwwStartAngle, value.parameterStart],
    0
  );
  const parameterSweep = firstFinite(
    [value.arc_angle, value.jwwArcAngle, value.parameterSweep],
    0
  );
  const parameterEnd = parameterStart + parameterSweep;
  const isFullCircle =
    Boolean(value.is_full_circle ?? value.isFullCircle) ||
    Math.abs(parameterSweep) >= TAU - ANGLE_EPSILON;
  const isEllipseLike = Math.abs(Math.abs(flatness) - 1) > FLATNESS_EPSILON;
  const geometry = {
    kind: isEllipseLike
      ? isFullCircle
        ? "ellipse"
        : "ellipse-arc"
      : isFullCircle
        ? "circle"
        : "circle-arc",
    center,
    radius,
    majorRadius: radius,
    minorRadius: Math.abs(radius * flatness),
    flatness,
    tiltAngle,
    parameterStart,
    parameterSweep,
    parameterEnd,
    isFullCircle,
    isEllipseLike,
    startPoint: jwwEllipsePoint({
      center,
      radius,
      flatness,
      tiltAngle,
      parameter: parameterStart,
    }),
    endPoint: jwwEllipsePoint({
      center,
      radius,
      flatness,
      tiltAngle,
      parameter: parameterEnd,
    }),
  };
  return { ...geometry, bounds: arcBounds(geometry) };
}
