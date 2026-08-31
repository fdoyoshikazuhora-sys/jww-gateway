# JWW native API

Use the `jww-gateway/native` package export when JWW remains the authoritative
document format:

```js
import {
  openNativeJww,
  preflightNativeJwwSave,
  saveNativeJww,
} from "jww-gateway/native";

const document = await openNativeJww(bytes, { encoding: "shift_jis" });
const untouched = saveNativeJww(document); // byte-identical original bytes
```

`openNativeJww()` returns a `kind: "jww-native"` document with the original
bytes and SHA-256, version and header, layer groups, stable native entity IDs,
block definitions, embedded images, settings, preserved byte regions, and
parser diagnostics. Parsed drawing and block records include their original
class name and source/payload byte spans. MFC `CArchive` PID/class tracking is
shared by the drawing list, block-definition list, and nested block lists.
Embedded image records also expose their name/header/payload source span.
Truncated image names, size fields, and payloads make diagnostics non-clean and
are retained only by byte-identical save or a source-spanned drawing-record
splice; a full rebuild is rejected before writing.
Existing records use section and serialized-list position for their stable ID;
the mutable record payload is not part of the ID. A same-class record-splice
therefore keeps the target ID after save and reopen, including when the payload
length changes. JWW has no persistent per-record UUID, so create/delete rebuilds
may renumber records that move to a different serialized-list position.

Fixed prefix metadata also has stable patch targets: `header.id` is
`jww:header`, and each layer group has `id: jww:layer-group:<index>`. A
`replace` patch may change `header.paperSize`, `header.writeLayerGroup`, a
layer group's `scale`, its `write_layer`, group/layer state codes, or group/layer
protection codes together with the required current-row invariants. Official
JWW 7.02 state codes are `0` hidden, `1` visible only, `2` editable, and `3`
current. Direct state edits accept only `0..2` on non-current rows; current rows
remain `3`, and protection code `2` (display state fixed) rejects the edit.
Protection edits accept only `0` (none), `1` (protected; display state can
change), and `2` (protected; display state fixed), including on the current
group and each group's current layer. Jw_cad 10.02.1 displayed Gateway-written
code `1` as `/`, code `2` as `X`, enforced their documented display-state
behavior, loaded and resaved current rows carrying codes `1` and `2`, and
retained the protection code when the current selection moved to an unprotected
row.
Changing
`writeLayerGroup` sets the previous write group state from `3` to `2` and the
selected group state from `0`, `1`, or `2` to `3`. Changing `write_layer` sets the
previous write layer state from `3` to `2` and the selected layer state from
`0`, `1`, or `2` to `3`. Other source states are rejected before writing.
These fields use a fixed-length `prefix-splice`; entity, block, embedded-image,
unknown, and trailing byte regions remain unchanged. A protected non-current
group/layer cannot become the current row, matching Jw_cad 10.02.1; moving away
from a protected current row demotes it to state `2` and retains its protection.
Header version/memo and other layer-group fields return
`JWW_NATIVE_METADATA_STRUCTURE_CHANGE_UNSUPPORTED` instead of being silently
rebuilt. The `state: 0` transition was verified by selecting a hidden group in
Jw_cad 10.02.1, saving under a new name, and reparsing the result.

Current-layer transitions were verified separately with public Jw_cad 6.20
sample drawings. Jw_cad changed a hidden (`state: 0`) target layer to `3` and
the previous layer from `3` to `2` on Save As. For a `state: 1` target, Gateway
changed only the group `write_layer`, target state, and previous state bytes;
Jw_cad 10.02.1 opened that exact output as `[0-0]`, saved it under a new name,
and Gateway reparsed the result with the target at `3`, the previous layer at
`2`, and clean diagnostics.

The native document is the save authority. A renderer may derive a view scene,
but that scene must not replace the native records. `saveNativeJww()` returns
the original bytes when there are no patches. An edited save accepts explicit
create, replace, and delete patches. Same-class replacements use a
`record-splice` strategy: only the target payload bytes are replaced, while the
original class header and every untouched byte—including blocks, embedded
images, and unsupported suffixes—remain unchanged. Clean documents may use a
full `rebuild` for create/delete operations. A document with parser loss rejects
operations that cannot be proven byte-preserving.

