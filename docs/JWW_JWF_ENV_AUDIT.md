# JWW / JWF Environment Audit

## 目的

JWF は Jw_cad の環境設定ファイルで、読み込むたびに Jw_cad の現在環境を変更する。JWW ファイルにも、保存時点の図面再現に必要な環境情報が含まれている可能性が高い。

この文書では、`C:\jww\Sample.jwf` に含まれる JWF 項目を基準に、現在の JWW Gateway が JWW から拾えている情報、部分対応の情報、未対応の情報を棚卸しする。

## 公開情報から確認できたこと

Jw_cad操作マニュアルでは、基本設定の「ファイル読込項目」に関連して、JWW形式ファイルには「線色要素・線種パターン・点半径」「描画・印刷状態」「文字基準点ずれ」などの作図状態も保存されていると説明されている。これは、JWW Gateway が色テーブル、線種テーブル、印刷色の点半径、文字基準点ずれ候補をJWW内から探す方針の裏付けになる。

JWFについては、環境設定ファイルが `.JWF` のテキストファイルであり、Jw*cad上の「環境設定ファイル」読込み・書込み・編集対象であることが公開マニュアルで説明されている。公開されている `Sample.jwf` 互換資料では、`LCOLLOR*\_`、`PCOLLOR\__`、`LTYPE*\*`、`LAYNAM*_`、`LAYCOL\_\_`、`LAYWID*\*`、`LAYTYP*\*` の意味と値域が確認できる。

公開情報から、`LAYCOL_*` は書込レイヤを変えた時の既定線色で、0 は切替なし、1..9 が線色番号、9 は補助線を意味する。`LAYWID_*` は線幅を1/100mm単位とする設定時のレイヤ別既定線幅で、-2 は線幅変更なし、-1 は現在線色に対する線幅へ変更、0..30000 は指定線幅を意味する。`LAYTYP_*` はレイヤ別既定線種で、0 は切替なし、0..19 の範囲だが 10 は除外される。これらは表示済みエンティティの見た目より、Jw_cad上で「そのレイヤに書き込む時の初期属性」に近いため、JWW変換表示では必須ではないが、Gatewayの環境再現データとしては保持対象にする。

この公開情報のうち、意味と値並びが確定しやすい `LCOLLOR_*`、`PCOLLOR_*`、`LTYPE_*`、`LAYNAM_*`、`LAYCOL_*`、`LAYWID_*`、`LAYTYP_*` は、JWFパーサの `entry.definition` に付与する。加えて、`Sample.jwf` の説明から `S_COMM_*`、文字、寸法、ハッチ、キー割当、クロックメニューなどのカテゴリ定義も付与する。`jwf:compare` / `jwf:value-scan` の HTML/CSV ではこの定義を Meaning 列として出力し、候補バイトが何の設定に対応するかを確認しやすくする。

`A-00 断面図.jww` + `断面図.JWF` の209項目では、JWFパーサ、JWF比較、値スキャンの全行に `definition` が付くことを確認済み。細かいビット・桁単位の意味までは未分解の行もあるが、棚卸し用の用途カテゴリは空欄なしになった。

`entry.definition.scope` には、優先順位付けのための粗い分類を入れる。

- `drawing`: 図面表示・変換結果に直接効きやすい色、線種、レイヤ、縮尺など
- `document`: 図面データや作図設定として保持価値がある文字、寸法、ハッチ、測定など
- `operation`: Jw_cad上の操作環境、キー割当、クロックメニュー、表示補助など

`jwf:compare` / `jwf:value-scan` のHTML/CSVには Scope 列を出力する。未対応を潰す時は、まず `drawing`、次に `document`、最後に必要に応じて `operation` を見る。

各レポートには `scopeStatusCounts` も出力する。HTMLでは上部に Scope/Status/Count 表、CSVでは明細前の集計ブロックとして出す。加えて `familyStatusCounts` も出力し、同じ `drawing` scope 内でも `layerColors`、`layerWidths`、`layerLineTypes`、`screenColors`、`lineTypes` のどこが残っているかを直接見られるようにする。`A-00 断面図.jww` + `断面図.JWF` の比較では `drawing extracted 58 / missing 50`、`document missing 26`、`operation missing 75`。値スキャンでは `drawing missing 31 / matched 32 / ambiguous 32 / not-scanned 13` まで分解できるため、次の候補調査は `drawing` scope の `missing` と `ambiguous` を優先する。

`jwf:compare` と `jwf:value-scan` は `--scope` / `--family` / `--key` / `--status` で絞り込みできる。例: `--scope drawing --status missing,ambiguous --html -o drawing-open.html`、`--family layerColors,layerLineTypes --html -o layer-defaults.html`、または `--key LTYPE_HC,LCOLLOR_M --html -o core-open.html`。`A-00 断面図.jww` + `断面図.JWF` ではこの絞り込みで63行になり、内訳は `missing 31 / ambiguous 32`。

`jwf:value-scan` には `gatewayStatus` も付与する。これはJWF値のバイト一致ではなく、Gateway本体がそのJWFキーを `extracted` / `missing` / `not-tracked` のどれとして扱っているかを示す。`--gateway-status missing` で絞ると、JWF値そのものは一致しないが既に抽出済みの `LAYSCALE`、`LTYPE_02`、`LCOLLOR_G` などを除外できる。`A-00 断面図.jww` + `断面図.JWF` では特殊画面色対応前は `--scope drawing --gateway-status missing` で53行、さらに `--status missing,ambiguous` を併用すると52行だった。`LCOLLOR_S/K/Z` 対応後は `--scope drawing --gateway-status missing` が50行、`--status missing,ambiguous` 併用が50行になる。

