# JWW / JWF Environment Audit

## 目的

JWF は Jw_cad の環境設定ファイルで、読み込むたびに Jw_cad の現在環境を変更する。JWW ファイルにも、保存時点の図面再現に必要な環境情報が含まれている可能性が高い。

この文書では、`C:\jww\Sample.jwf` に含まれる JWF 項目を基準に、現在の JWW Gateway が JWW から拾えている情報、部分対応の情報、未対応の情報を棚卸しする。

## 公開情報から確認できたこと

Jw_cad操作マニュアルでは、基本設定の「ファイル読込項目」に関連して、JWW形式ファイルには「線色要素・線種パターン・点半径」「描画・印刷状態」「文字基準点ずれ」などの作図状態も保存されていると説明されている。これは、JWW Gateway が色テーブル、線種テーブル、印刷色の点半径、文字基準点ずれ候補をJWW内から探す方針の裏付けになる。

JWFについては、環境設定ファイルが `.JWF` のテキストファイルであり、Jw*cad上の「環境設定ファイル」読込み・書込み・編集対象であることが公開マニュアルで説明されている。公開されている `Sample.jwf` 互換資料では、`LCOLLOR*\_`、`PCOLLOR\__`、`LTYPE*\*`、`LAYNAM*_`、`LAYCOL\_\_`、`LAYWID*\*`、`LAYTYP*\*` の意味と値域が確認できる。

公開情報から、`LAYCOL_*` は書込レイヤを変えた時の既定線色で、0 は切替なし、1..9 が線色番号、9 は補助線を意味する。`LAYWID_*` は線幅を1/100mm単位とする設定時のレイヤ別既定線幅で、-2 は線幅変更なし、-1 は現在線色に対する線幅へ変更、0..30000 は指定線幅を意味する。`LAYTYP_*` はレイヤ別既定線種で、0 は切替なし、0..19 の範囲だが 10 は除外される。これらは既存エンティティ属性ではなく「書込レイヤを切り替えた時の作図属性」に属する。2026-08-30の単独変更Save As比較でJWWへ保存されないことを確認したため、JWF Environment Profileでは保持するがJWW native documentの抽出・保存対象にはしない。

この公開情報のうち、意味と値並びが確定しやすい `LCOLLOR_*`、`PCOLLOR_*`、`LTYPE_*`、`LAYNAM_*`、`LAYCOL_*`、`LAYWID_*`、`LAYTYP_*` は、JWFパーサの `entry.definition` に付与する。加えて、`Sample.jwf` の説明から `S_COMM_*`、文字、寸法、ハッチ、キー割当、クロックメニューなどのカテゴリ定義も付与する。`jwf:compare` / `jwf:value-scan` の HTML/CSV ではこの定義を Meaning 列として出力し、候補バイトが何の設定に対応するかを確認しやすくする。

`A-00 断面図.jww` + `断面図.JWF` の209項目では、JWFパーサ、JWF比較、値スキャンの全行に `definition` が付くことを確認済み。細かいビット・桁単位の意味までは未分解の行もあるが、棚卸し用の用途カテゴリは空欄なしになった。

`entry.definition.scope` には、優先順位付けのための粗い分類を入れる。

- `drawing`: 図面表示・変換結果に直接効きやすい色、線種、レイヤ、縮尺など
- `document`: 図面データや作図設定として保持価値がある文字、寸法、ハッチ、測定など
- `operation`: Jw_cad上の操作環境、キー割当、クロックメニュー、表示補助など

`jwf:compare` / `jwf:value-scan` のHTML/CSVには Scope 列を出力する。未対応を潰す時は、まず `drawing`、次に `document`、最後に必要に応じて `operation` を見る。

各レポートには `scopeStatusCounts` も出力する。HTMLでは上部に Scope/Status/Count 表、CSVでは明細前の集計ブロックとして出す。加えて `familyStatusCounts` も出力し、同じ `drawing` scope 内でも `layerColors`、`layerWidths`、`layerLineTypes`、`screenColors`、`lineTypes` のどこが残っているかを直接見られるようにする。`A-00 断面図.jww` + `断面図.JWF` の比較では `drawing extracted 58 / missing 50`、`document missing 26`、`operation missing 75`。値スキャンでは `drawing missing 31 / matched 32 / ambiguous 32 / not-scanned 13` まで分解できるため、次の候補調査は `drawing` scope の `missing` と `ambiguous` を優先する。

