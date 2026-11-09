export function parseExecutionResponse(response) {
  if (response?.status !== 'ok') return { status: 'REJECTED', reason: typeof response?.response === 'string' ? response.response : 'Exchange rejected request.' };
  const statuses = response.response?.data?.statuses;
  if (!Array.isArray(statuses) || !statuses.length) return { status: 'FAILED', reason: 'Unrecognized exchange response; reconcile before retry.' };
  const orders = statuses.map(item => {
    if (item?.error) return { status: 'REJECTED', reason: String(item.error) };
    if (item?.filled && Number.isSafeInteger(item.filled.oid) && Number(item.filled.totalSz) > 0) return { status: 'FILLED', orderId: item.filled.oid, filledSize: Number(item.filled.totalSz), price: Number(item.filled.avgPx) };
    if (item?.resting && Number.isSafeInteger(item.resting.oid)) return { status: 'RESTING', orderId: item.resting.oid };
    if (item === 'success') return { status: 'CANCELED' };
    if (item === 'waitingForFill' || item === 'waitingForTrigger') return { status: 'SUBMITTED', exchangeStatus: item };
    return { status: 'FAILED', reason: 'Unknown order status.' };
  });
  return { status: orders.some(o => ['FAILED', 'REJECTED'].includes(o.status)) ? 'FAILED' : orders[0].status, orders };
}

export function parseOrderStatus(data, requestedSize) {
  if (data?.status !== 'order' || !data.order?.order) return { status: 'FAILED', reason: 'Order cannot be reconciled.' };
  const { order, status } = data.order;
  const remaining = Number(order.sz);
  if (status === 'open') return { status: remaining < requestedSize ? 'PARTIAL' : 'RESTING', orderId: order.oid, remaining };
  if (status === 'filled') return { status: 'FILLED', orderId: order.oid };
  if (/cancel/i.test(status)) return { status: 'CANCELED', orderId: order.oid };
  if (/reject/i.test(status)) return { status: 'REJECTED', orderId: order.oid };
  return { status: 'SUBMITTED', orderId: order.oid, exchangeStatus: status };
}
