export const EARTH_RADIUS_METERS = 6371008.8;
export function validPoint(point) {
  return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}
export function distanceMeters(a, b) {
  if (!validPoint(a) || !validPoint(b)) throw new RangeError('유효한 위도와 경도가 필요합니다.');
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters).toLocaleString('ko-KR')} m`;
  return `${(meters / 1000).toLocaleString('ko-KR', { maximumFractionDigits: meters < 100000 ? 1 : 0 })} km`;
}
export function elapsedLabel(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function boundsForPair(a, b) {
  if (!validPoint(a) || !validPoint(b)) throw new RangeError('좌표 범위 오류');
  const crossesDateLine = Math.abs(a.lng - b.lng) > 180;
  return { south: Math.min(a.lat, b.lat), north: Math.max(a.lat, b.lat), west: crossesDateLine ? Math.max(a.lng, b.lng) : Math.min(a.lng, b.lng), east: crossesDateLine ? Math.min(a.lng, b.lng) : Math.max(a.lng, b.lng) };
}

// Coverage-oriented sampling areas. Regions are selected evenly, not by land area.
// These are search areas, never answer coordinates; the API returns the actual start.
// [group, south, west, north, east, fallback latitude, fallback longitude]
export const COVERAGE_REGIONS = [
  ['japan',42.1,140.6,44.0,144.3,43.062,141.354],
  ['japan',38.1,139.8,40.5,141.7,38.27,140.88],
  ['japan',35.2,136.8,37.1,139.0,36.65,138.18],
  ['japan',34.4,134.9,35.6,136.1,35.01,135.75],
  ['japan',33.3,132.6,34.2,134.5,33.84,132.77],
  ['japan',32.0,130.1,33.8,131.9,32.80,130.71],
  ['japan',26.15,127.65,26.65,128.15,26.21,127.68],
  ['korea',37.1,126.7,37.8,127.6,37.56,126.98],
  ['korea',35.0,126.6,36.7,128.8,35.87,128.60],
  ['korea',35.0,128.9,36.1,129.4,35.16,129.06],
  ['korea',33.25,126.2,33.52,126.9,33.50,126.53],
  ['iceland',63.85,-22.0,64.7,-19.5,64.14,-21.92],
  ['iceland',65.2,-19.7,66.0,-16.9,65.68,-18.09],
  ['iceland',64.65,-15.2,65.5,-13.7,65.26,-14.40],
  ['newzealand',-37.9,174.5,-36.2,175.9,-36.85,174.76],
  ['newzealand',-41.2,174.9,-38.0,176.8,-38.14,176.25],
  ['newzealand',-43.9,169.0,-41.1,173.3,-41.27,173.28],
  ['newzealand',-46.1,167.9,-44.0,171.0,-45.87,170.50],
  ['europe',50.6,-4.7,54.6,0.5,52.48,-1.90],
  ['europe',52.0,-9.4,54.5,-6.2,53.27,-9.05],
  ['europe',44.0,-2.0,49.0,5.4,47.22,-1.55],
  ['europe',38.0,-6.5,43.0,1.5,41.65,-0.88],
  ['europe',38.0,-9.2,41.8,-7.0,40.21,-8.43],
  ['europe',44.1,8.0,46.0,12.5,45.44,10.99],
  ['europe',48.0,7.9,53.8,13.6,51.34,12.38],
  ['europe',48.8,13.0,50.5,17.0,49.20,16.61],
  ['europe',49.5,16.1,53.6,22.0,52.41,16.93],
  ['europe',55.4,9.1,57.2,10.5,56.16,10.20],
  ['europe',56.1,12.7,61.5,17.2,59.27,15.21],
  ['europe',60.4,23.0,65.0,28.0,62.24,25.75],
  ['europe',59.1,8.0,63.4,11.7,60.79,11.07],
  ['europe',57.7,23.7,59.4,27.4,58.38,26.72],
  ['europe',45.7,22.0,47.5,27.0,46.77,23.59],
  ['europe',37.8,21.5,40.9,24.0,39.64,22.42],
  ['world',40.1,-80.5,44.0,-73.0,42.65,-73.75],
  ['world',34.0,-121.0,39.0,-116.0,36.75,-119.78],
  ['world',32.3,-98.0,36.0,-94.5,35.47,-97.52],
  ['world',43.0,-81.5,46.0,-75.5,43.45,-80.49],
  ['world',49.1,-123.5,51.5,-119.0,50.67,-120.33],
  ['world',19.0,-103.5,22.0,-98.5,20.59,-100.39],
  ['world',-24.0,-50.0,-20.0,-44.0,-22.90,-47.06],
  ['world',-12.5,-42.0,-8.0,-34.7,-8.05,-34.90],
  ['world',-37.0,-63.0,-31.0,-57.8,-34.92,-57.95],
  ['world',-39.0,-73.1,-33.0,-70.7,-36.83,-73.05],
  ['world',3.0,-76.6,7.0,-73.2,4.81,-75.69],
  ['world',-14.0,-76.8,-10.0,-74.3,-12.07,-75.21],
  ['world',-34.8,-58.0,-31.5,-54.0,-34.47,-57.84],
  ['world',-34.2,18.6,-29.5,22.5,-33.94,18.86],
  ['world',-28.5,26.0,-24.0,30.5,-26.71,27.10],
  ['world',-24.9,25.2,-21.0,28.0,-24.65,25.91],
  ['world',-1.5,35.0,1.0,37.5,-0.28,36.07],
  ['world',5.4,-2.7,8.4,0.1,6.69,-1.62],
  ['world',13.6,-17.2,15.9,-14.7,14.79,-16.93],
  ['world',35.5,32.0,40.0,39.0,37.87,32.49],
  ['world',16.0,99.3,19.5,103.5,16.43,102.83],
  ['world',2.0,101.0,5.8,103.0,4.60,101.09],
  ['world',12.0,120.5,16.0,122.1,15.49,120.60],
  ['world',-8.0,107.0,-6.4,112.7,-7.80,110.37],
  ['world',22.5,120.2,25.1,121.6,24.15,120.67],
  ['world',7.0,79.9,9.1,81.0,7.29,80.64],
  ['world',11.0,76.0,15.0,79.5,12.30,76.64],
  ['world',-36.8,141.0,-33.5,150.5,-35.28,149.13],
  ['world',-29.5,149.8,-24.5,152.5,-27.56,151.95],
  ['world',-34.5,115.6,-30.5,118.4,-31.65,116.67],
];
export function randomUnit() {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  return Math.random();
}
export function regionsFor(mode) {
  if (mode === 'world') return COVERAGE_REGIONS;
  return COVERAGE_REGIONS.filter(r => r[0] === mode || (mode === 'europe' && r[0] === 'iceland'));
}
export function sampleCandidate(mode, random = randomUnit, fallback = false) {
  const list = regionsFor(mode);
  if (!list.length) throw new RangeError('알 수 없는 연습 범위');
  const r = list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  const [, south, west, north, east, anchorLat, anchorLng] = r;
  if (fallback) return { point: { lat: anchorLat + (random() - .5) * .025, lng: anchorLng + (random() - .5) * .025 }, radius: 3500, region: r };
  const rad = Math.PI / 180;
  const lat = Math.asin(Math.sin(south * rad) + random() * (Math.sin(north * rad) - Math.sin(south * rad))) / rad;
  return { point: { lat, lng: west + random() * (east - west) }, radius: 18000, region: r };
}
export function pointInMode(point, mode) {
  return validPoint(point) && regionsFor(mode).some(([, s, w, n, e]) => point.lat >= s && point.lat <= n && point.lng >= w && point.lng <= e);
}
export function summarize(history) {
  const values = history.filter(x => Number.isFinite(x.distance) && x.distance >= 0).map(x => x.distance);
  return { count: values.length, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, best: values.length ? Math.min(...values) : null };
}
