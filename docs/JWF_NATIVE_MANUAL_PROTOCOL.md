# JWF Native Manual Verification

Status: test material, NOT completed native acceptance. Target: the remaining 17 optional keys. Read the individual KEY/STEPS.md and manifest.json before each case. Files use Shift_JIS and CRLF. Instructions use English; native menu captions and original JWF Japanese text remain unchanged.

## Source And Limits

Source: installed Jw_cad 10.02.1 Sample.jwf, SHA-256 c6ca97617d4f2b037cec4c4c280c1bb5c963aa106d44cef37caf3aac8a6b8f38. Line references apply only to that source. Official [downloads](https://www.jwcad.net/download.htm) and [history](https://www.jwcad.net/versioninfo.htm) list 10.03.7 on 2026-10-16; the installed version was not upgraded. The [binary JWW specification](https://www.jwcad.net/jwdatafmt.txt) is not a replacement for JWF comments/help. Sample naming discrepancies and undocumented persistence remain unverified.

## Protect The Working Environment

1. Prefer a disposable Windows account or VM with the already installed version of Jw_cad. A copied executable does NOT isolate HKCU preferences. Do not run these profiles in the normal working Jw_cad session.
2. Close all Jw_cad windows after saving any user work. In the disposable environment, snapshot its registry/profile state before testing. Keep an identical restorable baseline for every arm. Do not import a registry backup taken before newer user edits.
3. Copy executable/support files to a TEST runtime. Keep the installed Sample.jwf and jw_win.JWF untouched. Only in this test runtime, replace its startup jw_win.JWF with the selected arm, while Jw_cad is closed. Cancel file-association/install prompts.
4. Clock cases require startup loading: S_COMM_0 is startup-only. The profiles use activation distance 35 and negative switching distance -100 (absolute distance >=70), with per-command clock mode enabled by S_COMM_4. Enter commands directly; do not use external-transformation macros.
5. For other cases, manual loading is Settings (設定) -> Environment File (環境設定ファイル) -> Read (読込み). Loading a commented or missing key does NOT reset its previous value. Restore/restart between off and on arms; never load all case files together.
6. All output goes in the corresponding TEST case directory, using new basenames. Do not overwrite installed examples, source drawings, existing evidence, or live JWF files. REF_FILE reads only the synthetic local reference.txt provided here. No print job is authorized.

## One Case At A Time

1. Record application version, source/profile SHA-256, baseline identity, startup profile and JWF/JWW load order in results.csv. Blank cells are not passes.
2. Run off.jwf with its fixed prerequisites. Record the UI and output before any comparison.
3. Close, restore the identical baseline and start on.jwf; operate the exact command from KEY/STEPS.md. Capture the changed UI/output. Defaults may equal the sample values: that is why explicit contrast profiles are supplied.
4. Repeat each contrast in its own restored baseline. Each contrast changes only the named key, and per-field variants change only that field. Km alternatives are a separate prerequisite family.
5. Export native JWF to a NEW test file when available; record whether the key is present. An export omission does not establish whether a value is stored in JWW. Several clock keys, TNKZ_SET and REF_FILE are explicitly not exported.
6. Save As a NEW JWW, close Jw_cad, restore baseline, start without the active target JWF, reopen the saved drawing. Check generated geometry/text AND the environment control separately.
7. Explicitly reload the same target JWF after reopening, repeat the operation and record the difference. This distinguishes persisted drawing output from reapplied environment behavior.
8. Record PASS only for the exact tested value/command/side/hour, FAIL for an observed mismatch, UNVERIFIED for missing semantics and BLOCKED for unavailable operation. Attach screenshots, exported JWF and output JWW paths/hashes. Never turn NOT_RUN into PASS merely because a profile loaded.
9. Close the test process and restore its captured baseline. Verify hashes of both original JWF files and installed sample drawings. Keep evidence; do not restore another person's or an older session's registry state.

## Seven-Field Boundary Resume

The private `.work/jwf-native-seven-20261016` pack has 21 independent profiles: fields 1/2/4/5/6/7/8, each with ASCII5/6/7. Its `cases.json` is a preparation record, not execution evidence. Read `native-results-recovered.json` and [the latest status matrix](JWF_TNKN_NAME_NATIVE_AUDIT.md) first; `native-results.json` preserves the earlier interrupted record. Do not recreate the pack or overwrite existing output.jww/screenshots.

1. After tool recovery, confirm no unrelated native session is open and recheck the captured original-file/registry baseline. The latest field-4 ASCII7 process was closed and the baseline restored; do not reuse its old handle or coordinates. Listing, selection and explicit activation succeeded, but capture failed again after restart with `foreground window did not report a process id`. Re-select the returned unique window and activate before capture; stop if the single refreshed retry fails. This procedure is not a proven permanent fix.
2. The five previously pending reopens (field-1 ASCII6/7, field-2 ASCII6/7 and field-4 ASCII6) are COMPLETE in a clean inactive-key session. Enlarged building-table labels were observed without edits/resaves; evidence is `reopened-review.jpg` in each case directory. Do not regenerate or overwrite it. Additional visual checks need new evidence names.
3. In separately restored active-startup sessions, generate field-4 ASCII7 and fields 5/6/7/8 ASCII6/7. Fields 1/2/5/6 use the reference branch; fields 4/7/8 use planned. Use Sky -> Triangulation, the same measurement position, building-position and triangle tables, and separate output placement. Record geometry/position if it differs from the previous run.
4. Native Save As to a new case output, close/restore/restart inactive, and reopen each output. For fields 5..8 enlarge the TRIANGLE-number table; a building-table screenshot is insufficient. Parse saved bytes separately to check all affected and unaffected labels/counts. Seven-byte inputs are out of spec and cannot justify changing the six-byte editor limit.
5. Complete the unrun ASCII5 controls for fields 2/4/5/6/7/8 similarly. Retain explicit UNVERIFIED for any unfinished phase; never substitute a Gateway rebuild for native reopen.
6. Post-generation JWF Write/Read has already been performed for field-1 ASCII5 and did not preserve TNKN_SET. Keep that unmodified export and result. Any additional export test must use a fresh filename, a clean inactive-key session for Read, and NEW geometry after Read; merely reopening old generated text does not test environment persistence.

The current pack does not contain Japanese/mixed boundary cases for these seven fields, and no such native result is claimed.

## Manual Input Boundaries

The current computer-use API supports left drag and right click, but not right drag, holding a button while capturing a menu, or mouse motion without a click. Clock-menu side/color checks and passive cursor screenshots therefore require manual input. Do not substitute a left drag for a right-drag result. Capture held menus with another person/camera if necessary; record which mouse button is held.

The twelve clock directions use 0 at the top, increasing clockwise. Read the displayed AM/PM state and hour before releasing. Keep the start point far enough from canvas edges to drag over 100 dots. A screenshot of a released menu is not evidence of its held color.

REF_FILE has an additional stop gate: the installed CHM `_RESOURCE/menu-file.html` lines 295..307 describes immediate output on a left canvas click in Print. A non-printing preview route has not been verified. The supplied files do not authorize printing, and a red print-range rectangle alone is not evidence of text substitution. Leave this case BLOCKED until a documented safe preview path is available.

## Generation

From the audit checkout:

```powershell
node tools/jwf-native-probe-pack.mjs C:\JWW\Sample.jwf .work\jwf-native-manual-17
```

The tool rejects an unreviewed source hash or an existing output directory. It writes files only; it does not launch Jw_cad, modify installed files, alter registry settings or read REF_FILE targets. manifest.json pins every generated file except itself. results.csv is an editable evidence template, not a report of completed runs.
