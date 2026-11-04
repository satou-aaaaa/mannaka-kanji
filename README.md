# まんなか漢字

まんなかに1文字入れて、上下左右の4つの熟語を完成させる1日3問の漢字パズル。

- 遊ぶ: https://satou-aaaaa.github.io/mannaka-kanji/
- 上の字＋まんなか・左の字＋まんなか・まんなか＋右の字・まんなか＋下の字が、どれも熟語になる字を札から選びます。答えは1つだけ。
- まちがえると、4つのうちいくつ熟語になったかが分かります。時間制限はありません。
- 今日の3問（やさしい・ふつう・むずかしい）はだれでも同じで1日1回。上級（むずかしい3問・札12枚・ヒントなし）、練習、集めた字が並ぶ漢字帳があります。
- 記録は遊ぶ人のブラウザにだけ残り、外へは何も送りません。

## 開発

```bash
bash scripts/setup.sh   # 最初に一度
node qa/run.mjs         # 検査（CI と同じ）
```

問題は `python3 tools/make-data.py <jamdict.db>` で作ります（決まりは AGENTS.md）。

## 出どころとライセンス

熟語と読みは [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html)（© Electronic Dictionary Research and Development Group）から作りました。JMdict は [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html) で、そこから作った `data.js` と `tools/words.txt` も CC BY-SA 4.0 です。

感想は [Issue のフォーム](https://github.com/satou-aaaaa/mannaka-kanji/issues/new?template=feedback.yml) からどうぞ。
