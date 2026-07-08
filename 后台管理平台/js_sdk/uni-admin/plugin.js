import {
    initUtil
} from './util.js'
import {
    initError
} from './error.js'
import {
    initRequest
} from './request.js'
import {
    initFetch
} from './fetchMock.js'
import {
    initPermission
} from './permission.js'
import {
    initInterceptor
} from './interceptor.js'

import {
	initUniIdPageStore
} from "../uni-id-pages/store"
import {
	bindUniCloudClientDbRefreshToken
} from './unicloudAuth.js'

export default {
    install(Vue) {
		// 尽早绑定 clientDB token 刷新写入 storage，避免 JQL 长期以匿名/过期上下文请求
		bindUniCloudClientDbRefreshToken()
        initUtil(Vue)
        initError(Vue)
		initUniIdPageStore(Vue)
		initRequest(Vue)
		initFetch(Vue)
        initPermission(Vue)
        initInterceptor()
    }
}