`jwf:compare` と `jwf:value-scan` は `--scope` / `--family` / `--key` / `--status` で絞り込みできる。例: `--scope drawing --status missing,ambiguous --html -o drawing-open.html`、`--family layerColors,layerLineTypes --html -o layer-defaults.html`、または `--key LTYPE_HC,LCOLLOR_M --html -o core-open.html`。`A-00 断面図.jww` + `断面図.JWF` ではこの絞り込みで63行になり、内訳は `missing 31 / ambiguous 32`。

`jwf:value-scan` には `gatewayStatus` も付与する。これはJWF値のバイト一致ではなく、Gateway本体がそのJWFキーを `extracted` / `missing` / `not-tracked` のどれとして扱っているかを示す。`--gateway-status missing` で絞ると、JWF値そのものは一致しないが既に抽出済みの `LAYSCALE`、`LTYPE_02`、`LCOLLOR_G` などを除外できる。過去の集計では特殊色候補を `extracted` に数えていたため、その件数は公式色表境界の確定後のparser判定とは分けて扱う。

過去の相対位置候補を公式240-byte色表へ重ね直すと、`colorTableOffset + 200` と `+216` はそれぞれ印刷色8と印刷色9のRGB先頭に一致した。したがって旧 `LCOLLOR_S` / `LCOLLOR_Z` 候補は別設定ではなく印刷色のaliasであり、`color_settings.specialColors` への昇格を取り消した。`+756` の `LCOLLOR_K` は公式色表外の互換候補としてのみ残し、native書込み対象にしない。`LCOLLOR_M` はJWF専用のズーム操作文字色で、JWWには保存されない。

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

一方で、JWF にある環境設定全体としてはまだ未対応項目が多い。特に `S_COMM_*`、文字種プリセット、寸法設定の詳細、ハッチ設定、キー割当、クロックメニュー、AUTO モードなどは、JWW 内に存在するか、JWF専用操作設定かを個別に判断する必要がある。線種テーブルは `LTYPE_02..09`、`LTYPE_R1..R5`、`LTYPE_L1..L4` まで構造化済み。`LTYPE_HC`、`LCOLLOR_M`、`LAYCOL/LAYWID/LAYTYP_0..F` はJWF専用設定として解決済み。

### 未対応分類の公開方針

現時点の横断スキャンでは `promotionCandidates: 0` を確認している。つまり、現在のサンプル群では「JWW内にJWF値が安定して一致しているのに、Gatewayが未抽出」という項目は残っていない。したがって未対応を無理に対応済みへ昇格せず、公開・受け渡し時は次の分類で扱う。

