# JWW Gateway Specification

Last updated: 2026-08-27

## 目的

JWW Gateway は、Jw_cad の `.jww` ファイルを解析し、JWW Gateway JSONとの間で変換するための読み込み・診断・限定書き出しレイヤーです。

主目的は次の4つです。

- JWW 図面をアプリへ読み込む
- JWW 固有情報をできるだけ保持して、表示・印刷・診断に渡す
- 読み込み結果の問題点を単体コマンドとアプリ内診断で確認できるようにする
- 対応エンティティを内部バージョン600/700のJWWへ厳格に書き戻す

## 構成

| ファイル                    | 役割                                                 |
| --------------------------- | ---------------------------------------------------- |
| `src/jww/parser.js`         | JWW バイナリを解析する中心パーサー                   |
| `src/jww/decoder.js`        | Shift_JIS 等の文字列変換、JWW 特殊文字の解釈         |
| `src/jww/shared.js`         | 用紙名、線色、線種、縮尺、JWW レイヤ名などの共有処理 |
| `src/jww/arcDiagnostics.js` | 弧・楕円の変換診断                                   |
| `src/jww/writer.js`         | v600/v700限定JWW writer                              |
| `src/jww/semanticDiff.js`   | 図面意味・文書メタ・内部設定の正規化差分             |
| `tools/jww-gateway.mjs`     | パーサー結果をJWW Gateway JSONへ変換するCLI        |
| `tools/jww-diagnostics.mjs` | JWW 読み込み結果を診断する CLI                       |
| `tools/jww-roundtrip-corpus.mjs` | エンティティ種別ごとのv600/v700往復検証       |

## 対応入力

| 項目         | 現状                                         |
| ------------ | -------------------------------------------- |
| 拡張子       | `.jww`                                       |
| 文字コード   | `shift_jis`, `utf-8`, `utf-16le`, `utf-16be` |
| 主な想定     | JWW内部バージョン600/700                     |
| 読み込み方向 | JWW からJWW Gateway JSON                  |
| 書き出し方向 | JWW Gateway JSONからv600/v700（対応型限定）   |

単体CLIでは `--encoding` で読み込み文字コードを指定します。ブラウザのローカル保存、ファイル名ごとのプリセット、`Open JWW` ダイアログは元アプリ側のUI機能であり、この配布フォルダには含めません。

## 変換対象エンティティ

| JWW要素        | アプリ内型      | 備考                                       |
| -------------- | --------------- | ------------------------------------------ |
| 線             | `LINE`          | 始点・終点、レイヤ、線色、線種、線幅を保持 |
| 円             | `CIRCLE`        | 中心、半径を保持                           |
| 弧             | `ARC`           | JWW角度、変換後角度、傾き、扁平率を保持    |
| 点             | `POINT`         | 位置を保持                                 |
| ソリッド       | `SOLID`         | 4頂点を保持                                |
| 文字           | `TEXT`          | 変換済み文字、元文字、特殊文字メタを保持   |
| 寸法           | `DIMENSION`    | `CDataSunpou` の線・文字・補助線・4点を保持 |
| ブロック参照   | `INSERT`       | `CDataBlock` と変換属性を保持               |
| ブロック定義   | 文書メタ       | `CDataList` と内包エンティティを保持         |
| 画像参照       | `IMAGE`        | `^@BM` 参照名・幅・高さを保持                |
| v700埋込画像   | 文書メタ       | 名前・宣言サイズ・バイナリ本体を保持         |

未対応クラスは `diagnostics.unsupportedClasses` に件数を記録します。

## JWW固有メタデータ

読み込み結果には、アプリ側で再利用するために以下を保持します。

