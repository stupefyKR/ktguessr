import { validPoint, distanceMeters, formatDistance, elapsedLabel, boundsForPair, sampleCandidate, pointInMode, summarize, randomUnit } from './core.mjs';

const $ = id => document.getElementById(id);
const storage = {
  get(key, fallback = null) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Practice still works without storage. */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* Storage may be disabled. */ } },
};
const labels = { world: '전 세계', japan: '일본', korea: '대한민국', iceland: '아이슬란드', europe: '유럽', newzealand: '뉴질랜드' };
let phase = 'offline';
let connected = false;
let sdkAttempted = false;
let searchToken = 0;
let map, panorama, service, PinOverlay;
let guessPin, actualPin, routeLine;
let round = null;
let guess = null;
let startedAt = 0;
let timerId = null;
let roundNumber = 0;
const recentStarts = [];
let history = [];
try {
  const parsed = JSON.parse(storage.get('streetlens.history.v1', '[]'));
  if (Array.isArray(parsed)) history = parsed.filter(x => x && Number.isFinite(x.distance) && x.distance >= 0 && x.distance < 20100000 && typeof x.label === 'string').slice(-100);
} catch { history = []; }

function announce(message) { $('statusMessage').textContent = message; }
function updateControls() {
  const searching = phase === 'searching' || phase === 'connecting';
  $('newRoundButton').disabled = !connected || searching;
  $('regionSelect').disabled = searching;
  $('submitGuess').disabled = phase !== 'playing' || !guess;
  $('coordinateButton').disabled = phase !== 'playing';
  $('coordinateForm').querySelectorAll('input').forEach(el => { el.disabled = phase !== 'playing'; });
  $('northButton').disabled = !round || !['playing', 'revealed'].includes(phase);
  $('returnButton').disabled = $('northButton').disabled;
  $('resetMapButton').disabled = !map;
  $('settingsButton').disabled = phase === 'connecting';
}
function stopTimer() { clearInterval(timerId); timerId = null; }
function startTimer() {
  stopTimer(); startedAt = performance.now(); $('timer').textContent = '00:00';
  timerId = setInterval(() => { $('timer').textContent = elapsedLabel((performance.now() - startedAt) / 1000); }, 1000);
}
function clearMarkers() {
  for (const overlay of [guessPin, actualPin, routeLine]) overlay?.setMap(null);
  guessPin = actualPin = routeLine = null;
}
function showSceneLoading(title, detail) {
  document.body.classList.add('is-searching');
  $('panorama').inert = true;
  $('sceneError').hidden = true;
  $('panorama').hidden = true;
  $('scenePlaceholder').hidden = false;
  $('sceneWelcome').hidden = true;
  $('sceneLoading').hidden = false;
  $('loadingTitle').textContent = title;
  $('loadingDetail').textContent = detail;
}
function showWelcome() {
  document.body.classList.remove('is-searching');
  $('sceneError').hidden = true; $('sceneLoading').hidden = true;
  $('panorama').hidden = true; $('scenePlaceholder').hidden = false; $('sceneWelcome').hidden = false;
  $('connectButton').textContent = connected ? '새 위치에서 연습하기 ↗' : '연습 시작하기 ↗';
}
function showError(message, settings = false) {
  document.body.classList.remove('is-searching');
  searchToken++; stopTimer(); phase = 'error';
  $('sceneErrorText').textContent = message; $('sceneError').hidden = false;
  $('retryButton').textContent = settings ? 'API 연결 설정' : '다른 위치 찾기';
  $('retryButton').dataset.settings = String(settings); updateControls(); announce(message);
}
function openSettings() {
  $('settingsError').hidden = true;
  $('referrerHint').textContent = location.protocol === 'file:' ? 'http://localhost:4173/*\nHTML 파일은 로컬 서버로 열어주세요.' : `${location.origin}/*`;
  if (!$('settingsDialog').open) $('settingsDialog').showModal();
}
function renderHistory() {
  const summary = summarize(history);
  $('completedStat').replaceChildren(document.createTextNode(String(summary.count)));
  const unit = document.createElement('span'); unit.textContent = '회'; $('completedStat').append(unit);
  $('averageStat').textContent = summary.average === null ? '—' : formatDistance(summary.average);
  $('bestStat').textContent = summary.best === null ? '—' : formatDistance(summary.best);
  $('historyList').replaceChildren();
  if (!history.length) {
    const empty = document.createElement('p'); empty.className = 'history-empty'; empty.textContent = '첫 번째 추측을 마치면 기록이 쌓입니다.'; $('historyList').append(empty); return;
  }
  for (const item of history.slice(-3).reverse()) {
    const row = document.createElement('div'); row.className = 'history-item';
    const name = document.createElement('span'); name.textContent = item.label.slice(0, 120);
    const distance = document.createElement('strong'); distance.textContent = formatDistance(item.distance);
    row.append(name, distance); $('historyList').append(row);
  }
}

