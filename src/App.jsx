import { useState, useEffect, useCallback, useRef } from "react";

const safeRead = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const safeWrite = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => safeRead(key, initialValue));
  useEffect(() => {
    safeWrite(key, value);
  }, [key, value]);
  return [value, setValue];
}

function SharedHeader({ mode, setMode, meta }) {
  const isSurf = mode === "surf";
  const accent = isSurf ? "#00bfff" : "#00e5cc";
  const bg = isSurf
    ? "linear-gradient(135deg,rgba(0,100,200,0.6),rgba(0,191,255,0.3))"
    : "linear-gradient(135deg,rgba(0,60,55,0.6),rgba(0,229,204,0.25))";
  const border = isSurf
    ? "1px solid rgba(0,191,255,0.25)"
    : "1px solid rgba(0,229,204,0.22)";

  return (
    <div className="shared-hdr">
      <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
        <div style={{width:32,height:32,borderRadius:8,background:bg,border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
          {isSurf ? "🌊" : "🤿"}
        </div>
        <div style={{minWidth:0,flex:1}}>
          <div style={{display:"flex",alignItems:"baseline",gap:8,minWidth:0,flexWrap:"wrap"}}>
            <div className="shared-brand">{isSurf ? "WAVECHECK" : "DIVECHECK"}</div>
            {meta?.title && <div className="shared-location">{meta.title}</div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2,minWidth:0,flexWrap:"wrap"}}>
            <span className="shared-sub" style={{color:isSurf ? "rgba(0,191,255,0.45)" : "rgba(0,229,204,0.45)"}}>CAPE TOWN · {isSurf ? "SURF" : "DIVE"}</span>
            {meta?.badges?.map((badge, i)=>(<span key={i} className="shared-badge" style={{borderColor:`${accent}33`,color:accent,background:`${accent}12`}}>{badge}</span>))}
            {meta?.refreshing
              ? <span className="shimmer" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:6.5,color:accent,letterSpacing:1}}>· SYNCING</span>
              : meta?.lastRef && <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:6.5,color:"rgba(255,255,255,0.2)",letterSpacing:1}}>· ↻ {Math.floor((Date.now()-new Date(meta.lastRef).getTime())/60000)<1?"just now":Math.floor((Date.now()-new Date(meta.lastRef).getTime())/60000)+"m ago"}</span>}
          </div>
        </div>
      </div>
      <div className="mode-pill shared-mode-pill">
        <button className={`mode-btn ${isSurf ? 'surf-active' : 'inactive'}`} onClick={()=>setMode("surf")}>🌊 SURF</button>
        <button className={`mode-btn ${!isSurf ? 'dive-active' : 'inactive'}`} onClick={()=>setMode("dive")}>🤿 DIVE</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED — tide model + helpers
// ═══════════════════════════════════════════════════════════════════════════════
const TIDE_C = [
  { a:0.76, s:28.9841, p:160 }, { a:0.25, s:30.0000, p:195 },
  { a:0.15, s:28.4397, p:140 }, { a:0.10, s:15.0411, p:220 },
  { a:0.08, s:13.9430, p:185 }, { a:0.07, s:30.0821, p:195 },
];
const EPOCH = Date.UTC(2000,0,1);
function tide(d){ const t=(d-EPOCH)/3600000; return 0.82+TIDE_C.reduce((s,c)=>s+c.a*Math.cos((c.s*t-c.p)*Math.PI/180),0); }
function tide48(now){ return Array.from({length:48},(_,i)=>{ const d=new Date(now); d.setHours(0,0,0,0); d.setHours(i); return{hour:i,h:tide(d)}; }); }
function tideExtremes(c){ const o=[]; for(let i=1;i<c.length-1;i++){ if(c[i].h>c[i-1].h&&c[i].h>c[i+1].h)o.push({...c[i],type:"High"}); else if(c[i].h<c[i-1].h&&c[i].h<c[i+1].h)o.push({...c[i],type:"Low"}); } return o; }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const D16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const deg2c = d => D16[Math.round(((d%360)+360)%360/22.5)%16];
const MONTH_TEMP = [18,18,17,16,15,14,13,13,14,15,16,17];


// ═══════════════════════════════════════════════════════════════════════════════
// SURF MODE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function wetsuit(wt,ws){ const c=wt-ws*0.3;
  if(c<10)return{suit:"5/4mm + Hood & Boots",icon:"🥶",color:"#60a5fa",short:"5/4mm"};
  if(c<13)return{suit:"4/3mm Full Suit",icon:"🧊",color:"#93c5fd",short:"4/3mm"};
  if(c<16)return{suit:"3/2mm Full Suit",icon:"🌊",color:"#6ee7b7",short:"3/2mm"};
  if(c<19)return{suit:"Springsuit / Shorty",icon:"👙",color:"#fde68a",short:"Springsuit"};
  return{suit:"Board Shorts",icon:"🏄",color:"#fca5a5",short:"Boardies"};
}

function ripRisk(beach,wh,tl,ts){
  const s=(ts.includes("Falling")||ts.includes("Low")?2:0)+(tl<1?2:0)+(wh>1.2?2:0)+(beach.rip?2:0);
  if(s>=6)return{level:"High",color:"#f87171",icon:"⚠️",tip:"Strong rip likely. Check before paddling out."};
  if(s>=4)return{level:"Medium",color:"#fbbf24",icon:"⚡",tip:"Some rip risk. Identify channels first."};
  return{level:"Low",color:"#4ade80",icon:"✅",tip:"Low rip risk today."};
}

function windState(beach,wc){
  if(beach.gw.includes(wc))return{s:"Offshore",c:"#00ff87",i:"✅",sub:"Glassy faces"};
  const gi=beach.gw.map(w=>D16.indexOf(w)), ci=D16.indexOf(wc);
  if(gi.some(g=>Math.min(Math.abs(g-ci),16-Math.abs(g-ci))<=2))return{s:"Cross-shore",c:"#fbbf24",i:"↗️",sub:"Bumpy but rideable"};
  return{s:"Onshore",c:"#f87171",i:"❌",sub:"Choppy surface"};
}

function score(wh,sp,ws,wd,beach){
  let s=0;
  if(beach){const[lo,hi]=beach.iw; s+=wh>=lo&&wh<=hi?32:wh>=lo*.7&&wh<lo?15:wh>hi&&wh<=hi*1.3?18:3;}
  else s+=wh>=0.8&&wh<=1.5?30:wh>1.5&&wh<=2.5?22:wh>0.5?14:6;
  s+=sp>=14?28:sp>=12?22:sp>=10?16:sp>=8?10:4;
  s+=ws<8?22:ws<15?16:ws<22?8:ws<30?3:0;
  const wst=beach?windState(beach,deg2c(wd)):null;
  if(wst?.s==="Offshore")s+=18; else if(wst?.s==="Cross-shore")s+=8;
  else if(!beach&&(deg2c(wd).includes("SE")||deg2c(wd).includes("S")))s+=18;
  return Math.min(s,100);
}

function rating(sc){
  if(sc>=80)return{e:"🔥",l:"Epic",c:"#00ff87",grad:"from #00ff87 to #00bfff"};
  if(sc>=60)return{e:"⚡",l:"Good",c:"#7fff6b",grad:"from #7fff6b to #00ff87"};
  if(sc>=40)return{e:"👌",l:"Fair",c:"#fbbf24",grad:"from #fbbf24 to #fb923c"};
  return{e:"💤",l:"Poor",c:"#f87171",grad:"from #f87171 to #dc2626"};
}

function swellQuality(sp){
  if(sp>=14)return{label:"Groundswell",color:"#00ff87"};
  if(sp>=10)return{label:"Mid-period",color:"#fbbf24"};
  return{label:"Wind swell",color:"#f87171"};
}

// ─── BEACHES ──────────────────────────────────────────────────────────────────
const BEACHES = [
  {id:"muizenberg",  name:"Muizenberg",         lat:-34.1075,lon:18.4711,level:"Beginner",      side:"False Bay", gw:["NW","N","NNW","WNW","W"],iw:[0.6,1.4],kelp:false,rip:true, char:"Soft crumbly lefts and rights. Long rides, forgiving. Perfect for beginners."},
  {id:"st_james",    name:"St James",            lat:-34.1178,lon:18.4547,level:"Beginner/Inter",side:"False Bay", gw:["NW","N","W","NNW"],       iw:[0.8,1.6],kelp:false,rip:false,char:"Sheltered cove with small punchy waves. Works on most swells."},
  {id:"kalk_bay",    name:"Kalk Bay Reef",       lat:-34.1280,lon:18.4430,level:"Advanced",      side:"False Bay", gw:["NW","N","NNW","W"],       iw:[1.2,2.5],kelp:false,rip:false,char:"Powerful reef break. Heavy lip. Best on solid SE swell 1.5m+."},
  {id:"fish_hoek",   name:"Fish Hoek",           lat:-34.1382,lon:18.4279,level:"Beginner/Inter",side:"False Bay", gw:["NW","N","W","NNW"],       iw:[0.6,1.4],kelp:false,rip:true, char:"Sandy beach break. Rip channels near the rocks."},
  {id:"clovelly",    name:"Clovelly",            lat:-34.1333,lon:18.4167,level:"Intermediate",  side:"False Bay", gw:["NW","N","W"],             iw:[0.8,1.8],kelp:false,rip:false,char:"Consistent beach break. Less crowded than Muizenberg."},
  {id:"llandudno",   name:"Llandudno",           lat:-34.0058,lon:18.3478,level:"Intermediate",  side:"Atlantic",  gw:["SE","SSE","S","ESE"],     iw:[1.0,2.2],kelp:true, rip:false,char:"Stunning cove. Heavy shorebreak. Navigate kelp on paddle-out."},
  {id:"glen_beach",  name:"Glen Beach",          lat:-33.9486,lon:18.3756,level:"Advanced",      side:"Atlantic",  gw:["SE","SSE","S"],            iw:[1.2,2.5],kelp:true, rip:false,char:"Below the Twelve Apostles. Hollow and powerful on big swells."},
  {id:"camps_bay",   name:"Camps Bay",           lat:-33.9500,lon:18.3764,level:"Beginner/Inter",side:"Atlantic",  gw:["SE","SSE","E","ESE"],     iw:[0.6,1.5],kelp:false,rip:false,char:"Fun beach break with a view. Crowded in summer. Best early morning."},
  {id:"pebbles",     name:"Pebbles",             lat:-33.9800,lon:18.3600,level:"Bodyboard",     side:"Atlantic",  gw:["SE","SSE","S","E"],       iw:[0.6,1.4],kelp:false,rip:false,char:"Bodyboard heaven. Steep dumpy waves onto the beach."},
  {id:"off_wall",    name:"Off The Wall",        lat:-33.9050,lon:18.4050,level:"Advanced",      side:"Atlantic",  gw:["SE","S","SSE"],           iw:[1.2,3.0],kelp:true, rip:false,char:"Powerful rights over shallow rock. Not for beginners."},
  {id:"bigbay",      name:"Big Bay",             lat:-33.7942,lon:18.4595,level:"All levels",    side:"West Coast",gw:["SE","SSE","S","E"],       iw:[0.8,2.0],kelp:false,rip:true, char:"Long beach, multiple peaks. Windy in the afternoon."},
  {id:"blouberg",    name:"Bloubergstrand",      lat:-33.8078,lon:18.4756,level:"All levels",    side:"West Coast",gw:["SE","S","SSE","E"],       iw:[0.8,2.0],kelp:false,rip:true, char:"Table Mountain backdrop. Consistent. Gets blown out by noon."},
  {id:"kommetjie",   name:"Long Beach",          lat:-34.1389,lon:18.3278,level:"Intermediate",  side:"Peninsula", gw:["SE","SSE","NE","E"],      iw:[1.0,2.2],kelp:true, rip:false,char:"Long lefts on a big SW swell. Cold water year-round."},
  {id:"noordhoek",   name:"Noordhoek",           lat:-34.1050,lon:18.3600,level:"Advanced",      side:"Peninsula", gw:["SE","SSE","NE"],          iw:[1.5,3.5],kelp:false,rip:true, char:"Remote, powerful, beautiful. Rarely surfed. Strong rips."},
  {id:"scarborough", name:"Scarborough",         lat:-34.2000,lon:18.3750,level:"Inter/Advanced",side:"Peninsula", gw:["SE","SSE","NE","E"],      iw:[1.0,2.5],kelp:false,rip:true, char:"Raw exposed swell. Very cold. Rarely crowded."},
];

const SHARK = ["muizenberg","st_james","fish_hoek","kalk_bay","clovelly"];
const LVL_COLOR = {
  "Beginner":"#4ade80","Beginner/Inter":"#86efac","Intermediate":"#fbbf24",
  "Inter/Advanced":"#fb923c","Advanced":"#f87171","Bodyboard":"#a78bfa","All levels":"#60a5fa"
};

// ─── CROWD HEURISTIC ─────────────────────────────────────────────────────────
function crowdLevel(beach, sc) {
  const day = new Date().getDay();
  const hour = new Date().getHours();
  const isWeekend = day === 0 || day === 6;
  const isPeakHour = hour >= 9 && hour <= 14;
  const isBeginner = beach.level.includes("Beginner") || beach.level === "All levels";
  let crowd = 0;
  if(isWeekend) crowd += 2;
  if(isPeakHour) crowd += 2;
  if(isBeginner) crowd += 2;
  if(sc >= 60) crowd += 2;
  if(sc >= 80) crowd += 1;
  if(crowd >= 7) return { level: "Packed", color: "#f87171", icon: "👥👥👥", tip: "Expect a busy lineup." };
  if(crowd >= 5) return { level: "Busy", color: "#fbbf24", icon: "👥👥", tip: "Moderate crowd expected." };
  if(crowd >= 3) return { level: "Moderate", color: "#7fff6b", icon: "👥", tip: "Manageable crowd." };
  return { level: "Quiet", color: "#4ade80", icon: "🤙", tip: "Mostly to yourself." };
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function WindArrow({deg, size=56, color="#00bfff"}) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{flexShrink:0}}>
      <circle cx="30" cy="30" r="27" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
      {["N","E","S","W"].map((d,i) => (
        <text key={d} x={30+19*Math.sin(i*Math.PI/2)} y={30-19*Math.cos(i*Math.PI/2)+3.5}
          textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="6" fontFamily="monospace">{d}</text>
      ))}
      <g transform={`rotate(${deg},30,30)`}>
        <polygon points="30,7 33,34 30,31 27,34" fill={color} style={{filter:`drop-shadow(0 0 4px ${color})`}}/>
        <polygon points="30,53 33,34 30,37 27,34" fill={`${color}30`}/>
      </g>
    </svg>
  );
}

function ScoreArc({sc, color, size=88}) {
  const r = 32, circ = 2*Math.PI*r;
  return (
    <svg width={size} height={size} viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6"/>
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={circ*(1-sc/100)}
        strokeLinecap="round" transform="rotate(-90 44 44)"
        style={{transition:"stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)",filter:`drop-shadow(0 0 6px ${color}90)`}}/>
      <text x="44" y="48" textAnchor="middle" fill="#fff"
        fontSize="22" fontFamily="'Orbitron',monospace" letterSpacing="1">{sc}</text>
    </svg>
  );
}

function MiniBar({value, max, color}) {
  return (
    <div style={{height:3,background:"rgba(255,255,255,0.07)",borderRadius:2,overflow:"hidden",marginTop:4}}>
      <div style={{height:"100%",width:`${Math.min((value/max)*100,100)}%`,background:color,borderRadius:2,transition:"width 0.8s ease"}}/>
    </div>
  );
}

function TideChart({curve, curHour}) {
  const hts = curve.map(p=>p.h), mn = Math.min(...hts), mx = Math.max(...hts);
  const W=600, H=72;
  const sx = i=>(i/(curve.length-1))*W;
  const sy = v=>H-4-((v-mn)/(mx-mn))*(H-14);
  const pts = curve.map((p,i)=>`${sx(i)},${sy(p.h)}`).join(" ");
  const ext = tideExtremes(curve);
  return (
    <div style={{width:"100%",overflowX:"hidden"}}>
      <svg viewBox={`0 0 ${W} ${H+26}`} style={{display:"block",width:"100%",height:"auto"}}>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00bfff" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#00bfff" stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {[0,6,12,18,24,30,36,42].map(h=>(
          <g key={h}>
            <line x1={sx(h)} y1={0} x2={sx(h)} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <text x={sx(h)+2} y={H+16} fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">
              {h<24?`${String(h).padStart(2,"0")}h`:`+${h-24}h`}
            </text>
          </g>
        ))}
        <line x1={sx(24)} y1={0} x2={sx(24)} y2={H} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,3"/>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#tg)"/>
        <polyline points={pts} fill="none" stroke="#00bfff" strokeWidth="1.8" strokeLinejoin="round"/>
        {ext.slice(0,8).map((e,i)=>(
          <g key={i}>
            <circle cx={sx(e.hour)} cy={sy(e.h)} r="3" fill={e.type==="High"?"#00bfff":"#1e4d7a"}
              stroke={e.type==="High"?"#00bfff":"#3b82f6"} strokeWidth="1.5"/>
            <text x={sx(e.hour)} y={e.type==="High"?sy(e.h)-8:sy(e.h)+14}
              textAnchor="middle" fill={e.type==="High"?"#7dd3fc":"#60a5fa"} fontSize="7" fontFamily="monospace">
              {e.h.toFixed(1)}m
            </text>
          </g>
        ))}
        {curHour<curve.length&&(
          <>
            <line x1={sx(curHour)} y1={0} x2={sx(curHour)} y2={H} stroke="#00ff87" strokeWidth="1.5" strokeDasharray="4,3"/>
            <circle cx={sx(curHour)} cy={sy(curve[curHour]?.h??0.82)} r="3.5" fill="#00ff87"/>
            <text x={sx(curHour)+5} y={10} fill="#00ff87" fontSize="7" fontFamily="monospace">NOW</text>
          </>
        )}
      </svg>
    </div>
  );
}

function SwellChart({hourly, curHour}) {
  if(!hourly) return null;
  const W=600, H=64;
  const data = Array.from({length:48},(_,i)=>({i,wh:hourly.wave_height?.[i]??0}));
  const mx = Math.max(...data.map(d=>d.wh),0.5);
  const sx = i=>(i/47)*W;
  const sy = v=>H-4-(v/mx)*(H-12);
  const pts = data.map(d=>`${sx(d.i)},${sy(d.wh)}`).join(" ");
  return (
    <div style={{width:"100%",overflowX:"hidden"}}>
      <svg viewBox={`0 0 ${W} ${H+26}`} style={{display:"block",width:"100%",height:"auto"}}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {[0,6,12,18,24,30,36,42].map(h=>(
          <g key={h}>
            <line x1={sx(h)} y1={0} x2={sx(h)} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <text x={sx(h)+2} y={H+16} fill="rgba(255,255,255,0.2)" fontSize="7.5" fontFamily="monospace">
              {h<24?`${String(h).padStart(2,"0")}h`:`+${h-24}h`}
            </text>
          </g>
        ))}
        <line x1={sx(24)} y1={0} x2={sx(24)} y2={H} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,3"/>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)"/>
        <polyline points={pts} fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinejoin="round"/>
        {data.filter((_,i)=>i%8===0).map((d,i)=>(
          <text key={i} x={sx(d.i)} y={sy(d.wh)-6} textAnchor="middle"
            fill="rgba(129,140,248,0.7)" fontSize="7" fontFamily="monospace">{d.wh.toFixed(1)}m</text>
        ))}
        {curHour<48&&(
          <line x1={sx(curHour)} y1={0} x2={sx(curHour)} y2={H} stroke="#00ff87" strokeWidth="1.5" strokeDasharray="4,3"/>
        )}
      </svg>
    </div>
  );
}