For circle, arc, ellipse, and ellipse-arc rendering, import
`buildJwwArcGeometry()` or `jwwEllipsePoint()` from `jww-gateway/geometry`.
The returned view geometry keeps JWW parameter start/sweep, flatness, and tilt
separate from legacy circular facade angles and includes exact start/end points
and partial-arc bounds. It is derived display geometry only; edits and saves
must still target the native `CDataEnko` record fields. See
`docs/JWW_ELLIPSE_ARC_EVIDENCE.md` for the formula and Jw_cad 10.02.1 evidence.

Every successful edited save returns a rebased `document` whose
`originalBytes` and `originalSha256` describe the saved output, whose record
source spans were recalculated by parsing that output, and whose `dirty` value
is `false`. Its revision retains the applied edit revision. Reuse this returned
document as the base for a later edit/save; otherwise a later source-splice can
start from stale bytes or stale offsets. The save result keeps
`originalSha256` as the input baseline hash and adds `savedSha256` for the
output baseline. Parser encoding and source/text context are retained in the
document's small `parseOptions` object so reparsing does not change resolved
text semantics.

`applyNativeJwwPatches()` retains pending same-class record replacements and
prefix-metadata targets on the dirty document. A later `saveNativeJww()` call
without resupplying those patches can therefore still select `record-splice`
or `prefix-splice`. Parser-loss documents may use this path without forcing a
full rebuild or dropping unsupported bytes.

Save results also report native ID transitions. `recordIdMap` contains only IDs
that changed between the edited in-memory document and the reparsed saved
document; an absent key means the ID stayed unchanged. It covers drawing
records, block definitions, nested block records, and embedded-image payload
records. A requested create ID therefore maps to its saved source-position ID,
and surviving records shifted by a delete are mapped to their new serialized
positions. `deletedRecordIds` lists removed source IDs and
`recordIdsChanged` indicates whether either collection is non-empty. Reproject
from the returned document or apply this transition before issuing another
patch. A create patch that reuses an existing source ID is rejected during
preflight. The same transition is returned whether patches are passed directly
to `saveNativeJww()` or first applied with `applyNativeJwwPatches()` and the
resulting dirty document is saved; dirty documents retain only the pending
created/deleted ID lists, replacement targets, prefix-metadata targets, and
rebuild requirement needed for that calculation.

Clean-document rebuilds also accept `replace` patches for existing nested block
records, block-definition metadata, and v700 embedded-image payload records.
Nested record count/order remains a structural boundary for whole-definition
`replace`. Block-definition numbers and embedded-image names are reference
boundaries: they cannot be changed by an isolated `replace`, but may be changed
when every affected reference is explicitly replaced in the same transaction,
as described below. New block definitions and embedded payloads use `create`
with the sections
`block-definitions` and `embedded-images`; both require a stable `targetId`.
Existing block definitions and embedded payloads can be deleted by ID. A block
definition cannot be deleted while any final drawing or nested INSERT still
references its number, and an embedded payload cannot be deleted while a final
`%temp%` IMAGE still references its name. References may be created or deleted
in the same patch transaction because integrity is checked against the final
document. Duplicate block numbers, duplicate normalized image names, missing
references, and references still in use return
`JWW_NATIVE_METADATA_REFERENCE_CONFLICT`,
`JWW_NATIVE_METADATA_REFERENCE_MISSING`, or
`JWW_NATIVE_METADATA_REFERENCE_IN_USE`.

