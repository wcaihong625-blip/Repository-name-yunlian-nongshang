'use strict';

const { verifyToken, createResponse } = require('nxt-auth');

function resPlain(code, message, data = null) {
  return { code, message, data: data || null };
}

function pickCountTotal(countRes) {
  if (!countRes || typeof countRes !== 'object') return 0;
  const totalRaw =
    countRes.total != null
      ? countRes.total
      : countRes.result && countRes.result.total != null
        ? countRes.result.total
        : 0;
  const n = Number(totalRaw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

module.exports = {
  _before() {},

  async follow(event = {}, context) {
    const db = uniCloud.database();
    const followsCollection = db.collection('user_follows');
    const usersCollection = db.collection('uni-id-users');

    const res = createResponse;

    try {
      const authResult = await verifyToken(event, context);
      if (!authResult.success) {
        return res(401, authResult.error);
      }

      const followerId = authResult.userId;
      const following_id = event.following_id || event.followed_id;

      if (!following_id) {
        return res(400, '参数错误：following_id不能为空');
      }

      if (followerId === following_id) {
        return res(400, '不能关注自己');
      }

      const userCheck = await usersCollection.doc(following_id).get();
      const userData = Array.isArray(userCheck.data) ? userCheck.data[0] : userCheck.data;
      if (!userData) {
        return res(404, '被关注用户不存在');
      }

      const existingFollow = await followsCollection
        .where({
          follower_id: followerId,
          following_id: following_id
        })
        .count();

      if (existingFollow.total > 0) {
        return res(200, '已是关注状态', {
          follower_id: followerId,
          following_id: following_id,
          already_following: true
        });
      }

      const now = new Date();
      try {
        await followsCollection.add({
          follower_id: followerId,
          following_id: following_id,
          created_date: now
        });
      } catch (addErr) {
        const addMsg = String((addErr && (addErr.errMsg || addErr.message)) || '');
        if (addMsg.includes('duplicate key') || addMsg.includes('E11000')) {
          return res(200, '已是关注状态', {
            follower_id: followerId,
            following_id: following_id,
            already_following: true
          });
        }
        throw addErr;
      }

      return res(200, '关注成功', {
        follower_id: followerId,
        following_id: following_id,
        created_date: now
      });
    } catch (err) {
      console.error('socialCo.follow', err);
      return res(500, '服务器内部错误', { error: err.message });
    }
  },

  async unfollow(event = {}, context) {
    const db = uniCloud.database();
    const followsCollection = db.collection('user_follows');

    const res = createResponse;

    try {
      const authResult = await verifyToken(event, context);
      if (!authResult.success) {
        return res(401, authResult.error);
      }

      const followerId = authResult.userId;
      const following_id = event.following_id || event.followed_id;

      if (!following_id) {
        return res(400, '参数错误：following_id不能为空');
      }

      const followRelation = await followsCollection
        .where({
          follower_id: followerId,
          following_id: following_id
        })
        .get();

      if (!followRelation.data || followRelation.data.length === 0) {
        return res(200, '已是未关注状态');
      }

      await followsCollection
        .where({
          follower_id: followerId,
          following_id: following_id
        })
        .remove();

      return res(200, '取消关注成功');
    } catch (err) {
      console.error('socialCo.unfollow', err);
      return res(500, '服务器内部错误', { error: err.message });
    }
  },

  async follows(event = {}, context) {
    const db = uniCloud.database();
    const followsCollection = db.collection('user_follows');
    const usersCollection = db.collection('uni-id-users');

    const res = createResponse;

    try {
      const authResult = await verifyToken(event, context);
      if (!authResult.success) {
        return res(401, authResult.error);
      }

      const userId = authResult.userId;
      const page = event.page || 1;
      const pageSize = event.pageSize || 10;

      const followsRes = await followsCollection
        .where({
          follower_id: userId
        })
        .orderBy('created_date', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      const totalRes = await followsCollection
        .where({
          follower_id: userId
        })
        .count();

      const total = totalRes.total;
      const followingIds = followsRes.data.map((item) => item.following_id);

      let usersData = [];
      if (followingIds.length > 0) {
        const usersRes = await usersCollection
          .where({
            _id: db.command.in(followingIds)
          })
          .get();

        const userMap = {};
        usersRes.data.forEach((user) => {
          userMap[user._id] = {
            id: user._id,
            username: user.username || '',
            nickname: user.nickname || user.username || '用户',
            avatar: user.avatar || '',
            location: user.location || '',
            industry: user.industry || '',
            bio: user.bio || '',
            isRealNameVerified: user.isRealNameVerified || false,
            isEnterpriseVerified: user.isEnterpriseVerified || false,
            companyName: user.companyName || ''
          };
        });

        usersData = followingIds.map((id) => userMap[id]).filter(Boolean);

        usersData.forEach((user, index) => {
          const followRecord = followsRes.data[index];
          if (followRecord) {
            user.followed_date = followRecord.created_date;
          }
        });
      }

      return res(200, '获取成功', {
        data: usersData,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: page * pageSize < total
      });
    } catch (err) {
      console.error('socialCo.follows', err);
      return res(500, '服务器内部错误', { error: err.message });
    }
  },

  async followers(event = {}, context) {
    const db = uniCloud.database();
    const followsCollection = db.collection('user_follows');
    const usersCollection = db.collection('uni-id-users');

    const res = createResponse;

    try {
      const authResult = await verifyToken(event, context);
      if (!authResult.success) {
        return res(401, authResult.error);
      }

      const userId = authResult.userId;
      const page = event.page || 1;
      const pageSize = event.pageSize || 10;

      const followersRes = await followsCollection
        .where({
          following_id: userId
        })
        .orderBy('created_date', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get();

      const totalRes = await followsCollection
        .where({
          following_id: userId
        })
        .count();

      const total = totalRes.total;
      const followerIds = followersRes.data.map((item) => item.follower_id);

      let usersData = [];
      if (followerIds.length > 0) {
        const usersRes = await usersCollection
          .where({
            _id: db.command.in(followerIds)
          })
          .get();

        const myFollowsRes = await followsCollection
          .where({
            follower_id: userId,
            following_id: db.command.in(followerIds)
          })
          .get();

        const myFollowingSet = new Set(myFollowsRes.data.map((item) => item.following_id));

        const userMap = {};
        usersRes.data.forEach((user) => {
          userMap[user._id] = {
            id: user._id,
            username: user.username || '',
            nickname: user.nickname || user.username || '用户',
            avatar: user.avatar || '',
            location: user.location || '',
            industry: user.industry || '',
            bio: user.bio || '',
            isRealNameVerified: user.isRealNameVerified || false,
            isEnterpriseVerified: user.isEnterpriseVerified || false,
            companyName: user.companyName || '',
            isFollowing: myFollowingSet.has(user._id)
          };
        });

        usersData = followerIds.map((id) => userMap[id]).filter(Boolean);

        usersData.forEach((user, index) => {
          const followRecord = followersRes.data[index];
          if (followRecord) {
            user.followed_date = followRecord.created_date;
          }
        });
      }

      return res(200, '获取成功', {
        data: usersData,
        total: total,
        page: page,
        pageSize: pageSize,
        hasMore: page * pageSize < total
      });
    } catch (err) {
      console.error('socialCo.followers', err);
      return res(500, '服务器内部错误', { error: err.message });
    }
  },

  async stats(event = {}, context) {
    const db = uniCloud.database();
    const followsCollection = db.collection('user_follows');

    const res = resPlain;

    try {
      const tokenResult = await verifyToken(event, context);
      if (!tokenResult.success) {
        return res(401, tokenResult.error || '登录状态无效');
      }
      const userId = tokenResult.userId;

      const ids = [event.user_id, event.uid, event._id].filter((v) => v != null && String(v).trim() !== '');
      for (const id of ids) {
        if (String(id) !== String(userId)) {
          return res(403, '无权查询其他用户的关注统计');
        }
      }

      let following = 0;
      let followers = 0;
      try {
        const followingRes = await followsCollection.where({ follower_id: userId }).count();
        following = pickCountTotal(followingRes);
      } catch (e) {
        console.error('socialCo.stats following count error', e);
      }
      try {
        const followersRes = await followsCollection.where({ following_id: userId }).count();
        followers = pickCountTotal(followersRes);
      } catch (e) {
        console.error('socialCo.stats followers count error', e);
      }

      return res(200, '获取成功', {
        following: following,
        followers: followers
      });
    } catch (err) {
      console.error('socialCo.stats', err);
      return res(500, '服务器内部错误', { error: err.message });
    }
  },

  async recordView(event = {}, context) {
    const db = uniCloud.database();
    const usersCollection = db.collection('uni-id-users');

    const res = createResponse;

    try {
      const authResult = await verifyToken(event, context);
      if (!authResult.success) {
        return res(401, authResult.error);
      }

      const viewerId = authResult.userId;
      const { viewed_user_id } = event;

      if (!viewed_user_id) {
        return res(400, '参数错误：viewed_user_id不能为空');
      }

      const userCheck = await usersCollection.doc(viewed_user_id).get();
      if (!userCheck.data || userCheck.data.length === 0) {
        return res(404, '被浏览用户不存在');
      }

      await usersCollection.doc(viewed_user_id).update({
        profile_views: db.command.inc(1)
      });

      return res(200, '记录成功', null);
    } catch (err) {
      console.error('socialCo.recordView', err);
      return res(500, '服务器内部错误', { error: err.message });
    }
  }
};
