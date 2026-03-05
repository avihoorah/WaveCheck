import { useState, useEffect, useCallback } from "react";

// ─── TIDE MODEL ───────────────────────────────────────────────────────────────
const TIDE_C = [
  {a:0.76,s:28.9841,p:160},{a:0.25,s:30.0000,p:195},
  {a:0.15,s:28.4397,p:140},{a:0.10,s:15.0411,p:220},
  {a:0.08,s:13.9430,p:185},{a:0.07,s:30.0821,p:195},
];
const EPOCH = Date.UTC(2000,0,1);
function tideH(ms){ const t=(ms-EPOCH)/3600000; return 0.82+TIDE_C.reduce((s,c)=>s+c.a*Math.cos((c.s*t-c.p)*Math.PI/180),0); }
function tide48(now){ return Array.from({length:48},(_,i)=>{ const d=new Date(now); d.setHours(0,0,0,0); d.setHours(i); return{hr:i,h:tideH(d.getTime())}; }); }
function tideExtremes(c){ const o=[]; for(let i=1;i<c.length-1;i++){ if(c[i].h>c[i-1].h&&c[i].h>c[i+1].h)o.push({...c[i],type:"High"}); else if(c[i].h<c[i-1].h&&c[i].h<c[i+1].h)o.push({...c[i],type:"Low"}); } return o; }

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const D16=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const deg2c=d=>D16[Math.round(((d%360)+360)%360/22.5)%16];
const MTEMP=[18,18,17,16,15,14,13,13,14,15,16,17];

function wetsuitRec(wt,ws){ const c=wt-ws*0.3;
  if(c<10)return{suit:"5/4mm + Hood & Boots",icon:"🥶",col:"#60a5fa"};
  if(c<13)return{suit:"4/3mm Full Suit",icon:"🧊",col:"#93c5fd"};
  if(c<16)return{suit:"3/2mm Full Suit",icon:"🌊",col:"#6ee7b7"};
  if(c<19)return{suit:"Springsuit / Shorty",icon:"👙",col:"#fde68a"};
  return{suit:"Board Shorts",icon:"🏄",col:"#fca5a5"};
}
function ripRisk(beach,wh,tl,ts){
  const sc=(ts.includes("Falling")||ts.includes("Low")?2:0)+(tl<1?2:0)+(wh>1.2?2:0)+(beach.rip?2:0);
  if(sc>=6)return{level:"High",  col:"#f87171",icon:"⚠️",tip:"Strong rip likely. Check before paddling out."};
  if(sc>=4)return{level:"Medium",col:"#fbbf24",icon:"⚡", tip:"Some rip risk. Identify channels first."};
  return      {level:"Low",   col:"#4ade80",icon:"✅",tip:"Low rip risk today."};
}
function windSt(beach,wc){
  if(beach.gw.includes(wc))return{s:"Offshore",  col:"#00ff87",i:"✅",sub:"Glassy faces"};
  const gi=beach.gw.map(w=>D16.indexOf(w)),ci=D16.indexOf(wc);
  if(gi.some(g=>Math.min(Math.abs(g-ci),16-Math.abs(g-ci))<=2))return{s:"Cross-shore",col:"#fbbf24",i:"↗️",sub:"Bumpy but rideable"};
  return{s:"Onshore",col:"#f87171",i:"❌",sub:"Choppy surface"};
}
function calcScore(wh,sp,ws,wd,beach){
  let s=0;
  if(beach){const[lo,hi]=beach.iw;s+=wh>=lo&&wh<=hi?32:wh>=lo*.7&&wh<lo?15:wh>hi&&wh<=hi*1.3?18:3;}
  else s+=wh>=0.8&&wh<=1.5?30:wh>1.5&&wh<=2.5?22:wh>0.5?14:6;
  s+=sp>=14?28:sp>=12?22:sp>=10?16:sp>=8?10:4;
  s+=ws<8?22:ws<15?16:ws<22?8:ws<30?3:0;
  const w=beach?windSt(beach,deg2c(wd)):null;
  if(w?.s==="Offshore")s+=18;else if(w?.s==="Cross-shore")s+=8;
  else if(!beach&&(deg2c(wd).includes("SE")||deg2c(wd).includes("S")))s+=18;
  return Math.min(s,100);
}
function ratingOf(sc){
  if(sc>=80)return{e:"🔥",l:"Epic",col:"#00ff87"};
  if(sc>=60)return{e:"⚡",l:"Good",col:"#7fff6b"};
  if(sc>=40)return{e:"👌",l:"Fair",col:"#fbbf24"};
  return{e:"💤",l:"Poor",col:"#f87171"};
}

