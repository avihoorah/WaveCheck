import { useState, useEffect, useCallback, useRef } from "react";

// ─── TIDE MODEL ───────────────────────────────────────────────────────────────
const TIDE_CONSTITUENTS = [
  { name: "M2", amplitude: 0.76, speed: 28.9841, phase: 160 },
  { name: "S2", amplitude: 0.25, speed: 30.0000, phase: 195 },
  { name: "N2", amplitude: 0.15, speed: 28.4397, phase: 140 },
  { name: "K1", amplitude: 0.10, speed: 15.0411, phase: 220 },
  { name: "O1", amplitude: 0.08, speed: 13.9430, phase: 185 },
  { name: "K2", amplitude: 0.07, speed: 30.0821, phase: 195 },
];
const TIDE_Z0 = 0.82;
const EPOCH_MS = Date.UTC(2000, 0, 1, 0, 0, 0);

function predictTide(dateObj) {
  const t = (dateObj.getTime() - EPOCH_MS) / 3600000;
  let h = TIDE_Z0;
  for (const c of TIDE_CONSTITUENTS) h += c.amplitude * Math.cos((c.speed * t - c.phase) * (Math.PI / 180));
  return h;
}

function buildTideCurve48h(startDate) {
  const pts = [];
  for (let h = 0; h < 48; h++) {
    const d = new Date(startDate);
    d.setHours(0, 0, 0, 0);
    d.setHours(h);
    pts.push({ hour: h, height: predictTide(d), date: new Date(d) });
  }
  return pts;
}

function findTideExtremes(curve) {
  const extremes = [];
  for (let i = 1; i < curve.length - 1; i++) {
    const prev = curve[i - 1].height, curr = curve[i].height, next = curve[i + 1].height;
    if (curr > prev && curr > next) extremes.push({ ...curve[i], type: "High" });
    else if (curr < prev && curr < next) extremes.push({ ...curve[i], type: "Low" });
  }
  return extremes;
}

// ─── WATER TEMP MODEL ─────────────────────────────────────────────────────────
const WATER_TEMP_BY_MONTH = [18, 18, 17, 16, 15, 14, 13, 13, 14, 15, 16, 17];

// ─── WETSUIT RECOMMENDER ──────────────────────────────────────────────────────
function getWetsuit(waterTemp, windSpeed) {
  const chill = waterTemp - windSpeed * 0.3;
  if (chill < 10) return { suit: "5/4mm Hood + Boots", icon: "🥶", color: "#60a5fa" };
  if (chill < 13) return { suit: "4/3mm Full Suit", icon: "🧊", color: "#93c5fd" };
  if (chill < 16) return { suit: "3/2mm Full Suit", icon: "🌊", color: "#6ee7b7" };
  if (chill < 19) return { suit: "Springsuit / Shorty", icon: "👙", color: "#fde68a" };
  return { suit: "Board Shorts", icon: "🏄", color: "#fca5a5" };
}

// ─── BEACHES ──────────────────────────────────────────────────────────────────
const BEACHES = [
  { id: "muizenberg",   name: "Muizenberg",           lat: -34.1075, lon: 18.4711, level: "Beginner",       side: "False Bay",  goodWind: ["NW","N","NNW","WNW","W"] },
  { id: "st_james",     name: "St James",              lat: -34.1178, lon: 18.4547, level: "Beginner/Inter", side: "False Bay",  goodWind: ["NW","N","W","NNW"] },
  { id: "kalk_bay",     name: "Kalk Bay Reef",         lat: -34.1280, lon: 18.4430, level: "Advanced",       side: "False Bay",  goodWind: ["NW","N","NNW","W"] },
  { id: "fish_hoek",    name: "Fish Hoek",             lat: -34.1382, lon: 18.4279, level: "Beginner/Inter", side: "False Bay",  goodWind: ["NW","N","W","NNW"] },
  { id: "clovelly",     name: "Clovelly",              lat: -34.1333, lon: 18.4167, level: "Intermediate",   side: "False Bay",  goodWind: ["NW","N","W"] },
  { id: "llandudno",    name: "Llandudno",             lat: -34.0058, lon: 18.3478, level: "Intermediate",   side: "Atlantic",   goodWind: ["SE","SSE","S","ESE"] },
  { id: "glen_beach",   name: "Glen Beach",            lat: -33.9486, lon: 18.3756, level: "Advanced",       side: "Atlantic",   goodWind: ["SE","SSE","S"] },
  { id: "camps_bay",    name: "Camps Bay",             lat: -33.9500, lon: 18.3764, level: "Beginner/Inter", side: "Atlantic",   goodWind: ["SE","SSE","E","ESE"] },
  { id: "pebbles",      name: "Pebbles",               lat: -33.9800, lon: 18.3600, level: "Bodyboard",      side: "Atlantic",   goodWind: ["SE","SSE","S","E"] },
  { id: "off_the_wall", name: "Off The Wall",          lat: -33.9050, lon: 18.4050, level: "Advanced",       side: "Atlantic",   goodWind: ["SE","S","SSE"] },
  { id: "bigbay",       name: "Big Bay",               lat: -33.7942, lon: 18.4595, level: "All levels",     side: "West Coast", goodWind: ["SE","SSE","S","E"] },
  { id: "blouberg",     name: "Bloubergstrand",        lat: -33.8078, lon: 18.4756, level: "All levels",     side: "West Coast", goodWind: ["SE","S","SSE","E"] },
  { id: "kommetjie",    name: "Long Beach",            lat: -34.1389, lon: 18.3278, level: "Intermediate",   side: "Peninsula",  goodWind: ["SE","SSE","NE","E"] },
  { id: "noordhoek",    name: "Noordhoek / The Hoek",  lat: -34.1050, lon: 18.3600, level: "Advanced",       side: "Peninsula",  goodWind: ["SE","SSE","NE"] },
  { id: "scarborough",  name: "Scarborough",           lat: -34.2000, lon: 18.3750, level: "Inter/Advanced", side: "Peninsula",  goodWind: ["SE","SSE","NE","E"] },
];

