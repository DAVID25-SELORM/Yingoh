import assert from 'node:assert/strict';
import { parseTutorCards } from '../src/utils/tutorCards.js';
import { PLAN_ENTITLEMENTS } from '../src/data/subscriptionPlans.js';
assert.equal(PLAN_ENTITLEMENTS.free.liveClasses,false);
for(const plan of ['basic','pro','master','faculty']) assert.equal(PLAN_ENTITLEMENTS[plan].liveClasses,true);
assert.deepEqual(parseTutorCards('```json\n[{"front":" Prompt ","back":" Answer "}]\n```'),[{front:'Prompt',back:'Answer'}]);
for(const bad of ['not json','{}','[]','[{"front":"","back":"x"}]','[{"front":42,"back":"x"}]']) assert.deepEqual(parseTutorCards(bad),[]);
console.log('PASS: paid plan access and malformed tutor flashcards');