特殊画面色は、`A-00 断面図.jww`、`A-00-3 平面図.jww`、`A-11 仕上表.jww` の3ファイルで、色テーブル基準の相対位置が安定していた。`LCOLLOR_S` は `colorTableOffset + 200`、`LCOLLOR_Z` は `+216`、`LCOLLOR_K` は `+756` で JWF値と一致したため、`color_settings.specialColors.S/K/Z` として抽出する。`LCOLLOR_M` は同じ近傍では JWF値と一致せず、現時点では未抽出扱いを維持する。これにより `A-00 断面図.jww` + `断面図.JWF` のJWF比較は extracted 55 から 58、drawing missing は 53 から 50 へ減った。

出典:

- Jw_cad操作マニュアル「環境設定ファイル」: https://jwcad.s-projects.net/configuration-file.html
- Jw_cad操作マニュアル「基本設定」: https://jwcad.s-projects.net/basic-configuration.html
- tmk-s.com 掲載の `Sample.jwf` 互換資料: https://www.tmk-s.com/jww/jwf.html

## 現在の結論

現在の JWW Gateway は、図面表示に直結する以下の情報をすでに拾っている。

- JWW バージョン
- メモ
- 用紙コード、用紙サイズ推定
- 書込レイヤグループ
- レイヤグループ状態
- レイヤ状態
- レイヤグループ縮尺
- レイヤグループ名
- レイヤ名
- 印刷原点、印刷倍率、回転設定
- 寸法設定の一部
- 画面色テーブル推定
- 印刷色テーブル推定
- 印刷色テーブルの実点半径
- 背景色推定
- JWF 相当の線種テーブル `LTYPE_02..09`、`LTYPE_R1..R5`、`LTYPE_L1..L4`
- エンティティごとの線色、線種、線幅、レイヤ、レイヤグループ
- 文字内容、文字サイズ、間隔、角度、フォント名
- JWW 特殊文字、印刷時埋め込み文字の一部
- 弧、楕円弧系の元角度情報

一方で、JWF にある環境設定全体としてはまだ未対応項目が多い。特に `S_COMM_*`、`LAYCOL_*`、`LAYWID_*`、`LAYTYP_*`、文字種プリセット、寸法設定の詳細、ハッチ設定、キー割当、クロックメニュー、AUTO モードなどは、JWW 内に存在する可能性を前提に追加調査が必要。線種テーブルは `LTYPE_02..09`、`LTYPE_R1..R5`、`LTYPE_L1..L4` まで構造化済みで、`LTYPE_HC` が残件。

### 未対応分類の公開方針

現時点の横断スキャンでは `promotionCandidates: 0` を確認している。つまり、現在のサンプル群では「JWW内にJWF値が安定して一致しているのに、Gatewayが未抽出」という項目は残っていない。したがって未対応を無理に対応済みへ昇格せず、公開・受け渡し時は次の分類で扱う。

| 分類 | 対象 | 公開判断 |
| --- | --- | --- |
| `sample-blocked` | `LTYPE_HC`、`LCOLLOR_M` | 候補や近傍調査は残すが、直接一致が複数実ファイルで再現するまで未抽出扱い。 |
| `audit-only` | `LAYCOL_*`、`LAYWID_*`、`LAYTYP_*` | エンティティ側の色・線幅・線種は読めているため、表示変換のブロッカーにはしない。レイヤ既定値としては監査継続。 |
| `metadata-ready` | JWW文字装飾の重ね描画 | `jwwSpecialRuns` / `jwwTextSegments` は出力済み。見た目の完全再現は下流レンダラ側の課題。 |
| `sample-comparison` | 傾き弧、楕円弧系の稀なケース | 元角度と変換後角度の診断は保持済み。確定例が増えた時に比較する。 |
| `out-of-scope-for-conversion` | `KEY_*`、クロックメニュー、操作コマンド等 | 図面変換には通常不要。完全なJw_cad環境保存が必要になった時だけ昇格検討。 |
| `separate-project` | JWW保存/書き戻し | 読み込みGatewayとは別プロジェクト。round-trip用仕様とテストができるまで非対応を明示する。 |

この分類は `JWW_GATEWAY_MANIFEST.json` の `openItems` と、`npm run open-items -- --html -o reports\open-items.html` の出力に反映する。未対応の数を減らすより、誤読して対応済みに見せないことを優先する。

## Jw_win.exe の静的確認

`C:\jww\Jw_win.exe` は Jw_cad 10.2.1.0 の署名済み実行ファイルだった。起動はせず、ファイル情報・署名・埋め込み文字列だけを確認した。

- ファイル: `C:\jww\Jw_win.exe`
- バージョン: `10.2.1.0`
- 署名: `JIRO SHIMIZU`
- ASCII文字列では `JwwData` と `CData` は見えるが、JWFキーはほぼ見えない
- UTF-16文字列では `S_COMM_`、`LCOLLOR_`、`PCOLLOR_`、`LAYNAM_`、`LAYCOL_`、`LAYWID_`、`LAYTYP_`、`LTYPE_`、`MWIDE`、`MHIGH`、`MDIST`、`MPEN` が確認できる

UTF-16文字列には、JWF書出し用と思われるフォーマット列が含まれていた。並びとしては `S_COMM_*`、`S_MESH_0`、`ZOOM`、`LAYSCALE`、`LTYPE_*`、`LCOLLOR_*`、`PCOLLOR_*`、`MSET`、`MHEN`、`MPEN`、`MWIDE`、`MHIGH`、`MDIST`、`MOFST`、`S_STR*`、`S_SET*`、`HATCH_*`、`LAYCOL_*`、`LAYWID_*`、`LAYTYP_*` などが連続している。これは JWF の全項目棚卸しの裏取りとして使える。

ただし、実行ファイルだけから JWW バイナリ内の保存オフセットを確定することはできない。JWW 側は実ファイルのバイナリ差分と、既知設定の変更前後比較で詰める必要がある。

## 対応状況サマリ

