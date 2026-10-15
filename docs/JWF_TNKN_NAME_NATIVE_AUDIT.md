# TNKN Fields And Planned Name Native Audit

Date: 2026-10-16. **Incomplete: automation connection failed before the requested matrix was finished.** This follows [the optional-key audit](JWF_OPTIONAL_KEYS_NATIVE_AUDIT.md). No new production behavior or whole-key certification is introduced.

## Sources

Installed Jw_cad 10.02.1, official Sample.jwf SHA-256 `c6ca97617d4f2b037cec4c4c280c1bb5c963aa106d44cef37caf3aac8a6b8f38`. Lines 1723..1725 specify TNK3_NM2 as at most 20 bytes (10 Japanese characters). Lines 1727..1744 define eight comma-separated TNKN_SET fields and the separate decoration example. The installed sample is the field-level source; the online binary JWW specification does not define JWF loading behavior.

Official [download page](https://www.jwcad.net/download.htm) and [version history](https://www.jwcad.net/versioninfo.htm) were rechecked. They list 10.03.7; no upgrade was made. All native observations below are specific to installed 10.02.1.

## Native Results

Each generation used a fresh process, restored registry baseline, one active target key in the TEST runtime startup JWF, and a fresh copy of the distributed shadow drawing. The input hash is `a574ab02d25d5dcefb4ed4e0d18b192c45c6fa264f58769dedcd7a904d7afb8b`. Measurement/output positions and both table options were kept consistent. Each contrast changes only one field to Qn. No original input drawing was overwritten.

| Field | Meaning | Native-saved labels | Native reopen in this continuation |
| --- | --- | --- | --- |
| 1 | Reference building prefix | Q13}, Q14}, Q16}, each twice | Loaded in a new restored process with target commented out; generated table visible; screenshot retained |
| 2 | Reference building suffix | {3Q2, {4Q2, {6Q2, each twice | NOT RUN |
| 3 | Planned building prefix | Previous Q3 evidence only | Previous continuation, not rerun |
| 4 | Planned building suffix | (3Q4, (4Q4, (6Q4, each twice | NOT RUN |
| 5 | Reference triangle prefix | Q51] through Q55], each twice | NOT RUN |
| 6 | Reference triangle suffix | [1Q6 through [5Q6, each twice | NOT RUN |
| 7 | Planned triangle prefix | NOT RUN; test process launch only | NOT RUN |
| 8 | Planned triangle suffix | NOT RUN | NOT RUN |

Native table generation and Save As were observed for fields 1, 2, 4, 5 and 6. Exact strings/counts above were then extracted from the native-saved files by Gateway. This binary inspection is not a substitute for native reopen. Field 1's reopen screenshot is limited in framing/legibility and does not prove all table cells or all generated labels were individually inspected. The unaffected table class has its original affixes in the saved files. The opposite building branch was not separately generated in each case.

During field 1 a toolbar operation opened printer settings unexpectedly. It was cancelled; no Print button or canvas print action was executed. Save As thereafter used the observed File menu. This event is not REF_FILE or printing verification.

## Name Cases Prepared, Not Run

| Case | Value | Shift_JIS bytes | Native status |
| --- | --- | ---: | --- |
| ascii19 | 1234567890123456789 | 19 | NOT RUN |
| ascii20 | 12345678901234567890 | 20 | NOT RUN |
| ascii21 | 123456789012345678901 | 21 | NOT RUN; outside documented limit |
| japanese-name | U+8A08 U+753B U+5EFA U+7269 U+691C U+8A3C | 12 | NOT RUN |
| japanese20 | U+6771 U+4EAC U+8A08 U+753B U+5EFA U+7269 U+78BA U+8A8D U+8A66 U+9A13 | 20 | NOT RUN |
| mixed21 | 1234567890123456789 followed by U+5EFA | 21 | NOT RUN; multibyte character crosses limit |

The actual JWF files contain the Japanese names, not escape sequences. Gateway unit tests separately check byte lengths, valid-name preservation and rejection of edited names above 20 bytes. Native acceptance, truncation, character splitting, warnings and saved/reopened behavior are UNKNOWN. Do not infer them from these unit tests.

## Evidence

Private root: `.work/jwf-native-fields-20261016`. Thirteen case directories contain on.jwf, off.jwf and input.jww; cases.json records profile hashes and initial NOT_RUN status. Actual evidence and current state are recorded separately in native-results.json. Source profiles and full native drawings remain private.

| Native output | Bytes | SHA-256 |
| --- | ---: | --- |
| field-1/output.jww | 140863 | e302acb151ad72eca7f20f47fb7b84e88a99e34ccdb07e9c494d6f21b15debe0 |
| field-2/output.jww | 140863 | 36177e75f8ec994396bde6c3b803c1d33c998641a8f153eff8a3e16cd96f75a3 |
| field-4/output.jww | 140716 | d57e6efcc5da761d8209f28170816bdf872fce780f5963761a1178236318d64e |
| field-5/output.jww | 140871 | 04b5fd631a2e2bc7f5d281a1f90f379ecae900dd71a4ca8b479b4c29943a3dca |
| field-6/output.jww | 140871 | 7a13d11ec80b9c2bd90829244fcbd54f9f968d443b5a0a8e00503dcbdfd4d7e5 |

`JWF_NATIVE_FIELDS_DIR=.work/jwf-native-fields-20261016` enables five source-pinned regression tests. They test saved strings, byte-identical Gateway no-op saves and semantic rebuilds, not native reopen. A configured missing file fails; absent environment variable explicitly skips the five private-fixture tests.

## Automated Verification

| Check | Result | Boundary |
| --- | --- | --- |
| Focused native-evidence and optional-key tests | 35/35 passed | Includes five new saved-file regressions and one name-byte-boundary test |
| npm test | 357/357 passed, zero skips | JWF_REVIEWED_SAMPLE, JWF_NATIVE_EVIDENCE_DIR and JWF_NATIVE_FIELDS_DIR configured with verified private inputs |
| npm run verify | Passed | Smoke and package manifest |
| npm run roundtrip:corpus | 41/41 passed | Generated corpus, not native GUI acceptance |
| npm run build | Missing script | Existing package has no build script |
| Browser | Not rerun | No application UI or production parser/writer behavior changed in this continuation |

Without the three opt-in environment variables, eight source/private-evidence tests explicitly skip. The saved-file regressions do not advance the NOT_RUN native reopen or name-case statuses above.

## Stop And Protection

During field-7 startup, `list_windows` returned `computer-use request timed out: list_windows`. A two-second delayed retry failed. Resetting the JavaScript kernel, importing the supported computer-use module again and retrying also failed. Native input stopped; no alternative UI automation was used.

The agent-created test process was identified by exact executable path, PID 29520 and creation timestamp 2026-10-16T04:37:08.9434990+09:00, then terminated with no field-7 drawing edits performed. A first cleanup identity check refused to run because its timestamp omitted fractional seconds; the exact timestamp was re-read before termination. Registry and installed source hashes were restored/verified afterward. All nine protected canonical dirty-file hashes remained unchanged. The normal installed JWF files were never edited.

## Remaining Work

1. Recover the Windows computer-use connection before further native input. Recheck current baseline rather than restoring an older baseline over user changes.
2. Native-reopen fields 2, 4, 5 and 6 without active target JWF; capture legible labels. Improve field-1 framing for all labels.
3. Execute fields 7 and 8 individually through reflection, separate Save As and clean-process reopen.
4. Execute the six name cases through the same steps. Treat 21-byte cases as diagnostic out-of-spec probes, not supported values.
5. TNKN_SET six-byte boundaries, empty affixes, decoration, other numbers/geometry, manual JWF reload and native JWF export remain outside this completed evidence. Do not promote either key to fully native-verified.
