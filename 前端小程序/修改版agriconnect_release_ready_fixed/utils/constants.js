// utils/constants.js - 常量数据文件（采用 CommonJS 导出，便于在小程序中通过 require 引入）

// 发布/编辑页用的产品品类（不含「全部」）
const PRODUCT_CATEGORIES = ['蔬菜', '水果', '粮油', '干货调料', '蛋禽肉类', '水产', '其他农产品'];

// 采购列表筛选等：「全部」+ 与发布页一致的品类
const PROCUREMENT_CATEGORIES = ['全部'].concat(PRODUCT_CATEGORIES);

// 供应列表筛选：与采购统一口径，便于前后台 category 一致
const SUPPLY_CATEGORIES = PROCUREMENT_CATEGORIES.slice();

// 地区列表（包含所有34个省级行政区）
const REGIONS = [
    '全国',
    '北京',
    '天津',
    '河北',
    '山西',
    '内蒙古',
    '辽宁',
    '吉林',
    '黑龙江',
    '上海',
    '江苏',
    '浙江',
    '安徽',
    '福建',
    '江西',
    '山东',
    '河南',
    '湖北',
    '湖南',
    '广东',
    '广西',
    '海南',
    '重庆',
    '四川',
    '贵州',
    '云南',
    '西藏',
    '陕西',
    '甘肃',
    '青海',
    '宁夏',
    '新疆',
    '台湾',
    '香港',
    '澳门'
];

// 供应页地区：全国、附近（接口侧暂不传 region）+ 各省区市
const SUPPLY_REGIONS = ['全国', '附近'].concat(REGIONS.filter((r) => r !== '全国'));

// ES6 导出（用于 import）
export {
    PRODUCT_CATEGORIES,
    PROCUREMENT_CATEGORIES,
    SUPPLY_CATEGORIES,
    REGIONS,
    SUPPLY_REGIONS
};

// CommonJS 导出（兼容 require，仅在支持 CommonJS 的环境中使用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PRODUCT_CATEGORIES,
        PROCUREMENT_CATEGORIES,
        SUPPLY_CATEGORIES,
        REGIONS,
        SUPPLY_REGIONS
    };
}
