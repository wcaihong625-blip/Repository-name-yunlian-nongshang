const db = uniCloud.database()
const dbCmd = db.command
const { verifyToken } = require('nxt-auth')

/** 与小程序 callCloudObject 约定一致的成功码 */
const OK = 200

const STAFF_AUTH_FIELDS = {
  _id: true,
  sales_name: true,
  mobile: true,
  sales_code: true,
  status: true,
  bind_user_id: true,
  bind_time: true
}

const CHANNEL_LIGHT_FIELDS = {
  _id: true,
  invite_code: true,
  channel_name: true,
  sales_id: true,
  sales_name: true
}

const CUSTOMER_DASHBOARD_FIELDS = {
  nickname: true,
  mobile: true,
  created_at: true
}

const CUSTOMER_LIST_FIELDS = {
  _id: true,
  user_id: true,
  nickname: true,
  mobile: true,
  avatar: true,
  member_status: true,
  member_expire_time: true,
  first_bind_time: true,
  created_at: true
}

const MEMBER_COMMISSION_LIST_FIELDS = {
  _id: true,
  order_no: true,
  customer_id: true,
  user_id: true,
  mobile: true,
  commission_type: true,
  order_type: true,
  pay_amount: true,
  commission_amount: true,
  commission_status: true,
  pay_time: true,
  created_at: true
}

function normalizeMobile(m) {
  if (m === undefined || m === null) return ''
  const s = String(m).trim().replace(/\s/g, '')
  return s
}

