<template>
    <!-- pages/privacy/privacy.wxml -->
    <view class="container">
        <view v-if="loading" class="content">
            <text class="paragraph">隐私政策加载中...</text>
        </view>
        <view v-else-if="error" class="content">
            <text class="paragraph">{{ error }}</text>
        </view>
        <view v-else class="content">
            <text class="title">{{ title }}</text>
            <mp-html v-if="content" :content="content" :tag-style="tagStyle"></mp-html>
            <text v-if="updateTimeText" class="update-time">最后更新时间：{{ updateTimeText }}</text>
        </view>

        <view class="button-container">
            <button class="agree-button" @tap="onAgree">我已阅读并同意</button>
        </view>
    </view>
</template>

<script>
// pages/privacy/privacy.js
import mpHtml from '@/uni_modules/mp-html/components/mp-html/mp-html.vue';

const PRIVACY_TITLE = '云链农商隐私政策';

const PRIVACY_CONTENT = `
<p>欢迎您使用“云链农商”产品与服务。我们非常重视您的个人信息和隐私保护。本隐私政策旨在说明我们如何收集、使用、存储、共享和保护您的个人信息，以及您依法享有的相关权利。</p>
<p>请您在使用云链农商服务前，认真阅读并充分理解本隐私政策。</p>
<h3>一、适用范围</h3>
<p>本隐私政策适用于云链农商小程序及相关服务。</p>
<h3>二、我们收集的信息</h3>
<p>根据您使用的具体功能，我们可能收集以下信息：</p>
<p>1. 注册、登录与账号基础信息</p>
<p>微信昵称、头像</p>
<p>手机号</p>
<p>用户账号标识</p>
<p>登录日志、操作记录、设备信息</p>
<p>2. 实名认证与企业认证信息</p>
<p>当您使用实名认证、企业认证功能时，我们可能收集：</p>
<p>姓名</p>
<p>身份证号码</p>
<p>身份证照片</p>
<p>营业执照照片</p>
<p>企业名称、统一社会信用代码、法定代表人等资料</p>
<p>认证审核记录与认证状态</p>
<p>通过OCR识别得到的证件信息</p>
<p>3. 发布与展示信息</p>
<p>当您发布采购、供应、商品、主页等信息时，我们可能收集：</p>
<p>标题、描述、图片、价格、数量、规格、产地、库存</p>
<p>联系人信息</p>
<p>地区、地址、发货地、收货地等展示信息</p>
<p>用户主页、店铺、简介等资料</p>
<p>4. 交易与支付信息</p>
<p>当您购买会员、推广服务或其他增值服务时，我们可能收集：</p>
<p>订单信息</p>
<p>支付状态</p>
<p>订单号、支付流水信息</p>
<p>会员类型、有效期、权益状态</p>
<p>5. 互动与运营数据</p>
<p>为了优化服务和统计效果，我们可能收集：</p>
<p>浏览量</p>
<p>粉丝、关注、收藏、联系等互动记录</p>
<p>发布记录、审核记录</p>
<p>页面访问记录、异常日志、错误日志</p>
<p>6. 设备与技术信息</p>
<p>为了保障服务安全运行，我们可能收集：</p>
<p>设备型号、操作系统、网络状态</p>
<p>IP地址、日志信息</p>
<p>小程序运行环境信息</p>
<p>崩溃日志、性能数据、安全风控信息</p>
<h3>三、我们如何使用您的信息</h3>
<p>我们可能将收集的信息用于以下目的：</p>
<p>为您提供注册、登录、账号管理服务</p>
<p>展示您的采购、供应、商品、主页等内容</p>
<p>完成实名认证、企业认证审核</p>
<p>提供会员服务、推广服务、订单服务</p>
<p>实现联系沟通和客户服务</p>
<p>统计浏览量、互动量和运营效果</p>
<p>进行安全保障、风险识别、异常排查</p>
<p>优化产品功能、改进服务体验</p>
<p>履行法律法规规定的义务</p>
<h3>四、关于OCR、认证与审核</h3>
<p>当您上传身份证、营业执照等资料时，我们可能通过OCR识别技术提取证件中的必要信息，用于自动填充表单、辅助审核和减少手动输入错误。</p>
<p>OCR识别结果仅作为认证处理和资料核验的辅助依据之一，不代表对您身份或资质的绝对保证。</p>
<p>为防范欺诈、冒用身份、虚假认证等风险，我们可能结合人工审核、系统校验、历史记录等方式综合判断。</p>
<h3>五、我们如何共享、转让、公开披露您的信息</h3>
<p>1. 共享</p>
<p>我们不会向无关第三方出售您的个人信息。仅在以下情况下，我们可能共享您的信息：</p>
<p>为实现支付、云存储、消息通知、OCR识别等必要功能，与第三方服务提供方共享必要信息</p>
<p>根据法律法规、监管要求、司法机关或行政机关要求进行提供</p>
<p>在征得您同意的情况下共享</p>
<p>2. 转让</p>
<p>除非获得您的明确授权同意或法律法规另有规定，我们不会将您的个人信息转让给其他公司、组织或个人。</p>
<p>3. 公开披露</p>
<p>除非获得您的明确同意或法律法规另有规定，我们不会公开披露您的个人信息。</p>
<h3>六、我们如何存储和保护您的信息</h3>
<p>我们会采取合理、必要的安全措施保护您的个人信息，防止信息被未经授权访问、公开披露、篡改、丢失或损坏。</p>
<p>我们会通过权限控制、数据脱敏、访问限制、日志审计等方式加强信息安全。</p>
<p>尽管我们会尽力保护您的个人信息，但互联网并非绝对安全环境，请您理解。</p>
<p>我们将在实现服务目的所需的最短期限内保存您的个人信息，法律法规另有规定的除外。</p>
<h3>七、您的权利</h3>
<p>在法律法规规定范围内，您有权：</p>
<p>查询您的个人信息</p>
<p>更正、补充您的个人信息</p>
<p>删除部分个人信息</p>
<p>撤回授权同意</p>
<p>注销账号</p>
<p>获取本隐私政策说明</p>
<p>对个人信息处理提出意见和投诉</p>
<p>如您申请注销账号，在符合法律法规和平台规则的前提下，我们将在核实身份后处理。注销后，除法律法规另有规定外，我们将停止为您提供服务，并删除或匿名化处理相关信息。</p>
<h3>八、未成年人保护</h3>
<p>本平台主要面向具有相应民事行为能力的用户提供服务。未成年人应在监护人同意和指导下使用本平台服务。</p>
<h3>九、第三方服务说明</h3>
<p>为保障相关功能实现，本平台可能接入第三方服务，包括但不限于：</p>
<p>微信登录、微信小程序基础能力</p>
<p>支付服务</p>
<p>云存储、云计算服务</p>
<p>OCR识别服务</p>
<p>消息通知服务</p>
<p>第三方服务由其各自运营方独立提供，您在使用相关功能时，还可能受第三方服务条款和隐私政策约束。</p>
<h3>十、隐私政策更新</h3>
<p>我们可能根据业务变化、法律法规要求更新本隐私政策。更新后，我们将通过合理方式向您提示。更新后的隐私政策一经发布即生效。</p>
<h3>十一、联系我们</h3>
<p>如您对本隐私政策有疑问、意见、建议，或需行使个人信息相关权利，可通过以下方式联系我们：</p>
<p>运营主体：甘肃农鲜通科贸有限公司</p>
<p>联系电话：19223093308</p>
<p>联系邮箱：545881000@qq.com</p>
`;

