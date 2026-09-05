import {
  createJwfProfile,
  editJwfProfile,
  openJwfProfile,
  preflightJwfProfileSave,
  saveJwfProfile,
  updateJwfProfileEntry,
} from "../../src/jww/jwf.js";
import { decodeLinePattern, encodeLinePattern } from "./line-pattern.js";

const $ = (selector) => document.querySelector(selector);
const ui = {
  open: $("#open-button"), emptyOpen: $("#empty-open-button"),
  new: $("#new-button"), emptyNew: $("#empty-new-button"),
  export: $("#export-button"), source: $("#source-button"), file: $("#file-input"),
  empty: $("#empty-state"), workspace: $("#profile-workspace"), tabs: $("#tab-list"),
  view: $("#profile-view"), name: $("#source-name"), detail: $("#source-detail"),
  metrics: $("#source-metrics"), status: $("#status-text"), dot: $("#status-dot"),
  ok: $("#ok-button"), cancel: $("#cancel-button"), apply: $("#apply-button"),
};

const TABS = [
  ["general1", "General (1)"], ["general2", "General (2)"],
  ["colors", "Colors & Screen"], ["lineTypes", "Line Types"],
  ["text", "Text"], ["auto", "AUTO"], ["keys", "KEY"],
  ["exchange", "DXF · SXF · JWC"], ["jwfOnly", "JWF-only Settings"],
  ["other", "Other JWF Settings"],
];
const GROUPS = {
  general1: [/^S_COMM_[0-4]$/, /^R_CROSS_SET$/],
  general2: [/^S_COMM_[5-9]$/, /^S_MESH_0$/, /^ZOOM$/, /^R_STR0_00$/],
  colors: [/^LCOLLOR_(?!M$)/, /^PCOLLOR_/],
  lineTypes: [/^LTYPE_(?!HC$)/],
  text: [/^(MSET|MHEN|MWIDE|MHIGH|MDIST|MPEN|MOFST)$/],
  auto: [/^(AC_COM|WD_COM)$/, /^(LD|RD|LD2|RD2)_(AM|PM)$/, /^COM_/, /^GCOM_/],
  keys: [/^N_KEY$/, /^KEY/],
  jwfOnly: [/^LCOLLOR_M$/, /^LTYPE_HC$/, /^LAY(?:COL|WID|TYP)_[0-9A-F]$/],
};
const TITLES = {
  S_COMM_0: "Startup and file defaults", S_COMM_1: "Auto-save, input, and backup",
  S_COMM_2: "Display and drawing behavior", S_COMM_3: "Text display and drawing order",
  S_COMM_4: "Cursor, search, and command behavior", S_COMM_5: "Text, shapes, points, and print",
  S_COMM_6: "Undo, paste, and drawing time", S_COMM_7: "Status and continuous operations",
  S_COMM_8: "Dimension and mouse behavior", S_COMM_9: "Auxiliary points and blocks",
  S_MESH_0: "Grid settings", ZOOM: "Mouse and keyboard zoom", R_CROSS_SET: "Crossline cursor",
  R_STR0_00: "Drawing units", MSET: "Text behavior", MHEN: "Default font and existing text",
  MWIDE: "Text widths", MHIGH: "Text heights", MDIST: "Character spacing",
  MPEN: "Text color numbers", MOFST: "Text reference offsets",
};
const GENERAL_LABELS = {
  S_COMM_0: ["Startup group / layer", "Clock-menu drag distance", "Default paper size", "Visible-layer reference lines only", "Visible-layer points only", "AUTO page-switch distance", "Preview embedded print text", "JWC / DXF overwrite and backup mode", "Text / chamfer / door defaults", "File-dialog divisions"],
  S_COMM_1: ["Auto-save interval (minutes)", "Show temporary marks at read points", "Keep left clock-menu AM / PM", "Keep right clock-menu AM / PM", "Confirm numeric position with arrow keys", "Double-line operation mode", "Erase operation mode", "File-read options", "Backup file count"],
  S_COMM_2: ["Scale screen line width with zoom", "Maximum line width / unit", "Print-preview background and origin", "Use eighth-circle snap", "Start in AUTO mode", "Circle-length acquisition mode", "Show paper frame", "Keep layer when line type changes", "Overwrite warning mode"],
  S_COMM_3: ["Large numeric-input text", "Large status-bar text", "Count text in two-byte units", "Text / frame display threshold", "Hold mouse button for zoom", "Mouse gesture H / V toggle", "Font display ratio", "Reset layers for a new file", "Image and solid drawing order"],
  S_COMM_4: ["Crossline cursor mode", "Visible-layer attributes only", "Reverse drawing order", "Reverse search order", "Clock menu after leaving AUTO", "Use standard clock menu", "Hidden-layer behavior", "Keep line-command dimension", "Search range (dots)"],
  S_COMM_5: ["Choose text position before typing", "Shape insertion layer mode", "Shape insertion color mode", "Shape insertion line-type mode", "Backslash numeric-input behavior", "Arrow-key zoom mode", "Draw real points with specified screen radius (max 100 dots)", "Print real points with specified radius (mm)", "Print circles as line segments"],
  S_COMM_6: ["Undo count", "Paste layer mode", "Paste color mode", "Paste line-type mode", "Inactive drawing-time threshold", "Allow drawing-time changes", "Show drawing time", "Measure / spreadsheet default", "Use key commands in AUTO"],
  S_COMM_7: ["Show layer-group name", "Reset copy / paste attributes", "Hide endpoint dimension", "Double-line click interval", "Copy / move click interval", "2.5D view interval", "Spaces around 2.5D separators", "Proportional-division mode", "Shape-file list mode"],
  S_COMM_8: ["Visible-only layer read controls", "Reserved", "Save / load dimension settings", "Dimension-value screen color", "Disable transform preview", "Close layer list after selection", "Mouse wheel while drawing", "Swap attribute click actions", "Default three-point mode to arc"],
  S_COMM_9: ["Auxiliary-point screen radius", "Temporary continuous-line type", "Block-tree transparency", "Repeat erase / dimension behavior"],
  MSET: ["Right-click text type", "Right-click reference point", "Text input dialog mode", "Text input width (dots)", "Text input height (dots)", "Image read width", "Background drawing mode", "Text-range expansion (mm)", "Keep text angle"],
  MHEN: ["Existing text conversion", "Default font"],
  MOFST: ["Use text reference offsets", "X offset — left", "X offset — center", "X offset — right", "Y offset — lower", "Y offset — center", "Y offset — upper", "Remember reference point for JWC / DXF"],
};
const BOOLEAN_FIELDS = new Set([
  "S_COMM_0:3","S_COMM_0:4","S_COMM_0:6","S_COMM_1:1","S_COMM_1:2","S_COMM_1:3","S_COMM_1:4",
  "S_COMM_2:0","S_COMM_2:3","S_COMM_2:4","S_COMM_2:5","S_COMM_2:6","S_COMM_2:7","S_COMM_2:8",
  "S_COMM_3:0","S_COMM_3:1","S_COMM_3:2","S_COMM_3:4","S_COMM_3:5","S_COMM_3:7",
  "S_COMM_4:1","S_COMM_4:2","S_COMM_4:3","S_COMM_4:5","S_COMM_4:7",
  "S_COMM_5:0","S_COMM_5:2","S_COMM_5:3","S_COMM_5:4","S_COMM_5:6","S_COMM_5:7","S_COMM_5:8",
  "S_COMM_6:2","S_COMM_6:3","S_COMM_6:5","S_COMM_6:6","S_COMM_6:8","S_COMM_7:0","S_COMM_7:2",
  "S_COMM_7:6","S_COMM_7:7","S_COMM_8:5","S_COMM_8:6","S_COMM_8:7","S_COMM_8:8","S_COMM_9:3",
  "MSET:8","MOFST:0","MOFST:7",
]);

const GENERAL_NUMBER_BEHAVIOR = {
  "S_COMM_1:0": "Higher values increase the time between automatic saves.",
  "S_COMM_1:8": "Sets how many backup files Jw_cad keeps.",
  "S_COMM_6:0": "Higher values keep more operations available for Undo; 0 keeps no Undo history.",
  "S_COMM_0:1": "Higher values require a longer mouse drag before the clock menu opens.",
  "S_COMM_3:3": "Sets the on-screen dot threshold for switching between text and frame display.",
  "S_COMM_3:6": "Higher values display text larger on screen; the stored text size is unchanged.",
  "S_COMM_0:5": "Higher values require a longer drag to switch between AUTO clock-menu pages.",
  "S_COMM_6:4": "Drawing-time counting pauses after this many inactive seconds; higher values wait longer.",
  "ZOOM:4": "Higher values widen the both-button drag zone used to choose a zoom action.",
  "ZOOM:5": "Higher values move the view farther with each arrow-key operation.",
  "ZOOM:6": "Higher values make each keyboard zoom step larger.",
  "ZOOM:7": "Higher values move farther when a mark-jump action is used.",
};

let profile = null;
let appliedText = "";
let active = "general1";

