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

describe("JWW Basic Settings native edits", () => {
  it("returns no patches when editable values are unchanged", async () => {
    const document = await openNativeJww(fixture());
    const patches = buildJwwBasicSettingsPatches(document, {
      paperSize: document.header.paperSize,
      writeLayerGroup: document.header.writeLayerGroup,
      layerGroupScales: { 0: document.layerGroups[0].scale },
      layerGroupWriteLayers: { 0: document.layerGroups[0].write_layer },
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

  it("rejects unproven fields and invalid native metadata before save", async () => {
    const document = await openNativeJww(fixture());

    expect(preflightJwwBasicSettingsSave(document, { memo: "not allowed" })).toMatchObject({
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
});
