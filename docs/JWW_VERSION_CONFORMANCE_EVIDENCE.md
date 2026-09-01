# JWW version conformance evidence

## Claim boundary

Gateway has separate evidence for parser conformance, generated writer round
trips, and Jw_cad GUI acceptance. None of those checks alone establishes
version-wide compatibility.

## Real v700 parser evidence

Two existing Jw_cad drawings were audited read-only on 2026-08-30. Neither is
redistributed as a package fixture.

- A 2,830,387-byte drawing contains 55,151 drawing records: ARC 1,913,
  CIRCLE 742, LINE 51,781, POINT 137, SOLID 2, and TEXT 576.
- A 974,948-byte drawing contains 17,100 drawing records: ARC 1,061, BLOCK 2,
  CIRCLE 278, DIMENSION 133, LINE 14,717, POINT 284, and TEXT 625.

Both report internal version 700, zero unsupported records, and zero skipped
records. This is parser evidence only. The isolated report is:

```text
.work/native-jww-open/version-conformance-real-and-bundled-20260830.json
```

The package's two redistributable JWF-pair samples also report version 700 and
parse without reported loss. No independently authored v600 drawing is present
in the package sample tree.

## Jw_cad installation v600 evidence

The local Jw_cad 10.02.1 installation contains 21 sample JWW files. A read-only
recursive conformance scan found one v220 file, three v351 files, fifteen v600
files, and two v700 files. All 21 parse without reported unsupported or skipped
records. The fifteen v600 files contain 22,624 drawing entities in total and
cover ARC, CIRCLE, LINE, POINT, SOLID, and TEXT. They do not contain native
DIMENSION, BLOCK/INSERT, or IMAGE records.

All fifteen v600 files carry the same packaged modification timestamp,
2008-01-01 06:01 local time. The official Jw_cad version history records the
Version 6.00 data-format change on 2007-11-05 and Version 6.01 on 2008-01-03:
<https://www.jwcad.net/download/versioninfo.htm>. This is strong release-era
provenance for the installed samples, but a packaged timestamp is not a
substitute for running the old 6.x executable itself.

On 2026-09-01, the same fifteen files were retrieved independently from the
public `KEINOS/Jw_cad-for-Mac` Jw_cad 7.11 bundle on GitHub:
<https://github.com/KEINOS/Jw_cad-for-Mac>. Every public file
matched the corresponding local installed sample byte-for-byte by file name,
size, and SHA-256. A separate Gateway conformance scan again identified all
fifteen as internal version 600 with zero unsupported and zero skipped records.
This makes the installed-sample baseline publicly reproducible; it does not
make the standard samples independently authored and does not add DIMENSION,
BLOCK/INSERT, or IMAGE coverage.

## Independently authored public v600 parser evidence

On 2026-09-01, two vehicle drawings were retrieved from the Matrix public CAD
download service. The distributor pages identify different real-world subjects
and publication dates, rather than Jw_cad standard samples:

- `NNP10_JWW.lzh`, Toyota Porte four-view drawing, published 2008-12-14:
  <https://nurie-cad.matrix.jp/modules/d3downloads/index.php?page=singlefile&cid=1&lid=84>
- `SCP92_JWW.lzh`, Toyota Belta two-view drawing, published 2009-10-18:
  <https://nurie-cad.matrix.jp/modules/d3downloads/index.php?page=singlefile&cid=1&lid=119>

The downloaded archive MD5 values exactly match the checksums printed on those
pages: `bacbe45a17ac3a55d740d9e158d9c96e` and
`c46cb992b8ce6a3611840c0bb5949326`. The extracted JWW files were inspected
read-only from the isolated `.work/native-jww-open/independent-v600/` tree and
were not added as package fixtures.