| 分類 | 対象 | 公開判断 |
| --- | --- | --- |
| `jwf-only-operation` | `LTYPE_HC`、`LCOLLOR_M`、`LAYCOL/LAYWID/LAYTYP_0..F` | JWF専用の操作・表示・書込レイヤ既定値。JWW文書には保存されないため、native Open/Saveの抽出対象外。 |
| `gateway-contract-complete` | JWW文字装飾 | raw制御列、`jwwSpecialRuns`、`jwwTextSegments`をGateway JSON/native rebuild保存で保持。見た目の完全再現は下流レンダラ側の課題。 |
| `geometry-resolved` | 傾き弧、楕円弧 | パラメータ角、扁平率、傾きを分離したgeometryと正確なboundsを実装。v700対象fixtureのJw_cad 10.02.1 Open/Save Asで図形差分0。版全体conformanceは別項目。 |
| `jwf-parse-ready` | `KEY_*`、クロックメニュー、操作コマンド等 | `.jwf` テキストファイルからは `normalizedSettings.operation` として正規化済み。JWWバイナリ内の保存位置抽出は、図面変換外の監査項目として継続。 |
| `bounded-writer-resolved` | JWW保存/書き戻し | v600/v700の対応エンティティに限定したwriterを実装。v700全対応種をJw_cad 10.02.1でOpen・編集・再保存し、正規化後のGateway再構築は編集前byte-identical。版全体保証は別のconformance項目に残す。 |

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
| `LAYCOL_0..F`                            | 書込レイヤ切替時の既定線色         | JWF専用操作設定 | JWF parserで保持する。JWWには保存されず、既存エンティティは `base.pen_color` を正本とする。                                                                        |
| `LAYWID_0..F`                            | 書込レイヤ切替時の既定線幅         | JWF専用操作設定 | JWF parserで保持する。JWWには保存されず、既存エンティティは `base.pen_width` を正本とする。                                                                        |
| `LAYTYP_0..F`                            | 書込レイヤ切替時の既定線種         | JWF専用操作設定 | JWF parserで保持する。JWWには保存されず、既存エンティティは `base.pen_style` を正本とする。                                                                        |
| `LCOLLOR_1..8`                           | 画面表示基本色、線幅               |       対応済み | 公式0～9画面色表の1～8を `color_settings.screenColors` に格納。                                                                                                   |
| `LCOLLOR_G`                              | グレー                             |       対応済み | 公式画面色表の9。RGBは利用者が変更できるため無彩色であることを検出条件にしない。                                                                                   |
| `LCOLLOR_H`                              | 補助線色                           |         未確認 | 公式0～9画面色表に10番は存在しない。旧10番は印刷背景色の誤読だったため除去。                                                                                       |
| `LCOLLOR_S/K/Z/M`                        | 選択色、仮線色、ズーム枠色、ズーム文字色 |       部分対応 | 旧S/Z候補は印刷色8/9のaliasだったため除去。Kは未確認候補のままread-only。MはJWF専用でJWWに保存されない。                                                      |
| `LCOLLOR_B`                              | 背景色                             |       対応済み | 公式画面色表の0を `color_settings.backgroundColor` として保持。                                                                                                   |
| `PCOLLOR_1..8`                           | 印刷色、印刷線幅、実点半径         |       対応済み | 公式0～9印刷色表の1～8を `color_settings.printColors` に格納。                                                                                                    |
| `PCOLLOR_G`                              | 印刷グレー                         |       対応済み | 公式印刷色表の9。RGB、線幅、実点半径を保持。                                                                                                                       |
| `P_dpi`                                  | プリンタ dpi                       |         未対応 | JWW 内有無の確認が必要。                                                                                                                                          |
| `LTYPE_02..09`                           | 基本線種パターン                   |       対応済み | `line_type_settings.rows`、`meta.jwwEnvironment.lineTypes` に抽出。候補テーブルはスコア推定。                                                                     |
| `LTYPE_R*`                               | ランダム線種                       |       対応済み | `LTYPE_R1..R5` を抽出。                                                                                                                                           |
| `LTYPE_L*`                               | 倍長線種など                       |       対応済み | `LTYPE_L1..L4` を抽出。                                                                                                                                           |
| `LTYPE_HC`                               | 選択仮線・クロスライン・端点設定   | JWF専用操作設定 | 6項目の意味はJWF契約として確定。JWWには保存されない。線種テーブル直後24 bytesは `postLineTypeTailCandidate` として中立な診断名で保持する。                 |
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
| `KEY*`                                   | キー割当                           | JWFパース対応 | `.jwf` では `normalizedSettings.operation.keyboard` に正規化する。JWWバイナリ抽出は未昇格。                                                                      |
| `LD_*` / `RD_*`                          | AUTOクロックメニュー               | JWFパース対応 | `.jwf` では `normalizedSettings.operation.clockMenus` にAUTOクロックメニュー(1)/(2)、左右、AM/PM、12方向の割当として正規化する。JWWバイナリ抽出は未昇格。        |
| `COM_*` / `GCOM_*` / `AC_COM` / `WD_COM` | コマンド環境                       | JWFパース対応 | `.jwf` では `normalizedSettings.operation` に raw 値を保持し、アプリ側の環境反映に渡せる形にする。JWWバイナリ抽出は未昇格。                                      |

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

JWW Gateway の変換JSONは `docs/jww-gateway-json.schema.json` と `tools/jww-schema-validate.mjs` で最低構造を固定する。現在の固定対象は、基本ヘッダ、`bounds`、代表エンティティ形状に加えて、JWW/JWF環境情報のうち `meta.colorSettings`、`meta.lineTypeSettings`、`meta.jwwEnvironment.coverage` である。

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