| メタ                        | 内容                                        |
| --------------------------- | ------------------------------------------- |
| `meta.paperSize`            | JWW用紙コードまたは図形範囲から推定した用紙 |
| `groupScaleState`           | レイヤグループごとの縮尺ラベル              |
| `meta.colorSettings`        | JWWファイル内の基本線色、背景色、線幅       |
| `meta.colorDiagnostics`     | 未解決線色番号                              |
| `meta.diagnostics`          | 未対応クラス、スキップ数                    |
| `meta.arcDiagnostics`       | 弧・円・楕円系の変換確認情報                |
| `meta.jwwInternalSettings`  | Jw_cad内部の印刷・表示設定文字列            |
| `meta.jwwBlockDefinitions`  | ネイティブブロック定義と内包エンティティ     |
| `meta.jwwEmbeddedImages`    | v700埋込画像名・サイズ・バイナリ本体          |

## 仕様根拠

- Jw_cad公式データ形式: https://www.jwcad.net/jwdatafmt.txt
- Jw_cad公式バージョン履歴: https://www.jwcad.net/download/versioninfo.htm

公式データ形式に記載された主エンティティリスト、ブロック定義リスト、v700画像リスト、`CDataSunpou`、`CDataBlock`、`CDataList` の直列化順を実装根拠とします。未確認フィールドは新しい意味へ推測変換せず、raw値または未対応診断として保持します。

Jw_cad 10.02.1での再保存時に確認した6種類の内部設定文字列は、開始・終了座標がともに`(0, -1000)`で、既知のキー名と数値代入形式が一致する場合だけ図形`TEXT`から分離します。元の文字列、値、座標、文字属性、レイヤ属性は`meta.jwwInternalSettings.records`へ保持します。同じ文字列が通常の図面座標にある場合や未確認のキーは、表示対象の`TEXT`として残します。

## 色の扱い

JWW はファイルごとに基本線色が変わるため、読み込み時に JWW 内の色テーブルを毎回読み取ります。

現在の動作:

- JWW 基本線色 1-10 を読み取る
- JWW 印刷色候補 1-10 を読み取り、診断に表示する
- 色テーブル候補のオフセットとスコアを診断に表示する
- JWW 背景色を読み取る
- 直接RGB指定色を保持する
- SXF系線色番号を既知の色へ解決する
- 暗い背景で暗い線色が見えない場合、表示用 `renderStroke` は白寄りに補正する
- 元のJWW色は `entity.jwwColor` に保持する
- JWW読み込み時、JWW基本線色をアプリの `Basic Settings > DXF Line` に反映する

注意:

- 表示用補正と元色は分離しています。
- 印刷時にどちらを使うかは印刷処理側の仕様で決めます。
- 印刷色候補は診断・確認用として保持します。実ファイルで確度を確認するまでは、印刷設定へ自動適用しません。

## 文字の扱い

文字は指定エンコーディングでデコードします。

対応済み:

- Shift_JIS / UTF-8 / UTF-16LE / UTF-16BE の切り替え
- JWW特殊文字の通常文字への変換
- 印刷時埋め込み文字の変換
- 上付き、下付き、重ね描画系コマンドのメタ情報保持
- 装飾範囲を `jwwTextSegments` として通常文字/装飾文字に分割保持
- 未解決文字は診断で検出

責任境界:

- `^o`, `^w`, `^b`, `^B`, `^n` などのraw制御列、`jwwSpecialRuns`、`jwwTextSegments`はGateway JSONとnative rebuild保存で保持します。
- 見た目そのものの重ね描画とJw_cadとの視覚比較は、Gatewayではなく下流rendererの責任です。`JWW_TEXT_DECORATION_CONTRACT.md`を参照してください。

## 弧・楕円の扱い

JWWの弧は、中心、半径、開始角、弧角、傾き、扁平率を持ちます。

現在の動作:

- JWW元角度を保持する
- アプリ描画用角度へ変換する
- 傾きありの弧を診断に出す
- 楕円相当の扁平率を診断に出す
- 代表的な弧を `JWW Arc Diagnostics` に一覧表示する

既知課題:

- 楕円・傾き弧はJWW実装との差が出やすい領域です。
- 修正時は `J Start`, `J Arc`, `J Tilt`, `Flat`, `A Start`, `A End` を比較します。

## 用紙・縮尺

現在の動作:

- JWW用紙コードを読む
- 図形範囲から用紙を推定する
- レイヤグループごとの縮尺を保持する
- 読み込み時は実寸相当の座標を保持し、印刷時に縮尺を使う

注意:

- 読み込み時に `1/100` などで座標を縮小しません。
- 印刷時の縮尺処理に渡せるよう、縮尺ラベルを保持します。

## 診断機能

### 診断レポート内容

`diagnose` CLI では以下を確認できます。

- 読み込みファイル概要
- 読み込みログ
- JWW未対応クラス
- JWW色テーブル、背景色、未解決色番号
- 弧・楕円診断
- 外れ要素候補
- 線種・線幅診断
- グループ/レイヤ情報

外れ要素候補は `--outlier-limit` と `--outlier-distance-min` で調整できます。読み込みログには、読み込み時刻、形式、文字コード、図形数、用紙、縮尺、JWW色数、背景色、未解決色番号、未対応/スキップ数を記録します。

診断JSON/CSV/HTMLには図形本体を含めません。公開後の不具合報告や比較確認では、このレポートを共有することで読み込み状態を追跡できます。

### CLI診断

単体でJWWを確認する場合:

```powershell
npm run diagnose -- "C:\path\to\file.jww"
```

JSONで出力する場合:

```powershell
npm run diagnose -- "C:\path\to\file.jww" --json
```

CSVで出力する場合:

```powershell
npm run diagnose -- "C:\path\to\file.jww" --csv
```

HTMLで出力する場合:

```powershell
npm run diagnose -- "C:\path\to\file.jww" --html -o report.html
```

外れ要素候補だけ確認しやすくする場合は、候補数と最小距離をCLI側でも調整できます。

```powershell
npm run diagnose -- "C:\path\to\file.jww" --json --outlier-limit 40 --outlier-distance-min 500
```

診断JSONを比較する場合:

```powershell
npm run diff -- before.import-diagnostics.json after.import-diagnostics.json --html -o diff.html
npm run diff -- before.import-diagnostics.json after.import-diagnostics.json --scope arcs --html -o arc-diff.html
```

`--scope arcs` を使うと、弧・楕円診断だけを比較できます。実ファイル比較テストでは、JWW調整前後の診断JSONを保存し、この差分HTMLで `J Start`, `J Arc`, `J Tilt`, `Flat`, `A Start`, `A End` の変化だけを確認します。`colors`、`text`、`outliers` も同じ形式で絞り込み可能です。

変換後JSONをスキーマ確認する場合:

```powershell
npm run validate -- output.json
npm run validate -- output.json --json
```

`validate` は `format`、`formatVersion`、`sourceFormat`、`encoding`、`meta`、`bounds`、`entities` の最低限の互換性を確認します。`LINE`、`POINT`、`TEXT`、`CIRCLE`、`ARC`、`SOLID` は代表的な座標・半径・文字値もチェックします。加えて、`meta.colorSettings`、`meta.lineTypeSettings`、`meta.jwwEnvironment.coverage`、`meta.jwwInternalSettings`は最低限の型と色HEX形式を固定し、JWW Gateway単体パッケージの smoke check と `test:jww` で回帰確認します。

元プロジェクト側から単体利用用のJWW Gatewayパッケージを作る場合:

```powershell
npm run jww:package
npm run jww:package:smoke
```

