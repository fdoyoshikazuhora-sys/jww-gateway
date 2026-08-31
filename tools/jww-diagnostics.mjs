#!/usr/bin/env node
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertJwwBytes } from "./jww-gateway.mjs";

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(number(value) * scale) / scale;
}

function formatRgb(entry) {
  if (!entry) return "-";
  return `${entry.hex || "-"} (${number(entry.red)}, ${number(entry.green)}, ${number(entry.blue)})`;
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .trim();
}

function boundsForEntity(item) {
  const entity = item.entity || {};
  const points = [];
  for (const key of ["start", "end", "center", "position", "startPoint"]) {
    const point = entity[key];
    if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
      points.push(point);
    }
  }
  for (const point of entity.vertices || []) {
    if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
      points.push(point);
    }
  }
  if (entity.center && number(entity.radius) > 0) {
    points.push({
      x: entity.center.x - entity.radius,
      y: entity.center.y - entity.radius,
    });
    points.push({
      x: entity.center.x + entity.radius,
      y: entity.center.y + entity.radius,
    });
  }
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function centerOfBounds(bounds) {
  if (!bounds) return null;
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

function formatBounds(bounds) {
  if (!bounds) return "-";
  return `X ${round(bounds.minX)}..${round(bounds.maxX)} / Y ${round(bounds.minY)}..${round(bounds.maxY)}`;
}

function paperLongEdgeMm(paperSize) {
  const sizes = {
    A0: 1189,
    A1: 841,
    A2: 594,
    A3: 420,
    A4: 297,
  };
  return sizes[String(paperSize || "").toUpperCase()] || 0;
}

function sheetSpanDiagnostics(bounds, paperSize) {
  const longEdge = paperLongEdgeMm(paperSize);
  if (!bounds || !longEdge) {
    return {
      possibleSheetCount: 1,
      summary: "Paper span estimate unavailable",
    };
  }
  const spanX = Math.max(0, bounds.maxX - bounds.minX);
  const spanY = Math.max(0, bounds.maxY - bounds.minY);
  const largestSpan = Math.max(spanX, spanY);
  const possibleSheetCount = Math.max(1, Math.round(largestSpan / longEdge));
  return {
    paperLongEdge: longEdge,
    spanX: round(spanX),
    spanY: round(spanY),
    possibleSheetCount,
    summary:
      possibleSheetCount >= 2
        ? `About ${possibleSheetCount} paper spans in drawing bounds`
        : "Drawing bounds fit about one paper span",
  };
}

function median(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, ratio) {
  const sorted = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * ratio))
  );
  return sorted[index];
}

