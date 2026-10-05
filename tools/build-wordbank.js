/* ============================================================
   build-wordbank.js — 从 ECDICT 生成扩充词条，注入 index.html
   产物：
   1. index.html 内新增 const WORDS_EXTRA=[...]（保留原 WORDS 精编词不动）
   2. tools/new-words.json      新词清单（供音频下载脚本用）
   3. tools/tpl-sentences.json  模板例句清单（供 edge-tts 生成用）
   ============================================================ */
const fs = require("fs");

const ROOT = "C:/Users/fm520/WorkBuddy/2026-10-01-01-17-06/english-phonics";
const CSV = ROOT + "/tools/ecdict.csv";
const HTML = ROOT + "/ios-pack/www/index.html";

function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/* ---------- CSV 解析 ---------- */
function parseCsvLine(line) {
  const out = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/* ---------- IPA 音素表 ---------- */
const VOWELS_IPA = new Set(["iː","ɪ","e","æ","ɑː","ɒ","ɔː","ʊ","uː","ʌ","ɜː","ə",
  "eɪ","aɪ","ɔɪ","əʊ","aʊ","ɪə","eə","ʊə"]);
const CONS_IPA = new Set(["p","b","t","d","k","ɡ","tʃ","dʒ","f","v","θ","ð","s","z","ʃ","ʒ","m","n","ŋ","h","l","r","j","w"]);
/* IPA → PHON_AUDIO key（无匹配时点击音素回退合成音） */
const IPA2KEY = {
  "p":"p","b":"b","t":"t","d":"d","k":"k","ɡ":"g","f":"f","v":"v","s":"s","z":"z",
  "m":"m","n":"n","h":"h","l":"l","r":"r","w":"w","j":"y","θ":"th","ð":"th",
  "ʃ":"sh","ʒ":"sh","tʃ":"ch","dʒ":"j","ŋ":"ng",
  "iː":"ee","ɪ":"i","e":"eh","æ":"a","ɑː":"ar","ɒ":"o","ɔː":"or","ʊ":"uh","uː":"oo",
  "ʌ":"uh","ɜː":"er","ə":"uh","eɪ":"ay","aɪ":"eye","ɔɪ":"oy","əʊ":"oh","aʊ":"ow",
  "ɪə":"ear","eə":"air","ʊə":"oor"
};

function parseIpa(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^\/+|\/+$/g, "");
  /* 多读音只取第一个（"castle: 'kæsl. 'kɑ:sl" → 取第一段）。
     注意：不能无脑按点号切！ECDICT 用「前导点号」表示次重音（understand=.ʌndә'stænd、
     conversation=.kɒnvә'seiʃәn），下面会把 . / , 统一转成 ˌ。 */
  s = s.split(/\.\s+/)[0].split(/[;；|]/)[0].trim();
  /* ECDICT 简化记法规范化 */
  s = s.replace(/\(([^)]*)\)/g, "$1");            // (r) → r
  /* 西里尔/老式替代字形：ә=ə、є=e（air"єә"、care"kєә"、chair"tʃєә" 等高频词全靠这条救回） */
  s = s.replace(/ә/g, "ə").replace(/є/g, "e").replace(/'’/g, "'");
  s = s.replace(/['’]/g, "ˈ");                   // ASCII 撇号 → 主重音
  s = s.replace(/[.,]/g, "ˌ");                    // . 或 , → 次重音
  s = s.replace(/:/g, "ː");
  /* 双元音记法规范化（ECDICT 用 ei/ai/ɔi/əu/au/iə/eə/uə） */
  s = s.replace(/ei/g, "eɪ").replace(/ai/g, "aɪ").replace(/ɔi/g, "ɔɪ")
       .replace(/əu/g, "əʊ").replace(/au/g, "aʊ")
       .replace(/iə/g, "ɪə").replace(/uə/g, "ʊə");
  s = s.replace(/ou/g, "əʊ");                    // ECDICT 老式记法：go"gou" → /ɡəʊ/
  /* 元音长短规范化 */
  s = s.replace(/ɒː/g, "ɔː").replace(/əː/g, "ɜː");
  s = s.replace(/ʤ/g, "dʒ").replace(/ʧ/g, "tʃ").replace(/g/g, "ɡ");
  s = s.replace(/[|‿·]/g, "");
  if (!s) return null;
  const phons = []; const stressAt = []; const secAt = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "ˈ") { stressAt.push(phons.length); i++; continue; }
    if (ch === "ˌ") { secAt.push(phons.length); i++; continue; }
    let matched = null, take = 1;
    const two = s.substr(i, 2);
    if (["eɪ","aɪ","ɔɪ","əʊ","aʊ","ɪə","eə","ʊə","tʃ","dʒ","iː","ɑː","ɔː","ɜː","uː"].includes(two)) { matched = two; take = 2; }
    else if (ch === "i") matched = "ɪ";           // ECDICT 单写 i = 短音 /ɪ/
    else if (ch === "u") matched = "ʊ";           // 单写 u = /ʊ/
    else if (ch === "ɔ") matched = "ɔː";
    else if (ch === "ɑ") matched = "ɑː";
    else if (ch === "ɜ") matched = "ɜː";
    else if (VOWELS_IPA.has(ch) || CONS_IPA.has(ch)) matched = ch;
    if (!matched) return null;
    phons.push(matched);
    i += take;
  }
  if (!phons.length) return null;
  return { phons, stressAt, secAt };
}

