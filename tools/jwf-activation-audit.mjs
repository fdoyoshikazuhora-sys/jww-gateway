#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditJwfBytes, createJwfActivationProbe } from "../src/jww/jwfAudit.js";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function parseArgs(argv) {
  const args = {};
  const values = { "--output": "output", "-o": "output", "--markdown": "markdown", "--probe-line": "line", "--expect-key": "key", "--expect-sha256": "hash", "--probe-dir": "probeDir", "--load-mode": "loadMode" };
  for (let i = 0; i < argv.length; i += 1) {
    if (Object.hasOwn(values, argv[i])) {
      const key = values[argv[i]];
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new Error(`Missing value for ${argv[i]}`);
      args[key] = argv[++i];
    } else if (argv[i] === "--reviewed") args.reviewed = true;
    else if (!args.input && !argv[i].startsWith("-")) args.input = argv[i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.input) throw new Error("Usage: node tools/jwf-activation-audit.mjs input.jwf [-o audit.json] [--markdown inventory.md] [--probe-line N --expect-key KEY --expect-sha256 HASH --probe-dir NEW_DIR --load-mode manual|startup --reviewed]");
  if (args.line && (!/^\d+$/.test(args.line) || !args.probeDir || !args.key || !args.hash)) throw new Error("A probe requires a line, key, expected SHA-256 and new output directory");
  if (!args.line && (args.probeDir || args.reviewed || args.key || args.hash || args.loadMode)) throw new Error("Probe options require --probe-line");
  return args;
}

function markdown(audit) {
  const cell = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/[\r\n]/g, " ");
  const lines = ["# JWF Activation Inventory", "", `Source: ${audit.sourceName}`, `SHA-256: ${audit.sha256}`, "",
    "This is a source-syntax inventory, not a certificate of Jw_cad behavior or complete JWF coverage.",
    "A commented assignment may be an example, an alternative, or an optional setting. It is never activated automatically.",
    "Named fields do not mean all field ranges, dependencies, or native behavior are verified.",
    "Documentation-only keys mentioned within explanatory sentences require a separate manual review; they are not executable rows.",
    "", `Summary: ${JSON.stringify(audit.summary)}`, `First END line: ${audit.firstEndLine ?? "none"}`, "",
    "| Line | Key | Source state | After END | Same-key lines | Gateway definition | Review reasons |",
    "| ---: | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of audit.rows) lines.push(`| ${row.line} | ${cell(row.key)} | ${row.state} | ${row.afterEnd} | ${row.sameKeyLines.join(", ")} | ${row.definitionCoverage} | ${row.reviewReasons.join(", ")} |`);
  lines.push("", "## Unclassified Lines", "", ...audit.otherLines.map((row) => `- Line ${row.line}: ${row.kind}`), "", "This inventory does not run native Jw_cad, browser, or consuming-app tests. See the accompanying audit for separately recorded evidence.");
  return `${lines.join("\n")}\n`;
}

export async function runJwfActivationAudit(args) {
  const inputPath = path.resolve(args.input);
  const input = new Uint8Array(await readFile(inputPath));
  const hash = sha256(input);
  const audit = { ...auditJwfBytes(input), sourceName: path.basename(inputPath), sha256: hash };
  if (args.line) {
    if (hash !== args.hash?.toLowerCase()) throw new Error("JWF source hash differs from the reviewed version");
    const probe = createJwfActivationProbe(input, { line: Number(args.line), expectedKey: args.key, reviewed: args.reviewed, loadMode: args.loadMode });
    const directory = path.resolve(args.probeDir);
    // A new directory plus exclusive writes prevents overwriting any live JWF.
    await mkdir(directory, { recursive: false });
    await writeFile(path.join(directory, "inactive.jwf"), probe.inactiveBytes, { flag: "wx" });
    await writeFile(path.join(directory, "active.jwf"), probe.activeBytes, { flag: "wx" });
    await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify({ ...probe.manifest, sourceSha256: hash, inactiveSha256: sha256(probe.inactiveBytes), activeSha256: sha256(probe.activeBytes) }, null, 2)}\n`, { flag: "wx" });
  }
  if (args.output) await writeFile(path.resolve(args.output), `${JSON.stringify(audit, null, 2)}\n`, { flag: "wx" });
  if (args.markdown) await writeFile(path.resolve(args.markdown), markdown(audit), { flag: "wx" });
  return { sourceName: audit.sourceName, sha256: hash, ...audit.summary, firstEndLine: audit.firstEndLine, nativeEvidence: "not-run" };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await runJwfActivationAudit(parseArgs(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
