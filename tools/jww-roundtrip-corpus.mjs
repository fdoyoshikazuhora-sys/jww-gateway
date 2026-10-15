#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { openNativeJww, saveNativeJww } from "../src/jww/native.js";
import { parseJwwDocumentHeader } from "../src/jww/documentHeader.js";
import { JWW_INTERNAL_SETTING_KEYS } from "../src/jww/internalSettings.js";
import { convertJwwBytes } from "./jww-gateway.mjs";
import { buildJwwSemanticDiff } from "../src/jww/semanticDiff.js";
import {
  buildJwwWriteResult,
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
  const variants = [[101, -1, 1], [101, 0, 2], [101, 5, 2], [101, 100, Math.PI * 2], [105, 4, 2], [105, 4, Math.PI * 2], [106, 4, 2], [106, 4, Math.PI * 2], [111, 0, 2], [111, 100, Math.PI * 2]];
  for (const [index, [penStyle, parameter, arcAngle]] of variants.entries()) {
    cases.push({ name: `circular-solid-${index + 1}`, entities: [{ type: "JWW_CIRCULAR_SOLID", entity: {
      jww: { ...base, penStyle, penColor: 10, flag: 0xffff }, jwwSolidColor: 0x123456,
      jwwCircularSolid: { penStyle, center: { x: 5, y: -7 }, radius: 10, flatness: 0.6, tiltAngle: 0.2, startAngle: -0.3, arcAngle, parameter },
    } }], meta: {} });
  }
  const text = (value, flags = 0) => ({ type: "TEXT", entity: { position: { x: 0, y: 0 }, endPoint: { x: 5, y: 0 }, text: value, paperTextWidth: 2, paperTextHeight: 3, fontFamily: "", jww: { ...base, flag: flags, penWidth: 0xffff } } });
  cases.push({ name: "attribute-bits", entities: Array.from({ length: 16 }, (_, i) => text("R1,234.00", 1 << i)), meta: {} });
  cases.push({ name: "internal-sentinels", entities: JWW_INTERNAL_SETTING_KEYS.flatMap((key, index) => {
    const item = text(`${key} = ${index}`, 0xffff);
    Object.assign(item.entity, { position: { x: 0, y: -1000 }, endPoint: { x: 0, y: -1000 } });
    return [line({ x: index, y: 0 }, { x: index, y: 10 }), item];
  }), meta: {} });
  const header = parseJwwDocumentHeader(buildJwwWriteResult({ version, entities: [] }).bytes);
  const changes = { m_nMaxDrawWid: -423, m_nMemoriMode: -11, m_nPrtKyoutsuuGray: 1, "m_aPenColor[356]": 0x123456, "m_astrUDColorName[256]": "SXF color", "m_astrUDLTypeName[32]": "SXF pattern", "m_anUDLTypeSegment[32]": 10 };
  for (let i = 1; i <= 10; i += 1) changes[`m_aadUDLTypePitch[32][${i}]`] = i * 0.125;
  for (const field of header.fields) if (Object.hasOwn(changes, field.name)) field.value = changes[field.name];
  cases.push({ name: "header-sxf-signed-settings", entities: [line({ x: 0, y: 0 }, { x: 10, y: 10 })], meta: { jwwInternalSettings: { document: header } } });
  return cases;
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

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
      const json = JSON.parse(JSON.stringify(converted));
      const second = buildJwwWriteResult({
        version,
        entities: json.entities,
        meta: json.meta,
      });
      const secondPath = path.join(outputDir, `${stem}.roundtrip.jww`);
      await writeFile(secondPath, second.bytes);
      const convertedAgain = convertJwwBytes(second.bytes, { sourcePath: secondPath });
      const diff = buildJwwSemanticDiff(converted, convertedAgain);
      const native = saveNativeJww(await openNativeJww(first.bytes));
      const firstSha256 = sha256(first.bytes);
      const secondSha256 = sha256(second.bytes);
      const binaryEqual = Buffer.from(first.bytes).equals(Buffer.from(second.bytes));
      const nativeUnchanged = native.byteIdentical && native.savedSha256 === firstSha256 && Buffer.from(first.bytes).equals(Buffer.from(native.bytes));
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
        firstSha256,
        secondSha256,
        binaryEqual,
        nativeUnchanged,
        passed: diff.roundTripCompatible && binaryEqual && nativeUnchanged,
      });
    }
  }

  const report = {
    format: "jww-gateway-roundtrip-corpus",
    formatVersion: 2,
    generatedAt: new Date().toISOString(),
    outputDir,
    rows,
    summary: {
      fixtures: rows.length,
      passed: rows.filter((row) => row.passed).length,
      failed: rows.filter((row) => !row.passed).length,
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
