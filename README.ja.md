# JWW Gateway

JWW Gateway は、JWW読み込み・変換・診断・意味差分・v600/v700限定書き出し用の単体CLIです。

Jw_cad `.jww` ファイルを読み込み、JWW Gateway JSONへ変換し、診断レポートを出力します。明示的なwriter CLIから内部バージョン600/700を書き出せますが、未対応エンティティ型は既定でエラーにします。

このフォルダは、コマンドラインから JWW ファイルを変換・診断するための配布用フォルダです。画面付きのCADアプリ本体ではありません。

## 使い方の流れ

JWW Gateway は、常駐サーバーや画面アプリへ直接接続するツールではありません。PowerShell などからコマンドを実行し、生成されたJSONファイルや診断レポートを他のツールへ渡して使います。

1. `JWW_Gateway` フォルダをPowerShellで開く
2. `npm run status` で配布物が揃っているか確認する
3. `npm run convert -- "C:\path\to\file.jww" -o output.json` でJWWをJSONへ変換する
4. 必要に応じて `npm run diagnose -- "C:\path\to\file.jww" --html -o diagnostics.html` で診断レポートを作る
5. 連携先のツールでは、生成された `output.json` や診断レポートを読み込む

## できること

- JWWファイルの読み込み
- JWW Gateway JSONへの変換
- JWW読み込み結果の診断レポート出力
- `shift_jis`, `utf-8`, `utf-16le`, `utf-16be` の文字コード指定
- 用紙、縮尺、レイヤ、基本線色、線種、文字情報の保持
- JWF比較、値スキャン、未対応項目の棚卸し
- 受け渡し用の検証レポート生成
- JWW Gateway JSONから内部バージョン600/700のJWWを書き出し
- 2つのJWWの図形・文書メタ情報・Jw_cad内部設定を分離した意味差分

書き出しは明示的な `write` コマンドだけが行います。変換・診断・意味差分コマンドは元のJWWファイルを変更しません。未対応型は `--allow-unsupported` を明示しない限り書き出しを拒否します。

## 最初に確認

`JWW_Gateway` フォルダで実行します。

```powershell
npm run status
```

`Ready: yes`、`Missing: files 0, scripts 0, bins 0` が出れば、配布物として必要なファイルは揃っています。

より詳しく確認する場合:

```powershell
npm run verify:handoff
```

## JWWをJSONへ変換

```powershell
npm run convert -- "C:\path\to\file.jww" -o output.json
```

文字コードを明示する場合:

```powershell
npm run convert -- "C:\path\to\file.jww" --encoding shift_jis -o output.json
```

対応している文字コード:

- `shift_jis`
- `utf-8`
- `utf-16le`
- `utf-16be`

単体CLIはブラウザのローカル保存を使いません。同じ条件で再現したい場合は、`--encoding` などのオプションをコマンドに明示してください。

## 診断レポートを出力

JWW読み込み結果だけを確認する場合:

```powershell
npm run diagnose -- "C:\path\to\file.jww"
```

JSON、CSV、HTMLで保存する場合:

```powershell
npm run diagnose -- "C:\path\to\file.jww" --json -o diagnostics.json
npm run diagnose -- "C:\path\to\file.jww" --csv -o diagnostics.csv
npm run diagnose -- "C:\path\to\file.jww" --html -o diagnostics.html
```

診断レポートには、読み込みログ、ファイル概要、未対応クラス、スキップ数、色テーブル、弧/楕円診断、外れ要素候補、線種・線幅診断、グループ/レイヤ情報などを含みます。図形本体を渡す必要がある場合は `convert` のJSONを使います。

外れ要素候補の数や最小距離を調整する場合:

```powershell
npm run diagnose -- "C:\path\to\file.jww" --json --outlier-limit 40 --outlier-distance-min 500 -o diagnostics.json
```

## JWWを書き出す

```powershell
npm run write -- input.json -o output.jww --version 700
npm run write -- input.json -o output-v600.jww --version 600
npm run write -- input.json -o output.jww --template source.jww
```

現在のwriter契約はv600/v700とテスト済みエンティティに限定されます。既存図面の編集では同じ元JWWを `--template` に指定してください。無関係なテンプレートは異なる文字種テーブルを持つ場合があります。ネイティブの `CDataSunpou` 寸法、`CDataBlock` 参照と `CDataList` 定義、外部画像参照、v700埋込画像ペイロードに対応しています。Jw_cadでの再読込・再保存結果は、parser成功や意味差分とは別に記録します。

エンティティ種別ごとの往復コーパスは次のコマンドで生成・検証します。

```powershell
npm run roundtrip:corpus
```

生成コーパスはv600が7件、v700が8件です。各fixtureでparser clean、図面意味一致、対応文書メタデータ一致をすべて要求します。

## JWWの意味差分を確認

`drawingRoundTripCompatible` は図面一致とparser clean、`roundTripCompatible` はさらに文書メタ情報一致を要求します。Jw_cad内部設定差は別項目に分離します。

```powershell
npm run semantic:diff -- before.jww after.jww
npm run semantic:diff -- before.jww after.jww --json --fail-on-drawing-difference
```

## 変換JSONを検証

