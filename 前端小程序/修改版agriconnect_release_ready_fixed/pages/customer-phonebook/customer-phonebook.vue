<template>
    <!-- pages/customer-phonebook/customer-phonebook.wxml -->
    <view class="phonebook-page">
        <!-- 搜索栏和添加按钮 -->
        <view class="header-section">
            <view class="search-bar">
                <image class="search-icon" src="/static/images/tabbar/magnifier.png" mode="aspectFit"></image>
                <input class="search-input" placeholder="搜索姓名、公司、电话或备注" :value="searchQuery" @input="onSearchInput" confirm-type="search" />
                <view v-if="searchQuery" class="clear-icon" @tap="clearSearch">✕</view>
            </view>
            <view class="add-btn" @tap="showAddContactModal">
                <text class="add-icon">➕</text>
                <text class="add-text">添加</text>
            </view>
        </view>

        <!-- 联系人列表 -->
        <scroll-view class="contacts-list" scroll-y enable-back-to-top>
            <view v-if="filteredContacts.length === 0" class="empty-state">
                <image class="empty-icon" src="/static/images/tabbar/phone.png" mode="aspectFit"></image>
                <text class="empty-text">{{ searchQuery ? '未找到相关联系人' : '暂无联系人' }}</text>
                <text v-if="!searchQuery" class="empty-hint">点击右上角"添加"按钮添加联系人</text>
            </view>

            <view v-else class="contacts-container">
                <view class="contact-group" v-for="(item, index) in filteredContacts" :key="index">
                    <!-- 联系人卡片 -->

                    <view class="contact-card" @tap="goToContactDetail" :data-contact="item">
                        <view class="contact-avatar">
                            <text class="avatar-text">{{ item.avatarText }}</text>
                        </view>

                        <view class="contact-info">
                            <view class="contact-name-row">
                                <text class="contact-name">{{ item.name }}</text>
                                <view v-if="item.source === 'platform'" class="platform-badge">平台</view>
                            </view>

                            <text v-if="item.company" class="contact-company">{{ item.company }}</text>
                            <text class="contact-phone">{{ item.phone }}</text>

                            <view v-if="item.sourceInfo || item.note" class="contact-tags">
                                <text v-if="item.sourceInfo" class="tag source-tag">{{ item.sourceInfo }}</text>
                                <text v-if="item.note" class="tag note-tag">{{ item.note }}</text>
                            </view>
                        </view>

                        <view class="contact-actions">
                            <!-- 主要操作：呼叫按钮（突出显示） -->
                            <view class="action-btn call-btn primary" @tap.stop.prevent="makeCall" :data-contact="item">
                                <image class="action-icon call-icon" src="/static/images/tabbar/phone.png" mode="aspectFit"></image>
                                <text class="action-text">呼叫</text>
                            </view>
                            <!-- 次要操作：更多菜单 -->
                            <view class="action-btn more-btn" @tap.stop.prevent="showActionMenuFun" :data-contact="item">
                                <text class="action-icon">⋯</text>
                            </view>
                        </view>
                    </view>
                </view>
            </view>
        </scroll-view>

        <!-- 添加联系人弹窗 -->
        <view v-if="showAddModal" class="modal-overlay" @tap="closeAddModal">
            <view class="modal-content" @tap.stop.prevent="stopPropagation">
                <view class="modal-header">
                    <text class="modal-title">添加联系人</text>
                    <view class="modal-close" @tap="closeAddModal">✕</view>
                </view>

                <view class="modal-body">
                    <view class="form-item">
                        <text class="form-label">姓名</text>
                        <input
                            class="form-input"
                            placeholder="请输入姓名"
                            :value="addForm.name"
                            data-field="name"
                            @input="onAddFormInput"
                            @focus="onInputFocus"
                            @blur="onInputBlur"
                            :hold-keyboard="true"
                            :adjust-position="true"
                            :cursor-spacing="20"
                        />
                    </view>

                    <view class="form-item">
                        <text class="form-label">电话号码</text>
                        <input
                            class="form-input"
                            type="number"
                            placeholder="请输入手机号码"
                            :value="addForm.phone"
                            data-field="phone"
                            @input="onAddFormInput"
                            @focus="onInputFocus"
                            @blur="onInputBlur"
                            :hold-keyboard="true"
                            :adjust-position="true"
                            :cursor-spacing="20"
                            maxlength="11"
                        />
                    </view>

                    <view class="form-item">
                        <text class="form-label">备注/标签</text>
                        <textarea
                            class="form-textarea"
                            placeholder="请输入备注或标签，如：李经理-钢材供应商（可选）"
                            :value="addForm.note"
                            data-field="note"
                            @input="onAddFormInput"
                            @focus="onInputFocus"
                            @blur="onInputBlur"
                            :hold-keyboard="true"
                            :adjust-position="true"
                            :cursor-spacing="20"
                            maxlength="50"
                            auto-height
                        />
                    </view>
                </view>

                <view class="modal-footer">
                    <button class="modal-btn cancel-btn" @tap="closeAddModal">取消</button>
                    <button class="modal-btn confirm-btn" @tap="submitAddContact">确定</button>
                </view>
            </view>
        </view>

        <!-- 备注编辑弹窗 -->
        <view v-if="showNoteModal" class="modal-overlay" @tap="closeNoteModal">
            <view class="modal-content" @tap.stop.prevent="stopPropagation">
                <view class="modal-header">
                    <text class="modal-title">编辑备注</text>
                    <view class="modal-close" @tap="closeNoteModal">✕</view>
                </view>

                <view class="modal-body">
                    <view class="form-item">
                        <text class="form-label">联系人</text>
                        <input
                            class="form-input"
                            placeholder="请输入联系人姓名"
                            :value="contactName"
                            @input="onContactNameInput"
                            @focus="onInputFocus"
                            @blur="onInputBlur"
                            :hold-keyboard="true"
                            :adjust-position="true"
                            :cursor-spacing="20"
                            maxlength="20"
                        />
                    </view>

                    <view class="form-item">
                        <text class="form-label">电话号码</text>
                        <input
                            class="form-input"
                            type="number"
                            placeholder="请输入手机号码"
                            :value="contactPhone"
                            @input="onContactPhoneInput"
                            @focus="onInputFocus"
                            @blur="onInputBlur"
                            :hold-keyboard="true"
                            :adjust-position="true"
                            :cursor-spacing="20"
                            maxlength="11"
                        />
                    </view>

                    <view class="form-item">
                        <text class="form-label">备注/标签</text>
                        <textarea
                            class="form-textarea"
                            placeholder="请输入备注或标签，如：李经理-钢材供应商"
                            :value="noteText"
                            @input="onNoteInput"
                            @focus="onInputFocus"
                            @blur="onInputBlur"
                            :hold-keyboard="true"
                            :adjust-position="true"
                            :cursor-spacing="20"
                            maxlength="50"
                            auto-height
                        />
                    </view>
                </view>

                <view class="modal-footer">
                    <button class="modal-btn cancel-btn" @tap="closeNoteModal">取消</button>
                    <button class="modal-btn confirm-btn" @tap="saveNote">保存</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