| JWF 系統                                 | 内容                               |     現在の状態 | 現在の格納先 / 備考                                                                                                                                               |
| ---------------------------------------- | ---------------------------------- | -------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `S_COMM_0..9`                            | 一般設定、表示、読込、印刷補助など | 未対応から一部 | JWW から専用構造としては未抽出。印刷設定など一部だけ別構造で読取済み。                                                                                            |
| `R_STR0_00`                              | 寸法・矩形・円半径などの入力値候補 |         未対応 | UI 操作用プリセット。JWW 内有無の確認が必要。                                                                                                                     |
| `R_CROSS_SET`                            | クロスライン等                     |         未対応 | 表示環境寄り。                                                                                                                                                    |
| `S_MESH_0`                               | 目盛・メッシュ                     |         未対応 | 表示補助。                                                                                                                                                        |
| `ZOOM`                                   | ズーム・表示倍率設定               |         未対応 | 表示環境寄り。                                                                                                                                                    |
| `LAYSCALE`                               | レイヤグループ縮尺                 |       対応済み | `doc.layer_groups[].scale`、Gateway `groupScaleState`。                                                                                                           |
| `LAYNAM_N`                               | レイヤ名表示などの設定             |         未対応 | 名前本体は対応済みだが、表示設定値は未抽出。                                                                                                                      |
| `LAYNAM_0..F`                            | レイヤグループ名、レイヤ名         |       対応済み | `doc.layer_groups[].name`、`layers[].name`。                                                                                                                      |
| `LAYCOL_0..F`                            | レイヤ別色指定                     |         未対応 | 現在は各エンティティの `base.pen_color` を使用。レイヤデフォルト色は未抽出。                                                                                      |
| `LAYWID_0..F`                            | レイヤ別線幅指定                   |         未対応 | 現在は各エンティティの `base.pen_width` と色テーブル線幅を使用。                                                                                                  |
| `LAYTYP_0..F`                            | レイヤ別線種指定                   |         未対応 | 現在は各エンティティの `base.pen_style` を使用。                                                                                                                  |
| `LCOLLOR_1..8`                           | 画面表示基本色、線幅               |       部分対応 | バイナリ内テーブルを推定して `color_settings.screenColors` に格納。確定オフセットではなくスコア推定。                                                             |
| `LCOLLOR_G`                              | グレー                             |       部分対応 | 色テーブル候補では読める場合あり。意味付けは弱い。                                                                                                                |
| `LCOLLOR_H`                              | 補助線色                           |       部分対応 | 10色テーブル推定に含まれる可能性あり。専用名としては未固定。                                                                                                      |
| `LCOLLOR_S/K/Z/M`                        | 選択色、仮線色、ズーム枠色、ズーム文字色 |       部分対応 | `LCOLLOR_S`、`LCOLLOR_K`、`LCOLLOR_Z` は色テーブル基準の候補オフセットから抽出。公開JWF資料では `LCOLLOR_M` はズーム文字色だが、JWW内位置は未特定。                  |
| `LCOLLOR_B`                              | 背景色                             |       部分対応 | `color_settings.backgroundColor` として推定。白黒反転判断に利用。                                                                                                 |
| `PCOLLOR_1..8`                           | 印刷色、印刷線幅、実点半径         |       対応済み | `color_settings.printColors` として推定。`RGB + width + pointRadius` 形式を優先し、実点半径を `pointRadius` として保持。                                          |
| `PCOLLOR_G`                              | 印刷グレー                         |   対応済み寄り | 推定テーブルに含まれる場合は `PCOLLOR_G` として抽出。専用意味付けはまだ弱い。                                                                                     |
| `P_dpi`                                  | プリンタ dpi                       |         未対応 | JWW 内有無の確認が必要。                                                                                                                                          |
| `LTYPE_02..09`                           | 基本線種パターン                   |       対応済み | `line_type_settings.rows`、`meta.jwwEnvironment.lineTypes` に抽出。候補テーブルはスコア推定。                                                                     |
| `LTYPE_R*`                               | ランダム線種                       |       対応済み | `LTYPE_R1..R5` を抽出。                                                                                                                                           |
| `LTYPE_L*`                               | 倍長線種など                       |       対応済み | `LTYPE_L1..L4` を抽出。                                                                                                                                           |
| `LTYPE_HC`                               | 線種補助・端点設定                 |   候補診断のみ | `line_type_settings.tailCandidate` / `meta.jwwEnvironment.lineTypes.LTYPE_HC_candidate` に線種テーブル直後の候補バイト、6項目の `valueSchema`、`u32Semantic` を保持。JWF値と一致未確認のため未抽出扱い。 |
| `MSET`                                   | 文字設定の基本                     |         未対応 | エンティティ文字の実値は読めるが、文字種プリセットとしては未抽出。                                                                                                |
| `MHEN`                                   | 文字フォント                       |       部分対応 | 各文字エンティティの `font_name` は読取済み。プリセット側は未対応。                                                                                               |
| `MWIDE`                                  | 文字種幅                           |         未対応 | 各文字の `size_x` は読取済み。プリセット表は未抽出。                                                                                                              |
| `MHIGH`                                  | 文字種高さ                         |         未対応 | 各文字の `size_y` は読取済み。プリセット表は未抽出。                                                                                                              |
| `MDIST`                                  | 文字間隔                           |         未対応 | 各文字の `spacing` は読取済み。プリセット表は未抽出。                                                                                                             |
| `MPEN`                                   | 文字種ごとの色                     |         未対応 | 各文字の `base.pen_color` は読取済み。プリセット表は未抽出。                                                                                                      |
| `MOFST`                                  | 文字基準点ずれ                     |         未対応 | 未抽出。                                                                                                                                                          |
| `S_STR1..3`                              | 寸法文字設定                       |       部分対応 | 寸法エンティティの線と文字は読取済み。寸法設定表は未抽出。                                                                                                        |
| `S_SET1..5`                              | 寸法線・矢印・寸法補助設定         |       部分対応 | 寸法エンティティの形状は一部読取済み。設定表は未抽出。                                                                                                            |
| `ZF_SET`                                 | 図形設定                           |         未対応 | 未抽出。                                                                                                                                                          |
| `SL_SET`                                 | ソリッド設定                       |       部分対応 | ソリッドエンティティ自体と直接色は対応。設定表は未抽出。                                                                                                          |
| `CU_SET`                                 | 曲線設定                           |         未対応 | 曲線クラスは未対応が多い。                                                                                                                                        |
| `MS_SET`                                 | 測定設定                           |         未対応 | 未抽出。                                                                                                                                                          |
| `HATCH_0..5`                             | ハッチ設定                         |         未対応 | ハッチ由来の線は読める場合があるが、設定としては未抽出。                                                                                                          |
| `KEY*`                                   | キー割当                           |         未対応 | CAD操作環境。Gateway変換には通常不要だが、全環境保存なら対象。                                                                                                    |
| `LD_*` / `RD_*`                          | クロックメニュー                   |         未対応 | 操作環境。                                                                                                                                                        |
| `COM_*` / `GCOM_*` / `AC_COM` / `WD_COM` | コマンド環境                       |         未対応 | 操作環境。                                                                                                                                                        |

