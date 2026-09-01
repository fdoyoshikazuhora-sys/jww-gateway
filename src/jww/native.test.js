import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  JWW_NATIVE_CONTRACT_VERSION,
  JWW_NATIVE_DOCUMENT_KIND,
  applyNativeJwwPatches,
  createNativeJwwImageRotationPatch,
  openNativeJww,
  preflightNativeJwwSave,
  saveNativeJww,
} from "jww-gateway/native";
import { parse } from "./parser.js";
import { buildJwwBytes } from "./writer.js";
import { encodeJwwColorSettings } from "./colorSettings.js";
import { encodeJwwLineTypeSettings } from "./lineTypeSettings.js";

const line = (endX = 10) => ({
  id: "line-1",
  type: "LINE",
  layer: "0-0",
  entity: {
    type: "LINE",
    start: { x: 1, y: 2 },
    end: { x: endX, y: 20 },
    jww: {
      group: 0,
      penStyle: 1,
      penColor: 2,
      penWidth: 3,
      layer: 0,
      layerGroup: 0,
      flag: 0,
    },
  },
});

const fixture = (version) =>
  buildJwwBytes({
    version,
    paperSize: 2,
    layerGroupScales: { 0: 100 },
    entities: [line()],
  });

const officialColorFixture = () =>
  readFileSync(
    new URL("../../samples/jwf-pairs/jwf-open-items-core.jww", import.meta.url)
  );

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

function withLayerGroupProtection(bytes, groupIndex, protect) {
  const output = Uint8Array.from(bytes);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const memoLength = output[12];
  const paperOffset = 12 + 1 + memoLength;
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  view.setUint32(
    layerGroupsOffset + groupIndex * layerGroupStride + 16,
    protect,
    true
  );
  return output;
}

function withLayerProtection(bytes, groupIndex, layerIndex, protect) {
  const output = Uint8Array.from(bytes);
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const memoLength = output[12];
  const paperOffset = 12 + 1 + memoLength;
  const layerGroupsOffset = paperOffset + 8;
  const layerGroupStride = 4 + 4 + 8 + 4 + 16 * (4 + 4);
  const layerOffset =
    layerGroupsOffset + groupIndex * layerGroupStride + 20 + layerIndex * 8;
  view.setUint32(layerOffset + 4, protect, true);
  return output;
}

