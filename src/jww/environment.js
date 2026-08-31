import { jwwKey } from "./shared.js";
import { JWF_ONLY_OPERATION_KEYS } from "./jwf.js";

const JWF_KEYS = [
  "S_COMM_0",
  "S_COMM_1",
  "S_COMM_2",
  "S_COMM_3",
  "S_COMM_4",
  "S_COMM_5",
  "S_COMM_6",
  "S_COMM_7",
  "S_COMM_8",
  "S_COMM_9",
  "R_STR0_00",
  "R_CROSS_SET",
  "S_MESH_0",
  "ZOOM",
  "LAYSCALE",
  "LTYPE_02",
  "LTYPE_03",
  "LTYPE_04",
  "LTYPE_05",
  "LTYPE_06",
  "LTYPE_07",
  "LTYPE_08",
  "LTYPE_09",
  "LTYPE_R1",
  "LTYPE_R2",
  "LTYPE_R3",
  "LTYPE_R4",
  "LTYPE_R5",
  "LTYPE_L1",
  "LTYPE_L2",
  "LTYPE_L3",
  "LTYPE_L4",
  "LTYPE_HC",
  "LCOLLOR_1",
  "LCOLLOR_2",
  "LCOLLOR_3",
  "LCOLLOR_4",
  "LCOLLOR_5",
  "LCOLLOR_6",
  "LCOLLOR_7",
  "LCOLLOR_8",
  "LCOLLOR_G",
  "LCOLLOR_H",
  "LCOLLOR_S",
  "LCOLLOR_K",
  "LCOLLOR_B",
  "LCOLLOR_Z",
  "LCOLLOR_M",
  "PCOLLOR_1",
  "PCOLLOR_2",
  "PCOLLOR_3",
  "PCOLLOR_4",
  "PCOLLOR_5",
  "PCOLLOR_6",
  "PCOLLOR_7",
  "PCOLLOR_8",
  "PCOLLOR_G",
  "MSET",
  "MHEN",
  "MWIDE",
  "MHIGH",
  "MDIST",
  "MPEN",
  "MOFST",
  "S_STR1",
  "S_STR2",
  "S_STR3",
  "S_SET1",
  "S_SET2",
  "S_SET3",
  "S_SET4",
  "S_SET5",
  "ZF_SET",
  "SL_SET",
  "CU_SET",
  "MS_SET",
  "HATCH_0",
  "HATCH_1",
  "HATCH_2",
  "HATCH_3",
  "HATCH_4",
  "HATCH_5",
  "LAYNAM_N",
  ...Array.from({ length: 16 }, (_, index) => `LAYNAM_${jwwKey(index)}`),
  ...Array.from({ length: 16 }, (_, index) => `LAYCOL_${jwwKey(index)}`),
  ...Array.from({ length: 16 }, (_, index) => `LAYWID_${jwwKey(index)}`),
  ...Array.from({ length: 16 }, (_, index) => `LAYTYP_${jwwKey(index)}`),
  "COM_LAY00",
  "COM_LAY01",
  "COM_LAY11",
  "COM_LAY21",
  "COM_LAY31",
  "COM_LAY41",
  "LD_AM",
  "LD_PM",
  "RD_AM",
  "RD_PM",
  "LD2_AM",
  "LD2_PM",
  "RD2_AM",
  "RD2_PM",
  "GCOM_100",
  "GCOM_110",
  "GCOM_120",
  "GCOM_130",
  "GCOM_140",
  "GCOM_150",
  "GCOM_160",
  "GCOM_170",
  "GCOM_180",
  "GCOM_190",
  "WD_COM",
  "AC_COM",
  "N_KEY",
  "KEY_A",
  "KEY_B",
  "KEY_C",
  "KEY_D",
  "KEY_E",
  "KEY_F",
  "KEY_G",
  "KEY_H",
  "KEY_I",
  "KEY_J",
  "KEY_K",
  "KEY_L",
  "KEY_M",
  "KEY_N",
  "KEY_O",
  "KEY_P",
  "KEY_Q",
  "KEY_R",
  "KEY_S",
  "KEY_T",
  "KEY_U",
  "KEY_V",
  "KEY_W",
  "KEY_X",
  "KEY_Y",
  "KEY_Z",
  "KEYF2",
  "KEYF3",
  "KEYF4",
  "KEYF5",
  "KEYF6",
  "KEYF7",
  "KEYF8",
  "KEYF9",
  "KEYSP",
  "KEY76",
];

