<template>
    <view class="rebuild-page">
        <view class="card">
            <text class="title">搜索索引维护工具</text>
            <text class="desc">仅管理员可用。建议先 Dry Run，再分步重建采购与供应。</text>

            <view class="field-row">
                <text class="field-label">batchSize</text>
                <input class="field-input" type="number" :value="batchSize" @input="onBatchInput" />
            </view>
            <view class="field-row">
                <text class="field-label">limit（0=不限）</text>
                <input class="field-input" type="number" :value="limit" @input="onLimitInput" />
            </view>

            <button class="btn btn-dry" :disabled="running" @tap="runDry">1. Dry Run</button>
            <button class="btn btn-main" :disabled="running" @tap="runPurchase">2. 重建采购</button>
            <button class="btn btn-main" :disabled="running" @tap="runSupply">3. 重建供应</button>
        </view>

        <view class="card result-card">
            <text class="result-title">执行结果</text>
            <text class="result-text">{{ resultText }}</text>
        </view>
    </view>
</template>

<script>
import { callCloudFunction } from '../../utils/api.js';

export default {
    data() {
        return {
            running: false,
            batchSize: '50',
            limit: '500',
            resultText: '点击上方按钮开始执行',
            isAdmin: false
        };
    },
    onLoad() {
        const userInfo = uni.getStorageSync('userInfo') || {};
        const role = userInfo.role;
        const isAdmin = Array.isArray(role)
            ? role.includes('admin')
            : typeof role === 'string'
            ? role.indexOf('admin') >= 0
            : false;
        this.setData({ isAdmin });
        if (!isAdmin) {
            this.setData({ resultText: '当前账号不是管理员，禁止执行。' });
        }
    },
    methods: {
        onBatchInput(e) {
            this.batchSize = (e.detail && e.detail.value) || '50';
        },
        onLimitInput(e) {
            this.limit = (e.detail && e.detail.value) || '0';
        },
        normalizeNumber(v, fallback) {
            const n = Number(v);
            if (!Number.isFinite(n) || n < 0) return fallback;
            return Math.floor(n);
        },
        getSafeBatchSize() {
            const raw = this.normalizeNumber(this.batchSize, 50) || 50;
            return Math.min(Math.max(raw, 20), 200);
        },
        getSafeLimit() {
            const raw = this.normalizeNumber(this.limit, 0);
            if (raw <= 0) return 0;
            return Math.min(raw, 5000);
        },
        getModeLabel(mode, dryRun) {
            if (dryRun) return 'Dry Run';
            if (mode === 'purchase') return '重建采购';
            if (mode === 'supply') return '重建供应';
            return '重建索引';
        },
        async runTask(mode, dryRun) {
            if (this.running) return;
            if (!this.isAdmin) {
                uni.showToast({ title: '仅管理员可执行', icon: 'none' });
                return;
            }
            const modeLabel = this.getModeLabel(mode, dryRun);
            const batchSize = this.getSafeBatchSize();
            const limit = this.getSafeLimit();
            const confirmRes = await new Promise((resolve) => {
                uni.showModal({
                    title: '请确认执行',
                    content: `${modeLabel}\n批次: ${batchSize}\n上限: ${limit > 0 ? limit : '不限(建议谨慎)'}`,
                    confirmText: '确认执行',
                    cancelText: '取消',
                    success: (r) => resolve(!!r.confirm),
                    fail: () => resolve(false)
                });
            });
            if (!confirmRes) return;

            this.running = true;
            this.resultText = '执行中，请稍候...';
            uni.showLoading({ title: '执行中' });
            try {
                const payload = {
                    mode,
                    dry_run: !!dryRun,
                    batchSize
                };
                if (limit > 0) {
                    payload.limit = limit;
                }
                const data = await callCloudFunction('rebuildSearchIndex', payload);
                this.resultText = JSON.stringify(data, null, 2);
                uni.showToast({ title: '执行成功', icon: 'none' });
            } catch (err) {
                const msg = (err && err.message) || '执行失败';
                this.resultText = `失败: ${msg}`;
                uni.showToast({ title: msg, icon: 'none' });
            } finally {
                this.running = false;
                uni.hideLoading();
            }
        },
        runDry() {
            this.runTask('all', true);
        },
        runPurchase() {
            this.runTask('purchase', false);
        },
        runSupply() {
            this.runTask('supply', false);
        }
    }
};
</script>

<style>
@import './rebuild-search-index.css';
</style>