## JWW Gateway の現状マッピング

### パーサ出力

`src/jww/parser.js` が現在返す主な環境情報:

- `version`
- `memo`
- `paper_size`
- `write_layer_group`
- `layer_groups`
  - `state`
  - `write_layer`
  - `scale`
  - `protect`
  - `name`
  - `layers[].state`
  - `layers[].protect`
  - `layers[].name`
- `print_settings`
  - `origin_x`
  - `origin_y`
  - `scale`
  - `rotation_setting`
- `sunpou_settings`
  - `sunpou1..5`
  - `max_line_width`
- `color_settings`
  - `screenColors`
  - `printColors`
  - `backgroundColor`
  - `colorTableCandidates`
- `line_type_settings`
  - `rows`
  - `offset`
  - `byteLength`
  - `score`
- `environment_region`
- `layer_names_extracted`
- `layer_name_fallbacks`
- `entities`
- `diagnostics`

### Gateway JSON 出力

`tools/jww-gateway.mjs` が現在外部へ返す主な情報:

- `format`
- `formatVersion`
- `sourceFormat`
- `encoding`
- `meta.jwwVersion`
- `meta.paperCode`
- `meta.paperSize`
- `meta.colorSettings`
- `meta.lineTypeSettings`
- `meta.layerNamesExtracted`
- `meta.layerNameFallbacks`
- `meta.environmentRegion`
- `meta.jwwEnvironment`
- `meta.colorDiagnostics`
- `meta.diagnostics`
- `meta.arcDiagnostics`
- `meta.memo`
- `layerGroups`
- `groupScaleState`
- `bounds`
- `entities`

### 出力契約・配布メタデータ

JWW Gateway の変換JSONは `docs/cadstudio-jww-json.schema.json` と `tools/jww-schema-validate.mjs` で最低構造を固定する。現在の固定対象は、基本ヘッダ、`bounds`、代表エンティティ形状に加えて、JWW/JWF環境情報のうち `meta.colorSettings`、`meta.lineTypeSettings`、`meta.jwwEnvironment.coverage` である。

固定している主なJWW環境メタデータ:

- `meta.colorSettings.screenColors` / `printColors` の色エントリ
- `meta.colorSettings.backgroundColor`
- `meta.colorSettings.specialColors.S/K/Z/M`
- 色HEX形式 `#rrggbb`
- `meta.lineTypeSettings.offset` / `byteLength` / `rows`
- `meta.jwwEnvironment.coverage.totalJwfKeysTracked`
- `meta.jwwEnvironment.coverage.supportedKeys`
- `meta.jwwEnvironment.coverage.missingJwfKeys`

`src/jww/schemaValidator.test.js` は、正しいJWWメタデータを通すことと、不正な色HEX、RGB範囲外、線種設定の型崩れ、JWF coverage の型崩れを検出することを確認する。これにより、JWF項目の棚卸しが進んでも、外部アプリへ渡すJSONの最低契約が崩れないようにする。

単体配布フォルダ `..\JWW_Gateway` には `JWW_GATEWAY_MANIFEST.json` を生成する。manifest は、対応CLI、対応エンコーディング、出力スキーマ、機能有無、JWW書き込み非対応、未確定環境キー、配布ファイル一覧を機械的に伝えるためのもの。manifest の形は `docs/jww-gateway-manifest.schema.json` に固定し、生成と検証の共通ルールは `src/jww/gatewayManifest.js` に置く。配布対象ファイル一覧は `src/jww/gatewayPackageFiles.js` に集約し、`package-jww-gateway.mjs` と `jww-gateway-smoke.mjs` が同じ一覧を使い、manifest の `packageFiles` にも出力する。`tools/jww-manifest-validate.mjs` はこの共通ルールで manifest JSON を単独検証するCLI。`--check-files` 付きでは、manifest と同じフォルダを基準に `packageFiles` の実在確認も行う。現時点の `unresolvedEnvironmentKeys` は `LTYPE_HC` と `LCOLLOR_M` で、`capabilities.jwwWrite` は `false` とする。`src/jww/gatewayManifest.test.js` は manifest生成、共通検証、CLI正常系、CLI異常系、配布必須ファイル一覧、`--check-files` 正常系/欠品系を確認する。元プロジェクト側の `npm run jww:package:smoke` は manifest、READMEの未確定キー説明、schema validator の正常系/異常系、value scan のRGB triplet、core-open direct-match 集計を確認する。
manifest の `capabilities.valueScanSummary` と `capabilities.promotionCandidateGate` は、`value-scan:summary` と `--fail-on-promotion-candidates` が使えることを外部アプリへ伝える。

