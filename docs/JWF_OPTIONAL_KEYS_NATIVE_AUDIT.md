# Optional JWF Keys: Native Audit

Updated: 2026-10-16. **Incomplete: 19 definitions reviewed, 4 keys partially observed natively, 15 keys not behavior-tested in Jw_cad. No whole-key native certification.**

This continues [JWF Activation Audit](JWF_ACTIVATION_AUDIT.md). Definitions, browser editing, native behavior, and persistence are separate evidence layers. This is not full JWF/JWW compatibility, engineering acceptance, or a mep-draft integration result.

Latest continuation: [TNKN fields, boundaries and planned-name audit](JWF_TNKN_NAME_NATIVE_AUDIT.md). **Seven-field boundary verification remains INCOMPLETE.** The five pending clean reopens (fields 1/2 ASCII6/7 and field 4 ASCII6) completed after capture temporarily recovered; field-1 ASCII5 was already reopened. On restart, capture failed again with `foreground window did not report a process id` despite successful window selection/activation. Reliable recovery and the internal cause remain unconfirmed. Field 4 ASCII7 and fields 5..8 ASCII6/7 remain unverified (nine cases). A post-generation native JWF export/reimport also **did not preserve TNKN_SET**, extending the earlier pre-generation omission evidence. Earlier eight field contrasts, nine boundary/empty/decoration cases and six TNK3_NM2 cases are retained separately; none substitutes for missing boundary checks. Whole-key status stays partial.

## Sources

