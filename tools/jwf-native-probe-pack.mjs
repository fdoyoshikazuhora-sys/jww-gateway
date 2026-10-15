import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { encodeJwfText, decodeJwfBytes, validateJwfText } from "../src/jww/jwf.js";
import { JWF_OPTIONAL_KEYS, optionalJwfDefinition } from "../src/jww/jwfOptional.js";
import { buildJwwBytes } from "../src/jww/writer.js";

export const SOURCE_SHA256 = "c6ca97617d4f2b037cec4c4c280c1bb5c963aa106d44cef37caf3aac8a6b8f38";
export const REMAINING_KEYS = JWF_OPTIONAL_KEYS.filter(key => !["TNKZ_SET", "TNK3_NM1"].includes(key));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const lines = { LD2_RV: 126, RD2_RV: 128, COM_RV01: 139, COM_RV11: 142, COM_RV21: 145, COM_RV31: 148, COM_RV41: 151, COM_RV_C: 159,
  R_CROSS_ST1: 687, R_CROSS_ST2: 688, R_CROSS_ST3: 689, R_CROSS_ST4: 690, R_CROSS_ST5: 691, R_CROSS_ST6: 692, TNK3_NM2: 1725, TNKN_SET: 1740, REF_FILE: 1766 };

export function buildNativeProbePack(source) {
  if (hash(source) !== SOURCE_SHA256) throw new Error("Unreviewed Sample.jwf hash; review this source before generating probes.");
  const sourceLines = decodeJwfBytes(source).split(/\r?\n/);
  const row = line => sourceLines[line - 1].replace(/^#/, "").trim();
  const value = line => row(line).split("=").slice(1).join("=").trim();
  const files = new Map();
  const cases = [];
  function add(path, bytes) {
    if (files.has(path)) throw new Error(`Duplicate output: ${path}`);
    files.set(path, bytes);
  }
  for (const key of REMAINING_KEYS) {
    const definition = optionalJwfDefinition(key);
    const clock = /^(LD2|RD2|COM)_RV/.test(key);
    const cursor = key.startsWith("R_CROSS_ST");
    const dependencies = clock
      ? ["S_COMM_0=00 35 A0 1 1 -100 0 0 0 8", "S_COMM_4=0 0 0 0 0 0 0 0 10"]
      : cursor ? [row(628), row(669), ...[687, 688, 689, 690, 691, 692].filter(n => n !== lines[key]).map(row)] : [];
    if (clock) {
      // Hold all non-target clock settings constant across every arm.
      for (const other of REMAINING_KEYS.filter(k => /^(LD2|RD2|COM)_RV/.test(k) && k !== key)) dependencies.push(row(lines[other]));
    }
    const selected = key === "REF_FILE" ? "REF_FILE=reference.txt" : row(lines[key]);
    const arms = [];
    const profile = (name, assignment, active = true, context = dependencies) => {
      const text = [`# Native probe: ${key}. Not a verified result.`, ...context, `${active ? "" : "#"}${assignment}`, "END", ""].join("\r\n");
      const validation = validateJwfText(text);
      if (!validation.ok) throw new Error(`${key}/${name}: ${JSON.stringify(validation.errors)}`);
      const path = `${key}/${name}.jwf`;
      add(path, encodeJwfText(text));
      arms.push({ name, path, targetActive: active, targetAssignment: assignment, nativeStatus: "not-run" });
    };
    profile("off", selected, false);
    profile("on", selected);
    if (key === "LD2_RV" || key === "RD2_RV") {
      for (let hour = 0; hour < 12; hour++) {
        const flags = Array(12).fill(1); flags[hour] = 0;
        profile(`hour-${String(hour).padStart(2, "0")}-disabled`, `${key}=${flags.join(" ")}`);
      }
    } else if (/^COM_RV\d/.test(key)) {
      const values = value(lines[key]).split(/\s+/).map(Number);
      definition.valueSchema.forEach((command, index) => {
        if (command.startsWith("reserved")) return;
        for (const mode of [1, 2, ...(["text", "dimension"].includes(command) ? [4] : [])]) {
          const contrast = [...values]; contrast[index] = mode;
          profile(`${command}-mode-${mode}`, `${key}=${contrast.join(" ")}`);
        }
      });
    } else if (key === "COM_RV_C") {
      for (const side of ["left", "right"]) for (let color = 0; color <= 5; color++) {
        profile(`${side}-color-${color}`, `${key}=${side === "left" ? color * 10 + 3 : 20 + color}`);
      }
    } else if (cursor && Number(key.slice(-1)) <= 3) {
      const stroke = Number(key.slice(-1));
      const kmContext = [row(625), row(669), ...[681, 682, 683].filter(n => n !== 680 + stroke).map(row)];
      profile("km-off", row(680 + stroke), false, kmContext);
      profile("km-on", row(680 + stroke), true, kmContext);
    } else if (key === "TNK3_NM2") {
      profile("contrast", "TNK3_NM2=AuditPlanned");
      profile("boundary-ascii20", "TNK3_NM2=12345678901234567890");
      profile("boundary-japanese20", `TNK3_NM2=${"\u5efa".repeat(10)}`);
    } else if (key === "TNKN_SET") {
      const fields = value(lines[key]).split(",");
      definition.valueSchema.forEach((field, i) => {
        const contrast = [...fields]; contrast[i] = `Q${i + 1}`;
        profile(field, `TNKN_SET=${contrast.join(",")}`);
      });
      profile("documented-decoration", row(1744));
    } else if (key === "REF_FILE") {
      add("REF_FILE/reference.txt", encodeJwfText("%%AUDIT\tJWF_REFERENCE_OK\r\n"));
      profile("missing-file", "REF_FILE=missing-reference.txt");
      const text = (content, y) => ({ type: "TEXT", entity: { position: { x: 0, y }, endPoint: { x: 40, y }, text: content,
        paperTextWidth: 4, paperTextHeight: 4, paperTextSpacing: 0, fontFamily: "MS Gothic" } });
      add("REF_FILE/input.jww", buildJwwBytes({ version: 700, entities: [text("%%AUDIT", 10), text("UNCHANGED_CONTROL", 0)] }));
    }
    cases.push({ key, sourceLine: lines[key], sourceRange: definition.sourceLines, fields: definition.valueSchema,
      loadMode: clock ? "startup-copy-only" : "manual-or-startup-copy", dependencies,
      nativeStatus: "not-run", automaticGenerationIsNotNativeEvidence: true, arms,
      remainingGates: clock ? ["Manual held-menu and both-button evidence", "Each supported hour/command and persistence"]
        : cursor ? ["Individual visible stroke", "Unit prerequisites", "JWW reopen versus explicit JWF reload"]
          : ["Native reflection", "Native Save As", "Clean-process reopen", "Boundary and alternate values"] });
    const instructions = instructionsFor(key, definition);
    add(`${key}/STEPS.md`, Buffer.from(`# ${key}\n\nStatus: NOT RUN. Source: Sample.jwf lines ${definition.sourceLines.join("-")}.\n\nRead ../README.md first. Do not load off.jwf to reset an already changed process.\n\n${instructions}\n\n## Files\n${arms.map(a => `- ${a.name}.jwf: ${a.targetActive ? "active" : "commented"} target; native result NOT RUN.`).join("\n")}\n`, "utf8"));
  }
  add("README.md", readFileSync(new URL("../docs/JWF_NATIVE_MANUAL_PROTOCOL.md", import.meta.url)));
  const resultHeader = ["key", "arm", "version", "loadOrder", "command", "mouseSide", "hour", "baseline", "reflected", "saveAsPath", "reopenWithoutJwf", "reloadJwf", "nativeExport", "evidencePath", "result", "notes"];
  add("results.csv", Buffer.from(resultHeader.join(",") + "\r\n" + cases.flatMap(c => c.arms.map(a => resultHeader.map(k => k === "key" ? c.key : k === "arm" ? a.name : k === "result" ? "NOT_RUN" : "").join(","))).join("\r\n") + "\r\n"));
  const manifest = { format: "jwf-native-manual-pack", formatVersion: 1, sourceSha256: SOURCE_SHA256, keyCount: cases.length,
    originalSourceModified: false, nativeStatus: "not-run", cases,
    files: [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })) };
  add("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2) + "\n"));
  return { files, manifest };
}

