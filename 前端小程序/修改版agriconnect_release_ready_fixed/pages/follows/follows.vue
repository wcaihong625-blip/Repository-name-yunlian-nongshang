<template>
    <!-- pages/follows/follows.wxml -->
    <view class="follows-page">
        <!-- 我的关注列表 -->
        <scroll-view
            v-if="activeTab === 'following'"
            class="content-section"
            :scroll-y="true"
            :refresher-enabled="true"
            :refresher-triggered="followingRefreshing"
            @refresherrefresh="onPullDownRefresh"
            @scrolltolower="onReachBottom"
            lower-threshold="50"
        >
            <!-- 空状态 -->
            <view v-if="followingList.length === 0 && !followingLoading" class="empty-state">
                <text class="empty-icon">👥</text>
                <text class="empty-text">您还没有关注任何用户</text>
                <text class="empty-hint">快去发现感兴趣的用户吧！</text>
            </view>

            <!-- 用户列表 -->
            <view v-else class="user-list">
                <view class="user-card" v-for="(item, index) in followingList" :key="index">
                    <!-- 左侧：头像区 -->

                    <view class="avatar-section" :data-user-id="item.id" @tap="goToUserProfile">
                        <image class="user-avatar" :src="item.avatar || '/static/images/logo.png'" mode="aspectFill"></image>
                    </view>

                    <!-- 中部：核心信息区 -->

                    <view class="info-section" :data-user-id="item.id" @tap="goToUserProfile">
                        <!-- 第一行：昵称 + 认证标识 -->
                        <view class="info-row name-row">
                            <text class="user-name">{{ item.username }}</text>
                            <text v-if="item.isRealNameVerified" class="verify-badge real-name">✓ 实名</text>
                            <text v-if="item.isEnterpriseVerified" class="verify-badge enterprise">✓ 企业</text>
                        </view>

                        <!-- 第二行：主营行业/标签 -->
                        <view v-if="item.industry" class="info-row industry-row">
                            <text class="industry-text">{{ item.industry }}</text>
                        </view>

                        <!-- 第三行：个性签名/简介 -->
                        <view v-if="item.bio" class="info-row bio-row">
                            <text class="bio-text">{{ item.bio }}</text>
                        </view>
                    </view>

                    <!-- 右侧：操作与状态区 -->

                    <view class="action-section">
                        <button class="follow-btn following" :data-user-id="item.id" @tap.stop.prevent="unfollowUser">已关注</button>
                    </view>
                </view>

                <!-- 加载更多提示 -->
                <view v-if="followingLoading" class="loading-more">
                    <text>加载中...</text>
                </view>
                <view v-else-if="!followingHasMore && followingList.length > 0" class="no-more">
                    <text>没有更多了</text>
                </view>
            </view>
        </scroll-view>

        <!-- 关注我的列表 -->
        <scroll-view
            v-if="activeTab === 'followers'"
            class="content-section"
            :scroll-y="true"
            :refresher-enabled="true"
            :refresher-triggered="followersRefreshing"
            @refresherrefresh="onPullDownRefresh"
            @scrolltolower="onReachBottom"
            lower-threshold="50"
        >
            <!-- 空状态 -->
            <view v-if="followersList.length === 0 && !followersLoading" class="empty-state">
                <text class="empty-icon">👥</text>
                <text class="empty-text">还没有人关注您</text>
                <text class="empty-hint">快去发布更多优质内容吧！</text>
            </view>

            <!-- 用户列表 -->
            <view v-else class="user-list">
                <view class="user-card" v-for="(item, index) in followersList" :key="index">
                    <!-- 左侧：头像区 -->

                    <view class="avatar-section" :data-user-id="item.id" @tap="goToUserProfile">
                        <image class="user-avatar" :src="item.avatar || '/static/images/logo.png'" mode="aspectFill"></image>
                    </view>

                    <!-- 中部：核心信息区 -->

                    <view class="info-section" :data-user-id="item.id" @tap="goToUserProfile">
                        <!-- 第一行：昵称 + 认证标识 -->
                        <view class="info-row name-row">
                            <text class="user-name">{{ item.username }}</text>
                            <text v-if="item.isRealNameVerified" class="verify-badge real-name">✓ 实名</text>
                            <text v-if="item.isEnterpriseVerified" class="verify-badge enterprise">✓ 企业</text>
                        </view>

                        <!-- 第二行：主营行业/标签 -->
                        <view v-if="item.industry" class="info-row industry-row">
                            <text class="industry-text">{{ item.industry }}</text>
                        </view>

                        <!-- 第三行：个性签名/简介 -->
                        <view v-if="item.bio" class="info-row bio-row">
                            <text class="bio-text">{{ item.bio }}</text>
                        </view>
                    </view>

                    <!-- 右侧：操作与状态区 -->

                    <view class="action-section">
                        <button v-if="item.isFollowing" class="follow-btn mutual" :data-user-id="item.id" @tap.stop.prevent="unfollowFollower">相互关注</button>
                        <button v-else class="follow-btn follow" :data-user-id="item.id" @tap.stop.prevent="followUser">关注</button>
                    </view>
                </view>

                <!-- 加载更多提示 -->
                <view v-if="followersLoading" class="loading-more">
                    <text>加载中...</text>
                </view>
                <view v-else-if="!followersHasMore && followersList.length > 0" class="no-more">
                    <text>没有更多了</text>
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script>
// pages/follows/follows.js - 关注管理页面
import { getMyFollows, getMyFollowers } from '../../utils/api.js';
import { isFollowing, syncFollowStateFromServer, toggleFollowUser } from '../../utils/followState.js';
export default {
    data() {
        return {
            activeTab: 'following',
            // 'following' | 'followers'

            // 我的关注
            followingList: [],
            followingPage: 1,
            followingPageSize: 10,
            followingHasMore: true,
            followingLoading: false,
            followingRefreshing: false,
            followingCount: 0,
            // 关注我的
            followersList: [],
            followersPage: 1,
            followersPageSize: 10,
            followersHasMore: true,
            followersLoading: false,
            followersRefreshing: false,
            followersCount: 0
        };
    },
    onLoad(options) {
        // 支持通过参数指定初始tab
        const tab = options.tab || 'following';
        this.setData({
            activeTab: tab
        });
        this.loadTabData(tab);
    },
    onShow() {
        // 页面显示时刷新当前tab数据
        this.loadTabData(this.activeTab, true);
    },
    // 下拉刷新
    onPullDownRefresh() {
        if (this.activeTab === 'following') {
            this.setData({
                followingPage: 1,
                followingHasMore: true,
                followingList: []
            });
            this.loadFollowingList(true);
        } else {
            this.setData({
                followersPage: 1,
                followersHasMore: true,
                followersList: []
            });
            this.loadFollowersList(true);
        }
        setTimeout(() => {
            uni.stopPullDownRefresh();
        }, 1000);
    },
    // 上拉加载更多
    onReachBottom() {
        if (this.activeTab === 'following') {
            if (this.followingHasMore && !this.followingLoading) {
                this.loadFollowingList();
            }
        } else {
            if (this.followersHasMore && !this.followersLoading) {
                this.loadFollowersList();
            }
        }
    },
    methods: {
        // 切换Tab
        switchTab(e) {
            const tab = e.currentTarget.dataset.tab;
            if (tab === this.activeTab) {
                return;
            }
            this.setData({
                activeTab: tab
            });
            this.loadTabData(tab);
        },

        // 加载Tab数据
        loadTabData(tab, refresh = false) {
            if (tab === 'following') {
                this.loadFollowingList(refresh);
            } else if (tab === 'followers') {
                this.loadFollowersList(refresh);
            }
        },

        // 加载我的关注列表
        loadFollowingList(refresh = false) {
            if (this.followingLoading) {
                return;
            }
            const page = refresh ? 1 : this.followingPage;
            this.setData({
                followingLoading: true,
                followingRefreshing: refresh
            });

            // 调用API获取我的关注列表
            getMyFollows({ page, pageSize: this.followingPageSize })
                .then(res => {
                    const mapped = (res.data || []).map((u) => ({
                        ...u,
                        isFollowing: true
                    }));
                    const newList = refresh ? res.data : [...this.followingList, ...res.data];
                    this.setData({
                        followingList: refresh ? mapped : [...this.followingList, ...mapped],
                        followingPage: page + 1,
                        followingHasMore: res.hasMore,
                        followingCount: res.total || (refresh ? mapped.length : [...this.followingList, ...mapped].length),
                        followingLoading: false,
                        followingRefreshing: false
                    });
                })
                .catch(err => {
                    console.error('加载失败', err);
                    this.setData({
                        followingLoading: false,
                        followingRefreshing: false
                    });
                    uni.showToast({
                        title: '加载失败',
                        icon: 'none'
                    });
                });
        },

        // 加载关注我的列表
        loadFollowersList(refresh = false) {
            if (this.followersLoading) {
                return;
            }
            const page = refresh ? 1 : this.followersPage;
            this.setData({
                followersLoading: true,
                followersRefreshing: refresh
            });

            // 调用API获取关注我的列表
            getMyFollowers({ page, pageSize: this.followersPageSize })
                .then(res => {
                    const incoming = (res.data || []).map((u) => ({
                        ...u,
                        isFollowing: isFollowing(u.id)
                    }));
                    const newList = refresh ? incoming : [...this.followersList, ...incoming];
                    
                    this.setData({
                        followersList: newList,
                        followersPage: page + 1,
                        followersHasMore: res.hasMore,
                        followersCount: res.total || newList.length,
                        followersLoading: false,
                        followersRefreshing: false
                    });
                })
                .catch(err => {
                    console.error('加载失败', err);
                    this.setData({
                        followersLoading: false,
                        followersRefreshing: false
                    });
                    uni.showToast({
                        title: '加载失败',
                        icon: 'none'
                    });
                });
        },


        // 跳转到用户主页
        goToUserProfile(e) {
            const userId = e.currentTarget.dataset.userId;
            if (!userId) {
                return;
            }
            uni.navigateTo({
                url: `/pages/user-profile/user-profile?userId=${userId}`
            });
        },

        // 取消关注（我的关注页面）
        unfollowUser(e) {
            const userId = e.currentTarget.dataset.userId;
            const user = this.followingList.find((u) => u.id === userId);
            if (!user) {
                return;
            }
            uni.showModal({
                title: '确认取消关注',
                content: `确定要取消关注"${user.username}"吗？`,
                confirmColor: '#ef4444',
                success: (res) => {
                    if (res.confirm) {
                        toggleFollowUser(userId)
                            .then(async () => {
                                this.removeFromFollowingList(userId);
                                await syncFollowStateFromServer(true);
                                this.loadFollowersList(true);
                                uni.showToast({
                                    title: '已取消关注',
                                    icon: 'success'
                                });
                            })
                            .catch(() => {
                                uni.showToast({
                                    title: '操作失败',
                                    icon: 'none'
                                });
                            });
                    }
                }
            });
        },

        // 从我的关注列表中移除
        removeFromFollowingList(userId) {
            const followingList = this.followingList.filter((u) => u.id !== userId);
            this.setData({
                followingList: followingList,
                followingCount: followingList.length
            });
        },

        // 关注用户（关注我的页面）
        followUser(e) {
            const userId = e.currentTarget.dataset.userId;
            const user = this.followersList.find((u) => u.id === userId);
            if (!user) {
                return;
            }

            toggleFollowUser(userId)
                .then(async (ret) => {
                    this.updateFollowerFollowStatus(userId, ret.isFollowing);
                    await syncFollowStateFromServer(true);
                    uni.showToast({
                        title: ret.isFollowing ? '关注成功' : '已取消关注',
                        icon: 'success'
                    });
                })
                .catch(() => {
                    uni.showToast({
                        title: '操作失败',
                        icon: 'none'
                    });
                });
        },

        // 取消关注（关注我的页面，如果已回关）
        unfollowFollower(e) {
            const userId = e.currentTarget.dataset.userId;
            const user = this.followersList.find((u) => u.id === userId);
            if (!user) {
                return;
            }
            uni.showModal({
                title: '确认取消关注',
                content: `确定要取消关注"${user.username}"吗？`,
                confirmColor: '#ef4444',
                success: (res) => {
                    if (res.confirm) {
                        toggleFollowUser(userId)
                            .then(async (ret) => {
                                this.updateFollowerFollowStatus(userId, ret.isFollowing);
                                await syncFollowStateFromServer(true);
                                uni.showToast({
                                    title: ret.isFollowing ? '关注成功' : '已取消关注',
                                    icon: 'success'
                                });
                            })
                            .catch(() => {
                                uni.showToast({
                                    title: '操作失败',
                                    icon: 'none'
                                });
                            });
                    }
                }
            });
        },

        // 更新关注我的列表中用户的关注状态
        updateFollowerFollowStatus(userId, isFollowing) {
            const followersList = this.followersList.map((u) => {
                if (u.id === userId) {
                    return {
                        ...u,
                        isFollowing: isFollowing
                    };
                }
                return u;
            });
            this.setData({
                followersList
            });
        },

        
    }
};
</script>
<style>
@import './follows.css';
</style>
