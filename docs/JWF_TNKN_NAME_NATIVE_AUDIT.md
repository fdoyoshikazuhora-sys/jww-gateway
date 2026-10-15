# TNKN Fields And Planned Name Native Audit

Updated: 2026-10-16. **Connection recovered; the seven remaining TNKN field contrasts and six planned-name cases have native reflection, separate JWW Save As and clean-process JWW reopen evidence.** This follows [the optional-key audit](JWF_OPTIONAL_KEYS_NATIVE_AUDIT.md). This bounded matrix is executed; neither key is fully certified. Native JWF export/reimport, other values and other versions remain unverified. No production behavior was changed.

## Sources

Installed Jw_cad 10.02.1, official Sample.jwf SHA-256 `c6ca97617d4f2b037cec4c4c280c1bb5c963aa106d44cef37caf3aac8a6b8f38`. Lines 1723..1725 specify TNK3_NM2 as at most 20 bytes (10 Japanese characters). Lines 1727..1744 define eight comma-separated TNKN_SET fields and the separate decoration example. The installed sample is the field-level source; the online binary JWW specification does not define JWF loading behavior.

Official [download page](https://www.jwcad.net/download.htm) and [version history](https://www.jwcad.net/versioninfo.htm) were rechecked. They list 10.03.7; no upgrade was made. All native observations below are specific to installed 10.02.1.

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

## Automated Verification

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

1. TNKN_SET six-byte boundaries, empty affixes, `^w` decoration, other numbering and geometry remain unverified natively.
2. Manual JWF reload, native JWF export/reimport, repeated application and interactions with other settings were NOT tested by this matrix. The save/reopen evidence concerns generated JWW drawing text, not persistence of JWF environment defaults.
3. No universal over-limit algorithm, other Jw_cad release behavior or native reloading of Gateway-rebuilt files is claimed by these tests.
4. Other optional-key manual-input/printing gates in the parent audit remain open. Do not promote either key or all JWF support to fully native-verified.
