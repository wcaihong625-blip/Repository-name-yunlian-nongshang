// utils/validators.js - 表单验证（与发布页 publish-info 规则一致，供编辑页等复用）

/**
 * 验证供应表单
 * @param {Object} form - 表单数据
 * @returns {Object} - { valid: boolean, errors: Object }
 */
export function validateSupplyForm(form) {
    const errors = {};
    const titleT = (form.title || '').trim();
    if (!titleT) {
        errors.title = '请输入供应标题';
    } else if (titleT.length < 4) {
        errors.title = '标题请写清产品、货量或优势（至少4个字）';
    }

    if (form.categoryIndex === undefined || form.categoryIndex < 0) {
        errors.category = '请选择产品品类';
    }

    const specT = (form.specifications || '').trim();
    if (!specT) {
        errors.specifications = '请填写产品规格';
    } else if (specT.length < 4) {
        errors.specifications = '请补充规格（至少4个字），便于精准匹配';
    }

    if (!form.quantity || !String(form.quantity).trim()) {
        errors.quantity = '请填写供应数量';
    } else if (isNaN(form.quantity) || parseFloat(form.quantity) <= 0) {
        errors.quantity = '请输入有效的数量';
    }

    if (form.unitIndex === undefined || form.unitIndex < 0) {
        errors.quantity = errors.quantity || '请选择单位';
    }

    const priceNegotiable = !!form.price_negotiable;
    if (!priceNegotiable) {
        if (!form.price || !String(form.price).trim()) {
            errors.price = '请填写单价或勾选价格面议';
        } else if (isNaN(form.price) || parseFloat(form.price) <= 0) {
            errors.price = '请输入有效的单价';
        }
    }

    if (!form.location || !String(form.location).trim()) {
        errors.location = '请输入所在地 / 发货地';
    }

    if (!form.images || form.images.length === 0) {
        errors.images = '请上传至少一张产品图片';
    }

    if (!form.description || !String(form.description).trim()) {
        errors.description = '请填写详细描述';
    } else if (String(form.description).trim().length < 15) {
        errors.description = '描述建议不少于15字，补充货源优势与发货说明';
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * 验证采购表单
 * @param {Object} form - 表单数据
 * @returns {Object} - { valid: boolean, errors: Object }
 */
export function validateProcurementForm(form) {
    const errors = {};
    const titleT = (form.title || '').trim();
    if (!titleT) {
        errors.title = '请输入采购标题';
    } else if (titleT.length < 4) {
        errors.title = '标题请写清产品、数量等关键信息（至少4个字）';
    }

    if (form.categoryIndex === undefined || form.categoryIndex < 0) {
        errors.category = '请选择产品品类';
    }

    const specT = (form.specifications || '').trim();
    if (!specT) {
        errors.specifications = '请输入详细规格';
    } else if (specT.length < 4) {
        errors.specifications = '请补充规格要求（至少4个字），减少无效咨询';
    }

    if (!form.quantity || !String(form.quantity).trim()) {
        errors.quantity = '请填写采购数量';
    } else if (isNaN(form.quantity) || parseFloat(form.quantity) <= 0) {
        errors.quantity = '请输入有效的数量';
    }

    if (form.unitIndex === undefined || form.unitIndex < 0) {
        errors.quantity = errors.quantity || '请选择单位';
    }

    const priceNegotiable = !!form.price_negotiable;
    if (!priceNegotiable) {
        if (!form.price || !String(form.price).trim()) {
            errors.price = '请填写期望单价或勾选价格面议';
        } else if (isNaN(form.price) || parseFloat(form.price) <= 0) {
            errors.price = '请输入有效的单价';
        }
    }

    if (!form.address || !String(form.address).trim()) {
        errors.address = '请输入收货地址';
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateSupplyForm,
        validateProcurementForm
    };
}
