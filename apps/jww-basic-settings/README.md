# JWW Basic Settings

Read-only English child app for inspecting settings stored in a native JWW document.

```powershell
cd "C:\dev\New project\JWW Gateway\apps\jww-basic-settings"
npm start
```

Open `http://127.0.0.1:4178/apps/jww-basic-settings/` and choose a local `.jww` file. The file is parsed locally in the browser and is not uploaded.

The app deliberately has no Apply or Save action. It displays a render-only settings projection and does not keep the original JWW bytes in UI state. Values that belong only to a JWF environment profile are labelled `Not stored in JWW`.
