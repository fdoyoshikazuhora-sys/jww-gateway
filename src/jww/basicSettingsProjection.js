import {
  JWW_BASIC_SETTINGS_EDIT_CONTRACT_VERSION,
  JWW_BASIC_SETTINGS_PAPER_OPTIONS,
} from "./basicSettingsEdits.js";

export const JWW_BASIC_SETTINGS_PROJECTION_FORMAT =
  "jww-basic-settings-projection";
export const JWW_BASIC_SETTINGS_PROJECTION_VERSION = 7;

const LAYER_STATE_OPTIONS = Object.freeze([
  { value: 0, label: "Hidden (0)" },
  { value: 1, label: "Visible only (1)" },
  { value: 2, label: "Editable (2)" },
]);

const LAYER_STATE_LABELS = Object.freeze({
  0: "Hidden (0)",
  1: "Visible only (1)",
  2: "Editable (2)",
  3: "Current (3)",
});

const LAYER_PROTECTION_LABELS = Object.freeze({
  0: "None (0)",
  1: "Protected; display state can change (1)",
  2: "Protected; display state fixed (2)",
});

const LAYER_PROTECTION_OPTIONS = Object.freeze([
  { value: 0, label: LAYER_PROTECTION_LABELS[0] },
  { value: 1, label: LAYER_PROTECTION_LABELS[1] },
  { value: 2, label: LAYER_PROTECTION_LABELS[2] },
]);

const PRINT_REFERENCE_POSITIONS = Object.freeze([
  "Unspecified",
  "Bottom left",
  "Bottom center",
  "Bottom right",
  "Middle left",
  "Center",
  "Middle right",
  "Top left",
  "Top center",
  "Top right",
]);

const PRINT_ROTATION_OPTIONS = Object.freeze(
  PRINT_REFERENCE_POSITIONS.flatMap((label, position) => [
    { value: position * 10, label: `${label} · 0° (${position * 10})` },
    { value: position * 10 + 1, label: `${label} · 90° (${position * 10 + 1})` },
  ])
);

const PAPER_NAMES = Object.freeze({
  0: "A0",
  1: "A1",
  2: "A2",
  3: "A3",
  4: "A4",
});

const STATUS = Object.freeze({
  STORED: "stored",
  DERIVED: "derived",
  NOT_STORED: "not-stored",
  UNCONFIRMED: "unconfirmed",
});

function finiteNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function displayNumber(value) {
  const number = finiteNumber(value);
  if (number === null) return "Not available";
  return Number.isInteger(number)
    ? String(number)
    : number.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function layerLabel(index) {
  return index.toString(16).toUpperCase();
}

function layerStateDescription(value) {
  const state = finiteNumber(value);
  return state === null
    ? "Not extracted"
    : LAYER_STATE_LABELS[state] || `Unknown (${state})`;
}

function layerProtectionDescription(value) {
  const protect = finiteNumber(value);
  return protect === null
    ? "Not extracted"
    : LAYER_PROTECTION_LABELS[protect] || `Unknown (${protect})`;
}

function groupStateEdit(group, groupIndex, writeLayerGroup) {
  if (
    groupIndex === writeLayerGroup ||
    Number(group.protect || 0) === 2 ||
    ![0, 1, 2].includes(Number(group.state))
  ) {
    return null;
  }
  return {
    key: `layerGroupStates.${groupIndex}`,
    control: "select",
    value: Number(group.state),
    options: LAYER_STATE_OPTIONS,
  };
}

function layerStateEdit(group, groupIndex, layer, layerIndex) {
  if (
    layerIndex === Number(group.write_layer) ||
    Number(layer.protect || 0) === 2 ||
    ![0, 1, 2].includes(Number(layer.state))
  ) {
    return null;
  }
  return {
    key: `layerStates.${groupIndex}.${layerIndex}`,
    control: "select",
    value: Number(layer.state),
    options: LAYER_STATE_OPTIONS,
  };
}

function groupProtectionEdit(group, groupIndex) {
  if (![0, 1, 2].includes(Number(group.protect))) {
    return null;
  }
  return {
    key: `layerGroupProtections.${groupIndex}`,
    control: "select",
    value: Number(group.protect),
    options: LAYER_PROTECTION_OPTIONS,
  };
}

function layerProtectionEdit(groupIndex, layer, layerIndex) {
  if (![0, 1, 2].includes(Number(layer.protect))) {
    return null;
  }
  return {
    key: `layerProtections.${groupIndex}.${layerIndex}`,
    control: "select",
    value: Number(layer.protect),
    options: LAYER_PROTECTION_OPTIONS,
  };
}

function writeLayerEdit(group, groupIndex) {
  return {
    key: `layerGroupWriteLayers.${groupIndex}`,
    control: "select",
    value: finiteNumber(group.write_layer, 0),
    options: (group.layers || []).map((layer, layerIndex) => ({
      value: layerIndex,
      label: `${layerLabel(layerIndex)} · ${layer.name || `Layer ${layerLabel(layerIndex)}`}`,
    })),
  };
}

function field({
  id,
  label,
  value,
  status = STATUS.STORED,
  source = "",
  note = "",
  swatch = "",
  edit = null,
}) {
  return { id, label, value, status, source, note, swatch, edit };
}

function notStoredField(id, label, note) {
  return field({
    id,
    label,
    value: "Not stored in JWW",
    status: STATUS.NOT_STORED,
    source: "JWF environment profile",
    note,
  });
}

function unavailableField(id, label, source, note) {
  return field({
    id,
    label,
    value: "Not extracted",
    status: STATUS.UNCONFIRMED,
    source,
    note,
  });
}

function fieldsSection(id, title, rows, description = "") {
  return { id, title, description, type: "fields", rows };
}

function tableSection(id, title, columns, rows, description = "") {
  return { id, title, description, type: "table", columns, rows };
}

function tab(id, label, sections) {
  return { id, label, sections };
}

function colorDescription(entry) {
  if (!entry) return "Not extracted";
  const rgb = [entry.red, entry.green, entry.blue]
    .map((value) => finiteNumber(value, 0))
    .join(", ");
  const details = [`RGB ${rgb}`];
  if (entry.hex) details.unshift(String(entry.hex).toUpperCase());
  if (Number.isFinite(Number(entry.width))) {
    details.push(`width ${displayNumber(entry.width)}`);
  }
  if (Number.isFinite(Number(entry.pointRadius))) {
    details.push(`point radius ${displayNumber(entry.pointRadius)}`);
  }
  return details.join(" · ");
}

function colorField(id, label, entry, source, status = STATUS.STORED) {
  if (!entry) {
    return unavailableField(id, label, source, "No supported color value was extracted.");
  }
  return field({
    id,
    label,
    value: colorDescription(entry),
    status,
    source,
    swatch: entry.hex || "",
  });
}

function nativeValue(record) {
  return record?.value && typeof record.value === "object"
    ? record.value
    : record || {};
}

function summarizeNumbers(values) {
  const numbers = values
    .map((value) => finiteNumber(value))
    .filter((value) => value !== null);
  if (!numbers.length) return "Not observed";
  const minimum = Math.min(...numbers);
  const maximum = Math.max(...numbers);
  return minimum === maximum
    ? displayNumber(minimum)
    : `${displayNumber(minimum)} – ${displayNumber(maximum)}`;
}

function uniqueText(values) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, "en"));
}

