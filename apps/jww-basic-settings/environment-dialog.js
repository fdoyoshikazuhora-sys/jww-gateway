import {
  createJwfProfile,
  editJwfProfile,
  openJwfProfile,
  preflightJwfProfileSave,
  saveJwfProfile,
  updateJwfProfileEntry,
} from "../../src/jww/jwf.js";

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
  ["exchange", "DXF · SXF · JWC"],
];
const GROUPS = {
  general1: [/^S_COMM_[0-4]$/, /^R_CROSS_SET$/],
  general2: [/^S_COMM_[5-9]$/, /^S_MESH_0$/, /^ZOOM$/, /^R_STR0_00$/],
  colors: [/^LCOLLOR_/, /^PCOLLOR_/],
  lineTypes: [/^LTYPE_/],
  text: [/^(MSET|MHEN|MWIDE|MHIGH|MDIST|MPEN|MOFST)$/],
  auto: [/^(AC_COM|WD_COM)$/, /^(LD|RD|LD2|RD2)_(AM|PM)$/, /^COM_/, /^GCOM_/],
  keys: [/^N_KEY$/, /^KEY/],
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
};
const BOOLEAN_FIELDS = new Set([
  "S_COMM_0:3","S_COMM_0:4","S_COMM_0:6","S_COMM_1:1","S_COMM_1:2","S_COMM_1:3","S_COMM_1:4",
  "S_COMM_2:0","S_COMM_2:3","S_COMM_2:4","S_COMM_2:5","S_COMM_2:6","S_COMM_2:7","S_COMM_2:8",
  "S_COMM_3:0","S_COMM_3:1","S_COMM_3:2","S_COMM_3:4","S_COMM_3:5","S_COMM_3:7",
  "S_COMM_4:1","S_COMM_4:2","S_COMM_4:3","S_COMM_4:5","S_COMM_4:7",
  "S_COMM_5:0","S_COMM_5:2","S_COMM_5:3","S_COMM_5:4","S_COMM_5:6","S_COMM_5:7","S_COMM_5:8",
  "S_COMM_6:2","S_COMM_6:3","S_COMM_6:5","S_COMM_6:6","S_COMM_6:8","S_COMM_7:0","S_COMM_7:2",
  "S_COMM_7:6","S_COMM_7:7","S_COMM_8:5","S_COMM_8:6","S_COMM_8:7","S_COMM_8:8","S_COMM_9:3",
]);

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
  const values = [...entry.values];
  values[index] = value;
  profile = updateJwfProfileEntry(profile, entry.key, values);
  refreshChrome();
  status(`${entry.key} changed. Select Apply to keep this edit in the current session.`, "ready");
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
function inputFor(entry, index, value) {
  if (BOOLEAN_FIELDS.has(`${entry.key}:${index}`) && [0, 1].includes(Number(value))) {
    const label = el("label", "check-field");
    const input = el("input"); input.type = "checkbox"; input.checked = Number(value) === 1;
    input.addEventListener("change", () => mutateEntry(entry, index, input.checked ? 1 : 0));
    label.append(input, el("span", "", fieldName(entry, index))); return label;
  }
  const label = el("label", "value-field"); label.append(el("span", "", fieldName(entry, index)));
  const input = el("input");
  const numeric = typeof value === "number" || (String(value).trim() !== "" && Number.isFinite(Number(value)));
  input.type = numeric ? "number" : "text"; input.value = value ?? ""; if (numeric) input.step = "any";
  input.addEventListener("change", () => mutateEntry(entry, index, numeric ? Number(input.value) : input.value));
  label.append(input); return label;
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
function renderColors() {
  const section = el("section", "table-section");
  section.append(el("h2", "color-page-title", "Line Color and Width Settings"), el("p", "tab-help", "Color values: 0–255 · Screen width: 1–16 · Printer width: 1–500"));
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
  const textColor = profile.parsed.entries.LCOLLOR_M;
  if (specialKeys.length || textColor) {
    const special = el("fieldset", "color-group special-color-group"); special.append(el("legend", "", "Screen Background, Zoom Frame, and Text"));
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
    if (textColor) { const textButton = el("button", "special-text-color-button", "Text Color"); textButton.type = "button"; textButton.addEventListener("click", () => openColorDialog(textColor,labelMap.LCOLLOR_M)); body.append(textButton); }
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
    const maximum = el("label", "value-field"); const maximumLabel = el("span", "", unitCheck.checked ? "N value" : "Maximum width"); const number = el("input"); number.type = "number"; number.min = "1"; number.max = "100"; number.value = String(Math.abs(Number(widthEntry.values[1]))); maximum.append(maximumLabel, number);
    unitCheck.addEventListener("change", () => mutateEntry(profile.parsed.entries.S_COMM_2, 1, (unitCheck.checked ? -1 : 1) * Math.max(1, Math.abs(Number(profile.parsed.entries.S_COMM_2.values[1]) || 100))));
    number.addEventListener("change", () => { const magnitude = Math.max(1, Math.min(100, Math.abs(Number(number.value) || 100))); mutateEntry(profile.parsed.entries.S_COMM_2, 1, (unitCheck.checked ? -1 : 1) * magnitude); });
    unit.append(unitToggle, maximum); optionFields.append(unit);
  }
  const helper = profile.parsed.entries.LTYPE_HC;
  if (helper?.values?.length > 5) {
    const endpoint = el("label", "endpoint-style-control"); endpoint.append(el("span", "", "Line endpoint style"));
    const select = el("select"); [[0,"Round"],[1,"Square"],[2,"Flat"]].forEach(([value,label]) => { const option = el("option", "", label); option.value = value; option.selected = Number(helper.values[5]) === value; select.append(option); });
    select.addEventListener("change", () => mutateEntry(profile.parsed.entries.LTYPE_HC, 5, Number(select.value))); endpoint.append(select); optionFields.append(endpoint);
  }
  const dpiEntry = profile.parsed.entries.P_dpi;
  const dpi = el("div", "dpi-control"); dpi.append(el("span", "", "Printer resolution"));
  const dpiValue = el("strong", "", dpiEntry ? `${dpiEntry.values[0]} dpi` : "Not specified in this JWF");
  const dpiButton = el("button", "mini-action", dpiEntry && Number(dpiEntry.values[0]) === 600 ? "Switch to 300 dpi" : "Switch to 600 dpi"); dpiButton.type = "button";
  dpiButton.addEventListener("click", () => { const next = dpiEntry && Number(profile.parsed.entries.P_dpi?.values?.[0]) === 600 ? 300 : 600; profile = updateJwfProfileEntry(profile, "P_dpi", [next]); refreshChrome(); render(); status(`Printer resolution set to ${next} dpi.`, "ready"); });
  dpi.append(dpiValue, dpiButton); optionFields.append(dpi);
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
    button.addEventListener("click", () => { active = id; render(); }); ui.tabs.append(button);
  }
}
function render() {
  if (!profile) return;
  renderTabs(); ui.view.replaceChildren(); ui.source.classList.toggle("active", active === "source");
  if (active === "source") renderSource(); else if (active === "colors") renderColors(); else if (active === "exchange") renderExchange(); else renderGeneric(active);
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