Gateway reports both drawings as internal version 600 with zero unsupported and
zero skipped records. `NNP10_JWW.jww` is 81,570 bytes and contains 1,015
records (ARC 610, CIRCLE 9, LINE 396). `SCP92_JWW.jww` is 88,171 bytes and
contains 1,252 records (ARC 436, CIRCLE 4, LINE 812). Together they establish
independently authored public v600 parser evidence for ARC, CIRCLE, and LINE.
They contain no native DIMENSION, BLOCK/INSERT, or IMAGE records, and no writer
or Jw_cad GUI claim is made from this parser-only scan.

All fifteen installed v600 samples were converted to Gateway JSON and rewritten
with their own source file as the template into an isolated output directory.
Every output was non-empty, parser-clean, drawing-semantic equal, and supported-
document-metadata equal to its source.

The representative `A mansion floor-plan example` sample contains 1,754
drawing entities. Its Gateway output opened visibly in Jw_cad 10.02.1 with A3
paper, scale 1/100, and layer `[0-9] General drawing - Drawing title`. A short
LINE was then added in blank space and saved. Jw_cad forward-saved the file from
internal version 600 to 700. Gateway reparsed the result with zero unsupported
or skipped records. Semantic diff reported the original 1,754 drawing entities
unchanged and exactly one appended LINE; the only document-metadata difference
was the expected expanded drawing bounds. Jw_cad also added six internal
print/view setting rows, which remain separated from drawing entities. Closing
and reopening the saved file in Jw_cad 10.02.1 displayed the added LINE and the
same A3, 1/100, and layer state.

The Jw_cad-resaved v700 file was converted and rewritten by Gateway with itself
as the template. The rewrite was byte-identical (SHA-256
`A9ABBD9847BB353FB7867B8DB801BA1DB9EA61DD95FFC1BA6B1C2788D4CB3392`)
and semantic diff reported drawing, document metadata, internal settings, and
parser-clean equality.

The isolated evidence is under:

```text
.work/native-jww-open/version-conformance-jwcad-install-20260830.json
.work/e2e-jww/jwcad-install-all-v600-roundtrip-20260830
.work/native-jww-open/independent-v600/github-keinos-standard-20260901/conformance.json
```

## Generated v600 evidence

The generated corpus contains seven v600 files covering LINE,
CIRCLE/ARC/ELLIPSE, TEXT/POINT, SOLID, DIMENSION, BLOCK, and external IMAGE.
The external image fixture uses the ordinary `^@BMfixture.bmp` reference form;
the `%temp%` embedded-image form remains v700-only.

Every v600 file passes parser-clean drawing and supported-document semantic
round-trip gates. Jw_cad 10.02.1 opened all seven files without a read-error
dialog on 2026-08-30. This proves current Jw_cad accepts those generated files;
it does not prove their provenance from Jw_cad 6.x, visual equality for every
attribute, or edit/resave compatibility in an older Jw_cad release.

The isolated generated evidence is under:

```text
.work/native-jww-open/roundtrip-corpus-v600-external-image-20260830
```

## Jw_cad 6.20 generated v600 runtime evidence

On 2026-09-01, the archived `jww620.exe` installer obtained through the
user-provided download location was run only inside the dedicated
`JWW620-Test-Win11` VM. The installer is not redistributed by Gateway. Its
local SHA-256 is
`A18B69A5C428E52B42AAF3FC055AE2C85A19F41DBDC51ECA15E1EA33272C3408`.
The Jw_cad version dialog in the VM identified the executable as Version 6.20.

Three Gateway-generated v600 fixtures were transferred through an isolated
host/guest exchange, opened visibly in Jw_cad 6.20, saved under new names,
closed, and reopened from the separately saved files. No private drawing was
used or redistributed. Every saved output remained internal version 600,
contained one drawing record, was non-empty, and reparsed in Gateway with zero
unsupported and zero skipped records.