export default {
    data() {
        return {
            loading: true,
            error: '',
            title: '隐私政策',
            content: '',
            updateTimeText: '',
            tagStyle: {
                p: 'font-size: 26rpx; line-height: 1.75; color: #374151; margin-bottom: 18rpx; text-align: justify;',
                h3: 'font-size: 31rpx; line-height: 1.5; font-weight: 700; color: #1f2937; margin-top: 28rpx; margin-bottom: 14rpx;'
            }
        };
    },
    components: {
        mpHtml
    },
    async onLoad() {
        await this.fetchAgreement();
    },
    methods: {
        async fetchAgreement() {
            this.loading = true;
            this.error = '';
            try {
                this.title = PRIVACY_TITLE;
                this.content = PRIVACY_CONTENT;
                this.updateTimeText = '';
            } catch (e) {
                console.error('加载隐私政策失败:', e);
                this.error = '隐私政策加载失败，请稍后重试';
            } finally {
                this.loading = false;
            }
        },
        // 同意协议按钮点击事件
        onAgree() {
            uni.showToast({
                title: '已同意隐私政策',
                icon: 'success',
                duration: 2000
            });

            // 延迟返回上一页
            setTimeout(() => {
                uni.navigateBack({
                    delta: 1
                });
            }, 1500);
        }
    }
};
</script>
<style>
@import './privacy.css';
</style>
