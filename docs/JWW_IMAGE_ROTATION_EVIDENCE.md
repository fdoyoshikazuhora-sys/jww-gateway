# JWW IMAGE rotation evidence

## Scope

This note records the binary evidence used by JWW Gateway to permit IMAGE
rotation writes. It does not infer IMAGE rotation from CDataMoji angle alone.

## Specification boundary

The official `jwdatafmt.txt` describes an IMAGE as a `CDataMoji` record whose
`^@BM` string contains the reference file name, drawing dimensions, trimming,
and related values. The same document defines the serialized CDataMoji start,
end, text size, spacing, `m_degKakudo`, font, and string fields. It does not
name the individual comma-separated `^@BM` transform fields. The implementation
therefore relies on a controlled Jw_cad save for the field-level meaning rather
than assigning an undocumented meaning by guesswork.

Official sources:

- https://www.jwcad.net/jwdatafmt.txt
- https://www.jwcad.net/download/versioninfo.htm

## Controlled Jw_cad 10.02.1 result

A Gateway-generated v700 file containing one embedded IMAGE was opened in
Jw_cad 10.02.1. The IMAGE was rotated 90 degrees with Jw_cad's move/rotation UI
and saved under a new name. The saved evidence file was 44,430 bytes with
SHA-256 `d8c9c56201faf875b18af40a007983d3748b9ef7380feca7dc8651dca180d636`.
Gateway reparsed it without unsupported or skipped records.

The resulting IMAGE record contained all three matching values:

| Binary-facing field | Observed 90-degree value |
| --- | --- |
| `^@BM` transform suffix | `0,0,1,90,255,255,255` |
| CDataMoji `angle` | `90` degrees |
| CDataMoji endpoint vector | rotated from horizontal to vertical by 90 degrees |

The complete reference text ended with
`,100,73.1454,0,0,1,90,255,255,255`. Earlier Gateway trials that changed only
CDataMoji angle and endpoint left the bitmap unrotated in Jw_cad. The controlled
Jw_cad save therefore proves that the fourth transform value after the image
width and height is the bitmap rotation angle in degrees, and that a native edit
must keep it consistent with the CDataMoji angle and endpoint.

The text reference used the name `...bmp`, while the embedded-image list stored
the same payload as `...bmp.gz` (24,649 bytes). Jw_cad reopened that save, so the
native reference resolver treats a terminal `.gz` on an embedded bitmap payload
as a storage suffix rather than as part of the `^@BM` reference identity.

## Gateway write verification

Gateway used the controlled 90-degree save as the source for explicit native
rotation patches to 0 and 180 degrees. Both saves used the record-splice path,
preserved the bytes after the IMAGE record exactly after accounting for the
changed string length, and reparsed with zero unsupported and zero skipped
records.

| Rotation | Output bytes | SHA-256 | Jw_cad 10.02.1 reload |
| --- | ---: | --- | --- |
| 0 degrees | 44,428 | `545948df52a9121ad44e7b1ce83a4f0772ea7fca43cd8771d48d95fa0fcd4cf8` | opened under the exact output file name |
| 180 degrees | 44,432 | `c0e8736f0db0221a1bb5816a3856e2ee612f3a46d1b36d98bfbf97ce3ed9e58d` | opened under the exact output file name |

The reload check used the Windows `.jww` file association, which supplies the
quoted absolute path to `C:\jww\Jw_win.exe`. Direct process-launch trials were
not used as compatibility evidence because path quoting and concurrent Jw_cad
startup can delay creation of the document window.

## Write contract

- Untouched documents remain byte-identical.
- Existing rotated IMAGE records survive unrelated rebuilds unchanged.
- A rotation edit must be represented in the `^@BM` rotation field,
  CDataMoji angle, and endpoint vector.
- `createNativeJwwImageRotationPatch()` produces those three changes together.
- Native preflight requires `allowImageRotation: true` before reporting that
  bytes may be written.
- Missing permission returns
  `JWW_NATIVE_IMAGE_ROTATION_PERMISSION_REQUIRED` before file creation.
- Inconsistent or unparseable rotation records return
  `JWW_NATIVE_IMAGE_ROTATION_INVALID` before file creation.
- Crop/fit values, optional RGB transparency values, and later suffix fields are
  preserved verbatim except for the rotation number itself.
