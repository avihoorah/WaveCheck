import { useState, useEffect, useCallback } from "react";

// ─── TIDE MODEL ───────────────────────────────────────────────────────────────
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

function wetsuit(wt,ws){ const c=wt-ws*0.3;
  if(c<10)return{suit:"5/4mm + Hood & Boots",icon:"🥶",color:"#60a5fa"};
  if(c<13)return{suit:"4/3mm Full Suit",icon:"🧊",color:"#93c5fd"};
  if(c<16)return{suit:"3/2mm Full Suit",icon:"🌊",color:"#6ee7b7"};
  if(c<19)return{suit:"Springsuit / Shorty",icon:"👙",color:"#fde68a"};
  return{suit:"Board Shorts",icon:"🏄",color:"#fca5a5"};
}

function ripRisk(beach,wh,tl,ts){
  const s=(ts.includes("Falling")||ts.includes("Low")?2:0)+(tl<1?2:0)+(wh>1.2?2:0)+(beach.rip?2:0);
  if(s>=6)return{level:"High",  color:"#f87171",icon:"⚠️", tip:"Strong rip likely. Check before paddling out."};
  if(s>=4)return{level:"Medium",color:"#fbbf24",icon:"⚡",  tip:"Some rip risk. Identify channels first."};
  return       {level:"Low",   color:"#4ade80",icon:"✅", tip:"Low rip risk today."};
}

function windState(beach,wc){
  if(beach.gw.includes(wc))return{s:"Offshore",  c:"#00ff87",i:"✅",sub:"Glassy faces"};
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
  if(sc>=80)return{e:"🔥",l:"Epic",c:"#00ff87"};
  if(sc>=60)return{e:"⚡",l:"Good",c:"#7fff6b"};
  if(sc>=40)return{e:"👌",l:"Fair",c:"#fbbf24"};
  return{e:"💤",l:"Poor",c:"#f87171"};
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

// ─── TINY COMPONENTS ──────────────────────────────────────────────────────────
function WindArrow({deg,size=60,color="#00bfff"}){
  return(
    <svg width={size} height={size} viewBox="0 0 60 60" style={{flexShrink:0,filter:`drop-shadow(0 0 5px ${color}60)`}}>
      <circle cx="30" cy="30" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
      {["N","E","S","W"].map((d,i)=>(
        <text key={d} x={30+20*Math.sin(i*Math.PI/2)} y={30-20*Math.cos(i*Math.PI/2)+3.5}
          textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace">{d}</text>
      ))}
      <g transform={`rotate(${deg},30,30)`}>
        <polygon points="30,6 33.5,35 30,32 26.5,35" fill={color}/>
        <polygon points="30,54 33.5,35 30,38 26.5,35" fill={`${color}25`}/>
      </g>
    </svg>
  );
}

function Ring({sc,color,size=72}){
  const r=28,circ=2*Math.PI*r;
  return(
    <svg width={size} height={size} viewBox="0 0 72 72" style={{flexShrink:0}}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5"/>
      <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ*(1-sc/100)}
        strokeLinecap="round" transform="rotate(-90 36 36)"
        style={{transition:"stroke-dashoffset 1s ease",filter:`drop-shadow(0 0 4px ${color})`}}/>
      <text x="36" y="41" textAnchor="middle" fill="#fff" fontSize="16" fontFamily="'Bebas Neue',sans-serif">{sc}</text>
    </svg>
  );
}

function Tag({children,color="#888"}){
  return <span style={{fontSize:9,color,background:`${color}18`,border:`1px solid ${color}35`,borderRadius:20,padding:"3px 9px",letterSpacing:1,whiteSpace:"nowrap"}}>{children}</span>;
}

