'use strict';
/**
 * 【历史兼容 / 非主链路】下单即视为支付成功并生效会员、生成提成。
 * 标准会员下单请使用云函数 createPendingMemberOrder（待支付）+
 * applyMemberOrderPaidResult / 微信回调落账；请勿在新页面把本函数作为主入口。
 */
const { verifyToken } = require('nxt-auth');

exports.main = async (event, context) => {
    const db = uniCloud.database();
    const cmd = db.command;

    const customerProfileCollection = db.collection('customer_profile');
    const memberOrderCollection = db.collection('member_order');
    const usersCollection = db.collection('uni-id-users');

    const res = (code, message, data) => {
        return { code, message, data: data || null };
    };

    try {
        // 1. 校验登录用户
        const tokenResult = await verifyToken(event, context);
        if (!tokenResult.success) {
            return res(401, tokenResult.error || '登录状态无效');
        }
        const userId = tokenResult.userId;

        // 获取用户完整信息，主要拿 mobile
        const userRes = await usersCollection.doc(userId).get();
        if (!userRes.data || userRes.data.length === 0) {
            return res(404, '用户不存在');
        }
        const userInfo = userRes.data[0];
        const mobile = userInfo.mobile || '';

        // 2. 接收参数
        const channel_id = event.channel_id || '';
        const invite_code = event.invite_code || '';
        const req_sales_id = event.sales_id || '';
        const pay_amount = event.pay_amount || 588;
        const original_amount = event.original_amount || 888;
        const member_days = event.member_days || 365;

        // 3. 归属判定收口（找渠道、找业务员、找邀请码）
        let final_channel_id = '';
        let final_channel_name = '';
        let final_sales_id = '';
        let final_sales_name = '';
        let final_invite_code = '';

        if (channel_id) {
            // 优先根据 channel_id 查询渠道记录
            const channelRes = await db.collection('sales_channel').doc(channel_id).get();
            if (!channelRes.data || channelRes.data.length === 0) {
                return res(400, '无效的渠道ID');
            }
            const channel = channelRes.data[0];
            final_channel_id = channel._id;
            final_channel_name = channel.channel_name;
            final_sales_id = channel.sales_id;
            final_sales_name = channel.sales_name;
            final_invite_code = channel.invite_code;

            // 一致性校验：如果传了 invite_code，必须匹配
            if (invite_code && invite_code !== final_invite_code) {
                return res(400, '渠道ID与邀请码不匹配');
            }
        } else if (invite_code) {
            // 没有 channel_id，根据 invite_code 反查渠道
            const channelRes = await db.collection('sales_channel').where({ invite_code: invite_code }).get();
            if (!channelRes.data || channelRes.data.length === 0) {
                return res(400, '无效的邀请码');
            }
            const channel = channelRes.data[0];
            final_channel_id = channel._id;
            final_channel_name = channel.channel_name;
            final_sales_id = channel.sales_id;
            final_sales_name = channel.sales_name;
            final_invite_code = channel.invite_code;
        }

        // 业务员一致性校验：如果前端传了 sales_id，必须与渠道关联的一致
        if (req_sales_id && final_sales_id && req_sales_id !== final_sales_id) {
            return res(400, '业务员ID与渠道分配不一致');
        }
        // 如果上面都没匹配出来且前端传了 req_sales_id，此时需要确认是否允许这种“直接通过业务员ID”进来的单
        if (!final_sales_id && req_sales_id) {
            const staffRes = await db.collection('sales_staff').doc(req_sales_id).get();
            if (staffRes.data && staffRes.data.length > 0) {
                final_sales_id = staffRes.data[0]._id;
                final_sales_name = staffRes.data[0].sales_name;
            }
        }

        // 4. 判断首开/续费 —— 仅根据历史成功会员订单判断
        let isFirstOpen = true;
        let historyCond = [{ user_id: userId }];
        if (mobile) historyCond.push({ mobile: mobile });

        const historyOrderQuery = await memberOrderCollection.where(
            cmd.and([
                cmd.or(historyCond),
                { order_status: 1 }
            ])
        ).orderBy('pay_time', 'asc').get();

        if (historyOrderQuery.data.length > 0) {
            isFirstOpen = false;
        }

        // 5. 查询或创建已有的 customer_profile
        let profileCond = [{ user_id: userId }];
        if (mobile) profileCond.push({ mobile: mobile });

        let profileQuery = await customerProfileCollection.where(cmd.or(profileCond)).get();
        let currentProfile = profileQuery.data.length > 0 ? profileQuery.data[0] : null;

        const now = new Date();
        let first_sales_id = '';
        let first_sales_name = '';
        let current_sales_id = '';
        let current_sales_name = '';
        let source_channel_id = '';
        let source_channel_name = '';

        if (isFirstOpen) {
            // 首开：全量写入归属
            first_sales_id = final_sales_id;
            first_sales_name = final_sales_name;
            current_sales_id = final_sales_id;
            current_sales_name = final_sales_name;
            source_channel_id = final_channel_id;
            source_channel_name = final_channel_name;

            if (!currentProfile) {
                const newProfile = {
                    user_id: userId,
                    mobile: mobile,
                    nickname: userInfo.nickname || '',
                    avatar: userInfo.avatar || '',
                    source_channel_id,
                    source_channel_name,
                    first_sales_id,
                    first_sales_name,
                    current_sales_id,
                    current_sales_name,
                    first_bind_time: now,
                    member_first_open_time: now,
                    member_last_renew_time: now,
                    member_status: 1,
                    member_expire_time: null,
                    created_at: now,
                    updated_at: now
                };
                const addRes = await customerProfileCollection.add(newProfile);
                currentProfile = { _id: addRes.id, ...newProfile };
            } else {
                // 已有档案但之前没开过会员
                // 首次归属若为空才更新
                const updateData = {
                    user_id: userId,
                    mobile: mobile,
                    nickname: userInfo.nickname || '',
                    avatar: userInfo.avatar || '',
                    current_sales_id,
                    current_sales_name,
                    member_first_open_time: now,
                    member_last_renew_time: now,
                    member_status: 1,
                    updated_at: now
                };
                if (!currentProfile.first_sales_id) {
                    updateData.first_sales_id = first_sales_id;
                    updateData.first_sales_name = first_sales_name;
                }
                if (!currentProfile.source_channel_id) {
                    updateData.source_channel_id = source_channel_id;
                    updateData.source_channel_name = source_channel_name;
                }
                await customerProfileCollection.doc(currentProfile._id).update(updateData);
                currentProfile = { ...currentProfile, ...updateData };
            }
        } else {
            // 续费：绝不允许覆盖 first_sales_id 和 source_channel_id
            if (!currentProfile) {
                // 异常兜底：存在历史成功订单但档案缺失时，先补建最小可用 customer_profile
                const earliestSuccessOrder = historyOrderQuery.data.length > 0 ? historyOrderQuery.data[0] : null;
                const recovered_first_sales_id =
                    (earliestSuccessOrder && (earliestSuccessOrder.first_sales_id || earliestSuccessOrder.sales_id)) ||
                    final_sales_id ||
                    '';
                const recovered_first_sales_name =
                    (earliestSuccessOrder && (earliestSuccessOrder.first_sales_name || earliestSuccessOrder.sales_name)) ||
                    final_sales_name ||
                    '';
                const recovered_source_channel_id =
                    (earliestSuccessOrder && earliestSuccessOrder.channel_id) ||
                    final_channel_id ||
                    '';
                const recovered_source_channel_name =
                    (earliestSuccessOrder && earliestSuccessOrder.channel_name) ||
                    final_channel_name ||
                    '';
                const recovered_current_sales_id = final_sales_id || recovered_first_sales_id || '';
                const recovered_current_sales_name = final_sales_name || recovered_first_sales_name || '';

                const fallbackProfile = {
                    user_id: userId,
                    mobile: mobile,
                    nickname: userInfo.nickname || '',
                    avatar: userInfo.avatar || '',
                    first_sales_id: recovered_first_sales_id,
                    first_sales_name: recovered_first_sales_name,
                    current_sales_id: recovered_current_sales_id,
                    current_sales_name: recovered_current_sales_name,
                    source_channel_id: recovered_source_channel_id,
                    source_channel_name: recovered_source_channel_name,
                    member_status: 1,
                    member_last_renew_time: now,
                    created_at: now,
                    updated_at: now
                };
                const addRes = await customerProfileCollection.add(fallbackProfile);
                currentProfile = { _id: addRes.id, ...fallbackProfile };
            }

            first_sales_id = currentProfile.first_sales_id || '';
            first_sales_name = currentProfile.first_sales_name || '';
            source_channel_id = currentProfile.source_channel_id || '';
            source_channel_name = currentProfile.source_channel_name || '';
            
            // 当前服务业务员：如果档案里没有，或是通过新渠道进来的，按既定规则更新 current_sales_id
            // 此处保持逻辑：续费也以当下渠道/业务员作为“服务者”
            current_sales_id = final_sales_id || currentProfile.current_sales_id || '';
            current_sales_name = final_sales_name || currentProfile.current_sales_name || '';

            await customerProfileCollection.doc(currentProfile._id).update({
                mobile: mobile,
                nickname: userInfo.nickname || '',
                avatar: userInfo.avatar || '',
                current_sales_id,
                current_sales_name,
                member_last_renew_time: now,
                member_status: 1,
                updated_at: now
            });
        }

        // 6. 提成计算统一（根据 final_sales_id 到 staff 表找比例）
        let commission_rate = 0;
        let commission_amount = 0;
        const commission_type = isFirstOpen ? 'first_open' : 'renewal';

        if (final_sales_id) {
            const staffRes = await db.collection('sales_staff').doc(final_sales_id).get();
            if (staffRes.data && staffRes.data.length > 0) {
                const staff = staffRes.data[0];
                commission_rate = isFirstOpen 
                    ? (staff.base_commission_rate_first || 0) 
                    : (staff.base_commission_rate_renew || 0);
                
                if (pay_amount > 0) {
                    commission_amount = Number((pay_amount * commission_rate).toFixed(2));
                }
            }
        }

        // 7. 计算到期时间
        const nowTs = now.getTime();
        const expire_time_before_ts = userInfo.vip_expire_time
            ? (userInfo.vip_expire_time instanceof Date ? userInfo.vip_expire_time.getTime() : userInfo.vip_expire_time)
            : nowTs;
        let expire_time_after_ts = Math.max(nowTs, expire_time_before_ts);
        expire_time_after_ts += member_days * 24 * 60 * 60 * 1000;

        const expire_time_before = new Date(expire_time_before_ts);
        const expire_time_after = new Date(expire_time_after_ts);
        const vip_expire_time = expire_time_after_ts;

        const dateObj = new Date(vip_expire_time);
        const vip_expire_time_text = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;

        // 8. 订单写入 member_order
        const order_no = 'VIP' + Date.now() + Math.floor(Math.random() * 10000);
        const discount_amount = original_amount - pay_amount;

        const newOrder = {
            order_no,
            user_id: userId,
            customer_id: currentProfile ? currentProfile._id : '',
            mobile: mobile,
            order_type: isFirstOpen ? 1 : 2,
            order_status: 1,
            pay_status: 1,
            pay_amount,
            original_amount,
            discount_amount,
            member_days,
            pay_time: now,
            pay_callback_time: now,
            out_trade_no: order_no,
            pay_order_no: order_no,
            transaction_id: event.transaction_id || `LEGACY_${order_no}`,
            expire_time_before,
            expire_time_after,
            sales_id: final_sales_id,
            sales_name: final_sales_name,
            first_sales_id,
            first_sales_name,
            channel_id: final_channel_id,
            channel_name: final_channel_name,
            invite_code: final_invite_code,
            commission_type,
            commission_rate,
            commission_amount,
            commission_status: 0,
            pay_channel: event.pay_channel || 'wechat',
            source_type: event.source_type || 'mini_program',
            remark: event.remark || '',
            created_at: now,
            updated_at: now
        };

        const orderInsert = await memberOrderCollection.add(newOrder);

        // 9. 更新 customer_profile 的 member_expire_time
        if (currentProfile) {
            await customerProfileCollection.doc(currentProfile._id).update({
                member_expire_time: expire_time_after,
                member_status: 1,
                updated_at: now
            });
        }

        // 10. 更新 uni-id-users 会员状态
        await usersCollection.doc(userId).update({
            is_vip: true,
            vip_expire_time,
            vip_expire_time_text
        });

        return res(200, '开通成功', {
            order_id: orderInsert.id,
            order_no,
            order_type: newOrder.order_type,
            sales_id: final_sales_id,
            sales_name: final_sales_name,
            channel_id: final_channel_id,
            channel_name: final_channel_name,
            commission_amount,
            vip_expire_time_text
        });

    } catch (err) {
        console.error('createMemberOrder error:', err);
        return res(500, '服务器内部错误', { error: err.message });
    }
};