function instructionsFor(key, definition) {
  if (key === "LD2_RV" || key === "RD2_RV") return `1. Use the ${key === "LD2_RV" ? "LEFT" : "RIGHT"} button. Start with on.jwf, then compare each hour-NN-disabled.jwf in a fresh identical baseline.
2. Select Line directly. Start in empty canvas, drag over 100 dots and hold in the clock direction. 0=up, 3=right, 6=down, 9=left; record the displayed AM hour before release. Observe switching at hours 1..9 and the attribute dialog at 10.
3. For left hour 11 check proportional line-width/point-radius display; for left hour 0 use Hatch clear. For right hours 0 and 11 use Text justification (0 lower-left, 11 center). Do not call a no-op in Line a test of Text/Hatch.
4. Record baseline attribute, menu while held, and attribute after release for every hour. Disabled means this attribute-switch feature is disabled, not that every clock command is disabled. Save a test line/text and reopen, then repeat the gesture separately; saved entity attributes do not prove the switch itself persisted.`;
  if (/^COM_RV\d/.test(key)) return `1. The field order is: ${definition.valueSchema.join(", ")}.
2. Compare on.jwf (mode 3) with each command-mode-1.jwf and command-mode-2.jwf. Select that exact command directly, enter its normal active state, and drag over 100 dots in AM on BOTH sides. Mode 1 allows left attribute switching; 2 right; 3 both. Reserved slots stay zero and have no test variants.
3. For drawing commands compare left color/right line type; Text compares text type/justification, Dimension compares dimension text type; Copy/Move/Parametric compare movement direction. Do not infer a supported right-side effect for a command where Sample.jwf does not describe one; mark that observation UNVERIFIED.
4. For text-mode-4 and dimension-mode-4, first select an existing text/dimension value so it is in movement state, then test LEFT drag directions. A new empty command is not the required state.
5. Record every command, side, hour and before/after attribute. Save generated test geometry, clean-reopen it, then repeat the control gesture. Do not run external transformations.`;
  if (key === "COM_RV_C") return `1. Compare on.jwf (23) with left-color-0..5 and right-color-0..5 separately; the other side remains fixed.
2. Select Line, drag over 100 dots and KEEP the indicated button down. Capture the menu while held (a second person/camera is suitable).
3. Expected modes: 0 normal; 1 red text; 2 green background; 3 cyan background; 4 blue background; 5 white text on black. Compare the menu labels, not the drawing line color. Release, save a separate JWW and repeat after clean reopen and then explicit JWF reload. The current automation API cannot capture a held drag.`;
  if (key.startsWith("R_CROSS_ST")) return `1. Compare off.jwf and on.jwf in separately restored baselines. The other FIVE shaku strokes remain identical. The target is ${key}; coordinates: ${definition.valueSchema.join(", ")}; origin upper-left and positive Y downward.
2. Confirm active non-mm input and real-size graduated cursor. The profiles set R_STR0_00 to shaku and R_CROSS_SET=1 1 1 3 6 0. Right-click the status MESSAGE area if the graduated cursor is hidden; right-click its unit/paper area only if paper-size scale is selected. Move the mouse into blank canvas without clicking; capture the unit glyph.
3. Check that exactly the target segment is missing/present. ST3 includes x=-2; do not clamp it. Compare km-off/km-on separately when provided, never mix Km and shaku contexts.
4. Save As a separate JWW, restart with an identical baseline and no target JWF, reopen, capture; then explicitly reload on.jwf and capture again. No claim is made that a glyph is stored in JWW. Meter mode ignores these strokes. The prose CROSS_ST1..30 versus example R_CROSS_ST1..6 discrepancy remains unresolved.`;
  if (key === "TNK3_NM2") return `1. Copy the distributed shadow drawing into this case directory; never save over the original. Open the COPY, exit Sky, read off/on/contrast.jwf separately in restored sessions.
2. Enter Sky -> Triangulation, choose a measurement point. Inspect the PLANNED building option. contrast.jwf should show AuditPlanned, while the reference option must remain unchanged. Re-enter the command if an existing control does not refresh.
3. Select planned output, enable triangulation and building-position table, place output in empty space. Save As a new basename in this directory.
4. Close, restore the identical baseline, restart with no active target key, reopen the saved JWW. Inspect generated name text AND command-default name separately. Then reload the contrast and repeat. Boundary profiles are prepared, not certified; record actual bytes/truncation separately.`;
  if (key === "TNKN_SET") return `1. Copy the distributed shadow drawing into this case directory. Compare on.jwf with each named field variant individually; only that one field changes to Q1..Q8. Field order: ${definition.valueSchema.join(", ")}.
2. Exit Sky before reading a profile. Re-enter Sky -> Triangulation, choose a measurement point, choose reference/planned according to the field, enable building-position table AND triangulation, place output in empty space.
3. Inspect the matching building-position or triangle number prefix/suffix. Also inspect the three other field pairs to detect unintended changes. Save As a new JWW; clean-restart/reopen without the target profile and inspect generated text, then reload the profile and regenerate to test environment behavior separately.
4. documented-decoration.jwf is the separate official square/circle ^w example, ONLY for maximum number <=99. Empty suffixes must remain empty. Six-byte boundaries, combined prefix/suffix truncation and ^w native rendering are NOT certified by the ASCII variants.`;
  return `1. input.jww is a SYNTHETIC Gateway-writer v700 fixture, not native-authored evidence. Keep it beside reference.txt; the file contains %%AUDIT, one TAB, and JWF_REFERENCE_OK. The second drawing label is UNCHANGED_CONTROL.
2. First establish a documented, non-printing preview path. This has NOT been established for installed 10.02.1: CHM menu-file.html lines 295..307 warns that a canvas LEFT click in Print immediately outputs a job. Do not treat the red print-range rectangle as proven preview or enter Print speculatively. Until a safe path is established, mark native substitution BLOCKED; no print job is authorized.
3. Once that gate is resolved, open input.jww in the disposable native session and load off.jwf/on.jwf in separately restored baselines. Use ONLY the verified non-printing preview. Record token/replacement and unchanged control at screen, preview, and after cancelling preview.
4. Save As a new basename in this same case directory. Clean-restart/reopen without REF_FILE, then reload on.jwf and preview again. Record whether the drawing retains %%AUDIT, not just what preview displays.
5. In a separately restored session load missing-file.jwf and record warning/fallback; do not create missing-reference.txt or assume the fallback. Relative lookup is proven only if a separate COPY of input.jww in another directory with no reference.txt behaves differently. Do not activate the original distributed placeholder or reference user files. If preview does not implement replacement, leave printing behavior UNVERIFIED; do not print to resolve it.`;
}

export function writeNativeProbePack(sourcePath, outputPath) {
  const source = readFileSync(sourcePath);
  const pack = buildNativeProbePack(source);
  const output = resolve(outputPath);
  mkdirSync(output); // Exclusive root creation prevents overwriting prior evidence or source directories.
  for (const [path, bytes] of pack.files) {
    const parts = path.split("/");
    if (parts.length > 1) mkdirSync(resolve(output, ...parts.slice(0, -1)), { recursive: true });
    writeFileSync(resolve(output, path), bytes, { flag: "wx" });
  }
  if (hash(readFileSync(sourcePath)) !== hash(source)) throw new Error("Source changed during generation.");
  return { output, keys: pack.manifest.keyCount, files: pack.files.size, nativeStatus: "not-run" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 4) throw new Error("Usage: node tools/jwf-native-probe-pack.mjs <reviewed-Sample.jwf> <new-output-directory>");
    console.log(JSON.stringify(writeNativeProbePack(process.argv[2], process.argv[3]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
