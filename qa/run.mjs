// まんなか漢字の検査。問題（答えが1つ・札の印を辞書で確かめ直す）・3問の組み方（何年分）・通しで遊ぶ・まちがいの手がかり・ヒント・続きから・上級・漢字帳・記録・スマホ幅・PWA を確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href; // # などを含むフォルダ名でも開ける
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

// 1. 問題（ブラウザを使わない）
const sb = { window: {} }; vm.runInNewContext(readFileSync(path.join(root, "data.js"), "utf8"), sb);
const P = sb.window.MK_DATA.P.map((a, i) => ({ id: i, x: a[0], t: a[1], w: a[2], r: a[3], d: a[4], m: a[5] }));
const W = new Set(readFileSync(path.join(root, "tools/words.txt"), "utf8").split("\n").filter((l) => l && !l.startsWith("#")));
const tiers = [0, 1, 2].map((t) => P.filter((p) => p.t === t).length);
check("問題は700問以上・難しさごとに200問以上", P.length >= 700 && tiers.every((n) => n >= 200), `${P.length}問（${tiers.join("・")}）`);
check("答えの字は重ならない（漢字帳で1字1問）", new Set(P.map((p) => p.x)).size === P.length);
check("どの問題も形がそろう（上+X・左+X・X+右・X+下、5字すべて違う、読み4つ）", P.every((p) => p.w[0][1] === p.x && p.w[1][1] === p.x && p.w[2][0] === p.x && p.w[3][0] === p.x && new Set([p.x, p.w[0][0], p.w[1][0], p.w[2][1], p.w[3][1]]).size === 5 && p.r.length === 4 && p.r.every((r) => /^[ぁ-ゖァ-ヺー]+$/.test(r))));
check("4つの熟語はどれも辞書（JMdict）にある", P.every((p) => p.w.every((w) => W.has(w))));
{ // 答えが1つ：辞書に出てくるどの字を入れても、ほかの字では4つ揃わない
  const ks = new Set([...W].flatMap((w) => [...w]));
  const bad = P.filter((p) => [...ks].some((y) => y !== p.x && W.has(p.w[0][0] + y) && W.has(p.w[1][0] + y) && W.has(y + p.w[2][1]) && W.has(y + p.w[3][1])));
  check("答えは1つだけ（辞書のどの字を入れても、ほかの字では4つ揃わない）", bad.length === 0, bad.slice(0, 5).map((p) => p.x).join(",")); }
{ // 札の印（まちがえたときに「いくつ熟語になるか」を出す）が辞書と合う
  const maskOf = (p, y) => (W.has(p.w[0][0] + y) ? 1 : 0) | (W.has(p.w[1][0] + y) ? 2 : 0) | (W.has(y + p.w[2][1]) ? 4 : 0) | (W.has(y + p.w[3][1]) ? 8 : 0);
  check("まちがいの札は11枚・答えや盤の字と重ならない", P.every((p) => p.d.length === 11 && new Set(p.d).size === 11 && !p.d.some((y) => [p.x, ...p.w.join("")].includes(y))));
  check("札の印（いくつ熟語になるか）が辞書と合い、4つ揃う札は無い", P.every((p) => p.d.every((y, j) => p.m[j] === maskOf(p, y) && p.m[j] !== 15)));
  check("惜しい札（2つ以上熟語になる）が多くの問題にある（手がかりで考えられる）", P.filter((p) => p.m.slice(0, 8).some((m) => [1, 2, 4, 8].filter((b) => m & b).length >= 2)).length >= P.length * 0.8); }
check("つらい言葉（死・殺など）を使わない", !P.some((p) => /[死殺葬屍姦淫娼尿糞呪遺棺骸刑獄墓弔喪病癌毒虐暴拷凶犯罪賊奴隷]/.test(p.w.join("") + p.d.join(""))));

{ // 入力の手がかり用の辞書 words.js は tools/words.txt から作ったものと同じ（手で直していない）
  const sw = { window: {} }; vm.runInNewContext(readFileSync(path.join(root, "words.js"), "utf8"), sw);
  const MW = sw.window.MK_WORDS, A = new Set(), C = new Set(); for (const p of P) { A.add(p.w[0][0]); A.add(p.w[1][0]); C.add(p.w[2][1]); C.add(p.w[3][1]); }
  const F = {}, B = {}; for (const w of W) { const [a, b] = [...w]; if (A.has(a)) F[a] = (F[a] || "") + b; if (C.has(b)) B[b] = (B[b] || "") + a; }
  const same = (x, y) => Object.keys(x).length === Object.keys(y).length && Object.keys(x).every((k) => [...x[k]].sort().join("") === [...(y[k] || "")].sort().join(""));
  check("入力の手がかり用の辞書 words.js は tools/words.txt（JMdict）と合う（node tools/make-words.cjs で作る）", same(MW.F, F) && same(MW.B, B)); }