async function loadGoogle(key) {
  if (location.protocol === 'file:') throw new Error('HTML 파일을 직접 열기보다 로컬 서버 또는 배포된 웹 주소로 접속해주세요.');
  sdkAttempted = true;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('Google Maps 연결 시간이 초과됐습니다. 인터넷 연결과 API 키의 웹사이트 제한을 확인해주세요.')), 22000);
    const finish = error => { if (settled) return; settled = true; clearTimeout(timeout); error ? reject(error) : resolve(); };
    window.__streetlensMapsReady = () => finish();
    const script = document.createElement('script'); script.id = 'googleMapsSdk'; script.async = true;
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.search = new URLSearchParams({ key, v: 'weekly', loading: 'async', callback: '__streetlensMapsReady', language: 'ko' }).toString();
    script.src = url.toString(); script.onerror = () => finish(new Error('Google Maps 스크립트를 불러올 수 없습니다. 인터넷 연결이나 차단 확장 프로그램을 확인해주세요.'));
    document.head.append(script);
  });
}

function initializeMaps() {
  const g = google.maps;
  PinOverlay = class extends g.OverlayView {
    constructor(position, label, type) { super(); this.position = position; this.label = label; this.type = type; }
    onAdd() {
      this.element = document.createElement('div'); this.element.className = `map-pin ${this.type}`;
      const caption = document.createElement('span'); caption.textContent = this.label;
      const dot = document.createElement('i'); dot.className = 'pin-point';
      this.element.append(caption, dot); this.getPanes().floatPane.append(this.element);
    }
    draw() { const p = this.getProjection()?.fromLatLngToDivPixel(new g.LatLng(this.position)); if (p && this.element) { this.element.style.left = `${p.x}px`; this.element.style.top = `${p.y}px`; } }
    onRemove() { this.element?.remove(); }
    setPosition(position) { this.position = position; this.draw(); }
  };
  $('guessMap').hidden = false; $('mapPlaceholder').hidden = true;
  map = new g.Map($('guessMap'), {
    center: { lat: 20, lng: 10 }, zoom: 2, minZoom: 1,
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
    clickableIcons: false, gestureHandling: 'greedy', keyboardShortcuts: true,
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#e0e6d8' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#4d5f4b' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#eef2e8' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#b4c8c2' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d4c6a1' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    ],
  });
  map.addListener('click', event => { if (event.latLng) chooseGuess(event.latLng.toJSON()); });
  panorama = new g.StreetViewPanorama($('panorama'), {
    visible: false, addressControl: false, showRoadLabels: false,
    linksControl: true, panControl: true, zoomControl: true, fullscreenControl: true,
    enableCloseButton: false, motionTracking: false, motionTrackingControl: false,
    clickToGo: true, scrollwheel: true,
  });
  service = new g.StreetViewService();
  panorama.addListener('status_changed', () => {
    if (round && phase === 'playing' && panorama.getStatus() === 'ZERO_RESULTS') showError('이 지점의 거리뷰가 더 이상 제공되지 않습니다. 다른 위치에서 다시 연습해주세요.');
  });
  updateControls();
}

function chooseGuess(point) {
  if (phase !== 'playing' || !validPoint(point)) return;
  guess = Object.freeze({ ...point });
  if (guessPin) guessPin.setPosition(guess);
  else { guessPin = new PinOverlay(guess, '나의 추측', 'guess'); guessPin.setMap(map); }
  $('guessLat').value = point.lat.toFixed(5); $('guessLng').value = point.lng.toFixed(5);
  $('guessHint').textContent = '위치 선택 완료 · 다시 클릭하면 변경할 수 있어요.';
  updateControls();
}

