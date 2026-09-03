import { applyNativeJwwPatches, openNativeJww } from "../../src/jww/native.js";
import { buildJwwBasicSettingsProjection } from "../../src/jww/basicSettingsProjection.js";
import {
  preflightJwwBasicSettingsSave,
  saveJwwBasicSettings,
} from "../../src/jww/basicSettingsEdits.js";

const elements = {
  openButton: document.querySelector("#open-button"),
  emptyOpenButton: document.querySelector("#empty-open-button"),
  saveButton: document.querySelector("#save-button"),
  resetButton: document.querySelector("#reset-button"),
  editModePill: document.querySelector("#edit-mode-pill"),
  fileInput: document.querySelector("#file-input"),
  sourceName: document.querySelector("#source-name"),
  sourceDetail: document.querySelector("#source-detail"),
  sourceMetrics: document.querySelector("#source-metrics"),
  tabList: document.querySelector("#tab-list"),
  legend: document.querySelector("#legend"),
  emptyState: document.querySelector("#empty-state"),
  settingsView: document.querySelector("#settings-view"),
  statusDot: document.querySelector("#status-dot"),
  statusText: document.querySelector("#status-text"),
};

let projection = null;
let nativeDocument = null;
let sourceFileName = "";
function emptyDraftEdits() {
  return {
    layerGroupScales: {},
    layerGroupWriteLayers: {},
    layerGroupStates: {},
    layerStates: {},
    layerGroupProtections: {},
    layerProtections: {},
    screenColors: {},
    screenColorWidths: {},
    printColors: {},
    printColorWidths: {},
    printPointRadii: {},
    lineTypeRows: {},
    textTypePresets: {},
  };
}

let draftEdits = emptyDraftEdits();
let currentPreflight = null;
let activeTabId = "general";

function createElement(tagName, className = "", text = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== "") element.textContent = String(text);
  return element;
}