出力先は `..\JWW_Gateway` です。パッケージ内には `tools`、`src/jww`、`package.json`、`README.md` を含み、JWW変換、診断、診断差分のCLIをアプリ本体から切り離して実行できます。
`JWW_GATEWAY_MANIFEST.json` には、対応CLI、対応エンコーディング、出力スキーマ、機能有無、bounded JWW writer、未確定環境キー、配布ファイル一覧を出力します。manifest の形は `docs/jww-gateway-manifest.schema.json` に固定し、生成・検証ルールは `src/jww/gatewayManifest.js` にまとめます。外部アプリはこのmanifestを読めば、JWW Gatewayを接続する前に利用可能機能と制限を確認できます。
`capabilities.valueScanSummary` と `capabilities.promotionCandidateGate` が `true` の場合、複数の value-scan JSON を横断集計し、未抽出の matched 行が残った時に検証を失敗させるゲートを利用できます。
manifest validator は、capability だけでなく必須 `commands` と `binaries` の実体名も確認します。これにより、機能フラグだけ true で CLI が欠けている配布物を検出できます。
`npm run manifest:validate -- JWW_GATEWAY_MANIFEST.json` または単体配布側の `npm run manifest:validate` で manifest の構造を検証できます。`--check-files` を付けると、manifest の `packageFiles` に載っているファイルが実際に存在するかも確認します。
`npm run jww:package:smoke` は元プロジェクト側で生成後の単体パッケージの必須ファイル、package.json、CLI import を確認します。

確認できる項目:

- 用紙サイズ、縮尺、全体Bounds
- 図形数と種類別件数
- JWW基本色、背景色、線幅、未解決色番号、直接RGB
- 未対応JWWクラス、スキップ数
- 弧/楕円の中心・半径・JWW角度・変換後角度
- JWW特殊文字、文字化け候補
- 外れ要素候補

### CLI変換

JWWをアプリ向けJSONへ変換する場合:

```powershell
npm run convert -- "C:\path\to\file.jww" -o output.json
```

変換JSONの基本スキーマは `docs/jww-gateway-json.schema.json` に固定しています。実ファイル変換後は `npm run validate -- output.json` で、アプリ接続前に構造崩れを検知できます。JWW固有メタデータでは、色テーブル、線種テーブル、JWF coverage の最低構造を固定対象に含めます。

JWF相当の環境情報については `docs/JWW_JWF_ENV_AUDIT.md` に、現在読めている項目・部分対応項目・未対応項目を棚卸ししています。

## 公開前チェックリスト

### 必須

- [ ] 代表JWWで読み込みできる
- [ ] JWW基本色がBasic Settingsへ反映される
- [ ] 暗背景ファイルで線色が視認できる
- [ ] 用紙サイズが期待通りに認識される
- [ ] 縮尺が読み込み時に座標縮小されていない
- [ ] 寸法値文字が文字化けしない
- [ ] 外れ要素候補を診断で確認・選択削除できる
- [ ] 外れ要素候補の感度を切り替えて確認できる
- [ ] 未対応クラスが診断に出る
- [ ] 診断結果をHTMLで出力し、ブラウザで確認できる
- [ ] 診断JSONの差分をHTMLで確認できる
- [ ] 弧・楕円診断だけを `--scope arcs` で比較できる
- [ ] 変換JSONを `validate` で検証できる
- [ ] JWF相当の環境情報棚卸しを更新している
- [ ] JWWファイル別読み込みプリセットが保存・再適用できる
- [ ] JWW Gateway単体パッケージを生成できる
- [ ] 生成したJWW Gateway単体パッケージのsmoke checkが通る
- [ ] `npm run test:jww` が通る
- [ ] 元プロジェクト側の `npm run build` が通る

### 公開時に明記する制限

- JWW保存は未対応
- JWW完全互換ビューアではない
- 下流rendererが明示的な楕円弧geometry契約を使用しない場合と、複雑な特殊文字装飾には再現差が残る可能性がある
- JWW仕様は公式に完全公開されていない領域があるため、実ファイルでの検証を前提にする
- 読み込み結果の削除・修正は元JWWファイルへは反映されない

## 今後の改善候補

- 実Jw_cad 6.x環境での編集・再読込証拠、および非privateの実在v600 DIMENSION/BLOCK/IMAGE sample

## Raw Environment Region

