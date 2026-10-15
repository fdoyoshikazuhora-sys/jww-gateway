# Optional JWF Keys: Native Audit

Date: 2026-10-15. **Incomplete: 19 definitions reviewed, 2 keys partially observed natively, 17 keys not behavior-tested in Jw_cad. No whole-key native certification.**

This continues [JWF Activation Audit](JWF_ACTIVATION_AUDIT.md). Definitions, browser editing, native behavior, and persistence are separate evidence layers. This is not full JWF/JWW compatibility, engineering acceptance, or a mep-draft integration result.

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
| TNK3_NM2 | 1723-1725 | One literal string, documented 20 Shift_JIS bytes | Not run | Must test independently; NM1 evidence is not transferred to NM2 |
| TNKN_SET | 1727-1744 | Eight comma-separated strings, including empty strings and `^w` | Not run | Native six-byte boundary/truncation and decoration behavior unresolved |
| REF_FILE | 1764-1778 | Literal reference filename; TAB-separated substitutions on printing | Not run; distributed placeholder remains blocked | Synthetic local reference/drawing pair, print-preview and missing-file behavior; no real print job |

Scope remains `unknown` at whole-key level, including TNKZ_SET: one proven document field does not prove all nine fields persist. Definition evidence points here and marks the two native observations as `partial`.

## Copy Isolation

The original Sample.jwf and live jw_win.JWF were never edited. Twenty-two off/on pairs were generated in `.work/jwf-native-19/cases` for 18 keys and their alternative rows. Each pair differs by one leading ASCII `#`; END remains present. REF_FILE's placeholder was not activated. Generating a pair is not loading or testing it.

Jw_cad's executable/support files were copied to a private runtime. Its registry subtree was backed up before testing, then restored and compared after closing each test process. Installed JWF, EXE, DLL, CHM, DAT and drawing-file hashes were also rechecked. A copied EXE alone does **not** isolate Jw_cad preferences. Association prompts were cancelled; installed settings and file associations were not intentionally changed.

An initial launch resolved the installed executable instead of its copy. It was immediately closed without test edits, followed by baseline restoration. Later launches used the verified `process:` path. A first Save As attempt using a full path in Jw_cad's custom filename box was rejected; no output was claimed for that attempt. Subsequent saves used a temporary private folder preference and a basename.

Original live `jw_win.JWF` SHA-256: `0cfe66d4b3576695d9b882c2ee05009ef33fd5e2c3bf4e082de4b0d49d58e8d1`.
Test executable SHA-256: `95e6b11c4ee014e0079f288429ae2c6e5eed41141a963e4b8770d2e8ead87acf` (file version 10.2.1.0).

## Native Radius Evidence

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

## Native Building-Name Evidence

The distributed shadow drawing was copied privately (input v600, 117,097 bytes, SHA-256 `a574ab02d25d5dcefb4ed4e0d18b192c45c6fa264f58769dedcd7a904d7afb8b`). The original was not saved over.

- Started with only the sample TNK3_NM1 enabled in the runtime copy. Loaded a separate one-key contrast `TNK3_NM1=AuditReference`, then re-entered the sky/triangulation command. Its reference-building option changed to AuditReference.
- Generated reference triangulation output, saved privately as `tnk3-name-reference.jww` (v700, 135,596 bytes, 1,900 drawing entities, SHA-256 `c7a47278aeb71e299f5dc9be66ac02b44f86c3e27199be206dbee4483c11eebe`). Gateway parsing found two generated text entities containing AuditReference.
- Closed the app, restored the registry, used a startup copy with TNK3_NM1 commented out, restarted and reopened that JWW. The generated AuditReference table/result text remained visible after zooming.
- The command's reference-building name returned to the distributed default. Thus preserved drawing text is **not** evidence that opening JWW restores the TNK3_NM1 environment default.

The output, accessibility observations and reopen screenshot are private evidence under `.work/jwf-native-19`. No native calculation result here is an engineering approval. Input v600 -> native output v700 is not proof of v600 byte preservation.

## Explicit Unknowns

- Sample prose names `CROSS_ST1..30`, while examples use `R_CROSS_ST1..6`. Only the six demonstrated key names are defined; aliases and additional members remain unverified and activation probes reject them.
- TNKZ_SET packed zero/omitted digits are retained without inventing implicit color/text defaults. All persistence beyond the observed radius remains unverified.
- TNKN_SET retains eight literal fields and applies a conservative six-byte-per-item editing guard. Exact native boundary/truncation behavior has not been verified; do not use this guard as proof of native acceptance.
- REF_FILE never causes Gateway to open an external file. Its filename round trip does not verify Jw_cad substitution, path resolution, or printer behavior.
- Right-button drag and button-held snapshots are unavailable in the documented current computer-use API. The clock-menu acceptance cases require manual evidence or an approved capable harness. A user question was issued; no manual result was received during this audit.
- The two partially checked native keys do not cover other values, interactions, exports, versions, or the remaining 17 keys. Those are pending work, not passed tests.

## Verification

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
2. Finish TNKZ_SET fields 2..9 individually using explicit contrast values; then TNK3_NM2 and TNKN_SET with reference/planned generated tables. Verify boundary cases before promoting definitions to native-verified.
3. Test six cursor strokes individually against an identical reviewed non-mm/real-size-cursor baseline; investigate the naming discrepancy separately.
4. Obtain manual clock-menu right-drag/hold evidence, then test every supported command/hour, including text/dimension mode 4. Do not equate loading without an error with reflection.
5. Use a synthetic local REF_FILE/drawing pair and preview only. Record missing-file and relative-path behavior. Keep real printing and arbitrary external-file reads out of this audit.

The remaining native checklist stays open. Do not merge this draft as proof of complete JWF support.