function buildGeneralTab(document, fileName) {
  const header = document.header || {};
  const diagnostics = document.diagnostics || {};
  const paperCode = finiteNumber(header.paperSize);
  return tab("general", "General", [
    fieldsSection("document", "Document", [
      field({
        id: "file-name",
        label: "File name",
        value: fileName || "Local JWW file",
        status: STATUS.DERIVED,
        source: "Browser File object",
      }),
      field({
        id: "format",
        label: "Format",
        value: "JWW",
        status: STATUS.DERIVED,
        source: "JwwData header",
      }),
      field({
        id: "version",
        label: "Internal version",
        value: displayNumber(document.version),
        source: "header.version",
      }),
      field({
        id: "memo",
        label: "Memo",
        value: header.memo || "(empty)",
        source: "header.memo",
        edit: {
          key: "memo",
          control: "textarea",
          value: String(header.memo || ""),
          rows: 3,
        },
      }),
      field({
        id: "paper-summary",
        label: "Paper",
        value:
          paperCode === null
            ? "Not extracted"
            : `${PAPER_NAMES[paperCode] || "Custom / extended"} (code ${paperCode})`,
        source: "header.paperSize",
      }),
      field({
        id: "write-group",
        label: "Current layer group",
        value: displayNumber(header.writeLayerGroup),
        source: "header.writeLayerGroup",
        edit: {
          key: "writeLayerGroup",
          control: "select",
          value: finiteNumber(header.writeLayerGroup, 0),
          options: (document.layerGroups || []).map((group, index) => ({
            value: index,
            label: `${index} · ${group.name || `Group ${index}`}`,
          })),
        },
      }),
    ]),
    fieldsSection(
      "native-source",
      "Native source",
      [
        field({
          id: "byte-length",
          label: "Original byte length",
          value: displayNumber(diagnostics.originalByteLength),
          status: STATUS.DERIVED,
          source: "diagnostics.originalByteLength",
        }),
        field({
          id: "sha256",
          label: "Original SHA-256",
          value: document.originalSha256 || "Not available",
          status: STATUS.DERIVED,
          source: "originalSha256",
        }),
        field({
          id: "revision",
          label: "Native revision",
          value: displayNumber(document.revision),
          status: STATUS.DERIVED,
          source: "revision",
        }),
        field({
          id: "dirty",
          label: "Modified",
          value: document.dirty ? "Yes" : "No",
          status: STATUS.DERIVED,
          source: "dirty",
        }),
      ],
      "The child app keeps this projection only. Original JWW bytes are not copied into UI state."
    ),
  ]);
}

function buildPaperScaleTab(document) {
  const header = document.header || {};
  const paperCode = finiteNumber(header.paperSize);
  const groupRows = (document.layerGroups || []).map((group, index) => ({
    id: group.id || `jww:layer-group:${index}`,
    cells: [
      String(index),
      group.name || `Group ${index}`,
      displayNumber(group.scale),
      String(finiteNumber(group.write_layer, 0)),
      index === finiteNumber(header.writeLayerGroup) ? "Current" : "",
    ],
    status: STATUS.STORED,
    source: `layerGroups[${index}]`,
    edits: {
      2: {
        key: `layerGroupScales.${index}`,
        control: "number",
        value: finiteNumber(group.scale, 1),
        min: Number.MIN_VALUE,
        step: "any",
      },
      3: writeLayerEdit(group, index),
    },
  }));
  return tab("paper-scale", "Paper & Scale", [
    fieldsSection("paper", "Paper", [
      field({
        id: "paper-code",
        label: "Paper code",
        value: displayNumber(paperCode),
        source: "header.paperSize",
        edit: {
          key: "paperSize",
          control: "select",
          value: paperCode,
          options: JWW_BASIC_SETTINGS_PAPER_OPTIONS,
        },
      }),
      field({
        id: "paper-name",
        label: "Paper name",
        value: paperCode === null ? "Not extracted" : PAPER_NAMES[paperCode] || "Custom / extended",
        status: STATUS.DERIVED,
        source: "header.paperSize",
      }),
    ]),
    tableSection(
      "group-scales",
      "Layer group scales",
      ["Group", "Name", "Scale", "Write layer", "Document state"],
      groupRows,
      "Scale is retained per layer group. The child app does not normalize all geometry to one scale."
    ),
  ]);
}