単体配布フォルダ `..\JWW_Gateway` には `JWW_GATEWAY_MANIFEST.json` を生成する。manifest は、対応CLI、対応エンコーディング、出力スキーマ、機能有無、JWF専用操作キー、未確定環境キー、配布ファイル一覧を機械的に伝えるためのもの。manifest の形は `docs/jww-gateway-manifest.schema.json` に固定し、生成と検証の共通ルールは `src/jww/gatewayManifest.js` に置く。配布対象ファイル一覧は `src/jww/gatewayPackageFiles.js` に集約し、`package-jww-gateway.mjs` と `jww-gateway-smoke.mjs` が同じ一覧を使い、manifest の `packageFiles` にも出力する。`tools/jww-manifest-validate.mjs` はこの共通ルールで manifest JSON を単独検証するCLI。`--check-files` 付きでは、manifest と同じフォルダを基準に `packageFiles` の実在確認も行う。`unresolvedEnvironmentKeys` は空、`jwfOnlyOperationKeys` は `LTYPE_HC`、`LCOLLOR_M`、`LAYCOL/LAYWID/LAYTYP_0..F` の計50キーとする。`capabilities.jwwWrite` はv600/v700限定writerの追加により `true` とする。v700全対応種のJw_cad 10.02.1実機ゲートは完了し、独立作図・版全体の互換性は`jww-version-conformance`に残す。
manifest の `capabilities.valueScanSummary` と `capabilities.promotionCandidateGate` は、`value-scan:summary` と `--fail-on-promotion-candidates` が使えることを外部アプリへ伝える。