- [Official downloads](https://www.jwcad.net/download.htm) and [official release history](https://www.jwcad.net/versioninfo.htm), checked 2026-10-15. Current release is 10.03.7; testing used the already installed 10.02.1, not the latest release. No installation or upgrade was performed.
- Installed `C:/JWW/Sample.jwf`, SHA-256 `c6ca97617d4f2b037cec4c4c280c1bb5c963aa106d44cef37caf3aac8a6b8f38`. Source line references below are for this file only. Its 2015 timestamp does not prove equivalence with the current downloadable distribution.
- Installed `Jw_cad.chm`, extracted read-only into a private test directory. `_RESOURCE/menu-other.html`, sky command section, explains height data, triangulation, reference/planned building selection and output placement.
- [Official JWW format](https://www.jwcad.net/jwdatafmt.txt) defines the separate binary drawing layout. A JWF key omitted from native JWF exports is not necessarily absent from a JWW.

## Per-Key Results

All 19 rows below have parser/serialization unit tests and individual browser read, byte-identical unchanged export, edited export and reopen checks. These columns do not constitute native acceptance. Reserved command slots remain unavailable for editing. Names, empty affixes and numeric-looking strings are not coerced into numbers.

| Key | Sample lines | Reviewed layout | Native reflection / save / reopen | Remaining gate |
| --- | --- | --- | --- | --- |
| LD2_RV | 121-126 | Twelve hourly 0/1 flags | Not run | Negative AUTO switch-distance dependency; twelve left-drag directions |
| RD2_RV | 121-128 | Twelve hourly 0/1 flags | Not run | Right-drag/hold unavailable in the current automation API |
| COM_RV01 | 130-139 | Ten command slots; text/dimension mode 4 | Not run | Both mouse sides, reserved slots and movement-direction special case |
| COM_RV11 | 130-142 | Ten command slots with reserved zeros | Not run | Per-command behavior and both mouse sides |
| COM_RV21 | 130-145 | Ten command slots with reserved zeros | Not run | Per-command behavior and both mouse sides |
| COM_RV31 | 130-148 | Ten command slots with reserved zeros | Not run | Hatch/tangent-ellipse behavior and both mouse sides |
| COM_RV41 | 130-151 | Three command slots, first reserved | Not run | Attribute/solid commands and both mouse sides |
| COM_RV_C | 153-159 | Decimal tens=left, ones=right; each 0..5 | Not run | Transient menu while button is held; no command-number interpretation |
| R_CROSS_ST1 | 673-697; 681/687 | Four stroke coordinates; two alternative examples | Not run | Non-mm active units, real-size graduated cursor; compare alternatives separately |
| R_CROSS_ST2 | 673-697; 682/688 | Four stroke coordinates; two alternative examples | Not run | Same prerequisite, do not merge alternative glyphs |
| R_CROSS_ST3 | 673-697; 683/689 | Four stroke coordinates; two alternative examples | Not run | Same prerequisite, negative coordinates retained |
| R_CROSS_ST4 | 673-697; 690 | Four stroke coordinates | Not run | Six-stroke shaku glyph context required |
| R_CROSS_ST5 | 673-697; 691 | Four stroke coordinates | Not run | Same prerequisite |
| R_CROSS_ST6 | 673-697; 692 | Four stroke coordinates | Not run | Same prerequisite |
| TNKZ_SET | 1650-1717 | Nine integers, including decimal-packed fields | **Partial:** radius 25 -> 50; native save and clean-process reopen retained 50 | Other eight fields, radius zero/bounds, packed defaults and generated geometry not certified |
| TNK3_NM1 | 1719-1721 | One literal string, documented 20 Shift_JIS bytes | **Partial:** `AuditReference` reflected; generated table saved and visibly reloaded | 20-byte boundary/truncation, Japanese boundary variants and repeated application not tested |
| TNK3_NM2 | 1723-1725 | One literal string, documented 20 Shift_JIS bytes | **Partial:** AuditPlanned plus six name cases reflected, saved and JWW-reopened; Japanese12/Japanese20/ASCII19/ASCII20 retained; ASCII21 truncated, mixed21 retained in 10.02.1 | Other strings/versions, manual reload, repeated application and native JWF export unverified; out-of-spec observations do not revise the 20-byte editing limit |
| TNKN_SET | 1727-1744 | Eight comma-separated strings, including empty strings and `^w` | **Partial:** earlier eight field contrasts plus field-3 boundaries/empty/decoration reopens. Fields 1/2 ASCII6/7 and field 4 ASCII6 now saved and natively reopened; field-1 ASCII5 also reopened. Pre- and post-generation native JWF export/reimport omitted the key in their tested sequences | Field 4 ASCII7 and fields 5..8 ASCII6/7 (nine cases), independent empty mixtures, other numbers/geometry, repeated application and other versions unverified; capture failed again after temporary recovery |
| REF_FILE | 1764-1778 | Literal reference filename; TAB-separated substitutions on printing | Not run; distributed placeholder remains blocked | Synthetic local reference/drawing pair, print-preview and missing-file behavior; no real print job |

Scope remains `unknown` at whole-key level, including TNKZ_SET: one proven document field does not prove all nine fields persist. Definition evidence points here and marks the four native observations as `partial`.

## Earlier Continuation On 2026-10-16

The existing registry and installed-file baseline matched before any action today. Windows automation initially timed out twice; a JavaScript-kernel reset recovered the connection. Only the private test executable was subsequently launched. Association prompts were cancelled. The canonical dirty checkout was not edited.

### TNK3_NM2

1. Restored baseline; startup copy contained only `TNK3_NM2=AuditPlanned` and END. Opened a fresh copy of the distributed shadow drawing, then Sky -> Triangulation, measurement point, planned building, position table and triangulation.
2. The planned radio label became `AuditPlanned`; the reference label stayed at its default. Generated the output at a separate empty location and used native Save As.
3. Closed Jw_cad, restored baseline, replaced the TEST startup profile with the commented-off arm, restarted and reopened the saved JWW. Generated AuditPlanned headings remained visible. The command's planned label reverted to its default, independently of the saved text.
4. The output contains three AuditPlanned text entities. This is one ASCII-name observation, not a 20-byte boundary certificate or proof of persistent environment naming.

### TNKN_SET

1. Restored baseline; startup copy contained only `TNKN_SET={,},Q3,),[,],<,>` and END. This changes only field 3 from the documented default.
2. Opened a fresh shadow-drawing copy and generated planned-building position and triangle tables at the same observed measurement/output positions as above.
3. Native output contained `Q33)`, `Q34)`, `Q36)` twice each (diagram and table). Planned triangle labels remained `<1>` through `<5>` twice each. The suffix `)` was retained. The reference-building branch was NOT generated in this run.
4. Closed, restored baseline, restarted with TNKN_SET commented out and reopened the JWW. Zoomed the building table and observed the Q3-prefixed labels. This proves persistence of generated text only. Other fields and bounded `^w` rendering cases were tested in the linked latest continuation.

### Evidence Files

Private root: `.work/jwf-native-manual-17`. Generated source profiles remain unchanged. Both input copies match SHA-256 `a574ab02d25d5dcefb4ed4e0d18b192c45c6fa264f58769dedcd7a904d7afb8b`.

| File | Bytes | SHA-256 | Drawing entities |
| --- | ---: | --- | ---: |
| TNK3_NM2/planned-name-output.jww | 140746 | 29e0b32070c6e3de8c90bbf8ce19e2c88d3a1c35e8e852486c216fc63189c8d8 | 1952 |
| TNKN_SET/planned-prefix-output.jww | 140716 | c3259a3089a2423bbf8744f200bce8772512ee2630e0602d060fb79725a8b5cb | 1952 |

Both outputs are v700 and include six additional internal-setting records. Reopen screenshots are `KEY/reopened.png`; TNK3_NM2 also has accessibility observations in `observations.json`. These private full drawings are not added to the public package.

### Writer Regression Found During Verification

The direct JSON rebuild initially produced a false semantic mismatch because `sourceEntitiesWithSettings` spliced six sentinel rows into the caller's drawing array when no dimension group was collapsed. Reusing the same input for preflight/save could accumulate records. A failing regression reproduced this using an existing native blank fixture; the fix copies the array before insertion. The format and fields are unchanged. Tests cover preflight, a frozen caller array, repeated writes and exactly six preserved settings.

Both new native outputs now pass byte-identical Gateway no-op save and JSON rebuild semantic comparison (including metadata). Native Save As byte identity is NOT claimed.

### Prepared Manual Pack And Stop Gates

`tools/jwf-native-probe-pack.mjs` produces 17 case directories, 143 JWF profiles, per-key STEPS.md, a hash manifest, synthetic REF_FILE input/reference files and a NOT_RUN results template. See [manual protocol](JWF_NATIVE_MANUAL_PROTOCOL.md).

- Eight clock keys: startup-only negative switching distance and per-command mode prerequisites are included. Hourly disable profiles, supported command/side modes, text/dimension mode 4 and both color digits have separate variants. Right drag and button-held snapshots require manual evidence.
- Six cursor keys: off/on arms retain the other five shaku strokes; ST1..3 also have separate Km families. Active non-mm units and real-size graduated cursor are included. Passive cursor motion/appearance remains a manual check. The CROSS_ST/R_CROSS_ST naming discrepancy is not resolved.
- TNK3_NM2 and TNKN_SET: prepared boundaries/field contrasts are NOT passed merely because the two above observations passed.
- REF_FILE: the installed official CHM `_RESOURCE/menu-file.html` lines 295..307 warns that a left canvas click in Print immediately outputs a job. A safe non-printing preview route has not been established; substitution, missing-file behavior and relative lookup remain BLOCKED/UNVERIFIED. No print command or job was performed. The distributed placeholder was not activated.

Official download/history pages were rechecked on 2026-10-16; latest is 10.03.7, while these observations remain specific to installed 10.02.1. No upgrade was performed.

### Earlier Verification (2026-10-16)

| Layer | Result | Limit |
| --- | --- | --- |
| Focused tests | 31/31 passed | Includes the new generator and native evidence regressions |
| Full npm test | 351/351 passed, no skips | JWF_REVIEWED_SAMPLE and JWF_NATIVE_EVIDENCE_DIR set to local verified inputs |
| npm run verify | Passed | Smoke and package file manifest |
| npm run roundtrip:corpus | 41/41 passed | Generated corpus, not 41 native GUI tests |
| npm run build | Missing script | Existing package has no build command |
| localhost:3000 browser | 19/19 read/edit/export/reopen checks; zero captured errors | Headless Chrome; private run4/result.json; existing narrow-layout overflow remains |
| Native progress this turn | 2 additional partial keys | 14 manual-input keys and REF_FILE's preview gate remain; partial keys also retain untested variants |
| Protection | Installed sources and Jw_cad registry restored/verified; all 9 canonical dirty-file hashes unchanged | Canonical main was not edited |
| Legacy path / whitespace | No old OneDrive project path matches in scoped source scan; git diff --check passed | .git, .work and node_modules excluded |

To repeat all 351 tests on this machine, set `JWF_REVIEWED_SAMPLE=C:/JWW/Sample.jwf` and `JWF_NATIVE_EVIDENCE_DIR=.work/jwf-native-manual-17` before `npm test`. Without those environment variables, three source/private-fixture tests explicitly skip; the mutation regression still runs from a bundled blank native fixture. A configured but missing evidence file fails, rather than silently skipping.

`native-results.json` in the private pack records actual observations separately from the generated NOT_RUN manifest/results template. No manual results have been supplied for the other 15 keys. This continuation is not completion of all 17 keys.

## Previous Copy Isolation (2026-10-15)

The original Sample.jwf and live jw_win.JWF were never edited. Twenty-two off/on pairs were generated in `.work/jwf-native-19/cases` for 18 keys and their alternative rows. Each pair differs by one leading ASCII `#`; END remains present. REF_FILE's placeholder was not activated. Generating a pair is not loading or testing it.

Jw_cad's executable/support files were copied to a private runtime. Its registry subtree was backed up before testing, then restored and compared after closing each test process. Installed JWF, EXE, DLL, CHM, DAT and drawing-file hashes were also rechecked. A copied EXE alone does **not** isolate Jw_cad preferences. Association prompts were cancelled; installed settings and file associations were not intentionally changed.

An initial launch resolved the installed executable instead of its copy. It was immediately closed without test edits, followed by baseline restoration. Later launches used the verified `process:` path. A first Save As attempt using a full path in Jw_cad's custom filename box was rejected; no output was claimed for that attempt. Subsequent saves used a temporary private folder preference and a basename.

Original live `jw_win.JWF` SHA-256: `0cfe66d4b3576695d9b882c2ee05009ef33fd5e2c3bf4e082de4b0d49d58e8d1`.
Test executable SHA-256: `95e6b11c4ee014e0079f288429ae2c6e5eed41141a963e4b8770d2e8ead87acf` (file version 10.2.1.0).

## Native Radius Evidence (2026-10-15)

1. With a restored baseline and no active TNKZ_SET startup entry, radius 25 was observed. A blank native drawing was saved separately.
2. Loaded `TNKZ_SET=50 1 0 3 302 20 11 201 100` from a test-only copy, outside the sky command. Only the first sample value was changed. The sky projection control showed radius 50.
3. Saved a separate JWW, closed Jw_cad, restored the baseline, restarted with no active TNKZ_SET, and reopened the saved JWW. Radius remained 50.

The two 17,435-byte v700 fixtures are retained under `samples/jwf-pairs`:

| Fixture | SHA-256 | Header diameter |
| --- | --- | ---: |
| native-tnkz-radius25.jww | e24fd16ebd8c64e516b46ef8bdbd99f4dd1fb4f87048da7fc56ddf5e562f92d0 | 50 |
| native-tnkz-radius50.jww | 15e88b0a2e61c58d65b03bdfc6c08155f8612da6c281add5070eac21f298af28 | 100 |

Observed mapping: JWF radius = JWW `m_dTenkuuZuDiameter / 2`. At offset 3676 in these fixtures the f64 changed from 50 to 100. This offset is fixture-specific, not a hardcoded universal offset.

Other differences must not be hidden: `dummyBeforeSunpou[0]` at 2396 changed 26800 -> 25900; `dummyAfterSunpou` at 2472 changed 9257 -> 9147; `m_lnDrawTime` at 4680 changed 71 -> 167. The dummy meanings remain unverified. Both files have zero drawing entities and retained internal settings. Their geometry is equal but document metadata and hashes are intentionally different. No claim of native byte-identical resave is made.

`jwfNativeEvidence.test.js` verifies each fixture's own no-op Gateway save is byte/hash identical, and JSON rebuild preserves diameter and normalized drawing/document meaning with a clean parser. This is distinct from rerunning the native application.

## Native Building-Name Evidence (2026-10-15)

The distributed shadow drawing was copied privately (input v600, 117,097 bytes, SHA-256 `a574ab02d25d5dcefb4ed4e0d18b192c45c6fa264f58769dedcd7a904d7afb8b`). The original was not saved over.

- Started with only the sample TNK3_NM1 enabled in the runtime copy. Loaded a separate one-key contrast `TNK3_NM1=AuditReference`, then re-entered the sky/triangulation command. Its reference-building option changed to AuditReference.
- Generated reference triangulation output, saved privately as `tnk3-name-reference.jww` (v700, 135,596 bytes, 1,900 drawing entities, SHA-256 `c7a47278aeb71e299f5dc9be66ac02b44f86c3e27199be206dbee4483c11eebe`). Gateway parsing found two generated text entities containing AuditReference.
- Closed the app, restored the registry, used a startup copy with TNK3_NM1 commented out, restarted and reopened that JWW. The generated AuditReference table/result text remained visible after zooming.
- The command's reference-building name returned to the distributed default. Thus preserved drawing text is **not** evidence that opening JWW restores the TNK3_NM1 environment default.

The output, accessibility observations and reopen screenshot are private evidence under `.work/jwf-native-19`. No native calculation result here is an engineering approval. Input v600 -> native output v700 is not proof of v600 byte preservation.

## Explicit Unknowns

- Sample prose names `CROSS_ST1..30`, while examples use `R_CROSS_ST1..6`. Only the six demonstrated key names are defined; aliases and additional members remain unverified and activation probes reject them.
- TNKZ_SET packed zero/omitted digits are retained without inventing implicit color/text defaults. All persistence beyond the observed radius remains unverified.
- TNKN_SET retains eight literal fields and applies the documented six-byte-per-item editing guard. Field-3 native observations retain 5/6 ASCII bytes and 6 Japanese bytes, truncate ASCII7 to six, but retain a mixed7 boundary-spanning character. Fields 1/2 now retain ASCII6 and truncate ASCII7 in generation/save/reopen; field 4 ASCII6 is also confirmed. Out-of-spec outcomes do not establish a universal truncation algorithm or relax the guard. Field 4 ASCII7 and fields 5..8 ASCII6/7 remain unverified.
- REF_FILE never causes Gateway to open an external file. Its filename round trip does not verify Jw_cad substitution, path resolution, or printer behavior.
- Right-button drag and button-held snapshots are unavailable in the documented current computer-use API. The clock-menu acceptance cases require manual evidence or an approved capable harness. A user question was issued; no manual result was received during this audit.
- The four partially checked native keys do not cover all their values, interactions, exports or versions. The other 15 keys still have no native behavior evidence. These gaps are pending work, not passed tests.

## Previous Verification (2026-10-15)

| Layer | Result | Boundary |
| --- | --- | --- |
| New focused tests | 26 passed | 23 optional-key tests and 3 native-fixture regression tests |
| Full npm test | 346 passed, 0 failed | Automated code verification |
| npm run verify | Passed | Smoke and package manifest checks |
| Generated JWW corpus | 41 passed, 0 failed | Separate from actual native tests |
| npm run build | Missing script | No fake build command added |
| localhost:3000 browser | 19 individual edit/export/reopen checks passed, no captured console/page/network errors | Headless Chrome; [report](../reports/jwf-optional-browser.json) |
| Invalid browser input | Radius 9 rejected, previous 25 restored | No uncaught exception |
| Narrow viewport | Existing 720px document width at 390px viewport | Not a responsive-layout pass |
| Native acceptance | 2 partial / 17 not run | Remains incomplete |
| Original files and registry | Restored and hash-checked | Both installed JWF files and all 9 protected canonical worktree files unchanged |
| Legacy path scan | No matches | Audit-worktree text scan for the old OneDrive Documents project path; excludes .git, .work and node_modules |

Browser script: `node tools/jwf-optional-browser-check.mjs <new-output-directory>`, with `PLAYWRIGHT_MODULE` set to the installed Playwright ESM entry. It uses synthetic one-key profiles, refuses an occupied port 3000 and closes its own browser/server. Native Jw_cad is not driven by this script.

## Next Native Gates

1. Restore baseline separately for each arm; record on/off source hashes, dependencies, native JWF export, JWW Save As and clean-process reopen. Commenting a setting out does not reset a running process.
2. Finish TNKZ_SET fields 2..9 and remaining value/interaction gates in the linked TNKN/name audit. The eight TNKN field contrasts and bounded name/decoration tests are already recorded; do not rerun or relabel them as untested. Investigate the observed TNKN native-export omission separately from generated-text persistence. Whole-key native certification remains closed.
3. Test six cursor strokes individually against an identical reviewed non-mm/real-size-cursor baseline; investigate the naming discrepancy separately.
4. Obtain manual clock-menu right-drag/hold evidence, then test every supported command/hour, including text/dimension mode 4. Do not equate loading without an error with reflection.
5. First establish a documented, safe non-printing preview route for REF_FILE; until then keep it BLOCKED. Only after resolving that gate use the synthetic local reference/drawing pair to record substitution, missing-file and relative-path behavior. Keep real printing and arbitrary external-file reads out of this audit.

The remaining native checklist stays open. Do not merge this draft as proof of complete JWF support. Current results and remaining gates are in the 2026-10-16 continuation above.
