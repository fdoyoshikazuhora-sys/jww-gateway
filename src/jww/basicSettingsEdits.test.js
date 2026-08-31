import { openNativeJww } from "./native.js";
import { buildJwwBytes } from "./writer.js";
import {
  buildJwwBasicSettingsPatches,
  preflightJwwBasicSettingsSave,
  saveJwwBasicSettings,
} from "./basicSettingsEdits.js";

const fixture = () =>
  buildJwwBytes({
    version: 700,
    paperSize: 2,
    layerGroupScales: { 0: 100, 10: 60 },
    entities: [
      {
        type: "LINE",
        entity: {
          type: "LINE",
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
          jww: {
            group: 0,
            layerGroup: 0,
            layer: 0,
            penColor: 2,
            penStyle: 1,
            penWidth: 1,
            flag: 0,
          },
        },
      },
    ],
  });

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

describe("JWW Basic Settings native edits", () => {
  it("returns no patches when editable values are unchanged", async () => {
    const document = await openNativeJww(fixture());
    const patches = buildJwwBasicSettingsPatches(document, {
      paperSize: document.header.paperSize,
      writeLayerGroup: document.header.writeLayerGroup,
      layerGroupScales: { 0: document.layerGroups[0].scale },
      layerGroupWriteLayers: { 0: document.layerGroups[0].write_layer },
      layerGroupProtections: { 1: document.layerGroups[1].protect },
      layerProtections: { "0.1": document.layerGroups[0].layers[1].protect },
    });

    expect(patches).toEqual([]);
    expect(preflightJwwBasicSettingsSave(document, {})).toMatchObject({
      ok: true,
      strategy: "byte-identical",
      patchCount: 0,
    });
  });

  it("builds one native replacement per edited layer group", async () => {
    const document = await openNativeJww(fixture());
    const patches = buildJwwBasicSettingsPatches(document, {
      paperSize: 3,
      writeLayerGroup: 10,
      layerGroupScales: { 0: 50, 10: 30 },
      layerGroupWriteLayers: { 0: 6, 10: 3 },
    });

    expect(patches.map((patch) => patch.targetId)).toEqual([
      "jww:header",
      "jww:layer-group:0",
      "jww:layer-group:10",
    ]);
    expect(preflightJwwBasicSettingsSave(document, {
      paperSize: 3,
      writeLayerGroup: 10,
      layerGroupScales: { 0: 50, 10: 30 },
      layerGroupWriteLayers: { 0: 6, 10: 3 },
    })).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      patchCount: 3,
      preservesUnsupportedBytes: true,
    });
  });

  it("saves and reparses the whitelisted metadata without changing records", async () => {
    const document = await openNativeJww(fixture());
    const saved = saveJwwBasicSettings(document, {
      paperSize: 3,
      writeLayerGroup: 10,
      layerGroupScales: { 0: 50, 10: 30 },
      layerGroupWriteLayers: { 0: 6, 10: 3 },
    });
    const reopened = await openNativeJww(saved.bytes);

    expect(saved.bytes.length).toBeGreaterThan(0);
    expect(saved.strategy).toBe("prefix-splice");
    expect(reopened.header).toMatchObject({ paperSize: 3, writeLayerGroup: 10 });
    expect(reopened.layerGroups[document.header.writeLayerGroup].state).toBe(2);
    expect(reopened.layerGroups[10].state).toBe(3);
    expect(reopened.layerGroups[0].scale).toBe(50);
    expect(reopened.layerGroups[10].scale).toBe(30);
    expect(reopened.layerGroups[0].write_layer).toBe(6);
    expect(reopened.layerGroups[0].layers[0].state).toBe(2);
    expect(reopened.layerGroups[0].layers[6].state).toBe(3);
    expect(reopened.layerGroups[10].write_layer).toBe(3);
    expect(reopened.layerGroups[10].layers[0].state).toBe(2);
    expect(reopened.layerGroups[10].layers[3].state).toBe(3);
    expect(reopened.nativeEntities.length).toBe(document.nativeEntities.length);
  });

  it("edits and reparses a variable-length memo by prefix splice", async () => {
    const document = await openNativeJww(fixture());
    const prefixEnd = document.preservedRegions.prefix.end;
    const memo = "MEP Draft memo\r\n日本語";
    const preflight = preflightJwwBasicSettingsSave(document, { memo });
    const saved = saveJwwBasicSettings(document, { memo });
    const reopened = await openNativeJww(saved.bytes);

    expect(preflight).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      patchCount: 1,
      preservesUnsupportedBytes: true,
    });
    expect(reopened.header.memo).toBe(memo);
    expect(reopened.nativeEntities.map((record) => record.value)).toEqual(
      document.nativeEntities.map((record) => record.value)
    );
    expect(saved.bytes.slice(reopened.preservedRegions.prefix.end)).toEqual(
      document.originalBytes.slice(prefixEnd)
    );
  });

  it("edits official non-current group and layer state codes by prefix splice", async () => {
    const document = await openNativeJww(fixture());
    const prefixEnd = document.preservedRegions.prefix.end;
    const saved = saveJwwBasicSettings(document, {
      layerGroupStates: { 1: 1, 2: 2 },
      layerStates: { "0.1": 1, "0.2": 2 },
    });
    const reopened = await openNativeJww(saved.bytes);

    expect(saved.strategy).toBe("prefix-splice");
    expect(reopened.layerGroups[1].state).toBe(1);
    expect(reopened.layerGroups[2].state).toBe(2);
    expect(reopened.layerGroups[0].layers[1].state).toBe(1);
    expect(reopened.layerGroups[0].layers[2].state).toBe(2);
    expect(saved.bytes.slice(prefixEnd)).toEqual(document.originalBytes.slice(prefixEnd));
  });

  it("edits official non-current protection codes 1 and 2 by prefix splice", async () => {
    const document = await openNativeJww(fixture());
    const prefixEnd = document.preservedRegions.prefix.end;
    const saved = saveJwwBasicSettings(document, {
      layerGroupProtections: { 1: 1, 2: 2 },
      layerProtections: { "0.1": 1, "0.2": 2 },
    });
    const reopened = await openNativeJww(saved.bytes);

    expect(saved.strategy).toBe("prefix-splice");
    expect(reopened.layerGroups[1].protect).toBe(1);
    expect(reopened.layerGroups[2].protect).toBe(2);
    expect(reopened.layerGroups[0].layers[1].protect).toBe(1);
    expect(reopened.layerGroups[0].layers[2].protect).toBe(2);
    expect(saved.bytes.slice(prefixEnd)).toEqual(document.originalBytes.slice(prefixEnd));
  });

  it("enforces protection 1 as state-editable and protection 2 as state-fixed", async () => {
    const protectedOne = await openNativeJww(
      withLayerProtection(withLayerGroupProtection(fixture(), 1, 1), 0, 1, 1)
    );
    const saved = saveJwwBasicSettings(protectedOne, {
      layerGroupStates: { 1: 1 },
      layerStates: { "0.1": 1 },
    });
    const reopened = await openNativeJww(saved.bytes);
    expect(reopened.layerGroups[1]).toMatchObject({ state: 1, protect: 1 });
    expect(reopened.layerGroups[0].layers[1]).toMatchObject({
      state: 1,
      protect: 1,
    });

    expect(preflightJwwBasicSettingsSave(protectedOne, {
      layerGroupProtections: { 1: 2 },
      layerGroupStates: { 1: 1 },
    })).toMatchObject({ ok: false, willWriteBytes: false });
    expect(preflightJwwBasicSettingsSave(protectedOne, {
      layerProtections: { "0.1": 2 },
      layerStates: { "0.1": 1 },
    })).toMatchObject({ ok: false, willWriteBytes: false });
  });

  it("allows protection 2 to be cleared before changing the same row state", async () => {
    const protectedTwo = await openNativeJww(
      withLayerProtection(withLayerGroupProtection(fixture(), 1, 2), 0, 1, 2)
    );
    const saved = saveJwwBasicSettings(protectedTwo, {
      layerGroupProtections: { 1: 0 },
      layerGroupStates: { 1: 1 },
      layerProtections: { "0.1": 0 },
      layerStates: { "0.1": 1 },
    });
    const reopened = await openNativeJww(saved.bytes);

    expect(reopened.layerGroups[1]).toMatchObject({ state: 1, protect: 0 });
    expect(reopened.layerGroups[0].layers[1]).toMatchObject({
      state: 1,
      protect: 0,
    });
  });

  it("saves Jw_cad-proven current-row protection edits by prefix splice", async () => {
    const document = await openNativeJww(fixture());
    const currentGroup = document.header.writeLayerGroup;
    const currentLayer = document.layerGroups[currentGroup].write_layer;
    const prefixEnd = document.preservedRegions.prefix.end;
    const edits = {
      layerGroupProtections: { [currentGroup]: 1 },
      layerProtections: { [`${currentGroup}.${currentLayer}`]: 2 },
    };

    expect(preflightJwwBasicSettingsSave(document, edits)).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      willWriteBytes: true,
    });
    const saved = saveJwwBasicSettings(document, edits);
    const reopened = await openNativeJww(saved.bytes);

    expect(reopened.layerGroups[currentGroup]).toMatchObject({ state: 3, protect: 1 });
    expect(reopened.layerGroups[currentGroup].layers[currentLayer]).toMatchObject({
      state: 3,
      protect: 2,
    });
    expect(saved.bytes.slice(prefixEnd)).toEqual(document.originalBytes.slice(prefixEnd));
  });

  it("rejects invalid protection edits before save", async () => {
    const document = await openNativeJww(fixture());

    expect(preflightJwwBasicSettingsSave(document, {
      layerGroupProtections: { 1: 3 },
    })).toMatchObject({ ok: false, willWriteBytes: false });
  });

  it("rejects state edits for current and display-fixed rows", async () => {
    const document = await openNativeJww(fixture());
    const currentGroup = document.header.writeLayerGroup;
    const currentLayer = document.layerGroups[0].write_layer;

    expect(preflightJwwBasicSettingsSave(document, {
      layerGroupStates: { [currentGroup]: 2 },
    })).toMatchObject({ ok: false, willWriteBytes: false });
    expect(preflightJwwBasicSettingsSave(document, {
      layerStates: { [`0.${currentLayer}`]: 2 },
    })).toMatchObject({ ok: false, willWriteBytes: false });

    document.layerGroups[1].protect = 2;
    document.layerGroups[0].layers[1].protect = 2;
    expect(preflightJwwBasicSettingsSave(document, {
      layerGroupStates: { 1: 1 },
    })).toMatchObject({ ok: false, willWriteBytes: false });
    expect(preflightJwwBasicSettingsSave(document, {
      layerStates: { "0.1": 1 },
    })).toMatchObject({ ok: false, willWriteBytes: false });
  });

  it("rejects unsupported fields and invalid native metadata before save", async () => {
    const document = await openNativeJww(fixture());

    expect(preflightJwwBasicSettingsSave(document, { lineTypes: {} })).toMatchObject({
      ok: false,
      code: "JWW_BASIC_SETTINGS_EDIT_UNSUPPORTED",
      willWriteBytes: false,
    });
    expect(preflightJwwBasicSettingsSave(document, { paperSize: 7 })).toMatchObject({
      ok: false,
      code: "JWW_BASIC_SETTINGS_EDIT_INVALID",
      willWriteBytes: false,
    });
    expect(preflightJwwBasicSettingsSave(document, {
      layerGroupScales: { 0: 0 },
    })).toMatchObject({
      ok: false,
      code: "JWW_BASIC_SETTINGS_EDIT_INVALID",
      willWriteBytes: false,
    });
    expect(preflightJwwBasicSettingsSave(document, {
      layerGroupWriteLayers: { 0: 16 },
    })).toMatchObject({
      ok: false,
      code: "JWW_BASIC_SETTINGS_EDIT_INVALID",
      willWriteBytes: false,
    });
  });

  it("rejects a protected layer before native save", async () => {
    const document = await openNativeJww(fixture());
    document.layerGroups[0].layers[6].protect = 2;

    expect(preflightJwwBasicSettingsSave(document, {
      layerGroupWriteLayers: { 0: 6 },
    })).toMatchObject({
      ok: false,
      code: "JWW_BASIC_SETTINGS_EDIT_INVALID",
      willWriteBytes: false,
    });
  });

  it("rejects protected write-group transitions", async () => {
    const protectedDocument = await openNativeJww(fixture());
    protectedDocument.layerGroups[10].protect = 1;
    expect(preflightJwwBasicSettingsSave(protectedDocument, {
      writeLayerGroup: 10,
    })).toMatchObject({
      ok: false,
      code: "JWW_NATIVE_METADATA_PATCH_INVALID",
      willWriteBytes: false,
    });
  });

  it("allows the Jw_cad-proven hidden write-group transition", async () => {
    const hiddenDocument = await openNativeJww(withLayerGroupState(fixture(), 10, 0));
    const previousWriteLayerGroup = hiddenDocument.header.writeLayerGroup;
    const prefixEnd = hiddenDocument.preservedRegions.prefix.end;

    expect(hiddenDocument.layerGroups[10].state).toBe(0);
    expect(preflightJwwBasicSettingsSave(hiddenDocument, {
      writeLayerGroup: 10,
    })).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      willWriteBytes: true,
    });
    const saved = saveJwwBasicSettings(hiddenDocument, { writeLayerGroup: 10 });
    const reopened = await openNativeJww(saved.bytes);

    expect(reopened.header.writeLayerGroup).toBe(10);
    expect(reopened.layerGroups[previousWriteLayerGroup].state).toBe(2);
    expect(reopened.layerGroups[10].state).toBe(3);
    expect(saved.bytes.slice(prefixEnd)).toEqual(hiddenDocument.originalBytes.slice(prefixEnd));
  });

  it("moves away from a protected current group and retains its protection", async () => {
    const sourceDocument = await openNativeJww(fixture());
    const previousWriteLayerGroup = sourceDocument.header.writeLayerGroup;
    const protectedDocument = await openNativeJww(
      withLayerGroupProtection(fixture(), previousWriteLayerGroup, 2)
    );
    const targetWriteLayerGroup = previousWriteLayerGroup === 10 ? 9 : 10;
    const prefixEnd = protectedDocument.preservedRegions.prefix.end;

    expect(preflightJwwBasicSettingsSave(protectedDocument, {
      writeLayerGroup: targetWriteLayerGroup,
    })).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      willWriteBytes: true,
    });
    const saved = saveJwwBasicSettings(protectedDocument, {
      writeLayerGroup: targetWriteLayerGroup,
    });
    const reopened = await openNativeJww(saved.bytes);

    expect(reopened.layerGroups[previousWriteLayerGroup]).toMatchObject({
      state: 2,
      protect: 2,
    });
    expect(reopened.layerGroups[targetWriteLayerGroup]).toMatchObject({
      state: 3,
      protect: 0,
    });
    expect(saved.bytes.slice(prefixEnd)).toEqual(
      protectedDocument.originalBytes.slice(prefixEnd)
    );
  });

  it("moves away from a protected current layer and retains its protection", async () => {
    const sourceDocument = await openNativeJww(fixture());
    const groupIndex = sourceDocument.header.writeLayerGroup;
    const previousWriteLayer = sourceDocument.layerGroups[groupIndex].write_layer;
    const targetWriteLayer = previousWriteLayer === 7 ? 6 : 7;
    const protectedDocument = await openNativeJww(
      withLayerProtection(fixture(), groupIndex, previousWriteLayer, 2)
    );
    const prefixEnd = protectedDocument.preservedRegions.prefix.end;

    expect(preflightJwwBasicSettingsSave(protectedDocument, {
      layerGroupWriteLayers: { [groupIndex]: targetWriteLayer },
    })).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      willWriteBytes: true,
    });
    const saved = saveJwwBasicSettings(protectedDocument, {
      layerGroupWriteLayers: { [groupIndex]: targetWriteLayer },
    });
    const reopened = await openNativeJww(saved.bytes);

    expect(reopened.layerGroups[groupIndex].layers[previousWriteLayer]).toMatchObject({
      state: 2,
      protect: 2,
    });
    expect(reopened.layerGroups[groupIndex].layers[targetWriteLayer]).toMatchObject({
      state: 3,
      protect: 0,
    });
    expect(saved.bytes.slice(prefixEnd)).toEqual(
      protectedDocument.originalBytes.slice(prefixEnd)
    );
  });

  for (const initialState of [0, 1]) {
    it(`allows a Jw_cad-proven state ${initialState} current-layer transition`, async () => {
      const document = await openNativeJww(withLayerState(fixture(), 0, 7, initialState));
      const previousWriteLayer = document.layerGroups[0].write_layer;
      const prefixEnd = document.preservedRegions.prefix.end;

      expect(preflightJwwBasicSettingsSave(document, {
        layerGroupWriteLayers: { 0: 7 },
      })).toMatchObject({
        ok: true,
        strategy: "prefix-splice",
        willWriteBytes: true,
      });
      const saved = saveJwwBasicSettings(document, {
        layerGroupWriteLayers: { 0: 7 },
      });
      const reopened = await openNativeJww(saved.bytes);

      expect(reopened.layerGroups[0].write_layer).toBe(7);
      expect(reopened.layerGroups[0].layers[previousWriteLayer].state).toBe(2);
      expect(reopened.layerGroups[0].layers[7].state).toBe(3);
      expect(saved.bytes.slice(prefixEnd)).toEqual(document.originalBytes.slice(prefixEnd));
    });
  }

  it("rejects an unverified Basic Settings current-layer state", async () => {
    const document = await openNativeJww(withLayerState(fixture(), 0, 7, 4));

    expect(preflightJwwBasicSettingsSave(document, {
      layerGroupWriteLayers: { 0: 7 },
    })).toMatchObject({
      ok: false,
      code: "JWW_BASIC_SETTINGS_EDIT_INVALID",
      willWriteBytes: false,
    });
  });

  it("edits and reparses the official print placement fields", async () => {
    const document = await openNativeJww(fixture());
    const prefixEnd = document.preservedRegions.prefix.end;
    const edits = {
      printOriginX: 25.5,
      printOriginY: -10.25,
      printScale: 0.5,
      printRotationSetting: 71,
    };

    expect(preflightJwwBasicSettingsSave(document, edits)).toMatchObject({
      ok: true,
      strategy: "prefix-splice",
      patchCount: 1,
      preservesUnsupportedBytes: true,
      willWriteBytes: true,
    });
    const saved = saveJwwBasicSettings(document, edits);
    const reopened = await openNativeJww(saved.bytes);

    expect(reopened.settings.print).toMatchObject({
      id: "jww:print-settings",
      origin_x: 25.5,
      origin_y: -10.25,
      scale: 0.5,
      rotation_setting: 71,
      sourceSpan: { byteLength: 28 },
    });
    expect(saved.bytes.slice(prefixEnd)).toEqual(
      document.originalBytes.slice(prefixEnd)
    );
  });

  it("rejects invalid print scale and rotation/reference codes before writing", async () => {
    const document = await openNativeJww(fixture());
    for (const edits of [
      { printScale: 0 },
      { printOriginX: Number.NaN },
      { printRotationSetting: 92 },
    ]) {
      expect(preflightJwwBasicSettingsSave(document, edits)).toMatchObject({
        ok: false,
        code: "JWW_BASIC_SETTINGS_EDIT_INVALID",
        willWriteBytes: false,
      });
    }
  });
});
