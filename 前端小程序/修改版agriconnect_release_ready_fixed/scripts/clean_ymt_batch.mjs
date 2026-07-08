/**
 * 说明：
 * 你的仓库里没有找到你提到的 clean_ymt_batch.mjs / parseMarkdownToProducts()，
 * 这里提供一个“可直接迁移到爬虫仓库”的参考实现：在解析产地/市场明细行之外，
 * 额外提取“行情分析长段落”，并生成一条 isAnalysis=true 的记录，供服务器端 ETL / 正式发布链路消费（不再依赖旧云函数 uploadYmtData）。
 *
 * 你可以把 parseMarkdownToProducts() 按需复制进你真实的爬虫脚本中。
 */

function stripTailMore(text) {
  if (!text) return '';
  return String(text)
    .replace(/\s*点击查看更多[>＞»]*\s*$/g, '')
    .replace(/\s*查看更多[>＞»]*\s*$/g, '')
    .trim();
}

function scoreAnalysisParagraph(p) {
  const s = String(p || '').trim();
  if (!s) return 0;
  const keywords = [
    '价格行情', '行情分析', '预计', '受', '短期', '趋势', '先扬后抑', '先涨后跌', '点击查看更多', '查看更多'
  ];
  let score = 0;
  for (const k of keywords) {
    if (s.includes(k)) score += 10;
  }
  // 长段落优先
  score += Math.min(200, s.length);
  return score;
}

/**
 * 从 markdown 中提取“分析段落”：
 * - 优先选择包含关键词的最长一段（综合评分最高）
 * - 清理末尾“点击查看更多>>”
 */
export function extractAnalysisParagraph(markdown) {
  if (!markdown) return '';
  const lines = String(markdown)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  // 以空行/标题/列表分隔近似段落
  const paragraphs = [];
  let buf = [];
  const flush = () => {
    if (buf.length) {
      paragraphs.push(buf.join(' '));
      buf = [];
    }
  };

  for (const line of lines) {
    // 遇到表格/分割线/代码块等可视为段落边界（按你实际 markdown 可再扩展）
    const isDivider = /^(-{3,}|\*{3,}|#{1,6}\s+)/.test(line);
    if (isDivider) {
      flush();
      continue;
    }
    buf.push(line);
  }
  flush();

  const cleaned = paragraphs
    .map(stripTailMore)
    .filter(p => p.length >= 20); // 太短的不认为是长文案

  let best = '';
  let bestScore = 0;
  for (const p of cleaned) {
    const sc = scoreAnalysisParagraph(p);
    if (sc > bestScore) {
      bestScore = sc;
      best = p;
    }
  }
  return best;
}

/**
 * 参考：把 markdown 解析为 products。
 * - priceRecords：你原本解析出来的 chandi_detail / shichang_detail 等价格行（此处用入参传入）
 * - 新增：analysis 记录（isAnalysis=true, data_type='analysis'）
 */
export function parseMarkdownToProducts({ markdown, name, date, priceRecords = [] }) {
  const analysisText = extractAnalysisParagraph(markdown);
  const analysisRecord = analysisText
    ? [{
      isAnalysis: true,
      data_type: 'analysis',
      name: name || '',
      date: date || '',
      display_text: analysisText,
      raw_line: analysisText
    }]
    : [];

  // 注意：analysisRecord 不应参与 price<=0 过滤，所以在你原脚本里要把它单独分流上传
  // 例如：在爬虫侧把 analysisRecord 单独分流进你的 pipeline 输出（勿再走已下线的云端直传接口）
  return {
    priceRecords,
    analysisRecord
  };
}




