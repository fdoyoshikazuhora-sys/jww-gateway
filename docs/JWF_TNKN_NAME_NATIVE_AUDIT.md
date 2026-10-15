# TNKN Fields And Planned Name Native Audit

Updated: 2026-10-16. **Latest seven-field boundary continuation is INCOMPLETE: six native saves, only one clean native reopen, and one post-generation JWF export/reimport experiment completed. The export did NOT preserve TNKN_SET. Native automation stopped responding before the other cases could be finished.** Earlier field contrasts, nine boundary/empty/decoration cases and six planned-name cases remain below. This follows [the optional-key audit](JWF_OPTIONAL_KEYS_NATIVE_AUDIT.md). Neither key is fully certified. No production behavior was changed.

## Sources

Installed Jw_cad 10.02.1, official Sample.jwf SHA-256 `c6ca97617d4f2b037cec4c4c280c1bb5c963aa106d44cef37caf3aac8a6b8f38`. Lines 1723..1725 specify TNK3_NM2 as at most 20 bytes (10 Japanese characters). Lines 1727..1744 define eight comma-separated TNKN_SET fields and the separate decoration example. The installed sample is the field-level source; the online binary JWW specification does not define JWF loading behavior.

Official [download page](https://www.jwcad.net/download.htm) and [version history](https://www.jwcad.net/versioninfo.htm) were rechecked. They list 10.03.7; no upgrade was made. All native observations below are specific to installed 10.02.1.

## Seven-Field Boundary Continuation (Incomplete)

The requested remaining fields are 1, 2, 4, 5, 6, 7 and 8; field 3 has the earlier evidence below. Twenty-one independent copies were prepared: each field with ASCII5, ASCII6 and ASCII7. ASCII7 exceeds the documented six-byte limit and is a diagnostic input, not a newly supported setting. Preparation does not count as execution.

Each generated case started from a freshly restored registry baseline and its own active startup JWF. Both tables were generated from a fresh copy of the pinned v600 input, then native Save As wrote a NEW output.jww. This continuation uses a 1536 x 912 maximized window, initial zoom 0.44, measurement point (600,700) and output placement (1000,800). Its generated building numbers are 3/4/5 and triangle numbers are 1..7, unlike the earlier probe geometry. Numerical sky-ratio accuracy is not certified.

| Field | Meaning | ASCII6 native generation / Save As | ASCII7 native generation / Save As | Clean native JWW reopen of boundary outputs |
| --- | --- | --- | --- | --- |
| 1 | Reference building prefix | ABCDEF3}, ABCDEF4}, ABCDEF5} | Same six-byte prefix; G omitted | NOT DONE for 6/7; ASCII5 control only completed |
| 2 | Reference building suffix | {3ABCDEF, {4ABCDEF, {5ABCDEF | Same six-byte suffix; G omitted | NOT DONE |
| 4 | Planned building suffix | (3ABCDEF, (4ABCDEF, (5ABCDEF | BLOCKED before input drawing opened | NOT DONE |
| 5 | Reference triangle prefix | NOT RUN | NOT RUN | NOT RUN |
| 6 | Reference triangle suffix | NOT RUN | NOT RUN | NOT RUN |
| 7 | Planned triangle prefix | NOT RUN | NOT RUN | NOT RUN |
| 8 | Planned triangle suffix | NOT RUN | NOT RUN | NOT RUN |

Each listed saved building label occurs twice. The unchanged triangle labels are [1]..[7] for reference and <1>..<7> for planned, each twice. Reference outputs have 2008 entities; planned field-4 ASCII6 has 2003. All saved outputs are v700. No setting warning was observed during these completed generation/save operations. Exact labels/counts come from the native-saved bytes; successful Gateway parsing is not native reopen evidence.

Field-1 ASCII5 additionally generated ABCDE3}/ABCDE4}/ABCDE5}, saved, closed and reopened in a clean inactive-key session. Its zoomed building table was inspected and captured. Other ASCII5 controls are NOT RUN. There is no claim that any of the seven fields has completed the requested six-byte-boundary native reopen cycle in this continuation. Japanese/mixed boundaries for these fields also remain unverified.

### Export After Generation

1. With field-1 ASCII5 active, generated reference building and triangle tables and saved output.jww. Then used native Settings -> Environment File -> Write to a separate post-generation-export.jwf.
2. This native export is 10275 bytes, has 209 parsed active keys and **contains no TNKN_SET text or entry**, including commented entries. It parses cleanly and Gateway unchanged JWF export is byte-identical.
3. Closed, restored baseline, restarted with TNKN_SET commented out, and used native Environment File -> Read on that unmodified export. No read error was observed. Opened a fresh input and generated the reference tables again.
4. Saved separately as post-export-reimport.jww, then closed/restored/restarted inactive and reopened that saved JWW. Its default building labels {3}/{4}/{5} were inspected in the enlarged table and captured. Saved bytes contain each default label twice and no ABCDE-prefixed label.

**Result: SETTING_NOT_PRESERVED.** Drawing generation and Save As before export did not make this field-1 ASCII5 setting survive native JWF Write/Read in 10.02.1. This extends the earlier pre-generation export finding; it is not proof about every field, version, or exported setting. The original ABCDE-labeled JWW separately retains its generated text after reopen. Drawing-text persistence and environment-setting persistence are different results. No synthetic TNKN_SET line was inserted into native export evidence.

### Evidence And Stop

Private root: `.work/jwf-native-seven-20261016`. `cases.json` remains the initial preparation record; **`native-results.json` is the explicit observed-status record**, including all 21 case statuses, artifacts/hashes, missing reopens and protection checks. Private drawings, JWF exports and screenshots are not published.

| Native artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| field-1-ascii5/output.jww | 144200 | a2a5422a5990c4883f1cfa3d4437ea4e24160732cd7e23d71e0eb53e85779d10 |
| field-1-ascii6/output.jww | 144212 | 8cd08656154863e1f740b70bdf310d406f6ec402505efb27f13895aed037829b |
| field-1-ascii7/output.jww | 144212 | 05ae39264f21762a91ab7b19c3f8a75acbb81b0422101bb8b5a1953dcd391aea |
| field-2-ascii6/output.jww | 144212 | c61e3088847a2cccd7510f31ab994132c1247ffc321e8f54c8d0312e3049b94c |
| field-2-ascii7/output.jww | 144212 | b16af48c16597afbf1cd365485575782ca3092df20592f7af31cd108781ecfbb |
| field-4-ascii6/output.jww | 143967 | e9a91a11fb9906fc78c41c6d784acc342f7bb246452aec749b3b9f677f98ab69 |
| field-1-ascii5/post-generation-export.jwf | 10275 | ff3efa6944e3f99259e4f3c1b7281be5002918d7710d0c984ae100cfd2246ab1 |
| field-1-ascii5/post-export-reimport.jww | 144152 | ce244bb94c1387cba20145ef9e930ecad945e8fd5e068fc6bdc12391336fe7d5 |

At field-4 ASCII7, the last observed state was the Open dialog before opening input.jww. `get_window_state` timed out; window-list retries reported an active request, then a JS-kernel reset/import/list retry timed out. No subsequent native input was attempted. Only the identified agent-created private-runtime process (PID 34548) was terminated after checking its exact executable path and that no case output existed. Registry baseline restoration and installed-source verification passed. All 21 profile pairs/input copies and all nine protected canonical dirty files retained their pinned hashes. Association prompts were cancelled; no print job was issued.

Seven new opt-in regressions use `JWF_NATIVE_SEVEN_DIR=.work/jwf-native-seven-20261016`: six saved-output cases and the post-generation export limitation. They pin source profiles, output hashes, labels/counts, byte-identical Gateway no-op saves and JSON rebuild meaning. They do NOT supply the missing native reopen evidence. The documented six-byte editing guard remains unchanged.

Verification: native-evidence file tests **36/36 passed**; full **npm test 383/383 passed, zero skips**, with JWF_REVIEWED_SAMPLE and all four private-evidence directory variables configured. The new seven tests explicitly skip when JWF_NATIVE_SEVEN_DIR is unset. A deliberately nonexistent configured directory failed with ENOENT rather than skipping, as required. `npm run verify` passed; `npm run roundtrip:corpus` passed 41/41. `npm run build` returned the existing missing-script error; no build command was invented. Scoped source scanning found no legacy OneDrive project-path references and `git diff --check` passed. Browser/consumer-app checks were not rerun: only evidence tests and documentation changed, with no production parser/writer/UI change.

Resume: first perform the five saved-output clean reopens, then field-4 ASCII7 and fields 5/6/7/8 ASCII6/7 generation/save/reopen, followed by missing ASCII5 controls. Follow [the manual protocol](JWF_NATIVE_MANUAL_PROTOCOL.md); never overwrite existing evidence. Independent empty-field mixtures, whitespace, ^w numbers 99/100, repeated manual application of original active profiles, other versions and consuming CAD acceptance remain outside these observations.

## Earlier Boundary Continuation

Sample.jwf lines 1727..1744 specify eight comma-separated affixes, at most six bytes per field, and the `^w` square/circle example for building numbers up to 99. Installed official CHM `_RESOURCE/menu-SETTEI.html`, anchor `SETTEI_JWF_File`, documents Environment File Read and Write. It does not establish that TNKN_SET is included in every native export. These local distribution documents are the field/operation evidence; no speculative behavior was added to Gateway.

### Native Results

Each generation used a fresh restored registry baseline, a test-only startup JWF containing one active TNKN_SET line and END, and a fresh copy of the same v600 input described below. The boundary cases change field 3 only. Empty cases set all eight affixes empty; decoration cases use the official example as a whole. They are not eight separate empty-field contrasts. Both building and triangle tables were generated, then saved to a separate JWW. Original JWFs and input drawings were never edited.

| Case | Input | Native-saved building labels | Reflection / separate Save As / clean JWW reopen |
| --- | --- | --- | --- |
| ascii5 | Field 3: ABCDE, 5 bytes | ABCDE3), ABCDE4), ABCDE6) | Confirmed |
| ascii6 | Field 3: ABCDEF, 6 bytes | ABCDEF3), ABCDEF4), ABCDEF6) | Confirmed |
| ascii7 | Field 3: ABCDEFG, 7 bytes | ABCDEF3), ABCDEF4), ABCDEF6) | Observed truncation; OUT OF SPEC |
| japanese6 | Field 3: U+6771 U+4EAC U+90FD, 6 bytes | All three Japanese characters followed by 3), 4), 6) | Confirmed, no replacement characters |
| mixed7 | Field 3: ABCDE + U+5EFA, 7 bytes | Entire prefix followed by 3), 4), 6) | Observed full retention; OUT OF SPEC |
| empty-reference | Eight empty strings | 3, 4, 6, no wrappers | Confirmed |
| empty-planned | Eight empty strings | 3, 4, 6, no wrappers | Confirmed |
| decoration-reference | `TNKN_SET=` + U+25A1 + `^w,,` + U+25CB + `^w,,[,],<,>` | Raw U+25A1 + ^w + digit; square around digit | Confirmed |
| decoration-planned | Same official example | Raw U+25CB + ^w + digit; circle around digit | Confirmed |

