// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題（答え）は入れず、遊び方の例（まんなかは「？」）だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const cell = (ch, x, y, c) => `<div style="position:absolute;left:${x}px;top:${y}px;width:120px;height:120px;border:4px solid ${c ? "#c43d2b" : "#1f1b16"};${c ? "border-style:dashed;color:#c43d2b;" : ""}border-radius:14px;background:#fffdf8;display:grid;place-items:center;font-size:80px;font-weight:900;box-shadow:0 6px 0 #1f1b1633">${ch}</div>`;
  const ar = (s, x, y) => `<div style="position:absolute;left:${x}px;top:${y}px;font-size:40px;color:#6b6257;font-weight:700">${s}</div>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Serif CJK JP','IPAPMincho','Noto Sans CJK JP',serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 80px;background:#f3ede0;color:#1f1b16;position:relative;overflow:hidden">
    <div style="font-size:34px;color:#8f2a1d;letter-spacing:.1em">だれでも同じ 1日3問・3分</div>
    <div style="font-size:104px;font-weight:900;margin-top:20px;letter-spacing:.1em">まんなか漢字</div>
    <div style="font-size:40px;margin-top:24px;line-height:1.5">まんなかに1文字入れて、<br>4つの熟語を完成させる。</div>
    <div style="position:absolute;left:740px;top:110px;width:420px;height:420px">
      ${cell("史", 150, 0)}${cell("向", 0, 150)}${cell("？", 150, 150, 1)}${cell("昇", 300, 150)}${cell("位", 150, 300)}
      ${ar("↓", 198, 118)}${ar("→", 122, 188)}${ar("→", 272, 188)}${ar("↓", 198, 268)}
    </div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
