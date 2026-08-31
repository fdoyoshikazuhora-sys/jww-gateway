#!/usr/bin/env node
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "../src/jww/parser.js";
import { buildJwwArcDiagnostics } from "../src/jww/arcDiagnostics.js";
import { buildJwwArcGeometry } from "../src/jww/arcGeometry.js";
import { buildJwwEnvironment } from "../src/jww/environment.js";
import { partitionJwwInternalSettings } from "../src/jww/internalSettings.js";
import {
  JWW_LINE_TYPE_NAMES,
  getJwwScreenColorHex,
  getJwwScreenLineWidth,
  getJwwGroupScaleLabels,
  getJwwLayerName,
  getJwwPaperSizeName,
  inferJwwPaperSizeNameFromEntities,
  resolveJwwColorEntry,
  unwrapJwwEntity,
} from "../src/jww/shared.js";

function point(x, y) {
  return { x: Number(x), y: Number(y) };
}

function normalizeSolidVertexOrder(points = []) {
  const valid = points.filter(
    (item) => Number.isFinite(item?.x) && Number.isFinite(item?.y)
  );
  if (valid.length < 4) return valid;
  const center = valid.reduce(
    (acc, item) => ({
      x: acc.x + item.x / valid.length,
      y: acc.y + item.y / valid.length,
    }),
    { x: 0, y: 0 }
  );
  return valid
    .map((item, index) => ({
      item,
      index,
      angle: Math.atan2(item.y - center.y, item.x - center.x),
    }))
    .sort((a, b) => a.angle - b.angle || a.index - b.index)
    .map((entry) => entry.item);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function jwwArcAnglesForDxf(value = {}) {
  const geometry = buildJwwArcGeometry(value);
  const { center, startPoint: jwwStartPoint, endPoint: jwwEndPoint } = geometry;
  const startAngle = Math.atan2(
    jwwEndPoint.y - center.y,
    jwwEndPoint.x - center.x
  );
  const endAngle = Math.atan2(
    jwwStartPoint.y - center.y,
    jwwStartPoint.x - center.x
  );

  return {
    startAngle,
    endAngle,
    jwwStartPoint,
    jwwEndPoint,
    geometry,
  };
}

function baseAttrs(base = {}) {
  return {
    group: Number(base.group) || 0,
    layerGroup: Number(base.layer_group) || 0,
    layer: Number(base.layer) || 0,
    penColor: Number(base.pen_color) || 0,
    penStyle: Number(base.pen_style) || 0,
    penWidth: Number(base.pen_width) || 0,
    flag: Number(base.flag) || 0,
  };
}

function nativeLine(value = {}) {
  return {
    jww: baseAttrs(value.base || {}),
    start: point(value.start_x, value.start_y),
    end: point(value.end_x, value.end_y),
  };
}

function nativePoint(value = {}) {
  return {
    jww: baseAttrs(value.base || {}),
    position: point(value.x, value.y),
    isTemporary: Boolean(value.is_temporary),
    code: numberOrZero(value.code),
    angle: numberOrZero(value.angle),
    scale: numberOrZero(value.scale || 1),
  };
}

function nativeText(value = {}) {
  return {
    jww: baseAttrs(value.base || {}),
    position: point(value.start_x, value.start_y),
    endPoint: point(value.end_x, value.end_y),
    textType: numberOrZero(value.text_type),
    sizeX: numberOrZero(value.size_x),
    sizeY: numberOrZero(value.size_y),
    spacing: numberOrZero(value.spacing),
    angle: numberOrZero(value.angle),
    fontName: value.font_name || "MS Gothic",
    text: value.raw_content || value.content || "",
  };
}

function jwwImageReference(text) {
  const match = /^\^@BM(.+?),\s*([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)(.*)$/i.exec(
    String(text || "")
  );
  if (!match) return null;
  return {
    fileName: match[1],
    width: numberOrZero(match[2]),
    height: numberOrZero(match[3]),
    suffix: match[4] || "",
  };
}

function blockDisplayName(name) {
  return String(name || "").replace(/@@SfigorgFlag@@\d+$/, "");
}

function makeEntity(doc, value, id, type, entity) {
  const base = value.base || {};
  const layer = getJwwLayerName(doc, base);
  const colorNumber = Number(base.pen_color) || 7;
  const colorSettings = doc.color_settings || {};
  const screenColors = colorSettings.screenColors || null;
  const jwwColor = resolveJwwColorEntry(value, colorSettings);
  const stroke = getJwwScreenColorHex(
    colorNumber,
    jwwColor ? { ...screenColors, [colorNumber]: jwwColor } : screenColors,
    "#111111",
    colorSettings.backgroundColor
  );
  const fileLineWidth = getJwwScreenLineWidth(colorNumber, screenColors);
  return {
    id: `jww-${id}`,
    type,
    layer,
    source: "jww",
    colorNumber,
    stroke,
    renderStroke: stroke,
    renderLineWidth: Math.max(
      1,
      Math.min(16, Number(base.pen_width) || fileLineWidth || 1)
    ),
    lineType: JWW_LINE_TYPE_NAMES[Number(base.pen_style)] || "CONTINUOUS",
    entity: {
      ...entity,
      type,
      layer,
      jwwColor,
      jww: baseAttrs(base),
    },
  };
}

function convertEntity(doc, source, index) {
  const value = unwrapJwwEntity(source);
  if (!value || typeof value !== "object") return [];

  const converted = [];
  if (value.jww_dimension) {
    const rawDimension = value.jww_dimension;
    const native = rawDimension.native || {};
    return [
      makeEntity(doc, value, index, "DIMENSION", {
        text: value.content || "",
        rawText: value.raw_content || value.content || "",
        position: point(value.start_x, value.start_y),
        startPoint: point(value.start_x, value.start_y),
        endPoint: point(value.end_x, value.end_y),
        paperTextWidth: Math.abs(numberOrZero(value.size_x)),
        paperTextHeight: Math.abs(numberOrZero(value.size_y)),
        paperTextSpacing: numberOrZero(value.spacing),
        jwwTextType: numberOrZero(value.text_type),
        rotation: numberOrZero(value.angle),
        fontFamily: value.font_name || "MS Gothic",
        jwwDimension: {
          base: baseAttrs(rawDimension.base || {}),
          line: nativeLine(rawDimension.line || value.dimension_line || {}),
          text: nativeText(rawDimension.text || value),
          native: native
            ? {
                sxfMode: numberOrZero(native.sxf_mode),
                extensionLines: [
                  nativeLine(native.extension_line_1 || {}),
                  nativeLine(native.extension_line_2 || {}),
                ],
                points: [
                  nativePoint(native.dimension_point_1 || {}),
                  nativePoint(native.dimension_point_2 || {}),
                  nativePoint(native.extension_point_1 || {}),
                  nativePoint(native.extension_point_2 || {}),
                ],
              }
            : null,
        },
      }),
    ];
  }

  if ("content" in value) {
    const hasRawText = value.raw_content && value.raw_content !== value.content;
    const hasResolvedText =
      value.resolved_content &&
      value.resolved_content !== value.content &&
      value.resolved_content !== value.raw_content;
    const textMetadata = {
      ...(hasRawText ? { rawText: value.raw_content } : {}),
      ...(hasResolvedText ? { resolvedText: value.resolved_content } : {}),
      ...(value.jww_special_runs?.length
        ? { jwwSpecialRuns: value.jww_special_runs }
        : {}),
      ...(value.jww_text_segments?.length
        ? { jwwTextSegments: value.jww_text_segments }
        : {}),
    };
    const imageReference = jwwImageReference(value.raw_content || value.content);
    converted.push(
      makeEntity(doc, value, index, imageReference ? "IMAGE" : "TEXT", {
        text: value.content || "",
        position: point(value.start_x, value.start_y),
        startPoint: point(value.start_x, value.start_y),
        endPoint: point(value.end_x, value.end_y),
        height: Math.max(0.5, Math.abs(numberOrZero(value.size_y || value.size_x || 2))),
        textHeight: Math.max(0.5, Math.abs(numberOrZero(value.size_y || value.size_x || 2))),
        paperTextWidth: Math.abs(numberOrZero(value.size_x)),
        paperTextHeight: Math.abs(numberOrZero(value.size_y)),
        paperTextSpacing: numberOrZero(value.spacing),
        jwwTextType: numberOrZero(value.text_type),
        rotation: Number(value.angle) || 0,
        fontFamily: value.font_name || "MS Gothic",
        ...(imageReference
          ? {
              fileName: imageReference.fileName,
              width: Math.abs(imageReference.width),
              height: Math.abs(imageReference.height),
              jwwImageText: value.raw_content || value.content,
              imageReferenceSuffix: imageReference.suffix,
            }
          : {}),
        ...textMetadata,
      })
    );
    return converted;
  }

  if ("center_x" in value) {
    const isCircle = !!value.is_full_circle;
    const arcAngles = jwwArcAnglesForDxf(value);
    converted.push(
      makeEntity(doc, value, index, isCircle ? "CIRCLE" : "ARC", {
        center: point(value.center_x, value.center_y),
        radius: Math.abs(numberOrZero(value.radius)),
        startAngle: arcAngles.startAngle,
        endAngle: arcAngles.endAngle,
        jwwStartPoint: arcAngles.jwwStartPoint,
        jwwEndPoint: arcAngles.jwwEndPoint,
        jwwArcGeometry: arcAngles.geometry,
        jwwStartAngle: Number(value.start_angle) || 0,
        jwwArcAngle: Number(value.arc_angle) || 0,
        jwwTiltAngle: Number(value.tilt_angle) || 0,
        jwwFlatness: Number.isFinite(Number(value.flatness))
          ? Number(value.flatness)
          : 1,
      })
    );
    return converted;
  }

  if ("start_x" in value && "end_x" in value) {
    converted.push(
      makeEntity(doc, value, index, "LINE", {
        start: point(value.start_x, value.start_y),
        end: point(value.end_x, value.end_y),
      })
    );
    return converted;
  }

  if ("point1_x" in value) {
    converted.push(
      makeEntity(doc, value, index, "SOLID", {
        jwwSourceVertices: [
          point(value.point1_x, value.point1_y),
          point(value.point4_x, value.point4_y),
          point(value.point2_x, value.point2_y),
          point(value.point3_x, value.point3_y),
        ],
        vertices: normalizeSolidVertexOrder([
          point(value.point1_x, value.point1_y),
          point(value.point2_x, value.point2_y),
          point(value.point3_x, value.point3_y),
          point(value.point4_x, value.point4_y),
        ]),
        jwwSolidColor: numberOrZero(value.color),
      })
    );
    return converted;
  }

  if ("ref_x" in value && "def_number" in value) {
    const definition = (doc.block_defs || []).find(
      (item) => Number(item.number) === Number(value.def_number)
    );
    converted.push(
      makeEntity(doc, value, index, "INSERT", {
        position: point(value.ref_x, value.ref_y),
        blockName: blockDisplayName(definition?.name || `Block${value.def_number}`),
        xScale: numberOrZero(value.scale_x || 1),
        yScale: numberOrZero(value.scale_y || 1),
        rotation: numberOrZero(value.rotation),
        jwwBlock: {
          reference: point(value.ref_x, value.ref_y),
          scaleX: numberOrZero(value.scale_x || 1),
          scaleY: numberOrZero(value.scale_y || 1),
          rotation: numberOrZero(value.rotation),
          definitionNumber: numberOrZero(value.def_number),
        },
      })
    );
    return converted;
  }

  if ("x" in value && "y" in value) {
    converted.push(
      makeEntity(doc, value, index, "POINT", {
        position: point(value.x, value.y),
        isTemporaryPoint: Boolean(value.is_temporary),
        jwwPointCode: numberOrZero(value.code),
        jwwPointAngle: numberOrZero(value.angle),
        jwwPointScale: numberOrZero(value.scale || 1),
      })
    );
  }

  return converted;
}

function boundsFor(entities) {
  const points = [];
  for (const item of entities) {
    const entity = item.entity || {};
    const pointKeys = entity.jwwArcGeometry
      ? ["start", "end", "position", "startPoint", "endPoint"]
      : ["start", "end", "center", "position", "startPoint", "endPoint"];
    for (const key of pointKeys) {
      const p = entity[key];
      if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) points.push(p);
    }
    for (const p of entity.vertices || []) {
      if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) points.push(p);
    }
    if (entity.jwwArcGeometry?.bounds) {
      const bounds = entity.jwwArcGeometry.bounds;
      points.push({ x: bounds.minX, y: bounds.minY });
      points.push({ x: bounds.maxX, y: bounds.maxY });
    } else if (entity.center && Number(entity.radius) > 0) {
      points.push({
        x: entity.center.x - entity.radius,
        y: entity.center.y - entity.radius,
      });
      points.push({
        x: entity.center.x + entity.radius,
        y: entity.center.y + entity.radius,
      });
    }
  }
  if (!points.length) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function convertJwwBytes(bytes, options = {}) {
  const encoding = options.encoding || "shift_jis";
  const doc = parse(bytes, {
    encoding,
    textContext: {
      sourcePath: options.sourcePath || "",
      sourceName: options.sourceName || "",
      lastModified: options.lastModified,
    },
  });
  const rawEntities = Array.isArray(doc.entities) ? doc.entities : [];
  const {
    drawingEntities,
    drawingEntityIndexes,
    settings: internalSettings,
  } = partitionJwwInternalSettings(rawEntities);
  const entities = drawingEntities.flatMap((entity, index) =>
    convertEntity(doc, entity, drawingEntityIndexes[index])
  );
  const jwwBlockDefinitions = (doc.block_defs || []).map((definition, index) => ({
    number: numberOrZero(definition.number),
    referred: Boolean(definition.referred),
    createdAt: numberOrZero(definition.created_at),
    name: blockDisplayName(definition.name || `Block${index}`),
    rawName: definition.name || `Block${index}`,
    jww: baseAttrs(definition.base || {}),
    entities: (definition.entities || []).flatMap((entity, entityIndex) =>
      convertEntity(doc, entity, `block-${index}-${entityIndex}`)
    ),
  }));
  const jwwEmbeddedImages = (doc.embedded_images || []).map((image) => ({
    fileName: image.file_name || "",
    declaredSize: numberOrZero(image.declared_size),
    dataBase64: Buffer.from(image.bytes || []).toString("base64"),
    truncated: Boolean(image.truncated),
  }));
  const jwwInternalSettings = {
    sentinel: {
      start: point(0, -1000),
      end: point(0, -1000),
    },
    records: internalSettings.map((setting) => {
      const value = setting.value;
      return {
        id: `jww-internal-setting-${setting.sourceIndex}`,
        sourceIndex: setting.sourceIndex,
        key: setting.key,
        settingValue: setting.settingValue,
        text: setting.text,
        rawText: value.raw_content || setting.text,
        resolvedText: value.resolved_content || setting.text,
        startPoint: point(value.start_x, value.start_y),
        endPoint: point(value.end_x, value.end_y),
        textType: Number(value.text_type) || 0,
        sizeX: numberOrZero(value.size_x),
        sizeY: numberOrZero(value.size_y),
        spacing: numberOrZero(value.spacing),
        angle: numberOrZero(value.angle),
        fontFamily: value.font_name || "MS Gothic",
        layer: getJwwLayerName(doc, value.base || {}),
        jww: baseAttrs(value.base || {}),
      };
    }),
  };
  const groupScaleState = getJwwGroupScaleLabels(doc);
  const arcDiagnostics = buildJwwArcDiagnostics(entities);
  const unresolvedColorNumbers = Array.from(
    new Set(
      entities
        .filter(
          (item) =>
            item.entity?.jww &&
            !item.entity?.jwwColor &&
            !doc.color_settings?.screenColors?.[item.entity.jww.penColor]
        )
        .map((item) => item.entity.jww.penColor)
    )
  ).sort((a, b) => Number(a) - Number(b));
  const paperSize =
    inferJwwPaperSizeNameFromEntities(rawEntities) ||
    getJwwPaperSizeName(doc.paper_size) ||
    null;
  const jwwEnvironment = buildJwwEnvironment(doc);

  return {
    format: "jww-gateway-json",
    formatVersion: 1,
    sourceFormat: "JWW",
    encoding,
    meta: {
      jwwVersion: doc.version,
      paperCode: doc.paper_size,
      paperSize,
      colorSettings: doc.color_settings || { screenColors: {} },
      lineTypeSettings: doc.line_type_settings || null,
      jwwBlockDefinitions,
      jwwEmbeddedImages,
      jwwInternalSettings,
      layerNamesExtracted: doc.layer_names_extracted !== false,
      layerNameFallbacks: doc.layer_name_fallbacks || [],
      environmentRegion: doc.environment_region || null,
      jwwEnvironment,
      colorDiagnostics: {
        unresolvedColorNumbers,
      },
      memo: doc.memo || "",
      diagnostics: doc.diagnostics || {},
      arcDiagnostics,
    },
    layerGroups: doc.layer_groups || [],
    groupScaleState,
    bounds: boundsFor(entities),
    entities,
  };
}

function parseArgs(argv) {
  const args = {
    input: "",
    output: "",
    encoding: "shift_jis",
    summary: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") args.output = argv[++i] || "";
    else if (arg === "--encoding") args.encoding = argv[++i] || "shift_jis";
    else if (arg === "--summary") args.summary = true;
    else if (!args.input) args.input = arg;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error(
      "Usage: node tools/jww-gateway.mjs <input.jww> [-o output.json] [--encoding shift_jis] [--summary]"
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
    lastModified: inputStats.mtime,
  });
  const output = args.summary
    ? {
        source: inputPath,
        format: converted.format,
        entityCount: converted.entities.length,
        paperSize: converted.meta.paperSize,
        jwwVersion: converted.meta.jwwVersion,
        diagnostics: converted.meta.diagnostics,
        arcDiagnostics: converted.meta.arcDiagnostics,
        jwwEnvironment: converted.meta.jwwEnvironment,
        bounds: converted.bounds,
      }
    : converted;
  const json = `${JSON.stringify(output, null, 2)}\n`;

  if (args.output) {
    await writeFile(path.resolve(args.output), json, "utf8");
  } else {
    process.stdout.write(json);
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