The test profiles contain actual Japanese/symbol characters encoded as Shift_JIS, not Unicode escape sequences. Every building label occurs twice in the saved data. Empty-case triangle numbers 1..5 occur twice without wrappers; other cases retain [1]..[5] for reference or <1>..<5> for planned triangles. Exact counts and raw text were extracted independently from native-saved bytes.

For reopens, ascii6 used its own clean process. The remaining eight outputs and the JWF-reimport result were opened sequentially in one new process after restoring the registry and disabling TNKN_SET in the test startup copy. No drawings were edited or saved during these reopen inspections. Each zoomed building-number table was inspected and captured. This visual check does not cover every rotated diagram label or a separate enlarged triangle-table inspection in this continuation. The actual square/circle overlays were visible after reopen, not just adjacent circle/square and digit strings. Gateway represents these as `halfOverlay` runs and retains raw `^w` text.

The two seven-byte observations do not define a universal truncation algorithm or a valid seven-byte JWF setting. The documented six-byte editing guard remains unchanged. Boundaries in fields 1/2/4/5/6/7/8 were tested in Gateway code, NOT natively in this earlier continuation; see the incomplete seven-field continuation above for newer observations. Other numbering, including 99 and 100, remains unverified.

### Native JWF Write And Read

1. Started the ascii6 active copy. Used Settings (設定) -> Environment File (環境設定ファイル) -> Write (書出し), before opening the input drawing, and saved a NEW `ascii6/native-export.jwf`. The original profile was not overwritten. Subsequent native generation in that same startup arm produced the ABCDEF-prefixed result above.
2. The native export is 10180 bytes and contains 209 active parsed keys, END, and **no TNKN_SET text or entry**. Gateway reads it without validation errors and its unchanged JWF export is byte-identical.
3. Closed Jw_cad, restored the registry, started with TNKN_SET commented out, and manually used Environment File -> Read (読込み) on the unedited native export. No load error was observed. Then opened the fresh input and generated the same planned-building/triangle tables.
4. Saved as `ascii6/reimport-output.jww`; the building labels were `(3)`, `(4)`, `(6)`, each twice, not ABCDEF-prefixed. This output was also reopened and its default labels inspected in the later clean session.

