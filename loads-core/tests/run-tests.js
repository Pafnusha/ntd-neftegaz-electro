#!/usr/bin/env node
'use strict';
var path = require('path');
var assert = require('assert');
var root = path.join(__dirname, '..');

var field = require(path.join(root, 'field'));
var currents = require(path.join(root, 'calculations/currents'));
var phase = require(path.join(root, 'calculations/phase-balance'));
var feeds = require(path.join(root, 'feeds'));
var qf = require(path.join(root, 'breakers/select-qf'));
var model = require(path.join(root, 'model'));
var demo = require(path.join(root, 'projects/ktp1-demo'));

var passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS  ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL  ' + name);
    console.log('         ' + e.message);
  }
}

console.log('loads-core automated tests');

test('redundancy error when work+reserve same section', function () {
  var v = feeds.validateRedundancy({
    id: 'X',
    category: 1,
    feedWork: { sectionId: 'SEC-A', sourceId: 'V1' },
    feedReserve: { sectionId: 'SEC-A', sourceId: 'V2' }
  });
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some(function (e) { return /ERROR/.test(e); }));
});

test('redundancy ok when different sections', function () {
  var v = feeds.validateRedundancy({
    id: 'X',
    category: 1,
    feedWork: { sectionId: 'SEC-A', sourceId: 'V1' },
    feedReserve: { sectionId: 'SEC-B', sourceId: 'V2' }
  });
  assert.strictEqual(v.ok, true);
});

test('phase balance sums L1+L2+L3 = total Pr', function () {
  var consumers = [
    { id: 'a', phases: 3, Pr: 30 },
    { id: 'b', phases: 1, Pr: 10 },
    { id: 'c', phases: 1, Pr: 5 },
    { id: 'd', phases: 1, Pr: 7 }
  ];
  var r = phase.balancePhases(consumers, 50);
  var sum = r.sums.L1 + r.sums.L2 + r.sums.L3;
  assert.ok(Math.abs(sum - 52) < 1e-6, 'sum=' + sum);
  assert.ok(r.assignments.b);
  assert.ok(r.assignments.c);
  assert.ok(r.assignments.d);
});

test('QF pick basic Ib=22 -> In>=25', function () {
  var p = qf.pickQf(22, { factor: 1.25 });
  assert.ok(p.In >= 25, 'In=' + p.In);
  assert.ok(p.check.Ib_le_In);
});

test('manual field not overwritten on setAuto', function () {
  var f = field.setManual(null, 63, 'user');
  var f2 = field.setAuto(f, 32, 'auto');
  assert.strictEqual(f2.value, 63);
  assert.strictEqual(f2.mode, 'manual');
});

test('model JSON round-trip', function () {
  var m = demo.buildKtp1Demo('2in+DES+UPS');
  assert.strictEqual(m.name, 'KTP-1');
  assert.strictEqual(m.consumers.length, 6);
  var json = model.toJSON(m);
  var m2 = model.fromJSON(json);
  assert.strictEqual(m2.consumers.length, 6);
  assert.strictEqual(m2.consumers[0].id, 'N-101');
  assert.ok(m2.sources.some(function (s) { return s.type === 'SOURCE_DG'; }));
  assert.ok(m2.sources.some(function (s) { return s.type === 'UPS'; }));
  assert.ok(m2.group.Pr > 0);
});

test('KTP-1 N-101 feeds V1/V2 different', function () {
  var m = demo.buildKtp1Demo('2in+DES+UPS');
  var n101 = m.consumers.find(function (c) { return c.id === 'N-101'; });
  assert.strictEqual(n101.feedWork.sourceId, 'V1');
  assert.strictEqual(n101.feedReserve.sourceId, 'V2');
  var v = feeds.validateRedundancy(n101);
  assert.strictEqual(v.ok, true);
});

test('Server on UPS', function () {
  var m = demo.buildKtp1Demo('2in+DES+UPS');
  var s = m.consumers.find(function (c) { return c.id === 'Server-1'; });
  assert.ok(s.upsRequired || s.category === 'special');
  assert.ok(s.feedWork && (s.feedWork.sectionId === 'SEC-UPS' || (s.feedUps && s.feedUps.sourceId)));
});

test('1φ/3φ currents finite', function () {
  var a = currents.calcConsumerPowers({ Pn: 18.5, ki: 0.8, cosPhi: 0.85, eta: 0.92, Ukv: 0.4, phases: 3 });
  var b = currents.calcConsumerPowers({ Pn: 10, ki: 0.9, cosPhi: 0.95, eta: 1, Ukv: 0.4, phases: 1 });
  assert.ok(a.Ir > 0 && isFinite(a.Ir));
  assert.ok(b.Ir > 0 && isFinite(b.Ir));
});

test('autoAssign detects same-source error when forced', function () {
  var consumers = [{
    id: 'bad',
    category: 1,
    upsRequired: false,
    feedWorkManual: true,
    feedReserveManual: true,
    feedWork: { sectionId: 'SEC-A', sourceId: 'V1' },
    feedReserve: { sectionId: 'SEC-A', sourceId: 'V1' }
  }];
  var r = feeds.autoAssignFeeds(consumers, [
    { id: 'SEC-A' }, { id: 'SEC-B' }
  ], [{ id: 'V1', type: 'GRID' }, { id: 'V2', type: 'GRID' }]);
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.length > 0);
});

console.log('');
console.log('Result: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