単体配布版 `JWW_Gateway` には `verify` コマンドを持たせる。`verify` は smoke と `manifest:validate --check-files` を連続実行し、公開前に配布物の欠落を確認する。生成レポートは `reports\` に出す運用とし、このフォルダはパッケージ再生成時に作り直される。
`verify:report` は公開・受け渡し用の短い検証レポートを生成する。manifestの妥当性、必須ファイル欠落、scripts/binのズレ、capability、未解決キーをまとめ、`reports\verify-report.txt`、`reports\verify-report.json`、または `reports\verify-report.html` に保存する。
`verify:report --expect-unresolved LTYPE_HC,LCOLLOR_M` を使うと、未解決キーの増減を検証エラーにできる。これにより、`LCOLLOR_M` や `LTYPE_HC` が解決された時、または別の未解決キーが増えた時に、公開前チェックで必ず気付ける。
JSON/CSV/HTMLには manifest 掲載ファイルのサイズとSHA-256も出力し、受け渡し後に配布物が変わっていないか比較できるようにする。
`verify:reports` は txt/json/csv/html の受け渡しレポートを一括生成する。
`verify:all` は `verify` と `verify:reports` を連続実行し、配布物検証と受け渡しレポート生成を一括で行う。
`reports\README.md` と `docs/JWW_GATEWAY_REPORTS.md` には、`verify-report`、`sample-plan`、coverage、JWF比較、value-scan、special-color、layer-defaults など生成レポートの置き場と種類をまとめる。
`verify:handoff` は `verify:all` の後に `--expect-unresolved LTYPE_HC,LCOLLOR_M` を実行し、受け渡し時の未解決キー増減をまとめて検出する。
`status` は単体配布フォルダの準備状態、欠落数、未解決キー、JWW書き込み非対応を短く表示する。
`open-items` は manifest の `openItems` から、既知の制限と残り調査項目を txt/json/csv/html で出力する。公開時に「残っているが意図した制限」と「実ファイル待ちの調査」を分けて説明するための一覧として使う。
`reports:index` は `reports\` 内の成果物を一覧化し、どのレポートが生成済みかと未生成レポートの作成コマンドを1枚のHTMLにまとめる。
Windows向けに `jww-gateway-status.cmd`、`jww-gateway-verify-all.cmd`、`jww-gateway-verify-handoff.cmd`、`jww-gateway-open-items.cmd`、`jww-gateway-report-index.cmd` も単体配布フォルダ直下へ置く。
変換と診断用に `jww-gateway-convert.cmd` と `jww-gateway-diagnose.cmd` も置き、引数をCLIへそのまま渡す。
JWF調査用に `jww-gateway-jwf-parse.cmd`、`jww-gateway-jwf-compare.cmd`、`jww-gateway-jwf-value-scan.cmd` も置き、`.jww + .jwf` セットの棚卸しを単体配布フォルダから実行できるようにする。
検証、環境スキャン、診断差分、検証レポート、検証レポート差分にも `.cmd` を置き、主要CLIはWindows上で単体配布フォルダ直下から実行できるようにする。
Windows向けショートカット一覧は `docs/JWW_GATEWAY_WINDOWS_COMMANDS.md` にまとめる。
公開・受け渡し手順は `docs/JWW_GATEWAY_RELEASE_CHECKLIST.md` にまとめる。
現在の対応範囲と既知の制限は `docs/JWW_GATEWAY_RELEASE_NOTES.md` にまとめる。
受け取り側が最初に読む短い入口として `JWW_GATEWAY_HANDOFF.md` を単体配布フォルダ直下へ置く。
manifest の `handoff` には、この入口ファイル、release checklist、sample set example/schema、`verify:handoff` と `sample:plan` の主要コマンドを記録する。
`sample:plan` は `.jww + .jwf` のサンプル一覧JSONを読み、ファイル存在確認と検証コマンド計画を txt/json/csv/html で出す。サンプル一覧の形は `docs/jww-gateway-sample-sets.schema.json` に固定し、`sample:plan` は書式エラーとローカルファイル未配置を分けて報告する。各サンプルの変換・診断・coverage・JWF比較・value scanに加え、coverage/core-open/special-color/layer-defaults の横断集計コマンドも出す。`docs/JWW_GATEWAY_SAMPLE_SETS.example.json` をコピーして実パスへ差し替えると、案件ごとの検証セットを再現しやすくなる。Windows向けには `jww-gateway-sample-plan.cmd` を置く。
`verify:diff` は2つの `verify-report.json` を比較し、追加・削除・変更ファイルを txt/json/csv/html で出力する。配布前後やバックアップ間の差分確認に使う。
既定では差分があると終了コード1にするため、検証ゲートとして使える。差分HTMLだけを生成したい場合は `--allow-differences` を付ける。
manifest validator は必須 `commands` / `binaries` も検査する。capability とCLI実体のズレを防ぎ、外部アプリが manifest を信頼して接続判断できるようにする。

`diagnose` は外れ要素候補の確認用に `--outlier-limit` と `--outlier-distance-min` を受け取る。ビュー側のチェックボックス削除に渡す前段として、単体CLIのJSON/HTML/CSVで候補数と最小距離を調整して比較できるようにした。

## 今後の追加方針

### 優先度 A: 図面再現に直結

1. JWW 内の `LAYCOL_*` / `LAYWID_*` / `LAYTYP_*` 相当を抽出する。
2. JWW 内の文字種プリセット `MSET` / `MWIDE` / `MHIGH` / `MDIST` / `MPEN` 相当を抽出する。
3. `LTYPE_HC` 候補診断を複数ファイルで比較し、JWF値との対応が確定したら抽出へ昇格する。
4. `LCOLLOR_G/H/B`、`PCOLLOR_G` など特殊色の意味付けを固定する。
5. `LTYPE_*` と `PCOLLOR_* pointRadius` は対応済み。実ファイル差分で誤検出がないか継続確認する。

### 優先度 B: 印刷再現に効く

1. `S_COMM_2` 相当の線幅単位、印刷背景、印刷基準点を抽出する。
2. プリンタ倍率、回転、基準点、埋め込み文字表示設定を整理する。
3. 寸法設定 `S_STR*` / `S_SET*` を構造化する。

### 優先度 C: 操作環境・UI再現

1. `KEY*`、`LD_*`、`RD_*`、`COM_*`、`GCOM_*`。
2. `ZOOM`、`S_MESH_*`、`R_CROSS_SET`。
3. AUTO モード、クロックメニュー、コマンド別環境。

## 次の実装候補

`jwwEnvironment` という専用オブジェクトを Gateway JSON に追加し、既存で読めているものを JWF 名に寄せて再配置している。

例:

```json
{
  "meta": {
    "jwwEnvironment": {
      "paper": {},
      "layers": {},
      "colors": {},
      "print": {},
      "text": {},
      "dimensions": {},
      "rawCoverage": {}
    }
  }
}
```

その上で、未対応項目を `rawCoverage.missingJwfKeys` に出す。これにより、今後 JWW 側から新しく抽出できた項目をチェックリスト形式で潰せる。

現在は `meta.jwwEnvironment.coverage.missingJwfKeys` に未抽出キー、`meta.jwwEnvironment.coverage.supportedKeys` に抽出済みキーを出す。追跡対象は `Sample.jwf --include-after-end` で拾える210キー基準にしており、図面再現系だけでなく `KEY_*`、`COM_*`、クロックメニュー系も未対応項目として見える。
単体CLIでは `coverage` を使い、JWWファイル単位の抽出済み/未抽出キーを txt/json/csv/html で出せる。`--scope drawing --status missing` で図面再現に近い未対応だけを絞り込める。coverage レポートには `scopeStatusCounts` と `familyStatusCounts` も出し、未対応の残りが `layerColors`、`layerWidths`、`layerLineTypes`、`lineTypes`、`screenColors` のどこに集中しているかを確認できる。
複数のcoverage JSONは `coverage:summary` で横断集計し、全ファイル共通でmissingのキーと、ファイルにより extracted/missing が分かれるキーを確認する。
`coverage:summary` は `alwaysMissingDrawing` も出す。これは `document` / `operation` のJWF環境設定を除き、図面再現に近い `drawing` scope で全サンプル共通 missing のキー数だけを数える。さらに `core`、`layerDefaults`、`other` に分類するため、レイヤ既定値の48件と中核未解決2件を分けて見られる。`--fail-on-always-missing-drawing` を使うと、公開前チェックで図面系の未対応が残っている場合だけ終了コード2で止められる。
`A-00-3 平面図`、`A-00 断面図`、`M-08 衛生設備` の coverage JSON を横断すると `alwaysMissingDrawing: 50`。内訳は `layerDefaults: 48`、`core: 2`、`other: 0`。この50件は図面再現に近い残件として、今後のサンプル追加時もまず確認する。
`LAYCOL_*` / `LAYWID_*` / `LAYTYP_*` に絞る場合は `layer-defaults:audit` を使う。これは `jwf:value-scan` のレイヤ既定値ファミリだけを抜き出し、family/status、昇格候補、tested pattern、match kind を確認するための専用ビュー。複数セットを比較する場合は、各 audit を `--json` で保存してから `layer-defaults:summary` に渡す。これにより全サンプル共通 missing、direct match 候補、promotion 候補を横断確認できる。summary は ambiguous 行について reason、値シグネチャ、match kind も集計するため、低情報値による偶然一致と、今後追加調査すべき案件固有値を分けて見られる。`--fail-on-direct-matches` は、将来レイヤ既定値の直接一致候補が出た時だけ検証を止めるためのゲートとして使う。

JWF自体は `npm run jwf:parse -- <file.jwf>` でJSON化できる。`Sample.jwf` は先頭の `END` 以降が説明用なので、棚卸し用途では `--include-after-end` を付ける。

JWWから抽出済みの環境情報とJWFキーを突き合わせる場合は、次を使う。

```powershell
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --html -o jwf-compare.html
```

これにより、JWF側の各キーが `extracted`、`missing`、`not-tracked` のどれに該当するかを一覧化できる。
HTML/CSVでは JWFパーサの `entry.definition` を Meaning 列に出すため、未対応項目の用途を見ながら優先順位を決められる。

値そのものが JWW バイト列内に存在するかを調査する場合は `jwf:value-scan` を使う。全て0、全て-1などの低情報量な連続数値は、JWW内の空白領域や初期化領域にも一致しやすいため `ambiguous` として扱う。`LAYCOL_*` / `LAYTYP_*` が全0のJWFでは、この曖昧一致を抽出済みへ昇格しない。共有・目視確認用には `--html -o value-scan.html` でHTMLレポートも出力できる。

## 調査メモ

- `PCOLLOR_*` は画面色テーブルから少し離れた位置にある `RGB + width + pointRadius` 形式の印刷色テーブル候補を優先採用する。`M-07 1階平面図(衛生).jww` では `PCOLLOR_1..8` と `PCOLLOR_G` が `extracted` になる。
- `PCOLLOR_1..8` の実点半径は `pointRadius` として保持する。古い `rgb-width` 候補に戻った場合は点半径が欠落する可能性があるため、`printColorTableKind` と `printColorTableCandidates` を診断に残す。
- `LAYCOL_*`、`LAYWID_*`、`LAYTYP_*` はレイヤ名直後の領域や単純な16x16テーブル探索では確定できなかった。現時点では誤読防止のため未抽出扱い。
- `A-00-3 平面図.jww` + `建築.JWF`、`A-00 断面図.jww` + `断面図.JWF`、`A-11 仕上表.jww` + `仕上げ表.JWF` は、`LAYCOL_*` と `LAYTYP_*` がほぼ全0、`LAYWID_*` が全-1の初期値中心だった。値スキャンではゼロ領域との曖昧一致になりやすいため、保存位置特定の主サンプルには弱い。
- `A-00 断面図.jww` は JWW診断上 `A2`、14232 entities、`LAYNAM_*` は抽出済み、レイヤ名フォールバック3件。JWF比較は extracted 58 / missing 151、値スキャンは matched 42 / ambiguous 37 / missing 102 / not-scanned 28。`LAYCOL_*` / `LAYTYP_*` は全0のため ambiguous、`LAYWID_*` は全-1のため未抽出扱いを維持する。
- `M-08 事務所棟 1階平面図(衛生設備).jww` + `設備.JWF` は `LAYCOL_*` / `LAYTYP_*` に差のある値を含むため、次の保存位置調査ではこちらを主サンプルにする。

### Raw Environment Region Diagnostics

Gateway JSON now includes `meta.environmentRegion`, and `jwwEnvironment.raw.environmentRegion` mirrors it for audit use.
This region starts immediately after layer/group names and ends at the entity list marker. It does not promote values to JWF settings yet. Instead it reports:

- `afterLayerNamesOffset`
- `entityListOffset`
- `byteLength`
- repeated `u32PairRuns`
- early numeric `doubleSamples`

The purpose is to compare real JWW files before accepting new extraction rules for `LAYCOL_*`, `LAYWID_*`, `LAYTYP_*`, text preset tables, hatch settings, and other JWF-like environment data.

`npm run env:scan -- <file-or-folder> --recursive --csv -o env-scan.csv` produces a compact multi-file table for this comparison.

### JWF value scan

`npm run jwf:value-scan -- <file.jww> <file.jwf> --include-after-end` searches the JWW bytes for exact numeric/color byte patterns derived from JWF entries. Add `--json`, `--csv`, or `--html` to generate machine-readable output, table data, or a review report.
It is an investigation tool, not proof that a JWF setting has been fully decoded. Short or repeated numeric arrays can match unrelated data, but stable offsets across files are useful candidates for promotion into the parser.
The scanner now checks color byte patterns, RGB triplets, and `u8`, `u16`, `i16`, `u32`, `i32`, and `f64` numeric sequences. JSON/CSV/HTML output includes `testedPatterns`, so missing rows still show which byte layouts were tried. It also includes `gatewayCandidate` and `gatewayCandidateComparison` for unresolved keys that Gateway already exposes as diagnostic candidates, such as `LTYPE_HC_candidate`. This is important for `LAYCOL_*` and `LAYTYP_*`, because those JWF rows are 16 small integers and may be stored more compactly than 32-bit values if they exist in the JWW environment block.

For `M-07 1階平面図(衛生).jww` with `設備設計用.jwf`, the scan finds many `LTYPE_*` rows and `LCOLLOR_1..8` as byte patterns. `LTYPE_02..09`, `LTYPE_R1..R5`, and `LTYPE_L1..L4` are now promoted to structured parser output. `LTYPE_HC` remains unresolved.

`M-08 事務所棟 1階平面図(衛生設備).jww` + `設備.JWF` は `LAYCOL_*` / `LAYTYP_*` に非ゼロ値が混ざる確認用セットとして有効。`u8/u16/i16` 追加後も、`--scope drawing --gateway-status missing` の50行はすべて `missing` のままで、非ゼロのレイヤ既定色・線種テーブルは直接バイト列としては見つからなかった。したがって現時点では、レイヤ既定値はJWWに保存されない、または単純な16要素配列ではなく別構造へ変換されている可能性が高い。
`--family layerColors,layerLineTypes,layerWidths` で絞ると、M-08 では `layerColors missing 16`、`layerWidths missing 16`、`layerLineTypes missing 16` の48行だけを確認できる。
`--family lineTypes,screenColors --gateway-status missing` で絞ると、A-00 断面図とM-08の両方で残る非レイヤ系drawing項目は `LTYPE_HC` と `LCOLLOR_M` の2件だけになる。`LCOLLOR_M` はRGB tripletも試して一致なし。
`LCOLLOR_M` の追加調査には `special-color:audit` を使う。これはJWWの検出済み色テーブル周辺をRGB tripletとして走査し、JWFの `LCOLLOR_M` 色との距離順に候補を出す。現時点では候補監査用であり、直接抽出には昇格しない。
複数の special color audit JSON は `special-color:summary` で横断集計できる。相対オフセット別・候補色別にファイル数、行数、直接一致数、距離をまとめるため、近似色が複数ファイルで繰り返し出ているかを確認できる。ただし `LCOLLOR_M` は直接一致が出るまで未解決扱いのままにする。
`A-00-3 平面図`、`M-08 衛生設備`、`A-00 断面図`、`A-11 仕上表` の special color audit JSON を `special-color:summary --fail-on-direct-matches` で横断したところ、4レポート96候補で `directMatches: 0`。最も近い繰り返し候補は相対 `+248/+249` の `#c3c3c3`、平均距離 `8.66` だった。期待値そのものではないため、抽出昇格は行わない。
`--key LTYPE_HC,LCOLLOR_M` で `A-00 断面図`、`A-00-3 平面図`、`A-11 仕上表`、`M-08 衛生設備` の4セットを横断確認した。4セットすべてで `LTYPE_HC` は `directU32Match: false`、`LCOLLOR_M` は `directSpecialMatch: false` だった。したがって、この2項目は現時点では抽出済みへ昇格しない。
複数の `--key LTYPE_HC,LCOLLOR_M --json` レポートは `core:summary` で横断集計できる。`core-open-cross-sample-summary.json/html/csv` では4レポート8行を集約し、`LTYPE_HC missing 4 / matched 0`、`LCOLLOR_M missing 4 / matched 0` と確認できる。集計には direct-match true/false も含め、候補位置の値がJWF値と直接一致したかを横断で追えるようにする。`--fail-on-direct-matches` は今後のサンプルで直接一致が現れた時に非0終了し、未確定キーを昇格候補として見落とさないための確認ゲートとして使う。

