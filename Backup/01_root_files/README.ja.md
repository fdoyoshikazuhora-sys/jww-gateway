# JWW Gateway

JWW Gateway は、JWW読み込み・変換・診断用の単体CLIです。

Jw_cad `.jww` ファイルを読み込み、JWW Gateway JSONへ変換し、診断レポートを出力します。JWW保存/書き出しには未対応です。

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

JWW保存/書き出しには対応していません。変換・診断コマンドは元のJWWファイルを変更しません。

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
.\jww-gateway-verify-handoff.cmd
```

ショートカットの一覧は [docs/JWW_GATEWAY_WINDOWS_COMMANDS.md](docs/JWW_GATEWAY_WINDOWS_COMMANDS.md) にあります。

## 既知の制限

- JWW保存/書き出しには未対応です。
- Jw_cad完全互換ビューアではありません。
- 傾き弧や楕円弧は、実ファイル比較による調整が必要になる場合があります。
- 複雑なJWW文字装飾はメタ情報として保持しますが、見た目の完全再現は未完了です。
- JWW文字装飾の範囲は `jwwTextSegments` として出力します。
- `LTYPE_HC` と `LCOLLOR_M` は、実ファイルで安定した直接一致が出るまで未解決扱いです。
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
