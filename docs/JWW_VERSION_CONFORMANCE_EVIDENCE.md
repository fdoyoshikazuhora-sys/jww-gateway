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

## Remaining old-release runtime and entity-sample gate

The remaining `jww-version-conformance` item is now limited to evidence that
cannot be established with the installed Jw_cad 10.02.1 runtime or the available
installed samples:

1. edit, Save As, and reload evidence in an actual Jw_cad 6.x runtime;
2. non-private, independently sourced v600 files containing native DIMENSION,
   BLOCK/INSERT, and IMAGE records; and
3. equivalent evidence for any additional Jw_cad release for which compatibility
   is claimed.

As checked on 2026-08-30, the official download page links Version 10.03.5 and
Version 8.25a, but no Version 6.x installer. No 6.x executable was found in the
local Jw_cad or Downloads directories. Acquiring and running an archived binary
therefore requires a separate provenance and safety decision.

Until the old runtime and remaining entity samples are available, Gateway may
claim the bounded v600/v700 writer contract, parser/semantic results for the 15
installed v600 samples, and the recorded Jw_cad 10.02.1 open/edit/save/reload
result, but not version-wide or Jw_cad 6.x runtime compatibility.