Nested block records use `create` with `section: "block-records"`, a stable
`targetId`, and the containing block definition's stable `parentId`. An optional
zero-based `index` selects the insertion position; omission appends to the final
nested list. Delete targets the nested record ID directly, and an optional
`parentId` is checked when supplied. Missing parents, out-of-range indexes, and
parent mismatches return `JWW_NATIVE_METADATA_PATCH_INVALID` before bytes are
written. The save result maps created and shifted nested IDs to their reparsed
source-position IDs. Whole-definition `replace` still cannot change nested
record count/order; structural edits must use these explicit record patches.
Block-definition numbers and embedded-image names may change through `replace`
only when every affected INSERT or `%temp%` IMAGE is also explicitly replaced in
the same patch transaction. Gateway does not silently rewrite references. The
final graph must contain no reference to the old key, every new reference must
resolve, and final block numbers and normalized embedded-image names must be
unique. Otherwise preflight returns `JWW_NATIVE_METADATA_REFERENCE_IN_USE`,
`JWW_NATIVE_METADATA_REFERENCE_MISSING`, or
`JWW_NATIVE_METADATA_REFERENCE_CONFLICT` before bytes are written. An old key
cannot be reused in the same rename transaction. Embedded payloads must provide
complete bytes and a matching declared size. Parser-loss documents still reject
all rebuild-only metadata operations.

When a block definition contains an IMAGE whose file name matches a v700
embedded payload, the writer emits the `%temp%` reference form inside the block
as well as in the drawing list. This follows Jw_cad's documented v7 history for
embedded images in block figures; the payload and reference remain separate
native records.

Call `preflightNativeJwwSave(document, { patches })` before opening a Save As
picker. It never writes bytes and returns `ok`, `strategy`, `code`, `reasons`,
and `willWriteBytes`. When `ok` is false, do not create the destination file.
`saveNativeJww()` enforces the same result and attaches it as `error.preflight`
when it throws. This prevents a picker-created zero-byte file from being left
behind after a rejected save.

Full native rebuilds always enforce loss-prevention checks. Passing
`strict: false` cannot enable a lossy native save: preflight returns
`JWW_NATIVE_STRICT_SAVE_REQUIRED`. Invalid target IDs return
`JWW_NATIVE_PATCH_INVALID`, and records that the writer cannot represent return
`JWW_NATIVE_UNSUPPORTED_CHANGE`, all with `willWriteBytes: false` before a Save
As picker is opened.

When an IMAGE reference names an entry in `embeddedImages`, the writer emits
the Jw_cad embedded-image form (`^@BM%temp%...`) while preserving the image
reference endpoint and the CDataMoji width, height, spacing, font, and suffix.
Jw_cad 10.02.1 save evidence establishes that bitmap rotation uses the fourth
transform value after the reference width and height, while the containing
CDataMoji stores the same degree angle and rotates its endpoint vector by the
same delta. See `JWW_IMAGE_ROTATION_EVIDENCE.md`.

Use `createNativeJwwImageRotationPatch(document, targetId, degrees)` to create
an internally consistent replacement. Before opening a Save As picker, call
`preflightNativeJwwSave(document, { patches, allowImageRotation: true })`.
Without that explicit permission, a rotation edit returns
`JWW_NATIVE_IMAGE_ROTATION_PERMISSION_REQUIRED` and `willWriteBytes: false`.
Even with permission, preflight returns `JWW_NATIVE_IMAGE_ROTATION_INVALID`
unless the `^@BM` rotation, CDataMoji angle, and endpoint angle agree. Pass the
same `allowImageRotation: true` option to `saveNativeJww()`. Existing rotated
records that were not edited are preserved during unrelated rebuilds without
being treated as newly authorized edits. Direct writer callers use the same
`allowImageRotation: true` option; `setJwwImageReferenceRotation()` changes only
the proven rotation field and preserves crop/fit, RGB, and trailing suffix
values. Embedded payload names ending in `.bmp.gz` resolve to the corresponding
`^@BM...bmp` reference identity, matching the controlled Jw_cad 10.02.1 save.

Drawing, block-definition, and nested block lists use MFC `CArchive` collection
counts. Counts through 65,534 use one WORD; larger lists use `0xFFFF` followed
by a DWORD. Native open indexes parser records once and patch application
structurally shares untouched records, so a single-record edit does not scan or
deep-copy the complete document for every record.

External JWF files are outside this API. Opening a JWW neither searches for nor
applies `jw_win.JWF`; settings stored inside the JWW remain authoritative.
