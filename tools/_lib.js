/* ============================================================
   build-wordbank.js — 从 ECDICT 生成扩充词条，注入 index.html
   产物：
   1. index.html 内新增 const WORDS_EXTRA=[...]（保留原 116 词不动）
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
  /* 多读音只取第一个（"castle: 'kæsl. 'kɑ:sl" → 取第一段） */
  s = s.split(/\.\s+/)[0].split(/[;；|]/)[0].trim();
  /* ECDICT 简化记法规范化 */
  s = s.replace(/\(([^)]*)\)/g, "$1");            // (r) → r
  s = s.replace(/ә/g, "ə").replace(/'’/g, "'");  // 西里尔 schwa
  s = s.replace(/['’]/g, "ˈ");                   // ASCII 撇号 → 主重音
  s = s.replace(/[.,]/g, "ˌ");                    // . 或 , → 次重音
  s = s.replace(/:/g, "ː");
  /* 双元音记法规范化（ECDICT 用 ei/ai/ɔi/əu/au/iə/eə/uə） */
  s = s.replace(/ei/g, "eɪ").replace(/ai/g, "aɪ").replace(/ɔi/g, "ɔɪ")
       .replace(/əu/g, "əʊ").replace(/au/g, "aʊ")
       .replace(/iə/g, "ɪə").replace(/uə/g, "ʊə");
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
const MAPM = { x:[["k","s"]], qu:[["k","w"]], u:[["j","uː"],["j","ʊ"],["j","ʊə"]], o:[["w","ʌ"]] };
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

/* ---------- 模板例句 ---------- */
const TPL = {
  n: [
    ["We talked about the {w} in class today.", "今天课上我们谈到了{zh}。"],
    ["This is a picture of a {w}.", "这是一张和{zh}有关的图片。"],
    ["Do you often see a {w} near your home?", "你家附近常能看到{zh}吗？"],
    ["The book has many pictures of the {w}.", "这本书里有很多和{zh}有关的图片。"]
  ],
  v: [
    ["Let's learn the word \"{w}\" today.", "今天我们来学习「{w}」这个单词。"],
    ["Can you use \"{w}\" in a sentence?", "你能用「{w}」造个句子吗？"],
    ["Please read the word \"{w}\" aloud.", "请大声读出「{w}」这个单词。"],
    ["I will remember the word \"{w}\".", "我会记住「{w}」这个单词。"]
  ],
  adj: [
    ["The story sounds very {w}.", "这个故事听起来很{zh}。"],
    ["Today the weather feels quite {w}.", "今天天气感觉很{zh}。"],
    ["My friend thinks this game is really {w}.", "我朋友觉得这个游戏非常{zh}。"],
    ["Why do you look so {w} today?", "你今天为什么看起来这么{zh}？"]
  ],
  other: [
    ["Let's learn the word \"{w}\" today.", "今天我们来学习「{w}」这个单词。"],
    ["Can you make a sentence with \"{w}\"?", "你能用「{w}」造个句子吗？"],
    ["I wrote the word \"{w}\" in my notebook.", "我把「{w}」记在了笔记本上。"],
    ["Do you know how to spell \"{w}\"?", "你知道「{w}」怎么拼写吗？"]
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

module.exports={parseIpa,alignWord,splitSyllables};