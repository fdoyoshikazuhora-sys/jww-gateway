import { parse } from "./parser.js";
import {
  JWW_WRITE_VERSIONS,
  buildJwwBytes,
  buildJwwWriteResult,
  extractJwwTemplatePrefix,
  patchJwwTemplatePrefixMetadata,
  parseJwwImageReferenceText,
  preflightJwwWrite,
  setJwwImageReferenceRotation,
} from "./writer.js";
import { convertJwwBytes } from "../../tools/jww-gateway.mjs";

function value(entity) {
  return entity?.value || entity;
}

function withLayerGroupState(bytes, groupIndex, state) {
  const output = Uint8Array.from(bytes);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const memoOffset = 12;
  const memoLength = output[memoOffset];
  if (memoLength === 0xff) {
    throw new Error("Expected a compact memo in the test fixture");
  }
  const paperOffset = memoOffset + 1 + memoLength;
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  view.setUint32(layerGroupsOffset + groupIndex * layerGroupStride, state, true);
  return output;
}

function withLayerState(bytes, groupIndex, layerIndex, state) {
  const output = Uint8Array.from(bytes);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const memoOffset = 12;
  const memoLength = output[memoOffset];
  if (memoLength === 0xff) {
    throw new Error("Expected a compact memo in the test fixture");
  }
  const paperOffset = memoOffset + 1 + memoLength;
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  const layersOffset =
    layerGroupsOffset + groupIndex * layerGroupStride + 4 + 4 + 8 + 4;
  view.setUint32(layersOffset + layerIndex * 8, state, true);
  return output;
}

