import {
  JWW_BASIC_SETTINGS_EDIT_CONTRACT_VERSION,
  JWW_BASIC_SETTINGS_PAPER_OPTIONS,
} from "./basicSettingsEdits.js";
import { decodeJwwDimensionSettings } from "./dimensionSettings.js";
import {
  decodeJwwGridSettings,
  JWW_GRID_MODE_OPTIONS,
} from "./gridSettings.js";
import {
  hasOfficialJwwLineTypeSettingsLayout,
  JWW_LINE_TYPE_ROW_DEFINITIONS,
} from "./lineTypeSettings.js";

export const JWW_BASIC_SETTINGS_PROJECTION_FORMAT =
  "jww-basic-settings-projection";
export const JWW_BASIC_SETTINGS_PROJECTION_VERSION = 11;

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

const DIMENSION_COLOR_OPTIONS = Object.freeze(
  Array.from({ length: 10 }, (_, value) => ({
    value,
    label: value === 0 ? "Not stored / inherited (0)" : `Color ${value}`,
  }))
);

const DIMENSION_TEXT_TYPE_OPTIONS = Object.freeze(
  Array.from({ length: 11 }, (_, value) => ({
    value,
    label: value === 0 ? "Not stored / inherited (0)" : `Text type ${value}`,
  }))
);

const DIMENSION_DECIMAL_OPTIONS = Object.freeze(
  Array.from({ length: 4 }, (_, value) => ({ value, label: String(value) }))
);

const DIMENSION_ANGLE_DECIMAL_OPTIONS = Object.freeze(
  Array.from({ length: 7 }, (_, value) => ({ value, label: String(value) }))
);

const DIMENSION_UNIT_OPTIONS = Object.freeze([
  { value: 0, label: "Millimetres (0)" },
  { value: 1, label: "Metres (1)" },
]);

const DIMENSION_ENDPOINT_OPTIONS = Object.freeze([
  { value: 0, label: "Point (0)" },
  { value: 1, label: "Arrow (1)" },
  { value: 2, label: "Reverse arrow (2)" },
]);

const DIMENSION_BINARY_OPTIONS = Object.freeze([
  { value: 0, label: "Off (0)" },
  { value: 1, label: "On (1)" },
]);

const DIMENSION_DIRECTION_OPTIONS = Object.freeze([
  { value: 0, label: "Correct direction (0)" },
  { value: 1, label: "Do not correct (1)" },
]);

const DIMENSION_RADIUS_MARK_OPTIONS = Object.freeze([
  { value: 0, label: "Hidden (0)" },
  { value: 1, label: "Prefix R (1)" },
  { value: 2, label: "Suffix R (2)" },
]);

const DIMENSION_ANGLE_UNIT_OPTIONS = Object.freeze([
  { value: 0, label: "Decimal degrees with symbol (0)" },
  { value: 1, label: "Degrees, minutes, seconds (1)" },
  { value: 2, label: "Decimal degrees without symbol (2)" },
]);

