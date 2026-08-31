# JWW Basic Settings

English child app for inspecting and safely editing proven settings stored in a native JWW document.

```powershell
cd "C:\dev\New project\JWW Gateway\apps\jww-basic-settings"
npm start
```

Open `http://127.0.0.1:4178/apps/jww-basic-settings/` and choose a local `.jww` file. The file is parsed locally in the browser and is not uploaded.

The app can edit only the native paper code, current layer group, per-group scale, and each group's current layer. A current-group change performs the Jw_cad-proven state transition: the previous write group becomes editable (`2`) and a target group in state `0`, `1`, or `2` becomes the write group (`3`). A current-layer change similarly makes the previous write layer editable (`2`) and the selected layer the write layer (`3`). Protected groups and layers are rejected by preflight. `Save As JWW` runs Gateway preflight before creating a download and never overwrites the source file. The settings projection does not copy the original JWW bytes into UI state.

All other fields remain read-only. Values that belong only to a JWF environment profile are labelled `Not stored in JWW` and are never detected or applied automatically.