function maskMobile(m) {
  const raw = normalizeMobile(m)
  if (!raw) return ''
  return raw.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

/** 未绑定账号的销售员：无字段 / 空串 / null（不覆盖已有 bind_user_id） */
function whereBindUserIdUnset() {
  return dbCmd.or([
    { bind_user_id: dbCmd.exists(false) },
    { bind_user_id: '' },
    { bind_user_id: null }
  ])
}

/**
 * 优先从 verifyToken 结果取手机号；uni-id 校验成功时 JWT 里未必带 mobile，需再查表。
 */
function pickMobileFromTokenResult(tokenResult) {
  const u = tokenResult.user
  if (u && u.mobile) return normalizeMobile(u.mobile)
  const d = tokenResult.decoded
  if (d && typeof d === 'object') {
    if (d.mobile) return normalizeMobile(d.mobile)
    if (d.userInfo && d.userInfo.mobile) return normalizeMobile(d.userInfo.mobile)
    if (d.user && d.user.mobile) return normalizeMobile(d.user.mobile)
  }
  return ''
}

async function getLoginMobile(tokenResult, uid) {
  let mobile = pickMobileFromTokenResult(tokenResult)
  if (mobile) return mobile
  const userRes = await db.collection('uni-id-users').doc(uid).field({ mobile: true }).get()
  const row = userRes.data && userRes.data[0]
  if (row && row.mobile) return normalizeMobile(row.mobile)
  return ''
}

function staffAuthOk(staff) {
  return {
    code: OK,
    isSales: true,
    staff: {
      sales_id: staff._id,
      sales_name: staff.sales_name,
      mobile: staff.mobile,
      sales_code: staff.sales_code,
      status: staff.status
    }
  }
}

/**
 * 云对象上下文：uniCloud 云对象方法里的 this，需提供 getUniIdToken / getClientInfo。
 * 不使用 this._xxx 下划线方法：部分环境下下划线方法不会挂到实例上，会导致 is not a function。
 *
 * 识别顺序：1) verifyToken 取 uid → 2) bind_user_id 命中且启用 → 3) 手机号唯一且未绑定时自动绑定 → 4) 否则无权限
 */
async function getStaffByTokenStrict(ctx) {
  const token = ctx.getUniIdToken()
  if (!token) return { code: 401, message: '未登录' }

  const tokenResult = await verifyToken({ token }, ctx.getClientInfo())
  if (!tokenResult.success) {
    return { code: 401, message: tokenResult.error || '登录失效' }
  }

  const uid =
    (tokenResult.user && tokenResult.user.userId) || tokenResult.userId || ''
  if (!uid) {
    return { code: 401, message: '无法识别当前用户' }
  }

  const byBind = await db.collection('sales_staff').where({
    bind_user_id: uid,
    status: 1
  }).field(STAFF_AUTH_FIELDS).limit(1).get()

  if (byBind.data.length) {
    return staffAuthOk(byBind.data[0])
  }

  const mobile = await getLoginMobile(tokenResult, uid)
  if (!mobile) {
    return { code: 403, message: '非销售员身份或账号已停用', isSales: false }
  }

  const pending = await db.collection('sales_staff').where(
    dbCmd.and([{ mobile: mobile }, { status: 1 }, whereBindUserIdUnset()])
  ).field(STAFF_AUTH_FIELDS).get()

  if (pending.data.length !== 1) {
    return { code: 403, message: '非销售员身份或账号已停用', isSales: false }
  }

  const cand = pending.data[0]
  const bindTime = Date.now()
  const updateRes = await db.collection('sales_staff').where(
    dbCmd.and([
      { _id: cand._id },
      { mobile: mobile },
      { status: 1 },
      whereBindUserIdUnset()
    ])
  ).update({
    bind_user_id: uid,
    bind_time: bindTime
  })

  const updated =
    (updateRes && (updateRes.updated || updateRes.affectedDocs)) || 0
  if (!updated) {
    const retry = await db.collection('sales_staff').where({
      bind_user_id: uid,
      status: 1
    }).field(STAFF_AUTH_FIELDS).limit(1).get()
    if (retry.data.length) {
      return staffAuthOk(retry.data[0])
    }
    return { code: 403, message: '非销售员身份或账号已停用', isSales: false }
  }

  const fresh = await db.collection('sales_staff').doc(cand._id).field(STAFF_AUTH_FIELDS).get()
  const staff = fresh.data && fresh.data[0] ? fresh.data[0] : { ...cand, bind_user_id: uid, bind_time: bindTime }
  return staffAuthOk(staff)
}

async function buildLastOrderTimeMap(userIds) {
  const map = {}
  const ids = [...new Set((userIds || []).filter(Boolean))]
  if (!ids.length) return map
  await Promise.all(
    ids.map((uid) =>
      db
        .collection('member_order')
        .where({ user_id: uid, order_status: 1 })
        .orderBy('created_at', 'desc')
        .limit(1)
        .field({ created_at: true })
        .get()
        .then((r) => {
          if (r.data && r.data[0]) map[uid] = r.data[0].created_at
        })
    )
  )
  return map
}

module.exports = {
  /**
   * 轻量权限探测：仅用于「我的」页是否展示销售中心入口，永不返回 403。
   * 权限规则与 getStaffByTokenStrict 一致：已绑定则认 bind_user_id；未绑定则手机号唯一时首次自动绑定。
   */
  async checkSalesAccess() {
    const auth = await getStaffByTokenStrict(this)
    if (auth.code !== OK || !auth.staff) {
      return { code: OK, message: 'ok', data: { hasAccess: false } }
    }
    const staff = auth.staff
    return {
      code: OK,
      message: 'ok',
      data: {
        hasAccess: true,
        sales_id: staff.sales_id,
        sales_name: staff.sales_name || '',
        sales_code: staff.sales_code || ''
      }
    }
  },

  /**
   * 小程序销售员推广信息
   */
  async getSalesPromotionInfo() {
    const auth = await getStaffByTokenStrict(this)
    if (auth.code !== OK) return auth

    const { sales_id, sales_name } = auth.staff

    // 仅取必要字段，降低云函数执行开销
    let channelRes = await db.collection('sales_channel').where({
      sales_id: sales_id,
      status: 1
    }).field({
      _id: true,
      invite_code: true,
      channel_name: true
    }).orderBy('invite_code', 'desc').limit(1).get()

    // 兼容：若排序链路受索引影响异常，退化为无排序兜底，避免前端超时
    if (!channelRes || !Array.isArray(channelRes.data) || channelRes.data.length === 0) {
      channelRes = await db.collection('sales_channel').where({
        sales_id: sales_id,
        status: 1
      }).field({
        _id: true,
        invite_code: true,
        channel_name: true
      }).limit(1).get()
    }

    if (channelRes.data.length === 0) {
      return { code: 404, message: '未找到该销售员的有效推广渠道' }
    }

    const channel = channelRes.data[0]
    return {
      code: OK,
      data: {
        sales_id,
        sales_name,
        invite_code: channel.invite_code,
        channel_id: channel._id,
        channel_name: channel.channel_name,
        promotion_path: `/pages/open-shop/open-shop?invite_code=${channel.invite_code}`,
        share_text: `云链农商供销发布平台，实时行情每日更新+专业行情分析，产销定价一眼看懂`
      }
    }
  },

  /**
   * 小程序销售员首页统计（字段与 dashboard.vue 对齐）
   */
  async getSalesCenterDashboard() {
    const auth = await getStaffByTokenStrict(this)
    if (auth.code !== OK) return auth

    const { sales_id, sales_name } = auth.staff
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const channelRes = await db.collection('sales_channel').where({
      sales_id: sales_id,
      status: 1
    }).field(CHANNEL_LIGHT_FIELDS).orderBy('invite_code', 'desc').limit(1).get()
    const inviteCode =
      channelRes.data.length > 0 ? channelRes.data[0].invite_code || '' : ''

    // 名下客户：与订单归因一致，使用 current_sales_id（当前服务业务员）
    const customerCountRes = await db.collection('customer_profile').where({
      current_sales_id: sales_id
    }).count()

    const startTimeStamp = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const estimatedRes = await db.collection('member_order').where({
      sales_id: sales_id,
      order_status: 1,
      commission_status: 0,
      created_at: dbCmd.gte(startTimeStamp)
    }).field({ commission_amount: true }).get()

    const monthEstimatedCommission = estimatedRes.data.reduce(
      (sum, item) => sum + (item.commission_amount || 0),
      0
    )

    const settledRes = await db.collection('member_order').where({
      sales_id: sales_id,
      order_status: 1,
      commission_status: 1,
      commission_settlement_month: currentMonth
    }).field({ commission_amount: true }).get()

    const monthSettledCommission = settledRes.data.reduce(
      (sum, item) => sum + (item.commission_amount || 0),
      0
    )

    const totalRes = await db.collection('member_order').where({
      sales_id: sales_id,
      order_status: 1
    }).field({ commission_amount: true }).get()

    const totalCommission = totalRes.data.reduce(
      (sum, item) => sum + (item.commission_amount || 0),
      0
    )

    const latestRes = await db.collection('customer_profile').where({
      current_sales_id: sales_id
    }).field(CUSTOMER_DASHBOARD_FIELDS).orderBy('created_at', 'desc').limit(5).get()

    return {
      code: OK,
      data: {
        staff: {
          name: sales_name,
          invite_code: inviteCode
        },
        customerCount: customerCountRes.total,
        monthEstimatedCommission: parseFloat(monthEstimatedCommission.toFixed(2)),
        monthSettledCommission: parseFloat(monthSettledCommission.toFixed(2)),
        totalCommission: parseFloat(totalCommission.toFixed(2)),
        latestDynamics: latestRes.data.map((item) => ({
          type: 'new_customer',
          name:
            item.nickname ||
            (item.mobile ? maskMobile(item.mobile) : '新客户'),
          time: item.created_at
        }))
      }
    }
  },

  /**
   * 我的客户列表（current_sales_id；与 customers.vue 字段对齐）
   */
  async getMySalesCustomers(params = {}) {
    const auth = await getStaffByTokenStrict(this)
    if (auth.code !== OK) return auth

    const { sales_id } = auth.staff
    const page = Math.max(1, parseInt(params.page, 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(params.pageSize, 10) || 20))
    const keyword = params.keyword != null ? String(params.keyword).trim() : ''

    let query = {
      current_sales_id: sales_id
    }

    if (keyword) {
      query = dbCmd.and([
        query,
        dbCmd.or([
          { mobile: new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          { nickname: new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        ])
      ])
    }

    const countRes = await db.collection('customer_profile').where(query).count()
    const listRes = await db
      .collection('customer_profile')
      .where(query)
      .field(CUSTOMER_LIST_FIELDS)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const userIds = listRes.data.map((i) => i.user_id).filter(Boolean)
    const lastOrderMap = await buildLastOrderTimeMap(userIds)

    return {
      code: OK,
      data: {
        list: listRes.data.map((item) => ({
          _id: item._id,
          customer_id: item._id,
          user_id: item.user_id,
          user_nickname: item.nickname || '',
          user_mobile: item.mobile ? maskMobile(item.mobile) : '',
          user_avatar: item.avatar || '',
          member_status: item.member_status,
          member_expire_time: item.member_expire_time,
          bind_time: item.first_bind_time || item.created_at,
          created_at: item.created_at,
          last_order_time: lastOrderMap[item.user_id] || null
        })),
        total: countRes.total,
        page,
        pageSize
      }
    }
  },

  /**
   * 我的提成（与 commission.vue 对齐）
   */
  async getMySalesCommission(params = {}) {
    const auth = await getStaffByTokenStrict(this)
    if (auth.code !== OK) return auth

    const { sales_id } = auth.staff
    const page = Math.max(1, parseInt(params.page, 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(params.pageSize, 10) || 20))
    const now = new Date()
    const targetMonth =
      params.month && String(params.month).trim()
        ? String(params.month).trim()
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const [year, mon] = targetMonth.split('-').map(Number)
    const startTimeStamp = new Date(year, mon - 1, 1).getTime()
    const endTimeStamp = new Date(year, mon, 1).getTime()

    const query = {
      sales_id: sales_id,
      order_status: 1,
      created_at: dbCmd.gte(startTimeStamp).and(dbCmd.lt(endTimeStamp))
    }

    const countRes = await db.collection('member_order').where(query).count()
    const listRes = await db
      .collection('member_order')
      .where(query)
      .field(MEMBER_COMMISSION_LIST_FIELDS)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    const statsRes = await db
      .collection('member_order')
      .where(query)
      .field({ commission_amount: true, commission_status: true })
      .get()

    let est = 0
    let set = 0
    statsRes.data.forEach((item) => {
      if (item.commission_status === 0) est += item.commission_amount || 0
      else if (item.commission_status === 1) set += item.commission_amount || 0
    })

    const totalAllRes = await db
      .collection('member_order')
      .where({ sales_id: sales_id, order_status: 1 })
      .field({ commission_amount: true })
      .get()
    const totalCommissionAll = totalAllRes.data.reduce(
      (sum, item) => sum + (item.commission_amount || 0),
      0
    )

    const uids = [...new Set(listRes.data.map((i) => i.user_id).filter(Boolean))]
    let nickByUserId = {}
    if (uids.length) {
      const profs = await db
        .collection('customer_profile')
        .where({ user_id: dbCmd.in(uids) })
        .field({ user_id: true, nickname: true, mobile: true })
        .get()
      profs.data.forEach((p) => {
        nickByUserId[p.user_id] = p.nickname || ''
      })
    }

    return {
      code: OK,
      data: {
        list: listRes.data.map((item) => {
          const nick = nickByUserId[item.user_id] || ''
          const commissionType =
            item.commission_type ||
            (item.order_type === 1 ? 'first_open' : 'renewal')
          return {
            order_id: item._id,
            order_no: item.order_no,
            customer_id: item.customer_id || item.user_id || '',
            customer_nickname:
              nick ||
              (item.mobile ? maskMobile(item.mobile) : '') ||
              '',
            commission_type: commissionType,
            order_pay_amount: item.pay_amount,
            commission_amount: item.commission_amount,
            commission_status: item.commission_status,
            pay_time: item.pay_time || item.created_at,
            created_at: item.created_at
          }
        }),
        total: countRes.total,
        summary: {
          monthEstimatedCommission: parseFloat(est.toFixed(2)),
          monthSettledCommission: parseFloat(set.toFixed(2)),
          totalCommission: parseFloat(totalCommissionAll.toFixed(2))
        },
        page,
        pageSize
      }
    }
  },

  async recordCustomerSource(params) {
    let { user_id, mobile, sales_id, channel_id, invite_code } = params

    if (!user_id && !mobile) {
      return { code: 400, message: '无效的用户信息' }
    }

    let final_channel_id = ''
    let final_channel_name = ''
    let final_sales_id = ''
    let final_sales_name = ''

    if (channel_id) {
      const channelRes = await db.collection('sales_channel').doc(channel_id).get()
      if (channelRes.data && channelRes.data.length > 0) {
        const channel = channelRes.data[0]
        final_channel_id = channel._id
        final_channel_name = channel.channel_name
        final_sales_id = channel.sales_id
        final_sales_name = channel.sales_name
      }
    } else if (invite_code) {
      const channelRes = await db
        .collection('sales_channel')
        .where({ invite_code: invite_code })
        .get()
      if (channelRes.data && channelRes.data.length > 0) {
        const channel = channelRes.data[0]
        final_channel_id = channel._id
        final_channel_name = channel.channel_name
        final_sales_id = channel.sales_id
        final_sales_name = channel.sales_name
      }
    } else if (sales_id) {
      const staffRes = await db.collection('sales_staff').doc(sales_id).get()
      if (staffRes.data && staffRes.data.length > 0) {
        const st = staffRes.data[0]
        final_sales_id = st._id
        final_sales_name = st.sales_name || ''
      }
    }

    let query = {}
    if (user_id) query.user_id = user_id
    else if (mobile) query.mobile = mobile

    const customerRes = await db.collection('customer_profile').where(query).get()

    if (customerRes.data && customerRes.data.length > 0) {
      const customer = customerRes.data[0]
      if (!customer.first_sales_id) {
        const updateData = {}
        if (final_channel_id) {
          updateData.source_channel_id = final_channel_id
          updateData.source_channel_name = final_channel_name
        }
        if (final_sales_id) {
          updateData.first_sales_id = final_sales_id
          updateData.first_sales_name = final_sales_name
          updateData.current_sales_id = final_sales_id
          updateData.current_sales_name = final_sales_name
        }
        if (mobile && !customer.mobile) {
          updateData.mobile = mobile
        }
        if (Object.keys(updateData).length > 0) {
          updateData.updated_at = Date.now()
          await db.collection('customer_profile').doc(customer._id).update(updateData)
        }
      }
    } else {
      const newData = {
        user_id: user_id || '',
        mobile: mobile || '',
        customer_type: 0,
        member_status: 0,
        source_channel_id: final_channel_id || '',
        source_channel_name: final_channel_name || '',
        first_sales_id: final_sales_id || '',
        first_sales_name: final_sales_name || '',
        current_sales_id: final_sales_id || '',
        current_sales_name: final_sales_name || '',
        created_at: Date.now(),
        updated_at: Date.now()
      }
      await db.collection('customer_profile').add(newData)
    }

    return { code: OK, message: '记录成功' }
  },

  async processMemberOrder(orderParams) {
    const {
      order_no,
      user_id,
      mobile,
      pay_amount,
      original_amount,
      discount_amount,
      member_days,
      pay_channel,
      source_type,
      pay_time,
      channel_id,
      invite_code,
      transaction_id
    } = orderParams

    if (!user_id && !mobile) {
      return { code: 400, message: '缺失用户信息' }
    }

    let final_channel_id = ''
    let final_channel_name = ''
    let final_sales_id = ''
    let final_sales_name = ''
    let final_invite_code = ''

    if (channel_id) {
      const chRes = await db.collection('sales_channel').doc(channel_id).get()
      if (chRes.data && chRes.data.length > 0) {
        const channel = chRes.data[0]
        final_channel_id = channel._id
        final_channel_name = channel.channel_name
        final_sales_id = channel.sales_id
        final_sales_name = channel.sales_name
        final_invite_code = channel.invite_code
      }
    } else if (invite_code) {
      const chRes = await db
        .collection('sales_channel')
        .where({ invite_code: invite_code })
        .get()
      if (chRes.data && chRes.data.length > 0) {
        const channel = chRes.data[0]
        final_channel_id = channel._id
        final_channel_name = channel.channel_name
        final_sales_id = channel.sales_id
        final_sales_name = channel.sales_name
        final_invite_code = channel.invite_code
      }
    }

    let query = {}
    if (user_id) query.user_id = user_id
    if (mobile) query.mobile = mobile

    let customerRes = await db.collection('customer_profile').where(query).limit(1).get()
    let customer =
      customerRes.data && customerRes.data.length > 0 ? customerRes.data[0] : null

    if (!customer) {
      const insertRes = await db.collection('customer_profile').add({
        user_id: user_id || '',
        mobile: mobile || '',
        customer_type: 0,
        member_status: 0,
        created_at: Date.now(),
        updated_at: Date.now()
      })
      customer = { _id: insertRes.id, user_id, mobile }
    }

    const historyOrders = await db
      .collection('member_order')
      .where(
        dbCmd.and([
          dbCmd.or([
            { user_id: user_id || '------' },
            { mobile: mobile || '------' }
          ]),
          { order_status: 1 }
        ])
      )
      .limit(1)
      .get()

    const isFirstOpen = historyOrders.data.length === 0
    const order_type = isFirstOpen ? 1 : 2
    const commission_type = isFirstOpen ? 'first_open' : 'renewal'

    let first_sales_id = customer.first_sales_id || ''
    let first_sales_name = customer.first_sales_name || ''
    let source_channel_id = customer.source_channel_id || ''
    let source_channel_name = customer.source_channel_name || ''
    let current_sales_id = customer.current_sales_id || ''
    let current_sales_name = customer.current_sales_name || ''

    if (isFirstOpen) {
      first_sales_id = final_sales_id || ''
      first_sales_name = final_sales_name || ''
      source_channel_id = final_channel_id || ''
      source_channel_name = final_channel_name || ''
      current_sales_id = final_sales_id || ''
      current_sales_name = final_sales_name || ''
    } else {
      current_sales_id = final_sales_id || current_sales_id || ''
      current_sales_name = final_sales_name || current_sales_name || ''
    }

    let commission_rate = 0
    let commission_amount = 0
    const this_order_sales_id = current_sales_id || final_sales_id

    if (this_order_sales_id) {
      const staffRes = await db.collection('sales_staff').doc(this_order_sales_id).get()
      if (staffRes.data && staffRes.data.length > 0) {
        const staff = staffRes.data[0]
        commission_rate = isFirstOpen
          ? staff.base_commission_rate_first || 0
          : staff.base_commission_rate_renew || 0
        if (pay_amount > 0) {
          commission_amount = parseFloat((pay_amount * commission_rate).toFixed(2))
        }
      }
    }

    const resolvedOrderNo = order_no || 'VIP' + Date.now()
    const orderData = {
      order_no: resolvedOrderNo,
      user_id,
      customer_id: customer._id,
      mobile,
      order_type,
      order_status: 1,
      pay_status: 1,
      pay_amount,
      original_amount: original_amount || pay_amount,
      discount_amount: discount_amount || 0,
      member_days: member_days || 365,
      pay_time: pay_time || Date.now(),
      pay_callback_time: pay_time || Date.now(),
      out_trade_no: resolvedOrderNo,
      pay_order_no: resolvedOrderNo,
      transaction_id: transaction_id || `LEGACY_OBJ_${resolvedOrderNo}`,
      sales_id: this_order_sales_id,
      sales_name: isFirstOpen ? first_sales_name : current_sales_name,
      first_sales_id,
      first_sales_name,
      channel_id: isFirstOpen
        ? source_channel_id
        : final_channel_id || source_channel_id,
      channel_name: isFirstOpen
        ? source_channel_name
        : final_channel_name || source_channel_name,
      invite_code: final_invite_code || customer.invite_code || '',
      commission_type,
      commission_rate,
      commission_amount: commission_amount || 0,
      commission_status: 0,
      pay_channel: pay_channel || 'wechat',
      source_type: source_type || 'mini_program',
      created_at: Date.now(),
      updated_at: Date.now()
    }

    const orderInsertRes = await db.collection('member_order').add(orderData)

    const updateCustomer = {
      member_status: 1,
      updated_at: Date.now()
    }
    if (isFirstOpen) {
      updateCustomer.first_sales_id = first_sales_id
      updateCustomer.first_sales_name = first_sales_name
      updateCustomer.source_channel_id = source_channel_id
      updateCustomer.source_channel_name = source_channel_name
      updateCustomer.current_sales_id = current_sales_id
      updateCustomer.current_sales_name = current_sales_name
      if (!customer.first_bind_time) updateCustomer.first_bind_time = Date.now()
      updateCustomer.member_first_open_time = Date.now()
    } else {
      updateCustomer.current_sales_id = current_sales_id
      updateCustomer.current_sales_name = current_sales_name
      updateCustomer.member_last_renew_time = Date.now()
    }

    await db.collection('customer_profile').doc(customer._id).update(updateCustomer)

    return {
      code: OK,
      message: '处理成功',
      data: { order_id: orderInsertRes.id, isFirstOpen, commission_amount }
    }
  }
}
