# JWW Gateway Release Notes

## 0.1.0

JWW Gateway is a standalone command-line package for JWW import, conversion,
diagnostics, JWF comparison, and package handoff verification.

### Supported

- JWW import, conversion, and diagnostics.
- JWW Gateway JSON output.
- JWF-like environment coverage reports from JWW files.
- Cross-file coverage summary reports with a drawing-scope missing gate.
- Focused LAYCOL/LAYWID/LAYTYP layer defaults audit and summary reports.
- Focused LCOLLOR_M special color audit and cross-file summary reports.
- Encodings: `shift_jis`, `utf-8`, `utf-16le`, `utf-16be`.
- JWW color table extraction, including file-specific RGB values.
- Black/white color inversion metadata for downstream display handling.
- JWF parsing, JWW/JWF coverage comparison, value scans, and cross-sample
  summaries.
- Diagnostics for text decoding, unresolved colors, unsupported classes, arc
  conversion, and outlier entity candidates.
- Manifest validation and standalone package verification.
- Compact package status output.
- Compact package status includes manifest identity, handoff entry, and primary commands.
- Open-items report for known limitations and remaining JWW/JWF research items,
  including classification, conversion impact, evidence, and release decision.
- Report index output for generated handoff artifacts in `reports\`.
- Windows `.cmd` shortcuts for status, full verification, and handoff verification.
- Windows `.cmd` pass-through shortcuts for conversion and diagnostics.
- Windows `.cmd` pass-through shortcuts for JWF parse, compare, and value-scan.
- Windows `.cmd` pass-through shortcuts for validation, environment scanning,
  and report diffs.
- Windows shortcut index in `docs/JWW_GATEWAY_WINDOWS_COMMANDS.md`.
- Short recipient-facing handoff note in `JWW_GATEWAY_HANDOFF.md`.
- Handoff reports in txt, JSON, CSV, and HTML.
- Verify-report diff output for package handoff comparison.
- Sample-set planning reports for repeatable `.jww + .jwf` checks.
- Sample-set manifest schema and validation errors in `sample:plan`.
- Report artifact guide in `docs/JWW_GATEWAY_REPORTS.md` and packaged `reports\README.md`.

### Known Limitations

- JWW save/write is not supported.
- `LTYPE_HC` and `LCOLLOR_M` are intentionally unresolved until real files show
  stable direct matches.
- `LAYCOL_*`, `LAYWID_*`, and `LAYTYP_*` remain audit-only because entity-level
  color, width, and line type are already read, while the JWF layer-default rows
  have not shown stable JWW storage patterns.
- Operation-only JWF settings are tracked for environment research but are not
  required for drawing conversion.
- JWW text decoration is preserved as converted text/decorative metadata, but
  full visual overprint reproduction still needs downstream renderer support.
- Tilted arcs and ellipse-like arcs should still be checked against real files
  when adding new sample patterns.

### Handoff

Before publishing or passing this folder to another app, run:

```powershell
npm run verify:all
npm run verify:handoff
```

Then review:

- `reports\verify-report.txt`
- `reports\verify-report.json`
- `reports\verify-report.csv`
- `reports\verify-report.html`
- `reports\README.md`
- `reports\open-items.html`
- `reports\index.html`

Use `docs/JWW_GATEWAY_RELEASE_CHECKLIST.md` as the short release procedure.