function buildColorTab(document) {
  const settings = document.settings?.color || {};
  const rows = [];
  rows.push(
    colorField(
      "background",
      "Background",
      settings.backgroundColor,
      "settings.color.backgroundColor"
    )
  );
  for (let number = 1; number <= 10; number += 1) {
    if (settings.screenColors?.[number]) {
      rows.push(
        colorField(
          `screen-${number}`,
          `Screen color ${number}`,
          settings.screenColors[number],
          `settings.color.screenColors[${number}]`
        )
      );
    }
  }
  const specialDefinitions = [
    ["S", "Selection color"],
    ["K", "Temporary line color"],
    ["Z", "Zoom frame / crossline color"],
  ];
  for (const [key, label] of specialDefinitions) {
    rows.push(
      colorField(
        `special-${key}`,
        label,
        settings.specialColors?.[key],
        `settings.color.specialColors.${key}`,
        STATUS.STORED
      )
    );
  }
  rows.push(
    notStoredField(
      "lcollor-m",
      "Zoom operation label background (LCOLLOR_M)",
      "This value belongs to a JWF environment profile and is not serialized into JWW."
    )
  );

  const printRows = [];
  for (let number = 1; number <= 9; number += 1) {
    const entry = settings.printColors?.[number];
    if (!entry) continue;
    printRows.push({
      id: `print-${number}`,
      cells: [
        String(number),
        entry.hex || "",
        `${finiteNumber(entry.red, 0)}, ${finiteNumber(entry.green, 0)}, ${finiteNumber(entry.blue, 0)}`,
        displayNumber(entry.width),
        displayNumber(entry.pointRadius),
      ],
      swatch: entry.hex || "",
      status: STATUS.STORED,
      source: `settings.color.printColors[${number}]`,
    });
  }
  return tab("colors", "Colors & Line Widths", [
    fieldsSection("screen-colors", "Screen colors", rows),
    tableSection(
      "print-colors",
      "Print colors",
      ["No.", "Color", "RGB", "Width", "Point radius"],
      printRows.length
        ? printRows
        : [
            {
              id: "print-colors-unavailable",
              cells: ["—", "Not extracted", "—", "—", "—"],
              status: STATUS.UNCONFIRMED,
              source: "settings.color.printColors",
            },
          ]
    ),
  ]);
}

function buildLineTypeTab(document) {
  const settings = document.settings?.lineType;
  const rows = Object.entries(settings?.rows || {}).map(([key, entry]) => ({
    id: key.toLowerCase(),
    cells: [key, entry.pattern || "", (entry.params || []).join(", ")],
    status: STATUS.STORED,
    source: `settings.lineType.rows.${key}`,
  }));
  return tab("line-types", "Line Types", [
    tableSection(
      "line-type-table",
      "JWW line type patterns",
      ["Key", "Pattern", "Parameters"],
      rows.length
        ? rows
        : [
            {
              id: "line-types-unavailable",
              cells: ["—", "Not extracted", "—"],
              status: STATUS.UNCONFIRMED,
              source: "settings.lineType",
            },
          ],
      "Pattern rows are displayed exactly as extracted from the JWW environment region."
    ),
    fieldsSection("line-type-diagnostics", "Extraction", [
      field({
        id: "line-type-score",
        label: "Parser confidence score",
        value: displayNumber(settings?.score),
        status: STATUS.DERIVED,
        source: "settings.lineType.score",
      }),
      field({
        id: "line-type-offset",
        label: "Source offset",
        value: displayNumber(settings?.offset),
        status: STATUS.DERIVED,
        source: "settings.lineType.offset",
      }),
      notStoredField(
        "ltype-hc",
        "Selection, crossline, pitch, baseline and endpoint settings (LTYPE_HC)",
        "All six values are JWF-only operation/display settings and are not serialized into JWW."
      ),
    ]),
  ]);
}

