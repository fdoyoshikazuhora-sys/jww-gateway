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
- unresolved keys are only `LTYPE_HC` and `LCOLLOR_M`

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

The open-items report classifies each item by status, class, conversion impact, evidence, release decision, and next action. Items marked `sample-blocked`, `audit-only`, `metadata-ready`, or `out-of-scope-for-conversion` are tracked deliberately and are not release blockers by default.

## Exit Codes

- `verify:handoff`: `0` means the package is ready and unresolved keys match expectations.
- `sample:plan`: `1` means the sample manifest shape is invalid.
- `sample:plan --strict`: `2` means local sample files are missing.

## Current Limits

- JWW import, conversion, and diagnostics are supported.
- JWW save/write is not supported.
- `LTYPE_HC` and `LCOLLOR_M` remain unresolved until real files show stable direct matches.
- Other open items are classified in `reports\open-items.html` so unresolved research does not look like accidental parser loss.
