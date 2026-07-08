import { followUser, unfollowUser, getMyFollows, getMyFollowers, getFollowStats } from './api.js';

const FOLLOW_STATE_KEY = 'followState';

function toId(value) {
    return value == null ? '' : String(value).trim();
}

function uniqIds(list) {
    const out = [];
    const seen = new Set();
    (list || []).forEach((id) => {
        const v = toId(id);
        if (!v || seen.has(v)) return;
        seen.add(v);
        out.push(v);
    });
    return out;
}

function readRawState() {
    const state = uni.getStorageSync(FOLLOW_STATE_KEY) || {};
    return {
        followingList: uniqIds(state.followingList || uni.getStorageSync('followingList') || []),
        followersList: uniqIds(state.followersList || uni.getStorageSync('followersList') || []),
        followStats: {
            following: Math.max(0, Number(state.followStats?.following) || 0),
            followers: Math.max(0, Number(state.followStats?.followers) || 0)
        },
        updateTime: Number(state.updateTime) || 0
    };
}

function persistState(state) {
    const next = {
        followingList: uniqIds(state.followingList),
        followersList: uniqIds(state.followersList),
        followStats: {
            following: Math.max(0, Number(state.followStats?.following) || 0),
            followers: Math.max(0, Number(state.followStats?.followers) || 0)
        },
        updateTime: Date.now()
    };
    uni.setStorageSync(FOLLOW_STATE_KEY, next);
    uni.setStorageSync('followingList', next.followingList);
    uni.setStorageSync('followersList', next.followersList);
    uni.setStorageSync('followStats', { ...next.followStats, updateTime: next.updateTime });
    return next;
}

function applyListStatsConsistency(state) {
    const followingCount = (state.followingList || []).length;
    const followersCount = (state.followersList || []).length;
    return {
        ...state,
        followStats: {
            following: followingCount,
            followers: followersCount
        }
    };
}

export function getFollowState() {
    const state = readRawState();
    return applyListStatsConsistency(state);
}

export function isFollowing(targetUserId) {
    const targetId = toId(targetUserId);
    if (!targetId) return false;
    const state = getFollowState();
    return state.followingList.includes(targetId);
}

export function notifyFollowStateChanged() {
    const app = getApp();
    if (app && app.globalData) {
        if (typeof app.globalData.updateProfileFollowStats === 'function') {
            app.globalData.updateProfileFollowStats();
        }
        if (typeof app.globalData.refreshFollowsPage === 'function') {
            app.globalData.refreshFollowsPage();
        }
    }
}

export async function syncFollowStateFromServer(force = false) {
    const local = readRawState();
    const age = Date.now() - local.updateTime;
    if (!force && local.updateTime && age < 300000) {
        const consistent = applyListStatsConsistency(local);
        return persistState(consistent);
    }

    const [followsRes, followersRes, statsRes] = await Promise.all([
        getMyFollows({ page: 1, pageSize: 1000 }),
        getMyFollowers({ page: 1, pageSize: 1000 }),
        getFollowStats()
    ]);

    const followingList = uniqIds((followsRes?.data || []).map((x) => x.id));
    const followersList = uniqIds((followersRes?.data || []).map((x) => x.id));
    const apiFollowing = Math.max(0, Number(statsRes?.following) || 0);
    const apiFollowers = Math.max(0, Number(statsRes?.followers) || 0);

    const next = {
        followingList,
        followersList,
        followStats: {
            following: followingList.length === apiFollowing ? apiFollowing : followingList.length,
            followers: followersList.length === apiFollowers ? apiFollowers : followersList.length
        },
        updateTime: Date.now()
    };

    return persistState(next);
}

export async function toggleFollowUser(targetUserId) {
    const targetId = toId(targetUserId);
    if (!targetId) {
        throw new Error('目标用户不存在');
    }

    const state = getFollowState();
    const followed = state.followingList.includes(targetId);
    if (followed) {
        await unfollowUser(targetId);
    } else {
        await followUser(targetId);
    }

    const synced = await syncFollowStateFromServer(true);
    notifyFollowStateChanged();
    return {
        isFollowing: synced.followingList.includes(targetId),
        followStats: synced.followStats,
        state: synced
    };
}
