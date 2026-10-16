#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createBasicSettingsAppServer } from "./jww-basic-settings-app.mjs";
import { encodeJwfText, parseJwfBytes } from "../src/jww/jwf.js";

// Synthetic browser fixtures. These are never loaded into Jw_cad.
const cases = [
  ["LD2_RV", "1 1 1 1 1 1 1 1 1 1 1 1", 0, 0],
  ["RD2_RV", "1 1 1 1 1 1 1 1 1 1 1 1", 11, 0],
  ["COM_RV01", "0 3 3 3 3 3 3 3 3 3", 1, 1],
  ["COM_RV11", "3 0 0 3 0 3 3 3 3 3", 0, 1],
  ["COM_RV21", "3 3 3 3 0 3 0 0 3 0", 0, 1],
  ["COM_RV31", "0 0 0 0 3 0 0 3 0 0", 4, 1],
  ["COM_RV41", "0 3 3", 1, 1], ["COM_RV_C", "23", 0, 15],
  ["R_CROSS_ST1", "0 0 7 0", 0, 1], ["R_CROSS_ST2", "0 1 0 5", 0, 1],
  ["R_CROSS_ST3", "0 5 -2 7", 0, 1], ["R_CROSS_ST4", "6 1 6 4", 0, 7],
  ["R_CROSS_ST5", "1 3 6 3", 0, 2], ["R_CROSS_ST6", "4 4 7 7", 0, 5],
  ["TNKZ_SET", "25 1 0 3 302 20 11 201 100", 0, 50],
  ["TNK3_NM1", "001", 0, "002"], ["TNK3_NM2", "\u8a08\u753b\u5efa\u7269\u7528", 0, "Building 02"],
  ["TNKN_SET", "01,,ab,,[,],<,>", 0, "02"], ["REF_FILE", "audit reference.txt", 0, "test reference.txt"],
];
if (!process.env.PLAYWRIGHT_MODULE) throw new Error("Set PLAYWRIGHT_MODULE to the installed Playwright ESM entry file.");
const { chromium } = await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href);
const out = path.resolve(process.argv[2] || ".work/jwf-optional-browser");
await mkdir(out, { recursive: false });
const server = createBasicSettingsAppServer();
await new Promise((resolve, reject) => { server.once("error", reject); server.listen(3000, "127.0.0.1", resolve); });
const errors = [], checks = [];
let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(`${message.type()}: ${message.text()}`); });
  page.on("response", response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
  page.on("requestfailed", request => errors.push(`Request failed: ${request.url()}`));
  await page.goto("http://localhost:3000/apps/jww-basic-settings/environment.html");
  async function load(name, bytes) {
    await page.locator("#file-input").setInputFiles({ name, mimeType: "application/octet-stream", buffer: Buffer.from(bytes) });
    await page.waitForFunction(name => document.querySelector("#status-text").textContent.includes(name), name);
  }
  async function exported(name) {
    const event = page.waitForEvent("download");
    await page.locator("#export-button").click();
    const file = await event;
    const target = path.join(out, name);
    await file.saveAs(target);
    return new Uint8Array(await readFile(target));
  }
  async function show(key) {
    await page.getByRole("button", { name: key.startsWith("COM_") ? "AUTO" : "Other JWF Settings", exact: true }).click();
    const caption = key.startsWith("COM_")
      ? page.locator("legend", { hasText: new RegExp(`\\(${key}\\)$`) })
      : page.locator("legend code", { hasText: new RegExp(`^${key}$`) });
    const group = page.locator("fieldset.direct-group").filter({ has: caption });
    if (key.startsWith("COM_")) await page.locator("details.jw-extra-settings > summary").click();
    await group.waitFor({ state: "visible" });
    return group;
  }
  for (const [key, value, index, next] of cases) {
    const bytes = encodeJwfText(`# keep comment\r\n${key}=${value}\r\n#${key}=${value}\r\nEND\r\n${key}=ignored\r\n`);
    await load(`${key}.jwf`, bytes);
    assert.deepEqual(await exported(`${key}-unchanged.jwf`), bytes);
    const group = await show(key);
    const input = group.locator("input").nth(index);
    if (await input.getAttribute("type") === "checkbox") await input.setChecked(Boolean(next));
    else { await input.fill(String(next)); await input.blur(); }
    assert.equal(await page.locator("#apply-button").isEnabled(), true, `${key}: edit must be accepted`);
    await page.locator("#apply-button").click();
    const edited = await exported(`${key}-edited.jwf`);
    assert.equal(parseJwfBytes(edited).entries[key].values[index], next);
    await load(`${key}-edited.jwf`, edited);
    const reopened = (await show(key)).locator("input").nth(index);
    if (await reopened.getAttribute("type") === "checkbox") assert.equal(await reopened.isChecked(), Boolean(next));
    else assert.equal(await reopened.inputValue(), String(next));
    assert.deepEqual(await exported(`${key}-reopened.jwf`), edited);
    checks.push({ key, unchangedBytes: true, editApplyExportReopen: true });
  }
  await load("invalid-radius.jwf", encodeJwfText("TNKZ_SET=25 1 0 3 302 20 11 201 100\r\nEND\r\n"));
  let group = await show("TNKZ_SET");
  await group.locator("input").first().fill("9");
  await group.locator("input").first().blur();
  assert.match(await page.locator("#status-text").innerText(), /Circle radius/);
  assert.equal(await group.locator("input").first().inputValue(), "25");
  await page.screenshot({ path: path.join(out, "optional-desktop.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(out, "optional-narrow.png"), fullPage: true });
  const narrowLayout = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth }));
  const report = { url: "http://localhost:3000/apps/jww-basic-settings/environment.html", browser: `Chrome ${browser.version()} headless`, checks, invalidEditRestored: true, errors, narrowLayout, nativeJwCad: "separate evidence, not exercised by this test" };
  await writeFile(path.join(out, "result.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
