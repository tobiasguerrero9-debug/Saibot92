# Stop lifecycle audit

Scope: code review and simulated exchange tests, not live execution certification. The current implementation is described in [the execution-path addendum](AUGUSTUS-EXECUTION-PATH.md); a separate hosted protection worker now exists, but real cloud operation remains unverified.

| Case | Current behavior | Release assessment |
| --- | --- | --- |
| Successful entry | Reconciles fills before sizing protection | Simulation covered |
| Partial fill | Stop size uses actual filled exposure; no second entry | Simulation covered |
| Stop acknowledgement | Does not establish PROTECTED | Correct fail-closed boundary |
| Stop verification | Independent open-order check requires correct market, side, trigger, reduce-only and sufficient size | Simulation covered |
| Rejected stop | Bounded protection attempts; then emergency reduce-only close | Simulation covered |
| Delayed/ambiguous stop | Reconciles same CLOID; no blind new stop identifier | Simulation covered; live latency not validated |
| Connection loss | Fresh state cannot be established; entry blocked; managed emergency close attempted; unresolved result stays an incident | Worker implemented; hosted outage validation pending |
| Restart during position | Entry slot remains consumed; worker reconstructs linkage, actual size and protection without entry replay | Mocked restart covered; hosted restart validation pending |
| Duplicate stop attempt | CLOID reconciliation prevents blind duplicate writes | Simulation covered |
| Emergency close | Uses actual exposure and reduce-only; independently checks flat state | Simulation covered |
| Partial/ambiguous emergency close | Reconciles previous exit; permits one new reduce-only attempt only after terminal confirmation; otherwise retains incident | Mocked recovery covered; hosted validation pending |
| Kill switch | Blocks new entries; does not cancel unrelated/protective orders | Simulation covered |

Relevant suites: real-execution, hosted, mainnet-adapter, mainnet-canary, product-execution, product-session and session. The context collector is separate from the new protection worker. Hosted execution requires both global flags, an unexpired account review, verified identity/mapping, persistence, fresh context/risk and healthy protection worker. Flags remain false. Before a live canary, deploy/migrate and validate hosted protection ownership, restart recovery and emergency-close availability, then require fresh proposal-specific human approval.
