/**
 * 后台 H5：保证 uni-id token 与 clientDB 刷新写入 storage，
 * 并在首屏等待 uniCloud 能解析出当前用户（避免 JQL 以匿名身份请求）。
 */

let refreshTokenBound = false

function persistUniIdToken({ token, tokenExpired }) {
	if (token) {
		uni.setStorageSync('uni_id_token', token)
	}
	if (tokenExpired) {
		uni.setStorageSync('uni_id_token_expired', tokenExpired)
	}
}

/**
 * 绑定 clientDB 的 refreshToken（官方文档示例基于 databaseForJQL）。
 * 同时对 database() 也绑定，避免项目内混用两种入口时漏刷新。
 */
export function bindUniCloudClientDbRefreshToken() {
	if (refreshTokenBound) {
		return
	}
	refreshTokenBound = true
	try {
		const db = uniCloud.database()
		db.on('refreshToken', persistUniIdToken)
	} catch (e) {
		console.warn('[unicloudAuth] database() refreshToken 绑定失败', e)
	}
	try {
		const dbJql = uniCloud.databaseForJQL()
		dbJql.on('refreshToken', persistUniIdToken)
	} catch (e) {
		console.warn('[unicloudAuth] databaseForJQL() refreshToken 绑定失败', e)
	}
}

export function hasValidUniIdStorage() {
	const token = uni.getStorageSync('uni_id_token')
	const expired = Number(uni.getStorageSync('uni_id_token_expired') || 0)
	return !!(token && expired > Date.now())
}

/**
 * 是否与「可发起带 uni-id 的 clientDB 请求」一致。
 * 以 storage 为准：部分 H5 上 getCurrentUserInfo() 的 uid/tokenExpired 解析不完整，
 * 但 JQL 仍会携带 uni_id_token，故不再把 getCurrentUserInfo().tokenExpired 当作必要条件。
 */
export function hasUniCloudUserContext() {
	return hasValidUniIdStorage()
}

/**
 * 等待本地 uni_id_token / 过期时间已写入（登录后或冷启动读 storage）。
 */
export function waitForUniCloudUserContext(maxWaitMs = 8000) {
	const step = 50
	let waited = 0
	return new Promise((resolve) => {
		const tick = () => {
			if (hasValidUniIdStorage()) {
				resolve(true)
				return
			}
			waited += step
			if (waited >= maxWaitMs) {
				resolve(false)
				return
			}
			setTimeout(tick, step)
		}
		tick()
	})
}
