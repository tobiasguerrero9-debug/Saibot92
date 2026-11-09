export function hostedConfig(env = process.env) {
  const errors = [], stage = env.AUGUSTUS_ENV;
  if (!['development', 'preview', 'production'].includes(stage)) errors.push('AUGUSTUS_ENV');
  if (env.VERCEL_ENV && env.VERCEL_ENV !== stage) errors.push('Environment scope mismatch');
  let origin; try { origin = new URL(env.AUGUSTUS_ORIGIN); if (origin.origin !== env.AUGUSTUS_ORIGIN || (stage !== 'development' && origin.protocol !== 'https:')) throw Error(); } catch { errors.push('AUGUSTUS_ORIGIN'); }
  let database; try { database = new URL(env.DATABASE_URL); if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname.endsWith('.neon.tech') || database.searchParams.get('sslmode') !== 'require') throw Error(); } catch { errors.push('DATABASE_URL'); }
  let key; try { key = Buffer.from(env.AGENT_ENCRYPTION_KEY_BASE64 || '', 'base64'); if (key.length !== 32) throw Error(); } catch { errors.push('AGENT_ENCRYPTION_KEY_BASE64'); }
  if (!env.AGENT_ENCRYPTION_KEY_ID) errors.push('AGENT_ENCRYPTION_KEY_ID');
  if (!env.AUGUSTUS_DATABASE_SCOPE || !env.AUGUSTUS_DATABASE_SCOPE.startsWith(stage + ':')) errors.push('AUGUSTUS_DATABASE_SCOPE');
  if (!env.CRON_SECRET || env.CRON_SECRET.length < 32) errors.push('CRON_SECRET');
  const liveRequested = env.LIVE_EXECUTION === 'true';
  if (liveRequested && stage !== 'production') errors.push('Non-production live execution forbidden');
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') errors.push('TLS verification must remain enabled');
  if (errors.length) throw Error('Hosted configuration unavailable: ' + errors.join(', '));
  return Object.freeze({ stage, origin: origin.origin, databaseUrl: env.DATABASE_URL, databaseScope: env.AUGUSTUS_DATABASE_SCOPE, key, keyId: env.AGENT_ENCRYPTION_KEY_ID, cronSecret: env.CRON_SECRET, liveRequested, releaseReviewed: env.AUGUSTUS_RELEASE_REVIEWED === 'true', diagnosticsEnabled: env.AUGUSTUS_DIAGNOSTICS_ENABLED === 'true' && stage === 'development' });
}
export function executionGate(config, accountReview, readiness) {
  const reasons = [];
  if (config.stage !== 'production') reasons.push('Production scope required');
  if (!config.liveRequested) reasons.push('LIVE_EXECUTION is false');
  if (!config.releaseReviewed) reasons.push('Release review not approved');
  if (!accountReview?.reviewed || !accountReview?.allowed || !accountReview.reviewId || !(new Date(accountReview.expiresAt).getTime() > Date.now())) reasons.push('Account allowlist review required');
  if (!readiness?.persistence || !readiness?.identity || !readiness?.mapping || !readiness?.protectionWorker) reasons.push('Persistence, identity, mapping and protection worker must be ready');
  // Signer readiness is supplied only by the server execution path.
  if (!readiness?.signerReady) reasons.push('Live signer integration remains release-blocked');
  return { executionEnabled: reasons.length === 0, requested: config.liveRequested, reasons };
}
