import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkerLoader } from '../../test-support/worker-module.mjs';

const { buildNodeStats, statsRegionKey } = createWorkerLoader({}).load('worker/src/utils/node-stats.ts');

test('returns zeroed stats for an empty fleet', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(buildNodeStats([], [], {}))), {
    onlineCount: 0,
    totalCount: 0,
    offlineCount: 0,
    regionCount: 0,
    totalUp: 0,
    totalDown: 0,
    totalSpeedUp: 0,
    totalSpeedDown: 0,
  });
});

test('counts online and offline nodes and sums only online traffic', () => {
  const clients = [
    { uuid: 'a', region: 'JP' },
    { uuid: 'b', region: 'JP' },
    { uuid: 'c', region: 'US' },
  ];
  const live = {
    a: { net_total_up: 100, net_total_down: 200, net_out: 10, net_in: 20 },
    b: { net_total_up: 1000, net_total_down: 2000, net_out: 100, net_in: 200 },
    c: { net_total_up: 5, net_total_down: 6, net_out: 7, net_in: 8 },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(buildNodeStats(clients, ['a', 'c'], live))), {
    onlineCount: 2,
    totalCount: 3,
    offlineCount: 1,
    regionCount: 2,
    totalUp: 105,
    totalDown: 206,
    totalSpeedUp: 17,
    totalSpeedDown: 28,
  });
});

test('ignores non-numeric and missing live fields', () => {
  const clients = [{ uuid: 'a', region: 'JP' }];
  const live = { a: { net_total_up: '100', net_total_down: null, net_out: Number.NaN, net_in: 5 } };
  const stats = buildNodeStats(clients, ['a'], live);
  assert.equal(stats.totalUp, 0);
  assert.equal(stats.totalDown, 0);
  assert.equal(stats.totalSpeedUp, 0);
  assert.equal(stats.totalSpeedDown, 5);
});

test('drops unknown regions and normalises two-letter codes', () => {
  assert.equal(statsRegionKey(undefined), null);
  assert.equal(statsRegionKey(null), null);
  assert.equal(statsRegionKey(''), null);
  assert.equal(statsRegionKey('unknown'), null);
  assert.equal(statsRegionKey('n/a'), null);
  assert.equal(statsRegionKey('jp'), 'JP');
  assert.equal(statsRegionKey('Tokyo, JP'), 'JP');
  assert.equal(statsRegionKey('Frankfurt'), 'Frankfurt');
});
