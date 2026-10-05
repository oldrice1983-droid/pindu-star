const fs=require("fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("C:/Users/fm520/WorkBuddy/2026-10-01-01-17-06/english-phonics/ios-pack/www/index.html","utf8");
const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
const dom=new JSDOM(html,{runScripts:"dangerously",url:"https://pindu-star.app.workbuddy.host/",pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
setTimeout(()=>{
  const r=w.eval("(function(){var n=WORDS.length, real=0, noSyl=0, noChunks=0, badAlign=[], badStress=[];"+
    "WORDS.forEach(function(x){"+
      "if(AUDIO_US.indexOf(x.w)>=0||AUDIO_UK.indexOf(x.w)>=0) real++;"+
      "if(!x.syl||!x.syl.length) noSyl++;"+
      "if(!x.chunks||!x.chunks.length) noChunks++;"+
      "if(x.syl&&x.syl.length){ var L=x.syl.map(function(s){return s[0];}).join(''); if(L.replace(/[^a-z]/g,'')!==x.w.replace(/[^a-z]/g,'')) badAlign.push(x.w);}"+
      "if(x.syl&&x.stress!=null&&(x.stress<0||x.stress>=x.syl.length)) badStress.push(x.w);"+
    "});"+
    "return JSON.stringify({total:n,realAudio:real,noSyl:noSyl,noChunks:noChunks,badAlign:badAlign.slice(0,10),badAlignN:badAlign.length,badStressN:badStress.length,badStress:badStress.slice(0,10)});})()");
  console.log(r);
  // 常用词覆盖检查：user 提过 congratulation/go/one/use/air/airport/Christmas
  const common=["go","one","use","air","airport","christmas","congratulations","congratulation","water","opportunity"];
  common.forEach(cw=>{
    const hit=w.eval("(function(){var x=WORDS.find(y=>y.w==='"+cw+"'); return x? ('syl='+x.syl.length+' real='+((AUDIO_US.indexOf('"+cw+"')>=0||AUDIO_UK.indexOf('"+cw+"')>=0)?1:0)) : 'MISSING';})()");
    console.log("  "+cw+": "+hit);
  });
  process.exit(0);
},5000);
