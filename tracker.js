/* Rust Tracker — GPS tracking logic (live tracking + demo drive, worldwide satellite/street maps) */
/* Tracker logic (proven v1.1): live GPS + demo drive */
"use strict";
/* ============================================================
   Rust Tracker — phone-as-GPS-tracker web app
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

const carIcon = L.divIcon({ className: '', html: '<div class="car-icon">📍</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
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

  const kmhNow = parseFloat($('speed').textContent) || 0;
  checkTools(point, kmhNow);
  guardCheck(point);
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
  resetTripStats();
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

function resetTripStats() {
  totalKm = 0; lastPoint = null; lastPointTime = null;
  if (trail) trail.setLatLngs([]);
  $('speed').textContent = '0'; $('distance').textContent = '0.00';
  $('lat').textContent = '—'; $('lng').textContent = '—'; $('accuracy').textContent = '—';
  $('tripTime').textContent = '00:00';
}

function startDemo() {
  showMsg('');
  resetTripStats();
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
  clearNav(); clearFence();
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

/* ============================================================
   TRIP TOOLS — Navigation (free OpenStreetMap routing),
   Geofence alert, and Speed alert. All run in the browser.
   ============================================================ */
let navLine = null, navDest = null;
let fence = null, fenceCenter = null, fenceOutside = false;
let lastBeepAt = 0, audioCtx = null;

function beep(times) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.12, t0 + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.25 + 0.18);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + i * 0.25); o.stop(t0 + i * 0.25 + 0.2);
    }
  } catch (e) {}
}

function needPos() {
  if (!lastPoint) { showMsg('Start Live Tracking or Demo Drive first — these tools need your current location.'); return true; }
  return false;
}

/* ---------- Navigation: free routing by OpenStreetMap (OSRM) ---------- */
async function showRoute() {
  const q = $('destIn').value.trim();
  if (!q) { showMsg('Type a destination first — a place name (e.g. "Liberty Market, Lahore") or coordinates like 31.52, 74.35.'); return; }
  if (needPos()) return;
  $('navInfo').textContent = 'Finding the best road route…';
  try {
    let dest = null;
    const m = q.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (m) { dest = [parseFloat(m[1]), parseFloat(m[2])]; }
    else {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q));
      const j = await r.json();
      if (!j.length) throw new Error('place not found');
      dest = [parseFloat(j[0].lat), parseFloat(j[0].lon)];
    }
    const rr = await fetch('https://router.project-osrm.org/route/v1/driving/' + lastPoint[1] + ',' + lastPoint[0] + ';' + dest[1] + ',' + dest[0] + '?overview=full&geometries=geojson');
    const rj = await rr.json();
    if (rj.code !== 'Ok' || !rj.routes.length) throw new Error('no route');
    const route = rj.routes[0];
    const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
    clearNav();
    navLine = L.polyline(coords, { color: '#38BDF8', weight: 5, opacity: 0.9 }).addTo(map);
    navDest = L.marker(dest).addTo(map);
    map.fitBounds(navLine.getBounds(), { padding: [30, 30] });
    $('navInfo').textContent = 'Route found: ' + (route.distance / 1000).toFixed(1) + ' km · about ' + Math.max(1, Math.round(route.duration / 60)) + ' minutes by road.';
  } catch (e) {
    $('navInfo').textContent = 'Could not find that route — check the place name and try again.';
  }
}
function clearNav() {
  if (navLine) { map.removeLayer(navLine); navLine = null; }
  if (navDest) { map.removeLayer(navDest); navDest = null; }
  const ni = $('navInfo'); if (ni) ni.textContent = '';
}

/* ---------- Geofence: alert when the car leaves a circle ---------- */
function setFence() {
  if (needPos()) return;
  const r = parseInt($('fenceRadius').value, 10);
  clearFence();
  fenceCenter = lastPoint.slice(); fenceOutside = false;
  fence = L.circle(fenceCenter, { radius: r, color: accentColor(), weight: 2, fillColor: accentColor(), fillOpacity: 0.12 }).addTo(map);
  $('fenceInfo').textContent = 'Geofence is ON: a ' + r + ' m circle around your current spot. An alert sounds if your vehicle leaves it.';
}
function clearFence() {
  if (fence) { map.removeLayer(fence); fence = null; }
  fenceCenter = null; fenceOutside = false;
  const fi = $('fenceInfo'); if (fi) fi.textContent = '';
}