function boundsFromPoints(points) {
  const xs = points
    .map((point) => point.x)
    .filter((value) => Number.isFinite(value));
  const ys = points
    .map((point) => point.y)
    .filter((value) => Number.isFinite(value));
  if (!xs.length || !ys.length) return null;
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function countBy(items, getKey) {
  const counts = {};
  for (const item of items) {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function colorDiagnostics(converted) {
  const meta = converted.meta || {};
  const colorSettings = meta.colorSettings || {};
  const screenColors = colorSettings.screenColors || {};
  const entities = converted.entities || [];
  const penCounts = countBy(
    entities.filter((item) => item.entity?.jww),
    (item) => String(item.entity.jww.penColor || 0)
  );
  const directColorCounts = countBy(
    entities.filter((item) => item.entity?.jwwColor?.source === "direct"),
    (item) => item.entity.jwwColor.hex || "-"
  );

  return {
    backgroundColor: colorSettings.backgroundColor || null,
    screenColors,
    printColors: colorSettings.printColors || {},
    colorTableCandidates: colorSettings.colorTableCandidates || [],
    unresolvedColorNumbers: meta.colorDiagnostics?.unresolvedColorNumbers || [],
    penCounts,
    directColorCounts,
  };
}

function textDiagnostics(converted) {
  const internalSettingRecords =
    converted.meta?.jwwInternalSettings?.records || [];
  const textEntities = (converted.entities || []).filter(
    (item) => item.type === "TEXT" || item.entity?.type === "TEXT"
  );
  const specialRuns = [];
  const textSegments = [];
  const unresolvedSamples = [];
  const settingTextSamples = internalSettingRecords.slice(0, 12).map((row) => ({
    id: row.id || "jww-internal-setting",
    layer: cleanText(row.layer || "-"),
    text: String(row.text || `${row.key || "Setting"} = ${row.settingValue ?? ""}`),
    key: row.key || "",
    settingValue: row.settingValue,
    kind: "internal-setting",
  }));
  for (const item of textEntities) {
    const entity = item.entity || {};
    const text = String(entity.text || "");
    for (const run of entity.jwwSpecialRuns || []) {
      specialRuns.push({
        id: item.id,
        layer: cleanText(item.layer || entity.layer || "-"),
        text,
        code: run.code || run.token || "-",
        marker: run.marker || "",
        kind: run.kind || run.type || "-",
      });
    }
    for (const segment of entity.jwwTextSegments || []) {
      if (segment.kind === "text") continue;
      textSegments.push({
        id: item.id,
        layer: cleanText(item.layer || entity.layer || "-"),
        kind: segment.kind || "-",
        marker: segment.marker || "",
        text: segment.text || "",
        start: segment.start,
        end: segment.end,
      });
    }
    if (text.includes("\uFFFD") && unresolvedSamples.length < 12) {
      unresolvedSamples.push({
        id: item.id,
        layer: cleanText(item.layer || entity.layer || "-"),
        text,
      });
    }
    if (
      /^(Type\s+Distance|Layer\s+Center|Bounds\s+Note)/.test(text) &&
      settingTextSamples.length < 12
    ) {
      settingTextSamples.push({
        id: item.id,
        layer: cleanText(item.layer || entity.layer || "-"),
        text,
        kind: "possible-hidden-note",
      });
    }
  }
  return {
    textCount: textEntities.length,
    specialRunCount: specialRuns.length,
    specialRunSamples: specialRuns.slice(0, 24),
    segmentCount: textSegments.length,
    segmentSamples: textSegments.slice(0, 24),
    unresolvedTextSamples: unresolvedSamples,
    settingTextSamples,
  };
}

function outlierDiagnostics(converted, options = {}) {
  const sampleLimit = Math.max(
    1,
    Math.min(500, Math.trunc(number(options.outlierLimit, 16)))
  );
  const distanceMin = Math.max(0, number(options.outlierDistanceMin, 0));
  const rows = (converted.entities || [])
    .map((item) => {
      const bounds = boundsForEntity(item);
      const center = centerOfBounds(bounds);
      if (!center) return null;
      return {
        id: item.id,
        type: item.type || item.entity?.type || "-",
        layer: cleanText(item.layer || item.entity?.layer || "-"),
        bounds,
        center,
      };
    })
    .filter(Boolean);
  if (!rows.length) return { samples: [] };

  const medianCenter = {
    x: median(rows.map((row) => row.center.x)),
    y: median(rows.map((row) => row.center.y)),
  };
  const samples = rows
    .map((row) => ({
      ...row,
      distance: Math.hypot(
        row.center.x - medianCenter.x,
        row.center.y - medianCenter.y
      ),
    }))
    .filter((row) => row.distance >= distanceMin)
    .sort((a, b) => b.distance - a.distance)
    .slice(0, sampleLimit)
    .map((row) => ({
      id: row.id,
      type: row.type,
      layer: row.layer,
      distance: round(row.distance),
      bounds: formatBounds(row.bounds),
    }));

  return {
    medianCenter,
    distanceMin: round(distanceMin),
    sampleLimit,
    samples,
  };
}

function drawingClusterDiagnostics(converted) {
  const rows = (converted.entities || [])
    .map((item) => {
      const bounds = boundsForEntity(item);
      const center = centerOfBounds(bounds);
      if (!center) return null;
      return {
        id: item.id,
        type: item.type || item.entity?.type || "-",
        layer: cleanText(item.layer || item.entity?.layer || "-"),
        bounds,
        center,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.center.x - b.center.x);
  if (rows.length < 64) {
    return {
      count: 0,
      summary: "Not enough entities for drawing cluster detection",
      rows: [],
    };
  }

  const xValues = rows.map((row) => row.center.x);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const spanX = Math.max(0, maxX - minX);
  const gaps = [];
  for (let index = 1; index < rows.length; index += 1) {
    const gap = rows[index].center.x - rows[index - 1].center.x;
    if (Number.isFinite(gap) && gap > 0) {
      gaps.push({ index, gap });
    }
  }
  const gapValues = gaps.map((row) => row.gap);
  const gapThreshold = Math.max(
    80,
    spanX * 0.08,
    percentile(gapValues, 0.95) * 1.5
  );
  const splitIndexes = gaps
    .filter((row) => row.gap >= gapThreshold)
    .map((row) => row.index);
  const ranges = [0, ...splitIndexes, rows.length];
  const minClusterSize = Math.max(48, rows.length * 0.04);
  const clusters = [];
  for (let index = 0; index < ranges.length - 1; index += 1) {
    const items = rows.slice(ranges[index], ranges[index + 1]);
    if (items.length < minClusterSize) continue;
    const points = [];
    for (const item of items) {
      points.push(
        { x: item.bounds.minX, y: item.bounds.minY },
        { x: item.bounds.maxX, y: item.bounds.maxY }
      );
    }
    clusters.push({
      index: clusters.length + 1,
      entityCount: items.length,
      bounds: boundsFromPoints(points),
      sampleLayers: Array.from(new Set(items.map((item) => item.layer)))
        .filter(Boolean)
        .slice(0, 8),
    });
  }

  return {
    count: clusters.length,
    threshold: round(gapThreshold),
    summary:
      clusters.length >= 2
        ? `${clusters.length} drawing clusters detected`
        : "Single drawing cluster detected",
    rows: clusters.map((cluster) => ({
      ...cluster,
      boundsText: formatBounds(cluster.bounds),
    })),
  };
}

export function buildJwwDiagnostics(converted, source = "", options = {}) {
  const entities = converted.entities || [];
  const meta = converted.meta || {};
  const color = colorDiagnostics(converted);
  const text = textDiagnostics(converted);
  const outliers = outlierDiagnostics(converted, options);
  const drawingClusters = drawingClusterDiagnostics(converted);
  const sheetSpan = sheetSpanDiagnostics(converted.bounds, meta.paperSize);
  const entityCounts = countBy(
    entities,
    (item) => item.type || item.entity?.type || "-"
  );
  const groupScales = (converted.layerGroups || []).map((group, index) => ({
    group: index,
    scale: number(group.scale, 1),
    label: number(group.scale, 0) > 0 ? `1/${round(group.scale, 0)}` : "-",
    name: cleanText(group.name || ""),
  }));

  return {
    source,
    encoding: converted.encoding,
    jwwVersion: meta.jwwVersion,
    paper: {
      code: meta.paperCode,
      size: meta.paperSize || "-",
    },
    bounds: converted.bounds,
    entityCount: entities.length,
    entityCounts,
    groupScales,
    colors: color,
    layerNames: {
      extracted: meta.layerNamesExtracted !== false,
      fallbacks: meta.layerNameFallbacks || [],
    },
    environment: meta.jwwEnvironment || null,
    environmentRegion: meta.environmentRegion || null,
    parserDiagnostics: meta.diagnostics || {},
    arcs: meta.arcDiagnostics || {},
    text,
    drawingClusters,
    sheetSpan,
    outliers,
  };
}

function linesForDiagnostics(report) {
  const lines = [];
  lines.push("JWW Diagnostics");
  lines.push(`Source: ${report.source || "-"}`);
  lines.push(`Encoding: ${report.encoding || "-"}`);
  lines.push(
    `Version: ${report.jwwVersion ?? "-"} / Paper: ${report.paper.size} (${report.paper.code ?? "-"})`
  );
  lines.push(`Entities: ${report.entityCount}`);
  lines.push(`Bounds: ${formatBounds(report.bounds)}`);
  lines.push("");

  lines.push("Entity Counts");
  for (const [type, count] of Object.entries(report.entityCounts).sort()) {
    lines.push(`  ${type}: ${count}`);
  }
  lines.push("");

  lines.push("Paper / Scale");
  for (const group of report.groupScales) {
    if (group.scale !== 1 || group.name) {
      lines.push(
        `  Group ${group.group}: ${group.label} (${group.scale}) ${group.name}`.trimEnd()
      );
    }
  }
  lines.push("");

  lines.push("Colors");
  lines.push(`  Background: ${formatRgb(report.colors.backgroundColor)}`);
  Object.entries(report.colors.screenColors)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([colorNumber, entry]) => {
      lines.push(
        `  Line color ${colorNumber}: ${formatRgb(entry)} / width ${entry.width ?? "-"}`
      );
    });
  Object.entries(report.colors.printColors || {})
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .forEach(([colorNumber, entry]) => {
      lines.push(
        `  Print color ${colorNumber}: ${formatRgb(entry)} / width ${entry.width ?? "-"}${
          entry.pointRadius !== undefined ? ` / point ${entry.pointRadius}` : ""
        }`
      );
    });
  if (report.colors.colorTableCandidates?.length) {
    lines.push(
      `  Color table candidates: ${report.colors.colorTableCandidates
        .map((row) => `${row.role}@${row.offset}:${row.score}`)
        .join(", ")}`
    );
  }
  lines.push(
    `  Unresolved color numbers: ${
      report.colors.unresolvedColorNumbers.length
        ? report.colors.unresolvedColorNumbers.join(", ")
        : "none"
    }`
  );
  lines.push(`  Pen color usage: ${JSON.stringify(report.colors.penCounts)}`);
  lines.push(
    `  Direct RGB usage: ${JSON.stringify(report.colors.directColorCounts)}`
  );
  lines.push("");

  if (
    report.layerNames?.fallbacks?.length ||
    report.layerNames?.extracted === false
  ) {
    lines.push("Layer Names");
    lines.push(
      `  Extracted: ${report.layerNames.extracted ? "yes" : "no"} / fallbacks: ${
        report.layerNames.fallbacks?.length || 0
      }`
    );
    for (const row of (report.layerNames.fallbacks || []).slice(0, 12)) {
      lines.push(
        `  ${row.kind} ${row.group}${row.layer !== undefined ? `-${row.layer}` : ""}: "${cleanText(row.original)}" -> "${row.fallback}"`
      );
    }
    lines.push("");
  }

  lines.push("Parser Diagnostics");
  lines.push(
    `  Unsupported: ${report.parserDiagnostics.unsupportedCount || 0} ${JSON.stringify(
      report.parserDiagnostics.unsupportedClasses || {}
    )}`
  );
  lines.push(`  Skipped: ${report.parserDiagnostics.skippedCount || 0}`);
  lines.push("");

  if (report.environment?.coverage) {
    lines.push("JWF-like Environment Coverage");
    lines.push(
      `  Supported keys: ${report.environment.coverage.supportedKeys.length} / ${report.environment.coverage.totalJwfKeysTracked}`
    );
    lines.push(
      `  Missing samples: ${report.environment.coverage.missingJwfKeys
        .slice(0, 24)
        .join(", ")}`
    );
    lines.push("");
  }
  if (report.environment?.lineTypes?.offset !== undefined) {
    const lineTypes = report.environment.lineTypes;
    lines.push("JWF-like Line Types");
    lines.push(
      `  Offset: ${lineTypes.offset} / bytes: ${lineTypes.byteLength ?? "-"} / score: ${lineTypes.score ?? "-"}`
    );
    for (const [key, row] of Object.entries(lineTypes)
      .filter(([key]) => /^LTYPE_/.test(key))
      .slice(0, 12)) {
      lines.push(`  ${key}: ${row.values?.join(" ") || "-"}`);
    }
    if (lineTypes.postLineTypeTailCandidate) {
      lines.push(
        `  Post-line-type diagnostic tail @${lineTypes.postLineTypeTailCandidate.offset}: u32 ${lineTypes.postLineTypeTailCandidate.u32?.join(" ")}`
      );
    }
    lines.push("");
  }
  if (report.environmentRegion) {
    const region = report.environmentRegion;
    lines.push("JWF-like Raw Region");
    lines.push(
      `  After layer names: ${region.afterLayerNamesOffset ?? "-"} / entity list: ${region.entityListOffset ?? "-"} / bytes: ${region.byteLength ?? "-"}`
    );
    if (region.u32PairRuns?.length) {
      lines.push(
        `  U32 pair runs: ${region.u32PairRuns
          .slice(0, 8)
          .map(
            (row) =>
              `${row.first}/${row.second} x${row.count} @${row.firstOffset}`
          )
          .join(", ")}`
      );
    }
    if (region.doubleSamples?.length) {
      lines.push(
        `  Double samples: ${region.doubleSamples
          .slice(0, 8)
          .map((row) => `${round(row.value)} @${row.offset}`)
          .join(", ")}`
      );
    }
    lines.push("");
  }

  lines.push("Arc / Ellipse");
  lines.push(`  ${report.arcs.summary || "-"}`);
  for (const row of report.arcs.rows || []) {
    lines.push(
      `  ${row.id} ${row.note}: center ${row.center}, R ${row.radius}, J ${row.jwwStartDeg} + ${row.jwwArcDeg}, tilt ${row.jwwTiltDeg}, app ${row.appStartDeg}..${row.appEndDeg}`
    );
  }
  lines.push("");

  lines.push("Text / Special Characters");
  lines.push(
    `  Text: ${report.text.textCount} / special runs: ${report.text.specialRunCount} / decorated segments: ${report.text.segmentCount || 0}`
  );
  for (const row of report.text.specialRunSamples) {
    lines.push(
      `  ${row.id} ${row.layer}: ${row.code} ${row.kind} "${cleanText(row.text)}"`
    );
  }
  for (const row of report.text.segmentSamples || []) {
    lines.push(
      `  segment ${row.id} ${row.layer}: ${row.marker} ${row.kind} ${row.start}..${row.end} "${cleanText(row.text)}"`
    );
  }
  if (report.text.unresolvedTextSamples.length) {
    lines.push("  Unresolved text samples:");
    for (const row of report.text.unresolvedTextSamples) {
      lines.push(`    ${row.id} ${row.layer}: "${cleanText(row.text)}"`);
    }
  }
  if (report.text.settingTextSamples.length) {
    lines.push("  JWW internal settings / possible hidden notes:");
    for (const row of report.text.settingTextSamples) {
      lines.push(`    ${row.id} ${row.layer}: "${cleanText(row.text)}"`);
    }
  }
  lines.push("");

  lines.push("Drawing Clusters");
  lines.push(
    `  ${report.drawingClusters.summary || "-"} / threshold ${report.drawingClusters.threshold ?? "-"}`
  );
  lines.push(
    `  Sheet span: ${report.sheetSpan.summary || "-"} / X ${report.sheetSpan.spanX ?? "-"} / Y ${report.sheetSpan.spanY ?? "-"} / paper long edge ${report.sheetSpan.paperLongEdge ?? "-"}`
  );
  for (const row of report.drawingClusters.rows || []) {
    lines.push(
      `  Cluster ${row.index}: ${row.entityCount} entities / ${row.boundsText} / layers ${row.sampleLayers.join(", ")}`
    );
  }
  lines.push("");

  lines.push("Outlier Candidates");
  lines.push(
    `  Sample limit: ${report.outliers.sampleLimit ?? "-"} / distance min ${report.outliers.distanceMin ?? 0}`
  );
  lines.push(
    `  Median center: ${round(report.outliers.medianCenter?.x)}, ${round(
      report.outliers.medianCenter?.y
    )}`
  );
  for (const row of report.outliers.samples) {
    lines.push(
      `  ${row.id} ${row.type} ${row.layer}: distance ${row.distance} / ${row.bounds}`
    );
  }

  return lines;
}

function csvValue(value) {
  const text = Array.isArray(value)
    ? value.join("; ")
    : value === null || value === undefined
      ? ""
      : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  return `${rows.map((row) => row.map(csvValue).join(",")).join("\n")}\n`;
}

function csvForDiagnostics(report) {
  return rowsToCsv([
    [
      "source",
      "encoding",
      "version",
      "paper",
      "entities",
      "bounds",
      "colors",
      "printColors",
      "background",
      "unresolvedColors",
      "unsupported",
      "skipped",
      "arcs",
      "circles",
      "tiltedArcs",
      "ellipseLike",
      "text",
      "specialRuns",
      "decoratedSegments",
      "drawingClusters",
      "sheetSpanEstimate",
      "outlierCandidates",
      "outlierLimit",
      "outlierDistanceMin",
      "layerNameFallbacks",
      "environmentSupportedKeys",
      "environmentMissingKeys",
    ],
    [
      report.source,
      report.encoding,
      report.jwwVersion,
      `${report.paper.size} (${report.paper.code ?? "-"})`,
      report.entityCount,
      formatBounds(report.bounds),
      Object.keys(report.colors.screenColors || {}).length,
      Object.keys(report.colors.printColors || {}).length,
      report.colors.backgroundColor?.hex || "",
      report.colors.unresolvedColorNumbers,
      report.parserDiagnostics.unsupportedCount || 0,
      report.parserDiagnostics.skippedCount || 0,
      report.arcs.arcs || 0,
      report.arcs.circles || 0,
      report.arcs.tilted || 0,
      report.arcs.ellipseLike || 0,
      report.text.textCount || 0,
      report.text.specialRunCount || 0,
      report.text.segmentCount || 0,
      report.drawingClusters?.count || 0,
      report.sheetSpan?.possibleSheetCount || 1,
      report.outliers.samples?.length || 0,
      report.outliers.sampleLimit || 16,
      report.outliers.distanceMin || 0,
      report.layerNames?.fallbacks?.length || 0,
      report.environment?.coverage?.supportedKeys?.length || 0,
      report.environment?.coverage?.missingJwfKeys?.length || 0,
    ],
  ]);
}

function htmlText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlCell(value) {
  const text = Array.isArray(value) ? value.join(", ") : value;
  return `<td>${htmlText(text)}</td>`;
}

function htmlRows(rows) {
  return rows
    .map((row) => `<tr>${row.map((value) => htmlCell(value)).join("")}</tr>`)
    .join("\n");
}

function htmlForDiagnostics(report) {
  const rowsForColors = (kind, colors) =>
    Object.entries(colors || {})
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([colorNumber, entry]) => [
        kind,
        colorNumber,
        entry?.hex || "",
        entry?.red ?? "",
        entry?.green ?? "",
        entry?.blue ?? "",
        entry?.width ?? "",
        entry?.pointRadius ?? "",
      ]);
  const colorRows = [
    ...rowsForColors("Screen", report.colors.screenColors),
    ...rowsForColors("Print", report.colors.printColors),
  ];
  const entityRows = Object.entries(report.entityCounts || {})
    .sort()
    .map(([type, count]) => [type, count]);
  const scaleRows = (report.groupScales || []).map((group) => [
    group.group,
    group.label,
    group.scale,
    group.name,
  ]);
  const arcRows = (report.arcs.rows || []).map((row) => [
    row.id,
    row.radius,
    row.center,
    row.jwwStartDeg,
    row.jwwArcDeg,
    row.jwwTiltDeg,
    row.jwwFlatness,
    row.appStartDeg,
    row.appEndDeg,
    row.note,
  ]);
  const textRows = (report.text.specialRunSamples || []).map((row) => [
    row.id,
    row.layer,
    row.marker || row.code,
    row.kind,
    cleanText(row.text),
  ]);
  const segmentRows = (report.text.segmentSamples || []).map((row) => [
    row.id,
    row.layer,
    row.marker,
    row.kind,
    `${row.start}..${row.end}`,
    cleanText(row.text),
  ]);
  const unresolvedTextRows = (report.text.unresolvedTextSamples || []).map(
    (row) => [row.id, row.layer, cleanText(row.text)]
  );
  const settingTextRows = (report.text.settingTextSamples || []).map((row) => [
    row.id,
    row.layer,
    cleanText(row.text),
  ]);
  const outlierRows = (report.outliers.samples || []).map((row) => [
    row.id,
    row.type,
    row.layer,
    row.distance,
    row.bounds,
  ]);
  const clusterRows = (report.drawingClusters?.rows || []).map((row) => [
    row.index,
    row.entityCount,
    row.boundsText,
    row.sampleLayers,
  ]);
  const layerNameRows = (report.layerNames?.fallbacks || []).map((row) => [
    row.kind,
    row.group,
    row.layer ?? "",
    cleanText(row.original),
    row.fallback,
  ]);
  const environmentCoverage = report.environment?.coverage || {};
  const environmentRows = [
    ["Supported keys", (environmentCoverage.supportedKeys || []).join(", ")],
    ["Missing keys", (environmentCoverage.missingJwfKeys || []).join(", ")],
    ["Partial keys", (environmentCoverage.partialKeys || []).join(", ")],
  ];
  const environmentRegion = report.environmentRegion || {};
  const environmentRegionRows = [
    ["After layer names", environmentRegion.afterLayerNamesOffset ?? ""],
    ["Entity list", environmentRegion.entityListOffset ?? ""],
    ["Byte length", environmentRegion.byteLength ?? ""],
    [
      "U32 pair runs",
      (environmentRegion.u32PairRuns || [])
        .slice(0, 12)
        .map(
          (row) =>
            `${row.first}/${row.second} x${row.count} @${row.firstOffset}`
        )
        .join(", "),
    ],
    [
      "Double samples",
      (environmentRegion.doubleSamples || [])
        .slice(0, 12)
        .map((row) => `${round(row.value)} @${row.offset}`)
        .join(", "),
    ],
  ];
  const lineTypeRows = report.environment?.lineTypes
    ? Object.entries(report.environment.lineTypes)
        .filter(([key]) => /^LTYPE_/.test(key))
        .map(([key, row]) => [
          key,
          row.pattern || "",
          (row.params || []).join(", "),
          row.offset ?? "",
        ])
    : [];
  if (report.environment?.lineTypes?.postLineTypeTailCandidate) {
    const candidate = report.environment.lineTypes.postLineTypeTailCandidate;
    lineTypeRows.push([
      "Post-line-type diagnostic tail",
      "diagnostic",
      `u32: ${(candidate.u32 || []).join(", ")} / u16: ${(candidate.u16 || []).join(", ")}`,
      candidate.offset ?? "",
    ]);
  }

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>JWW Diagnostics</title>
  <style>
    body { font-family: Arial, "Yu Gothic", Meiryo, sans-serif; margin: 24px; color: #0f172a; background: #f8fafc; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 24px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; margin: 6px 0 12px; background: #fff; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; font-size: 12px; }
    th { background: #e2e8f0; }
    dl { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 4px 8px; margin: 8px 0 12px; }
    dt, dd, p { font-size: 12px; }
    dt { font-weight: 700; color: #334155; }
    dd { margin: 0; }
  </style>
</head>
<body>
  <h1>JWW Diagnostics</h1>
  <dl>
    <dt>Source</dt><dd>${htmlText(report.source || "-")}</dd>
    <dt>Encoding</dt><dd>${htmlText(report.encoding || "-")}</dd>
    <dt>Version</dt><dd>${htmlText(report.jwwVersion ?? "-")}</dd>
    <dt>Paper</dt><dd>${htmlText(`${report.paper.size} (${report.paper.code ?? "-"})`)}</dd>
    <dt>Entities</dt><dd>${htmlText(report.entityCount)}</dd>
    <dt>Bounds</dt><dd>${htmlText(formatBounds(report.bounds))}</dd>
  </dl>
  <h2>Entity Counts</h2>
  <table><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>${htmlRows(
    entityRows
  )}</tbody></table>
  <h2>Paper / Scale</h2>
  <table><thead><tr><th>Group</th><th>Label</th><th>Scale</th><th>Name</th></tr></thead><tbody>${htmlRows(
    scaleRows
  )}</tbody></table>
  <h2>Colors</h2>
  <p>Background: ${htmlText(formatRgb(report.colors.backgroundColor))}</p>
  <p>Color table candidates: ${htmlText(
    report.colors.colorTableCandidates?.length
      ? report.colors.colorTableCandidates
          .map((row) => `${row.role}@${row.offset}:${row.score}`)
          .join(", ")
      : "none"
  )}</p>
  <p>Unresolved color numbers: ${htmlText(
    report.colors.unresolvedColorNumbers.length
      ? report.colors.unresolvedColorNumbers.join(", ")
      : "none"
  )}</p>
  <table><thead><tr><th>Table</th><th>No.</th><th>Hex</th><th>R</th><th>G</th><th>B</th><th>Width</th><th>Point</th></tr></thead><tbody>${htmlRows(
    colorRows
  )}</tbody></table>
  <h2>Parser Diagnostics</h2>
  <p>Unsupported: ${htmlText(
    report.parserDiagnostics.unsupportedCount || 0
  )} / Skipped: ${htmlText(report.parserDiagnostics.skippedCount || 0)}</p>
  <h2>Layer Names</h2>
  <p>Extracted: ${htmlText(report.layerNames?.extracted ? "yes" : "no")} / fallbacks: ${htmlText(
    report.layerNames?.fallbacks?.length || 0
  )}</p>
  <table><thead><tr><th>Kind</th><th>Group</th><th>Layer</th><th>Original</th><th>Fallback</th></tr></thead><tbody>${htmlRows(
    layerNameRows
  )}</tbody></table>
  <h2>JWF-like Environment Coverage</h2>
  <table><thead><tr><th>Kind</th><th>Keys</th></tr></thead><tbody>${htmlRows(
    environmentRows
  )}</tbody></table>
  <h2>JWF-like Raw Region</h2>
  <table><thead><tr><th>Kind</th><th>Value</th></tr></thead><tbody>${htmlRows(
    environmentRegionRows
  )}</tbody></table>
  <h2>JWF-like Line Types</h2>
  <table><thead><tr><th>Key</th><th>Pattern</th><th>Params</th><th>Offset</th></tr></thead><tbody>${htmlRows(
    lineTypeRows
  )}</tbody></table>
  <h2>Arc / Ellipse</h2>
  <p>${htmlText(report.arcs.summary || "-")}</p>
  <table><thead><tr><th>ID</th><th>Radius</th><th>Center</th><th>J Start</th><th>J Arc</th><th>J Tilt</th><th>Flat</th><th>A Start</th><th>A End</th><th>Note</th></tr></thead><tbody>${htmlRows(
    arcRows
  )}</tbody></table>
  <h2>Text / Special Characters</h2>
  <p>Text: ${htmlText(report.text.textCount)} / special runs: ${htmlText(
    report.text.specialRunCount
  )} / decorated segments: ${htmlText(report.text.segmentCount || 0)}</p>
  <table><thead><tr><th>ID</th><th>Layer</th><th>Code</th><th>Kind</th><th>Text</th></tr></thead><tbody>${htmlRows(
    textRows
  )}</tbody></table>
  <h2>JWW Text Segments</h2>
  <table><thead><tr><th>ID</th><th>Layer</th><th>Marker</th><th>Kind</th><th>Range</th><th>Text</th></tr></thead><tbody>${htmlRows(
    segmentRows
  )}</tbody></table>
  <h2>Unresolved Text Samples</h2>
  <table><thead><tr><th>ID</th><th>Layer</th><th>Text</th></tr></thead><tbody>${htmlRows(
    unresolvedTextRows
  )}</tbody></table>
  <h2>JWW Setting Text / Hidden Notes</h2>
  <table><thead><tr><th>ID</th><th>Layer</th><th>Text</th></tr></thead><tbody>${htmlRows(
    settingTextRows
  )}</tbody></table>
  <h2>Drawing Clusters</h2>
  <p>${htmlText(report.drawingClusters?.summary || "-")} / threshold ${htmlText(
    report.drawingClusters?.threshold ?? "-"
  )}</p>
  <p>Sheet span: ${htmlText(report.sheetSpan?.summary || "-")} / X ${htmlText(
    report.sheetSpan?.spanX ?? "-"
  )} / Y ${htmlText(report.sheetSpan?.spanY ?? "-")} / paper long edge ${htmlText(
    report.sheetSpan?.paperLongEdge ?? "-"
  )}</p>
  <table><thead><tr><th>No.</th><th>Entities</th><th>Bounds</th><th>Layers</th></tr></thead><tbody>${htmlRows(
    clusterRows
  )}</tbody></table>
  <h2>Outlier Candidates</h2>
  <p>Sample limit: ${htmlText(
    report.outliers.sampleLimit ?? "-"
  )} / distance min: ${htmlText(report.outliers.distanceMin ?? 0)}</p>
  <p>Median center: ${htmlText(
    `${round(report.outliers.medianCenter?.x)}, ${round(report.outliers.medianCenter?.y)}`
  )}</p>
  <table><thead><tr><th>ID</th><th>Type</th><th>Layer</th><th>Distance</th><th>Bounds</th></tr></thead><tbody>${htmlRows(
    outlierRows
  )}</tbody></table>
</body>
</html>
`;
}

function parseArgs(argv) {
  const args = {
    input: "",
    output: "",
    encoding: "shift_jis",
    outlierLimit: 16,
    outlierDistanceMin: 0,
    json: false,
    csv: false,
    html: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") args.output = argv[++i] || "";
    else if (arg === "--encoding") args.encoding = argv[++i] || "shift_jis";
    else if (arg === "--outlier-limit") args.outlierLimit = argv[++i] || 16;
    else if (arg === "--outlier-distance-min")
      args.outlierDistanceMin = argv[++i] || 0;
    else if (arg === "--json") args.json = true;
    else if (arg === "--csv") args.csv = true;
    else if (arg === "--html") args.html = true;
    else if (!args.input) args.input = arg;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error(
      "Usage: node tools/jww-diagnostics.mjs <input.jww> [--encoding shift_jis] [--outlier-limit 16] [--outlier-distance-min 0] [--json|--csv|--html] [-o output.txt]"
    );
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(args.input);
  const inputStats = await stat(inputPath);
  const bytes = new Uint8Array(await readFile(inputPath));
  const converted = convertJwwBytes(bytes, {
    encoding: args.encoding,
    sourcePath: inputPath,
    sourceName: path.basename(inputPath),
    lastModified: inputStats.mtime,
  });
  const report = buildJwwDiagnostics(converted, inputPath, {
    outlierLimit: args.outlierLimit,
    outlierDistanceMin: args.outlierDistanceMin,
  });
  const output = args.csv
    ? csvForDiagnostics(report)
    : args.html
      ? htmlForDiagnostics(report)
      : args.json
        ? `${JSON.stringify(report, null, 2)}\n`
        : `${linesForDiagnostics(report).join("\n")}\n`;

  if (args.output) {
    await writeFile(path.resolve(args.output), output, "utf8");
  } else {
    process.stdout.write(output);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