function queryPanorama(candidate, token) {
  return new Promise(resolve => {
    let finished = false;
    const done = data => { if (finished) return; finished = true; clearTimeout(timeout); resolve(token === searchToken ? data : null); };
    const timeout = setTimeout(() => done(null), 5500);
    try {
      service.getPanorama({ location: candidate.point, radius: candidate.radius, preference: google.maps.StreetViewPreference.BEST, sources: [google.maps.StreetViewSource.GOOGLE, google.maps.StreetViewSource.OUTDOOR] }, (data, status) => done(status === 'OK' ? data : null));
    } catch { done(null); }
  });
}

function displayPanorama(panoId, heading, token) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let listener;
    const finish = error => { if (finished) return; finished = true; clearTimeout(timeout); listener?.remove(); error ? reject(error) : resolve(); };
    const check = () => {
      if (token !== searchToken) return finish(new Error('cancelled'));
      if (panorama.getPano() !== panoId) return;
      const status = panorama.getStatus();
      if (status === 'OK') finish();
      else if (status === 'ZERO_RESULTS') finish(new Error('거리뷰를 표시할 수 없는 지점입니다. 다른 위치를 선택해주세요.'));
    };
    const timeout = setTimeout(() => finish(new Error('거리뷰 표시 시간이 초과됐습니다. 인터넷 연결을 확인하고 다른 위치를 시도해주세요.')), 14000);
    listener = panorama.addListener('status_changed', check);
    $('scenePlaceholder').hidden = true; $('panorama').hidden = false;
    panorama.setPano(panoId); panorama.setPov({ heading, pitch: 0 }); panorama.setZoom(0); panorama.setVisible(true);
    // SDK status is delivered asynchronously; the timeout also covers a missing event.
  });
}

async function newRound() {
  if (!connected) { openSettings(); return; }
  if (['searching', 'connecting'].includes(phase)) return;
  const token = ++searchToken;
  const mode = $('regionSelect').value;
  phase = 'searching'; stopTimer(); round = null; guess = null;
  clearMarkers(); document.body.classList.remove('is-result'); $('resultCard').hidden = true;
  $('guessLat').value = ''; $('guessLng').value = '';
  $('guessHint').textContent = '지도를 확대하고 한 지점을 클릭하세요.';
  $('timer').textContent = '00:00'; $('roundBadge').textContent = '새 위치 준비 중';
  map.setOptions({ draggableCursor: 'crosshair' }); map.setCenter({ lat: 20, lng: 10 }); map.setZoom(2);
  showSceneLoading('새로운 길을 찾고 있어요', `${labels[mode]}의 거리뷰 제공 지역에서 무작위로 선택합니다.`);
  updateControls(); announce('새 위치의 거리뷰를 찾고 있습니다.');
  try {
    const searchStarted = performance.now();
    for (let attempt = 0; attempt < 18 && performance.now() - searchStarted < 50000; attempt++) {
      if (token !== searchToken) return;
      $('loadingDetail').textContent = `${labels[mode]} · 거리뷰 확인 중 (${attempt + 1}/18)`;
      const candidate = sampleCandidate(mode, randomUnit, attempt >= 10);
      const data = await queryPanorama(candidate, token);
      if (token !== searchToken) return;
      if (!data?.location?.latLng || !data.location.pano || !data.links?.length) continue;
      const actual = data.location.latLng.toJSON();
      if (!pointInMode(actual, mode)) continue;
      if (recentStarts.some(point => distanceMeters(point, actual) < 300)) continue;
      const heading = Math.floor(randomUnit() * 360);
      await displayPanorama(data.location.pano, heading, token);
      if (token !== searchToken) return;
      // Freeze the original panorama coordinate. Movement never changes the answer.
      round = Object.freeze({ actual: Object.freeze({ ...actual }), panoId: data.location.pano, heading, mode, description: data.location.description || data.location.shortDescription || '이름 없는 길', imageDate: data.imageDate || '' });
      recentStarts.push(actual); if (recentStarts.length > 10) recentStarts.shift();
      phase = 'playing'; $('panorama').inert = false; document.body.classList.remove('is-searching'); roundNumber++; $('roundBadge').textContent = `ROUND ${String(roundNumber).padStart(2, '0')}`;
      startTimer(); updateControls(); announce('거리뷰가 준비됐습니다. 주변을 살펴본 뒤 지도에 추측 위치를 선택하세요.'); return;
    }
    if (token === searchToken) showError('연결 가능한 거리뷰를 찾지 못했습니다. 다른 범위를 선택하거나 다시 시도해주세요. 반복되면 API 키·Maps JavaScript API 활성화·결제 설정을 확인해주세요.');
  } catch (error) {
    if (token === searchToken && error.message !== 'cancelled') showError(error.message || '새 위치를 불러오지 못했습니다. 다시 시도해주세요.');
  }
}

