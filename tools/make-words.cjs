// 入力して答えるときの手がかり用の辞書 words.js を tools/words.txt と data.js から作る（手で直さない）。
// 打った字で「4つのうちいくつ熟語になるか」と別解を確かめるため、盤の字につながる2字の語だけを持つ。
// F[上か左の字] = その字で始まる語の2字目を並べた文字列、B[右か下の字] = その字で終わる語の1字目を並べた文字列。
// 熟語：JMdict（© Electronic Dictionary Research and Development Group、CC BY-SA 4.0）。このファイルが作る words.js も CC BY-SA 4.0。
// 使い方: node tools/make-words.cjs
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "..");
const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, "data.js"), "utf8"), sb);
const P = sb.window.MK_DATA.P;
const W = fs.readFileSync(path.join(root, "tools/words.txt"), "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
const A = new Set(), C = new Set();
for (const p of P) { A.add([...p[2][0]][0]); A.add([...p[2][1]][0]); C.add([...p[2][2]][1]); C.add([...p[2][3]][1]); }
const F = {}, B = {};
for (const w of W) { const [a, b] = [...w]; if (A.has(a)) F[a] = (F[a] || "") + b; if (C.has(b)) B[b] = (B[b] || "") + a; }
const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const out = `// まんなか漢字の手がかり用の辞書。tools/make-words.cjs が tools/words.txt から作る（手で直さない）。\n// 熟語：JMdict（© Electronic Dictionary Research and Development Group、CC BY-SA 4.0）。このファイルも CC BY-SA 4.0。\n// F[上か左の字] = その字で始まる2字の語の2字目、B[右か下の字] = その字で終わる2字の語の1字目\nwindow.MK_WORDS = ${JSON.stringify({ F: sortObj(F), B: sortObj(B) })};\n`;
fs.writeFileSync(path.join(root, "words.js"), out);
console.log(`words.js: ${Object.keys(F).length}+${Object.keys(B).length}字, ${Buffer.byteLength(out)} bytes`);
