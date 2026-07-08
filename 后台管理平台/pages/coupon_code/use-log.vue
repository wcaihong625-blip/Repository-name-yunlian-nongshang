<template>
  <view>
    <view class="uni-header">
      <view class="uni-group" style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <input class="uni-search" v-model="q.code" placeholder="优惠码" style="width:130px;" @confirm="search" />
        <input class="uni-search" v-model="q.batch_id" placeholder="批次ID" style="width:150px;" @confirm="search" />
        <input class="uni-search" v-model="q.batch_name" placeholder="批次名称" style="width:120px;" @confirm="search" />
        <input class="uni-search" v-model="q.mobile" placeholder="手机号" style="width:120px;" @confirm="search" />
        <input class="uni-search" v-model="q.order_no" placeholder="订单号" style="width:160px;" @confirm="search" />
        <view style="width:260px;">
          <uni-datetime-picker type="datetimerange" return-type="timestamp" v-model="q.usedRange" />
        </view>
        <button class="uni-button" type="primary" size="mini" @click="search">搜索</button>
        <button class="uni-button" type="default" size="mini" @click="reset">重置</button>
        <button class="uni-button" type="default" size="mini" @click="goList">返回码列表</button>
      </view>
    </view>
    <view class="uni-container">
      <uni-table border stripe :loading="loading" emptyText="暂无核销记录">
        <uni-tr>
          <uni-th align="center" width="110">优惠码</uni-th>
          <uni-th align="center" width="140">订单号</uni-th>
          <uni-th align="center" width="100">用户ID</uni-th>
          <uni-th align="center" width="100">手机号</uni-th>
          <uni-th align="center" width="140">核销时间</uni-th>
          <uni-th align="center" width="80">优惠前</uni-th>
          <uni-th align="center" width="80">优惠额</uni-th>
          <uni-th align="center" width="80">实付</uni-th>
          <uni-th align="center" width="80">会员类型</uni-th>
          <uni-th align="center" width="80">套餐周期</uni-th>
          <uni-th align="center" width="80">首开/续费</uni-th>
          <uni-th align="center" width="80">状态</uni-th>
          <uni-th align="center" width="100">批次</uni-th>
        </uni-tr>
        <uni-tr v-for="row in list" :key="row._id">
          <uni-td align="center"><text class="mono">{{ row.code }}</text></uni-td>
          <uni-td align="center">{{ row.order_no }}</uni-td>
          <uni-td align="center"><text class="mono tiny">{{ row.user_id }}</text></uni-td>
          <uni-td align="center">{{ row.mobile || '—' }}</uni-td>
          <uni-td align="center"><uni-dateformat :date="row.used_at" /></uni-td>
          <uni-td align="center">￥{{ row.pay_amount_before }}</uni-td>
          <uni-td align="center">￥{{ row.discount_amount }}</uni-td>
          <uni-td align="center">￥{{ row.pay_amount_after }}</uni-td>
          <uni-td align="center">{{ memberTypeLabel(row.member_type) }}</uni-td>
          <uni-td align="center">{{ planTypeLabel(row.plan_type) }}</uni-td>
          <uni-td align="center">{{ sceneLabel(row) }}</uni-td>
          <uni-td align="center">{{ row.status === 'used' ? '已核销' : row.status }}</uni-td>
          <uni-td align="center">{{ row.batch_name || '—' }}</uni-td>
        </uni-tr>
      </uni-table>
      <view class="uni-pagination-box">
        <uni-pagination show-icon :page-size="pageSize" v-model="page" :total="total" @change="onPage" />
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
      q: { code: '', batch_id: '', batch_name: '', mobile: '', order_no: '', usedRange: [] }
    };
  },
  onLoad() {
    this.load();
  },
  methods: {
    tokenPayload() {
      const uniIdToken = uni.getStorageSync('uni_id_token') || '';
      return { uniIdToken, token: uniIdToken };
    },
    memberCouponCo() {
      return uniCloud.importObject('memberCouponCo', { customUI: true });
    },
    async load() {
      this.loading = true;
      try {
        const ur = this.q.usedRange;
        const used_at_range = ur && ur.length === 2 ? ur : null;
        const body = await this.memberCouponCo().useLog({
          ...this.tokenPayload(),
          page: this.page,
          pageSize: this.pageSize,
          code: this.q.code,
          batch_id: this.q.batch_id,
          batch_name: this.q.batch_name,
          mobile: this.q.mobile,
          order_no: this.q.order_no,
          used_at_range
        });
        if (body.code !== 200) {
          uni.showModal({ title: '加载失败', content: body.message || '', showCancel: false });
          return;
        }
        const d = body.data || {};
        this.list = d.list || [];
        this.total = d.total || 0;
      } catch (e) {
        uni.showModal({ content: e.message || '请求失败', showCancel: false });
      } finally {
        this.loading = false;
      }
    },
    search() {
      this.page = 1;
      this.load();
    },
    reset() {
      this.q = { code: '', batch_id: '', batch_name: '', mobile: '', order_no: '', usedRange: [] };
      this.page = 1;
      this.load();
    },
    onPage(e) {
      this.page = e.current || this.page;
      this.load();
    },
    memberTypeLabel(v) {
      const m = { personal: '个人', enterprise: '企业' };
      return m[v] || '—';
    },
    planTypeLabel(v) {
      const m = { month: '月卡', quarter: '季卡', year: '年卡' };
      return m[v] || '—';
    },
    sceneLabel(row) {
      if (row.order_scene === 'new' || row.order_type === 1) return '首开';
      if (row.order_scene === 'renew' || row.order_type === 2) return '续费';
      return row.order_scene || '—';
    },
    goList() {
      uni.navigateBack({ fail: () => uni.redirectTo({ url: '/pages/coupon_code/list' }) });
    }
  }
};
</script>

<style scoped>
.mono {
  font-family: monospace;
  font-size: 12px;
}
.tiny {
  font-size: 11px;
  word-break: break-all;
}
</style>
