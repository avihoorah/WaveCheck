import { useState, useEffect, useCallback } from "react";

const BEACHES = [
  { id: "muizenberg", name: "Muizenberg", lat: -34.1075, lon: 18.4711, windRef: "SE" },
  { id: "bigbay", name: "Big Bay", lat: -33.7942, lon: 18.4595, windRef: "SE" },
  { id: "kommetjie", name: "Kommetjie", lat: -34.1389, lon: 18.3278, windRef: "SE" },
  { id: "blouberg", name: "Bloubergstrand", lat: -33.8078, lon: 18.4756, windRef: "SE" },
  { id: "llandudno", name: "Llandudno", lat: -34.0058, lon: 18.3478, windRef: "SE" },
];

const WIND_DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

function degToCompass(deg) {
  const i = Math.round(deg / 22.5) % 16;
  return WIND_DIRS[i];
}

function waveRating(waveHeight, swellPeriod, windSpeed, windDir, swellDir) {
  let score = 0;
  // Wave height (ideal 1–2.5m for bodyboarding)
  if (waveHeight >= 0.8 && waveHeight <= 1.5) score += 30;
  else if (waveHeight > 1.5 && waveHeight <= 2.5) score += 25;
  else if (waveHeight > 0.5 && waveHeight < 0.8) score += 15;
  else if (waveHeight > 2.5 && waveHeight <= 3.5) score += 10;
  else score += 0;
  // Swell period (ideal > 10s)
  if (swellPeriod >= 12) score += 25;
  else if (swellPeriod >= 10) score += 20;
  else if (swellPeriod >= 8) score += 12;
  else score += 5;
  // Wind speed
  if (windSpeed < 10) score += 25;
  else if (windSpeed < 15) score += 18;
  else if (windSpeed < 20) score += 10;
  else score += 0;
  // Wind direction (offshore = SE for most CT beaches)
  const dir = degToCompass(windDir);
  if (dir.includes("SE") || dir.includes("S")) score += 20;
  else if (dir.includes("E")) score += 10;
  else score += 0;

  return Math.min(score, 100);
}

function getRatingLabel(score) {
  if (score >= 80) return { emoji: "🔥", label: "Epic", color: "#00ff87" };
  if (score >= 60) return { emoji: "👍", label: "Good", color: "#7fff6b" };
  if (score >= 40) return { emoji: "👌", label: "Fair", color: "#f5c842" };
  return { emoji: "👎", label: "Poor", color: "#ff4f4f" };
}

function WindArrow({ deg, size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="17" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <g transform={`rotate(${deg}, 18, 18)`}>
        <polygon points="18,4 22,26 18,23 14,26" fill="#00bfff" opacity="0.9" />
      </g>
    </svg>
  );
}

