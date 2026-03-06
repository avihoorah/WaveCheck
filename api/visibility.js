// api/visibility.js — Vercel Edge Function
// Proxies Copernicus Marine Service KD490 (turbidity) data for Cape Town dive sites
// Called by DiveCheck with ?lat=-34.18&lon=18.47
// Returns { kd490, viz_m, quality, source, date } or { error }

export const config = { runtime: "edge" };

// KD490 → estimated visibility in metres
// KD490 is the diffuse attenuation coefficient at 490nm (m⁻¹)
// Lower = clearer water. Typical ranges:
//   0.03–0.06  → very clear (open ocean)
//   0.06–0.12  → clear (15–25m viz)
//   0.12–0.20  → moderate (8–15m viz)
//   0.20–0.35  → turbid (4–8m viz)
//   >0.35      → very turbid (<4m viz)
function kd490ToViz(kd490) {
  if (!kd490 || isNaN(kd490)) return null;
  // Secchi depth approximation: Zsd ≈ 1.7 / Kd490
  // Diver visibility ≈ 2–3x Secchi depth (subjective, air-adjusted)
  const secchi = 1.7 / kd490;
  const viz = secchi * 2.2;
  return Math.max(1, Math.min(25, viz));
}

function vizToLabel(viz_m) {
  if (viz_m >= 15) return { label: `${Math.round(viz_m)}–${Math.round(viz_m)+5}m`, quality: "Excellent", color: "#00ff9d" };
  if (viz_m >= 10) return { label: `${Math.round(viz_m)}–${Math.round(viz_m)+3}m`, quality: "Very good", color: "#00e5cc" };
  if (viz_m >= 7)  return { label: `${Math.round(viz_m)}–${Math.round(viz_m)+2}m`, quality: "Good",     color: "#00e5cc" };
  if (viz_m >= 4)  return { label: `${Math.round(viz_m)}–${Math.round(viz_m)+2}m`, quality: "Fair",     color: "#ffb300" };
  if (viz_m >= 2)  return { label: `${Math.round(viz_m)}–${Math.round(viz_m)+1}m`, quality: "Poor",     color: "#ff8800" };
  return { label: "<2m", quality: "Very poor", color: "#ff4444" };
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "-34.18");
  const lon = parseFloat(searchParams.get("lon") ?? "18.47");

  const user = process.env.VITE_COPERNICUS_USER;
  const pass = process.env.VITE_COPERNICUS_PASS;

  if (!user || !pass) {
    return new Response(JSON.stringify({ error: "Copernicus credentials not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    // CMEMS NRT Ocean Colour L3 - KD490 product
    // Dataset: cmems_obs-oc_glo_bgc-transp_nrt_l3-multi-4km_P1D
    // WMS GetFeatureInfo gives us the value at a specific lat/lon

    // Build small bbox around point (0.1° buffer ≈ ~10km)
    const bbox = `${lon - 0.05},${lat - 0.05},${lon + 0.05},${lat + 0.05}`;

    // Use WMS GetMap → GetFeatureInfo to extract pixel value at point
    const wmsBase = "https://nrt.cmems-du.eu/thredds/wms/cmems_obs-oc_glo_bgc-transp_nrt_l3-multi-4km_P1D";

    // First try GetFeatureInfo at current point
    const wmsParams = new URLSearchParams({
      SERVICE: "WMS",
      VERSION: "1.1.1",
      REQUEST: "GetFeatureInfo",
      LAYERS: "KD490",
      QUERY_LAYERS: "KD490",
      INFO_FORMAT: "application/json",
      WIDTH: "3",
      HEIGHT: "3",
      BBOX: bbox,
      SRS: "EPSG:4326",
      X: "1",
      Y: "1",
      FORMAT: "image/png",
    });

    const auth = btoa(`${user}:${pass}`);
    const wmsUrl = `${wmsBase}?${wmsParams.toString()}`;

    const response = await fetch(wmsUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      // 8 second timeout
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`CMEMS WMS returned ${response.status}`);
    }

    const text = await response.text();
    let kd490 = null;
    let dataDate = null;

    // Parse the WMS GetFeatureInfo response (JSON format)
    try {
      const json = JSON.parse(text);
      // CMEMS returns features array
      const features = json.features ?? json.value ?? [];
      if (features.length > 0) {
        const props = features[0]?.properties ?? features[0];
        kd490 = props?.KD490 ?? props?.value ?? props?.["KD490 (m-1)"] ?? null;
        dataDate = props?.time ?? props?.date ?? null;
      }
    } catch {
      // Try parsing as plain text value
      const match = text.match(/KD490[^\d]*([\d.]+)/i);
      if (match) kd490 = parseFloat(match[1]);
    }

    if (kd490 === null || isNaN(kd490)) {
      throw new Error("KD490 value not found in response");
    }

    const viz_m = kd490ToViz(kd490);
    const label = vizToLabel(viz_m);

    return new Response(JSON.stringify({
      kd490: Math.round(kd490 * 1000) / 1000,
      viz_m: Math.round(viz_m * 10) / 10,
      est: label.label,
      quality: label.quality,
      color: label.color,
      source: "Copernicus CMEMS KD490",
      date: dataDate ?? new Date().toISOString().split("T")[0],
      lat, lon
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        // Cache for 6 hours — satellite data only updates daily
        "Cache-Control": "public, max-age=21600, stale-while-revalidate=3600"
      }
    });

  } catch (err) {
    // Return error with enough detail to debug
    return new Response(JSON.stringify({
      error: err.message,
      fallback: true,
      note: "Using inference model — satellite data unavailable"
    }), {
      status: 200, // 200 so app handles gracefully
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
