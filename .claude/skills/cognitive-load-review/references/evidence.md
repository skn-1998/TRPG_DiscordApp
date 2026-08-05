# 一次情報の裏取り台帳（evidence ledger）

このスキルの主張と、その根拠となる一次情報の対応表。全ソースは 2026-07-14 に原典を直接取得して確認した
（書籍は本文、論文は原文/アブストラクト、Web 文書は本体）。trusted-source ポリシーに従い、
一次情報（原著論文・原著書籍・著者本人の文書・ベンダー公式文書）のみを採用している。
まとめサイト・二次記事は根拠に使っていない。

## 主張 → 出典の対応表

| スキルの主張 | 出典 | 確認状況 |
|---|---|---|
| 作業記憶は同時に約 4 チャンク | Cowan 2001 [S2] | 原文どおり（3〜5、中心値 4） |
| チャンク化で保持情報量を拡張できる | Miller 1956 [S1] | 原文どおり（7±2 とリコーディング） |
| intrinsic / extraneous の区別 | Sweller 1988・Sweller et al. 1998 [S3]、コードへの適用は Zakirullin [S6] | 原文どおり |
| 認知負荷=タスク完了に知る必要がある量 | Ousterhout 2018 §2.2 [S4]（症状としての cognitive load）、Zakirullin [S6] | 原文どおり |
| 複雑性の原因は依存と不明瞭さ | Ousterhout 2018 §2.3 [S4] | 原文どおり |
| 変更増幅・認知負荷・unknown unknowns の 3 症状 | Ousterhout 2018 §2.2 [S4] | 原文どおり |
| 深い/浅いモジュール、classitis | Ousterhout 2018 §4.4–4.6 [S4] | 原文どおり |
| 行数・分岐数は理解しにくさの代理にならない | Campbell/SonarSource [S5]（CC は理解容易性を測れない）、Peitek et al. 2021 [S8]（McCabe は認知指標と相関せず） | 原文どおり |
| 依存の追跡（ホップ・非局所性）が負荷の中心 | Peitek et al. 2021 [S8]（DepDegree が脳活動・行動指標と相関）、Ousterhout §2.3 [S4] | 原文どおり |
| 開発時間の過半は理解に費やされる | Xia et al. 2018 [S7]（実測約 58%） | 原文どおり |
| 重複は誤った抽象より安い / 共有抽象は結合を生む | Metz 2016 [S9] | 原文どおり |
| ネストは線形フローの中断として負荷を増やす | Campbell/SonarSource [S5]（増分ルール） | 原文どおり |

## 出典詳細

### S1. Miller (1956) — 7±2 とチャンク

- Miller, G. A. (1956). The magical number seven, plus or minus two: Some limits on our capacity
  for processing information. *Psychological Review*, 63, 81–97.
  https://psychclassics.yorku.ca/Miller/
- 確認内容: 即時記憶の範囲は内容の情報量にほぼ依存せず約 7 チャンク。リコーディング
  （意味のある大きな単位への再符号化）で保持できる総情報量を増やせる。
- スキルでの使い方: 「チャンク」概念の原典。容量の数値自体は S2 で更新されているため、
  スキル本文の数値は 4 を採用。

### S2. Cowan (2001) — 約 4 チャンク

- Cowan, N. (2001). The magical number 4 in short-term memory: A reconsideration of mental
  storage capacity. *Behavioral and Brain Sciences*, 24(1), 87–114.
  https://pubmed.ncbi.nlm.nih.gov/11515286/
- 確認内容: リハーサルや長期記憶による再チャンク化を遮断した条件で、中心的な容量限界は
  平均約 4 チャンク（3〜5）。Miller の 7 という見積もりの再検討。
- スキルでの使い方: 「同時保持数」プロキシの理論的上限。同時把握が 4 項目を大きく超える
  構造を負荷源とみなす根拠。

### S3. Sweller (1988) / Sweller, van Merriënboer & Paas (1998) — 認知負荷理論

- Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science*, 12, 257–285.
- Sweller, J., van Merriënboer, J. J. G., & Paas, F. (1998). Cognitive architecture and
  instructional design. *Educational Psychology Review*, 10, 251–296.
  20 年後のレビュー: https://link.springer.com/article/10.1007/s10648-019-09465-5
- 確認内容: intrinsic load は素材固有の要素間相互作用（element interactivity）に由来し、
  提示方法では除去できない。extraneous load は提示・手順の設計に由来し、設計変更で削減できる。
  germane load はスキーマ構築に振り向けられる資源（学習文脈の概念）。負荷は加算的で、
  合計が作業記憶容量を超えると処理の質が落ちる。
- スキルでの使い方: intrinsic / extraneous 二分の原典。germane はコードレビュー文脈では
  対象外のため意図的に採用していない（教育設計の概念）。

### S4. Ousterhout (2018) — A Philosophy of Software Design

- Ousterhout, J. K. (2018). *A Philosophy of Software Design*. Yaknyam Press.（第2版 2021）
  https://web.stanford.edu/~ouster/cgi-bin/book.php
- 確認内容（本文 §2.1–2.3, §4.4–4.6 を直接照合）:
  - 複雑性の定義: システムを理解・変更しにくくする構造上のすべて（§2.1）。
  - 3 症状（§2.2）: 変更増幅（単純な変更が多数箇所の修正を要求する）、認知負荷
    （タスク完了のために開発者が知る必要のある量。負荷が高いほど学習時間が増え、
    見落としによるバグのリスクが増える）、unknown unknowns（どこを直せばよいか・
    何を知る必要があるかが分からない。最悪の症状）。
  - 2 原因（§2.3）: 依存（あるコードを単独で理解・変更できず、他のコードを考慮・修正する
    必要がある状態）と不明瞭さ（重要な情報が明白でない状態）。
  - 深いモジュール=単純なインターフェースの下に大きな機能を隠す。浅いモジュール=
    インターフェースの複雑さの割に機能が少なく、複雑さをほとんど隠さない。
    モジュールの便益は機能、コストはインターフェース（§4.4–4.5）。
  - classitis: 「クラスは小さくすべき」の極端化で浅いクラスが量産され、システム全体の
    複雑性が増す症候群（§4.6）。
- スキルでの使い方: モード A の読者シミュレーション（変更に必要な把握量を数える）は
  この本の複雑性定義の操作化。浅いモジュール・間接層の類型の根拠。

### S5. Campbell / SonarSource (2023) — Cognitive Complexity 白書

- Campbell, G. A. *Cognitive Complexity: a new way of measuring understandability*.
  SonarSource, v1.7 (2023-08-29). https://www.sonarsource.com/docs/CognitiveComplexity.pdf
- 確認内容（本文 pp.2–5 を直接照合): Cyclomatic Complexity はテスト容易性の測定には優れるが
  理解容易性の測定には数理モデルが不適切（同じ CC 値でも理解の難しさが著しく異なる例を提示）。
  Cognitive Complexity の基本 3 規則: ①可読な省略記法は数えない ②線形フローの中断
  （分岐・ループ・catch・ラベルジャンプ・論理演算子列・再帰）で加算 ③フロー中断構造の
  ネストで追加加算。
- スキルでの使い方: 「行数・分岐数は負荷の代理にならない」「ネスト・フロー中断が負荷」の根拠。
  ただしこのメトリクスは関数内の制御フローに限定されるため、スキルはファイル横断のホップ・
  非局所性を別プロキシとして補完している（白書の適用範囲外を明示的に補う設計）。

### S6. Zakirullin — Cognitive load is what matters