function TideBar({ tides, currentHour }) {
  const heights = tides.map(t => t.height);
  const min = Math.min(...heights);
  const max = Math.max(...heights);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48, padding: "0 2px" }}>
      {tides.map((t, i) => {
        const pct = max === min ? 0.5 : (t.height - min) / (max - min);
        const isNow = t.hour === currentHour;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{
              width: "100%",
              height: `${12 + pct * 32}px`,
              background: isNow ? "rgba(0,191,255,0.9)" : "rgba(0,191,255,0.22)",
              borderRadius: "2px 2px 0 0",
              border: isNow ? "1px solid #00bfff" : "none",
              transition: "height 0.3s"
            }} />
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, unit, sub, icon }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 12,
      padding: "18px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      backdropFilter: "blur(8px)"
    }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Space Mono', monospace", letterSpacing: 2, textTransform: "uppercase" }}>
        {icon && <span style={{ marginRight: 6 }}>{icon}</span>}{label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 28, fontFamily: "'Bebas Neue', sans-serif", color: "#fff", lineHeight: 1.1 }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "'Space Mono', monospace" }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'Space Mono', monospace" }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const [selectedBeach, setSelectedBeach] = useState(BEACHES[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [now] = useState(new Date());

  const fetchConditions = useCallback(async (beach) => {
    setLoading(true);
    setError(null);
    try {
      const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${beach.lat}&longitude=${beach.lon}&hourly=wave_height,wave_period,wave_direction,ocean_current_velocity&daily=wave_height_max&timezone=Africa%2FJohannesburg&forecast_days=1`;
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${beach.lat}&longitude=${beach.lon}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation_probability,cloud_cover&daily=temperature_2m_max,temperature_2m_min&timezone=Africa%2FJohannesburg&forecast_days=1`;

      const [marineRes, weatherRes] = await Promise.all([
        fetch(marineUrl),
        fetch(weatherUrl)
      ]);

      const marine = await marineRes.json();
      const weather = await weatherRes.json();

      const hr = now.getHours();

      // Build hourly tide simulation (Open-Meteo doesn't have real tides, simulate sinusoidal)
      const tideData = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        height: 1.2 + Math.sin((i / 24) * 2 * Math.PI * 2 + 1.2) * 0.8
      }));

      const currentWaveH = marine.hourly?.wave_height?.[hr] ?? 0;
      const currentPeriod = marine.hourly?.wave_period?.[hr] ?? 0;
      const currentWaveDir = marine.hourly?.wave_direction?.[hr] ?? 0;
      const currentWind = weather.hourly?.wind_speed_10m?.[hr] ?? 0;
      const currentWindDir = weather.hourly?.wind_direction_10m?.[hr] ?? 0;
      const currentTemp = weather.hourly?.temperature_2m?.[hr] ?? 0;
      const currentCloud = weather.hourly?.cloud_cover?.[hr] ?? 0;
      const currentRain = weather.hourly?.precipitation_probability?.[hr] ?? 0;
      const currentTide = tideData[hr]?.height ?? 1.2;

      // Find best session window (next 8 hours)
      let bestScore = -1, bestStart = hr, bestEnd = hr + 2;
      for (let s = hr; s < Math.min(hr + 10, 22); s++) {
        const wh = marine.hourly?.wave_height?.[s] ?? 0;
        const wp = marine.hourly?.wave_period?.[s] ?? 0;
        const ws = weather.hourly?.wind_speed_10m?.[s] ?? 0;
        const wd = weather.hourly?.wind_direction_10m?.[s] ?? 0;
        const wd2 = marine.hourly?.wave_direction?.[s] ?? 0;
        const sc = waveRating(wh, wp, ws, wd, wd2);
        if (sc > bestScore) {
          bestScore = sc;
          bestStart = s;
          bestEnd = Math.min(s + 2, 23);
        }
      }

      const rating = waveRating(currentWaveH, currentPeriod, currentWind, currentWindDir, currentWaveDir);

      setData({
        waveHeight: currentWaveH,
        swellPeriod: currentPeriod,
        waveDir: currentWaveDir,
        windSpeed: currentWind,
        windDir: currentWindDir,
        temp: currentTemp,
        cloud: currentCloud,
        rain: currentRain,
        tideLevel: currentTide,
        tides: tideData,
        rating,
        bestStart,
        bestEnd,
        bestScore,
        waterTemp: 16 + Math.random() * 2, // Cape Town avg ~16-18°C
      });
    } catch (e) {
      setError("Could not load conditions. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [now]);

  useEffect(() => {
    fetchConditions(selectedBeach);
  }, [selectedBeach, fetchConditions]);

  const rating = data ? getRatingLabel(data.rating) : null;
  const windCompass = data ? degToCompass(data.windDir) : "—";
  const waveCompass = data ? degToCompass(data.waveDir) : "—";
  const isOffshore = data && (windCompass.includes("SE") || windCompass.includes("S") || windCompass.includes("E"));

  const fmt = (h) => `${String(h).padStart(2, "0")}:00`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060c14; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        select { appearance: none; -webkit-appearance: none; cursor: pointer; }
        select option { background: #0d1a27; color: #fff; }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-anim { animation: slideUp 0.4s ease forwards; }
        .dot-live { animation: pulse 1.8s infinite; }

        .beach-select:focus { outline: none; border-color: rgba(0,191,255,0.5) !important; }
        .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 480px) { .stat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 640px) { .stat-grid { grid-template-columns: repeat(4, 1fr); } }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #060c14 0%, #0a1625 50%, #061220 100%)",
        fontFamily: "'Space Mono', monospace",
        color: "#fff",
        padding: "0 0 40px",
      }}>

        {/* HEADER */}
        <div style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          background: "rgba(0,0,0,0.2)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "linear-gradient(135deg, #00bfff, #0070ff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18
            }}>🌊</div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, lineHeight: 1 }}>BODYBOARD.WX</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>SOUTH AFRICA CONDITIONS</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="dot-live" style={{ width: 7, height: 7, borderRadius: "50%", background: "#00ff87" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 2 }}>LIVE</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginLeft: 8 }}>
              {now.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>

          {/* BEACH SELECTOR */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 8, textTransform: "uppercase" }}>Select Beach</div>
            <div style={{ position: "relative" }}>
              <select
                className="beach-select"
                value={selectedBeach.id}
                onChange={e => setSelectedBeach(BEACHES.find(b => b.id === e.target.value))}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 10,
                  padding: "14px 44px 14px 16px",
                  color: "#fff",
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 22,
                  letterSpacing: 2,
                  transition: "border-color 0.2s",
                }}
              >
                {BEACHES.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", pointerEvents: "none", fontSize: 12 }}>▼</div>
            </div>
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.3)", fontSize: 12, letterSpacing: 3 }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>🌊</div>
              FETCHING CONDITIONS…
            </div>
          )}

          {error && (
            <div style={{
              background: "rgba(255,79,79,0.1)", border: "1px solid rgba(255,79,79,0.3)",
              borderRadius: 10, padding: "16px 20px", color: "#ff8080", fontSize: 12, letterSpacing: 1
            }}>
              {error}
            </div>
          )}

          {data && !loading && (
            <div className="card-anim">

              {/* MAIN RATING CARD */}
              <div style={{
                background: `linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,20,40,0.6))`,
                border: `1px solid ${rating.color}30`,
                borderRadius: 16,
                padding: "28px 24px",
                marginBottom: 12,
                position: "relative",
                overflow: "hidden",
              }}>
                {/* BG glow */}
                <div style={{
                  position: "absolute", top: -60, right: -60, width: 200, height: 200,
                  background: `radial-gradient(circle, ${rating.color}15, transparent 70%)`,
                  pointerEvents: "none",
                }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 8 }}>CURRENT CONDITIONS</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 52 }}>{rating.emoji}</span>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: rating.color, lineHeight: 1, letterSpacing: 2 }}>
                          {rating.label.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>
                          SCORE {data.rating}/100
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SCORE ARC */}
                  <div style={{ textAlign: "center" }}>
                    <svg width="90" height="90" viewBox="0 0 90 90">
                      <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
                      <circle cx="45" cy="45" r="38" fill="none" stroke={rating.color} strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 38}`}
                        strokeDashoffset={`${2 * Math.PI * 38 * (1 - data.rating / 100)}`}
                        strokeLinecap="round"
                        transform="rotate(-90 45 45)"
                        style={{ transition: "stroke-dashoffset 1s ease" }}
                      />
                      <text x="45" y="50" textAnchor="middle" fill="#fff" fontSize="20"
                        fontFamily="'Bebas Neue', sans-serif" letterSpacing="1">
                        {data.rating}
                      </text>
                    </svg>
                  </div>
                </div>

                {/* WIND STATUS BADGE */}
                <div style={{
                  marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8,
                  background: isOffshore ? "rgba(0,255,135,0.1)" : "rgba(255,79,79,0.1)",
                  border: `1px solid ${isOffshore ? "rgba(0,255,135,0.3)" : "rgba(255,79,79,0.3)"}`,
                  borderRadius: 20, padding: "6px 14px",
                }}>
                  <span style={{ fontSize: 13 }}>{isOffshore ? "✅" : "❌"}</span>
                  <span style={{ fontSize: 11, letterSpacing: 2, color: isOffshore ? "#00ff87" : "#ff6b6b" }}>
                    {isOffshore ? "OFFSHORE WIND" : "ONSHORE WIND"}
                  </span>
                </div>
              </div>

              {/* BEST TIME CARD */}
              <div style={{
                background: "rgba(0,191,255,0.06)",
                border: "1px solid rgba(0,191,255,0.2)",
                borderRadius: 14,
                padding: "18px 20px",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(0,191,255,0.6)", letterSpacing: 3, marginBottom: 4 }}>⏱ BEST SESSION TODAY</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#00bfff", letterSpacing: 3 }}>
                    {fmt(data.bestStart)} – {fmt(data.bestEnd)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 2, marginBottom: 4 }}>WINDOW SCORE</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: getRatingLabel(data.bestScore).color }}>
                    {getRatingLabel(data.bestScore).label.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* STATS GRID */}
              <div className="stat-grid" style={{ marginBottom: 10 }}>
                <StatCard
                  label="Wave Height"
                  value={data.waveHeight.toFixed(1)}
                  unit="m"
                  sub={data.waveHeight < 0.5 ? "Flat" : data.waveHeight < 1 ? "Small" : data.waveHeight < 2 ? "Decent" : "Solid"}
                  icon="🌊"
                />
                <StatCard
                  label="Swell Period"
                  value={data.swellPeriod.toFixed(0)}
                  unit="sec"
                  sub={data.swellPeriod >= 10 ? "Long period ✓" : "Short period"}
                  icon="⏱"
                />
                <StatCard
                  label="Wind Speed"
                  value={data.windSpeed.toFixed(0)}
                  unit="km/h"
                  sub={windCompass}
                  icon="💨"
                />
                <StatCard
                  label="Swell Dir"
                  value={waveCompass}
                  sub={`${data.waveDir.toFixed(0)}°`}
                  icon="🧭"
                />
                <StatCard
                  label="Air Temp"
                  value={data.temp.toFixed(0)}
                  unit="°C"
                  sub={`Cloud ${data.cloud}%`}
                  icon="🌤"
                />
                <StatCard
                  label="Water Temp"
                  value={data.waterTemp.toFixed(0)}
                  unit="°C"
                  sub="Cape Town avg"
                  icon="🌡"
                />
                <StatCard
                  label="Tide Level"
                  value={data.tideLevel.toFixed(1)}
                  unit="m"
                  sub="Simulated"
                  icon="🌙"
                />
                <StatCard
                  label="Rain Chance"
                  value={data.rain}
                  unit="%"
                  sub={data.rain > 50 ? "Likely rain" : "Mostly dry"}
                  icon="🌧"
                />
              </div>

              {/* WIND DIRECTION CARD */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "18px 20px",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 20,
                flexWrap: "wrap",
              }}>
                <WindArrow deg={data.windDir} size={64} />
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 6 }}>WIND DIRECTION</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 2, lineHeight: 1 }}>{windCompass}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                    {isOffshore ? "Offshore — glassy faces ✓" : "Onshore — choppy surface ✗"}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 6 }}>SWELL FROM</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 2, lineHeight: 1 }}>{waveCompass}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>{data.waveDir.toFixed(0)}°</div>
                </div>
              </div>

              {/* TIDE BAR */}
              <div style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "16px 20px",
                marginBottom: 10,
              }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginBottom: 12 }}>🌙 TIDE CHART — 24H</div>
                <TideBar tides={data.tides} currentHour={now.getHours()} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  {[0, 6, 12, 18, 23].map(h => (
                    <span key={h} style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'Space Mono', monospace" }}>
                      {String(h).padStart(2, "0")}h
                    </span>
                  ))}
                </div>
              </div>

              {/* FOOTER */}
              <div style={{ textAlign: "center", marginTop: 24, fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: 2 }}>
                DATA: OPEN-METEO MARINE API · TIDE IS SIMULATED
                <br />
                <span style={{ color: "rgba(255,255,255,0.08)" }}>
                  {selectedBeach.lat}°S, {Math.abs(selectedBeach.lon)}°E
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}