単体配布版 `JWW_Gateway` には `verify` コマンドを持たせる。`verify` は smoke と `manifest:validate --check-files` を連続実行し、公開前に配布物の欠落を確認する。生成レポートは `reports\` に出す運用とし、このフォルダはパッケージ再生成時に作り直される。
`verify:report` は公開・受け渡し用の短い検証レポートを生成する。manifestの妥当性、必須ファイル欠落、scripts/binのズレ、capability、未解決キーをまとめ、`reports\verify-report.txt`、`reports\verify-report.json`、または `reports\verify-report.html` に保存する。
`verify:report --expect-no-unresolved` を使うと、未解決キーが1件でも追加された場合を検証エラーにできる。
JSON/CSV/HTMLには manifest 掲載ファイルのサイズとSHA-256も出力し、受け渡し後に配布物が変わっていないか比較できるようにする。
`verify:reports` は txt/json/csv/html の受け渡しレポートを一括生成する。
`verify:all` は `verify` と `verify:reports` を連続実行し、配布物検証と受け渡しレポート生成を一括で行う。
`reports\README.md` と `docs/JWW_GATEWAY_REPORTS.md` には、`verify-report`、`sample-plan`、coverage、JWF比較、value-scan、special-color、layer-defaults など生成レポートの置き場と種類をまとめる。
`verify:handoff` は `verify:all` の後に `--expect-no-unresolved` を実行し、受け渡し時に未解決キーが追加されていないことを検出する。
`status` は単体配布フォルダの準備状態、欠落数、未解決キー、bounded JWW writerの有無を短く表示する。
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

1. JWW 内の文字種プリセット `MSET` / `MWIDE` / `MHIGH` / `MDIST` / `MPEN` 相当を抽出する。
2. `postLineTypeTailCandidate` は `LTYPE_HC` と無関係な診断領域として保持し、公式仕様で別フィールドを特定できるまで意味付けしない。
4. `LCOLLOR_G/H/B`、`PCOLLOR_G` など特殊色の意味付けを固定する。
5. `LTYPE_*` と `PCOLLOR_* pointRadius` は対応済み。実ファイル差分で誤検出がないか継続確認する。

### 優先度 B: 印刷再現に効く

1. `S_COMM_2` 相当の線幅単位、印刷背景、印刷基準点を抽出する。
2. プリンタ倍率、回転、基準点、埋め込み文字表示設定を整理する。
3. 寸法設定 `S_STR*` / `S_SET*` を構造化する。

### 優先度 C: 操作環境・UI再現

1. `KEY*`、`LD_*`、`RD_*`、`COM_*`、`GCOM_*`。
2. `ZOOM`、`S_MESH_*`、`R_CROSS_SET`。
3. JWWバイナリ内の AUTO モード、クロックメニュー、コマンド別環境の保存位置確認。`.jwf` テキストの読込は `normalizedSettings.operation` に昇格済み。

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
`LAYCOL_*` / `LAYWID_*` / `LAYTYP_*` の履歴・単独変更証拠を確認する場合は `layer-defaults:audit` を使う。現在は48キーを `gatewayStatus: not-serialized` とし、`nonSerialized` 件数へ集計する。複数セットを比較する場合は、各 audit を `--json` で保存してから `layer-defaults:summary` に渡す。旧監査JSONのmissing/ambiguous/direct match情報も読み取れるが、非シリアライズキーはpromotion candidateから除外する。

JWF自体は `npm run jwf:parse -- <file.jwf>` でJSON化できる。`Sample.jwf` は先頭の `END` 以降が説明用なので、棚卸し用途では `--include-after-end` を付ける。

JWWから抽出済みの環境情報とJWFキーを突き合わせる場合は、次を使う。

```powershell
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end
npm run jwf:compare -- "C:\path\to\file.jww" "C:\jww\Sample.jwf" --include-after-end --html -o jwf-compare.html
```

これにより、JWF側の各キーが `extracted`、`missing`、`not-tracked` のどれに該当するかを一覧化できる。
HTML/CSVでは JWFパーサの `entry.definition` を Meaning 列に出すため、未対応項目の用途を見ながら優先順位を決められる。

値そのものが JWW バイト列内に存在するかを調査する場合は `jwf:value-scan` を使う。全て0、全て-1などの低情報量な連続数値は、JWW内の空白領域や初期化領域にも一致しやすいため `ambiguous` として扱う。`LAYCOL_*` / `LAYTYP_*` が全0のJWFで見つかる一致は、非シリアライズ契約では偶然一致として扱い、抽出済みへ昇格しない。共有・目視確認用には `--html -o value-scan.html` でHTMLレポートも出力できる。

## 調査メモ

- `PCOLLOR_*` は画面色テーブルから少し離れた位置にある `RGB + width + pointRadius` 形式の印刷色テーブル候補を優先採用する。`M-07 1階平面図(衛生).jww` では `PCOLLOR_1..8` と `PCOLLOR_G` が `extracted` になる。
- `PCOLLOR_1..8` の実点半径は `pointRadius` として保持する。古い `rgb-width` 候補に戻った場合は点半径が欠落する可能性があるため、`printColorTableKind` と `printColorTableCandidates` を診断に残す。
- `LAYCOL_*`、`LAYWID_*`、`LAYTYP_*` はレイヤ名直後の領域や単純な16x16テーブル探索では確定できなかった。その後の単独変更Save As比較で、JWWへシリアライズされないJWF専用設定と確定した。
- `A-00-3 平面図.jww` + `建築.JWF`、`A-00 断面図.jww` + `断面図.JWF`、`A-11 仕上表.jww` + `仕上げ表.JWF` は、`LAYCOL_*` と `LAYTYP_*` がほぼ全0、`LAYWID_*` が全-1の初期値中心だった。値スキャンではゼロ領域との曖昧一致になりやすいため、保存位置特定の主サンプルには弱い。
- `A-00 断面図.jww` は JWW診断上 `A2`、14232 entities、`LAYNAM_*` は抽出済み、レイヤ名フォールバック3件。旧JWF比較は extracted 58 / missing 151、値スキャンは matched 42 / ambiguous 37 / missing 102 / not-scanned 28。`LAYCOL_*` / `LAYTYP_*` の全0と `LAYWID_*` の全-1は、当時の曖昧一致調査の記録として残す。
- `M-08 事務所棟 1階平面図(衛生設備).jww` + `設備.JWF` は `LAYCOL_*` / `LAYTYP_*` に差のある値を含み、単純配列の直接一致がないことを示した歴史的サンプルとして残す。

### Raw Environment Region Diagnostics

Gateway JSON now includes `meta.environmentRegion`, and `jwwEnvironment.raw.environmentRegion` mirrors it for audit use.
This region starts immediately after layer/group names and ends at the entity list marker. It does not promote values to JWF settings yet. Instead it reports:

- `afterLayerNamesOffset`
- `entityListOffset`
- `byteLength`
- repeated `u32PairRuns`
- early numeric `doubleSamples`

The purpose is to compare real JWW files before accepting new extraction rules for serialized text preset tables, hatch settings, and other JWF-like environment data. `LAYCOL_*`, `LAYWID_*`, and `LAYTYP_*` are retained only as historical non-serialization evidence.

`npm run env:scan -- <file-or-folder> --recursive --csv -o env-scan.csv` produces a compact multi-file table for this comparison.

### JWF value scan

`npm run jwf:value-scan -- <file.jww> <file.jwf> --include-after-end` searches the JWW bytes for exact numeric/color byte patterns derived from JWF entries. Add `--json`, `--csv`, or `--html` to generate machine-readable output, table data, or a review report.
It is an investigation tool, not proof that a JWF setting has been fully decoded. Short or repeated numeric arrays can match unrelated data, but stable offsets across files are useful candidates for promotion into the parser.
The scanner checks color byte patterns, RGB triplets, and `u8`, `u16`, `i16`, `u32`, `i32`, and `f64` numeric sequences. JSON/CSV/HTML output includes `testedPatterns`, so missing rows still show which byte layouts were tried. Historical reports compared the old `LTYPE_HC_candidate`; current output marks `LTYPE_HC`, `LCOLLOR_M`, and all `LAYCOL/LAYWID/LAYTYP_0..F` keys as non-serialized JWF keys and exposes the unrelated post-line-type bytes only through the neutral diagnostic name.

For `M-07 1階平面図(衛生).jww` with `設備設計用.jwf`, the scan finds many `LTYPE_*` rows and `LCOLLOR_1..8` as byte patterns. `LTYPE_02..09`, `LTYPE_R1..R5`, and `LTYPE_L1..L4` are promoted to structured parser output. The lack of an `LTYPE_HC` match was later explained by its JWF-only operation scope.

`M-08 事務所棟 1階平面図(衛生設備).jww` + `設備.JWF` は `LAYCOL_*` / `LAYTYP_*` に非ゼロ値が混ざる確認用セットとして有効だった。`u8/u16/i16` 追加後も非ゼロのレイヤ既定色・線種テーブルは直接バイト列として見つからず、後述の単独変更試験による非シリアライズ結論と整合する。
現在は `--family layerColors,layerLineTypes,layerWidths --gateway-status not-serialized` で48行を確認できる。
`LTYPE_HC` と `LCOLLOR_M` も同じ `not-serialized` 分類であり、drawing missing件数には含めない。
`LCOLLOR_M` の追加調査には `special-color:audit` を使う。これはJWWの検出済み色テーブル周辺をRGB tripletとして走査し、JWFの `LCOLLOR_M` 色との距離順に候補を出す。現時点では候補監査用であり、直接抽出には昇格しない。
複数のspecial color audit JSONは`special-color:summary`で横断集計できる。この監査で直接一致がなかったことは、後の単独変更試験で`LCOLLOR_M`がJWF専用のズーム操作文字色と確定した結果と整合する。
`A-00-3 平面図`、`M-08 衛生設備`、`A-00 断面図`、`A-11 仕上表` の special color audit JSON を `special-color:summary --fail-on-direct-matches` で横断したところ、4レポート96候補で `directMatches: 0`。最も近い繰り返し候補は相対 `+248/+249` の `#c3c3c3`、平均距離 `8.66` だった。期待値そのものではないため、抽出昇格は行わない。
`--key LTYPE_HC,LCOLLOR_M` で `A-00 断面図`、`A-00-3 平面図`、`A-11 仕上表`、`M-08 衛生設備` の4セットを横断確認した旧レポートでは、4セットすべてで直接一致なしだった。現在のscannerは両キーを `nonSerializedJwfKey: true`、`comparisonRequired: false` とする。
複数の旧 `--key LTYPE_HC,LCOLLOR_M --json` レポートは `core:summary` で横断集計できる。これらは非シリアライズ結論に至るまでの履歴証拠であり、新しいparser昇格ゲートではない。