// ─── BEACHES ──────────────────────────────────────────────────────────────────
const BEACHES=[
  {id:"muizenberg", name:"Muizenberg",        lat:-34.1075,lon:18.4711,level:"Beginner",      side:"False Bay", gw:["NW","N","NNW","WNW","W"],iw:[0.6,1.4],kelp:false,rip:true, char:"Soft crumbly lefts and rights. Long rides, forgiving. Perfect for beginners."},
  {id:"st_james",   name:"St James",           lat:-34.1178,lon:18.4547,level:"Beginner/Inter",side:"False Bay", gw:["NW","N","W","NNW"],      iw:[0.8,1.6],kelp:false,rip:false,char:"Sheltered cove with small punchy waves. Works on most swells."},
  {id:"kalk_bay",   name:"Kalk Bay Reef",      lat:-34.1280,lon:18.4430,level:"Advanced",      side:"False Bay", gw:["NW","N","NNW","W"],      iw:[1.2,2.5],kelp:false,rip:false,char:"Powerful reef break. Heavy lip. Best on solid SE swell 1.5m+."},
  {id:"fish_hoek",  name:"Fish Hoek",          lat:-34.1382,lon:18.4279,level:"Beginner/Inter",side:"False Bay", gw:["NW","N","W","NNW"],      iw:[0.6,1.4],kelp:false,rip:true, char:"Sandy beach break. Rip channels near the rocks."},
  {id:"clovelly",   name:"Clovelly",           lat:-34.1333,lon:18.4167,level:"Intermediate",  side:"False Bay", gw:["NW","N","W"],            iw:[0.8,1.8],kelp:false,rip:false,char:"Consistent beach break. Less crowded than Muizenberg."},
  {id:"llandudno",  name:"Llandudno",          lat:-34.0058,lon:18.3478,level:"Intermediate",  side:"Atlantic",  gw:["SE","SSE","S","ESE"],    iw:[1.0,2.2],kelp:true, rip:false,char:"Stunning cove. Heavy shorebreak. Navigate kelp on paddle-out."},
  {id:"glen_beach", name:"Glen Beach",         lat:-33.9486,lon:18.3756,level:"Advanced",      side:"Atlantic",  gw:["SE","SSE","S"],           iw:[1.2,2.5],kelp:true, rip:false,char:"Below the Twelve Apostles. Hollow and powerful on big swells."},
  {id:"camps_bay",  name:"Camps Bay",          lat:-33.9500,lon:18.3764,level:"Beginner/Inter",side:"Atlantic",  gw:["SE","SSE","E","ESE"],    iw:[0.6,1.5],kelp:false,rip:false,char:"Fun beach break with a view. Crowded in summer. Best early morning."},
  {id:"pebbles",    name:"Pebbles",            lat:-33.9800,lon:18.3600,level:"Bodyboard",     side:"Atlantic",  gw:["SE","SSE","S","E"],      iw:[0.6,1.4],kelp:false,rip:false,char:"Bodyboard heaven. Steep dumpy waves onto the beach."},
  {id:"off_wall",   name:"Off The Wall",       lat:-33.9050,lon:18.4050,level:"Advanced",      side:"Atlantic",  gw:["SE","S","SSE"],          iw:[1.2,3.0],kelp:true, rip:false,char:"Powerful rights over shallow rock. Not for beginners."},
  {id:"bigbay",     name:"Big Bay",            lat:-33.7942,lon:18.4595,level:"All levels",    side:"West Coast",gw:["SE","SSE","S","E"],      iw:[0.8,2.0],kelp:false,rip:true, char:"Long beach, multiple peaks. Windy in the afternoon."},
  {id:"blouberg",   name:"Bloubergstrand",     lat:-33.8078,lon:18.4756,level:"All levels",    side:"West Coast",gw:["SE","S","SSE","E"],      iw:[0.8,2.0],kelp:false,rip:true, char:"Table Mountain backdrop. Consistent. Gets blown out by noon."},
  {id:"kommetjie",  name:"Long Beach",         lat:-34.1389,lon:18.3278,level:"Intermediate",  side:"Peninsula", gw:["SE","SSE","NE","E"],     iw:[1.0,2.2],kelp:true, rip:false,char:"Long lefts on a big SW swell. Cold water year-round."},
  {id:"noordhoek",  name:"Noordhoek",          lat:-34.1050,lon:18.3600,level:"Advanced",      side:"Peninsula", gw:["SE","SSE","NE"],         iw:[1.5,3.5],kelp:false,rip:true, char:"Remote, powerful, beautiful. Rarely surfed. Strong rips."},
  {id:"scarborough",name:"Scarborough",        lat:-34.2000,lon:18.3750,level:"Inter/Advanced",side:"Peninsula", gw:["SE","SSE","NE","E"],     iw:[1.0,2.5],kelp:false,rip:true, char:"Raw exposed swell. Very cold. Rarely crowded."},
];
const SHARK=["muizenberg","st_james","fish_hoek","kalk_bay","clovelly"];
const LCOL={"Beginner":"#4ade80","Beginner/Inter":"#86efac","Intermediate":"#fbbf24","Inter/Advanced":"#fb923c","Advanced":"#f87171","Bodyboard":"#a78bfa","All levels":"#60a5fa"};

// ─── SVG CHARTS ───────────────────────────────────────────────────────────────
// Both charts use viewBox + preserveAspectRatio so they scale naturally on any screen
function TideChart({curve,curHr}){
  const hts=curve.map(p=>p.h),mn=Math.min(...hts),mx=Math.max(...hts);
  const W=560,H=76,pad=4;
  const sx=i=>(i/47)*W, sy=v=>H-pad-((v-mn)/(mx-mn))*(H-pad*2);
  const pts=curve.map((p,i)=>`${sx(i).toFixed(1)},${sy(p.h).toFixed(1)}`).join(" ");
  const ext=tideExtremes(curve);
  return(
    <svg viewBox={`0 0 ${W} ${H+20}`} preserveAspectRatio="xMidYMid meet"
      style={{width:"100%",height:"auto",display:"block",overflow:"visible"}}>
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00bfff" stopOpacity="0.28"/>
          <stop offset="100%" stopColor="#00bfff" stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      {[0,12,24,36,48].map(h=>(
        <g key={h}>
          <line x1={sx(Math.min(h,47))} y1={0} x2={sx(Math.min(h,47))} y2={H} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          <text x={sx(Math.min(h,47))+2} y={H+13} fill="rgba(255,255,255,0.22)" fontSize="7.5" fontFamily="monospace">{h===0?"Now":h<24?`${h}h`:h===24?"Tmrw":`+${h-24}h`}</text>
        </g>
      ))}
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#tg)"/>
      <polyline points={pts} fill="none" stroke="#00bfff" strokeWidth="1.8" strokeLinejoin="round"/>
      {ext.slice(0,8).map((e,i)=>(
        <g key={i}>
          <circle cx={sx(e.hr)} cy={sy(e.h)} r="2.5" fill={e.type==="High"?"#00bfff":"#004488"}/>
          <text x={sx(e.hr)} y={e.type==="High"?sy(e.h)-6:sy(e.h)+12} textAnchor="middle"
            fill={e.type==="High"?"#7dd3fc":"#5580aa"} fontSize="7" fontFamily="monospace">{e.h.toFixed(1)}m</text>
        </g>
      ))}
      {curHr<48&&<>
        <line x1={sx(curHr)} y1={0} x2={sx(curHr)} y2={H} stroke="#00ff87" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.8"/>
        <text x={sx(curHr)+3} y={8} fill="#00ff87" fontSize="7" fontFamily="monospace">NOW</text>
      </>}
    </svg>
  );
}