function setStatus(message, state = "ready") {
  elements.statusText.textContent = message;
  elements.statusDot.dataset.state = state;
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusBadge(status) {
  const badge = createElement("span", `provenance-badge provenance-${status}`);
  const label = projection?.legend.find((item) => item.status === status)?.label;
  badge.textContent = label || status;
  return badge;
}

function editableBadge() {
  return createElement("span", "native-editable-badge", "Native editable");
}

function draftValue(edit) {
  const rowFamily = ["lineTypeRows", "textTypePresets"].find((family) =>
    edit.key.startsWith(`${family}.`)
  );
  if (rowFamily) {
    const [, rowKey, field] = edit.key.split(".");
    return Object.hasOwn(draftEdits[rowFamily]?.[rowKey] || {}, field)
      ? draftEdits[rowFamily][rowKey][field]
      : edit.value;
  }
  const groupFamily = [
    "layerGroupScales",
    "layerGroupWriteLayers",
    "layerGroupStates",
    "layerStates",
    "layerGroupProtections",
    "layerProtections",
    "screenColors",
    "screenColorWidths",
    "printColors",
    "printColorWidths",
    "printPointRadii",
  ].find(
    (family) => edit.key.startsWith(`${family}.`)
  );
  if (groupFamily) {
    const index = edit.key.slice(groupFamily.length + 1);
    return Object.hasOwn(draftEdits[groupFamily], index)
      ? draftEdits[groupFamily][index]
      : edit.value;
  }
  return Object.hasOwn(draftEdits, edit.key) ? draftEdits[edit.key] : edit.value;
}

function setDraftValue(edit, value, { rerender = true } = {}) {
  const rowFamily = ["lineTypeRows", "textTypePresets"].find((family) =>
    edit.key.startsWith(`${family}.`)
  );
  if (rowFamily) {
    const [, rowKey, field] = edit.key.split(".");
    draftEdits = {
      ...draftEdits,
      [rowFamily]: {
        ...draftEdits[rowFamily],
        [rowKey]: {
          ...(draftEdits[rowFamily]?.[rowKey] || {}),
          [field]: value,
        },
      },
    };
  } else {
  const groupFamily = [
    "layerGroupScales",
    "layerGroupWriteLayers",
    "layerGroupStates",
    "layerStates",
    "layerGroupProtections",
    "layerProtections",
    "screenColors",
    "screenColorWidths",
    "printColors",
    "printColorWidths",
    "printPointRadii",
  ].find(
    (family) => edit.key.startsWith(`${family}.`)
  );
  if (groupFamily) {
    const index = edit.key.slice(groupFamily.length + 1);
    draftEdits = {
      ...draftEdits,
      [groupFamily]: { ...draftEdits[groupFamily], [index]: value },
    };
  } else {
    draftEdits = { ...draftEdits, [edit.key]: value };
  }
  }
  if (edit.key === "writeLayerGroup") {
    const states = { ...draftEdits.layerGroupStates };
    delete states[String(value)];
    draftEdits = { ...draftEdits, layerGroupStates: states };
  } else if (edit.key.startsWith("layerGroupWriteLayers.")) {
    const groupIndex = edit.key.slice("layerGroupWriteLayers.".length);
    const states = { ...draftEdits.layerStates };
    delete states[`${groupIndex}.${value}`];
    draftEdits = { ...draftEdits, layerStates: states };
  } else if (
    edit.key.startsWith("layerGroupProtections.") &&
    Number(value) === 2
  ) {
    const groupIndex = edit.key.slice("layerGroupProtections.".length);
    const states = { ...draftEdits.layerGroupStates };
    delete states[groupIndex];
    draftEdits = { ...draftEdits, layerGroupStates: states };
  } else if (
    edit.key.startsWith("layerProtections.") &&
    Number(value) === 2
  ) {
    const coordinate = edit.key.slice("layerProtections.".length);
    const states = { ...draftEdits.layerStates };
    delete states[coordinate];
    draftEdits = { ...draftEdits, layerStates: states };
  }
  refreshEditState();
  refreshProjectionFromDraft();
  renderSourceMetrics();
  if (rerender) renderActiveTab();
}

function renderEditControl(edit) {
  let control;
  if (edit.control === "select") {
    control = createElement("select", "native-edit-control");
    for (const option of edit.options || []) {
      const item = createElement("option", "", option.label);
      item.value = String(option.value);
      control.append(item);
    }
  } else if (edit.control === "textarea") {
    control = createElement(
      "textarea",
      "native-edit-control memo-edit-control"
    );
    control.rows = Number(edit.rows || 3);
  } else {
    control = createElement("input", "native-edit-control");
    control.type = ["color", "text"].includes(edit.control)
      ? edit.control
      : "number";
    if (edit.min !== undefined) control.min = String(edit.min);
    if (edit.max !== undefined) control.max = String(edit.max);
    if (edit.step !== undefined) control.step = String(edit.step);
    if (edit.pattern !== undefined) control.pattern = String(edit.pattern);
    if (edit.maxLength !== undefined) control.maxLength = Number(edit.maxLength);
  }
  control.value = String(draftValue(edit) ?? "");
  control.dataset.editKey = edit.key;
  control.setAttribute("aria-label", edit.key);
  control.addEventListener("change", () => setDraftValue(edit, control.value));
  if (
    edit.control === "number" ||
    edit.control === "textarea" ||
    edit.control === "color" ||
    edit.control === "text"
  ) {
    control.addEventListener("input", () =>
      setDraftValue(edit, control.value, { rerender: false })
    );
  }
  if (edit.control === "number") {
    control.addEventListener("keydown", (event) => {
      if (event.key === "Enter") control.blur();
    });
  }
  return control;
}

function sourceLine(source, note = "") {
  const wrapper = createElement("div", "row-meta");
  if (source) wrapper.append(createElement("code", "source-path", source));
  if (note) wrapper.append(createElement("span", "row-note", note));
  return wrapper;
}

function renderFieldRow(row) {
  const item = createElement("div", "setting-row");
  const identity = createElement("div", "setting-identity");
  identity.append(createElement("div", "setting-label", row.label));
  identity.append(sourceLine(row.source, row.note));
  const value = createElement("div", "setting-value");
  if (row.swatch) {
    const swatch = createElement("span", "color-swatch");
    swatch.style.backgroundColor = row.swatch;
    swatch.title = row.swatch;
    value.append(swatch);
  }
  if (row.edit) value.append(renderEditControl(row.edit));
  else value.append(createElement("span", "value-text", row.value));
  const provenance = createElement("div", "setting-provenance");
  provenance.append(statusBadge(row.status));
  if (row.edit) provenance.append(editableBadge());
  item.append(identity, value, provenance);
  return item;
}

function renderTable(section) {
  const scroll = createElement("div", "table-scroll");
  const table = createElement("table", "settings-table");
  const head = createElement("thead");
  const headRow = createElement("tr");
  for (const column of section.columns) headRow.append(createElement("th", "", column));
  headRow.append(createElement("th", "provenance-column", "Source"));
  head.append(headRow);
  const body = createElement("tbody");
  for (const row of section.rows) {
    const tableRow = createElement("tr");
    row.cells.forEach((cell, index) => {
      const dataCell = createElement("td");
      if (index === (row.swatchColumn ?? 1) && row.swatch) {
        const swatch = createElement("span", "color-swatch small");
        swatch.style.backgroundColor = row.swatch;
        dataCell.append(swatch);
      }
      const edit = row.edits?.[index];
      if (edit) dataCell.append(renderEditControl(edit));
      else dataCell.append(document.createTextNode(String(cell)));
      tableRow.append(dataCell);
    });
    const sourceCell = createElement("td", "table-source");
    sourceCell.append(statusBadge(row.status));
    if (row.edits && Object.keys(row.edits).length) sourceCell.append(editableBadge());
    if (row.source) sourceCell.append(createElement("code", "source-path", row.source));
    tableRow.append(sourceCell);
    body.append(tableRow);
  }
  table.append(head, body);
  scroll.append(table);
  return scroll;
}

function renderSection(section) {
  const card = createElement("section", "settings-card");
  const heading = createElement("div", "card-heading");
  heading.append(createElement("h3", "", section.title));
  if (section.description) heading.append(createElement("p", "card-description", section.description));
  card.append(heading);
  if (section.type === "table") card.append(renderTable(section));
  else {
    const rows = createElement("div", "setting-rows");
    for (const row of section.rows) rows.append(renderFieldRow(row));
    card.append(rows);
  }
  return card;
}

function renderActiveTab() {
  const tab = projection?.tabs.find((candidate) => candidate.id === activeTabId);
  if (!tab) return;
  elements.settingsView.replaceChildren();
  const header = createElement("div", "page-heading");
  const copy = createElement("div");
  copy.append(createElement("p", "eyebrow", "JWW native document"));
  copy.append(createElement("h2", "", tab.label));
  header.append(copy, createElement("span", "projection-pill", "Native-safe edit scope"));
  elements.settingsView.append(header);
  const grid = createElement("div", "card-grid");
  for (const section of tab.sections) grid.append(renderSection(section));
  elements.settingsView.append(grid);
  for (const button of elements.tabList.querySelectorAll("button")) {
    const selected = button.dataset.tabId === activeTabId;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-current", selected ? "page" : "false");
  }
}

function renderTabs() {
  elements.tabList.replaceChildren();
  for (const tab of projection.tabs) {
    const button = createElement("button", "tab-button");
    button.type = "button";
    button.dataset.tabId = tab.id;
    button.append(createElement("span", "tab-indicator"), createElement("span", "", tab.label));
    button.addEventListener("click", () => {
      activeTabId = tab.id;
      renderActiveTab();
    });
    elements.tabList.append(button);
  }
}

function renderLegend() {
  elements.legend.replaceChildren(createElement("p", "legend-title", "Value source"));
  for (const item of projection.legend) {
    const row = createElement("div", "legend-row");
    row.append(createElement("span", `legend-dot legend-${item.status}`), createElement("span", "", item.label));
    elements.legend.append(row);
  }
}

function metric(label, value, tone = "") {
  const wrapper = createElement("div", `metric ${tone}`.trim());
  wrapper.append(createElement("span", "metric-label", label), createElement("strong", "metric-value", value));
  return wrapper;
}

function renderSourceMetrics() {
  if (!projection) {
    elements.sourceMetrics.replaceChildren();
    return;
  }
  const source = projection.source;
  const saveState = !currentPreflight?.ok
    ? "Blocked"
    : currentPreflight.patchCount
      ? "Ready"
      : "Unchanged";
  elements.sourceMetrics.replaceChildren(
    metric("Version", source.version),
    metric("Size", formatBytes(source.byteLength)),
    metric("Parse", source.clean ? "Clean" : "Review", source.clean ? "good" : "warn"),
    metric("Save", saveState, saveState === "Ready" ? "good" : saveState === "Blocked" ? "warn" : "")
  );
}

function refreshEditState() {
  if (!nativeDocument) {
    currentPreflight = null;
    elements.saveButton.disabled = true;
    elements.resetButton.disabled = true;
    elements.editModePill.textContent = "Native-safe edits";
    elements.editModePill.dataset.state = "idle";
    return;
  }
  currentPreflight = preflightJwwBasicSettingsSave(nativeDocument, draftEdits);
  const hasChanges = currentPreflight.patchCount > 0;
  elements.saveButton.disabled = !hasChanges || !currentPreflight.ok;
  elements.resetButton.disabled = !hasChanges;
  elements.editModePill.textContent = !currentPreflight.ok
    ? "Save blocked"
    : hasChanges
      ? `Ready · ${currentPreflight.strategy}`
      : "Native-safe edits";
  elements.editModePill.dataset.state = !currentPreflight.ok
    ? "blocked"
    : hasChanges
      ? "ready"
      : "idle";
  if (!currentPreflight.ok) {
    setStatus(currentPreflight.reasons.join("; "), "error");
  } else if (hasChanges) {
    setStatus(
      `${currentPreflight.patchCount} native metadata change${currentPreflight.patchCount === 1 ? "" : "s"} ready for Save As (${currentPreflight.strategy}).`,
      "ready"
    );
  }
}

function refreshProjectionFromDraft() {
  if (!nativeDocument) return;
  const previewDocument = currentPreflight?.ok && currentPreflight.patchCount
    ? applyNativeJwwPatches(nativeDocument, currentPreflight.patches)
    : nativeDocument;
  projection = buildJwwBasicSettingsProjection(previewDocument, {
    fileName: sourceFileName,
  });
}

function renderProjection() {
  const source = projection.source;
  elements.emptyState.hidden = true;
  elements.settingsView.hidden = false;
  elements.sourceName.textContent = source.fileName || "Local JWW file";
  elements.sourceDetail.textContent = source.sha256 ? `SHA-256 ${source.sha256}` : "SHA-256 unavailable";
  refreshEditState();
  renderSourceMetrics();
  activeTabId = "general";
  renderTabs();
  renderLegend();
  renderActiveTab();
}

async function loadFile(file) {
  if (!file) return;
  setStatus(`Opening ${file.name}…`, "working");
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.length) throw new Error("The selected file is empty.");
    nativeDocument = await openNativeJww(bytes, {
      sourceName: file.name,
      fileName: file.name,
      lastModified: file.lastModified,
    });
    if (!nativeDocument.version) throw new Error("The selected file is not a supported JWW document.");
    sourceFileName = file.name;
    draftEdits = emptyDraftEdits();
    projection = buildJwwBasicSettingsProjection(nativeDocument, { fileName: file.name });
    renderProjection();
    setStatus(`Loaded ${file.name}. Only proven native metadata fields are editable.`, projection.source.clean ? "ready" : "warning");
  } catch (error) {
    projection = null;
    nativeDocument = null;
    sourceFileName = "";
    draftEdits = emptyDraftEdits();
    refreshEditState();
    elements.settingsView.hidden = true;
    elements.emptyState.hidden = false;
    elements.sourceName.textContent = "JWW file could not be opened";
    elements.sourceDetail.textContent = error?.message || String(error);
    elements.sourceMetrics.replaceChildren();
    elements.tabList.replaceChildren();
    elements.legend.replaceChildren();
    setStatus(error?.message || "Open failed.", "error");
  } finally {
    elements.fileInput.value = "";
  }
}

