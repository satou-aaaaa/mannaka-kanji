// まんなか漢字の検査。問題（答えが1つ・札の印を辞書で確かめ直す）・3問の組み方（何年分）・通しで遊ぶ・まちがいの手がかり・ヒント・続きから・上級・漢字帳・記録・スマホ幅・PWA を確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

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

const html = readFileSync(path.join(root, "index.html"), "utf8");
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習の問題選びだけ（今日の3問・上級・札の並びは日付と問題の乱数）", (html.match(/Math\.random/g) || []).length === 1);
check("熟語の出どころ（JMdict・EDRDG）を画面とデータに書いている", /JMdict/.test(html) && /CC BY-SA 4\.0/.test(readFileSync(path.join(root, "data.js"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/mannaka-kanji/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./data.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
  check("PWA：ネットの返事の保存は、イベントの中で waitUntil に預ける（遅れて届いた新しい版も保存できる）", /e\.waitUntil\(net\.then/.test(sw) && !/\.then\([^\n]*e\.waitUntil/.test(sw));
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
    out.same = JSON.stringify(g.dailyList("2026-12-01")) === JSON.stringify(g.dailyList("2026-12-01"));
    out.tiles = g.P.every((p) => { const a = g.tilesOf(p, 9), b = g.tilesOf(p, 12); return a.includes(p.x) && b.includes(p.x) && new Set(a).size === 9 && new Set(b).size === 12 && JSON.stringify(a) === JSON.stringify(g.tilesOf(p, 9)); });
    out.pos = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => g.P.filter((p) => g.tilesOf(p, 9)[j] === p.x).length);
    return out;
  });
  check("今日の3問は毎日「やさしい・ふつう・むずかしい」、上級はむずかしい3問（3年分）", sel.bad.length === 0, sel.bad.slice(0, 3).join(","));
  check("1周するまで同じ問題は出ない（難しさごと）", sel.dup === 0);
  check("上級は今日の3問目と重ならない（3年分）", sel.hardHit === 0, `${sel.hardHit}日`);
  check("同じ日はいつ開いても同じ3問", sel.same);
  check("札は答えを含み、9枚・12枚とも重ならず、問題ごとに並びが決まる", sel.tiles);
  check("答えの札の場所が偏らない（どの場所も 5〜20%）", sel.pos.every((n) => n >= P.length * 0.05 && n <= P.length * 0.2), sel.pos.join(","));

  // 3. 通しで遊ぶ
  check("初めて開くと遊び方が出る", await page.locator("#howto[open]").count() === 1);
  await page.click("#howto-ok");
  check("ホームの例の盤は遊び方と同じ（史・向・昇・位）", (await page.textContent(".hero .board")).replace(/[\s↓→]/g, "") === "史向？昇位");
  await page.click("#go-d");
  let p = await curP(page);
  check("1問目は「やさしい」・札は9枚・まんなかは「？」", p.t === 0 && (await page.locator(".tile").count()) === 9 && (await page.textContent("#ctr")) === "？");
  const wrong = p.d.find((y, j) => [1, 2, 4, 8].filter((b) => p.m[j] & b).length >= 2 && (j < 8)) || p.d[0];
  const wm = p.m[p.d.indexOf(wrong)], wn = [1, 2, 4, 8].filter((b) => wm & b).length;
  await page.click(`.tile[data-ch="${wrong}"]`);
  check("まちがえると、4つのうちいくつ熟語になったかが盤（○×）と文で分かる", (await page.locator(".mk.ok").count()) === wn && (await page.locator(".mk.ng").count()) === 4 - wn && (await page.textContent("#near")).includes(`${wn}つ熟語`));
  check("まちがえた札は消え、もう押せない（何個なったかが札に残る）", await page.isDisabled(`.tile[data-ch="${wrong}"]`) && (await page.textContent(`.tile[data-ch="${wrong}"]`)).includes(`${wn}/4`));
  await page.click("#hint");
  check("ヒントで上の熟語の読みが出る", (await page.textContent(".cell[data-pos=t] .yomi")) === p.r[0]);
  await page.reload(); await page.click("#go-d");
  check("途中で閉じても、まちがえた札とヒントはそのまま（続きから）", await page.isDisabled(`.tile[data-ch="${wrong}"]`) && (await page.textContent(".cell[data-pos=t] .yomi")) === p.r[0] && (await page.textContent("#miss")).includes("ヒント 1"));
  // 練習を始めても今日の途中は消えない
  await page.click("#back"); await page.click("#go-p"); await page.locator(".lv button").first().click(); await page.click("#back"); await page.click("#go-d");
  check("練習を始めても、今日の途中経過は消えない", await page.isDisabled(`.tile[data-ch="${wrong}"]`) && (await page.evaluate(() => window.__mk.mode())) === "d");
  await page.click(`.tile[data-ch="${p.x}"]`);
  check("正解すると、4つの熟語と読みが出て★1（まちがい1・ヒント1）", (await page.locator(".verdict .words div").count()) === 4 && (await page.textContent(".verdict")).includes(p.w[0]) && (await page.locator(".verdict .stars .off").textContent()).length === 2);
  check("正解のあとは札が消える", !(await page.locator("#tiles").isVisible()));
  await page.click("#next");
  // 別のタブで先に進んでいたら、古い画面の正解は足さない
  p = await curP(page);
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.push({ m: 0, g: [], h: 0 }); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await page.click(`.tile[data-ch="${p.x}"]`);
  check("別のタブで先に進んでいたら、古い画面の正解は足さず今の問題を出し直す", (await page.evaluate(() => window.__mk.load().runs.d.res.length)) === 2 && (await page.textContent("header")).includes("3/3"));
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.pop(); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await page.reload(); await page.click("#go-d");
  for (let j = 0; j < 2; j++) { p = await curP(page); await page.click(`.tile[data-ch="${p.x}"]`); await page.click("#next"); }
  const share = await page.textContent(".share");
  const daily = await page.evaluate(() => { const g = window.__mk; return g.dailyList(g.todayKey()).map((id) => g.P[id]); });
  check("3問で結果・シェアの文は番号と色だけ（答えの字・熟語は出さない）", /まんなか漢字 #\d+/.test(share) && /やさしい (🟨|⬜)💡🟩/.test(share) && /ふつう 🟩/.test(share) && !daily.some((q) => share.includes(q.x) || q.w.some((w) => share.includes(w))));
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("まちがいのあった日は Ko-fi のひとことを出さない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  check("ホームで連続1日・今日の結果を見るに変わる・漢字帳に3字", (await page.textContent(".stats")).includes("1連続の日") && (await page.textContent("#go-d")).includes("今日の結果") && (await page.textContent("#go-dex")).includes("3/"));
  // 上級：札12枚・ヒントなし・全問一発なら Ko-fi
  await page.click("#go-h");
  check("上級は札12枚・ヒントのボタンが無い・むずかしい", (await page.locator(".tile").count()) === 12 && (await page.locator("#hint").count()) === 0 && (await curP(page)).t === 2);
  for (let j = 0; j < 3; j++) { p = await curP(page); await page.click(`.tile[data-ch="${p.x}"]`); await page.click("#next"); }
  check("上級を全問一発で初めて終えると、結果に Ko-fi のひとことが1行", (await page.locator(".kofi").count()) === 1 && (await page.textContent(".big")).includes("全問一発"));
  await page.click("#back"); await page.click("#go-h");
  check("2回目に結果を開いても Ko-fi のひとことは出ない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  // 練習：記録の日を増やさず、漢字帳には載る
  // 期待値を練習の乱数に頼らない：遊んだ字が今日の問題と重なることがあるので、数でなく「遊んだ字が載ったか」を見る
  await page.click("#go-p"); await page.locator(".lv button").nth(1).click();
  const played = [];
  for (let j = 0; j < 3; j++) { p = await curP(page); played.push(p.x); await page.click(`.tile[data-ch="${p.x}"]`); await page.click("#next"); }
  const after = await page.evaluate(() => { const s = window.__mk.load(); return { days: Object.keys(s.days).length, dex: s.dex }; });
  check("練習は今日の記録を増やさず、漢字帳には載る", after.days === 1 && played.every((x) => after.dex[x] >= 1) && (await page.locator(".share").count()) === 0, played.join(""));
  await page.click("#go-dex");
  check("漢字帳に集めた字が出て、押すと熟語と読みが見られる", (await page.locator(".dex button").count()) === Object.keys(after.dex).length);
  await page.locator(".dex button").first().click();
  check("漢字帳の字を押すと盤と4つの熟語", (await page.locator(".sheet .words div").count()) === 4);
  await page.close();

  // 4. スマホ幅：はみ出さない・押せる所は44px以上
  for (const w of [320, 390]) {
    const p3 = await newPage(w, 700); await p3.click("#howto-ok");
    const homeOk = await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p3.click("#go-d");
    const r = await p3.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) }));
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
    const pn = await newPage();
    await pn.evaluate((k) => { const g = window.__mk, d = new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ m: 0, g: [], h: 0 })) } } })); }, KEY);
    await pn.reload();
    check("前の日に終えて閉じても、翌日に開くとその日の記録がつく", await pn.evaluate(() => { const g = window.__mk; return !!g.load().days[new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10)] && !g.load().runs.d; }));
    await pn.close(); }
} catch (e) { // 途中で止まっても、ここまでの結果とレポートは書き出す
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

const ng = results.filter((r) => !r.ok);
const md = `# まんなか漢字 QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