function buildTextTab(document) {
  const texts = (document.nativeEntities || [])
    .filter((record) => record.kind === "TEXT")
    .map(nativeValue);
  const fonts = uniqueText(texts.map((value) => value.font_name));
  const textTypes = uniqueText(texts.map((value) => value.text_type));
  return tab("text", "Text", [
    fieldsSection(
      "text-presets",
      "Basic text presets",
      [
        unavailableField(
          "mset",
          "Current text preset (MSET)",
          "JWW environment",
          "Entity text attributes are retained, but the Jw_cad preset table is not exposed as a confirmed JWW field."
        ),
        unavailableField("mhen", "Preset fonts (MHEN)", "JWW environment", "Observed entity fonts are listed separately."),
        unavailableField("mwide", "Preset widths (MWIDE)", "JWW environment", "Observed entity widths are listed separately."),
        unavailableField("mhigh", "Preset heights (MHIGH)", "JWW environment", "Observed entity heights are listed separately."),
        unavailableField("mdist", "Preset spacing (MDIST)", "JWW environment", "Observed entity spacing is listed separately."),
      ],
      "Unconfirmed preset fields remain visibly unavailable rather than receiving guessed defaults."
    ),
    fieldsSection("observed-text", "Observed native text entities", [
      field({ id: "text-count", label: "Text record count", value: String(texts.length), status: STATUS.DERIVED, source: "nativeEntities[kind=TEXT]" }),
      field({ id: "text-fonts", label: "Fonts used", value: fonts.length ? fonts.join(", ") : "Not observed", status: STATUS.DERIVED, source: "nativeEntities[].value.font_name" }),
      field({ id: "text-types", label: "Text type numbers", value: textTypes.length ? textTypes.join(", ") : "Not observed", status: STATUS.DERIVED, source: "nativeEntities[].value.text_type" }),
      field({ id: "text-widths", label: "Character width range", value: summarizeNumbers(texts.map((value) => value.size_x)), status: STATUS.DERIVED, source: "nativeEntities[].value.size_x" }),
      field({ id: "text-heights", label: "Character height range", value: summarizeNumbers(texts.map((value) => value.size_y)), status: STATUS.DERIVED, source: "nativeEntities[].value.size_y" }),
      field({ id: "text-spacing", label: "Spacing range", value: summarizeNumbers(texts.map((value) => value.spacing)), status: STATUS.DERIVED, source: "nativeEntities[].value.spacing" }),
      field({ id: "text-angles", label: "Angle range", value: summarizeNumbers(texts.map((value) => value.angle)), status: STATUS.DERIVED, source: "nativeEntities[].value.angle" }),
    ]),
  ]);
}

function buildDimensionTab(document) {
  const settings = document.settings?.dimension || {};
  const dimensionCount = (document.nativeEntities || []).filter(
    (record) => record.kind === "DIMENSION"
  ).length;
  const rows = [1, 2, 3, 4, 5].map((number) =>
    field({
      id: `sunpou-${number}`,
      label: `Native dimension setting ${number}`,
      value: displayNumber(settings[`sunpou${number}`]),
      source: `settings.dimension.sunpou${number}`,
      note: "Native field retained; an unverified Jw_cad UI label is intentionally not assigned.",
    })
  );
  rows.push(
    field({
      id: "dimension-max-line-width",
      label: "Maximum line width",
      value: displayNumber(settings.max_line_width),
      source: "settings.dimension.max_line_width",
    })
  );
  return tab("dimensions", "Dimensions", [
    fieldsSection("native-dimension-settings", "Native dimension settings", rows),
    fieldsSection("dimension-coverage", "Coverage", [
      field({ id: "dimension-count", label: "Native dimension record count", value: String(dimensionCount), status: STATUS.DERIVED, source: "nativeEntities[kind=DIMENSION]" }),
      unavailableField("s-str", "Dimension string preset (S_STR)", "JWW environment", "No confirmed JWW field mapping is exposed."),
      unavailableField("s-set", "Dimension setting preset (S_SET)", "JWW environment", "No confirmed JWW field mapping is exposed."),
    ]),
  ]);
}

