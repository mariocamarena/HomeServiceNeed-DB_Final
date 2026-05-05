// zip code geocoding + distance helpers
// uses zippopotam.us (free, no key) and caches results in memory for the
// life of the process

const _cache = new Map();

async function zipCoords(zip) {
    if (!zip) return null;
    const key = String(zip).trim().slice(0, 5);
    if (!/^\d{5}$/.test(key)) return null;
    if (_cache.has(key)) return _cache.get(key);
    try {
        const res = await fetch(`https://api.zippopotam.us/us/${key}`, {
            signal: AbortSignal.timeout(2500)
        });
        if (!res.ok) { _cache.set(key, null); return null; }
        const data = await res.json();
        const place = data && Array.isArray(data.places) && data.places[0];
        if (!place) { _cache.set(key, null); return null; }
        const coords = {
            lat: parseFloat(place.latitude),
            lon: parseFloat(place.longitude)
        };
        if (Number.isNaN(coords.lat) || Number.isNaN(coords.lon)) {
            _cache.set(key, null);
            return null;
        }
        _cache.set(key, coords);
        return coords;
    } catch (e) {
        _cache.set(key, null);
        return null;
    }
}

function haversineMiles(a, b) {
    if (!a || !b) return null;
    const R = 3959;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}

// filter provider rows by haversine distance from userZip
// rows with unknown coords are passed through (we don't know their distance,
// but excluding them silently would feel like the filter is broken)
async function filterByDistance(rows, userZip, radiusMiles) {
    const r = Number(radiusMiles) || 0;
    if (!userZip || r <= 0) return rows;
    const userC = await zipCoords(userZip);
    if (!userC) return rows;
    const enriched = await Promise.all(rows.map(async p => {
        if (!p.home_zip) return { row: p, keep: true, dist: null };
        const pc = await zipCoords(p.home_zip);
        if (!pc) return { row: p, keep: true, dist: null };
        const d = haversineMiles(userC, pc);
        const inRadius = d <= r;
        // also require the provider be willing to travel that far
        const willing = (p.travel_radius_miles == null) || (Number(p.travel_radius_miles) >= d);
        return { row: p, keep: inRadius && willing, dist: d };
    }));
    return enriched
        .filter(e => e.keep)
        .map(e => e.dist != null
            ? { ...e.row, distance_miles: Math.round(e.dist * 10) / 10 }
            : e.row);
}

module.exports = { zipCoords, haversineMiles, filterByDistance };
