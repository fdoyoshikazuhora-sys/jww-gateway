#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertJwwBytes } from "./jww-gateway.mjs";
import { buildJwwSemanticDiff } from "../src/jww/semanticDiff.js";
import {
  buildJwwWriteResult,
  extractJwwTemplatePrefix,
} from "../src/jww/writer.js";

const base = { penColor: 2, penStyle: 1, penWidth: 0, layerGroup: 0, layer: 0 };
const line = (start, end) => ({ type: "LINE", entity: { start, end, jww: base } });

function dimensionEntity() {
  const dimensionLine = {
    jww: base,
    start: { x: 0, y: 0 },
    end: { x: 20, y: 0 },
  };
  const point = { jww: base, position: { x: 0, y: 0 }, isTemporary: false };
  return {
    type: "DIMENSION",
    entity: {
      jww: base,
      jwwDimension: {
        base,
        line: dimensionLine,
        text: {
          jww: base,
          position: { x: 8, y: 3 },
          endPoint: { x: 12, y: 3 },
          text: "20",
          textType: 1,
          sizeX: 4,
          sizeY: 3,
          spacing: 0.5,
          fontName: "MS Gothic",
        },
        native: {
          sxfMode: 0,
          extensionLines: [dimensionLine, dimensionLine],
          points: [point, point, point, point],
        },
      },
    },
  };
}

function casesFor(version) {
  const cases = [
    {
      name: "line",
      entities: [line({ x: 0, y: 0 }, { x: 10, y: 5 })],
      meta: {},
    },
    {
      name: "arc-circle-ellipse",
      entities: [
        { type: "ARC", entity: { center: { x: 0, y: 0 }, radius: 10, jwwStartAngle: 0.25, jwwArcAngle: 1.5, jww: base } },
        { type: "CIRCLE", entity: { center: { x: 30, y: 0 }, radius: 5, jww: base } },
        { type: "ELLIPSE", entity: { center: { x: 50, y: 0 }, majorRadius: 8, jwwFlatness: 0.5, jwwTiltAngle: 0.4, jwwArcAngle: Math.PI * 2, jww: base } },
        { type: "ELLIPSE", entity: { center: { x: 75, y: 0 }, majorRadius: 8, jwwFlatness: 0.5, jwwTiltAngle: 0.4, jwwStartAngle: 0.25, jwwArcAngle: 1.5, jww: base } },
      ],
      meta: {},
    },
    {
      name: "text-point",
      entities: [
        { type: "TEXT", entity: { position: { x: 0, y: 0 }, endPoint: { x: 8, y: 0 }, text: "Gateway", paperTextWidth: 8, paperTextHeight: 3, paperTextSpacing: 0.5, fontFamily: "MS Gothic", jww: base } },
        { type: "POINT", entity: { position: { x: 10, y: 10 }, jwwPointCode: 3, jwwPointAngle: 0.5, jwwPointScale: 2, jww: { ...base, penStyle: 100 } } },
      ],
      meta: {},
    },
    {
      name: "solid",
      entities: [{ type: "SOLID", entity: { jwwSourceVertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], jwwSolidColor: 0x336699, jww: { ...base, penColor: 10 } } }],
      meta: {},
    },
    { name: "dimension", entities: [dimensionEntity()], meta: {} },
    {
      name: "block",
      entities: [{ type: "INSERT", entity: { jww: base, jwwBlock: { reference: { x: 25, y: 30 }, scaleX: 1.5, scaleY: 0.75, rotation: 0.25, definitionNumber: 1 } } }],
      meta: {
        jwwBlockDefinitions: [{ number: 1, referred: true, createdAt: 0, name: "GatewayBlock", rawName: "GatewayBlock@@SfigorgFlag@@4", jww: base, entities: [line({ x: 0, y: 0 }, { x: 10, y: 0 })] }],
      },
    },
    {
      name: "image-reference",
      entities: [
        {
          type: "IMAGE",
          entity: {
            position: { x: 0, y: 0 },
            endPoint: { x: 65, y: 0 },
            fileName: "fixture.bmp",
            width: 114.163642,
            height: 129.166667,
            paperTextWidth: 2,
            paperTextHeight: 2,
            jwwImageText:
              "^@BMfixture.bmp,114.163642,129.166667, 0, 0, 1, 0",
            jww: base,
          },
        },
      ],
      meta: {},
    },
  ];
  if (version >= 700) {
    cases.push({
      name: "image-embedded",
      entities: [{ type: "IMAGE", entity: { position: { x: 0, y: 0 }, fileName: "fixture.bmp", width: 20, height: 10, jww: base } }],
      meta: { jwwEmbeddedImages: [{ fileName: "fixture.bmp", bytes: Uint8Array.from([0x42, 0x4d, 1, 2, 3, 4]) }] },
    });
  }
  return cases;
}

async function main() {
  const outputArg = process.argv.includes("--output")
    ? process.argv[process.argv.indexOf("--output") + 1]
    : ".work/roundtrip-corpus";
  const outputDir = path.resolve(outputArg);
  await mkdir(outputDir, { recursive: true });
  const rows = [];

  for (const version of [600, 700]) {
    for (const fixture of casesFor(version)) {
      const first = buildJwwWriteResult({
        version,
        entities: fixture.entities,
        meta: fixture.meta,
      });
      const stem = `v${version}-${fixture.name}`;
      const firstPath = path.join(outputDir, `${stem}.jww`);
      await writeFile(firstPath, first.bytes);
      const converted = convertJwwBytes(first.bytes, { sourcePath: firstPath });
      const template = extractJwwTemplatePrefix(first.bytes);
      const second = buildJwwWriteResult({
        version,
        entities: converted.entities,
        meta: converted.meta,
        templatePrefix: template.prefixBytes,
      });
      const secondPath = path.join(outputDir, `${stem}.roundtrip.jww`);
      await writeFile(secondPath, second.bytes);
      const convertedAgain = convertJwwBytes(second.bytes, { sourcePath: secondPath });
      const diff = buildJwwSemanticDiff(converted, convertedAgain);
      await writeFile(
        path.join(outputDir, `${stem}.semantic.json`),
        `${JSON.stringify(diff, null, 2)}\n`,
        "utf8"
      );
      rows.push({
        version,
        family: fixture.name,
        firstBytes: first.bytes.length,
        secondBytes: second.bytes.length,
        entityCount: converted.entities.length,
        blockDefinitionCount: converted.meta.jwwBlockDefinitions?.length || 0,
        embeddedImageCount: converted.meta.jwwEmbeddedImages?.length || 0,
        drawingRoundTripCompatible: diff.drawingRoundTripCompatible,
        documentRoundTripCompatible: diff.roundTripCompatible,
        parserClean: diff.parserClean,
      });
    }
  }

  const report = {
    format: "jww-gateway-roundtrip-corpus",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    outputDir,
    rows,
    summary: {
      fixtures: rows.length,
      passed: rows.filter((row) => row.documentRoundTripCompatible).length,
      failed: rows.filter((row) => !row.documentRoundTripCompatible).length,
    },
  };
  await writeFile(
    path.join(outputDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.summary.failed) process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((error) => { console.error(error); process.exitCode = 1; });