function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = String(text);
  return node;
}
function status(message, state = "ready") { ui.status.textContent = message; ui.dot.dataset.state = state; }
function entryTitle(entry) {
  if (TITLES[entry.key]) return TITLES[entry.key];
  const layerDefault = entry.key.match(/^(LAYNAM|LAYCOL|LAYWID|LAYTYP)_([0-9A-F])$/);
  if (layerDefault) {
    const names = { LAYNAM:"Layer names", LAYCOL:"Default layer colors", LAYWID:"Default layer widths", LAYTYP:"Default layer line types" };
    return `${names[layerDefault[1]]} — Group ${layerDefault[2]}`;
  }
  const color = entry.key.match(/^(P?LCOLLOR)_(.+)$/);
  if (color) return `${color[1] === "PCOLLOR" ? "Print" : "Screen"} color ${color[2]}`;
  const line = entry.key.match(/^LTYPE_(.+)$/);
  if (line) return `Line type ${line[1]}`;
  const key = entry.key.match(/^KEY_?(.+)$/);
  if (key) return `Key ${key[1]}`;
  return entry.definition?.label || entry.key.replaceAll("_", " ");
}
function fieldName(entry, index) {
  if (/^(MWIDE|MHIGH|MDIST|MPEN)$/.test(entry.key)) return `Text type ${index + 1}`;
  if (/^LAYNAM_[0-9A-F]$/.test(entry.key)) return index === 0 ? "Group name" : `Layer ${(index - 1).toString(16).toUpperCase()}`;
  if (/^(LAYCOL|LAYWID|LAYTYP)_[0-9A-F]$/.test(entry.key)) return `Layer ${index.toString(16).toUpperCase()}`;
  return GENERAL_LABELS[entry.key]?.[index] || entry.definition?.valueSchema?.[index] || `Value ${index + 1}`;
}
function entriesFor(tab) {
  if (!profile || !GROUPS[tab]) return [];
  return profile.parsed.keys.map((key) => profile.parsed.entries[key])
    .filter((entry) => GROUPS[tab].some((pattern) => pattern.test(entry.key)));
}
function hasPending() { return Boolean(profile && profile.text !== appliedText); }
function refreshChrome() {
  if (!profile) return;
  const preflight = preflightJwfProfileSave(profile);
  ui.name.textContent = profile.sourceName || "Local JWF profile";
  ui.detail.textContent = "Environment Profile · Shift_JIS · separate from the open JWW drawing";
  ui.metrics.replaceChildren();
  for (const [label, value] of [["Keys", profile.validation.keyCount], ["Errors", profile.validation.errors.length], ["Warnings", profile.validation.warnings.length]]) {
    const item = el("span", "compact-metric"); item.append(el("small", "", label), el("strong", "", value)); ui.metrics.append(item);
  }
  ui.export.disabled = !preflight.ok;
  ui.source.disabled = false;
  ui.apply.disabled = !hasPending();
}
function mutateEntry(entry, index, value) {
  const values = [...(profile.parsed.entries[entry.key]?.values || entry.values)];
  values[index] = value;
  profile = updateJwfProfileEntry(profile, entry.key, values);
  refreshChrome();
  status(`${entry.key} changed. Select Apply to keep this edit in the current session.`, "ready");
}
function numericConstraint(entry,index) {
  if (/^(?:L|P)COLLOR_/.test(entry.key)&&index<3) return { min:0,max:255,step:1,label:"0–255" };
  if (/^LCOLLOR_(?:[1-8]|H)$/.test(entry.key)&&index===3) return { min:1,max:16,step:1,label:"1–16" };
  if (/^PCOLLOR_[1-8]$/.test(entry.key)&&index===3) return { min:1,max:500,step:1,label:"1–500" };
  if (/^PCOLLOR_[1-8]$/.test(entry.key)&&index===4) return { min:.1,max:10,step:.1,label:"0.1–10" };
  if (/^LTYPE_(?:0[2-9]|L[1-4])$/.test(entry.key)) {
    if (index===1) return { min:1,max:32,step:1,label:"1–32" };
    if (index===2) return { min:1,max:16,step:1,label:"1–16" };
    if (index===3) return { min:1,max:160,step:1,label:"1–160" };
  }
  if (/^LTYPE_R[1-5]$/.test(entry.key)) {
    if ([1,2,3].includes(index)) return { min:1,max:16,step:1,label:"1–16" };
    if (index===4) return { min:1,max:160,step:1,label:"1–160" };
  }
  if (/^(MWIDE|MHIGH)$/.test(entry.key)) return { min:.1,max:500,step:.1,label:"0.1–500" };
  if (entry.key==="MDIST") return { min:-100,max:500,step:.1,label:"-100–500" };
  if (entry.key==="MPEN") return { min:1,max:9,step:1,label:"1–9" };
  if (entry.key==="MSET") {
    if (index===5) return { min:-1000,max:1000,step:1,label:"-1000–-10 or 10–1000",valid:(value)=>Math.abs(value)>=10&&Math.abs(value)<=1000 };
    if (index===6) return { min:0,max:12,step:1,label:"0, 1, 2, 10, 11, or 12",valid:(value)=>[0,1,2,10,11,12].includes(value) };
    const ranges=[[0,10,1],[1,9,1],[0,4,1],[500,5000,1],[40,400,1],null, null,[-1,10,.1],[0,1,1]];
    const [min,max,step]=ranges[index]||[]; if (min!==undefined) return { min,max,step,label:`${min}–${max}` };
  }
  if (entry.key==="LAYSCALE") return { min:0,max:3000000,step:.01,label:"0–3000000" };
  if (/^LAYCOL_[0-9A-F]$/.test(entry.key)) return { min:0,max:9,step:1,label:"0–9" };
  if (/^LAYWID_[0-9A-F]$/.test(entry.key)) return { min:-2,max:30000,step:1,label:"-2–30000" };
  if (/^LAYTYP_[0-9A-F]$/.test(entry.key)) return { min:0,max:19,step:1,excluded:new Set([10]),label:"0–19 except 10" };
  if (entry.key === "LTYPE_HC") {
    if ([0,1,3,4].includes(index)) return { min:1,max:9,step:1,label:"1–9" };
    if (index === 2) return { min:0,max:1,step:1,label:"0–1" };
    if (index === 5) return { min:0,max:2,step:1,label:"0–2" };
  }
  return null;
}
function numericBehavior(entry, index) {
  const exact = GENERAL_NUMBER_BEHAVIOR[`${entry.key}:${index}`];
  if (exact) return exact;
  if (/^(?:L|P)COLLOR_/.test(entry.key) && index < 3) {
    return `Higher values add more ${["red", "green", "blue"][index]} to this color.`;
  }
  if (/^LCOLLOR_(?:[1-8]|H)$/.test(entry.key) && index === 3) return "Higher values draw this screen line thicker.";
  if (/^PCOLLOR_[1-8]$/.test(entry.key) && index === 3) return "Higher values print this line thicker.";
  if (/^PCOLLOR_[1-8]$/.test(entry.key) && index === 4) return "Higher values print real points with a larger radius.";
  if (/^LTYPE_(?:0[2-9]|L[1-4])$/.test(entry.key)) {
    return [
      "Changes the 32-bit dash pattern used by this line type.",
      "Higher values use more dots in one repeating pattern unit.",
      "Higher values lengthen the pattern pitch on screen.",
      "Higher values lengthen the pattern pitch in printer output.",
    ][index] || "Changes this line-type pattern value.";
  }
  if (/^LTYPE_R[1-5]$/.test(entry.key)) {
    return [
      "Changes the 32-bit random-line pattern.",
      "Higher values increase the random amplitude on screen.",
      "Higher values lengthen the random pattern pitch on screen.",
      "Higher values increase the random amplitude in printer output.",
      "Higher values lengthen the random pattern pitch in printer output.",
    ][index] || "Changes this random-line parameter.";
  }
  if (entry.key === "MWIDE") return "Higher values make this text type wider.";
  if (entry.key === "MHIGH") return "Higher values make this text type taller.";
  if (entry.key === "MDIST") return "Higher values increase character spacing; negative values tighten it.";
  if (entry.key === "MPEN") return "Selects line color 1–8, or 9 for the auxiliary color.";
  if (entry.key === "MSET") {
    return [
      "0 selects custom size; 1–10 select the text type recalled by right-click.",
      "1–9 select the reference point recalled by right-click: lower-left is 1 and upper-right is 9.",
      "0 keeps the standard dialog; 1–4 resize it and progressively hide font controls.",
      "Higher values make the text input dialog wider.",
      "Higher values make the text input dialog taller.",
      "Absolute values 10–1000 set image-read width; a negative value stores same-folder images by file name only.",
      "Ones digit: 0 none, 1 outline, 2 range. Tens digit 1 draws dimension/block text last.",
      "Higher values enlarge the background text range; -1–10 mm.",
      "Off allows the write angle to change; On keeps the current angle.",
    ][index] || "Changes this text-command setting.";
  }
  if (entry.key === "LAYSCALE") return "Sets this layer group's scale denominator; higher values make the paper-scale view smaller.";
  if (/^LAYCOL_[0-9A-F]$/.test(entry.key)) return "0 keeps the current color; 1–8 select a line color; 9 selects the auxiliary color.";
  if (/^LAYWID_[0-9A-F]$/.test(entry.key)) return "-2 keeps the current width; -1 uses the current color width; 0–30000 sets a width.";
  if (/^LAYTYP_[0-9A-F]$/.test(entry.key)) return "0 keeps the current line type; 1–19 select a line type (10 is unused).";
  if (entry.key === "LTYPE_HC") {
    const notes = [
      "Selects the temporary selection-frame line type number.",
      "Selects the crossline-cursor line type number.",
      "0 keeps a fixed dash pitch; 1 adjusts the pitch automatically.",
      "Selects the right-click reference line color number.",
      "Selects the right-click reference line type number.",
      "0 = round, 1 = square, 2 = flat line ends.",
    ];
    return notes[index] || "Changes this JWF-only helper setting.";
  }
  if (/^(?:KEY|N_KEY)/.test(entry.key)) return "0 disables the shortcut; a nonzero command number assigns the shortcut.";
  if (/^(?:LD|RD|LD2|RD2)_(?:AM|PM)$/.test(entry.key)) return "0 cancels; positive selects a command; negative selects it and keeps it active.";
  if (/^(?:COM_|GCOM_|AC_COM|WD_COM)/.test(entry.key)) return "Selects the Jw_cad command number used at this position.";
  const constraint = numericConstraint(entry, index);
  const range = constraint ? ` Allowed: ${constraint.label}.` : "";
  return `Raw JWF value for ${fieldName(entry, index)}.${range} Keep the original value unless its Jw_cad behavior is known.`;
}
function appendBehavior(control, description) {
  if (description) control.append(el("small", "field-behavior", description));
  return control;
}
const basicPalette = [
  "#ff8080","#ffff80","#80ff80","#00ff80","#80ffff","#0080ff","#ff80c0","#ff80ff",
  "#ff0000","#ffff00","#80ff00","#00ff40","#00ffff","#0080c0","#8080c0","#ff00ff",
  "#804040","#ff8040","#00ff00","#008080","#004080","#8080ff","#800040","#ff0080",
  "#800000","#ff8000","#008000","#008040","#0000ff","#0000a0","#800080","#8000ff",
  "#400000","#804000","#004000","#004040","#000080","#000040","#400040","#400080",
  "#000000","#808000","#808040","#808080","#408080","#c0c0c0","#400040","#ffffff",
];
const customPalette = Array(16).fill("#d4d4d4");
function clamp(value, maximum) { return Math.max(0, Math.min(maximum, Number(value) || 0)); }
function hslToRgb(hue, saturation, lightness) {
  const h = ((Number(hue) % 360) + 360) % 360 / 360;
  const s = clamp(saturation, 100) / 100;
  const l = clamp(lightness, 100) / 100;
  if (s === 0) return [l, l, l].map((value) => Math.round(value * 255));
  const q = l < .5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (offset) => {
    let t = h + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(1 / 3), channel(0), channel(-1 / 3)].map((value) => Math.round(value * 255));
}
function rgbToHsl(red, green, blue) {
  const [r, g, b] = [red, green, blue].map((value) => clamp(value, 255) / 255);
  const maximum = Math.max(r, g, b); const minimum = Math.min(r, g, b); const delta = maximum - minimum;
  let hue = 0;
  if (delta) {
    if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
    else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0;
  return [Math.round(hue), Math.round(saturation * 100), Math.round(lightness * 100)];
}
function openColorDialog(entry, label) {
  const dialog = el("dialog", "jwf-color-dialog");
  const titleBar = el("div", "color-dialog-title", "Color Settings");
  const form = el("form", "color-dialog-body"); form.method = "dialog";
  const working = entry.values.slice(0, 3).map((value) => clamp(value, 255));
  let hsl = rgbToHsl(...working);
  const rgbInputs = []; const hslInputs = [];
  const colorHex = () => `#${working.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
  const palettePanel = el("section", "dialog-palette-panel");
  palettePanel.append(el("h3", "dialog-section-title", "Basic Colors"));
  const basicGrid = el("div", "basic-color-grid");
  const choose = (hex) => {
    [1,3,5].forEach((start,index) => { working[index] = Number.parseInt(hex.slice(start,start+2),16); });
    hsl = rgbToHsl(...working); refresh();
  };
  basicPalette.forEach((hex) => { const button = el("button", "palette-color"); button.type = "button"; button.style.backgroundColor = hex; button.setAttribute("aria-label", `Basic color ${hex}`); button.addEventListener("click", () => choose(hex)); basicGrid.append(button); });
  palettePanel.append(basicGrid, el("h3", "dialog-section-title custom-title", "Custom Colors"));
  const customGrid = el("div", "custom-color-grid");
  const renderCustom = () => { customGrid.replaceChildren(); customPalette.forEach((hex,index) => { const button = el("button", "palette-color custom-color"); button.type = "button"; button.style.backgroundColor = hex; button.setAttribute("aria-label", `Custom color ${index + 1}`); button.addEventListener("click", () => choose(hex)); customGrid.append(button); }); };
  renderCustom(); palettePanel.append(customGrid);
  const spectrumPanel = el("section", "dialog-spectrum-panel");
  const spectrumRow = el("div", "spectrum-row");
  const spectrum = el("canvas", "color-spectrum"); spectrum.width = 240; spectrum.height = 220; spectrum.setAttribute("aria-label", "Color spectrum");
  const spectrumContext = spectrum.getContext("2d");
  const hueGradient = spectrumContext.createLinearGradient(0,0,spectrum.width,0);
  [[0,"#f00"],[1/6,"#ff0"],[2/6,"#0f0"],[3/6,"#0ff"],[4/6,"#00f"],[5/6,"#f0f"],[1,"#f00"]].forEach(([offset,color]) => hueGradient.addColorStop(offset,color));
  spectrumContext.fillStyle = hueGradient; spectrumContext.fillRect(0,0,spectrum.width,spectrum.height);
  const shadeGradient = spectrumContext.createLinearGradient(0,0,0,spectrum.height);
  shadeGradient.addColorStop(0,"rgba(255,255,255,1)"); shadeGradient.addColorStop(.5,"rgba(255,255,255,0)"); shadeGradient.addColorStop(.5,"rgba(0,0,0,0)"); shadeGradient.addColorStop(1,"rgba(0,0,0,1)");
  spectrumContext.fillStyle = shadeGradient; spectrumContext.fillRect(0,0,spectrum.width,spectrum.height);
  const lightness = el("canvas", "lightness-strip"); lightness.width = 20; lightness.height = 220; lightness.setAttribute("aria-label", "Lightness");
  const lightnessContext = lightness.getContext("2d"); const lightnessGradient = lightnessContext.createLinearGradient(0,0,0,lightness.height); lightnessGradient.addColorStop(0,"#fff"); lightnessGradient.addColorStop(1,"#000"); lightnessContext.fillStyle = lightnessGradient; lightnessContext.fillRect(0,0,lightness.width,lightness.height);
  const pickSpectrum = (event) => { const bounds = spectrum.getBoundingClientRect(); hsl[0] = Math.round(clamp((event.clientX - bounds.left) / bounds.width * 359,359)); hsl[1] = 100; hsl[2] = Math.round(clamp(100 - (event.clientY - bounds.top) / bounds.height * 100,100)); working.splice(0,3,...hslToRgb(...hsl)); refresh(); };
  spectrum.addEventListener("pointerdown", pickSpectrum);
  lightness.addEventListener("pointerdown", (event) => { const bounds = lightness.getBoundingClientRect(); hsl[2] = Math.round(clamp(100 - (event.clientY - bounds.top) / bounds.height * 100,100)); working.splice(0,3,...hslToRgb(...hsl)); refresh(); });
  spectrumRow.append(spectrum,lightness); spectrumPanel.append(spectrumRow);
  const detailRow = el("div", "color-detail-row"); const preview = el("div", "dialog-color-preview"); preview.setAttribute("aria-label", `${label} color preview`);
  const valueColumns = el("div", "dialog-value-columns"); const hslFields = el("div", "dialog-number-fields"); const rgbFields = el("div", "dialog-number-fields");
  const numberField = (name, maximum, collection, onInput) => { const field = el("label"); field.append(el("span", "", name)); const input = el("input"); input.type = "number"; input.min = "0"; input.max = String(maximum); input.addEventListener("change", onInput); field.append(input); collection.push(input); return field; };
  ["Hue","Saturation","Lightness"].forEach((name,index) => hslFields.append(numberField(name,index ? 100 : 359,hslInputs,() => { hsl[index] = clamp(hslInputs[index].value,index ? 100 : 359); working.splice(0,3,...hslToRgb(...hsl)); refresh(); })));
  ["Red","Green","Blue"].forEach((name,index) => rgbFields.append(numberField(name,255,rgbInputs,() => { working[index] = clamp(rgbInputs[index].value,255); hsl = rgbToHsl(...working); refresh(); })));
  valueColumns.append(hslFields,rgbFields); detailRow.append(preview,valueColumns); spectrumPanel.append(detailRow);
  const addCustom = el("button", "add-custom-color", "Add to Custom Colors"); addCustom.type = "button"; addCustom.addEventListener("click", () => { const empty = customPalette.indexOf("#d4d4d4"); customPalette[empty >= 0 ? empty : customPalette.length - 1] = colorHex(); renderCustom(); }); spectrumPanel.append(addCustom);
  const actions = el("div", "color-dialog-actions"); const ok = el("button", "dialog-button primary-dialog-button", "OK"); ok.type = "submit"; ok.value = "ok"; const cancel = el("button", "dialog-button", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", () => dialog.close("cancel")); actions.append(ok,cancel);
  const refresh = () => { preview.style.backgroundColor = colorHex(); rgbInputs.forEach((input,index) => { input.value = String(Math.round(working[index])); }); hslInputs.forEach((input,index) => { input.value = String(Math.round(hsl[index])); }); };
  form.append(palettePanel,spectrumPanel,actions); dialog.append(titleBar,form); document.body.append(dialog); refresh();
  dialog.addEventListener("close", () => { if (dialog.returnValue === "ok") { const revised = [...profile.parsed.entries[entry.key].values]; working.forEach((value,index) => { revised[index] = Math.round(value); }); profile = updateJwfProfileEntry(profile,entry.key,revised); refreshChrome(); render(); status(`${label} color changed.`,"ready"); } dialog.remove(); });
  dialog.showModal();
}
function inputFor(entry, index, value, { describe = true } = {}) {
  if (BOOLEAN_FIELDS.has(`${entry.key}:${index}`) && [0, 1].includes(Number(value))) {
    const label = el("label", "check-field");
    const input = el("input"); input.type = "checkbox"; input.checked = Number(value) === 1;
    input.addEventListener("change", () => mutateEntry(entry, index, input.checked ? 1 : 0));
    label.append(input, el("span", "", fieldName(entry, index))); return label;
  }
  const label = el("label", "value-field"); label.append(el("span", "", fieldName(entry, index)));
  const input = el("input");
  const numeric = typeof value === "number" || (String(value).trim() !== "" && Number.isFinite(Number(value)));
  const linePattern = /^LTYPE_(?:0[2-9]|R[1-5]|L[1-4])$/.test(entry.key) && index === 0;
  const constraint = numeric ? numericConstraint(entry,index) : null;
  input.type = numeric&&constraint ? "number" : "text"; input.value = value ?? "";
  if (constraint) { input.min=String(constraint.min); input.max=String(constraint.max); input.step=String(constraint.step); input.title=`Allowed: ${constraint.label}`; }
  if (linePattern) { input.pattern="[0-9a-fA-F]{8}"; input.maxLength=8; input.title="Enter exactly eight hexadecimal digits (00000001–ffffffff)."; }
  const validate = () => { const next=Number(input.value); const excluded=constraint?.excluded?.has(next); const invalidValue=constraint?.valid&&!constraint.valid(next); const invalidPattern=linePattern&&!/^[0-9a-fA-F]{8}$/.test(input.value); input.setCustomValidity(excluded||invalidValue?`Enter ${constraint.label}.`:invalidPattern?"Enter exactly eight hexadecimal digits.":""); return !excluded&&!invalidValue&&!invalidPattern&&input.checkValidity(); };
  input.addEventListener("input",validate);
  input.addEventListener("change", () => { if ((numeric||linePattern)&&!validate()) { status(`${entry.key} ${fieldName(entry,index)} must be ${linePattern?"exactly eight hexadecimal digits":constraint?.label||"a valid number"}.`,"error"); return; } mutateEntry(entry,index,numeric?Number(input.value):input.value); });
  label.append(input); return appendBehavior(label, numeric && describe ? numericBehavior(entry, index) : "");
}
function general1Entry(key, index) {
  const entry = profile.parsed.entries[key];
  return entry?.values?.length > index ? entry : null;
}
function general1Checkbox(key, index, label, options = {}) {
  const entry = general1Entry(key, index); const control = el("label", "g1-check"); const input = el("input"); input.type = "checkbox";
  const raw = entry ? Number(entry.values[index]) || 0 : 0;
  input.checked = entry ? (options.read ? options.read(raw) : raw === 1) : false; input.disabled = !entry;
  if (!entry) control.title = `${key} is not present in this JWF.`;
  input.addEventListener("change", () => { const current = Number(profile.parsed.entries[key].values[index]) || 0; mutateEntry(profile.parsed.entries[key],index,options.write ? options.write(input.checked,current) : input.checked ? 1 : 0); if (options.rerender) render(); });
  control.append(input,el("span","",label)); return control;
}
function general1Number(key, index, label, options = {}) {
  const entry = general1Entry(key,index); const control = el("label","g1-number"); const caption = el("span","",label); const input = el("input"); input.type = "number";
  if (options.min !== undefined) input.min = String(options.min); if (options.max !== undefined) input.max = String(options.max); if (options.step !== undefined) input.step = String(options.step);
  const raw = entry ? entry.values[index] : ""; input.value = entry ? String(options.read ? options.read(raw) : raw) : ""; input.placeholder = entry ? "" : "Not in JWF"; input.disabled = !entry;
  input.addEventListener("change", () => { const numeric = Number(input.value); if (!Number.isFinite(numeric)) return; const bounded = Math.max(options.min ?? -Infinity,Math.min(options.max ?? Infinity,numeric)); const current = profile.parsed.entries[key].values[index]; mutateEntry(profile.parsed.entries[key],index,options.write ? options.write(bounded,current) : bounded); });
  control.append(caption,input); return appendBehavior(control, GENERAL_NUMBER_BEHAVIOR[`${key}:${index}`]);
}
function unavailableGeneral1(label, value = "Not stored in JWF") {
  const control = el("label","g1-number g1-unavailable"); control.append(el("span","",label)); const input = el("input"); input.type = "text"; input.value = value; input.disabled = true; control.append(input); return control;
}
function decimalDigit(value, place) { return Math.floor(Math.abs(Number(value) || 0) / place) % 10; }
function replaceDecimalDigit(value, place, digit) {
  const numeric = Number(value) || 0; const sign = numeric < 0 ? -1 : 1; const absolute = Math.abs(numeric); const previous = decimalDigit(absolute,place);
  return sign * (absolute - previous * place + Number(digit) * place);
}
function general1DigitCheckbox(key,index,place,label) {
  return general1Checkbox(key,index,label,{ read:(value)=>decimalDigit(value,place) === 1, write:(checked,value)=>replaceDecimalDigit(value,place,checked ? 1 : 0) });
}
function renderGeneral1() {
  const section = el("section","general1-panel"); section.append(el("h2","g1-title","General Settings (1)"));
  const top = el("div","g1-top-grid");
  top.append(unavailableGeneral1("External editor","Application setting"),unavailableGeneral1("Screen width (mm)","Application setting"),unavailableGeneral1("Overall view mode","Application setting"),unavailableGeneral1("Screen horizontal pixels","Application setting"));
  top.append(general1Number("S_COMM_1",0,"Auto-save interval (1–1000 min)",{min:1,max:1000}),general1Number("S_COMM_1",8,"Backup file count",{min:-9,max:9}),general1Number("S_COMM_6",0,"Undo count",{min:0,max:1000}));
  section.append(top);
  const options = el("div","g1-options-grid");
  const left = el("div","g1-column"); const right = el("div","g1-column");
  left.append(general1Checkbox("S_COMM_0",1,"Do not use clock menus",{read:(value)=>Math.abs(value)>=1020,write:(checked,value)=>{const drag=Math.max(20,Math.min(200,Math.abs(value)%1000||35));return checked?1000+drag:drag;},rerender:true}));
  right.append(general1Checkbox("S_COMM_1",2,"Keep previous AM/PM state for left clock menu"),general1Checkbox("S_COMM_1",3,"Keep previous AM/PM state for right clock menu"));
  left.append(general1Checkbox("S_COMM_1",1,"Show temporary marks at read points"));
  right.append(general1Number("S_COMM_0",1,"Clock-menu drag distance (20–200)",{min:20,max:200,read:(value)=>Math.abs(Number(value))%1000,write:(next,value)=>Math.abs(Number(value))>=1000?1000+next:Number(value)<0?-next:next}));
  left.append(general1DigitCheckbox("S_COMM_1",5,1,"Continue double-line spacing after Enter"));
  right.append(general1DigitCheckbox("S_COMM_1",6,1,"Redisplay erased portions"));
  const fileRead = el("fieldset","g1-subgroup g1-span-2"); fileRead.append(el("legend","","File read options")); const fileChecks=el("div","g1-inline-checks"); fileChecks.append(general1DigitCheckbox("S_COMM_1",7,1,"Line colors, line types, and point radii"),general1DigitCheckbox("S_COMM_1",7,10,"Drawing and print state"),general1DigitCheckbox("S_COMM_1",7,100,"Text reference-point offsets")); fileRead.append(fileChecks);
  options.append(left,right,fileRead);
  const rows = el("div","g1-wide-options");
  rows.append(general1DigitCheckbox("S_COMM_2",2,1,"Use white background for printer output images"),general1Checkbox("S_COMM_2",3,"Use eighth-circle snap instead of quarter-circle snap"),general1Checkbox("S_COMM_2",4,"Start with AUTO mode"),general1Checkbox("S_COMM_2",5,"Acquire circumference instead of radius"),general1Checkbox("S_COMM_2",6,"Show paper frame"),general1Checkbox("S_COMM_3",0,"Use large text for numeric input"),general1Checkbox("S_COMM_3",1,"Use large status-bar text"),general1Checkbox("S_COMM_3",2,"Count text-box length in two-byte units"));
  const paired = el("div","g1-paired-numbers"); paired.append(general1Number("S_COMM_3",3,"Text/frame display switching threshold",{min:2,max:1000}),general1Number("S_COMM_3",6,"Text font display ratio",{min:.5,max:2,step:.01})); rows.append(paired);
  rows.append(general1Checkbox("S_COMM_3",4,"Hold left/right mouse button for one second to zoom"),general1Checkbox("S_COMM_3",5,"Switch horizontal/vertical and diagonal line by four mouse moves"));
  const crossline = el("fieldset","g1-subgroup"); crossline.append(el("legend","","Crossline cursor")); const crossEntry=general1Entry("S_COMM_4",0); const crossValue=crossEntry?Number(crossEntry.values[0])||0:0; const crossMaster=general1Checkbox("S_COMM_4",0,"Use crossline cursor",{read:(value)=>value!==0,write:(checked,value)=>checked?(value||1):0,rerender:true}); const modes=el("div","g1-radio-row"); [[2,"Range selection only"],[3,"Range start only"]].forEach(([value,label])=>{const item=el("label","g1-radio");const radio=el("input");radio.type="radio";radio.name="crossline-mode";radio.checked=crossValue===value;radio.disabled=!crossEntry||crossValue===0;radio.addEventListener("change",()=>{if(radio.checked){mutateEntry(profile.parsed.entries.S_COMM_4,0,value);render();}});item.append(radio,el("span","",label));modes.append(item);}); crossline.append(crossMaster,modes); rows.append(crossline);
  rows.append(general1Checkbox("S_COMM_4",1,"Acquire attributes from display-only layers"),unavailableGeneral1("Use monitor dialog for file selection"),general1Checkbox("S_COMM_4",2,"Reverse drawing order"));
  const imageOrder = el("fieldset","g1-subgroup"); imageOrder.append(el("legend","","Image and solid drawing order")); imageOrder.append(general1Checkbox("S_COMM_3",8,"Draw image/solid data first",{read:(value)=>[1,2].includes(decimalDigit(value,1)),write:(checked,value)=>replaceDecimalDigit(value,1,checked?(decimalDigit(value,1)===2?2:1):0),rerender:true}),general1Checkbox("S_COMM_3",8,"Draw solids before images",{read:(value)=>decimalDigit(value,1)===2,write:(checked,value)=>replaceDecimalDigit(value,1,checked?2:1),rerender:true}));
  const orderEntry=general1Entry("S_COMM_3",8); const orderValue=orderEntry?decimalDigit(orderEntry.values[8],10):0; const orderSelect=el("label","g1-number"); orderSelect.append(el("span","","Solid ordering key")); const select=el("select"); [[0,"Layer order"],[3,"Reverse layer order"],[1,"Color number order"],[2,"Reverse color number order"],[6,"Printer output setting order"]].forEach(([value,label])=>{const option=el("option","",label);option.value=String(value);option.selected=orderValue===value;select.append(option);});select.disabled=!orderEntry;select.addEventListener("change",()=>mutateEntry(profile.parsed.entries.S_COMM_3,8,replaceDecimalDigit(profile.parsed.entries.S_COMM_3.values[8],10,Number(select.value))));orderSelect.append(select); imageOrder.append(orderSelect); rows.append(imageOrder);
  rows.append(general1Checkbox("S_COMM_3",7,"For a new file, reset layer names/states and reload the environment profile"),general1Checkbox("S_COMM_4",3,"Reverse search order"));
  section.append(options,rows);
  const counts=el("div","g1-counts"); ["Lines","Circles","Text","Points","Dimensions","Blocks/Solids"].forEach((label)=>{const item=el("span","");item.append(el("small","",label),el("strong","","—"));counts.append(item);}); section.append(counts,el("p","g1-footnote","Entity counts and Windows-only application settings are not stored in a JWF profile.")); ui.view.append(section);
}
function selectForEntry(key,index,label,choices,{read=(value)=>Number(value),write=(value)=>Number(value)}={}) {
  const entry=general1Entry(key,index); const control=el("label","g1-number"); control.append(el("span","",label)); const select=el("select"); const current=entry?read(entry.values[index]):null;
  choices.forEach(([value,text])=>{const option=el("option","",text);option.value=String(value);option.selected=String(current)===String(value);select.append(option);}); select.disabled=!entry;
  if (!entry) control.title=`${key} is not present in this JWF.`;
  select.addEventListener("change",()=>mutateEntry(profile.parsed.entries[key],index,write(select.value,profile.parsed.entries[key].values[index]))); control.append(select); return control;
}
function renderGeneral2() {
  const section=el("section","general1-panel general2-panel"); section.append(el("h2","g1-title","General Settings (2)"));
  const top=el("fieldset","g1-subgroup"); top.append(el("legend","","AUTO clock-menu behavior")); const topGrid=el("div","g2-top-grid");
  topGrid.append(selectForEntry("S_COMM_4",4,"After leaving AUTO mode",[[0,"Per-command setting"],[1,"Command selection uses AUTO menu"],[2,"All commands use AUTO menu"],[3,"Add selection on repeated range selection"]]),general1Number("S_COMM_0",5,"AUTO menu 1/2 switch distance (50–1000)",{min:50,max:1000}),general1Checkbox("S_COMM_4",5,"Use the standard clock menu for all non-AUTO commands"),general1Checkbox("S_COMM_6",8,"Use key commands in AUTO mode")); top.append(topGrid); section.append(top);
  const body=el("div","g1-wide-options");
  body.append(selectForEntry("S_COMM_4",6,"Hidden-layer command behavior",[[0,"Make layer hidden"],[1,"Make layer display-only"],[2,"Make all layers hidden"],[3,"Make all layers display-only"]],{read:(value)=>decimalDigit(value,1),write:(next,value)=>replaceDecimalDigit(value,1,next)}),general1Checkbox("S_COMM_4",7,"Keep the line-command dimension value"),general1Checkbox("S_COMM_2",7,"Do not change the layer when changing line type"),general1Checkbox("S_COMM_5",0,"Choose the text position before entering text"),general1Checkbox("S_COMM_0",6,"Show embedded file name and output date in print preview"),unavailableGeneral1("Use metre-unit input"),general1Checkbox("S_COMM_5",4,"Use ×1000 for backslash numeric input"),unavailableGeneral1("Confirm offset/copy/move values with End or +"),general1Checkbox("S_COMM_1",4,"Confirm copy/parametric numeric input with arrow keys"));
  const drawingTime=el("fieldset","g1-subgroup"); drawingTime.append(el("legend","","Drawing time")); const timeGrid=el("div","g2-three-grid"); timeGrid.append(general1Number("S_COMM_6",4,"Inactive interval not counted (seconds)",{min:10,max:3600}),general1Checkbox("S_COMM_6",5,"Allow drawing-time changes"),general1Checkbox("S_COMM_6",6,"Show drawing time on the status bar")); drawingTime.append(timeGrid); body.append(drawingTime);
  const keyZoom=el("fieldset","g1-subgroup"); keyZoom.append(el("legend","","Arrow, PageUp, PageDown, and Home keys")); const keyGrid=el("div","g2-three-grid"); keyGrid.append(selectForEntry("S_COMM_5",5,"Keyboard zoom mode",[[0,"Disabled"],[1,"Screen-axis movement"],[2,"Axis-angle movement"]]),general1Number("ZOOM",5,"Movement rate (0.1–1.0)",{min:.1,max:1,step:.1}),general1Number("ZOOM",6,"Zoom factor (1.1–5.0)",{min:1.1,max:5,step:.1})); keyZoom.append(keyGrid); body.append(keyZoom);
  const drag=el("fieldset","g1-subgroup"); drag.append(el("legend","","Both-button drag zoom operation")); const dragGrid=el("div","g2-drag-grid"); const dragChoices=[[0,"No assignment"],[1,"Mark jump 1"],[2,"Mark jump 2"],[3,"Mark jump 3"],[4,"Mark jump 4"],[5,"Remember range"],[6,"Release range"],[7,"Actual size"],[8,"Whole paper"],[9,"Previous zoom"]]; [[0,"12 o'clock"],[1,"3 o'clock"],[2,"6 o'clock"],[3,"9 o'clock"]].forEach(([index,label])=>dragGrid.append(selectForEntry("ZOOM",index,label,dragChoices))); dragGrid.append(general1Number("ZOOM",4,"Movement range (2–50)",{min:2,max:50}),general1Number("ZOOM",7,"Mark-jump distance (50–1000)",{min:50,max:1000})); drag.append(dragGrid); body.append(drag);
  const wheel=el("fieldset","g1-subgroup"); wheel.append(el("legend","","Mouse and wheel application options")); const wheelGrid=el("div","g2-three-grid"); wheelGrid.append(selectForEntry("ZOOM",8,"Screen zoom",[[0,"Disabled"],[1,"Enabled (+ direction)"],[-1,"Enabled (reverse direction)"]],{read:(value)=>Math.sign(Number(value)||0),write:(next,value)=>{const tens=Math.trunc(Math.abs(Number(value)||0)/10)*10;return Number(next)<0?-(tens+1):Number(next)>0?tens+1:tens;}}),unavailableGeneral1("Shift + both-button drag screen slide"),unavailableGeneral1("Shift + left-button drag screen slide"),unavailableGeneral1("Dismiss Dial standard menu at next startup"),unavailableGeneral1("Wheel-button click selects line / line type")); wheel.append(wheelGrid); body.append(wheel);
  section.append(body,el("p","g1-footnote","Disabled controls are Jw_cad application settings that are not stored in a JWF profile.")); ui.view.append(section);
}
const VISIBLE_GENERAL_FIELDS = {
  S_COMM_0:new Set([1,5,6]), S_COMM_1:new Set([0,1,2,3,4,5,6,7,8]), S_COMM_2:new Set([2,3,4,5,6,7]), S_COMM_3:new Set([0,1,2,3,4,5,6,7,8]),
  S_COMM_4:new Set([0,1,2,3,4,5,6,7]), S_COMM_5:new Set([0,4,5]), S_COMM_6:new Set([0,4,5,6,8]), ZOOM:new Set([0,1,2,3,4,5,6,7,8]),
};
function renderOther() {
  const section=el("section","table-section"); section.append(el("h2","","Other JWF Settings"),el("p","tab-help","Settings read from this JWF that are not represented by the General (1), General (2), or dedicated settings pages remain editable here.")); const list=el("div","settings-groups"); const standardPatterns=[...GROUPS.colors,...GROUPS.lineTypes,...GROUPS.text,...GROUPS.auto,...GROUPS.keys,...GROUPS.jwfOnly]; let shown=0;
  for (const key of profile.parsed.keys) {
    const entry=profile.parsed.entries[key]; let indexes=[];
    if (/^S_COMM_[0-9]$/.test(key)||key==="ZOOM") indexes=entry.values.map((_,index)=>index).filter((index)=>!VISIBLE_GENERAL_FIELDS[key]?.has(index));
    else if (key==="R_CROSS_SET"||key==="S_MESH_0"||key==="R_STR0_00"||!standardPatterns.some((pattern)=>pattern.test(key))) indexes=entry.values.map((_,index)=>index);
    if (!indexes.length) continue; shown+=1; const group=el("fieldset","direct-group"); const legend=el("legend"); legend.append(el("span","",entryTitle(entry)),el("code","",entry.key)); group.append(legend); const fields=el("div","direct-fields"); indexes.forEach((index)=>fields.append(inputFor(entry,index,entry.values[index]))); group.append(fields); list.append(group);
  }
  if (!shown) list.append(el("p","empty-tab","This JWF contains no additional settings outside the dedicated pages.")); section.append(list); ui.view.append(section);
}
function renderJwfOnly() {
  const section=el("section","table-section jwf-only-panel"); section.append(el("h2","","JWF-only Settings"),el("p","tab-help","These operation defaults are stored in the JWF environment profile, not in a JWW drawing. They affect later Jw_cad operations after the profile is loaded."));
  const list=el("div","settings-groups"); const entries=entriesFor("jwfOnly");
  if (!entries.length) list.append(el("p","empty-tab","This profile does not contain JWF-only settings."));
  for (const entry of entries) { const group=el("fieldset","direct-group"); const legend=el("legend"); legend.append(el("span","",entryTitle(entry)),el("code","",entry.key)); group.append(legend); if (entry.definition?.note) group.append(el("p","jwf-only-note",entry.definition.note)); const fields=el("div","direct-fields"); const repeatedLayerMeaning=/^LAY(?:COL|WID|TYP)_[0-9A-F]$/.test(entry.key); entry.values.forEach((value,index)=>fields.append(inputFor(entry,index,value,{describe:!repeatedLayerMeaning}))); group.append(fields); list.append(group); }
  section.append(list); ui.view.append(section);
}
function appendExtraEntries(parent, entries, title = "Additional JWF settings") {
  if (!entries.length) return;
  const details = el("details", "jw-extra-settings");
  details.append(el("summary", "", title));
  for (const entry of entries) {
    const group = el("fieldset", "direct-group");
    group.append(el("legend", "", `${entryTitle(entry)} (${entry.key})`));
    const fields = el("div", "direct-fields");
    entry.values.forEach((value, index) => fields.append(inputFor(entry, index, value)));
    group.append(fields); details.append(group);
  }
  parent.append(details);
}
function commandReference() {
  const group = el("div", "jw-command-reference");
  group.append(el("p", "", "コマンド一覧（0：無指定／キャンセル）"));
  const names = ["AUTO", "線", "矩形", "円弧", "文字", "点", "寸法", "2線", "中心線", "連続線", "複線", "コーナー", "伸縮", "面取", "消去", "複写", "移動", "接線", "接円", "建具平面", "建具断面", "建具立面", "多角形", "曲線", "包絡", "分割", "図形", "記号変形", "パラメトリック", "外部変形", "測定", "登録選択図", "範囲選択", "貼付", "ハッチ", "データ整理", "座標ファイル", "接楕円", "表計算", "距離", "式計算", "属性変更", "ソリッド"];
  group.append(el("p", "", names.map((name, i) => `${i + 1} ${name}`).join("　")));
  group.append(el("p", "", "負数：AUTOモードでコマンド継続（対応するコマンドのみ）。未収録の欄は — で表示。"));
  return group;
}
function renderAuto() {
  const page = el("section", "jw-auto-page jw-native-page");
  const header = el("div", "jw-auto-header");
  const switcher = el("button", "mini-action", "クロックメニュー（1）"); switcher.type = "button";
  header.append(switcher, el("span", "", "0～11時のコマンド番号を編集")); page.append(header);
  const clocks = el("div", "jw-clock-grid"); page.append(clocks);
  let menuPage = 1;
  const drawClocks = () => {
    clocks.replaceChildren();
    for (const [side, meridiem, label] of [["LD", "AM", "左 AM"], ["RD", "AM", "右 AM"], ["LD", "PM", "左 PM"], ["RD", "PM", "右 PM"]]) {
      const key = `${side}${menuPage === 2 ? "2" : ""}_${meridiem}`;
      const entry = profile.parsed.entries[key];
      const clock = el("div", "jw-clock"); clock.setAttribute("aria-label", `${label} clock menu ${menuPage}`);
      clock.append(el("span", "jw-clock-center", label));
      const fixed = meridiem !== "AM" ? {} : side === "LD" ? {5:"線種変更",6:"属性取得",9:"AUTO"} : {0:"円1/4",3:"中心点",4:"戻る",5:"進む",6:"オフセット",9:"線上点"};
      for (let hour = 0; hour < 12; hour += 1) {
        const angle = hour * Math.PI / 6;
        const number = el("span", "jw-clock-hour", String(hour));
        number.style.left = `${50 + Math.sin(angle) * 22}%`; number.style.top = `${50 - Math.cos(angle) * 22}%`;
        const slot = el("div", "jw-clock-slot");
        slot.style.left = `${50 + Math.sin(angle) * 40}%`; slot.style.top = `${50 - Math.cos(angle) * 40}%`;
        if (Object.hasOwn(fixed, hour)) {
          const value = fixedCompactInput(fixed[hour], `${label} ${hour}:00 fixed`, "Jw_cad fixed function; stored value is preserved.");
          slot.append(value);
        } else slot.append(compactInput(entry, hour, `${key} ${hour}:00 command`));
        clock.append(number, slot);
      }
      clocks.append(clock);
    }
  };
  switcher.addEventListener("click", () => { menuPage = menuPage === 1 ? 2 : 1; switcher.textContent = `クロックメニュー（${menuPage}）`; drawClocks(); });
  drawClocks(); page.append(commandReference());
  appendExtraEntries(page, entriesFor("auto").filter(entry => !/^(LD|RD|LD2|RD2)_(AM|PM)$/.test(entry.key)));
  ui.view.append(page);
}
function renderKeys() {
  const page = el("section", "jw-key-page jw-native-page");
  const columns = el("div", "jw-key-columns"); const shown = new Set();
  const groups = [Array.from("ABCDEFGHIJKL"), Array.from("MNOPQRSTUVWX"), ["Y", "Z", ...Array.from({length:8}, (_, i) => `F${i + 2}`)]];
  groups.forEach((keys, columnIndex) => {
    const column = el("div", "jw-key-column");
    const heading = el("div", "jw-key-row jw-key-heading"); heading.append(el("span"), el("span", "", "通常"), el("span", "", "Shift")); column.append(heading);
    keys.forEach(key => {
      const jwfKey = key.startsWith("F") && key.length > 1 ? `KEY${key}` : `KEY_${key}`;
      const entry = profile.parsed.entries[jwfKey]; shown.add(jwfKey);
      const row = el("div", "jw-key-row"); row.append(el("span", "", key), compactInput(entry, 0, `${key} command`), compactInput(entry, 1, `Shift+${key} command`)); column.append(row);
    });
    if (columnIndex === 0) {
      const row = el("div", "jw-key-row jw-space-key"); row.append(el("span", "", "Space"), compactInput(profile.parsed.entries.KEYSP, 0, "Space command")); column.append(row); shown.add("KEYSP");
    }
    if (columnIndex === 2) column.append(el("p", "jw-key-shortcuts", "Tab：属性取得\nShift+Tab：レイヤ非表示化\nEsc：戻る\nShift+Esc：進む"));
    columns.append(column);
  });
  page.append(columns);
  const flags = el("div", "jw-key-flags");
  const mode = profile.parsed.entries.N_KEY;
  [[2,"直接属性取得を行う"],[0,"キーによるコマンド選択を無効にする"],[1,"Numキーのコマンド選択を無効にする"]].forEach(([index,label]) => {
    const row = el("label", "g1-check"); const input = el("input"); input.type = "checkbox";
    input.disabled = !mode || mode.values.length <= index; input.checked = Number(mode?.values[index]) === 1;
    input.addEventListener("change", () => mutateEntry(profile.parsed.entries.N_KEY, index, input.checked ? 1 : 0));
    row.append(input, el("span", "", label)); flags.append(row);
  });
  page.append(flags, commandReference());
  appendExtraEntries(page, entriesFor("keys").filter(entry => !shown.has(entry.key)));
  ui.view.append(page);
}
function renderGeneric(tab) {
  const list = el("div", "settings-groups");
  const entries = entriesFor(tab);
  if (!entries.length) list.append(el("p", "empty-tab", "This profile does not contain settings for this tab. For a complete editable starting point, read a JWF exported by Jw_cad. Advanced users may add an explicit KEY = values row in JWF Source."));
  for (const entry of entries) {
    const group = el("fieldset", "direct-group");
    const legend = el("legend"); legend.append(el("span", "", entryTitle(entry)), el("code", "", entry.key)); group.append(legend);
    const fields = el("div", "direct-fields");
    entry.values.forEach((value, index) => fields.append(inputFor(entry, index, value)));
    group.append(fields); list.append(group);
  }
  ui.view.append(list);
}
function compactInput(entry, index, ariaLabel) {
  if (!entry?.values || entry.values.length <= index) {
    const missing = el("input", "compact-input"); missing.type = "text"; missing.value = "—"; missing.disabled = true; missing.setAttribute("aria-label", ariaLabel); return missing;
  }
  const control = inputFor(entry, index, entry.values[index], { describe:false });
  control.classList.add("compact-value");
  const input = control.querySelector("input");
  input?.setAttribute("aria-label", ariaLabel);
  return control;
}
function fixedCompactInput(value, ariaLabel, title = "Not stored in this JWF") {
  const input = el("input", "compact-input"); input.type = "text"; input.value = value; input.disabled = true; input.title = title; input.setAttribute("aria-label", ariaLabel); return input;
}
function lineTypeRow(label, key, kind = "standard") {
  const entry = profile.parsed.entries[key]; const row = el("tr"); row.append(el("th", "row-heading", label));
  if (!entry) {
    for (let index = 0; index < 5; index += 1) { const cell = el("td", "missing-value-cell"); cell.append(fixedCompactInput("—", `${label} unavailable`)); row.append(cell); }
    return row;
  }
  const indexes = kind === "random" ? [0,1,2,3,4] : [0,1,2,null,3];
  indexes.forEach((index,column) => { const cell = el("td", index === null ? "missing-value-cell" : ""); cell.append(index === null ? fixedCompactInput("—", `${label} printer amplitude`, "This line type has no amplitude value.") : compactInput(entry,index,`${label} ${["pattern","screen value","screen pitch","printer amplitude","printer pitch"][column]}`)); row.append(cell); });
  return row;
}
function renderLineTypes() {
  const section = el("section", "jw-line-page");
  const layout = el("div", "jw-line-layout");
  const names = el("div", "jw-line-names");
  const makeGroup = (title, className) => {
    const group = el("fieldset", `jw-line-column ${className}`);
    group.append(el("legend", "", title)); return group;
  };
  const patterns = makeGroup("Line Pattern", "jw-pattern-column");
  const screen = makeGroup("Screen Display", "jw-screen-column");
  const print = makeGroup("Printer Output", "jw-print-column");
  const heading = (parent, text) => parent.append(el("div", "jw-line-heading", text));
  heading(names, ""); heading(patterns, '32 characters: "-" or space');
  const pair = (parent, first, second, className = "") => {
    const row = el("div", `jw-line-pair ${className}`); row.append(first, second); parent.append(row);
  };
  pair(screen, el("span", "", "Dots"), el("span", "", "Pitch"), "jw-line-heading");
  pair(print, el("span"), el("span", "", "Pitch"), "jw-line-heading");
  const patternInput = (entry, label, random = false, fixed = false) => {
    const input = el("input", "jw-pattern-input"); input.type = "text";
    input.setAttribute("aria-label", `${label} pattern`); input.spellcheck = false;
    input.maxLength = 32; input.disabled = fixed || !entry;
    const raw = fixed ? "ffffffff" : entry?.values[0];
    input.value = raw == null ? "" : decodeLinePattern(raw, random);
    input.title = random ? "32 positions: comma or apostrophe. Converted to the stored JWF bit pattern." : "32 positions: dash draws a segment; space leaves a gap.";
    input.addEventListener("change", () => {
      let hex;
      try { hex = encodeLinePattern(input.value, random); }
      catch (error) { input.setCustomValidity(error.message); input.reportValidity(); return; }
      input.setCustomValidity("");
      if (!random && hex === "00000000") { input.setCustomValidity("The pattern needs at least one drawn segment."); input.reportValidity(); return; }
      mutateEntry(profile.parsed.entries[entry.key], 0, hex);
    });
    input.addEventListener("input", () => input.setCustomValidity(""));
    return input;
  };
  for (let n = 1; n <= 9; n += 1) {
    const label = n === 9 ? "Auxiliary" : `Line Type ${n}`;
    const entry = profile.parsed.entries[`LTYPE_0${n}`];
    names.append(el("div", "jw-line-label", label)); patterns.append(patternInput(entry, label, false, n === 1));
    pair(screen, n === 1 ? fixedCompactInput("32", `${label} dots`, "Fixed solid line") : compactInput(entry, 1, `${label} dots`), n === 1 ? fixedCompactInput("1", `${label} screen pitch`, "Fixed solid line") : compactInput(entry, 2, `${label} screen pitch`));
    pair(print, el("span"), n === 9 ? el("span") : n === 1 ? fixedCompactInput("10", `${label} printer pitch`, "Fixed solid line") : compactInput(entry, 3, `${label} printer pitch`));
  }
  heading(names, ""); heading(patterns, "32 characters: apostrophe (') / comma (,)");
  pair(screen, el("span", "", "Amplitude"), el("span", "", "Pitch"), "jw-line-heading jw-random-heading");
  pair(print, el("span", "", "Amplitude"), el("span", "", "Pitch"), "jw-line-heading jw-random-heading");
  for (let n = 1; n <= 5; n += 1) {
    const label = `Random ${n}`; const entry = profile.parsed.entries[`LTYPE_R${n}`];
    names.append(el("div", "jw-line-label", label)); patterns.append(patternInput(entry, label, true));
    pair(screen, compactInput(entry,1,`${label} screen amplitude`),compactInput(entry,2,`${label} screen pitch`));
    pair(print, compactInput(entry,3,`${label} printer amplitude`),compactInput(entry,4,`${label} printer pitch`));
  }
  layout.append(names,patterns,screen,print); section.append(layout);
  const bottom = el("div", "jw-line-bottom");
  const reset = el("button", "mini-action", "Initialize Lines"); reset.type="button"; reset.disabled=true; reset.title="Jw_cad initialization values have not been verified.";
  bottom.append(reset, general1Number("LTYPE_HC",0,"Selection-frame line No.",{min:1,max:9}),general1Number("LTYPE_HC",1,"Crossline-cursor line No.",{min:1,max:9}));
  section.append(bottom);
  const extra=el("details","line-extra-settings");extra.append(el("summary","","Additional JWF line types"));
  const table=el("table","settings-table line-type-table");const body=el("tbody");
  for(let n=1;n<=4;n+=1) if(profile.parsed.entries[`LTYPE_L${n}`]) body.append(lineTypeRow(`Doubled ${n}`,`LTYPE_L${n}`));
  table.append(body);extra.append(table);section.append(extra); ui.view.append(section);
}
function textFlagCheckbox(entry, label, read, write) {
  const control=el("label","g1-check");const input=el("input");input.type="checkbox";input.checked=Boolean(entry&&read(Number(entry.values[6])||0));input.disabled=!entry;input.addEventListener("change",()=>{const value=Number(profile.parsed.entries.MSET.values[6])||0;mutateEntry(profile.parsed.entries.MSET,6,write(input.checked,value));render();});control.append(input,el("span","",label));return control;
}
function renderText() {
  const section=el("section","table-section text-panel");
  section.append(el("h2","jwcad-page-title","Text Size and Color Settings"),el("p","tab-help","Width and height: 0.1–500 mm · Spacing: -100–500 mm · Color No.: 1–8, or 9 for auxiliary text"));
  const main=el("div","text-main-layout"); const tableWrap=el("div","text-table-wrap");
  const table=el("table","settings-table text-type-table"); const header=el("tr");["","Width","Height","Spacing","Color No.","Used Characters","Custom-size Types"].forEach((value)=>header.append(el("th","",value)));const thead=el("thead");thead.append(header);table.append(thead);const body=el("tbody");
  const custom=el("tr");custom.append(el("th","row-heading","Custom Size"));for(let index=0;index<4;index+=1)custom.append(el("td","muted-cell","—"));const customUsage=el("td");customUsage.append(fixedCompactInput("—","Custom-size used characters","Entity usage counts are stored in the drawing, not in a JWF profile."));const customTypes=el("td");customTypes.append(fixedCompactInput("—","Custom-size type count","Custom-size type counts are stored in the drawing, not in a JWF profile."));custom.append(customUsage,customTypes);body.append(custom);
  const textEntries=["MWIDE","MHIGH","MDIST","MPEN"].map((key)=>profile.parsed.entries[key]);
  for(let type=0;type<10;type+=1){const row=el("tr");row.append(el("th","row-heading",`Text Type ${type+1}`));textEntries.forEach((entry,column)=>{const cell=el("td");cell.append(compactInput(entry,type,`Text Type ${type+1} ${["width","height","spacing","color number"][column]}`));row.append(cell);});const used=el("td");used.append(fixedCompactInput("—",`Text Type ${type+1} used characters`,`Entity usage counts are stored in the drawing, not in a JWF profile.`));row.append(used,el("td","muted-cell","—"));body.append(row);} table.append(body);tableWrap.append(table,el("p","jwcad-page-note","Used-character and custom-size type counts are drawing statistics and are not stored in JWF."));
  const side=el("aside","text-side-panel"); const mset=profile.parsed.entries.MSET;
  const current=el("fieldset","jwcad-group");current.append(el("legend","","Current Text Command"));if(mset){current.append(inputFor(mset,0,mset.values[0],{describe:false}),inputFor(mset,1,mset.values[1],{describe:false}));}else current.append(el("p","empty-tab","MSET is not present."));
  const movement=el("fieldset","jwcad-group ctrl-move-group");movement.append(el("legend","","Ctrl-key Text Movement"));[["Shift","X"],["Ctrl","Y"],["Alt","XY"]].forEach(([key,value])=>{const row=el("label","ctrl-move-row");row.append(el("span","",key),fixedCompactInput(value,`${key} text movement direction`,`This is a Jw_cad application setting and is not stored in JWF.`));movement.append(row);});movement.append(el("small","field-behavior","Application setting — not stored in JWF."));side.append(current,movement);main.append(tableWrap,side);section.append(main);
  const mhen=profile.parsed.entries.MHEN; const resize=el("fieldset","jwcad-group text-resize-group");resize.append(el("legend","","Existing Text Size Conversion"));
  if(mhen){const resizeToggle=el("label","g1-check");const toggle=el("input");toggle.type="checkbox";toggle.checked=Number(mhen.values[0])>=0;resizeToggle.append(toggle,el("span","","Change the size of existing text when this JWF is read"));toggle.addEventListener("change",()=>{mutateEntry(profile.parsed.entries.MHEN,0,toggle.checked?1:-1);render();});resize.append(resizeToggle);const anchors=el("div","text-anchor-grid");[[7,"Upper Left"],[8,"Upper Center"],[9,"Upper Right"],[4,"Middle Left"],[5,"Center"],[6,"Middle Right"],[1,"Lower Left"],[2,"Lower Center"],[3,"Lower Right"]].forEach(([value,label])=>{const item=el("label","text-anchor");const radio=el("input");radio.type="radio";radio.name="text-resize-anchor";radio.value=String(value);radio.checked=Number(mhen.values[0])===value;radio.disabled=!toggle.checked;radio.addEventListener("change",()=>{if(radio.checked)mutateEntry(profile.parsed.entries.MHEN,0,value);});item.append(radio,el("span","",label));anchors.append(item);});const customAnchor=el("label","text-anchor custom-anchor");const customRadio=el("input");customRadio.type="radio";customRadio.name="text-resize-anchor";customRadio.checked=Number(mhen.values[0])===0;customRadio.disabled=!toggle.checked;customRadio.addEventListener("change",()=>{if(customRadio.checked)mutateEntry(profile.parsed.entries.MHEN,0,0);});customAnchor.append(customRadio,el("span","","Custom size (0)"));resize.append(anchors,customAnchor,inputFor(mhen,1,mhen.values[1],{describe:false}));}else resize.append(el("p","empty-tab","MHEN is not present."));section.append(resize);
  if(mset){const options=el("fieldset","jwcad-group text-options-group");options.append(el("legend","","Text Display and Input Options"));const optionGrid=el("div","text-option-grid");
    optionGrid.append(textFlagCheckbox(mset,"Draw text outlines in the background",value=>Math.abs(value)%10===1,(checked,value)=>replaceDecimalDigit(value,1,checked?1:0)),textFlagCheckbox(mset,"Draw the text range in the background",value=>Math.abs(value)%10===2,(checked,value)=>replaceDecimalDigit(value,1,checked?2:0)),textFlagCheckbox(mset,"Draw text in dimension and block figures last",value=>decimalDigit(value,10)===1,(checked,value)=>replaceDecimalDigit(value,10,checked?1:0)),inputFor(mset,7,mset.values[7]),inputFor(mset,8,mset.values[8]));options.append(optionGrid);
    const advanced=el("details","text-command-extra");advanced.append(el("summary","","Additional text-command settings from MSET"));const fields=el("div","direct-fields");[2,3,4,5].forEach((index)=>fields.append(inputFor(mset,index,mset.values[index])));advanced.append(fields);options.append(advanced);section.append(options);
  }
  const offset=profile.parsed.entries.MOFST;if(offset){const group=el("details","text-command-extra");group.append(el("summary","","Text reference-point offsets (MOFST)"));const fields=el("div","direct-fields");offset.values.forEach((value,index)=>fields.append(inputFor(offset,index,value)));group.append(fields);section.append(group);}
  // Keep command-only JWF values available without displacing the native text grid.
  const currentSettings = side.firstElementChild;
  const commandDetails = el("details", "text-command-extra");
  commandDetails.append(el("summary", "", "Current text command (JWF)"), currentSettings);
  section.append(commandDetails);
  ui.view.append(section);
}
function renderColors() {
  const section = el("section", "table-section");
  section.append(el("h2", "color-page-title", "Line Color and Width Settings"), el("p", "tab-help", "RGB: higher channel values add more of that color · Screen/print width: higher values make lines thicker · Point: higher values enlarge printed real points"));
  const labelMap = {
    LCOLLOR_1:"Color 1", LCOLLOR_2:"Color 2", LCOLLOR_3:"Color 3", LCOLLOR_4:"Color 4",
    LCOLLOR_5:"Color 5", LCOLLOR_6:"Color 6", LCOLLOR_7:"Color 7", LCOLLOR_8:"Color 8",
    LCOLLOR_G:"Gray", LCOLLOR_H:"Auxiliary", LCOLLOR_S:"Selection", LCOLLOR_K:"Temporary",
    LCOLLOR_B:"Background", LCOLLOR_Z:"Zoom Frame", LCOLLOR_M:"Text",
    PCOLLOR_1:"Color 1", PCOLLOR_2:"Color 2", PCOLLOR_3:"Color 3", PCOLLOR_4:"Color 4",
    PCOLLOR_5:"Color 5", PCOLLOR_6:"Color 6", PCOLLOR_7:"Color 7", PCOLLOR_8:"Color 8", PCOLLOR_G:"Gray",
  };
  const colorInput = (entry) => {
    const input = el("input", "color-sample"); input.type = "color"; input.setAttribute("aria-label", `${labelMap[entry.key] || entry.key} color sample`);
    input.value = `#${entry.values.slice(0, 3).map((v) => Math.max(0, Math.min(255, Number(v) || 0)).toString(16).padStart(2, "0")).join("")}`;
    input.addEventListener("change", () => {
      const revised = [...profile.parsed.entries[entry.key].values];
      [1, 3, 5].forEach((start, index) => { revised[index] = Number.parseInt(input.value.slice(start, start + 2), 16); });
      profile = updateJwfProfileEntry(profile, entry.key, revised); refreshChrome(); render(); status(`${entry.key} color changed.`, "ready");
    }); return input;
  };
  const colorTable = (keys, { print = false } = {}) => {
    const table = el("table", "settings-table color-settings-table");
    const head = el("tr"); ["", "Sample", "Red", "Green", "Blue", "Width", ...(print ? ["Point"] : [])].forEach((value) => head.append(el("th", "", value)));
    const thead = el("thead"); thead.append(head); table.append(thead); const body = el("tbody");
    keys.forEach((key) => {
      const entry = profile.parsed.entries[key]; if (!entry) return;
      const row = el("tr"); row.append(el("th", "row-heading", labelMap[key] || key));
      const sample = el("td", "sample-cell"); sample.append(colorInput(entry)); row.append(sample);
      const total = print ? 5 : 4;
      const hasWidthAndPoint = print ? /^PCOLLOR_[1-8]$/.test(key) : /^LCOLLOR_[1-8]$/.test(key) || key === "LCOLLOR_H";
      for (let index = 0; index < total; index += 1) {
        const cell = el("td");
        if (index < 3 && index < entry.values.length) cell.append(inputFor(entry, index, entry.values[index]));
        else if (index >= 3 && hasWidthAndPoint && index < entry.values.length) cell.append(inputFor(entry, index, entry.values[index]));
        else { cell.classList.add("missing-value-cell"); cell.append(el("span", "muted-cell", "—")); }
        row.append(cell);
      }
      body.append(row);
    });
    table.append(body); return table;
  };
  const screenGroup = el("fieldset", "color-group"); screenGroup.append(el("legend", "", "Screen Elements"));
  screenGroup.append(colorTable(["LCOLLOR_1","LCOLLOR_2","LCOLLOR_3","LCOLLOR_4","LCOLLOR_5","LCOLLOR_6","LCOLLOR_7","LCOLLOR_8","LCOLLOR_G","LCOLLOR_H","LCOLLOR_S","LCOLLOR_K"]));
  const printGroup = el("fieldset", "color-group"); printGroup.append(el("legend", "", "Printer Output Elements"));
  printGroup.append(colorTable(["PCOLLOR_1","PCOLLOR_2","PCOLLOR_3","PCOLLOR_4","PCOLLOR_5","PCOLLOR_6","PCOLLOR_7","PCOLLOR_8","PCOLLOR_G"], { print:true }));
  const printerStack = el("div", "printer-color-stack"); printerStack.append(printGroup);
  const layout = el("div", "color-tables-layout"); layout.append(screenGroup, printerStack); section.append(layout);
  const specialKeys = ["LCOLLOR_B","LCOLLOR_Z"].filter((key) => profile.parsed.entries[key]);
  if (specialKeys.length) {
    const special = el("fieldset", "color-group special-color-group"); special.append(el("legend", "", "Screen Background and Zoom Frame"));
    const body = el("div", "special-color-layout"); const grid = el("div", "special-color-grid");
    ["", "Red", "Green", "Blue"].forEach((label) => grid.append(el("span", "special-color-heading", label)));
    specialKeys.forEach((key) => {
      const entry = profile.parsed.entries[key];
      const button = el("button", "special-color-button", labelMap[key]); button.type = "button";
      button.addEventListener("click", () => openColorDialog(entry,labelMap[key]));
      const buttonCell = el("span", "special-color-button-cell"); buttonCell.append(button); grid.append(buttonCell);
      entry.values.slice(0,3).forEach((value,index) => grid.append(inputFor(entry,index,value)));
    });
    body.append(grid);
    special.append(body); printerStack.append(special);
  }
  const options = el("fieldset", "color-group color-options-group"); options.append(el("legend", "", "Display and Print Options"));
  const optionFields = el("div", "color-option-fields");
  [["S_COMM_5",6],["S_COMM_5",7],["S_COMM_2",0]].forEach(([key,index]) => {
    const entry = profile.parsed.entries[key]; if (entry?.values?.length > index) optionFields.append(inputFor(entry, index, entry.values[index]));
  });
  const widthEntry = profile.parsed.entries.S_COMM_2;
  if (widthEntry?.values?.length > 1) {
    const unit = el("div", "line-width-unit-control");
    const unitToggle = el("label", "check-field"); const unitCheck = el("input"); unitCheck.type = "checkbox"; unitCheck.checked = Number(widthEntry.values[1]) < 0;
    unitToggle.append(unitCheck, el("span", "", "Use 1/N mm line-width units"));
    const maximum = el("label", "value-field"); const maximumLabel = el("span", "", unitCheck.checked ? "N value" : "Maximum width"); const number = el("input"); number.type = "number"; number.min = "1"; number.max = "100"; number.value = String(Math.abs(Number(widthEntry.values[1]))); maximum.append(maximumLabel, number, el("small", "field-behavior", unitCheck.checked ? "Higher N values make each 1/N mm width unit finer." : "Higher values allow thicker screen lines."));
    unitCheck.addEventListener("change", () => mutateEntry(profile.parsed.entries.S_COMM_2, 1, (unitCheck.checked ? -1 : 1) * Math.max(1, Math.abs(Number(profile.parsed.entries.S_COMM_2.values[1]) || 100))));
    number.addEventListener("change", () => { const magnitude = Math.max(1, Math.min(100, Math.abs(Number(number.value) || 100))); mutateEntry(profile.parsed.entries.S_COMM_2, 1, (unitCheck.checked ? -1 : 1) * magnitude); });
    unit.append(unitToggle, maximum); optionFields.append(unit);
  }
  const dpiEntry = profile.parsed.entries.P_dpi;
  const dpi = el("div", "dpi-control"); dpi.append(el("span", "", "Printer resolution"));
  const dpiValue = el("strong", "", dpiEntry ? `${dpiEntry.values[0]} dpi` : "Not specified in this JWF");
  const dpiButton = el("button", "mini-action", dpiEntry && Number(dpiEntry.values[0]) === 600 ? "Switch to 300 dpi" : "Switch to 600 dpi"); dpiButton.type = "button";
  dpiButton.addEventListener("click", () => { const next = dpiEntry && Number(profile.parsed.entries.P_dpi?.values?.[0]) === 600 ? 300 : 600; profile = updateJwfProfileEntry(profile, "P_dpi", [next]); refreshChrome(); render(); status(`Printer resolution set to ${next} dpi.`, "ready"); });
  dpi.append(dpiValue, dpiButton, el("small", "field-behavior", "Higher DPI uses a finer printer-resolution basis for line widths; it is not an output limit.")); optionFields.append(dpi);
  options.append(optionFields); section.append(options);
  const presets = el("div", "color-preset-row");
  const note = "Jw_cad does not document the complete multi-color transformation performed by this preset button. Edit the verified color rows directly.";
  ["Initialize Colors","Background: White","Background: Black","Background: Dark Green","Printer Output Colors","Line Widths"].forEach((label) => { const button = el("button", "mini-action", label); button.type = "button"; button.disabled = true; button.title = note; presets.append(button); });
  presets.append(el("span", "preset-note", "Preset transformations are intentionally disabled; their complete JWF rewrite rules are not documented."));
  section.append(presets);
  ui.view.append(section);
}
function renderExchange() {
  const section = el("section", "exchange-panel");
  section.append(el("h2", "", "DXF · SXF · JWC"));
  const notice = el("div", "evidence-notice");
  notice.append(el("strong", "", "Only proven JWF fields are editable here."), el("p", "", "The selected profile contains no dedicated keys for most controls shown on Jw_cad's DXF/SXF/JWC Basic Settings tab. Those controls are Jw_cad application settings, not values we can safely invent in this JWF."));
  section.append(notice);
  const entry = profile.parsed.entries.S_COMM_0;
  if (entry?.values?.length > 7) {
    const group = el("fieldset", "direct-group"); group.append(el("legend", "", "Confirmed shared file setting · S_COMM_0"));
    const fields = el("div", "direct-fields"); fields.append(inputFor(entry, 7, entry.values[7])); group.append(fields); section.append(group);
  }
  const unavailable = el("div", "unavailable-grid");
  ["Read DXF drawing extents", "Initialize colors on JWC/DXF read", "DXF export point mode", "SXF read color inversion", "SXF tolerance settings", "SXF line-type mapping"].forEach((name) => {
    const row = el("div", "unavailable-item"); row.append(el("span", "", name), el("strong", "", "Not stored in this JWF")); unavailable.append(row);
  });
  section.append(unavailable); ui.view.append(section);
}
function renderSource() {
  const section = el("section", "source-panel");
  section.append(el("h2", "", "Advanced JWF Source"), el("p", "tab-help", "Use this only for settings not covered by the form. Invalid syntax or non-Shift_JIS characters block export."));
  const editor = el("textarea", "source-editor"); editor.value = profile.text; editor.spellcheck = false;
  editor.addEventListener("input", () => { profile = editJwfProfile(profile, editor.value); refreshChrome(); status(profile.validation.ok ? "Source changed. Select Apply to keep it." : profile.validation.errors[0]?.message || "Invalid JWF source.", profile.validation.ok ? "ready" : "error"); });
  section.append(editor); ui.view.append(section);
}
function renderTabs() {
  ui.tabs.replaceChildren();
  for (const [id, label] of TABS) {
    const button = el("button", `jwcad-tab${active === id ? " active" : ""}`, label); button.type = "button";
    button.addEventListener("click", () => { active = id; render(); ui.view.scrollTop = 0; }); ui.tabs.append(button);
  }
}
function render() {
  if (!profile) return;
  renderTabs(); ui.view.replaceChildren(); ui.source.classList.toggle("active", active === "source");
  if (active === "source") renderSource(); else if (active === "general1") renderGeneral1(); else if (active === "general2") renderGeneral2(); else if (active === "colors") renderColors(); else if (active === "lineTypes") renderLineTypes(); else if (active === "text") renderText(); else if (active === "auto") renderAuto(); else if (active === "keys") renderKeys(); else if (active === "exchange") renderExchange(); else if (active === "jwfOnly") renderJwfOnly(); else if (active === "other") renderOther(); else renderGeneric(active);
  refreshChrome();
}
function showProfile() { ui.empty.hidden = true; ui.workspace.hidden = false; active = "general1"; appliedText = profile.text; render(); }
async function readFile(file) {
  if (!file) return;
  try { profile = openJwfProfile(new Uint8Array(await file.arrayBuffer()), { sourceName: file.name }); showProfile(); status(`Read ${file.name}.`, profile.validation.ok ? "ready" : "error"); }
  catch (error) { status(error?.message || "The JWF profile could not be read.", "error"); }
  finally { ui.file.value = ""; }
}
function createNew() { profile = createJwfProfile(); showProfile(); status("New local profile created. Add settings in Advanced JWF Source when a tab has no entries."); }
function applyChanges({ fromOk = false } = {}) {
  if (!profile.validation.ok) { status(profile.validation.errors[0]?.message || "Fix validation errors before applying.", "error"); return false; }
  appliedText = profile.text; refreshChrome(); status(fromOk ? "Changes applied. Use Export JWF to save a separate file." : "Changes applied to this local editing session.", "ready"); return true;
}
function cancelChanges() { profile = editJwfProfile(profile, appliedText); render(); status("Changes made since the last Apply were cancelled.", "ready"); }
function download(bytes, name) { const url = URL.createObjectURL(new Blob([bytes])); const a = el("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 0); }
function exportProfile() {
  const preflight = preflightJwfProfileSave(profile); if (!preflight.ok) { status(preflight.reasons.join("; "), "error"); return; }
  const saved = saveJwfProfile(profile); const base = (profile.sourceName || "environment-profile.jwf").replace(/\.jwf$/i, ""); const name = `${base}${profile.dirty && profile.originalBytes ? "-edited" : ""}.jwf`;
  download(saved.bytes, name); profile = openJwfProfile(saved.bytes, { sourceName: name }); appliedText = profile.text; render(); status(`Exported ${name} (${saved.bytes.length} bytes).`, "ready");
}
function requestFile() { ui.file.click(); }
ui.open.addEventListener("click", requestFile); ui.emptyOpen.addEventListener("click", requestFile);
ui.new.addEventListener("click", createNew); ui.emptyNew.addEventListener("click", createNew);
ui.file.addEventListener("change", () => readFile(ui.file.files?.[0])); ui.export.addEventListener("click", exportProfile);
ui.source.addEventListener("click", () => { active = active === "source" ? "general1" : "source"; render(); });
ui.apply.addEventListener("click", () => applyChanges()); ui.cancel.addEventListener("click", cancelChanges); ui.ok.addEventListener("click", () => applyChanges({ fromOk: true }));
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => { event.preventDefault(); readFile(event.dataTransfer?.files?.[0]); });
