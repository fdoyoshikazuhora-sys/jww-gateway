# JWW Gateway

JWW Gateway is a standalone CLI for JWW import, conversion, diagnostics, semantic comparison, and bounded v600/v700 output.
It reads Jw_cad `.jww` files, converts them into JWW Gateway JSON, and writes diagnostic reports.
JWW write is available for internal versions 600 and 700 through an explicit bounded writer. Unsupported entity types fail by default.

日本語の取扱説明は [README.ja.md](README.ja.md) を参照してください。

This package also produces diagnostics reports for colors, text decoding, unsupported classes, arc conversion, and stray entity candidates.

Package metadata is written to `JWW_GATEWAY_MANIFEST.json`. Use it to inspect supported commands, encodings, output schema, capabilities, and unresolved JWF-derived keys. The manifest shape is documented by `docs/jww-gateway-manifest.schema.json`.

For release or handoff, follow `docs/JWW_GATEWAY_RELEASE_CHECKLIST.md`.
For the current package status and known limitations, see `docs/JWW_GATEWAY_RELEASE_NOTES.md`.
For generated review files, see `docs/JWW_GATEWAY_REPORTS.md` or `reports/README.md`.

## Commands

Convert a JWW file to JSON:

```powershell
npm run convert -- "C:\path\to\file.jww" -o output.json
```

Diagnose a JWW file:

```powershell
npm run diagnose -- "C:\path\to\file.jww"
npm run diagnose -- "C:\path\to\file.jww" --json -o diagnostics.json
npm run diagnose -- "C:\path\to\file.jww" --csv -o diagnostics.csv
npm run diagnose -- "C:\path\to\file.jww" --html -o diagnostics.html
npm run diagnose -- "C:\path\to\file.jww" --json --outlier-limit 40 --outlier-distance-min 500 -o diagnostics.json
```

Report JWF-like environment coverage extracted from a JWW file:

```powershell
npm run coverage -- "C:\path\to\file.jww"
npm run coverage -- "C:\path\to\file.jww" --scope drawing --status missing --html -o coverage.html
npm run coverage -- "C:\path\to\file.jww" --family lineTypes,screenColors --csv -o coverage.csv
```

Compare two diagnostics JSON files:

```powershell
npm run diff -- before.json after.json --html -o diff.html
```

Scan JWW environment regions across one or more files:

```powershell
npm run env:scan -- "C:\path\to\file.jww"
npm run env:scan -- "C:\path\to\folder" --recursive --csv -o env-scan.csv
```

Audit parser conformance separately from writer and Jw_cad round-trip evidence:

```powershell
npm run conformance -- "C:\path\to\file.jww"
npm run conformance -- "C:\path\to\folder" --recursive --json -o conformance.json
npm run conformance -- "C:\path\to\folder" --recursive --require-clean-parse
```

`parsed-without-reported-loss` means only that the parser reported no unsupported or skipped records. It does not prove exact rendering, writer fidelity, or successful reopening in Jw_cad.

Write Gateway JSON as JWW v600 or v700:

```powershell
npm run write -- input.json -o output.jww --version 700
npm run write -- input.json -o output-v600.jww --version 600
npm run write -- input.json -o output.jww --template source.jww
```

Compare two JWW files by normalized drawing meaning, document metadata, and Jw_cad internal settings. `drawingRoundTripCompatible` ignores metadata but requires a clean parse; `roundTripCompatible` also requires document metadata equality. Internal Jw_cad settings remain a separate result:

```powershell
npm run semantic:diff -- before.jww after.jww
npm run semantic:diff -- before.jww after.jww --json --fail-on-drawing-difference
```

The writer handles the entity families covered by its tests and rejects unknown types unless `--allow-unsupported` is explicitly supplied. For editing an existing file, use that same source JWW as `--template`; an unrelated template can carry a different text-style table. Supported native structures include `CDataSunpou` dimensions, `CDataBlock` references with `CDataList` definitions, external image references, and v700 embedded image payloads. Jw_cad reopen/resave results are recorded separately from parser and semantic-diff results.

