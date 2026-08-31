# JWW Gateway Release Notes

## 0.1.0

JWW Gateway is a standalone command-line package for JWW import, conversion,
diagnostics, JWF comparison, and package handoff verification.

### Supported

- JWW import, conversion, and diagnostics.
- JWW Gateway JSON output.
- Bounded JWW v600/v700 writer with strict unsupported-type rejection.
- Native `CDataSunpou` dimension, `CDataBlock`/`CDataList` block, external image reference, and v700 embedded image read/write support.
- Native Basic Settings dimension metadata has a stable source span and patch target; the official five packed DWORDs can be edited through named English controls without rewriting the retained dummy and maximum draw-width fields.
- Jw_cad 10.02.1 reopened the real v700 dimension-settings validation output. Its Dimension Settings dialog displayed the intended text type `3`, line/extension/point colors `4`/`5`/`6`, value and extension offsets `2.5`/`3.5`, arrow length/angle/reverse projection `4`/`25`/`7`, italic and bold flags, three decimal places, two angle decimal places, and dimension-object creation; the drawing remained A-2 at 1:60.
- Jw_cad 10.02.1 reopened and edited a v700 Gateway output containing LINE,
  CIRCLE, ARC, TEXT, POINT, SOLID, DIMENSION, BLOCK/INSERT, and IMAGE. A
  Jw_cad-normalized Gateway rewrite was byte-identical before the intended
  point edit; see `JWW_WRITE_EVIDENCE.md`.
- Generated entity-family round-trip corpus: seven v600 and eight v700 fixtures with parser-clean drawing and document semantic gates.
- Fifteen Jw_cad-installed v600 samples totaling 22,624 drawing entities pass
  parser-clean Gateway template rewrites with drawing/document semantic equality.
  Jw_cad 10.02.1 opened, edited, saved, and reopened a representative output;
  Gateway then reproduced the saved v700 file byte-for-byte.
- Semantic JWW diff separating drawing order/geometry, document metadata, and Jw_cad internal settings.
- JWF-like environment coverage reports from JWW files.
- Cross-file coverage summary reports with a drawing-scope missing gate.
- Focused LAYCOL/LAYWID/LAYTYP layer defaults audit and summary reports.
- Focused LCOLLOR_M special color audit and cross-file summary reports.
- Encodings: `shift_jis`, `utf-8`, `utf-16le`, `utf-16be`.
- JWW color table extraction, including file-specific RGB values.
- Jw_cad internal print/view setting text is separated from drawing entities
  and preserved as structured conversion metadata.
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

- JWW writer compatibility remains bounded to internal versions 600/700 and
  tested entity families. Version-wide compatibility and other Jw_cad releases
  remain the separate `jww-version-conformance` gate. Current evidence includes
  15 Jw_cad-installed v600 samples and a representative Jw_cad 10.02.1
  open/edit/save/reload cycle. The remaining gate is an actual Jw_cad 6.x
  runtime plus independently sourced v600 DIMENSION, BLOCK/INSERT, and IMAGE
  samples.
- `LTYPE_HC`, `LCOLLOR_M`, and `LAYCOL/LAYWID/LAYTYP_0..F` are classified as
  JWF-only operation/default settings. Controlled Jw_cad 10.02.1 Save As tests
  show that they are not serialized into JWW.
- Operation-only JWF settings are tracked for environment research but are not
  required for drawing conversion.
- JWW text decoration raw controls, special runs, and segments are preserved
  through Gateway JSON and native structural rebuilds. Exact visual overprint
  remains a downstream renderer responsibility; see
  `JWW_TEXT_DECORATION_CONTRACT.md`.
- Tilted circles and ellipse arcs now expose parameter-preserving geometry and
  exact bounds through `jww-gateway/geometry`. A targeted v700 fixture reopened
  and resaved in Jw_cad 10.02.1 with zero drawing semantic differences. New
  binary patterns remain part of the broader version-conformance sample gate.

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
