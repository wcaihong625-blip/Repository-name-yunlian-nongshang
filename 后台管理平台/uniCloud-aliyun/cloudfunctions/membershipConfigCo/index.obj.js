'use strict';

const { requireAdmin } = require('nxt-auth');
const {
  loadMembershipPromotionConfig,
  deepMerge,
  DEFAULT_CONFIG
} = require('nxt-membership-promotion-config');

module.exports = {
  _before() {},

  async getConfig(event = {}, context) {
    const db = uniCloud.database();
    const res = (code, message, data) => ({ code, message, data: data || null });
    try {
      const config = await loadMembershipPromotionConfig(db);
      return res(200, 'ok', config);
    } catch (err) {
      console.error('membershipConfigCo.getConfig', err);
      return res(200, 'ok（默认）', DEFAULT_CONFIG);
    }
  },

  async saveConfig(event = {}, context) {
    const db = uniCloud.database();
    const col = db.collection('platform_settings');
    const res = (code, message, data) => ({ code, message, data: data || null });

    try {
      const adminResult = await requireAdmin(event, context);
      if (!adminResult.success) {
        return res(403, adminResult.error || '需要管理员权限');
      }

      const incoming = event.config || event.membership_promotion_config;
      if (!incoming || typeof incoming !== 'object') {
        return res(400, '参数错误：缺少 config 对象');
      }

      const merged = deepMerge(DEFAULT_CONFIG, incoming);
      const now = Date.now();

      const existing = await col.doc('default').get();
      if (!existing.data || existing.data.length === 0) {
        await col.add({
          _id: 'default',
          membership_promotion_config: merged,
          create_time: now,
          update_time: now
        });
      } else {
        await col.doc('default').update({
          membership_promotion_config: merged,
          update_time: now
        });
      }

      const saved = await loadMembershipPromotionConfig(db);
      return res(200, '保存成功', saved);
    } catch (err) {
      console.error('membershipConfigCo.saveConfig', err);
      return res(500, err.message || '保存失败');
    }
  }
};