**Result: file write and read operations completed, but this native JWF round trip did NOT retain the configured TNKN_SET prefix.** This is an observed omission in the tested sequence, not proof of a JWF syntax error, of failure of all exported settings, or of absence from every possible native export. Export after generation was not tested in this earlier sequence; the newer field-1 ASCII5 sequence above now records it. Repeated manual loading of the original active copy remains untested. Do not synthesize the missing key and describe it as native-exported evidence. No undocumented persistence mapping was implemented.

### Artifacts And Regression

Private root: `.work/jwf-native-boundaries-20261016`. Each of the nine case folders contains unchanged on.jwf/off.jwf/input.jww, native output.jww, and a reopened.png screenshot. `cases.json` retains the original NOT_RUN preparation state; **`native-results.json` records the actual observations, original/input/output/screenshot hashes, protection checks and explicit unknowns**. The native export, reimport output and two associated screenshots are in ascii6. Full drawings, local configuration and screenshots stay private.

| Native artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| ascii5/output.jww | 140752 | 465519f0c12d036345b7c02413851155b78eb0950867414c5a33bc9212e5dca1 |
| ascii6/output.jww | 140764 | abe3a5670ed4dd01848fc51fe29d1d9343ce9c1718a63b8381ceae60d8162b34 |
| ascii7/output.jww | 140764 | 6ce01719f8b2fec41a2b0cf088e0fe3c1acf61f5925a362028cb03c583429bc4 |
| japanese6/output.jww | 140728 | 3a4167d339b37fb808bc5bfb2ba8639407099b76922cf292cb254a91d4e36382 |
| mixed7/output.jww | 140764 | 47ef43a17992e15acb32da54c48080343fc9edfd70ac194f24ebc8b9636cd723 |
| empty-reference/output.jww | 140787 | 8be31ff9b518e6e8a9c2eb6f7db4f242c6d087ef162ca8ed697a529facf9072a |
| empty-planned/output.jww | 140640 | 22d0cbb5e5eeb7e5bb2f96dc804b2596e8b25479f4c65f817e391f13e8211b29 |
| decoration-reference/output.jww | 140863 | c5e8d2973bb5a0bc80c4308b3569b4dbc4b754fb6676a1e7b1900343e2276c13 |
| decoration-planned/output.jww | 140716 | f8c551ff86994a6fa76f189ac814e78908aff294ac708a63d698babf86447e90 |
| ascii6/native-export.jwf | 10180 | 3fa686f3b4b84a4b4a4f7967d99e92fa4c1602992a5968d559d3c6ddb810f8bf |
| ascii6/reimport-output.jww | 140704 | 36661afa8e9466128d0b74bd27059a5a4778d018f999d73d837e22afc21caff4 |

