/* Rust Car Tracker — GPS tracking logic (live + demo drive, worldwide satellite/street map) */
/* Tracker logic (proven v1.1): live GPS + demo drive */
"use strict";
/* ============================================================
   Rust Car Tracker — phone-as-GPS-tracker web app
   Live mode : uses the phone's own GPS (Geolocation API)
   Demo mode : simulates a drive so anyone can test instantly
   ============================================================ */

/* The map is WORLDWIDE (OpenStreetMap covers the whole planet) and the
   phone's GPS satellites are global — this app works in any city of any
   country. It opens on a world view and flies to YOUR city the moment
   live tracking starts. */
const WORLD_VIEW = [20, 10];

const map = L.map('map').setView(WORLD_VIEW, 2);
/* Satellite map (Esri World Imagery - free, no API key) + a labels layer
   on top, so the dark theme gets a real-earth look with place names. */
const satBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Satellite imagery (c) Esri, Maxar, Earthstar Geographics'
});
const satLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19
});
const streetBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '(c) OpenStreetMap contributors'
});
satBase.addTo(map); satLabels.addTo(map);
/* Dark mode = satellite (night feel); Light mode = bright street map. */
window.__applyMapTheme = function(t){
  if (t === 'light') {
    map.removeLayer(satBase); map.removeLayer(satLabels);
    streetBase.addTo(map);
  } else {
    map.removeLayer(streetBase);
    satBase.addTo(map); satLabels.addTo(map);
  }
  try { trail.setStyle({ color: accentColor() }); } catch(e) {}
};

