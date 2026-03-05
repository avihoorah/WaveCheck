import { useState, useEffect, useCallback } from "react";

// ─── TIDE MODEL (harmonic, Simon's Town gauge) ────────────────────────────────
const TIDE_CONSTITUENTS = [
  { name:"M2", amplitude:0.76, speed:28.9841, phase:160 },
  { name:"S2", amplitude:0.25, speed:30.0000, phase:195 },
  { name:"N2", amplitude:0.15, speed:28.4397, phase:140 },
  { name:"K1", amplitude:0.10, speed:15.0411, phase:220 },
  { name:"O1", amplitude:0.08, speed:13.9430, phase:185 },
  { name:"K2", amplitude:0.07, speed:30.0821, phase:195 },
];
const TIDE_Z0  = 0.82;
const EPOCH_MS = Date.UTC(2000,0,1,0,0,0);

function predictTide(d) {
  const t = (d.getTime() - EPOCH_MS) / 3600000;
  let h = TIDE_Z0;
  for (const c of TIDE_CONSTITUENTS)
    h += c.amplitude * Math.cos((c.speed * t - c.phase) * (Math.PI / 180));
  return h;
}

function buildTideCurve48h(now) {
  return Array.from({ length: 48 }, (_, i) => {
    const d = new Date(now); d.setHours(0, 0, 0, 0); d.setHours(i);
    return { hour: i, height: predictTide(d) };
  });
}

function findTideExtremes(curve) {
  const out = [];
  for (let i = 1; i < curve.length - 1; i++) {
    const p = curve[i-1].height, c = curve[i].height, n = curve[i+1].height;
    if (c > p && c > n) out.push({ ...curve[i], type: "High" });
    else if (c < p && c < n) out.push({ ...curve[i], type: "Low" });
  }
  return out;
}

// ─── WETSUIT ──────────────────────────────────────────────────────────────────
function getWetsuit(waterTemp, windSpeed) {
  const chill = waterTemp - windSpeed * 0.3;
  if (chill < 10) return { suit: "5/4mm Hood + Boots",  icon: "🥶", color: "#60a5fa" };
  if (chill < 13) return { suit: "4/3mm Full Suit",      icon: "🧊", color: "#93c5fd" };
  if (chill < 16) return { suit: "3/2mm Full Suit",      icon: "🌊", color: "#6ee7b7" };
  if (chill < 19) return { suit: "Springsuit / Shorty",  icon: "👙", color: "#fde68a" };
  return               { suit: "Board Shorts",           icon: "🏄", color: "#fca5a5" };
}

// ─── RIP RISK ─────────────────────────────────────────────────────────────────
function getRipRisk(beach, waveHeight, tideLevel, tideState) {
  const falling  = tideState.includes("Falling") || tideState.includes("Low");
  const lowTide  = tideLevel < 1.0;
  const bigSwell = waveHeight > 1.2;
  const ripProne = ["muizenberg","fish_hoek","bigbay","blouberg","noordhoek","scarborough"].includes(beach.id);
  const score    = (falling?2:0) + (lowTide?2:0) + (bigSwell?2:0) + (ripProne?2:0);
  if (score >= 6) return { level:"High",   color:"#f87171", icon:"⚠️",  tip:"Strong rip likely. Check the water before paddling out." };
  if (score >= 4) return { level:"Medium", color:"#fbbf24", icon:"⚡",  tip:"Some rip risk. Identify channels before entering." };
  return               { level:"Low",    color:"#4ade80", icon:"✅", tip:"Low rip risk today." };
}

// ─── WIND STATE (3-way: offshore / cross-shore / onshore) ────────────────────
const ALL16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

function getWindState(beach, windCompass) {
  if (beach.goodWind.includes(windCompass))
    return { state: "Offshore",    color: "#00ff87", icon: "✅", sub: "Glassy faces" };
  const goodIdxs = beach.goodWind.map(w => ALL16.indexOf(w));
  const curIdx   = ALL16.indexOf(windCompass);
  const isCross  = goodIdxs.some(gi => Math.min(Math.abs(gi-curIdx), 16-Math.abs(gi-curIdx)) <= 2);
  if (isCross)
    return { state: "Cross-shore", color: "#fbbf24", icon: "↗️",  sub: "Bumpy but rideable" };
  return   { state: "Onshore",     color: "#f87171", icon: "❌",  sub: "Choppy surface" };
}

// ─── WAVE RATING (per-beach ideal window) ─────────────────────────────────────
function waveRating(waveHeight, swellPeriod, windSpeed, windDir, beach) {
  let score = 0;
  if (beach) {
    const [lo, hi] = beach.idealWave;
    if (waveHeight >= lo && waveHeight <= hi)        score += 32;
    else if (waveHeight >= lo*0.7 && waveHeight < lo) score += 15;
    else if (waveHeight > hi && waveHeight <= hi*1.3) score += 18;
    else score += 3;
  } else {
    if (waveHeight >= 0.8 && waveHeight <= 1.5)      score += 30;
    else if (waveHeight > 1.5 && waveHeight <= 2.5)  score += 22;
    else if (waveHeight > 0.5 && waveHeight < 0.8)   score += 14;
    else score += 6;
  }
  if (swellPeriod >= 14)      score += 28;
  else if (swellPeriod >= 12) score += 22;
  else if (swellPeriod >= 10) score += 16;
  else if (swellPeriod >= 8)  score += 10;
  else score += 4;

  if (windSpeed < 8)       score += 22;
  else if (windSpeed < 15) score += 16;
  else if (windSpeed < 22) score += 8;
  else if (windSpeed < 30) score += 3;

  const wc = degToCompass(windDir);
  if (beach) {
    const ws = getWindState(beach, wc);
    if (ws.state === "Offshore")    score += 18;
    else if (ws.state === "Cross-shore") score += 8;
  } else if (wc.includes("SE") || wc.includes("S")) score += 18;

  return Math.min(score, 100);
}

function getRatingLabel(score) {
  if (score >= 80) return { emoji: "🔥", label: "Epic", color: "#00ff87" };
  if (score >= 60) return { emoji: "⚡", label: "Good", color: "#7fff6b" };
  if (score >= 40) return { emoji: "👌", label: "Fair", color: "#fbbf24" };
  return               { emoji: "💤", label: "Poor", color: "#f87171" };
}

const WIND_DIRS = ALL16;
function degToCompass(deg) { return WIND_DIRS[Math.round(((deg%360)+360)%360/22.5)%16]; }