/* ---------- 字母-音素对齐（带代价的 DP） ---------- */
const G3 = ["igh","tch","dge","air","are","ear","eer","ere","ire","ore","our","oor","ure","augh","ough","eur"];
const G2 = ["sh","ch","th","ph","wh","ck","ng","qu","dg","gh","sc","oo","ee","ea","ai","ay","au","aw","ow","ou","oi","oy","oa","ie","ei","ey","ue","ui","eu","oe","ar","er","ir","or","ur","yr","ew","kn","wr","mb","ll","ss","tt","pp","bb","dd","gg","ff","zz","rr","nn","mm","cc"];
const VC = "bcdfghjklmnpqrstvwxyz";
const MAP1 = {
  b:["b"], c:["k","s","tʃ","ʃ"], d:["d","dʒ"], f:["f"], g:["ɡ","dʒ","ʒ"], h:["h"], j:["dʒ"],
  k:["k"], l:["l"], m:["m"], n:["n","ŋ","nɡ"], p:["p"], q:["k","w"], r:["r"], s:["s","z","ʃ"],
  t:["t","ʃ","tʃ","θ"], v:["v"], w:["w"], x:["k","s"], y:["j","ɪ","aɪ","iː","i","ə"], z:["z"],
  a:["æ","eɪ","ɑː","ɒ","ə","ɔː","e","aɪ"], e:["e","iː","ə","ɪ","eɪ","i"],
  i:["ɪ","aɪ","iː","i","ə","e"], o:["ɒ","əʊ","ʌ","uː","ʊ","ɔː","ə","ɪ","aʊ"],
  u:["ʌ","ʊ","uː","juː","ə","ɪ","e","ɔː","w"]
};
const MAP2 = {
  sh:["ʃ"], ch:["tʃ","k","ʃ"], th:["θ","ð"], ph:["f"], wh:["w","h"], ck:["k"],
  ng:["ŋ"], qu:["k","w"], dg:["dʒ"], gh:["ɡ","f",""], sc:["s","sk"],
  oo:["ʊ","uː","ʌ","əʊ"], ee:["iː","ɪə"], ea:["iː","e","eɪ","ɪə","eə","ɑː","ɪ"],
  ai:["eɪ","e","ɑː","ɪə"], ay:["eɪ"], au:["ɔː","ɑː","ə"], aw:["ɔː"],
  ow:["əʊ","aʊ","ɒ"], ou:["aʊ","ʌ","əʊ","uː","ʊ","ɔː","ɪ","ə"],
  oi:["ɔɪ"], oy:["ɔɪ"], oa:["əʊ","ɔː"], ie:["aɪ","iː","e","ɪ"], ei:["eɪ","iː","aɪ"],
  ey:["eɪ","iː","ɪ"], ue:["uː","juː","e"], ui:["uː","juː","ɪ","w"], eu:["juː"], oe:["əʊ","uː"],
  ar:["ɑː","ə","ɔː","eə"], er:["ɜː","ə","ɪə","ɔː","aʊ"], ir:["ɜː","ə","aɪ"],
  or:["ɔː","ɜː","ə","aʊ","ɒ"], ur:["ɜː","ʊə","ʊ","ə","jʊə"], yr:["ɜː","aɪ"],
  ew:["uː","juː","əʊ"], kn:["n"], wr:["r"], mb:["m"],
  ll:["l"], ss:["s","z"], tt:["t"], pp:["p"], bb:["b"], dd:["d"], gg:["ɡ"], ff:["f"],
  zz:["z"], rr:["r"], nn:["n"], mm:["m"], cc:["k","s"]
};
const MAP3 = {
  igh:["aɪ"], tch:["tʃ"], dge:["dʒ"], air:["eə"], are:["eə","ɑː"],
  ear:["ɪə","eə","ɜː"], eer:["ɪə"], ere:["ɪə","eə"], ire:["aɪ","ə"],
  ore:["ɔː"], our:["aʊ","ə","ɔː","ʊə","ɜː"], oor:["ʊə","ɔː"],
  ure:["ə","ʊə","jʊə","ɜː","ʊ"], augh:["ɔː","ɑːf"], ough:["ɔː","əʊ","ʌ","uː"], eur:["jʊə","ʊə"]
};
const MAPM = { x:[["k","s"],["ɡ","z"]], qu:[["k","w"]], u:[["j","uː"],["j","ʊ"],["j","ʊə"]], o:[["w","ʌ"]] };
const SILENT_OK = new Set(["gh","kn","wr","mb","ue","ough","augh","ll","ss","tt","pp","bb","dd","gg","ff","zz","rr","nn","mm","cc"]);