// pages/customer-phonebook/customer-phonebook.js - 客户电话簿页面
import { getCustomerContacts, addManualContact, updateContactNote, deleteContact } from '../../utils/api.js';
import { validatePhone, showError, showSuccess, showLoading, hideLoading } from '../../utils/util.js';
const app = getApp();
export default {
    data() {
        return {
            searchQuery: '',
            // 搜索关键词
            contacts: [],
            // 所有联系人
            filteredContacts: [],
            // 过滤后的联系人
            showAddModal: false,
            // 是否显示添加联系人弹窗
            showNoteModal: false,
            // 是否显示备注编辑弹窗
            showActionMenu: false,
            // 是否显示操作菜单
            currentContact: null,
            // 当前操作的联系人
            addForm: {
                name: '',
                phone: '',
                note: ''
            },
            contactName: '',
            // 编辑的联系人姓名
            contactPhone: '',
            // 编辑的联系人电话
            noteText: '' // 备注文本
        };
    },
    onLoad() {
        this.loadContacts();
    },
    onShow() {
        // 页面显示时刷新联系人列表
        this.loadContacts();
    },
    // 下拉刷新
    onPullDownRefresh() {
        this.loadContacts();
        setTimeout(() => {
            uni.stopPullDownRefresh();
        }, 1000);
    },
    methods: {
        // 加载联系人列表
        async loadContacts() {
            showLoading('加载中...');

            try {
                // 调用API获取联系人列表（包含平台联系人和手动添加的联系人）
                // callCloudFunction 在成功时返回 res.result.data
                const contacts = await getCustomerContacts();
                
                if (Array.isArray(contacts)) {
                    this.processContacts(contacts);
                } else {
                    console.warn('联系人数据格式异常:', contacts);
                    this.processContacts([]);
                }
                hideLoading();
            } catch (err) {
                console.error('加载联系人失败', err);
                hideLoading();
                showError(err.message || '加载失败，请重试');
                // 失败时显示空列表
                this.processContacts([]);
            }
        },


        // 获取名字首字符（用于头像显示）
        getAvatarText(name) {
            if (!name || !name.trim()) {
                return '客';
            }
            // 优先使用名字的第一个字符
            return name.trim().charAt(0);
        },

        // 处理联系人数据（排序、分组、生成首字母索引）
        processContacts(contacts) {
            // 过滤隐藏的联系人（平台联系人可能被用户隐藏）
            const hiddenContacts = uni.getStorageSync('hiddenContacts') || [];
            contacts = contacts.filter((c) => {
                // 平台联系人使用 userId 作为隐藏标识，手动联系人使用 id
                const hideKey = c.source === 'platform' ? c.userId : c.id;
                return !hiddenContacts.includes(hideKey);
            });

            // 为每个联系人生成首字母和头像文字
            contacts.forEach((contact) => {
                // 确保有必要的字段
                if (!contact.name) {
                    contact.name = '未知联系人';
                }
                if (!contact.phone) {
                    contact.phone = '';
                }
                
                const firstChar = this.getFirstLetter(contact.name);
                contact.firstLetter = firstChar;
                // 生成头像显示文字
                contact.avatarText = this.getAvatarText(contact.name);
            });

            // 按首字母排序
            contacts.sort((a, b) => {
                if (a.firstLetter !== b.firstLetter) {
                    return a.firstLetter.localeCompare(b.firstLetter, 'zh-CN');
                }
                return a.name.localeCompare(b.name, 'zh-CN');
            });
            this.setData({
                contacts: contacts,
                filteredContacts: contacts
            });
            this.filterContacts();
        },

        // 获取中文首字母
        getFirstLetter(str) {
            if (!str) {
                return '#';
            }
            const firstChar = str.charAt(0);

            // 如果是英文字母
            if (/[a-zA-Z]/.test(firstChar)) {
                return firstChar.toUpperCase();
            }

            // 如果是数字
            if (/[0-9]/.test(firstChar)) {
                return '#';
            }

            // 如果是中文，使用拼音首字母（简化版，实际应使用拼音库）
            // 这里使用Unicode范围判断，实际项目中应使用pinyin库
            const code = firstChar.charCodeAt(0);
            if (code >= 19968 && code <= 40869) {
                // 中文Unicode范围，这里简化处理，实际应使用拼音库
                // 暂时返回第一个字符
                return firstChar;
            }
            return '#';
        },

        // 搜索过滤
        onSearchInput(e) {
            const query = e.detail.value;
            this.setData({
                searchQuery: query
            });
            this.filterContacts();
        },

        // 过滤联系人
        filterContacts() {
            const { searchQuery, contacts } = this;
            if (!searchQuery.trim()) {
                this.setData({
                    filteredContacts: contacts
                });
                return;
            }
            const query = searchQuery.toLowerCase();
            const filtered = contacts.filter((contact) => {
                // 搜索姓名
                if (contact.name.toLowerCase().includes(query)) {
                    return true;
                }
                // 搜索公司名
                if (contact.company && contact.company.toLowerCase().includes(query)) {
                    return true;
                }
                // 搜索手机号
                if (contact.phone.includes(query)) {
                    return true;
                }
                // 搜索备注
                if (contact.note && contact.note.toLowerCase().includes(query)) {
                    return true;
                }
                return false;
            });
            this.setData({
                filteredContacts: filtered
            });
        },

        // 清空搜索
        clearSearch() {
            this.setData({
                searchQuery: ''
            });
            this.filterContacts();
        },

        // 显示添加联系人弹窗
        showAddContactModal() {
            this.setData({
                showAddModal: true,
                addForm: {
                    name: '',
                    phone: '',
                    note: ''
                }
            });
        },

        // 关闭添加联系人弹窗
        closeAddModal() {
            this.setData({
                showAddModal: false
            });
        },

        // 阻止事件冒泡（防止点击输入框时关闭弹窗）
        stopPropagation(e) {
            // 空函数，仅用于阻止事件冒泡
        },

        // 输入框获得焦点
        onInputFocus(e) {
            // 确保弹窗保持显示状态
            // 不执行任何可能关闭弹窗的操作
        },

        // 输入框失去焦点
        onInputBlur(e) {
            // 不执行任何可能关闭弹窗的操作
        },

        // 添加联系人表单输入
        onAddFormInput(e) {
            const field = e.currentTarget.dataset.field;
            const value = e.detail.value;
            this.setData({
                [`addForm.${field}`]: value
            });
        },

        // 提交添加联系人
        async submitAddContact() {
            const { name, phone, note } = this.addForm;
            if (!name.trim()) {
                showError('请输入姓名');
                return;
            }
            if (!phone.trim()) {
                showError('请输入电话号码');
                return;
            }

            // 验证手机号格式
            if (!validatePhone(phone)) {
                showError('请输入正确的手机号码');
                return;
            }

            // 检查是否已存在
            const exists = this.contacts.find((c) => c.phone === phone);
            if (exists) {
                showError('该联系人已存在');
                return;
            }
            showLoading('添加中...');

            try {
                // 调用API添加联系人
                await addManualContact({ 
                    name: name.trim(), 
                    phone: phone.trim(), 
                    note: note.trim() || '' 
                });
                
                hideLoading();
                showSuccess('添加成功');
                this.closeAddModal();
                this.loadContacts();
            } catch (err) {
                console.error('添加联系人失败', err);
                hideLoading();
                showError(err.message || '添加失败，请重试');
            }
        },

        // 显示操作菜单
        showActionMenuFun(e) {
            const contact = e.currentTarget.dataset.contact;
            if (!contact) {
                return;
            }
            const actionItems = [
                {
                    text: '编辑备注',
                    icon: '📝',
                    action: 'note'
                },
                {
                    text: contact.source === 'manual' ? '删除联系人' : '移除联系人',
                    icon: '🗑️',
                    action: 'delete',
                    danger: true
                }
            ];
            uni.showActionSheet({
                itemList: actionItems.map((item) => item.text),
                success: (res) => {
                    const selectedAction = actionItems[res.tapIndex].action;
                    if (selectedAction === 'note') {
                        this.showNoteModalFun({
                            currentTarget: {
                                dataset: {
                                    contact
                                }
                            }
                        });
                    } else if (selectedAction === 'delete') {
                        this.deleteContact({
                            currentTarget: {
                                dataset: {
                                    contact
                                }
                            }
                        });
                    }
                }
            });
        },

        // 显示备注编辑弹窗
        showNoteModalFun(e) {
            const contact = e.currentTarget.dataset.contact;
            // 平台联系人和手动联系人都可以编辑
            this.setData({
                showNoteModal: true,
                currentContact: contact,
                contactName: contact.name || '',
                contactPhone: contact.phone || '',
                noteText: contact.note || ''
            });
        },

        // 关闭备注编辑弹窗
        closeNoteModal() {
            this.setData({
                showNoteModal: false
            });
        },

        // 联系人姓名输入
        onContactNameInput(e) {
            // 只更新数据，不关闭弹窗
            this.setData({
                contactName: e.detail.value
            });
        },

        // 联系人电话输入
        onContactPhoneInput(e) {
            // 只更新数据，不关闭弹窗
            this.setData({
                contactPhone: e.detail.value
            });
        },

        // 备注输入
        onNoteInput(e) {
            // 只更新数据，不关闭弹窗
            this.setData({
                noteText: e.detail.value
            });
        },

        // 保存备注、联系人姓名和电话
        async saveNote() {
            const { currentContact, contactName, contactPhone, noteText } = this;
            if (!currentContact) {
                showError('联系人信息不存在');
                return;
            }

            // 验证联系人姓名
            if (!contactName.trim()) {
                showError('请输入联系人姓名');
                return;
            }

            // 验证电话号码（平台联系人可能没有电话，允许为空）
            if (contactPhone.trim() && !validatePhone(contactPhone)) {
                showError('请输入正确的手机号码');
                return;
            }
            
            showLoading('保存中...');

            try {
                // 调用API更新联系人信息
                // 平台联系人使用 platformUserId，手动联系人使用 contactId
                const updateData = {
                    name: contactName.trim(),
                    phone: contactPhone.trim(),
                    note: noteText.trim()
                };
                
                if (currentContact.source === 'platform') {
                    // 平台联系人：传递 platformUserId（使用 userId 字段）
                    // 验证 userId 是否存在且有效
                    const platformUserId = currentContact.userId || currentContact.id;
                    if (!platformUserId || typeof platformUserId !== 'string' || !platformUserId.trim()) {
                        console.error('平台联系人 userId 无效:', currentContact);
                        hideLoading();
                        showError('联系人信息错误，无法更新');
                        return;
                    }
                    
                    updateData.platformUserId = platformUserId.trim();
                    console.log('更新平台联系人，platformUserId:', updateData.platformUserId);
                    // 平台联系人不需要 contactId，传递 null
                    await updateContactNote(null, updateData);
                } else {
                    // 手动联系人：传递 contactId
                    if (!currentContact.id) {
                        console.error('手动联系人 id 不存在:', currentContact);
                        hideLoading();
                        showError('联系人信息错误，无法更新');
                        return;
                    }
                    
                    updateData.contactId = currentContact.id;
                    console.log('更新手动联系人，contactId:', updateData.contactId);
                    await updateContactNote(currentContact.id, updateData);
                }
                
                hideLoading();
                showSuccess('保存成功');
                this.closeNoteModal();
                this.loadContacts();
            } catch (err) {
                console.error('保存联系人失败', err);
                hideLoading();
                showError(err.message || '保存失败，请重试');
            }
        },

        // 一键呼叫
        makeCall(e) {
            const contact = e.currentTarget.dataset.contact;
            if (!contact || !contact.phone) {
                showError('电话号码不存在');
                return;
            }

            // 显示确认提示
            const phoneLast4 = contact.phone.slice(-4);
            uni.showModal({
                title: '确认呼叫',
                content: `即将为您呼叫 ${contact.name}\n号码：****${phoneLast4}`,
                confirmText: '呼叫',
                confirmColor: '#16a34a',
                success: (res) => {
                    if (res.confirm) {
                        uni.makePhoneCall({
                            phoneNumber: contact.phone,
                            fail: (err) => {
                                console.error('拨打电话失败', err);
                                showError('拨打电话失败');
                            }
                        });
                    }
                }
            });
        },

        // 点击联系人卡片（跳转到用户主页或聊天）
        goToContactDetail(e) {
            const contact = e.currentTarget.dataset.contact;
            if (!contact) {
                return;
            }

            // 如果是平台用户，跳转到用户主页
            if (contact.source === 'platform' && contact.userId) {
                uni.navigateTo({
                    url: `/pages/user-profile/user-profile?userId=${contact.userId}`
                });
            }
            // 手动添加的联系人，点击卡片不执行任何操作
        },

        // 左滑删除/移除
        deleteContact(e) {
            const contact = e.currentTarget.dataset.contact;
            if (!contact) {
                return;
            }
            const action = contact.source === 'manual' ? '删除' : '移除';
            uni.showModal({
                title: '确认' + action,
                content: `确定要${action}联系人"${contact.name}"吗？`,
                confirmText: action,
                confirmColor: '#ef4444',
                success: async (res) => {
                    if (!res.confirm) {
                        return;
                    }
                    showLoading(`${action}中...`);

                    try {
                        // 如果是平台联系人，只能在前端隐藏（不影响原始用户数据）
                        if (contact.source === 'platform') {
                            hideLoading();
                            // 平台联系人不能通过API删除，只能在前端隐藏
                            // 使用 userId 作为隐藏标识
                            const hiddenContacts = uni.getStorageSync('hiddenContacts') || [];
                            const hideKey = contact.userId || contact.id;
                            if (!hiddenContacts.includes(hideKey)) {
                                hiddenContacts.push(hideKey);
                                uni.setStorageSync('hiddenContacts', hiddenContacts);
                            }
                            showSuccess('已移除');
                            this.loadContacts();
                            return;
                        }

                        // 调用API删除手动添加的联系人
                        await deleteContact(contact.id);
                        
                        hideLoading();
                        showSuccess(`${action}成功`);
                        this.loadContacts();
                    } catch (err) {
                        console.error(`${action}联系人失败`, err);
                        hideLoading();
                        showError(err.message || `${action}失败，请重试`);
                    }
                }
            });
        }
    }
};
</script>
<style>
@import './customer-phonebook.css';
</style>
