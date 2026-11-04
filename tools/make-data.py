#!/usr/bin/env python3
"""まんなか漢字の問題を JMdict から作る（標準ライブラリだけ）。

使い方: python3 tools/make-data.py <jamdict.db>
  jamdict.db は PyPI の jamdict-data（JMdict・KANJIDIC2 を SQLite にしたもの）の中の jamdict.db.xz を解いたもの。
  JMdict・KANJIDIC2 は © EDRDG、CC BY-SA 4.0（https://www.edrdg.org/edrdg/licence.html）。作った data.js も CC BY-SA 4.0。

問題の決まり（QA も同じことを見る）:
- まんなかの字 X と、上 A・左 B・右 C・下 D で「AX」「BX」「XC」「XD」の4つの熟語ができる。
- 4つの熟語はどれも JMdict のよく使う語（ichi1・news1・spec1 の印）で、字はすべて常用漢字。
- 答えは1つ：X 以外のどの字を入れても、4つすべてが JMdict の語（よく使う語に限らない）になることはない。
- 数字だけの語・つらい言葉（死・殺など）は使わない。
"""
import sqlite3, collections, json, random, sys

if len(sys.argv) < 2:
    sys.exit("使い方: python3 tools/make-data.py <jamdict.db>")
c = sqlite3.connect(sys.argv[1])
grade = {l: g for l, g in c.execute("select literal, grade from character")}
JOYO = {k for k, g in grade.items() if g in ("1", "2", "3", "4", "5", "6", "8")}
NUM = set("一二三四五六七八九十百千万億兆零")
NG = set("死殺葬屍姦淫娼尿糞呪遺棺骸刑獄墓弔喪病癌毒虐暴拷凶犯罪賊奴隷")
isk = lambda ch: "一" <= ch <= "鿿"

rows = c.execute("select id, text, idseq from Kanji").fetchall()
broad = {t for _, t, _ in rows if len(t) == 2 and isk(t[0]) and isk(t[1])}
pri = collections.defaultdict(set)
for kid, p in c.execute("select kid, text from KJP"):
    pri[kid].add(p)
kana = collections.defaultdict(list)
for seq, t in c.execute("select idseq, text from Kana order by ID"):
    kana[seq].append(t)

common = {}  # 語 -> (よく使う順の目安 1〜48、読み)
for kid, t, seq in rows:
    if t not in broad or not (pri[kid] & {"ichi1", "news1", "spec1"}):
        continue
    if not (t[0] in JOYO and t[1] in JOYO) or (t[0] in NUM and t[1] in NUM) or (set(t) & NG):
        continue
    nf = [int(p[2:]) for p in pri[kid] if p.startswith("nf")]
    score = min(nf) if nf else 30
    if t in common and common[t][0] <= score:
        continue
    common[t] = (score, kana[seq][0] if kana[seq] else "")

before, after = collections.defaultdict(set), collections.defaultdict(set)
for w in common:
    before[w[1]].add(w[0]); after[w[0]].add(w[1])
bb, aa = collections.defaultdict(set), collections.defaultdict(set)
for w in broad:
    bb[w[1]].add(w[0]); aa[w[0]].add(w[1])

R = random.Random(20261104)
pool_decoy = sorted(k for k in JOYO if grade[k] in ("1", "2", "3", "4", "5", "6") and k not in NUM and k not in NG)
out = []
for X in sorted(JOYO - NUM - NG):
    As = sorted(before[X] - {X}, key=lambda a: (common[a + X][0], a))[:8]
    Cs = sorted(after[X] - {X}, key=lambda d: (common[X + d][0], d))[:8]
    best = None
    for i in range(len(As)):
        for j in range(i + 1, len(As)):
            for k in range(len(Cs)):
                for l in range(k + 1, len(Cs)):
                    A, B, C2, D2 = As[i], As[j], Cs[k], Cs[l]
                    if len({A, B, C2, D2, X}) < 5:
                        continue
                    if (aa[A] & aa[B] & bb[C2] & bb[D2]) - {X}:
                        continue  # ほかの字でも4つ揃うので答えが1つにならない
                    sc = max(common[A + X][0], common[B + X][0], common[X + C2][0], common[X + D2][0])
                    if best is None or sc < best[0]:
                        best = (sc, A, B, C2, D2)
    if not best:
        continue
    sc, A, B, C2, D2 = best
    words = [A + X, B + X, X + C2, X + D2]
    used = {A, B, C2, D2, X}
    def mask(Y):
        return (A + Y in broad) | (B + Y in broad) << 1 | (Y + C2 in broad) << 2 | (Y + D2 in broad) << 3
    near = [(bin(m).count("1"), Y, m) for Y in sorted(JOYO - NG - NUM - used) for m in [mask(Y)] if m]
    near.sort(key=lambda t: (-t[0], t[1]))
    strong = [(Y, m) for _, Y, m in near[:12]]
    R.shuffle(strong)
    decoys = strong[:6]
    rest = [Y for Y in pool_decoy if Y not in used and Y not in {d for d, _ in decoys}]
    R.shuffle(rest)
    decoys += [(Y, mask(Y)) for Y in rest[: 11 - len(decoys)]]
    out.append({"x": X, "s": sc, "w": words, "r": [common[w][1] for w in words], "d": decoys})

tier = lambda s: 0 if s <= 7 else 1 if s <= 15 else 2
P = sorted(out, key=lambda p: (tier(p["s"]), p["x"]))
print(f"問題 {len(P)}（やさしい {sum(tier(p['s'])==0 for p in P)}・ふつう {sum(tier(p['s'])==1 for p in P)}・むずかしい {sum(tier(p['s'])==2 for p in P)}）", file=sys.stderr)
lines = ",\n".join(json.dumps([p["x"], tier(p["s"]), p["w"], p["r"], [d for d, _ in p["d"]], [m for _, m in p["d"]]], ensure_ascii=False, separators=(",", ":")) for p in P)
js = f"""// まんなか漢字の問題。tools/make-data.py が JMdict から作る（手で直さない）。
// 熟語と読み：JMdict（© Electronic Dictionary Research and Development Group、CC BY-SA 4.0）。このファイルも CC BY-SA 4.0。
// 1問 = [まんなかの字, 難しさ(0やさしい 1ふつう 2むずかしい), [上+X, 左+X, X+右, X+下], [読み×4], [まちがいの札×11], [札ごとに4つのうち熟語になる所の印(1上 2左 4右 8下)]]
window.MK_DATA = {{ P: [
{lines}
] }};
"""
open("data.js", "w").write(js)
# QA が「答えが1つ」「札の印」を確かめ直すための、JMdict の2字の漢字語すべて（画面では使わない）
open("tools/words.txt", "w").write("# JMdict（© EDRDG、CC BY-SA 4.0）の2字の漢字語。tools/make-data.py が作る（手で直さない）\n" + "\n".join(sorted(broad)) + "\n")