const LEVEL_COLORS = {
  "Beginner": "#4ade80", "Beginner/Inter": "#86efac", "Intermediate": "#fbbf24",
  "Inter/Advanced": "#fb923c", "Advanced": "#f87171", "Bodyboard": "#a78bfa", "All levels": "#60a5fa"
};

const WIND_DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function degToCompass(deg) { return WIND_DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }

function isOffshoreForBeach(beach, windCompass) {
  return beach.goodWind.includes(windCompass);
}

function waveRating(waveHeight, swellPeriod, windSpeed, windDir, beach) {
  let score = 0;
  if (waveHeight >= 0.8 && waveHeight <= 1.5) score += 30;
  else if (waveHeight > 1.5 && waveHeight <= 2.5) score += 25;
  else if (waveHeight > 0.5 && waveHeight < 0.8) score += 15;
  else if (waveHeight > 2.5 && waveHeight <= 3.5) score += 10;
  else if (waveHeight > 3.5) score += 5;
  if (swellPeriod >= 14) score += 30;
  else if (swellPeriod >= 12) score += 25;
  else if (swellPeriod >= 10) score += 20;
  else if (swellPeriod >= 8) score += 12;
  else score += 5;
  if (windSpeed < 8) score += 25;
  else if (windSpeed < 15) score += 18;
  else if (windSpeed < 20) score += 10;
  else if (windSpeed < 28) score += 5;
  const wc = degToCompass(windDir);
  if (beach && isOffshoreForBeach(beach, wc)) score += 20;
  else if (!beach) {
    if (wc.includes("SE") || wc.includes("S")) score += 20;
  }
  return Math.min(score, 100);
}

function getRatingLabel(score) {
  if (score >= 80) return { emoji: "🔥", label: "Epic",      color: "#00ff87", bg: "rgba(0,255,135,0.08)" };
  if (score >= 60) return { emoji: "⚡", label: "Good",      color: "#7fff6b", bg: "rgba(127,255,107,0.08)" };
  if (score >= 40) return { emoji: "👌", label: "Fair",      color: "#fbbf24", bg: "rgba(251,191,36,0.08)" };
  return              { emoji: "💤", label: "Poor",      color: "#f87171", bg: "rgba(248,113,113,0.08)" };
}

function getCrowdEstimate(beach, hour, rating, isWeekend) {
  if (rating < 35) return { level: "Empty", color: "#4ade80", icon: "🏖️" };
  const peakHours = hour >= 7 && hour <= 10 || hour >= 14 && hour <= 17;
  const beginner = beach.level.includes("Beginner");
  if (beginner && peakHours && isWeekend && rating > 55) return { level: "Busy", color: "#f87171", icon: "👥" };
  if (peakHours && isWeekend) return { level: "Moderate", color: "#fbbf24", icon: "🧍" };
  if (peakHours || isWeekend) return { level: "Quiet", color: "#86efac", icon: "🧘" };
  return { level: "Empty", color: "#4ade80", icon: "🏖️" };
}

// ─── ANIMATED WAVE BG ─────────────────────────────────────────────────────────
function WaveBg() {
  return (
    <svg style={{ position:"fixed", bottom:0, left:0, width:"100%", height:220, opacity:0.06, pointerEvents:"none", zIndex:0 }} viewBox="0 0 1440 220" preserveAspectRatio="none">
      <defs>
        <style>{`
          @keyframes waveAnim1{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
          @keyframes waveAnim2{0%{transform:translateX(-50%)}100%{transform:translateX(0)}}
          .w1{animation:waveAnim1 14s linear infinite}
          .w2{animation:waveAnim2 10s linear infinite}
        `}</style>
      </defs>
      <g className="w1">
        <path d="M0,120 C180,60 360,180 540,120 C720,60 900,180 1080,120 C1260,60 1440,180 1620,120 C1800,60 1980,180 2160,120 L2160,220 L0,220 Z" fill="#00bfff"/>
      </g>
      <g className="w2">
        <path d="M0,150 C200,90 400,200 600,150 C800,100 1000,200 1200,150 C1400,100 1600,200 1800,150 L1800,220 L0,220 Z" fill="#0070ff" opacity="0.5"/>
      </g>
    </svg>
  );
}

// ─── WIND ARROW ───────────────────────────────────────────────────────────────
function WindArrow({ deg, size = 64, color = "#00bfff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" style={{ filter:`drop-shadow(0 0 6px ${color}50)` }}>
      <circle cx="36" cy="36" r="33" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
      {["N","E","S","W"].map((d, i) => (
        <text key={d} x={36 + 24*Math.sin(i*Math.PI/2)} y={36 - 24*Math.cos(i*Math.PI/2)+4}
          textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="7" fontFamily="monospace">{d}</text>
      ))}
      <g transform={`rotate(${deg}, 36, 36)`}>
        <polygon points="36,8 40.5,42 36,38 31.5,42" fill={color}/>
        <polygon points="36,64 40.5,42 36,46 31.5,42" fill={`${color}30`}/>
      </g>
    </svg>
  );
}