/* ---------- Checks that run on every new GPS point ---------- */
function checkTools(point, kmh) {
  const limEl = $('speedLimit');
  if (limEl) {
    const lim = parseInt(limEl.value, 10);
    const over = kmh > lim;
    $('speed').parentElement.style.color = over ? '#F87171' : '';
    if (over && Date.now() - lastBeepAt > 8000) {
      lastBeepAt = Date.now(); beep(2);
      showMsg('⚠️ Speed alert: ' + Math.round(kmh) + ' km/h — your limit is ' + lim + ' km/h.');
    }
  }
  if (fence && fenceCenter) {
    const dM = haversineKm(fenceCenter, point) * 1000;
    const r = parseInt($('fenceRadius').value, 10);
    if (dM > r && !fenceOutside) {
      fenceOutside = true;
      fence.setStyle({ color: '#F87171', fillColor: '#F87171' });
      beep(3);
      showMsg('🚨 Geofence alert: your vehicle has LEFT the fenced area.');
    } else if (dM <= r && fenceOutside) {
      fenceOutside = false;
      fence.setStyle({ color: accentColor(), fillColor: accentColor() });
      showMsg('✅ Your vehicle is back inside the geofence.');
    }
  }
}

$('navBtn').addEventListener('click', showRoute);
$('navClear').addEventListener('click', clearNav);
$('fenceBtn').addEventListener('click', setFence);
$('fenceClear').addEventListener('click', clearFence);

/* ============================================================
   GUARD MODE (website theft guard) — arm when parked.
   Triggers: car moves >60 m, phone shakes, charger unplugged.
   Alarm: siren + flashing banner here AND on the owner's
   other signed-in device (via Firebase Realtime Database).
   ============================================================ */
let guardArmed = false, guardPoint = null, guardAlarmOn = false;
let sirenTimer = null, sirenCtx = null, lastGuardPushAt = 0, remoteMarker = null;

function guardRef() {
  try {
    if (window.firebase && firebase.apps && firebase.apps.length && window.__uid && firebase.database) {
      return firebase.database().ref('guard/' + window.__uid);
    }
  } catch (e) {}
  return null;
}
function guardPush(extra) {
  const r = guardRef(); if (!r) return;
  const data = { armed: guardArmed, alarm: guardAlarmOn, ts: Date.now() };
  if (lastPoint) { data.lat = lastPoint[0]; data.lng = lastPoint[1]; }
  if (extra) Object.assign(data, extra);
  r.set(data).catch(() => {});
}
function guardSetInfo(t) { const el = $('guardInfo'); if (el) el.textContent = t; }

