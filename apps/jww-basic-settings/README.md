# JWW Basic Settings

English child app for inspecting and safely editing proven settings stored in a native JWW document.

```powershell
cd "C:\dev\New project\JWW Gateway"
node --no-warnings tools\jww-basic-settings-app.mjs
```

Open `http://127.0.0.1:4178/apps/jww-basic-settings/` and choose a local `.jww` file. The file is parsed locally in the browser and is not uploaded.

The app can edit the native file memo, paper code, current layer group, per-group scale, each group's current layer, the display/edit state of non-current groups and layers, the protection code of every recognized group and layer row, the official screen and print color tables, printer output placement, grid settings, and the five packed native dimension-setting DWORDs through named English controls. The dimension controls cover line/point colors, text type, value precision and unit, endpoint style, value and extension offsets, arrow geometry, text/radius formatting, angle formatting, and dimension-object behaviour. Their meanings and decimal-digit packing come directly from the official `jwdatafmt.txt` layout. Dimension edits rewrite only the documented fields inside the fixed 84-byte dimension region; the first 14 DWORDs, the intervening dummy DWORD, maximum draw-width code, and all bytes outside the region remain unchanged. The signed maximum draw-width code is displayed read-only.

Colors & Line Widths uses the official contiguous 240-byte layout: screen entries `0` (background), `1-8` (line colors), and `9` (gray), followed by the matching ten print entries. Screen widths are limited to `1-16`; print widths to `1-500`; print point radii to `0.1-10`. Color edits are enabled only when this complete source span is verified, and Save As replaces only that span. The former heuristic screen entry `10` was an off-by-one read of print-background bytes and is not exposed. Candidate operation colors remain read-only and JWF-only values are not written into JWW.

Grid Settings exposes the documented display/unit/snapping mode, 5–100 dot minimum display spacing, X/Y spacing, and base point. The signed mode is selected only from the documented and representable encodings; undocumented source modes remain read-only. Grid edits replace only the fixed 44-byte mode-and-geometry region immediately after Print Settings.

Print placement edits rewrite only the official fixed 28-byte prefix region. Memo edits rewrite only the official header `CString`; every byte after the original native prefix is retained unchanged and moved to its reparsed position. State labels follow the official JWW 7.02 meanings: `0 Hidden`, `1 Visible only`, `2 Editable`, and `3 Current`. Protection labels are `0 None`, `1 Protected; display state can change`, and `2 Protected; display state fixed`. A current-group change performs the Jw_cad-proven state transition: the previous write group becomes editable (`2`) and a target group in state `0`, `1`, or `2` becomes the write group (`3`). A current-layer change similarly makes the previous write layer editable (`2`) and a selected layer in state `0`, `1`, or `2` the write layer (`3`). Current rows, unrecognized source states/protection values, and display-fixed protection code `2` rows cannot receive a direct state edit. Jw_cad 10.02.1 displayed Gateway-written protection `1` as `/` and `2` as `X`, enforced their documented display-state behavior, loaded and resaved current rows carrying codes `1` and `2`, and retained the protection code while demoting a protected current row to editable state (`2`) when the current selection moved away. A protected non-current row cannot become current. `Save As JWW` runs Gateway preflight before creating a download and never overwrites the source file. The settings projection does not copy the original JWW bytes into UI state.

All other fields remain read-only. Values that belong only to a JWF environment profile are labelled `Not stored in JWW` and are never detected or applied automatically.