// ─── TIDE CHART (48h) ─────────────────────────────────────────────────────────
function TideChart48h({ curve, currentHour }) {
  const w = 680, h = 90;
  const heights = curve.map(p => p.height);
  const min = Math.min(...heights), max = Math.max(...heights);
  const scaleY = v => h - 8 - ((v - min) / (max - min)) * (h - 16);
  const scaleX = i => (i / (curve.length - 1)) * w;
  const pts = curve.map((p, i) => `${scaleX(i)},${scaleY(p.height)}`).join(" ");
  const fillPts = `0,${h} ${pts} ${w},${h}`;
  const nowX = scaleX(currentHour);
  const extremes = findTideExtremes(curve);

  return (
    <div style={{ overflowX:"auto", overflowY:"hidden", WebkitOverflowScrolling:"touch", marginLeft:-4, paddingLeft:4 }}>
      <svg width={w} height={h + 24} viewBox={`0 0 ${w} ${h + 24}`} style={{ display:"block" }}>
        <defs>
          <linearGradient id="tideGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00bfff" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#00bfff" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0,6,12,18,24,30,36,42,48].map(h24 => (
          <g key={h24}>
            <line x1={scaleX(h24)} y1="0" x2={scaleX(h24)} y2={h} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <text x={scaleX(h24)+3} y={h+14} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">
              {h24 < 24 ? `${String(h24).padStart(2,"0")}h` : `+${h24-24}h`}
            </text>
          </g>
        ))}
        {/* Fill */}
        <polygon points={fillPts} fill="url(#tideGrad)"/>
        {/* Line */}
        <polyline points={pts} fill="none" stroke="#00bfff" strokeWidth="2" strokeLinejoin="round"/>
        {/* Extremes labels */}
        {extremes.slice(0, 8).map((e, i) => (
          <g key={i}>
            <circle cx={scaleX(e.hour)} cy={scaleY(e.height)} r="3" fill={e.type==="High"?"#00bfff":"#0050aa"}/>
            <text x={scaleX(e.hour)} y={e.type==="High" ? scaleY(e.height)-7 : scaleY(e.height)+14}
              textAnchor="middle" fill={e.type==="High"?"#00bfff":"#5588cc"} fontSize="7" fontFamily="monospace">
              {e.height.toFixed(1)}m
            </text>
          </g>
        ))}
        {/* Now line */}
        {currentHour < curve.length && (
          <>
            <line x1={nowX} y1="0" x2={nowX} y2={h} stroke="#00ff87" strokeWidth="1.5" strokeDasharray="3,2"/>
            <text x={nowX+4} y="10" fill="#00ff87" fontSize="7" fontFamily="monospace">NOW</text>
          </>
        )}
        {/* Day marker */}
        <line x1={scaleX(24)} y1="0" x2={scaleX(24)} y2={h} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,2"/>
        <text x={scaleX(24)+4} y={h+14} fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="monospace">Tomorrow</text>
      </svg>
    </div>
  );
}

// ─── SWELL FORECAST CHART ─────────────────────────────────────────────────────
function SwellChart({ hourly, currentHour }) {
  if (!hourly) return null;
  const w = 680, h = 80;
  const data = Array.from({ length: 48 }, (_, i) => ({
    hour: i,
    wh: hourly.wave_height?.[i] ?? 0,
    wp: hourly.wave_period?.[i] ?? 0,
  }));
  const maxH = Math.max(...data.map(d => d.wh), 0.5);
  const scaleY = v => h - 8 - (v / maxH) * (h - 16);
  const scaleX = i => (i / (data.length - 1)) * w;
  const pts = data.map((d, i) => `${scaleX(i)},${scaleY(d.wh)}`).join(" ");
  const fill = `0,${h} ${pts} ${w},${h}`;
  const nowX = scaleX(currentHour);

  return (
    <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", marginLeft:-4, paddingLeft:4 }}>
      <svg width={w} height={h + 24} viewBox={`0 0 ${w} ${h + 24}`} style={{ display:"block" }}>
        <defs>
          <linearGradient id="swellGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        {[0,6,12,18,24,30,36,42,48].map(hh => (
          <g key={hh}>
            <line x1={scaleX(hh)} y1="0" x2={scaleX(hh)} y2={h} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <text x={scaleX(hh)+3} y={h+14} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">
              {hh < 24 ? `${String(hh).padStart(2,"0")}h` : `+${hh-24}h`}
            </text>
          </g>
        ))}
        <polygon points={fill} fill="url(#swellGrad)"/>
        <polyline points={pts} fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinejoin="round"/>
        {data.filter((_, i) => i % 6 === 0).map((d, i) => (
          <text key={i} x={scaleX(d.hour)} y={scaleY(d.wh) - 5}
            textAnchor="middle" fill="rgba(167,139,250,0.7)" fontSize="7" fontFamily="monospace">
            {d.wh.toFixed(1)}m
          </text>
        ))}
        {currentHour < data.length && (
          <line x1={nowX} y1="0" x2={nowX} y2={h} stroke="#00ff87" strokeWidth="1.5" strokeDasharray="3,2"/>
        )}
        <line x1={scaleX(24)} y1="0" x2={scaleX(24)} y2={h} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4,2"/>
        <text x={scaleX(24)+4} y={h+14} fill="rgba(255,255,255,0.35)" fontSize="8" fontFamily="monospace">Tomorrow</text>
      </svg>
    </div>
  );
}

// ─── SCORE RING ───────────────────────────────────────────────────────────────
function ScoreRing({ score, color, size = 96 }) {
  const r = 38, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
      <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
        strokeLinecap="round" transform="rotate(-90 48 48)"
        style={{ transition:"stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)", filter:`drop-shadow(0 0 6px ${color})` }}/>
      <text x="48" y="53" textAnchor="middle" fill="#fff" fontSize="22" fontFamily="'Bebas Neue',sans-serif">{score}</text>
    </svg>
  );
}