// ─── BEACHES ──────────────────────────────────────────────────────────────────
const BEACHES = [
  { id:"muizenberg",   name:"Muizenberg",          lat:-34.1075,lon:18.4711, level:"Beginner",       side:"False Bay",
    goodWind:["NW","N","NNW","WNW","W"],     idealWave:[0.6,1.4], kelp:false, rip:true,
    character:"Soft crumbly rights and lefts. Long rides, forgiving. Best in the world for beginners." },
  { id:"st_james",     name:"St James",             lat:-34.1178,lon:18.4547, level:"Beginner/Inter", side:"False Bay",
    goodWind:["NW","N","W","NNW"],           idealWave:[0.8,1.6], kelp:false, rip:false,
    character:"Sheltered cove with small punchy waves. Good on most swells." },
  { id:"kalk_bay",     name:"Kalk Bay Reef",        lat:-34.1280,lon:18.4430, level:"Advanced",       side:"False Bay",
    goodWind:["NW","N","NNW","W"],           idealWave:[1.2,2.5], kelp:false, rip:false,
    character:"Powerful reef break. Heavy lip. Fires on solid SE swell 1.5m+." },
  { id:"fish_hoek",    name:"Fish Hoek",            lat:-34.1382,lon:18.4279, level:"Beginner/Inter", side:"False Bay",
    goodWind:["NW","N","W","NNW"],           idealWave:[0.6,1.4], kelp:false, rip:true,
    character:"Sandy beach break. Rip channels near the rocks. Check conditions carefully." },
  { id:"clovelly",     name:"Clovelly",             lat:-34.1333,lon:18.4167, level:"Intermediate",   side:"False Bay",
    goodWind:["NW","N","W"],                 idealWave:[0.8,1.8], kelp:false, rip:false,
    character:"Consistent beach break. Less crowded than Muizenberg. Fun in small-mid swell." },
  { id:"llandudno",    name:"Llandudno",            lat:-34.0058,lon:18.3478, level:"Intermediate",   side:"Atlantic",
    goodWind:["SE","SSE","S","ESE"],         idealWave:[1.0,2.2], kelp:true,  rip:false,
    character:"Stunning cove. Heavy shorebreak. Navigate kelp channels on paddle-out." },
  { id:"glen_beach",   name:"Glen Beach",           lat:-33.9486,lon:18.3756, level:"Advanced",       side:"Atlantic",
    goodWind:["SE","SSE","S"],               idealWave:[1.2,2.5], kelp:true,  rip:false,
    character:"Below the Twelve Apostles. Hollow and powerful on big swells. Rarely crowded." },
  { id:"camps_bay",    name:"Camps Bay",            lat:-33.9500,lon:18.3764, level:"Beginner/Inter", side:"Atlantic",
    goodWind:["SE","SSE","E","ESE"],         idealWave:[0.6,1.5], kelp:false, rip:false,
    character:"Fun beach break with a view. Crowded in summer. Best early morning." },
  { id:"pebbles",      name:"Pebbles",              lat:-33.9800,lon:18.3600, level:"Bodyboard",      side:"Atlantic",
    goodWind:["SE","SSE","S","E"],           idealWave:[0.6,1.4], kelp:false, rip:false,
    character:"Bodyboard heaven. Steep dumpy waves that barrel onto the beach." },
  { id:"off_the_wall", name:"Off The Wall",         lat:-33.9050,lon:18.4050, level:"Advanced",       side:"Atlantic",
    goodWind:["SE","S","SSE"],               idealWave:[1.2,3.0], kelp:true,  rip:false,
    character:"Powerful rights over shallow rock. Not for beginners. Kelp on entry." },
  { id:"bigbay",       name:"Big Bay",              lat:-33.7942,lon:18.4595, level:"All levels",     side:"West Coast",
    goodWind:["SE","SSE","S","E"],           idealWave:[0.8,2.0], kelp:false, rip:true,
    character:"Long beach with multiple peaks. Windy in the afternoon. Rip channels present." },
  { id:"blouberg",     name:"Bloubergstrand",       lat:-33.8078,lon:18.4756, level:"All levels",     side:"West Coast",
    goodWind:["SE","S","SSE","E"],           idealWave:[0.8,2.0], kelp:false, rip:true,
    character:"Table Mountain backdrop. Consistent. Gets blown out by noon most days." },
  { id:"kommetjie",    name:"Long Beach",           lat:-34.1389,lon:18.3278, level:"Intermediate",   side:"Peninsula",
    goodWind:["SE","SSE","NE","E"],          idealWave:[1.0,2.2], kelp:true,  rip:false,
    character:"Long lefts on a big SW swell. Cold water year-round. Kelp on entry." },
  { id:"noordhoek",    name:"Noordhoek / The Hoek", lat:-34.1050,lon:18.3600, level:"Advanced",       side:"Peninsula",
    goodWind:["SE","SSE","NE"],              idealWave:[1.5,3.5], kelp:false, rip:true,
    character:"Remote, powerful, beautiful. Rarely surfed. Strong rips. Cold." },
  { id:"scarborough",  name:"Scarborough",          lat:-34.2000,lon:18.3750, level:"Inter/Advanced", side:"Peninsula",
    goodWind:["SE","SSE","NE","E"],          idealWave:[1.0,2.5], kelp:false, rip:true,
    character:"Raw exposed swell. Very cold. Rarely crowded. Drive carefully on the pass." },
];

const LEVEL_COLORS = {
  "Beginner":"#4ade80","Beginner/Inter":"#86efac","Intermediate":"#fbbf24",
  "Inter/Advanced":"#fb923c","Advanced":"#f87171","Bodyboard":"#a78bfa","All levels":"#60a5fa"
};

const SHARK_BEACHES = ["muizenberg","st_james","fish_hoek","kalk_bay","clovelly"];

// ─── WAVE BG ──────────────────────────────────────────────────────────────────
function WaveBg() {
  return (
    <svg style={{position:"fixed",bottom:0,left:0,width:"100%",height:200,opacity:0.05,pointerEvents:"none",zIndex:0}}
      viewBox="0 0 1440 200" preserveAspectRatio="none">
      <defs><style>{`
        @keyframes wa1{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes wa2{0%{transform:translateX(-50%)}100%{transform:translateX(0)}}
        .ww1{animation:wa1 16s linear infinite}.ww2{animation:wa2 11s linear infinite}
      `}</style></defs>
      <g className="ww1"><path d="M0,110 C180,55 360,165 540,110 C720,55 900,165 1080,110 C1260,55 1440,165 1620,110 C1800,55 1980,165 2160,110 L2160,200 L0,200 Z" fill="#00bfff"/></g>
      <g className="ww2"><path d="M0,145 C200,90 400,185 600,145 C800,100 1000,185 1200,145 C1400,100 1600,185 1800,145 L1800,200 L0,200 Z" fill="#0070ff" opacity="0.5"/></g>
    </svg>
  );
}

