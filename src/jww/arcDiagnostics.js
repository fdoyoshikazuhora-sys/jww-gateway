const EPSILON = 1e-9;
const FLATNESS_EPSILON = 1e-3;

function toDegrees(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round((number * 180 * 100) / Math.PI) / 100;
}

function formatPoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return "-";
  }
  return `${Math.round(point.x * 1000) / 1000}, ${Math.round(point.y * 1000) / 1000}`;
}

function arcRow(item, index) {
  const entity = item.entity || {};
  const center = entity.center || {};
  const radius = Number(entity.radius || 0);
  const startAngle = Number(entity.startAngle || 0);
  const endAngle = Number(entity.endAngle || 0);
  const flatness = Number(entity.jwwFlatness ?? 1);
  const tilt = Number(entity.jwwTiltAngle || 0);
  const isEllipseLike = Math.abs(flatness - 1) > FLATNESS_EPSILON;
  const isTilted = Math.abs(tilt) > EPSILON;
  const geometry = entity.jwwArcGeometry || null;
  const startPoint = entity.jwwStartPoint || geometry?.startPoint || null;
  const endPoint = entity.jwwEndPoint || geometry?.endPoint || null;

  return {
    id: item.id || `arc-${index}`,
    type: item.type || entity.type || "ARC",
    layer: item.layer || entity.layer || "-",
    center: formatPoint(center),
    radius: Math.round(radius * 1000) / 1000,
    jwwStartDeg: toDegrees(entity.jwwStartAngle),
    jwwArcDeg: toDegrees(entity.jwwArcAngle),
    jwwTiltDeg: toDegrees(entity.jwwTiltAngle),
    jwwFlatness: Math.round(flatness * 1000) / 1000,
    appStartDeg: toDegrees(startAngle),
    appEndDeg: toDegrees(endAngle),
    startPoint: formatPoint(startPoint),
    endPoint: formatPoint(endPoint),
    geometryKind: geometry?.kind || (isEllipseLike ? "ellipse-arc" : "circle-arc"),
    bounds: geometry?.bounds || null,
    note: isEllipseLike
      ? "ellipse-like"
      : isTilted
        ? "tilted circle arc"
        : "circle arc",
  };
}

export function buildJwwArcDiagnostics(entities = []) {
  const arcEntities = entities.filter((item) => {
    const type = item.type || item.entity?.type;
    return type === "ARC" || type === "CIRCLE";
  });
  const arcs = arcEntities.filter((item) => (item.type || item.entity?.type) === "ARC");
  const circles = arcEntities.length - arcs.length;
  const tilted = arcs.filter(
    (item) => Math.abs(Number(item.entity?.jwwTiltAngle || 0)) > EPSILON
  ).length;
  const ellipseLike = arcs.filter(
    (item) =>
      Math.abs(Number(item.entity?.jwwFlatness ?? 1) - 1) > FLATNESS_EPSILON
  ).length;
  const rows = arcs
    .map((item, index) => arcRow(item, index))
    .sort((a, b) => Number(b.radius || 0) - Number(a.radius || 0))
    .slice(0, 24);

  return {
    total: arcEntities.length,
    arcs: arcs.length,
    circles,
    tilted,
    ellipseLike,
    rows,
    summary: `${arcs.length} arcs, ${circles} circles, ${tilted} tilted, ${ellipseLike} ellipse-like`,
  };
}