function buildLayersTab(document) {
  const groups = document.layerGroups || [];
  const writeLayerGroup = finiteNumber(document.header?.writeLayerGroup, 0);
  const groupRows = groups.map((group, index) => ({
    id: group.id || `group-${index}`,
    cells: [
      String(index),
      group.name || `Group ${index}`,
      layerStateDescription(group.state),
      layerProtectionDescription(group.protect),
      displayNumber(group.scale),
      displayNumber(group.write_layer),
    ],
    status: STATUS.STORED,
    source: `layerGroups[${index}]`,
    edits: {
      ...(groupStateEdit(group, index, writeLayerGroup)
        ? { 2: groupStateEdit(group, index, writeLayerGroup) }
        : {}),
      ...(groupProtectionEdit(group, index)
        ? { 3: groupProtectionEdit(group, index) }
        : {}),
      5: writeLayerEdit(group, index),
    },
  }));
  const sections = [
    tableSection(
      "layer-groups",
      "Layer groups",
      ["No.", "Name", "State", "Protection", "Scale", "Write layer"],
      groupRows,
      "State and protection meanings follow the official JWW 7.02 format. State editing is limited to non-current rows whose display state is not fixed; protection editing also includes current rows."
    ),
  ];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    sections.push(
      tableSection(
        `layers-${groupIndex}`,
        `${group.name || `Group ${groupIndex}`} layers`,
        ["Layer", "Name", "State", "Protection"],
        (group.layers || []).map((layer, layerIndex) => ({
          id: `group-${groupIndex}-layer-${layerIndex}`,
          cells: [
            String(layerIndex),
            layer.name || `${groupIndex}-${layerIndex}`,
            layerStateDescription(layer.state),
            layerProtectionDescription(layer.protect),
          ],
          status: STATUS.STORED,
          source: `layerGroups[${groupIndex}].layers[${layerIndex}]`,
          edits: {
            ...(layerStateEdit(group, groupIndex, layer, layerIndex)
              ? { 2: layerStateEdit(group, groupIndex, layer, layerIndex) }
              : {}),
            ...(layerProtectionEdit(groupIndex, layer, layerIndex)
              ? {
                  3: layerProtectionEdit(
                    groupIndex,
                    layer,
                    layerIndex
                  ),
                }
              : {}),
          },
        })),
        groupIndex === finiteNumber(document.header?.writeLayerGroup)
          ? "Current document layer group"
          : ""
      )
    );
  }
  sections.push(
    fieldsSection("jwf-layer-defaults", "Environment profile defaults", [
      notStoredField("laycol", "Write-layer color defaults (LAYCOL_0..F)", "Applied when the write layer changes; not serialized into JWW."),
      notStoredField("laywid", "Write-layer width defaults (LAYWID_0..F)", "Applied when the write layer changes; not serialized into JWW."),
      notStoredField("laytyp", "Write-layer line type defaults (LAYTYP_0..F)", "Applied when the write layer changes; not serialized into JWW."),
    ])
  );
  return tab("layers", "Layer Groups & Layers", sections);
}

function buildPrintTab(document) {
  const settings = document.settings?.print || {};
  return tab("print", "Print Settings", [
    fieldsSection("print-origin", "Print placement", [
      field({ id: "print-origin-x", label: "Origin X", value: displayNumber(settings.origin_x), source: "settings.print.origin_x", edit: {
        key: "printOriginX",
        control: "number",
        value: finiteNumber(settings.origin_x, 0),
        step: "any",
      } }),
      field({ id: "print-origin-y", label: "Origin Y", value: displayNumber(settings.origin_y), source: "settings.print.origin_y", edit: {
        key: "printOriginY",
        control: "number",
        value: finiteNumber(settings.origin_y, 0),
        step: "any",
      } }),
      field({ id: "print-scale", label: "Print scale", value: displayNumber(settings.scale), source: "settings.print.scale", edit: {
        key: "printScale",
        control: "number",
        value: finiteNumber(settings.scale, 1),
        min: Number.MIN_VALUE,
        step: "any",
      } }),
      field({
        id: "print-rotation",
        label: "Rotation / reference position",
        value: displayNumber(settings.rotation_setting),
        source: "settings.print.rotation_setting",
        note: "Ones digit: 0° or 90°. Tens digit: output reference position.",
        edit: {
          key: "printRotationSetting",
          control: "select",
          value: finiteNumber(settings.rotation_setting, 0),
          options: PRINT_ROTATION_OPTIONS,
        },
      }),
    ]),
  ]);
}