function Stat({icon,label,value,unit,sub,hi}){
  return(
    <div style={{background:hi?"rgba(0,191,255,0.06)":"rgba(255,255,255,0.03)",border:`1px solid ${hi?"rgba(0,191,255,0.2)":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:"12px 14px"}}>
      <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>{icon} {label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:4,flexWrap:"wrap"}}>
        <span style={{fontSize:22,fontFamily:"'Bebas Neue',sans-serif",color:hi?"#00bfff":"#fff",lineHeight:1.1,wordBreak:"break-word"}}>{value}</span>
        {unit&&<span style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>{unit}</span>}
      </div>
      {sub&&<div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:3,lineHeight:1.3}}>{sub}</div>}
    </div>
  );
}

// ─── TIDE SVG ─────────────────────────────────────────────────────────────────
function TideChart({curve,curHour}){
  const hts=curve.map(p=>p.h), mn=Math.min(...hts), mx=Math.max(...hts);
  const W=600,H=80;
  const sx=i=>(i/(curve.length-1))*W, sy=v=>H-4-((v-mn)/(mx-mn))*(H-12);
  const pts=curve.map((p,i)=>`${sx(i)},${sy(p.h)}`).join(" ");
  const ext=tideExtremes(curve);
  return(
    <div style={{width:"100%",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
      <svg viewBox={`0 0 ${W} ${H+22}`} style={{display:"block",minWidth:280,width:"100%",height:"auto"}}>
        <defs>
          <linearGradient id="tg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00bfff" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#00bfff" stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {[0,6,12,18,24,30,36,42,48].map(h=>(
          <g key={h}>
            <line x1={sx(h)} y1={0} x2={sx(h)} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <text x={sx(h)+2} y={H+14} fill="rgba(255,255,255,0.22)" fontSize="7" fontFamily="monospace">{h<24?`${String(h).padStart(2,"0")}h`:`+${h-24}h`}</text>
          </g>
        ))}
        <line x1={sx(24)} y1={0} x2={sx(24)} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,2"/>
        <text x={sx(24)+3} y={H+14} fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="monospace">Tomorrow</text>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#tg2)"/>
        <polyline points={pts} fill="none" stroke="#00bfff" strokeWidth="1.5" strokeLinejoin="round"/>
        {ext.slice(0,8).map((e,i)=>(
          <g key={i}>
            <circle cx={sx(e.hour)} cy={sy(e.h)} r="2.5" fill={e.type==="High"?"#00bfff":"#0055aa"}/>
            <text x={sx(e.hour)} y={e.type==="High"?sy(e.h)-6:sy(e.h)+13} textAnchor="middle"
              fill={e.type==="High"?"#00bfff":"#5588cc"} fontSize="6.5" fontFamily="monospace">{e.h.toFixed(1)}m</text>
          </g>
        ))}
        {curHour<curve.length&&(
          <>
            <line x1={sx(curHour)} y1={0} x2={sx(curHour)} y2={H} stroke="#00ff87" strokeWidth="1.5" strokeDasharray="3,2"/>
            <text x={sx(curHour)+3} y={9} fill="#00ff87" fontSize="6.5" fontFamily="monospace">NOW</text>
          </>
        )}
      </svg>
    </div>
  );
}

// ─── SWELL SVG ────────────────────────────────────────────────────────────────
function SwellChart({hourly,curHour}){
  if(!hourly)return null;
  const W=600,H=70;
  const data=Array.from({length:48},(_,i)=>({i,wh:hourly.wave_height?.[i]??0}));
  const mx=Math.max(...data.map(d=>d.wh),0.5);
  const sx=i=>(i/47)*W, sy=v=>H-4-(v/mx)*(H-12);
  const pts=data.map(d=>`${sx(d.i)},${sy(d.wh)}`).join(" ");
  return(
    <div style={{width:"100%",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
      <svg viewBox={`0 0 ${W} ${H+22}`} style={{display:"block",minWidth:280,width:"100%",height:"auto"}}>
        <defs>
          <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {[0,6,12,18,24,30,36,42,48].map(h=>(
          <g key={h}>
            <line x1={sx(h)} y1={0} x2={sx(h)} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <text x={sx(h)+2} y={H+14} fill="rgba(255,255,255,0.22)" fontSize="7" fontFamily="monospace">{h<24?`${String(h).padStart(2,"0")}h`:`+${h-24}h`}</text>
          </g>
        ))}
        <line x1={sx(24)} y1={0} x2={sx(24)} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,2"/>
        <text x={sx(24)+3} y={H+14} fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="monospace">Tomorrow</text>
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg2)"/>
        <polyline points={pts} fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinejoin="round"/>
        {data.filter((_,i)=>i%6===0).map((d,i)=>(
          <text key={i} x={sx(d.i)} y={sy(d.wh)-5} textAnchor="middle"
            fill="rgba(167,139,250,0.7)" fontSize="6.5" fontFamily="monospace">{d.wh.toFixed(1)}m</text>
        ))}
        {curHour<48&&<line x1={sx(curHour)} y1={0} x2={sx(curHour)} y2={H} stroke="#00ff87" strokeWidth="1.5" strokeDasharray="3,2"/>}
      </svg>
    </div>
  );
}

// ─── FORECAST STRIP ───────────────────────────────────────────────────────────
function ForecastStrip({hourly,curHour,beach}){
  if(!hourly)return null;
  const hours=Array.from({length:12},(_,i)=>curHour+i).filter(h=>h<48);
  return(
    <div style={{display:"flex",gap:7,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4}}>
      {hours.map(h=>{
        const sc=score(hourly.wave_height?.[h]??0,hourly.wave_period?.[h]??0,hourly.wind_speed_10m?.[h]??0,hourly.wind_direction_10m?.[h]??0,beach);
        const r=rating(sc); const now=h===curHour;
        return(
          <div key={h} style={{flexShrink:0,minWidth:68,background:now?"rgba(0,191,255,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${now?"rgba(0,191,255,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
            <div style={{fontSize:9,color:now?"#00bfff":"rgba(255,255,255,0.3)",marginBottom:4}}>{h<24?`${String(h).padStart(2,"0")}:00`:`+${h-24}h`}</div>
            <div style={{fontSize:16,marginBottom:2}}>{r.e}</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:r.c}}>{(hourly.wave_height?.[h]??0).toFixed(1)}m</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.25)"}}>{(hourly.wave_period?.[h]??0).toFixed(0)}s</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── WEEK OUTLOOK ─────────────────────────────────────────────────────────────
function WeekOutlook({hourly,beach}){
  if(!hourly)return null;
  const now=new Date();
  const days=Array.from({length:5},(_,d)=>{
    const best=Math.max(...Array.from({length:24},(_,h)=>score(hourly.wave_height?.[d*24+h]??0,hourly.wave_period?.[d*24+h]??0,hourly.wind_speed_10m?.[d*24+h]??0,hourly.wind_direction_10m?.[d*24+h]??0,beach)));
    return{d,best};
  });
  const DNAMES=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return(
    <div style={{display:"flex",gap:7,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:4}}>
      {days.map((d,i)=>{
        const r=rating(d.best), lbl=i===0?"Today":i===1?"Tmrw":DNAMES[(now.getDay()+i)%7];
        return(
          <div key={i} style={{flex:"1 1 60px",minWidth:60,flexShrink:0,background:"rgba(255,255,255,0.03)",border:`1px solid ${i===0?"rgba(0,191,255,0.3)":"rgba(255,255,255,0.07)"}`,borderRadius:10,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontSize:9,color:i===0?"#00bfff":"rgba(255,255,255,0.3)",marginBottom:6,letterSpacing:1}}>{lbl.toUpperCase()}</div>
            <div style={{fontSize:20,marginBottom:3}}>{r.e}</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:12,color:r.c,letterSpacing:1}}>{r.l.toUpperCase()}</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.2)",marginTop:2}}>peak {d.best}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [beach,setBeach]=useState(BEACHES[0]);
  const [favs,setFavs]=useState(["muizenberg","bigbay","llandudno"]);
  const [data,setData]=useState(null);
  const [hourly,setHourly]=useState(null);
  const [liveSst,setLiveSst]=useState(null);
  const [loading,setLoading]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [err,setErr]=useState(null);
  const [tab,setTab]=useState("now");
  const [filter,setFilter]=useState("All");
  const [lastRef,setLastRef]=useState(null);
  const [now,setNow]=useState(new Date());
  const hr=now.getHours();

  const fetchData=useCallback(async(b,silent=false)=>{
    silent?setRefreshing(true):(setLoading(true),setErr(null),setData(null));
    try{
      const cHr=new Date().getHours();
      const[mr,wr,sr]=await Promise.all([
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
      const h48={wave_height:[...(m.hourly?.wave_height??[])],wave_period:[...(m.hourly?.wave_period??[])],wind_speed_10m:[...(w.hourly?.wind_speed_10m??[])],wind_direction_10m:[...(w.hourly?.wind_direction_10m??[])]};
      setHourly(h48);
      let bsc=-1,bst=cHr,ben=Math.min(cHr+2,47);
      for(let i=cHr;i<Math.min(cHr+23,46);i++){const sc2=score(h48.wave_height[i]??0,h48.wave_period?.[i]??0,h48.wind_speed_10m[i]??0,h48.wind_direction_10m[i]??0,b);if(sc2>bsc){bsc=sc2;bst=i;ben=Math.min(i+2,47);}}
      setData({wh:m.current?.wave_height??m.hourly?.wave_height?.[cHr]??0,sp:m.current?.wave_period??m.hourly?.wave_period?.[cHr]??0,waveDir:m.current?.wave_direction??m.hourly?.wave_direction?.[cHr]??0,ws,wd,tmp,cld,rain,uv,tl,ts,tides:tc,wt,suit:wetsuit(wt,ws),bst,ben,bsc,sc:score(m.hourly?.wave_height?.[cHr]??0,m.hourly?.wave_period?.[cHr]??0,ws,wd,b)});
      setLastRef(new Date()); setNow(new Date());
    }catch{if(!silent)setErr("Couldn't load conditions. Check your connection.");}
    finally{setLoading(false);setRefreshing(false);}
  },[]);

  useEffect(()=>{fetchData(beach);},[beach,fetchData]);
  useEffect(()=>{const t=setInterval(()=>fetchData(beach,true),60000);return()=>clearInterval(t);},[beach,fetchData]);

  const wc=data?deg2c(data.wd):"—";
  const wvc=data?deg2c(data.waveDir):"—";
  const ws=data?windState(beach,wc):null;
  const fmt=h=>h<24?`${String(h).padStart(2,"0")}:00`:`+${h-24}h`;
  const sides=["All","False Bay","Atlantic","West Coast","Peninsula"];
  const beachList=BEACHES.filter(b=>filter==="All"||b.side===filter);
  const TABS=[{id:"now",l:"Now"},{id:"forecast",l:"Forecast"},{id:"tides",l:"Tides"},{id:"safety",l:"Safety"},{id:"gear",l:"Gear"}];

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:ital,wght@0,400;0,700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#050c16;overflow-x:hidden;-webkit-text-size-adjust:100%}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:4px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fp{0%,100%{opacity:0.3}50%{opacity:1}}
        .up{animation:up .3s ease forwards}
        .ld{animation:pulse 2s infinite}
        .rf{animation:fp 1s infinite}
        button{cursor:pointer;border:none;background:none;font-family:inherit}
        button:focus-visible{outline:2px solid #00bfff;outline-offset:2px}

        /* ── layout ── */
        .shell{min-height:100vh;background:linear-gradient(160deg,#050c16 0%,#081828 55%,#040f1c 100%);color:#fff;font-family:'Space Mono',monospace;padding-bottom:48px;position:relative;overflow:hidden}
        .hdr{position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px;background:rgba(5,12,22,0.92);backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,0.05)}
        .page{width:100%;max-width:800px;margin:0 auto;padding:14px 12px}
        @media(min-width:600px){.page{padding:20px 24px}}

        /* ── beach selector ── */
        .side-row{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch}
        .side-row::-webkit-scrollbar{display:none}
        .beach-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;align-items:flex-start}
        .beach-row::-webkit-scrollbar{display:none}

        /* ── tabs ── */
        .tabs{display:flex;gap:3px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:3px;margin-bottom:14px}
        .tab{flex:1;padding:8px 2px;border-radius:9px;font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:1.5px;transition:all .2s;color:rgba(255,255,255,0.3)}
        .tab.on{background:rgba(0,191,255,0.15);color:#00bfff}

        /* ── stat grid ── */
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        @media(min-width:520px){.grid2{grid-template-columns:repeat(3,1fr)}}
        @media(min-width:720px){.grid2{grid-template-columns:repeat(4,1fr)}}

        /* ── card ── */
        .card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px 16px}

        /* ── decision ── */
        .dec{border-radius:16px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden}

        /* ── wave bg ── */
        @keyframes wa1{to{transform:translateX(-50%)}}
        @keyframes wa2{from{transform:translateX(-50%)}to{transform:translateX(0)}}
        .wbg{position:fixed;bottom:0;left:0;width:100%;height:180px;pointer-events:none;z-index:0;opacity:.05}
        .ww1{animation:wa1 16s linear infinite}
        .ww2{animation:wa2 11s linear infinite}
      `}</style>

      {/* wave bg */}
      <svg className="wbg" viewBox="0 0 1440 180" preserveAspectRatio="none">
        <g className="ww1"><path d="M0,100 C180,50 360,150 540,100 C720,50 900,150 1080,100 C1260,50 1440,150 1620,100 C1800,50 1980,150 2160,100 L2160,180 L0,180Z" fill="#00bfff"/></g>
        <g className="ww2"><path d="M0,130 C200,80 400,170 600,130 C800,90 1000,170 1200,130 C1400,90 1600,170 1800,130 L1800,180 L0,180Z" fill="#0070ff" opacity=".5"/></g>
      </svg>

      <div className="shell" style={{position:"relative",zIndex:1}}>

        {/* HEADER */}
        <div className="hdr">
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
            <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#00bfff,#0055ff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0,boxShadow:"0 0 16px rgba(0,191,255,0.35)"}}>🌊</div>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:21,letterSpacing:4,lineHeight:1}}>WAVECHECK</div>
              <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:2}}>CAPE TOWN · LIVE</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {refreshing&&<span className="rf" style={{fontSize:8,color:"#00bfff",letterSpacing:1}}>SYNC</span>}
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div className="ld" style={{width:6,height:6,borderRadius:"50%",background:"#00ff87"}}/>
              <span style={{fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:2}}>LIVE</span>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"rgba(255,255,255,0.6)",letterSpacing:1}}>{now.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</div>
              {lastRef&&<div style={{fontSize:7,color:"rgba(255,255,255,0.2)"}}>↻{lastRef.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</div>}
            </div>
          </div>
        </div>

        <div className="page">

          {/* BEACH SELECTOR */}
          <div style={{marginBottom:16}}>
            {/* side filters */}
            <div className="side-row" style={{marginBottom:8}}>
              {sides.map(s=>(
                <button key={s} onClick={()=>setFilter(s)} style={{flexShrink:0,padding:"5px 12px",borderRadius:100,fontSize:9,letterSpacing:2,fontFamily:"'Space Mono',monospace",transition:"all .2s",background:filter===s?"rgba(0,191,255,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${filter===s?"rgba(0,191,255,0.4)":"rgba(255,255,255,0.08)"}`,color:filter===s?"#00bfff":"rgba(255,255,255,0.4)"}}>{s.toUpperCase()}</button>
              ))}
            </div>
            {/* beach pills */}
            <div className="beach-row">
              {beachList.map(b=>(
                <div key={b.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
                  <button onClick={()=>setBeach(b)} style={{padding:"7px 14px",borderRadius:100,fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,whiteSpace:"nowrap",transition:"all .2s",background:beach.id===b.id?"rgba(0,191,255,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${beach.id===b.id?"rgba(0,191,255,0.5)":"rgba(255,255,255,0.08)"}`,color:beach.id===b.id?"#00bfff":"rgba(255,255,255,0.5)",boxShadow:beach.id===b.id?"0 0 12px rgba(0,191,255,0.2)":"none"}}>
                    {b.name}{favs.includes(b.id)?" ★":""}
                  </button>
                  <span style={{fontSize:8,color:LVL_COLOR[b.level]??"#888",letterSpacing:1}}>{b.level.toUpperCase()}</span>
                </div>
              ))}
            </div>
            {/* info row */}
            <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
              <Tag color={LVL_COLOR[beach.level]??"#888"}>{beach.level.toUpperCase()}</Tag>
              <Tag color="#5588aa">{beach.side}</Tag>
              {beach.rip&&<Tag color="#fbbf24">⚡ Rip-prone</Tag>}
              {beach.kelp&&<Tag color="#a78bfa">🌿 Kelp</Tag>}
              {SHARK.includes(beach.id)&&<Tag color="#f87171">🦈 Shark Spotters</Tag>}
              <button onClick={()=>setFavs(p=>p.includes(beach.id)?p.filter(x=>x!==beach.id):[...p,beach.id])} style={{marginLeft:"auto",fontSize:12,color:favs.includes(beach.id)?"#fbbf24":"rgba(255,255,255,0.25)",transition:"color .2s"}}>
                {favs.includes(beach.id)?"★ Saved":"☆ Save"}
              </button>
            </div>
          </div>

          {/* LOADING */}
          {loading&&(
            <div style={{textAlign:"center",padding:"56px 0",color:"rgba(255,255,255,0.25)"}}>
              <div style={{fontSize:32,display:"inline-block",animation:"spin 1.4s linear infinite",marginBottom:12}}>🌊</div>
              <div style={{fontSize:10,letterSpacing:4}}>FETCHING CONDITIONS…</div>
            </div>
          )}
          {err&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:10,padding:"12px 16px",color:"#fca5a5",fontSize:11}}>⚠ {err}</div>}

          {/* CONTENT */}
          {data&&!loading&&(
            <div className="up">

              {/* TABS */}
              <div className="tabs">
                {TABS.map(t=>(
                  <button key={t.id} className={`tab${tab===t.id?" on":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>
                ))}
              </div>

              {/* ══ NOW ══ */}
              {tab==="now"&&(()=>{
                const rip=ripRisk(beach,data.wh,data.tl,data.ts);
                const wst=windState(beach,wc);
                const goCount=[wst.s!=="Onshore",data.tl>0.6&&data.tl<1.7,data.wh>=beach.iw[0]*.7&&data.wh<=beach.iw[1]*1.3,data.ws<28].filter(Boolean).length;
                let dec,emoji,color,reason;
                if(goCount>=3&&data.sc>=55){dec="PADDLE OUT";emoji="🤙";color="#00ff87";reason="Conditions are firing. Don't miss this.";}
                else if(goCount>=2&&data.sc>=38){dec="WORTH IT";emoji="👍";color="#fbbf24";reason=[wst.s==="Onshore"?"Onshore wind":null,data.wh<beach.iw[0]*.7?"Below ideal size":null,data.wh>beach.iw[1]*1.3?"Above ideal size":null].filter(Boolean).join(" · ")||"Decent session ahead.";}
                else{dec="STAY HOME";emoji="🛋️";color="#f87171";reason=data.wh<0.4?"Flat as a lake.":data.ws>30?"Howling onshore.":"Multiple factors against you.";}
                const r=rating(data.sc);
                return(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {/* decision */}
                    <div className="dec" style={{background:`${color}0f`,border:`2px solid ${color}40`}}>
                      <div style={{position:"absolute",top:-30,right:-30,width:130,height:130,background:`radial-gradient(${color}20,transparent 70%)`,pointerEvents:"none"}}/>
                      <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:8}}>SHOULD YOU SURF?</div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <span style={{fontSize:36,flexShrink:0}}>{emoji}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color,lineHeight:1,letterSpacing:2}}>{dec}</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.45)",marginTop:3,lineHeight:1.4}}>{reason}</div>
                        </div>
                        <Ring sc={data.sc} color={r.c} size={68}/>
                      </div>
                    </div>

                    {/* best session */}
                    <div style={{background:"rgba(0,191,255,0.05)",border:"1px solid rgba(0,191,255,0.18)",borderRadius:12,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                      <div>
                        <div style={{fontSize:9,color:"rgba(0,191,255,0.6)",letterSpacing:3,marginBottom:3}}>⏱ BEST SESSION</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#00bfff",letterSpacing:2}}>{fmt(data.bst)} – {fmt(data.ben)}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.25)",letterSpacing:2,marginBottom:3}}>RATING</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:rating(data.bsc).c,letterSpacing:2}}>{rating(data.bsc).e} {rating(data.bsc).l.toUpperCase()}</div>
                      </div>
                    </div>

                    {/* stats */}
                    <div className="grid2">
                      <Stat icon="🌊" label="Wave Height" value={data.wh.toFixed(1)} unit="m"
                        sub={data.wh>=beach.iw[0]&&data.wh<=beach.iw[1]?"In ideal range ✓":`Ideal ${beach.iw[0]}–${beach.iw[1]}m`} hi/>
                      <Stat icon="⏱" label="Swell Period" value={data.sp.toFixed(0)} unit="sec"
                        sub={data.sp>=12?"Long — quality":data.sp>=8?"Medium":"Short — bumpy"}/>
                      <Stat icon="💨" label="Wind" value={data.ws.toFixed(0)} unit="km/h" sub={`${wc} — ${wst.s}`}/>
                      <Stat icon="🧭" label="Swell Dir" value={wvc} sub={`${data.waveDir.toFixed(0)}°`}/>
                      <Stat icon="🌤" label="Air Temp" value={data.tmp.toFixed(0)} unit="°C" sub={`Cloud ${data.cld}%`}/>
                      <Stat icon="🌊" label="Water Temp" value={data.wt} unit="°C" sub={liveSst?"Live SST ✓":"Seasonal avg"} hi={!!liveSst}/>
                      <Stat icon="🔆" label="UV" value={data.uv?.toFixed(0)??"-"} sub={data.uv>=8?"Very High 🔥":data.uv>=5?"Mod — SPF 30+":"Low"}/>
                      <Stat icon="🌧" label="Rain" value={data.rain} unit="%" sub={data.rain>60?"Pack a towel":"Likely dry"}/>
                      <Stat icon="🌙" label="Tide" value={data.tl.toFixed(2)} unit="m" sub={data.ts} hi/>
                      <Stat icon={rip.icon} label="Rip Risk" value={rip.level} sub={rip.tip.slice(0,38)+"…"}/>
                    </div>

                    {/* wind card */}
                    <div className="card" style={{display:"flex",alignItems:"center",gap:14}}>
                      <WindArrow deg={data.wd} size={58} color={wst.c}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:3}}>WIND DIRECTION</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,lineHeight:1}}>{wc}</div>
                        <div style={{fontSize:10,color:wst.c,marginTop:3}}>{wst.i} {wst.s} — {wst.sub}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:2,marginBottom:3}}>SWELL FROM</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,lineHeight:1}}>{wvc}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:3}}>{data.waveDir.toFixed(0)}°</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ══ FORECAST ══ */}
              {tab==="forecast"&&(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:10}}>📅 5-DAY OUTLOOK</div>
                    <WeekOutlook hourly={hourly} beach={beach}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:10}}>NEXT 12 HOURS</div>
                    <ForecastStrip hourly={hourly} curHour={hr} beach={beach}/>
                  </div>
                  <div className="card">
                    <div style={{fontSize:9,color:"rgba(167,139,250,0.8)",letterSpacing:3,marginBottom:12}}>📈 48H WAVE HEIGHT</div>
                    <SwellChart hourly={hourly} curHour={hr}/>
                  </div>
                </div>
              )}

              {/* ══ TIDES ══ */}
              {tab==="tides"&&(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div className="card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <span style={{fontSize:9,color:"rgba(0,191,255,0.7)",letterSpacing:3}}>🌙 48H TIDES</span>
                      <span style={{fontSize:8,color:"#00ff87",letterSpacing:1}}>Harmonic ✓</span>
                    </div>
                    <TideChart curve={data.tides} curHour={hr}/>
                  </div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:6}}>HIGHS & LOWS</div>
                  {tideExtremes(data.tides).slice(0,6).map((e,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"12px 14px",marginBottom:7}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:16}}>{e.type==="High"?"🌊":"🏖️"}</span>
                        <div>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:e.type==="High"?"#00bfff":"#fbbf24",letterSpacing:2}}>{e.type} Tide</div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>{e.hour<24?`${String(e.hour).padStart(2,"0")}:00`:`Tomorrow ${String(e.hour-24).padStart(2,"0")}:00`}</div>
                        </div>
                      </div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:"#fff"}}>{e.h.toFixed(2)}m</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ══ SAFETY ══ */}
              {tab==="safety"&&(()=>{
                const rip=ripRisk(beach,data.wh,data.tl,data.ts);
                return(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{background:`${rip.color}10`,border:`1px solid ${rip.color}40`,borderRadius:12,padding:"14px 16px"}}>
                      <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:8}}>⚠️ RIP CURRENT RISK</div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:rip.color,flexShrink:0,letterSpacing:2}}>{rip.level}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.4}}>{rip.tip}</div>
                      </div>
                    </div>
                    {SHARK.includes(beach.id)&&(
                      <div style={{background:"rgba(248,113,113,0.07)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,padding:"14px 16px"}}>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:8}}>🦈 SHARK SPOTTERS — FALSE BAY</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>This beach is in the SA Shark Spotters programme. Check <span style={{color:"#f87171"}}>sharkspotters.org.za</span> for today's flag colour before paddling out. <strong style={{color:"#fca5a5"}}>Never surf alone.</strong></div>
                      </div>
                    )}
                    {beach.kelp&&(
                      <div style={{background:"rgba(167,139,250,0.07)",border:"1px solid rgba(167,139,250,0.3)",borderRadius:12,padding:"14px 16px"}}>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:8}}>🌿 KELP BED ALERT</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>Kelp beds present at this break. Paddle through channels, not over the beds. Can impede duck-diving on the paddle-out.</div>
                      </div>
                    )}
                    <div className="card">
                      <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:8}}>📍 BREAK CHARACTER</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.6,marginBottom:10}}>{beach.char}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <Tag color={LVL_COLOR[beach.level]??"#888"}>{beach.level}</Tag>
                        <Tag color="#00bfff">IDEAL {beach.iw[0]}–{beach.iw[1]}m</Tag>
                        {beach.kelp&&<Tag color="#a78bfa">KELP</Tag>}
                        {beach.rip&&<Tag color="#fbbf24">RIP-PRONE</Tag>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ══ GEAR ══ */}
              {tab==="gear"&&(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {/* wetsuit */}
                  <div style={{background:`${data.suit.color}10`,border:`1px solid ${data.suit.color}35`,borderRadius:14,padding:"16px"}}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:10}}>🤿 WETSUIT</div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:38,flexShrink:0}}>{data.suit.icon}</span>
                      <div style={{minWidth:0}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:data.suit.color,letterSpacing:2,lineHeight:1.1}}>{data.suit.suit}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:3}}>Water {data.wt}°C {liveSst?"(live SST)":"(seasonal)"} · wind chill applied</div>
                      </div>
                    </div>
                  </div>

                  {/* board */}
                  <div className="card">
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:10}}>🏄 BOARD FOR THIS BREAK</div>
                    {(()=>{
                      const wh=data.wh,[lo,hi]=beach.iw;
                      const[board,reason]=wh<0.4?["Longboard / Foamie","Flat — grab the log."]:wh<lo*.8?["Funboard / Longboard","Small — go for volume."]:wh<=hi?[beach.level==="Advanced"||beach.level==="Inter/Advanced"?"Shortboard / Step-up":"Fish / Mid-length",`In the ideal window for ${beach.name}.`]:wh<=hi*1.4?["Step-up","Bigger than ideal — go for length."]:["Gun","Big surf — don't underboard."];
                      return(<><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:"#00bfff",letterSpacing:2,marginBottom:4}}>{board}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{reason}</div></>);
                    })()}
                  </div>

                  {/* UV */}
                  <div style={{background:data.uv>=6?"rgba(251,191,36,0.07)":"rgba(255,255,255,0.03)",border:`1px solid ${data.uv>=6?"rgba(251,191,36,0.3)":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:"14px 16px"}}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:10}}>🔆 SUN PROTECTION</div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:34,color:data.uv>=8?"#f87171":data.uv>=5?"#fbbf24":"#4ade80",flexShrink:0}}>UV {data.uv?.toFixed(0)??"-"}</div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,color:"#fff",marginBottom:3,lineHeight:1.3}}>{data.uv>=8?"SPF 50+ — reapply every hour":data.uv>=5?"SPF 30+ recommended":data.uv>=3?"Light protection needed":"Low UV today"}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{data.uv>=6?"Rashguard or UV-50 lycra top recommended.":"Still wear sunscreen on the water."}</div>
                      </div>
                    </div>
                  </div>

                  {/* checklist */}
                  <div className="card">
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:3,marginBottom:12}}>📋 SESSION CHECKLIST</div>
                    {[
                      {item:data.suit.suit,icon:data.suit.icon,show:true},
                      {item:"Sunscreen SPF 50+",icon:"☀️",show:true},
                      {item:"Leash",icon:"🔗",show:true},
                      {item:"Wax / Traction pad",icon:"🏄",show:true},
                      {item:"Boots + Hood",icon:"🥾",show:data.wt<14},
                      {item:"Rain jacket",icon:"🌧",show:data.rain>60},
                      {item:"Towel + warm layers",icon:"🏖️",show:true},
                      {item:"Water bottle",icon:"💧",show:true},
                      {item:"Check sharkspotters.org.za",icon:"🦈",show:SHARK.includes(beach.id)},
                    ].filter(g=>g.show).map((g,i,arr)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none"}}>
                        <span style={{fontSize:16,flexShrink:0,width:22,textAlign:"center"}}>{g.icon}</span>
                        <span style={{fontSize:11,color:"rgba(255,255,255,0.6)",flex:1,minWidth:0}}>{g.item}</span>
                        <span style={{color:"#4ade80",fontSize:12,flexShrink:0}}>✓</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FOOTER */}
              <div style={{marginTop:16,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,padding:"10px 14px"}}>
                <div style={{fontSize:8,color:"rgba(255,255,255,0.15)",letterSpacing:2,marginBottom:6}}>DATA SOURCES</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {["WAVES: Open-Meteo Marine","WIND: Open-Meteo Live",`WATER: ${liveSst?"Copernicus SST ✓":"Seasonal model"}`,"TIDES: Harmonic Model","UV: Open-Meteo Live"].map(s=>(
                    <span key={s} style={{fontSize:8,color:"#00ff87",background:"rgba(0,255,135,0.05)",border:"1px solid rgba(0,255,135,0.1)",borderRadius:4,padding:"2px 7px"}}>{s}</span>
                  ))}
                </div>
                <div style={{marginTop:6,fontSize:7,color:"rgba(255,255,255,0.1)",letterSpacing:1}}>{beach.lat}°S · {Math.abs(beach.lon)}°E · Auto-refreshes every 60s</div>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}
