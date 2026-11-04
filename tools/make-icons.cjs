// アプリのアイコン（icon-192.png・icon-512.png）を作る。和紙の地に十字の5マス、まんなかは朱の「中」。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    const box = (x, y, fill, stroke) => `<rect x="${x}" y="${y}" width="24" height="24" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f3ede0"/>
      ${box(38, 10, "#fffdf8", "#1f1b16")}${box(10, 38, "#fffdf8", "#1f1b16")}${box(66, 38, "#fffdf8", "#1f1b16")}${box(38, 66, "#fffdf8", "#1f1b16")}
      ${box(36, 36, "#c43d2b", "#8f2a1d").replace('width="24" height="24"', 'width="28" height="28"')}
      <text x="50" y="58" font-size="20" text-anchor="middle" fill="#fff" font-family="serif" font-weight="800">中</text></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
