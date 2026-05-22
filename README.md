# JWW Gateway

JWW Gateway is a standalone CLI for JWW import, conversion, and diagnostics.
It reads Jw_cad `.jww` files, converts them into CAD Studio compatible JSON, and writes diagnostic reports.
JWW save/write is not supported.

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

Validate converted CAD Studio JWW JSON:

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
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --family layerColors,layerLineTypes --html -o layer-defaults.html
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --key LTYPE_HC,LCOLLOR_M --html -o core-open.html
```

Scan exact JWF numeric/color byte patterns inside a JWW file:

```powershell
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --html -o value-scan.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --scope drawing --status missing,ambiguous --html -o drawing-open.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --scope drawing --gateway-status missing --html -o drawing-gateway-missing.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --family layerColors,layerLineTypes --html -o layer-defaults-scan.html
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

The coverage summary includes `alwaysMissingDrawing` so drawing-related gaps can be checked separately from document and operation settings. It also splits those drawing gaps into `core`, `layerDefaults`, and `other`. The layer defaults summary can fail on direct LAYCOL/LAYWID/LAYTYP candidates with `--fail-on-direct-matches`. The key-level summary includes missing/matched counts and direct-match true/false counts. This is mainly used for currently unresolved JWF-derived keys such as `LTYPE_HC` and `LCOLLOR_M`, where a candidate can exist in the JWW bytes but still not match the JWF value directly.

Check that the standalone package is complete:

```powershell
npm run smoke
npm run status
npm run verify
npm run verify:reports
npm run verify:all
npm run verify:handoff
npm run open-items
npm run reports:index -- --html -o reports\index.html
npm run verify:report -- -o reports\verify-report.txt
npm run verify:report -- --json -o reports\verify-report.json
npm run verify:report -- --csv -o reports\verify-report.csv
npm run verify:report -- --html -o reports\verify-report.html
npm run verify:report -- --expect-unresolved LTYPE_HC,LCOLLOR_M
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
`verify` runs the smoke check and validates `JWW_GATEWAY_MANIFEST.json --check-files`. `verify:reports` writes txt/json/csv/html handoff reports in one run. `verify:all` runs verification, handoff reports, open-items, and the report index. `verify:handoff` runs `verify:all` and then enforces that the only unresolved environment keys are `LTYPE_HC` and `LCOLLOR_M`. `open-items` writes the known open items from the manifest as txt/json/csv/html, including classification, conversion impact, evidence, release decision, and next action. `reports:index` writes a recipient-facing index of generated report files. `verify:report` writes one compact handoff report for the package, manifest, required files, scripts, binaries, and unresolved keys. Use `--expect-unresolved LTYPE_HC,LCOLLOR_M` when you want the handoff check to fail if unresolved keys are added or removed unexpectedly. `verify:diff` compares two verify-report JSON files and highlights added, removed, and changed package files. Generated review artifacts should be written under `reports\`; this folder is recreated whenever the package is regenerated. See `reports/README.md` for the expected report types.

## Encoding

Default encoding is `shift_jis`.

```powershell
npm run convert -- "C:\path\to\file.jww" --encoding shift_jis -o output.json
```

Supported values: `shift_jis`, `utf-8`, `utf-16le`, `utf-16be`.

## Notes

- JWW save/write is not supported.
- The output keeps JWW-specific metadata such as layer groups, scale labels, colors, arc source angles, text special runs, and text decoration segments.
- Real-file comparison is still recommended for tilted arcs, ellipse-like arcs, and complex JWW text decoration.
- `LTYPE_HC` and `LCOLLOR_M` are intentionally left as unresolved environment keys until real files show stable direct matches.
- Open items are classified as sample-blocked, audit-only, metadata-ready, separate-project, or out-of-scope-for-conversion so unresolved research items are not treated as release blockers by default.