- Zakirullin, A. *Cognitive load is what matters*. https://github.com/zakirullin/cognitive-load
- 確認内容: 認知負荷=タスク完了のために開発者が考える必要のある量。intrinsic / extraneous の
  コードへの適用。負荷源リスト（複合条件式、深い継承、浅いメソッド/クラス/モジュールの過剰、
  フレームワークの魔法、層状アーキテクチャの間接、DRY の過剰適用、自己記述的でない
  HTTP ステータスコードの流用など）。深い/浅いモジュールは Ousterhout を出典として引用。
  作業記憶約 4 チャンクにも言及。
- スキルでの使い方: 負荷源カタログ（references/load-sources.md）の類型の多くと重なる
  実務側の整理。位置づけは「実務者による総説」であり、理論的根拠は S2–S5 に還元して確認済み。

### S7. Xia et al. (2018) — 理解時間の実測

- Xia, X., Bao, L., Lo, D., Xing, Z., Hassan, A. E., & Li, S. (2018). Measuring program
  comprehension: A large-scale field study with professionals. *IEEE Transactions on
  Software Engineering*, 44(10), 951–976. https://ieeexplore.ieee.org/document/8453126
- 確認内容: 職業開発者 78 名・延べ 3,148 時間の行動計測で、作業時間の平均約 58% が
  プログラム理解に費やされていた。
- スキルでの使い方: 理解コストが開発作業の重要な独立軸であることの実証。読む/書く比率の
  逸話的な引用（例: 10:1）の代わりに、この実測値を採用する。変更容易性全体との同一視には使わない。

### S8. Peitek et al. (2021) — 複雑性メトリクスと脳活動

- Peitek, N., Apel, S., Parnin, C., Brechmann, A., & Siegmund, J. (2021). Program comprehension
  and code complexity metrics: An fMRI study. *ICSE 2021*, 524–536.
  https://dl.acm.org/doi/10.1109/ICSE43902.2021.00056 （ACM SIGSOFT Distinguished Paper）
- 確認内容: 19 名の fMRI 実験で 41 のコード複雑性メトリクスと認知処理の相関を検証。
  McCabe（Cyclomatic Complexity）は一貫して有意な相関なし。DepDegree（データフロー依存度）は
  脳活動・応答時間・正答率のすべてと相関。LOC・Halstead（語彙量）は小〜中程度の相関。
- スキルでの使い方: 「分岐数より依存・語彙の量を数えるべき」という計測プロキシ設計
  （ホップ数・非局所性・概念数）の実証的根拠。制約: 小規模サンプル・短いスニペットでの
  実験であり、ファイル横断の負荷への外挿は本スキルの推論である点に注意。

### S9. Metz (2016) — The Wrong Abstraction

- Metz, S. (2016-01-20). *The Wrong Abstraction*.
  https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction
- 確認内容: 重複は誤った抽象よりはるかに安い。誤った抽象は新要件のたびに引数と条件分岐を
  蓄積して理解不能になっていく。対処は抽象の維持ではなく、呼び出し元へのインライン化による
  重複の再導入と、各呼び出し元に必要なコードだけを残す整理。sunk cost に抗うこと。
- スキルでの使い方: 「共有抽象結合」類型と、その修正方向（分割して素直に重複させる）の根拠。

## スキル独自の拡張（出典がスキル外の判断であるもの）

正確さのために、出典で直接支持されていない部分も明示する:

- **5 つの計測プロキシの構成**は、S2（容量）・S4（依存・不明瞭）・S5（フロー中断）・
  S8（依存度・語彙の実証）を工学的に操作化したもので、検証済みの測定器ではない。
  数値は判定の補助であり、閾値の機械的適用は意図していない。
- **重大度 = 負荷 × 実測変更頻度**の優先度式は、Ousterhout のコスト/便益の枠組み
  （§4.5）と本リポジトリの pc-config 監査（2026-07-14: 実害 0 件・runtime 呼び出し 0/166 の
  contract 群 4,800 行超を中止判定）から導いた運用ルール。
- **モード B（必要性監査）の 5 系統**は同監査で実際に機能した手順の一般化であり、
  文献由来ではなくプロジェクト由来。
