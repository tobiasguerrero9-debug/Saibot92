// Optional read-only context. No subscription to SAIBOT singleton state; never a signal.
export function adaptSaibotContext(input) {
  if (!input) return { available: false, note: 'No SAIBOT92 context supplied. No execution signal inferred.' };
  const fields = ['agentState', 'marketBias', 'contextScore', 'whatChanged', 'squeezeState', 'fundingContext', 'orderFlowContext'];
  return Object.freeze({ available: true, ...Object.fromEntries(fields.filter(k => input[k] !== undefined).map(k => [k, structuredClone(input[k])])), note: 'Context only. Entry criteria, risk validation and explicit approval are still required.' });
}