function suggestedSaveName(fileName) {
  const base = String(fileName || "drawing.jww").replace(/\.jww$/i, "");
  return `${base}-basic-settings.jww`;
}

function downloadJww(bytes, fileName) {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function resetChanges() {
  if (!nativeDocument) return;
  draftEdits = emptyDraftEdits();
  refreshEditState();
  refreshProjectionFromDraft();
  renderSourceMetrics();
  renderActiveTab();
  setStatus("Native metadata changes were reset. The source JWW remains unchanged.", "ready");
}

function saveAsJww() {
  if (!nativeDocument) return;
  const preflight = preflightJwwBasicSettingsSave(nativeDocument, draftEdits);
  if (!preflight.ok || preflight.patchCount === 0) {
    setStatus(
      preflight.reasons?.join("; ") || "There are no changes to save.",
      preflight.ok ? "warning" : "error"
    );
    return;
  }
  setStatus(`Preparing native JWW with ${preflight.strategy}…`, "working");
  try {
    const saved = saveJwwBasicSettings(nativeDocument, draftEdits);
    if (!saved.bytes.length) throw new Error("Gateway produced an empty JWW output.");
    const fileName = suggestedSaveName(sourceFileName);
    downloadJww(saved.bytes, fileName);
    nativeDocument = saved.document;
    sourceFileName = fileName;
    draftEdits = emptyDraftEdits();
    projection = buildJwwBasicSettingsProjection(nativeDocument, { fileName });
    renderProjection();
    setStatus(
      `Saved ${fileName} (${formatBytes(saved.bytes.length)}) using ${saved.strategy}. The source file was not overwritten.`,
      "ready"
    );
  } catch (error) {
    setStatus(error?.message || "Save As failed.", "error");
    refreshEditState();
    renderSourceMetrics();
  }
}

function requestFile() { elements.fileInput.click(); }
elements.openButton.addEventListener("click", requestFile);
elements.emptyOpenButton.addEventListener("click", requestFile);
elements.saveButton.addEventListener("click", saveAsJww);
elements.resetButton.addEventListener("click", resetChanges);
elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files?.[0]));
document.addEventListener("dragover", (event) => { event.preventDefault(); document.body.classList.add("dragging"); });
document.addEventListener("dragleave", (event) => { if (!event.relatedTarget) document.body.classList.remove("dragging"); });
document.addEventListener("drop", (event) => {
  event.preventDefault();
  document.body.classList.remove("dragging");
  loadFile(event.dataTransfer?.files?.[0]);
});
