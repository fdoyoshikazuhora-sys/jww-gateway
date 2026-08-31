# JWW round-trip corpus

Run `npm run roundtrip:corpus` to generate isolated v600/v700 fixtures and
semantic reports under `.work/roundtrip-corpus`.

Covered families:

- line
- arc, circle, and ellipse
- text and point marker
- solid
- native `CDataSunpou` dimension
- native `CDataBlock` plus `CDataList` definition
- external image reference for v600/v700
- embedded image payload for v700

The generated fixtures are implementation-owned and contain no redistributed
Jw_cad sample drawings. A fixture passes only when parsing is clean and both
drawing and document semantic round trips are compatible.