const fullFixture = () => {
  const base = { penColor: 3, penStyle: 2, penWidth: 4, layerGroup: 1, layer: 2 };
  return buildJwwBytes({
    version: 700,
    entities: [
      line(),
      { type: "CIRCLE", entity: { jww: base, center: { x: 1, y: 2 }, radius: 3 } },
      {
        type: "ARC",
        entity: {
          jww: base,
          center: { x: 4, y: 5 },
          radius: 6,
          jwwStartAngle: 0,
          jwwArcAngle: 1,
        },
      },
      {
        type: "TEXT",
        entity: {
          jww: base,
          position: { x: 7, y: 8 },
          endPoint: { x: 10, y: 8 },
          text: "text",
          paperTextWidth: 3,
          paperTextHeight: 4,
          fontFamily: "MS Gothic",
        },
      },
      { type: "POINT", entity: { jww: base, position: { x: 11, y: 12 } } },
      {
        type: "SOLID",
        entity: {
          jww: base,
          vertices: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
        },
      },
      {
        type: "INSERT",
        entity: {
          jww: base,
          jwwBlock: {
            reference: { x: 13, y: 14 },
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
          position: { x: 15, y: 16 },
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
            line: { jww: base, start: { x: 0, y: 20 }, end: { x: 10, y: 20 } },
            text: {
              jww: base,
              position: { x: 4, y: 22 },
              endPoint: { x: 6, y: 22 },
              text: "10",
              sizeX: 3,
              sizeY: 3,
              fontName: "MS Gothic",
            },
            native: { sxfMode: 0, extensionLines: [], points: [] },
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
          rawName: "NativeBlock@@SfigorgFlag@@4",
          jww: base,
          entities: [{ type: "LINE", entity: { jww: base, start: { x: 0, y: 0 }, end: { x: 5, y: 0 } } }],
        },
      ],
      jwwEmbeddedImages: [
        { fileName: "fixture.bmp", bytes: Uint8Array.from([0x42, 0x4d, 1, 2, 3]) },
      ],
    },
  });
};

async function fixtureWithUnsupportedBlockRecord() {
  const bytes = fullFixture();
  const clean = await openNativeJww(bytes);
  const start = clean.blockDefinitions[0].value.entities[0].sourceSpan.start;
  const corrupted = Uint8Array.from(bytes);
  corrupted[start] = 0x00;
  corrupted[start + 1] = 0x80;
  return { bytes: corrupted, unsupportedStart: start };
}

function fixtureWithNestedObjectReference() {
  const source = fullFixture();
  const parsed = parse(source);
  const sourceRecord = parsed.entity_records[0];
  const nestedRecord = parsed.block_defs[0].entity_records[0];
  const objectPid = Number(sourceRecord?.objectPid);
  const span = nestedRecord?.sourceSpan;
  if (
    !Number.isInteger(objectPid) ||
    objectPid <= 0 ||
    objectPid >= 0x7fff ||
    !Number.isInteger(span?.start) ||
    !Number.isInteger(span?.end)
  ) {
    throw new Error("Unable to construct nested CArchive object-reference fixture");
  }
  const bytes = new Uint8Array(source.length - (span.end - span.start) + 2);
  bytes.set(source.slice(0, span.start), 0);
  bytes.set([objectPid & 0xff, (objectPid >>> 8) & 0xff], span.start);
  bytes.set(source.slice(span.end), span.start + 2);
  return bytes;
}

const fixtureWithTruncatedEmbeddedImage = () => fullFixture().slice(0, -2);

describe("JWW native document API", () => {
  for (const version of [600, 700]) {
    it(`opens v${version} fixtures through the public native contract`, async () => {
      const bytes = fixture(version);
      const document = await openNativeJww(bytes, { encoding: "shift_jis" });

      expect(document.kind).toBe(JWW_NATIVE_DOCUMENT_KIND);
      expect(document.contractVersion).toBe(JWW_NATIVE_CONTRACT_VERSION);
      expect(document.version).toBe(version);
      expect(document.header.paperSize).toBe(2);
      expect(document.layerGroups[0].scale).toBe(100);
      expect(document.nativeEntities.length).toBe(1);
      expect(document.nativeEntities[0]).toMatchObject({
        kind: "LINE",
        section: "drawing",
        index: 0,
        className: "CDataSen",
      });
      expect(document.nativeEntities[0].sourceSpan.byteLength).toBe(61);
      expect(document.settings.grid).toMatchObject({
        id: "jww:grid-settings",
        sourceSpan: { byteLength: 44 },
      });
      expect(document.diagnostics.recordSourceSpansAvailable).toBe(true);
      expect(document.diagnostics.clean).toBe(true);
    });
  }

  it("retains original bytes and their SHA-256 and saves an untouched document byte-identically", async () => {
    const bytes = fixture(700);
    const document = await openNativeJww(bytes);
    const expectedHash = createHash("sha256").update(bytes).digest("hex");

    expect(document.originalSha256).toBe(expectedHash);
    expect(document.originalBytes).toEqual(bytes);
    const saved = saveNativeJww(document);
    expect(saved.byteIdentical).toBe(true);
    expect(saved.bytes).toEqual(bytes);
    expect(saved.recordIdMap).toEqual({});
    expect(saved.deletedRecordIds).toEqual([]);
    expect(saved.recordIdsChanged).toBe(false);
  });

  it("source-splices native paper, write-group, scale, and current-layer metadata", async () => {
    const document = await openNativeJww(fixture(700));
    const header = { ...document.header, paperSize: 3, writeLayerGroup: 2 };
    const previousWriteLayerGroup = Number(document.header.writeLayerGroup);
    const previousWriteLayer = Number(document.layerGroups[10].write_layer);
    const writeLayer = (previousWriteLayer + 6) % 16;
    const layers = document.layerGroups[10].layers.map((layer) => ({ ...layer }));
    layers[previousWriteLayer].state = 2;
    layers[writeLayer].state = 3;
    const group = {
      ...document.layerGroups[10],
      scale: 20,
      write_layer: writeLayer,
      layers,
    };
    const patches = [
      { op: "replace", targetId: document.header.id, record: header },
      { op: "replace", targetId: document.layerGroups[10].id, record: group },
    ];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    const prefixEnd = document.preservedRegions.prefix.end;

    expect(document.header.id).toBe("jww:header");
    expect(document.layerGroups[10].id).toBe("jww:layer-group:10");
    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      prefixMetadataUpdated: true,
      replacementCount: 0,
      willWriteBytes: true,
    });
    expect(saved).toMatchObject({
      strategy: "prefix-splice",
      recordsWritten: 0,
      prefixMetadataUpdated: true,
    });
    expect(reopened.header).toMatchObject({ paperSize: 3, writeLayerGroup: 2 });
    expect(reopened.layerGroups[previousWriteLayerGroup].state).toBe(2);
    expect(reopened.layerGroups[2].state).toBe(3);
    expect(reopened.layerGroups[10].scale).toBe(20);
    expect(reopened.layerGroups[10].write_layer).toBe(writeLayer);
    expect(reopened.layerGroups[10].layers[previousWriteLayer].state).toBe(2);
    expect(reopened.layerGroups[10].layers[writeLayer].state).toBe(3);
    expect(saved.bytes.slice(prefixEnd)).toEqual(document.originalBytes.slice(prefixEnd));
  });

  it("source-splices a variable-length memo while preserving every later source byte", async () => {
    const document = await openNativeJww(fixture(700));
    const originalPrefixEnd = document.preservedRegions.prefix.end;
    const memo = "Gateway native memo\r\n日本語";
    const patches = [{
      op: "replace",
      targetId: document.header.id,
      record: { ...document.header, memo },
    }];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    const savedPrefixEnd = reopened.preservedRegions.prefix.end;

    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      prefixMetadataUpdated: true,
      preservesUnsupportedBytes: true,
      willWriteBytes: true,
    });
    expect(saved.bytes.length).toBeGreaterThan(0);
    expect(saved.document.header.memo).toBe(memo);
    expect(reopened.header.memo).toBe(memo);
    expect(reopened.header.paperSize).toBe(document.header.paperSize);
    expect(reopened.layerGroups).toEqual(document.layerGroups);
    expect(reopened.nativeEntities.map((record) => record.value)).toEqual(
      document.nativeEntities.map((record) => record.value)
    );
    expect(saved.bytes.slice(savedPrefixEnd)).toEqual(
      document.originalBytes.slice(originalPrefixEnd)
    );
  });

  it("keeps a pre-applied dirty memo patch source-spliceable", async () => {
    const document = await openNativeJww(fixture(700));
    const memo = "Pending native memo 日本語";
    const dirty = applyNativeJwwPatches(document, [{
      op: "replace",
      targetId: document.header.id,
      record: { ...document.header, memo },
    }]);
    const preflight = preflightNativeJwwSave(dirty);
    const saved = saveNativeJww(dirty);

    expect(dirty.pendingPrefixMetadataFields).toEqual(["header.memo"]);
    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      preservesUnsupportedBytes: true,
    });
    expect(saved.document.header.memo).toBe(memo);
    expect(saved.document.pendingPrefixMetadataFields).toBe(undefined);
  });

  it("source-splices official non-current group and layer state codes", async () => {
    const document = await openNativeJww(fixture(700));
    const layers = document.layerGroups[0].layers.map((layer) => ({ ...layer }));
    layers[1].state = 1;
    layers[2].state = 2;
    const patches = [
      {
        op: "replace",
        targetId: document.layerGroups[0].id,
        record: { ...document.layerGroups[0], layers },
      },
      {
        op: "replace",
        targetId: document.layerGroups[1].id,
        record: { ...document.layerGroups[1], state: 1 },
      },
    ];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    const prefixEnd = document.preservedRegions.prefix.end;

    expect(preflight).toMatchObject({ ok: true, strategy: "prefix-splice" });
    expect(reopened.layerGroups[1].state).toBe(1);
    expect(reopened.layerGroups[0].layers[1].state).toBe(1);
    expect(reopened.layerGroups[0].layers[2].state).toBe(2);
    expect(saved.bytes.slice(prefixEnd)).toEqual(document.originalBytes.slice(prefixEnd));
  });

  it("source-splices official non-current group and layer protection codes", async () => {
    const document = await openNativeJww(fixture(700));
    const layers = document.layerGroups[0].layers.map((layer) => ({ ...layer }));
    layers[1].protect = 1;
    layers[2].protect = 2;
    const patches = [
      {
        op: "replace",
        targetId: document.layerGroups[0].id,
        record: { ...document.layerGroups[0], layers },
      },
      {
        op: "replace",
        targetId: document.layerGroups[1].id,
        record: { ...document.layerGroups[1], protect: 1 },
      },
      {
        op: "replace",
        targetId: document.layerGroups[2].id,
        record: { ...document.layerGroups[2], protect: 2 },
      },
    ];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    const prefixEnd = document.preservedRegions.prefix.end;

    expect(preflight).toMatchObject({ ok: true, strategy: "prefix-splice" });
    expect(reopened.layerGroups[1].protect).toBe(1);
    expect(reopened.layerGroups[2].protect).toBe(2);
    expect(reopened.layerGroups[0].layers[1].protect).toBe(1);
    expect(reopened.layerGroups[0].layers[2].protect).toBe(2);
    expect(saved.bytes.slice(prefixEnd)).toEqual(document.originalBytes.slice(prefixEnd));
  });

  it("uses revised protection codes when validating state changes", async () => {
    const protectedDocument = await openNativeJww(
      withLayerProtection(
        withLayerGroupProtection(fixture(700), 1, 2),
        0,
        1,
        2
      )
    );
    const layers = protectedDocument.layerGroups[0].layers.map((layer) => ({
      ...layer,
    }));
    layers[1] = { ...layers[1], state: 1, protect: 0 };
    const patches = [
      {
        op: "replace",
        targetId: protectedDocument.layerGroups[0].id,
        record: { ...protectedDocument.layerGroups[0], layers },
      },
      {
        op: "replace",
        targetId: protectedDocument.layerGroups[1].id,
        record: {
          ...protectedDocument.layerGroups[1],
          state: 1,
          protect: 0,
        },
      },
    ];
    const saved = saveNativeJww(protectedDocument, { patches });
    const reopened = await openNativeJww(saved.bytes);

    expect(reopened.layerGroups[1]).toMatchObject({ state: 1, protect: 0 });
    expect(reopened.layerGroups[0].layers[1]).toMatchObject({
      state: 1,
      protect: 0,
    });
  });

  it("source-splices Jw_cad-proven current-row protection patches", async () => {
    const document = await openNativeJww(fixture(700));
    const currentGroup = document.header.writeLayerGroup;
    const currentLayer = document.layerGroups[currentGroup].write_layer;
    const currentLayers = document.layerGroups[currentGroup].layers.map((layer) => ({
      ...layer,
    }));
    currentLayers[currentLayer].protect = 2;
    const patches = [{
      op: "replace",
      targetId: document.layerGroups[currentGroup].id,
      record: {
        ...document.layerGroups[currentGroup],
        protect: 1,
        layers: currentLayers,
      },
    }];
    const prefixEnd = document.preservedRegions.prefix.end;

    expect(preflightNativeJwwSave(document, { patches })).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
    });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);

    expect(reopened.layerGroups[currentGroup]).toMatchObject({ state: 3, protect: 1 });
    expect(reopened.layerGroups[currentGroup].layers[currentLayer]).toMatchObject({
      state: 3,
      protect: 2,
    });
    expect(saved.bytes.slice(prefixEnd)).toEqual(document.originalBytes.slice(prefixEnd));
  });

  it("rejects invalid protection patches", async () => {
    const document = await openNativeJww(fixture(700));

    expect(preflightNativeJwwSave(document, {
      patches: [{
        op: "replace",
        targetId: document.layerGroups[1].id,
        record: { ...document.layerGroups[1], protect: 3 },
      }],
    })).toMatchObject({ ok: false, code: "JWW_NATIVE_METADATA_PATCH_INVALID" });
  });

  it("rejects state edits for current and display-fixed native rows", async () => {
    const document = await openNativeJww(fixture(700));
    const currentGroup = document.header.writeLayerGroup;
    const currentLayer = document.layerGroups[0].write_layer;
    const currentLayers = document.layerGroups[0].layers.map((layer) => ({ ...layer }));
    currentLayers[currentLayer].state = 2;

    expect(preflightNativeJwwSave(document, {
      patches: [{
        op: "replace",
        targetId: document.layerGroups[currentGroup].id,
        record: { ...document.layerGroups[currentGroup], state: 2 },
      }],
    })).toMatchObject({ ok: false, code: "JWW_NATIVE_METADATA_PATCH_INVALID" });
    expect(preflightNativeJwwSave(document, {
      patches: [{
        op: "replace",
        targetId: document.layerGroups[0].id,
        record: { ...document.layerGroups[0], layers: currentLayers },
      }],
    })).toMatchObject({ ok: false, code: "JWW_NATIVE_METADATA_PATCH_INVALID" });

    document.layerGroups[1].protect = 2;
    document.layerGroups[0].layers[1].protect = 2;
    const protectedLayers = document.layerGroups[0].layers.map((layer) => ({ ...layer }));
    protectedLayers[1].state = 1;
    expect(preflightNativeJwwSave(document, {
      patches: [{
        op: "replace",
        targetId: document.layerGroups[1].id,
        record: { ...document.layerGroups[1], state: 1 },
      }],
    })).toMatchObject({ ok: false, code: "JWW_NATIVE_METADATA_PATCH_INVALID" });
    expect(preflightNativeJwwSave(document, {
      patches: [{
        op: "replace",
        targetId: document.layerGroups[0].id,
        record: { ...document.layerGroups[0], layers: protectedLayers },
      }],
    })).toMatchObject({ ok: false, code: "JWW_NATIVE_METADATA_PATCH_INVALID" });
  });

  it("source-splices the Jw_cad-proven hidden write-group transition", async () => {
    const bytes = withLayerGroupState(fixture(700), 8, 0);
    const document = await openNativeJww(bytes);
    const previousWriteLayerGroup = document.header.writeLayerGroup;
    const patches = [
      {
        op: "replace",
        targetId: document.header.id,
        record: { ...document.header, writeLayerGroup: 8 },
      },
    ];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    const prefixEnd = document.preservedRegions.prefix.end;

    expect(document.layerGroups[8].state).toBe(0);
    expect(preflight).toMatchObject({ ok: true, strategy: "prefix-splice" });
    expect(reopened.header.writeLayerGroup).toBe(8);
    expect(reopened.layerGroups[previousWriteLayerGroup].state).toBe(2);
    expect(reopened.layerGroups[8].state).toBe(3);
    expect(saved.bytes.slice(prefixEnd)).toEqual(bytes.slice(prefixEnd));
  });

  it("moves away from a protected current group and retains its protection", async () => {
    const sourceDocument = await openNativeJww(fixture(700));
    const previousWriteLayerGroup = sourceDocument.header.writeLayerGroup;
    const bytes = withLayerGroupProtection(
      fixture(700),
      previousWriteLayerGroup,
      2
    );
    const document = await openNativeJww(bytes);
    const targetWriteLayerGroup = previousWriteLayerGroup === 8 ? 7 : 8;
    const patches = [{
      op: "replace",
      targetId: document.header.id,
      record: { ...document.header, writeLayerGroup: targetWriteLayerGroup },
    }];
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    const prefixEnd = document.preservedRegions.prefix.end;

    expect(reopened.header.writeLayerGroup).toBe(targetWriteLayerGroup);
    expect(reopened.layerGroups[previousWriteLayerGroup]).toMatchObject({
      state: 2,
      protect: 2,
    });
    expect(reopened.layerGroups[targetWriteLayerGroup]).toMatchObject({
      state: 3,
      protect: 0,
    });
    expect(saved.bytes.slice(prefixEnd)).toEqual(bytes.slice(prefixEnd));
  });

  it("moves away from a protected current layer and retains its protection", async () => {
    const sourceDocument = await openNativeJww(fixture(700));
    const groupIndex = sourceDocument.header.writeLayerGroup;
    const previousWriteLayer = sourceDocument.layerGroups[groupIndex].write_layer;
    const targetWriteLayer = previousWriteLayer === 7 ? 6 : 7;
    const bytes = withLayerProtection(
      fixture(700),
      groupIndex,
      previousWriteLayer,
      2
    );
    const document = await openNativeJww(bytes);
    const layers = document.layerGroups[groupIndex].layers.map((layer) => ({
      ...layer,
    }));
    layers[previousWriteLayer].state = 2;
    layers[targetWriteLayer].state = 3;
    const patches = [{
      op: "replace",
      targetId: document.layerGroups[groupIndex].id,
      record: {
        ...document.layerGroups[groupIndex],
        write_layer: targetWriteLayer,
        layers,
      },
    }];
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    const prefixEnd = document.preservedRegions.prefix.end;

    expect(reopened.layerGroups[groupIndex].write_layer).toBe(targetWriteLayer);
    expect(reopened.layerGroups[groupIndex].layers[previousWriteLayer]).toMatchObject({
      state: 2,
      protect: 2,
    });
    expect(reopened.layerGroups[groupIndex].layers[targetWriteLayer]).toMatchObject({
      state: 3,
      protect: 0,
    });
    expect(saved.bytes.slice(prefixEnd)).toEqual(bytes.slice(prefixEnd));
  });

  for (const initialState of [0, 1]) {
    it(`source-splices the Jw_cad-proven state ${initialState} write-layer transition`, async () => {
      const bytes = withLayerState(fixture(700), 0, 7, initialState);
      const document = await openNativeJww(bytes);
      const previousWriteLayer = document.layerGroups[0].write_layer;
      const layers = document.layerGroups[0].layers.map((layer) => ({ ...layer }));
      layers[previousWriteLayer].state = 2;
      layers[7].state = 3;
      const patches = [
        {
          op: "replace",
          targetId: document.layerGroups[0].id,
          record: { ...document.layerGroups[0], write_layer: 7, layers },
        },
      ];
      const preflight = preflightNativeJwwSave(document, { patches });
      const saved = saveNativeJww(document, { patches });
      const reopened = await openNativeJww(saved.bytes);
      const prefixEnd = document.preservedRegions.prefix.end;

      expect(document.layerGroups[0].layers[7].state).toBe(initialState);
      expect(preflight).toMatchObject({ ok: true, strategy: "prefix-splice" });
      expect(reopened.layerGroups[0].write_layer).toBe(7);
      expect(reopened.layerGroups[0].layers[previousWriteLayer].state).toBe(2);
      expect(reopened.layerGroups[0].layers[7].state).toBe(3);
      expect(saved.bytes.slice(prefixEnd)).toEqual(bytes.slice(prefixEnd));
    });
  }

  it("rejects an unverified native write-layer state transition", async () => {
    const document = await openNativeJww(withLayerState(fixture(700), 0, 7, 4));
    const previousWriteLayer = document.layerGroups[0].write_layer;
    const layers = document.layerGroups[0].layers.map((layer) => ({ ...layer }));
    layers[previousWriteLayer].state = 2;
    layers[7].state = 3;
    const preflight = preflightNativeJwwSave(document, {
      patches: [
        {
          op: "replace",
          targetId: document.layerGroups[0].id,
          record: { ...document.layerGroups[0], write_layer: 7, layers },
        },
      ],
    });

    expect(preflight).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_PATCH_INVALID",
      willWriteBytes: false,
    });
    expect(preflight.reasons[0]).toContain(
      "JWW write layer transition from state 4 is not verified"
    );
  });

  it("applies native prefix metadata during a required structural rebuild", async () => {
    const document = await openNativeJww(fixture(700));
    const groupOneLayers = document.layerGroups[1].layers.map((layer) => ({ ...layer }));
    groupOneLayers[1].state = 1;
    groupOneLayers[1].protect = 1;
    const patches = [
      {
        op: "replace",
        targetId: document.header.id,
        record: { ...document.header, paperSize: 4, writeLayerGroup: 10 },
      },
      {
        op: "replace",
        targetId: document.layerGroups[10].id,
        record: { ...document.layerGroups[10], state: 3, scale: 30 },
      },
      {
        op: "replace",
        targetId: document.layerGroups[1].id,
        record: {
          ...document.layerGroups[1],
          state: 1,
          protect: 1,
          layers: groupOneLayers,
        },
      },
      {
        op: "create",
        targetId: "created-for-prefix-rebuild",
        record: {
          base: { pen_style: 1, pen_color: 2, pen_width: 3, layer: 0, layer_group: 10 },
          start_x: 20,
          start_y: 21,
          end_x: 30,
          end_y: 31,
        },
      },
    ];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);

    expect(preflight).toMatchObject({ ok: true, strategy: "rebuild" });
    expect(reopened.header).toMatchObject({ paperSize: 4, writeLayerGroup: 10 });
    expect(reopened.layerGroups[document.header.writeLayerGroup].state).toBe(2);
    expect(reopened.layerGroups[10].state).toBe(3);
    expect(reopened.layerGroups[10].scale).toBe(30);
    expect(reopened.layerGroups[1]).toMatchObject({ state: 1, protect: 1 });
    expect(reopened.layerGroups[1].layers[1]).toMatchObject({
      state: 1,
      protect: 1,
    });
    expect(reopened.nativeEntities.length).toBe(document.nativeEntities.length + 1);
  });

  it("preserves parser-loss bytes while source-splicing native prefix metadata", async () => {
    const { bytes, unsupportedStart } = await fixtureWithUnsupportedBlockRecord();
    const document = await openNativeJww(bytes);
    const patches = [
      {
        op: "replace",
        targetId: document.header.id,
        record: { ...document.header, paperSize: 4 },
      },
      {
        op: "replace",
        targetId: document.layerGroups[1].id,
        record: { ...document.layerGroups[1], scale: 25 },
      },
    ];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    const prefixEnd = document.preservedRegions.prefix.end;

    expect(document.diagnostics.unsupportedCount).toBeGreaterThan(0);
    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      preservesUnsupportedBytes: true,
    });
    expect(saved.bytes.length).toBe(bytes.length);
    expect(saved.bytes.slice(prefixEnd)).toEqual(bytes.slice(prefixEnd));
    expect(saved.bytes.slice(unsupportedStart)).toEqual(bytes.slice(unsupportedStart));
    expect(reopened.header.paperSize).toBe(4);
    expect(reopened.layerGroups[1].scale).toBe(25);
  });

  it("keeps pre-applied dirty record replacements source-spliceable with parser loss", async () => {
    const { bytes, unsupportedStart } = await fixtureWithUnsupportedBlockRecord();
    const document = await openNativeJww(bytes);
    const target = document.nativeEntities[0];
    const replacement = structuredClone(target.value);
    replacement.end_x = 77;
    const dirty = applyNativeJwwPatches(document, [
      { op: "replace", targetId: target.id, record: replacement },
    ]);
    const preflight = preflightNativeJwwSave(dirty);
    const saved = saveNativeJww(dirty);
    const reopened = await openNativeJww(saved.bytes);

    expect(preflight).toMatchObject({
      ok: true,
      strategy: "record-splice",
      replacementRecordIds: [target.id],
      preservesUnsupportedBytes: true,
    });
    expect(saved.bytes.slice(unsupportedStart)).toEqual(bytes.slice(unsupportedStart));
    expect(reopened.nativeEntities[0].value.end_x).toBe(77);
  });

  it("accepts memo changes and rejects unsupported native metadata changes", async () => {
    const document = await openNativeJww(fixture(700));
    const memoSaved = saveNativeJww(document, {
      patches: [
        {
          op: "replace",
          targetId: document.header.id,
          record: { ...document.header, memo: "changed" },
        },
      ],
    });
    const namePreflight = preflightNativeJwwSave(document, {
      patches: [
        {
          op: "replace",
          targetId: document.layerGroups[0].id,
          record: { ...document.layerGroups[0], name: "changed" },
        },
      ],
    });

    expect(memoSaved.strategy).toBe("prefix-splice");
    expect(memoSaved.document.header.memo).toBe("changed");
    expect(memoSaved.bytes.length).toBeGreaterThan(0);
    expect(namePreflight).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_STRUCTURE_CHANGE_UNSUPPORTED",
      willWriteBytes: false,
    });
  });

  it("assigns stable native record ids for the same source bytes", async () => {
    const bytes = fixture(700);
    const first = await openNativeJww(bytes);
    const second = await openNativeJww(bytes);
    expect(first.nativeEntities.map((item) => item.id)).toEqual(
      second.nativeEntities.map((item) => item.id)
    );
  });

  it("keeps a source record id stable after same-class replace, save, and reopen", async () => {
    const document = await openNativeJww(fixture(700));
    const target = document.nativeEntities[0];
    const replacement = structuredClone(target.value);
    replacement.end_x = 25;

    const saved = saveNativeJww(document, {
      patches: [{ op: "replace", targetId: target.id, record: replacement }],
    });
    const reopened = await openNativeJww(saved.bytes);

    expect(target).toMatchObject({
      id: "jww:drawing:0",
      index: 0,
      sourceIndex: 0,
    });
    expect(reopened.nativeEntities[0]).toMatchObject({
      id: target.id,
      index: 0,
      sourceIndex: 0,
      value: { end_x: 25 },
    });
  });

  it("assigns unique source-position ids to value-identical records", async () => {
    const document = await openNativeJww(
      buildJwwBytes({ version: 700, entities: [line(), line()] })
    );

    expect(document.nativeEntities.map((record) => record.id)).toEqual([
      "jww:drawing:0",
      "jww:drawing:1",
    ]);
  });

  it("uses the serialized source index when filtered records precede drawing records", async () => {
    const document = await openNativeJww(
      buildJwwBytes({
        version: 700,
        entities: [
          {
            type: "TEXT",
            entity: {
              position: { x: 0, y: 0 },
              endPoint: { x: 1, y: 0 },
              text: "jww_gateway_metadata",
            },
          },
          line(),
        ],
      })
    );

    expect(document.nativeEntities.length).toBe(1);
    expect(document.nativeEntities[0]).toMatchObject({
      id: "jww:drawing:1",
      index: 0,
      sourceIndex: 1,
      kind: "LINE",
    });
  });

  it("structurally shares untouched records when applying a native patch", async () => {
    const document = await openNativeJww(fixture(700));
    const target = document.nativeEntities[0];
    const untouched = document.nativeEntities[1];
    const replacement = structuredClone(target.value);
    replacement.end_x = 25;

    const revised = applyNativeJwwPatches(document, [
      { op: "replace", targetId: target.id, record: replacement },
    ]);

    expect(revised.nativeEntities).not.toBe(document.nativeEntities);
    expect(revised.nativeEntities[0]).not.toBe(target);
    expect(revised.nativeEntities[1]).toBe(untouched);
    expect(document.nativeEntities[0].value.end_x).not.toBe(25);
    expect(revised.nativeEntities[0].value.end_x).toBe(25);
  });

  it("opens an MFC extended-count native document without quadratic record lookup", async () => {
    const source = buildJwwBytes({
      version: 700,
      entities: Array(0xffff).fill(line()),
    });
    const document = await openNativeJww(source);

    expect(document.nativeEntities.length).toBe(0xffff);
    expect(Boolean(document.nativeEntities[0].sourceSpan)).toBe(true);
    expect(Boolean(document.nativeEntities.at(-1).sourceSpan)).toBe(true);
    expect(document.diagnostics).toMatchObject({
      unsupportedCount: 0,
      skippedCount: 0,
      recordSourceSpansAvailable: true,
    });
  });

  it("retains every required record kind, block relation, and embedded image payload", async () => {
    const document = await openNativeJww(fullFixture());

    expect(document.nativeEntities.map((item) => item.kind)).toEqual([
      "LINE",
      "CIRCLE",
      "ARC",
      "TEXT",
      "POINT",
      "SOLID",
      "INSERT",
      "IMAGE",
      "DIMENSION",
    ]);
    expect(document.blockDefinitions[0]).toMatchObject({
      index: 0,
      value: { number: 7, name: "NativeBlock@@SfigorgFlag@@4" },
    });
    expect(document.blockDefinitions[0].value.entities[0]).toMatchObject({
      kind: "LINE",
      section: "block-0",
      index: 0,
    });
    expect(document.embeddedImages[0]).toMatchObject({
      index: 0,
      fileName: "fixture.bmp",
      declaredSize: 5,
      truncated: false,
    });
    expect(document.embeddedImages[0].sourceSpan.end - document.embeddedImages[0].sourceSpan.payloadStart).toBe(5);
    expect(Array.from(document.embeddedImages[0].bytes)).toEqual([
      0x42,
      0x4d,
      1,
      2,
      3,
    ]);
  });

  it("round-trips native edits for every required drawing record without losing blocks or images", async () => {
    const document = await openNativeJww(fullFixture());
    const patches = document.nativeEntities.map((record) => {
      const value = structuredClone(record.value);
      if (record.kind === "LINE") value.end_x = 101;
      if (record.kind === "CIRCLE") value.radius = 4;
      if (record.kind === "ARC") value.start_angle = 0.25;
      if (record.kind === "TEXT") {
        value.start_x = 8;
        value.content = "edited";
        value.raw_content = "edited";
      }
      if (record.kind === "POINT") value.x = 12;
      if (record.kind === "SOLID") value.point1_x = 2;
      if (record.kind === "INSERT") value.ref_x = 14;
      if (record.kind === "IMAGE") value.start_x = 16;
      if (record.kind === "DIMENSION") {
        value.jww_dimension.line.end_x = 11;
        value.jww_dimension.text.content = "11";
        value.jww_dimension.text.raw_content = "11";
      }
      return { op: "replace", targetId: record.id, record: value };
    });

    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    const byKind = Object.fromEntries(
      reopened.nativeEntities.map((record) => [record.kind, record.value])
    );
    expect(byKind.LINE.end_x).toBe(101);
    expect(byKind.CIRCLE.radius).toBe(4);
    expect(byKind.ARC.start_angle).toBe(0.25);
    expect(byKind.TEXT.content).toBe("edited");
    expect(byKind.POINT.x).toBe(12);
    expect(byKind.SOLID.point1_x).toBe(2);
    expect(byKind.INSERT.ref_x).toBe(14);
    expect(byKind.IMAGE.start_x).toBe(16);
    expect(byKind.DIMENSION.jww_dimension.line.end_x).toBe(11);
    expect(byKind.DIMENSION.jww_dimension.text.content).toBe("11");
    expect(reopened.blockDefinitions[0].value.number).toBe(7);
    expect(reopened.blockDefinitions[0].value.entities.length).toBe(1);
    expect(Array.from(reopened.embeddedImages[0].bytes)).toEqual([
      0x42,
      0x4d,
      1,
      2,
      3,
    ]);
  });

  it("replaces a nested block record and embedded image payload through a clean rebuild", async () => {
    const document = await openNativeJww(fullFixture());
    const nested = document.blockDefinitions[0].value.entities[0];
    const nestedReplacement = structuredClone(nested.value);
    nestedReplacement.end_x = 9;
    const embedded = document.embeddedImages[0];
    const embeddedReplacement = structuredClone(embedded);
    embeddedReplacement.bytes = Uint8Array.from([0x42, 0x4d, 9, 8, 7]);
    embeddedReplacement.declaredSize = embeddedReplacement.bytes.length;
    const patches = [
      { op: "replace", targetId: nested.id, record: nestedReplacement },
      { op: "replace", targetId: embedded.id, record: embeddedReplacement },
    ];

    expect(preflightNativeJwwSave(document, { patches })).toMatchObject({
      ok: true,
      strategy: "rebuild",
      preservesUnsupportedBytes: true,
    });
    const dirty = applyNativeJwwPatches(document, patches);
    expect(document.blockDefinitions[0].value.entities[0].value.end_x).toBe(5);
    expect(Array.from(document.embeddedImages[0].bytes)).toEqual([0x42, 0x4d, 1, 2, 3]);
    const saved = saveNativeJww(dirty);
    const reopened = await openNativeJww(saved.bytes);

    expect(saved.strategy).toBe("rebuild");
    expect(saved.document).toMatchObject({ dirty: false, revision: 1 });
    expect(reopened.blockDefinitions[0].value.number).toBe(7);
    expect(reopened.blockDefinitions[0].value.entities[0]).toMatchObject({
      id: nested.id,
      kind: "LINE",
      value: { end_x: 9 },
    });
    expect(
      reopened.nativeEntities.find((record) => record.kind === "INSERT").value.def_number
    ).toBe(7);
    expect(Array.from(reopened.embeddedImages[0].bytes)).toEqual([
      0x42,
      0x4d,
      9,
      8,
      7,
    ]);
  });

  it("rebuilds a nested CArchive object reference instead of raw-splicing an absent payload", async () => {
    const source = fixtureWithNestedObjectReference();
    const document = await openNativeJww(source);
    const nested = document.blockDefinitions[0].value.entities[0];
    const replacement = structuredClone(nested.value);
    replacement.end_x = 99;
    const patches = [
      { op: "replace", targetId: nested.id, record: replacement },
    ];

    expect(nested).toMatchObject({
      archiveKind: "object-reference",
      className: "CDataSen",
    });
    expect(nested.sourceSpan.payloadStart).toBe(nested.sourceSpan.end);
    expect(preflightNativeJwwSave(document, { patches })).toMatchObject({
      ok: true,
      strategy: "rebuild",
      willWriteBytes: true,
    });

    const saved = saveNativeJww(document, { patches });
    expect(saved.strategy).toBe("rebuild");
    expect(saved.document.diagnostics).toMatchObject({
      clean: true,
      trailingByteLength: 0,
    });
    expect(saved.document.nativeEntities[0].value.end_x).toBe(10);
    expect(saved.document.blockDefinitions[0].value.entities[0].value.end_x).toBe(99);

    const lossyDocument = await openNativeJww(source.slice(0, -2));
    const lossyNested = lossyDocument.blockDefinitions[0].value.entities[0];
    const lossyReplacement = structuredClone(lossyNested.value);
    lossyReplacement.end_x = 77;
    expect(
      preflightNativeJwwSave(lossyDocument, {
        patches: [
          { op: "replace", targetId: lossyNested.id, record: lossyReplacement },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_LOSSY_SAVE_BLOCKED",
      strategy: "blocked",
      willWriteBytes: false,
    });
  });

  it("preserves untouched JWW text decoration controls during a native rebuild", async () => {
    const rawText = "P^bL";
    const source = buildJwwBytes({
      version: 700,
      entities: [
        line(),
        {
          type: "TEXT",
          entity: {
            position: { x: 1, y: 2 },
            endPoint: { x: 5, y: 2 },
            text: rawText,
            paperTextWidth: 4,
            paperTextHeight: 3,
            fontFamily: "MS Gothic",
          },
        },
      ],
    });
    const document = await openNativeJww(source);
    const created = structuredClone(
      document.nativeEntities.find((record) => record.kind === "LINE").value
    );
    created.start_x = 30;
    created.end_x = 40;
    const patches = [
      { op: "create", targetId: "created-line-for-text-rebuild", record: created },
    ];

    expect(preflightNativeJwwSave(document, { patches })).toMatchObject({
      ok: true,
      strategy: "rebuild",
      willWriteBytes: true,
    });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    const text = reopened.nativeEntities.find((record) => record.kind === "TEXT").value;

    expect(saved.bytes.length).toBeGreaterThan(0);
    expect(text.raw_content).toBe(rawText);
    expect(text.content).toBe("PL");
    expect(text.jww_special_runs).toEqual([
      expect.objectContaining({ kind: "overlay", marker: "^b" }),
    ]);
  });

  it("renames a block definition without changing its number or nested record order", async () => {
    const document = await openNativeJww(fullFixture());
    const definition = document.blockDefinitions[0];
    const replacement = structuredClone(definition.value);
    replacement.name = "RenamedBlock@@SfigorgFlag@@4";
    const saved = saveNativeJww(document, {
      patches: [{ op: "replace", targetId: definition.id, record: replacement }],
    });
    const reopened = await openNativeJww(saved.bytes);

    expect(saved.strategy).toBe("rebuild");
    expect(reopened.blockDefinitions[0]).toMatchObject({
      id: definition.id,
      value: {
        number: 7,
        name: "RenamedBlock@@SfigorgFlag@@4",
      },
    });
    expect(reopened.blockDefinitions[0].value.entities[0].id).toBe(
      definition.value.entities[0].id
    );
  });

  it("creates referenced block and embedded-image metadata with stable ID transitions", async () => {
    const document = await openNativeJww(fullFixture());
    const sourceDefinition = document.blockDefinitions[0];
    const sourceInsert = document.nativeEntities.find((record) => record.kind === "INSERT");
    const sourceImage = document.nativeEntities.find((record) => record.kind === "IMAGE");
    const createdDefinition = structuredClone(sourceDefinition.value);
    createdDefinition.number = 8;
    createdDefinition.name = "CreatedBlock@@SfigorgFlag@@4";
    createdDefinition.entities = [
      {
        id: "created-block-line",
        value: {
          ...structuredClone(sourceDefinition.value.entities[0].value),
          end_x: 12,
        },
      },
    ];
    const createdInsert = structuredClone(sourceInsert.value);
    createdInsert.def_number = 8;
    createdInsert.ref_x = 30;
    const createdImage = structuredClone(sourceImage.value);
    createdImage.raw_content = "^@BM%temp%created.bmp,20,10";
    createdImage.content = createdImage.raw_content;
    createdImage.start_x = 40;
    createdImage.end_x = 60;
    const createdPayload = {
      fileName: "created.bmp",
      bytes: Uint8Array.from([0x42, 0x4d, 7, 8, 9]),
      declaredSize: 5,
    };
    const patches = [
      {
        op: "create",
        section: "block-definitions",
        targetId: "created-block-definition",
        record: createdDefinition,
      },
      { op: "create", targetId: "created-insert", record: createdInsert },
      {
        op: "create",
        section: "embedded-images",
        targetId: "created-embedded-image",
        record: createdPayload,
      },
      { op: "create", targetId: "created-image-record", record: createdImage },
    ];

    expect(preflightNativeJwwSave(document, { patches })).toMatchObject({
      ok: true,
      strategy: "rebuild",
      blockDefinitionsWritten: 2,
      embeddedImagesWritten: 2,
    });
    const dirty = applyNativeJwwPatches(document, patches);
    expect(dirty).toMatchObject({ dirty: true, revision: 1 });
    expect(dirty.blockDefinitions[1].id).toBe("created-block-definition");
    expect(dirty.embeddedImages[1].id).toBe("created-embedded-image");
    const saved = saveNativeJww(dirty);
    const reopened = await openNativeJww(saved.bytes);

    expect(reopened.blockDefinitions.length).toBe(2);
    expect(reopened.blockDefinitions[1].value).toMatchObject({
      number: 8,
      name: "CreatedBlock@@SfigorgFlag@@4",
    });
    expect(reopened.blockDefinitions[1].value.entities[0]).toMatchObject({
      kind: "LINE",
      value: { end_x: 12 },
    });
    expect(
      reopened.nativeEntities.find(
        (record) => record.kind === "INSERT" && record.value.def_number === 8
      )?.value.ref_x
    ).toBe(30);
    expect(
      Boolean(reopened.nativeEntities.find(
        (record) =>
          record.kind === "IMAGE" &&
          record.value.raw_content === "^@BM%temp%created.bmp,20,10"
      ))
    ).toBe(true);
    expect(reopened.embeddedImages[1]).toMatchObject({
      fileName: "created.bmp",
      declaredSize: 5,
    });
    expect(Array.from(reopened.embeddedImages[1].bytes)).toEqual([
      0x42,
      0x4d,
      7,
      8,
      9,
    ]);
    expect(saved.recordIdMap["created-block-definition"]).toBe(
      reopened.blockDefinitions[1].id
    );
    expect(saved.recordIdMap["created-block-line"]).toBe(
      reopened.blockDefinitions[1].value.entities[0].id
    );
    expect(saved.recordIdMap["created-embedded-image"]).toBe(
      reopened.embeddedImages[1].id
    );
    expect(Boolean(saved.recordIdMap["created-insert"])).toBe(true);
    expect(Boolean(saved.recordIdMap["created-image-record"])).toBe(true);
    expect(saved.recordIdsChanged).toBe(true);
  });

  it("deletes block and embedded-image metadata only with their references", async () => {
    const document = await openNativeJww(fullFixture());
    const definition = document.blockDefinitions[0];
    const nestedId = definition.value.entities[0].id;
    const insert = document.nativeEntities.find((record) => record.kind === "INSERT");
    const imageRecord = document.nativeEntities.find((record) => record.kind === "IMAGE");
    const embeddedImage = document.embeddedImages[0];
    const patches = [
      { op: "delete", targetId: definition.id },
      { op: "delete", targetId: embeddedImage.id },
      { op: "delete", targetId: insert.id },
      { op: "delete", targetId: imageRecord.id },
    ];

    expect(preflightNativeJwwSave(document, { patches })).toMatchObject({
      ok: true,
      strategy: "rebuild",
      blockDefinitionsWritten: 0,
      embeddedImagesWritten: 0,
    });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);

    expect(reopened.blockDefinitions).toEqual([]);
    expect(reopened.embeddedImages).toEqual([]);
    expect(reopened.nativeEntities.some((record) => record.kind === "INSERT")).toBe(false);
    expect(reopened.nativeEntities.some((record) => record.kind === "IMAGE")).toBe(false);
    expect(saved.deletedRecordIds).toEqual(
      expect.arrayContaining([
        definition.id,
        nestedId,
        embeddedImage.id,
        insert.id,
        imageRecord.id,
      ])
    );
    expect(saved.recordIdsChanged).toBe(true);
  });

  it("creates and deletes nested block records with stable parent and ID transitions", async () => {
    const document = await openNativeJww(fullFixture());
    const definition = document.blockDefinitions[0];
    const originalLine = definition.value.entities[0];
    const createdLine = structuredClone(originalLine.value);
    createdLine.start_x = 0;
    createdLine.start_y = 0;
    createdLine.end_x = 0;
    createdLine.end_y = 8;
    const createPatch = {
      op: "create",
      section: "block-records",
      parentId: definition.id,
      targetId: "created-nested-line",
      index: 0,
      record: createdLine,
    };

    expect(preflightNativeJwwSave(document, { patches: [createPatch] })).toMatchObject({
      ok: true,
      strategy: "rebuild",
      blockDefinitionsWritten: 1,
    });
    const created = saveNativeJww(document, { patches: [createPatch] });
    const createdDocument = created.document;
    const createdDefinition = createdDocument.blockDefinitions[0];

    expect(createdDefinition.value.entities.map((record) => record.kind)).toEqual([
      "LINE",
      "LINE",
    ]);
    expect(createdDefinition.value.entities[0].value).toMatchObject({
      start_x: 0,
      start_y: 0,
      end_x: 0,
      end_y: 8,
    });
    expect(created.recordIdMap["created-nested-line"]).toBe(
      createdDefinition.value.entities[0].id
    );
    expect(created.recordIdMap[originalLine.id]).toBe(
      createdDefinition.value.entities[1].id
    );

    const createdSavedId = createdDefinition.value.entities[0].id;
    const deleted = saveNativeJww(createdDocument, {
      patches: [
        {
          op: "delete",
          parentId: createdDefinition.id,
          targetId: createdSavedId,
        },
      ],
    });
    const deletedDefinition = deleted.document.blockDefinitions[0];

    expect(deletedDefinition.value.entities.length).toBe(1);
    expect(deletedDefinition.value.entities[0].value.end_x).toBe(5);
    expect(deleted.deletedRecordIds.includes(createdSavedId)).toBe(true);
    expect(deleted.recordIdMap[createdDefinition.value.entities[1].id]).toBe(
      deletedDefinition.value.entities[0].id
    );
  });

  it("preserves extended block names and nested text during a structural rebuild", async () => {
    const blockName = `${"長".repeat(300)}@@SfigorgFlag@@4`;
    const nestedText = "配管".repeat(180);
    const source = buildJwwBytes({
      version: 700,
      entities: [],
      meta: {
        jwwBlockDefinitions: [
          {
            number: 21,
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
    const document = await openNativeJww(source);
    const definition = document.blockDefinitions[0];
    const createdValue = structuredClone(definition.value.entities[0].value);
    createdValue.content = "追加";
    createdValue.raw_content = "追加";
    const patch = {
      op: "create",
      section: "block-records",
      parentId: definition.id,
      targetId: "created-long-string-regression-record",
      record: createdValue,
    };

    expect(preflightNativeJwwSave(document, { patches: [patch] })).toMatchObject({
      ok: true,
      strategy: "rebuild",
    });
    const saved = saveNativeJww(document, { patches: [patch] });
    const savedDefinition = saved.document.blockDefinitions[0];

    expect(savedDefinition.value.name).toBe(blockName);
    expect(savedDefinition.value.entities[0].value.raw_content).toBe(nestedText);
    expect(savedDefinition.value.entities[1].value.raw_content).toBe("追加");
    expect(saved.document.diagnostics).toMatchObject({
      clean: true,
      trailingByteLength: 0,
    });
  });

  it("rejects ambiguous nested block record create/delete patches before writing", async () => {
    const document = await openNativeJww(fullFixture());
    const definition = document.blockDefinitions[0];
    const nested = definition.value.entities[0];
    const record = structuredClone(nested.value);
    const cases = [
      {
        patch: {
          op: "create",
          section: "block-records",
          targetId: "missing-parent",
          record,
        },
        reason: "parentId",
      },
      {
        patch: {
          op: "create",
          section: "block-records",
          parentId: "missing-block",
          targetId: "unknown-parent",
          record,
        },
        reason: "parent was not found",
      },
      {
        patch: {
          op: "create",
          section: "block-records",
          parentId: definition.id,
          targetId: "bad-index",
          index: 2,
          record,
        },
        reason: "outside",
      },
      {
        patch: {
          op: "delete",
          parentId: "different-block",
          targetId: nested.id,
        },
        reason: "does not belong",
      },
    ];

    for (const { patch, reason } of cases) {
      const preflight = preflightNativeJwwSave(document, { patches: [patch] });
      expect(preflight).toMatchObject({
        ok: false,
        code: "JWW_NATIVE_METADATA_PATCH_INVALID",
        strategy: "blocked",
        willWriteBytes: false,
      });
      expect(preflight.reasons[0].includes(reason)).toBe(true);
    }
  });

  it("renumbers a block and renames an embedded image only with explicit reference patches", async () => {
    const document = await openNativeJww(fullFixture());
    const definition = document.blockDefinitions[0];
    const insert = document.nativeEntities.find((record) => record.kind === "INSERT");
    const imageRecord = document.nativeEntities.find((record) => record.kind === "IMAGE");
    const embeddedImage = document.embeddedImages[0];
    const renumberedDefinition = structuredClone(definition.value);
    renumberedDefinition.number = 17;
    const revisedInsert = structuredClone(insert.value);
    revisedInsert.def_number = 17;
    const renamedPayload = structuredClone(embeddedImage);
    renamedPayload.fileName = "renamed-fixture.bmp";
    const revisedImage = structuredClone(imageRecord.value);
    revisedImage.raw_content = String(revisedImage.raw_content).replace(
      /fixture\.bmp/i,
      "renamed-fixture.bmp"
    );
    revisedImage.content = revisedImage.raw_content;
    const patches = [
      { op: "replace", targetId: definition.id, record: renumberedDefinition },
      { op: "replace", targetId: insert.id, record: revisedInsert },
      { op: "replace", targetId: embeddedImage.id, record: renamedPayload },
      { op: "replace", targetId: imageRecord.id, record: revisedImage },
    ];

    expect(preflightNativeJwwSave(document, { patches })).toMatchObject({
      ok: true,
      strategy: "rebuild",
      blockDefinitionsWritten: 1,
      embeddedImagesWritten: 1,
    });
    const saved = saveNativeJww(document, { patches });
    const reopened = saved.document;

    expect(reopened.blockDefinitions[0]).toMatchObject({
      id: definition.id,
      value: { number: 17 },
    });
    expect(
      reopened.nativeEntities.find((record) => record.kind === "INSERT")?.value
        ?.def_number
    ).toBe(17);
    expect(reopened.embeddedImages[0]).toMatchObject({
      id: embeddedImage.id,
      fileName: "renamed-fixture.bmp",
      declaredSize: embeddedImage.declaredSize,
    });
    expect(Array.from(reopened.embeddedImages[0].bytes)).toEqual(
      Array.from(embeddedImage.bytes)
    );
    expect(
      reopened.nativeEntities.find((record) => record.kind === "IMAGE")?.value
        ?.raw_content
    ).toBe("^@BM%temp%renamed-fixture.bmp,20,10");
    expect(saved.deletedRecordIds).toEqual([]);
  });

  it("rejects reuse of an old block number or image name inside its rename transaction", async () => {
    const document = await openNativeJww(fullFixture());
    const definition = document.blockDefinitions[0];
    const insert = document.nativeEntities.find((record) => record.kind === "INSERT");
    const imageRecord = document.nativeEntities.find((record) => record.kind === "IMAGE");
    const embeddedImage = document.embeddedImages[0];
    const renumberedDefinition = structuredClone(definition.value);
    renumberedDefinition.number = 17;
    const revisedInsert = structuredClone(insert.value);
    revisedInsert.def_number = 17;
    const reusedNumberDefinition = structuredClone(definition.value);
    reusedNumberDefinition.entities = [];
    const renamedPayload = structuredClone(embeddedImage);
    renamedPayload.fileName = "renamed-fixture.bmp";
    const revisedImage = structuredClone(imageRecord.value);
    revisedImage.raw_content = String(revisedImage.raw_content).replace(
      /fixture\.bmp/i,
      "renamed-fixture.bmp"
    );
    revisedImage.content = revisedImage.raw_content;

    expect(
      preflightNativeJwwSave(document, {
        patches: [
          { op: "replace", targetId: definition.id, record: renumberedDefinition },
          { op: "replace", targetId: insert.id, record: revisedInsert },
          {
            op: "create",
            section: "block-definitions",
            targetId: "reused-old-block-number",
            record: reusedNumberDefinition,
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_CONFLICT",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(
      preflightNativeJwwSave(document, {
        patches: [
          { op: "replace", targetId: embeddedImage.id, record: renamedPayload },
          { op: "replace", targetId: imageRecord.id, record: revisedImage },
          {
            op: "create",
            section: "embedded-images",
            targetId: "reused-old-image-name",
            record: {
              fileName: "fixture.bmp",
              bytes: Uint8Array.from([0x42, 0x4d]),
              declaredSize: 2,
            },
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_CONFLICT",
      strategy: "blocked",
      willWriteBytes: false,
    });
  });

  it("rejects unsafe block/image metadata reference and structure changes in preflight", async () => {
    const document = await openNativeJww(fullFixture());
    const definition = document.blockDefinitions[0];
    const renumbered = structuredClone(definition.value);
    renumbered.number = 8;
    const reordered = structuredClone(definition.value);
    reordered.entities = [];
    const renamedImage = structuredClone(document.embeddedImages[0]);
    renamedImage.fileName = "renamed.bmp";

    expect(
      preflightNativeJwwSave(document, {
        patches: [{ op: "replace", targetId: definition.id, record: renumbered }],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_IN_USE",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(
      preflightNativeJwwSave(document, {
        patches: [{ op: "replace", targetId: definition.id, record: reordered }],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_STRUCTURE_CHANGE_UNSUPPORTED",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(
      preflightNativeJwwSave(document, {
        patches: [
          {
            op: "replace",
            targetId: document.embeddedImages[0].id,
            record: renamedImage,
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_IN_USE",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(
      preflightNativeJwwSave(document, {
        patches: [{ op: "delete", targetId: definition.id }],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_IN_USE",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(
      preflightNativeJwwSave(document, {
        patches: [{ op: "delete", targetId: document.embeddedImages[0].id }],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_IN_USE",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(
      preflightNativeJwwSave(document, {
        patches: [
          {
            op: "create",
            section: "block-definitions",
            targetId: "duplicate-block-number",
            record: structuredClone(definition.value),
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_CONFLICT",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(
      preflightNativeJwwSave(document, {
        patches: [
          {
            op: "create",
            section: "embedded-images",
            targetId: "duplicate-image-name",
            record: {
              fileName: "FIXTURE.BMP",
              bytes: Uint8Array.from([0x42, 0x4d]),
              declaredSize: 2,
            },
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_CONFLICT",
      strategy: "blocked",
      willWriteBytes: false,
    });
    const missingBlockInsert = structuredClone(
      document.nativeEntities.find((record) => record.kind === "INSERT").value
    );
    missingBlockInsert.def_number = 999;
    expect(
      preflightNativeJwwSave(document, {
        patches: [
          { op: "create", targetId: "missing-block-insert", record: missingBlockInsert },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_MISSING",
      strategy: "blocked",
      willWriteBytes: false,
    });
    const missingPayloadImage = structuredClone(
      document.nativeEntities.find((record) => record.kind === "IMAGE").value
    );
    missingPayloadImage.raw_content = "^@BM%temp%missing.bmp,20,10";
    missingPayloadImage.content = missingPayloadImage.raw_content;
    expect(
      preflightNativeJwwSave(document, {
        patches: [
          { op: "create", targetId: "missing-payload-image", record: missingPayloadImage },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_MISSING",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(
      preflightNativeJwwSave(document, {
        patches: [
          {
            op: "create",
            section: "block-records",
            parentId: definition.id,
            targetId: "nested-missing-block-insert",
            record: missingBlockInsert,
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_MISSING",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(
      preflightNativeJwwSave(document, {
        patches: [
          {
            op: "create",
            section: "block-records",
            parentId: definition.id,
            targetId: "nested-missing-payload-image",
            record: missingPayloadImage,
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_REFERENCE_MISSING",
      strategy: "blocked",
      willWriteBytes: false,
    });
  });

  it("preserves image placement, CDataMoji fields, suffix, and payload during rebuild", async () => {
    const imageText =
      "^@BM%temp%fixture.bmp,114.163642,129.166667, 0, 0, 1, 0";
    const source = buildJwwBytes({
      version: 700,
      entities: [
        line(),
        {
          type: "IMAGE",
          entity: {
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
      meta: {
        jwwEmbeddedImages: [
          { fileName: "fixture.bmp", bytes: Uint8Array.from([0x42, 0x4d, 1, 2, 3]) },
        ],
      },
    });
    const document = await openNativeJww(source);
    const createdLine = structuredClone(
      document.nativeEntities.find((record) => record.kind === "LINE").value
    );
    createdLine.start_x = 30;
    createdLine.end_x = 40;

    const saved = saveNativeJww(document, {
      patches: [{ op: "create", targetId: "created-line", record: createdLine }],
    });
    const reopened = await openNativeJww(saved.bytes);
    const image = reopened.nativeEntities.find((record) => record.kind === "IMAGE")?.value;

    expect(saved.strategy).toBe("rebuild");
    expect(saved.bytes.length).toBeGreaterThan(0);
    expect(image).toMatchObject({
      start_x: 10,
      start_y: 20,
      end_x: 75,
      end_y: 20,
      size_x: 2,
      size_y: 2,
      angle: 0,
      raw_content: imageText,
    });
    expect(Array.from(reopened.embeddedImages[0].bytes)).toEqual([
      0x42,
      0x4d,
      1,
      2,
      3,
    ]);
  });

  it("requires explicit permission and binary-consistent fields for native IMAGE rotation", async () => {
    const document = await openNativeJww(fullFixture());
    const imageRecord = document.nativeEntities.find((record) => record.kind === "IMAGE");
    const patch = createNativeJwwImageRotationPatch(document, imageRecord.id, 90);

    const replace = preflightNativeJwwSave(document, {
      patches: [patch],
    });
    const approved = preflightNativeJwwSave(document, {
      patches: [patch],
      allowImageRotation: true,
    });

    expect(replace).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_IMAGE_ROTATION_PERMISSION_REQUIRED",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(approved).toMatchObject({
      ok: true,
      strategy: "record-splice",
      imageRotationApproved: true,
      imageRotationRecordIds: [imageRecord.id],
      willWriteBytes: true,
    });

    const inconsistent = structuredClone(imageRecord.value);
    inconsistent.angle = 90;
    expect(
      preflightNativeJwwSave(document, {
        patches: [
          { op: "replace", targetId: imageRecord.id, record: inconsistent },
        ],
        allowImageRotation: true,
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_IMAGE_ROTATION_INVALID",
      strategy: "blocked",
      willWriteBytes: false,
    });

    const saved = saveNativeJww(document, {
      patches: [patch],
      allowImageRotation: true,
    });
    const reopened = await openNativeJww(saved.bytes);
    const rotated = reopened.nativeEntities.find((record) => record.kind === "IMAGE");
    expect(saved.bytes.length).toBeGreaterThan(0);
    expect(rotated.value.angle).toBe(90);
    expect(Number(rotated.value.end_x.toFixed(12))).toBe(15);
    expect(Number(rotated.value.end_y.toFixed(12))).toBe(36);
    expect(rotated.value.raw_content).toBe(
      "^@BM%temp%fixture.bmp,20,10,0,0,1,90"
    );
  });

  it("preserves an existing rotated IMAGE during an unrelated rebuild without treating it as a new edit", async () => {
    const sourceDocument = await openNativeJww(fullFixture());
    const image = sourceDocument.nativeEntities.find((record) => record.kind === "IMAGE");
    const rotatedSource = saveNativeJww(sourceDocument, {
      patches: [createNativeJwwImageRotationPatch(sourceDocument, image.id, 90)],
      allowImageRotation: true,
    });
    const document = await openNativeJww(rotatedSource.bytes);
    const createdLine = structuredClone(
      document.nativeEntities.find((record) => record.kind === "LINE").value
    );
    createdLine.start_x = 30;
    createdLine.end_x = 40;
    const patches = [
      { op: "create", targetId: "unrelated-created-line", record: createdLine },
    ];

    expect(preflightNativeJwwSave(document, { patches })).toMatchObject({
      ok: true,
      strategy: "rebuild",
      imageRotationRecordIds: [],
      imageRotationApproved: false,
    });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);
    expect(reopened.nativeEntities.find((record) => record.kind === "IMAGE")?.value)
      .toMatchObject({
        angle: 90,
        raw_content: "^@BM%temp%fixture.bmp,20,10,0,0,1,90",
      });
  });

  it("requires the same explicit permission for a binary-consistent rotated IMAGE create", async () => {
    const document = await openNativeJww(fullFixture());
    const sourceImage = document.nativeEntities.find((record) => record.kind === "IMAGE");
    const created = structuredClone(sourceImage.value);
    created.start_x = 40;
    created.start_y = 50;
    created.end_x = 40;
    created.end_y = 70;
    created.angle = 90;
    created.raw_content = "^@BM%temp%fixture.bmp,20,10,0,0,1,90";
    created.content = created.raw_content;
    const patches = [
      { op: "create", targetId: "created-rotated-image", record: created },
    ];

    expect(preflightNativeJwwSave(document, { patches })).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_IMAGE_ROTATION_PERMISSION_REQUIRED",
      willWriteBytes: false,
    });
    expect(
      preflightNativeJwwSave(document, {
        patches,
        allowImageRotation: true,
      })
    ).toMatchObject({
      ok: true,
      strategy: "rebuild",
      imageRotationApproved: true,
      imageRotationRecordIds: ["created-rotated-image"],
      willWriteBytes: true,
    });
    const saved = saveNativeJww(document, {
      patches,
      allowImageRotation: true,
    });
    const reopened = await openNativeJww(saved.bytes);
    expect(
      reopened.nativeEntities.find(
        (record) => record.value?.start_x === 40 && record.kind === "IMAGE"
      )?.value
    ).toMatchObject({
      end_x: 40,
      end_y: 70,
      angle: 90,
      raw_content: "^@BM%temp%fixture.bmp,20,10,0,0,1,90",
    });
  });

  it("resolves Jw_cad .bmp references to their .bmp.gz embedded payload during rotation preflight", async () => {
    const bytes = buildJwwBytes({
      version: 700,
      entities: [
        {
          type: "IMAGE",
          entity: {
            position: { x: 1, y: 2 },
            endPoint: { x: 21, y: 2 },
            fileName: "fixture.bmp",
            width: 20,
            height: 10,
          },
        },
      ],
      meta: {
        jwwEmbeddedImages: [
          {
            fileName: "fixture.bmp.gz",
            bytes: Uint8Array.from([1, 2, 3, 4]),
          },
        ],
      },
    });
    const document = await openNativeJww(bytes);
    const image = document.nativeEntities.find((record) => record.kind === "IMAGE");
    const patch = createNativeJwwImageRotationPatch(document, image.id, 90);

    expect(
      preflightNativeJwwSave(document, {
        patches: [patch],
        allowImageRotation: true,
      })
    ).toMatchObject({
      ok: true,
      strategy: "record-splice",
      imageRotationApproved: true,
    });
    const reopened = await openNativeJww(
      saveNativeJww(document, {
        patches: [patch],
        allowImageRotation: true,
      }).bytes
    );
    expect(reopened.embeddedImages[0].fileName).toBe("fixture.bmp.gz");
    expect(reopened.nativeEntities[0].value.raw_content).toBe(
      "^@BM%temp%fixture.bmp,20,10,0,0,1,90"
    );
  });

  it("diagnoses and preserves an unparsed trailing region on untouched save", async () => {
    const source = fixture(700);
    const bytes = new Uint8Array(source.length + 4);
    bytes.set(source);
    bytes.set([0xde, 0xad, 0xbe, 0xef], source.length);
    const document = await openNativeJww(bytes);

    expect(document.preservedRegions.trailing).toMatchObject({
      start: source.length,
      end: bytes.length,
      byteLength: 4,
    });
    expect(document.diagnostics.clean).toBe(false);
    expect(document.diagnostics.preservedUnknownRegions.length).toBe(1);
    expect(saveNativeJww(document).bytes).toEqual(bytes);
  });

  it("blocks trailing-region rebuilds while preserving same-length record and prefix splices", async () => {
    const source = fixture(700);
    const bytes = new Uint8Array(source.length + 4);
    bytes.set(source);
    bytes.set([0xde, 0xad, 0xbe, 0xef], source.length);
    const document = await openNativeJww(bytes);
    const target = document.nativeEntities[0];
    const replacement = structuredClone(target.value);
    replacement.end_x = 42;
    const safePatches = [
      { op: "replace", targetId: target.id, record: replacement },
      {
        op: "replace",
        targetId: document.header.id,
        record: { ...document.header, paperSize: 4 },
      },
    ];

    expect(preflightNativeJwwSave(document, { patches: safePatches })).toMatchObject({
      ok: true,
      strategy: "record-splice",
      prefixMetadataUpdated: true,
      preservesUnsupportedBytes: true,
    });
    const saved = saveNativeJww(document, { patches: safePatches });
    expect(saved.bytes.length).toBe(bytes.length);
    expect(saved.document.preservedRegions.trailing.start).toBe(source.length);
    expect(saved.bytes.slice(source.length)).toEqual(bytes.slice(source.length));
    expect(saved.document.nativeEntities[0].value.end_x).toBe(42);
    expect(saved.document.header.paperSize).toBe(4);

    const rebuildPreflight = preflightNativeJwwSave(document, {
      patches: [
        {
          op: "create",
          targetId: "created-with-trailing-region",
          record: replacement,
        },
      ],
    });
    expect(rebuildPreflight).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_LOSSY_SAVE_BLOCKED",
      strategy: "blocked",
      willWriteBytes: false,
    });
  });

  it("moves a preserved trailing region without changing its bytes during memo edit", async () => {
    const source = fixture(700);
    const trailing = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);
    const bytes = new Uint8Array(source.length + trailing.length);
    bytes.set(source);
    bytes.set(trailing, source.length);
    const document = await openNativeJww(bytes);
    const patches = [{
      op: "replace",
      targetId: document.header.id,
      record: { ...document.header, memo: "Longer Gateway memo" },
    }];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);

    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      preservesUnsupportedBytes: true,
      willWriteBytes: true,
    });
    expect(saved.bytes.length).toBeGreaterThan(0);
    expect(saved.bytes.slice(-trailing.length)).toEqual(trailing);
    expect(reopened.header.memo).toBe("Longer Gateway memo");
    expect(reopened.diagnostics.trailingByteLength).toBe(trailing.length);
    expect(reopened.preservedRegions.trailing.start).not.toBe(source.length);
  });

  it("preserves a truncated embedded image only through byte-identical or record-splice save", async () => {
    const bytes = fixtureWithTruncatedEmbeddedImage();
    const document = await openNativeJww(bytes);
    const image = document.embeddedImages[0];
    const target = document.nativeEntities.find((record) => record.kind === "LINE");
    const replacement = structuredClone(target.value);
    replacement.end_x = 42;
    const replacePatches = [
      { op: "replace", targetId: target.id, record: replacement },
    ];

    expect(document.diagnostics).toMatchObject({
      clean: false,
      unsupportedCount: 0,
      skippedCount: 0,
      embeddedImageTruncatedCount: 1,
      recordSourceSpansAvailable: true,
    });
    expect(document.diagnostics.embeddedImageIssues[0]).toMatchObject({
      reason: "truncated-payload",
      declaredByteLength: 5,
      bytesRead: 3,
    });
    expect(document.diagnostics.preservedUnknownRegions[0]).toMatchObject({
      reason: "truncated-payload",
      section: "embedded-images",
      index: 0,
    });
    expect(image.sourceSpan.end).toBe(bytes.length);
    expect(saveNativeJww(document).bytes).toEqual(bytes);

    const replaced = saveNativeJww(document, { patches: replacePatches });
    expect(replaced.strategy).toBe("record-splice");
    expect(replaced.bytes.slice(image.sourceSpan.start)).toEqual(
      bytes.slice(image.sourceSpan.start)
    );
    const createPreflight = preflightNativeJwwSave(document, {
      patches: [
        {
          op: "create",
          targetId: "created-line",
          record: replacement,
        },
      ],
    });
    expect(createPreflight).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_LOSSY_SAVE_BLOCKED",
      strategy: "blocked",
      willWriteBytes: false,
    });
    const payloadReplacement = structuredClone(image);
    payloadReplacement.bytes = Uint8Array.from([1, 2, 3]);
    payloadReplacement.declaredSize = 3;
    expect(
      preflightNativeJwwSave(document, {
        patches: [
          {
            op: "replace",
            targetId: image.id,
            record: payloadReplacement,
          },
        ],
      })
    ).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_LOSSY_SAVE_BLOCKED",
      strategy: "blocked",
      willWriteBytes: false,
    });
  });

  it("applies a native record patch and writes a clean revised JWW", async () => {
    const document = await openNativeJww(fixture(700));
    const record = document.nativeEntities[0];
    const replacement = structuredClone(record.value);
    replacement.start_x = 25;

    const saved = saveNativeJww(document, {
      patches: [{ op: "replace", targetId: record.id, record: replacement }],
    });
    const parsed = parse(saved.bytes);

    expect(saved.byteIdentical).toBe(false);
    expect(saved.document.dirty).toBe(false);
    expect(saved.document.revision).toBe(1);
    expect(saved.document.originalBytes).toBe(saved.bytes);
    expect(saved.savedSha256).toBe(
      createHash("sha256").update(saved.bytes).digest("hex")
    );
    expect(saved.document.originalSha256).toBe(saved.savedSha256);
    expect(saved.recordIdMap).toEqual({});
    expect(saved.deletedRecordIds).toEqual([]);
    expect(saved.recordIdsChanged).toBe(false);
    expect(parsed.diagnostics).toMatchObject({
      unsupportedCount: 0,
      skippedCount: 0,
    });
    expect(parsed.entities[0].value.start_x).toBe(25);
    expect(parsed.entities[0].value.end_x).toBe(10);
  });

  it("rebases saved bytes and source spans for a second edit without losing the first edit", async () => {
    const bytes = buildJwwBytes({
      version: 700,
      entities: [
        {
          type: "TEXT",
          entity: {
            jww: { layerGroup: 0, layer: 0, penColor: 2, penStyle: 1, penWidth: 3 },
            position: { x: 1, y: 2 },
            endPoint: { x: 4, y: 2 },
            text: "short",
            paperTextWidth: 3,
            paperTextHeight: 4,
            fontFamily: "MS Gothic",
          },
        },
        line(),
      ],
    });
    const original = await openNativeJww(bytes, {
      encoding: "shift_jis",
      fileName: "sequential-save.jww",
    });
    const originalText = original.nativeEntities.find((record) => record.kind === "TEXT");
    const originalLine = original.nativeEntities.find((record) => record.kind === "LINE");
    const longText = `first-save-${"x".repeat(96)}`;
    const textReplacement = structuredClone(originalText.value);
    textReplacement.content = longText;
    textReplacement.raw_content = longText;

    const first = saveNativeJww(original, {
      patches: [
        { op: "replace", targetId: originalText.id, record: textReplacement },
      ],
    });
    const firstLine = first.document.nativeEntities.find(
      (record) => record.id === originalLine.id
    );

    expect(first.document).toMatchObject({
      dirty: false,
      revision: 1,
      parseOptions: {
        encoding: "shift_jis",
        fileName: "sequential-save.jww",
      },
    });
    expect(first.document.originalBytes).toBe(first.bytes);
    expect(firstLine.sourceSpan.start).toBeGreaterThan(originalLine.sourceSpan.start);

    const lineReplacement = structuredClone(firstLine.value);
    lineReplacement.end_x = 77;
    const second = saveNativeJww(first.document, {
      patches: [
        { op: "replace", targetId: firstLine.id, record: lineReplacement },
      ],
    });
    const reopened = await openNativeJww(second.bytes);

    expect(second.document).toMatchObject({ dirty: false, revision: 2 });
    expect(second.document.originalBytes).toBe(second.bytes);
    expect(second.document.originalSha256).toBe(second.savedSha256);
    expect(
      reopened.nativeEntities.find((record) => record.kind === "TEXT").value.raw_content
    ).toBe(longText);
    expect(
      reopened.nativeEntities.find((record) => record.kind === "LINE").value.end_x
    ).toBe(77);
  });

  it("preserves unsupported record bytes when a source-spanned supported record is replaced", async () => {
    const { bytes, unsupportedStart } = await fixtureWithUnsupportedBlockRecord();
    const document = await openNativeJww(bytes);
    const record = document.nativeEntities[0];
    const replacement = structuredClone(record.value);
    replacement.end_x = 42;
    const patches = [{ op: "replace", targetId: record.id, record: replacement }];

    expect(document.diagnostics.unsupportedCount).toBe(1);
    expect(document.diagnostics.unsupportedRecords[0]).toMatchObject({
      reason: "invalid-old-class-pid-zero",
      tag: 32768,
      classPid: 0,
    });
    const preflight = preflightNativeJwwSave(document, { patches });
    expect(preflight).toMatchObject({
      ok: true,
      strategy: "record-splice",
      preservesUnsupportedBytes: true,
      willWriteBytes: true,
    });
    const saved = saveNativeJww(document, { patches });
    expect(saved.bytes.length > 0).toBe(true);
    expect(saved.bytes.slice(unsupportedStart)).toEqual(bytes.slice(unsupportedStart));
    expect(parse(saved.bytes).entities[0].value.end_x).toBe(42);
  });

  it("rejects an unsafe unknown-record edit in preflight before byte generation", async () => {
    const { bytes } = await fixtureWithUnsupportedBlockRecord();
    const document = await openNativeJww(bytes);
    const patch = { op: "create", targetId: "new-line", record: line(30).entity };
    const preflight = preflightNativeJwwSave(document, { patches: [patch] });

    expect(preflight).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_LOSSY_SAVE_BLOCKED",
      strategy: "blocked",
      willWriteBytes: false,
    });
    let error = null;
    try {
      saveNativeJww(document, { patches: [patch] });
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).toBe("JWW_NATIVE_LOSSY_SAVE_BLOCKED");
    expect(error?.preflight?.willWriteBytes).toBe(false);
  });

  it("rejects an unsupported create during preflight even when strict false is requested", async () => {
    const document = await openNativeJww(fixture(700));
    const unsupportedPatch = {
      op: "create",
      targetId: "created-unknown",
      record: { unsupported_native_shape: true },
    };
    const unsupported = preflightNativeJwwSave(document, {
      patches: [unsupportedPatch],
    });
    const nonStrict = preflightNativeJwwSave(document, {
      patches: [
        {
          op: "create",
          targetId: "created-line",
          record: structuredClone(document.nativeEntities[0].value),
        },
      ],
      strict: false,
    });

    expect(unsupported).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_UNSUPPORTED_CHANGE",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(unsupported.reasons[0]).toContain("Unsupported JWW write entity types: UNKNOWN");
    expect(nonStrict).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_STRICT_SAVE_REQUIRED",
      strategy: "blocked",
      willWriteBytes: false,
    });

    let unsupportedError = null;
    try {
      saveNativeJww(document, { patches: [unsupportedPatch] });
    } catch (caught) {
      unsupportedError = caught;
    }
    expect(unsupportedError?.code).toBe("JWW_NATIVE_UNSUPPORTED_CHANGE");
    expect(unsupportedError?.preflight?.willWriteBytes).toBe(false);

    let error = null;
    try {
      saveNativeJww(document, { patches: [unsupportedPatch], strict: false });
    } catch (caught) {
      error = caught;
    }
    expect(error?.code).toBe("JWW_NATIVE_STRICT_SAVE_REQUIRED");
    expect(error?.preflight?.willWriteBytes).toBe(false);
  });

  it("rejects missing patch targets during preflight", async () => {
    const document = await openNativeJww(fixture(700));
    const preflight = preflightNativeJwwSave(document, {
      patches: [{ op: "delete", targetId: "missing-record" }],
    });

    expect(preflight).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_PATCH_INVALID",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(preflight.reasons[0]).toContain("target was not found");
  });

  it("rejects a create patch that reuses an existing native record id", async () => {
    const document = await openNativeJww(fixture(700));
    const preflight = preflightNativeJwwSave(document, {
      patches: [
        {
          op: "create",
          targetId: document.nativeEntities[0].id,
          record: structuredClone(document.nativeEntities[0].value),
        },
      ],
    });

    expect(preflight).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_PATCH_INVALID",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(preflight.reasons[0]).toContain("target already exists");
  });

  it("keeps IMAGE rotation permission pending on an already-applied dirty document", async () => {
    const document = await openNativeJww(fullFixture());
    const image = document.nativeEntities.find((record) => record.kind === "IMAGE");
    const dirty = applyNativeJwwPatches(document, [
      createNativeJwwImageRotationPatch(document, image.id, 90),
    ]);
    const preflight = preflightNativeJwwSave(dirty);
    const approved = preflightNativeJwwSave(dirty, {
      allowImageRotation: true,
    });

    expect(preflight).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_IMAGE_ROTATION_PERMISSION_REQUIRED",
      strategy: "blocked",
      willWriteBytes: false,
    });
    expect(approved).toMatchObject({
      ok: true,
      strategy: "record-splice",
      imageRotationApproved: true,
      imageRotationRecordIds: [image.id],
      willWriteBytes: true,
    });
    const saved = saveNativeJww(dirty, { allowImageRotation: true });
    const reopened = await openNativeJww(saved.bytes);
    expect(reopened.nativeEntities.find((record) => record.kind === "IMAGE")?.value)
      .toMatchObject({
        angle: 90,
        raw_content: "^@BM%temp%fixture.bmp,20,10,0,0,1,90",
      });
  });

  it("rebuilds clean native documents after create and delete patches", async () => {
    const source = await openNativeJww(fixture(700));
    const created = saveNativeJww(source, {
      patches: [
        {
          op: "create",
          targetId: "created-line",
          record: {
            base: { pen_style: 1, pen_color: 2, pen_width: 3, layer: 0, layer_group: 0 },
            start_x: 20,
            start_y: 21,
            end_x: 30,
            end_y: 31,
          },
        },
      ],
    });
    const deleted = saveNativeJww(source, {
      patches: [{ op: "delete", targetId: source.nativeEntities[0].id }],
    });

    expect(created.strategy).toBe("rebuild");
    expect(parse(created.bytes).entities.length).toBe(2);
    expect(created.document).toMatchObject({ dirty: false, revision: 1 });
    expect(created.document.originalBytes).toBe(created.bytes);
    expect(created.document.originalSha256).toBe(created.savedSha256);
    expect(created.recordIdMap).toEqual({
      "created-line": "jww:drawing:1",
    });
    expect(created.deletedRecordIds).toEqual([]);
    expect(created.recordIdsChanged).toBe(true);

    const createdSavedId = created.recordIdMap["created-line"];
    const createdRecord = created.document.nativeEntities.find(
      (record) => record.id === createdSavedId
    );
    const createdReplacement = structuredClone(createdRecord.value);
    createdReplacement.end_x = 99;
    const editedCreated = saveNativeJww(created.document, {
      patches: [
        { op: "replace", targetId: createdSavedId, record: createdReplacement },
      ],
    });
    expect(editedCreated.document.revision).toBe(2);
    expect(
      editedCreated.document.nativeEntities.find(
        (record) => record.id === createdSavedId
      ).value.end_x
    ).toBe(99);

    expect(deleted.strategy).toBe("rebuild");
    expect(deleted.document).toMatchObject({ dirty: false, revision: 1 });
    expect(deleted.document.originalBytes).toBe(deleted.bytes);
    expect(deleted.recordIdMap).toEqual({});
    expect(deleted.deletedRecordIds).toEqual([source.nativeEntities[0].id]);
    expect(deleted.recordIdsChanged).toBe(true);
    const deletedDocument = parse(deleted.bytes);
    expect(deletedDocument.version).toBe(700);
    expect(deletedDocument.entities.length).toBe(0);
    expect(deletedDocument.entity_list_complete).toBe(true);
    expect(deletedDocument.block_list_complete).toBe(true);
    expect(deletedDocument.embedded_image_list_complete).toBe(true);
  });

  it("maps surviving source ids that are renumbered by a delete rebuild", async () => {
    const source = await openNativeJww(
      buildJwwBytes({
        version: 700,
        entities: [line(10), line(20), line(30)],
      })
    );
    const [, deletedRecord, shiftedRecord] = source.nativeEntities;
    const saved = saveNativeJww(source, {
      patches: [{ op: "delete", targetId: deletedRecord.id }],
    });

    expect(saved.recordIdMap).toEqual({
      [shiftedRecord.id]: "jww:drawing:1",
    });
    expect(saved.deletedRecordIds).toEqual([deletedRecord.id]);
    expect(saved.recordIdsChanged).toBe(true);
    expect(
      saved.document.nativeEntities.find(
        (record) => record.id === saved.recordIdMap[shiftedRecord.id]
      ).value.end_x
    ).toBe(30);
  });

  it("retains ID transitions when an already-applied dirty document is saved", async () => {
    const source = await openNativeJww(
      buildJwwBytes({
        version: 700,
        entities: [line(10), line(20), line(30)],
      })
    );
    const [, deletedRecord, shiftedRecord] = source.nativeEntities;
    const createdValue = structuredClone(source.nativeEntities[0].value);
    createdValue.start_x = 40;
    createdValue.end_x = 50;
    const dirty = applyNativeJwwPatches(source, [
      { op: "delete", targetId: deletedRecord.id },
      { op: "create", targetId: "dirty-created-line", record: createdValue },
    ]);

    expect(dirty.pendingCreatedRecordIds).toEqual(["dirty-created-line"]);
    expect(dirty.pendingDeletedRecordIds).toEqual([deletedRecord.id]);
    const saved = saveNativeJww(dirty);

    expect(saved.document).toMatchObject({ dirty: false, revision: 1 });
    expect(saved.document.pendingCreatedRecordIds).toBe(undefined);
    expect(saved.document.pendingDeletedRecordIds).toBe(undefined);
    expect(saved.recordIdMap).toEqual({
      [shiftedRecord.id]: "jww:drawing:1",
      "dirty-created-line": "jww:drawing:2",
    });
    expect(saved.deletedRecordIds).toEqual([deletedRecord.id]);
    expect(saved.recordIdsChanged).toBe(true);
    expect(saved.document.nativeEntities[1].value.end_x).toBe(30);
    expect(saved.document.nativeEntities[2].value.end_x).toBe(50);
  });

  it("source-splices stable native print settings and retains a pre-applied edit", async () => {
    const document = await openNativeJww(fixture(700));
    const print = document.settings.print;
    const revisedPrint = {
      ...print,
      origin_x: 14.25,
      origin_y: -3.5,
      scale: 0.8,
      rotation_setting: 81,
    };
    const patches = [{
      op: "replace",
      targetId: print.id,
      record: revisedPrint,
    }];
    const dirty = applyNativeJwwPatches(document, patches);
    const preflight = preflightNativeJwwSave(dirty);
    const saved = saveNativeJww(dirty);
    const reopened = await openNativeJww(saved.bytes);

    expect(print).toMatchObject({
      id: "jww:print-settings",
      sourceSpan: { byteLength: 28 },
    });
    expect(dirty.pendingPrefixMetadataTargetIds).toContain(print.id);
    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      preservesUnsupportedBytes: true,
      willWriteBytes: true,
    });
    expect(reopened.settings.print).toMatchObject({
      origin_x: 14.25,
      origin_y: -3.5,
      scale: 0.8,
      rotation_setting: 81,
    });
    expect(saved.bytes.slice(0, print.sourceSpan.start)).toEqual(
      document.originalBytes.slice(0, print.sourceSpan.start)
    );
    expect(saved.bytes.slice(print.sourceSpan.end)).toEqual(
      document.originalBytes.slice(print.sourceSpan.end)
    );
  });

  it("source-splices stable native dimension settings and retains signed width metadata", async () => {
    const document = await openNativeJww(fixture(700));
    const dimension = document.settings.dimension;
    const patches = [{
      op: "replace",
      targetId: dimension.id,
      record: {
        ...dimension,
        sunpou1: dimension.sunpou1 + 1,
        sunpou2: 1025,
      },
    }];
    const dirty = applyNativeJwwPatches(document, patches);
    const preflight = preflightNativeJwwSave(dirty);
    const saved = saveNativeJww(dirty);
    const reopened = await openNativeJww(saved.bytes);

    expect(dimension).toMatchObject({
      id: "jww:dimension-settings",
      max_line_width: -300,
      sourceSpan: { byteLength: 84 },
    });
    expect(dirty.pendingPrefixMetadataTargetIds).toContain(dimension.id);
    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      preservesUnsupportedBytes: true,
      willWriteBytes: true,
    });
    expect(reopened.settings.dimension).toMatchObject({
      sunpou1: dimension.sunpou1 + 1,
      sunpou2: 1025,
      dummy: dimension.dummy,
      max_line_width: -300,
    });
    expect(saved.bytes.slice(0, dimension.sourceSpan.start)).toEqual(
      document.originalBytes.slice(0, dimension.sourceSpan.start)
    );
    expect(saved.bytes.slice(dimension.sourceSpan.end)).toEqual(
      document.originalBytes.slice(dimension.sourceSpan.end)
    );
  });

  it("source-splices stable native grid settings and retains signed mode", async () => {
    const document = await openNativeJww(fixture(700));
    const grid = document.settings.grid;
    const patches = [{
      op: "replace",
      targetId: grid.id,
      record: {
        ...grid,
        mode: -11,
        minimum_display_spacing: 12,
        spacing_x: 250,
        spacing_y: 500,
        base_x: 1.25,
        base_y: -2.5,
      },
    }];
    const dirty = applyNativeJwwPatches(document, patches);
    const preflight = preflightNativeJwwSave(dirty);
    const saved = saveNativeJww(dirty);
    const reopened = await openNativeJww(saved.bytes);

    expect(grid).toMatchObject({
      id: "jww:grid-settings",
      sourceSpan: { byteLength: 44 },
    });
    expect(dirty.pendingPrefixMetadataTargetIds).toContain(grid.id);
    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      preservesUnsupportedBytes: true,
      willWriteBytes: true,
    });
    expect(reopened.settings.grid).toMatchObject({
      mode: -11,
      minimum_display_spacing: 12,
      spacing_x: 250,
      spacing_y: 500,
      base_x: 1.25,
      base_y: -2.5,
    });
    expect(saved.bytes.slice(0, grid.sourceSpan.start)).toEqual(
      document.originalBytes.slice(0, grid.sourceSpan.start)
    );
    expect(saved.bytes.slice(grid.sourceSpan.end)).toEqual(
      document.originalBytes.slice(grid.sourceSpan.end)
    );
  });

  it("source-splices only the verified official native color tables", async () => {
    const document = await openNativeJww(officialColorFixture());
    const color = document.settings.color;
    const patches = [{
      op: "replace",
      targetId: color.id,
      record: {
        ...color,
        screenColors: {
          ...color.screenColors,
          1: {
            ...color.screenColors[1],
            red: 18,
            green: 52,
            blue: 86,
            width: 4,
            hex: "#123456",
          },
        },
        printColors: {
          ...color.printColors,
          1: {
            ...color.printColors[1],
            red: 101,
            green: 67,
            blue: 33,
            width: 25,
            pointRadius: 0.7,
            hex: "#654321",
          },
        },
      },
    }];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);

    expect(color).toMatchObject({
      id: "jww:color-settings",
      sourceLayout: "jwdatafmt-color-tables-v600-v700",
      sourceSpan: { byteLength: 240 },
    });
    expect(color.screenColors[10]).toBe(undefined);
    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      preservesUnsupportedBytes: true,
      prefixMetadataTargetIds: ["jww:color-settings"],
    });
    expect(reopened.settings.color.screenColors[1]).toMatchObject({
      hex: "#123456",
      width: 4,
    });
    expect(reopened.settings.color.printColors[1]).toMatchObject({
      hex: "#654321",
      width: 25,
      pointRadius: 0.7,
    });
    expect(saved.bytes.length).toBe(document.originalBytes.length);
    expect(saved.bytes.slice(0, color.sourceSpan.start)).toEqual(
      document.originalBytes.slice(0, color.sourceSpan.start)
    );
    expect(saved.bytes.slice(color.sourceSpan.end)).toEqual(
      document.originalBytes.slice(color.sourceSpan.end)
    );
  });

  it("rejects invalid native color values before writing", async () => {
    const document = await openNativeJww(officialColorFixture());
    const color = document.settings.color;
    const preflight = preflightNativeJwwSave(document, {
      patches: [{
        op: "replace",
        targetId: color.id,
        record: {
          ...color,
          screenColors: {
            ...color.screenColors,
            1: { ...color.screenColors[1], width: 17 },
          },
        },
      }],
    });

    expect(preflight).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_PATCH_INVALID",
      willWriteBytes: false,
    });
    expect(preflight.reasons[0]).toContain("1 to 16");
  });

  it("source-splices only the verified official native line type table", async () => {
    const document = await openNativeJww(officialColorFixture());
    const lineType = document.settings.lineType;
    const revised = encodeJwwLineTypeSettings(lineType, {
      lineTypeRows: {
        LTYPE_02: {
          pattern: "aaaaaaaa",
          unitDotCount: 8,
          screenPitch: 2,
          printPitch: 10,
        },
        LTYPE_R1: {
          screenAmplitude: 2,
          screenPitch: 4,
          printAmplitude: 3,
          printPitch: 20,
        },
      },
    });
    const patches = [{
      op: "replace",
      targetId: lineType.id,
      record: revised,
    }];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);

    expect(lineType).toMatchObject({
      id: "jww:line-type-settings",
      sourceLayout: "jwdatafmt-line-type-tables-v600-v700",
      sourceSpan: { byteLength: 292 },
    });
    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      preservesUnsupportedBytes: true,
      prefixMetadataTargetIds: ["jww:line-type-settings"],
    });
    expect(reopened.settings.lineType.rows.LTYPE_02).toMatchObject({
      pattern: "aaaaaaaa",
      unitDotCount: 8,
      screenPitch: 2,
      printPitch: 10,
    });
    expect(reopened.settings.lineType.rows.LTYPE_R1).toMatchObject({
      screenAmplitude: 2,
      screenPitch: 4,
      printAmplitude: 3,
      printPitch: 20,
    });
    expect(saved.bytes.slice(0, lineType.sourceSpan.start)).toEqual(
      document.originalBytes.slice(0, lineType.sourceSpan.start)
    );
    expect(saved.bytes.slice(lineType.sourceSpan.end)).toEqual(
      document.originalBytes.slice(lineType.sourceSpan.end)
    );
  });

  it("preserves edited color and line type tables during a structural rebuild", async () => {
    const document = await openNativeJww(officialColorFixture());
    const color = encodeJwwColorSettings(document.settings.color, {
      screenColors: { 2: "#abcdef" },
    });
    const lineType = encodeJwwLineTypeSettings(document.settings.lineType, {
      lineTypeRows: { LTYPE_L1: { unitDotCount: 16, screenPitch: 8, printPitch: 80 } },
    });
    const patches = [
      { op: "replace", targetId: color.id, record: color },
      { op: "replace", targetId: lineType.id, record: lineType },
      {
        op: "create",
        targetId: "created-for-color-line-type-rebuild",
        record: {
          base: {
            pen_style: 2,
            pen_color: 2,
            pen_width: 1,
            layer: 0,
            layer_group: 0,
          },
          start_x: 1,
          start_y: 2,
          end_x: 3,
          end_y: 4,
        },
      },
    ];
    const preflight = preflightNativeJwwSave(document, { patches });
    const saved = saveNativeJww(document, { patches });
    const reopened = await openNativeJww(saved.bytes);

    expect(preflight).toMatchObject({ ok: true, strategy: "rebuild" });
    expect(reopened.settings.color.screenColors[2].hex).toBe("#abcdef");
    expect(reopened.settings.lineType.rows.LTYPE_L1).toMatchObject({
      unitDotCount: 16,
      screenPitch: 8,
      printPitch: 80,
    });
    expect(reopened.nativeEntities.length).toBe(document.nativeEntities.length + 1);
  });

  it("rejects invalid native line type values before writing", async () => {
    const document = await openNativeJww(officialColorFixture());
    const lineType = document.settings.lineType;
    const invalidRow = {
      ...lineType.rows.LTYPE_02,
      unitDotCount: 33,
      params: [33, lineType.rows.LTYPE_02.screenPitch, lineType.rows.LTYPE_02.printPitch],
      values: [
        lineType.rows.LTYPE_02.pattern,
        33,
        lineType.rows.LTYPE_02.screenPitch,
        lineType.rows.LTYPE_02.printPitch,
      ],
    };
    const preflight = preflightNativeJwwSave(document, {
      patches: [{
        op: "replace",
        targetId: lineType.id,
        record: {
          ...lineType,
          rows: { ...lineType.rows, LTYPE_02: invalidRow },
        },
      }],
    });

    expect(preflight).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_PATCH_INVALID",
      willWriteBytes: false,
    });
    expect(preflight.reasons[0]).toContain("1 to 32");
  });
});
