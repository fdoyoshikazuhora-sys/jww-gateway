# JWW Gateway Windows Commands

Run these from the standalone `JWW_Gateway` folder.

## Basic Checks

```powershell
.\jww-gateway-status.cmd
.\jww-gateway-verify-all.cmd
.\jww-gateway-verify-handoff.cmd
.\jww-gateway-open-items.cmd --html -o reports\open-items.html
.\jww-gateway-report-index.cmd --html -o reports\index.html
```

| File                             | Purpose                                           |
| -------------------------------- | ------------------------------------------------- |
| `jww-gateway-status.cmd`         | Print package readiness summary.                  |
| `jww-gateway-verify-all.cmd`     | Run smoke, manifest check, reports.               |
| `jww-gateway-verify-handoff.cmd` | Run handoff verification and unresolved-key gate. |
| `jww-gateway-open-items.cmd`     | Export known limitations and remaining research items. |
| `jww-gateway-report-index.cmd`   | Generate an index for files under `reports\`.      |
| `jww-gateway-verify-report.cmd`  | Generate one verify report format.                |
| `jww-gateway-verify-diff.cmd`    | Compare two verify-report JSON files.             |

## JWW Import And Diagnostics

```powershell
.\jww-gateway-convert.cmd "C:\path\to\file.jww" -o output.json
.\jww-gateway-coverage.cmd "C:\path\to\file.jww" --scope drawing --status missing --html -o coverage.html
.\jww-gateway-coverage-summary.cmd coverage-a.json coverage-b.json --html -o coverage-summary.html
.\jww-gateway-diagnose.cmd "C:\path\to\file.jww" --html -o diagnostics.html
.\jww-gateway-validate.cmd output.json
```

| File                               | Purpose                                   |
| ---------------------------------- | ----------------------------------------- |
| `jww-gateway-convert.cmd`          | Convert JWW to CAD Studio JSON.           |
| `jww-gateway-coverage.cmd`         | Report extracted/missing JWF-like keys.   |
| `jww-gateway-coverage-summary.cmd` | Summarize multiple coverage JSON reports. |
| `jww-gateway-diagnose.cmd`         | Generate diagnostics for one JWW file.    |
| `jww-gateway-validate.cmd`         | Validate converted CAD Studio JWW JSON.   |
| `jww-gateway-diff.cmd`             | Compare two diagnostics JSON reports.     |
| `jww-gateway-env-scan.cmd`         | Scan JWW environment regions.             |

## JWF Environment Checks

```powershell
.\jww-gateway-jwf-parse.cmd "C:\path\to\file.jwf" --summary
.\jww-gateway-jwf-compare.cmd "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --html -o jwf-compare.html
.\jww-gateway-jwf-value-scan.cmd "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --html -o value-scan.html
.\jww-gateway-core-open-summary.cmd core-a.json core-b.json --summary --fail-on-direct-matches
.\jww-gateway-special-color-audit.cmd "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --html -o special-colors.html
.\jww-gateway-special-color-summary.cmd special-a.json special-b.json --html -o special-summary.html
.\jww-gateway-layer-defaults-audit.cmd "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --html -o layer-defaults.html
.\jww-gateway-layer-defaults-summary.cmd layer-a.json layer-b.json --html -o layer-summary.html
.\jww-gateway-layer-defaults-summary.cmd layer-a.json layer-b.json --fail-on-promotion-candidates
.\jww-gateway-sample-plan.cmd docs\JWW_GATEWAY_SAMPLE_SETS.example.json --html -o reports\sample-plan.html
```

| File                                     | Purpose                                  |
| ---------------------------------------- | ---------------------------------------- |
| `jww-gateway-jwf-parse.cmd`              | Parse a JWF environment file.            |
| `jww-gateway-jwf-compare.cmd`            | Compare JWW extracted settings to JWF.   |
| `jww-gateway-jwf-value-scan.cmd`         | Scan JWF values inside JWW bytes.        |
| `jww-gateway-core-open-summary.cmd`      | Summarize LTYPE_HC/LCOLLOR_M reports.    |
| `jww-gateway-special-color-audit.cmd`    | Audit LCOLLOR_M nearby color candidates. |
| `jww-gateway-special-color-summary.cmd`  | Summarize multiple special color audits. |
| `jww-gateway-layer-defaults-audit.cmd`   | Audit LAYCOL/LAYWID/LAYTYP directly.     |
| `jww-gateway-layer-defaults-summary.cmd` | Summarize multiple layer default audits. |
| `jww-gateway-sample-plan.cmd`            | Plan repeatable checks for JWW/JWF sets. |

## Notes

- Paths with spaces must be quoted.
- All arguments after the `.cmd` file are passed through to the npm command.
- `reports\` is recreated when the standalone package is regenerated.
- JWW save/write is not supported.
