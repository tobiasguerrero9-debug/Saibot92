import { ResearchFeed } from './researchFeed.js';
import { decideEligibility } from './sessionPolicy.js';
import { CONTEXT_FIELDS } from './mainnetCanary.js';

export function validateLiveContext(context, now = Date.now()) {
  if (!context || context.symbol !== 'ETH' || !Number.isFinite(context.timestamp) || context.timestamp > now || now - context.timestamp > 10000 || CONTEXT_FIELDS.some(k => context[k] == null)) throw Error('Required SAIBOT92 context missing or stale.');
  if (!context.whatChanged?.hasHistory || !Number.isFinite(context.contextScore) || context.contextScore < 0 || context.contextScore > 100 || !Number.isFinite(context.orderFlow?.buyRatio) || context.orderFlow.buyRatio < 0 || context.orderFlow.buyRatio > 1 || !Number.isFinite(context.openInterest) || context.openInterest <= 0 || !Number.isFinite(context.funding) || context.liquidationContext?.status !== 'OBSERVING' || !Number.isFinite(context.liquidationContext.observedSince) || context.liquidationContext.observedSince > now) throw Error('SAIBOT92 context incomplete: history, liquidation observation or numeric telemetry unavailable.');
  for (const key of ['agentState', 'marketBias', 'squeezeState', 'transitionPressure']) if (typeof context[key] !== 'string' || !context[key] || /UNAVAILABLE|UNKNOWN|PENDING DATA/i.test(context[key])) throw Error('Unavailable SAIBOT92 interpretation.');
  return context;
}
export class MainnetContextFeed {
  constructor(feed = new ResearchFeed()) { this.feed = feed; }
  start() { return this.feed.startLiquidations(); }
  async read() {
    const context = await this.feed.read();
    return { ...context, source: context.source.replace('execution prices come from Hyperliquid TESTNET', 'execution prices come from Hyperliquid MAINNET; research source is separate') };
  }
  async eligible(side, now = Date.now()) {
    const context = validateLiveContext(await this.read(), now);
    const decision = decideEligibility(context, { direction: side === 'LONG' ? 'LONG_ONLY' : 'SHORT_ONLY' }, now);
    if (decision.decision !== 'ENTRY_ELIGIBLE' || decision.side !== side) throw Error('Entry ineligible: ' + decision.reason);
    return { context, whyEntryEligible: decision.reason };
  }
}
