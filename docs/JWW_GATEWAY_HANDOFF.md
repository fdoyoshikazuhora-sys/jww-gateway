# JWW Gateway Handoff

Use this file as the short entry point when receiving a standalone `JWW_Gateway` folder.

## Quick Check

Run from the `JWW_Gateway` folder:

```powershell
npm run status
npm run verify:handoff
npm run open-items
npm run reports:index -- --html -o reports\index.html
```

Expected:

- `Ready: yes`
- `Manifest schema: docs/jww-gateway-manifest.schema.json`
- `Handoff: JWW_GATEWAY_HANDOFF.md`
- `Known open items` is shown in `status`
- `Missing files: 0`
- `Missing scripts: 0`
- `Missing bins: 0`
- unresolved environment keys: none
- JWF-only operation/default keys: `LTYPE_HC`, `LCOLLOR_M`, and all `LAYCOL/LAYWID/LAYTYP_0..F` keys

On Windows, the same checks can be started with:

```powershell
.\jww-gateway-status.cmd
.\jww-gateway-verify-handoff.cmd
```

The same entry points are also recorded in `JWW_GATEWAY_MANIFEST.json` under `handoff`.

## Sample Plan

Copy `docs\JWW_GATEWAY_SAMPLE_SETS.example.json`, replace the paths with local `.jww + .jwf` pairs, then run:

```powershell
npm run sample:plan -- docs\JWW_GATEWAY_SAMPLE_SETS.example.json --html -o reports\sample-plan.html
```

The plan separates sample manifest validation errors from missing local files. It also emits the individual and cross-sample commands needed for coverage, core-open, special-color, and layer-default checks.

## Reports

Generated review artifacts belong in `reports\`. See `reports\README.md` for the expected report file types and which commands usually create them.
Use `reports\index.html` as the one-page map after generating reports.

Known limitations and remaining research items can be exported with:

```powershell
npm run open-items -- --json -o reports\open-items.json
npm run open-items -- --html -o reports\open-items.html
npm run reports:index -- --html -o reports\index.html
```

The open-items report classifies each item by status, class, conversion impact, evidence, release decision, and next action. Items marked `independent-v600-samples`, `audit-only`, `metadata-ready`, or `out-of-scope-for-conversion` are tracked deliberately and are not current-version parser failures by default.

## Exit Codes

- `verify:handoff`: `0` means the package is ready and unresolved keys match expectations.
- `sample:plan`: `1` means the sample manifest shape is invalid.
- `sample:plan --strict`: `2` means local sample files are missing.

## Current Limits

- JWW import, conversion, and diagnostics are supported.
- JWW write is limited to internal versions 600 and 700 and supported entities.
  Fifteen Jw_cad-installed v600 samples totaling 22,624 drawing entities parse
  cleanly and survive Gateway template rewrites with drawing/document semantic
  equality. All fifteen are byte-identical to files independently retrieved
  from the public `KEINOS/Jw_cad-for-Mac` GitHub mirror, making this standard-
  sample baseline publicly reproducible without adding independently authored
  DIMENSION/BLOCK/IMAGE coverage. Two separately distributed Matrix vehicle
  drawings published in 2008 and 2009 match their published archive MD5 values,
  parse as v600 with zero loss, and add independently authored ARC/CIRCLE/LINE
  parser evidence. Eleven Meiji-maru drawings published by Tokyo University of
  Marine Science and Technology use internal version 600 with runtime-class
  schema 700 and add 48,974 independently authored ARC/CIRCLE/LINE/SOLID/TEXT
  records with zero loss after the parser stopped equating those two version
  fields. Jw_cad 10.02.1 opened, edited, saved, and reopened a
  representative output; Gateway then reproduced that saved v700 file byte-for-
  byte. Jw_cad
  6.20 also opened, separately saved, and reopened generated v600 DIMENSION,
  BLOCK/INSERT, and external IMAGE-reference fixtures; the recorded Save As
  normalizations are documented. A separate generated DIMENSION-fixture cycle
  added one LINE, saved a non-empty parser-clean v600 file, isolated the intended
  LINE from Jw_cad 6.20 normalization in semantic diff, and reloaded visibly in
  Jw_cad 6.20. Public third-party v351 DIMENSION and v214 BLOCK/IMAGE samples
  were then converted by Jw_cad 6.20 into non-empty parser-clean v600 outputs
  and reopened from disk. Entity counts stayed stable; DIMENSION helper slots,
  BLOCK/TEXT pen widths and raw-name metadata, and IMAGE/TEXT pen widths were
  normalized explicitly. The IMAGE absolute reference frame reopened, but its
  unavailable legacy `G:` path prevented bitmap-pixel display. Files that were
  already independently authored/distributed as native v600 DIMENSION,
  BLOCK/INSERT, and IMAGE samples remain the separate conformance gate. See
  `JWW_VERSION_CONFORMANCE_EVIDENCE.md`.
- `LTYPE_HC` and `LCOLLOR_M` are JWF-only operation/display settings and are not serialized into JWW.
- JWW text decoration raw controls and structured runs survive Gateway write
  paths. Exact visual overprint belongs to the downstream renderer; see
  `JWW_TEXT_DECORATION_CONTRACT.md`.
- Other open items are classified in `reports\open-items.html` so unresolved research does not look like accidental parser loss.
