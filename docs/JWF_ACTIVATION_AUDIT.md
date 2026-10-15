# JWF Activation Audit

Date: 2026-10-15. Status: investigation and scoped remediation, **not complete JWF support**.

## Scope And Sources

Follow the JWF-first investigation requested by the owner. Do not automatically apply a JWF to an existing JWW or propagate `JWW_CIRCULAR_SOLID` into consumers as part of this change.

- [Official Jw_cad download page](https://www.jwcad.net/download.htm), checked on 2026-10-15, advertises 10.03.7. The new distribution has not been extracted or compared in this audit.
- [Official JWW binary-format reference](https://www.jwcad.net/jwdatafmt.txt) remains the separate source for drawing entities and serialization. The web text reader could not decode this Shift_JIS resource on this pass; no new binary-layout claim is made here.
- Primary JWF reference examined: installed `C:/JWW/Sample.jwf`, 93,057 bytes, SHA-256 `c6ca97617d4f2b037cec4c4c280c1bb5c963aa106d44cef37caf3aac8a6b8f38`. Its file timestamp is 2015-01-12, and provenance has not been matched against the current download.
- Installed executable: `C:/JWW/Jw_win.exe`, file version `10.2.1.0`, SHA-256 `95e6b11c4ee014e0079f288429ae2c6e5eed41141a963e4b8770d2e8ead87acf`. It was not launched for these tests.
- The live `C:/JWW/jw_win.JWF` is not a test output. Its baseline SHA-256 is `0cfe66d4b3576695d9b882c2ee05009ef33fd5e2c3bf4e082de4b0d49d58e8d1`.

Source line numbers below refer only to the pinned installed sample, not every Jw_cad version. Local reference text is not copied into the repository wholesale.

## Inventory

The [row matrix](JWF_SAMPLE_ACTIVATION_MATRIX.md) preserves every assignment occurrence, including alternatives. It is not limited to the active-key dictionary returned by the ordinary parser.

| Item | Count | Interpretation |
| --- | ---: | --- |
| Assignment rows | 236 | Includes comments and rows behind END |
| Distinct keys | 230 | Example keys, not all possible family members |
| Commented assignments | 26 | Must review each example and its dependencies |
| Uncommented assignments behind END | 210 | Inactive in this source file |
| Active assignments | 0 | The first END is on line 34 |
| Rows without a Gateway definition | 23 | 19 distinct keys; raw preservation is not semantic support |
| Numeric command-reference rows | 120 | Documentation, not settings to activate |
| Other non-comment lines | 7 | Separators/headings/notes at 1784-1786, 1848-1849, 1893, 1924 |

The previous 210-key inventory omitted commented alternatives. Even 230 distinct keys is not proof of exhaustive JWF coverage: families can have more members than the sample, and some keys occur only in prose.

## Commented Row Review

| Source lines | Keys | Documented purpose and dependency | Current gate |
| --- | --- | --- | --- |
| 126, 128 | LD2_RV, RD2_RV | Twelve hourly enable switches for clock-menu attribute changes; depends on the negative switching-distance mode described at 97-123 | Definition and native behavior pending |
| 139, 142, 145, 148, 151 | COM_RV01/11/21/31/41 | Per-command left/right attribute-change modes; reserved command positions and text/dimension exceptions at 130-151 | Definition and native behavior pending |
| 159 | COM_RV_C | Decimal-packed left/right clock-menu text colors, not a command number | Definition and native behavior pending |
| 625, 628 | R_STR0_00 | Alternative Km/shaku unit presets; five numeric parameters plus comma-delimited unit text; later dimension rows can override two settings | Isolated byte probes generated; native behavior pending |
| 681-683, 687-692 | R_CROSS_ST1..6 | Alternative unit-label stroke coordinates; example sets must not be combined accidentally; description mentions up to 30 strokes | Exact family naming/range and native behavior pending; no guessed aliases |
| 867 | P_dpi | Printer-resolution example; documentation at 865-869 says 300/600 and not written back to JWF | Isolated byte probe generated; native/printer behavior pending |
| 1714 | TNKZ_SET | Sky-diagram settings with packed colors, text types, threshold and radius | Field mapping and native behavior pending |
| 1721, 1725 | TNK3_NM1/2 | Reference/planned building labels with a documented 20-byte limit | Encoding limits and native behavior pending |
| 1740, 1744 | TNKN_SET | Alternative numbering prefix/suffix sets, not two independent settings | String layout and native behavior pending |
| 1766 | REF_FILE | External text-substitution file example, not a real reference-file path | Blocked; real fixture and path policy required |

The absence of these keys from a JWF exported by Jw_cad is not evidence that Jw_cad does not support them. Several are documented as read-only inputs to the environment loader and omitted from exports.

Prose-only examples also require review: `AutoSaveDir` at 570-579, `OldVerSave` at 583-596, and `JWW_USER` at 1747-1761. The last changes application-level file-modification permissions and must not be activated casually. The numeric command catalog and `A-Read` loader directive are not normal assignment rows.

## Confirmed Corrections

| Item | Evidence | Change | Remaining boundary |
| --- | --- | --- | --- |
| R_STR0_00 write syntax | 599-628 | Stop quoting the five-number prefix and empty trailing comma segment during form edits; preserve the legacy values array and Japanese text; reject ambiguous layouts | Five parameters still share a raw UI field; no new native unit behavior claimed |
| Unit form | Same source | Label the comma segments correctly, hide the non-setting trailing delimiter, display rejected edits without uncaught browser exceptions | Not a full per-parameter settings UI |
| S_SET5 | 1098-1103 | Define all ten optional angle positions instead of four | Native range and interaction tests pending |
| ZF_SET | 1106-1127 | Correct shape-setting mislabel to coordinate-file input/output; name six positions | Persistence is not inferred from the existing generic document scope |
| CU_SET | 1166-1193 | Correct the previously misaligned field names; preserve the ninth packed value | Packed digits are not mapped to speculative JWW offsets |
| Legacy report labels | 1131-1162, 1166-1218 | Correct SL_SET, CU_SET, MS_SET meanings | Other historical coverage entries are not silently promoted |

`MS_SET` also combines numeric and comma-delimited string segments. Its typed editing/normalization remains an open item. The new audit does not certify generic editable forms as semantically correct merely because they can retain raw values.

## Isolated Probe Tool

```powershell
npm run jwf:activation-audit -- C:/JWW/Sample.jwf --output .work/new-audit.json --markdown .work/new-matrix.md
npm run jwf:activation-audit -- C:/JWW/Sample.jwf --probe-line 625 --expect-key R_STR0_00 --expect-sha256 c6ca97617d4f2b037cec4c4c280c1bb5c963aa106d44cef37caf3aac8a6b8f38 --probe-dir .work/new-km-probe --load-mode manual --reviewed
```

Report paths must not exist. Probe directories must be new and their parent must exist. The tool never loads Jw_cad or overwrites the source. It writes `inactive.jwf`, `active.jwf`, and a hash-pinned manifest. Only the selected leading ASCII `#` differs between the two profiles; both end with an explicit END. Source END lines remain untouched. Malformed Shift_JIS and Unicode BOM inputs are rejected, not silently converted.

`--reviewed` records an explicit context/dependency-review assertion, not native acceptance. Unknown Gateway definitions and external-reference examples remain blocked. `S_COMM_0` and `S_MESH_0` require the startup test protocol; other keys are not automatically declared manual-load compatible.

Local probes generated from the pinned reference: `.work/jwf-probe-km` (625), `.work/jwf-probe-shaku` (628), `.work/jwf-probe-dpi` (867). Their native-evidence status remains `not-run`.

## Native Test Protocol

1. Pin the target Jw_cad version and obtain its matching distributed reference. Diff keys, ranges, comments and directives against this inventory before claiming current-version coverage.
2. Use a disposable Windows user/VM or a proven restorable application profile. Copying the executable alone is not assumed to isolate registry/profile settings. Preserve live files and registry state.
3. Restore the identical baseline before **each** inactive/active arm. Loading the inactive file after the active one does not reset the setting: omitted/commented keys leave previous state intact.
4. Separate manual-load and startup-load tests. Respect file order, repeated keys, earlier END, dependent settings, and dimension read/save switches such as S_COMM_8. Test new drawings and existing drawings separately.
5. Apply one reviewed row/value change at a time. Record UI state, actual command behavior, exported JWF and JWW before/after, native Save As/reopen, binary spans and normalized semantic differences. Check all aliases and family members explicitly.
6. A missing JWF export or unchanged JWW is not automatically a failure: distinguish non-exported environment state, transient command state and serialized drawing state. Conversely, a numeric byte match alone is not proof of a field mapping.
7. Only after Gateway evidence is sound, run authorized mep-draft import/edit/save/reopen tests. CAD Studio Pro remains outside this change because it is being edited on another PC.

JWF analysis may identify defaults used to create circular solids, but it does not replace verification of existing CDataSolid geometry. `JWW_CIRCULAR_SOLID` is a Gateway intermediate type. Its display/edit/save contract and consumer compatibility remain separate, unverified gates; no consumer files were changed.

## Verification

| Layer | Result on 2026-10-15 | Boundary |
| --- | --- | --- |
| Focused JWF parser/audit/CLI tests | 32/32 passed | Includes 15 new tests; byte-isolated activation, guards, encoding, no-overwrite, mixed unit syntax |
| Full `npm test` | 320/320 passed | Gateway code, not native Jw_cad |
| `npm run verify` | Passed | Smoke and manifest file checks |
| JWW generated round-trip corpus | 41/41 passed | Prior geometry/metadata behavior retained; not native acceptance |
| `npm run build` | Unavailable: missing script | No artificial build command was added |
| Browser on localhost:3000 | 11 scoped checks passed, 0 captured errors/warnings | Fresh headless Chrome through Playwright, not native Jw_cad |
| Source preservation | All nine protected canonical files and both installed JWF hashes unchanged | Canonical dirty worktree was not replaced |
| Legacy OneDrive reference scan | No hits in the audit worktree text scan | Excludes `.git`, `.work`, `node_modules`; not a binary/system-wide scan |
| Native Jw_cad / mep-draft | Not run | No setting applied to the live Jw_cad environment |

Browser evidence is recorded in [jwf-activation-browser.json](../reports/jwf-activation-browser.json). Six unchanged probe exports were byte-identical. Unit parameter/text editing, rejected input, Apply, export and reopen passed. The three corrected definitions were individually exercised through form edit/Apply/export, confirming ZF_SET coordinate precision, CU_SET angle unit, and the tenth S_SET5 angle target the intended values. This checks Gateway forms and files, not Jw_cad's interpretation of those values.

Desktop (1440x1000) and narrow-viewport (390x844) screenshots were examined locally. The unit input now fits the tested parameter string. The existing page still has a 720px body minimum at a 390px viewport; full mobile usability remains an open item, not a passing responsive-layout claim. Test servers and the test browser were closed after verification.

Next priorities: matching-version reference acquisition; reviewed definitions for the 19 uncovered keys; mixed-delimiter typed fields including MS_SET; isolated native activation pairs; JWW persistence classification; then mep-draft integration. Stop and mark any unsupported semantic claim as unverified rather than inventing a mapping.
