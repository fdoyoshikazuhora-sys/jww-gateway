# Bounded JWW writer evidence

## Contract

The Gateway writer supports internal JWW versions 600 and 700 for the entity
families it explicitly accepts. Unsupported entity types fail by default. This
is a bounded writer contract, not a version-wide compatibility claim.

For `CDataSolid`, the binary serialization order is point 1, point 4, point 2,
point 3. Gateway JSON exposes the visible boundary in point 1, point 2, point
3, point 4 order. The converter now keeps those two orders distinct so a
rectangular solid cannot be serialized as a crossed bow-tie. The writer test
round-trips the converter output and checks the four named parser points.

## Automated evidence

- Writer tests cover LINE, CIRCLE/ARC/ELLIPSE, TEXT, POINT, SOLID, native
  DIMENSION, BLOCK/INSERT, external IMAGE, and v700 embedded IMAGE records.
- The generated corpus covers seven v600 and eight v700 fixtures and requires
  parser-clean drawing and document semantic equality.
- The focused SOLID regression converts a rectangular `CDataSolid` through
  Gateway JSON, writes it, reparses it, and verifies point 1, point 4, point 2,
  and point 3 in binary boundary order.

## Jw_cad 10.02.1 evidence

All files below are isolated under `.work` and are not package fixtures.

Gateway wrote this v700 file with one drawing record for each supported family:

```text
.work/e2e-jww/v700-all-supported-current-writer-solidfix-20260830.jww
```

It is 17,624 bytes and reparses cleanly with LINE, CIRCLE, ARC, TEXT, POINT,
SOLID, DIMENSION, INSERT, and IMAGE counts of one each, plus one four-LINE block
definition and one 70-byte embedded 2x2 bitmap. Jw_cad opened it and displayed
the SOLID as a rectangle, the BLOCK reference as a rectangle, and the embedded
bitmap as its four-color square.

Jw_cad then added one POINT and saved a separate copy:

```text
.work/e2e-jww/v700-all-supported-current-writer-solidfix-jwcad-edit-20260830.jww
```

The 20,730-byte result reparses cleanly. Jw_cad normalized calculated or
container details: text and dimension extent endpoints, block number 7 to 0,
the 2x2 bitmap display ratio from 40x20 to 40x40, and the embedded BMP payload
to gzip. Gunzip of the 49-byte stored payload is byte-identical to the original
70-byte bitmap (SHA-256
`652cfca51926089da0818c3b62d5b1886b526a2c4ad42ed2e61c09a72e304fe8`).
The block definition and reference remain linked and all nine drawing families
remain present.

Gateway converted that Jw_cad-normalized document and rebuilt it with the same
document as template. The result is 20,730 bytes and byte-identical to the
Jw_cad file (SHA-256
`2683583888e80085d3e23e5e9d7eab1b0423b403a0747643eba48e7e289f1a65`):

```text
.work/e2e-jww/v700-all-supported-jwcad-normalized-gateway-rewrite-20260830.jww
```

Jw_cad reopened that Gateway output. Two ordinary POINT records were added at
the same test coordinate and saved to another isolated copy. The output is
20,804 bytes, reparses cleanly, and its only drawing changes are the two
appended POINT records. Paper, all group scales, layers, color and line-type
settings, BLOCK definition/reference, embedded image payload, IMAGE record,
SOLID, DIMENSION, and the other unchanged entities compare equal. Bounds expand
only because the added point lies below the former minimum Y.

## Scope boundary

This resolves the bounded v700 writer/Jw_cad 10.02.1 reopen-and-edit gate for
the supported entity families. It does not establish version-wide compatibility
for independently authored v600/v700 drawings or other Jw_cad releases. That
broader evidence remains tracked by `jww-version-conformance`.