`--family text --json` で `A-00-3 平面図`、`A-00 断面図`、`A-11 仕上表`、`M-08 衛生設備` の4セットを横断確認した。4セットすべてで `MSET`、`MWIDE`、`MHIGH`、`MDIST`、`MPEN`、`MOFST` は `missing`、`MHEN` は文字列/フォント名設定のため `not-scanned` だった。したがって、文字種プリセットは現時点では単純な連続数値テーブルとしてはJWW内に見つかっていない。各文字エンティティの `font_name`、`size_x`、`size_y`、`spacing`、`base.pen_color` は引き続き個別実体値として保持する。

`--family dimensions,hatch --json` でも同じ4セットを横断確認した。低情報量判定を強めた後は、`S_STR2`、`S_STR3`、`HATCH_4` は `ambiguous` になり、抽出候補としては残るが昇格対象ではない。`S_STR3` は全0、`S_STR2` は短い0/1列、`HATCH_4` は候補一致数が多すぎるため、寸法・ハッチ設定表としては未確定扱いを維持する。寸法エンティティの線・文字そのものは既存パーサで個別実体として扱う。
複数の value-scan JSON は `value-scan:summary` で横断集計できる。文字、寸法、ハッチのようにファミリ単位で調べる項目は、`core:summary` よりこちらを使い、status/family/key ごとの傾向を見てから抽出へ昇格する。`text-preset-cross-sample-summary.json/html/csv` は4レポート28行を集約し、`missing 24 / not-scanned 4`。`document-settings-cross-sample-summary.json/html/csv` は4レポート56行を集約し、`missing 44 / ambiguous 8 / not-scanned 4`。
`--family general --json` では `S_COMM_0..9` を4セット横断確認した。`general-settings-cross-sample-summary.json/html/csv` は4レポート40行を集約し、`missing 37 / ambiguous 3`。`S_COMM_8` だけ一部ファイルで短い `u8` 列に一致したが、同じ列が複数箇所に出るため `ambiguous` に倒した。`S_COMM_*` は現時点では専用構造として抽出へ昇格しない。
`--scope operation --json` では `S_COMM_*`、クロックメニュー、コマンド、キー割当を4セット横断確認した。`operation-settings-cross-sample-summary.json/html/csv` は4レポート301行を集約し、低情報量判定を強めた後は `missing 197 / ambiguous 60 / not-scanned 44 / matched 0`。`KEY_*` や `LD2_AM` などは短い2値配列、または0が大半の疎な配列として偶然一致しやすいため、JWWバイナリ抽出へは昇格しない。一方、`.jwf` テキストファイルから読み込む operation scope は `normalizedSettings.operation` として正規化済みで、接続アプリが基本設定・クロックメニュー・キー割当へ反映するための入力として利用できる。
フィルタなしの全項目スキャンも4セット横断で再生成した。`full-value-scan-cross-sample-summary.json/html/csv` は4レポート837行を集約し、現在の保守的判定では `missing 400 / ambiguous 286 / not-scanned 120 / matched 31`。`matched` が残るキーは10種類で、すべて Gateway が既に `gatewayExtracted` として扱う線種・色系だった。未抽出なのに `matched` になっているキーは0件。`ZF_SET` の `[-1,-1,0,0,0,0]` のような初期値らしい短い列は `ambiguous` に倒した。`value-scan:summary` は `promotionCandidates` も出力し、この総合サマリでは `promotionCandidates: 0` と確認できる。`--summary --fail-on-promotion-candidates` を付けると、短い確認レポートを出しつつ昇格候補が残る場合に終了コード2で失敗するため、今後の検証ゲートに使える。