function alignWord(letters, phons) {
  const L = letters, P = phons;
  const nl = L.length, np = P.length;
  const INF = 1e9;
  const dp = Array.from({ length: nl + 1 }, () => new Array(np + 1).fill(INF));
  const bk = Array.from({ length: nl + 1 }, () => new Array(np + 1).fill(null));
  dp[0][0] = 0;
  const cand = (i) => {
    const out = [];
    if (i + 3 <= nl && G3.includes(L.substr(i, 3))) out.push([3, L.substr(i, 3)]);
    if (i + 2 <= nl && G2.includes(L.substr(i, 2))) out.push([2, L.substr(i, 2)]);
    if (i < nl) out.push([1, L[i]]);
    return out;
  };
  for (let i = 0; i <= nl; i++) {
    for (let j = 0; j <= np; j++) {
      const c0 = dp[i][j];
      if (c0 >= INF) continue;
      for (const [len, g] of cand(i)) {
        /* 1 grapheme → 2 phonemes（x, qu, u→juː, o→wʌ 等） */
        const mm = MAPM[g];
        if (mm && j + 2 <= np) {
          for (const opt of mm) {
            if (opt[0] === P[j] && opt[1] === P[j + 1]) {
              const cost = c0 + 1;
              if (cost < dp[i + len][j + 2]) { dp[i + len][j + 2] = cost; bk[i + len][j + 2] = { pi: i, pj: j, g, n: 2 }; }
            }
          }
        }
        if (j + 1 <= np) {
          const table = len === 3 ? MAP3 : len === 2 ? MAP2 : MAP1;
          const known = table[g];
          let cost;
          if (known) cost = known.includes(P[j]) ? (len === 1 ? 1 : 0.5) : 6;
          else cost = len === 1 ? (VC.includes(g) ? 7 : 5) : 5;
          const cost2 = c0 + cost;
          if (cost2 < dp[i + len][j + 1]) { dp[i + len][j + 1] = cost2; bk[i + len][j + 1] = { pi: i, pj: j, g, n: 1 }; }
        }
        if (j <= np) {
          const isEndE = (i + len === nl) && g === "e";
          /* 双字组白名单静默成本 1.2；任意单字母静默 3.5（listen 的 t、island 的 s 等） */
          const silentCost = SILENT_OK.has(g) || isEndE ? 1.2 : (len === 1 ? 3.5 : INF);
          if (silentCost < INF) {
            const cost = c0 + silentCost;
            if (cost < dp[i + len][j]) { dp[i + len][j] = cost; bk[i + len][j] = { pi: i, pj: j, g, n: 0 }; }
          }
        }
      }
    }
  }
  if (dp[nl][np] >= INF) return null;
  const pairs = [];
  let i = nl, j = np;
  while (i > 0 || j > 0) {
    const b = bk[i][j];
    if (!b) return null;
    pairs.unshift({ g: b.g, phon: b.n === 0 ? null : (b.n === 2 ? [P[b.pj], P[b.pj + 1]] : P[b.pj]) });
    i = b.pi; j = b.pj;
  }
  return { pairs, cost: dp[nl][np] };
}

/* ---------- 音节切分 ---------- */
function splitSyllables(items) {
  const vowelIdx = [];
  items.forEach((it, i) => { if (it.phon && VOWELS_IPA.has(it.phon)) vowelIdx.push(i); });
  if (vowelIdx.length === 0) return null;
  if (vowelIdx.length === 1) {
    return { syl: [{ letters: items.map(x => x.letters).join(""), ipa: items.map(x => x.phon).filter(Boolean).join("") }], stress: 0, stress2: -1 };
  }
  const bounds = [0];
  for (let k = 0; k < vowelIdx.length - 1; k++) {
    const a = vowelIdx[k], b = vowelIdx[k + 1];
    const cons = [];
    for (let i = a + 1; i < b; i++) if (items[i].phon && CONS_IPA.has(items[i].phon)) cons.push(i);
    let cut;
    if (cons.length === 0) cut = a + 1;
    else if (cons.length === 1) cut = cons[0];
    else {
      let c = cons[0];
      if (items[cons[1]].phon.length === 2) c = cons[0];
      cut = c + 1;
    }
    bounds.push(cut);
  }
  bounds.push(items.length);
  const syl = [];
  for (let k = 0; k < bounds.length - 1; k++) {
    const seg = items.slice(bounds[k], bounds[k + 1]);
    if (!seg.length) continue;
    syl.push({
      letters: seg.map(x => x.letters).join(""),
      ipa: seg.map(x => x.phon).filter(Boolean).join("")
    });
  }
  return { syl, bounds };
}

