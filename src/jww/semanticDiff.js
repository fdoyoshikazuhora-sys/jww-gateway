function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function quantize(value, tolerance) {
  const number = finiteNumber(value);
  if (!(tolerance > 0)) return number;
  return Number((Math.round(number / tolerance) * tolerance).toPrecision(15));
}

function point(value, tolerance) {
  if (!value || typeof value !== "object") return null;
  return {
    x: quantize(value.x, tolerance),
    y: quantize(value.y, tolerance),
  };
}

function jwwAttrs(item = {}) {
  const source = item.entity?.jww || item.jww || {};
  return {
    group: finiteNumber(source.group),
    layerGroup: finiteNumber(source.layerGroup ?? source.layer_group),
    layer: finiteNumber(source.layer),
    penColor: finiteNumber(source.penColor ?? source.pen_color),
    penStyle: finiteNumber(source.penStyle ?? source.pen_style),
    penWidth: finiteNumber(source.penWidth ?? source.pen_width),
    flag: finiteNumber(source.flag),
  };
}

function entityType(item = {}) {
  return String(item.type || item.entity?.type || "UNKNOWN").toUpperCase();
}

export function canonicalJwwEntity(item, options = {}) {
  const tolerance = Number(options.tolerance || 1e-9);
  const entity = item?.entity || item || {};
  const type = entityType(item);
  const base = {
    type,
    layer: String(item?.layer || entity.layer || ""),
    jww: jwwAttrs(item),
  };

  if (type === "LINE") {
    return {
      ...base,
      start: point(entity.start || entity.startPoint, tolerance),
      end: point(entity.end || entity.endPoint, tolerance),
    };
  }
  if (type === "ARC" || type === "CIRCLE" || type === "ELLIPSE") {
    return {
      ...base,
      center: point(entity.center, tolerance),
      radius: quantize(entity.radius, tolerance),
      startAngle: quantize(
        entity.jwwStartAngle ?? entity.startAngle,
        tolerance
      ),
      arcAngle: quantize(
        entity.jwwArcAngle ??
          (finiteNumber(entity.endAngle) - finiteNumber(entity.startAngle)),
        tolerance
      ),
      tiltAngle: quantize(entity.jwwTiltAngle, tolerance),
      flatness: quantize(entity.jwwFlatness ?? entity.axisRatio ?? 1, tolerance),
    };
  }
  if (type === "TEXT") {
    return {
      ...base,
      text: String(entity.rawText || entity.text || entity.content || ""),
      position: point(entity.position || entity.startPoint, tolerance),
      endPoint: point(entity.endPoint || entity.end, tolerance),
      width: quantize(
        entity.paperTextWidth ?? entity.width ?? entity.textWidth,
        tolerance
      ),
      height: quantize(
        entity.paperTextHeight ?? entity.textHeight ?? entity.height,
        tolerance
      ),
      spacing: quantize(
        entity.paperTextSpacing ?? entity.spacing,
        tolerance
      ),
      rotation: quantize(entity.rotation, tolerance),
      textType: finiteNumber(entity.jwwTextType ?? entity.textType),
      fontFamily: String(entity.fontFamily || ""),
    };
  }
  if (type === "POINT") {
    return {
      ...base,
      position: point(entity.position || entity.point, tolerance),
      temporary: Boolean(entity.isTemporaryPoint || entity.temporaryPoint),
      code: finiteNumber(entity.jwwPointCode ?? entity.code),
      angle: quantize(entity.jwwPointAngle ?? entity.angle, tolerance),
      scale: quantize(entity.jwwPointScale ?? entity.scale ?? 1, tolerance),
    };
  }
  if (type === "SOLID") {
    return {
      ...base,
      vertices: (entity.vertices || []).map((item) => point(item, tolerance)),
      color: finiteNumber(entity.jwwSolidColor),
    };
  }
  if (type === "IMAGE") {
    return {
      ...base,
      fileName: String(entity.fileName || ""),
      width: quantize(entity.width, tolerance),
      height: quantize(entity.height, tolerance),
      position: point(entity.position || entity.startPoint, tolerance),
      endPoint: point(entity.endPoint || entity.end, tolerance),
      textWidth: quantize(entity.paperTextWidth, tolerance),
      textHeight: quantize(entity.paperTextHeight, tolerance),
      spacing: quantize(entity.paperTextSpacing ?? entity.spacing, tolerance),
      rotation: quantize(entity.rotation, tolerance),
      textType: finiteNumber(entity.jwwTextType ?? entity.textType),
      fontFamily: String(entity.fontFamily || ""),
      imageText: String(entity.jwwImageText || entity.rawText || entity.text || ""),
    };
  }
  if (type === "INSERT") {
    const block = entity.jwwBlock || {};
    return {
      ...base,
      blockName: String(entity.blockName || ""),
      position: point(entity.position, tolerance),
      scaleX: quantize(entity.xScale ?? block.scaleX ?? 1, tolerance),
      scaleY: quantize(entity.yScale ?? block.scaleY ?? 1, tolerance),
      rotation: quantize(entity.rotation ?? block.rotation, tolerance),
      definitionNumber: finiteNumber(block.definitionNumber),
    };
  }
  if (type === "DIMENSION") {
    return {
      ...base,
      text: String(entity.rawText || entity.text || ""),
      position: point(entity.position || entity.startPoint, tolerance),
      endPoint: point(entity.endPoint, tolerance),
      dimension: semanticMetadataValue(entity.jwwDimension || null),
    };
  }
  return { ...base, value: entity };
}

