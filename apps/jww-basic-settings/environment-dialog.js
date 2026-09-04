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
  const values = [...entry.values];
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
    const ranges=[[0,10,1],[1,9,1],[0,4,1],[500,5000,1],[40,400,1],[-1000,1000,1],[0,12,1],[-1,10,.1],[0,1,1]];
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
  const constraint = numeric ? numericConstraint(entry,index) : null;
  input.type = numeric&&constraint ? "number" : "text"; input.value = value ?? "";
  if (constraint) { input.min=String(constraint.min); input.max=String(constraint.max); input.step=String(constraint.step); input.title=`Allowed: ${constraint.label}`; }
  const validate = () => { const next=Number(input.value); const excluded=constraint?.excluded?.has(next); input.setCustomValidity(excluded?`Enter ${constraint.label}.`:""); return !excluded&&input.checkValidity(); };
  input.addEventListener("input",validate);
  input.addEventListener("change", () => { if (numeric&&!validate()) { status(`${entry.key} ${fieldName(entry,index)} must be ${constraint?.label||"a valid number"}.`,"error"); return; } mutateEntry(entry,index,numeric?Number(input.value):input.value); });
  label.append(input); return label;
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
  control.append(caption,input); return control;
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
  for (const entry of entries) { const group=el("fieldset","direct-group"); const legend=el("legend"); legend.append(el("span","",entryTitle(entry)),el("code","",entry.key)); group.append(legend); if (entry.definition?.note) group.append(el("p","jwf-only-note",entry.definition.note)); const fields=el("div","direct-fields"); entry.values.forEach((value,index)=>fields.append(inputFor(entry,index,value))); group.append(fields); list.append(group); }
  section.append(list); ui.view.append(section);
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
    const maximum = el("label", "value-field"); const maximumLabel = el("span", "", unitCheck.checked ? "N value" : "Maximum width"); const number = el("input"); number.type = "number"; number.min = "1"; number.max = "100"; number.value = String(Math.abs(Number(widthEntry.values[1]))); maximum.append(maximumLabel, number);
    unitCheck.addEventListener("change", () => mutateEntry(profile.parsed.entries.S_COMM_2, 1, (unitCheck.checked ? -1 : 1) * Math.max(1, Math.abs(Number(profile.parsed.entries.S_COMM_2.values[1]) || 100))));
    number.addEventListener("change", () => { const magnitude = Math.max(1, Math.min(100, Math.abs(Number(number.value) || 100))); mutateEntry(profile.parsed.entries.S_COMM_2, 1, (unitCheck.checked ? -1 : 1) * magnitude); });
    unit.append(unitToggle, maximum); optionFields.append(unit);
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
  if (active === "source") renderSource(); else if (active === "general1") renderGeneral1(); else if (active === "general2") renderGeneral2(); else if (active === "colors") renderColors(); else if (active === "exchange") renderExchange(); else if (active === "jwfOnly") renderJwfOnly(); else if (active === "other") renderOther(); else renderGeneric(active);
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
