import test from 'node:test';
import assert from 'node:assert/strict';
import { nextOnboardingStep } from '../../src/augustus/state/onboarding.js';
test('new users configure risk before authorization and ARM', () => {
  assert.equal(nextOnboardingStep({ account: { agentAuthorized: false } }), 2);
  assert.equal(nextOnboardingStep({ risk: {}, account: { agentAuthorized: false } }), 3);
});
test('returning users skip completed risk and authorization without automatically arming', () => {
  assert.equal(nextOnboardingStep({ risk: {}, account: { agentAuthorized: true }, armed: false }), 4);
  assert.equal(nextOnboardingStep({ risk: {}, account: { agentAuthorized: false } }), 3);
});