function buildDiagnosticsTab(document) {
  const diagnostics = document.diagnostics || {};
  const unknownRows = (diagnostics.preservedUnknownRegions || []).map(
    (region, index) => ({
      id: `unknown-${index}`,
      cells: [
        region.section || "unknown",
        region.reason || "unparsed region",
        displayNumber(region.start),
        displayNumber(region.end),
        displayNumber(region.byteLength),
      ],
      status: STATUS.UNCONFIRMED,
      source: `diagnostics.preservedUnknownRegions[${index}]`,
    })
  );
  return tab("diagnostics", "Diagnostics", [
    fieldsSection("parse-status", "Parser status", [
      field({ id: "clean", label: "Clean parse", value: diagnostics.clean ? "Yes" : "No", status: STATUS.DERIVED, source: "diagnostics.clean" }),
      field({ id: "unsupported", label: "Unsupported records", value: displayNumber(diagnostics.unsupportedCount), status: STATUS.DERIVED, source: "diagnostics.unsupportedCount" }),
      field({ id: "skipped", label: "Skipped records", value: displayNumber(diagnostics.skippedCount), status: STATUS.DERIVED, source: "diagnostics.skippedCount" }),
      field({ id: "source-spans", label: "Record source spans available", value: diagnostics.recordSourceSpansAvailable ? "Yes" : "No", status: STATUS.DERIVED, source: "diagnostics.recordSourceSpansAvailable" }),
      field({ id: "trailing", label: "Trailing unparsed bytes", value: displayNumber(diagnostics.trailingByteLength), status: STATUS.DERIVED, source: "diagnostics.trailingByteLength" }),
    ]),
    fieldsSection("record-counts", "Native record counts", [
      field({ id: "entities", label: "Drawing entities", value: String((document.nativeEntities || []).length), status: STATUS.DERIVED, source: "nativeEntities.length" }),
      field({ id: "blocks", label: "Block definitions", value: String((document.blockDefinitions || []).length), status: STATUS.DERIVED, source: "blockDefinitions.length" }),
      field({ id: "images", label: "Embedded images", value: String((document.embeddedImages || []).length), status: STATUS.DERIVED, source: "embeddedImages.length" }),
    ]),
    tableSection(
      "unknown-regions",
      "Preserved unknown regions",
      ["Section", "Reason", "Start", "End", "Bytes"],
      unknownRows.length
        ? unknownRows
        : [
            {
              id: "unknown-none",
              cells: ["—", "None reported", "—", "—", "0"],
              status: STATUS.DERIVED,
              source: "diagnostics.preservedUnknownRegions",
            },
          ],
    "Unknown bytes are reported explicitly. Native-safe metadata edits never remove them."
    ),
  ]);
}

export function buildJwwBasicSettingsProjection(document, options = {}) {
  if (document?.kind !== "jww-native") {
    throw new TypeError("JwwNativeDocument is required");
  }
  const fileName = String(options.fileName || options.sourceName || "");
  const tabs = [
    buildGeneralTab(document, fileName),
    buildPaperScaleTab(document),
    buildColorTab(document),
    buildLineTypeTab(document),
    buildTextTab(document),
    buildDimensionTab(document),
    buildLayersTab(document),
    buildPrintTab(document),
    buildDiagnosticsTab(document),
  ];
  return {
    format: JWW_BASIC_SETTINGS_PROJECTION_FORMAT,
    formatVersion: JWW_BASIC_SETTINGS_PROJECTION_VERSION,
    readOnly: false,
    saveAsOnly: true,
    editContract: {
      version: JWW_BASIC_SETTINGS_EDIT_CONTRACT_VERSION,
      mode: "native-metadata-safe",
      writablePaths: [
        "header.memo",
        "header.paperSize",
        "header.writeLayerGroup",
        "layerGroups[].scale",
        "layerGroups[].write_layer",
        "layerGroups[].state",
        "layerGroups[].protect",
        "layerGroups[].layers[].state",
        "layerGroups[].layers[].protect",
        "settings.print.origin_x",
        "settings.print.origin_y",
        "settings.print.scale",
        "settings.print.rotation_setting",
      ],
      managedInvariantPaths: ["layerGroups[].layers[].state"],
    },
    source: {
      fileName,
      kind: document.kind,
      version: finiteNumber(document.version, 0),
      byteLength: finiteNumber(document.diagnostics?.originalByteLength, 0),
      sha256: document.originalSha256 || "",
      clean: Boolean(document.diagnostics?.clean),
      revision: finiteNumber(document.revision, 0),
      dirty: Boolean(document.dirty),
    },
    legend: [
      { status: STATUS.STORED, label: "Stored in JWW" },
      { status: STATUS.DERIVED, label: "Derived" },
      { status: STATUS.NOT_STORED, label: "Not stored in JWW" },
      { status: STATUS.UNCONFIRMED, label: "Unsupported / unconfirmed" },
    ],
    tabs,
  };
}