const DIMENSION_DECIMAL_HANDLING_OPTIONS = Object.freeze([
  { value: 0, label: "Round (0)" },
  { value: 1, label: "Truncate (1)" },
  { value: 2, label: "Round up (2)" },
]);

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
  const editable = Boolean(
    settings.id &&
      settings.sourceLayout === "jwdatafmt-color-tables-v600-v700" &&
      settings.sourceSpan?.byteLength === 240
  );
  const summaryRows = [];
  summaryRows.push(
    colorField(
      "background",
      "Background",
      settings.backgroundColor,
      "settings.color.backgroundColor"
    )
  );
  const specialDefinitions = [
    ["S", "Selection color"],
    ["K", "Temporary line color"],
    ["Z", "Zoom frame / crossline color"],
  ];
  for (const [key, label] of specialDefinitions) {
    summaryRows.push(
      colorField(
        `special-${key}`,
        label,
        settings.specialColors?.[key],
        `settings.color.specialColors.${key}`,
        STATUS.UNCONFIRMED
      )
    );
  }
  summaryRows.push(
    notStoredField(
      "lcollor-m",
      "Zoom operation label background (LCOLLOR_M)",
      "This value belongs to a JWF environment profile and is not serialized into JWW."
    )
  );

  const screenRows = [];
  for (let number = 0; number <= 9; number += 1) {
    const entry = number === 0
      ? settings.backgroundColor
      : settings.screenColors?.[number];
    if (!entry) continue;
    const role = number === 0 ? "Background" : number === 9 ? "Gray" : "Line";
    const colorKey = number === 0 ? "backgroundColor" : `screenColors.${number}`;
    const widthKey = number === 0
      ? "backgroundLineWidth"
      : `screenColorWidths.${number}`;
    screenRows.push({
      id: `screen-${number}`,
      cells: [
        String(number),
        role,
        entry.hex || "",
        `${finiteNumber(entry.red, 0)}, ${finiteNumber(entry.green, 0)}, ${finiteNumber(entry.blue, 0)}`,
        displayNumber(entry.width),
      ],
      swatch: entry.hex || "",
      swatchColumn: 2,
      status: STATUS.STORED,
      source:
        number === 0
          ? "settings.color.backgroundColor"
          : `settings.color.screenColors[${number}]`,
      edits: editable
        ? {
            2: {
              key: colorKey,
              control: "color",
              value: entry.hex || "#000000",
            },
            4: {
              key: widthKey,
              control: "number",
              value: finiteNumber(entry.width, 1),
              min: 1,
              max: 16,
              step: 1,
            },
          }
        : undefined,
    });
  }

  const printRows = [];
  for (let number = 0; number <= 9; number += 1) {
    const entry = number === 0
      ? settings.printBackgroundColor
      : settings.printColors?.[number];
    if (!entry) continue;
    const role = number === 0 ? "Background" : number === 9 ? "Gray" : "Line";
    const colorKey = number === 0
      ? "printBackgroundColor"
      : `printColors.${number}`;
    const widthKey = number === 0
      ? "printBackgroundLineWidth"
      : `printColorWidths.${number}`;
    const radiusKey = number === 0
      ? "printBackgroundPointRadius"
      : `printPointRadii.${number}`;
    printRows.push({
      id: `print-${number}`,
      cells: [
        String(number),
        role,
        entry.hex || "",
        `${finiteNumber(entry.red, 0)}, ${finiteNumber(entry.green, 0)}, ${finiteNumber(entry.blue, 0)}`,
        displayNumber(entry.width),
        displayNumber(entry.pointRadius),
      ],
      swatch: entry.hex || "",
      swatchColumn: 2,
      status: STATUS.STORED,
      source:
        number === 0
          ? "settings.color.printBackgroundColor"
          : `settings.color.printColors[${number}]`,
      edits: editable
        ? {
            2: {
              key: colorKey,
              control: "color",
              value: entry.hex || "#000000",
            },
            4: {
              key: widthKey,
              control: "number",
              value: finiteNumber(entry.width, 1),
              min: 1,
              max: 500,
              step: 1,
            },
            5: {
              key: radiusKey,
              control: "number",
              value: finiteNumber(entry.pointRadius, 0.1),
              min: 0.1,
              max: 10,
              step: 0.1,
            },
          }
        : undefined,
    });
  }
  return tab("colors", "Colors & Line Widths", [
    fieldsSection(
      "color-notes",
      "Source notes",
      summaryRows,
      "Only the official JWW 0-9 screen and print tables are native-editable. Candidate operation colors remain read-only."
    ),
    tableSection(
      "screen-colors",
      "Screen colors",
      ["No.", "Role", "Color", "RGB", "Width"],
      screenRows.length
        ? screenRows
        : [
            {
              id: "screen-colors-unavailable",
              cells: ["—", "Not extracted", "—", "—", "—"],
              status: STATUS.UNCONFIRMED,
              source: "settings.color.screenColors",
            },
          ],
      "JWW stores color 0 as background, colors 1-8 as line colors, and color 9 as gray. Screen widths are 1-16."
    ),
    tableSection(
      "print-colors",
      "Print colors",
      ["No.", "Role", "Color", "RGB", "Width", "Point radius"],
      printRows.length
        ? printRows
        : [
            {
              id: "print-colors-unavailable",
              cells: ["—", "Not extracted", "—", "—", "—", "—"],
              status: STATUS.UNCONFIRMED,
              source: "settings.color.printColors",
            },
          ],
      "JWW stores matching print colors 0-9 with widths 1-500 and point radii 0.1-10."
    ),
  ]);
}

