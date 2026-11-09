// Server module only. A plain object/client supplied by a request is never a capability.
const capabilities = new WeakSet();
export function registerExecutionClient(client) { capabilities.add(client); return client; }
export function isExecutionClient(client) { return !!client && capabilities.has(client); }
