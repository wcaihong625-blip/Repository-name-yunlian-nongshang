<template>
    <!-- pages/user-profile/user-profile.wxml -->
    <view class="user-profile-page">
        <!-- 顶部用户信息概览区 -->
        <view class="profile-header">
            <view class="header-content">
                <view class="user-avatar-wrapper">
                    <image class="user-avatar" :src="userInfo.avatar || '/static/images/logo.png'" mode="aspectFill"></image>
                </view>
                <view class="user-info">
                    <view class="user-name-row">
                        <text class="user-name">{{ userInfo.username || userInfo.companyName || '用户' }}</text>
                    </view>
                    <auth-badges
                        class="profile-auth-badges"
                        :realname-verified="userInfo.isRealNameVerified"
                        :enterprise-verified="userInfo.isEnterpriseVerified"
                    />
                    <view class="user-meta">
                        <text v-if="userInfo.location" class="meta-item">📍 {{ userInfo.location }}</text>
                        <text v-if="userInfo.industry" class="meta-item">🏢 {{ userInfo.industry }}</text>
                    </view>
                    <text v-if="userInfo.bio" class="user-bio">{{ userInfo.bio }}</text>
                </view>
                <view class="header-actions">
                    <view v-if="isOwnProfile" class="edit-btn" @tap="editProfile">
                        <text>编辑资料</text>
                    </view>
                    <view v-if="!isOwnProfile" class="report-btn" @tap="showReportModalFun">
                        <text class="report-icon">⚠️</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- Tab切换区 -->
        <view class="tab-bar">
            <view :class="'tab-item ' + (activeTab === 'procurement' ? 'active' : '')" data-tab="procurement" @tap="switchTab">
                <text class="tab-text">采购信息</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'supply' ? 'active' : '')" data-tab="supply" @tap="switchTab">
                <text class="tab-text">供应信息</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'reputation' ? 'active' : '')" data-tab="reputation" @tap="switchTab">
                <text class="tab-text">信誉与评价</text>
            </view>
        </view>

        <!-- 内容区域 -->
        <view class="content-area">
            <!-- 采购信息Tab -->
            <view v-if="activeTab === 'procurement'" class="tab-content">
                <view v-if="procurementList.length > 0" class="item-list">
                    <view class="procurement-card" :data-id="item.id" @tap="goToProcurementDetail" v-for="(item, index) in procurementList" :key="index">
                        <view v-if="item.urgency === 'Urgent'" class="urgent-badge">急购</view>

                        <view class="card-header">
                            <view class="card-category">{{ item.category }}</view>
                        </view>

                        <text class="card-title">{{ item.title }}</text>

                        <view class="card-info">
                            <view class="info-item">
                                <text class="info-label">采购数量</text>
                                <text class="info-value">{{ item.quantity }}</text>
                            </view>
                            <view class="info-item">
                                <text class="info-label">期望价格</text>
                                <text class="info-value">{{ item.expectedPrice || '面议' }}</text>
                            </view>
                            <view v-if="item.deadline" class="info-item">
                                <text class="info-label">需求截止</text>
                                <text class="info-value">{{ item.deadline }}</text>
                            </view>
                        </view>

                        <view class="card-footer procurement-footer">
                            <text class="card-location">📍 {{ item.location }}</text>
                            <text class="card-time">{{ item.time }}</text>
                        </view>
                    </view>
                </view>
                <view v-else class="empty-state">
                    <text class="empty-icon">🛒</text>
                    <text class="empty-text">该用户暂未发布采购</text>
                </view>
            </view>

            <!-- 供应信息Tab -->
            <view v-if="activeTab === 'supply'" class="tab-content">
                <view v-if="supplyList.length > 0" class="item-list">
                    <view class="supply-card" :data-id="item.id" @tap="goToSupplyDetail" v-for="(item, index) in supplyList" :key="index">
                        <image class="card-image" :src="item.imageUrl" mode="aspectFill"></image>

                        <view class="card-content">
                            <view class="card-header">
                                <view class="card-category">{{ item.category }}</view>
                            </view>
                            <text class="card-title">{{ item.title }}</text>
                            <view class="card-footer supply-footer">
                                <text class="card-price">{{ item.price }}</text>
                                <view class="supply-meta-row">
                                    <text class="card-location">📍 {{ item.location }}</text>
                                    <text class="card-time">{{ item.updateTime || item.time }}</text>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
                <view v-else class="empty-state">
                    <text class="empty-icon">📦</text>
                    <text class="empty-text">该用户暂未发布供应</text>
                </view>
            </view>

            <!-- 信誉与评价Tab -->
            <view v-if="activeTab === 'reputation'" class="tab-content">
                <view class="reputation-section">
                    <!-- 评价TA按钮（仅在查看他人主页时显示） -->
                    <view v-if="!isOwnProfile" class="evaluate-action-bar">
                        <button class="evaluate-btn" @tap="showEvaluateModalFun">
                            <text class="evaluate-icon">⭐</text>
                            <text class="evaluate-text">评价TA</text>
                        </button>
                    </view>

                    <!-- 第一块：信誉概览 -->
                    <view class="rep-card rep-overview-card">
                        <text class="rep-card-title">信誉概览</text>
                        <view class="rep-overview-grid">
                            <view class="rep-overview-row">
                                <text class="rep-label">综合信誉</text>
                                <text class="rep-em">{{ repSummary.reputation_score }} 分</text>
                            </view>
                            <view class="rep-overview-row">
                                <text class="rep-label">好评率</text>
                                <text class="rep-em">{{ repSummaryDisplayPositiveRate }}</text>
                            </view>
                            <view class="rep-overview-row">
                                <text class="rep-label">举报记录</text>
                                <text class="rep-em">{{ repSummary.report_count }} 次</text>
                            </view>
                            <view class="rep-overview-row">
                                <text class="rep-label">有效举报</text>
                                <text class="rep-value">{{ repSummary.valid_report_count }} 次</text>
                            </view>
                            <view class="rep-overview-row">
                                <text class="rep-label">实名认证</text>
                                <text class="rep-value">{{ repSummaryDisplayVerify }}</text>
                            </view>
                            <view class="rep-overview-row">
                                <text class="rep-label">风险状态</text>
                                <text :class="'rep-value ' + repSummaryRiskClass">{{ repSummaryDisplayRisk }}</text>
                            </view>
                        </view>
                    </view>

                    <!-- 第二块：行为统计 -->
                    <view class="rep-card rep-stats-card">
                        <text class="rep-card-title">用户行为</text>
                        <view class="rep-stat-grid">
                            <view class="rep-stat-cell">
                                <text class="rep-stat-num">{{ repStats.publish_purchase_count }}</text>
                                <text class="rep-stat-label">采购发布</text>
                            </view>
                            <view class="rep-stat-cell">
                                <text class="rep-stat-num">{{ repStats.publish_supply_count }}</text>
                                <text class="rep-stat-label">供应发布</text>
                            </view>
                            <view class="rep-stat-cell">
                                <text class="rep-stat-num">{{ repStats.total_view_count }}</text>
                                <text class="rep-stat-label">浏览总量</text>
                            </view>
                            <view class="rep-stat-cell">
                                <text class="rep-stat-num">{{ repStats.contact_count }}</text>
                                <text class="rep-stat-label">被联系</text>
                            </view>
                            <view class="rep-stat-cell">
                                <text class="rep-stat-num">{{ repStats.favorite_count }}</text>
                                <text class="rep-stat-label">被收藏</text>
                            </view>
                        </view>
                    </view>

                    <!-- 第三块：评价列表 -->
                    <view class="reviews-section rep-reviews-wrap">
                        <view class="reviews-header">
                            <text class="section-title">用户评价</text>
                            <view class="sort-options">
                                <view :class="'sort-item ' + (reviewSortType === 'latest' ? 'active' : '')" data-sort="latest" @tap="changeReviewSort">
                                    <text>最新</text>
                                </view>
                                <view class="sort-divider">|</view>
                                <view :class="'sort-item ' + (reviewSortType === 'helpful' ? 'active' : '')" data-sort="helpful" @tap="changeReviewSort">
                                    <text>最有用</text>
                                </view>
                            </view>
                        </view>
                        <view v-if="sortedReviews && sortedReviews.length > 0" class="reviews-list">
                            <view class="review-item rep-review-card" v-for="(rev, ridx) in sortedReviews" :key="rev.id || ridx">
                                <view class="review-header">
                                    <view
                                        :class="'reviewer-info ' + (rev.isAnonymous ? 'anonymous' : '')"
                                        v-if="!rev.isAnonymous"
                                        :data-reviewer-id="rev.reviewerId"
                                        @tap="goToReviewerProfile"
                                    >
                                        <view class="reviewer-avatar">{{ rev.reviewerNameChar }}</view>
                                        <view class="reviewer-details">
                                            <text class="reviewer-name">{{ rev.reviewerName }}</text>
                                            <view class="review-stars">
                                                <text
                                                    :class="'star ' + (si < rev.score ? 'filled' : '')"
                                                    v-for="(s, si) in 5"
                                                    :key="'s' + si"
                                                >
                                                    ★
                                                </text>
                                                <text class="review-score-text">{{ rev.score }} 分</text>
                                            </view>
                                        </view>
                                    </view>
                                    <view v-else class="reviewer-info anonymous">
                                        <view class="reviewer-avatar anonymous-avatar">匿</view>
                                        <view class="reviewer-details">
                                            <text class="reviewer-name">匿名用户</text>
                                            <view class="review-stars">
                                                <text
                                                    :class="'star ' + (si < rev.score ? 'filled' : '')"
                                                    v-for="(s, si) in 5"
                                                    :key="'s' + si"
                                                >
                                                    ★
                                                </text>
                                                <text class="review-score-text">{{ rev.score }} 分</text>
                                            </view>
                                        </view>
                                    </view>
                                    <text class="review-time">{{ rev.time }}</text>
                                </view>

                                <view v-if="rev.tags && rev.tags.length" class="rep-review-tags">
                                    <text class="rep-tag" v-for="(tg, ti) in rev.tags" :key="'t' + ti">{{ tg }}</text>
                                </view>

                                <text class="review-content">{{ rev.content || '—' }}</text>

                                <view v-if="rev.detailScores" class="review-detail-scores">
                                    <view class="detail-score-item">
                                        <text class="detail-label">商品相符</text>
                                        <view class="detail-stars">
                                            <text
                                                :class="'star ' + (si < (rev.detailScores.description || 0) ? 'filled' : '')"
                                                v-for="(s, si) in 5"
                                                :key="'d' + si"
                                            >
                                                ★
                                            </text>
                                        </view>
                                    </view>
                                    <view class="detail-score-item">
                                        <text class="detail-label">发货速度</text>
                                        <view class="detail-stars">
                                            <text
                                                :class="'star ' + (si < (rev.detailScores.delivery || 0) ? 'filled' : '')"
                                                v-for="(s, si) in 5"
                                                :key="'e' + si"
                                            >
                                                ★
                                            </text>
                                        </view>
                                    </view>
                                    <view class="detail-score-item">
                                        <text class="detail-label">沟通态度</text>
                                        <view class="detail-stars">
                                            <text
                                                :class="'star ' + (si < (rev.detailScores.communication || 0) ? 'filled' : '')"
                                                v-for="(s, si) in 5"
                                                :key="'f' + si"
                                            >
                                                ★
                                            </text>
                                        </view>
                                    </view>
                                </view>
                            </view>
                        </view>
                        <view v-else class="empty-state rep-empty">
                            <text class="empty-icon">💬</text>
                            <text class="empty-text">暂无评价记录</text>
                            <text class="empty-sub">继续保持真实、活跃的交易行为，有助于提升信誉</text>
                        </view>
                    </view>

                    <!-- 第四块：平台说明 -->
                    <view class="rep-footer-note">
                        <text class="rep-note-line">信誉信息由发布行为、活跃情况、评价记录、举报处理结果综合生成。</text>
                        <text class="rep-note-line">平台严禁发布虚假信息、诈骗、辱骂等违规行为。</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 固定底部操作栏 -->
        <view v-if="!isOwnProfile" class="bottom-actions">
            <button :class="'follow-btn ' + (isFollowing ? 'followed' : '')" @tap="toggleFollow">
                <text v-if="isFollowing">✓ 已关注</text>
                <text v-else>➕ 关注</text>
            </button>
            <button class="contact-btn" @tap="contactUser">💬 联系TA</button>
        </view>

        <!-- 评价弹窗 -->
        <view v-if="showEvaluateModal" class="modal-overlay" @tap="closeEvaluateModal">
            <view class="modal-content" @tap.stop.prevent="stopPropagation">
                <view class="modal-header">
                    <text class="modal-title">评价用户</text>
                    <text class="modal-close" @tap="closeEvaluateModal">✕</text>
                </view>
                <view class="modal-body">
                    <!-- 综合评分 -->
                    <view class="evaluate-section">
                        <text class="evaluate-label">
                            综合评分
                            <text class="required">*</text>
                        </text>
                        <view class="star-rating">
                            <text
                                :class="'star-select ' + (index < evaluateForm.overallScore ? 'active' : '')"
                                :data-score="index + 1"
                                @tap="setOverallScore"
                                v-for="(item, index) in 5"
                                :key="index"
                            >
                                ★
                            </text>
                        </view>
                    </view>

                    <!-- 细分维度评分 -->
                    <view class="evaluate-section">
                        <text class="evaluate-label">交易诚信度（可选）</text>
                        <view class="star-rating">
                            <text
                                :class="'star-select ' + (index < evaluateForm.trustScore ? 'active' : '')"
                                :data-score="index + 1"
                                data-type="trust"
                                @tap="setDetailScore"
                                v-for="(item, index) in 5"
                                :key="index"
                            >
                                ★
                            </text>
                        </view>
                    </view>

                    <view class="evaluate-section">
                        <text class="evaluate-label">沟通响应度（可选）</text>
                        <view class="star-rating">
                            <text
                                :class="'star-select ' + (index < evaluateForm.communicationScore ? 'active' : '')"
                                :data-score="index + 1"
                                data-type="communication"
                                @tap="setDetailScore"
                                v-for="(item, index) in 5"
                                :key="index"
                            >
                                ★
                            </text>
                        </view>
                    </view>

                    <view class="evaluate-section">
                        <text class="evaluate-label">货品相符度（可选）</text>
                        <view class="star-rating">
                            <text
                                :class="'star-select ' + (index < evaluateForm.productScore ? 'active' : '')"
                                :data-score="index + 1"
                                data-type="product"
                                @tap="setDetailScore"
                                v-for="(item, index) in 5"
                                :key="index"
                            >
                                ★
                            </text>
                        </view>
                    </view>

                    <!-- 文字评价 -->
                    <view class="evaluate-section">
                        <text class="evaluate-label">详细评价</text>
                        <textarea
                            class="evaluate-textarea"
                            placeholder="请填写您的评价内容..."
                            :value="evaluateForm.content"
                            @input="onEvaluateContentInput"
                            maxlength="500"
                            :show-confirm-bar="false"
                        ></textarea>
                        <text class="char-count">{{ evaluateForm.content.length }}/500</text>
                    </view>

                    <!-- 匿名评价选项 -->
                    <view class="evaluate-section">
                        <view class="checkbox-wrapper" @tap="toggleAnonymous">
                            <view :class="'checkbox ' + (evaluateForm.isAnonymous ? 'checked' : '')">
                                <text v-if="evaluateForm.isAnonymous" class="checkbox-icon">✓</text>
                            </view>
                            <text class="checkbox-label">匿名评价</text>
                        </view>
                    </view>
                </view>
                <view class="modal-footer">
                    <button class="modal-btn cancel-btn" @tap="closeEvaluateModal">取消</button>
                    <button class="modal-btn submit-btn" @tap="submitEvaluate" :disabled="evaluateForm.overallScore === 0">提交评价</button>
                </view>
            </view>
        </view>

        <!-- 举报弹窗 -->
        <view v-if="showReportModal" class="modal-overlay" @tap="onReportOverlayTap">
            <view class="modal-content report-modal" @tap.stop.prevent="stopPropagation">
                <view class="modal-header">
                    <text class="modal-title">举报用户</text>
                    <text class="modal-close" @tap="closeReportModal">✕</text>
                </view>
                <view class="modal-body">
                    <!-- 举报原因 -->
                    <view class="report-section">
                        <text class="report-label">
                            举报原因
                            <text class="required">*</text>
                        </text>
                        <view class="report-reasons">
                            <view
                                :class="'reason-item ' + (reportForm.selectedCode === item.code ? 'selected' : '')"
                                :data-code="item.code"
                                @tap="selectReportReason"
                                v-for="(item, index) in reportReasons"
                                :key="index"
                            >
                                <text class="reason-text">{{ item.label }}</text>

                                <text v-if="reportForm.selectedCode === item.code" class="reason-check">✓</text>
                            </view>
                        </view>
                    </view>

                    <!-- 补充说明 -->
                    <view class="report-section">
                        <text class="report-label">补充说明</text>
                        <textarea
                            class="report-textarea"
                            placeholder="请详细描述举报的具体情况..."
                            :value="reportForm.description"
                            @input="onReportDescriptionInput"
                            maxlength="500"
                            :show-confirm-bar="false"
                        ></textarea>
                        <text class="char-count">{{ reportForm.description.length }}/500</text>
                    </view>

                    <!-- 上传图片证据 -->
                    <view class="report-section">
                        <text class="report-label">上传证据（可选）</text>
                        <view class="image-upload">
                            <view class="uploaded-image" v-for="(item, index) in reportForm.images" :key="index">
                                <image class="image-preview" :src="item" mode="aspectFill"></image>

                                <text class="image-delete" :data-index="index" @tap="removeReportImage">✕</text>
                            </view>
                            <view v-if="reportForm.images.length < 3" class="upload-btn" @tap="chooseReportImage">
                                <text class="upload-icon">📷</text>
                                <text class="upload-text">添加图片</text>
                            </view>
                        </view>
                    </view>
                </view>
                <view class="modal-footer">
                    <button class="modal-btn cancel-btn" @tap="closeReportModal" :disabled="reportSubmitting">取消</button>
                    <button
                        class="modal-btn submit-btn"
                        @tap="submitReport"
                        :disabled="!reportForm.selectedCode || reportSubmitting"
                        :loading="reportSubmitting"
                    >
                        提交举报
                    </button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