describe("JWW writer", () => {
  it("writes and reparses an empty drawing with complete native list boundaries", () => {
    for (const version of JWW_WRITE_VERSIONS) {
      const bytes = buildJwwBytes({ version, entities: [] });
      const doc = parse(bytes);

      expect(doc.version).toBe(version);
      expect(Number.isInteger(doc.entity_list_offset)).toBe(true);
      expect(doc.entity_list_complete).toBe(true);
      expect(doc.block_list_complete).toBe(true);
      expect(doc.entities.length).toBe(0);
      expect(doc.block_defs.length).toBe(0);
      if (version >= 700) expect(doc.embedded_image_list_complete).toBe(true);
    }
  });

  it("finds an empty drawing list before block definitions and embedded images", () => {
    const withBlock = buildJwwBytes({
      version: 700,
      entities: [],
      meta: {
        jwwBlockDefinitions: [
          {
            number: 7,
            rawName: "OnlyBlock",
            entities: [
              {
                type: "LINE",
                entity: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
              },
            ],
          },
        ],
      },
    });
    const withImage = buildJwwBytes({
      version: 700,
      entities: [],
      meta: {
        jwwEmbeddedImages: [
          { fileName: "only.bmp", bytes: Uint8Array.from([1, 2, 3]) },
        ],
      },
    });
    const blockDoc = parse(withBlock);
    const imageDoc = parse(withImage);

    expect(blockDoc.entities.length).toBe(0);
    expect(blockDoc.entity_list_complete).toBe(true);
    expect(blockDoc.block_list_complete).toBe(true);
    expect(blockDoc.block_defs.length).toBe(1);
    expect(blockDoc.block_defs[0].name).toBe("OnlyBlock");
    expect(imageDoc.entities.length).toBe(0);
    expect(imageDoc.entity_list_complete).toBe(true);
    expect(imageDoc.block_list_complete).toBe(true);
    expect(imageDoc.embedded_image_list_complete).toBe(true);
    expect(imageDoc.embedded_images.length).toBe(1);
    expect(Array.from(imageDoc.embedded_images[0].bytes)).toEqual([1, 2, 3]);
  });

  it("writes clean v600 and v700 files with version-correct empty tails", () => {
    for (const version of JWW_WRITE_VERSIONS) {
      const result = buildJwwWriteResult({
        version,
        entities: [
          {
            type: "LINE",
            entity: {
              start: { x: 1, y: 2 },
              end: { x: 3, y: 4 },
              jww: { penColor: 2, penStyle: 1, layerGroup: 0, layer: 0 },
            },
          },
          {
            type: "LINE",
            entity: {
              start: { x: 5, y: 6 },
              end: { x: 7, y: 8 },
              jww: { penColor: 3, penStyle: 1, layerGroup: 0, layer: 0 },
            },
          },
        ],
      });
      const doc = parse(result.bytes, { encoding: "shift_jis" });

      expect(result.version).toBe(version);
      expect(result.recordsWritten).toBe(2);
      expect(result.unsupportedEntities).toEqual([]);
      expect(Array.from(result.bytes.slice(version >= 700 ? -6 : -2))).toEqual(
        version >= 700 ? [0, 0, 0, 0, 0, 0] : [0, 0]
      );
      expect(doc.version).toBe(version);
      expect(doc.entities.length).toBe(2);
      expect(doc.diagnostics).toMatchObject({
        unsupportedClasses: {},
        unsupportedCount: 0,
        skippedCount: 0,
      });
      expect(value(doc.entities[0]).start_x).toBe(1);
      expect(value(doc.entities[1]).end_y).toBe(8);
    }
  });

  it("extracts only the pre-entity prefix from a complete JWW template", () => {
    const source = buildJwwBytes({
      version: 700,
      entities: [
        {
          type: "LINE",
          entity: { start: { x: 1, y: 1 }, end: { x: 2, y: 2 } },
        },
        {
          type: "LINE",
          entity: { start: { x: 3, y: 3 }, end: { x: 4, y: 4 } },
        },
      ],
    });
    const template = extractJwwTemplatePrefix(source);
    const rewritten = buildJwwBytes({
      version: 700,
      templatePrefix: template.prefixBytes,
      entities: [
        {
          type: "POINT",
          entity: { position: { x: 9, y: 10 } },
        },
      ],
    });
    const doc = parse(rewritten, { encoding: "shift_jis" });

    expect(template.entityListOffset < source.length).toBe(true);
    expect(template.prefixBytes.length).toBe(template.entityListOffset);
    expect(doc.entities.length).toBe(1);
    expect(value(doc.entities[0]).x).toBe(9);
    expect(value(doc.entities[0]).y).toBe(10);
    expect(doc.diagnostics).toMatchObject({
      unsupportedClasses: {},
      unsupportedCount: 0,
      skippedCount: 0,
    });
  });

  it("preserves text, arc, point marker, solid, and internal setting fields", () => {
    const bytes = buildJwwBytes({
      entities: [
        {
          type: "TEXT",
          entity: {
            position: { x: 10, y: 20 },
            endPoint: { x: 15, y: 20 },
            text: "Gateway",
            paperTextWidth: 5,
            paperTextHeight: 3,
            paperTextSpacing: 0.5,
            jwwTextType: 2,
            fontFamily: "MS Gothic",
          },
        },
        {
          type: "ARC",
          entity: {
            center: { x: 30, y: 40 },
            radius: 5,
            jwwStartAngle: 0.25,
            jwwArcAngle: 1.5,
            jwwTiltAngle: 0.5,
            jwwFlatness: 0.75,
          },
        },
        {
          type: "POINT",
          entity: {
            position: { x: 50, y: 60 },
            jwwPointCode: 3,
            jwwPointAngle: 0.75,
            jwwPointScale: 2,
            jww: { penStyle: 100 },
          },
        },
        {
          type: "SOLID",
          entity: {
            jwwSourceVertices: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
              { x: 0, y: 10 },
            ],
            jwwSolidColor: 0x112233,
            jww: { penColor: 10 },
          },
        },
      ],
      meta: {
        jwwInternalSettings: {
          records: [
            {
              id: "setting",
              text: "View_Direct2d = 1",
              startPoint: { x: 0, y: -1000 },
              endPoint: { x: 0, y: -1000 },
              sizeX: 3,
              sizeY: 3,
              spacing: 0.5,
              angle: 0,
              fontFamily: "MS Gothic",
              textType: 1,
              jww: { penColor: 9, penStyle: 9, layerGroup: 6, layer: 0 },
            },
          ],
        },
      },
    });
    const doc = parse(bytes, { encoding: "shift_jis" });
    const rows = doc.entities.map(value);

    expect(rows.length).toBe(5);
    expect(rows[0].content).toBe("Gateway");
    expect(rows[0].text_type).toBe(2);
    expect(rows[1].flatness).toBe(0.75);
    expect(rows[2].code).toBe(3);
    expect(rows[2].scale).toBe(2);
    expect(rows[3].color).toBe(0x112233);
    expect({ x: rows[3].point1_x, y: rows[3].point1_y }).toEqual({ x: 0, y: 0 });
    expect({ x: rows[3].point4_x, y: rows[3].point4_y }).toEqual({ x: 10, y: 0 });
    expect({ x: rows[3].point2_x, y: rows[3].point2_y }).toEqual({ x: 10, y: 10 });
    expect({ x: rows[3].point3_x, y: rows[3].point3_y }).toEqual({ x: 0, y: 10 });
    expect(rows[4].content).toBe("View_Direct2d = 1");
  });

  it("writes and parses the MFC extended collection count above 65534 records", () => {
    const line = {
      type: "LINE",
      entity: { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
    };
    const result = buildJwwWriteResult({
      version: 700,
      entities: Array(0xffff).fill(line),
    });
    const doc = parse(result.bytes, { encoding: "shift_jis" });

    expect(result.recordsWritten).toBe(0xffff);
    expect(Array.from(result.bytes.slice(doc.entity_list_offset, doc.entity_list_offset + 6))).toEqual([
      0xff,
      0xff,
      0xff,
      0xff,
      0,
      0,
    ]);
    expect(doc.entity_list_offset).toBeGreaterThan(0);
    expect(doc.entity_records.length).toBe(0xffff);
    expect(doc.entities.length).toBe(0xffff);
    expect(doc.entity_list_complete).toBe(true);
    expect(doc.diagnostics).toMatchObject({ unsupportedCount: 0, skippedCount: 0 });
  });

  it("preserves CDataSolid boundary order through Gateway JSON conversion", () => {
    const boundary = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const source = buildJwwBytes({
      version: 700,
      entities: [
        {
          type: "SOLID",
          entity: {
            jwwSourceVertices: boundary,
            jwwSolidColor: 0x112233,
            jww: { penColor: 10 },
          },
        },
      ],
    });

    const converted = convertJwwBytes(source, { sourcePath: "solid.jww" });
    expect(converted.entities[0].entity.jwwSourceVertices).toEqual(boundary);

    const rewritten = buildJwwBytes({
      version: 700,
      entities: converted.entities,
      meta: converted.meta,
    });
    const solid = value(parse(rewritten).entities[0]);

    expect({ x: solid.point1_x, y: solid.point1_y }).toEqual(boundary[0]);
    expect({ x: solid.point4_x, y: solid.point4_y }).toEqual(boundary[1]);
    expect({ x: solid.point2_x, y: solid.point2_y }).toEqual(boundary[2]);
    expect({ x: solid.point3_x, y: solid.point3_y }).toEqual(boundary[3]);
  });

  it("preserves JWW text decoration controls through Gateway JSON conversion", () => {
    const rawText = "P^bL";
    const source = buildJwwBytes({
      version: 700,
      entities: [
        {
          type: "TEXT",
          entity: {
            position: { x: 10, y: 20 },
            endPoint: { x: 30, y: 20 },
            text: rawText,
            paperTextWidth: 20,
            paperTextHeight: 3,
            paperTextSpacing: 0,
            rotation: 0,
            fontFamily: "MS Gothic",
          },
        },
      ],
    });
    const converted = convertJwwBytes(source, { encoding: "shift_jis" });
    const text = converted.entities[0].entity;

    expect(text.text).toBe("PL");
    expect(text.rawText).toBe(rawText);
    expect(text.jwwSpecialRuns).toEqual([
      expect.objectContaining({
        kind: "overlay",
        marker: "^b",
        baseText: "P",
        overlayText: "L",
      }),
    ]);
    expect(text.jwwTextSegments).toEqual([
      expect.objectContaining({
        kind: "overlay",
        marker: "^b",
        text: "PL",
      }),
    ]);

    const rewritten = buildJwwWriteResult({
      version: 700,
      entities: converted.entities,
      meta: converted.meta,
    });
    const reopened = value(parse(rewritten.bytes).entities[0]);

    expect(reopened.raw_content).toBe(rawText);
    expect(reopened.content).toBe("PL");
    expect(reopened.jww_special_runs).toEqual(text.jwwSpecialRuns);
    expect(reopened.jww_text_segments).toEqual(text.jwwTextSegments);
  });

  it("applies an explicit paper code to default and source templates", () => {
    for (const paperSize of [0, 1, 2, 3, 4, 8, 9, 10, 11, 12, 13, 14]) {
      const bytes = buildJwwBytes({ paperSize, entities: [] });
      expect(parse(bytes, { encoding: "shift_jis" }).paper_size).toBe(paperSize);
    }

    const source = buildJwwBytes({
      paperSize: 2,
      entities: [
        {
          type: "LINE",
          entity: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
        },
      ],
    });
    const template = extractJwwTemplatePrefix(source);
    const rewritten = buildJwwBytes({
      paperSize: 4,
      templatePrefix: template.prefixBytes,
      entities: [],
    });
    expect(parse(rewritten, { encoding: "shift_jis" }).paper_size).toBe(4);
  });

  it("applies explicit layer group scales to a source template", () => {
    const source = buildJwwBytes({
      version: 700,
      entities: [
        {
          type: "LINE",
          entity: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
        },
      ],
    });
    const template = extractJwwTemplatePrefix(source);
    const rewritten = buildJwwBytes({
      templatePrefix: template.prefixBytes,
      layerGroupScales: { 0: "1/100", 1: "1/250", F: "1/5" },
      entities: [],
    });
    const parsed = parse(rewritten, { encoding: "shift_jis" });

    expect(parsed.layer_groups[0].scale).toBe(100);
    expect(parsed.layer_groups[1].scale).toBe(250);
    expect(parsed.layer_groups[15].scale).toBe(5);
  });

  it("patches paper, write group, group scales, and write layers without touching entity bytes", () => {
    const source = buildJwwBytes({
      version: 700,
      paperSize: 2,
      layerGroupScales: { 0: 100, 1: 50 },
      entities: [
        {
          type: "LINE",
          entity: { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
        },
      ],
    });
    const before = parse(source);
    const prefixEnd = before.entity_list_offset;
    const prefix = patchJwwTemplatePrefixMetadata(source.slice(0, prefixEnd), {
      paperSize: 3,
      writeLayerGroup: 2,
      layerGroupScales: { 0: 20 },
      layerGroupWriteLayers: { 0: 6 },
    });
    const bytes = new Uint8Array(prefix.length + source.length - prefixEnd);
    bytes.set(prefix, 0);
    bytes.set(source.slice(prefixEnd), prefix.length);
    const after = parse(bytes);

    expect(prefix.length).toBe(prefixEnd);
    expect(after.paper_size).toBe(3);
    expect(after.write_layer_group).toBe(2);
    expect(before.layer_groups[before.write_layer_group].state).toBe(3);
    expect(after.layer_groups[before.write_layer_group].state).toBe(2);
    expect(after.layer_groups[2].state).toBe(3);
    expect(after.layer_groups[0].scale).toBe(20);
    expect(after.layer_groups[1].scale).toBe(50);
    expect(after.layer_groups[0].write_layer).toBe(6);
    expect(after.layer_groups[0].layers[0].state).toBe(2);
    expect(after.layer_groups[0].layers[6].state).toBe(3);
    expect(bytes.slice(prefix.length)).toEqual(source.slice(prefixEnd));
  });

  it("patches official non-current group and layer state codes without touching entity bytes", () => {
    const source = buildJwwBytes({
      version: 700,
      entities: [{
        type: "LINE",
        entity: { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
      }],
    });
    const before = parse(source);
    const prefixEnd = before.entity_list_offset;
    const groupStates = Array(16).fill(null);
    groupStates[1] = 1;
    groupStates[2] = 2;
    const prefix = patchJwwTemplatePrefixMetadata(source.slice(0, prefixEnd), {
      layerGroupStates: groupStates,
      layerStates: { "0.1": 1, "0.2": 2 },
    });
    const bytes = new Uint8Array(prefix.length + source.length - prefixEnd);
    bytes.set(prefix, 0);
    bytes.set(source.slice(prefixEnd), prefix.length);
    const after = parse(bytes);

    expect(after.layer_groups[1].state).toBe(1);
    expect(after.layer_groups[2].state).toBe(2);
    expect(after.layer_groups[0].layers[1].state).toBe(1);
    expect(after.layer_groups[0].layers[2].state).toBe(2);
    expect(bytes.slice(prefix.length)).toEqual(source.slice(prefixEnd));
  });

  it("patches official non-current protection codes 1 and 2 without touching entity bytes", () => {
    const source = buildJwwBytes({
      version: 700,
      entities: [{
        type: "LINE",
        entity: { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
      }],
    });
    const before = parse(source);
    const prefixEnd = before.entity_list_offset;
    const prefix = patchJwwTemplatePrefixMetadata(source.slice(0, prefixEnd), {
      layerGroupProtections: { 1: 1, 2: 2 },
      layerProtections: { "0.1": 1, "0.2": 2 },
    });
    const bytes = new Uint8Array(prefix.length + source.length - prefixEnd);
    bytes.set(prefix, 0);
    bytes.set(source.slice(prefixEnd), prefix.length);
    const after = parse(bytes);

    expect(after.layer_groups[1].protect).toBe(1);
    expect(after.layer_groups[2].protect).toBe(2);
    expect(after.layer_groups[0].layers[1].protect).toBe(1);
    expect(after.layer_groups[0].layers[2].protect).toBe(2);
    expect(bytes.slice(prefix.length)).toEqual(source.slice(prefixEnd));
  });

  it("rejects protection codes outside 0..2 and nonzero current-row protection", () => {
    const source = buildJwwBytes({ version: 700, entities: [] });
    const parsed = parse(source);
    const prefix = source.slice(0, parsed.entity_list_offset);
    const currentGroup = parsed.write_layer_group;
    const currentLayer = parsed.layer_groups[0].write_layer;
    const messageFor = (options) => {
      try {
        patchJwwTemplatePrefixMetadata(prefix, options);
        return "";
      } catch (error) {
        return error?.message || String(error);
      }
    };

    expect(messageFor({ layerGroupProtections: { 1: 3 } })).toContain(
      "Unsupported JWW layer protection"
    );
    expect(messageFor({ layerGroupProtections: { [currentGroup]: 1 } })).toContain(
      "Current JWW layer group cannot be protected"
    );
    expect(messageFor({ layerProtections: { [`0.${currentLayer}`]: 2 } })).toContain(
      "Current JWW layer cannot be protected"
    );
  });

  it("rejects state 3 for non-current rows and non-3 for current rows", () => {
    const source = buildJwwBytes({ version: 700, entities: [] });
    const parsed = parse(source);
    const prefix = source.slice(0, parsed.entity_list_offset);
    const currentGroup = parsed.write_layer_group;
    const currentLayer = parsed.layer_groups[0].write_layer;
    const invalidGroupStates = Array(16).fill(null);
    invalidGroupStates[currentGroup] = 2;

    const messageFor = (options) => {
      try {
        patchJwwTemplatePrefixMetadata(prefix, options);
        return "";
      } catch (error) {
        return error?.message || String(error);
      }
    };
    expect(messageFor({ layerGroupStates: invalidGroupStates })).toContain(
      "Current JWW layer group must retain state 3"
    );
    expect(messageFor({ layerStates: { [`0.${currentLayer}`]: 2 } })).toContain(
      "Current JWW layer must retain state 3"
    );
    expect(messageFor({ layerStates: { "0.1": 3 } })).toContain(
      "Non-current JWW layer cannot use state 3"
    );
  });

  it("patches a hidden target group to the write group without touching entity bytes", () => {
    const source = withLayerGroupState(buildJwwBytes({
      version: 700,
      entities: [
        {
          type: "LINE",
          entity: { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
        },
      ],
    }), 8, 0);
    const before = parse(source);
    const prefixEnd = before.entity_list_offset;
    const prefix = patchJwwTemplatePrefixMetadata(source.slice(0, prefixEnd), {
      writeLayerGroup: 8,
    });
    const bytes = new Uint8Array(prefix.length + source.length - prefixEnd);
    bytes.set(prefix, 0);
    bytes.set(source.slice(prefixEnd), prefix.length);
    const after = parse(bytes);

    expect(before.layer_groups[8].state).toBe(0);
    expect(after.write_layer_group).toBe(8);
    expect(after.layer_groups[before.write_layer_group].state).toBe(2);
    expect(after.layer_groups[8].state).toBe(3);
    expect(bytes.slice(prefix.length)).toEqual(source.slice(prefixEnd));
  });

  for (const initialState of [0, 1]) {
    it(`patches a state ${initialState} target layer to the write layer without touching entity bytes`, () => {
      const source = withLayerState(buildJwwBytes({
        version: 700,
        entities: [
          {
            type: "LINE",
            entity: { start: { x: 1, y: 2 }, end: { x: 3, y: 4 } },
          },
        ],
      }), 0, 7, initialState);
      const before = parse(source);
      const prefixEnd = before.entity_list_offset;
      const prefix = patchJwwTemplatePrefixMetadata(source.slice(0, prefixEnd), {
        layerGroupWriteLayers: { 0: 7 },
      });
      const bytes = new Uint8Array(prefix.length + source.length - prefixEnd);
      bytes.set(prefix, 0);
      bytes.set(source.slice(prefixEnd), prefix.length);
      const after = parse(bytes);

      expect(before.layer_groups[0].write_layer).toBe(0);
      expect(before.layer_groups[0].layers[0].state).toBe(3);
      expect(before.layer_groups[0].layers[7].state).toBe(initialState);
      expect(after.layer_groups[0].write_layer).toBe(7);
      expect(after.layer_groups[0].layers[0].state).toBe(2);
      expect(after.layer_groups[0].layers[7].state).toBe(3);
      expect(bytes.slice(prefix.length)).toEqual(source.slice(prefixEnd));
    });
  }

  it("rejects unverified current-layer state transitions", () => {
    const source = withLayerState(buildJwwBytes({ version: 700, entities: [] }), 0, 7, 4);
    const prefixEnd = parse(source).entity_list_offset;
    let message = "";
    try {
      patchJwwTemplatePrefixMetadata(source.slice(0, prefixEnd), {
        layerGroupWriteLayers: { 0: 7 },
      });
    } catch (error) {
      message = error?.message || String(error);
    }

    expect(message).toContain(
      "JWW write layer transition from state 4 is not verified: 0.7"
    );
  });

  it("aligns the default template write group and layers with new entities", () => {
    const result = buildJwwWriteResult({
      entities: [
        {
          type: "LINE",
          entity: {
            jww: { layerGroup: 4, layer: 9 },
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
          },
        },
        {
          type: "POINT",
          entity: {
            jww: { layerGroup: 2, layer: 3 },
            position: { x: 5, y: 5 },
          },
        },
      ],
    });
    const parsed = parse(result.bytes, { encoding: "shift_jis" });

    expect(result.usedDefaultTemplatePrefix).toBe(true);
    expect(parsed.write_layer_group).toBe(4);
    expect(parsed.layer_groups[4]).toMatchObject({ state: 3, write_layer: 9 });
    expect(parsed.layer_groups[4].layers[9].state).toBe(3);
    expect(parsed.layer_groups[2]).toMatchObject({ state: 2, write_layer: 3 });
    expect(parsed.layer_groups[2].layers[3].state).toBe(3);
    expect(parsed.layer_groups[0]).toMatchObject({ state: 2, write_layer: 0 });
    expect(parsed.layer_groups[0].layers[0].state).toBe(3);
  });

  it("writes a supported semantic linear dimension group as one CDataSunpou", () => {
    const dimensionId = "dimension-1";
    const profile = { dimensionFigure: true };
    const baseItem = {
      isDimension: true,
      dimensionId,
      dimensionAttributeProfile: profile,
    };
    const line = (start, end) => ({
      ...baseItem,
      type: "LINE",
      entity: {
        type: "LINE",
        isDimension: true,
        dimensionId,
        dimensionAttributeProfile: profile,
        jww: { penColor: 7, penStyle: 1, layerGroup: 0, layer: 0 },
        start,
        end,
      },
    });
    const pointItem = (position) => ({
      ...baseItem,
      type: "POINT",
      entity: {
        type: "POINT",
        isDimension: true,
        dimensionId,
        dimensionAttributeProfile: profile,
        jww: { penColor: 7, penStyle: 1, layerGroup: 0, layer: 0 },
        position,
      },
    });
    const result = buildJwwWriteResult({
      entities: [
        line({ x: 0, y: 0 }, { x: 0, y: 20 }),
        line({ x: 100, y: 0 }, { x: 100, y: 20 }),
        line({ x: 0, y: 20 }, { x: 100, y: 20 }),
        pointItem({ x: 0, y: 20 }),
        pointItem({ x: 100, y: 20 }),
        {
          ...baseItem,
          type: "TEXT",
          entity: {
            type: "TEXT",
            isDimension: true,
            dimensionId,
            dimensionAttributeProfile: profile,
            jww: { penColor: 7, penStyle: 1, layerGroup: 0, layer: 0 },
            position: { x: 45, y: 22 },
            endPoint: { x: 55, y: 22 },
            text: "100",
            paperTextWidth: 3.5,
            paperTextHeight: 3.5,
            paperTextSpacing: 0.5,
            fontFamily: "MS Gothic",
          },
        },
      ],
    });
    const parsed = parse(result.bytes, { encoding: "shift_jis" });
    const dimension = parsed.entities[0].value.jww_dimension;

    expect(result.recordsWritten).toBe(1);
    expect(parsed.entities.length).toBe(1);
    expect(parsed.entity_records[0].className).toBe("CDataSunpou");
    expect(dimension.line).toMatchObject({
      start_x: 0,
      start_y: 20,
      end_x: 100,
      end_y: 20,
    });
    expect(dimension.text.content).toBe("100");
    expect(dimension.native.extension_line_1).toMatchObject({
      start_x: 0,
      start_y: 0,
      end_x: 0,
      end_y: 20,
    });
    expect(dimension.native.extension_point_1).toMatchObject({ x: 0, y: 0 });
    expect(dimension.native.extension_point_2).toMatchObject({ x: 100, y: 0 });
  });

  it("rejects an unsupported semantic dimension group before writing", () => {
    const dimensionId = "dimension-arrow";
    let error = null;
    try {
      buildJwwBytes({
        entities: [
          {
            type: "LINE",
            isDimension: true,
            dimensionId,
            entity: {
              type: "LINE",
              isDimension: true,
              dimensionId,
              start: { x: 0, y: 0 },
              end: { x: 10, y: 0 },
            },
          },
        ],
      });
    } catch (caught) {
      error = caught;
    }
    expect(String(error?.message || "").includes("DIMENSION_GROUP")).toBe(true);
  });

  it("writes native blocks, embedded images, and full dimension records", () => {
    const base = { penColor: 2, penStyle: 1, layerGroup: 0, layer: 0 };
    const line = {
      jww: base,
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
    };
    const dimensionPoint = {
      jww: base,
      position: { x: 0, y: 0 },
      isTemporary: false,
    };
    const result = buildJwwWriteResult({
      version: 700,
      entities: [
        {
          type: "INSERT",
          entity: {
            jww: base,
            jwwBlock: {
              reference: { x: 25, y: 30 },
              scaleX: 2,
              scaleY: 3,
              rotation: 0.5,
              definitionNumber: 7,
            },
          },
        },
        {
          type: "IMAGE",
          entity: {
            jww: base,
            position: { x: 5, y: 6 },
            fileName: "fixture.bmp",
            width: 20,
            height: 10,
          },
        },
        {
          type: "DIMENSION",
          entity: {
            jww: base,
            jwwDimension: {
              base,
              line,
              text: {
                jww: base,
                position: { x: 5, y: 2 },
                endPoint: { x: 8, y: 2 },
                text: "10",
                textType: 1,
                sizeX: 3,
                sizeY: 3,
                spacing: 0.5,
                fontName: "MS Gothic",
              },
              native: {
                sxfMode: 2,
                extensionLines: [line, line],
                points: [dimensionPoint, dimensionPoint, dimensionPoint, dimensionPoint],
              },
            },
          },
        },
      ],
      meta: {
        jwwBlockDefinitions: [
          {
            number: 7,
            referred: true,
            createdAt: 123456789,
            name: "GatewayBlock",
            rawName: "GatewayBlock@@SfigorgFlag@@4",
            jww: base,
            entities: [{ type: "LINE", entity: line }],
          },
        ],
        jwwEmbeddedImages: [
          {
            fileName: "fixture.bmp",
            bytes: Uint8Array.from([0x42, 0x4d, 1, 2, 3]),
          },
        ],
      },
    });
    const doc = parse(result.bytes, { encoding: "shift_jis" });
    const rows = doc.entities.map(value);

    expect(result.blockDefinitionsWritten).toBe(1);
    expect(result.embeddedImagesWritten).toBe(1);
    expect(rows[0].def_number).toBe(7);
    expect(rows[0].scale_x).toBe(2);
    expect(rows[1].raw_content).toBe("^@BM%temp%fixture.bmp,20,10");
    expect(rows[2].jww_dimension.native.sxf_mode).toBe(2);
    expect(rows[2].jww_dimension.native.extension_line_1.end_x).toBe(10);
    expect(doc.block_defs.length).toBe(1);
    expect(doc.block_defs[0].number).toBe(7);
    expect(doc.block_defs[0].name).toBe("GatewayBlock@@SfigorgFlag@@4");
    expect(value(doc.block_defs[0].entities[0]).end_x).toBe(10);
    expect(doc.embedded_images.length).toBe(1);
    expect(doc.embedded_images[0].file_name).toBe("fixture.bmp");
    expect(Array.from(doc.embedded_images[0].bytes)).toEqual([0x42, 0x4d, 1, 2, 3]);
    expect(doc.embedded_images[0].sourceSpan.end - doc.embedded_images[0].sourceSpan.payloadStart).toBe(5);
    expect(doc.embedded_image_list_complete).toBe(true);
    expect(doc.diagnostics).toMatchObject({
      embeddedImageCountDeclared: 1,
      embeddedImageCountParsed: 1,
      embeddedImageTruncatedCount: 0,
      embeddedImageIssues: [],
    });
  });

  it("keeps an external image reference external in v600", () => {
    const result = buildJwwWriteResult({
      version: 600,
      entities: [
        {
          type: "IMAGE",
          entity: {
            position: { x: 5, y: 6 },
            fileName: "fixture.bmp",
            width: 20,
            height: 10,
          },
        },
      ],
      meta: {},
    });
    const doc = parse(result.bytes, { encoding: "shift_jis" });

    expect(value(doc.entities[0]).raw_content).toBe(
      "^@BMfixture.bmp,20,10"
    );
    expect(doc.embedded_images).toEqual([]);
  });

  it("writes extended MFC CString lengths for block names and nested text", () => {
    const blockName = `${"長".repeat(300)}@@SfigorgFlag@@4`;
    const nestedText = "配管".repeat(180);
    const result = buildJwwWriteResult({
      version: 700,
      entities: [],
      meta: {
        jwwBlockDefinitions: [
          {
            number: 19,
            referred: false,
            rawName: blockName,
            entities: [
              {
                type: "TEXT",
                entity: {
                  position: { x: 0, y: 0 },
                  endPoint: { x: 20, y: 0 },
                  text: nestedText,
                  paperTextWidth: 20,
                  paperTextHeight: 3,
                  fontFamily: "MS Gothic",
                },
              },
            ],
          },
        ],
      },
    });
    const doc = parse(result.bytes, { encoding: "shift_jis" });

    expect(doc.block_defs[0].name).toBe(blockName);
    expect(value(doc.block_defs[0].entities[0]).raw_content).toBe(nestedText);
    expect(doc.block_list_complete).toBe(true);
    expect(doc.diagnostics).toMatchObject({
      unsupportedCount: 0,
      skippedCount: 0,
    });
  });

  it("links an image inside a block definition to its embedded v700 payload", () => {
    const imageBytes = Uint8Array.from([0x42, 0x4d, 9, 8, 7]);
    const result = buildJwwWriteResult({
      version: 700,
      entities: [],
      meta: {
        jwwBlockDefinitions: [
          {
            number: 11,
            rawName: "ImageBlock@@SfigorgFlag@@4",
            entities: [
              {
                type: "IMAGE",
                entity: {
                  position: { x: 1, y: 2 },
                  fileName: "block-image.bmp",
                  width: 30,
                  height: 20,
                },
              },
            ],
          },
        ],
        jwwEmbeddedImages: [
          { fileName: "block-image.bmp", bytes: imageBytes },
        ],
      },
    });
    const doc = parse(result.bytes);
    const image = value(doc.block_defs[0].entities[0]);

    expect(image.raw_content).toBe("^@BM%temp%block-image.bmp,30,20");
    expect(Array.from(doc.embedded_images[0].bytes)).toEqual(Array.from(imageBytes));
    expect(doc.diagnostics).toMatchObject({
      unsupportedCount: 0,
      skippedCount: 0,
      embeddedImageIssues: [],
    });
  });

  it("reports the exact source span of a truncated embedded image payload", () => {
    const complete = buildJwwBytes({
      version: 700,
      entities: [
        {
          type: "LINE",
          entity: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
        },
      ],
      meta: {
        jwwEmbeddedImages: [
          { fileName: "truncated.bmp", bytes: Uint8Array.from([1, 2, 3, 4, 5]) },
        ],
      },
    });
    const truncated = complete.slice(0, -2);
    const doc = parse(truncated);
    const image = doc.embedded_images[0];

    expect(image.truncated).toBe(true);
    expect(image.declared_size).toBe(5);
    expect(Array.from(image.bytes)).toEqual([1, 2, 3]);
    expect(image.sourceSpan.end).toBe(truncated.length);
    expect(image.sourceSpan.end - image.sourceSpan.payloadStart).toBe(3);
    expect(doc.embedded_image_list_complete).toBe(false);
    expect(doc.diagnostics).toMatchObject({
      embeddedImageCountDeclared: 1,
      embeddedImageCountParsed: 1,
      embeddedImageTruncatedCount: 1,
    });
    expect(doc.diagnostics.embeddedImageIssues[0]).toMatchObject({
      section: "embedded-images",
      index: 0,
      reason: "truncated-payload",
      declaredByteLength: 5,
      bytesRead: 3,
    });
  });

  it("rejects incomplete embedded image metadata before writing", () => {
    const options = {
      version: 700,
      entities: [],
      meta: {
        jwwEmbeddedImages: [
          {
            fileName: "truncated.bmp",
            declaredSize: 5,
            bytes: Uint8Array.from([1, 2, 3]),
            truncated: true,
          },
        ],
      },
    };
    const preflight = preflightJwwWrite(options);
    let error = null;
    try {
      buildJwwWriteResult(options);
    } catch (caught) {
      error = caught;
    }

    expect(preflight).toMatchObject({
      ok: false,
      code: "JWW_WRITE_PREFLIGHT_FAILED",
    });
    expect(preflight.reasons[0]).toContain("Incomplete embedded JWW image payload");
    expect(error?.message).toContain("Incomplete embedded JWW image payload");
  });

  it("preserves independent image placement and CDataMoji fields through Gateway JSON", () => {
    const imageText =
      "^@BM%temp%fixture.bmp,114.163642,129.166667, 0, 0, 1, 0";
    const first = buildJwwWriteResult({
      version: 700,
      entities: [
        {
          type: "IMAGE",
          entity: {
            jww: { penColor: 1, penStyle: 1, layerGroup: 2, layer: 9 },
            position: { x: 10, y: 20 },
            endPoint: { x: 75, y: 20 },
            fileName: "%temp%fixture.bmp",
            width: 114.163642,
            height: 129.166667,
            paperTextWidth: 2,
            paperTextHeight: 2,
            rotation: 0,
            fontFamily: "MS Gothic",
            jwwImageText: imageText,
          },
        },
      ],
    });

    const converted = convertJwwBytes(first.bytes, { sourcePath: "image.jww" });
    const image = converted.entities.find((item) => item.type === "IMAGE")?.entity;
    expect(image).toMatchObject({
      endPoint: { x: 75, y: 20 },
      width: 114.163642,
      height: 129.166667,
      paperTextWidth: 2,
      paperTextHeight: 2,
      jwwImageText: imageText,
      imageReferenceSuffix: ", 0, 0, 1, 0",
    });
    expect(converted.bounds.maxX).toBe(75);

    const second = buildJwwWriteResult({
      version: 700,
      entities: converted.entities,
      meta: converted.meta,
    });
    const reopened = parse(second.bytes, { encoding: "shift_jis" });
    const reopenedImage = reopened.entities
      .map(value)
      .find((item) => /^\^@BM/i.test(item.raw_content || item.content || ""));
    expect(reopenedImage).toMatchObject({
      start_x: 10,
      start_y: 20,
      end_x: 75,
      end_y: 20,
      size_x: 2,
      size_y: 2,
      angle: 0,
      raw_content: imageText,
    });
  });

  it("writes IMAGE rotation to the CDataMoji fields and the ^@BM transform suffix only with explicit permission", () => {
    const result = buildJwwWriteResult({
      version: 700,
      entities: [
        {
          type: "TEXT",
          entity: {
            position: { x: 0, y: 0 },
            text: "vertical",
            paperTextWidth: 10,
            paperTextHeight: 3,
            rotation: 90,
          },
        },
      ],
    });
    const rows = parse(result.bytes, { encoding: "shift_jis" }).entities.map(value);

    expect(Number(rows[0].end_x.toFixed(12))).toBe(0);
    expect(Number(rows[0].end_y.toFixed(12))).toBe(10);
    expect(rows[0].angle).toBe(90);

    const image = {
      type: "IMAGE",
      entity: {
        position: { x: 5, y: 5 },
        fileName: "vertical.bmp",
        width: 20,
        height: 10,
        rotation: 90,
      },
    };
    expect(preflightJwwWrite({ version: 700, entities: [image] })).toMatchObject({
      ok: false,
      code: "JWW_WRITE_PREFLIGHT_FAILED",
    });

    const written = buildJwwWriteResult({
      version: 700,
      entities: [image],
      allowImageRotation: true,
    });
    const reopenedImage = value(parse(written.bytes).entities[0]);
    expect(Number(reopenedImage.end_x.toFixed(12))).toBe(5);
    expect(Number(reopenedImage.end_y.toFixed(12))).toBe(25);
    expect(reopenedImage.angle).toBe(90);
    expect(reopenedImage.raw_content).toBe(
      "^@BMvertical.bmp,20,10,0,0,1,90"
    );

    const inconsistent = preflightJwwWrite({
      version: 700,
      entities: [
        {
          ...image,
          entity: { ...image.entity, endPoint: { x: 25, y: 5 } },
        },
      ],
      allowImageRotation: true,
    });
    expect(inconsistent).toMatchObject({
      ok: false,
      code: "JWW_WRITE_PREFLIGHT_FAILED",
    });
    expect(inconsistent.reasons[0]).toContain("IMAGE_ROTATION_GEOMETRY");
  });

  it("replaces only the proven IMAGE rotation suffix field and preserves crop and RGB fields", () => {
    const source =
      "^@BM%temp%fixture.bmp,100,73.1454, 12, 34, 0.5, 90, 255, 254, 253";
    const revised = setJwwImageReferenceRotation(source, -45);
    expect(revised).toBe(
      "^@BM%temp%fixture.bmp,100,73.1454, 12, 34, 0.5, -45, 255, 254, 253"
    );
    expect(parseJwwImageReferenceText(revised)).toMatchObject({
      embedded: true,
      fileName: "fixture.bmp",
      width: 100,
      height: 73.1454,
      rotation: -45,
      hasRotationField: true,
    });
  });

  it("keeps one CArchive PID map across drawing, block definitions, and nested block lists", () => {
    const base = { penColor: 2, penStyle: 1, layerGroup: 0, layer: 0 };
    const circle = (x) => ({
      type: "CIRCLE",
      entity: { jww: base, center: { x, y: 2 }, radius: 3 },
    });
    const bytes = buildJwwBytes({
      version: 700,
      entities: [circle(1)],
      meta: {
        jwwBlockDefinitions: [0, 1].map((number) => ({
          number,
          referred: true,
          createdAt: 123456789 + number,
          rawName: `Cloud${number}@@SfigorgFlag@@4`,
          jww: base,
          entities: Array.from({ length: 12 }, (_, index) => circle(index)),
        })),
      },
    });
    const doc = parse(bytes, { encoding: "shift_jis" });

    expect(doc.diagnostics).toMatchObject({ unsupportedCount: 0, skippedCount: 0 });
    expect(doc.entity_list_complete).toBe(true);
    expect(doc.block_list_complete).toBe(true);
    expect(doc.block_defs.map((block) => block.entities.length)).toEqual([12, 12]);
    const circleClassPid = doc.entity_records[0].classPid;
    expect(doc.block_defs[0].entity_records[0].classPid).toBe(circleClassPid);
    expect(doc.block_defs[1].entity_records[11].classPid).toBe(circleClassPid);
  });

  it("rejects unsupported entity types instead of silently dropping them", () => {
    let message = "";
    try {
      buildJwwBytes({
        entities: [{ id: "mesh-1", type: "MESH", entity: { type: "MESH" } }],
      });
    } catch (error) {
      message = error.message;
    }

    expect(message).toContain("Unsupported JWW write entity types: MESH");
  });

  it("reports unsupported entity types through writer preflight", () => {
    const result = preflightJwwWrite({
      version: 700,
      entities: [{ id: "mesh-1", type: "MESH", entity: { type: "MESH" } }],
    });

    expect(result).toMatchObject({
      ok: false,
      code: "JWW_WRITE_PREFLIGHT_FAILED",
    });
    expect(result.reasons[0]).toContain("Unsupported JWW write entity types: MESH");
  });
});
