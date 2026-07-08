'use strict';

exports.main = async (event, context) => {
  const db = uniCloud.database();

  try {
    // 统一只使用一个集合：ymt_origin_price
    const originColl = db.collection('ymt_origin_price');

    // 入参
    const {
      type = 'origin',   // 'origin' | 'wholesale' | 'forecast'
      search,            // 前端传的搜索关键字/子分类，例如 "土豆"、"苹果"
      name,
      productName
    } = event || {};

    console.log('[getMarketTrends] 调用参数:', JSON.stringify({ type, search, name, productName }));

    // 计算今天字符串（注意 uniCloud 是 UTC，需要加 8 小时变成北京时间）
    const now = Date.now() + 8 * 60 * 60 * 1000;
    const todayDate = new Date(now);
    const yyyy = todayDate.getFullYear();
    const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(todayDate.getDate()).padStart(2, '0');
    let todayStr = `${yyyy}-${mm}-${dd}`;

    console.log('[getMarketTrends] 查询日期（今天）:', todayStr);

    // 构造关键字
    const keyword = (search || productName || name || '').trim();
    const hasKeyword = !!keyword;

    // 基础 where：按日期
    const where = { date: todayStr };

    // 根据 type 添加 location 过滤逻辑
    if (type === 'origin') {
      // 产地行情：排除包含"批发市场"的记录，保留产地类（包含"县"、"市"、"镇"、"村"等）
      // 使用 $and 和 $or 组合：不包含"批发市场"，且包含"县"或"市"或"镇"或"村"
      // 注意：uniCloud 数据库查询不支持复杂的正则组合，需要先查询再过滤
      console.log('[getMarketTrends] origin 模式：排除批发市场，保留产地类');
    } else if (type === 'wholesale') {
      // 批发市场行情：只保留 location 包含"批发市场"或"市场"的记录
      where.location = new RegExp('批发市场|市场', 'i');
      console.log('[getMarketTrends] wholesale 模式：只查询 location 包含"批发市场"或"市场"的记录');
    } else if (type === 'forecast') {
      // 行情分析：优先返回 isAnalysis === true 的记录
      where.isAnalysis = true;
      console.log('[getMarketTrends] forecast 模式：只查询 isAnalysis = true 的记录');
    }

    // 如果有关键字，就用 name 做模糊匹配
    if (hasKeyword) {
      where.name = new RegExp(keyword, 'i');
      console.log('[getMarketTrends] 使用关键字过滤:', keyword);
    }

    console.log('[getMarketTrends] 查询条件:', JSON.stringify(where));

    // 查询数据库（先查询今天的数据）
    let dbRes = await originColl.where(where).limit(500).get();
    let rows = dbRes.data || [];
    console.log('[getMarketTrends] 查询结果数量（今天）:', rows.length);
    
    // 对于 origin 类型，需要在内存中过滤掉包含"批发市场"的记录
    if (type === 'origin' && rows.length > 0) {
      const originKeywords = ['县', '市', '镇', '村', '区', '省', '自治区', '自治州'];
      rows = rows.filter(item => {
        const location = (item.location || '').toString();
        // 排除包含"批发市场"的记录
        if (location.includes('批发市场') || location.includes('市场')) {
          return false;
        }
        // 保留包含产地关键词的记录
        return originKeywords.some(keyword => location.includes(keyword));
      });
      console.log('[getMarketTrends] origin 模式过滤后数量:', rows.length);
    }
    
    // 如果今天没有数据，尝试查询最近7天的数据（回退方案）
    if (rows.length === 0) {
      console.warn('[getMarketTrends] 今天没有数据，尝试查询最近7天的数据');
      
      // 生成最近7天的日期列表
      const recentDays = [];
      for (let i = 1; i <= 7; i++) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const yyyy2 = date.getFullYear();
        const mm2 = String(date.getMonth() + 1).padStart(2, '0');
        const dd2 = String(date.getDate()).padStart(2, '0');
        recentDays.push(`${yyyy2}-${mm2}-${dd2}`);
      }
      console.log('[getMarketTrends] 尝试查询最近7天日期:', recentDays);
      
      // 尝试查询最近7天的数据
      for (const dateStr of recentDays) {
        const fallbackWhere = { date: dateStr };
        
        // 根据 type 添加过滤条件
        if (type === 'wholesale') {
          fallbackWhere.location = new RegExp('批发市场|市场', 'i');
        } else if (type === 'forecast') {
          fallbackWhere.isAnalysis = true;
        }
        
        if (hasKeyword) {
          fallbackWhere.name = new RegExp(keyword, 'i');
        }
        
        const fallbackRes = await originColl.where(fallbackWhere).limit(500).get();
        let fallbackRows = fallbackRes.data || [];
        
        // 对于 origin 类型，需要在内存中过滤
        if (type === 'origin' && fallbackRows.length > 0) {
          const originKeywords = ['县', '市', '镇', '村', '区', '省', '自治区', '自治州'];
          fallbackRows = fallbackRows.filter(item => {
            const location = (item.location || '').toString();
            if (location.includes('批发市场') || location.includes('市场')) {
              return false;
            }
            return originKeywords.some(keyword => location.includes(keyword));
          });
        }
        
        if (fallbackRows.length > 0) {
          console.log(`[getMarketTrends] 在日期 ${dateStr} 找到 ${fallbackRows.length} 条数据`);
          rows = fallbackRows;
          todayStr = dateStr;
          break;
        }
      }
      
      if (rows.length === 0) {
        console.warn('[getMarketTrends] 最近7天也没有数据！type:', type, '关键字:', keyword || '无');
      }
    }
    
    if (rows.length > 0) {
      console.log('[getMarketTrends] 第一条数据示例:', JSON.stringify(rows[0]));
    }

    // 清理 display_text 中的"点击查看更多>>"等字眼
    const cleanDisplayText = (text) => {
      if (!text || typeof text !== 'string') return '';
      return text
        // 去掉末尾的"点击查看更多>>""点击查看更多>""点击查看更多＞＞"等变体
        .replace(/\s*点击查看更多[>＞»]*\s*$/g, '')
        .replace(/\s*查看更多[>＞»]*\s*$/g, '')
        .replace(/\s*点击查看[>＞»]*\s*$/g, '')
        .trim();
    };

    // 标准化返回给前端的字段
    const products = rows.map(doc => {
      return {
        // 商品名称
        name: doc.name || '',
        // 品类
        category: doc.category || '',
        // 地区 / 市场名
        location: doc.location || doc.region || doc.marketName || '',
        // 价格（字符串或数字都接受）
        price: doc.price,
        unit: doc.unit || '元/斤',
        date: doc.date,
        change: doc.change || 0,
        // 清理后的展示文字
        display_text: cleanDisplayText(doc.display_text || ''),
        isAnalysis: !!doc.isAnalysis,
        // 兼容字段：region、marketName（用于前端兼容）
        region: doc.region || doc.location || doc.marketName || '',
        marketName: doc.marketName || doc.location || ''
      };
    });

    const result = {
      code: 0,
      msg: 'ok',
      type,
      meta: {
        updateDate: todayStr,
        total: products.length
      },
      products
    };

    console.log('[getMarketTrends] 返回结果:', { 
      type, 
      todayStr, 
      count: products.length,
      sample: products.length > 0 ? { 
        name: products[0].name, 
        location: products[0].location,
        category: products[0].category
      } : null
    });

    return result;

  } catch (error) {
    console.error('[getMarketTrends] 执行出错:', error);
    return {
      code: -1,
      msg: error.message || '查询失败',
      type: event?.type || 'origin',
      meta: {
        updateDate: '',
        total: 0
      },
      products: []
    };
  }
};
