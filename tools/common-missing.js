const fs=require("fs");
const {JSDOM,VirtualConsole}=require("jsdom");
const html=fs.readFileSync("C:/Users/fm520/WorkBuddy/2026-10-01-01-17-06/english-phonics/ios-pack/www/index.html","utf8");
const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
const dom=new JSDOM(html,{runScripts:"dangerously",url:"https://pindu-star.app.workbuddy.host/",pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
setTimeout(()=>{
  // 高频日常词抽查（口语/小学/初中常用）
  const list=("congratulations holiday weekend tomorrow yesterday birthday party dinner breakfast lunch supper " +
    "watermelon strawberry hamburger sandwich vegetables chopsticks bathroom bedroom livingroom kitchen " +
    "homework classroom playground library museum hospital restaurant supermarket station airport " +
    "grandma grandpa uncle aunt cousin brother sister daughter son parents family " +
    "sunny rainy windy cloudy snowy weather season spring summer autumn winter " +
    "Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June " +
    "July August September October November December week month year hour minute " +
    "elephant monkey tiger lion bear wolf fox deer rabbit panda zebra " +
    "apple banana orange grape pear peach lemon mango pineapple " +
    "red blue green yellow black white pink purple brown grey gray " +
    "pen pencil ruler eraser book bag desk chair window door floor " +
    "hand head face eye ear nose mouth hair arm leg foot feet " +
    "happy sad angry tired hungry thirsty sleepy excited bored " +
    "beautiful ugly tall short big small long fast slow new old young " +
    "run walk jump swim fly sing dance read write draw sleep " +
    "always usually often sometimes never today tonight " +
    "computer phone television radio camera picture photo " +
    "teacher student doctor nurse farmer driver worker police firefighter " +
    "-China Chinese England English America American Japan Japanese " +
    "money dollar cent shop store market price cheap expensive " +
    "train bus car taxi bike plane ship boat subway " +
    "hello goodbye please thanks welcome sorry " +
    "question answer problem idea example story song game " +
    "outside inside upstairs downstairs front back left right middle").split(/\s+/);
  const uniq=[...new Set(list.map(x=>x.replace(/^-/,"").toLowerCase()))];
  const missing=w.eval("(function(){var miss=[];var L="+JSON.stringify(uniq)+";L.forEach(function(x){if(!WORDS.some(function(y){return y.w===x;})) miss.push(x);});return miss;})()");
  console.log("抽查 "+uniq.length+" 个高频词，缺失 "+missing.length+" 个：");
  console.log(missing.join(" "));
  process.exit(0);
},5000);