All new JWW outputs are v700. Reference cases have 1955 drawing entities; planned cases have 1952. Ten new source-pinned tests require `JWF_NATIVE_BOUNDARIES_DIR=.work/jwf-native-boundaries-20261016`. They cover source profiles, saved raw/display text, empty-label counts, `halfOverlay` runs, JSON rebuild text/run/segment equality, semantic/metadata equality, and byte-identical Gateway no-op saving. The export test pins the missing-key limitation; its pass does not mean successful native environment preservation. No GUI test is replaced by an automated file assertion.

An always-running test checks all eight Gateway fields against 0/5/6/7-byte, Japanese and square/circle control values. The two out-of-spec cases remain rejected for editing, while their literal input is not silently truncated. Original comments/inactive rows and unchanged JWF bytes are preserved.

Focused tests: **54/54 passed**. Full `npm test`: **376/376 passed, zero skips**, with JWF_REVIEWED_SAMPLE, JWF_NATIVE_EVIDENCE_DIR, JWF_NATIVE_FIELDS_DIR and JWF_NATIVE_BOUNDARIES_DIR configured. Without all four variables, 26 source/private-evidence tests explicitly skip; a configured missing file fails. This continuation changes tests and evidence documentation only, not production parser, writer or UI behavior. No browser/consumer-app acceptance is claimed.

