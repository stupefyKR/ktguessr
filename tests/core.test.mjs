import test from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_RADIUS_METERS, validPoint, distanceMeters, formatDistance, elapsedLabel, boundsForPair, sampleCandidate, regionsFor, pointInMode, summarize } from '../dist/core.mjs';

test('same point, including poles, returns zero', () => {
  assert.equal(distanceMeters({lat:37.5,lng:127}, {lat:37.5,lng:127}), 0);
  assert.ok(distanceMeters({lat:90,lng:0}, {lat:90,lng:180}) < .000001);
});
test('one degree of latitude is about 111.195 km', () => {
  assert.ok(Math.abs(distanceMeters({lat:0,lng:0}, {lat:1,lng:0}) - 111195.0802) < .001);
});
test('date-line crossing uses the short great-circle distance', () => {
  assert.ok(Math.abs(distanceMeters({lat:0,lng:179}, {lat:0,lng:-179}) - 222390.1605) < .001);
});
test('antipodal points stay finite and equal half the circumference', () => {
  const d = distanceMeters({lat:0,lng:0}, {lat:0,lng:180});
  assert.ok(Number.isFinite(d)); assert.ok(Math.abs(d - Math.PI * EARTH_RADIUS_METERS) < .001);
});
test('invalid, empty and nonfinite coordinates are rejected', () => {
  for (const p of [null, {}, {lat:91,lng:0}, {lat:0,lng:181}, {lat:NaN,lng:0}, {lat:0,lng:Infinity}, {lat:'0',lng:0}]) {
    assert.equal(validPoint(p), false); assert.throws(() => distanceMeters(p, {lat:0,lng:0}), RangeError);
  }
});
test('pair bounds cross the date line instead of fitting most of Earth', () => {
  assert.deepEqual(boundsForPair({lat:10,lng:179}, {lat:-5,lng:-177}), {south:-5,north:10,west:179,east:-177});
  assert.deepEqual(boundsForPair({lat:10,lng:4}, {lat:20,lng:8}), {south:10,north:20,west:4,east:8});
});
test('region sampler and fallback anchors stay in the selected practice area', () => {
  let n = 87;
  const rng = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  for (const mode of ['world','japan','korea','europe','iceland','newzealand']) {
    assert.ok(regionsFor(mode).length > 0);
    for (const fallback of [false,true]) for (let i=0;i<1000;i++) {
      const sample = sampleCandidate(mode,rng,fallback);
      assert.equal(pointInMode(sample.point,mode), true, `${mode}: ${JSON.stringify(sample.point)}`);
    }
  }
});
test('selected areas exclude known locations in other countries', () => {
  assert.equal(pointInMode({lat:37.5665,lng:126.978},'japan'),false);
  assert.equal(pointInMode({lat:43.062,lng:141.354},'japan'),true);
  assert.equal(pointInMode({lat:0,lng:0},'iceland'),false);
  assert.throws(() => sampleCandidate('unknown'), RangeError);
});
test('results and duration formatting have usable units', () => {
  assert.equal(formatDistance(0),'0 m'); assert.equal(formatDistance(125),'125 m');
  assert.equal(formatDistance(1500),'1.5 km'); assert.equal(formatDistance(NaN),'—');
  assert.equal(elapsedLabel(125.8),'02:05'); assert.equal(elapsedLabel(3661),'61:01');
});
test('statistics retain a real zero-distance best result', () => {
  assert.deepEqual(summarize([]),{count:0,average:null,best:null});
  assert.deepEqual(summarize([{distance:1000},{distance:0},{distance:2000},{distance:NaN}]),{count:3,average:1000,best:0});
});