/* ---------- 模板例句（基于真实释义，避免 "This is a picture of a more." 这类占位 nonsense） ---------- */
const TPL = {
  n: [
    ["The word \"{w}\" means {zh}.", "「{w}」的意思是{zh}。"],
    ["You can remember \"{w}\" as {zh}.", "你可以把「{w}」理解为{zh}。"]
  ],
  v: [
    ["The word \"{w}\" means {zh}.", "「{w}」的意思是{zh}。"],
    ["You can remember \"{w}\" as {zh}.", "你可以把「{w}」理解为{zh}。"]
  ],
  adj: [
    ["The word \"{w}\" means {zh}.", "「{w}」的意思是{zh}。"],
    ["You can remember \"{w}\" as {zh}.", "你可以把「{w}」理解为{zh}。"]
  ],
  other: [
    ["The word \"{w}\" means {zh}.", "「{w}」的意思是{zh}。"],
    ["You can remember \"{w}\" as {zh}.", "你可以把「{w}」理解为{zh}。"]
  ]
};
function pickSent(word, pos, trText) {
  let key = "other";
  if (/^n\./.test(pos)) key = "n";
  else if (/^v/.test(pos)) key = "v";
  else if (/^adj/.test(pos)) key = "adj";
  const pool = TPL[key];
  let h = 0; for (const c of word) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const t = pool[h % pool.length];
  let gl = String(trText || word).split(/[;；,，。]/)[0].replace(/^(n|v|adj|adv|prep|pron|conj|interj|num|art)\.\s*/, "").trim();
  if (!gl || gl.length > 14) gl = word;
  const en = t[0].replace(/\{w\}/g, word);
  const zhOut = t[1].replace(/\{w\}/g, word).replace(/\{zh\}/g, gl);
  return [en, zhOut];
}

/* ---------- rule 文案 ---------- */
function makeRule(word, pairs, sylN) {
  const low = word;
  const hasTeam = pairs.some(p => p.g.length >= 2 && "aeiou".includes(p.g[0]) && p.phon);
  const magicE = /[^aeiou]e$/.test(low) && pairs.length > 2 && pairs[pairs.length - 1].phon === null;
  const rCtl = pairs.some(p => /^[aeiou]r$/.test(p.g) && p.phon);
  if (sylN === 1) {
    if (magicE) return "<b>魔法 e</b>：词尾不发音的 e 让前面的元音读它的字母名（长音），如 a→/eɪ/";
    if (hasTeam) return "<b>元音组合</b>：两个元音字母组合起来读一个音，组合多为固定发音";
    if (rCtl) return "<b>r 控制元音</b>：元音 + r 组合读卷舌长音，r 改变元音读法";
    return "<b>CVC 闭音节</b>：辅音+元音+辅音，重读闭音节中元音读短音";
  }
  if (magicE) return "<b>开音节 + 魔法 e</b>：词尾不发音的 e 让重读音节的元音读长音";
  if (hasTeam) return "<b>多音节 + 元音组合</b>：注意重读音节里的元音组合发音；非重读元音常弱化为 /ə/";
  if (rCtl) return "<b>r 控制元音</b>：重读音节中元音 + r 读卷舌音；非重读音节常弱化为 /ə/";
  return "<b>多音节词</b>：先找准重读音节，非重读的元音常弱化成 /ə/（schwa），这是听懂长词的关键";
}

/* ---------- exchange → forms 文案 ---------- */
function makeForms(ex) {
  if (!ex) return "";
  const m = {};
  ex.split("/").forEach(kv => {
    const [k, v] = kv.split(":");
    if (v && v !== "0") m[k] = v;
  });
  const seg = [];
  if (m.s) seg.push("复数 " + m.s);
  if (m.p) seg.push("过去式 " + m.p);
  if (m.d && m.d !== m.p) seg.push("过去分词 " + m.d);
  if (m.i) seg.push("现在分词 " + m.i);
  if (m["3"]) seg.push("三单 " + m["3"]);
  if (m.r) seg.push("比较级 " + m.r);
  if (m.t) seg.push("最高级 " + m.t);
  return seg.slice(0, 3).join("；");
}

/* ---------- 主流程 ---------- */
const EXAM_TAG = { zk: "中考", gk: "高考", cet4: "四级", cet6: "六级", ky: "考研", ielts: "雅思", toefl: "托福" };
/* 扩容版配额：每类放宽约 3 倍 + 新增 common 高频桶（近似 sight words / 日常高频），目标产出 ~8000 词 */
const QUOTA = { zk: 1400, gk: 1900, cet4: 2400, cet6: 1900, ky: 1500, ielts: 1700, toefl: 1700, common: 1600 };