| Fixture | Input / output bytes | Jw_cad 6.20 result | Gateway semantic result |
| --- | ---: | --- | --- |
| DIMENSION | 16,416 / 16,399 | Open, Save As, and reload succeeded | Text end point X normalized from `12` to `12.25`; dimension-settings word `9322` normalized to `9122` |
| BLOCK/INSERT | 16,228 / 16,197 | Open, Save As, and reload succeeded | Definition number normalized from `1` to `0`; name, reference position, X/Y scales, rotation, and definition LINE stayed equal |
| external IMAGE reference | 16,210 / 16,146 | Reference frame opened, Save As and reload succeeded | Pen color normalized from `2` to `1` and text end point X from `65` to `49`; file name, image dimensions, position, rotation, and `^@BM...` payload stayed equal |

The IMAGE test is specifically the external `fixture.bmp` reference form. The
BMP was intentionally not supplied to the VM, so this proves preservation and
reload of the IMAGE reference record and its frame, not pixel rendering and not
v600 embedded-image support.

The three Save As outputs are parser-clean but not drawing-semantic equal under
the Gateway comparator because Jw_cad 6.20 performed the explicit
normalizations above. Those differences are recorded rather than suppressed.
The checks establish old-runtime acceptance, Save As, and reload for these
generated records; they do not establish independently authored v600
conformance.

The DIMENSION fixture was then opened again in Jw_cad 6.20 and edited by adding
one LINE. Save As created a separate 16,460-byte v600 file. Gateway reparsed the
output cleanly with one DIMENSION and one LINE, retained A3 paper, layer/group
state, group scales, and internal settings, and reported the intended LINE from
`(67.565217391, -36.52173913)` to `(128.434782609, -36.52173913)`. The same
semantic diff separately reported Jw_cad 6.20 normalization of the DIMENSION
text end point X from `12` to `12.25`, text type from `1` to `0`, and the
retained dimension dummy word from `9322` to `9062`. The edited output was
closed and visibly reloaded in Jw_cad 6.20; both the DIMENSION and added LINE
were present. This proves one generated-fixture intentional-edit cycle only.

The isolated evidence is under:

```text
.work/native-jww-open/legacy-jwcad/vm/vm-jwcad-version-6.20-20260831.png
.work/native-jww-open/legacy-jwcad/vm/vm-v600-dimension-*-20260901.png
.work/native-jww-open/legacy-jwcad/vm/vm-v600-block-*-20260901.png
.work/native-jww-open/legacy-jwcad/vm/vm-v600-image-*-20260901.png
.work/native-jww-open/legacy-jwcad/vm/exchange/*.diagnostics.json
.work/native-jww-open/legacy-jwcad/vm/exchange/*.semantic.json
.work/e2e-jww/v600-dimension-jw620-intentional-line.jww
.work/e2e-jww/v600-dimension-jw620-intentional-line.diagnostics.json
.work/e2e-jww/v600-dimension-jw620-intentional-line.semantic-diff.json
.work/e2e-jww/v600-dimension-jw620-intentional-line-reload.png
```

## Remaining independent-sample gate

The remaining `jww-version-conformance` item is now limited to evidence that
is not supplied by the generated fixtures, installed samples, public mirror, or
the two independently authored Matrix drawings:

1. non-private, independently authored v600 files containing native DIMENSION,
   BLOCK/INSERT, and IMAGE records; and
2. equivalent evidence for any additional Jw_cad release for which compatibility
   is claimed.

Until the remaining independent samples are available, Gateway may
claim the bounded v600/v700 writer contract, parser/semantic results for the 15
installed v600 samples, parser-only ARC/CIRCLE/LINE results for the two Matrix
drawings, and the recorded Jw_cad 10.02.1 open/edit/save/reload result. It may
also claim the exact Jw_cad 6.20 generated-fixture Open, Save As, reload,
parser-clean results, automatic normalizations, and single intentional LINE-edit
cycle listed above, but not version-wide independently authored v600
compatibility or independent DIMENSION/BLOCK/IMAGE coverage.