function countTypes(rows) {
  const counts = {};
  for (const row of rows) counts[row.type] = (counts[row.type] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function fingerprint(row) {
  return JSON.stringify(row);
}

function semanticMetadataValue(value) {
  if (Array.isArray(value)) return value.map(semanticMetadataValue);
  if (!value || typeof value !== "object") return value;
  const ignoredKeys = new Set([
    "offset",
    "byteLength",
    "score",
    "firstOffset",
    "lastOffset",
  ]);
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !ignoredKeys.has(key) &&
          !key.endsWith("Offset") &&
          !key.endsWith("Candidates")
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, semanticMetadataValue(item)])
  );
}

function multiset(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = fingerprint(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function sameMultiset(before, after) {
  const left = multiset(before);
  const right = multiset(after);
  if (left.size !== right.size) return false;
  for (const [key, count] of left) {
    if (right.get(key) !== count) return false;
  }
  return true;
}

function orderedChanges(before, after, limit) {
  const rows = [];
  const length = Math.max(before.length, after.length);
  for (let index = 0; index < length && rows.length < limit; index += 1) {
    const left = before[index] || null;
    const right = after[index] || null;
    if (fingerprint(left) === fingerprint(right)) continue;
    rows.push({ index, before: left, after: right });
  }
  return rows;
}

function canonicalBounds(bounds, tolerance) {
  if (!bounds) return null;
  return {
    minX: quantize(bounds.minX, tolerance),
    maxX: quantize(bounds.maxX, tolerance),
    minY: quantize(bounds.minY, tolerance),
    maxY: quantize(bounds.maxY, tolerance),
  };
}

function documentMetadata(document = {}, tolerance) {
  const meta = document.meta || {};
  return {
    paperCode: meta.paperCode ?? null,
    paperSize: meta.paperSize ?? null,
    bounds: canonicalBounds(document.bounds, tolerance),
    groupScaleState: document.groupScaleState || null,
    layerGroups: document.layerGroups || [],
    colorSettings: semanticMetadataValue(meta.colorSettings || null),
    lineTypeSettings: semanticMetadataValue(meta.lineTypeSettings || null),
    blockDefinitions: semanticMetadataValue(meta.jwwBlockDefinitions || []),
    embeddedImages: semanticMetadataValue(meta.jwwEmbeddedImages || []),
  };
}

function internalSettings(document = {}) {
  return (document.meta?.jwwInternalSettings?.records || [])
    .map((row) => ({
      key: String(row.key || ""),
      settingValue: finiteNumber(row.settingValue),
      text: String(row.rawText || row.text || ""),
    }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.text.localeCompare(b.text));
}

function hasCleanParse(document = {}) {
  const diagnostics = document.meta?.diagnostics || {};
  return (
    finiteNumber(diagnostics.unsupportedCount) === 0 &&
    finiteNumber(diagnostics.skippedCount) === 0
  );
}

export function buildJwwSemanticDiff(beforeDocument, afterDocument, options = {}) {
  const tolerance = Number(options.tolerance || 1e-9);
  const changeLimit = Math.max(1, Number(options.changeLimit || 24));
  const before = (beforeDocument?.entities || []).map((item) =>
    canonicalJwwEntity(item, { tolerance })
  );
  const after = (afterDocument?.entities || []).map((item) =>
    canonicalJwwEntity(item, { tolerance })
  );
  const beforeFingerprints = before.map(fingerprint);
  const afterFingerprints = after.map(fingerprint);
  const orderedEqual =
    beforeFingerprints.length === afterFingerprints.length &&
    beforeFingerprints.every((value, index) => value === afterFingerprints[index]);
  const unorderedEqual = sameMultiset(before, after);
  const beforeMetadata = documentMetadata(beforeDocument, tolerance);
  const afterMetadata = documentMetadata(afterDocument, tolerance);
  const beforeSettings = internalSettings(beforeDocument);
  const afterSettings = internalSettings(afterDocument);
  const metadataEqual = fingerprint(beforeMetadata) === fingerprint(afterMetadata);
  const internalSettingsEqual =
    fingerprint(beforeSettings) === fingerprint(afterSettings);
  const cleanParse = hasCleanParse(beforeDocument) && hasCleanParse(afterDocument);

  return {
    format: "jww-gateway-semantic-diff",
    formatVersion: 1,
    tolerance,
    drawingSemanticEqual: orderedEqual,
    drawingRoundTripCompatible: orderedEqual && cleanParse,
    roundTripCompatible: orderedEqual && metadataEqual && cleanParse,
    documentMetadataEqual: metadataEqual,
    internalSettingsEqual,
    parserClean: cleanParse,
    drawing: {
      orderedEqual,
      unorderedEqual,
      orderOnlyDifference: !orderedEqual && unorderedEqual,
      beforeCount: before.length,
      afterCount: after.length,
      beforeTypeCounts: countTypes(before),
      afterTypeCounts: countTypes(after),
      changes: orderedChanges(before, after, changeLimit),
    },
    metadata: {
      before: beforeMetadata,
      after: afterMetadata,
    },
    internalSettings: {
      before: beforeSettings,
      after: afterSettings,
    },
  };
}