### Generated JWF/JWW fixture pairs

2026-06-05 に、Jw_cad 10.02.1 で JWF を起動時読込みした状態から、次の実 JWW/JWF ペアを作成した。

- `samples/jwf-pairs/jwf-open-items-core.jwf` / `.jww`
  - `LTYPE_HC = 2 3 1 4 5 2`
  - `LCOLLOR_M = 12 34 56`
- `samples/jwf-pairs/jwf-open-items-layer-defaults.jwf` / `.jww`
  - `LAYCOL_0`、`LAYWID_0`、`LAYTYP_0` に初期値へ埋もれにくい識別値を設定

`docs/JWW_GATEWAY_SAMPLE_SETS.local.json` はこの2ペアを指すローカル検証 manifest として追加した。`sample:plan` では `samples: 2`、`complete: 2`、`missingFiles: 0` を確認済み。

この実ペアで `jwf:value-scan --key LTYPE_HC,LCOLLOR_M`、`special-color:audit`、`layer-defaults:audit` を実行した結果、次の通りだった。

- `LTYPE_HC`: JWF値 `2,3,1,4,5,2` に対し、JWW側候補は `1,1,61,0,1,0` で `directU32Match: false`
- `LCOLLOR_M`: JWF値 `#0c2238` に対し、RGB triplet と特殊色候補の直接一致はなし。`directSpecialMatch: false`、`directMatches: 0`
- `LAYCOL_0` / `LAYWID_0` / `LAYTYP_0`: `u8`、`u16`、`i16`、`u32`、`i32`、`f64` の各連続パターンで直接一致なし。`promotionCandidates: 0`

この時点ではこれらを未解決またはaudit-onlyとしていたが、以下の2026-08-30単独変更試験によってJWF専用操作設定と確定した。

### 2026-08-30 `LTYPE_HC` / `LCOLLOR_M` 単独変更試験

Jw_cad 10.02.1で同一の1-LINE図面へ、baselineと各1項目だけを変えたJWFを順番に読み込み、毎回別名JWWへSave Asした。`LTYPE_HC`は6フィールドをそれぞれ単独変更し、`LCOLLOR_M`は`200 200 200`から`0 255 0`へ変更した。さらにbaselineをもう一度保存し、設定差と保存ごとの可変値を分離した。