function buildLineTypeTab(document) {
  const settings = document.settings?.lineType;
  const editable = Boolean(
    settings?.id && hasOfficialJwwLineTypeSettingsLayout(settings)
  );
  const rows = JWW_LINE_TYPE_ROW_DEFINITIONS
    .map((definition) => {
      const entry = settings?.rows?.[definition.key];
      if (!entry) return null;
      const edits = editable
        ? {
            1: {
              key: `lineTypeRows.${definition.key}.pattern`,
              control: "text",
              value: entry.pattern || "00000000",
              pattern: "[0-9A-Fa-f]{8}",
              maxLength: 8,
            },
          }
        : undefined;
      if (edits) {
        for (const field of definition.fields) {
          const column = {
            unitDotCount: 2,
            screenAmplitude: 3,
            screenPitch: 4,
            printAmplitude: 5,
            printPitch: 6,
          }[field.key];
          edits[column] = {
            key: `lineTypeRows.${definition.key}.${field.key}`,
            control: "number",
            value: finiteNumber(entry[field.key], field.minimum),
            min: field.minimum,
            max: field.maximum,
            step: 1,
          };
        }
      }
      return {
        id: definition.key.toLowerCase(),
        cells: [
          definition.key,
          entry.pattern || "",
          entry.unitDotCount ?? "—",
          entry.screenAmplitude ?? "—",
          entry.screenPitch ?? "—",
          entry.printAmplitude ?? "—",
          entry.printPitch ?? "—",
        ],
        edits,
        status: STATUS.STORED,
        source: `settings.lineType.rows.${definition.key}`,
      };
    })
    .filter(Boolean);
  return tab("line-types", "Line Types", [
    tableSection(
      "line-type-table",
      "JWW line type patterns",
      [
        "Key",
        "Pattern",
        "Unit dots",
        "Screen amplitude",
        "Screen pitch",
        "Print amplitude",
        "Print pitch",
      ],
      rows.length
        ? rows
        : [
            {
              id: "line-types-unavailable",
              cells: ["—", "Not extracted", "—", "—", "—", "—", "—"],
              status: STATUS.UNCONFIRMED,
              source: "settings.lineType",
            },
          ],
      "The official 17-row JWW table is native-editable only when its fixed 292-byte source span is verified. Ordinary and doubled rows use unit dots and pitch; random rows use screen/print amplitudes and pitch."
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

function dimensionSelectField(id, label, key, value, options, source, note = "") {
  const selected = options.find((option) => Number(option.value) === Number(value));
  return field({
    id,
    label,
    value: selected?.label || displayNumber(value),
    source,
    note,
    edit: { key, control: "select", value, options },
  });
}

function dimensionNumberField(
  id,
  label,
  key,
  value,
  source,
  { min, max, step = 0.1, note = "" } = {}
) {
  return field({
    id,
    label,
    value: displayNumber(value),
    source,
    note,
    edit: { key, control: "number", value, min, max, step },
  });
}

function rawDimensionRows(settings, note = "Official JWW fixed-prefix DWORD.") {
  return [1, 2, 3, 4, 5].map((number) =>
    field({
      id: `sunpou-${number}`,
      label: `Packed dimension setting ${number}`,
      value: displayNumber(settings[`sunpou${number}`]),
      source: `settings.dimension.sunpou${number}`,
      note,
    })
  );
}

function buildDimensionTab(document) {
  const settings = document.settings?.dimension || {};
  const dimensionCount = (document.nativeEntities || []).filter(
    (record) => record.kind === "DIMENSION"
  ).length;
  let decoded;
  let decodeError = "";
  try {
    decoded = decodeJwwDimensionSettings(settings);
  } catch (error) {
    decodeError = error?.message || String(error);
  }
  const coverage = fieldsSection("dimension-coverage", "Coverage", [
    field({ id: "dimension-count", label: "Native dimension record count", value: String(dimensionCount), status: STATUS.DERIVED, source: "nativeEntities[kind=DIMENSION]" }),
    unavailableField("s-str", "Dimension string preset (S_STR)", "JWF environment profile", "S_STR is not a confirmed JWW-native field and is not applied automatically."),
    unavailableField("s-set", "Dimension setting preset (S_SET)", "JWF environment profile", "S_SET is not a confirmed JWW-native field and is not applied automatically."),
  ]);
  const rawRows = rawDimensionRows(
    settings,
    decodeError || "Official JWW fixed-prefix DWORD; edited through the named fields above."
  );
  rawRows.push(
    field({
      id: "dimension-max-line-width",
      label: "Maximum draw width code",
      value: displayNumber(settings.max_line_width),
      source: "settings.dimension.max_line_width",
      note: "Signed JWW code. Negative values encode 1/100 mm mode and the previous maximum width; retained read-only in this milestone.",
    })
  );
  if (!decoded) {
    return tab("dimensions", "Dimensions", [
      fieldsSection(
        "native-dimension-settings",
        "Native dimension settings",
        rawRows,
        `Named editing is unavailable because the packed values did not match the documented JWW encoding: ${decodeError}`
      ),
      coverage,
    ]);
  }
  return tab("dimensions", "Dimensions", [
    fieldsSection("dimension-attributes", "Lines, points and text type", [
      dimensionSelectField("dimension-line-color", "Dimension line color", "dimensionLineColor", decoded.lineColor, DIMENSION_COLOR_OPTIONS, "settings.dimension.sunpou1"),
      dimensionSelectField("dimension-extension-color", "Extension line color", "dimensionExtensionLineColor", decoded.extensionLineColor, DIMENSION_COLOR_OPTIONS, "settings.dimension.sunpou1"),
      dimensionSelectField("dimension-point-color", "Dimension point color", "dimensionPointColor", decoded.pointColor, DIMENSION_COLOR_OPTIONS, "settings.dimension.sunpou1"),
      dimensionSelectField("dimension-endpoint", "Line endpoint", "dimensionEndpointStyle", decoded.endpointStyle, DIMENSION_ENDPOINT_OPTIONS, "settings.dimension.sunpou1"),
      dimensionSelectField("dimension-text-type", "Dimension text type", "dimensionTextType", decoded.textType, DIMENSION_TEXT_TYPE_OPTIONS, "settings.dimension.sunpou1"),
    ]),
    fieldsSection("dimension-values", "Value format and placement", [
      dimensionSelectField("dimension-decimals", "Decimal places", "dimensionDecimalPlaces", decoded.decimalPlaces, DIMENSION_DECIMAL_OPTIONS, "settings.dimension.sunpou1"),
      dimensionSelectField("dimension-unit", "Unit", "dimensionUnit", decoded.unit, DIMENSION_UNIT_OPTIONS, "settings.dimension.sunpou1"),
      dimensionNumberField("dimension-value-offset", "Value-to-line offset", "dimensionValueOffset", decoded.valueOffset, "settings.dimension.sunpou2", { min: -99.9, max: 99.9 }),
      dimensionNumberField("dimension-extension-projection", "Extension-line projection", "dimensionExtensionProjection", decoded.extensionProjection, "settings.dimension.sunpou2", { min: -99.9, max: 99.9 }),
    ]),
    fieldsSection("dimension-arrows", "Arrow geometry", [
      dimensionNumberField("dimension-arrow-length", "Arrow length", "dimensionArrowLength", decoded.arrowLength, "settings.dimension.sunpou3", { min: 0, max: 99.9 }),
      dimensionNumberField("dimension-arrow-angle", "Arrow angle", "dimensionArrowAngle", decoded.arrowAngle, "settings.dimension.sunpou3", { min: 0.1, max: 80 }),
      dimensionNumberField("dimension-reverse-arrow", "Reverse-arrow projection", "dimensionReverseArrowProjection", decoded.reverseArrowProjection, "settings.dimension.sunpou3", { min: 0, max: 99.9 }),
    ]),
    fieldsSection("dimension-text-format", "Text and radius format", [
      dimensionSelectField("dimension-direction-correction", "Text direction correction", "dimensionDirectionCorrection", decoded.directionCorrection, DIMENSION_DIRECTION_OPTIONS, "settings.dimension.sunpou4"),
      dimensionSelectField("dimension-full-width-text", "Full-width dimension value", "dimensionFullWidthText", decoded.fullWidthText, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou4"),
      dimensionSelectField("dimension-comma-space", "Replace comma with space", "dimensionCommaAsSpace", decoded.commaAsSpace, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou4"),
      dimensionSelectField("dimension-full-width-comma", "Full-width comma", "dimensionFullWidthComma", decoded.fullWidthComma, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou4"),
      dimensionSelectField("dimension-full-width-decimal", "Full-width decimal point", "dimensionFullWidthDecimalPoint", decoded.fullWidthDecimalPoint, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou4"),
      dimensionSelectField("dimension-show-unit", "Show unit", "dimensionShowUnit", decoded.showUnit, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou4"),
      dimensionSelectField("dimension-radius-mark", "Radius R position", "dimensionRadiusMarkPosition", decoded.radiusMarkPosition, DIMENSION_RADIUS_MARK_OPTIONS, "settings.dimension.sunpou4"),
      dimensionSelectField("dimension-radius-comma", "Radius comma", "dimensionRadiusComma", decoded.radiusComma, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou4"),
      dimensionSelectField("dimension-radius-zero", "Radius trailing zero", "dimensionRadiusTrailingZero", decoded.radiusTrailingZero, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou4"),
      dimensionSelectField("dimension-italic", "Italic dimension value", "dimensionItalicText", decoded.italicText, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou5"),
      dimensionSelectField("dimension-bold", "Bold dimension value", "dimensionBoldText", decoded.boldText, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou5"),
      dimensionSelectField("dimension-angle-unit", "Angle unit", "dimensionAngleUnit", decoded.angleUnit, DIMENSION_ANGLE_UNIT_OPTIONS, "settings.dimension.sunpou5"),
      dimensionSelectField("dimension-angle-decimals", "Angle decimal places", "dimensionAngleDecimalPlaces", decoded.angleDecimalPlaces, DIMENSION_ANGLE_DECIMAL_OPTIONS, "settings.dimension.sunpou5"),
      dimensionSelectField("dimension-decimal-handling", "Displayed decimal handling", "dimensionDecimalHandling", decoded.decimalHandling, DIMENSION_DECIMAL_HANDLING_OPTIONS, "settings.dimension.sunpou5"),
    ]),
    fieldsSection("dimension-behaviour", "Dimension object behaviour", [
      dimensionSelectField("dimension-create-entity", "Create dimension entity", "dimensionCreateEntity", decoded.createEntity, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou5"),
      dimensionSelectField("dimension-select-attributes", "Select by line color/type", "dimensionSelectByLineAttributes", decoded.selectByLineAttributes, DIMENSION_BINARY_OPTIONS, "settings.dimension.sunpou5"),
    ]),
    fieldsSection("native-dimension-settings", "Native packed values", rawRows),
    coverage,
  ]);
}

function gridNumberField(id, label, key, value, source, options = {}) {
  return field({
    id,
    label,
    value: displayNumber(value),
    source,
    note: options.note || "",
    edit: {
      key,
      control: "number",
      value,
      ...(options.min === undefined ? {} : { min: options.min }),
      ...(options.max === undefined ? {} : { max: options.max }),
      step: options.step ?? "any",
    },
  });
}

function buildGridTab(document) {
  const settings = document.settings?.grid || {};
  let decoded;
  let decodeError = "";
  try {
    decoded = decodeJwwGridSettings(settings);
  } catch (error) {
    decodeError = error?.message || String(error);
  }
  if (!decoded) {
    return tab("grid", "Grid Settings", [
      fieldsSection(
        "grid-native",
        "Native grid settings",
        [
          field({ id: "grid-mode", label: "Grid mode", value: displayNumber(settings.mode), source: "settings.grid.mode" }),
          field({ id: "grid-minimum-display-spacing", label: "Minimum display spacing (dots)", value: displayNumber(settings.minimum_display_spacing), source: "settings.grid.minimum_display_spacing" }),
          field({ id: "grid-spacing-x", label: "Spacing X", value: displayNumber(settings.spacing_x), source: "settings.grid.spacing_x" }),
          field({ id: "grid-spacing-y", label: "Spacing Y", value: displayNumber(settings.spacing_y), source: "settings.grid.spacing_y" }),
          field({ id: "grid-base-x", label: "Base point X", value: displayNumber(settings.base_x), source: "settings.grid.base_x" }),
          field({ id: "grid-base-y", label: "Base point Y", value: displayNumber(settings.base_y), source: "settings.grid.base_y" }),
        ],
        `Editing is unavailable because the stored mode or geometry is outside the documented JWW encoding: ${decodeError}`
      ),
    ]);
  }
  const selectedMode = JWW_GRID_MODE_OPTIONS.find(
    (option) => Number(option.value) === Number(decoded.mode)
  );
  return tab("grid", "Grid Settings", [
    fieldsSection("grid-mode", "Display and snapping", [
      field({
        id: "grid-mode-value",
        label: "Grid mode",
        value: selectedMode?.label || displayNumber(decoded.mode),
        source: "settings.grid.mode",
        note: "Ones digit controls display, tens digit selects drawing or real-size units, and a negative value disables grid snapping.",
        edit: {
          key: "gridMode",
          control: "select",
          value: decoded.mode,
          options: JWW_GRID_MODE_OPTIONS,
        },
      }),
      field({ id: "grid-display", label: "Grid display", value: decoded.display ? "Displayed" : "Hidden", status: STATUS.DERIVED, source: "settings.grid.mode" }),
      field({ id: "grid-units", label: "Spacing units", value: decoded.realSizeUnits ? "Real-size units" : "Drawing units", status: STATUS.DERIVED, source: "settings.grid.mode" }),
      field({ id: "grid-snapping", label: "Grid snapping", value: decoded.snapping ? "Enabled" : "Disabled", status: STATUS.DERIVED, source: "settings.grid.mode" }),
    ]),
    fieldsSection("grid-geometry", "Spacing and base point", [
      gridNumberField("grid-minimum-display-spacing", "Minimum display spacing (dots)", "gridMinimumDisplaySpacing", decoded.minimum_display_spacing, "settings.grid.minimum_display_spacing", { min: 0 }),
      gridNumberField("grid-spacing-x", "Spacing X", "gridSpacingX", decoded.spacing_x, "settings.grid.spacing_x", { min: Number.MIN_VALUE }),
      gridNumberField("grid-spacing-y", "Spacing Y", "gridSpacingY", decoded.spacing_y, "settings.grid.spacing_y", { min: Number.MIN_VALUE }),
      gridNumberField("grid-base-x", "Base point X", "gridBaseX", decoded.base_x, "settings.grid.base_x"),
      gridNumberField("grid-base-y", "Base point Y", "gridBaseY", decoded.base_y, "settings.grid.base_y"),
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
    buildGridTab(document),
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
        "settings.dimension.sunpou1",
        "settings.dimension.sunpou2",
        "settings.dimension.sunpou3",
        "settings.dimension.sunpou4",
        "settings.dimension.sunpou5",
        "settings.grid.mode",
        "settings.grid.minimum_display_spacing",
        "settings.grid.spacing_x",
        "settings.grid.spacing_y",
        "settings.grid.base_x",
        "settings.grid.base_y",
        "settings.color.backgroundColor",
        "settings.color.screenColors[1..9]",
        "settings.color.printBackgroundColor",
        "settings.color.printColors[1..9]",
        "settings.lineType.rows.LTYPE_02..LTYPE_09",
        "settings.lineType.rows.LTYPE_R1..LTYPE_R5",
        "settings.lineType.rows.LTYPE_L1..LTYPE_L4",
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