const html = readFileSync(path.join(root, "index.html"), "utf8");
check("終えた回を消すのは同じ回のときだけ・0時を過ぎたホームの「今日」のボタンは描き直す（2026-11-04 CodeRabbit）", /c\.date === run\.date && c\.id === run\.id\) s2\.runs\[MODE\] = null/.test(html) && /\$\("go-d"\)\.onclick = \(\) => \(k !== todayKey\(\) \? home\(\)/.test(html));
check("別のタブで今日の分を終えたあと、古い画面から今日・上級をもう一度始めない（2026-11-04 CodeRabbit）", /\(mode === "d" && s\.days\[k\]\) \|\| \(mode === "h" && s\.hdays\[k\]\)\) return;/.test(html));
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む。2026-11-04）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
check("正解を入れられなかったら正解の画面を出さない・別のタブのまちがいも数える（2026-11-04 CodeRabbit）", /if \(!saved\) \{ toast\("別の画面で先に進んでいます"\); return play\(\); \}/.test(html) && /for \(const c of r0\.cur\.tried \|\| \[\]\) if \(!cur\.tried\.includes\(c\)\) cur\.tried\.push\(c\)/.test(html));
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの問題選びととことんの回の見分けだけ（今日の3問・上級・札の並びは日付と問題の乱数）", (html.match(/Math\.random/g) || []).length === 3);
check("熟語の出どころ（JMdict・EDRDG）を画面とデータに書いている", /JMdict/.test(html) && /CC BY-SA 4\.0/.test(readFileSync(path.join(root, "data.js"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/mannaka-kanji/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./transfer.js", "./data.js", "./words.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
  check("PWA：ネットの返事の保存は、イベントの中で waitUntil に預ける（遅れて届いた新しい版も保存できる）", /e\.waitUntil\(Promise\.race\(\[net\.then[^\n]*Promise\.race\(\[caches\.open[^\n]*wait\(15000\)\]\); \}, \(\) => \{\}\)\.catch\(\(\) => \{\}\), wait\(60000\)\]\)\);/.test(sw) && !/\.then\([^\n]*e\.waitUntil/.test(sw));
  check("PWA：sw.js は画面のファイルを全部保存し、外へ何も送らない", need.every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "まんなか漢字" && mf.icons.length >= 2 && mf.start_url === "./"); }
{ // 同じ日はどのブラウザでも同じ問題：sort の比較の中で乱数を引かない（引く回数がブラウザで変わる）
  const src = ["index.html", ...["gen.js", "data.js"].filter((f) => existsSync(path.join(root, f)))].map((f) => readFileSync(path.join(root, f), "utf8")).join("\n");
  const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
  check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t);
const errors = [];
async function newPage(w = 390, h = 844) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.stack));
  page.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  return page;
}
const curP = (page) => page.evaluate(() => { const g = window.__mk, r = g.load().runs[g.mode()]; return g.P[r.list[r.res.length]]; });
const KEY = "mannaka-v1";
// 入力して答える：入力欄に打って「決める」。打った字が下に残っているか
const type = async (pg, ch) => { await pg.fill("#ans", ch); await pg.click("#go"); };
const triedHas = async (pg, ch) => ((await pg.textContent("#tried")) || "").includes(ch);
try {
  const page = await newPage();
  // 2. 3問の組み方（日付の乱数）。3年分
  const sel = await page.evaluate(() => {
    const g = window.__mk, out = { bad: [], dup: 0, hardHit: 0, len: [] };
    const seen = [[], [], []];
    for (let n = 0; n < 1100; n++) {
      const k = new Date(Date.parse("2026-11-04") + n * 864e5).toISOString().slice(0, 10);
      const d = g.dailyList(k), h = g.hardList(k);
      if (d.map((id) => g.P[id].t).join() !== "0,1,2") out.bad.push(k);
      if (h.some((id) => g.P[id].t !== 2) || new Set(h).size !== 3) out.bad.push(k + "h");
      if (h.includes(d[2])) out.hardHit++;
      d.forEach((id, t) => seen[t].push(id)); (seen.h = seen.h || []).push(d[2], ...h);
    }
    // 1周（その難しさの問題数）のうちは同じ問題が出ない
    // むずかしいは今日の3問目と上級の3問で1日4問ずつ使う。使う順に並べて、1周（問題数）ごとに重ならないかを見る
    seen[2] = seen.h;
    [0, 1, 2].forEach((t) => { const L = g.POOL[t].length; for (let i = 0; i + L <= seen[t].length; i += L) if (new Set(seen[t].slice(i, i + L)).size !== L) out.dup++; });
    out.d1201 = JSON.stringify(g.dailyList("2026-12-01"));
    out.tiles = g.P.every((p) => { const a = g.tilesOf(p, 9), b = g.tilesOf(p, 12); return a.includes(p.x) && b.includes(p.x) && new Set(a).size === 9 && new Set(b).size === 12 && JSON.stringify(a) === JSON.stringify(g.tilesOf(p, 9)); });
    out.pos = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => g.P.filter((p) => g.tilesOf(p, 9)[j] === p.x).length);
    return out;
  });
  check("今日の3問は毎日「やさしい・ふつう・むずかしい」、上級はむずかしい3問（3年分）", sel.bad.length === 0, sel.bad.slice(0, 3).join(","));
  check("上級の3つはどの日も重ならない（周の切れ目をまたぐ日も。55年分）", await page.evaluate(() => { const g = window.__mk; for (let n = 0; n < 20000; n++) { const k = new Date(Date.parse("2026-11-04") + n * 864e5).toISOString().slice(0, 10), h = g.hardList(k); if (h.length !== 3 || new Set(h).size !== 3 || h.includes(g.dailyList(k).slice(-1)[0])) return false; } return true; }));
  check("1周するまで同じ問題は出ない（難しさごと）", sel.dup === 0);
  check("上級は今日の3問目と重ならない（3年分）", sel.hardHit === 0, `${sel.hardHit}日`);
  { // 別のブラウザ（まっさらな別のコンテキスト）で開いても同じ3問か
    const ctx = await browser.newContext(); const p2 = await ctx.newPage(); await p2.goto(url);
    const d2 = await p2.evaluate(() => JSON.stringify(window.__mk.dailyList("2026-12-01")));
    await ctx.close();
    check("同じ日は別のブラウザで開いても同じ3問", sel.d1201 === d2); }
  check("札は答えを含み、9枚・12枚とも重ならず、問題ごとに並びが決まる", sel.tiles);
  check("答えの札の場所が偏らない（どの場所も 5〜20%）", sel.pos.every((n) => n >= P.length * 0.05 && n <= P.length * 0.2), sel.pos.join(","));

  // 3. 通しで遊ぶ
  check("初めて開くと遊び方が出る", await page.locator("#howto[open]").count() === 1);
  await page.click("#howto-ok");
  check("ホームの例の盤は遊び方と同じ（史・向・昇・位）", (await page.textContent(".hero .board")).replace(/[\s↓→]/g, "") === "史向？昇位");
  await page.click("#go-d");
  let p = await curP(page);
  check("1問目は「やさしい」・札は無く入力欄（16px以上・lang=ja・自動修正なし）・まんなかは「？」", p.t === 0 && (await page.locator(".tile").count()) === 0 && (await page.textContent("#ctr")) === "？" && (await page.evaluate(() => { const a = document.querySelector("#ans"); return parseFloat(getComputedStyle(a).fontSize) >= 16 && a.lang === "ja" && a.getAttribute("autocomplete") === "off" && a.getAttribute("spellcheck") === "false" && a.getAttribute("enterkeyhint") === "done"; })));
  const wrong = p.d.find((y, j) => [1, 2, 4, 8].filter((b) => p.m[j] & b).length >= 2 && (j < 8)) || p.d[0];
  const wm = p.m[p.d.indexOf(wrong)], wn = [1, 2, 4, 8].filter((b) => wm & b).length;
  await type(page, wrong);
  check("まちがえると、4つのうちいくつ熟語になったかが盤（○×）と文で分かる", (await page.locator(".mk.ok").count()) === wn && (await page.locator(".mk.ng").count()) === 4 - wn && (await page.textContent("#near")).includes(`${wn}つ熟語`));
  check("まちがえた字は下に残り、何個なったかが分かる・入力欄は空にもどる", (await page.textContent("#tried")).includes(`${wrong}${wn}/4`) && (await page.inputValue("#ans")) === "");
  await page.click("#hint");
  check("ヒントで上の熟語の読みが出る", (await page.textContent(".cell[data-pos=t] .yomi")) === p.r[0]);
  await page.reload(); await page.click("#go-d");
  check("途中で閉じても、まちがえた字とヒントはそのまま（続きから）", await triedHas(page, wrong) && (await page.textContent(".cell[data-pos=t] .yomi")) === p.r[0] && (await page.textContent("#miss")).includes("ヒント 1"));
  // 練習を始めても今日の途中は消えない
  await page.click("#back"); await page.click("#go-p"); await page.locator(".lv button").first().click(); await page.click("#back"); await page.click("#go-d");
  check("練習を始めても、今日の途中経過は消えない", await triedHas(page, wrong) && (await page.evaluate(() => window.__mk.mode())) === "d");
  await type(page, p.x);
  check("正解すると、4つの熟語と読みが出て★1（まちがい1・ヒント1）", (await page.locator(".verdict .words div").count()) === 4 && (await page.textContent(".verdict")).includes(p.w[0]) && (await page.locator(".verdict .stars .off").textContent()).length === 2);
  check("正解のあとは入力欄が消える", !(await page.locator("#inp").isVisible()));
  check("正解すると4つの熟語が順に灯る（手ごたえ）・初めての実績が結果に小さく出る", (await page.locator("#bd .board.lit").count()) === 1 && (await page.textContent(".verdict .achnew")).includes("🏅 実績：はじめの一字"));
  await page.click("#next");
  // 別のタブで先に進んでいたら、古い画面の正解は足さない
  p = await curP(page);
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.push({ m: 0, g: [], h: 0 }); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await type(page, p.x);
  check("別のタブで先に進んでいたら、古い画面の正解は足さず今の問題を出し直す", (await page.evaluate(() => window.__mk.load().runs.d.res.length)) === 2 && (await page.textContent("header")).includes("3/3"));
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.pop(); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await page.reload(); await page.click("#go-d");
  for (let j = 0; j < 2; j++) { p = await curP(page); await type(page, p.x); await page.click("#next"); }
  const share = await page.textContent(".share");
  const daily = await page.evaluate(() => { const g = window.__mk; return g.dailyList(g.todayKey()).map((id) => g.P[id]); });
  check("3問で結果・シェアの文は番号と色だけ（答えの字・熟語は出さない）", /まんなか漢字 #\d+/.test(share) && /やさしい (🟨|⬜)💡🟩/.test(share) && /ふつう 🟩/.test(share) && !daily.some((q) => share.includes(q.x) || q.w.some((w) => share.includes(w))));
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("まちがいのあった日は Ko-fi のひとことを出さない", (await page.locator(".kofi").count()) === 0);
  check("今日の3問の結果に「続けて遊ぶ：とことん」の大きなボタン", (await page.locator("#go-e.main").count()) === 1 && (await page.textContent("#go-e")).includes("とことん"));
  await page.click("#back");
  check("ホームで連続1日・今日の結果を見るに変わる・漢字帳に3字", (await page.textContent(".rank")).includes("連続1日") && (await page.textContent("#go-d")).includes("今日の結果") && (await page.textContent("#go-dex")).includes("3/"));
  // 上級：入力だけ（ヒント・候補なし）・全問一発なら Ko-fi
  await page.click("#go-h");
  check("上級は入力だけ・ヒントのボタンも候補も無い・むずかしい", (await page.locator("#ans").count()) === 1 && (await page.locator(".tile").count()) === 0 && (await page.locator("#hint").count()) === 0 && (await curP(page)).t === 2);
  for (let j = 0; j < 3; j++) { p = await curP(page); await type(page, p.x); await page.click("#next"); }
  check("上級を全問一発で初めて終えると、結果に Ko-fi のひとことが1行", (await page.locator(".kofi").count()) === 1 && (await page.textContent(".big")).includes("全問一発"));
  await page.click("#back"); await page.click("#go-h");
  check("2回目に結果を開いても Ko-fi のひとことは出ない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  // 練習：記録の日を増やさず、漢字帳には載る
  // 期待値を練習の乱数に頼らない：遊んだ字が今日の問題と重なることがあるので、数でなく「遊んだ字が載ったか」を見る
  await page.click("#go-p"); await page.locator(".lv button").nth(1).click();
  const played = [];
  for (let j = 0; j < 3; j++) { p = await curP(page); played.push(p.x); await type(page, p.x); await page.click("#next"); }
  const after = await page.evaluate(() => { const s = window.__mk.load(); return { days: Object.keys(s.days).length, dex: s.dex }; });
  check("練習は今日の記録を増やさず、漢字帳には載る", after.days === 1 && played.every((x) => after.dex[x] >= 1) && (await page.locator(".share").count()) === 0, played.join(""));
  await page.click("#go-dex");
  check("漢字帳に集めた字が出て、押すと熟語と読みが見られる", (await page.locator(".dex button").count()) === Object.keys(after.dex).length);
  await page.locator(".dex button").first().click();
  check("漢字帳の字を押すと盤と4つの熟語", (await page.locator(".sheet .words div").count()) === 4);
  await page.close();

  // 4. スマホ幅：はみ出さない・押せる所は44px以上
  for (const w of [320, 390]) {
    const p3 = await newPage(w, 700); const fb2 = await p3.evaluate(() => { const a = document.querySelector("#howto #fb2"); return a ? a.getBoundingClientRect().height : 0; }); check(`幅${w}px：遊び方の「感想を送る」も高さ44px以上`, fb2 >= 44, `${fb2}px`); await p3.click("#howto-ok");
    const homeOk = await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p3.click("#go-d");
    const r = await p3.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a, input")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) }));
    check(`幅${w}px：横にはみ出さず、押せる所は高さ44px以上`, homeOk && !r.over && r.small.length === 0, r.small.join(","));
    await p3.close();
  }
  { // 保存できないブラウザでも遊べる（開いているあいだは途中経過を覚えている）
    const pb = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pb.on("pageerror", (e) => errors.push(e.message));
    await pb.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
    await pb.goto(url); await pb.click("#howto-ok"); await pb.click("#go-d");
    check("保存できないブラウザでも、今日の1問目が始まる", (await pb.textContent("header")).includes("1/3"));
    await pb.click("#back");
    check("保存できないブラウザでも、遊び方が何度も開かない", !(await pb.locator("#howto[open]").count()));
    await pb.close(); }
  { // ヒントを出したあとにまちがえても、盤の ○× は消えない
    const ph = await newPage(); await ph.click("#howto-ok").catch(() => {}); await ph.click("#go-p"); await ph.locator(".lv button").first().click();
    const q = await curP(ph); await ph.click("#hint");
    const w = q.d.find((y) => y !== q.x); await type(ph, w);
    check("ヒントのあとにまちがえても、盤に ○× が出たまま", (await ph.locator(".mk.ok").count()) + (await ph.locator(".mk.ng").count()) === 4);
    await ph.close(); }
  { // 前の記録が残っていて、書き込みだけ失敗する（容量いっぱいなど）ときも、メモリの新しい進み具合を使う
    const pq = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pq.on("pageerror", (e) => errors.push(e.message));
    await pq.addInitScript(() => { const orig = Storage.prototype.setItem; orig.call(localStorage, "mannaka-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, kofi: {}, runs: {} })); Storage.prototype.setItem = () => { throw new Error("full"); }; });
    await pq.goto(url); await pq.click("#go-d");
    check("前の記録があり書き込みだけ失敗しても、今日の1問目が始まる", (await pq.textContent("header")).includes("1/3"));
    await pq.close(); }
  { // 最後の1問を終えて「結果を見る」を押す前に閉じた日は、開き直すと結果へ進み記録がつく
    const pc = await newPage();
    await pc.evaluate((k) => { const g = window.__mk, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, g: [], h: 0 })) } } })); }, KEY);
    await pc.reload();
    check("最後の1問のあと閉じても、開き直すと結果へ進み今日の記録がつく", await pc.evaluate(() => { const g = window.__mk; return !!g.load().days[g.todayKey()] && !g.load().runs.d; }));
    await pc.close(); }
  { // 0時の前に最後の1問を終えて閉じ、翌日に開いても、終えた日の記録として残る
    { // 今日の結果を開いたまま0時を過ぎてから「上級」を押しても、翌日の上級は始めない
    const pm = await newPage();
    await pm.evaluate((k) => { const g = window.__mk, d = new Date(Date.parse(g.todayKey())).toISOString().slice(0, 10); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, g: [], h: 0 })) } } })); }, KEY);
    await pm.reload();
    const had = await pm.locator("#go-h").count();
    await pm.evaluate(() => { const RD = Date, off = 864e5; window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; }); // 時計を1日進める
    if (had) await pm.click("#go-h");
    check("結果を開いたまま日付が変わったら、上級のボタンを押しても翌日の上級は始まらない", had > 0 && (await pm.evaluate(() => window.__mk.mode())) !== "h");
    await pm.close(); }
    const pn = await newPage();
    await pn.evaluate((k) => { const g = window.__mk, d = new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, g: [], h: 0 })) } } })); }, KEY);
    await pn.reload();
    check("前の日に終えて閉じても、翌日に開くとその日の記録がつく", await pn.evaluate(() => { const g = window.__mk; return !!g.load().days[new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10)] && !g.load().runs.d; }));
    check("前の日の結果の画面からは、今日の上級を始められない（今日の分を先に）", !(await pn.locator("#go-h").count()));
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__mk, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, "mannaka-v1"));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残す", await pn.evaluate((K) => { const g = window.__mk, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": s0.days[Object.keys(s0.days)[0]] || 1 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"]; }, "mannaka-v1"));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__mk, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0 }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: Object.assign({}, s0.runs, { d: Object.assign({}, base) }) })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: Object.assign({}, s0.runs, { d: Object.assign({}, base, { res: [{}, {}], i: 2 }) }) }))); const r = g.load(); mem = null; return r.runs.d.res.length === 2 && r.runs.d.i === 2; }, "mannaka-v1"));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（その日を終えた記録があれば null を使う・終えた回は日ごとの結果に残す）", await pn.evaluate((K) => { const g = window.__mk, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b, dd) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }, dd ? { days: Object.assign({}, s0.days, dd) } : {}))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }, { "2000-01-01": 1 }), r3 = put({ d: base }, { d: null }), r4 = put({ d: done }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null && !!r3.runs.d && r3.runs.d.date === "2000-01-01" && r4.runs.d === null && !!r4.days["2000-01-01"]; }, "mannaka-v1"));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__mk, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, "mannaka-v1"));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__mk, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, "mannaka-v1"));
    check("同じ問題の途中なら、両方のタブで選んだ札とヒントを合わせて残す", await pn.evaluate((K) => { const g = window.__mk, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], res: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { cur: { i: 0, tried: ["甲"], hints: 0 } }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: Object.assign({}, base, { cur: { i: 0, tried: ["乙"], hints: 1 } }) } }))); const r = g.load(); mem = null; const c = r.runs.d.cur; return c.tried.length === 2 && c.tried.includes("甲") && c.tried.includes("乙") && c.hints === 1; }, "mannaka-v1"));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__mk, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, "mannaka-v1"));
    check("保存に失敗したあと別のタブが保存しても、帳の★は高いほうを残す", await pn.evaluate((K) => { const g = window.__mk, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, dex: { zz: 3 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, dex: { zz: 1 } }))); const r = g.load(); mem = null; return r.dex.zz === 3; }, "mannaka-v1"));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, "mannaka-v1"));
    await pn.close(); }
  // 4b. 入力して答える
  { const pi = await newPage(320, 700); await pi.click("#howto-ok"); await pi.click("#go-p"); await pi.locator(".lv button").first().click();
    let q = await curP(pi);
    const box = await pi.evaluate(() => ["#ans", "#go"].map((s) => document.querySelector(s).getBoundingClientRect().height));
    check("幅320px：入力欄と「決める」は高さ44px以上", box.every((h) => h >= 44), box.join(","));
    // 変換中の Enter（isComposing・keyCode 229）では送らない
    await pi.fill("#ans", q.x);
    const sent = await pi.evaluate(() => { const a = document.querySelector("#ans"); const ev = (o) => { const e = new KeyboardEvent("keydown", Object.assign({ key: "Enter", bubbles: true, cancelable: true }, o)); a.dispatchEvent(e); }; ev({ isComposing: true }); const e2 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }); Object.defineProperty(e2, "keyCode", { get: () => 229 }); a.dispatchEvent(e2); return !!document.querySelector(".verdict"); });
    check("変換中の Enter（isComposing・keyCode 229）では答えを送らない", !sent && (await pi.inputValue("#ans")) === q.x);
    await pi.press("#ans", "Enter");
    check("変換を終えた Enter で送れる", (await pi.locator(".verdict").count()) === 1);
    await pi.click("#next"); q = await curP(pi);
    await type(pi, "ひらがな"); await type(pi, "カタカナ");
    check("かな・カタカナだけは「漢字に変換して」と出し、まちがいに数えない", (await pi.textContent("#near")).includes("漢字に変換") && (await pi.evaluate(() => { const g = window.__mk, r = g.load().runs.p; return !r.cur || r.cur.tried.length === 0; })) && (await pi.textContent("#miss")) === "");
    const w2 = q.d[0]; await type(pi, w2); await type(pi, " " + w2 + " ");
    check("同じ字をもう一度打っても、まちがいは増えない", (await pi.textContent("#near")).includes("もう試しました") && (await pi.textContent("#miss")).includes("まちがい 1"));
    await type(pi, "　" + q.x + " ");
    check("前後の空白（全角・半角）があっても正解になる", (await pi.locator(".verdict").count()) === 1);
    await pi.click("#next"); q = await curP(pi);
    await type(pi, q.w[2]); // 熟語ごと打っても（例「上昇」）まんなかの字を見る
    check("熟語ごと打っても、盤の字を除いてまんなかの字を見る", (await pi.locator(".verdict").count()) === 1);
    check("NFKC で全角・半角のゆれをそろえる（ｶﾀｶﾅ・全角英数字も整える）", await pi.evaluate(() => { const p = window.__mk.P[0]; return window.__mk.pickKanji(" ｱｲ ", p).ch === undefined && window.__mk.pickKanji("　上　", p).ch === "上" && window.__mk.pickKanji("⼈", p).ch === "人"; }));
    await pi.close(); }
  { // 別解：ほかの字でも4つとも辞書の熟語になるなら正解にして「別解」と出す
    const pj = await newPage(); await pj.click("#howto-ok"); await pj.click("#go-p"); await pj.locator(".lv button").first().click();
    const q = await curP(pj), y = "鬱";
    await pj.evaluate(([q, y]) => { const W = window.MK_WORDS; W.F[q.w[0][0]] += y; W.F[q.w[1][0]] += y; W.B[q.w[2][1]] += y; W.B[q.w[3][1]] += y; }, [q, y]);
    await type(pj, y);
    check("別解（ほかの字でも4つとも熟語）は正解にして「別解」と出す・漢字帳はその問題の字", (await pj.locator(".verdict").count()) === 1 && (await pj.textContent(".verdict")).includes("別解") && (await pj.evaluate((x) => !!window.__mk.load().dex[x], q.x)));
    await pj.close(); }
  { // ヒント：読み2つ → 最後に候補4つ（★が下がる）。打った字は辞書で数える
    const ph = await newPage(); await ph.click("#howto-ok"); await ph.click("#go-p"); await ph.locator(".lv button").nth(1).click();
    const q = await curP(ph);
    for (let j = 0; j < 3; j++) await ph.click("#hint");
    const c = await ph.$$eval("#cands .tile", (a) => a.map((b) => b.dataset.ch));
    check("3つ目のヒントで候補が4つ出る（答えを含む・問題ごとに決まった並び）・ヒントはそれ以上出ない", c.length === 4 && c.includes(q.x) && await ph.isDisabled("#hint") && JSON.stringify(c) === JSON.stringify(await ph.evaluate((id) => window.__mk.tilesOf(window.__mk.P[id], 4), q.id)));
    const wr = c.find((x) => x !== q.x); await ph.click(`#cands .tile[data-ch="${wr}"]`);
    check("候補でまちがえても、その字は押せなくなり下に残る", await ph.isDisabled(`#cands .tile[data-ch="${wr}"]`) && await triedHas(ph, wr));
    await ph.click(`#cands .tile[data-ch="${q.x}"]`);
    check("候補を使って正解すると★1（ヒント3）", (await ph.locator(".verdict .stars .off").textContent()).length === 2 && (await ph.textContent(".verdict")).includes("ヒント3回"));
    check("打った字の「いくつ熟語になるか」は辞書で数え、まちがいの札の印と同じ", await ph.evaluate(() => { const g = window.__mk; return g.P.every((p) => p.d.every((y, j) => g.maskOf(p, y) === p.m[j])); }));
    await ph.close(); }
  // 5. やりこみ：実績・記録（カレンダー）・取りこぼした日をあとから
  { // 実績の数え方（いまの記録から毎回数える）
    const pa = await newPage(320, 700);
    const r = await pa.evaluate(() => { const g = window.__mk, s = g.load(); const xs = g.P.slice(0, 60).map((p) => p.x); s.dex = Object.fromEntries(xs.map((x, i) => [x, i < 10 ? 3 : 1])); s.days = { "2026-11-04": { m: [0, 0, 0], g: [[], [], []], h: [0, 0, 0] }, "2026-11-05": { m: [1, 0, 2], g: [], h: [] }, "2026-11-07": { m: [0, 1, 0], g: [], h: [] } }; s.hdays = { "2026-11-04": { m: [0, 1, 0], g: [], h: [] } }; s.late = { "2026-11-06": { m: [0, 0, 1], g: [], h: [] } }; const got = g.achGot(s); return { n: g.ACH.length, kinds: [...new Set(g.ACH.map((a) => a[3]))].join(), got, d200: g.achProg(s, g.ACH.find((a) => a[0] === "dex200")), week: g.achProg(s, g.ACH.find((a) => a[0] === "week")), s3: g.achProg(s, g.ACH.find((a) => a[0] === "s3")) }; });
    check("実績は13個で、腕前・集める・続けるを混ぜる", r.n === 13 && r.kinds === "腕前,集める,続ける", r.kinds);
    check("実績はいまの記録から数える（取れたもの・進み具合）", ["first", "perfect", "hard1", "dex50", "late1", "days3"].every((id) => r.got.includes(id)) && !r.got.includes("hardp") && !r.got.includes("dex200") && r.d200.join() === "60,200" && r.week.join() === "4,7" && r.s3.join() === "10,50", JSON.stringify(r));
    await pa.evaluate((K) => { const g = window.__mk, s = g.load(); s.tut = true; s.dex = Object.fromEntries(g.P.slice(0, 60).map((p) => [p.x, 1])); localStorage.setItem(K, JSON.stringify(s)); }, KEY);
    await pa.reload(); await pa.click("#go-ach");
    const v = await pa.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, n: document.querySelectorAll(".ach").length, pg: document.querySelector('.ach[data-id="dex200"] .pg').textContent, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) }));
    check("実績の画面：幅320pxで崩れず、まだの実績は条件と「60/200」のような進み具合", !v.over && v.n === 13 && v.pg.includes("60/200") && v.small.length === 0, JSON.stringify(v));
    await pa.close(); }
  { // 統合の前に両方を fresh() で補う（片方にしか無いキーを失わない。2026-11-04 CodeRabbit が前のゲームで指摘）
    const pl = await newPage();
    check("保存に失敗したあとの統合でも、片方にしか無い実績の印・あとから遊んだ日を失わない", await pl.evaluate((K) => { const g = window.__mk, base = { v: 1, days: {}, hdays: {}, dex: {}, runs: {}, kofi: {} }; mem = JSON.stringify(Object.assign({}, base, { t: 9, ach: { first: 1 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, base, { t: 5, late: { "2026-11-04": { m: [0, 0, 0] } } }))); const r1 = g.load(); mem = JSON.stringify(Object.assign({}, base, { t: 9, late: { "2026-11-04": { m: [0, 0, 0] } } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, base, { t: 5, ach: { first: 1 } }))); const r2 = g.load(); mem = null; return r1.ach.first === 1 && !!r1.late["2026-11-04"] && r2.ach.first === 1 && !!r2.late["2026-11-04"]; }, KEY));
    await pl.close(); }
  { // 取りこぼした日の選び方（何百日分）：今日より前の7日・EPOCH より前は無し・遊んだ日は出さない
    const pm = await newPage();
    const bad = await pm.evaluate(() => { const g = window.__mk, add = (k, n) => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10), out = []; const s = { days: {}, late: {} }; for (let n = 0; n < 600; n++) { const k = add("2026-11-04", n); if ((n * 7) % 3 === 0) s.days[k] = { m: [0, 0, 0] }; else if (n % 5 === 0) s.late[k] = { m: [0, 0, 0] }; } for (let n = 0; n < 600; n++) { const k = add("2026-11-04", n), m = g.missedDays(s, k), want = []; for (let i = 1; i <= 7; i++) { const d = add(k, -i); if (d >= "2026-11-04" && !s.days[d] && !s.late[d]) want.push(d); } if (JSON.stringify(m) !== JSON.stringify(want)) out.push(k); } return out; });
    check("取りこぼした日は、遊んでいない過去7日だけ（はじめの日より前は無い。600日分）", bad.length === 0, bad.slice(0, 3).join(","));
    await pm.close(); }
  { // あとから遊ぶ：時計を 2026-11-20 にして、A日を途中まで→B日を始める→A日に戻ると続きから・終えても今日の記録・連続・Ko-fi に入れない
    const pz = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pz.on("pageerror", (e) => errors.push(e.stack));
    await pz.addInitScript(() => { const RD = Date, off = Date.parse("2026-11-20T03:00:00Z") - RD.now(); window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; });
    await pz.goto(url); await pz.evaluate((K) => localStorage.setItem(K, JSON.stringify({ v: 1, tut: true, days: { "2026-11-19": { m: [0, 0, 0], g: [[], [], []], h: [0, 0, 0] } }, hdays: {}, dex: {}, kofi: {}, runs: {} })), KEY); await pz.reload();
    const miss = await pz.evaluate(() => window.__mk.missedDays(window.__mk.load()));
    check("ホームに取りこぼした日のボタン（遊んだ日は除く7日前まで）", (await pz.textContent("#go-late")).includes("6日") && miss.join() === "2026-11-18,2026-11-17,2026-11-16,2026-11-15,2026-11-14,2026-11-13", miss.join());
    const A = "2026-11-15", B = "2026-11-17";
    await pz.click("#go-late"); await pz.click(`.misses button[data-d="${A}"]`);
    const ra = await pz.evaluate((A) => { const g = window.__mk, s = g.load(); return { list: JSON.stringify(s.runs[g.aKey(A)].list), want: JSON.stringify(g.dailyList(A)), mode: g.mode() }; }, A);
    check("あとから遊ぶ問題は、その日の今日の3問と同じ（日付の種）", ra.list === ra.want && ra.mode === "a:" + A && (await pz.textContent("header")).includes("11/15"));
    let q = await curP(pz); const wr = q.d[0];
    await type(pz, q.x); await pz.click("#next");
    q = await curP(pz); await type(pz, q.d[0]);
    await pz.click("#back"); await pz.click("#go-cal"); await pz.click(`.misses button[data-d="${B}"]`);
    const both = await pz.evaluate(([A, B]) => { const s = window.__mk.load(); return { a: s.runs["a:" + A], b: s.runs["a:" + B] }; }, [A, B]);
    check("別の日を始めても、前の日の途中経過は残る（runs を日付ごとに分ける）", both.a && both.a.res.length === 1 && both.a.cur && both.a.cur.tried.length === 1 && both.b && both.b.res.length === 0);
    await pz.click("#back"); await pz.click("#go-cal");
    check("記録で途中の日は「続き」と出る", (await pz.textContent(`.misses button[data-d="${A}"]`)).includes("続き"));
    await pz.click(`.misses button[data-d="${A}"]`);
    check("前の日に戻ると続きから（2問目・まちがえた字もそのまま）", (await pz.textContent("header")).includes("2/3") && await triedHas(pz, q.d[0]));
    for (let j = 0; j < 2; j++) { q = await curP(pz); await type(pz, q.x); await pz.click("#next"); }
    const fin = await pz.evaluate((A) => { const g = window.__mk, s = g.load(); return { late: !!s.late[A], day: !!s.days[A], days: Object.keys(s.days).length, st: g.streak(s.days), runB: !!s.runs["a:2026-11-17"], dex: Object.keys(s.dex).length, miss: g.missedDays(s) }; }, A);
    check("あとから終えた日は late に入り、今日の記録（days）・連続の日を増やさない。帳には載る", fin.late && !fin.day && fin.days === 1 && fin.st === 1 && fin.dex === 3 && !fin.miss.includes(A) && fin.runB, JSON.stringify(fin));
    check("あとからの結果：Ko-fi の1行・上級のボタンは出さず、シェアに「あとから」・実績「取りこぼし回収」", (await pz.locator(".kofi").count()) === 0 && (await pz.locator("#go-h").count()) === 0 && (await pz.textContent(".share")).includes("（あとから）") && (await pz.textContent(".achnew")).includes("取りこぼし回収"));
    check("結果に「あと少しの実績」を1つだけ出す：まだの実績のうち目標にいちばん近いもの（取った・0のものは選ばない。研究の要点 12）", await pz.evaluate(() => { const g = window.__mk, s = g.load(), nx = g.nextAch(s), el = document.querySelectorAll("#achnext"); if (!nx) return false; const ok = g.ACH.every((a) => { const [n, t] = g.achProg_(s, a); return !(n > 0 && n < t) || n / t <= nx.r + 1e-12; }); return ok && el.length === 1 && el[0].textContent.includes(nx.name) && el[0].textContent.includes("あと" + nx.left) && !g.achGot(s).includes(nx.id); }));
    await pz.click("#go-cal");
    const cal = await pz.evaluate((A) => ({ late: document.querySelector(`.cal [data-k="${A}"]`)?.className || "", d19: document.querySelector('.cal [data-k="2026-11-19"]')?.className || "", streak: document.querySelector("#cal-streak")?.textContent || "", over: document.documentElement.scrollWidth > innerWidth }), A);
    check("カレンダー：その日にといた日は★の濃さ、あとからの日は別の印（点線）、連続は1以上のときだけ", /\blate\b/.test(cal.late) && /\bd3\b/.test(cal.d19) && cal.streak.includes("連続1日") && !cal.over, JSON.stringify(cal));
    const firstMonth = await pz.isDisabled("#cal-prev");
    await pz.evaluate(() => window.__mk.calView("2026-12")); await pz.click("#cal-prev");
    check("カレンダー：前の月へ戻れる（はじめの月 2026年11月より前へは行かない）", firstMonth && (await pz.textContent("#cal-ym")) === "2026年11月" && (await pz.locator('.cal [data-k="2026-11-15"]').count()) === 1);
    await pz.close(); }
  { // 連続が0のときは出さない（休んだ日を責めない）・カレンダーの上級の印と★の濃さ
    const pk = await newPage();
    await pk.evaluate((K) => localStorage.setItem(K, JSON.stringify({ v: 1, tut: true, days: { "2026-11-04": { m: [0, 1, 2], g: [], h: [] } }, hdays: { "2026-11-04": { m: [0, 0, 0], g: [], h: [] } }, dex: {}, kofi: {}, runs: {} })), KEY); await pk.reload();
    const st = await pk.evaluate(() => window.__mk.streak(window.__mk.load().days));
    check("連続の日は1以上のときだけ出す（0は出さない）", st >= 1 ? (await pk.textContent(".rank")).includes("連続") : !(await pk.textContent(".rank")).includes("連続") && !(await pk.textContent(".stats")).includes("連続"));
    await pk.evaluate(() => window.__mk.calView("2026-11"));
    const c = await pk.getAttribute('.cal [data-k="2026-11-04"]', "class");
    check("カレンダー：★6の日は薄い朱（d1）・上級の日は印（hd）・はじめの月より前には戻れない", /\bd1\b/.test(c) && /\bhd\b/.test(c) && (await pk.isDisabled("#cal-prev")), c);
    await pk.close(); }
  { // とことん：次々に出る・やさしい→ふつう→むずかしい・ヒントは🎫を使う・降りると自己ベスト（2026-11-05 satou さん「一日で遊べる量が少なすぎる」）
    const pe = await newPage(); await pe.click("#howto-ok");
    check("とことんの並び（300回）：やさしい5→ふつう10→むずかしい45、同じ問題は出ない・毎回ちがう並び", await pe.evaluate(() => { const g = window.__mk, firsts = new Set(); for (let n = 0; n < 300; n++) { const L = g.endlessList(); if (L.length !== 60 || new Set(L).size !== 60) return false; const t = L.map((id) => g.P[id].t); if (!t.every((x, i) => x === (i < 5 ? 0 : i < 15 ? 1 : 2))) return false; firsts.add(L.slice(0, 5).join()); } return firsts.size > 250; }));
    check("ホームに「とことん」の大きなボタン", (await pe.locator("#go-e.main").count()) === 1 && (await pe.textContent("#go-e")).includes("何問続けて"));
    await pe.click("#go-e");
    check("とことんの1問目はやさしい・🎫が3枚・ヒントのボタンに🎫", (await curP(pe)).t === 0 && (await pe.evaluate(() => window.__mk.load().runs.e.life)) === 3 && (await pe.locator("#life").textContent()).split("🎫").length - 1 === 3 && (await pe.textContent("#hint")).includes("🎫"));
    for (let j = 0; j < 3; j++) { const q = await curP(pe); await type(pe, q.x); await pe.click("#next"); }
    check("とことんは何問目かを出す（4問目）・今日の記録は増えない", (await pe.textContent("header")).includes("4問目") && (await pe.evaluate(() => Object.keys(window.__mk.load().days).length)) === 0);
    const q4 = await curP(pe); await type(pe, q4.d[0]);
    check("とことんのまちがいでは🎫は減らない", (await pe.evaluate(() => window.__mk.load().runs.e.life)) === 3);
    await pe.click("#hint");
    check("とことんのヒントは🎫を1枚使う（画面の🎫も減る）", (await pe.evaluate(() => window.__mk.load().runs.e.life)) === 2 && (await pe.locator("#life .off").textContent()) === "🎫");
    await pe.click("#hint"); await pe.click("#back"); await pe.click("#go-e");
    check("とことんは途中で閉じても続きから（4問目・🎫1・ヒント2回・まちがえた字のまま）", (await pe.textContent("header")).includes("4問目") && (await pe.evaluate(() => window.__mk.load().runs.e.life)) === 1 && (await pe.evaluate(() => window.__mk.cur().hints)) === 2 && await triedHas(pe, q4.d[0]));
    await pe.click("#quit");
    check("降りるとクリアした数と自己ベスト更新が出て、記録に残る（今日の記録・連続には入らない・漢字帳には載る）", (await pe.textContent("#eres")).includes("3問") && (await pe.textContent("#ebest")).includes("自己ベスト更新") && (await pe.evaluate(() => { const s = window.__mk.load(); return s.ebest === 3 && !s.runs.e && Object.keys(s.days).length === 0 && Object.keys(s.dex).length === 3; })) && (await pe.locator(".share").count()) === 0 && (await pe.locator(".kofi").count()) === 0);
    check("とことんの終わりに「もう一度とことん」の大きなボタン", (await pe.locator("#go-e.main").count()) === 1);
    await pe.click("#go-e"); const q1 = await curP(pe); await type(pe, q1.x); await pe.click("#quit");
    check("ベストに届かないと、ベストと「あと何問で更新」を出し、ベストは下げない", (await pe.textContent("#ebest")).includes("あと3問で更新") && (await pe.evaluate(() => window.__mk.load().ebest)) === 3);
    await pe.click("#back");
    check("ホームのとことんのボタンに自己ベスト", (await pe.textContent("#go-e")).includes("自己ベスト 3問"));
    await pe.click("#go-e");
    await pe.evaluate((K) => { const s = JSON.parse(localStorage.getItem(K)); s.runs.e.life = 0; localStorage.setItem(K, JSON.stringify(s)); }, KEY); await pe.click("#back"); await pe.click("#go-e");
    check("🎫が無いとヒントは押せない", await pe.locator("#hint").isDisabled());
    check("自己ベストは2つの保存を合わせるとき大きいほうを残す", await pe.evaluate((K) => { const g = window.__mk, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 99, ebest: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, ebest: 7 }))); const r = g.load(); mem = null; return r.ebest === 7; }, KEY));
    await pe.close(); }
  for (const w of [320, 390]) { // 実績・記録・結果の画面も、はみ出さず押せる所は44px以上
    const pw = await newPage(w, 700);
    await pw.evaluate((K) => { const g = window.__mk, k = g.todayKey(); localStorage.setItem(K, JSON.stringify({ v: 1, tut: true, days: { [k]: { m: [0, 1, 3], g: [[], [2], [1, 2, 0]], h: [0, 1, 1] } }, hdays: {}, dex: {}, kofi: {}, runs: {}, late: { "2026-11-04": { m: [0, 0, 0], g: [], h: [] } } })); }, KEY);
    await pw.reload();
    const bad = [];
    for (const go of ["#go-ach", "#go-cal", "#go-d", "#go-e", "#quit"]) { if (go !== "#quit") await pw.click("#back").catch(() => {}); await pw.click(go); const r = await pw.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) })); if (r.over || r.small.length) bad.push(go + ":" + r.small.join("/")); }
    check(`幅${w}px：実績・記録・結果・とことん（遊ぶ・終わり）の画面もはみ出さず、押せる所は44px以上`, bad.length === 0, bad.join(" "));
    await pw.close(); }
  { // 色だけで分けない（WCAG 1.4.1。shared-workflows routines/game-dev.md A1・A7・A8）：状態は記号・文字・形・aria-label でも出て、知らせは #live（role=status）に文字で出る
    const pc = await newPage(390, 844);
    await pc.evaluate((K) => { localStorage.setItem(K, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, late: {}, dex: {}, runs: {}, kofi: {}, ebest: 0 })); }, KEY); await pc.reload();
    check("読み上げソフトへの知らせの場所 #live（role=status・aria-live=polite）が、どの画面にもある", await pc.evaluate(() => { const l = document.getElementById("live"); return !!l && l.getAttribute("role") === "status" && l.getAttribute("aria-live") === "polite" && !l.closest("#app"); }));
    check("見やすさの設定を開くボタン（data-a11y-open）がホームと遊び方にある", (await pc.locator("#app [data-a11y-open]").count()) === 1 && (await pc.locator("#howto [data-a11y-open]").count()) === 1);
    await pc.click("#go-d");
    const dots = await pc.evaluate(() => [...document.querySelectorAll(".dots i")].map((i) => { const c = getComputedStyle(i); return { cls: i.className, h: i.getBoundingClientRect().height, bg: c.backgroundColor, bw: parseFloat(c.borderTopWidth) }; }));
    check("進み具合の点は色だけでなく形でも分かる（いま＝高い・まだ＝中が空の枠）", dots.length === 3 && dots[0].cls === "on" && dots[0].h > dots[1].h && dots.slice(1).every((d) => d.bg === "rgba(0, 0, 0, 0)" && d.bw >= 1), JSON.stringify(dots));
    const q = await curP(pc), wy = q.d.find((y, j) => { const n = [1, 2, 4, 8].filter((b) => q.m[j] & b).length; return n >= 1 && n <= 3; }) || q.d[0];
    await type(pc, wy); await pc.waitForTimeout(120);
    const mk = await pc.evaluate(() => [...document.querySelectorAll(".mk")].map((e) => e.className.replace("mk ", "") + ":" + e.textContent));
    check("まちがえたとき、熟語になった・ならないは色だけでなく ○・× の記号でも出る", mk.length === 4 && mk.every((t) => t === "ok:○" || t === "ng:×"), mk.join(","));
    check("まちがえたことと、どの向きが熟語になったか（上○・左× など）を #live に文字で知らせる", await pc.evaluate((y) => { const t = document.getElementById("live").textContent; return t.includes("まちがい") && t.includes(y) && /上[○×]・左[○×]・右[○×]・下[○×]/.test(t); }, wy));
    check("問題の盤に読み上げの印（data-a11y-say）と、盤の字を言う aria-label がある", await pc.evaluate(() => { const b = document.querySelector("#bd .board"); return !!b && b.hasAttribute("data-a11y-say") && /上「.」左「.」右「.」下「.」/.test(b.getAttribute("aria-label")); }));
    await pc.click("#hint"); await pc.waitForTimeout(120);
    check("ヒントの知らせも #live に文字で出る", (await pc.textContent("#live")).includes("読み"));
    await type(pc, q.x); await pc.waitForTimeout(120);
    check("正解の知らせは #live に文字（「正解」・星の数）で出て、取れなかった星は ☆（色の濃さだけで分けない）", (await pc.textContent("#live")).includes(`正解「${q.x}」`) && (await pc.textContent(".verdict .stars .off")) === "☆☆");
    await pc.click("#back"); await pc.click("#go-dex");
    check("漢字帳の字は★の数を字の隅（data-st）と aria-label にも出す（朱の塗り・枠の色だけで分けない）", await pc.evaluate((x) => { const b = [...document.querySelectorAll(".dex button")].find((e) => e.textContent === x); return !!b && b.dataset.st === "★1" && getComputedStyle(b, "::after").content.includes("★1") && b.getAttribute("aria-label").includes("星1つ"); }, q.x));
    await pc.click("#back"); await pc.click("#go-ach");
    check("取れた実績は色だけでなく ✓ でも分かり、まだのものは「いま/目標」が出る", await pc.evaluate(() => { const g = document.querySelector('.ach[data-id="first"]'), n = document.querySelector('.ach[data-id="dex50"]'); return g.classList.contains("got") && g.querySelector("b").textContent.startsWith("✓") && !n.querySelector("b").textContent.startsWith("✓") && /\d+\/50/.test(n.querySelector(".pg").textContent); }));
    await pc.close();
    // 色の見分けを助ける・動きを減らす（localStorage a11y-v1）
    const pv = await newPage(390, 844);
    await pv.evaluate((K) => { localStorage.setItem(K, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, late: {}, dex: {}, runs: {}, kofi: {}, ebest: 0 })); localStorage.setItem("a11y-v1", JSON.stringify({ cvd: true, calm: true })); }, KEY);
    await pv.addInitScript(() => { window.__vib = 0; try { Object.defineProperty(navigator, "vibrate", { value: () => { window.__vib++; return true; }, configurable: true }); } catch (e) {} });
    await pv.reload(); await pv.click("#go-d");
    const q2 = await curP(pv), wy2 = q2.d.find((y, j) => q2.m[j] > 0 && q2.m[j] < 15) || q2.d[0];
    await type(pv, wy2);
    const cv = await pv.evaluate(() => { const ok = document.querySelector(".mk.ok"), ng = document.querySelector(".mk.ng"); return { cvd: document.documentElement.classList.contains("a11y-cvd"), ok: ok ? getComputedStyle(ok).backgroundColor : "", ngR: ng ? getComputedStyle(ng).borderTopLeftRadius : "", vib: window.__vib }; });
    check("「色の見分けを助ける」では、熟語になった印を青（#0072B2）に、ならない印を四角に替える", cv.cvd && (!cv.ok || cv.ok === "rgb(0, 114, 178)") && (!cv.ngR || cv.ngR === "3px") && (cv.ok || cv.ngR), JSON.stringify(cv));
    check("「動きを減らす」では、まちがえても振動させない", cv.vib === 0, JSON.stringify(cv));
    await pv.close(); }
} catch (e) { // 途中で止まっても、ここまでの結果とレポートは書き出す
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  try { // キーボードで選んだボタンに枠が出る（all:unset のカレンダーのます目でも消えない。2026-11-04 CodeRabbit の指摘）。止まっても失敗として記録し、レポートまで進む
    const pf = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await pf.goto(url); await pf.evaluate(() => localStorage.clear()); await pf.reload();
    await pf.click("#howto-ok").catch(() => {});
    const bad = [];
    for (const open of [null, "#go-cal"]) {
      if (open) await pf.click(open);
      await pf.keyboard.press("Shift");
      bad.push(...await pf.evaluate(() => {
        const cal = document.querySelector(".cal");
        if (cal) { const b = document.createElement("button"); b.className = (cal.querySelector("button") || cal.lastElementChild).className + " miss"; b.textContent = "1"; cal.append(b); }
        return [...document.querySelectorAll("button:not([disabled]),a[href]")].filter((b) => b.checkVisibility()).filter((b) => { b.focus(); const cs = getComputedStyle(b); return !b.matches(":focus-visible") || cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) < 2; }).map((b) => b.className || b.id || b.tagName);
      }));
    }
    check("キーボードで選んだボタン（カレンダーのあとから遊ぶ日も）に枠が出る", bad.length === 0, bad.join(","));
    await pf.close();
  } catch (e) { check("キーボードで選んだボタン（カレンダーのあとから遊ぶ日も）に枠が出る", false, e.message.split("\n")[0]); }
  try { // 引き継ぎコード（別の端末へ記録を移す。shared-workflows template/qa/transfer-check.mjs）
    await checkTransfer({ browser, url, game: "mannaka-kanji", sample: { "mannaka-v1": JSON.stringify({ v: 1, tut: true }) }, check, open: async (p) => { await p.click("#howto-ok", { timeout: 1500 }).catch(() => {}); } });
  } catch (e) { check("引き継ぎコード", false, e.message.split("\n")[0]); }
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し。routines/game-dev.md「だれでも遊べるように」）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# まんなか漢字 QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
