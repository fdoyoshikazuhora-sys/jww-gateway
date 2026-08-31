# Tilted ellipse and ellipse-arc evidence

## Contract

Jw_cad's published `CDataEnko::Serialize` order is center, radius, start
parameter, sweep parameter, tilt, flatness, and the full-circle flag. Gateway
keeps those source values unchanged. See the official
[JWW data format](https://www.jwcad.net/jwdatafmt.txt).

For rendering, hit testing, and bounds only, `jww-gateway/geometry` exports
`buildJwwArcGeometry()` and `jwwEllipsePoint()`. The point at JWW parameter
`t` is calculated by applying flatness on the local Y axis before rotating:

```text
localX = radius * cos(t)
localY = radius * flatness * sin(t)
x = centerX + localX * cos(tilt) - localY * sin(tilt)
y = centerY + localX * sin(tilt) + localY * cos(tilt)
```

The result explicitly separates `parameterStart` / `parameterSweep` from the
legacy circular projection angles and exposes `kind`, start/end points, major
and minor radii, tilt, and exact partial-arc bounds. The derived geometry is
not a save authority; the native JWW record remains authoritative.

## Automated evidence

- Focused geometry cases cover a tilted circle arc, a tilted partial ellipse,
  a full tilted ellipse, a signed sweep, explicit projection metadata, and
  exact bounds.
- The generated v600/v700 `arc-circle-ellipse` corpus case contains both a
  full tilted ellipse and a partial tilted ellipse. All 15 corpus fixtures pass
  parser-clean document semantic round trip.
- Writer/parser round trip preserves radius `8`, start `0.25`, sweep `1.5`,
  tilt `0.4`, flatness `0.5`, and `is_full_circle: false` for the partial
  ellipse.

## Jw_cad 10.02.1 evidence

Input (generated, not committed):

```text
.work/native-jww-open/roundtrip-corpus-ellipse-20260830/v700-arc-circle-ellipse.jww
```

Jw_cad opened and displayed four separate records: a circle arc, a circle, a
full tilted ellipse, and a tilted partial ellipse. It then saved a separate
output without overwriting the input:

```text
.work/e2e-jww/v700-tilted-partial-ellipse-jwcad-resave-20260830.jww
```

The output is 19,410 bytes, reparses cleanly as v700, and retains all four
drawing records. Gateway semantic diff reports drawing semantic equality,
document metadata equality, parser-clean output, unchanged order, and zero
changed drawing positions. Direct parser comparison also retains all seven
`CDataEnko` geometry fields exactly for the partial ellipse. Jw_cad adds its
normal internal sentinel setting records on Save As, so raw entity-list count
changes from 4 to 10 while converted drawing count remains 4.

This closes the Gateway geometry/projection uncertainty for the tested
parameter model and Jw_cad 10.02.1. It does not replace the separate version-
wide conformance requirement for independently authored drawings, and a
downstream renderer must consume the explicit geometry contract to gain the
fix.