// ─── WIND ARROW ───────────────────────────────────────────────────────────────
function WindArrow({ deg, size = 64, color = "#00bfff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72"
      style={{ filter: `drop-shadow(0 0 6px ${color}50)` }}>
      <circle cx="36" cy="36" r="33" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
      {["N","E","S","W"].map((d,i) => (
        <text key={d} x={36+24*Math.sin(i*Math.PI/2)} y={36-24*Math.cos(i*Math.PI/2)+4}
          textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="7" fontFamily="monospace">{d}</text>
      ))}
      <g transform={`rotate(${deg},36,36)`}>
        <polygon points="36,8 40.5,42 36,38 31.5,42" fill={color}/>
        <polygon points="36,64 40.5,42 36,46 31.5,42" fill={`${color}30`}/>
      </g>
    </svg>
  );
}

// ─── SCORE RING ───────────────────────────────────────────────────────────────
function ScoreRing({ score, color, size = 80 }) {
  const r = 34, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - score/100)}
        strokeLinecap="round" transform="rotate(-90 40 40)"
        style={{ transition:"stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)", filter:`drop-shadow(0 0 5px ${color})` }}/>
      <text x="40" y="45" textAnchor="middle" fill="#fff" fontSize="18" fontFamily="'Bebas Neue',sans-serif">{score}</text>
    </svg>
  );
}

// ─── TIDE CHART ───────────────────────────────────────────────────────────────
function TideChart({ curve, currentHour }) {
  const W = 680, H = 88;
  const hts = curve.map(p => p.height);
  const mn = Math.min(...hts), mx = Math.max(...hts);
  const sy = v => H - 8 - ((v-mn)/(mx-mn)) * (H-16);
  const sx = i => (i/(curve.length-1)) * W;
  const pts = curve.map((p,i) => `${sx(i)},${sy(p.height)}`).join(" ");
  const extr = findTideExtremes(curve);
  return (
    <div style={{ overflowX:"auto" }}>
      <svg width={W} height={H+24} viewBox={`0 0 ${W} ${H+24}`} style={{ display:"block", minWidth:W }}>
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00bfff" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#00bfff" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {[0,6,12,18,24,30,36,42,48].map(h => (
          <g key={h}>
            <line x1={sx(h)} y1="0" x2={sx(h)} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <text x={sx(h)+3} y={H+14} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">
              {h < 24 ? `${String(h).padStart(2,"0")}h` : `+${h-24}h`}
            </text>
          </g>
        ))}
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#tg)"/>
        <polyline points={pts} fill="none" stroke="#00bfff" strokeWidth="2" strokeLinejoin="round"/>
        {extr.slice(0,8).map((e,i) => (
          <g key={i}>
            <circle cx={sx(e.hour)} cy={sy(e.height)} r="3" fill={e.type==="High"?"#00bfff":"#005599"}/>
            <text x={sx(e.hour)} y={e.type==="High" ? sy(e.height)-7 : sy(e.height)+14}
              textAnchor="middle" fill={e.type==="High"?"#00bfff":"#5588cc"} fontSize="7" fontFamily="monospace">
              {e.height.toFixed(1)}m
            </text>
          </g>
        ))}
        {currentHour < curve.length && (
          <>
            <line x1={sx(currentHour)} y1="0" x2={sx(currentHour)} y2={H}
              stroke="#00ff87" strokeWidth="1.5" strokeDasharray="3,2"/>
            <text x={sx(currentHour)+4} y="10" fill="#00ff87" fontSize="7" fontFamily="monospace">NOW</text>
          </>
        )}
        <line x1={sx(24)} y1="0" x2={sx(24)} y2={H}
          stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,2"/>
        <text x={sx(24)+4} y={H+14} fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">Tomorrow</text>
      </svg>
    </div>
  );
}

// ─── SWELL CHART ──────────────────────────────────────────────────────────────
function SwellChart({ hourly, currentHour }) {
  if (!hourly) return null;
  const W = 680, H = 78;
  const data = Array.from({ length: 48 }, (_, i) => ({ hour: i, wh: hourly.wave_height?.[i] ?? 0 }));
  const maxH = Math.max(...data.map(d => d.wh), 0.5);
  const sy = v => H - 8 - (v/maxH)*(H-16);
  const sx = i => (i/(data.length-1))*W;
  const pts = data.map((d,i) => `${sx(i)},${sy(d.wh)}`).join(" ");
  return (
    <div style={{ overflowX:"auto" }}>
      <svg width={W} height={H+24} viewBox={`0 0 ${W} ${H+24}`} style={{ display:"block", minWidth:W }}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.45"/>
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {[0,6,12,18,24,30,36,42,48].map(h => (
          <g key={h}>
            <line x1={sx(h)} y1="0" x2={sx(h)} y2={H} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <text x={sx(h)+3} y={H+14} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">
              {h < 24 ? `${String(h).padStart(2,"0")}h` : `+${h-24}h`}
            </text>
          </g>
        ))}
        <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)"/>
        <polyline points={pts} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round"/>
        {data.filter((_,i) => i%6===0).map((d,i) => (
          <text key={i} x={sx(d.hour)} y={sy(d.wh)-5}
            textAnchor="middle" fill="rgba(167,139,250,0.7)" fontSize="7" fontFamily="monospace">
            {d.wh.toFixed(1)}m
          </text>
        ))}
        {currentHour < data.length && (
          <line x1={sx(currentHour)} y1="0" x2={sx(currentHour)} y2={H}
            stroke="#00ff87" strokeWidth="1.5" strokeDasharray="3,2"/>
        )}
        <line x1={sx(24)} y1="0" x2={sx(24)} y2={H}
          stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,2"/>
        <text x={sx(24)+4} y={H+14} fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="monospace">Tomorrow</text>
      </svg>
    </div>
  );
}

// ─── STAT TILE ────────────────────────────────────────────────────────────────
function Tile({ icon, label, value, unit, sub, accent }) {
  return (
    <div style={{
      background: accent ? "rgba(0,191,255,0.06)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${accent ? "rgba(0,191,255,0.2)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 14, padding: "14px 15px",
      display: "flex", flexDirection: "column", gap: 4
    }}>
      <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:2.5, textTransform:"uppercase", fontFamily:"'Space Mono',monospace" }}>
        {icon} {label}
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
        <span style={{ fontSize:24, fontFamily:"'Bebas Neue',sans-serif", color:accent?"#00bfff":"#fff", lineHeight:1.1 }}>{value}</span>
        {unit && <span style={{ fontSize:11, color:"rgba(255,255,255,0.35)", fontFamily:"'Space Mono',monospace" }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize:9, color:"rgba(255,255,255,0.28)", fontFamily:"'Space Mono',monospace", lineHeight:1.3 }}>{sub}</div>}
    </div>
  );
}