- 全9出力は19,355 bytesでGateway再parseがclean、semantic diffはdrawing/document/internal settingsすべてequal。
- 全ファイルのバイト差はoffset 2396、2472、6600付近だけ。baseline再保存でも同じ3箇所が変化した。
- 公式`jwdatafmt.txt`により、2396はレイヤ群直後の14 DWORDダミーの先頭、2472は寸法設定直後のDWORDダミー、6600は作図時間`m_lnDrawTime`と確認した。
- 線種テーブル直後の従来`LTYPE_HC_candidate` 24 bytesは全9出力で不変だったため、`LTYPE_HC`ではない。`postLineTypeTailCandidate`へ改名した。
- `LCOLLOR_M=0 255 0`で保存したJWWをbaseline環境で再読込しても、Jw_cadのズーム文字色は`200 200 200`のままだった。
- `LTYPE_HC`の端点形状を`2`（フラット）にして保存したJWWをbaseline環境で再読込しても、端点形状は`丸`のままだった。

以上により、`LTYPE_HC`と`LCOLLOR_M`はJWFの操作・表示プロファイル値であり、JWW native documentの保存対象ではない。直接一致がないことはparser未対応ではなく、JWWへシリアライズされないという仕様・実挙動による。

### 2026-08-30 `LAYCOL` / `LAYWID` / `LAYTYP` 単独変更試験

Jw_cad 10.02.1で同一の6-entity図面へ、baselineと各1項目だけを変えたJWFを順番に読み込み、毎回別名JWWへSave Asした。baselineは`LAYCOL_0`全0、`LAYWID_0`全-1、`LAYTYP_0`全0とし、variantはグループ0・レイヤ1だけをそれぞれ`color=8`、`width=250`、`lineType=5`へ変更した。

- 4出力はすべて19,355 bytesで、Gateway native parseは6 entities、unsupported/skipped 0、source spansあり、trailing bytes 0。
- 3 variantはbaselineに対して`drawingSemanticEqual`、`drawingRoundTripCompatible`、`roundTripCompatible`、`documentMetadataEqual`、`internalSettingsEqual`、`parserClean`がすべてtrue。
- colorとwidthの差は4 bytesだけで、offset 2396-2397、2472、6600。line typeの差は6 bytesだけで、2396-2397、2472-2473、6600-6601。
- これらは`LTYPE_HC` / `LCOLLOR_M`試験でも変化した保存セッション可変領域であり、公式`jwdatafmt.txt`上はレイヤ群直後のdummy DWORD、寸法設定直後のdummy DWORD、`m_lnDrawTime`に対応する。レイヤ既定値テーブル本体と解釈できる差分はない。

以上により、`LAYCOL_0..F`、`LAYWID_0..F`、`LAYTYP_0..F`は、`Sample.jwf`が説明する書込レイヤ切替時のJWF操作既定値であり、JWW文書へシリアライズされない。GatewayはJWF parser/Environment Profileでは値を保持するが、JWW coverageでは50個のJWF専用キーの一部として`not-serialized`に分類し、JWW parser/writerの欠落やopen itemには数えない。

### Post-line-type diagnostic tail（旧 `LTYPE_HC_candidate`）

`LTYPE_L4` の直後24 bytesは `postLineTypeTailCandidate` として保持する。単独変更試験でJWFの `LTYPE_HC` 6フィールドと連動しないことを確認したため、`LTYPE_HC`というキー名や6項目の意味は付与しない。既存実ファイル比較のためraw `u32` / `u16`だけを中立な診断値として残す。

The same pair also helped identify the official contiguous print table. Gateway now reads all ten `RGB + width + pointRadius` rows directly after the 80-byte screen table, so `PCOLLOR_1..8` and `PCOLLOR_G` retain their point radii without falling back to a plain RGB/width candidate.

### UTF-16LE inline JWW strings

Some JWW files store individual strings with an inline `FF FE FF` marker even when the import encoding is `shift_jis`.
The parser now treats this as a UTF-16LE string marker, so a memo such as CRLF no longer shifts the paper, layer, and entity offsets.
If the layer-name block still looks binary after decoding, Gateway falls back to default layer names and reports `layerNamesExtracted: false`; those `LAYNAM_*` keys are not counted as extracted in JWF coverage.
