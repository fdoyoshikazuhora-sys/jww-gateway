# JWW Gateway Reports

Generated review artifacts should be written under `reports\` in the standalone package.

Common report files:

- `index.html`: one-page index of generated reports and the commands that create missing optional reports.
- `verify-report.txt`, `verify-report.json`, `verify-report.csv`, `verify-report.html`: package readiness, manifest validity, required files, scripts, binaries, unresolved keys, and file inventory.
- `verify-diff.*`: differences between two `verify-report.json` files.
- `open-items.*`: known limitations and remaining research items from `JWW_GATEWAY_MANIFEST.json`. Each row includes status, category, classification, conversion impact, evidence, release decision, and next action so an item is not mistaken for a release blocker just because it is still open.
- `sample-plan.txt`, `sample-plan.json`, `sample-plan.csv`, `sample-plan.html`: repeatable command plans for local `.jww + .jwf` sample sets.
- `*.diagnostics.*`: JWW conversion diagnostics, including unsupported classes and outlier candidates.
- `*.coverage.*`: JWF-like environment coverage extracted from a JWW file.
- `*.jwf-compare.*`: JWW extracted settings compared with a `.jwf` file.
- `*.value-scan.*`: raw numeric/color byte-pattern scans against a `.jwf` file.
- `*.core-open.json`: historical focused scans for the former core open items `LTYPE_HC` and `LCOLLOR_M`; current scans classify both as non-serialized JWF-only operation/display keys.
- `*.special-color.json`: focused audits for special color settings such as `LCOLLOR_M`.
- `*.layer-defaults.json`: historical and controlled evidence for JWF-only layer default color, width, and line type settings; current rows report `gatewayStatus: not-serialized`.
- `*-summary.*`: cross-sample summaries for coverage, core-open keys, special colors, and layer defaults.

The package generator recreates `reports\`. Keep long-term evidence in the source project, the GitHub backup, or a dated local backup.

Generate the index after creating reports:

```powershell
npm run reports:index -- --html -o reports\index.html
```