`--family text --json` で `A-00-3 平面図`、`A-00 断面図`、`A-11 仕上表`、`M-08 衛生設備` の4セットを横断確認した。4セットすべてで `MSET`、`MWIDE`、`MHIGH`、`MDIST`、`MPEN`、`MOFST` は `missing`、`MHEN` は文字列/フォント名設定のため `not-scanned` だった。したがって、文字種プリセットは現時点では単純な連続数値テーブルとしてはJWW内に見つかっていない。各文字エンティティの `font_name`、`size_x`、`size_y`、`spacing`、`base.pen_color` は引き続き個別実体値として保持する。

`--family dimensions,hatch --json` でも同じ4セットを横断確認した。低情報量判定を強めた後は、`S_STR2`、`S_STR3`、`HATCH_4` は `ambiguous` になり、抽出候補としては残るが昇格対象ではない。`S_STR3` は全0、`S_STR2` は短い0/1列、`HATCH_4` は候補一致数が多すぎるため、寸法・ハッチ設定表としては未確定扱いを維持する。寸法エンティティの線・文字そのものは既存パーサで個別実体として扱う。
複数の value-scan JSON は `value-scan:summary` で横断集計できる。文字、寸法、ハッチのようにファミリ単位で調べる項目は、`core:summary` よりこちらを使い、status/family/key ごとの傾向を見てから抽出へ昇格する。`text-preset-cross-sample-summary.json/html/csv` は4レポート28行を集約し、`missing 24 / not-scanned 4`。`document-settings-cross-sample-summary.json/html/csv` は4レポート56行を集約し、`missing 44 / ambiguous 8 / not-scanned 4`。
`--family general --json` では `S_COMM_0..9` を4セット横断確認した。`general-settings-cross-sample-summary.json/html/csv` は4レポート40行を集約し、`missing 37 / ambiguous 3`。`S_COMM_8` だけ一部ファイルで短い `u8` 列に一致したが、同じ列が複数箇所に出るため `ambiguous` に倒した。`S_COMM_*` は現時点では専用構造として抽出へ昇格しない。
`--scope operation --json` では `S_COMM_*`、クロックメニュー、コマンド、キー割当を4セット横断確認した。`operation-settings-cross-sample-summary.json/html/csv` は4レポート301行を集約し、低情報量判定を強めた後は `missing 197 / ambiguous 60 / not-scanned 44 / matched 0`。`KEY_*` や `LD2_AM` などは短い2値配列、または0が大半の疎な配列として偶然一致しやすいため、抽出へ昇格しない。operation scope は Gateway の図面変換には通常不要だが、JWF環境保存の完全性を確認するために未対応として棚卸しを続ける。
フィルタなしの全項目スキャンも4セット横断で再生成した。`full-value-scan-cross-sample-summary.json/html/csv` は4レポート837行を集約し、現在の保守的判定では `missing 400 / ambiguous 286 / not-scanned 120 / matched 31`。`matched` が残るキーは10種類で、すべて Gateway が既に `gatewayExtracted` として扱う線種・色系だった。未抽出なのに `matched` になっているキーは0件。`ZF_SET` の `[-1,-1,0,0,0,0]` のような初期値らしい短い列は `ambiguous` に倒した。`value-scan:summary` は `promotionCandidates` も出力し、この総合サマリでは `promotionCandidates: 0` と確認できる。`--summary --fail-on-promotion-candidates` を付けると、短い確認レポートを出しつつ昇格候補が残る場合に終了コード2で失敗するため、今後の検証ゲートに使える。

