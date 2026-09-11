import test from 'node:test';
import assert from 'node:assert/strict';
import {routeRewards} from '../lib/student-route.ts';
test('empty trail never awards completion bonus',()=>assert.equal(routeRewards([],[]).total,0));
test('drafts, unrelated submissions and duplicates do not earn extra points',()=>assert.deepEqual(routeRewards([{id:'a'},{id:'b'}],[{assignment_id:'a',status:'submitted'},{assignment_id:'a',status:'submitted'},{assignment_id:'b',status:'draft'},{assignment_id:'other',status:'submitted'}]),{completed:1,lessonPoints:10,bonus:0,total:10}));
test('completed trail awards exactly one 100 point bonus',()=>assert.equal(routeRewards([{id:'a'}],[{assignment_id:'a',status:'submitted'}]).total,110));
