# JWW Gateway Release Checklist

Use this checklist before handing off or publishing a standalone `JWW_Gateway` folder.

## 1. Regenerate the package

Run this from the source project:

```powershell
npm run jww:package:smoke
```

Expected result:

- `..\JWW_Gateway` is regenerated.
- `JWW Gateway smoke check passed` is printed.
- `JWW_GATEWAY_HANDOFF.md` exists at the standalone folder root.

## 2. Verify the standalone folder

Run this from `JWW_Gateway`:

```powershell
npm run status
npm run verify:all
npm run verify:handoff
npm run open-items -- --html -o reports\open-items.html
npm run reports:index -- --html -o reports\index.html
```

On Windows, these can also be run from the standalone folder:

```powershell
.\jww-gateway-status.cmd
.\jww-gateway-verify-all.cmd
.\jww-gateway-verify-handoff.cmd
.\jww-gateway-open-items.cmd --html -o reports\open-items.html
.\jww-gateway-report-index.cmd --html -o reports\index.html
```

Conversion and diagnostics can also be launched with pass-through arguments:

```powershell
.\jww-gateway-convert.cmd "C:\path\to\file.jww" -o output.json
.\jww-gateway-coverage.cmd "C:\path\to\file.jww" --scope drawing --status missing --html -o coverage.html
.\jww-gateway-diagnose.cmd "C:\path\to\file.jww" --html -o diagnostics.html
```

JWF environment checks can be launched the same way:

```powershell
.\jww-gateway-jwf-parse.cmd "C:\path\to\file.jwf" --summary
.\jww-gateway-jwf-compare.cmd "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --html -o jwf-compare.html
.\jww-gateway-jwf-value-scan.cmd "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --html -o value-scan.html
.\jww-gateway-sample-plan.cmd docs\JWW_GATEWAY_SAMPLE_SETS.example.json --html -o reports\sample-plan.html
```

Additional shortcuts are available for validation, environment scanning, and report comparison:

```powershell
.\jww-gateway-validate.cmd output.json
.\jww-gateway-env-scan.cmd "C:\path\to\folder" --recursive --csv -o env-scan.csv
.\jww-gateway-diff.cmd before-diagnostics.json after-diagnostics.json --html -o diagnostics-diff.html
.\jww-gateway-verify-report.cmd --html -o reports\verify-report.html
.\jww-gateway-verify-diff.cmd reports\before-verify-report.json reports\verify-report.json --html --allow-differences -o reports\verify-diff.html
```

See `docs/JWW_GATEWAY_WINDOWS_COMMANDS.md` for the full shortcut list.
Use `JWW_GATEWAY_HANDOFF.md` as the short recipient-facing entry point.

Expected result:

- smoke passes
- manifest validation is valid
- `reports\verify-report.txt`
- `reports\verify-report.json`
- `reports\verify-report.csv`
- `reports\verify-report.html`
- `reports\README.md`
- `reports\open-items.html`
- `reports\index.html`
- optional `reports\sample-plan.html` when a local sample manifest is used

## 3. Review unresolved items

Confirm that the report still lists only expected unresolved environment keys:

- `LTYPE_HC`
- `LCOLLOR_M`

You can make this check fail automatically:

```powershell
npm run verify:handoff
npm run verify:report -- --expect-no-unresolved
```

`LTYPE_HC`, `LCOLLOR_M`, and all `LAYCOL/LAYWID/LAYTYP_0..F` keys are recorded separately as JWF-only operation/default keys; the unresolved environment-key list must stay empty.

## 4. Compare with a previous handoff

If a previous `verify-report.json` exists:

```powershell
npm run verify:diff -- reports\before-verify-report.json reports\verify-report.json --html --allow-differences -o reports\verify-diff.html
```

Use the diff report to confirm added, removed, and changed files are expected.

## 5. Handoff notes

- JWW write/save is bounded to v600/v700 and supported entities; unsupported types must fail unless explicitly allowed.
- Generated review artifacts live in `reports\`.
- Report file types are summarized in `reports\README.md` and `docs/JWW_GATEWAY_REPORTS.md`.
- `reports\` is recreated when the package is regenerated.
- Keep long-term evidence in a dated backup or in the source project.