// ─── FORECAST HOUR STRIP ──────────────────────────────────────────────────────
function ForecastStrip({ hourly, currentHour, beach }) {
  if (!hourly) return null;
  const hours = Array.from({ length: 12 }, (_, i) => currentHour + i).filter(h => h < 48);
  return (
    <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:6 }}>
      {hours.map(h => {
        const wh = hourly.wave_height?.[h] ?? 0;
        const wp = hourly.wave_period?.[h] ?? 0;
        const ws = hourly.wind_speed_10m?.[h] ?? 0;
        const wd = hourly.wind_direction_10m?.[h] ?? 0;
        const score = waveRating(wh, wp, ws, wd, beach);
        const r = getRatingLabel(score);
        const isNow = h === currentHour;
        const lbl = h < 24 ? `${String(h).padStart(2,"0")}:00` : `+${h-24}h`;
        return (
          <div key={h} style={{
            background: isNow ? "rgba(0,191,255,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${isNow ? "rgba(0,191,255,0.4)" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 12, padding: "10px 12px", minWidth: 74, flexShrink: 0, textAlign: "center"
          }}>
            <div style={{ fontSize:9, color:isNow?"#00bfff":"rgba(255,255,255,0.3)", letterSpacing:1, marginBottom:5 }}>{lbl}</div>
            <div style={{ fontSize:16 }}>{r.emoji}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:15, color:r.color, letterSpacing:1 }}>{wh.toFixed(1)}m</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)" }}>{wp.toFixed(0)}s</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 5-DAY OUTLOOK ────────────────────────────────────────────────────────────
function WeekOutlook({ hourly, beach }) {
  if (!hourly) return null;
  const now = new Date();
  const days = Array.from({ length: 5 }, (_, d) => {
    const startH = d * 24;
    const scores = Array.from({ length: 24 }, (_, h) => {
      const i = startH + h;
      return waveRating(
        hourly.wave_height?.[i] ?? 0, hourly.wave_period?.[i] ?? 0,
        hourly.wind_speed_10m?.[i] ?? 0, hourly.wind_direction_10m?.[i] ?? 0, beach
      );
    });
    return { day: d, best: Math.max(...scores) };
  });
  return (
    <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:6 }}>
      {days.map((d, i) => {
        const dayIdx = (now.getDay() + i) % 7;
        const label = i===0?"Today":i===1?"Tomorrow":["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayIdx];
        const r = getRatingLabel(d.best);
        return (
          <div key={i} style={{
            flex:1, minWidth:64, flexShrink:0,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${i===0?"rgba(0,191,255,0.3)":"rgba(255,255,255,0.07)"}`,
            borderRadius:12, padding:"12px 10px", textAlign:"center"
          }}>
            <div style={{ fontSize:9, color:i===0?"#00bfff":"rgba(255,255,255,0.3)", letterSpacing:1, marginBottom:6 }}>{label.toUpperCase()}</div>
            <div style={{ fontSize:22, marginBottom:4 }}>{r.emoji}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, color:r.color, letterSpacing:1 }}>{r.label.toUpperCase()}</div>
            <div style={{ fontSize:8, color:"rgba(255,255,255,0.2)", marginTop:3 }}>peak {d.best}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DECISION BADGE ───────────────────────────────────────────────────────────
function DecisionBadge({ data, beach }) {
  if (!data) return null;
  const wc = degToCompass(data.windDir);
  const ws = getWindState(beach, wc);
  const goodWave = data.waveHeight >= beach.idealWave[0]*0.7 && data.waveHeight <= beach.idealWave[1]*1.3;
  const goodWind = data.windSpeed < 28;
  const goodTide = data.tideLevel > 0.6 && data.tideLevel < 1.7;
  const offshore = ws.state === "Offshore";
  const cross    = ws.state === "Cross-shore";
  const goCount  = [(offshore || (cross && goodWind)), goodTide, goodWave, goodWind].filter(Boolean).length;
  const r = getRatingLabel(data.rating);

  let decision, emoji, color, reasons;
  if (goCount === 4 || (goCount >= 3 && data.rating >= 60)) {
    decision = "PADDLE OUT"; emoji = "🤙"; color = "#00ff87";
    reasons = "Conditions are firing. Don't miss this one.";
  } else if (goCount >= 2 && data.rating >= 40) {
    decision = "WORTH IT"; emoji = "👍"; color = "#fbbf24";
    const issues = [
      !offshore && !cross ? "Onshore wind" : null,
      !goodTide ? "Tide not ideal" : null,
      !goodWave ? "Outside ideal wave range" : null,
    ].filter(Boolean);
    reasons = issues.length ? issues.join(" · ") : "Decent session ahead.";
  } else {
    decision = "STAY HOME"; emoji = "🛋️"; color = "#f87171";
    reasons = data.waveHeight < 0.4 ? "Flat as a lake."
      : data.windSpeed > 30 ? "Howling onshore — blown out."
      : !goodWave && data.waveHeight > beach.idealWave[1]*1.5 ? "Too big for this break."
      : "Multiple factors against you today.";
  }

  return (
    <div style={{
      background: `${color}10`, border: `2px solid ${color}40`,
      borderRadius: 20, padding: "18px", marginBottom: 14,
      position: "relative", overflow: "hidden"
    }}>
      <div style={{ position:"absolute", top:-40, right:-40, width:150, height:150,
        background:`radial-gradient(circle,${color}20,transparent 70%)`, pointerEvents:"none" }}/>
      <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>SHOULD YOU SURF?</div>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ fontSize:40, flexShrink:0 }}>{emoji}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:34, color, lineHeight:1, letterSpacing:2 }}>{decision}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:4, lineHeight:1.4 }}>{reasons}</div>
        </div>
        <div style={{ flexShrink:0 }}><ScoreRing score={data.rating} color={r.color} size={76}/></div>
      </div>
    </div>
  );
}

// ─── SAFETY PANEL ─────────────────────────────────────────────────────────────
function SafetyPanel({ data, beach }) {
  if (!data) return null;
  const rip   = getRipRisk(beach, data.waveHeight, data.tideLevel, data.tideState);
  const shark = SHARK_BEACHES.includes(beach.id);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ background:`${rip.color}10`, border:`1px solid ${rip.color}40`, borderRadius:14, padding:"16px 18px" }}>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:8 }}>⚠️ RIP CURRENT RISK</div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:rip.color, flexShrink:0, letterSpacing:2 }}>{rip.level}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", lineHeight:1.4 }}>{rip.tip}</div>
        </div>
      </div>

      {shark && (
        <div style={{ background:"rgba(248,113,113,0.07)", border:"1px solid rgba(248,113,113,0.3)", borderRadius:14, padding:"16px 18px" }}>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:8 }}>🦈 SHARK SPOTTERS — FALSE BAY</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", lineHeight:1.5 }}>
            This beach is in the SA Shark Spotters programme. Check{" "}
            <span style={{ color:"#f87171" }}>sharkspotters.org.za</span>{" "}
            for today's flag colour before paddling out.{" "}
            <strong style={{ color:"#fca5a5" }}>Never surf alone.</strong>
          </div>
        </div>
      )}

      {beach.kelp && (
        <div style={{ background:"rgba(167,139,250,0.07)", border:"1px solid rgba(167,139,250,0.3)", borderRadius:14, padding:"16px 18px" }}>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:8 }}>🌿 KELP BED ALERT</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", lineHeight:1.5 }}>
            Kelp beds at this break. Paddle through channels, not over the beds. Can impede duck-diving on the paddle-out.
          </div>
        </div>
      )}

      <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 18px" }}>
        <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:8 }}>📍 BREAK CHARACTER</div>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", lineHeight:1.6 }}>{beach.character}</div>
        <div style={{ marginTop:10, display:"flex", gap:8, flexWrap:"wrap" }}>
          <div style={{ fontSize:9, color:LEVEL_COLORS[beach.level]??"#888", background:"rgba(255,255,255,0.05)", border:`1px solid ${LEVEL_COLORS[beach.level]??"#888"}40`, borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>{beach.level}</div>
          <div style={{ fontSize:9, color:"rgba(0,191,255,0.7)", background:"rgba(0,191,255,0.07)", border:"1px solid rgba(0,191,255,0.2)", borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>IDEAL {beach.idealWave[0]}–{beach.idealWave[1]}m</div>
          {beach.kelp && <div style={{ fontSize:9, color:"rgba(167,139,250,0.7)", background:"rgba(167,139,250,0.07)", border:"1px solid rgba(167,139,250,0.2)", borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>KELP</div>}
          {beach.rip  && <div style={{ fontSize:9, color:"rgba(251,191,36,0.7)",  background:"rgba(251,191,36,0.07)",  border:"1px solid rgba(251,191,36,0.2)",  borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>RIP-PRONE</div>}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedBeach, setSelectedBeach] = useState(BEACHES[0]);
  const [favorites,     setFavorites]     = useState(["muizenberg","bigbay","llandudno"]);
  const [data,          setData]          = useState(null);
  const [hourlyRaw,     setHourlyRaw]     = useState(null);
  const [waterTempLive, setWaterTempLive] = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState(null);
  const [activeTab,     setActiveTab]     = useState("now");
  const [sideFilter,    setSideFilter]    = useState("All");
  const [lastRefresh,   setLastRefresh]   = useState(null);
  const [now,           setNow]           = useState(new Date());

  const currentHour = now.getHours();
  const isWeekend   = now.getDay() === 0 || now.getDay() === 6;

  // ── FETCH ──────────────────────────────────────────────────────────────────
  const fetchConditions = useCallback(async (beach, silent = false) => {
    if (silent) setRefreshing(true);
    else { setLoading(true); setError(null); setData(null); }

    try {
      const hr = new Date().getHours();
      const [marineRes, weatherRes, sstRes] = await Promise.all([
        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&current=wave_height,wave_period,wave_direction&hourly=wave_height,wave_period,wave_direction&timezone=Africa%2FJohannesburg&forecast_days=3`),
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover,uv_index&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,cloud_cover,uv_index&timezone=Africa%2FJohannesburg&forecast_days=3`),
        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=sea_surface_temperature&timezone=Africa%2FJohannesburg&forecast_days=1`).catch(() => null),
      ]);

      const marine  = await marineRes.json();
      const weather = await weatherRes.json();
      const sst     = sstRes ? await sstRes.json().catch(() => null) : null;

      const windSpeed = weather.current?.wind_speed_10m     ?? weather.hourly?.wind_speed_10m?.[hr]     ?? 0;
      const windDir   = weather.current?.wind_direction_10m  ?? weather.hourly?.wind_direction_10m?.[hr]  ?? 0;
      const temp      = weather.current?.temperature_2m     ?? weather.hourly?.temperature_2m?.[hr]      ?? 0;
      const cloud     = weather.current?.cloud_cover        ?? weather.hourly?.cloud_cover?.[hr]         ?? 0;
      const rain      = weather.hourly?.precipitation_probability?.[hr] ?? 0;
      const uv        = weather.current?.uv_index           ?? weather.hourly?.uv_index?.[hr]            ?? 0;

      // Live SST (Copernicus via Open-Meteo marine API)
      const liveSst = sst?.hourly?.sea_surface_temperature?.[hr] ?? null;
      setWaterTempLive(liveSst ? Math.round(liveSst * 10) / 10 : null);
      const waterTemp = liveSst
        ? Math.round(liveSst * 10) / 10
        : [18,18,17,16,15,14,13,13,14,15,16,17][new Date().getMonth()];

      const tideData  = buildTideCurve48h(new Date());
      const tideLvl   = tideData[hr]?.height ?? 0.82;
      const allH      = tideData.map(t => t.height);
      const tideMid   = (Math.max(...allH) + Math.min(...allH)) / 2;
      const tideNext  = tideData[Math.min(hr+1, 47)]?.height ?? tideLvl;
      const tideState = tideLvl > tideNext + 0.02
        ? (tideLvl > tideMid ? "High — Falling ↓" : "Falling ↓")
        : tideLvl < tideNext - 0.02
        ? (tideLvl < tideMid ? "Low — Rising ↑" : "Rising ↑")
        : tideLvl > tideMid ? "High Tide" : "Low Tide";

      const hourly48 = {
        wave_height:        [...(marine.hourly?.wave_height        ?? [])],
        wave_period:        [...(marine.hourly?.wave_period        ?? [])],
        wave_direction:     [...(marine.hourly?.wave_direction     ?? [])],
        wind_speed_10m:     [...(weather.hourly?.wind_speed_10m    ?? [])],
        wind_direction_10m: [...(weather.hourly?.wind_direction_10m ?? [])],
      };
      setHourlyRaw(hourly48);

      let bestScore = -1, bestStart = hr, bestEnd = Math.min(hr+2, 47);
      for (let s = hr; s < Math.min(hr+23, 46); s++) {
        const sc = waveRating(
          hourly48.wave_height[s]??0, hourly48.wave_period?.[s]??0,
          hourly48.wind_speed_10m[s]??0, hourly48.wind_direction_10m[s]??0, beach
        );
        if (sc > bestScore) { bestScore = sc; bestStart = s; bestEnd = Math.min(s+2, 47); }
      }

      setData({
        waveHeight:  marine.current?.wave_height    ?? marine.hourly?.wave_height?.[hr]    ?? 0,
        swellPeriod: marine.current?.wave_period    ?? marine.hourly?.wave_period?.[hr]    ?? 0,
        waveDir:     marine.current?.wave_direction ?? marine.hourly?.wave_direction?.[hr] ?? 0,
        windSpeed, windDir, temp, cloud, rain, uv,
        tideLevel: tideLvl, tideState, tides: tideData,
        waterTemp, wetsuit: getWetsuit(waterTemp, windSpeed),
        bestStart, bestEnd, bestScore,
        rating: waveRating(
          marine.hourly?.wave_height?.[hr]??0, marine.hourly?.wave_period?.[hr]??0,
          windSpeed, windDir, beach
        ),
      });

      setLastRefresh(new Date());
      setNow(new Date());
    } catch {
      if (!silent) setError("Couldn't load conditions. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial + beach-change fetch
  useEffect(() => { fetchConditions(selectedBeach); }, [selectedBeach, fetchConditions]);

  // ── AUTO-REFRESH every 60 seconds ──────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConditions(selectedBeach, true);
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedBeach, fetchConditions]);

  const toggleFav = id => setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const windCompass = data ? degToCompass(data.windDir) : "—";
  const waveCompass = data ? degToCompass(data.waveDir) : "—";
  const windState   = data ? getWindState(selectedBeach, windCompass) : null;
  const fmt = h => h < 24 ? `${String(h).padStart(2,"0")}:00` : `+${h-24}h`;
  const beach = selectedBeach;

  const sides    = ["All","False Bay","Atlantic","West Coast","Peninsula"];
  const filtered = BEACHES.filter(b => sideFilter === "All" || b.side === sideFilter);
  const tabs     = [
    { id:"now",      label:"Now"      },
    { id:"forecast", label:"Forecast" },
    { id:"tides",    label:"Tides"    },
    { id:"safety",   label:"Safety"   },
    { id:"gear",     label:"Gear"     },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#050c16;overflow-x:hidden;max-width:100vw}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadePulse{0%,100%{opacity:0.3}50%{opacity:1}}
        .anim-up{animation:slideUp 0.35s ease forwards}
        .live-dot{animation:pulse 2s infinite}
        .refreshing{animation:fadePulse 1s infinite}
        button:focus{outline:none}
        .wrap{padding:16px 12px;max-width:740px;margin:0 auto}
        @media(min-width:480px){.wrap{padding:20px 16px}}
      `}</style>

      <WaveBg/>

      <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#050c16 0%,#081828 60%,#040f1c 100%)", fontFamily:"'Space Mono',monospace", color:"#fff", paddingBottom:60, position:"relative", zIndex:1 }}>

        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, background:"rgba(5,12,22,0.9)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:200 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:"linear-gradient(135deg,#00bfff,#0055ff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, boxShadow:"0 0 20px rgba(0,191,255,0.3)" }}>🌊</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:4, lineHeight:1 }}>WAVECHECK</div>
              <div style={{ fontSize:8, color:"rgba(255,255,255,0.25)", letterSpacing:2 }}>CAPE TOWN · LIVE</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            {refreshing && <div className="refreshing" style={{ fontSize:8, color:"#00bfff", letterSpacing:1 }}>UPDATING</div>}
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div className="live-dot" style={{ width:6, height:6, borderRadius:"50%", background:"#00ff87" }}/>
              <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:2 }}>LIVE</span>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:1 }}>{now.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</div>
              {lastRefresh && <div style={{ fontSize:7, color:"rgba(255,255,255,0.2)", letterSpacing:1 }}>↻ {lastRefresh.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</div>}
            </div>
          </div>
        </div>

        <div className="wrap">

          {/* ── BEACH SELECTOR ─────────────────────────────────────────────── */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8, marginBottom:8 }}>
              {sides.map(s => (
                <button key={s} onClick={() => setSideFilter(s)} style={{
                  background: sideFilter===s ? "rgba(0,191,255,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${sideFilter===s?"rgba(0,191,255,0.4)":"rgba(255,255,255,0.08)"}`,
                  borderRadius:100, padding:"6px 13px",
                  color: sideFilter===s ? "#00bfff" : "rgba(255,255,255,0.4)",
                  fontSize:9, letterSpacing:2, cursor:"pointer", whiteSpace:"nowrap",
                  fontFamily:"'Space Mono',monospace", transition:"all 0.2s"
                }}>{s.toUpperCase()}</button>
              ))}
            </div>

            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:8 }}>
              {filtered.map(b => (
                <div key={b.id} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, flexShrink:0 }}>
                  <button onClick={() => setSelectedBeach(b)} style={{
                    background: selectedBeach.id===b.id ? "rgba(0,191,255,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${selectedBeach.id===b.id?"rgba(0,191,255,0.5)":"rgba(255,255,255,0.08)"}`,
                    borderRadius:100, padding:"8px 16px",
                    color: selectedBeach.id===b.id ? "#00bfff" : "rgba(255,255,255,0.5)",
                    fontFamily:"'Bebas Neue',sans-serif", fontSize:13, letterSpacing:2,
                    cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.2s",
                    boxShadow: selectedBeach.id===b.id ? "0 0 14px rgba(0,191,255,0.2)" : "none"
                  }}>
                    {b.name}{favorites.includes(b.id) ? " ★" : ""}
                  </button>
                  <div style={{ fontSize:8, color:LEVEL_COLORS[b.level]??"#888", letterSpacing:1 }}>
                    {b.level.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4, flexWrap:"wrap" }}>
              <div style={{ fontSize:9, color:LEVEL_COLORS[beach.level]??"#888", background:"rgba(255,255,255,0.04)", border:`1px solid ${LEVEL_COLORS[beach.level]??"#888"}40`, borderRadius:20, padding:"3px 10px", letterSpacing:1 }}>{beach.level.toUpperCase()}</div>
              <div style={{ fontSize:9, color:"rgba(255,255,255,0.2)", letterSpacing:1 }}>{beach.side}</div>
              {beach.rip  && <div style={{ fontSize:9, color:"rgba(251,191,36,0.6)",  letterSpacing:1 }}>⚡ Rip-prone</div>}
              {beach.kelp && <div style={{ fontSize:9, color:"rgba(167,139,250,0.6)", letterSpacing:1 }}>🌿 Kelp</div>}
              {SHARK_BEACHES.includes(beach.id) && <div style={{ fontSize:9, color:"rgba(248,113,113,0.6)", letterSpacing:1 }}>🦈 Shark Spotters</div>}
              <button onClick={() => toggleFav(beach.id)} style={{
                background:"none", border:"none", cursor:"pointer", fontSize:12, marginLeft:"auto",
                color: favorites.includes(beach.id) ? "#fbbf24" : "rgba(255,255,255,0.2)", transition:"all 0.2s"
              }}>{favorites.includes(beach.id) ? "★ Saved" : "☆ Save"}</button>
            </div>
          </div>

          {/* ── LOADING ─────────────────────────────────────────────────────── */}
          {loading && (
            <div style={{ textAlign:"center", padding:"60px 0", color:"rgba(255,255,255,0.25)" }}>
              <div style={{ fontSize:34, marginBottom:14, display:"inline-block", animation:"spin 1.5s linear infinite" }}>🌊</div>
              <div style={{ fontSize:10, letterSpacing:4 }}>FETCHING CONDITIONS…</div>
            </div>
          )}

          {error && (
            <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:12, padding:"14px 18px", color:"#fca5a5", fontSize:11, letterSpacing:1 }}>⚠ {error}</div>
          )}

          {/* ── CONTENT ─────────────────────────────────────────────────────── */}
          {data && !loading && (
            <div className="anim-up">

              {/* TABS */}
              <div style={{ display:"flex", gap:3, marginBottom:16, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:4 }}>
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                    flex:1, padding:"9px 0", borderRadius:10, border:"none", cursor:"pointer", transition:"all 0.2s",
                    background: activeTab===t.id ? "rgba(0,191,255,0.15)" : "none",
                    color: activeTab===t.id ? "#00bfff" : "rgba(255,255,255,0.3)",
                    fontFamily:"'Bebas Neue',sans-serif", fontSize:12, letterSpacing:1.5,
                  }}>{t.label}</button>
                ))}
              </div>

              {/* ══ NOW ════════════════════════════════════════════════════════ */}
              {activeTab === "now" && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <DecisionBadge data={data} beach={beach}/>

                  {/* Best session */}
                  <div style={{ background:"rgba(0,191,255,0.05)", border:"1px solid rgba(0,191,255,0.18)", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:9, color:"rgba(0,191,255,0.55)", letterSpacing:3, marginBottom:4 }}>⏱ BEST SESSION TODAY</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:"#00bfff", letterSpacing:2 }}>{fmt(data.bestStart)} – {fmt(data.bestEnd)}</div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", letterSpacing:2, marginBottom:4 }}>RATING</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:getRatingLabel(data.bestScore).color, letterSpacing:2 }}>
                        {getRatingLabel(data.bestScore).emoji} {getRatingLabel(data.bestScore).label.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
                    <Tile icon="🌊" label="Wave Height" value={data.waveHeight.toFixed(1)} unit="m"
                      sub={data.waveHeight >= beach.idealWave[0] && data.waveHeight <= beach.idealWave[1] ? "In ideal range ✓" : data.waveHeight < beach.idealWave[0] ? `Ideal: ${beach.idealWave[0]}m+` : `Ideal: <${beach.idealWave[1]}m`} accent/>
                    <Tile icon="⏱" label="Swell Period" value={data.swellPeriod.toFixed(0)} unit="sec"
                      sub={data.swellPeriod>=12?"Long — quality waves":data.swellPeriod>=8?"Medium period":"Short — bumpy"}/>
                    <Tile icon="💨" label="Wind" value={data.windSpeed.toFixed(0)} unit="km/h"
                      sub={`${windCompass} — ${windState?.state??""}`}/>
                    <Tile icon="🧭" label="Swell Dir" value={waveCompass} sub={`${data.waveDir.toFixed(0)}°`}/>
                    <Tile icon="🌤" label="Air Temp" value={data.temp.toFixed(0)} unit="°C" sub={`Cloud ${data.cloud}%`}/>
                    <Tile icon="🌊" label="Water Temp" value={data.waterTemp} unit="°C"
                      sub={waterTempLive ? "Live SST ✓" : "Seasonal avg"} accent={!!waterTempLive}/>
                    <Tile icon="🔆" label="UV Index" value={data.uv?.toFixed(0)??"-"}
                      sub={data.uv>=8?"Very High 🔥":data.uv>=5?"Moderate — SPF 30+":"Low"}/>
                    <Tile icon="🌧" label="Rain Chance" value={data.rain} unit="%" sub={data.rain>60?"Pack a towel":"Likely dry"}/>
                    <Tile icon="🌙" label="Tide" value={data.tideLevel.toFixed(2)} unit="m" sub={data.tideState} accent/>
                    <Tile icon={getRipRisk(beach,data.waveHeight,data.tideLevel,data.tideState).icon}
                      label="Rip Risk" value={getRipRisk(beach,data.waveHeight,data.tideLevel,data.tideState).level}
                      sub={getRipRisk(beach,data.waveHeight,data.tideLevel,data.tideState).tip.slice(0,40)+"…"}/>
                  </div>

                  {/* Wind card */}
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"14px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <WindArrow deg={data.windDir} size={62} color={windState?.color??"#00bfff"}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:4 }}>WIND</div>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:2, lineHeight:1 }}>{windCompass}</div>
                        <div style={{ fontSize:10, color:windState?.color, marginTop:4 }}>
                          {windState?.icon} {windState?.state} — {windState?.sub}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:4 }}>SWELL</div>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, letterSpacing:2, lineHeight:1 }}>{waveCompass}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4 }}>{data.waveDir.toFixed(0)}°</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ FORECAST ═══════════════════════════════════════════════════ */}
              {activeTab === "forecast" && (
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  <div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>📅 5-DAY OUTLOOK</div>
                    <WeekOutlook hourly={hourlyRaw} beach={beach}/>
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>NEXT 12 HOURS</div>
                    <ForecastStrip hourly={hourlyRaw} currentHour={currentHour} beach={beach}/>
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 18px" }}>
                    <div style={{ fontSize:9, color:"rgba(167,139,250,0.7)", letterSpacing:3, marginBottom:12 }}>📈 48H WAVE HEIGHT</div>
                    <SwellChart hourly={hourlyRaw} currentHour={currentHour}/>
                  </div>
                </div>
              )}

              {/* ══ TIDES ══════════════════════════════════════════════════════ */}
              {activeTab === "tides" && (
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 18px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                      <div style={{ fontSize:9, color:"rgba(0,191,255,0.6)", letterSpacing:3 }}>🌙 48H TIDAL CHART</div>
                      <div style={{ fontSize:8, color:"#00ff87", letterSpacing:1 }}>Harmonic model ✓</div>
                    </div>
                    <TideChart curve={data.tides} currentHour={currentHour}/>
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>UPCOMING HIGHS & LOWS</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {findTideExtremes(data.tides).slice(0,6).map((e,i) => {
                        const hh = e.hour < 24 ? `${String(e.hour).padStart(2,"0")}:00` : `Tomorrow ${String(e.hour-24).padStart(2,"0")}:00`;
                        return (
                          <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 16px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                              <span style={{ fontSize:18 }}>{e.type==="High"?"🌊":"🏖️"}</span>
                              <div>
                                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:17, color:e.type==="High"?"#00bfff":"#fbbf24", letterSpacing:2 }}>{e.type} Tide</div>
                                <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>{hh}</div>
                              </div>
                            </div>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"#fff" }}>{e.height.toFixed(2)}m</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ══ SAFETY ═════════════════════════════════════════════════════ */}
              {activeTab === "safety" && <SafetyPanel data={data} beach={beach}/>}

              {/* ══ GEAR ═══════════════════════════════════════════════════════ */}
              {activeTab === "gear" && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {/* Wetsuit */}
                  <div style={{ background:`${data.wetsuit.color}12`, border:`1px solid ${data.wetsuit.color}40`, borderRadius:16, padding:"18px" }}>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>🤿 WETSUIT RECOMMENDATION</div>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ fontSize:42, flexShrink:0 }}>{data.wetsuit.icon}</div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:data.wetsuit.color, letterSpacing:2, lineHeight:1.1 }}>{data.wetsuit.suit}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:4 }}>
                          Water {data.waterTemp}°C {waterTempLive?"(live SST)":"(seasonal)"} · wind chill applied
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Board rec per beach */}
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 18px" }}>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:12 }}>🏄 BOARD FOR THIS BREAK</div>
                    {(() => {
                      const wh = data.waveHeight;
                      const [lo, hi] = beach.idealWave;
                      let board, reason;
                      if (wh < 0.4)         { board="Longboard / Foamie";       reason="Flat — grab the log and have fun."; }
                      else if (wh < lo*0.8) { board="Funboard / Longboard";     reason="Small for this break — go for volume."; }
                      else if (wh <= hi)    { board=beach.level==="Advanced"||beach.level==="Inter/Advanced"?"Shortboard / Step-up":"Fish / Mid-length"; reason=`In the ideal window for ${beach.name}.`; }
                      else if (wh <= hi*1.4){ board="Step-up";                  reason="Bigger than ideal — length and paddle power matter."; }
                      else                  { board="Gun";                       reason="Big surf — don't underboard this break."; }
                      return (
                        <div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"#00bfff", letterSpacing:2, marginBottom:6 }}>{board}</div>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{reason}</div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* UV */}
                  <div style={{ background:data.uv>=6?"rgba(251,191,36,0.07)":"rgba(255,255,255,0.03)", border:`1px solid ${data.uv>=6?"rgba(251,191,36,0.3)":"rgba(255,255,255,0.07)"}`, borderRadius:14, padding:"14px 16px" }}>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>🔆 SUN PROTECTION</div>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:data.uv>=8?"#f87171":data.uv>=5?"#fbbf24":"#4ade80", flexShrink:0 }}>UV {data.uv?.toFixed(0)??"-"}</div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12, color:"#fff", marginBottom:4, lineHeight:1.3 }}>{data.uv>=8?"SPF 50+ — reapply every hour":data.uv>=5?"SPF 30+ recommended":data.uv>=3?"Light protection needed":"Low UV"}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>{data.uv>=6?"Wear a rashguard or UV-50 lycra.":"Still wear sunscreen on the water."}</div>
                      </div>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 18px" }}>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:14 }}>📋 SESSION CHECKLIST</div>
                    {[
                      { item: data.wetsuit.suit,            icon: data.wetsuit.icon, show: true },
                      { item: "Sunscreen SPF 50+",           icon: "☀️",             show: true },
                      { item: "Leash",                       icon: "🔗",             show: true },
                      { item: "Wax / Traction pad",          icon: "🏄",             show: true },
                      { item: "Boots + Hood",                icon: "🥾",             show: data.waterTemp < 14 },
                      { item: "Rain jacket",                 icon: "🌧",             show: data.rain > 60 },
                      { item: "Towel + warm layers",         icon: "🏖️",            show: true },
                      { item: "Water bottle",                icon: "💧",             show: true },
                      { item: "Check sharkspotters.org.za",  icon: "🦈",             show: SHARK_BEACHES.includes(beach.id) },
                    ].filter(g => g.show).map((g, i, arr) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}>
                        <span style={{ fontSize:17, flexShrink:0 }}>{g.icon}</span>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)", flex:1, minWidth:0 }}>{g.item}</span>
                        <span style={{ color:"#4ade80", fontSize:13, flexShrink:0 }}>✓</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FOOTER */}
              <div style={{ marginTop:18, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:8, color:"rgba(255,255,255,0.15)", letterSpacing:2, marginBottom:8 }}>DATA SOURCES</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {[
                    "WAVES: Open-Meteo Marine ✓",
                    "WIND: Open-Meteo Live ✓",
                    `WATER TEMP: ${waterTempLive ? "Copernicus SST ✓" : "Seasonal model"}`,
                    "TIDES: Harmonic Model ✓",
                    "UV: Open-Meteo Live ✓",
                  ].map(s => (
                    <div key={s} style={{ fontSize:8, color:"#00ff87", background:"rgba(0,255,135,0.05)", border:"1px solid rgba(0,255,135,0.1)", borderRadius:4, padding:"2px 8px", letterSpacing:1 }}>{s}</div>
                  ))}
                </div>
                <div style={{ marginTop:8, fontSize:8, color:"rgba(255,255,255,0.1)", letterSpacing:1 }}>
                  {beach.lat}°S · {Math.abs(beach.lon)}°E · Auto-refreshes every 60s
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}
