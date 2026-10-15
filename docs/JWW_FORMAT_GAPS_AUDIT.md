# JWW Format Gaps Audit

## Scope and Evidence

Baseline: `c5f7d551be8de3b927e46344ada37307f5f397fc` on `main`.
Audit date: 2026-10-15. Remediation branch: `codex/jww-format-audit`.
The canonical repository's existing uncommitted UI/JWF/CLI edits were not incorporated or modified; this work uses a separate worktree at the requested commit.

Primary reference: [Jw_cad data format](https://www.jwcad.net/jwdatafmt.txt), retrieved as 24,156 bytes and decoded with Windows-932.
SHA-256: `028a63568400c99d4e6bbff9c3ad4fc610f4b27b09b651522fbe99bba19e5165`.
The document identifies Version 7.02/internal 700. The audited 600/700 branches share the header declarations; embedded images are version 700 only.

Supplementary primary references: [MFC persistent object format](https://learn.microsoft.com/en-us/cpp/mfc/tn002-persistent-object-data-format?view=msvc-170), [CArchive](https://learn.microsoft.com/en-us/cpp/mfc/reference/carchive-class?view=msvc-170), and [CTime](https://learn.microsoft.com/en-us/cpp/atl-mfc-shared/reference/ctime-class?view=msvc-170).
MFC documentation does not establish the exact CTime encoding used by every Jw_cad build.

This is a binary-structure preservation audit, not certification of full Jw_cad compatibility. Native Jw_cad reopening, mep-draft rendering/editing, and CAD Studio Pro integration were **not** performed in this audit. No synthetic fixture is described as a native Jw_cad-generated acceptance fixture.

## Gap Matrix

| Area | Baseline finding | Remediation / current contract | Remaining limit |
| --- | --- | --- | --- |
| Complete document prefix | Only selected settings projected into JSON; preservation depended on an external template. | All 3,221 scalar/CString fields now have ordered descriptors, offsets, sizes, values and original prefix bytes in `meta.jwwInternalSettings.document`. | Primitive serialization coverage is not semantic validation of every possible setting value. |
| Header/entity-list boundary | Class-name and color-table heuristics could mistake text for structure. | Official prefix parsing determines the list start and standard color-table position. | Unverified headers remain diagnostic-only; strict conversion refuses them. |
| Standard color tables | Heuristic required multiple colors and positive widths/radii. | Exact official offsets also support monochrome tables and zero values. | Existing native color-edit UI validation can be narrower than raw retention. |
| SXF colors | No complete named JSON projection of extended tables. | Retain all 257 entries at color indices 100..356, names, screen/print widths, print colors and point radii. | Consumer rendering must resolve SXF colors; this PR does not implement a consumer renderer. |
| SXF line types | No complete named projection of extended pattern parameters. | Retain 33 entries at 30..62, names, segment counts and all ten pitch doubles per entry. | Native pattern rendering/printing not tested. |
| Base `m_sFlg` | Raw WORD already retained, but systematic bit coverage absent. | Preserve the complete WORD, including reserved bits; exercise every bit and combined words. | Named UI toggles for every entity-specific interpretation are not introduced. |
| Text dimension flags | WORD present as `jww.penWidth`, without explicit decoder/editor. | New `decodeJwwTextDimensionFlags` / `encodeJwwTextDimensionFlags` preserve all 65,536 words and reserved bits. | Numeric flag representation is not proof that a consumer formats dimension labels correctly. |
| Circular solids | Polygon-oriented conversion did not distinguish overloaded parameter slots. | Explicit `JWW_CIRCULAR_SOLID` JSON entity; validate and serialize styles 101/105/106/111 and ten documented shape cases. | Other styles/shape parameters are unverified and refused by the bounded writer. Annular type 106 rendering is not implemented here. |
| Five dimension DWORDs | Existing decimal packing largely matched the reference. | Retain the existing implementation; add independent expected DWORD values for all packed groups and both versions. | No automatic application of JWF settings; zero/unconfigured values remain distinct. |
| Signed maximum width | Raw signed value already available; no complete branch helper. | Preserve int32 and add `decodeJwwMaxDrawWidth` for -101, -201..-300 and -401..-500. | -400 is produced by one reading of the sample code but omitted from its prose range; interpretation stays unverified. |
| Grid and printer flags | Grid signed mode retained, printer header not completely projected. | Full raw header retains negative grid mode, common-layer gray flag, display-only flag and print order/settings. | No claim that Gateway UI exposes or Jw_cad honors all values. |
| Internal setting text | Six known keys extracted, then reinserted after drawing records; semantic diff ignored attribute/order changes. | Preserve source index, complete text attributes, controls and ordering; full compatibility includes their differences. | These keys and numeric domains are not specified in the retrieved 7.02 document. Unknown keys remain ordinary text, not invented settings. |
| Metadata-like text | `hq[b/d]` / `jww_` prefixes silently discarded. | Preserve ordinary source text, including these prefixes. | A prefix alone is not a proven internal record marker. |
| Temporary/full-circle/referred flags | DWORDs reduced to booleans in some paths. | Preserve raw DWORD values alongside boolean views. | Contradictory explicit edits are normalized to the requested boolean by existing writer policy. |
| Zero point/block scale | `value || 1` changed zero to one. | Use nullish defaults; test zero retention. | Geometric validity of a zero scale is not asserted. |
| Empty names/fonts | Falsy defaulting replaced valid empty CString values. | Retain empty font and block-name strings. | Rebuilt entity strings may still use a different CString encoding than the original. |
| Incomplete records | Short reads could supply zero-filled values; list completeness did not cover every boundary. | Track failed reads, reject truncated/non-finite payloads, reject incomplete nested lists and invalid list/object-reference class roles. | `parse()` remains an inspection API; callers must respect diagnostics. Conversion/write/preflight enforce refusal. |
| Unsupported/trailing source bytes | Some conversion/save paths silently proceeded despite parser loss. | Strict conversion and writes refuse unsupported/incomplete/unparsed regions. CLI opt-in emits warnings. Native edits require explicit `allowUnsupported`. | Opt-in does not make unknown data understood and does not permit native rebuild across unknown bytes. |
| Source integrity | No-op native save trusted a stored hash without rechecking mutable original bytes. | Preflight recomputes SHA-256 and rejects changed source buffers. | Hash equality establishes consistency, not authenticity or Jw_cad acceptance. |
| Full semantic-diff gate | Overall compatibility excluded internal-setting differences. | Include header values and complete internal-setting records; add CLI `--fail-on-difference`. | Geometry tolerance defaults to 1e-9; byte comparison is a separate test. |

## Header Field Inventory

[JWW_FORMAT_FIELD_MATRIX.md](JWW_FORMAT_FIELD_MATRIX.md) lists every header field separately, its declared primitive type, and its byte offset/length in the built-in template. CString lengths make offsets file-dependent.
The generator uses the implementation descriptor list. It is reproducible coverage inventory, **not an independent specification oracle**. Tests additionally check selected offsets/values against independent literals and existing native sample headers.

Coverage includes version/memo/paper; 16 groups and 256 layers with states, protection and names; dummy words; dimension/print/grid settings; shadow/sky and 2.5D fields; view origins and zoom jumps; multiline settings; standard and extended color/line tables; drawing/printing order and flags; eye coordinates; creation defaults; and text presets, alignment and offsets.
Unnamed dummy fields are retained without assigning invented semantics.

The `document.fields` sequence is authoritative when writing converted Gateway JSON. Derived `meta` presentation fields are not a second independently editable serialization format. Use typed writer options for supported settings or edit the corresponding header field; the CLI preserves the supplied document header instead of overwriting it from stale presentation aliases. Keep both representations consistent in custom consumers.
Unchanged strings/numbers retain their original bytes, including original CString encoding and floating-point negative-zero bits. Changed header strings use MFC UTF-16 CString encoding. Unknown non-finite numeric fields are not silently normalized.

## Entity Field Layouts

Offsets below are payload-relative; MFC object/class tags precede the payload. All numbers are little-endian. Both supported versions include the 15-byte base record.

| Class | Offset | Field | Bytes / condition | Preservation |
| --- | ---: | --- | --- | --- |
| CData (every entity) | 0 | curve/group number | DWORD, 4 | raw integer |
| CData | 4 | pen style | BYTE, 1 | raw integer |
| CData | 5 | pen color | WORD, 2 | raw integer |
| CData | 7 | pen width / text dimension flags | WORD, 2 | raw integer; text helper |
| CData | 9 | layer | WORD, 2 | raw integer |
| CData | 11 | layer group | WORD, 2 | raw integer |
| CData | 13 | attribute flags | WORD, 2 | all bits |
| CDataSen | 15,23,31,39 | start X,Y; end X,Y | 4 doubles; total 47 | parsed/written; independent offset test |
| CDataEnko | 15,23,31,39,47,55,63 | center X,Y; radius; start; sweep; tilt; flatness | 7 doubles | raw geometry fields |
| CDataEnko | 71 | full-circle flag | DWORD; total 75 | raw DWORD + boolean |
| CDataTen | 15,23 | X,Y | 2 doubles | parsed/written |
| CDataTen | 31 | temporary flag | DWORD; ordinary total 35 | raw DWORD + boolean |
| CDataTen | 35,39,47 | point code; angle; scale | DWORD + 2 doubles only for style 100; total 55 | code, zero scale retained |
| CDataMoji | 15,23,31,39 | start X,Y; end X,Y | 4 doubles | parsed/written |
| CDataMoji | 47 | text type including decoration additions | DWORD | raw type retained |
| CDataMoji | 51,59,67,75 | width; height; spacing; angle | 4 doubles | raw parser fields; consumer normalization limits below |
| CDataMoji | 83, variable | font name; text/control string | 2 CStrings | content retained; rebuilt encoding may differ |
| CDataSunpou | 15 | embedded line then text | CDataSen + variable CDataMoji, each with base | all nested bases retained |
| CDataSunpou | variable | SXF mode | WORD | retained in v600/v700 |
| CDataSunpou | variable | two extension lines; four points | full serialized records, including point style-100 tails | retained; truncation rejected |
| CDataSolid | 15,23,31,39,47,55,63,71 | points in source order 1,4,2,3 | 8 doubles | retain source order; total 79 |
| CDataSolid | 79 | arbitrary color | DWORD only when color number = 10; total 83 | full DWORD retained |
| CDataBlock | 15,23,31,39,47 | reference X,Y; scale X,Y; rotation | 5 doubles | raw values; zero scales retained |
| CDataBlock | 55 | definition number | DWORD; total 59 | retained |
| CDataList | 15,19 | definition number; referred flag | 2 DWORDs | raw values |
| CDataList | 23 | timestamp | CTime, implementation-dependent | bounded 32-bit nonnegative form only; extended forms unverified |
| CDataList | variable | raw name and compound-figure suffix | CString | complete raw name retained |
| CDataList | variable | child entity list | MFC count and object records | class-role and completeness checks |
| Document after drawing list | variable | block-definition list | MFC count/object records | invalid list references rejected |
| Document after block list | variable | embedded images, v700 only | names, lengths, bytes | retained; incomplete data rejected |

The reference CDataSen example repeats `m_start.x` where the surrounding definition specifies X,Y. Existing X,Y interpretation is retained, not changed to reproduce an apparent sample typo.

## Attribute Words

`m_sFlg` is entity-dependent; it must not be confused with CDataMoji's dimension-setting WORD at base offset 7.
The table below summarizes documented uses; a blank/unlisted meaning does not authorize clearing that bit. All 16 bits are retained for every entity base, including nested dimension/block bases.

| Mask | Documented uses of `m_sFlg` |
| --- | --- |
| 0x0001,0x0002,0x0004,0x0008 | No meaning given in this reference; retained |
| 0x0010 | Figure attribute on circle/point; dimension value on text |
| 0x0020 | Hatch on line/circle/point/solid; vertical text |
| 0x0040 | Dimension on circle/point; true-north text |
| 0x0080 | Fitting on circle/point; shadow text |
| 0x0100,0x0200,0x0400 | Radius, diameter, angle dimension text |
| 0x0800 | Figure on line/block; figure-attribute selection on text |
| 0x1000 | Fitting on line/block; cumulative dimension text |
| 0x2000 | Dimension on line/block/dimension; fitting text |
| 0x4000 | Dimension text |
| 0x8000 | Line fitting excluded from envelope processing; 2.5D text |

| Mask | Text dimension-setting WORD meaning |
| --- | --- |
| 0x0002 | settings present |
| 0x0008 | full-width characters |
| 0x0010,0x0020 | unit selector; append unit |
| 0x0040,0x0080 | grouping comma; trailing fractional zeros |
| 0x0100,0x0200 | truncate; round up; neither means normal rounding |
| 0x0400,0x0800 | diameter/radius symbol prefix; suffix |
| 0x3000 | decimal-place field: 0,1,2,3 |
| 0xc005 | undocumented/reserved bits retained |

The source's prose and code disagree over the +10000/+20000 italic/bold additions. Raw `m_nMojiShu` is retained; interpreting or changing that disagreement requires independently verified native evidence.

## Circular Solids

All circular solids reuse the eight polygon coordinate slots in this order: center X/Y, radius/flatness, tilt/start angle, sweep/shape parameter. They are not polygon vertices.

| Style | Parameter | Meaning / constraint |
| ---: | --- | --- |
| 101 | -1 | outside-arc region; sweep magnitude at most pi/2 |
| 101 | 0 | sector |
| 101 | 5 | chord segment |
| 101 | 100 | full disk/ellipse |
| 105 | inner radius | annulus type 1; sweep distinguishes arc/full |
| 106 | inner radius | annulus type 2; equal outer/inner major/minor radius differences |
| 111 | 0 | circumference arc |
| 111 | 100 | full circumference |

The writer retains these parameters directly, without approximating arcs as polygons. It rejects undocumented styles and shape codes. `JWW_CIRCULAR_SOLID` is an intentional new Gateway JSON entity type; downstream applications must handle it explicitly before claiming display/edit compatibility.

## Refusal and Byte Identity

- `convertJwwBytes` is strict by default; use `allowUnsupported: true` only for deliberate salvage/inspection. The converter CLI exposes `--allow-unsupported` and warns on stderr.
- The bounded writer/preflight rejects incomplete source diagnostics and unsupported entities. Writer CLI opt-in warns that omitted data may be lost.
- Semantic-diff CLI `--fail-on-difference` exits 2 for a comparison mismatch; invalid input/processing errors exit 1.
- `parse()` remains usable for diagnostics of incomplete input; its output alone must never imply a safe save.
- Native dirty saves with unsupported source require `allowUnsupported: true`. That permits only an already-proven source splice; it does not unlock rebuilding unknown data.
- Native no-op copying of an unsupported file remains allowed because it preserves all original bytes after verifying the original hash. It does not mark that file Parse Clean.
- An actual edit should change the output hash. Splice tests assert that bytes outside the authorized replacement interval remain unchanged, not that an edited file has its original hash.
- Generated fixture JSON roundtrips and the two checked-in samples are byte-identical. This is not a general promise for every valid MFC archive: CString encoding, archive PID sharing, signed zero in entity projections, and normalization of geometry can differ during a semantic rebuild. Use Native unchanged/source-splice operations where original byte identity is required.

## Open Gates

These are explicit **unverified** items, not silently completed work:

1. Extended/64-bit CTime and historical signed-date encodings. Values outside the bounded timestamp form fail instead of guessing a layout.
2. Native meaning of unlisted sentinel keys/values and the +10000/+20000 decoration discrepancy. Known six sentinel rows are losslessly retained, not assigned new semantics.
3. General arbitrary-file JSON rebuild byte identity, MFC shared/null object identity, malformed legacy text encoding, negative geometry and all downstream display normalizations. The Native path retains source bytes; this PR does not claim a universally lossless semantic rebuild.
4. Native Jw_cad acceptance for every circular-solid subtype, SXF custom pattern, image codec and document setting. Synthetic tests cannot close this gate.
5. Updated consumer handling of `JWW_CIRCULAR_SOLID` and strict conversion failures. mep-draft and CAD Studio Pro were not changed.

## Verification

Run from the audit worktree:

```sh
npm test
npm run roundtrip:corpus
npm run verify
node tools/jww-format-field-matrix.mjs
```

The corpus now has 41 generated v600/v700 fixtures (previously 15). It tests real JSON serialization/deserialization, normalized meaning, complete header/internal settings, full binary equality, SHA-256 equality and Native no-op saving. Reports and fixture binaries are generated under `.work/roundtrip-corpus`; no proprietary external drawings are uploaded.
`formatAudit.test.js` adds per-byte truncation tests, all 65,536 dimension flag words, every header primitive descriptor, literal entity offsets, signed settings, sentinel attributes/order, malformed block-list references and source-hash mutation refusal.

Existing checked-in sample verification (settings-oriented fixtures; not evidence of broad native entity coverage):

| Sample | Bytes | SHA-256 | JSON rebuild / Native no-op / meaning |
| --- | ---: | --- | --- |
| `samples/jwf-pairs/jwf-open-items-core.jww` | 17435 | `da3666b5616caf525e0931ac11548af1c57a2fea821c339239b48d6324fdfe7b` | identical / identical / equal |
| `samples/jwf-pairs/jwf-open-items-layer-defaults.jww` | 17657 | `c069d23142068604588f17a3e82c3858b0b4115faf14b1e4413e92f47d10d4b3` | identical / identical / equal |

Final automated results: `npm test` **305/305**, `npm run roundtrip:corpus` **41/41**, and `npm run verify` **passed**. The converter -> JSON validator -> writer -> semantic-diff CLI chain passed on the core settings sample. Dedicated CLI tests verify refusal without opt-in, stderr warnings with opt-in, and the full-difference exit code.
The [committed corpus evidence](../reports/format-audit-corpus.json) contains separate first/second SHA-256 values, binary comparisons and Native no-op results for each generated fixture.

`npm run build` was attempted and returned `Missing script: build`; no root build script exists at the baseline and none was invented to claim a pass. Browser and native Jw_cad acceptance were not executed. The draft PR is not a claim that the open gates above are closed.