function submitGuess() {
  if (phase !== 'playing' || !round || !guess) return;
  const distance = distanceMeters(round.actual, guess);
  const seconds = (performance.now() - startedAt) / 1000;
  stopTimer(); phase = 'revealed'; map.setOptions({ draggableCursor: null });
  actualPin = new PinOverlay(round.actual, '실제 출발점', 'answer'); actualPin.setMap(map);
  routeLine = new google.maps.Polyline({ map, path: [guess, round.actual], geodesic: true, strokeOpacity: 0, icons: [{ icon: { path: 'M 0,-1 0,1', strokeColor: '#6c547d', strokeOpacity: .85, scale: 2 }, offset: '0', repeat: '12px' }] });
  document.body.classList.add('is-result'); $('resultCard').hidden = false;
  $('resultDistance').textContent = formatDistance(distance);
  $('resultMessage').textContent = distance < 100 ? '거의 정확한 지점이에요. 작은 단서까지 잘 읽으셨네요.' : distance < 10000 ? '가까운 곳을 찾았어요. 도로의 굽이와 교차로를 비교해보세요.' : distance < 300000 ? '지역의 단서를 더 살펴볼까요? 지형과 도로 표지를 비교해보세요.' : '새로운 지역을 배웠어요. 정답의 풍경과 내 추측을 비교해보세요.';
  const date = round.imageDate ? ` · 촬영 ${round.imageDate}` : '';
  $('actualLocation').textContent = `${round.description} · ${round.actual.lat.toFixed(5)}, ${round.actual.lng.toFixed(5)}${date}`;
  const link = new URL('https://www.google.com/maps'); link.searchParams.set('q', `${round.actual.lat},${round.actual.lng}`); $('actualLink').href = link.toString();
  map.fitBounds(boundsForPair(guess, round.actual), { top: 65, right: 40, bottom: 45, left: 40 });
  google.maps.event.addListenerOnce(map, 'idle', () => { if (phase === 'revealed' && map.getZoom() > 17) map.setZoom(17); });
  history.push({ distance, label: round.description.slice(0, 200), seconds, completedAt: new Date().toISOString() });
  history = history.slice(-100); storage.set('streetlens.history.v1', JSON.stringify(history)); renderHistory();
  $('practiceTip').textContent = '정답 지점에서 놓쳤던 단서를 다시 찾아보세요. 다음 연습에서는 같은 단서가 더 빨리 눈에 들어올 거예요.';
  updateControls(); $('resultTitle').focus({ preventScroll: true });
  announce(`추측을 제출했습니다. 정답과의 직선거리는 ${formatDistance(distance)}입니다.`);
}

async function connect(key) {
  if (phase === 'connecting') return;
  if (sdkAttempted) {
    // Google SDK authentication is page-scoped. A changed key requires a fresh page.
    try { sessionStorage.setItem('streetlens.pendingKey', key); } catch {
      $('settingsError').textContent = '페이지를 새로고침한 뒤 새 API 키를 다시 입력해주세요.'; $('settingsError').hidden = false; return;
    }
    location.reload(); return;
  }
  phase = 'connecting'; $('connectSubmit').disabled = true; $('apiKeyInput').disabled = true;
  $('settingsError').hidden = true; $('connectSubmit').textContent = 'Google Maps 연결 중…'; updateControls();
  try {
    await loadGoogle(key);
    if (phase === 'error') throw new Error('Google Maps 인증에 실패했습니다. API 키·결제 설정·허용 웹사이트를 확인해주세요.');
    initializeMaps(); connected = true; phase = 'idle'; $('settingsDialog').close();
    $('settingsButton').innerHTML = '<span class="live-dot" aria-hidden="true"></span>API 연결됨';
    await newRound();
  } catch (error) {
    connected = false; phase = 'error'; $('settingsError').textContent = error.message || 'Google Maps에 연결할 수 없습니다.'; $('settingsError').hidden = false;
    if (!$('settingsDialog').open) $('settingsDialog').showModal();
    announce('연결에 실패했습니다. API 설정을 확인해주세요.');
  } finally {
    $('connectSubmit').disabled = false; $('apiKeyInput').disabled = false;
    $('connectSubmit').textContent = '연결하고 연습 시작 ↗'; updateControls();
  }
}

