<template>
	<scroll-view class="sidebar" scroll-y="true">
		<uni-data-menu ref="menu" :value="currentMenu" :staticMenu="staticMenu" collection="opendb-admin-menus"
			:page-size="500" :field="field" where="enable==true" orderby="sort asc" active-text-color="#409eff" @select="select">
		</uni-data-menu>
	</scroll-view>
</template>

<script>
	import {
		mapState,
		mapActions
	} from 'vuex'
	import config from '@/admin.config.js'
	export default {
		data() {
			return {
				...config.sideBar,
				field: 'url as value, name as text, menu_id, parent_id, sort, icon, permission',
				currentMenu: '/'
			}
		},
		computed: {
			...mapState('app', ['inited', 'navMenu', 'active']),
			userInfo () {
				return this.$uniIdPagesStore.store.userInfo
			}
		},

		watch: {
			// #ifdef H5
			$route: {
				immediate: true,
				handler(newRoute, oldRoute) {
					const path = newRoute.fullPath
					if (path) {
						this.currentMenu = this.splitFullPath(path)
					}
				}
			},
			// #endif
			userInfo: {
				// immediate: true,
				handler(newVal, oldVal) {
					if (newVal) {
						// 当用户信息发生变化后，重新加载左侧menu
						this.$nextTick(function() {
							this.$refs.menu.load()
						})
					}
				}
			}
		},
		methods: {
			...mapActions({
				setRoutes: 'app/setRoutes'
			}),
			select(e, routes) {
				let url = e.value
				if (!url) {
					url = this.active
				}
				this.clickMenuItem(url)
				this.setRoutes(routes)
				// #ifdef H5
				// #ifdef VUE3
				uni.hideLeftWindow()
				// #endif
				// #endif
			},
			clickMenuItem(url) {
				// #ifdef H5
				if (url.indexOf('http') === 0) {
					return window.open(url)
				}
				// #endif

				// url 开头可用有 / ，也可没有
				if (url[0] !== '/' && url.indexOf('http') !== 0) {
					url = '/' + url
				}
				// #ifndef H5
				if (url === "/") {
					url = config.index.url;
				}
				// #endif
				// TODO 后续要调整
				uni.redirectTo({
					url: url,
					fail: () => {
						uni.showModal({
							title: '提示',
							content: '页面 ' + url + ' 跳转失败',
							showCancel: false
						})
					}
				})
			},
			splitFullPath(path) {
				if (!path) {
					path = '/'
				}
				return path.split('?')[0]
			},
		}
	}
</script>

<style lang="scss">
	@import '@/common/admin-refactor.scss';

	.sidebar {
		position: fixed;
		// top: var(--top-window-height); // useless
		width: $admin-sidebar-expand-width;
		height: calc(100vh - (var(--top-window-height)));
		box-sizing: border-box;
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		background: $admin-sidebar-bg;
		padding: 12px 10px 12px;
		scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
	}
	/* #ifdef H5 */
	.sidebar ::-webkit-scrollbar {
		width: 4px;
		height: 4px;
	}
	.sidebar ::-webkit-scrollbar-thumb {
		background: rgba(148, 163, 184, 0.34);
		border-radius: 3px;
	}
	/* #endif */

	.sidebar :deep(.uni-data-menu) {
		background: transparent;
	}

	.sidebar :deep(.menu-item),
	.sidebar :deep(.menu-item-content),
	.sidebar :deep(.uni-data-menu-item) {
		height: 42px;
		line-height: 42px;
		border-radius: 8px;
		color: $admin-sidebar-text;
		font-size: 14px;
		transition: background-color 0.2s ease, color 0.2s ease;
	}

	.sidebar :deep(.menu-item:hover),
	.sidebar :deep(.menu-item-content:hover),
	.sidebar :deep(.uni-data-menu-item:hover) {
		background: $admin-sidebar-hover-bg;
		color: $admin-sidebar-text-active;
	}

	.sidebar :deep(.menu-item.active),
	.sidebar :deep(.menu-item-content.active),
	.sidebar :deep(.uni-data-menu-item.active) {
		background: $admin-sidebar-active-bg;
		color: $admin-sidebar-text-active;
		position: relative;
	}

	.sidebar :deep(.menu-item.active::before),
	.sidebar :deep(.menu-item-content.active::before),
	.sidebar :deep(.uni-data-menu-item.active::before) {
		content: '';
		position: absolute;
		left: 0;
		top: 10px;
		width: 3px;
		height: 22px;
		border-radius: 999px;
		background: #60a5fa;
	}

	.sidebar :deep(.menu-text),
	.sidebar :deep(.uni-data-menu-item__text) {
		color: inherit;
	}

	.sidebar :deep(.uni-sub-menu__content),
	.sidebar :deep(.uni-sub-menu),
	.sidebar :deep(.item-bg) {
		background: transparent !important;
	}

	.sidebar :deep(.uni-sub-menu__title),
	.sidebar :deep(.uni-sub-menu__icon) {
		color: $admin-sidebar-text;
	}

	.sidebar :deep(.menu-group-title) {
		color: rgba(255, 255, 255, 0.52);
		font-size: 12px;
		padding: 8px 10px 4px;
	}
</style>