Additional checks in this continuation: `npm run verify` passed (smoke and manifest, no missing files); `npm run roundtrip:corpus` passed 41/41; `npm run build` returned the existing missing-script error. The scoped legacy OneDrive project-path scan found no matches, and `git diff --check` passed. No build script was invented. Browser checks were not rerun because no application behavior or UI was changed.

All test processes were closed; Jw_cad registry and installed-file baseline restoration/verification passed. Nine new profile pairs and all nine input copies matched their preparation hashes; all nine protected canonical dirty-file hashes remained unchanged. Temporary helper delays/cached-element failures were reobserved before further input; no uncertain action was counted as a completed result. File-association prompts were cancelled and no print job was issued.

## Native Results

Each generation used a fresh process, restored registry baseline, one active target key in the TEST runtime startup JWF, and a fresh copy of the distributed shadow drawing. The input hash is `a574ab02d25d5dcefb4ed4e0d18b192c45c6fa264f58769dedcd7a904d7afb8b` (v600, 117097 bytes, 1740 entities). Measurement/output positions and both table options were kept consistent. Each contrast changes only one field to Qn. No original input drawing was overwritten. Before each reopen session, the registry baseline was restored and the target JWF key was commented out. Fields 2/4/5/6 were reopened sequentially in one such clean session without drawing edits; the other cases had separate clean sessions.