```powershell
npm run validate -- output.json
npm run validate -- output.json --json
```

変換JSONの最低構造は [docs/jww-gateway-json.schema.json](docs/jww-gateway-json.schema.json) で定義しています。

## Windows用ショートカット

Windowsでは、フォルダ直下の `.cmd` からも実行できます。

```powershell
.\jww-gateway-status.cmd
.\jww-gateway-convert.cmd "C:\path\to\file.jww" -o output.json
.\jww-gateway-diagnose.cmd "C:\path\to\file.jww" --html -o diagnostics.html
.\jww-gateway-write.cmd input.json -o output.jww --version 700
.\jww-gateway-semantic-diff.cmd before.jww after.jww
.\jww-gateway-verify-handoff.cmd
```

ショートカットの一覧は [docs/JWW_GATEWAY_WINDOWS_COMMANDS.md](docs/JWW_GATEWAY_WINDOWS_COMMANDS.md) にあります。

## 既知の制限

- JWW書き出しは内部バージョン600/700とテスト済みエンティティに限定され、未対応型は既定で拒否します。
- ネイティブ寸法、ブロック定義/参照、外部画像参照、v700埋込画像はfocused testと生成コーパスの対象です。
- Jw_cad完全互換ビューアではありません。
- 傾き弧・楕円弧は、JWWのパラメータ角、扁平率、傾きを保持した明示geometryと正確なboundsを出力します。v700対象fixtureはJw_cad 10.02.1でOpen/Save As後も図形semantic差分0を確認済みです。下流rendererはこのgeometry契約を使用する必要があります。
- JWW文字装飾はraw制御列、`jwwSpecialRuns`、`jwwTextSegments`をGateway JSONとnative rebuild保存で保持します。見た目の完全再現は下流rendererの責任です。
- `LTYPE_HC`、`LCOLLOR_M`、`LAYCOL_0..F`、`LAYWID_0..F`、`LAYTYP_0..F` はJWF専用の操作・作図既定値です。Jw_cad 10.02.1の単独変更Save As比較で、JWWへ保存されないことを確認済みです。
- 単体版の `open-items` レポートでは、未対応項目を「サンプル待ち」「監査のみ」「メタデータ出力済み」「別プロジェクト」「変換対象外」に分類し、変換への影響と公開判断を併記します。

既知の制限と残り調査項目を確認する場合:

```powershell
npm run open-items -- --html -o reports\open-items.html
```

## 配布者向け確認

公開・受け渡し前は、次を実行してください。

```powershell
npm run status
npm run verify:handoff
```

検証レポートをまとめて作る場合:

```powershell
npm run verify:reports
npm run reports:index -- --html -o reports\index.html
```

生成されたレポートは `reports\` に出力されます。レポートの種類は [docs/JWW_GATEWAY_REPORTS.md](docs/JWW_GATEWAY_REPORTS.md) と [reports/README.md](reports/README.md) にまとめています。

公開前の詳しい確認手順は [docs/JWW_GATEWAY_RELEASE_CHECKLIST.md](docs/JWW_GATEWAY_RELEASE_CHECKLIST.md) を参照してください。

## 調査用コマンド

JWF環境設定ファイルをJSON化:

```powershell
npm run jwf:parse -- "C:\jww\Sample.jwf" --include-after-end -o sample-jwf.json
```

JWWから抽出できた環境情報とJWFキーを比較:

```powershell
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end
```

JWF数値/色バイト列がJWW内にあるか確認:

```powershell
npm run jwf:value-scan -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end
```

JWF相当キーの棚卸し:

```powershell
npm run coverage -- "C:\path\to\file.jww" --scope drawing --status missing --html -o coverage.html
```

複数ファイルの横断集計:

```powershell
npm run coverage:summary -- coverage-a.json coverage-b.json --html -o coverage-summary.html
npm run value-scan:summary -- full-a.json full-b.json --summary --fail-on-promotion-candidates -o full-summary.txt
```

JWW環境候補領域を複数ファイルで確認:

```powershell
npm run env:scan -- "C:\path\to\folder" --recursive --csv -o env-scan.csv
```

詳しい調査メモは [docs/JWW_JWF_ENV_AUDIT.md](docs/JWW_JWF_ENV_AUDIT.md) にあります。

## 関連ドキュメント

- [JWW_GATEWAY_HANDOFF.md](JWW_GATEWAY_HANDOFF.md): 受け渡し用の短い入口
- [docs/JWW_GATEWAY_SPEC.md](docs/JWW_GATEWAY_SPEC.md): 技術仕様
- [docs/JWW_GATEWAY_RELEASE_NOTES.md](docs/JWW_GATEWAY_RELEASE_NOTES.md): 現在の対応範囲と既知の制限
- [docs/JWW_GATEWAY_RELEASE_CHECKLIST.md](docs/JWW_GATEWAY_RELEASE_CHECKLIST.md): 公開前チェック
- [docs/JWW_GATEWAY_REPORTS.md](docs/JWW_GATEWAY_REPORTS.md): 生成レポートの説明
- [docs/JWW_GATEWAY_WINDOWS_COMMANDS.md](docs/JWW_GATEWAY_WINDOWS_COMMANDS.md): Windows用ショートカット一覧