function colorEntry(entry = null) {
  if (!entry) return null;
  return {
    red: Number(entry.red) || 0,
    green: Number(entry.green) || 0,
    blue: Number(entry.blue) || 0,
    width: Number(entry.width) || 0,
    ...(entry.hex ? { hex: entry.hex } : {}),
    ...(entry.pointRadius !== undefined
      ? { pointRadius: Number(entry.pointRadius) || 0 }
      : {}),
    ...(entry.source ? { source: entry.source } : {}),
    ...(entry.raw !== undefined ? { raw: entry.raw } : {}),
  };
}

function colorTable(prefix, colors = {}, count = 8) {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => {
      const colorNumber = index + 1;
      return [`${prefix}_${colorNumber}`, colorEntry(colors[colorNumber])];
    }).filter(([, entry]) => entry)
  );
}

function layerNameRows(layerGroups = []) {
  const rows = {};
  for (let groupIndex = 0; groupIndex < 16; groupIndex += 1) {
    const group = layerGroups[groupIndex] || {};
    rows[`LAYNAM_${jwwKey(groupIndex)}`] = [
      group.name || "",
      ...Array.from({ length: 16 }, (_, layerIndex) =>
        String(group.layers?.[layerIndex]?.name || "")
      ),
    ];
  }
  return rows;
}

function layerStateRows(layerGroups = []) {
  return Object.fromEntries(
    Array.from({ length: 16 }, (_, groupIndex) => {
      const group = layerGroups[groupIndex] || {};
      return [
        jwwKey(groupIndex),
        {
          state: Number(group.state) || 0,
          writeLayer: Number(group.write_layer) || 0,
          scale: Number(group.scale) || 0,
          protect: Number(group.protect) || 0,
          name: group.name || "",
          layers: Object.fromEntries(
            Array.from({ length: 16 }, (_, layerIndex) => {
              const layer = group.layers?.[layerIndex] || {};
              return [
                jwwKey(layerIndex),
                {
                  state: Number(layer.state) || 0,
                  protect: Number(layer.protect) || 0,
                  name: layer.name || "",
                },
              ];
            })
          ),
        },
      ];
    })
  );
}

function supportedKeySet(doc = {}) {
  const colorSettings = doc.color_settings || {};
  const lineTypeRows = doc.line_type_settings?.rows || {};
  const supported = new Set(["LAYSCALE"]);
  if (doc.layer_names_extracted !== false) {
    supported.add("LAYNAM_N");
    for (let index = 0; index < 16; index += 1) {
      supported.add(`LAYNAM_${jwwKey(index)}`);
    }
  }

  for (let index = 1; index <= 8; index += 1) {
    if (colorSettings.screenColors?.[index]) supported.add(`LCOLLOR_${index}`);
    if (colorSettings.printColors?.[index]) supported.add(`PCOLLOR_${index}`);
  }
  if (colorSettings.backgroundColor) supported.add("LCOLLOR_B");
  if (colorSettings.screenColors?.[9]) supported.add("LCOLLOR_G");
  if (colorSettings.screenColors?.[10]) supported.add("LCOLLOR_H");
  if (colorSettings.specialColors?.S) supported.add("LCOLLOR_S");
  if (colorSettings.specialColors?.K) supported.add("LCOLLOR_K");
  if (colorSettings.specialColors?.Z) supported.add("LCOLLOR_Z");
  if (colorSettings.printColors?.[9]) supported.add("PCOLLOR_G");
  for (const key of Object.keys(lineTypeRows)) {
    supported.add(key);
  }

  return supported;
}