// ─── STAT TILE ────────────────────────────────────────────────────────────────
function Tile({ icon, label, value, unit, sub, accent, wide }) {
  return (
    <div style={{
      background: accent ? `rgba(0,191,255,0.06)` : "rgba(255,255,255,0.03)",
      border: `1px solid ${accent ? "rgba(0,191,255,0.2)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 14, padding: "14px 14px",
      gridColumn: wide ? "span 2" : "span 1",
      display:"flex", flexDirection:"column", gap:5
    }}>
      <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:1.5, textTransform:"uppercase", fontFamily:"'Space Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {icon} {label}
      </div>
      <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
        <span style={{ fontSize:24, fontFamily:"'Bebas Neue',sans-serif", color: accent ? "#00bfff" : "#fff", lineHeight:1.1, wordBreak:"break-all" }}>{value}</span>
        {unit && <span style={{ fontSize:12, color:"rgba(255,255,255,0.35)", fontFamily:"'Space Mono',monospace" }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize:10, color:"rgba(255,255,255,0.28)", fontFamily:"'Space Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sub}</div>}
    </div>
  );
}

// ─── BEACH PILL ───────────────────────────────────────────────────────────────
function BeachPill({ beach, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: selected ? "rgba(0,191,255,0.15)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${selected ? "rgba(0,191,255,0.5)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 100, padding: "8px 16px",
      color: selected ? "#00bfff" : "rgba(255,255,255,0.5)",
      fontFamily:"'Bebas Neue',sans-serif", fontSize:14, letterSpacing:2,
      cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
      transition:"all 0.2s", boxShadow: selected ? "0 0 12px rgba(0,191,255,0.2)" : "none"
    }}>
      {beach.name}
    </button>
  );
}

// ─── DECISION BADGE ───────────────────────────────────────────────────────────
function DecisionBadge({ data, beach, now }) {
  if (!data) return null;
  const r = getRatingLabel(data.rating);
  const wc = degToCompass(data.windDir);
  const offshore = isOffshoreForBeach(beach, wc);
  const goodTide = data.tideLevel > 0.7 && data.tideLevel < 1.6;
  const goodWave = data.waveHeight > 0.6 && data.waveHeight < 3.5;
  const goodWind = data.windSpeed < 25;
  const goCount = [offshore, goodTide, goodWave, goodWind].filter(Boolean).length;

  let decision, emoji, color, reasons;
  if (goCount === 4 || (goCount >= 3 && data.rating >= 60)) {
    decision = "PADDLE OUT"; emoji = "🤙"; color = "#00ff87";
    reasons = "Conditions are firing. Don't miss this one.";
  } else if (goCount >= 2 && data.rating >= 40) {
    decision = "WORTH IT"; emoji = "👍"; color = "#fbbf24";
    reasons = `${!offshore?"Onshore wind is the weak point.":""} ${!goodTide?"Tide's not ideal.":""}`.trim() || "Decent session ahead.";
  } else {
    decision = "STAY HOME"; emoji = "🛋️"; color = "#f87171";
    reasons = data.waveHeight < 0.5 ? "Flat as a lake." : data.windSpeed > 30 ? "Too windy — howling onshore." : "Multiple factors working against you today.";
  }

  return (
    <div style={{
      background: `${color}10`, border:`2px solid ${color}40`,
      borderRadius:20, padding:"20px", marginBottom:14,
      position:"relative", overflow:"hidden"
    }}>
      <div style={{ position:"absolute", top:-40, right:-40, width:160, height:160,
        background:`radial-gradient(circle,${color}20,transparent 70%)`, pointerEvents:"none" }}/>
      <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>SHOULD YOU SURF?</div>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ fontSize:40, flexShrink:0 }}>{emoji}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:34, color, lineHeight:1, letterSpacing:2 }}>{decision}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginTop:4, lineHeight:1.4 }}>{reasons}</div>
        </div>
        <div style={{ flexShrink:0 }}>
          <ScoreRing score={data.rating} color={r.color} size={76}/>
        </div>
      </div>
    </div>
  );
}

// ─── FORECAST HOUR ROW ────────────────────────────────────────────────────────
function ForecastStrip({ hourly, currentHour, beach }) {
  if (!hourly) return null;
  const hours = Array.from({ length: 12 }, (_, i) => currentHour + i).filter(h => h < 48);
  return (
    <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:8 }}>
      {hours.map(h => {
        const wh = hourly.wave_height?.[h] ?? 0;
        const wp = hourly.wave_period?.[h] ?? 0;
        const ws = hourly.wind_speed_10m?.[h] ?? 0;
        const wd = hourly.wind_direction_10m?.[h] ?? 0;
        const score = waveRating(wh, wp, ws, wd, beach);
        const r = getRatingLabel(score);
        const isNow = h === currentHour;
        const label = h < 24 ? `${String(h).padStart(2,"0")}:00` : `+${h-24}h`;
        return (
          <div key={h} style={{
            background: isNow ? "rgba(0,191,255,0.12)" : "rgba(255,255,255,0.03)",
            border:`1px solid ${isNow?"rgba(0,191,255,0.4)":"rgba(255,255,255,0.07)"}`,
            borderRadius:12, padding:"12px 14px", minWidth:80, flexShrink:0, textAlign:"center"
          }}>
            <div style={{ fontSize:9, color: isNow?"#00bfff":"rgba(255,255,255,0.3)", letterSpacing:1, marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:18 }}>{r.emoji}</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:r.color, letterSpacing:1 }}>{wh.toFixed(1)}m</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)" }}>{wp.toFixed(0)}s</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedBeach, setSelectedBeach] = useState(BEACHES[0]);
  const [favorites, setFavorites] = useState(["muizenberg", "bigbay", "llandudno"]);
  const [data, setData] = useState(null);
  const [hourlyRaw, setHourlyRaw] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("now");
  const [sideFilter, setSideFilter] = useState("All");
  const [now] = useState(new Date());
  const currentHour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  const fetchConditions = useCallback(async (beach) => {
    setLoading(true); setError(null); setData(null);
    try {
      const [marineRes, weatherRes] = await Promise.all([
        fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&current=wave_height,wave_period,wave_direction&hourly=wave_height,wave_period,wave_direction&timezone=Africa%2FJohannesburg&forecast_days=2`),
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover,uv_index&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,cloud_cover,uv_index&timezone=Africa%2FJohannesburg&forecast_days=2`)
      ]);
      const marine = await marineRes.json();
      const weather = await weatherRes.json();
      const hr = currentHour;

      const windSpeed  = weather.current?.wind_speed_10m     ?? weather.hourly?.wind_speed_10m?.[hr]     ?? 0;
      const windDir    = weather.current?.wind_direction_10m  ?? weather.hourly?.wind_direction_10m?.[hr]  ?? 0;
      const temp       = weather.current?.temperature_2m     ?? weather.hourly?.temperature_2m?.[hr]      ?? 0;
      const cloud      = weather.current?.cloud_cover        ?? weather.hourly?.cloud_cover?.[hr]         ?? 0;
      const rain       = weather.hourly?.precipitation_probability?.[hr] ?? 0;
      const uv         = weather.current?.uv_index           ?? weather.hourly?.uv_index?.[hr]            ?? 0;

      const tideData   = buildTideCurve48h(now);
      const tideLevel  = tideData[hr]?.height ?? TIDE_Z0;
      const allH       = tideData.map(t => t.height);
      const tideMid    = (Math.max(...allH) + Math.min(...allH)) / 2;
      const tideNext   = tideData[Math.min(hr + 1, 47)]?.height ?? tideLevel;
      const tideState  = tideLevel > tideNext + 0.02
        ? (tideLevel > tideMid ? "High — Falling ↓" : "Falling ↓")
        : tideLevel < tideNext - 0.02
        ? (tideLevel < tideMid ? "Low — Rising ↑" : "Rising ↑")
        : tideLevel > tideMid ? "High Tide" : "Low Tide";

      const waterTemp = WATER_TEMP_BY_MONTH[now.getMonth()];
      const wetsuit = getWetsuit(waterTemp, windSpeed);

      let bestScore = -1, bestStart = hr, bestEnd = Math.min(hr + 2, 47);
      for (let s = hr; s < Math.min(hr + 23, 46); s++) {
        const sc = waveRating(
          marine.hourly?.wave_height?.[s]         ?? 0,
          marine.hourly?.wave_period?.[s]         ?? 0,
          weather.hourly?.wind_speed_10m?.[s]     ?? 0,
          weather.hourly?.wind_direction_10m?.[s] ?? 0, beach
        );
        if (sc > bestScore) { bestScore = sc; bestStart = s; bestEnd = Math.min(s + 2, 47); }
      }

      const hourly48 = {
        wave_height:        [...(marine.hourly?.wave_height ?? [])],
        wave_period:        [...(marine.hourly?.wave_period ?? [])],
        wave_direction:     [...(marine.hourly?.wave_direction ?? [])],
        wind_speed_10m:     [...(weather.hourly?.wind_speed_10m ?? [])],
        wind_direction_10m: [...(weather.hourly?.wind_direction_10m ?? [])],
      };
      setHourlyRaw(hourly48);

      setData({
        waveHeight:  marine.current?.wave_height    ?? marine.hourly?.wave_height?.[hr]    ?? 0,
        swellPeriod: marine.current?.wave_period    ?? marine.hourly?.wave_period?.[hr]    ?? 0,
        waveDir:     marine.current?.wave_direction ?? marine.hourly?.wave_direction?.[hr] ?? 0,
        windSpeed, windDir, temp, cloud, rain, uv,
        tideLevel, tideState, tides: tideData,
        waterTemp, wetsuit,
        rating: waveRating(
          marine.hourly?.wave_height?.[hr] ?? 0,
          marine.hourly?.wave_period?.[hr] ?? 0,
          windSpeed, windDir, beach
        ),
        bestStart, bestEnd, bestScore,
        crowd: getCrowdEstimate(beach, hr, waveRating(
          marine.hourly?.wave_height?.[hr]??0, marine.hourly?.wave_period?.[hr]??0, windSpeed, windDir, beach
        ), isWeekend),
      });
    } catch (e) {
      setError("Couldn't load conditions. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [now, currentHour, isWeekend]);

  useEffect(() => { fetchConditions(selectedBeach); }, [selectedBeach, fetchConditions]);

  const toggleFav = (id) => setFavorites(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const windCompass = data ? degToCompass(data.windDir) : "—";
  const waveCompass = data ? degToCompass(data.waveDir) : "—";
  const offshore = data ? isOffshoreForBeach(selectedBeach, windCompass) : false;
  const fmt = h => h < 24 ? `${String(h).padStart(2,"0")}:00` : `+${h-24}h`;

  const sides = ["All", "False Bay", "Atlantic", "West Coast", "Peninsula"];
  const filteredBeaches = BEACHES.filter(b => sideFilter === "All" || b.side === sideFilter);

  const tabs = [
    { id:"now",      label:"Now" },
    { id:"forecast", label:"Forecast" },
    { id:"tides",    label:"Tides" },
    { id:"gear",     label:"Gear" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#050c16;overflow-x:hidden;max-width:100%;width:100%}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
        select{appearance:none;-webkit-appearance:none;cursor:pointer}
        select option{background:#0d1a27;color:#fff}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .anim-up{animation:slideUp 0.4s ease forwards}
        .live-dot{animation:pulse 2s infinite}
        .tab-btn:hover{opacity:1!important}
        button:focus{outline:none}
        input:focus{outline:none}
        .beach-pill:hover{opacity:0.85}
        .app-wrap{padding:16px 12px}
        @media(min-width:480px){.app-wrap{padding:20px 16px}}
      `}</style>

      <WaveBg/>

      <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#050c16 0%,#081828 60%,#040f1c 100%)", fontFamily:"'Space Mono',monospace", color:"#fff", paddingBottom:60, position:"relative", zIndex:1, overflowX:"hidden", maxWidth:"100vw" }}>

        {/* ── HEADER ── */}
        <div style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, background:"rgba(5,12,22,0.85)", backdropFilter:"blur(20px)", position:"sticky", top:0, zIndex:200 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:"linear-gradient(135deg,#00bfff,#0055ff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, boxShadow:"0 0 20px rgba(0,191,255,0.3)" }}>🌊</div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, letterSpacing:4, lineHeight:1, color:"#fff" }}>WAVECHECK</div>
              <div style={{ fontSize:8, color:"rgba(255,255,255,0.25)", letterSpacing:2 }}>CAPE TOWN · LIVE</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div className="live-dot" style={{ width:6, height:6, borderRadius:"50%", background:"#00ff87" }}/>
              <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:2 }}>LIVE</span>
            </div>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontFamily:"'Bebas Neue',sans-serif", letterSpacing:1 }}>
              {now.toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}
            </span>
          </div>
        </div>

        <div className="app-wrap" style={{ maxWidth:740, margin:"0 auto" }}>

          {/* ── BEACH SELECTOR ── */}
          <div style={{ marginBottom:20 }}>
            {/* Side filters */}
            <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:10, marginBottom:10 }}>
              {sides.map(s => (
                <button key={s} onClick={() => setSideFilter(s)} style={{
                  background: sideFilter===s ? "rgba(0,191,255,0.15)" : "rgba(255,255,255,0.04)",
                  border:`1px solid ${sideFilter===s?"rgba(0,191,255,0.4)":"rgba(255,255,255,0.08)"}`,
                  borderRadius:100, padding:"6px 14px", color: sideFilter===s?"#00bfff":"rgba(255,255,255,0.4)",
                  fontSize:10, letterSpacing:2, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Space Mono',monospace",
                  transition:"all 0.2s"
                }}>{s.toUpperCase()}</button>
              ))}
            </div>

            {/* Beach pills */}
            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:8 }}>
              {filteredBeaches.map(b => (
                <div key={b.id} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, flexShrink:0 }}>
                  <button className="beach-pill" onClick={() => setSelectedBeach(b)} style={{
                    background: selectedBeach.id===b.id ? "rgba(0,191,255,0.15)" : "rgba(255,255,255,0.04)",
                    border:`1px solid ${selectedBeach.id===b.id?"rgba(0,191,255,0.5)":"rgba(255,255,255,0.08)"}`,
                    borderRadius:100, padding:"9px 18px",
                    color: selectedBeach.id===b.id?"#00bfff":"rgba(255,255,255,0.5)",
                    fontFamily:"'Bebas Neue',sans-serif", fontSize:14, letterSpacing:2,
                    cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.2s",
                    boxShadow: selectedBeach.id===b.id ? "0 0 14px rgba(0,191,255,0.2)" : "none"
                  }}>
                    {b.name}
                  </button>
                  <div style={{ fontSize:8, color: LEVEL_COLORS[b.level]??"#888", letterSpacing:1 }}>
                    {b.level.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected beach info bar */}
            {selectedBeach && (
              <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <div style={{ fontSize:9, color: LEVEL_COLORS[selectedBeach.level]||"#888", background:"rgba(255,255,255,0.05)", border:`1px solid ${LEVEL_COLORS[selectedBeach.level]||"#888"}40`, borderRadius:20, padding:"4px 12px", letterSpacing:2 }}>
                  {selectedBeach.level.toUpperCase()}
                </div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", letterSpacing:1 }}>{selectedBeach.side}</div>
                <button onClick={() => toggleFav(selectedBeach.id)} style={{
                  background:"none", border:"none", cursor:"pointer", fontSize:14, marginLeft:"auto",
                  color: favorites.includes(selectedBeach.id) ? "#fbbf24" : "rgba(255,255,255,0.2)",
                  transition:"all 0.2s"
                }}>
                  {favorites.includes(selectedBeach.id) ? "★" : "☆"} {favorites.includes(selectedBeach.id) ? "Saved" : "Save"}
                </button>
              </div>
            )}
          </div>

          {/* ── LOADING ── */}
          {loading && (
            <div style={{ textAlign:"center", padding:"64px 0", color:"rgba(255,255,255,0.25)" }}>
              <div style={{ fontSize:36, marginBottom:16, display:"inline-block", animation:"spin 1.5s linear infinite" }}>🌊</div>
              <div style={{ fontSize:10, letterSpacing:4 }}>FETCHING CONDITIONS…</div>
            </div>
          )}

          {error && (
            <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.25)", borderRadius:12, padding:"16px 20px", color:"#fca5a5", fontSize:11, letterSpacing:1 }}>
              ⚠ {error}
            </div>
          )}

          {/* ── CONTENT ── */}
          {data && !loading && (
            <div className="anim-up">

              {/* ── TABS ── */}
              <div style={{ display:"flex", gap:4, marginBottom:18, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:4 }}>
                {tabs.map(t => (
                  <button key={t.id} className="tab-btn" onClick={() => setActiveTab(t.id)} style={{
                    flex:1, padding:"10px 0", borderRadius:10, border:"none", cursor:"pointer", transition:"all 0.2s",
                    background: activeTab===t.id ? "rgba(0,191,255,0.15)" : "none",
                    color: activeTab===t.id ? "#00bfff" : "rgba(255,255,255,0.35)",
                    fontFamily:"'Bebas Neue',sans-serif", fontSize:15, letterSpacing:2,
                    boxShadow: activeTab===t.id ? "0 0 12px rgba(0,191,255,0.1)" : "none"
                  }}>{t.label}</button>
                ))}
              </div>

              {/* ══ TAB: NOW ══ */}
              {activeTab === "now" && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <DecisionBadge data={data} beach={selectedBeach} now={now}/>

                  {/* Best session */}
                  <div style={{ background:"rgba(0,191,255,0.05)", border:"1px solid rgba(0,191,255,0.18)", borderRadius:14, padding:"16px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:9, color:"rgba(0,191,255,0.55)", letterSpacing:3, marginBottom:4 }}>⏱ BEST SESSION TODAY</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color:"#00bfff", letterSpacing:2 }}>
                        {fmt(data.bestStart)} – {fmt(data.bestEnd)}
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:8, color:"rgba(255,255,255,0.25)", letterSpacing:1, marginBottom:4 }}>RATING</div>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:getRatingLabel(data.bestScore).color, letterSpacing:2 }}>
                        {getRatingLabel(data.bestScore).emoji} {getRatingLabel(data.bestScore).label.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
                    <Tile icon="🌊" label="Wave Height" value={data.waveHeight.toFixed(1)} unit="m"
                      sub={data.waveHeight<0.5?"Flat":data.waveHeight<1?"Small":data.waveHeight<1.8?"Fun size":"Solid"} accent/>
                    <Tile icon="⏱" label="Swell Period" value={data.swellPeriod.toFixed(0)} unit="sec"
                      sub={data.swellPeriod>=12?"Long period ✓":data.swellPeriod>=8?"Medium period":"Short period"}/>
                    <Tile icon="💨" label="Wind Speed" value={data.windSpeed.toFixed(0)} unit="km/h"
                      sub={windCompass + (offshore?" Offshore ✓":" Onshore ✗")}/>
                    <Tile icon="🧭" label="Swell Dir" value={waveCompass} sub={`${data.waveDir.toFixed(0)}°`}/>
                    <Tile icon="🌤" label="Air Temp" value={data.temp.toFixed(0)} unit="°C" sub={`Cloud ${data.cloud}%`}/>
                    <Tile icon="🌊" label="Water Temp" value={data.waterTemp} unit="°C" sub="Seasonal avg"/>
                    <Tile icon="🔆" label="UV Index" value={data.uv?.toFixed(0)??"-"} sub={data.uv>=8?"Very High 🔥":data.uv>=5?"Moderate":"Low"} accent/>
                    <Tile icon="🌧" label="Rain Chance" value={data.rain} unit="%" sub={data.rain>60?"Pack a towel":"Likely dry"}/>
                    <Tile icon="🌙" label="Tide" value={data.tideLevel.toFixed(2)} unit="m" sub={data.tideState} accent/>
                    <Tile icon={data.crowd.icon} label="Crowd Est." value={data.crowd.level} sub={isWeekend?"Weekend":"Weekday"}/>
                  </div>

                  {/* Wind card */}
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"16px 18px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                      <WindArrow deg={data.windDir} size={64} color={offshore?"#00ff87":"#f87171"}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:4 }}>WIND</div>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:30, letterSpacing:2, lineHeight:1 }}>{windCompass}</div>
                        <div style={{ fontSize:10, color: offshore?"#00ff87":"#f87171", marginTop:4 }}>
                          {offshore ? "Offshore ✓ glassy" : "Onshore ✗ choppy"}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:2, marginBottom:4 }}>SWELL</div>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:30, letterSpacing:2, lineHeight:1 }}>{waveCompass}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:4 }}>{data.waveDir.toFixed(0)}°</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ TAB: FORECAST ══ */}
              {activeTab === "forecast" && (
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  <div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>NEXT 12 HOURS — HOURLY</div>
                    <ForecastStrip hourly={hourlyRaw} currentHour={currentHour} beach={selectedBeach}/>
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px" }}>
                    <div style={{ fontSize:9, color:"rgba(167,139,250,0.7)", letterSpacing:3, marginBottom:12 }}>📈 48H WAVE HEIGHT FORECAST</div>
                    <SwellChart hourly={hourlyRaw} currentHour={currentHour}/>
                  </div>
                </div>
              )}

              {/* ══ TAB: TIDES ══ */}
              {activeTab === "tides" && (
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                      <div style={{ fontSize:9, color:"rgba(0,191,255,0.6)", letterSpacing:3 }}>🌙 TIDAL CHART — 48H</div>
                      <div style={{ fontSize:8, color:"#00ff87", letterSpacing:1 }}>Harmonic model ✓</div>
                    </div>
                    <TideChart48h curve={data.tides} currentHour={currentHour}/>
                  </div>

                  {/* Tide extremes list */}
                  <div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>UPCOMING HIGHS & LOWS</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {findTideExtremes(data.tides).slice(0,6).map((e, i) => {
                        const hh = e.hour < 24 ? `${String(e.hour).padStart(2,"0")}:00` : `Tomorrow ${String(e.hour-24).padStart(2,"0")}:00`;
                        return (
                          <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"14px 18px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                              <span style={{ fontSize:18 }}>{e.type==="High"?"🌊":"🏖️"}</span>
                              <div>
                                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:18, color:e.type==="High"?"#00bfff":"#fbbf24", letterSpacing:2 }}>{e.type} Tide</div>
                                <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>{hh}</div>
                              </div>
                            </div>
                            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:"#fff" }}>{e.height.toFixed(2)}m</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ══ TAB: GEAR ══ */}
              {activeTab === "gear" && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {/* Wetsuit */}
                  <div style={{ background:`${data.wetsuit.color}12`, border:`1px solid ${data.wetsuit.color}40`, borderRadius:16, padding:"20px" }}>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>🤿 WETSUIT RECOMMENDATION</div>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ fontSize:44, flexShrink:0 }}>{data.wetsuit.icon}</div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:data.wetsuit.color, letterSpacing:2, lineHeight:1.1 }}>{data.wetsuit.suit}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginTop:4 }}>
                          Water {data.waterTemp}°C · Wind chill applied
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* UV / Sun warning */}
                  <div style={{ background: data.uv>=6?"rgba(251,191,36,0.07)":"rgba(255,255,255,0.03)", border:`1px solid ${data.uv>=6?"rgba(251,191,36,0.3)":"rgba(255,255,255,0.07)"}`, borderRadius:14, padding:"16px 18px" }}>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:10 }}>🔆 SUN PROTECTION</div>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:38, color: data.uv>=8?"#f87171":data.uv>=5?"#fbbf24":"#4ade80", flexShrink:0 }}>UV {data.uv?.toFixed(0)??"-"}</div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12, color:"#fff", marginBottom:4, lineHeight:1.3 }}>
                          {data.uv>=8?"SPF 50+ — reapply every hour":data.uv>=5?"SPF 30+ recommended":data.uv>=3?"Light protection needed":"Low UV today"}
                        </div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)" }}>
                          {data.uv>=6?"Wear a rashguard or UV-50 lycra." : "Still wear sunscreen on the water."}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Gear checklist */}
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px" }}>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:14 }}>📋 SESSION CHECKLIST</div>
                    {[
                      { item: data.wetsuit.suit, icon: data.wetsuit.icon, always: true },
                      { item: "Sunscreen SPF 50+", icon: "☀️", always: true },
                      { item: "Leash", icon: "🔗", always: true },
                      { item: "Wax / Traction pad", icon: "🏄", always: true },
                      { item: "Boots + Hood", icon: "🥾", always: data.waterTemp < 14 },
                      { item: "Rain jacket (high rain chance)", icon: "🌧", always: data.rain > 60 },
                      { item: "Extra towel", icon: "🏖️", always: true },
                      { item: "Water bottle", icon: "💧", always: true },
                    ].map((g, i) => g.always && (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i<7?"1px solid rgba(255,255,255,0.05)":"none" }}>
                        <span style={{ fontSize:18, flexShrink:0 }}>{g.icon}</span>
                        <span style={{ fontSize:12, color:"rgba(255,255,255,0.6)", flex:1, minWidth:0 }}>{g.item}</span>
                        <span style={{ color:"#4ade80", fontSize:14, flexShrink:0 }}>✓</span>
                      </div>
                    ))}
                  </div>

                  {/* Board rec */}
                  <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"18px 20px" }}>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", letterSpacing:3, marginBottom:12 }}>🏄 BOARD RECOMMENDATION</div>
                    {(() => {
                      const wh = data.waveHeight;
                      let board, reason;
                      if (wh < 0.5) { board = "Longboard / Foamie"; reason = "Flat day — grab the log and have fun."; }
                      else if (wh < 1.0) { board = "Funboard / Malibu"; reason = "Small surf — volume is your friend."; }
                      else if (wh < 1.8) { board = "Shortboard / Fish"; reason = "Fun size — ideal for performance surfing."; }
                      else if (wh < 2.8) { board = "Shortboard / Step-up"; reason = "Solid surf — a step-up will give you control."; }
                      else { board = "Gun / Step-up"; reason = "Big surf — make sure your board has enough length."; }
                      return (
                        <div>
                          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:28, color:"#00bfff", letterSpacing:2, marginBottom:6 }}>{board}</div>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{reason}</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* ── DATA SOURCES FOOTER ── */}
              <div style={{ marginTop:20, background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:10, padding:"12px 16px" }}>
                <div style={{ fontSize:8, color:"rgba(255,255,255,0.15)", letterSpacing:2, marginBottom:8 }}>DATA SOURCES</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {["WAVES: Open-Meteo Marine ✓","WIND: Open-Meteo Live ✓","TIDES: Harmonic Model ✓","WATER TEMP: Seasonal Model ✓","UV: Open-Meteo Live ✓"].map(s => (
                    <div key={s} style={{ fontSize:8, color:"#00ff87", background:"rgba(0,255,135,0.05)", border:"1px solid rgba(0,255,135,0.1)", borderRadius:4, padding:"2px 8px", letterSpacing:1 }}>{s}</div>
                  ))}
                </div>
                <div style={{ marginTop:8, fontSize:8, color:"rgba(255,255,255,0.1)", letterSpacing:1 }}>{selectedBeach.lat}°S · {Math.abs(selectedBeach.lon)}°E</div>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}
