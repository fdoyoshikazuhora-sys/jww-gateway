# JWW Gateway Reports

Generated review artifacts should be written under `reports\` in the standalone package.

Common report files:

- `index.html`: one-page index of generated reports and the commands that create missing optional reports.
- `conformance.json`: observed JWW versions, entity types, unsupported classes, and skipped records. A clean parser result is not a Jw_cad round-trip guarantee.
- `verify-report.txt`, `verify-report.json`, `verify-report.csv`, `verify-report.html`: package readiness, manifest validity, required files, scripts, binaries, unresolved keys, and file inventory.
- `verify-diff.*`: differences between two `verify-report.json` files.
- `open-items.*`: classified limitations and remaining research items from `JWW_GATEWAY_MANIFEST.json`, including conversion impact, evidence, release decision, and next action.
- `sample-plan.txt`, `sample-plan.json`, `sample-plan.csv`, `sample-plan.html`: repeatable command plans for local `.jww + .jwf` sample sets.
- `*.diagnostics.*`: JWW conversion diagnostics, including unsupported classes and outlier candidates.
- `*.coverage.*`: JWF-like environment coverage extracted from a JWW file.
- `*.jwf-compare.*`: JWW extracted settings compared with a `.jwf` file.
- `*.value-scan.*`: raw numeric/color byte-pattern scans against a `.jwf` file.
- `*.core-open.json`: historical focused scans that helped prove `LTYPE_HC` and `LCOLLOR_M` are not serialized into JWW.
- `*.special-color.json`: focused audits for special color settings such as `LCOLLOR_M`.
- `*.layer-defaults.json`: focused audits for layer default color, width, and line type settings.
- `*-summary.*`: cross-sample summaries for coverage, core-open keys, special colors, and layer defaults.

The package generator recreates `reports\`. Keep long-term evidence in the source project, the GitHub backup, or a dated local backup.

Generate the index after creating reports:

```powershell
npm run reports:index -- --json -o reports\index.json
npm run reports:index -- --html -o reports\index.html
```