const carIcon = L.divIcon({ className: '', html: '<div class="car-icon">🚗</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
let marker = null;
function accentColor(){ try { return getComputedStyle(document.documentElement).getPropertyValue('--lime').trim() || '#A3E635'; } catch(e) { return '#A3E635'; } }
let trail = L.polyline([], { color: accentColor(), weight: 5, opacity: 0.85 }).addTo(map);

let watchId = null;        // geolocation watch handle
let demoTimer = null;      // demo animation handle
let clockTimer = null;     // trip clock
let tripStart = null;      // Date when the current trip started
let totalKm = 0;           // accumulated distance
let lastPoint = null;      // last [lat, lng]
let lastPointTime = null;  // timestamp of last point

const $ = id => document.getElementById(id);
const pill = $('statusPill');

function showMsg(text) {
  const m = $('msg');
  if (!text) { m.style.display = 'none'; m.textContent = ''; return; }
  m.textContent = text; m.style.display = 'block';
}

function setStatus(text, cls) {
  pill.textContent = '● ' + text;
  pill.className = cls || '';
  pill.id = 'statusPill';
}

/* Great-circle distance between two GPS points, in kilometres */
function haversineKm(a, b) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function startClock() {
  tripStart = Date.now();
  clockTimer = setInterval(() => {
    const s = Math.floor((Date.now() - tripStart) / 1000);
    $('tripTime').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 1000);
}

function stopClock() { if (clockTimer) { clearInterval(clockTimer); clockTimer = null; } }

/* Every new GPS point flows through here — live or demo */
function handlePoint(lat, lng, speedMs, accuracyM) {
  const point = [lat, lng];
  const now = Date.now();

  if (lastPoint) {
    const d = haversineKm(lastPoint, point);
    /* Ignore GPS jitter smaller than ~3 metres */
    if (d > 0.003) {
      totalKm += d;
      trail.addLatLng(point);
      if ((speedMs === null || speedMs === undefined) && lastPointTime) {
        const hours = (now - lastPointTime) / 3600000;
        if (hours > 0) speedMs = (d / hours) / 3.6; /* km/h -> m/s */
      }
      lastPoint = point; lastPointTime = now;
    }
  } else {
    lastPoint = point; lastPointTime = now;
    trail.addLatLng(point);
    map.setView(point, 15);
  }

  if (!marker) { marker = L.marker(point, { icon: carIcon }).addTo(map); }
  else { marker.setLatLng(point); }
  map.panTo(point);

  $('speed').textContent = speedMs ? Math.round(speedMs * 3.6) : 0;
  $('distance').textContent = totalKm.toFixed(2);
  $('lat').textContent = lat.toFixed(6);
  $('lng').textContent = lng.toFixed(6);
  $('accuracy').textContent = accuracyM ? Math.round(accuracyM) : '—';
}

function setButtons(tracking) {
  $('startBtn').disabled = tracking;
  $('demoBtn').disabled = tracking;
  $('stopBtn').disabled = !tracking;
}

/* ---------------- Live GPS mode ---------------- */
function startLive() {
  showMsg('');
  if (!('geolocation' in navigator)) {
    showMsg('This browser does not support GPS geolocation. Try the Demo Drive button instead.');
    setStatus('GPS not supported', 'error');
    return;
  }
  setStatus('Waiting for GPS…', 'demo');
  watchId = navigator.geolocation.watchPosition(
    pos => {
      setStatus('Live tracking', 'live');
      handlePoint(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.accuracy);
    },
    err => {
      stopAll();
      setStatus('GPS error', 'error');
      showMsg('Could not get your location (' + err.message + '). Allow location permission for this site, keep GPS/location services ON, and try again — or use Demo Drive.');
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
  );
  startClock();
  setButtons(true);
}

/* ---------------- Demo mode ----------------
   A short simulated route in Gulberg / Main Boulevard, Lahore,
   so the app can be tested anywhere with no GPS at all.     */
const DEMO_ROUTE = [
  [31.5102, 74.3441], [31.5120, 74.3470], [31.5141, 74.3498], [31.5163, 74.3522],
  [31.5189, 74.3544], [31.5216, 74.3563], [31.5244, 74.3579], [31.5273, 74.3591],
  [31.5301, 74.3598], [31.5330, 74.3601], [31.5355, 74.3595], [31.5378, 74.3582]
];

function interpolate(route, stepsPerLeg) {
  const pts = [];
  for (let i = 0; i < route.length - 1; i++) {
    for (let s = 0; s < stepsPerLeg; s++) {
      pts.push([
        route[i][0] + (route[i + 1][0] - route[i][0]) * (s / stepsPerLeg),
        route[i][1] + (route[i + 1][1] - route[i][1]) * (s / stepsPerLeg)
      ]);
    }
  }
  pts.push(route[route.length - 1]);
  return pts;
}

function startDemo() {
  showMsg('');
  setStatus('Demo drive', 'demo');
  const pts = interpolate(DEMO_ROUTE, 6);
  let i = 0;
  startClock();
  setButtons(true);
  demoTimer = setInterval(() => {
    if (i >= pts.length) { stopAll(); setStatus('Demo finished', ''); return; }
    /* Simulated city speed: gentle variation between 24 and 42 km/h */
    const fakeSpeedMs = (24 + 18 * Math.abs(Math.sin(i / 5))) / 3.6;
    handlePoint(pts[i][0], pts[i][1], fakeSpeedMs, 8);
    i++;
  }, 700);
}

/* ---------------- Stop / clear ---------------- */
function stopAll() {
  if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (demoTimer) { clearInterval(demoTimer); demoTimer = null; }
  stopClock();
  setButtons(false);
  if (pill.textContent.includes('tracking') || pill.textContent.includes('Demo')) setStatus('Stopped', '');
}

function clearRoute() {
  stopAll();
  trail.setLatLngs([]);
  if (marker) { map.removeLayer(marker); marker = null; }
  totalKm = 0; lastPoint = null; lastPointTime = null;
  $('speed').textContent = '0'; $('distance').textContent = '0.00';
  $('lat').textContent = '—'; $('lng').textContent = '—'; $('accuracy').textContent = '—';
  $('tripTime').textContent = '00:00';
  setStatus('Not tracking', '');
  map.setView(WORLD_VIEW, 2);
}

/* If the visitor has ALREADY granted location permission to this site,
   open the map over their own city (anywhere in the world) instead of the
   world view. No prompt is triggered from here. */
if (navigator.permissions && navigator.geolocation) {
  navigator.permissions.query({ name: 'geolocation' }).then(result => {
    if (result.state === 'granted') {
      navigator.geolocation.getCurrentPosition(
        pos => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
        () => {},
        { timeout: 8000 }
      );
    }
  }).catch(() => {});
}

$('startBtn').addEventListener('click', startLive);
$('demoBtn').addEventListener('click', startDemo);
$('stopBtn').addEventListener('click', stopAll);
$('clearBtn').addEventListener('click', clearRoute);

/* Hero buttons: jump to the tracker and start */
// Hero CTAs: jump to the tracker and press the matching button
  document.getElementById('ctaStart').addEventListener('click', () => setTimeout(() => document.getElementById('startBtn').click(), 450));
  document.getElementById('ctaDemo').addEventListener('click', () => setTimeout(() => document.getElementById('demoBtn').click(), 450));
