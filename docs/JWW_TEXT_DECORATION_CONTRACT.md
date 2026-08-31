# JWW text decoration contract

## Gateway responsibility

JWW text control strings have two distinct representations:

- `rawText` / native `raw_content`: the original JWW control string used for
  binary Save, such as `P^bL`;
- `text`: the normalized display string, such as `PL`.

Gateway parsing also exposes `jwwSpecialRuns` and `jwwTextSegments`. These
identify overlay, half-overlay, superscript, subscript, and other recognized
control spans without making the normalized string the document source of
truth.

The following preservation paths are tested:

1. JWW parser to Gateway JSON retains raw, normalized, run, and segment data.
2. Gateway JSON to JWW writer chooses `rawText` when present, so control strings
   survive conversion and reparse.
3. Native JWW structural rebuild preserves an untouched record's `raw_content`
   while other drawing records are created.
4. Diagnostics count and sample special runs and decorated segments.

## Downstream responsibility

Gateway is not a drawing renderer. Exact glyph placement and visual overprint
for the exported runs and segments must be implemented and verified in the
downstream renderer. That visual task does not change the Gateway binary or
metadata contract and is not a Gateway parser/writer open item.