Generate the entity-family round-trip corpus:

```powershell
npm run roundtrip:corpus
```

The generated corpus contains seven v600 and eight v700 fixtures. Every fixture must parse cleanly and preserve both normalized drawing meaning and supported document metadata after Gateway JSON to JWW to JSON round trip.

Validate converted JWW Gateway JSON:

```powershell
npm run validate -- output.json
npm run validate -- output.json --json
```

Parse a JWF environment file:

```powershell
npm run jwf:parse -- "C:\jww\Jw_win.jwf" --summary
npm run jwf:parse -- "C:\jww\Sample.jwf" --include-after-end -o sample-jwf.json
```

Compare JWW extracted environment coverage against a JWF file:

```powershell
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --html -o jwf-compare.html
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --scope drawing --status missing --html -o drawing-missing.html
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --family layerColors,layerLineTypes,layerWidths --status not-serialized --html -o layer-defaults.html
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --key LTYPE_HC,LCOLLOR_M --html -o core-open.html
```

Scan exact JWF numeric/color byte patterns inside a JWW file:

```powershell
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --html -o value-scan.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --scope drawing --status missing,ambiguous --html -o drawing-open.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --scope drawing --gateway-status missing --html -o drawing-gateway-missing.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --family layerColors,layerLineTypes,layerWidths --gateway-status not-serialized --html -o layer-defaults-scan.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --key LTYPE_HC,LCOLLOR_M --html -o core-open-scan.html
```

Summarize multiple core-open value scan JSON reports:

```powershell
npm run value-scan:summary -- text-a.json text-b.json --html -o value-summary.html
npm run value-scan:summary -- text-a.json text-b.json --csv -o value-summary.csv
npm run value-scan:summary -- full-a.json full-b.json --summary --fail-on-promotion-candidates -o reports\full-summary.txt
npm run coverage:summary -- coverage-a.json coverage-b.json --summary
npm run coverage:summary -- coverage-a.json coverage-b.json --fail-on-always-missing-drawing
npm run core:summary -- core-a.json core-b.json --summary
npm run core:summary -- core-a.json core-b.json --html -o core-summary.html
npm run core:summary -- core-a.json core-b.json --csv -o core-summary.csv
npm run core:summary -- core-a.json core-b.json --fail-on-direct-matches
npm run special-color:audit -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --html -o special-colors.html
npm run special-color:summary -- special-a.json special-b.json --html -o special-summary.html
npm run special-color:summary -- special-a.json special-b.json --fail-on-direct-matches
npm run layer-defaults:summary -- layer-a.json layer-b.json --html -o layer-summary.html
npm run layer-defaults:summary -- layer-a.json layer-b.json --csv -o layer-summary.csv
npm run layer-defaults:summary -- layer-a.json layer-b.json --fail-on-direct-matches
npm run layer-defaults:summary -- layer-a.json layer-b.json --fail-on-promotion-candidates
npm run sample:plan -- docs\JWW_GATEWAY_SAMPLE_SETS.example.json --html -o reports\sample-plan.html
npm run open-items -- --html -o reports\open-items.html
npm run reports:index -- --html -o reports\index.html
```

The coverage summary includes `alwaysMissingDrawing` so drawing-related gaps can be checked separately from document and operation settings. Historical layer-default audit reports remain readable, but `LAYCOL_*`, `LAYWID_*`, and `LAYTYP_*` are now classified as JWF-only write-layer operation defaults with `gatewayStatus: not-serialized`; byte matches are not parser promotion candidates. `LTYPE_HC` and `LCOLLOR_M` have the same non-serialized JWF-only classification.

Check that the standalone package is complete:

```powershell
npm run smoke
npm run status
npm run verify
npm run verify:conformance
npm run verify:reports
npm run verify:all
npm run verify:handoff
npm run open-items
npm run reports:index -- --html -o reports\index.html
npm run verify:report -- -o reports\verify-report.txt
npm run verify:report -- --json -o reports\verify-report.json
npm run verify:report -- --csv -o reports\verify-report.csv
npm run verify:report -- --html -o reports\verify-report.html
npm run verify:report -- --expect-no-unresolved
npm run verify:diff -- reports\before-verify-report.json reports\verify-report.json --csv --allow-differences -o reports\verify-diff.csv
npm run verify:diff -- reports\before-verify-report.json reports\verify-report.json --html -o reports\verify-diff.html
```

Validate package metadata manifest:

```powershell
npm run manifest:validate
npm run manifest:validate -- JWW_GATEWAY_MANIFEST.json --json
npm run manifest:validate -- JWW_GATEWAY_MANIFEST.json --check-files --json
```

The smoke check verifies required files, CLI imports, schema validation for valid and invalid JWW metadata, value-scan RGB patterns, and core-open direct-match summary counts.
`verify` runs the smoke check and validates `JWW_GATEWAY_MANIFEST.json --check-files`. `verify:reports` writes txt/json/csv/html handoff reports in one run. `verify:all` runs verification, handoff reports, open-items, and the report index. `verify:handoff` runs `verify:all` and then enforces that no unresolved environment keys remain. `open-items` writes the known open items from the manifest as txt/json/csv/html, including classification, conversion impact, evidence, release decision, and next action. `reports:index` writes a recipient-facing index of generated report files. `verify:report` writes one compact handoff report for the package, manifest, required files, scripts, binaries, and unresolved keys. Use `--expect-no-unresolved` when you want the handoff check to fail if any unresolved environment key is added. `verify:diff` compares two verify-report JSON files and highlights added, removed, and changed package files. Generated review artifacts should be written under `reports\`; this folder is recreated whenever the package is regenerated. See `reports/README.md` for the expected report types.

## Encoding

Default encoding is `shift_jis`.

```powershell
npm run convert -- "C:\path\to\file.jww" --encoding shift_jis -o output.json
```

Supported values: `shift_jis`, `utf-8`, `utf-16le`, `utf-16be`.

## Notes

- JWW write is bounded to internal versions 600 and 700; unsupported entity types fail by default. Native dimensions, block definitions/references, external image references, and v700 embedded image payloads are covered by focused tests and the generated corpus.
- The output keeps JWW-specific metadata such as layer groups, scale labels, colors, arc source angles, text special runs, and text decoration segments.
- Native Basic Settings dimension edits use the official five packed dimension DWORDs and source-splice only their fixed prefix fields. The surrounding dummy DWORDs, signed maximum draw-width code, entities, blocks, images, unknown regions, and trailing bytes remain source-preserved.
- Native Basic Settings grid edits use the official signed mode DWORD and five `double` values. The 44-byte region is source-spliced without rewriting adjacent print settings, layer names, drawing records, blocks, images, unknown regions, or trailing bytes.
- Native Basic Settings color edits use the official contiguous 240-byte screen/print tables. Screen and print entries are numbered `0-9`; the former heuristic screen entry `10` was print-background data and has been removed. Only the verified table span is source-spliced.
- Known Jw_cad print/view setting rows stored at the internal `(0, -1000)` sentinel are excluded from drawing entities and preserved under `meta.jwwInternalSettings`.
- Tilted circles and ellipse arcs expose parameter-preserving geometry and exact bounds. A targeted v700 fixture reopened and resaved in Jw_cad 10.02.1 with zero drawing semantic changes; downstream renderers must consume this explicit geometry contract. JWW text decoration raw controls and structured runs survive Gateway JSON and native rebuild saves; exact visual overprint remains a downstream renderer responsibility.
- `LTYPE_HC` and `LCOLLOR_M` are JWF-only operation/display settings. Controlled Jw_cad 10.02.1 Save As and reload tests show that they are not serialized into JWW.
- Open items are classified by their actual evidence boundary, including old-release-runtime, audit-only, metadata-ready, separate-project, and out-of-scope-for-conversion, so unresolved research items are not treated as current-version parser failures.