export function buildJwwEnvironment(doc = {}) {
  const colorSettings = doc.color_settings || {};
  const lineTypeSettings = doc.line_type_settings || null;
  const layerGroups = doc.layer_groups || [];
  const supported = supportedKeySet(doc);
  const missing = JWF_KEYS.filter(
    (key) =>
      !supported.has(key) && !JWF_ONLY_OPERATION_KEYS.includes(key)
  );

  return {
    source: "jww",
    note: "JWF-like environment values currently extracted from the JWW file.",
    coverage: {
      totalJwfKeysTracked: JWF_KEYS.length,
      supportedKeys: Array.from(supported).sort(),
      missingJwfKeys: missing,
      nonSerializedJwfKeys: [...JWF_ONLY_OPERATION_KEYS],
      partialKeys: [
        "LCOLLOR_*",
        "PCOLLOR_*",
        "LAYNAM_*",
        "LAYSCALE",
      ],
    },
    paper: {
      paperCode: doc.paper_size ?? null,
      writeLayerGroup: doc.write_layer_group ?? null,
    },
    layers: {
      LAYSCALE: Object.fromEntries(
        layerGroups.map((group, index) => [
          jwwKey(index),
          Number(group?.scale) || 0,
        ])
      ),
      LAYNAM_N: null,
      ...layerNameRows(layerGroups),
      groups: layerStateRows(layerGroups),
      missing: {
        ...(doc.layer_names_extracted === false
          ? { LAYNAM: "layer name block looked binary; default names were used" }
          : {}),
      },
      jwfOnlyDefaults: {
        LAYCOL:
          "write-layer color-switch defaults; not serialized into JWW",
        LAYWID: "write-layer width defaults; not serialized into JWW",
        LAYTYP: "write-layer line-type defaults; not serialized into JWW",
      },
    },
    colors: {
      ...colorTable("LCOLLOR", colorSettings.screenColors),
      LCOLLOR_G: colorEntry(colorSettings.screenColors?.[9]),
      LCOLLOR_H: colorEntry(colorSettings.screenColors?.[10]),
      LCOLLOR_S: colorEntry(colorSettings.specialColors?.S),
      LCOLLOR_K: colorEntry(colorSettings.specialColors?.K),
      LCOLLOR_B: colorEntry(colorSettings.backgroundColor),
      LCOLLOR_Z: colorEntry(colorSettings.specialColors?.Z),
      LCOLLOR_M: colorEntry(colorSettings.specialColors?.M),
      ...colorTable("PCOLLOR", colorSettings.printColors),
      PCOLLOR_G: colorEntry(colorSettings.printColors?.[9]),
      colorTableOffset: colorSettings.offset,
      printColorTableOffset: colorSettings.printColorTableOffset,
      printColorTableKind: colorSettings.printColorTableKind,
      colorTableCandidates: colorSettings.colorTableCandidates || [],
      printColorTableCandidates: colorSettings.printColorTableCandidates || [],
    },
    print: {
      originX: doc.print_settings?.origin_x ?? null,
      originY: doc.print_settings?.origin_y ?? null,
      scale: doc.print_settings?.scale ?? null,
      rotationSetting: doc.print_settings?.rotation_setting ?? null,
      missing: {
        S_COMM_2: "not extracted as JWF general setting yet",
      },
    },
    text: {
      missing: {
        MSET: "not extracted yet",
        MHEN: "entity font names are extracted, preset font setting is not",
        MWIDE: "entity size_x is extracted, preset width table is not",
        MHIGH: "entity size_y is extracted, preset height table is not",
        MDIST: "entity spacing is extracted, preset spacing table is not",
        MPEN: "entity pen color is extracted, preset text pen table is not",
      },
    },
    dimensions: {
      sunpouSettings: doc.sunpou_settings || {},
      missing: {
        S_STR: "dimension entities are partially extracted, dimension setting table is not",
        S_SET: "dimension entities are partially extracted, dimension setting table is not",
      },
    },
    lineTypes: {
      ...(lineTypeSettings?.rows || {}),
      offset: lineTypeSettings?.offset,
      byteLength: lineTypeSettings?.byteLength,
      score: lineTypeSettings?.score,
      postLineTypeTailCandidate: lineTypeSettings?.tailCandidate || null,
      missing: {
        ...(!lineTypeSettings?.rows
          ? {
              LTYPE:
                "entity pen_style is extracted, actual JWF line pattern table is not",
            }
          : {}),
      },
    },
    commands: {
      missing: {
        COM_LAY: "command layer switching settings are not extracted yet",
        LD_RD: "clock menu settings are not extracted yet",
        GCOM: "command group settings are not extracted yet",
        AC_COM: "AUTO mode command settings are not extracted yet",
        WD_COM: "window command settings are not extracted yet",
      },
    },
    keys: {
      missing: {
        KEY: "keyboard shortcut settings are not extracted yet",
      },
    },
    raw: {
      memo: doc.memo || "",
      version: doc.version ?? null,
      environmentRegion: doc.environment_region || null,
    },
    jwfOnly: {
      LTYPE_HC:
        "selection/crossline helper and endpoint behavior; not serialized into JWW",
      LCOLLOR_M:
        "zoom-operation text color; not serialized into JWW",
      "LAYCOL_0..F":
        "write-layer color-switch defaults; not serialized into JWW",
      "LAYWID_0..F":
        "write-layer width defaults; not serialized into JWW",
      "LAYTYP_0..F":
        "write-layer line-type defaults; not serialized into JWW",
    },
  };
}
