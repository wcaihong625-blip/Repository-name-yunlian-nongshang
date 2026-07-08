<template>
  <view class="page-shell">
    <view class="page-header">
      <view>
        <view class="page-title">会员优惠码管理</view>
        <view class="page-subtitle">按批次、类型、范围与状态管理优惠码并执行批量生成。</view>
      </view>
    </view>
    <view class="filter-card">
      <view class="toolbar-row">
        <input class="uni-search" v-model="q.batch_name" placeholder="批次名称" style="width:120px;" @confirm="search" />
        <input class="uni-search" v-model="q.code" placeholder="优惠码" style="width:140px;" @confirm="search" />
        <input class="uni-search" v-model="q.batch_id" placeholder="批次ID" style="width:160px;" @confirm="search" />
        <uni-data-select v-model="q.coupon_type" :localdata="typeOpts" style="width:130px;" />
        <uni-data-select v-model="q.scope" :localdata="scopeOpts" style="width:120px;" />
        <uni-data-select v-model="q.status" :localdata="statusOpts" style="width:100px;" />
        <button class="uni-button" type="primary" size="mini" @click="search">搜索</button>
        <button class="uni-button" type="default" size="mini" @click="reset">重置</button>
        <button class="uni-button" type="warn" size="mini" @click="openGen">批量生成</button>
        <button class="uni-button" type="default" size="mini" @click="goUseLog">核销记录</button>
        <button class="uni-button" type="default" size="mini" @click="exportCsv">导出当前页 CSV</button>
        <button class="uni-button" type="default" size="mini" @click="exportBatchByFilter">按筛选导出全部（分页拉取）</button>
      </view>
    </view>
    <view class="table-card">
      <uni-table border stripe :loading="loading" emptyText="暂无数据">
        <uni-tr>
          <uni-th align="center" width="120">优惠码</uni-th>
          <uni-th align="center" width="100">批次</uni-th>
          <uni-th align="center" width="80">类型</uni-th>
          <uni-th align="center" width="90">规则</uni-th>
          <uni-th align="center" width="80">范围</uni-th>
          <uni-th align="center" width="70">状态</uni-th>
          <uni-th align="center" width="90">已用/总数</uni-th>
          <uni-th align="center" width="140">有效期</uni-th>
          <uni-th align="center" width="120">创建时间</uni-th>
          <uni-th align="center" width="140">操作</uni-th>
        </uni-tr>
        <uni-tr v-for="row in list" :key="row._id">
          <uni-td align="center"><text class="mono">{{ row.code }}</text></uni-td>
          <uni-td align="center">{{ row.batch_name }}</uni-td>
          <uni-td align="center">{{ typeLabel(row.coupon_type) }}</uni-td>
          <uni-td align="center">{{ ruleText(row) }}</uni-td>
          <uni-td align="center">{{ scopeLabel(row.scope) }}</uni-td>
          <uni-td align="center">{{ row.status === 'enabled' ? '启用' : '停用' }}</uni-td>
          <uni-td align="center">{{ row.used_count || 0 }}/{{ row.max_use_count }}</uni-td>
          <uni-td align="center">
            <uni-dateformat :date="row.start_time" /> ~ <uni-dateformat :date="row.end_time" />
          </uni-td>
          <uni-td align="center"><uni-dateformat :date="row.created_at" /></uni-td>
          <uni-td align="center">
            <button class="uni-button" size="mini" type="primary" plain @click="showDetail(row)">详情</button>
            <button v-if="row.status === 'enabled'" class="uni-button" size="mini" @click="setStatus(row, 'disabled')">停用</button>
            <button v-else class="uni-button" size="mini" type="warn" @click="setStatus(row, 'enabled')">启用</button>
          </uni-td>
        </uni-tr>
      </uni-table>
      <view class="uni-pagination-box">
        <uni-pagination show-icon :page-size="pageSize" v-model="page" :total="total" @change="onPage" />
      </view>
    </view>

    <uni-popup ref="genPopup" type="center">
      <view class="gen-card">
        <view class="gen-title">批量生成优惠码</view>
        <uni-forms label-width="120">
          <uni-forms-item label="批次名称" required><input v-model="gen.batch_name" class="uni-input" placeholder="必填" /></uni-forms-item>
          <uni-forms-item label="前缀（可选）"><input v-model="gen.prefix" class="uni-input" placeholder="字母数字" /></uni-forms-item>
          <uni-forms-item label="数量" required><input v-model.number="gen.count" type="number" class="uni-input" /></uni-forms-item>
          <uni-forms-item label="类型">
            <uni-data-select v-model="gen.coupon_type" :localdata="genTypeOpts" />
          </uni-forms-item>
          <uni-forms-item v-if="gen.coupon_type !== 'free'" label="抵扣值">
            <input v-model.number="gen.discount_value" type="digit" class="uni-input" placeholder="金额或0.9折" />
          </uni-forms-item>
          <uni-forms-item label="适用范围">
            <uni-data-select v-model="gen.scope" :localdata="genScopeOpts" />
          </uni-forms-item>
          <uni-forms-item label="开始时间"><uni-datetime-picker type="datetime" return-type="timestamp" v-model="gen.start_time" /></uni-forms-item>
          <uni-forms-item label="结束时间"><uni-datetime-picker type="datetime" return-type="timestamp" v-model="gen.end_time" /></uni-forms-item>
          <uni-forms-item label="每码总次数"><input v-model.number="gen.max_use_count" type="number" class="uni-input" /></uni-forms-item>
          <uni-forms-item label="每用户次数"><input v-model.number="gen.max_use_per_user" type="number" class="uni-input" /></uni-forms-item>
          <uni-forms-item label="备注"><input v-model="gen.remark" class="uni-input" /></uni-forms-item>
        </uni-forms>
        <view class="gen-actions">
          <button class="uni-button" type="default" @click="closeGen">取消</button>
          <button class="uni-button" type="primary" :loading="genLoading" @click="submitGen">生成</button>
        </view>
      </view>
    </uni-popup>

    <uni-popup ref="detailPopup" type="center">
      <view class="gen-card detail-card" v-if="detailRow">
        <view class="gen-title">优惠码详情</view>
        <view class="detail-line"><text class="k">码</text><text class="v mono">{{ detailRow.code }}</text></view>
        <view class="detail-line"><text class="k">批次</text><text class="v">{{ detailRow.batch_name }} ({{ detailRow.batch_id }})</text></view>
        <view class="detail-line"><text class="k">类型/规则</text><text class="v">{{ typeLabel(detailRow.coupon_type) }} · {{ ruleText(detailRow) }}</text></view>
        <view class="detail-line"><text class="k">范围</text><text class="v">{{ scopeLabel(detailRow.scope) }}</text></view>
        <view class="detail-line"><text class="k">状态</text><text class="v">{{ detailRow.status === 'enabled' ? '启用' : '停用' }}</text></view>
        <view class="detail-line"><text class="k">使用</text><text class="v">{{ detailRow.used_count }}/{{ detailRow.max_use_count }}（每用户 {{ detailRow.max_use_per_user }}）</text></view>
        <view class="detail-line"><text class="k">有效期</text><text class="v"><uni-dateformat :date="detailRow.start_time" /> ~ <uni-dateformat :date="detailRow.end_time" /></text></view>
        <view class="detail-line" v-if="detailRow.remark"><text class="k">备注</text><text class="v">{{ detailRow.remark }}</text></view>
        <button class="uni-button" type="primary" @click="closeDetail">关闭</button>
      </view>
    </uni-popup>
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
      q: { batch_name: '', code: '', batch_id: '', coupon_type: '', scope: '', status: '' },
      typeOpts: [
        { value: '', text: '全部类型' },
        { value: 'amount', text: '固定金额' },
        { value: 'discount', text: '折扣' },
        { value: 'free', text: '0元' }
      ],
      scopeOpts: [
        { value: '', text: '全部范围' },
        { value: 'first_open', text: '首开' },
        { value: 'renewal', text: '续费' },
        { value: 'all', text: '全部' }
      ],
      statusOpts: [
        { value: '', text: '全部状态' },
        { value: 'enabled', text: '启用' },
        { value: 'disabled', text: '停用' }
      ],
      genLoading: false,
      gen: {
        batch_name: '',
        prefix: '',
        count: 10,
        coupon_type: 'amount',
        discount_value: 100,
        scope: 'all',
        start_time: null,
        end_time: null,
        max_use_count: 1,
        max_use_per_user: 1,
        remark: ''
      },
      genTypeOpts: [
        { value: 'amount', text: '固定金额抵扣' },
        { value: 'discount', text: '折扣' },
        { value: 'free', text: '0元开通' }
      ],
      genScopeOpts: [
        { value: 'first_open', text: '仅首开' },
        { value: 'renewal', text: '仅续费' },
        { value: 'all', text: '首开+续费' }
      ],
      detailRow: null
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
        const body = await this.memberCouponCo().list({
          ...this.tokenPayload(),
          page: this.page,
          pageSize: this.pageSize,
          batch_name: this.q.batch_name,
          code: this.q.code,
          batch_id: this.q.batch_id,
          coupon_type: this.q.coupon_type,
          scope: this.q.scope,
          status: this.q.status
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
      this.q = { batch_name: '', code: '', batch_id: '', coupon_type: '', scope: '', status: '' };
      this.page = 1;
      this.load();
    },
    onPage(e) {
      this.page = e.current || this.page;
      this.load();
    },
    goUseLog() {
      uni.navigateTo({ url: '/pages/coupon_code/use-log' });
    },
    typeLabel(t) {
      const m = { amount: '固定金额', discount: '折扣', free: '0元' };
      return m[t] || t;
    },
    scopeLabel(s) {
      const m = { first_open: '首开', renewal: '续费', all: '全部' };
      return m[s] || s;
    },
    ruleText(row) {
      if (!row) return '';
      if (row.coupon_type === 'free') return '实付0元';
      if (row.coupon_type === 'amount') return `减${row.discount_value}元`;
      if (row.coupon_type === 'discount') return `${(Number(row.discount_value) * 10).toFixed(1)}折`;
      return '';
    },
    openGen() {
      this.$refs.genPopup.open();
    },
    closeGen() {
      this.$refs.genPopup.close();
    },
    async submitGen() {
      if (!this.gen.batch_name) {
        uni.showToast({ title: '请填写批次名称', icon: 'none' });
        return;
      }
      this.genLoading = true;
      try {
        const body = await this.memberCouponCo().generate({
          ...this.tokenPayload(),
          ...this.gen
        });
        if (body.code !== 200) {
          uni.showModal({ title: '生成失败', content: body.message || '', showCancel: false });
          return;
        }
        const codes = (body.data && body.data.codes) || [];
        uni.showModal({
          title: '生成成功',
          content: `共 ${codes.length} 条。可在列表查看；需要文本备份可复制下方前若干条到备忘录。`,
          showCancel: false
        });
        this.closeGen();
        this.search();
        if (codes.length && codes.length <= 30) {
          setTimeout(() => {
            uni.setClipboardData({ data: codes.join('\n') });
          }, 400);
        }
      } catch (e) {
        uni.showModal({ content: e.message || '请求失败', showCancel: false });
      } finally {
        this.genLoading = false;
      }
    },
    showDetail(row) {
      this.detailRow = row;
      this.$refs.detailPopup.open();
    },
    closeDetail() {
      this.$refs.detailPopup.close();
    },
    async setStatus(row, status) {
      try {
        const body = await this.memberCouponCo().setStatus({ ...this.tokenPayload(), _id: row._id, status });
        if (body.code !== 200) {
          uni.showToast({ title: body.message || '失败', icon: 'none' });
          return;
        }
        uni.showToast({ title: '已更新', icon: 'success' });
        this.load();
      } catch (e) {
        uni.showToast({ title: e.message || '失败', icon: 'none' });
      }
    },
    exportCsv() {
      this._downloadCouponCsv(this.list, `member_coupon_page_${Date.now()}.csv`);
    },
    async exportBatchByFilter() {
      const all = [];
      let p = 1;
      const ps = 100;
      uni.showLoading({ title: '拉取中…' });
      try {
        while (true) {
          const body = await this.memberCouponCo().list({
            ...this.tokenPayload(),
            page: p,
            pageSize: ps,
            batch_name: this.q.batch_name,
            code: this.q.code,
            batch_id: this.q.batch_id,
            coupon_type: this.q.coupon_type,
            scope: this.q.scope,
            status: this.q.status
          });
          if (body.code !== 200) {
            uni.showModal({ title: '导出失败', content: body.message || '', showCancel: false });
            return;
          }
          const chunk = (body.data && body.data.list) || [];
          all.push(...chunk);
          if (chunk.length < ps) break;
          p += 1;
          if (p > 50) break;
        }
        if (!all.length) {
          uni.showToast({ title: '没有可导出的数据', icon: 'none' });
          return;
        }
        this._downloadCouponCsv(all, `member_coupon_export_${Date.now()}.csv`);
        uni.showToast({ title: `已导出 ${all.length} 条`, icon: 'success' });
      } catch (e) {
        uni.showModal({ content: e.message || '请求失败', showCancel: false });
      } finally {
        uni.hideLoading();
      }
    },
    _downloadCouponCsv(rows, filename) {
      const header = ['code', 'batch_name', 'batch_id', 'coupon_type', 'discount_value', 'scope', 'status', 'used_count', 'max_use_count'];
      const lines = [header.join(',')];
      rows.forEach((row) => {
        lines.push(
          header
            .map((k) => {
              let v = row[k];
              if (v === undefined || v === null) v = '';
              v = String(v).replace(/"/g, '""');
              return `"${v}"`;
            })
            .join(',')
        );
      });
      const csv = '\ufeff' + lines.join('\n');
      /* #ifdef H5 */
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      /* #endif */
      /* #ifndef H5 */
      uni.setClipboardData({ data: csv });
      uni.showToast({ title: '已复制 CSV 到剪贴板', icon: 'none' });
      /* #endif */
    }
  }
};
</script>

<style scoped>
@import '@/styles/admin-page.scss';
.gen-card {
  width: 520px;
  max-width: 92vw;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}
.gen-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 12px;
}
.gen-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
}
.detail-card .detail-line {
  display: flex;
  margin-bottom: 8px;
  font-size: 14px;
}
.detail-line .k {
  width: 100px;
  color: #666;
}
.detail-line .v {
  flex: 1;
}
.mono {
  font-family: monospace;
  font-size: 12px;
}
</style>