### LTYPE_HC candidate

`LTYPE_L4` の直後24 bytesを `LTYPE_HC_candidate` として保持する。公開JWF資料では6項目の意味が確認できたため、候補JSONには `selectionTemporaryLineTypeNo`、`crosslineCursorLineTypeNo`、`dashPitchAutoAdjust`、`rightClickBaseLineColorNo`、`rightClickBaseLineTypeNo`、`lineEndStyle` の `valueSchema` と、`lineEndStyleName` を含む `u32Semantic` を出す。`A-00-3 平面図.jww` と `A-00 断面図.jww` では u32 候補が `0,1,2,1,0,0`、`A-11 仕上表.jww` では `0,1,1,0,0,0`、`M-08 事務所棟 1階平面図(衛生設備).jww` では `0,1,1,0,1,0` だった。一方、対応するJWFの `LTYPE_HC` は `1,1,0,2,1,0` で、現時点では順序・型・意味が一致しない。したがって `coverage.supportedKeys` には入れず、診断候補として比較用に残す。

The same pair also showed that print colors can appear as `RGB + width + pointRadius` rows. Gateway now prefers this richer `print-rgb-width-radius` table over the older plain RGB/width candidate, so `PCOLLOR_1..8` can retain real point radius values when present.

### UTF-16LE inline JWW strings

Some JWW files store individual strings with an inline `FF FE FF` marker even when the import encoding is `shift_jis`.
The parser now treats this as a UTF-16LE string marker, so a memo such as CRLF no longer shifts the paper, layer, and entity offsets.
If the layer-name block still looks binary after decoding, Gateway falls back to default layer names and reports `layerNamesExtracted: false`; those `LAYNAM_*` keys are not counted as extracted in JWF coverage.