// pages/user-profile/user-profile.js
import {
    getUserProfile,
    getUserSupplies,
    getUserProcurements,
    recordProfileView,
    getUserReputationSummary,
    getUserReputationReviews,
    submitUserReport,
    submitUserReview,
    uploadImage
} from '../../utils/api.js';
import { isFollowing, syncFollowStateFromServer, toggleFollowUser } from '../../utils/followState.js';
import { parseTimeToMinutes as parseTimeToMinutesUtil } from '../../utils/util.js';
import AuthBadges from '../../components/auth-badges/auth-badges.vue';
const app = getApp();
export default {
    components: {
        AuthBadges
    },
    data() {
        return {
            userId: null,
            isOwnProfile: false,
            isFollowing: false,
            activeTab: 'procurement',
            // 'supply' | 'procurement' | 'reputation'
            reviewSortType: 'latest',
            // 'latest' | 'helpful'
            userInfo: {
                username: '',
                companyName: '',
                avatar: '',
                location: '',
                industry: '',
                bio: '',
                isRealNameVerified: false,
                isEnterpriseVerified: false
            },
            supplyList: [],
            procurementList: [],
            reputationData: {
                overallScore: 0,
                descriptionScore: 0,
                deliveryScore: 0,
                communicationScore: 0,
                transactionCount: 0,
                reviews: [],
                descriptionScoreInt: 0,
                deliveryScoreInt: 0,
                communicationScoreInt: 0
            },
            /** 信誉概览（接口 + 兜底） */
            repSummary: {
                reputation_score: 0,
                positive_rate: 0,
                report_count: 0,
                valid_report_count: 0,
                is_verified: false,
                is_enterprise_verified: false,
                risk_level: 'normal'
            },
            /** 行为统计 */
            repStats: {
                publish_purchase_count: 0,
                publish_supply_count: 0,
                total_view_count: 0,
                contact_count: 0,
                favorite_count: 0
            },
            sortedReviews: [],
            // 评价相关
            showEvaluateModal: false,
            evaluateForm: {
                overallScore: 0,
                trustScore: 0,
                communicationScore: 0,
                productScore: 0,
                content: '',
                isAnonymous: false
            },
            // 举报相关
            showReportModal: false,
            reportReasons: [
                { label: '发布不实信息/虚假内容', code: 'fake_info' },
                { label: '发布垃圾广告/骚扰信息', code: 'spam' },
                { label: '头像/昵称涉嫌违规', code: 'illegal_profile' },
                { label: '存在欺诈或资金风险', code: 'fraud' },
                { label: '言语辱骂/人身攻击', code: 'abuse' },
                { label: '其他', code: 'other' }
            ],
            reportForm: {
                selectedCode: '',
                description: '',
                images: []
            },
            reportSubmitting: false
        };
    },
    computed: {
        repSummaryDisplayPositiveRate() {
            let p = Number(this.repSummary.positive_rate);
            if (isNaN(p)) {
                p = 0;
            }
            if (p > 0 && p <= 1) {
                p = Math.round(p * 100);
            }
            return `${Math.round(p)}%`;
        },
        repSummaryDisplayVerify() {
            const ent = this.repSummary.is_enterprise_verified || this.userInfo.isEnterpriseVerified;
            const real = this.repSummary.is_verified || this.userInfo.isRealNameVerified;
            if (ent) {
                return '企业已认证';
            }
            if (real) {
                return '已认证';
            }
            return '未认证';
        },
        repSummaryDisplayRisk() {
            const lv = (this.repSummary.risk_level || 'normal').toString().toLowerCase();
            const map = {
                normal: '正常',
                low: '轻度风险',
                mild: '轻度风险',
                light: '轻度风险',
                warning: '已警告',
                warn: '已警告',
                critical: '已警告',
                danger: '已警告'
            };
            return map[lv] || (lv === 'normal' ? '正常' : this.repSummary.risk_level || '正常');
        },
        repSummaryRiskClass() {
            const t = this.repSummaryDisplayRisk;
            if (t === '正常') {
                return 'risk-ok';
            }
            if (t === '轻度风险') {
                return 'risk-mild';
            }
            return 'risk-warn';
        }
    },
    onLoad(options) {
        const userId = options.userId || options.id;
        if (!userId) {
            uni.showToast({
                title: '用户不存在',
                icon: 'none'
            });
            setTimeout(() => {
                uni.navigateBack();
            }, 1500);
            return;
        }

        // 检查是否是自己的主页
        const currentUser = app.globalData.userInfo || uni.getStorageSync('userInfo');
        const currentUserId = (currentUser && (currentUser.user_id || currentUser._id || currentUser.id)) || '';
        const isOwnProfile = !!currentUserId && String(currentUserId) === String(userId);

        const isFollowingNow = isFollowing(userId);
        this.setData({
            userId: userId,
            isOwnProfile: isOwnProfile,
            isFollowing: isFollowingNow
        });
        this.loadUserInfo();
        this.loadTabData('procurement');
        
        // 如果不是自己的主页，记录浏览
        if (!isOwnProfile && currentUserId) {
            this.recordProfileView(userId);
        }
    },
    onShow() {
        // 页面显示时刷新数据
        if (this.userId) {
            this.loadTabData(this.activeTab);
            this.refreshFollowState();
        }
    },
    // 下拉刷新
    onPullDownRefresh() {
        this.loadUserInfo();
        this.loadTabData(this.activeTab);
        setTimeout(() => {
            uni.stopPullDownRefresh();
            uni.showToast({
                title: '刷新成功',
                icon: 'success',
                duration: 1500
            });
        }, 1000);
    },
    methods: {
        async refreshFollowState(force = false) {
            if (!this.userId || this.isOwnProfile) return;
            try {
                if (force) {
                    await syncFollowStateFromServer(true);
                }
            } catch (_e) {}
            this.setData({
                isFollowing: isFollowing(this.userId)
            });
        },
        // 加载用户信息
        async loadUserInfo() {
            if (!this.userId) {
                return;
            }

            try {
                const user = await getUserProfile(this.userId);
                if (user) {
                    this.setData({
                        userInfo: {
                            username: user.username || user.nickname || '用户',
                            companyName: user.companyName || '',
                            avatar: user.avatar || '',
                            location: user.location || '未设置',
                            industry: user.industry || '未设置',
                            bio: user.bio || '这个人很懒，什么都没有留下',
                            isRealNameVerified: user.isRealNameVerified || false,
                            isEnterpriseVerified: user.isEnterpriseVerified || false
                        }
                    });
                }
            } catch (error) {
                console.error('加载用户信息失败:', error);
                uni.showToast({
                    title: '加载用户信息失败',
                    icon: 'none'
                });
            }
        },

        // 加载Tab数据
        loadTabData(tab) {
            switch (tab) {
                case 'supply':
                    this.loadSupplyList();
                    break;
                case 'procurement':
                    this.loadProcurementList();
                    break;
                case 'reputation':
                    this.loadReputationData();
                    break;
            }
        },

        // 加载供应列表
        async loadSupplyList() {
            if (!this.userId) {
                return;
            }

            try {
                const result = await getUserSupplies(this.userId, {
                    page: 1,
                    pageSize: 100
                });
                
                if (result && result.list) {
                    // 格式化数据
                    const formattedList = result.list.map(item => ({
                        ...item,
                        imageUrl: item.images && item.images.length > 0 ? item.images[0] : '/static/images/logo.png',
                        updateTime: item.time || '刚刚'
                    }));
                    
                    this.setData({
                        supplyList: formattedList
                    });
                } else {
                    this.setData({
                        supplyList: []
                    });
                }
            } catch (error) {
                console.error('加载供应列表失败:', error);
                this.setData({
                    supplyList: []
                });
            }
        },

        // 加载采购列表
        async loadProcurementList() {
            if (!this.userId) {
                return;
            }

            try {
                const result = await getUserProcurements(this.userId, {
                    page: 1,
                    pageSize: 100
                });
                
                if (result && result.list) {
                    this.setData({
                        procurementList: result.list
                    });
                } else {
                    this.setData({
                        procurementList: []
                    });
                }
            } catch (error) {
                console.error('加载采购列表失败:', error);
                this.setData({
                    procurementList: []
                });
            }
        },

        mergeRepSummaryFromApi(raw) {
            const r = raw || {};
            const nested = r.stats || r.summary || {};
            const num = (a, b, def) => {
                const v = a != null ? a : b;
                const n = Number(v);
                return isNaN(n) ? def : n;
            };
            return {
                reputation_score: num(r.reputation_score, nested.reputation_score, 0),
                positive_rate: num(r.positive_rate, nested.positive_rate, 0),
                report_count: num(r.report_count, nested.report_count, 0),
                valid_report_count: num(r.valid_report_count, nested.valid_report_count, 0),
                is_verified: !!(r.is_verified != null ? r.is_verified : nested.is_verified),
                is_enterprise_verified: !!(r.is_enterprise_verified != null ? r.is_enterprise_verified : nested.is_enterprise_verified),
                risk_level: r.risk_level || nested.risk_level || 'normal'
            };
        },

        mergeRepStatsFromApi(raw) {
            const r = raw || {};
            const s = r.stats || r.behavior || {};
            const pick = (k) => {
                const v = r[k] != null ? r[k] : s[k];
                const n = Number(v);
                return isNaN(n) ? 0 : n;
            };
            return {
                publish_purchase_count: pick('publish_purchase_count'),
                publish_supply_count: pick('publish_supply_count'),
                total_view_count: pick('total_view_count'),
                contact_count: pick('contact_count'),
                favorite_count: pick('favorite_count')
            };
        },

        maskReviewUserName(name) {
            const n = (name || '').toString().trim();
            if (!n || n.length < 2) {
                return n || '用**';
            }
            return n.charAt(0) + '**';
        },

        computeReviewSortScore(displayTime, rawIso) {
            const iso = rawIso || '';
            if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) {
                const d = new Date(iso.replace(/-/g, '/'));
                return isNaN(d.getTime()) ? 0 : d.getTime();
            }
            const t = displayTime || '';
            if (t && /^\d{4}-\d{2}-\d{2}/.test(t)) {
                const d = new Date(t.replace(/-/g, '/'));
                return isNaN(d.getTime()) ? 0 : d.getTime();
            }
            const m = parseTimeToMinutesUtil(t);
            if (m > 0) {
                return Date.now() - m * 60000;
            }
            return 0;
        },

        normalizeReviewFromApi(r) {
            const row = r || {};
            const score = Math.min(5, Math.max(0, Math.round(Number(row.score) || 0)));
            let tags = [];
            if (Array.isArray(row.tags)) {
                tags = row.tags.filter(Boolean);
            } else if (typeof row.tags === 'string' && row.tags) {
                tags = row.tags
                    .split(/[,，]/)
                    .map((x) => x.trim())
                    .filter(Boolean);
            }
            const isAnon = !!(row.is_anonymous || row.isAnonymous);
            const rawName = (row.review_user_name || row.reviewerName || '用户').toString();
            const masked = isAnon ? '匿名用户' : this.maskReviewUserName(rawName);
            const created = row.created_at || row.createdAt || '';
            let time = '';
            if (created) {
                time = created.indexOf('T') > 0 ? created.slice(0, 10) : created.slice(0, 10);
            } else if (row.time) {
                time = row.time;
            } else {
                time = '—';
            }
            const sortScore = this.computeReviewSortScore(time, created) || Date.now();
            const reviewerNameChar = masked === '匿名用户' ? '匿' : masked.charAt(0) || '用';
            return {
                id: row.id || row._id || '',
                reviewerId: row.reviewer_id || row.review_user_id || row.reviewerId || '',
                reviewerName: masked,
                reviewerNameChar,
                score,
                content: row.content || '',
                time,
                helpfulCount: Number(row.helpful_count || row.helpfulCount) || 0,
                tags,
                isAnonymous: isAnon,
                detailScores: row.detail_scores || row.detailScores,
                sortScore
            };
        },

        // 加载信誉数据（云对象 reputationCo.getSummary / getReviews，未部署时兜底为空）
        async loadReputationData() {
            if (!this.userId) {
                return;
            }
            const uid = this.userId;
            try {
                const [sumRaw, revRaw] = await Promise.all([getUserReputationSummary(uid), getUserReputationReviews(uid, { page: 1, pageSize: 50 })]);
                const repSummary = this.mergeRepSummaryFromApi(sumRaw);
                const repStats = this.mergeRepStatsFromApi(sumRaw);
                let list = [];
                if (revRaw) {
                    const arr = revRaw.list || revRaw.reviews || revRaw.data || (Array.isArray(revRaw) ? revRaw : []);
                    if (Array.isArray(arr)) {
                        list = arr.map((item) => this.normalizeReviewFromApi(item));
                    }
                }
                const avg =
                    list.length > 0 ? (list.reduce((acc, x) => acc + (x.score || 0), 0) / list.length).toFixed(1) : '0.0';
                const reputationData = {
                    ...this.reputationData,
                    overallScore: avg,
                    reviews: list
                };
                this.setData({
                    repSummary,
                    repStats,
                    reputationData
                });
                this.sortReviews(this.reviewSortType);
            } catch (e) {
                console.error('加载信誉数据失败:', e);
                this.setData({
                    repSummary: this.mergeRepSummaryFromApi(null),
                    repStats: this.mergeRepStatsFromApi(null),
                    reputationData: {
                        ...this.reputationData,
                        reviews: []
                    }
                });
                this.sortReviews('latest');
            }
        },

        // 排序评价
        sortReviews(sortType) {
            const { reputationData } = this;
            let sortedReviews = [...(reputationData.reviews || [])];
            if (sortType === 'latest') {
                sortedReviews.sort((a, b) => (b.sortScore || 0) - (a.sortScore || 0));
            } else if (sortType === 'helpful') {
                sortedReviews.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0));
            }
            this.setData({
                sortedReviews: sortedReviews,
                reviewSortType: sortType
            });
        },

        // 解析时间字符串为分钟数（用于排序）- 使用工具函数
        parseTimeToMinutes(timeStr) {
            return parseTimeToMinutesUtil(timeStr);
        },

        // 切换评价排序方式
        changeReviewSort(e) {
            const sortType = e.currentTarget.dataset.sort;
            if (sortType && sortType !== this.reviewSortType) {
                this.sortReviews(sortType);
            }
        },

        // 跳转到评价者个人主页
        goToReviewerProfile(e) {
            const reviewerId = e.currentTarget.dataset.reviewerId;
            if (!reviewerId) {
                return;
            }
            uni.navigateTo({
                url: `/pages/user-profile/user-profile?userId=${reviewerId}`
            });
        },

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

        // 跳转到供应详情
        goToSupplyDetail(e) {
            const id = e.currentTarget.dataset.id;
            uni.navigateTo({
                url: `/pages/supply-detail/supply-detail?id=${id}`
            });
        },

        // 跳转到采购详情
        goToProcurementDetail(e) {
            const id = e.currentTarget.dataset.id;
            // 假设有采购详情页，如果没有可以跳转到采购列表页
            uni.showToast({
                title: '采购详情功能开发中',
                icon: 'none'
            });
            // wx.navigateTo({
            //   url: `/pages/procurement-detail/procurement-detail?id=${id}`
            // });
        },

        // 切换关注状态
        toggleFollow() {
            const { userId } = this;
            toggleFollowUser(userId)
                .then((ret) => {
                    this.setData({
                        isFollowing: ret.isFollowing
                    });
                    uni.showToast({
                        title: ret.isFollowing ? '关注成功' : '已取消关注',
                        icon: 'success',
                        duration: 1500
                    });
                })
                .catch((err) => {
                    uni.showToast({
                        title: err.message || '操作失败',
                        icon: 'none'
                    });
                });
        },

        // 联系用户
        async contactUser() {
            if (!this.userId) {
                return;
            }

            try {
                // 获取用户信息（包括电话）
                const userInfo = await getUserProfile(this.userId);
                
                if (userInfo && userInfo.mobile) {
                    // 显示联系弹窗
                    uni.showModal({
                        title: '联系用户',
                        content: `即将拨打 ${userInfo.nickname || userInfo.username || '用户'} 的电话\n${userInfo.mobile}`,
                        confirmText: '拨打',
                        confirmColor: '#16a34a',
                        success: (res) => {
                            if (res.confirm) {
                                uni.makePhoneCall({
                                    phoneNumber: userInfo.mobile,
                                    fail: (err) => {
                                        console.error('拨打电话失败', err);
                                        uni.showToast({
                                            title: '拨打电话失败',
                                            icon: 'none'
                                        });
                                    }
                                });
                            }
                        }
                    });
                } else {
                    uni.showToast({
                        title: '该用户未设置电话',
                        icon: 'none'
                    });
                }
            } catch (error) {
                console.error('获取用户信息失败:', error);
                uni.showToast({
                    title: '获取用户信息失败',
                    icon: 'none'
                });
            }
        },

        // 编辑资料
        editProfile() {
            uni.showToast({
                title: '编辑资料功能开发中',
                icon: 'none'
            });
            // 实际项目中可以：
            // wx.navigateTo({
            //   url: '/pages/edit-profile/edit-profile'
            // });
        },

        // ========== 评价功能 ==========
        // 显示评价弹窗
        showEvaluateModalFun() {
            // 检查是否已经评价过（防重复评价）
            const currentUser = app.globalData.userInfo || uni.getStorageSync('userInfo');
            const currentUserId = (currentUser && (currentUser.user_id || currentUser._id || currentUser.id)) || '';
            if (!currentUser || !currentUserId) {
                uni.showToast({
                    title: '请先登录',
                    icon: 'none'
                });
                return;
            }

            // 检查是否在短时间内已经评价过
            const evaluationHistory = uni.getStorageSync('evaluationHistory') || {};
            const key = `${currentUserId}_${this.userId}`;
            const lastEvaluation = evaluationHistory[key];
            if (lastEvaluation) {
                const now = Date.now();
                const timeDiff = now - lastEvaluation.timestamp;
                const oneDay = 86400 * 1000; // 24小时

                if (timeDiff < oneDay) {
                    uni.showModal({
                        title: '提示',
                        content: '您今天已经评价过该用户，请明天再试',
                        showCancel: false
                    });
                    return;
                }
            }
            this.setData({
                showEvaluateModal: true,
                evaluateForm: {
                    overallScore: 0,
                    trustScore: 0,
                    communicationScore: 0,
                    productScore: 0,
                    content: '',
                    isAnonymous: false
                }
            });
        },

        // 关闭评价弹窗
        closeEvaluateModal() {
            this.setData({
                showEvaluateModal: false
            });
        },

        // 阻止事件冒泡
        stopPropagation() {
            // 空函数，用于阻止事件冒泡
        },

        // 设置综合评分
        setOverallScore(e) {
            const score = e.currentTarget.dataset.score;
            this.setData({
                'evaluateForm.overallScore': score
            });
        },

        // 设置细分维度评分
        setDetailScore(e) {
            const score = e.currentTarget.dataset.score;
            const type = e.currentTarget.dataset.type;
            const key = type === 'trust' ? 'trustScore' : type === 'communication' ? 'communicationScore' : 'productScore';
            this.setData({
                [`evaluateForm.${key}`]: score
            });
        },

        // 输入评价内容
        onEvaluateContentInput(e) {
            this.setData({
                'evaluateForm.content': e.detail.value
            });
        },

        // 切换匿名评价
        toggleAnonymous() {
            this.setData({
                'evaluateForm.isAnonymous': !this.evaluateForm.isAnonymous
            });
        },

        // 提交评价（云对象 reputationCo.submitReview，成功后刷新信誉 Tab）
        async submitEvaluate() {
            const { evaluateForm, userId } = this;
            const scoreNum = Number(evaluateForm.overallScore);
            if (!scoreNum || scoreNum < 1) {
                uni.showToast({
                    title: '请选择综合评分',
                    icon: 'none'
                });
                return;
            }
            const currentUser = app.globalData.userInfo || uni.getStorageSync('userInfo');
            const currentUserId = (currentUser && (currentUser.user_id || currentUser._id || currentUser.id)) || '';
            if (!currentUser || !currentUserId) {
                uni.showToast({
                    title: '请先登录',
                    icon: 'none'
                });
                return;
            }

            uni.showLoading({
                title: '提交中...',
                mask: true
            });

            try {
                await submitUserReview({
                    target_user_id: userId,
                    score: scoreNum,
                    content: (evaluateForm.content || '').trim() || '用户未填写文字评价',
                    is_anonymous: !!evaluateForm.isAnonymous,
                    tags: []
                });

                const evaluationHistory = uni.getStorageSync('evaluationHistory') || {};
                const key = `${currentUserId}_${userId}`;
                evaluationHistory[key] = {
                    timestamp: Date.now(),
                    userId: userId
                };
                uni.setStorageSync('evaluationHistory', evaluationHistory);

                this.setData({
                    showEvaluateModal: false
                });
                await this.loadReputationData();
                uni.showToast({
                    title: '评价提交成功',
                    icon: 'success',
                    duration: 2000
                });
            } catch (e) {
                console.error('submitEvaluate', e);
            } finally {
                uni.hideLoading();
            }
        },

        // ========== 举报功能 ==========
        // 显示举报弹窗
        showReportModalFun() {
            this.setData({
                showReportModal: true,
                reportSubmitting: false,
                reportForm: {
                    selectedCode: '',
                    description: '',
                    images: []
                }
            });
        },

        // 关闭举报弹窗
        closeReportModal() {
            if (this.reportSubmitting) {
                return;
            }
            this.setData({
                showReportModal: false
            });
        },

        onReportOverlayTap() {
            if (this.reportSubmitting) {
                return;
            }
            this.closeReportModal();
        },

        // 选择举报原因（单选）
        selectReportReason(e) {
            const code = e.currentTarget.dataset.code;
            if (!code) {
                return;
            }
            this.setData({
                'reportForm.selectedCode': code
            });
        },

        // 输入举报描述
        onReportDescriptionInput(e) {
            this.setData({
                'reportForm.description': e.detail.value
            });
        },

        // 选择举报图片
        chooseReportImage() {
            const { reportForm } = this;
            if (reportForm.images.length >= 3) {
                uni.showToast({
                    title: '最多上传3张图片',
                    icon: 'none'
                });
                return;
            }
            uni.chooseImage({
                count: 3 - reportForm.images.length,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFilePaths = res.tempFilePaths;
                    this.setData({
                        'reportForm.images': [...reportForm.images, ...tempFilePaths]
                    });
                },
                fail: (err) => {
                    uni.showToast({
                        title: '选择图片失败',
                        icon: 'none'
                    });
                }
            });
        },

        // 删除举报图片
        removeReportImage(e) {
            const index = e.currentTarget.dataset.index;
            const { reportForm } = this;
            const images = [...reportForm.images];
            images.splice(index, 1);
            this.setData({
                'reportForm.images': images
            });
        },

        // 提交举报
        async submitReport() {
            const { reportForm, userId } = this;
            if (!reportForm.selectedCode) {
                uni.showToast({
                    title: '请选择举报原因',
                    icon: 'none'
                });
                return;
            }
            const currentUser = app.globalData.userInfo || uni.getStorageSync('userInfo');
            const currentUserId = (currentUser && (currentUser.user_id || currentUser._id || currentUser.id)) || '';
            if (!currentUser || !currentUserId) {
                uni.showToast({
                    title: '请先登录',
                    icon: 'none'
                });
                return;
            }
            if (this.reportSubmitting) {
                return;
            }

            const reasonItem = this.reportReasons.find((r) => r.code === reportForm.selectedCode);
            const report_reason = reasonItem ? reasonItem.label : '';

            let evidenceUrls = [];
            try {
                this.setData({ reportSubmitting: true });
                uni.showLoading({ title: '提交中...', mask: true });

                if (reportForm.images && reportForm.images.length > 0) {
                    for (let i = 0; i < reportForm.images.length; i++) {
                        const up = await uploadImage(reportForm.images[i]);
                        const url = (up && (up.fileID || up.url)) || '';
                        if (url) {
                            evidenceUrls.push(url);
                        }
                    }
                }

                const reportedName =
                    this.userInfo.username || this.userInfo.companyName || this.userInfo.nickname || '用户';
                const reporterName =
                    currentUser.username || currentUser.nickname || currentUser.companyName || '用户';

                const payload = {
                    reported_user_id: userId,
                    reported_user_name: reportedName,
                    reporter_user_id: currentUserId,
                    reporter_user_name: reporterName,
                    report_reason_code: reportForm.selectedCode,
                    report_reason,
                    report_description: (reportForm.description || '').trim(),
                    page_source: 'user_profile',
                    related_content_id: userId,
                    related_content_type: 'user',
                    evidence_urls: evidenceUrls
                };

                await submitUserReport(payload);

                uni.hideLoading();
                this.setData({
                    reportSubmitting: false,
                    showReportModal: false,
                    reportForm: {
                        selectedCode: '',
                        description: '',
                        images: []
                    }
                });
                uni.showToast({
                    title: '举报已提交',
                    icon: 'success',
                    duration: 2000
                });
            } catch (err) {
                console.error('举报提交失败:', err);
                uni.hideLoading();
                this.setData({ reportSubmitting: false });
                uni.showToast({
                    title: (err && err.message) || '举报提交失败',
                    icon: 'none'
                });
            }
        },

        // 记录用户主页被浏览
        async recordProfileView(userId) {
            try {
                // 检查是否已经记录过（避免重复记录）
                const viewKey = `profile_view_${userId}`;
                const lastViewTime = uni.getStorageSync(viewKey);
                const now = Date.now();
                
                // 如果5分钟内已经记录过，不再重复记录
                if (lastViewTime && (now - lastViewTime) < 5 * 60 * 1000) {
                    return;
                }
                
                // 记录浏览
                await recordProfileView(userId);
                
                // 保存记录时间
                uni.setStorageSync(viewKey, now);
            } catch (error) {
                // 静默失败，不影响用户体验
                console.log('记录浏览失败（不影响使用）:', error);
            }
        }
    }
};
</script>
<style>
@import './user-profile.css';
</style>
