/* 全词库拆分与实际一致性校验（WORDS 精编 + WORDS_EXTRA 自动生成全覆盖）
   用法: node validate-wordbank.js
   校验项:
   1) syl 字母拼回 == 单词字母        2) syl 音标拼回 == 全词 ip（约定豁免: 双辅音边界 / 可选(r) / 弱化ə与ː）
   3) chunks 字母拼回 == 单词字母      4) 主/次重音下标不越界
   输出: 控制台统计 + _validate_report.json */
const fs = require("fs");
const HTML = "C:/Users/fm520/WorkBuddy/2026-10-01-01-17-06/english-phonics/ios-pack/www/index.html";
const html = fs.readFileSync(HTML, "utf8");
const _strip = s => String(s || "").replace(/[\s/ˈˌ]/g, "");
const _letters = s => String(s || "").replace(/[^a-zA-Z]/g, "").toLowerCase();
function ipaClass(a, b) {
  if (a === b) return null;
  const V = {
    "去可选(r)": s => s.replace(/\(r\)/g, ""),
    "双辅音边界": s => s.replace(/\(r\)/g, "").replace(/(.)\1+/g, "$1"),
    "弱化ə/ː": s => s.replace(/\(r\)/g, "").replace(/[əː]/g, "").replace(/(.)\1+/g, "$1")
  };
  for (const k of Object.keys(V)) if (V[k](a) === V[k](b)) return k;
  return "冲突";
}
const blocks = html.split(/\{w:"/).slice(1);
let withSyl = 0; const bad = []; const exempt = { "去可选(r)": 0, "双辅音边界": 0, "弱化ə/ː": 0 };
for (const b of blocks) {
  const w = (b.match(/^([^"]+)"/) || [])[1];
  const ip = (b.match(/ip:"([^"]*)"/) || [])[1] || "";
  const sylM = b.match(/syl:\[([^\]]*(?:\][^\]]*?)*?)\],\s*stress/);
  if (!sylM) continue;
  let syl; try { syl = JSON.parse("[" + sylM[1] + "]"); } catch (e) { bad.push({ w, issues: ["syl 解析失败"] }); continue; }
  withSyl++;
  const stress = parseInt((b.match(/stress:(-?\d+)/) || [0, "0"])[1], 10);
  const stress2 = parseInt((b.match(/stress2:(-?\d+)/) || [0, "-1"])[1], 10);
  const issues = [];
  const jl = _letters(syl.map(s => s[0]).join(""));
  if (jl !== _letters(w)) issues.push(`字母拼回不一致 syl=${jl} word=${_letters(w)}`);
  const cls = ipaClass(_strip(syl.map(s => s[1]).join("")), _strip(ip));
  if (cls === "冲突") issues.push(`音标拼回冲突 syl=${_strip(syl.map(s => s[1]).join(""))} ip=${_strip(ip)}`);
  else if (cls) exempt[cls]++;
  if (!(stress >= 0 && stress < syl.length)) issues.push("主重音下标越界 " + stress);
  if (stress2 >= 0 && stress2 >= syl.length) issues.push("次重音下标越界 " + stress2);
  const chunksM = b.match(/chunks:\[([^\]]*(?:\][^\]]*]*)*?)\]/);
  if (chunksM) {
    let chunks; try { chunks = JSON.parse("[" + chunksM[1] + "]"); } catch (e) { chunks = null; }
    if (chunks) {
      const jc = _letters(chunks.map(c => c[0]).join(""));
      if (jc !== _letters(w)) issues.push(`chunks 字母拼回不一致 ${jc}`);
    }
  }
  if (issues.length) bad.push({ w, ip, syl: syl.map(s => s[0] + "/" + s[1] + "/").join("·"), issues });
}
console.log("词条(含 syl):", withSyl);
console.log("记法约定豁免:", exempt);
console.log("真冲突:", bad.length, `(${bad.length ? (bad.length / withSyl * 100).toFixed(2) : 0}%)`);
bad.slice(0, 30).forEach(x => console.log(" -", x.w, "|", x.issues.join(" ; ")));
fs.writeFileSync("C:/Users/fm520/WorkBuddy/2026-10-01-01-17-06/english-phonics/tools/_validate_report.json", JSON.stringify({ withSyl, exempt, bad }, null, 1));
console.log("报告: tools/_validate_report.json");