window.gm_authFailure = () => {
  connected = false;
  $('settingsButton').textContent = 'API 연결 설정';
  showError('Google Maps 인증에 실패했습니다. API 키, 결제 계정, Maps JavaScript API 활성화와 이 웹사이트의 HTTP 리퍼러 허용 여부를 확인해주세요.', true);
  $('settingsError').textContent = 'Google Maps 인증 실패. API 키·결제·웹사이트 제한을 확인한 후 다시 연결해주세요.'; $('settingsError').hidden = false;
};
$('connectButton').addEventListener('click', () => connected ? newRound() : openSettings());
$('settingsButton').addEventListener('click', openSettings);
$('closeSettings').addEventListener('click', () => { if (phase !== 'connecting') $('settingsDialog').close(); });
$('settingsDialog').addEventListener('cancel', event => { if (phase === 'connecting') event.preventDefault(); });
$('toggleKey').addEventListener('click', () => {
  const visible = $('apiKeyInput').type === 'password'; $('apiKeyInput').type = visible ? 'text' : 'password';
  $('toggleKey').textContent = visible ? '숨김' : '표시'; $('toggleKey').setAttribute('aria-pressed', String(visible)); $('toggleKey').setAttribute('aria-label', visible ? 'API 키 숨기기' : 'API 키 표시');
});
$('settingsForm').addEventListener('submit', event => {
  event.preventDefault(); const key = $('apiKeyInput').value.trim();
  if (key.length < 20 || /\s/.test(key)) { $('settingsError').textContent = '공백 없이 API 키 전체를 입력해주세요.'; $('settingsError').hidden = false; return; }
  if ($('rememberKey').checked) storage.set('streetlens.apiKey', key); else storage.remove('streetlens.apiKey');
  connect(key);
});
$('newRoundButton').addEventListener('click', newRound);
$('nextRoundButton').addEventListener('click', newRound);
$('retryButton').addEventListener('click', () => $('retryButton').dataset.settings === 'true' || !connected ? openSettings() : newRound());
$('cancelSearch').addEventListener('click', () => {
  if (phase !== 'searching') return; searchToken++; phase = 'idle'; round = null;
  panorama?.setVisible(false); showWelcome(); $('roundBadge').textContent = '자유 연습'; updateControls(); announce('검색을 취소했습니다. 새 위치를 선택할 수 있습니다.');
});
$('northButton').addEventListener('click', () => { if (round && panorama) { panorama.setPov({ heading: 0, pitch: 0 }); announce('시선을 북쪽으로 정렬했습니다.'); } });
$('returnButton').addEventListener('click', () => { if (round && panorama) { panorama.setPano(round.panoId); panorama.setPov({ heading: round.heading, pitch: 0 }); panorama.setZoom(0); announce('원래 출발점으로 돌아왔습니다.'); } });
$('resetMapButton').addEventListener('click', () => { map?.setCenter({ lat: 20, lng: 10 }); map?.setZoom(2); });
$('submitGuess').addEventListener('click', submitGuess);
$('coordinateForm').addEventListener('submit', event => {
  event.preventDefault(); if (phase !== 'playing') return;
  if (!$('guessLat').value.trim() || !$('guessLng').value.trim()) return;
  const point = { lat: Number($('guessLat').value), lng: Number($('guessLng').value) };
  if (!validPoint(point)) { announce('위도는 -90~90, 경도는 -180~180 범위로 입력해주세요.'); return; }
  chooseGuess(point); map.panTo(point); if (map.getZoom() < 5) map.setZoom(5);
});
$('regionSelect').addEventListener('change', () => { announce(`다음 위치부터 ${labels[$('regionSelect').value]} 범위가 적용됩니다.`); });
window.addEventListener('pagehide', () => { searchToken++; stopTimer(); });
renderHistory(); updateControls();
const remembered = storage.get('streetlens.apiKey', '');
if (remembered) { $('apiKeyInput').value = remembered; $('rememberKey').checked = true; }
let pending = '';
try { pending = sessionStorage.getItem('streetlens.pendingKey') || ''; sessionStorage.removeItem('streetlens.pendingKey'); } catch { /* Session storage is optional. */ }
if (pending) { $('apiKeyInput').value = pending; openSettings(); connect(pending); }