function ForecastStrip({hourly, curHour, beach}) {
  if(!hourly) return null;
  const hours = Array.from({length:12},(_,i)=>curHour+i).filter(h=>h<48);
  return (
    <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
      {hours.map(h=>{
        const sc = score(hourly.wave_height?.[h]??0,hourly.wave_period?.[h]??0,hourly.wind_speed_10m?.[h]??0,hourly.wind_direction_10m?.[h]??0,beach);
        const r = rating(sc);
        const isNow = h===curHour;
        return (
          <div key={h} style={{flexShrink:0,minWidth:64,background:isNow?"rgba(0,191,255,0.08)":"rgba(255,255,255,0.02)",
            border:`1px solid ${isNow?"rgba(0,191,255,0.35)":"rgba(255,255,255,0.06)"}`,
            borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
            <div style={{fontSize:10,color:isNow?"#7dd3fc":"rgba(255,255,255,0.28)",marginBottom:5,letterSpacing:1}}>
              {h<24?`${String(h).padStart(2,"0")}:00`:`+${h-24}h`}
            </div>
            <div style={{fontSize:15,marginBottom:3}}>{r.e}</div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:15,color:r.c,letterSpacing:1}}>
              {(hourly.wave_height?.[h]??0).toFixed(1)}m
            </div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.28)",marginTop:1}}>
              {(hourly.wave_period?.[h]??0).toFixed(0)}s
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekOutlook({hourly, beach}) {
  if(!hourly) return null;
  const now = new Date();
  const DNAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const maxDays = Math.min(5, Math.floor((hourly.wave_height?.length??0)/24));
  const days = Array.from({length:maxDays},(_,d)=>{
    const best = Math.max(...Array.from({length:24},(_,h)=>score(
      hourly.wave_height?.[Math.min(d*24+h, (hourly.wave_height?.length??1)-1)]??0,
      hourly.wave_period?.[Math.min(d*24+h, (hourly.wave_period?.length??1)-1)]??0,
      hourly.wind_speed_10m?.[Math.min(d*24+h, (hourly.wind_speed_10m?.length??1)-1)]??0,
      hourly.wind_direction_10m?.[Math.min(d*24+h, (hourly.wind_direction_10m?.length??1)-1)]??0,beach)));
    const avgWh = Array.from({length:24},(_,h)=>hourly.wave_height?.[Math.min(d*24+h,(hourly.wave_height?.length??1)-1)]??0).reduce((a,b)=>a+b,0)/24;
    return{d,best,avgWh};
  });
  return (
    <div style={{display:"flex",gap:6}}>
      {days.map((d,i)=>{
        const r = rating(d.best);
        const lbl = i===0?"Today":i===1?"Tmrw":DNAMES[(now.getDay()+i)%7];
        return (
          <div key={i} style={{flex:"1 1 0",minWidth:0,background:i===0?"rgba(0,191,255,0.07)":"rgba(255,255,255,0.02)",
            border:`1px solid ${i===0?"rgba(0,191,255,0.28)":"rgba(255,255,255,0.06)"}`,
            borderRadius:10,padding:"12px 5px",textAlign:"center"}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:7.5,color:i===0?"#7dd3fc":"rgba(255,255,255,0.3)",marginBottom:6,letterSpacing:0.5}}>
              {lbl.toUpperCase()}
            </div>
            <div style={{fontSize:20,marginBottom:5}}>{r.e}</div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,color:r.c,letterSpacing:0.5,marginBottom:3}}>
              {r.l.toUpperCase()}
            </div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"rgba(255,255,255,0.25)"}}>
              {d.avgWh.toFixed(1)}m
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── BEACH SCORE OVERVIEW ─────────────────────────────────────────────────────
function AllBeachesOverview({allScores, onSelect, currentId}) {
  const sorted = [...allScores].sort((a,b)=>b.sc-a.sc);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {sorted.map(({ beach, sc, wh }) => {
        const r = rating(sc);
        const isActive = beach.id === currentId;
        return (
          <button key={beach.id} onClick={()=>onSelect(beach)}
            style={{display:"flex",alignItems:"center",gap:10,background:isActive?"rgba(0,191,255,0.07)":"rgba(255,255,255,0.02)",
              border:`1px solid ${isActive?"rgba(0,191,255,0.3)":"rgba(255,255,255,0.05)"}`,
              borderRadius:10,padding:"9px 12px",textAlign:"left",width:"100%",cursor:"pointer",
              transition:"all 0.15s"}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:16,color:r.c,width:26,textAlign:"center",flexShrink:0,lineHeight:1}}>{sc}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                <div style={{fontSize:10,color:isActive?"#7dd3fc":"rgba(255,255,255,0.7)",fontFamily:"'Orbitron',monospace",letterSpacing:0.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {beach.name}
                </div>
                {wh !== undefined && <span style={{fontSize:7,color:"rgba(255,255,255,0.3)",flexShrink:0}}>{wh.toFixed(1)}m</span>}
              </div>
              <MiniBar value={sc} max={100} color={r.c}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
              <span style={{fontSize:11}}>{r.e}</span>
              <span style={{fontSize:6.5,color:LVL_COLOR[beach.level]??"#888",letterSpacing:0.5}}>{beach.level.toUpperCase()}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── SURF CONSTANTS ─────────────────────────────────────────────────────────────────
const TABS = [
  {id:"now",l:"Now",icon:"🌊"},
  {id:"forecast",l:"Forecast",icon:"📅"},
  {id:"tides",l:"Tides",icon:"🌙"},
  {id:"spots",l:"Spots",icon:"📍"},
  {id:"safety",l:"Safety",icon:"⚠️"},
  {id:"gear",l:"Gear",icon:"🏄"},
];
const SIDES = ["All","False Bay","Atlantic","West Coast","Peninsula"];


// ═══════════════════════════════════════════════════════════════════════════════
// DIVE MODE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
// Diving condition logic — INVERTED from surfing. Calm = good.
function diveVerdict(wh, ws, sp, tl) {
  const swellOk = wh <= 1.0;
  const windOk  = ws <= 15;
  const periodOk = sp <= 10 || wh < 0.5; // short period ok if swell tiny
  const tideOk  = tl > 0.6 && tl < 1.8;
  const goCount = [swellOk, windOk, periodOk, tideOk].filter(Boolean).length;
  if (goCount === 4) return { verdict:"GO", color:"#00ff9d", icon:"🤿", sub:"Clean conditions. Visibility likely good." };
  if (goCount >= 2) return { verdict:"CAUTION", color:"#ffb300", icon:"⚠️", sub:"Some factors against you. Assess on the day." };
  return { verdict:"NO-GO", color:"#ff4444", icon:"🚫", sub:"Conditions likely to reduce visibility and safety." };
}

// ─── IMPROVED VISIBILITY MODEL ───────────────────────────────────────────────
// Factors: swell height, period, wind speed, swell direction vs site exposure,
// time of day (morning better before afternoon wind), season (summer SE clearer).
// TODO: COPERNICUS HOOK — when KD490 satellite data is available via Vercel edge
// function, replace baseViz calculation with: baseViz = kd490ToVisibility(kd490Value)
// and use the model below only as fallback.
function visibilityEstimate(wh, ws, sp, waveDir, site, hourOfDay, monthIndex) {
  // Base visibility from swell height (primary degrader)
  let baseViz = wh < 0.3 ? 14
              : wh < 0.5 ? 11
              : wh < 0.8 ? 8
              : wh < 1.1 ? 5
              : wh < 1.5 ? 3
              : 1.5;

  // Swell period modifier: long-period groundswell penetrates deeper but
  // short choppy wind-swell stirs up more surface sediment
  if (sp < 7 && wh > 0.4) baseViz *= 0.75;
  else if (sp >= 12) baseViz *= 1.1; // groundswell cleaner than wind swell

  // Wind modifier: onshore wind creates surface chop + sediment suspension
  if (ws > 25) baseViz *= 0.6;
  else if (ws > 15) baseViz *= 0.8;
  else if (ws < 8) baseViz *= 1.1; // calm = clearer

  // Swell direction vs site exposure
  // Atlantic sites exposed to NW-SW swells; False Bay exposed to SE swells
  if (site) {
    const swellDeg = waveDir ?? 180;
    const isAtlantic = site.side === "Atlantic";
    const isFalseBay = site.side === "False Bay";
    // NW swell (270-340°) hitting Atlantic sites = bad viz (oncoming fetch)
    if (isAtlantic && swellDeg >= 270 && swellDeg <= 340 && wh > 0.5) baseViz *= 0.75;
    // SE swell (100-160°) hitting False Bay = bad viz
    if (isFalseBay && swellDeg >= 100 && swellDeg <= 160 && wh > 0.5) baseViz *= 0.75;
    // Kelp sites (Oudekraal, Llandudno) have naturally lower viz baseline
    if (site.kelp && wh > 0.6) baseViz *= 0.85;
  }

  // Time of day: morning (before 10am) typically clearer before afternoon wind
  if (hourOfDay !== undefined) {
    if (hourOfDay >= 6 && hourOfDay <= 9) baseViz *= 1.1;   // morning bonus
    if (hourOfDay >= 14) baseViz *= 0.9; // afternoon wind degradation
  }

  // Seasonal baseline: False Bay summer (Dec-Feb) naturally clearer due to SE winds
  // pushing surface water offshore, upwelling brings clearer cold water up
  if (monthIndex !== undefined && site?.side === "False Bay") {
    if (monthIndex >= 11 || monthIndex <= 1) baseViz *= 1.15; // Dec-Feb
    if (monthIndex >= 5 && monthIndex <= 7) baseViz *= 0.85;  // Jun-Aug (winter swell season)
  }

  const viz = Math.max(1, Math.min(20, baseViz));

  if (viz >= 10) return { est:`${Math.round(viz)}–${Math.round(viz)+5}m`, color:"#00ff9d", quality:"Excellent" };
  if (viz >= 7)  return { est:`${Math.round(viz)}–${Math.round(viz)+3}m`, color:"#00e5cc", quality:"Good" };
  if (viz >= 4)  return { est:`${Math.round(viz)}–${Math.round(viz)+2}m`, color:"#ffb300", quality:"Fair" };
  if (viz >= 2)  return { est:`${Math.round(viz)}–${Math.round(viz)+1}m`, color:"#ff8800", quality:"Poor" };
  return { est:"<2m", color:"#ff4444", quality:"Very poor" };
}

function currentStrength(wh, tl, ts) {
  const falling = ts.includes("Falling") || ts.includes("High");
  const rising  = ts.includes("Rising")  || ts.includes("Low");
  const bigSwell = wh > 1.0;
  if (bigSwell && (falling || rising)) return { level:"Strong", color:"#ff4444", tip:"High surge risk at entries/exits." };
  if (bigSwell || falling || rising)   return { level:"Moderate", color:"#ffb300", tip:"Plan entry around slack water." };
  return { level:"Mild", color:"#00ff9d", tip:"Good time to be in the water." };
}

function diveWetsuit(wt) {
  if (wt < 13) return { suit:"7mm Semi-dry", icon:"🥶", color:"#60a5fa" };
  if (wt < 15) return { suit:"5mm Full Suit", icon:"🧊", color:"#93c5fd" };
  if (wt < 17) return { suit:"5mm or Drysuit", icon:"🌊", color:"#6ee7b7" };
  return { suit:"3mm Shorty", icon:"🤿", color:"#fde68a" };
}

// ─── DIVE SITES ───────────────────────────────────────────────────────────────
const SITES = [
  // FALSE BAY
  { id:"millers",      name:"Miller's Point",      lat:-34.2119, lon:18.4644, side:"False Bay",
    mpa:false, entryType:"Shore — rocky ledge", maxDepth:18, char:"Cape Town's most popular dive. Kelp forests, red Roman, octopus. Multiple entry points.",
    species:["Hottentot","Red Roman","Octopus","Crayfish","Klipfish"], bestTide:"High incoming" },
  { id:"boulders",     name:"Boulders Beach",      lat:-34.1980, lon:18.4510, side:"False Bay",
    mpa:false, entryType:"Shore — sand/boulders", maxDepth:8, char:"Shallow, sheltered bay. Penguins in the water. Great for novice divers.",
    species:["African Penguin","Steenbras","Shyshark","Sand sharks"], bestTide:"Any" },
  { id:"partridge",    name:"Partridge Point",      lat:-34.2200, lon:18.4700, side:"False Bay",
    mpa:false, entryType:"Shore — rocky", maxDepth:22, char:"Dramatic wall and gullies. Excellent visibility. Less crowded than Miller's.",
    species:["Crayfish","Red Roman","Soupfin shark","Gully sharks"], bestTide:"Slack high" },
  { id:"roman_rock",   name:"Roman Rock",           lat:-34.1900, lon:18.4600, side:"False Bay",
    mpa:false, entryType:"Boat", maxDepth:16, char:"Lighthouse pinnacle. Good fish life. Boat access only — arrange charter.",
    species:["Yellowtail","Hottentot","Dageraad","Elf"], bestTide:"Slack" },
  { id:"coral",        name:"Coral Gardens",        lat:-34.1720, lon:18.4550, side:"False Bay",
    mpa:false, entryType:"Shore", maxDepth:12, char:"Colourful sea fans and soft corals. Macro photography heaven.",
    species:["Pipefish","Seahorse","Nudibranchs","Sea fans"], bestTide:"High" },
  { id:"kalk_bay_cave",name:"Kalk Bay Cave",        lat:-34.1290, lon:18.4420, side:"False Bay",
    mpa:false, entryType:"Shore — harbour", maxDepth:10, char:"Sheltered harbour dive. Cave system. Good for nights dives.",
    species:["Octopus","Cuttlefish","Moray eel","Rock lobster"], bestTide:"Any — sheltered" },
  { id:"simonstown",   name:"Simon's Town Wreck",   lat:-34.1900, lon:18.4300, side:"False Bay",
    mpa:false, entryType:"Boat", maxDepth:20, char:"Small wreck with good marine life. Lionfish spotted. Boat recommended.",
    species:["Lionfish","Klipfish","Moray","Torpedo ray"], bestTide:"Slack" },

  // ATLANTIC SEABOARD
  { id:"oudekraal",    name:"Oudekraal",            lat:-33.9900, lon:18.3600, side:"Atlantic",
    mpa:true,  entryType:"Shore — boulders", maxDepth:18, char:"Marine Protected Area. Pristine kelp. Exceptional on calm SE days. Entry can be tricky.",
    species:["Klipfish","Sea urchins","Cape fur seal","Crayfish (no take)"], bestTide:"High slack" },
  { id:"camps_bay_reef",name:"Camps Bay Reef",      lat:-33.9510, lon:18.3720, side:"Atlantic",
    mpa:false, entryType:"Shore", maxDepth:14, char:"Sandy patches with scattered reef. Good viz when flat. Fur seals common.",
    species:["Cape fur seal","Strepie","Klipfish","Pyjama shark"], bestTide:"High" },
  { id:"apostles",     name:"The Apostles",         lat:-33.9700, lon:18.3700, side:"Atlantic",
    mpa:false, entryType:"Boat", maxDepth:25, char:"Deep wall below the mountains. Schooling fish. Boat only.",
    species:["Yellowtail","Geelbek","Giant kob","Snoek"], bestTide:"Slack high" },
  { id:"sandy_bay",    name:"Sandy Bay",            lat:-34.0200, lon:18.3500, side:"Atlantic",
    mpa:false, entryType:"Shore — sand", maxDepth:10, char:"Sandy bottom with reef patches. Good for photography. Informal entry.",
    species:["Puffer fish","Guitarfish","Sole","Torpedo ray"], bestTide:"Any calm" },

  // WEST COAST
  { id:"langebaan",    name:"Langebaan Lagoon",     lat:-33.0900, lon:17.9900, side:"West Coast",
    mpa:true,  entryType:"Shore", maxDepth:6, char:"West Coast National Park MPA. Calm, warm, shallow. Ideal for new divers and photography.",
    species:["Sea anemone","Klipfish","Sea cucumber","Starfish"], bestTide:"High" },
  { id:"dassen",       name:"Dassen Island",        lat:-33.4100, lon:18.0500, side:"West Coast",
    mpa:false, entryType:"Boat — charter", maxDepth:20, char:"Remote island. Penguin colony. Exceptional marine life. Full day trip.",
    species:["African Penguin","Cape gannet","Yellowtail","Dorado"], bestTide:"Slack" },
  { id:"paternoster",  name:"Paternoster Reef",     lat:-32.7900, lon:17.8900, side:"West Coast",
    mpa:false, entryType:"Shore/Boat", maxDepth:15, char:"West Coast gem. Crayfish country. Cold but crystal clear on good days.",
    species:["Crayfish","Perlemoen (MPA)","Geelbek","Roman"], bestTide:"Slack high" },
  // PENINSULA
  { id:"cape_point",   name:"Cape Point Pinnacles",  lat:-34.3500, lon:18.4800, side:"Peninsula",
    mpa:true,  entryType:"Boat — charter", maxDepth:30, char:"Remote, spectacular. Two Oceans convergence zone. Exceptional diversity. Boat only, exposed — weather-dependent.",
    species:["Blue shark","Yellowtail","Giant kob","Cape fur seal","Sunfish"], bestTide:"Slack" },
  { id:"smitswinkel",  name:"Smitswinkel Bay",        lat:-34.2400, lon:18.4750, side:"False Bay",
    mpa:false, entryType:"Shore — rocky ledge", maxDepth:25, char:"4 wrecks in one bay. Superb macro. Sheltered from SE. One of Cape Town's best dives.",
    species:["Octopus","Nudibranchs","Pipefish","Moray eel","Crayfish"], bestTide:"Any — sheltered" },
];

const MPA_SITES = SITES.filter(s => s.mpa).map(s => s.id);
const DIVE_SIDES = ["All", "False Bay", "Atlantic", "West Coast", "Peninsula"];
const DIVE_TABS = [
  {id:"now",      l:"Now"},
  {id:"forecast", l:"Forecast"},
  {id:"tides",    l:"Tides"},
  {id:"sites",    l:"Sites"},
  {id:"safety",   l:"Safety"},
  {id:"gear",     l:"Gear"},
];

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function DepthRing({ value, max, color, label, unit, size=80 }) {
  const r = 30, circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(0,229,204,0.08)" strokeWidth="5"/>
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
          strokeLinecap="round" transform="rotate(-90 40 40)"
          style={{transition:"stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)",
            filter:`drop-shadow(0 0 5px ${color}80)`}}/>
        <text x="40" y="37" textAnchor="middle" fill="#fff"
          fontSize="15" fontFamily="'Orbitron',monospace" letterSpacing="0">{value}</text>
        <text x="40" y="50" textAnchor="middle" fill="rgba(255,255,255,0.35)"
          fontSize="8" fontFamily="'JetBrains Mono',monospace">{unit}</text>
      </svg>
      <div style={{fontSize:7.5,color:"rgba(0,229,204,0.6)",letterSpacing:2,textTransform:"uppercase"}}>{label}</div>
    </div>
  );
}

function WindCompass({ deg, size=52, color="#00e5cc" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" style={{flexShrink:0}}>
      <circle cx="30" cy="30" r="27" fill="none" stroke="rgba(0,229,204,0.08)" strokeWidth="1"/>
      {["N","E","S","W"].map((d,i) => (
        <text key={d} x={30+19*Math.sin(i*Math.PI/2)} y={30-19*Math.cos(i*Math.PI/2)+3.5}
          textAnchor="middle" fill="rgba(0,229,204,0.25)" fontSize="6" fontFamily="monospace">{d}</text>
      ))}
      <g transform={`rotate(${deg},30,30)`}>
        <polygon points="30,7 33,34 30,31 27,34" fill={color} style={{filter:`drop-shadow(0 0 4px ${color})`}}/>
        <polygon points="30,53 33,34 30,37 27,34" fill={`${color}30`}/>
      </g>
    </svg>
  );
}

function DTideChart({ curve, curHour }) {
  const hts = curve.map(p=>p.h), mn=Math.min(...hts), mx=Math.max(...hts);
  const W=600, H=64;
  const sx = i=>(i/(curve.length-1))*W;
  const sy = v=>H-4-((v-mn)/(mx-mn))*(H-14);
  const pts = curve.map((p,i)=>`${sx(i)},${sy(p.h)}`).join(" ");
  const ext = tideExtremes(curve);
  return (
    <div style={{width:"100%",overflowX:"hidden"}}>
      <svg viewBox={`0 0 ${W} ${H+26}`} style={{display:"block",width:"100%",height:"auto"}}>
        <defs>
          <linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00e5cc" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#00e5cc" stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {[0,6,12,18,24,30,36,42].map(h=>(
          <g key={h}>
            <line x1={sx(h)} y1={0} x2={sx(h)} y2={H} stroke="rgba(0,229,204,0.06)" strokeWidth="1"/>
            <text x={sx(h)+2} y={H+16} fill="rgba(0,229,204,0.25)" fontSize="7.5" fontFamily="monospace">
              {h<24?`${String(h).padStart(2,"0")}h`:`+${h-24}h`}
            </text>
          </g>
        ))}
        <line x1={sx(24)} y1={0} x2={sx(24)} y2={H} stroke="rgba(0,229,204,0.15)" strokeWidth="1" strokeDasharray="4,3"/>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#tg2)"/>
        <polyline points={pts} fill="none" stroke="#00e5cc" strokeWidth="1.8" strokeLinejoin="round"/>
        {ext.slice(0,8).map((e,i)=>(
          <g key={i}>
            <circle cx={sx(e.hour)} cy={sy(e.h)} r="3" fill={e.type==="High"?"#00e5cc":"#003d36"}
              stroke="#00e5cc" strokeWidth="1.5"/>
            <text x={sx(e.hour)} y={e.type==="High"?sy(e.h)-8:sy(e.h)+14}
              textAnchor="middle" fill="#00e5cc" fontSize="7" fontFamily="monospace" opacity="0.7">
              {e.h.toFixed(1)}m
            </text>
          </g>
        ))}
        {curHour<curve.length&&(
          <>
            <line x1={sx(curHour)} y1={0} x2={sx(curHour)} y2={H} stroke="#00ff9d" strokeWidth="1.5" strokeDasharray="4,3"/>
            <circle cx={sx(curHour)} cy={sy(curve[curHour]?.h??0.82)} r="3.5" fill="#00ff9d"/>
            <text x={sx(curHour)+5} y={10} fill="#00ff9d" fontSize="7" fontFamily="monospace">NOW</text>
          </>
        )}
      </svg>
    </div>
  );
}

function DForecastStrip({ hourly, curHour }) {
  if (!hourly) return null;
  const hours = Array.from({length:12},(_,i)=>curHour+i).filter(h=>h<48);
  return (
    <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
      {hours.map(h=>{
        const wh = hourly.wave_height?.[h]??0;
        const ws = hourly.wind_speed_10m?.[h]??0;
        const sp = hourly.wave_period?.[h]??0;
        const v = diveVerdict(wh, ws, sp, 1.0);
        const isNow = h===curHour;
        return (
          <div key={h} style={{flexShrink:0,minWidth:62,
            background:isNow?"rgba(0,229,204,0.07)":"rgba(0,229,204,0.02)",
            border:`1px solid ${isNow?"rgba(0,229,204,0.3)":"rgba(0,229,204,0.07)"}`,
            borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
            <div style={{fontSize:8,color:isNow?"#00e5cc":"rgba(0,229,204,0.3)",marginBottom:5,letterSpacing:1}}>
              {h<24?`${String(h).padStart(2,"0")}:00`:`+${h-24}h`}
            </div>
            <div style={{fontSize:14,marginBottom:3}}>{v.icon}</div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:v.color,letterSpacing:0}}>
              {wh.toFixed(1)}m
            </div>
            <div style={{fontSize:7,color:"rgba(0,229,204,0.3)",marginTop:2}}>{ws.toFixed(0)}km/h</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// WaveCheckMode
// ═══════════════════════════════════════════════════════════════════════════════
function WaveCheckMode({ setMode, hideHeader=false, setHeaderMeta, onReady }) {
  const [beach, setBeach] = useState(() => BEACHES.find(b => b.id === safeRead("bc_surf_beach", BEACHES[0].id)) || BEACHES[0]);
  const [favs, setFavs] = useStoredState("bc_surf_favs", ["muizenberg","bigbay","llandudno"]);
  const [data, setData] = useState(null);
  const [hourly, setHourly] = useState(null);
  const [liveSst, setLiveSst] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useStoredState("bc_surf_tab", "now");
  const [filter, setFilter] = useStoredState("bc_surf_filter", "All");
  const [lastRef, setLastRef] = useState(null);
  const [now, setNow] = useState(new Date());
  const [showBeachPicker, setShowBeachPicker] = useStoredState("bc_surf_picker", false);
  const [allScores, setAllScores] = useState([]);
  const [detailExpanded, setDetailExpanded] = useStoredState("bc_surf_detailExpanded", false);
  const [units, setUnits] = useStoredState("bc_units", { height:"m", temp:"C", speed:"kmh" });
  const [checklistDone, setChecklistDone] = useStoredState("bc_surf_checklist", {});
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hr = now.getHours();

  const fetchData = useCallback(async(b, silent=false)=>{
    silent ? setRefreshing(true) : (setLoading(true), setErr(null), setData(null));
    try {
      const cHr = new Date().getHours();
      const [mr,wr,sr] = await Promise.all([
        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${b.lat}&longitude=${b.lon}&current=wave_height,wave_period,wave_direction&hourly=wave_height,wave_period,wave_direction&timezone=Africa%2FJohannesburg&forecast_days=3`),
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${b.lat}&longitude=${b.lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,uv_index&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,cloud_cover,uv_index&timezone=Africa%2FJohannesburg&forecast_days=3`),
        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${b.lat}&longitude=${b.lon}&hourly=sea_surface_temperature&timezone=Africa%2FJohannesburg&forecast_days=1`).catch(()=>null),
      ]);
      const m=await mr.json(), w=await wr.json(), s=sr?await sr.json().catch(()=>null):null;
      const ws=w.current?.wind_speed_10m??w.hourly?.wind_speed_10m?.[cHr]??0;
      const wd=w.current?.wind_direction_10m??w.hourly?.wind_direction_10m?.[cHr]??0;
      const tmp=w.current?.temperature_2m??w.hourly?.temperature_2m?.[cHr]??0;
      const cld=w.current?.cloud_cover??w.hourly?.cloud_cover?.[cHr]??0;
      const rain=w.hourly?.precipitation_probability?.[cHr]??0;
      const uv=w.current?.uv_index??w.hourly?.uv_index?.[cHr]??0;
      const sst=s?.hourly?.sea_surface_temperature?.[cHr]??null;
      setLiveSst(sst?Math.round(sst*10)/10:null);
      const wt=sst?Math.round(sst*10)/10:MONTH_TEMP[new Date().getMonth()];
      const tc=tide48(new Date());
      const tl=tc[cHr]?.h??0.82;
      const allH=tc.map(t=>t.h), mid=(Math.max(...allH)+Math.min(...allH))/2;
      const tn=tc[Math.min(cHr+1,47)]?.h??tl;
      const ts=tl>tn+0.02?(tl>mid?"High — Falling ↓":"Falling ↓"):tl<tn-0.02?(tl<mid?"Low — Rising ↑":"Rising ↑"):tl>mid?"High Tide":"Low Tide";
      const h48={
        wave_height:[...(m.hourly?.wave_height??[])],
        wave_period:[...(m.hourly?.wave_period??[])],
        wind_speed_10m:[...(w.hourly?.wind_speed_10m??[])],
        wind_direction_10m:[...(w.hourly?.wind_direction_10m??[])]
      };
      setHourly(h48);
      let bsc=-1, bst=cHr, ben=Math.min(cHr+2,47);
      for(let i=cHr;i<Math.min(cHr+23,46);i++){
        const sc2=score(h48.wave_height[i]??0,h48.wave_period?.[i]??0,h48.wind_speed_10m[i]??0,h48.wind_direction_10m[i]??0,b);
        if(sc2>bsc){bsc=sc2;bst=i;ben=Math.min(i+2,47);}
      }
      const currentSc = score(m.hourly?.wave_height?.[cHr]??0,m.hourly?.wave_period?.[cHr]??0,ws,wd,b);
      setData({wh:m.current?.wave_height??m.hourly?.wave_height?.[cHr]??0,sp:m.current?.wave_period??m.hourly?.wave_period?.[cHr]??0,waveDir:m.current?.wave_direction??m.hourly?.wave_direction?.[cHr]??0,ws,wd,tmp,cld,rain,uv,tl,ts,tides:tc,wt,suit:wetsuit(wt,ws),bst,ben,bsc,sc:currentSc});
      setLastRef(new Date());
      setNow(new Date());
      // Fetch per-side marine data for accurate beach scoring.
      // Atlantic & False Bay have genuinely different swell exposure.
      // We use 2 representative coords + the already-fetched selected beach.
      const ATLANTIC_COORD = { lat:-33.95, lon:18.37 };   // Camps Bay offshore
      const FALSEBAY_COORD = { lat:-34.12, lon:18.46 };   // Muizenberg offshore
      const needAtlantic = b.side !== "Atlantic";
      const needFalseBay = b.side !== "False Bay";
      const [atl, fb] = await Promise.all([
        needAtlantic ? fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${ATLANTIC_COORD.lat}&longitude=${ATLANTIC_COORD.lon}&current=wave_height,wave_period,wave_direction&hourly=wind_speed_10m,wind_direction_10m&timezone=Africa%2FJohannesburg&forecast_days=1`).then(r=>r.json()).catch(()=>null) : null,
        needFalseBay ? fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${FALSEBAY_COORD.lat}&longitude=${FALSEBAY_COORD.lon}&current=wave_height,wave_period,wave_direction&timezone=Africa%2FJohannesburg&forecast_days=1`).then(r=>r.json()).catch(()=>null) : null,
      ]);
      const atlWh  = needAtlantic ? (atl?.current?.wave_height??m.current?.wave_height??0) : (m.current?.wave_height??0);
      const atlSp  = needAtlantic ? (atl?.current?.wave_period??m.current?.wave_period??0) : (m.current?.wave_period??0);
      const fbWh   = needFalseBay ? (fb?.current?.wave_height??m.current?.wave_height??0) : (m.current?.wave_height??0);
      const fbSp   = needFalseBay ? (fb?.current?.wave_period??m.current?.wave_period??0) : (m.current?.wave_period??0);
      const scores = BEACHES.map(bch => {
        const isAtlantic = bch.side === "Atlantic";
        const isFalseBay = bch.side === "False Bay";
        const bWh = isAtlantic ? atlWh : isFalseBay ? fbWh : m.current?.wave_height??0;
        const bSp = isAtlantic ? atlSp : isFalseBay ? fbSp : m.current?.wave_period??0;
        return { beach: bch, sc: score(bWh, bSp, ws, wd, bch), wh: bWh };
      });
      setAllScores(scores);
    } catch {
      if(!silent) setErr("Couldn't load conditions. Check connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  },[]);

  useEffect(()=>{fetchData(beach);},[beach,fetchData]);
  useEffect(()=>{
    const t=setInterval(()=>fetchData(beach,true),300000);
    return ()=>clearInterval(t);
  },[beach,fetchData]);
  // Clock tick for "last updated" display
  useEffect(()=>{
    const t=setInterval(()=>setNow(new Date()),30000);
    return ()=>clearInterval(t);
  },[]);

  useEffect(()=>{
    let m=document.querySelector('meta[name="viewport"]');
    if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
    m.content='width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover';
    document.documentElement.style.overflowX='hidden';
    document.body.style.overflowX='hidden';
    document.body.style.width='100%';
  },[]);

  useEffect(()=>{
    safeWrite("bc_surf_beach", beach.id);
  },[beach]);

  useEffect(()=>{
    setHeaderMeta?.({
      title: beach.name,
      badges: [beach.level],
      refreshing,
      lastRef,
    });
  },[beach.name, beach.level, refreshing, lastRef, setHeaderMeta]);

  useEffect(()=>{
    if(data && !loading) onReady?.();
  },[data, loading, onReady]);

  const wc = data ? deg2c(data.wd) : "—";
  const wvc = data ? deg2c(data.waveDir) : "—";
  const wst = data ? windState(beach, wc) : null;
  const fmt = h => h<24 ? `${String(h).padStart(2,"0")}:00` : `+${h-24}h`;
  const beachList = BEACHES.filter(b => filter==="All" || b.side===filter);

  // Unit conversion helpers
  const fmtHeight = v => units.height==="ft" ? `${(v*3.281).toFixed(1)}ft` : `${v.toFixed(1)}m`;
  const fmtTemp = v => units.temp==="F" ? `${Math.round(v*9/5+32)}°F` : `${Math.round(v)}°C`;
  const fmtSpeed = v => units.speed==="kts" ? `${Math.round(v*0.540)}kts` : `${Math.round(v)}km/h`;
  const heightUnit = units.height==="ft" ? "ft" : "m";
  const speedUnit = units.speed==="kts" ? "kts" : "km/h";

  // Pull-to-refresh
  const handlePullRefresh = async () => {
    if (isRefreshing || refreshing) return;
    setIsRefreshing(true);
    await fetchData(beach, true);
    setIsRefreshing(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html { overflow-x:hidden; -webkit-text-size-adjust:100%; }
        body { background:#020910; overflow-x:hidden; width:100%; max-width:100vw; overscroll-behavior-x:none; }
        ::-webkit-scrollbar { width:2px; height:2px; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
        button { cursor:pointer; border:none; background:none; font-family:inherit; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
        button:focus-visible { outline:2px solid #00bfff; outline-offset:2px; }

        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes rise { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes waveBg1 { to{transform:translateX(-50%)} }
        @keyframes waveBg2 { from{transform:translateX(-50%)} to{transform:translateX(0)} }
        @keyframes waveBg3 { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes epicGlow { 0%,100%{box-shadow:0 0 0 0 rgba(0,255,135,0),0 4px 24px rgba(0,255,135,0.06)} 50%{box-shadow:0 0 0 3px rgba(0,255,135,0.08),0 4px 40px rgba(0,255,135,0.2)} }
        @keyframes firingSlide { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes badgePop { from{opacity:0;transform:scale(0.8) translateY(-3px)} to{opacity:1;transform:scale(1) translateY(0)} }

        .rise { animation:rise 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards; }

        /* ── SKELETON ── */
        @keyframes skeletonPulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
        .sk { background:rgba(255,255,255,0.04); border-radius:8px; animation:skeletonPulse 1.6s ease-in-out infinite; }
        .sk-line { height:10px; border-radius:4px; }
        .sk-hero { height:140px; border-radius:16px; }
        .sk-card { height:80px; border-radius:12px; }
        .pulse { animation:pulse 2.5s ease-in-out infinite; }
        .shimmer { animation:shimmer 1.5s ease-in-out infinite; }

        /* ── UNIFIED DESIGN SYSTEM — SURF MODE (accent: #00bfff) ── */
        --accent: #00bfff;
        --accent-dim: rgba(0,191,255,0.12);
        --accent-border: rgba(0,191,255,0.25);
        --accent-text: #7dd3fc;

        .shell {
          min-height:100vh;
          background:
            radial-gradient(ellipse 120% 45% at 50% -8%, rgba(0,80,160,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 60% 35% at 90% 90%, rgba(0,20,60,0.12) 0%, transparent 55%),
            linear-gradient(180deg, #020910 0%, #030d18 60%, #020910 100%);
          color:#fff;
          font-family:'JetBrains Mono',monospace;
          padding-bottom:60px;
          overflow-x:hidden;
          width:100%;
          max-width:100vw;
        }
        .shell::before {
          content:'';
          position:fixed; inset:0;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity:0.018; pointer-events:none; z-index:0;
        }

        /* ── HEADER ── */
        .hdr {
          position:sticky; top:0; z-index:100;
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          padding:11px 16px;
          background:rgba(2,9,16,0.88);
          backdrop-filter:blur(24px);
          -webkit-backdrop-filter:blur(24px);
          border-bottom:1px solid rgba(0,191,255,0.08);
        }

        /* ── MODE TOGGLE PILL ── */
        .mode-pill {
          display:flex; align-items:center;
          background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.07);
          border-radius:100px;
          padding:3px;
          gap:2px;
          flex-shrink:0;
        }
        .mode-btn {
          padding:4px 10px; border-radius:100px;
          font-family:'Orbitron',monospace;
          font-size:7.5px; letter-spacing:1px;
          transition:all 0.22s cubic-bezier(0.4,0,0.2,1);
          white-space:nowrap;
        }
        .mode-btn.surf-active {
          background:rgba(0,191,255,0.14);
          border:1px solid rgba(0,191,255,0.38);
          color:#7dd3fc;
          box-shadow:0 0 10px rgba(0,191,255,0.12);
        }
        .mode-btn.dive-active {
          background:rgba(0,229,204,0.14);
          border:1px solid rgba(0,229,204,0.38);
          color:#00e5cc;
          box-shadow:0 0 10px rgba(0,229,204,0.12);
        }
        .mode-btn.inactive {
          color:rgba(255,255,255,0.2);
          border:1px solid transparent;
        }
        .mode-btn.inactive:hover { color:rgba(255,255,255,0.5); }

        .page {
          width:100%; max-width:min(820px,100vw);
          margin:0 auto; padding:var(--page-top,16px) 14px calc(80px + env(safe-area-inset-bottom));
          overflow-x:hidden;
        }

        .scroll-row {
          display:flex; gap:6px; overflow-x:auto; padding-bottom:2px;
          -webkit-overflow-scrolling:touch; scrollbar-width:none;
        }
        .scroll-row::-webkit-scrollbar { display:none; }

        /* ── TABS — hidden, replaced by bottom nav ── */
        .tabs { display:none; }

        /* ── BOTTOM NAV ── */
        .bottom-nav {
          position:fixed; bottom:0; left:0; right:0; z-index:200;
          display:flex; align-items:stretch;
          background:rgba(2,9,16,0.97);
          backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
          border-top:1px solid rgba(0,191,255,0.1);
          padding-bottom:env(safe-area-inset-bottom);
        }
        .bottom-nav button {
          flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:3px; padding:9px 0 8px;
          color:rgba(255,255,255,0.28);
          font-family:'Orbitron',monospace; font-size:8px; letter-spacing:0.5px;
          transition:all 0.18s; min-width:0; overflow:hidden;
        }
        .bottom-nav button.active { color:#7dd3fc; }
        .bottom-nav button.active .nav-icon { filter:drop-shadow(0 0 6px rgba(0,191,255,0.6)); }
        .bottom-nav button:active { transform:scale(0.92); }
        .nav-icon { font-size:17px; line-height:1; }
        .nav-label { font-size:7px; letter-spacing:1px; white-space:nowrap; }

        /* ── CARDS ── */
        .card {
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:12px;
          padding:14px;
          min-width:0; overflow:hidden;
        }
        .card-label {
          font-family:'Orbitron',monospace;
          font-size:9px; letter-spacing:2px;
          color:rgba(255,255,255,0.3);
          text-transform:uppercase;
          margin-bottom:10px;
        }

        .hero {
          border-radius:16px; padding:18px;
          position:relative; overflow:hidden;
          margin-bottom:10px;
        }
        .hero-epic { animation:epicGlow 3s ease-in-out infinite; }

        /* ── STAT GRID ── */
        .stat-grid {
          display:grid; grid-template-columns:1fr 1fr; gap:7px;
        }
        @media(min-width:480px) { .stat-grid { grid-template-columns:repeat(3,1fr); } }
        @media(min-width:700px) { .stat-grid { grid-template-columns:repeat(4,1fr); } }

        .stat-cell {
          background:rgba(255,255,255,0.02);
          border:1px solid rgba(255,255,255,0.05);
          border-radius:10px; padding:11px 12px; min-width:0;
        }
        .stat-label {
          font-family:'Orbitron',monospace;
          font-size:9px; letter-spacing:1.5px;
          color:rgba(255,255,255,0.3);
          text-transform:uppercase; margin-bottom:5px;
        }
        .stat-value {
          font-family:'Orbitron',monospace;
          font-size:18px; letter-spacing:0px;
          color:#fff; line-height:1.05;
        }
        .stat-sub {
          font-family:'JetBrains Mono',monospace;
          font-size:11px; color:rgba(255,255,255,0.35);
          margin-top:3px; line-height:1.3;
        }

        .cond-row {
          display:flex; gap:7px;
          overflow-x:auto; -webkit-overflow-scrolling:touch;
          scrollbar-width:none; padding-bottom:2px;
        }
        .cond-row::-webkit-scrollbar { display:none; }
        .cond-pill {
          flex-shrink:0;
          background:rgba(255,255,255,0.025);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:24px; padding:6px 14px;
          display:flex; align-items:center; gap:6px; white-space:nowrap;
        }

        /* ── MODAL OVERLAY ── */
        .modal-overlay {
          position:fixed; inset:0; z-index:500;
          background:rgba(0,0,0,0.7);
          backdrop-filter:blur(6px);
          display:flex; align-items:flex-end; justify-content:center;
          padding:0 0 env(safe-area-inset-bottom);
        }
        .modal-sheet {
          width:100%; max-width:820px;
          background:#0a1628;
          border:1px solid rgba(0,191,255,0.15);
          border-bottom:none;
          border-radius:20px 20px 0 0;
          padding:20px 18px 32px;
          animation:rise 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .modal-handle {
          width:36px; height:4px; background:rgba(255,255,255,0.15);
          border-radius:2px; margin:0 auto 18px;
        }

        /* ── PULL REFRESH INDICATOR ── */
        @keyframes spinCw { to{transform:rotate(360deg)} }
        .refresh-spinning { animation:spinCw 0.8s linear infinite; display:inline-block; }

        .wave-bg {
          position:fixed; bottom:0; left:0;
          width:100%; height:140px;
          pointer-events:none; z-index:0; opacity:0.04;
        }
        .wave1 { animation:waveBg1 18s linear infinite; }
        .wave2 { animation:waveBg2 13s linear infinite; }
        .wave3 { animation:waveBg3 26s linear infinite; }

        /* ── INTERACTIVE CHECKLIST ── */
        .check-item { transition:opacity 0.2s; }
        .check-item.done { opacity:0.45; }
        .check-box {
          width:20px; height:20px; border-radius:6px; border:1.5px solid rgba(255,255,255,0.15);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
          transition:all 0.18s; font-size:11px;
        }
        .check-box.checked { background:rgba(0,255,135,0.15); border-color:rgba(0,255,135,0.5); }
      `}</style>

      {/* Ambient waves */}
      <svg className="wave-bg" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <g className="wave1">
          <path d="M0,80 C200,30 400,120 600,80 C800,40 1000,120 1200,80 C1400,40 1600,120 1800,80 C2000,40 2200,120 2400,80 L2400,160 L0,160Z" fill="#00bfff"/>
        </g>
        <g className="wave2">
          <path d="M0,100 C240,60 480,130 720,100 C960,70 1200,130 1440,100 C1680,70 1920,130 2160,100 L2160,160 L0,160Z" fill="#0055cc" opacity="0.55"/>
        </g>
        <g className="wave3">
          <path d="M0,122 C180,98 360,142 540,122 C720,102 900,142 1080,122 C1260,102 1440,142 1620,122 C1800,102 1980,142 2160,122 L2160,160 L0,160Z" fill="#003399" opacity="0.35"/>
        </g>
      </svg>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={()=>setShowSettings(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,letterSpacing:2,color:"#7dd3fc",marginBottom:18}}>⚙ SETTINGS</div>
            {[
              { label:"HEIGHT UNITS", key:"height", opts:[{v:"m",l:"Metres (m)"},{v:"ft",l:"Feet (ft)"}] },
              { label:"TEMPERATURE", key:"temp", opts:[{v:"C",l:"Celsius (°C)"},{v:"F",l:"Fahrenheit (°F)"}] },
              { label:"WIND SPEED", key:"speed", opts:[{v:"kmh",l:"km/h"},{v:"kts",l:"Knots"}] },
            ].map(({label,key,opts})=>(
              <div key={key} style={{marginBottom:16}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:2,fontFamily:"'Orbitron',monospace",marginBottom:8}}>{label}</div>
                <div style={{display:"flex",gap:6}}>
                  {opts.map(({v,l})=>(
                    <button key={v} onClick={()=>setUnits(u=>({...u,[key]:v}))}
                      style={{flex:1,padding:"10px",borderRadius:10,fontSize:12,
                        background:units[key]===v?"rgba(0,191,255,0.12)":"rgba(255,255,255,0.04)",
                        border:`1px solid ${units[key]===v?"rgba(0,191,255,0.4)":"rgba(255,255,255,0.08)"}`,
                        color:units[key]===v?"#7dd3fc":"rgba(255,255,255,0.45)"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={()=>setShowSettings(false)}
              style={{width:"100%",padding:"12px",borderRadius:10,marginTop:4,
                background:"rgba(0,191,255,0.08)",border:"1px solid rgba(0,191,255,0.2)",
                color:"#7dd3fc",fontSize:11,fontFamily:"'Orbitron',monospace",letterSpacing:2}}>
              DONE
            </button>
          </div>
        </div>
      )}

      {/* Score Info Modal */}
      {showScoreInfo && (
        <div className="modal-overlay" onClick={()=>setShowScoreInfo(false)}>
          <div className="modal-sheet" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,letterSpacing:2,color:"#7dd3fc",marginBottom:16}}>HOW IS THE SCORE CALCULATED?</div>
            <p style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.7,marginBottom:14}}>
              The surf score (0–100) combines four weighted factors:
            </p>
            {[
              {factor:"Wave height",weight:"32pts",desc:"How close swell is to the ideal range for this break"},
              {factor:"Swell period",weight:"28pts",desc:"Longer period = more powerful, organised groundswell"},
              {factor:"Wind speed",weight:"22pts",desc:"Lighter wind = cleaner faces"},
              {factor:"Wind direction",weight:"18pts",desc:"Offshore scores max — onshore scores near zero"},
            ].map(({factor,weight,desc})=>(
              <div key={factor} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                <div style={{width:52,flexShrink:0}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:12,color:"#00ff87"}}>{weight}</div>
                </div>
                <div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.7)",marginBottom:2}}>{factor}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",lineHeight:1.5}}>{desc}</div>
                </div>
              </div>
            ))}
            <p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:12,lineHeight:1.6}}>
              Each beach has its own ideal wave range, preferred wind directions, and rip risk — scores reflect conditions specifically for the selected break.
            </p>
            <button onClick={()=>setShowScoreInfo(false)}
              style={{width:"100%",padding:"12px",borderRadius:10,marginTop:16,
                background:"rgba(0,191,255,0.08)",border:"1px solid rgba(0,191,255,0.2)",
                color:"#7dd3fc",fontSize:11,fontFamily:"'Orbitron',monospace",letterSpacing:2}}>
              GOT IT
            </button>
          </div>
        </div>
      )}

      <div className="shell" style={{position:"relative",zIndex:1}}>

        {/* ── HEADER ── */}
        <div className="hdr" style={hideHeader ? {display:"none"} : undefined}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
            <div style={{width:32,height:32,borderRadius:8,
              background:"linear-gradient(135deg,rgba(0,100,200,0.6),rgba(0,191,255,0.3))",
              border:"1px solid rgba(0,191,255,0.25)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🌊</div>
            <div style={{minWidth:0}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,letterSpacing:3,lineHeight:1,color:"#fff"}}>WAVECHECK</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"rgba(0,191,255,0.5)",letterSpacing:2}}>CAPE TOWN</span>
                {(refreshing||isRefreshing)
                  ? <span className="shimmer" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#7dd3fc",letterSpacing:1}}>· SYNCING</span>
                  : lastRef && <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:1}}>· ↻ {Math.floor((now-lastRef)/60000)<1?"just now":Math.floor((now-lastRef)/60000)+"m ago"}</span>
                }
              </div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <button onClick={handlePullRefresh} title="Refresh"
              style={{width:30,height:30,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
                background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                fontSize:14,color:"rgba(255,255,255,0.35)"}}>
              <span className={isRefreshing?"refresh-spinning":""}>↻</span>
            </button>
            <button onClick={()=>setShowSettings(true)} title="Settings"
              style={{width:30,height:30,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
                background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                fontSize:14,color:"rgba(255,255,255,0.35)"}}>
              ⚙
            </button>
            <div className="mode-pill">
              <button className="mode-btn surf-active" onClick={()=>setMode("surf")}>🌊 SURF</button>
              <button className="mode-btn inactive" onClick={()=>setMode("dive")}>🤿 DIVE</button>
            </div>
          </div>
        </div>

        <div className="page">

          {/* ── BEACH SELECTOR ── */}
          <div style={{marginBottom:14}}>
            {/* Compact current beach + change */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:8,minHeight:34}}>
              <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1,overflow:"hidden"}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:17,letterSpacing:0.8,color:"#fff",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>
                  {beach.name}
                </div>
                <span style={{fontSize:7,color:LVL_COLOR[beach.level]??"#888",letterSpacing:1,flexShrink:0,
                  background:`${LVL_COLOR[beach.level]??'#888'}15`,border:`1px solid ${LVL_COLOR[beach.level]??'#888'}30`,
                  borderRadius:20,padding:"2px 7px"}}>
                  {beach.level.toUpperCase()}
                </span>
                {SHARK.includes(beach.id) && <span style={{fontSize:7,flexShrink:0}}>🦈</span>}
                {beach.rip && <span style={{fontSize:7,flexShrink:0}}>⚡</span>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>setFavs(p=>p.includes(beach.id)?p.filter(x=>x!==beach.id):[...p,beach.id])}
                  style={{fontSize:13,color:favs.includes(beach.id)?"#fbbf24":"rgba(255,255,255,0.2)",transition:"color 0.2s"}}>
                  {favs.includes(beach.id)?"★":"☆"}
                </button>
                <button onClick={()=>setShowBeachPicker(p=>!p)}
                  style={{padding:"5px 12px",borderRadius:20,fontSize:8,letterSpacing:2,
                    background:showBeachPicker?"rgba(0,191,255,0.12)":"rgba(255,255,255,0.05)",
                    border:`1px solid ${showBeachPicker?"rgba(0,191,255,0.3)":"rgba(255,255,255,0.08)"}`,
                    color:showBeachPicker?"#7dd3fc":"rgba(255,255,255,0.4)"}}>
                  {showBeachPicker?"CLOSE":"CHANGE"}
                </button>
              </div>
            </div>

            {/* Expandable picker */}
            {showBeachPicker && (
              <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"12px",marginBottom:8}}>
                <div className="scroll-row" style={{marginBottom:8}}>
                  {SIDES.map(s=>(
                    <button key={s} onClick={()=>setFilter(s)}
                      style={{flexShrink:0,padding:"4px 12px",borderRadius:100,fontSize:8,letterSpacing:2,
                        fontFamily:"'Orbitron',monospace",transition:"all 0.15s",
                        background:filter===s?"rgba(0,191,255,0.12)":"rgba(255,255,255,0.04)",
                        border:`1px solid ${filter===s?"rgba(0,191,255,0.35)":"rgba(255,255,255,0.07)"}`,
                        color:filter===s?"#7dd3fc":"rgba(255,255,255,0.35)"}}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="scroll-row">
                  {beachList.map(b=>(
                    <button key={b.id} onClick={()=>{setBeach(b);setShowBeachPicker(false);}}
                      style={{flexShrink:0,padding:"6px 14px",borderRadius:100,
                        fontFamily:"'Orbitron',monospace",fontSize:12,letterSpacing:2,whiteSpace:"nowrap",
                        transition:"all 0.15s",
                        background:beach.id===b.id?"rgba(0,191,255,0.12)":"rgba(255,255,255,0.04)",
                        border:`1px solid ${beach.id===b.id?"rgba(0,191,255,0.4)":"rgba(255,255,255,0.07)"}`,
                        color:beach.id===b.id?"#7dd3fc":"rgba(255,255,255,0.45)"}}>
                      {b.name}{favs.includes(b.id)?" ★":""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── LOADING ── */}
          {loading && (
            <div style={{display:"flex",flexDirection:"column",gap:9,padding:"4px 0"}}>
              <div className="sk sk-hero"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                <div className="sk sk-card"/>
                <div className="sk sk-card"/>
              </div>
              <div className="sk" style={{height:80,borderRadius:12}}/>
              <div style={{display:"flex",gap:6}}>
                {[1,2,3].map(i=><div key={i} className="sk" style={{flex:1,height:28,borderRadius:20}}/>)}
              </div>
            </div>
          )}
          {err && (
            <div style={{background:"rgba(248,113,113,0.07)",border:"1px solid rgba(248,113,113,0.2)",
              borderRadius:10,padding:"12px 16px",color:"#fca5a5",fontSize:11,marginBottom:12}}>
              ⚠ {err}
            </div>
          )}

          {/* ── CONTENT ── */}
          {data && !loading && (
            <div className="rise">
              <div className="tabs">
                {TABS.map(t=>(
                  <button key={t.id} className={`tab-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* ════════ NOW ════════ */}
              {tab==="now" && (()=>{
                const rip = ripRisk(beach,data.wh,data.tl,data.ts);
                const crowd = crowdLevel(beach,data.sc);
                const r = rating(data.sc);
                const wst2 = windState(beach,wc);
                const sq = swellQuality(data.sp);
                // Sunrise in Cape Town: ~05:00 in Dec, ~07:15 in Jun
                // Approximate: sunrise = 6 + 1.25 * sin((month-6)/12 * 2π)
                const _mo = new Date().getMonth();
                const sunriseHr = Math.round(6 + 1.25 * Math.sin((_mo - 5) / 12 * 2 * Math.PI));
                const isDawnPatrol = data.bst >= sunriseHr && data.bst <= sunriseHr + 2;
                let dec, emoji, color, reason;
                const goCount = [wst2.s!=="Onshore",data.tl>0.6&&data.tl<1.7,data.wh>=beach.iw[0]*.7&&data.wh<=beach.iw[1]*1.3,data.ws<28].filter(Boolean).length;
                if(goCount>=3&&data.sc>=55){dec="PADDLE OUT";emoji="🤙";color="#00ff87";reason="Conditions are firing.";}
                else if(goCount>=2&&data.sc>=38){
                  dec="WORTH A SESSION";emoji="👍";color="#fbbf24";
                  reason=[wst2.s==="Onshore"?"Onshore wind":null,data.wh<beach.iw[0]*.7?"Below ideal size":null,data.wh>beach.iw[1]*1.3?"Above ideal size":null].filter(Boolean).join(" · ")||"Decent session ahead.";
                } else {
                  dec="STAY HOME";emoji="🛋️";color="#f87171";
                  reason=data.wh<0.4?"Flat as a lake.":data.ws>30?"Howling onshore.":"Conditions against you today.";
                }
                return (
                  <div style={{display:"flex",flexDirection:"column",gap:9}}>

                    {/* FIRING BANNER */}
                    {data.sc >= 80 && (
                      <div style={{
                        animation:"firingSlide 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards",
                        background:"linear-gradient(135deg,rgba(0,255,135,0.1) 0%,rgba(0,191,255,0.07) 100%)",
                        border:"1px solid rgba(0,255,135,0.3)",borderRadius:10,padding:"10px 14px",
                        display:"flex",alignItems:"center",justifyContent:"space-between"
                      }}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:18}}>🔥</span>
                          <div>
                            <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,color:"#00ff87",letterSpacing:2}}>FIRING RIGHT NOW</div>
                            <div style={{fontSize:8,color:"rgba(255,255,255,0.35)",letterSpacing:1}}>Epic conditions at {beach.name}</div>
                          </div>
                        </div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:26,color:"#00ff87",lineHeight:1}}>{data.sc}</div>
                      </div>
                    )}

                    {/* HERO */}
                    <div className={`hero${data.sc>=80?" hero-epic":""}`} style={{
                      background:`linear-gradient(135deg,${color}12 0%,${color}05 45%,transparent 72%),linear-gradient(220deg,rgba(0,15,40,0.55) 0%,transparent 55%)`,
                      border:`1px solid ${color}30`,
                      boxShadow:`0 4px 32px ${color}0a,inset 0 1px 0 ${color}12`
                    }}>
                      <div style={{position:"absolute",top:-50,right:-50,width:210,height:210,
                        background:`radial-gradient(${color}1c,transparent 70%)`,pointerEvents:"none"}}/>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,height:44,
                        background:`linear-gradient(0deg,${color}07,transparent)`,
                        pointerEvents:"none",borderRadius:"0 0 16px 16px"}}/>

                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",letterSpacing:2}}>SHOULD YOU SURF?</div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          {isDawnPatrol && (
                            <div style={{
                              animation:"badgePop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards",
                              display:"flex",alignItems:"center",gap:4,
                              background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.28)",
                              borderRadius:20,padding:"3px 10px"
                            }}>
                              <span style={{fontSize:9}}>🌅</span>
                              <span style={{fontSize:9,color:"#fbbf24",letterSpacing:1.5}}>DAWN PATROL</span>
                            </div>
                          )}
                          <button onClick={()=>setShowScoreInfo(true)}
                            style={{width:22,height:22,borderRadius:"50%",fontSize:11,
                              background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
                              color:"rgba(255,255,255,0.45)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            ⓘ
                          </button>
                        </div>
                      </div>

                      <div style={{display:"flex",alignItems:"center",gap:14}}>
                        <span style={{fontSize:40,flexShrink:0,lineHeight:1}}>{emoji}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Orbitron',monospace",
                            fontSize:"clamp(24px,7vw,38px)",lineHeight:1,letterSpacing:2,
                            color,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                            textShadow:`0 0 28px ${color}40`}}>
                            {dec}
                          </div>
                          <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginTop:4,lineHeight:1.4}}>
                            {reason}
                          </div>
                        </div>
                        <ScoreArc sc={data.sc} color={r.c} size={80}/>
                      </div>

                      {/* Quick condition pills */}
                      <div style={{display:"flex",gap:6,marginTop:14,flexWrap:"wrap"}}>
                        {[
                          {l:`${fmtHeight(data.wh)}`, icon:"🌊", c:data.wh>=beach.iw[0]&&data.wh<=beach.iw[1]?"#00ff87":data.wh>beach.iw[1]*1.3?"#f87171":"#fbbf24"},
                          {l:`${data.sp.toFixed(0)}s · ${sq.label}`, icon:"⏱", c:sq.color},
                          {l:`${wc} ${fmtSpeed(data.ws)}`, icon:"💨", c:wst2.c},
                          {l:data.ts, icon:"🌙", c:"#7dd3fc"},
                          {l:crowd.level, icon:"👥", c:crowd.color},
                        ].map((p,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:5,
                            background:`${p.c}0e`,border:`1px solid ${p.c}28`,
                            borderRadius:20,padding:"5px 11px",height:30,boxSizing:"border-box"}}>
                            <span style={{fontSize:11,lineHeight:1}}>{p.icon}</span>
                            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:p.c,letterSpacing:0.3,whiteSpace:"nowrap"}}>{p.l}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* BEST SESSION + SHARE */}
                    <div style={{display:"flex",gap:7}}>
                      <div style={{flex:1,background:"rgba(0,191,255,0.04)",
                        border:"1px solid rgba(0,191,255,0.15)",borderRadius:11,padding:"12px 14px"}}>
                        <div className="card-label" style={{color:"rgba(0,191,255,0.5)"}}>⏱ BEST WINDOW TODAY</div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:20,color:"#7dd3fc",letterSpacing:2}}>
                          {fmt(data.bst)} – {fmt(data.ben)}
                        </div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.28)",marginTop:3}}>
                          Peak score: {data.bsc}/100
                        </div>
                      </div>
                      <div style={{flex:1,background:"rgba(255,255,255,0.025)",
                        border:"1px solid rgba(255,255,255,0.06)",borderRadius:11,padding:"12px 14px"}}>
                        <div className="card-label">💨 WIND</div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <WindArrow deg={data.wd} size={42} color={wst2.c}/>
                          <div style={{minWidth:0}}>
                            <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,color:wst2.c,letterSpacing:1}}>
                              {wst2.s}
                            </div>
                            <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",marginTop:1}}>{wc} · {data.ws.toFixed(0)}km/h</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SHARE CONDITIONS */}
                    <button onClick={()=>{
                      const txt = `🌊 ${beach.name} — Score ${data.sc}/100\n${dec}\n${data.wh.toFixed(1)}m · ${data.sp.toFixed(0)}s · ${wc} ${data.ws.toFixed(0)}km/h\ncheck-eosin.vercel.app`;
                      if(navigator.share){navigator.share({title:`${beach.name} conditions`,text:txt});}
                      else{navigator.clipboard?.writeText(txt).then(()=>alert("Copied to clipboard!"));}
                    }} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,
                        padding:"9px",borderRadius:10,
                        background:"rgba(0,191,255,0.04)",border:"1px solid rgba(0,191,255,0.12)",
                        color:"rgba(0,191,255,0.5)",fontSize:8,letterSpacing:2,width:"100%",
                        fontFamily:"'Orbitron',monospace",transition:"all 0.15s"}}>
                      📤 SHARE CONDITIONS
                    </button>

                    {/* EXPAND DETAIL TOGGLE */}
                    <button onClick={()=>setDetailExpanded(p=>!p)}
                      style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                        padding:"10px",borderRadius:10,
                        background:detailExpanded?"rgba(0,191,255,0.06)":"rgba(255,255,255,0.02)",
                        border:`1px solid ${detailExpanded?"rgba(0,191,255,0.2)":"rgba(255,255,255,0.06)"}`,
                        color:detailExpanded?"rgba(0,191,255,0.7)":"rgba(255,255,255,0.3)",
                        fontSize:8,letterSpacing:2,width:"100%",transition:"all 0.2s",fontFamily:"'Orbitron',monospace"}}>
                      <span style={{transition:"transform 0.2s",display:"inline-block",transform:detailExpanded?"rotate(180deg)":"rotate(0deg)",fontSize:10}}>⌄</span>
                      {detailExpanded?"LESS DETAIL":"MORE DETAIL"}
                    </button>

                    {detailExpanded && (
                      <div style={{display:"flex",flexDirection:"column",gap:7}}>
                        <div className="stat-grid">
                          {[
                            {icon:"🌊",label:"Wave Height",value:`${data.wh.toFixed(1)}m`,sub:data.wh>=beach.iw[0]&&data.wh<=beach.iw[1]?"✓ Ideal range":`Ideal ${beach.iw[0]}–${beach.iw[1]}m`,hi:data.wh>=beach.iw[0]&&data.wh<=beach.iw[1]},
                            {icon:"⏱",label:"Swell Period",value:`${data.sp.toFixed(0)}s`,sub:data.sp>=12?"Long — quality swell":data.sp>=8?"Medium period":"Short — bumpy"},
                            {icon:"🌡",label:"Water Temp",value:`${data.wt}°C`,sub:liveSst?"🛰 Live SST":"📅 Seasonal avg — not live",hi:!!liveSst},
                            {icon:"🌤",label:"Air Temp",value:`${data.tmp.toFixed(0)}°C`,sub:`Cloud ${data.cld}%`},
                            {icon:"🔆",label:"UV Index",value:`${data.uv?.toFixed(0)??"-"}`,sub:data.uv>=8?"Very high 🔥":data.uv>=5?"Moderate":"Low UV"},
                            {icon:"🌧",label:"Rain Chance",value:`${data.rain}%`,sub:data.rain>60?"Pack a towel":"Likely dry"},
                            {icon:"🧭",label:"Swell Dir",value:wvc,sub:`${data.waveDir.toFixed(0)}°`},
                            {icon:"⚠️",label:"Rip Risk",value:ripRisk(beach,data.wh,data.tl,data.ts).level,sub:ripRisk(beach,data.wh,data.tl,data.ts).tip.slice(0,32)+"…"},
                          ].map((s,i)=>(
                            <div key={i} className="stat-cell" style={s.hi?{borderColor:"rgba(0,191,255,0.2)",background:"rgba(0,191,255,0.04)"}:{}}>
                              <div className="stat-label">{s.icon} {s.label}</div>
                              <div className="stat-value" style={s.hi?{color:"#7dd3fc"}:{}}>{s.value}</div>
                              <div className="stat-sub">{s.sub}</div>
                            </div>
                          ))}
                        </div>
                        {/* Break description */}
                        <div className="card">
                          <div className="card-label">📍 {beach.name.toUpperCase()} NOTES</div>
                          <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.6,marginBottom:8}}>{beach.char}</p>
                          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                            {beach.kelp && <span style={{fontSize:8,color:"#a78bfa",background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.2)",borderRadius:20,padding:"3px 9px",letterSpacing:1}}>🌿 KELP</span>}
                            {beach.rip && <span style={{fontSize:8,color:"#fbbf24",background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:20,padding:"3px 9px",letterSpacing:1}}>⚡ RIP-PRONE</span>}
                            {SHARK.includes(beach.id) && <span style={{fontSize:8,color:"#f87171",background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:20,padding:"3px 9px",letterSpacing:1}}>🦈 SHARK SPOTTERS</span>}
                            <span style={{fontSize:8,color:"#60a5fa",background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:20,padding:"3px 9px",letterSpacing:1}}>IDEAL {beach.iw[0]}–{beach.iw[1]}m</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ════════ FORECAST ════════ */}
              {tab==="forecast" && (
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div>
                    <div className="card-label">📅 5-DAY OUTLOOK</div>
                    <WeekOutlook hourly={hourly} beach={beach}/>
                  </div>
                  <div>
                    <div className="card-label">NEXT 12 HOURS</div>
                    <ForecastStrip hourly={hourly} curHour={hr} beach={beach}/>
                  </div>
                  <div className="card">
                    <div className="card-label" style={{color:"rgba(129,140,248,0.7)"}}>📈 48H WAVE HEIGHT</div>
                    <SwellChart hourly={hourly} curHour={hr}/>
                  </div>
                </div>
              )}

              {/* ════════ TIDES ════════ */}
              {tab==="tides" && (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div className="card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <span className="card-label" style={{color:"rgba(0,191,255,0.6)",margin:0}}>🌙 48H TIDES</span>
                      <span style={{fontSize:8,color:"#00ff87",letterSpacing:1.5}}>HARMONIC ✓</span>
                    </div>
                    <TideChart curve={data.tides} curHour={hr}/>
                  </div>
                  <div className="card-label" style={{marginTop:4}}>HIGHS & LOWS</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {tideExtremes(data.tides).slice(0,6).map((e,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                        background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",
                        borderRadius:10,padding:"12px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:18}}>{e.type==="High"?"🌊":"🏖️"}</span>
                          <div>
                            <div style={{fontFamily:"'Orbitron',monospace",fontSize:15,
                              color:e.type==="High"?"#7dd3fc":"#fbbf24",letterSpacing:2}}>
                              {e.type} Tide
                            </div>
                            <div style={{fontSize:8.5,color:"rgba(255,255,255,0.25)",marginTop:1}}>
                              {e.hour<24?`${String(e.hour).padStart(2,"0")}:00`:`Tomorrow ${String(e.hour-24).padStart(2,"0")}:00`}
                            </div>
                          </div>
                        </div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:22,color:"#fff"}}>
                          {e.h.toFixed(2)}<span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>m</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ════════ SPOTS ════════ */}
              {tab==="spots" && (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:2}}>
                    ALL CAPE TOWN BREAKS — CURRENT CONDITIONS
                  </div>
                  {allScores.length > 0 ? (
                    <AllBeachesOverview allScores={allScores} onSelect={(b)=>{setBeach(b);setTab("now");}} currentId={beach.id}/>
                  ) : (
                    <div style={{color:"rgba(255,255,255,0.3)",fontSize:11,padding:"20px 0",textAlign:"center"}}>
                      Loading spot scores…
                    </div>
                  )}
                </div>
              )}

              {/* ════════ SAFETY ════════ */}
              {tab==="safety" && (()=>{
                const rip = ripRisk(beach,data.wh,data.tl,data.ts);
                const crowd = crowdLevel(beach,data.sc);
                return (
                  <div style={{display:"flex",flexDirection:"column",gap:9}}>
                    <div style={{background:`${rip.color}0d`,border:`1px solid ${rip.color}35`,borderRadius:12,padding:"14px"}}>
                      <div className="card-label">⚠️ RIP CURRENT RISK</div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:28,color:rip.color,letterSpacing:2,flexShrink:0}}>
                          {rip.level}
                        </div>
                        <div style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",lineHeight:1.5}}>{rip.tip}</div>
                      </div>
                    </div>

                    <div style={{background:`${crowd.color}0d`,border:`1px solid ${crowd.color}30`,borderRadius:12,padding:"14px"}}>
                      <div className="card-label">👥 CROWD FORECAST</div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:28,color:crowd.color,letterSpacing:2,flexShrink:0}}>
                          {crowd.level}
                        </div>
                        <div style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",lineHeight:1.5}}>{crowd.tip}</div>
                      </div>
                    </div>

                    {SHARK.includes(beach.id) && (
                      <div style={{background:"rgba(248,113,113,0.06)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:12,padding:"14px"}}>
                        <div className="card-label">🦈 SHARK SPOTTERS — FALSE BAY</div>
                        <p style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",lineHeight:1.6}}>
                          This beach is covered by the SA Shark Spotters programme. Check{" "}
                          <span style={{color:"#f87171"}}>sharkspotters.org.za</span>{" "}
                          for today's flag colour before paddling out.{" "}
                          <strong style={{color:"#fca5a5"}}>Never surf alone.</strong>
                        </p>
                      </div>
                    )}

                    {beach.kelp && (
                      <div style={{background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:12,padding:"14px"}}>
                        <div className="card-label">🌿 KELP BEDS</div>
                        <p style={{fontSize:10.5,color:"rgba(255,255,255,0.45)",lineHeight:1.6}}>
                          Paddle through channels, not over kelp. Can impede duck-diving on the paddle-out.
                        </p>
                      </div>
                    )}

                    <div className="card">
                      <div className="card-label">📍 BREAK CHARACTER</div>
                      <p style={{fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.6,marginBottom:10}}>{beach.char}</p>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        <span style={{fontSize:8,color:LVL_COLOR[beach.level],background:`${LVL_COLOR[beach.level]}12`,
                          border:`1px solid ${LVL_COLOR[beach.level]}30`,borderRadius:20,padding:"3px 9px",letterSpacing:1}}>
                          {beach.level.toUpperCase()}
                        </span>
                        <span style={{fontSize:8,color:"#60a5fa",background:"rgba(96,165,250,0.08)",
                          border:"1px solid rgba(96,165,250,0.2)",borderRadius:20,padding:"3px 9px",letterSpacing:1}}>
                          IDEAL {beach.iw[0]}–{beach.iw[1]}m
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ════════ GEAR ════════ */}
              {tab==="gear" && (
                <div style={{display:"flex",flexDirection:"column",gap:9}}>
                  {/* Wetsuit */}
                  <div style={{background:`${data.suit.color}0d`,border:`1px solid ${data.suit.color}30`,borderRadius:14,padding:"16px"}}>
                    <div className="card-label">🤿 WETSUIT RECOMMENDATION</div>
                    <div style={{display:"flex",alignItems:"center",gap:14}}>
                      <span style={{fontSize:44,flexShrink:0,lineHeight:1}}>{data.suit.icon}</span>
                      <div style={{minWidth:0}}>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:22,color:data.suit.color,
                          letterSpacing:2,lineHeight:1.1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {data.suit.suit}
                        </div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:4}}>
                          Water {data.wt}°C {liveSst?"(live SST)":"(seasonal avg)"} · wind chill applied
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Board */}
                  <div className="card">
                    <div className="card-label">🏄 BOARD RECOMMENDATION</div>
                    {(()=>{
                      const wh=data.wh,[lo,hi]=beach.iw;
                      const[board,reason]=wh<0.4?["Longboard / Foamie","Flat — grab the log."]:wh<lo*.8?["Funboard / Longboard","Small — go for volume."]:wh<=hi?[beach.level==="Advanced"||beach.level==="Inter/Advanced"?"Shortboard / Step-up":"Fish / Mid-length",`In the ideal window for ${beach.name}.`]:wh<=hi*1.4?["Step-up","Bigger than ideal — go for length."]:["Gun","Big surf. Don't underboard."];
                      return (
                        <>
                          <div style={{fontFamily:"'Orbitron',monospace",fontSize:24,color:"#7dd3fc",letterSpacing:2,marginBottom:3}}>{board}</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{reason}</div>
                        </>
                      );
                    })()}
                  </div>

                  {/* UV */}
                  <div style={{background:data.uv>=6?"rgba(251,191,36,0.06)":"rgba(255,255,255,0.025)",
                    border:`1px solid ${data.uv>=6?"rgba(251,191,36,0.25)":"rgba(255,255,255,0.06)"}`,
                    borderRadius:12,padding:"14px"}}>
                    <div className="card-label">🔆 SUN PROTECTION</div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:36,flexShrink:0,lineHeight:1,
                        color:data.uv>=8?"#f87171":data.uv>=5?"#fbbf24":"#4ade80"}}>
                        UV {data.uv?.toFixed(0)??"-"}
                      </div>
                      <div>
                        <div style={{fontSize:12,color:"#fff",marginBottom:3}}>
                          {data.uv>=8?"SPF 50+ — reapply hourly":data.uv>=5?"SPF 30+ recommended":data.uv>=3?"Light protection":"Low UV today"}
                        </div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>
                          {data.uv>=6?"Rashguard or UV-50 lycra recommended.":"Still wear sunscreen on the water."}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="card">
                    <div className="card-label">📋 SESSION CHECKLIST</div>
                    {[
                      {item:data.suit.suit, icon:data.suit.icon, show:true},
                      {item:"Sunscreen SPF 50+", icon:"☀️", show:true},
                      {item:"Leash", icon:"🔗", show:true},
                      {item:"Wax / Traction pad", icon:"🏄", show:true},
                      {item:"Boots + Hood", icon:"🥾", show:data.wt<14},
                      {item:"Rain jacket", icon:"🌧", show:data.rain>60},
                      {item:"Towel + warm layers", icon:"🏖️", show:true},
                      {item:"Water bottle", icon:"💧", show:true},
                      {item:"sharkspotters.org.za — check flag status", icon:"🦈", show:SHARK.includes(beach.id), link:"https://sharkspotters.org.za"},
                    ].filter(g=>g.show).map((g,i,arr)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",
                        borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.04)":"none"}}>
                        <span style={{fontSize:15,flexShrink:0,width:22,textAlign:"center"}}>{g.icon}</span>
                        {g.link
                          ? <a href={g.link} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:"#7dd3fc",flex:1,textDecoration:"none"}}>{g.item} ↗</a>
                          : <span style={{fontSize:11,color:"rgba(255,255,255,0.55)",flex:1}}>{g.item}</span>}
                        <button onClick={()=>setChecklistDone(p=>({...p,[`s_${i}`]:!p[`s_${i}`]}))}
                          className={`check-box${checklistDone[`s_${i}`]?" checked":""}`}>
                          {checklistDone[`s_${i}`]?"✓":""}
                        </button>
                      </div>
                    ))}
                    {Object.values(checklistDone).some(Boolean) && (
                      <button onClick={()=>setChecklistDone({})}
                        style={{width:"100%",marginTop:10,padding:"8px",borderRadius:8,
                          fontSize:10,color:"rgba(255,255,255,0.3)",
                          background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                        Reset checklist
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* FOOTER */}
              <div style={{marginTop:18,padding:"10px 14px",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:5}}>
                  {["WAVES: Open-Meteo Marine","WIND: Open-Meteo","WATER: "+(liveSst?"🛰 Live SST":"📅 Seasonal"),"TIDES: Harmonic","UV: Open-Meteo"].map(s=>(
                    <span key={s} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"rgba(0,191,255,0.6)",background:"rgba(0,191,255,0.05)",
                      border:"1px solid rgba(0,191,255,0.1)",borderRadius:4,padding:"2px 7px",letterSpacing:0.3}}>{s}</span>
                  ))}
                </div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.12)",letterSpacing:1}}>
                  {beach.lat}°S · {Math.abs(beach.lon)}°E · Auto-refresh 5min · Tides: harmonic model (indicative)
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav className="bottom-nav">
        {TABS.map(t=>(
          <button key={t.id} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}>
            <span className="nav-icon">{t.icon}</span>
            <span className="nav-label">{t.l.toUpperCase()}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DiveCheckMode
// ═══════════════════════════════════════════════════════════════════════════════
function DiveCheckMode({ setMode, hideHeader=false, setHeaderMeta, onReady }) {
  const [site, setSite]               = useState(() => SITES.find(s => s.id === safeRead("bc_dive_site", SITES[0].id)) || SITES[0]);
  const [data, setData]               = useState(null);
  const [hourly, setHourly]           = useState(null);
  const [liveSst, setLiveSst]         = useState(null);
  const [satelliteViz, setSatelliteViz] = useState(null); // Copernicus KD490 result
  const [loading, setLoading]         = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [err, setErr]                 = useState(null);
  const [tab, setTab]                 = useStoredState("bc_dive_tab", "now");
  const [filter, setFilter]           = useStoredState("bc_dive_filter", "All");
  const [showPicker, setShowPicker]   = useStoredState("bc_dive_picker", false);
  const [now, setNow]                 = useState(new Date());
  const [lastRef, setLastRef]         = useState(null);
  const [favs, setFavs]               = useStoredState("bc_dive_favs", ["millers","oudekraal","langebaan"]);
  const [showDiveSettings, setShowDiveSettings] = useState(false);
  const [showDiveScoreInfo, setShowDiveScoreInfo] = useState(false);
  const [diveChecklistDone, setDiveChecklistDone] = useStoredState("bc_dive_checklist", {});
  const [isRefreshingDive, setIsRefreshingDive] = useState(false);
  const [units, setUnits] = useStoredState("bc_units", { height:"m", temp:"C", speed:"kmh", pressure:"bar" });
  const hr = now.getHours();
  const siteList = SITES.filter(s => filter==="All" || s.side===filter);

  const fetchData = useCallback(async (s, silent=false) => {
    silent ? setRefreshing(true) : (setLoading(true), setErr(null), setData(null));
    try {
      const cHr = new Date().getHours();
      const [mr, wr, sr] = await Promise.all([
        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${s.lat}&longitude=${s.lon}&current=wave_height,wave_period,wave_direction&hourly=wave_height,wave_period,wave_direction&timezone=Africa%2FJohannesburg&forecast_days=3`),
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,uv_index&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,wind_gusts_10m&timezone=Africa%2FJohannesburg&forecast_days=3`),
        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${s.lat}&longitude=${s.lon}&hourly=sea_surface_temperature&timezone=Africa%2FJohannesburg&forecast_days=1`).catch(()=>null),
      ]);
      // Copernicus KD490 satellite visibility — fire in parallel, don't block on failure
      fetch(`/api/visibility?lat=${s.lat}&lon=${s.lon}`)
        .then(r => r.json())
        .then(d => { if (d.est && !d.error) setSatelliteViz(d); else setSatelliteViz(null); })
        .catch(() => setSatelliteViz(null));
      const m=await mr.json(), w=await wr.json(), ss=sr?await sr.json().catch(()=>null):null;
      const ws  = w.current?.wind_speed_10m  ?? w.hourly?.wind_speed_10m?.[cHr]  ?? 0;
      const wd  = w.current?.wind_direction_10m ?? w.hourly?.wind_direction_10m?.[cHr] ?? 0;
      const tmp = w.current?.temperature_2m  ?? w.hourly?.temperature_2m?.[cHr]  ?? 0;
      const wg  = w.hourly?.wind_gusts_10m?.[cHr] ?? ws * 1.3;
      const sst = ss?.hourly?.sea_surface_temperature?.[cHr] ?? null;
      setLiveSst(sst ? Math.round(sst*10)/10 : null);
      const wt  = sst ? Math.round(sst*10)/10 : MONTH_TEMP[new Date().getMonth()];
      const tc  = tide48(new Date());
      const tl  = tc[cHr]?.h ?? 0.82;
      const allH = tc.map(t=>t.h), mid = (Math.max(...allH)+Math.min(...allH))/2;
      const tn  = tc[Math.min(cHr+1,47)]?.h ?? tl;
      const ts  = tl>tn+0.02?(tl>mid?"High — Falling ↓":"Falling ↓"):tl<tn-0.02?(tl<mid?"Low — Rising ↑":"Rising ↑"):tl>mid?"High Tide":"Low Tide";
      const wh  = m.current?.wave_height  ?? m.hourly?.wave_height?.[cHr]  ?? 0;
      const sp  = m.current?.wave_period  ?? m.hourly?.wave_period?.[cHr]  ?? 0;
      const wdir= m.current?.wave_direction ?? m.hourly?.wave_direction?.[cHr] ?? 0;
      const h48 = {
        wave_height:    [...(m.hourly?.wave_height    ?? [])],
        wave_period:    [...(m.hourly?.wave_period    ?? [])],
        wind_speed_10m: [...(w.hourly?.wind_speed_10m ?? [])],
        wind_direction_10m: [...(w.hourly?.wind_direction_10m ?? [])],
      };
      setHourly(h48);
      // Calculate best dive window (next 24h)
      let bestDiveScore = -1, bestDiveHour = cHr, bestDiveEnd = Math.min(cHr+2, 47);
      for (let i = cHr; i < Math.min(cHr+23, 46); i++) {
        const hwh = h48.wave_height?.[i] ?? 0;
        const hws = h48.wind_speed_10m?.[i] ?? 0;
        const hsp = h48.wave_period?.[i] ?? 0;
        const htc = tc[i]?.h ?? 0.82;
        const hts = htc > (tc[Math.min(i+1,47)]?.h ?? htc) + 0.02 ? "Falling" : "Rising";
        const dv = diveVerdict(hwh, hws, hsp, htc);
        // Score: GO=3, CAUTION=1, NO-GO=0; bonus for slack tide, morning hours
        let ds = dv.verdict==="GO" ? 3 : dv.verdict==="CAUTION" ? 1 : 0;
        if (Math.abs(htc - (tc[Math.min(i+1,47)]?.h ?? htc)) < 0.05) ds += 1; // slack tide bonus
        if (i >= 6 && i <= 10) ds += 1; // morning bonus
        if (ds > bestDiveScore) { bestDiveScore = ds; bestDiveHour = i; bestDiveEnd = Math.min(i+2, 47); }
      }
      setData({ wh, sp, wdir, ws, wd, wg, tmp, tl, ts, tides:tc, wt, wc:deg2c(wd), wvc:deg2c(wdir), bestDiveHour, bestDiveEnd, bestDiveScore });
      setLastRef(new Date());
      setNow(new Date());
    } catch {
      if (!silent) setErr("Couldn't load conditions. Check connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(()=>{fetchData(site);},[site,fetchData]);
  useEffect(()=>{
    const t=setInterval(()=>fetchData(site,true),300000);
    return ()=>clearInterval(t);
  },[site,fetchData]);
  useEffect(()=>{
    const t=setInterval(()=>setNow(new Date()),30000);
    return ()=>clearInterval(t);
  },[]);
  useEffect(()=>{
    let m=document.querySelector('meta[name="viewport"]');
    if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
    m.content='width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover';
    document.documentElement.style.overflowX='hidden';
    document.body.style.overflowX='hidden';
  },[]);


  useEffect(()=>{
    safeWrite("bc_dive_site", site.id);
  },[site]);

  useEffect(()=>{
    const badges = [];
    if (MPA_SITES.includes(site.id)) badges.push("MPA");
    if (site.entryType.includes("Boat")) badges.push("BOAT");
    badges.push(site.side);
    setHeaderMeta?.({
      title: site.name,
      badges,
      refreshing,
      lastRef,
    });
  },[site, refreshing, lastRef, setHeaderMeta]);

  useEffect(()=>{
    if(data && !loading) onReady?.();
  },[data, loading, onReady]);

  const verdict = data ? diveVerdict(data.wh, data.ws, data.sp, data.tl) : null;
  // Visibility: prefer Copernicus satellite KD490 data, fallback to inference model
  const vis = data
    ? (satelliteViz ?? visibilityEstimate(data.wh, data.ws, data.sp, data.wdir, site, hr, new Date().getMonth()))
    : null;
  const visSource = satelliteViz ? "satellite" : "model";
  const current = data ? currentStrength(data.wh, data.tl, data.ts) : null;
  const suit    = data ? diveWetsuit(data.wt) : null;

  // Unit conversion helpers (shared key "bc_units" with surf mode)
  const fmtHeight = v => units.height==="ft" ? `${(v*3.281).toFixed(1)}ft` : `${Number(v).toFixed(1)}m`;
  const fmtTemp = v => units.temp==="F" ? `${Math.round(Number(v)*9/5+32)}°F` : `${Math.round(Number(v))}°C`;
  const fmtSpeed = v => units.speed==="kts" ? `${Math.round(Number(v)*0.540)}kts` : `${Math.round(Number(v))}km/h`;

  const handleDivePullRefresh = async () => {
    if (isRefreshingDive || refreshing) return;
    setIsRefreshingDive(true);
    await fetchData(site, true);
    setIsRefreshingDive(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        html { overflow-x:hidden; -webkit-text-size-adjust:100%; }
        body { background:#020910; overflow-x:hidden; width:100%; max-width:100vw; overscroll-behavior-x:none; }
        ::-webkit-scrollbar { width:2px; height:2px; }
        ::-webkit-scrollbar-thumb { background:rgba(0,229,204,0.15); border-radius:2px; }
        button { cursor:pointer; border:none; background:none; font-family:inherit; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
        button:focus-visible { outline:2px solid #00e5cc; outline-offset:2px; }

        @keyframes rise   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes shimmer{ 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes bubbleUp { 0%{transform:translateY(0) scale(1);opacity:0.6} 100%{transform:translateY(-120px) scale(0.4);opacity:0} }
        @keyframes sonarPing { 0%{transform:scale(0.8);opacity:0.8} 100%{transform:scale(2.2);opacity:0} }
        @keyframes verdictPop { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }

        .rise    { animation:rise 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }

        @keyframes skeletonPulse { 0%,100%{opacity:0.3} 50%{opacity:0.8} }
        .sk { background:rgba(0,229,204,0.06); border-radius:8px; animation:skeletonPulse 1.6s ease-in-out infinite; }
        .sk-hero { height:180px; border-radius:16px; }
        .sk-card { height:80px; border-radius:12px; }
        .shimmer { animation:shimmer 1.6s ease-in-out infinite; }
        .bubble { position:fixed; border-radius:50%; background:rgba(0,229,204,0.1); pointer-events:none; animation:bubbleUp 7s ease-in infinite; }

        .shell {
          min-height:100vh;
          background:
            radial-gradient(ellipse 100% 50% at 50% 100%, rgba(0,80,70,0.25) 0%, transparent 65%),
            radial-gradient(ellipse 80% 40% at 20% 60%, rgba(0,40,50,0.2) 0%, transparent 55%),
            linear-gradient(180deg, #020d0f 0%, #030f12 50%, #020b0d 100%);
          color:#e0f7f5;
          font-family:'JetBrains Mono',monospace;
          padding-bottom:60px;
          overflow-x:hidden;
          width:100%; max-width:100vw;
        }
        .shell::before {
          content:'';
          position:fixed; inset:0;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          opacity:0.018; pointer-events:none; z-index:0;
        }

        .hdr {
          position:sticky; top:0; z-index:100;
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          padding:10px 16px;
          background:rgba(2,13,15,0.94);
          backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
          border-bottom:1px solid rgba(0,229,204,0.1);
        }

        .mode-pill {
          display:flex; align-items:center;
          background:rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.07);
          border-radius:100px; padding:3px; gap:2px; flex-shrink:0;
        }
        .mode-btn {
          padding:5px 12px; border-radius:100px;
          font-family:'Orbitron',monospace;
          font-size:7.5px; letter-spacing:1px;
          transition:all 0.22s cubic-bezier(0.4,0,0.2,1); white-space:nowrap;
          border:1px solid transparent;
        }
        .mode-btn.surf-active {
          background:rgba(0,191,255,0.13); border-color:rgba(0,191,255,0.35); color:#7dd3fc;
        }
        .mode-btn.dive-active {
          background:rgba(0,229,204,0.13); border-color:rgba(0,229,204,0.35); color:#00e5cc;
        }
        .mode-btn.inactive { color:rgba(255,255,255,0.2); }
        .mode-btn.inactive:hover { color:rgba(255,255,255,0.45); }

        .page {
          width:100%; max-width:min(820px,100vw);
          margin:0 auto; padding:var(--page-top,16px) 14px calc(80px + env(safe-area-inset-bottom));
          overflow-x:hidden; position:relative; z-index:1;
        }

        .scroll-row { display:flex; gap:6px; overflow-x:auto; padding-bottom:2px; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
        .scroll-row::-webkit-scrollbar { display:none; }

        .tabs {
          display:flex; gap:1px;
          background:rgba(0,229,204,0.04);
          border:1px solid rgba(0,229,204,0.1);
          border-radius:10px; padding:3px;
          margin-bottom:var(--section-gap,14px);
        }
        .tab-btn {
          flex:1; padding:7px 0; border-radius:7px;
          font-family:'Orbitron',monospace; font-size:9px; letter-spacing:1px;
          color:rgba(0,229,204,0.3);
          transition:all 0.18s; text-align:center; white-space:nowrap; overflow:hidden;
        }
        .tab-btn.active {
          background:linear-gradient(135deg,rgba(0,229,204,0.18) 0%,rgba(0,100,90,0.12) 100%);
          color:#00e5cc;
          box-shadow:0 0 14px rgba(0,229,204,0.12), inset 0 1px 0 rgba(0,229,204,0.2);
          border:1px solid rgba(0,229,204,0.2);
        }
        .tab-btn:not(.active):hover { color:rgba(0,229,204,0.55); background:rgba(0,229,204,0.04); }

        .card {
          background:rgba(0,229,204,0.03);
          border:1px solid rgba(0,229,204,0.08);
          border-radius:12px; padding:14px;
          min-width:0; overflow:hidden;
        }
        .card-label {
          font-size:7.5px; letter-spacing:3px;
          color:rgba(0,229,204,0.35);
          text-transform:uppercase; margin-bottom:10px;
          font-family:'Orbitron',monospace;
        }

        .hero {
          border-radius:16px; padding:18px;
          position:relative; overflow:hidden; margin-bottom:10px;
        }

        .stat-grid {
          display:grid; grid-template-columns:1fr 1fr; gap:7px;
        }
        @media(min-width:480px){.stat-grid{grid-template-columns:repeat(3,1fr);}}
        @media(min-width:700px){.stat-grid{grid-template-columns:repeat(4,1fr);}}

        .stat-cell {
          background:rgba(0,229,204,0.03);
          border:1px solid rgba(0,229,204,0.07);
          border-radius:10px; padding:11px 12px; min-width:0;
        }
        /* ── TABS — hidden, replaced by bottom nav ── */
        .tabs { display:none; }

        /* ── BOTTOM NAV (dive teal theme) ── */
        .bottom-nav-dive {
          position:fixed; bottom:0; left:0; right:0; z-index:200;
          display:flex; align-items:stretch;
          background:rgba(2,13,15,0.97);
          backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
          border-top:1px solid rgba(0,229,204,0.12);
          padding-bottom:env(safe-area-inset-bottom);
        }
        .bottom-nav-dive button {
          flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:3px; padding:9px 0 8px;
          color:rgba(0,229,204,0.28);
          font-family:'Orbitron',monospace; font-size:8px; letter-spacing:0.5px;
          transition:all 0.18s; min-width:0; overflow:hidden;
        }
        .bottom-nav-dive button.active { color:#00e5cc; }
        .bottom-nav-dive button.active .nav-icon { filter:drop-shadow(0 0 6px rgba(0,229,204,0.6)); }
        .bottom-nav-dive button:active { transform:scale(0.92); }
        .nav-icon { font-size:17px; line-height:1; }
        .nav-label { font-size:7px; letter-spacing:1px; white-space:nowrap; }

        .card {
          background:rgba(0,229,204,0.03);
          border:1px solid rgba(0,229,204,0.08);
          border-radius:12px; padding:14px;
          min-width:0; overflow:hidden;
        }
        .card-label {
          font-size:9px; letter-spacing:2px;
          color:rgba(0,229,204,0.4);
          text-transform:uppercase; margin-bottom:10px;
          font-family:'Orbitron',monospace;
        }

        .hero {
          border-radius:16px; padding:18px;
          position:relative; overflow:hidden; margin-bottom:10px;
        }

        .stat-grid {
          display:grid; grid-template-columns:1fr 1fr; gap:7px;
        }
        @media(min-width:480px){.stat-grid{grid-template-columns:repeat(3,1fr);}}
        @media(min-width:700px){.stat-grid{grid-template-columns:repeat(4,1fr);}}

        .stat-cell {
          background:rgba(0,229,204,0.03);
          border:1px solid rgba(0,229,204,0.07);
          border-radius:10px; padding:11px 12px; min-width:0;
        }
        .stat-label { font-size:9px; letter-spacing:1.5px; color:rgba(0,229,204,0.35); text-transform:uppercase; margin-bottom:5px; font-family:'Orbitron',monospace; }
        .stat-value { font-family:'Orbitron',monospace; font-size:18px; color:#e0f7f5; line-height:1.05; }
        .stat-sub   { font-size:11px; color:rgba(0,229,204,0.4); margin-top:3px; line-height:1.3; }

        /* ── MODAL (dive themed) ── */
        .modal-overlay-d {
          position:fixed; inset:0; z-index:500;
          background:rgba(0,0,0,0.75);
          backdrop-filter:blur(6px);
          display:flex; align-items:flex-end; justify-content:center;
        }
        .modal-sheet-d {
          width:100%; max-width:820px;
          background:#030f12;
          border:1px solid rgba(0,229,204,0.15);
          border-bottom:none;
          border-radius:20px 20px 0 0;
          padding:20px 18px calc(32px + env(safe-area-inset-bottom));
          animation:rise 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .modal-handle-d {
          width:36px; height:4px; background:rgba(0,229,204,0.2);
          border-radius:2px; margin:0 auto 18px;
        }

        /* ── INTERACTIVE CHECKLIST ── */
        .check-item-d { transition:opacity 0.2s; }
        .check-item-d.done { opacity:0.4; }
        .check-box-d {
          width:20px; height:20px; border-radius:6px; border:1.5px solid rgba(0,229,204,0.2);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
          transition:all 0.18s; font-size:11px;
        }
        .check-box-d.checked { background:rgba(0,229,204,0.12); border-color:rgba(0,229,204,0.5); }

        @keyframes spinCw { to{transform:rotate(360deg)} }
        .refresh-spinning { animation:spinCw 0.8s linear infinite; display:inline-block; }

        /* Ambient wave background */
        .wave-bg { position:fixed; bottom:0; left:0; width:100%; height:160px; pointer-events:none; z-index:0; opacity:0.035; }
        .wave1 { animation:waveBg1 20s linear infinite; }
        .wave2 { animation:waveBg2 15s linear infinite; }
        .wave3 { animation:waveBg3 28s linear infinite; }

        /* Sonar ping on verdict */
        .sonar-ring {
          position:absolute; border-radius:50%;
          border:1px solid currentColor;
          animation:sonarPing 2.5s ease-out infinite;
          pointer-events:none;
        }
      `}</style>

      {/* Bubble particles */}
      {[...Array(6)].map((_,i)=>(
        <div key={i} className="bubble" style={{
          width:4+i*2,height:4+i*2,
          left:`${10+i*14}%`, bottom:`${5+i*8}%`,
          animationDelay:`${i*1.1}s`, animationDuration:`${5+i*1.5}s`
        }}/>
      ))}

      {/* Ambient waves */}
      <svg className="wave-bg" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <g className="wave1">
          <path d="M0,80 C200,35 400,120 600,80 C800,40 1000,120 1200,80 C1400,40 1600,120 1800,80 C2000,40 2200,120 2400,80 L2400,160 L0,160Z" fill="#00e5cc"/>
        </g>
        <g className="wave2">
          <path d="M0,100 C240,65 480,130 720,100 C960,70 1200,130 1440,100 C1680,70 1920,130 2160,100 L2160,160 L0,160Z" fill="#006655" opacity="0.6"/>
        </g>
        <g className="wave3">
          <path d="M0,125 C180,105 360,145 540,125 C720,105 900,145 1080,125 C1260,105 1440,145 1620,125 L1620,160 L0,160Z" fill="#004433" opacity="0.4"/>
        </g>
      </svg>

      {/* Dive Settings Modal */}
      {showDiveSettings && (
        <div className="modal-overlay-d" onClick={()=>setShowDiveSettings(false)}>
          <div className="modal-sheet-d" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle-d"/>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,letterSpacing:2,color:"#00e5cc",marginBottom:18}}>⚙ SETTINGS</div>
            {[
              { label:"DEPTH/HEIGHT UNITS", key:"height", opts:[{v:"m",l:"Metres (m)"},{v:"ft",l:"Feet (ft)"}] },
              { label:"TEMPERATURE", key:"temp", opts:[{v:"C",l:"Celsius (°C)"},{v:"F",l:"Fahrenheit (°F)"}] },
              { label:"WIND SPEED", key:"speed", opts:[{v:"kmh",l:"km/h"},{v:"kts",l:"Knots"}] },
              { label:"TANK PRESSURE", key:"pressure", opts:[{v:"bar",l:"Bar"},{v:"psi",l:"PSI"}] },
            ].map(({label,key,opts})=>(
              <div key={key} style={{marginBottom:16}}>
                <div style={{fontSize:9,color:"rgba(0,229,204,0.4)",letterSpacing:2,fontFamily:"'Orbitron',monospace",marginBottom:8}}>{label}</div>
                <div style={{display:"flex",gap:6}}>
                  {opts.map(({v,l})=>(
                    <button key={v} onClick={()=>setUnits(u=>({...u,[key]:v}))}
                      style={{flex:1,padding:"10px",borderRadius:10,fontSize:12,
                        background:units[key]===v?"rgba(0,229,204,0.1)":"rgba(0,229,204,0.03)",
                        border:`1px solid ${units[key]===v?"rgba(0,229,204,0.4)":"rgba(0,229,204,0.08)"}`,
                        color:units[key]===v?"#00e5cc":"rgba(0,229,204,0.4)"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button onClick={()=>setShowDiveSettings(false)}
              style={{width:"100%",padding:"12px",borderRadius:10,marginTop:4,
                background:"rgba(0,229,204,0.08)",border:"1px solid rgba(0,229,204,0.2)",
                color:"#00e5cc",fontSize:11,fontFamily:"'Orbitron',monospace",letterSpacing:2}}>
              DONE
            </button>
          </div>
        </div>
      )}

      {/* Dive Score/Verdict Info Modal */}
      {showDiveScoreInfo && (
        <div className="modal-overlay-d" onClick={()=>setShowDiveScoreInfo(false)}>
          <div className="modal-sheet-d" onClick={e=>e.stopPropagation()}>
            <div className="modal-handle-d"/>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,letterSpacing:2,color:"#00e5cc",marginBottom:16}}>HOW IS THE DIVE VERDICT CALCULATED?</div>
            <p style={{fontSize:12,color:"rgba(0,229,204,0.5)",lineHeight:1.7,marginBottom:14}}>
              The dive verdict (GO / CAUTION / NO-GO) is based on four conditions:
            </p>
            {[
              {factor:"Swell height",thresh:"≤ 1.0m = ✓",desc:"Larger swell reduces visibility and increases surge at entries"},
              {factor:"Wind speed",thresh:"≤ 15 km/h = ✓",desc:"High surface wind churns up sediment and makes entries dangerous"},
              {factor:"Swell period",thresh:"≤ 10s = ✓",desc:"Short period wind-swell is choppier and more disruptive than groundswell"},
              {factor:"Tide height",thresh:"0.6–1.8m = ✓",desc:"Very low or very high tides increase surge and current risk"},
            ].map(({factor,thresh,desc})=>(
              <div key={factor} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(0,229,204,0.06)"}}>
                <div style={{width:80,flexShrink:0}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:9,color:"#00ff9d",letterSpacing:0.5}}>{thresh}</div>
                </div>
                <div>
                  <div style={{fontSize:12,color:"rgba(0,229,204,0.8)",marginBottom:2}}>{factor}</div>
                  <div style={{fontSize:11,color:"rgba(0,229,204,0.4)",lineHeight:1.5}}>{desc}</div>
                </div>
              </div>
            ))}
            <p style={{fontSize:11,color:"rgba(0,229,204,0.3)",marginTop:12,lineHeight:1.6}}>
              4/4 conditions met = GO · 2–3/4 = CAUTION · Fewer than 2 = NO-GO. Visibility and current are displayed separately as they depend on additional local factors.
            </p>
            <button onClick={()=>setShowDiveScoreInfo(false)}
              style={{width:"100%",padding:"12px",borderRadius:10,marginTop:16,
                background:"rgba(0,229,204,0.08)",border:"1px solid rgba(0,229,204,0.2)",
                color:"#00e5cc",fontSize:11,fontFamily:"'Orbitron',monospace",letterSpacing:2}}>
              GOT IT
            </button>
          </div>
        </div>
      )}

      <div className="shell" style={{position:"relative",zIndex:1}}>

        {/* ── HEADER ── */}
        <div className="hdr" style={hideHeader ? {display:"none"} : undefined}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
            <div style={{width:32,height:32,borderRadius:8,
              background:"linear-gradient(135deg,rgba(0,60,55,0.6),rgba(0,229,204,0.25))",
              border:"1px solid rgba(0,229,204,0.22)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🤿</div>
            <div style={{minWidth:0}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,letterSpacing:3,lineHeight:1,color:"#fff"}}>DIVECHECK</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"rgba(0,229,204,0.5)",letterSpacing:2}}>CAPE TOWN</span>
                {(refreshing||isRefreshingDive)
                  ? <span className="shimmer" style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#00e5cc",letterSpacing:1}}>· SYNCING</span>
                  : lastRef && <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"rgba(255,255,255,0.2)",letterSpacing:1}}>· ↻ {Math.floor((now-lastRef)/60000)<1?"just now":Math.floor((now-lastRef)/60000)+"m ago"}</span>
                }
              </div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <button onClick={handleDivePullRefresh} title="Refresh"
              style={{width:30,height:30,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
                background:"rgba(0,229,204,0.04)",border:"1px solid rgba(0,229,204,0.1)",
                fontSize:14,color:"rgba(0,229,204,0.4)"}}>
              <span className={isRefreshingDive?"refresh-spinning":""}>↻</span>
            </button>
            <button onClick={()=>setShowDiveSettings(true)} title="Settings"
              style={{width:30,height:30,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
                background:"rgba(0,229,204,0.04)",border:"1px solid rgba(0,229,204,0.1)",
                fontSize:14,color:"rgba(0,229,204,0.4)"}}>
              ⚙
            </button>
            <div className="mode-pill">
              <button className="mode-btn inactive" onClick={()=>setMode("surf")}>🌊 SURF</button>
              <button className="mode-btn dive-active" onClick={()=>setMode("dive")}>🤿 DIVE</button>
            </div>
          </div>
        </div>

        <div className="page">

          {/* ── SITE SELECTOR ── */}
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:8,minHeight:34}}>
              <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0,flex:1,overflow:"hidden"}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:17,letterSpacing:0.8,color:"#fff",lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>
                  {site.name}
                </div>
                {MPA_SITES.includes(site.id) && (
                  <span style={{fontSize:9,color:"#00ff9d",background:"rgba(0,255,157,0.08)",
                    border:"1px solid rgba(0,255,157,0.25)",borderRadius:20,padding:"2px 7px",
                    letterSpacing:1.5,flexShrink:0}}>MPA</span>
                )}
                {site.entryType.includes("Boat") && (
                  <span style={{fontSize:9,color:"#ffb300",background:"rgba(255,179,0,0.08)",
                    border:"1px solid rgba(255,179,0,0.2)",borderRadius:20,padding:"2px 7px",
                    letterSpacing:1,flexShrink:0}}>⛵</span>
                )}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>setFavs(p=>p.includes(site.id)?p.filter(x=>x!==site.id):[...p,site.id])}
                  style={{fontSize:13,color:favs.includes(site.id)?"#ffb300":"rgba(0,229,204,0.2)",transition:"color 0.2s"}}>
                  {favs.includes(site.id)?"★":"☆"}
                </button>
                <button onClick={()=>setShowPicker(p=>!p)}
                  style={{padding:"5px 12px",borderRadius:20,fontSize:8,letterSpacing:2,
                    background:showPicker?"rgba(0,229,204,0.1)":"rgba(0,229,204,0.04)",
                    border:`1px solid ${showPicker?"rgba(0,229,204,0.3)":"rgba(0,229,204,0.1)"}`,
                    color:showPicker?"#00e5cc":"rgba(0,229,204,0.4)",
                    fontFamily:"'Orbitron',monospace",fontSize:7}}>
                  {showPicker?"CLOSE":"CHANGE"}
                </button>
              </div>
            </div>

            {showPicker && (
              <div style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,229,204,0.1)",borderRadius:12,padding:"12px",marginBottom:8}}>
                <div className="scroll-row" style={{marginBottom:8}}>
                  {DIVE_SIDES.map(s=>(
                    <button key={s} onClick={()=>setFilter(s)}
                      style={{flexShrink:0,padding:"4px 12px",borderRadius:100,fontSize:7.5,letterSpacing:2,
                        fontFamily:"'Orbitron',monospace",transition:"all 0.15s",
                        background:filter===s?"rgba(0,229,204,0.1)":"rgba(0,229,204,0.03)",
                        border:`1px solid ${filter===s?"rgba(0,229,204,0.35)":"rgba(0,229,204,0.08)"}`,
                        color:filter===s?"#00e5cc":"rgba(0,229,204,0.35)"}}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="scroll-row">
                  {siteList.map(s=>(
                    <button key={s.id} onClick={()=>{setSite(s);setShowPicker(false);}}
                      style={{flexShrink:0,padding:"6px 14px",borderRadius:100,
                        fontFamily:"'Orbitron',monospace",fontSize:9,letterSpacing:1,whiteSpace:"nowrap",
                        transition:"all 0.15s",
                        background:site.id===s.id?"rgba(0,229,204,0.1)":"rgba(0,229,204,0.03)",
                        border:`1px solid ${site.id===s.id?"rgba(0,229,204,0.4)":"rgba(0,229,204,0.08)"}`,
                        color:site.id===s.id?"#00e5cc":"rgba(0,229,204,0.45)"}}>
                      {s.name}{favs.includes(s.id)?" ★":""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── LOADING ── */}
          {loading && (
            <div style={{display:"flex",flexDirection:"column",gap:9,padding:"4px 0"}}>
              <div className="sk sk-hero"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                <div className="sk sk-card"/>
                <div className="sk sk-card"/>
              </div>
              <div className="sk" style={{height:80,borderRadius:12}}/>
              <div style={{display:"flex",gap:6}}>
                {[1,2,3].map(i=><div key={i} className="sk" style={{flex:1,height:28,borderRadius:20}}/>)}
              </div>
            </div>
          )}
          {err && (
            <div style={{background:"rgba(255,68,68,0.06)",border:"1px solid rgba(255,68,68,0.2)",
              borderRadius:10,padding:"12px 16px",color:"#ff8888",fontSize:11,marginBottom:12}}>
              ⚠ {err}
            </div>
          )}

          {/* ── CONTENT ── */}
          {data && !loading && (
            <div className="rise">
              <div className="tabs">
                {DIVE_TABS.map(t=>(
                  <button key={t.id} className={`tab-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* ════════ NOW ════════ */}
              {tab==="now" && (
                <div style={{display:"flex",flexDirection:"column",gap:9}}>

                  {/* DIVE COMPUTER HERO */}
                  <div className="hero" style={{
                    background:`linear-gradient(135deg,${verdict.color}10 0%,${verdict.color}04 45%,transparent 70%),linear-gradient(220deg,rgba(0,10,12,0.7) 0%,transparent 55%)`,
                    border:`1px solid ${verdict.color}30`,
                    boxShadow:`0 4px 40px ${verdict.color}0a,inset 0 1px 0 ${verdict.color}12`
                  }}>
                    {/* Corner glow */}
                    <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,
                      background:`radial-gradient(${verdict.color}18,transparent 70%)`,pointerEvents:"none"}}/>

                    {/* Sonar ring on GO */}
                    {verdict.verdict==="GO" && (
                      <div className="sonar-ring" style={{
                        width:60,height:60,top:18,right:18,color:verdict.color
                      }}/>
                    )}

                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{fontSize:9,color:"rgba(0,229,204,0.35)",letterSpacing:3,
                        fontFamily:"'Orbitron',monospace"}}>
                        DIVE CONDITIONS — {site.name.toUpperCase()}
                      </div>
                      <button onClick={()=>setShowDiveScoreInfo(true)}
                        style={{width:22,height:22,borderRadius:"50%",fontSize:11,
                          background:"rgba(0,229,204,0.06)",border:"1px solid rgba(0,229,204,0.15)",
                          color:"rgba(0,229,204,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        ⓘ
                      </button>
                    </div>

                    {/* Verdict */}
                    <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
                      <span style={{fontSize:38,flexShrink:0,lineHeight:1}}>{verdict.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:"'Orbitron',monospace",
                          fontSize:"clamp(26px,7vw,42px)",lineHeight:1,fontWeight:700,
                          color:verdict.color,textShadow:`0 0 30px ${verdict.color}50`,
                          letterSpacing:2}}>
                          {verdict.verdict}
                        </div>
                        <div style={{fontSize:12,color:"rgba(0,229,204,0.5)",marginTop:5,lineHeight:1.4}}>
                          {verdict.sub}
                        </div>
                      </div>
                    </div>

                    {/* Depth rings row — key dive metrics */}
                    <div style={{display:"flex",justifyContent:"space-around",alignItems:"flex-start",
                      padding:"12px 0",borderTop:`1px solid ${verdict.color}15`,
                      borderBottom:`1px solid ${verdict.color}15`,marginBottom:12}}>
                      <DepthRing value={fmtHeight(data.wh)} max={3} color={data.wh<1?"#00ff9d":data.wh<2?"#ffb300":"#ff4444"} label="SWELL" unit={units.height==="ft"?"ft":"m"} size={76}/>
                      <DepthRing value={Math.round(data.ws)} max={50} color={data.ws<15?"#00ff9d":data.ws<25?"#ffb300":"#ff4444"} label="WIND" unit={units.speed==="kts"?"kts":"km/h"} size={76}/>
                      <DepthRing value={fmtTemp(data.wt).replace("°C","").replace("°F","")} max={units.temp==="F"?70:25} color={data.wt>=16?"#fde68a":data.wt>=14?"#6ee7b7":"#93c5fd"} label="WATER" unit={units.temp==="F"?"°F":"°C"} size={76}/>
                      <DepthRing value={data.tl.toFixed(1)} max={2} color="#00e5cc" label="TIDE" unit="m" size={76}/>
                    </div>

                    {/* Best dive window */}
                    {data.bestDiveHour !== undefined && (
                      <div style={{marginBottom:12,padding:"8px 12px",borderRadius:10,
                        background:"rgba(0,229,204,0.05)",border:"1px solid rgba(0,229,204,0.12)"}}>
                        <div style={{fontSize:9,color:"rgba(0,229,204,0.4)",letterSpacing:2,fontFamily:"'Orbitron',monospace",marginBottom:3}}>⏱ BEST DIVE WINDOW</div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,color:"#00e5cc",letterSpacing:2}}>
                          {data.bestDiveHour<24?`${String(data.bestDiveHour).padStart(2,"0")}:00`:`+${data.bestDiveHour-24}h`}
                          {" – "}
                          {data.bestDiveEnd<24?`${String(data.bestDiveEnd).padStart(2,"0")}:00`:`+${data.bestDiveEnd-24}h`}
                        </div>
                      </div>
                    )}

                    {/* Condition pills */}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {[
                        {l:`${vis.est} viz`, icon:"👁", c:vis.color},
                        {l:current.level+" current", icon:"🌀", c:current.color},
                        {l:`${data.wc} ${fmtSpeed(data.ws)}`, icon:"💨", c:data.ws<15?"#00ff9d":data.ws<25?"#ffb300":"#ff4444"},
                        {l:data.ts, icon:"🌊", c:"#00e5cc"},
                        {l:site.entryType.split("—")[0].trim(), icon:"🪨", c:"rgba(0,229,204,0.7)"},
                      ].map((p,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:5,
                          background:`${p.c}0e`,border:`1px solid ${p.c}28`,
                          borderRadius:20,padding:"5px 10px"}}>
                          <span style={{fontSize:11}}>{p.icon}</span>
                          <span style={{fontSize:11,color:p.c,letterSpacing:0.3,fontFamily:"'JetBrains Mono',monospace"}}>{p.l}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* QUICK STATS ROW */}
                  <div style={{display:"flex",gap:7}}>
                    <div style={{flex:1,background:"rgba(0,229,204,0.03)",border:"1px solid rgba(0,229,204,0.1)",borderRadius:11,padding:"12px 14px"}}>
                      <div className="card-label">💨 WIND</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <WindCompass deg={data.wd} size={42} color={data.ws<15?"#00ff9d":data.ws<25?"#ffb300":"#ff4444"}/>
                        <div style={{minWidth:0}}>
                          <div style={{fontFamily:"'Orbitron',monospace",fontSize:15,
                            color:data.ws<15?"#00ff9d":data.ws<25?"#ffb300":"#ff4444"}}>
                            {data.ws.toFixed(0)}<span style={{fontSize:9,opacity:0.6}}> km/h</span>
                          </div>
                          <div style={{fontSize:8,color:"rgba(0,229,204,0.35)",marginTop:1}}>
                            {data.wc} · Gusts {data.wg.toFixed(0)}km/h
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{flex:1,background:"rgba(0,229,204,0.03)",border:"1px solid rgba(0,229,204,0.1)",borderRadius:11,padding:"12px 14px"}}>
                      <div className="card-label">🌊 SWELL</div>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,color:"#e0f7f5",marginBottom:3}}>
                        {data.wh.toFixed(1)}<span style={{fontSize:10,opacity:0.5}}>m</span>
                      </div>
                      <div style={{fontSize:8,color:"rgba(0,229,204,0.35)"}}>
                        {data.sp.toFixed(0)}s · {data.wvc}
                      </div>
                    </div>
                  </div>

                  {/* VISIBILITY + CURRENT */}
                  <div style={{display:"flex",gap:7}}>
                    <div style={{flex:1,background:`${vis.color}08`,border:`1px solid ${vis.color}20`,borderRadius:11,padding:"12px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                        <div className="card-label" style={{color:`${vis.color}60`,marginBottom:0}}>👁 VISIBILITY</div>
                        <span style={{fontSize:6.5,letterSpacing:1,padding:"2px 6px",borderRadius:10,
                          background: visSource==="satellite" ? "rgba(0,255,157,0.1)" : "rgba(255,179,0,0.08)",
                          border: `1px solid ${visSource==="satellite" ? "rgba(0,255,157,0.3)" : "rgba(255,179,0,0.2)"}`,
                          color: visSource==="satellite" ? "#00ff9d" : "#ffb300",
                          fontFamily:"'Orbitron',monospace"}}>
                          {visSource==="satellite" ? "🛰 SAT" : "~ MODEL"}
                        </span>
                      </div>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:20,color:vis.color,lineHeight:1}}>{vis.est}</div>
                      <div style={{fontSize:8,color:"rgba(0,229,204,0.3)",marginTop:4}}>
                        {visSource==="satellite"
                          ? `KD490 ${satelliteViz?.kd490}m⁻¹ · ${satelliteViz?.date ?? "today"}`
                          : `${vis.quality} · swell-based estimate`}
                      </div>
                    </div>
                    <div style={{flex:1,background:`${current.color}08`,border:`1px solid ${current.color}20`,borderRadius:11,padding:"12px 14px"}}>
                      <div className="card-label" style={{color:`${current.color}60`}}>🌀 CURRENT</div>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:20,color:current.color,lineHeight:1}}>{current.level}</div>
                      <div style={{fontSize:8,color:"rgba(0,229,204,0.3)",marginTop:4}}>{current.tip}</div>
                    </div>
                  </div>

                  {/* SITE NOTES */}
                  <div className="card">
                    <div className="card-label">📍 SITE NOTES — {site.name.toUpperCase()}</div>
                    <p style={{fontSize:11,color:"rgba(0,229,204,0.5)",lineHeight:1.65,marginBottom:10}}>{site.char}</p>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                      <span style={{fontSize:8,color:"#00e5cc",background:"rgba(0,229,204,0.07)",border:"1px solid rgba(0,229,204,0.15)",borderRadius:20,padding:"3px 9px",letterSpacing:1}}>
                        ⬇ {site.maxDepth}m MAX
                      </span>
                      <span style={{fontSize:8,color:"#00e5cc",background:"rgba(0,229,204,0.07)",border:"1px solid rgba(0,229,204,0.15)",borderRadius:20,padding:"3px 9px",letterSpacing:1}}>
                        🪨 {site.entryType}
                      </span>
                      <span style={{fontSize:8,color:"#00e5cc",background:"rgba(0,229,204,0.07)",border:"1px solid rgba(0,229,204,0.15)",borderRadius:20,padding:"3px 9px",letterSpacing:1}}>
                        🌊 {site.bestTide}
                      </span>
                      {MPA_SITES.includes(site.id) && (
                        <span style={{fontSize:8,color:"#00ff9d",background:"rgba(0,255,157,0.07)",border:"1px solid rgba(0,255,157,0.2)",borderRadius:20,padding:"3px 9px",letterSpacing:1}}>
                          🌿 MPA — No Take
                        </span>
                      )}
                    </div>
                    <div className="card-label" style={{marginBottom:6}}>SPECIES</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {site.species.map((sp,i)=>(
                        <span key={i} style={{fontSize:8,color:"rgba(0,229,204,0.55)",background:"rgba(0,229,204,0.04)",
                          border:"1px solid rgba(0,229,204,0.1)",borderRadius:20,padding:"3px 9px"}}>
                          {sp}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* ════════ FORECAST ════════ */}
              {tab==="forecast" && (
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div>
                    <div className="card-label">NEXT 12 HOURS</div>
                    <DForecastStrip hourly={hourly} curHour={hr}/>
                  </div>

                  {/* 5 day */}
                  <div>
                    <div className="card-label">5-DAY OUTLOOK</div>
                    <div style={{display:"flex",gap:6}}>
                      {Array.from({length:5},(_,d)=>{
                        const DNAMES=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
                        const lbl=d===0?"Today":d===1?"Tmrw":DNAMES[(now.getDay()+d)%7];
                        const avgWh = Array.from({length:24},(_,h)=>hourly.wave_height?.[d*24+h]??0).reduce((a,b)=>a+b,0)/24;
                        const avgWs = Array.from({length:24},(_,h)=>hourly.wind_speed_10m?.[d*24+h]??0).reduce((a,b)=>a+b,0)/24;
                        const v = diveVerdict(avgWh, avgWs, 8, 1.0);
                        return (
                          <div key={d} style={{flex:"1 1 0",minWidth:0,
                            background:d===0?"rgba(0,229,204,0.05)":"rgba(0,229,204,0.02)",
                            border:`1px solid ${d===0?"rgba(0,229,204,0.2)":"rgba(0,229,204,0.07)"}`,
                            borderRadius:10,padding:"12px 6px",textAlign:"center"}}>
                            <div style={{fontSize:7.5,color:d===0?"#00e5cc":"rgba(0,229,204,0.3)",marginBottom:7,letterSpacing:1,fontFamily:"'Orbitron',monospace"}}>
                              {lbl.toUpperCase()}
                            </div>
                            <div style={{fontSize:16,marginBottom:4}}>{v.icon}</div>
                            <div style={{fontFamily:"'Orbitron',monospace",fontSize:9,color:v.color,letterSpacing:1}}>
                              {v.verdict}
                            </div>
                            <div style={{fontSize:8,color:"rgba(0,229,204,0.3)",marginTop:3}}>
                              {avgWh.toFixed(1)}m avg
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-label">⚠️ NOTE ON VISIBILITY</div>
                    <p style={{fontSize:10.5,color:"rgba(0,229,204,0.45)",lineHeight:1.6}}>
                      Visibility estimates are derived from swell height and period only. Actual viz depends on
                      kelp, currents, river runoff, and algae bloom — none of which are forecast-able in real time.
                      Chlorophyll satellite data (historic only) available via{" "}
                      <span style={{color:"#00e5cc"}}>CMEMS copernicus.eu</span>.
                      Always assess on the day.
                    </p>
                  </div>
                </div>
              )}

              {/* ════════ TIDES ════════ */}
              {tab==="tides" && (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div className="card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <span className="card-label" style={{color:"rgba(0,229,204,0.5)",margin:0}}>48H TIDE CURVE</span>
                      <span style={{fontSize:8,color:"#00ff9d",letterSpacing:1.5}}>HARMONIC ✓</span>
                    </div>
                    <DTideChart curve={data.tides} curHour={hr}/>
                  </div>

                  <div className="card-label" style={{marginTop:4}}>HIGHS & LOWS</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {tideExtremes(data.tides).slice(0,6).map((e,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                        background:"rgba(0,229,204,0.03)",border:"1px solid rgba(0,229,204,0.08)",
                        borderRadius:10,padding:"12px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:18}}>{e.type==="High"?"🌊":"🏖️"}</span>
                          <div>
                            <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,
                              color:e.type==="High"?"#00e5cc":"#ffb300",letterSpacing:1}}>
                              {e.type} Tide
                            </div>
                            <div style={{fontSize:8,color:"rgba(0,229,204,0.3)",marginTop:2}}>
                              {e.hour<24?`${String(e.hour).padStart(2,"0")}:00`:`Tomorrow ${String(e.hour-24).padStart(2,"0")}:00`}
                            </div>
                          </div>
                        </div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:20,color:"#e0f7f5"}}>
                          {e.h.toFixed(2)}<span style={{fontSize:10,color:"rgba(0,229,204,0.35)"}}>m</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="card" style={{background:"rgba(0,229,204,0.03)"}}>
                    <div className="card-label">💡 DIVE & TIDE</div>
                    <p style={{fontSize:10.5,color:"rgba(0,229,204,0.45)",lineHeight:1.65}}>
                      Best diving is typically at <span style={{color:"#00e5cc"}}>high slack water</span> — 
                      silt has settled, surge is minimal, and marine life is active.
                      Avoid the last two hours of an ebb tide at exposed sites — strong outflow increases current and stirs sediment.
                    </p>
                  </div>
                </div>
              )}

              {/* ════════ SITES ════════ */}
              {tab==="sites" && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{fontSize:8,color:"rgba(0,229,204,0.3)",letterSpacing:2,marginBottom:4,fontFamily:"'Orbitron',monospace"}}>
                    ALL CAPE TOWN DIVE SITES
                  </div>

                  {/* MPA note */}
                  <div style={{background:"rgba(0,255,157,0.05)",border:"1px solid rgba(0,255,157,0.15)",
                    borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                    <span style={{fontSize:16}}>🌿</span>
                    <div style={{fontSize:9,color:"rgba(0,255,157,0.7)",lineHeight:1.5}}>
                      <strong style={{color:"#00ff9d"}}>MPA sites</strong> — Marine Protected Areas. No removal of any species. Spearfishing prohibited.
                      Check <span style={{color:"#00ff9d"}}>dffe.gov.za</span> for current regulations.
                    </div>
                  </div>

                  {SIDES.filter(s=>s!=="All").map(side=>(
                    <div key={side}>
                      <div className="card-label" style={{marginTop:8,marginBottom:6}}>{side.toUpperCase()}</div>
                      {SITES.filter(s=>s.side===side).map(s=>{
                        const isActive = s.id === site.id;
                        return (
                          <button key={s.id} onClick={()=>{setSite(s);setTab("now");}}
                            style={{display:"flex",alignItems:"center",gap:12,width:"100%",
                              background:isActive?"rgba(0,229,204,0.07)":"rgba(0,229,204,0.02)",
                              border:`1px solid ${isActive?"rgba(0,229,204,0.3)":"rgba(0,229,204,0.06)"}`,
                              borderRadius:10,padding:"11px 14px",textAlign:"left",cursor:"pointer",
                              transition:"all 0.15s",marginBottom:5}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                                <span style={{fontSize:11,color:isActive?"#00e5cc":"rgba(0,229,204,0.7)",
                                  fontFamily:"'Orbitron',monospace",letterSpacing:0.5}}>{s.name}</span>
                                {s.mpa && <span style={{fontSize:6.5,color:"#00ff9d",border:"1px solid rgba(0,255,157,0.3)",borderRadius:10,padding:"1px 6px",letterSpacing:1}}>MPA</span>}
                                {s.entryType.includes("Boat") && <span style={{fontSize:6.5,color:"#ffb300",border:"1px solid rgba(255,179,0,0.3)",borderRadius:10,padding:"1px 6px"}}>⛵</span>}
                              </div>
                              <div style={{fontSize:8,color:"rgba(0,229,204,0.35)",lineHeight:1.4}}>{s.char.slice(0,70)}…</div>
                            </div>
                            <div style={{flexShrink:0,textAlign:"right"}}>
                              <div style={{fontSize:9,color:"rgba(0,229,204,0.5)",fontFamily:"'Orbitron',monospace"}}>⬇{s.maxDepth}m</div>
                              {favs.includes(s.id) && <div style={{fontSize:10,color:"#ffb300",marginTop:2}}>★</div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}

                  {/* MPA map link */}
                  <div className="card" style={{marginTop:4}}>
                    <div className="card-label">🗺 MARINE PROTECTED AREAS</div>
                    <p style={{fontSize:10.5,color:"rgba(0,229,204,0.45)",lineHeight:1.6,marginBottom:8}}>
                      Full MPA boundary map for Cape Town waters:
                    </p>
                    <div style={{background:"rgba(0,229,204,0.06)",border:"1px solid rgba(0,229,204,0.15)",
                      borderRadius:8,padding:"10px 12px",fontSize:9,color:"#00e5cc",letterSpacing:1,
                      fontFamily:"'Orbitron',monospace",wordBreak:"break-all"}}>
                      maps.google.com → search "Cape Town Marine Protected Areas"
                    </div>
                    <p style={{fontSize:9,color:"rgba(0,229,204,0.3)",marginTop:8,lineHeight:1.5}}>
                      Or visit <span style={{color:"#00e5cc"}}>dffe.gov.za/mpa</span> for official boundaries and regulations.
                    </p>
                  </div>
                </div>
              )}

              {/* ════════ SAFETY ════════ */}
              {tab==="safety" && (
                <div style={{display:"flex",flexDirection:"column",gap:9}}>

                  {/* Current risk */}
                  <div style={{background:`${current.color}08`,border:`1px solid ${current.color}25`,borderRadius:12,padding:"14px"}}>
                    <div className="card-label">🌀 SURGE & CURRENT</div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:22,color:current.color,flexShrink:0}}>{current.level}</div>
                      <div style={{fontSize:10.5,color:"rgba(0,229,204,0.45)",lineHeight:1.5}}>{current.tip}</div>
                    </div>
                  </div>

                  {/* MPA warning if applicable */}
                  {MPA_SITES.includes(site.id) && (
                    <div style={{background:"rgba(0,255,157,0.06)",border:"1px solid rgba(0,255,157,0.25)",borderRadius:12,padding:"14px"}}>
                      <div className="card-label" style={{color:"rgba(0,255,157,0.5)"}}>🌿 MARINE PROTECTED AREA</div>
                      <p style={{fontSize:10.5,color:"rgba(0,229,204,0.45)",lineHeight:1.6}}>
                        <strong style={{color:"#00ff9d"}}>{site.name}</strong> is inside a Marine Protected Area.
                        Removal of any organism — including crayfish, fish, shells, or coral — is a criminal offence.
                        Spearfishing and collection strictly prohibited.
                      </p>
                    </div>
                  )}

                  {/* Boat entry warning */}
                  {site.entryType.includes("Boat") && (
                    <div style={{background:"rgba(255,179,0,0.06)",border:"1px solid rgba(255,179,0,0.25)",borderRadius:12,padding:"14px"}}>
                      <div className="card-label" style={{color:"rgba(255,179,0,0.5)"}}>⛵ BOAT ACCESS REQUIRED</div>
                      <p style={{fontSize:10.5,color:"rgba(0,229,204,0.45)",lineHeight:1.6}}>
                        {site.name} requires boat access. Arrange with a licensed Cape Town dive charter.
                        Ensure skipper has valid SAMSA certification and dive flag is deployed.
                      </p>
                    </div>
                  )}

                  {/* Bag & size limits */}
                  <div className="card">
                    <div className="card-label">📋 SPECIES & BAG LIMITS</div>
                    <p style={{fontSize:10.5,color:"rgba(0,229,204,0.45)",lineHeight:1.6,marginBottom:10}}>
                      Daily bag and size limits apply to recreational fishing and spearfishing in South Africa.
                      Limits change — always check the latest before you dive.
                    </p>
                    <div style={{background:"rgba(0,229,204,0.06)",border:"1px solid rgba(0,229,204,0.15)",
                      borderRadius:8,padding:"10px 12px"}}>
                      <div style={{fontSize:8,color:"rgba(0,229,204,0.5)",letterSpacing:2,marginBottom:6,fontFamily:"'Orbitron',monospace"}}>OFFICIAL SOURCES</div>
                      {[
                        {l:"DFFE Recreational Fishing Guide","u":"dalrrd.gov.za"},
                        {l:"SA Recreational Fishing App","u":"sarecfishing.co.za"},
                        {l:"Two Oceans Aquarium species ID","u":"aquarium.co.za"},
                      ].map((r,i)=>(
                        <div key={i} style={{fontSize:9,color:"#00e5cc",marginBottom:4,letterSpacing:0.5}}>
                          → {r.l} <span style={{color:"rgba(0,229,204,0.4)"}}>({r.u})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* General safety */}
                  <div className="card">
                    <div className="card-label">🛟 DIVE SAFETY</div>
                    {[
                      "Never dive alone — always use the buddy system",
                      "Check SADS dive flag regulations — flag must be visible",
                      "Log your dive plan with someone on shore",
                      "Cold Atlantic water: watch for cold shock and hypothermia",
                      "Kelp can disorient — stay calm, ascend slowly through gaps",
                      "NSRI emergency: 082 990 5922",
                    ].map((tip,i,arr)=>(
                      <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"7px 0",
                        borderBottom:i<arr.length-1?"1px solid rgba(0,229,204,0.05)":"none"}}>
                        <span style={{color:"#00e5cc",fontSize:10,flexShrink:0,marginTop:1}}>›</span>
                        <span style={{fontSize:10,color:"rgba(0,229,204,0.5)",lineHeight:1.5}}>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ════════ GEAR ════════ */}
              {tab==="gear" && (
                <div style={{display:"flex",flexDirection:"column",gap:9}}>

                  {/* Wetsuit */}
                  <div style={{background:`${suit.color}0d`,border:`1px solid ${suit.color}30`,borderRadius:14,padding:"16px"}}>
                    <div className="card-label">🤿 WETSUIT</div>
                    <div style={{display:"flex",alignItems:"center",gap:14}}>
                      <span style={{fontSize:42,flexShrink:0,lineHeight:1}}>{suit.icon}</span>
                      <div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,color:suit.color,letterSpacing:1,lineHeight:1.1}}>
                          {suit.suit}
                        </div>
                        <div style={{fontSize:9,color:"rgba(0,229,204,0.35)",marginTop:4}}>
                          Water {data.wt}°C {liveSst?"(live SST)":"(seasonal avg)"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cape Town specific wetsuit note */}
                  <div className="card">
                    <div className="card-label">🌡 CAPE TOWN WATER TEMPS</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {[
                        {season:"Summer (Dec–Feb)", temp:"17–19°C", suit:"3mm shorty or 5mm"},
                        {season:"Autumn (Mar–May)",  temp:"15–17°C", suit:"5mm full suit"},
                        {season:"Winter (Jun–Aug)",  temp:"13–15°C", suit:"5mm + hood"},
                        {season:"Spring (Sep–Nov)",  temp:"13–16°C", suit:"5mm full suit"},
                      ].map((r,i)=>(
                        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                          padding:"8px 0",borderBottom:i<3?"1px solid rgba(0,229,204,0.05)":"none"}}>
                          <div>
                            <div style={{fontSize:10,color:"rgba(0,229,204,0.7)"}}>{r.season}</div>
                            <div style={{fontSize:8,color:"rgba(0,229,204,0.35)",marginTop:2}}>{r.suit}</div>
                          </div>
                          <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,color:"#00e5cc"}}>{r.temp}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="card">
                    <div className="card-label">📋 PRE-DIVE CHECKLIST</div>
                    {[
                      {item:suit.suit, icon:suit.icon, show:true},
                      {item:"BCD fully inflated check", icon:"🫧", show:true},
                      {item:"Regulator breathing test", icon:"😮‍💨", show:true},
                      {item:`Tank pressure — 200+ ${units.pressure==="psi"?"(2900+ psi)":"bar"}`, icon:"🔴", show:true},
                      {item:"Weight belt / integrated weights", icon:"⚓", show:true},
                      {item:"Dive computer charged", icon:"⌚", show:true},
                      {item:"SMB + reel", icon:"🟠", show:true},
                      {item:"Dive knife or cutter", icon:"🔱", show:true},
                      {item:"Hood + gloves", icon:"🥶", show:data.wt<16},
                      {item:"Buddy check — BWRAF", icon:"🤝", show:true},
                      {item:"Dive flag deployed", icon:"🚩", show:true},
                    ].filter(g=>g.show).map((g,i,arr)=>(
                      <div key={i} className={`check-item-d${diveChecklistDone[`d_${i}`]?" done":""}`}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",
                          borderBottom:i<arr.length-1?"1px solid rgba(0,229,204,0.04)":"none"}}>
                        <span style={{fontSize:14,flexShrink:0,width:22,textAlign:"center"}}>{g.icon}</span>
                        <span style={{fontSize:11,color:"rgba(0,229,204,0.6)",flex:1,lineHeight:1.4}}>{g.item}</span>
                        <button onClick={()=>setDiveChecklistDone(p=>({...p,[`d_${i}`]:!p[`d_${i}`]}))}
                          className={`check-box-d${diveChecklistDone[`d_${i}`]?" checked":""}`}>
                          {diveChecklistDone[`d_${i}`]?"✓":""}
                        </button>
                      </div>
                    ))}
                    {Object.values(diveChecklistDone).some(Boolean) && (
                      <button onClick={()=>setDiveChecklistDone({})}
                        style={{width:"100%",marginTop:10,padding:"8px",borderRadius:8,
                          fontSize:10,color:"rgba(0,229,204,0.35)",
                          background:"rgba(0,229,204,0.03)",border:"1px solid rgba(0,229,204,0.08)"}}>
                        Reset checklist
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* FOOTER */}
              <div style={{marginTop:18,padding:"10px 14px",borderTop:"1px solid rgba(0,229,204,0.06)"}}>
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:5}}>
                  {["WAVES: Open-Meteo Marine","WIND: Open-Meteo","WATER: "+(liveSst?"🛰 Live SST":"📅 Seasonal"),"TIDES: Harmonic",
                    "VIZ: "+(satelliteViz?"🛰 Copernicus KD490":"Swell model")].map(s=>(
                    <span key={s} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"rgba(0,229,204,0.6)",background:"rgba(0,229,204,0.04)",
                      border:"1px solid rgba(0,229,204,0.1)",borderRadius:4,padding:"2px 7px",letterSpacing:0.3}}>{s}</span>
                  ))}
                </div>
                <div style={{fontSize:9,color:"rgba(0,229,204,0.15)",letterSpacing:1}}>
                  {site.lat}°S · {Math.abs(site.lon)}°E · Auto-refresh 5min · Conditions indicative only · Always dive with a buddy
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* ── DIVE BOTTOM NAV ── */}
      <nav className="bottom-nav-dive">
        {DIVE_TABS.map(t=>(
          <button key={t.id} className={tab===t.id?"active":""} onClick={()=>setTab(t.id)}>
            <span className="nav-icon">{t.id==="now"?"🤿":t.id==="forecast"?"📅":t.id==="tides"?"🌊":t.id==="sites"?"📍":t.id==="safety"?"🛟":"🧭"}</span>
            <span className="nav-label">{t.l.toUpperCase()}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [mode, setMode] = useStoredState("bc_mode", "surf");
  const [headerMeta, setHeaderMeta] = useState({});

  useEffect(() => {
    document.documentElement.style.setProperty("--page-top", "16px");
    document.documentElement.style.setProperty("--page-bottom", "18px");
    document.documentElement.style.setProperty("--section-gap", "14px");
  }, []);

  const restoreScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    const y = safeRead(`bc_scroll_${mode}`, 0) || 0;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "auto" });
    });
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const save = () => safeWrite(`bc_scroll_${mode}`, window.scrollY || window.pageYOffset || 0);
    const onScroll = () => save();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", save);
    const t = window.setTimeout(restoreScroll, 120);
    return () => {
      save();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("beforeunload", save);
      window.clearTimeout(t);
    };
  }, [mode, restoreScroll]);

  return (
    <div className="app-root-shell">
      <style>{`
        :root {
          --app-max: min(820px, 100vw);
          --shared-header-h: 68px;
          --page-top: 16px;
          --page-bottom: 18px;
          --section-gap: 14px;
        }
        #root { width:100%; max-width:none; margin:0; padding:0; text-align:left; }
        .app-root-shell { min-height:100vh; }
        .shared-hdr {
          position:sticky; top:0; z-index:999;
          height:var(--shared-header-h);
          display:flex; align-items:center; justify-content:space-between; gap:8px;
          padding:0 16px;
          background:rgba(2,9,16,0.94);
          backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
          border-bottom:1px solid rgba(255,255,255,0.05);
        }
        .shared-brand { font-family:'Orbitron',monospace; font-size:14px; font-weight:700; letter-spacing:3px; line-height:1; color:#fff; }
        .shared-location { font-family:'Orbitron',monospace; font-size:12px; letter-spacing:1.2px; color:rgba(255,255,255,0.92); line-height:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .shared-sub { font-family:'JetBrains Mono',monospace; font-size:6.5px; letter-spacing:2px; }
        .shared-badge { font-family:'JetBrains Mono',monospace; font-size:6.5px; letter-spacing:1.1px; border:1px solid; border-radius:999px; padding:2px 7px; }
        .shared-mode-pill { flex-shrink:0; }
        .mode-scene { will-change:opacity,transform; animation:modeSwap 160ms ease; }
        @keyframes modeSwap { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 520px) {
          .shared-hdr { padding:0 12px; }
          .shared-brand { font-size:12px; letter-spacing:2.2px; }
          .shared-location { font-size:10px; max-width:140px; }
          .shared-badge { font-size:6px; padding:2px 6px; }
        }
      `}</style>
      <SharedHeader mode={mode} setMode={setMode} meta={headerMeta} />
      <div className="mode-scene" key={mode}>
        {mode === "surf"
          ? <WaveCheckMode setMode={setMode} hideHeader={true} setHeaderMeta={setHeaderMeta} onReady={restoreScroll} />
          : <DiveCheckMode setMode={setMode} hideHeader={true} setHeaderMeta={setHeaderMeta} onReady={restoreScroll} />}
      </div>
    </div>
  );
}