function armGuard() {
  if (!lastPoint) { startLive(); showMsg('Starting GPS first — wait for the marker dot, then press Arm Guard again.'); return; }
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().catch(() => {});
  }
  guardArmed = true; guardPoint = lastPoint.slice(); guardAlarmOn = false;
  window.addEventListener('devicemotion', guardMotion);
  if (navigator.getBattery) navigator.getBattery().then(b => b.addEventListener('chargingchange', guardCharge)).catch(() => {});
  $('guardBtn').textContent = '🔓 Disarm Guard';
  guardSetInfo('Guard is ON — watching movement, shaking and the charger. Keep this tab open and the phone plugged in.');
  guardPush({ reason: '' });
  showMsg('🛡️ Guard armed at your parked spot.');
}
function disarmGuard() {
  guardArmed = false;
  stopAlarm();
  window.removeEventListener('devicemotion', guardMotion);
  $('guardBtn').textContent = '🛡️ Arm Guard';
  guardSetInfo('Guard is off.');
  guardPush({ reason: '' });
}
function guardMotion(e) {
  if (!guardArmed || guardAlarmOn) return;
  const a = e.accelerationIncludingGravity; if (!a) return;
  const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
  if (Math.abs(mag - 9.8) > 7) triggerAlarm('Your vehicle was shaken or pushed.');
}
function guardCharge() { if (guardArmed && !guardAlarmOn) triggerAlarm('The charger was disconnected.'); }
function guardCheck(point) {
  if (!guardArmed) return;
  if (Date.now() - lastGuardPushAt > 15000) { lastGuardPushAt = Date.now(); guardPush({}); }
  if (!guardAlarmOn && guardPoint) {
    const dM = haversineKm(guardPoint, point) * 1000;
    if (dM > 60) triggerAlarm('Your vehicle moved ' + Math.round(dM) + ' m away from its parked spot.');
  }
}
function triggerAlarm(why) {
  if (guardAlarmOn) return;
  guardAlarmOn = true;
  $('alarmWhy').textContent = why;
  $('alarmBanner').style.display = 'flex';
  startSiren();
  if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
  guardSetInfo('🚨 ALARM: ' + why);
  guardPush({ reason: why });
}
function stopAlarm() {
  guardAlarmOn = false;
  const b = $('alarmBanner'); if (b) b.style.display = 'none';
  if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
}
function startSiren() {
  try {
    sirenCtx = sirenCtx || new (window.AudioContext || window.webkitAudioContext)();
    let hi = false;
    const blip = () => {
      const o = sirenCtx.createOscillator(), g = sirenCtx.createGain();
      o.type = 'square'; o.frequency.value = hi ? 920 : 620; hi = !hi;
      g.gain.setValueAtTime(0.05, sirenCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, sirenCtx.currentTime + 0.28);
      o.connect(g); g.connect(sirenCtx.destination);
      o.start(); o.stop(sirenCtx.currentTime + 0.3);
    };
    blip(); sirenTimer = setInterval(blip, 320);
  } catch (e) {}
}
/* Owner's other device: listen for the car phone's alarm */
window.__onGuardLogin = function () {
  const r = guardRef(); if (!r) return;
  r.on('value', snap => {
    const v = snap.val(); if (!v) return;
    if (v.alarm && !guardAlarmOn) {
      guardAlarmOn = true;
      $('alarmWhy').textContent = (v.reason || 'Theft alert.') + ' Last known location is marked on the map.';
      $('alarmBanner').style.display = 'flex';
      startSiren();
      if (v.lat && v.lng) {
        if (remoteMarker) map.removeLayer(remoteMarker);
        remoteMarker = L.marker([v.lat, v.lng]).addTo(map);
        map.setView([v.lat, v.lng], 15);
      }
    }
  });
};
let pinResolve = null;
function inlinePin(placeholder) {
  return new Promise(res => {
    pinResolve = res;
    const inp = $('guardPinInput');
    inp.value = ''; inp.placeholder = placeholder;
    $('guardPinRow').style.display = 'flex';
    setTimeout(() => inp.focus(), 30);
  });
}
function closePin(v) { $('guardPinRow').style.display = 'none'; if (pinResolve) { const r = pinResolve; pinResolve = null; r(v); } }
$('guardPinOk').addEventListener('click', () => closePin($('guardPinInput').value));
$('guardPinCancel').addEventListener('click', () => closePin(null));
$('guardPinInput').addEventListener('keydown', e => { if (e.key === 'Enter') closePin(e.target.value); else if (e.key === 'Escape') closePin(null); });
async function guardPinOk() {
  const pin = localStorage.getItem('rct-guard-pin');
  if (!pin) return true;
  const entered = await inlinePin('Enter your Guard PIN');
  return entered !== null && entered === pin;
}
$('guardBtn').addEventListener('click', async () => {
  if (!guardArmed) { armGuard(); return; }
  if (!await guardPinOk()) { showMsg('Wrong PIN — the guard stays ON.'); return; }
  disarmGuard();
});
$('guardPinBtn').addEventListener('click', async () => {
  const p = await inlinePin('Set a Guard PIN (empty = remove it)');
  if (p === null) return;
  if (p.trim() === '') { localStorage.removeItem('rct-guard-pin'); showMsg('Guard PIN removed.'); }
  else { localStorage.setItem('rct-guard-pin', p.trim()); showMsg('Guard PIN set — you will need it to disarm.'); }
});
$('alarmOff').addEventListener('click', async () => {
  if (!await guardPinOk()) { showMsg('Wrong PIN — the alarm stays ON.'); return; }
  if (guardArmed) disarmGuard(); else stopAlarm();
});