// 仅剥离「ECDICT 自动生成的 WORDS_EXTRA 块」：锚定 ECDICT 专属注释 + const WORDS_EXTRA=[
// 注意：WORDS 数组内部的 v17 注释也以「扩充词库」开头，若用宽泛正则会从它开始匹配并吞掉 WORDS 的闭合 ];，导致脚本语法损坏。
let html = fs.readFileSync(HTML, "utf8").replace(/(?:\/\* ===== 扩充词库（数据源 ECDICT[\s\S]*?\*\/\s*)?const WORDS_EXTRA=\[[\s\S]*?WORDS\.push\.apply\(WORDS,WORDS_EXTRA\);/, "");
const mWords = html.match(/const WORDS = \[([\s\S]*?)\n\];/);
if (!mWords) { console.error("FATAL: 未找到 WORDS 数组"); process.exit(1); }
const existing = new Set();
const reW = /\{w:"([^"]+)"/g; let mm;
while ((mm = reW.exec(html))) existing.add(mm[1]);   // 扫描整份（已剥离旧 EXTRA），确保 WORDS 精编词全部去重
console.error("原有词条:", existing.size);

const data = fs.readFileSync(CSV, "utf8");
const lines = data.split("\n");
console.error("CSV 行数:", lines.length);
const seen = new Set();
const byTag = {}; Object.keys(QUOTA).forEach(t => byTag[t] = []);
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].replace(/\r$/, "");
  if (!line) continue;
  const parts = parseCsvLine(line);
  if (parts.length < 11) continue;
  const wordRaw = parts[0], phon = parts[1], def = parts[2], tr = parts[3], pos = parts[4],
    collins = parts[5], oxford = parts[6], tag = parts[7], bnc = parts[8], frq = parts[9], ex = parts[10];
  /* 大写开头的专有/节日名词（Christmas / Monday / January 等）统一转小写后收词 */
  const word = /^[A-Z]/.test(wordRaw || "") ? wordRaw.toLowerCase() : wordRaw;
  if (!/^[a-z][a-z'-]{1,13}$/.test(word)) continue;
  if (existing.has(word) || seen.has(word)) continue;
  if (!phon || !tr) continue;
  if (phon.length > 24) continue;
  const tl = tag ? tag.split(/\s+/).filter(t => QUOTA[t]) : [];
  const rank = [parseInt(frq) || 0, parseInt(bnc) || 0].filter(v => v > 0).sort((a, b) => a - b)[0] || 0;
  let mainTag = tl.length ? tl.slice().sort((a, b) => QUOTA[b] - QUOTA[a])[0] : null;
  /* 高频但无考试标签的词（近似 sight words / 日常高频）进 common 桶，补足阅读高频词 */
  if (!mainTag && (rank > 0 && rank <= 2000 || parseInt(collins) >= 3)) mainTag = "common";
  if (!mainTag) continue;
  byTag[mainTag].push({ word, phon, def, tr, pos, collins, oxford, tag: mainTag === "common" ? [] : tl, rank, ex });
  seen.add(word);
}
const chosen = new Map();
for (const t of Object.keys(QUOTA)) {
  const arr = byTag[t].sort((a, b) => (a.rank || 99999) - (b.rank || 99999)).slice(0, QUOTA[t]);
  arr.forEach(x => { if (!chosen.has(x.word)) chosen.set(x.word, x); });
}
console.error("配额入选:", chosen.size);
/* 补词模式（--fill-all）：放宽所有「考试标签」桶的名额，把带中考/高考/四六级/考研/雅思/托福标签
   且未被入选的词全部补齐，消除如 congratulation / airport / go / one / use 等高频缺口。
   注意：不受理无考试标签的 common 桶，避免把低频词灌进来。 */
if (process.argv.includes("--fill-all")) {
  const FILL_TAGS = ["zk", "gk", "cet4", "cet6", "ky", "ielts", "toefl"];
  let added = 0;
  for (const t of FILL_TAGS) {
    for (const x of (byTag[t] || [])) if (!chosen.has(x.word)) { chosen.set(x.word, x); added++; }
  }
  console.error("补词模式新增:", added, "→ 入选总数:", chosen.size);
}

const FAILS = [];
const out = []; const stats = { align: 0, fuzzy: 0, fail: 0, reject: 0 };
const phonIndex = {};   // 音素 → 词列表（第二遍填充 chunk 例词）
const alignedAll = [];  // {entry, pairs}

for (const x of chosen.values()) {
  let ipa = parseIpa(x.phon);
  if (!ipa) { stats.fail++; FAILS.push([x.word,x.phon,"ipa解析"]); continue; }
  const letters = x.word.replace(/[^a-z]/g, "");
  let al = alignWord(letters, ipa.phons);
  /* 兜底重试：ECDICT 少数多读音未用空格分隔（如 live=liv.laiv），整体对齐失败时再按点号取第一段 */
  if (!al && /\./.test(String(x.phon))) {
    const ipa2 = parseIpa(String(x.phon).split(".")[0]);
    if (ipa2) { const al2 = alignWord(letters, ipa2.phons); if (al2) { ipa = ipa2; al = al2; } }
  }
  if (!al) { stats.fail++; FAILS.push([x.word,x.phon,"对齐失败"]); continue; }
  /* 质量门控（扩容版放宽）：代价过高 or 出现 ≥3 个单字母模糊静默 → 拒收 */
  const silentSingles = al.pairs.filter(p => !p.phon && p.g.length === 1 && !/e$/.test(letters)).length;
  if (al.cost > 20 || silentSingles >= 3) { stats.reject++; FAILS.push([x.word,x.phon,"门控拒收 cost="+al.cost]); continue; }
  if (al.cost >= 6) stats.fuzzy++; else stats.align++;
  /* chunks：静默字母并入相邻 chunk（有后继归后继，词尾归前驱 → "name" 切成 na+me 式） */
  const ALLPHONS = new Set([...VOWELS_IPA, ...CONS_IPA]);
  const chunkList = [];
  let pendingSilent = "";
  for (const p of al.pairs) {
    if (!p.phon) { pendingSilent += p.g; continue; }
    const ph = Array.isArray(p.phon) ? p.phon.join("") : p.phon;
    /* 元音判定：单音素或多音素串（one 的 o→"wʌ"、use 的 u→"juː"）只要含元音音素就算元音块，
       否则会被判成"无元音"而整词丢弃（one / use 等高频词曾因此缺失） */
    const isVow = VOWELS_IPA.has(ph) || /[iɪeæɑɒɔʊuʌɜə]/.test(ph);
    chunkList.push({ g: pendingSilent + p.g, ph, key: IPA2KEY[ph] || ph, vow: isVow });
    pendingSilent = "";
  }
  if (pendingSilent && chunkList.length) chunkList[chunkList.length - 1].g += pendingSilent;
  if (!chunkList.length) { stats.fail++; FAILS.push([x.word,x.phon,"无音素块"]); continue; }
  const chunks = chunkList.map(c => [c.g, "/" + c.ph + "/", c.key, "", ...(c.vow ? [] : [null])]);
  /* 音节：按元音 chunk 划界（两元音间辅音：1 个归后，≥2 个首个归前） */
  const vowIdx = [];
  chunkList.forEach((c, i) => { if (c.vow) vowIdx.push(i); });
  if (!vowIdx.length) { stats.fail++; FAILS.push([x.word,x.phon,"无元音块"]); continue; }
  let sylArr;
  if (vowIdx.length === 1) {
    sylArr = [{ letters: chunkList.map(c => c.g).join(""), ipa: chunkList.map(c => c.ph).join("") }];
  } else {
    const cb = [0];
    for (let k = 0; k < vowIdx.length - 1; k++) {
      const a = vowIdx[k], b = vowIdx[k + 1];
      const cons = [];
      for (let i = a + 1; i < b; i++) if (!chunkList[i].vow) cons.push(i);
      let cut;
      if (cons.length === 0) cut = a + 1;
      else if (cons.length === 1) cut = cons[0];
      else cut = cons[0] + 1;
      cb.push(cut);
    }
    cb.push(chunkList.length);
    sylArr = [];
    for (let k = 0; k < cb.length - 1; k++) {
      const seg = chunkList.slice(cb[k], cb[k + 1]);
      if (!seg.length) continue;
      sylArr.push({ letters: seg.map(c => c.g).join(""), ipa: seg.map(c => c.ph).join("") });
    }
  }
  /* 重音：音素序号（ˈ 在的音素）→ chunk 序号 → 音节序号 */
  let stress = 0, stress2 = -1;
  if (sylArr.length > 1) {
    const phonCnt = chunkList.map(c => ALLPHONS.has(c.ph) ? 1 : 2);
    const chunkSyl = new Array(chunkList.length).fill(0);
    const vIdx = [];
    chunkList.forEach((c, i) => { if (c.vow) vIdx.push(i); });
    const bnd = [0];
    for (let k = 0; k < vIdx.length - 1; k++) {
      const a = vIdx[k], b = vIdx[k + 1];
      const cons = [];
      for (let i = a + 1; i < b; i++) if (!chunkList[i].vow) cons.push(i);
      bnd.push(cons.length === 0 ? a + 1 : cons.length === 1 ? cons[0] : cons[0] + 1);
    }
    bnd.push(chunkList.length);
    for (let k = 0; k < bnd.length - 1; k++)
      for (let i = bnd[k]; i < bnd[k + 1]; i++) chunkSyl[i] = k;
    const sylOfPhon = (pi) => {
      let cnt = 0;
      for (let i = 0; i < chunkList.length; i++) {
        if (cnt >= pi) return chunkSyl[i];
        cnt += phonCnt[i];
      }
      return chunkSyl[chunkList.length - 1];
    };
    if (ipa.stressAt.length) stress = Math.min(sylOfPhon(ipa.stressAt[0]), sylArr.length - 1);
    if (ipa.secAt.length) stress2 = Math.min(sylOfPhon(ipa.secAt[0]), sylArr.length - 1);
  }
  const rank = x.rank;
  const lvRank = (rank > 0 && rank <= 800) ? 1 : rank <= 2500 ? 2 : rank <= 5000 ? 3 : (rank > 0 ? 4 : (x.tag.includes("zk") || x.tag.includes("gk") ? 2 : 3));
  const itG = (rank > 0 && rank <= 2500) ? "基础" : (rank > 0 && rank <= 6000) ? "进阶" : (rank > 6000 ? "高阶" : "进阶");
  const trLines = x.tr.split(/\\n|\n/).map(s => s.trim()).filter(l => l && !l.startsWith("[网络") && !l.startsWith("[经]"));
  let zh = (trLines[0] || "").replace(/^(n|v|adj|adv|prep|pron|conj|interj|num|art|vt|vi)\.\s*/, "").replace(/\s+/g, " ").trim().slice(0, 42);
  if (!zh) zh = x.word;
  const pos2 = (x.pos || (trLines[0] ? ((trLines[0].match(/^(n|v|adj|adv|prep|pron|conj|interj|num|art)\./) || [])[0] || "") : "")).trim();
  const sent = pickSent(x.word, pos2, trLines.join("；"));
  let col = null;
  if (x.def && x.def.length > 8) {
    const defFirst = String(x.def).split(/\.\s+/)[0];
    col = { star: (parseInt(x.collins) || 0) > 0 ? parseInt(x.collins) : 2, en: `<b>${x.word}</b> ${escHtml(defFirst.slice(0, 120))}.`, zh };
  }
  const entry = {
    w: x.word,
    ip: "/" + ipa.phons.join("") + "/",
    pos: pos2 || "",
    zh,
    auto: 1,
    syl: sylArr.map(s => [s.letters, s.ipa]),
    stress,
    forms: makeForms(x.ex),
    col,
    chunks,
    rule: makeRule(x.word, al.pairs, sylArr.length),
    phrases: [],
    sent,
    exam: x.tag.map(t => EXAM_TAG[t]).filter(Boolean),
    lv: lvRank,
    it: itG,
    dict: (parseInt(x.oxford) ? { ox: 1 } : {}),
    coca: x.rank || 0
  };
  if (stress2 >= 0 && stress2 !== stress) entry.stress2 = stress2;
  out.push(entry);
  alignedAll.push({ entry, pairs: al.pairs, cost: al.cost });
  /* 音素 → 词索引（取短词作例词） */
  al.pairs.forEach(p => {
    const ph = Array.isArray(p.phon) ? p.phon.join("") : p.phon;
    if (!ph) return;
    (phonIndex[ph] = phonIndex[ph] || []).push(x.word);
  });
}

/* 第二遍：给每个 chunk 填 2 个例词（优先同字母组合的短词） */
for (const { entry, pairs } of alignedAll) {
  entry.chunks.forEach((c, ci) => {
    const g = pairs[ci] ? pairs[ci].g : "";
    const ph = c[1].replace(/\//g, "");
    const words = (phonIndex[ph] || []).filter(w => w !== entry.w);
    const same = words.filter(w => w.includes(g)).sort((a, b) => a.length - b.length);
    const pick = (same.length ? same : words.slice()).slice(0, 2);
    c[3] = pick.join(" · ");
  });
}
console.error("对齐成功(可信):", stats.align, " 模糊:", stats.fuzzy, " 失败:", stats.fail, " 门控拒收:", stats.reject, " 产出词条:", out.length);

/* ---------- 拆分与实际一致性校验（必须做：代码生成的 syl/chunks 不允许与词典实际发音冲突） ---------- */
const _strip = s => String(s || "").replace(/[\s/ˈˌ]/g, "");
const _letters = s => String(s || "").replace(/[^a-zA-Z]/g, "").toLowerCase();
/* 记法约定豁免：双辅音音节边界（op·por）、英式可选 (r)、弱化 ə/长音 ː——都不是真冲突 */
function sylIpaClass(a, b) {
  if (a === b) return null;
  const V = {
    "原样": s => s,
    "去可选(r)": s => s.replace(/\(r\)/g, ""),
    "双辅音边界": s => s.replace(/\(r\)/g, "").replace(/(.)\1+/g, "$1"),
    "弱化ə/ː": s => s.replace(/\(r\)/g, "").replace(/[əː]/g, "").replace(/(.)\1+/g, "$1")
  };
  for (const k of Object.keys(V)) if (V[k](a) === V[k](b)) return k;
  return "冲突";
}
const SYL_BAD = [];
for (const e of out) {
  if (!e.syl || !e.syl.length) { SYL_BAD.push({ w: e.w, why: "无 syl" }); continue; }
  const issues = [];
  const jl = _letters(e.syl.map(s => s[0]).join(""));
  if (jl !== _letters(e.w)) issues.push("字母拼回不一致 syl=" + jl);
  const cls = sylIpaClass(_strip(e.syl.map(s => s[1]).join("")), _strip(e.ip));
  if (cls === "冲突") issues.push(`音标拼回冲突 syl=${_strip(e.syl.map(s => s[1]).join(""))} ip=${_strip(e.ip)}`);
  if (!(e.stress >= 0 && e.stress < e.syl.length)) issues.push("主重音下标越界 " + e.stress);
  if (e.stress2 != null && e.stress2 >= 0 && e.stress2 >= e.syl.length) issues.push("次重音下标越界 " + e.stress2);
  const jc = _letters((e.chunks || []).map(c => c[0]).join(""));
  if (jc !== _letters(e.w)) issues.push("chunks字母拼回不一致 " + jc);
  if (issues.length) SYL_BAD.push({ w: e.w, ip: e.ip, syl: e.syl.map(s => s[0] + "/" + s[1] + "/").join("·"), issues });
}
const sylConflicts = SYL_BAD.filter(x => x.issues);
console.error("拆分校验: 检查", out.length, "条 → 真冲突", sylConflicts.length, "条（其余为约定豁免）");
if (sylConflicts.length) {
  console.error("冲突词:", sylConflicts.slice(0, 20).map(x => x.w).join(", "));
  sylConflicts.slice(0, 40).forEach(x => console.error("  -", x.w, "|", (x.issues || []).join(" ; ")));
}

/* ---------- 序列化 & 注入 ---------- */
if (process.env.DRY) {
  /* 试运行：打印样例，不写文件 */
  const withCost = out.map((e, i) => ({ ...e, _c: alignedAll[i].cost }));
  const hi = withCost.filter(e => e._c >= 6);
  const sample = hi.filter((_, i) => i % Math.max(1, Math.floor(hi.length / 30)) === 0);
  console.log(sample.map(e => `${e.w} (cost=${e._c}) ip=${e.ip} chunks=${e.chunks.map(c => c[0] + c[1]).join("·")} syl=${e.syl.map(s => s[0]).join("-")} stress=${e.stress}`).join("\n"));
  console.error("DRY 模式：不注入。产出词条", out.length);
  process.exit(0);
}
function serEntry(e) {
  return "{" + Object.entries(e).map(([k, v]) => {
    if (k === "col") return `col:${v ? `{star:${v.star},en:${JSON.stringify(v.en)},zh:${JSON.stringify(v.zh)}}` : "null"}`;
    if (k === "dict") return `dict:${JSON.stringify(v)}`;
    if (k === "coca") return v ? `coca:${v}` : "";
    if (k === "chunks") return `chunks:[${v.map(c => `[${c.map(z => JSON.stringify(z === undefined ? "" : z)).join(",")}]`).join(",")}]`;
    if (k === "syl") return `syl:[${v.map(s => `[${JSON.stringify(s[0])},${JSON.stringify(s[1])}]`).join(",")}]`;
    if (k === "sent") return `sent:[${JSON.stringify(v[0])},${JSON.stringify(v[1])}]`;
    if (k === "exam") return `exam:[${v.map(x => JSON.stringify(x)).join(",")}]`;
    if (k === "phrases") return "phrases:[]";
    if (v === "" || v === null || v === undefined) return `${k}:null`;
    return `${k}:${JSON.stringify(v)}`;
  }).filter(Boolean).join(",") + "}";
}
const block = `/* ===== 扩充词库（数据源 ECDICT · phonics 数据自动生成） ===== */
const WORDS_EXTRA=[
${out.map(serEntry).join(",\n")}
];
WORDS.push.apply(WORDS,WORDS_EXTRA);`;

/* 确定性注入：把新 WORDS_EXTRA 块插在 const LEVELS= 之前
   （WORDS 的闭合 ]; 已在剥离后保留，LEVELS 紧随其后，故插在 LEVELS 前即位于 WORDS ]; 之后） */
const li = html.indexOf("const LEVELS=");
if (li < 0) { console.error("FATAL: 未找到 const LEVELS"); process.exit(1); }
const html2 = html.slice(0, li) + "\n" + block + html.slice(li);
fs.writeFileSync(HTML, html2);
fs.writeFileSync(ROOT + "/tools/new-words.json", JSON.stringify(out.map(e => e.w)));
const uniq = {};
out.forEach(e => { uniq[e.sent[0]] = e.sent[1]; });
fs.writeFileSync(ROOT + "/tools/tpl-sentences.json", JSON.stringify(uniq, null, 1));
fs.writeFileSync("_fill_fail.json", JSON.stringify(FAILS,null,1));
fs.writeFileSync("_syl_report.json", JSON.stringify(SYL_BAD,null,1));
console.error("已注入 index.html，新增词条", out.length, "，模板句", Object.keys(uniq).length, "条，拆分校验报告 _syl_report.json");