Converted JSON exposes `meta.environmentRegion` for JWF/JWW environment research. It is a diagnostic block, not a normalized setting table.
It reports the byte region between the layer/group-name area and the entity list marker, including repeated unsigned-32-bit pair runs and numeric double samples.
Use it to compare real files before mapping additional serialized JWF-like keys such as text presets, hatch presets, and command settings. `LAYCOL_*`, `LAYWID_*`, and `LAYTYP_*` are JWF-only write-layer operation defaults and are not mapping candidates for JWW.

## Environment Region Scan CLI

```powershell
npm run env:scan -- "C:\path\to\file.jww"
npm run env:scan -- "C:\path\to\folder" --recursive --csv -o env-scan.csv
```

This command summarizes `meta.environmentRegion`, color-table offsets, and JWF coverage for one or more JWW files.
Use it before promoting raw candidate bytes to named JWF settings.

## JWF Coverage Compare CLI

```powershell
npm run jwf:compare -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end
npm run jwf:compare -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --html -o jwf-compare.html
npm run jwf:compare -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --scope drawing --status missing --html -o drawing-missing.html
npm run jwf:compare -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --family layerColors,layerLineTypes,layerWidths --status not-serialized --html -o layer-defaults.html
npm run jwf:compare -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --key LTYPE_HC,LCOLLOR_M --html -o core-open.html
```

This command compares Gateway's extracted `meta.jwwEnvironment.coverage` against a JWF file. HTML/CSV output includes a Meaning column from `entry.definition` so missing rows can be triaged by setting purpose.
Reports include both `scopeStatusCounts` and `familyStatusCounts`; use `--scope`, `--family`, `--key`, and `--status` with comma-separated values to focus the report.

## JWF Value Scan CLI

```powershell
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --csv -o value-scan.csv
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --html -o value-scan.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --scope drawing --status missing,ambiguous --html -o drawing-open.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --scope drawing --gateway-status missing --html -o drawing-gateway-missing.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --family layerColors,layerLineTypes,layerWidths --gateway-status not-serialized --html -o layer-defaults-scan.html
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --key LTYPE_HC,LCOLLOR_M --html -o core-open-scan.html
npm run layer-defaults:summary -- layer-a.json layer-b.json --html -o layer-summary.html
npm run layer-defaults:summary -- layer-a.json layer-b.json --fail-on-promotion-candidates
```

