import { openNativeJww } from "../../src/jww/native.js";
import { buildJwwBasicSettingsProjection } from "../../src/jww/basicSettingsProjection.js";

const elements = {
  openButton: document.querySelector("#open-button"),
  emptyOpenButton: document.querySelector("#empty-open-button"),
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
  value.append(createElement("span", "value-text", row.value));
  const provenance = createElement("div", "setting-provenance");
  provenance.append(statusBadge(row.status));
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
      if (index === 1 && row.swatch) {
        const swatch = createElement("span", "color-swatch small");
        swatch.style.backgroundColor = row.swatch;
        dataCell.append(swatch);
      }
      dataCell.append(document.createTextNode(String(cell)));
      tableRow.append(dataCell);
    });
    const sourceCell = createElement("td", "table-source");
    sourceCell.append(statusBadge(row.status));
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
  header.append(copy, createElement("span", "projection-pill", "Projection only"));
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

function renderProjection() {
  const source = projection.source;
  elements.emptyState.hidden = true;
  elements.settingsView.hidden = false;
  elements.sourceName.textContent = source.fileName || "Local JWW file";
  elements.sourceDetail.textContent = source.sha256 ? `SHA-256 ${source.sha256}` : "SHA-256 unavailable";
  elements.sourceMetrics.replaceChildren(
    metric("Version", source.version),
    metric("Size", formatBytes(source.byteLength)),
    metric("Parse", source.clean ? "Clean" : "Review", source.clean ? "good" : "warn")
  );
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
    const nativeDocument = await openNativeJww(bytes, {
      sourceName: file.name,
      fileName: file.name,
      lastModified: file.lastModified,
    });
    if (!nativeDocument.version) throw new Error("The selected file is not a supported JWW document.");
    projection = buildJwwBasicSettingsProjection(nativeDocument, { fileName: file.name });
    renderProjection();
    setStatus(`Loaded ${file.name} as a read-only native settings projection.`, projection.source.clean ? "ready" : "warning");
  } catch (error) {
    projection = null;
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

function requestFile() { elements.fileInput.click(); }
elements.openButton.addEventListener("click", requestFile);
elements.emptyOpenButton.addEventListener("click", requestFile);
elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files?.[0]));
document.addEventListener("dragover", (event) => { event.preventDefault(); document.body.classList.add("dragging"); });
document.addEventListener("dragleave", (event) => { if (!event.relatedTarget) document.body.classList.remove("dragging"); });
document.addEventListener("drop", (event) => {
  event.preventDefault();
  document.body.classList.remove("dragging");
  loadFile(event.dataTransfer?.files?.[0]);
});
