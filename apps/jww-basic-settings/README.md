# JWW Basic Settings

English child app for inspecting and safely editing proven settings stored in a native JWW document.

```powershell
cd "C:\dev\New project\JWW Gateway\apps\jww-basic-settings"
npm start
```

Open `http://127.0.0.1:4178/apps/jww-basic-settings/` and choose a local `.jww` file. The file is parsed locally in the browser and is not uploaded.

The app can edit the native paper code, current layer group, per-group scale, each group's current layer, the display/edit state of non-current groups and layers, and the protection code of every recognized group and layer row. State labels follow the official JWW 7.02 meanings: `0 Hidden`, `1 Visible only`, `2 Editable`, and `3 Current`. Protection labels are `0 None`, `1 Protected; display state can change`, and `2 Protected; display state fixed`. A current-group change performs the Jw_cad-proven state transition: the previous write group becomes editable (`2`) and a target group in state `0`, `1`, or `2` becomes the write group (`3`). A current-layer change similarly makes the previous write layer editable (`2`) and a selected layer in state `0`, `1`, or `2` the write layer (`3`). Current rows, unrecognized source states/protection values, and display-fixed protection code `2` rows cannot receive a direct state edit. Jw_cad 10.02.1 displayed Gateway-written protection `1` as `/` and `2` as `X`, enforced their documented display-state behavior, loaded and resaved current rows carrying codes `1` and `2`, and retained the protection code while demoting a protected current row to editable state (`2`) when the current selection moved away. A protected non-current row cannot become current. `Save As JWW` runs Gateway preflight before creating a download and never overwrites the source file. The settings projection does not copy the original JWW bytes into UI state.

All other fields remain read-only. Values that belong only to a JWF environment profile are labelled `Not stored in JWW` and are never detected or applied automatically.