function SwellChart({hourly,curHr}){
  if(!hourly)return null;
  const W=560,H=66,pad=4;
  const vals=Array.from({length:48},(_,i)=>hourly.wave_height?.[i]??0);
  const mx=Math.max(...vals,0.5);
  const sx=i=>(i/47)*W, sy=v=>H-pad-(v/mx)*(H-pad*2);
  const pts=vals.map((v,i)=>`${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  return(
    <svg viewBox={`0 0 ${W} ${H+20}`} preserveAspectRatio="xMidYMid meet"
      style={{width:"100%",height:"auto",display:"block",overflow:"visible"}}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.38"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      {[0,12,24,36,48].map(h=>(
        <g key={h}>
          <line x1={sx(Math.min(h,47))} y1={0} x2={sx(Math.min(h,47))} y2={H} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          <text x={sx(Math.min(h,47))+2} y={H+13} fill="rgba(255,255,255,0.22)" fontSize="7.5" fontFamily="monospace">{h===0?"Now":h<24?`${h}h`:h===24?"Tmrw":`+${h-24}h`}</text>
        </g>
      ))}
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)"/>
      <polyline points={pts} fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinejoin="round"/>
      {vals.filter((_,i)=>i%8===0).map((v,i)=>(
        <text key={i} x={sx(i*8)} y={sy(v)-6} textAnchor="middle" fill="rgba(167,139,250,0.7)" fontSize="7" fontFamily="monospace">{v.toFixed(1)}m</text>
      ))}
      {curHr<48&&<line x1={sx(curHr)} y1={0} x2={sx(curHr)} y2={H} stroke="#00ff87" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.8"/>}
    </svg>
  );
}

// ─── SMALL UI PIECES ──────────────────────────────────────────────────────────
function Arrow({deg,col="#00bfff"}){
  return(
    <svg viewBox="0 0 48 48" style={{width:48,height:48,flexShrink:0,filter:`drop-shadow(0 0 4px ${col}50)`}}>
      <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
      {["N","E","S","W"].map((d,i)=>(
        <text key={d} x={24+16*Math.sin(i*Math.PI/2)} y={24-16*Math.cos(i*Math.PI/2)+3}
          textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="5.5" fontFamily="monospace">{d}</text>
      ))}
      <g transform={`rotate(${deg},24,24)`}>
        <polygon points="24,5 27,30 24,27 21,30" fill={col}/>
        <polygon points="24,43 27,30 24,33 21,30" fill={`${col}22`}/>
      </g>
    </svg>
  );
}

function Ring({sc,col,sz=64}){
  const r=26,circ=2*Math.PI*r;
  return(
    <svg viewBox="0 0 64 64" style={{width:sz,height:sz,flexShrink:0}}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5"/>
      <circle cx="32" cy="32" r={r} fill="none" stroke={col} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ*(1-sc/100)}
        strokeLinecap="round" transform="rotate(-90 32 32)"
        style={{transition:"stroke-dashoffset 1s ease",filter:`drop-shadow(0 0 4px ${col})`}}/>
      <text x="32" y="37" textAnchor="middle" fill="#fff" fontSize="14" fontFamily="'Bebas Neue',sans-serif">{sc}</text>
    </svg>
  );
}

// ─── FORECAST STRIP ───────────────────────────────────────────────────────────
function ForecastStrip({hourly,curHr,beach}){
  if(!hourly)return null;
  const hours=Array.from({length:12},(_,i)=>curHr+i).filter(h=>h<48);
  return(
    <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
      {hours.map(h=>{
        const sc=calcScore(hourly.wave_height?.[h]??0,hourly.wave_period?.[h]??0,hourly.wind_speed_10m?.[h]??0,hourly.wind_direction_10m?.[h]??0,beach);
        const r=ratingOf(sc),isNow=h===curHr;
        return(
          <div key={h} style={{flexShrink:0,minWidth:64,background:isNow?"rgba(0,191,255,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${isNow?"rgba(0,191,255,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:10,padding:"9px 7px",textAlign:"center"}}>
            <div style={{fontSize:8,color:isNow?"#00bfff":"rgba(255,255,255,0.3)",marginBottom:4,letterSpacing:0.5}}>{h<24?`${String(h).padStart(2,"0")}:00`:`+${h-24}h`}</div>
            <div style={{fontSize:15,marginBottom:2}}>{r.e}</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:r.col}}>{(hourly.wave_height?.[h]??0).toFixed(1)}m</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.25)"}}>{(hourly.wave_period?.[h]??0).toFixed(0)}s</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 5-DAY OUTLOOK ────────────────────────────────────────────────────────────
function WeekOutlook({hourly,beach}){
  if(!hourly)return null;
  const now=new Date();
  const days=Array.from({length:5},(_,d)=>({d,best:Math.max(...Array.from({length:24},(_,h)=>calcScore(hourly.wave_height?.[d*24+h]??0,hourly.wave_period?.[d*24+h]??0,hourly.wind_speed_10m?.[d*24+h]??0,hourly.wind_direction_10m?.[d*24+h]??0,beach)))}));
  const DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return(
    <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
      {days.map((d,i)=>{
        const r=ratingOf(d.best),lbl=i===0?"Today":i===1?"Tmrw":DN[(now.getDay()+i)%7];
        return(
          <div key={i} style={{flex:"1 1 58px",minWidth:58,flexShrink:0,background:"rgba(255,255,255,0.03)",border:`1px solid ${i===0?"rgba(0,191,255,0.3)":"rgba(255,255,255,0.07)"}`,borderRadius:10,padding:"11px 6px",textAlign:"center"}}>
            <div style={{fontSize:8,color:i===0?"#00bfff":"rgba(255,255,255,0.3)",marginBottom:5,letterSpacing:1}}>{lbl.toUpperCase()}</div>
            <div style={{fontSize:19,marginBottom:3}}>{r.e}</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:11,color:r.col,letterSpacing:1}}>{r.l.toUpperCase()}</div>
            <div style={{fontSize:8,color:"rgba(255,255,255,0.2)",marginTop:2}}>peak {d.best}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
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
  const curHr=now.getHours();

  const fetchData=useCallback(async(b,silent=false)=>{
    silent?setRefreshing(true):(setLoading(true),setErr(null),setData(null));
    try{
      const ch=new Date().getHours();
      const[mr,wr,sr]=await Promise.all([
        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${b.lat}&longitude=${b.lon}&current=wave_height,wave_period,wave_direction&hourly=wave_height,wave_period,wave_direction&timezone=Africa%2FJohannesburg&forecast_days=3`),
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${b.lat}&longitude=${b.lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,uv_index&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,cloud_cover,uv_index&timezone=Africa%2FJohannesburg&forecast_days=3`),
        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${b.lat}&longitude=${b.lon}&hourly=sea_surface_temperature&timezone=Africa%2FJohannesburg&forecast_days=1`).catch(()=>null),
      ]);
      const m=await mr.json(),w=await wr.json(),s=sr?await sr.json().catch(()=>null):null;
      const ws2=w.current?.wind_speed_10m??w.hourly?.wind_speed_10m?.[ch]??0;
      const wd2=w.current?.wind_direction_10m??w.hourly?.wind_direction_10m?.[ch]??0;
      const tmp=w.current?.temperature_2m??w.hourly?.temperature_2m?.[ch]??0;
      const cld=w.current?.cloud_cover??w.hourly?.cloud_cover?.[ch]??0;
      const rain=w.hourly?.precipitation_probability?.[ch]??0;
      const uv=w.current?.uv_index??w.hourly?.uv_index?.[ch]??0;
      const sst=s?.hourly?.sea_surface_temperature?.[ch]??null;
      setLiveSst(sst?Math.round(sst*10)/10:null);
      const wt=sst?Math.round(sst*10)/10:MTEMP[new Date().getMonth()];
      const tc=tide48(new Date());
      const tl=tc[ch]?.h??0.82;
      const allH=tc.map(t=>t.h),mid=(Math.max(...allH)+Math.min(...allH))/2;
      const tn=tc[Math.min(ch+1,47)]?.h??tl;
      const ts=tl>tn+0.02?(tl>mid?"High — Falling ↓":"Falling ↓"):tl<tn-0.02?(tl<mid?"Low — Rising ↑":"Rising ↑"):tl>mid?"High Tide":"Low Tide";
      const h48={wave_height:[...(m.hourly?.wave_height??[])],wave_period:[...(m.hourly?.wave_period??[])],wind_speed_10m:[...(w.hourly?.wind_speed_10m??[])],wind_direction_10m:[...(w.hourly?.wind_direction_10m??[])]};
      setHourly(h48);
      let bsc=-1,bst=ch,ben=Math.min(ch+2,47);
      for(let i=ch;i<Math.min(ch+23,46);i++){const sc2=calcScore(h48.wave_height[i]??0,h48.wave_period?.[i]??0,h48.wind_speed_10m[i]??0,h48.wind_direction_10m[i]??0,b);if(sc2>bsc){bsc=sc2;bst=i;ben=Math.min(i+2,47);}}
      setData({wh:m.current?.wave_height??m.hourly?.wave_height?.[ch]??0,sp:m.current?.wave_period??m.hourly?.wave_period?.[ch]??0,waveDir:m.current?.wave_direction??m.hourly?.wave_direction?.[ch]??0,ws:ws2,wd:wd2,tmp,cld,rain,uv,tl,ts,tides:tc,wt,suit:wetsuitRec(wt,ws2),bst,ben,bsc,sc:calcScore(m.hourly?.wave_height?.[ch]??0,m.hourly?.wave_period?.[ch]??0,ws2,wd2,b)});
      setLastRef(new Date());setNow(new Date());
    }catch{if(!silent)setErr("Couldn't load conditions. Check your connection.");}
    finally{setLoading(false);setRefreshing(false);}
  },[]);

  useEffect(()=>{fetchData(beach);},[beach,fetchData]);
  useEffect(()=>{const t=setInterval(()=>fetchData(beach,true),60000);return()=>clearInterval(t);},[beach,fetchData]);

  const wc=data?deg2c(data.wd):"—";
  const wvc=data?deg2c(data.waveDir):"—";
  const wst=data?windSt(beach,wc):null;
  const fmt=h=>h<24?`${String(h).padStart(2,"0")}:00`:`+${h-24}h`;
  const SIDES=["All","False Bay","Atlantic","West Coast","Peninsula"];
  const bList=BEACHES.filter(b=>filter==="All"||b.side===filter);
  const TABS=[{id:"now",l:"Now"},{id:"forecast",l:"Forecast"},{id:"tides",l:"Tides"},{id:"safety",l:"Safety"},{id:"gear",l:"Gear"}];

  // reusable inline styles
  const card={background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"13px 14px"};
  const label={fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:2.5,textTransform:"uppercase",marginBottom:6};
  const col1={display:"flex",flexDirection:"column",gap:10};

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{overflow-x:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth}
        body{background:#050c16;overflow-x:hidden;width:100%;max-width:100vw}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:4px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes slideup{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fp{0%,100%{opacity:0.25}50%{opacity:1}}
        @keyframes wa1{to{transform:translateX(-50%)}}
        @keyframes wa2{from{transform:translateX(-50%)}to{transform:translateX(0)}}
        button{cursor:pointer;border:none;background:none;font-family:inherit;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
        button:focus-visible{outline:2px solid #00bfff;outline-offset:2px}
        .su{animation:slideup .3s ease forwards}
        .ld{animation:pulse 2s infinite}
        .rf{animation:fp .9s infinite}
        .ww1{animation:wa1 16s linear infinite}
        .ww2{animation:wa2 11s linear infinite}
        /* scrollable rows — hide scrollbar visually */
        .hscroll{display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:6px;padding-bottom:4px}
        .hscroll::-webkit-scrollbar{display:none}
        /* grid */
        .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        @media(min-width:480px){.g2{grid-template-columns:repeat(3,1fr)}}
        @media(min-width:680px){.g2{grid-template-columns:repeat(4,1fr)}}
        /* tabs */
        .tabs{display:flex;gap:2px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:3px;margin-bottom:14px}
        .tab-btn{flex:1;padding:8px 1px;border-radius:9px;font-family:'Bebas Neue',sans-serif;font-size:11px;letter-spacing:1px;color:rgba(255,255,255,0.3);transition:all .2s;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        @media(min-width:360px){.tab-btn{font-size:12px;letter-spacing:1.5px}}
        .tab-btn.on{background:rgba(0,191,255,0.15);color:#00bfff}
      `}</style>

      {/* Animated wave background */}
      <svg style={{position:"fixed",bottom:0,left:0,width:"100%",height:160,opacity:.05,pointerEvents:"none",zIndex:0}} viewBox="0 0 1440 160" preserveAspectRatio="none">
        <g className="ww1"><path d="M0,90 C180,45 360,135 540,90 C720,45 900,135 1080,90 C1260,45 1440,135 1620,90 C1800,45 1980,135 2160,90 L2160,160 L0,160Z" fill="#00bfff"/></g>
        <g className="ww2"><path d="M0,120 C200,75 400,155 600,120 C800,85 1000,155 1200,120 C1400,85 1600,155 1800,120 L1800,160 L0,160Z" fill="#0070ff" opacity=".5"/></g>
      </svg>

      {/* App shell */}
      <div style={{position:"relative",zIndex:1,minHeight:"100vh",background:"linear-gradient(160deg,#050c16 0%,#081828 55%,#040f1c 100%)",fontFamily:"'Space Mono',monospace",color:"#fff",paddingBottom:52,overflowX:"hidden",width:"100%"}}>

        {/* ── HEADER ── */}
        <div style={{position:"sticky",top:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(5,12,22,0.96)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
          {/* logo */}
          <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0,overflow:"hidden"}}>
            <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#00bfff,#0055ff)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,boxShadow:"0 0 14px rgba(0,191,255,0.3)"}}>🌊</div>
            <div style={{minWidth:0}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:4,lineHeight:1,whiteSpace:"nowrap"}}>WAVECHECK</div>
              <div style={{fontSize:7,color:"rgba(255,255,255,0.25)",letterSpacing:2}}>CAPE TOWN · LIVE</div>
            </div>
          </div>
          {/* right side */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:8}}>
            {refreshing&&<span className="rf" style={{fontSize:7,color:"#00bfff",letterSpacing:1}}>SYNC</span>}
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div className="ld" style={{width:5,height:5,borderRadius:"50%",background:"#00ff87"}}/>
              <span style={{fontSize:7,color:"rgba(255,255,255,0.3)",letterSpacing:2}}>LIVE</span>
            </div>
            <div style={{textAlign:"right",minWidth:44}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,color:"rgba(255,255,255,0.6)",letterSpacing:1}}>{now.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</div>
              {lastRef&&<div style={{fontSize:6,color:"rgba(255,255,255,0.2)",whiteSpace:"nowrap"}}>↻{lastRef.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</div>}
            </div>
          </div>
        </div>

        {/* ── PAGE ── */}
        <div style={{width:"100%",maxWidth:820,margin:"0 auto",padding:"12px 12px 0"}}>

          {/* BEACH SELECTOR */}
          <div style={{marginBottom:14}}>
            {/* region filter */}
            <div className="hscroll" style={{marginBottom:8}}>
              {SIDES.map(s=>(
                <button key={s} onClick={()=>setFilter(s)} style={{flexShrink:0,padding:"5px 11px",borderRadius:100,fontSize:9,letterSpacing:1.5,fontFamily:"'Space Mono',monospace",transition:"all .2s",background:filter===s?"rgba(0,191,255,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${filter===s?"rgba(0,191,255,0.4)":"rgba(255,255,255,0.08)"}`,color:filter===s?"#00bfff":"rgba(255,255,255,0.4)"}}>{s.toUpperCase()}</button>
              ))}
            </div>
            {/* beach pills */}
            <div className="hscroll" style={{alignItems:"flex-start",gap:8}}>
              {bList.map(b=>(
                <div key={b.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
                  <button onClick={()=>setBeach(b)} style={{padding:"6px 13px",borderRadius:100,fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,whiteSpace:"nowrap",transition:"all .2s",background:beach.id===b.id?"rgba(0,191,255,0.15)":"rgba(255,255,255,0.04)",border:`1px solid ${beach.id===b.id?"rgba(0,191,255,0.5)":"rgba(255,255,255,0.08)"}`,color:beach.id===b.id?"#00bfff":"rgba(255,255,255,0.5)",boxShadow:beach.id===b.id?"0 0 10px rgba(0,191,255,0.18)":"none"}}>
                    {b.name}{favs.includes(b.id)?" ★":""}
                  </button>
                  <span style={{fontSize:7,color:LCOL[b.level]??"#888",letterSpacing:0.5}}>{b.level.toUpperCase()}</span>
                </div>
              ))}
            </div>
            {/* info tags */}
            <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
              {[
                {txt:beach.level.toUpperCase(),col:LCOL[beach.level]??"#888"},
                {txt:beach.side,col:"#4488aa"},
                ...(beach.rip?[{txt:"⚡ Rip-prone",col:"#fbbf24"}]:[]),
                ...(beach.kelp?[{txt:"🌿 Kelp",col:"#a78bfa"}]:[]),
                ...(SHARK.includes(beach.id)?[{txt:"🦈 Shark Spotters",col:"#f87171"}]:[]),
              ].map((t,i)=>(
                <span key={i} style={{fontSize:8,color:t.col,background:`${t.col}15`,border:`1px solid ${t.col}30`,borderRadius:20,padding:"3px 8px",letterSpacing:0.5,whiteSpace:"nowrap"}}>{t.txt}</span>
              ))}
              <button onClick={()=>setFavs(p=>p.includes(beach.id)?p.filter(x=>x!==beach.id):[...p,beach.id])} style={{marginLeft:"auto",fontSize:11,color:favs.includes(beach.id)?"#fbbf24":"rgba(255,255,255,0.22)",transition:"color .2s"}}>
                {favs.includes(beach.id)?"★ Saved":"☆ Save"}
              </button>
            </div>
          </div>

          {/* LOADING */}
          {loading&&<div style={{textAlign:"center",padding:"52px 0",color:"rgba(255,255,255,0.25)"}}>
            <div style={{fontSize:30,display:"inline-block",animation:"spin 1.4s linear infinite",marginBottom:10}}>🌊</div>
            <div style={{fontSize:9,letterSpacing:4}}>FETCHING CONDITIONS…</div>
          </div>}
          {err&&<div style={{background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.25)",borderRadius:10,padding:"11px 14px",color:"#fca5a5",fontSize:11,marginBottom:12}}>⚠ {err}</div>}

          {/* MAIN CONTENT */}
          {data&&!loading&&(
            <div className="su">

              {/* TABS */}
              <div className="tabs">
                {TABS.map(t=>(
                  <button key={t.id} className={`tab-btn${tab===t.id?" on":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>
                ))}
              </div>

              {/* ══ NOW ══ */}
              {tab==="now"&&(()=>{
                const rip=ripRisk(beach,data.wh,data.tl,data.ts);
                const wstNow=windSt(beach,wc);
                const goCount=[wstNow.s!=="Onshore",data.tl>0.6&&data.tl<1.7,data.wh>=beach.iw[0]*.7&&data.wh<=beach.iw[1]*1.3,data.ws<28].filter(Boolean).length;
                let dec,em,dcol,reason;
                if(goCount>=3&&data.sc>=55){dec="PADDLE OUT";em="🤙";dcol="#00ff87";reason="Conditions are firing. Don't miss this.";}
                else if(goCount>=2&&data.sc>=38){dec="WORTH IT";em="👍";dcol="#fbbf24";reason=[wstNow.s==="Onshore"?"Onshore wind":null,data.wh<beach.iw[0]*.7?"Below ideal size":null,data.wh>beach.iw[1]*1.3?"Above ideal size":null].filter(Boolean).join(" · ")||"Decent session ahead.";}
                else{dec="STAY HOME";em="🛋️";dcol="#f87171";reason=data.wh<0.4?"Flat as a lake.":data.ws>30?"Howling onshore.":"Multiple factors against you.";}
                const r=ratingOf(data.sc);
                return(
                  <div style={col1}>
                    {/* decision badge */}
                    <div style={{background:`${dcol}0e`,border:`2px solid ${dcol}38`,borderRadius:14,padding:"14px",position:"relative",overflow:"hidden"}}>
                      <div style={{position:"absolute",top:-24,right:-24,width:110,height:110,background:`radial-gradient(${dcol}18,transparent 70%)`,pointerEvents:"none"}}/>
                      <div style={{...label}}>SHOULD YOU SURF?</div>
                      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"nowrap"}}>
                        <span style={{fontSize:32,flexShrink:0}}>{em}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:dcol,lineHeight:1,letterSpacing:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dec}</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginTop:3,lineHeight:1.4}}>{reason}</div>
                        </div>
                        <Ring sc={data.sc} col={r.col} sz={60}/>
                      </div>
                    </div>

                    {/* best session */}
                    <div style={{background:"rgba(0,191,255,0.05)",border:"1px solid rgba(0,191,255,0.18)",borderRadius:12,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"nowrap"}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:8,color:"rgba(0,191,255,0.6)",letterSpacing:2,marginBottom:3}}>⏱ BEST SESSION</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#00bfff",letterSpacing:2,whiteSpace:"nowrap"}}>{fmt(data.bst)} – {fmt(data.ben)}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:8,color:"rgba(255,255,255,0.25)",letterSpacing:1,marginBottom:3}}>PEAK RATING</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:ratingOf(data.bsc).col,letterSpacing:2}}>{ratingOf(data.bsc).e} {ratingOf(data.bsc).l.toUpperCase()}</div>
                      </div>
                    </div>

                    {/* stat grid */}
                    <div className="g2">
                      {[
                        {icon:"🌊",label:"Wave Height",value:data.wh.toFixed(1),unit:"m",sub:data.wh>=beach.iw[0]&&data.wh<=beach.iw[1]?"In ideal range ✓":`Ideal ${beach.iw[0]}–${beach.iw[1]}m`,hi:true},
                        {icon:"⏱",label:"Swell Period",value:data.sp.toFixed(0),unit:"sec",sub:data.sp>=12?"Long — quality":data.sp>=8?"Medium":"Short — bumpy"},
                        {icon:"💨",label:"Wind",value:data.ws.toFixed(0),unit:"km/h",sub:`${wc} — ${wstNow.s}`},
                        {icon:"🧭",label:"Swell Dir",value:wvc,sub:`${data.waveDir.toFixed(0)}°`},
                        {icon:"🌤",label:"Air Temp",value:data.tmp.toFixed(0),unit:"°C",sub:`Cloud ${data.cld}%`},
                        {icon:"🌊",label:"Water Temp",value:data.wt,unit:"°C",sub:liveSst?"Live SST ✓":"Seasonal avg",hi:!!liveSst},
                        {icon:"🔆",label:"UV",value:data.uv?.toFixed(0)??"-",sub:data.uv>=8?"Very High 🔥":data.uv>=5?"Mod — SPF 30+":"Low"},
                        {icon:"🌧",label:"Rain",value:data.rain,unit:"%",sub:data.rain>60?"Pack a towel":"Likely dry"},
                        {icon:"🌙",label:"Tide",value:data.tl.toFixed(2),unit:"m",sub:data.ts,hi:true},
                        {icon:rip.icon,label:"Rip Risk",value:rip.level,sub:rip.tip.slice(0,36)+"…"},
                      ].map((s,i)=>(
                        <div key={i} style={{background:s.hi?"rgba(0,191,255,0.06)":"rgba(255,255,255,0.03)",border:`1px solid ${s.hi?"rgba(0,191,255,0.2)":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:"11px 12px"}}>
                          <div style={{fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{s.icon} {s.label}</div>
                          <div style={{display:"flex",alignItems:"baseline",gap:3,flexWrap:"wrap"}}>
                            <span style={{fontSize:21,fontFamily:"'Bebas Neue',sans-serif",color:s.hi?"#00bfff":"#fff",lineHeight:1.1}}>{s.value}</span>
                            {s.unit&&<span style={{fontSize:9,color:"rgba(255,255,255,0.35)"}}>{s.unit}</span>}
                          </div>
                          {s.sub&&<div style={{fontSize:8,color:"rgba(255,255,255,0.3)",marginTop:3,lineHeight:1.3}}>{s.sub}</div>}
                        </div>
                      ))}
                    </div>

                    {/* wind / swell direction card */}
                    <div style={{...card,display:"flex",alignItems:"center",gap:12}}>
                      <Arrow deg={data.wd} col={wstNow.col}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{...label}}>WIND</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wc}</div>
                        <div style={{fontSize:9,color:wstNow.col,marginTop:3}}>{wstNow.i} {wstNow.s} — {wstNow.sub}</div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0,minWidth:52}}>
                        <div style={{...label,textAlign:"right"}}>SWELL</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,lineHeight:1}}>{wvc}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:3}}>{data.waveDir.toFixed(0)}°</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ══ FORECAST ══ */}
              {tab==="forecast"&&(
                <div style={col1}>
                  <div>
                    <div style={{...label}}>📅 5-DAY OUTLOOK</div>
                    <WeekOutlook hourly={hourly} beach={beach}/>
                  </div>
                  <div>
                    <div style={{...label}}>NEXT 12 HOURS</div>
                    <ForecastStrip hourly={hourly} curHr={curHr} beach={beach}/>
                  </div>
                  <div style={card}>
                    <div style={{...label,color:"rgba(167,139,250,0.8)"}}>📈 48H WAVE HEIGHT</div>
                    <SwellChart hourly={hourly} curHr={curHr}/>
                  </div>
                </div>
              )}

              {/* ══ TIDES ══ */}
              {tab==="tides"&&(
                <div style={col1}>
                  <div style={card}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <span style={{fontSize:9,color:"rgba(0,191,255,0.7)",letterSpacing:2}}>🌙 48H TIDES</span>
                      <span style={{fontSize:8,color:"#00ff87",letterSpacing:1}}>Harmonic ✓</span>
                    </div>
                    <TideChart curve={data.tides} curHr={curHr}/>
                  </div>
                  <div style={{...label}}>HIGHS & LOWS</div>
                  {tideExtremes(data.tides).slice(0,6).map((e,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",...card,marginBottom:7,padding:"11px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:15}}>{e.type==="High"?"🌊":"🏖️"}</span>
                        <div>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:e.type==="High"?"#00bfff":"#fbbf24",letterSpacing:2}}>{e.type} Tide</div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>{e.hr<24?`${String(e.hr).padStart(2,"0")}:00`:`Tomorrow ${String(e.hr-24).padStart(2,"0")}:00`}</div>
                        </div>
                      </div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#fff"}}>{e.h.toFixed(2)}m</div>
                    </div>
                  ))}
                </div>
              )}

              {/* ══ SAFETY ══ */}
              {tab==="safety"&&(()=>{
                const rip=ripRisk(beach,data.wh,data.tl,data.ts);
                return(
                  <div style={col1}>
                    <div style={{background:`${rip.col}0f`,border:`1px solid ${rip.col}40`,borderRadius:12,padding:"13px 14px"}}>
                      <div style={{...label}}>⚠️ RIP CURRENT RISK</div>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:rip.col,flexShrink:0,letterSpacing:2}}>{rip.level}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.4}}>{rip.tip}</div>
                      </div>
                    </div>
                    {SHARK.includes(beach.id)&&(
                      <div style={{background:"rgba(248,113,113,0.07)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:12,padding:"13px 14px"}}>
                        <div style={{...label}}>🦈 SHARK SPOTTERS — FALSE BAY</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>This beach is in the SA Shark Spotters programme. Check <span style={{color:"#f87171"}}>sharkspotters.org.za</span> for today's flag colour. <strong style={{color:"#fca5a5"}}>Never surf alone.</strong></div>
                      </div>
                    )}
                    {beach.kelp&&(
                      <div style={{background:"rgba(167,139,250,0.07)",border:"1px solid rgba(167,139,250,0.3)",borderRadius:12,padding:"13px 14px"}}>
                        <div style={{...label}}>🌿 KELP BED ALERT</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>Kelp beds at this break. Paddle through channels, not over beds. Can impede duck-diving on the paddle-out.</div>
                      </div>
                    )}
                    <div style={card}>
                      <div style={{...label}}>📍 BREAK CHARACTER</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",lineHeight:1.6,marginBottom:10}}>{beach.char}</div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {[{t:beach.level,c:LCOL[beach.level]??"#888"},{t:`IDEAL ${beach.iw[0]}–${beach.iw[1]}m`,c:"#00bfff"},...(beach.kelp?[{t:"KELP",c:"#a78bfa"}]:[]),...(beach.rip?[{t:"RIP-PRONE",c:"#fbbf24"}]:[])].map((tg,i)=>(
                          <span key={i} style={{fontSize:8,color:tg.c,background:`${tg.c}15`,border:`1px solid ${tg.c}30`,borderRadius:20,padding:"3px 8px",letterSpacing:0.5,whiteSpace:"nowrap"}}>{tg.t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ══ GEAR ══ */}
              {tab==="gear"&&(
                <div style={col1}>
                  {/* wetsuit */}
                  <div style={{background:`${data.suit.col}0f`,border:`1px solid ${data.suit.col}35`,borderRadius:13,padding:"14px"}}>
                    <div style={{...label}}>🤿 WETSUIT</div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <span style={{fontSize:34,flexShrink:0}}>{data.suit.icon}</span>
                      <div style={{minWidth:0}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:data.suit.col,letterSpacing:2,lineHeight:1.1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{data.suit.suit}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:3}}>Water {data.wt}°C {liveSst?"(live SST)":"(seasonal)"} · wind chill applied</div>
                      </div>
                    </div>
                  </div>

                  {/* board */}
                  <div style={card}>
                    <div style={{...label}}>🏄 BOARD FOR THIS BREAK</div>
                    {(()=>{
                      const wh=data.wh,[lo,hi]=beach.iw;
                      const[board,reason]=wh<0.4?["Longboard / Foamie","Flat — grab the log."]:wh<lo*.8?["Funboard / Longboard","Small — go for volume."]:wh<=hi?[beach.level==="Advanced"||beach.level==="Inter/Advanced"?"Shortboard / Step-up":"Fish / Mid-length",`In the ideal window for ${beach.name}.`]:wh<=hi*1.4?["Step-up","Bigger than ideal — go for length."]:["Gun","Big surf — don't underboard."];
                      return<><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#00bfff",letterSpacing:2,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{board}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{reason}</div></>;
                    })()}
                  </div>

                  {/* UV */}
                  <div style={{background:data.uv>=6?"rgba(251,191,36,0.07)":"rgba(255,255,255,0.03)",border:`1px solid ${data.uv>=6?"rgba(251,191,36,0.3)":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:"13px 14px"}}>
                    <div style={{...label}}>🔆 SUN PROTECTION</div>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,color:data.uv>=8?"#f87171":data.uv>=5?"#fbbf24":"#4ade80",flexShrink:0,lineHeight:1}}>UV {data.uv?.toFixed(0)??"-"}</div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:11,color:"#fff",marginBottom:3,lineHeight:1.3}}>{data.uv>=8?"SPF 50+ — reapply every hour":data.uv>=5?"SPF 30+ recommended":data.uv>=3?"Light protection needed":"Low UV today"}</div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",lineHeight:1.3}}>{data.uv>=6?"Rashguard or UV-50 lycra top.":"Still wear sunscreen on the water."}</div>
                      </div>
                    </div>
                  </div>

                  {/* checklist */}
                  <div style={card}>
                    <div style={{...label}}>📋 SESSION CHECKLIST</div>
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
                        <span style={{fontSize:15,flexShrink:0,width:20,textAlign:"center"}}>{g.icon}</span>
                        <span style={{fontSize:11,color:"rgba(255,255,255,0.6)",flex:1,minWidth:0}}>{g.item}</span>
                        <span style={{color:"#4ade80",fontSize:11,flexShrink:0}}>✓</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* footer */}
              <div style={{marginTop:16,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,padding:"10px 12px",marginBottom:4}}>
                <div style={{fontSize:7,color:"rgba(255,255,255,0.15)",letterSpacing:2,marginBottom:6}}>DATA SOURCES</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {["WAVES: Open-Meteo Marine","WIND: Open-Meteo Live",`WATER: ${liveSst?"Copernicus SST ✓":"Seasonal model"}`,"TIDES: Harmonic Model","UV: Open-Meteo Live"].map(s=>(
                    <span key={s} style={{fontSize:7,color:"#00ff87",background:"rgba(0,255,135,0.05)",border:"1px solid rgba(0,255,135,0.1)",borderRadius:4,padding:"2px 7px"}}>{s}</span>
                  ))}
                </div>
                <div style={{marginTop:5,fontSize:7,color:"rgba(255,255,255,0.1)"}}>{beach.lat}°S · {Math.abs(beach.lon)}°E · Auto-refreshes every 60s</div>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}