| Field | Meaning | Native-saved labels | Native reopen in this continuation |
| --- | --- | --- | --- |
| 1 | Reference building prefix | Q13}, Q14}, Q16}, each twice | Confirmed; improved table framing in recovered continuation |
| 2 | Reference building suffix | {3Q2, {4Q2, {6Q2, each twice | Confirmed; all three table labels inspected |
| 3 | Planned building prefix | Previous Q3 evidence only | Previous continuation, not rerun |
| 4 | Planned building suffix | (3Q4, (4Q4, (6Q4, each twice | Confirmed; all three table labels inspected |
| 5 | Reference triangle prefix | Q51] through Q55], each twice | Confirmed; five table labels inspected |
| 6 | Reference triangle suffix | [1Q6 through [5Q6, each twice | Confirmed; five table labels inspected |
| 7 | Planned triangle prefix | Q71> through Q75>, each twice | Newly generated, saved and reopened; five table labels inspected |
| 8 | Planned triangle suffix | <1Q8 through <5Q8, each twice | Newly generated, saved and reopened; five table labels inspected |

Generation and Save As for fields 1/2/4/5/6 came from the interrupted continuation; this continuation finished their reopens and generated/saved/reopened fields 7/8. Exact strings/counts were independently extracted from the native-saved files by Gateway. Two occurrences mean diagram and table; the native visual check covered the table, not every rotated diagram label. The unaffected table class retains its original affixes. The opposite building branch was not separately generated in each case. This is not validation of sky-ratio numerical accuracy.

During field 1 a toolbar operation opened printer settings unexpectedly. It was cancelled; no Print button or canvas print action was executed. Save As thereafter used the observed File menu. This event is not REF_FILE or printing verification.

## Native Name Cases

| Case | Input value | Shift_JIS bytes | Native reflection / JWW save / reopen |
| --- | --- | ---: | --- |
| ascii19 | 1234567890123456789 | 19 | All confirmed, full value retained |
| ascii20 | 12345678901234567890 | 20 | All confirmed, full value retained |
| ascii21 | 123456789012345678901 | 21 | All observed, truncated to `12345678901234567890`; OUT OF SPEC |
| japanese-name | U+8A08 U+753B U+5EFA U+7269 U+691C U+8A3C | 12 | All confirmed, full Japanese value retained |
| japanese20 | U+6771 U+4EAC U+8A08 U+753B U+5EFA U+7269 U+78BA U+8A8D U+8A66 U+9A13 | 20 | All confirmed, all ten Japanese characters retained |
| mixed21 | 1234567890123456789 followed by U+5EFA | 21 | All observed, entire final Japanese character retained (21 bytes); OUT OF SPEC |

The actual JWF files contain the Japanese names, not escape sequences. The native planned-option accessibility label and all three generated name texts agree with the outcomes above. The reference-option label remained at its default. No setting-value warning was observed. Long toolbar labels were visually clipped by their control width; the accessibility text and saved drawing contained the full observed value. Reopened table headings/footers were inspected visually; exact character counts come from the saved-file tests.

ASCII21 and mixed21 demonstrate different observed behavior in 10.02.1. They do not establish a general truncation algorithm, a revised limit, or behavior in 10.03.7. Gateway still rejects edited names over the documented 20 Shift_JIS bytes; it does not silently truncate or emulate this out-of-spec exception. A JWW text entity containing the diagnostic name is preserved independently of the JWF input guard.

## Evidence

Private root: `.work/jwf-native-fields-20261016`. Thirteen case directories contain on.jwf, off.jwf, input.jww, output.jww and reopened-review.png. Name cases also contain applied.png and applied-accessibility.txt. `cases.json` records initial NOT_RUN status, and `native-results.json` preserves the interrupted-run record. **Current observations and artifact hashes are in `native-results-recovered.json`.** Source profiles, screenshots and full native drawings remain private.

| Native output | Bytes | SHA-256 |
| --- | ---: | --- |
| field-1/output.jww | 140863 | e302acb151ad72eca7f20f47fb7b84e88a99e34ccdb07e9c494d6f21b15debe0 |
| field-2/output.jww | 140863 | 36177e75f8ec994396bde6c3b803c1d33c998641a8f153eff8a3e16cd96f75a3 |
| field-4/output.jww | 140716 | d57e6efcc5da761d8209f28170816bdf872fce780f5963761a1178236318d64e |
| field-5/output.jww | 140871 | 04b5fd631a2e2bc7f5d281a1f90f379ecae900dd71a4ca8b479b4c29943a3dca |
| field-6/output.jww | 140871 | 7a13d11ec80b9c2bd90829244fcbd54f9f968d443b5a0a8e00503dcbdfd4d7e5 |
| field-7/output.jww | 140724 | 5dc58560953f58f14b8aef4d86cbfe3d1a2cfa7107287d3810b1b36a3de36674 |
| field-8/output.jww | 140724 | 7a9ea3db594b647efa12cccf072fc3421c31b60bb8c5ca2035d5558613386e56 |
| ascii19/output.jww | 140788 | 23e2562d8a792071e04d04c4a02926e87f28cc9d9478560bf66f77418a1a7625 |
| ascii20/output.jww | 140794 | d27c0826082bd6ca679f40642efc36f4b25cc22031f98e107383c760ca5aef53 |
| ascii21/output.jww | 140794 | 7243af65a8cbf106310d2233c79a3b3cbfad820cfa0366c1c0a052cc0ad175e1 |
| japanese-name/output.jww | 140710 | 707cd46a6f87ba9507f68fd9cf54afc0053b2071776b365df917a1fe28d615af |
| japanese20/output.jww | 140734 | 1e5b2208621f9cc558bac1648f13a3040cb7471eff2fc9c5397addf45a576772 |
| mixed21/output.jww | 140794 | 0f9e920752eb5449c8fcf6ddaa06455d5faed059348179c3421bd2fb031693de |

All outputs are v700. Reference cases 1/2/5/6 have 1955 entities; the other cases have 1952. `JWF_NATIVE_FIELDS_DIR=.work/jwf-native-fields-20261016` enables thirteen source-pinned regression tests. They test saved strings, unaffected numbering, byte-identical Gateway no-op saves and semantic rebuilds, not native reopen. Six name tests additionally check the exact source profile, byte length, inactive arm and full rebuilt text. A configured missing file fails; an absent variable explicitly skips these private-fixture tests.

## Earlier Automated Verification

| Check | Result | Boundary |
| --- | --- | --- |
| Focused native-evidence and optional-key tests | 43/43 passed | Eight additional native-saved-file regressions; six name-byte cases retain the documented editing guard |
| npm test | 365/365 passed, zero skips | JWF_REVIEWED_SAMPLE, JWF_NATIVE_EVIDENCE_DIR and JWF_NATIVE_FIELDS_DIR configured with verified private inputs |
| npm run verify | Passed | Smoke and package manifest; no missing files |
| npm run roundtrip:corpus | 41/41 passed | Generated corpus, not native GUI acceptance |
| npm run build | Missing script | Existing package has no build script |
| Browser | Not rerun | No application UI or production parser/writer behavior changed in this continuation |
| Legacy path / whitespace | No old OneDrive project path matches; git diff --check passed | Source scan excludes .git, .work and node_modules |

Without the three opt-in environment variables, sixteen source/private-evidence tests explicitly skip. The native GUI observations above were performed separately; no automated saved-file assertion is presented as native GUI evidence. Native Save As changes version/content and is not byte-identical to the input. Byte identity applies only to Gateway no-op saving each output itself.

## Connection And Protection

The prior continuation stopped during field-7 startup after `list_windows` timed out, its delayed retry timed out and a kernel reset/re-import/retry also failed. That stop record remains in `native-results.json`; no failed-run result was promoted to a pass.

On this retry, connectivity recovered and the current registry/installed-file baseline matched BEFORE restoration or test changes. Only supported computer-use input was used. One launch during ASCII20 reopen resolved to the installed executable because the identifier omitted `process:`. It was observed as an untitled, unedited window, closed, and excluded from the experiment. Baseline restoration/verification succeeded, and the exact `process:` test-runtime identifier was used for the successful retry. Association prompts were cancelled throughout; no printing occurred in this recovered continuation.

All agent-created native sessions were closed. Jw_cad registry and installed source hashes were restored/verified. All thirteen on/off profile pairs and input copies retained their original content. All nine protected canonical dirty-file hashes remained unchanged. The normal installed JWF files were never edited, and no canonical main files were modified.

## Remaining Work

1. TNKN_SET native six-byte boundaries outside field 3, independent empty/nonempty mixtures, whitespace handling, other numbering (including 99/100) and geometry remain unverified. The nine latest bounded cases above do not certify the whole key.
2. Native JWF export/reimport was executed once and did not preserve TNKN_SET. Export after generation, repeated manual loading of the original active copy and interactions with other settings remain unverified. Preserved generated JWW text is not restored JWF environment state.
3. No universal over-limit algorithm, other Jw_cad release behavior or native reloading of Gateway-rebuilt files is claimed by these tests.
4. Other optional-key manual-input/printing gates in the parent audit remain open. Do not promote either key or all JWF support to fully native-verified.
