/**
 * 业务员下拉：展示「编号 / 姓名」，value 仍为 sales_staff._id（客户/订单筛选不变）
 */
export function rowsToSalesStaffSelectOptions(rows) {
  return (rows || []).map((r) => ({
    value: r._id,
    text: `${r.sales_code || '—'} / ${r.sales_name || '—'}`
  }))
}

export async function loadSalesStaffRowsForSelect() {
  const db = uniCloud.database()
  const res = await db
    .collection('sales_staff')
    .field('_id,sales_code,sales_name,status')
    .orderBy('sales_code', 'asc')
    .limit(1000)
    .get()
  const list = (res && res.result && res.result.data) || []
  return list
}