This investigation command searches the JWW bytes for exact numeric and color byte patterns derived from JWF entries. It checks color byte rows, RGB triplets, and `u8`, `u16`, `i16`, `u32`, `i32`, and `f64` numeric sequences. JSON/CSV/HTML output includes `testedPatterns`, `gatewayCandidate`, `gatewayCandidateComparison`, `scopeStatusCounts`, and `familyStatusCounts`. Keys proven to be JWF-only report `gatewayStatus: not-serialized` and `comparisonRequired: false`; any incidental byte match for such a key is not a parser candidate.
For historical or controlled `LAYCOL_*`, `LAYWID_*`, and `LAYTYP_*` evidence, write each `layer-defaults:audit --json` result to a file and pass those files to `layer-defaults:summary`. Current audits count these rows as `nonSerialized` and exclude them from promotion candidates.
Use `--html` when reviewing historical ambiguous rows such as all-zero `LAYCOL_*` / `LAYTYP_*`. `--family` narrows the report to JWF families such as `layerColors`, `layerLineTypes`, `layerWidths`, `screenColors`, or `lineTypes`. `gatewayStatus` distinguishes extracted, missing, and non-serialized keys.
Use `value-scan:summary` to summarize multiple value-scan JSON reports by status, family, and key before promoting any candidate into the parser.
The summary also reports `promotionCandidates`: matched rows whose JWF key is not yet extracted by Gateway. Keep this at zero before treating a scan set as stable. Use `--summary --fail-on-promotion-candidates` in verification scripts to write a compact gate report and fail when unreviewed matched rows remain.
`layer-defaults:summary --fail-on-direct-matches` remains available for old audit JSON, but current non-serialized rows are excluded from direct/promotion candidate gates.
In the standalone package, write generated review files under `reports\`, for example `-o reports\full-summary.txt`. The package generator recreates this folder, so persistent evidence should be copied into the source project or a dated backup.
The packaged `reports\README.md` and source `docs/JWW_GATEWAY_REPORTS.md` summarize the expected report types.
Use `npm run verify:report -- -o reports\verify-report.txt`, `npm run verify:report -- --json -o reports\verify-report.json`, `npm run verify:report -- --csv -o reports\verify-report.csv`, or `npm run verify:report -- --html -o reports\verify-report.html` to create a compact handoff report for manifest validity, required files, scripts, binaries, capabilities, and unresolved keys.
Use `npm run open-items -- --html -o reports\open-items.html` to export known limitations and remaining research items recorded in the manifest.
Use `npm run reports:index -- --html -o reports\index.html` to generate a one-page map of the generated handoff artifacts.
Use `npm run verify:report -- --expect-no-unresolved` when the empty unresolved-key set should be enforced during handoff. `LTYPE_HC` and `LCOLLOR_M` are reported separately as JWF-only operation keys.
Use `npm run coverage -- "C:\path\to\file.jww" --scope drawing --status missing --html -o coverage.html` in the standalone package to report extracted and missing JWF-like environment keys for one JWW file.
Use `npm run coverage:summary -- coverage-a.json coverage-b.json --summary` to summarize multiple coverage reports. The summary includes `alwaysMissingDrawing` and splits those drawing gaps into `core`, `layerDefaults`, and `other`. `--fail-on-always-missing-drawing` can be used as a focused gate for drawing-related gaps without failing on document or operation environment settings.
Use `npm run verify:reports` in the standalone package to generate all four handoff report formats at once.
Use `npm run verify:all` to run package verification and generate all four handoff reports in one command.
Use `npm run verify:handoff` to run `verify:all` and then enforce that the unresolved environment-key set remains empty. `LTYPE_HC` and `LCOLLOR_M` are checked separately through `jwfOnlyOperationKeys`.
Use `npm run status` to print a compact readiness summary for the standalone package.
On Windows, `jww-gateway-status.cmd`, `jww-gateway-verify-all.cmd`, `jww-gateway-verify-handoff.cmd`, `jww-gateway-open-items.cmd`, and `jww-gateway-report-index.cmd` provide direct shortcuts from the standalone folder.
`jww-gateway-convert.cmd`, `jww-gateway-coverage.cmd`, and `jww-gateway-diagnose.cmd` provide Windows pass-through shortcuts for common import, coverage, and diagnostic runs.
`jww-gateway-jwf-parse.cmd`, `jww-gateway-jwf-compare.cmd`, `jww-gateway-jwf-value-scan.cmd`, `jww-gateway-layer-defaults-audit.cmd`, and `jww-gateway-layer-defaults-summary.cmd` provide Windows pass-through shortcuts for JWF environment checks.
`jww-gateway-validate.cmd`, `jww-gateway-env-scan.cmd`, `jww-gateway-diff.cmd`, `jww-gateway-verify-report.cmd`, and `jww-gateway-verify-diff.cmd` provide Windows pass-through shortcuts for validation, environment scanning, diagnostics diffing, and handoff report checks.
Use `docs/JWW_GATEWAY_WINDOWS_COMMANDS.md` as the Windows shortcut index.
Use `docs/JWW_GATEWAY_RELEASE_CHECKLIST.md` as the release/handoff procedure.
Use `docs/JWW_GATEWAY_RELEASE_NOTES.md` to review the current package status and known limitations.
The JSON/CSV/HTML reports also include a SHA-256 file inventory for manifest-listed package files, so a received package can be compared against the handoff record.
Use `npm run verify:diff -- <before-report.json> <after-report.json> --html -o reports\verify-diff.html` to compare two handoff reports and list added, removed, and changed package files.
By default, `verify:diff` exits non-zero when differences are found. Add `--allow-differences` when generating a review artifact for expected changes.
`JWW_GATEWAY_MANIFEST.json` also includes a `handoff` object with the short entrypoint file, release checklist path, sample-set example/schema, and the two primary commands: `verify:handoff` and `sample:plan`.
`npm run status` prints the manifest identity, the same handoff entry, and the primary commands so recipients can confirm the entrypoint before running the heavier checks.

Use `npm run sample:plan -- docs\JWW_GATEWAY_SAMPLE_SETS.example.json --html -o reports\sample-plan.html` to turn a local `.jww + .jwf` sample list into a repeatable verification command plan. The sample manifest shape is documented by `docs/jww-gateway-sample-sets.schema.json`, and `sample:plan` reports validation errors separately from missing local files. The plan checks whether the referenced files exist and emits the convert, diagnose, coverage JSON/HTML, JWF compare, value-scan, core-open, special-color, and layer-default audit commands expected for each sample. It also emits aggregate summary commands for coverage, core-open, special-color, and layer-default reports.

## Core Open Summary CLI

```powershell
npm run core:summary -- core-a.json core-b.json --html -o core-summary.html
npm run core:summary -- core-a.json core-b.json --csv -o core-summary.csv
npm run core:summary -- core-a.json core-b.json --summary
npm run core:summary -- core-a.json core-b.json --fail-on-direct-matches
npm run special-color:audit -- "C:\path\to\file.jww" "C:\path\to\file.jwf" --include-after-end --html -o special-colors.html
npm run special-color:summary -- special-a.json special-b.json --html -o special-summary.html
npm run special-color:summary -- special-a.json special-b.json --fail-on-direct-matches
```

This command summarizes multiple historical `--key LTYPE_HC,LCOLLOR_M --json` value-scan reports into one cross-sample table. Key-level totals include missing/matched counts and direct-match true/false counts. These reports supplied the negative evidence later confirmed by controlled Jw_cad Save As tests: both keys are JWF-only operation/display settings and are not serialized into JWW.
Use `special-color:audit` when investigating `LCOLLOR_M`; it scans RGB triplets near the detected JWW color table and ranks nearby candidates by distance from the JWF M color. `special-color:summary` groups those audit JSON files by relative offset and candidate color so repeated near-matches can be reviewed separately from direct-match promotion.

Gateway currently extracts the structured line type rows `LTYPE_02..09`, `LTYPE_R1..R5`, and `LTYPE_L1..L4` when a plausible JWW line-type table is found. Public JWF references define `LTYPE_HC` as six operation/display fields. Controlled Jw_cad 10.02.1 single-change Save As tests prove that they are not serialized into JWW. The 24 bytes immediately after `LTYPE_L4` do not track those six fields and are exposed only as the neutral `meta.jwwEnvironment.lineTypes.postLineTypeTailCandidate` diagnostic value.

Print color tables are read from the richer `RGB + width + pointRadius` row format when available. In that case `meta.colorSettings.printColors[n].pointRadius` is included for `PCOLLOR_1..8`.

## Diagnostics Notes

When individual decoded layer names look corrupt, Gateway keeps the valid names and replaces only the suspicious entries with safe defaults. The replacement list is exposed as `meta.layerNameFallbacks`.

The app-side diagnostics also estimate whether the drawing bounds span multiple paper widths. This `sheetSpan` hint is meant to prevent second-sheet content from being mistaken for stray garbage during review.

## Inline UTF-16 Strings

JWW files can contain per-string UTF-16 markers even when the selected import encoding is `shift_jis`.
Gateway handles `FF FE FF` as an inline UTF-16LE marker. This prevents memo or layer-name text from shifting the binary read position.
When a layer-name block still appears to be binary data, Gateway uses safe default layer names and exposes `meta.layerNamesExtracted: false`.
