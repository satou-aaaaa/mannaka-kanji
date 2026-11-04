# AGENTS.md

まんなか漢字：まんなかに1文字入れて、上下左右の4つの熟語（上→中・左→中・中→右・中→下）を完成させる1日3問の漢字パズル（「和同開珎」の形）。`index.html` と `data.js`（問題758問）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs   # 答えが1つか（辞書で全部の字を試す）・札の印・入力の辞書 words.js・入力して答える（変換中の Enter・NFKC・かなだけ・別解・候補）・3問の組み方（3年分）・通しで遊ぶ・続きから・上級・漢字帳・Ko-fi・スマホ幅・PWA（CI の QA と同じ）
```

## このリポジトリの決まり

- 問題は `python3 tools/make-data.py <jamdict.db>` で JMdict から作る（`data.js`・`tools/words.txt` を手で直さない）。jamdict.db は PyPI の jamdict-data の中の `jamdict.db.xz` を解いたもの。熟語はよく使う語（ichi1・news1・spec1）で常用漢字だけ、答えは1つ（ほかのどの字でも4つは揃わない）。QA が `tools/words.txt`（JMdict の2字の漢字語すべて）で確かめ直す。
- JMdict は © EDRDG、CC BY-SA 4.0。`data.js`・`words.js`・`tools/words.txt` も CC BY-SA 4.0 で、画面の遊び方と README に出どころを書く（消さない）。
- 数字だけの語・つらい言葉（死・殺など）は使わない（QA が見る）。
- 難しさはよく使う順の目安で3つ（やさしい・ふつう・むずかしい）。今日の3問は1つずつ、上級はむずかしい3問。むずかしいは1日4問ずつ使い、今日の3問目と上級は重ならない。1周するまで同じ問題は出ない。
- 今日の3問・上級・候補の並びは日本時間の日付と問題から作る乱数（`seedOf`・`rng`）で決まり、だれでも同じ。`Math.random()` は練習の問題選びだけ（QA が数を見る）。`data.js` を作り直すと過去の日の問題も変わるので、作り直した PR に一言書く。
- 答えは入力欄に漢字を1字打つ（2026-11-04 satou さん「漢字系のゲームは、選択肢ではなく、入力してもらう形のほうが良いかも」）。変換中の Enter（`isComposing`・`keyCode 229`）では送らない。打った文字は空白を消して NFKC でそろえ、盤の字を除いた漢字を見る（熟語ごと打っても通る）。かなだけ・同じ字の打ち直しはまちがいに数えない。4つとも辞書の熟語になるほかの字は「別解」として正解にする。
- まちがえた字は、4つのうちいくつ熟語になったか（盤の ○×・下に残る字の「n/4」）を出す。考える手がかりにするため。打った字の印は `words.js`（`node tools/make-words.cjs` が `tools/words.txt` から作る。手で直さない）で数え、`data.js` の札の印 `m` と同じになる（QA が見る）。★はまちがい＋ヒントの数（0で★3・1で★2・それ以上★1）。ヒントは読みを2つ、最後に候補4つ（`tilesOf(p, 4)`。ヒント3回で★1）。上級はヒントも候補もなし（入力だけ）。時間制限は付けない。
- 今日の3問・上級は1日1回で、途中で閉じても打った字とヒントのまま続きから。途中経過はモードごとに分けて保存し（`runs.d`・`runs.h`・`runs.p`）、練習で今日・上級の途中を消さない。答えを入れる前に、保存した進み具合が画面と同じ問題か確かめる（古いタブで二重に入れない）。記録は保存の前に読み直す。
- 実績（`ACH`、13個）は記録（`days`・`hdays`・`late`・`dex`）から毎回数える。新しく残すのは「見せた」印の `ach` だけ。腕前・集める・続けるを混ぜ、続けるは連続でなく合計で数える。実績を足したら QA の数（13）も直す。正解の瞬間は4つの熟語が順に灯る（`.board.lit`）。
- 記録（カレンダー）から、遊んでいない過去7日（`EPOCH` より前は無し）の今日の3問をあとから遊べる（`dailyList(その日)` と同じ問題）。途中経過は日付ごとに `runs["a:日付"]`、結果は `late` に分けて置き、`days`（今日の記録）・連続の日・Ko-fi の1行には数えない（実績と漢字帳には入る）。連続の日は1以上のときだけ出す。`load()` は統合の前に両方を `fresh()` で補い、片方にしか無い記録（`ach`・`late` など）を失わない。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文に答えの字・熟語を出さない（🟩正解・🟨2つ以上なった字・⬜1つ以下・💡ヒント）。
- 文字は少なめ・一画面一問。お笑いの言葉は入れない（QA が見る）。ほかの作品の名前・キャラ・見た目は使わない。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、ラベル「感想」）を開くだけ。項目は shared-workflows の `template/.github/ISSUE_TEMPLATE/feedback.yml` と同じにし、名前・メールは聞かない。週1で shared-workflows `routines/game-feedback.md` が読んで直す。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の3問・上級を初めて終えて全問一発のときだけ、結果の画面の下に1行（共有フォルダ kofi/app-guide.md）。遊ぶのは無料のまま、有料版は置かない。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。記録は遊ぶ人のブラウザ（localStorage）だけ。
- 同じ日はどの端末でも同じ問題にする：乱数は `sort` の比較の中で引かない（QA が見る）。少し遅れて動く処理（setTimeout）は、画面が替わっていたら何もしない。
- 押せる所は高さ44px以上（QA が見る）。機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何年分も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（今日の答えを入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
