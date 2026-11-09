import { decideEligibility } from './sessionPolicy.js';
import { validateLiveContext } from './mainnetContext.js';

// Public market interpretation only. Never read a tenant, risk budget or proposal.
export function publicMonitoring(context, now = Date.now()) {
  try { validateLiveContext(context, now); }
  catch { return { mode: 'PUBLIC MONITORING', setup: 'NO SETUP', proposal: null, executionEnabled: false, reason: 'Fresh live context unavailable.' }; }
  const result = decideEligibility(context, { direction: 'BOTH' }, now);
  return { mode: 'PUBLIC MONITORING', setup: result.decision === 'ENTRY_ELIGIBLE' ? 'SETUP DETECTED' : 'NO SETUP', proposal: null, executionEnabled: false, reason: result.reason, configurationRequired: true };
}
