'use strict';

const createConfig = require('uni-config-center');
const { verifyToken } = require('nxt-auth');

let cachedAccessToken = '';
let cachedAccessTokenExpireAt = 0;

function res(code, message, data) {
  return { code, message, data: data || null };
}

function safeText(value) {
  return value == null ? '' : String(value).trim();
}

function toFormUrlEncoded(data = {}) {
  return Object.keys(data)
    .filter((key) => data[key] !== undefined && data[key] !== null)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(data[key]))}`)
    .join('&');
}

function getWordValue(wordsResult, key) {
  const row = wordsResult && wordsResult[key];
  if (!row) return '';
  if (typeof row === 'string') return row.trim();
  return safeText(row.words);
}

function normalizeDateText(raw) {
  const value = safeText(raw);
  if (!value) return '';
  if (value === '长期') return '长期';
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value.replace(/(\d{4})(\d{2})(\d{2})/g, '$1-$2-$3');
}

function parseIdCardValidDate(raw) {
  const value = safeText(raw).replace(/\s/g, '');
  if (!value) {
    return { validDate: '', validFrom: '', validTo: '' };
  }
  if (value === '长期') {
    return { validDate: '长期', validFrom: '', validTo: '长期' };
  }
  const parts = value.split(/[-至]/);
  const validFrom = normalizeDateText(parts[0] || '');
  const validTo = normalizeDateText(parts[1] || '');
  return {
    validDate: validTo ? `${validFrom}-${validTo}` : normalizeDateText(value),
    validFrom,
    validTo
  };
}

function summarizeIdCardQuality(raw) {
  const imageStatus = raw && raw.image_status ? raw.image_status : '';
  const messages = [];
  if (imageStatus && imageStatus !== 'normal') {
    messages.push('身份证照片可能存在模糊、反光、遮挡或缺角，请核对后视情况重拍');
  }
  return {
    ok: imageStatus === '' || imageStatus === 'normal',
    imageStatus,
    messages
  };
}

function summarizeBusinessQuality(raw) {
  const messages = [];
  const riskType = safeText(raw && raw.risk_type);
  if (riskType) {
    messages.push('营业执照照片可能存在风险，请核对图片是否清晰完整');
  }
  return {
    ok: !riskType,
    imageStatus: riskType,
    messages
  };
}

function summarizeRisk(raw) {
  return {
    type: safeText(raw && raw.risk_type),
    warning: safeText(raw && raw.risk_warn),
    messages: [safeText(raw && raw.risk_warn)].filter(Boolean)
  };
}

function getBaiduOcrConfig() {
  const configCenter = createConfig({ pluginId: 'baidu-ocr' });
  const cfg = typeof configCenter.config === 'function' ? configCenter.config() : {};
  const config = cfg || {};
  if (!safeText(config.apiKey) || !safeText(config.secretKey)) {
    throw new Error('百度OCR配置缺失，请先在 uni-config-center/baidu-ocr/config.json 中填写 apiKey 和 secretKey');
  }
  if (!safeText(config.tokenUrl) || !safeText(config.idcardUrl) || !safeText(config.businessLicenseUrl)) {
    throw new Error('百度OCR接口地址配置不完整');
  }
  return config;
}

async function getBaiduAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessTokenExpireAt > now) {
    return cachedAccessToken;
  }
  const config = getBaiduOcrConfig();
  const tokenRes = await uniCloud.httpclient.request(config.tokenUrl, {
    method: 'POST',
    dataType: 'json',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: toFormUrlEncoded({
      grant_type: 'client_credentials',
      client_id: config.apiKey,
      client_secret: config.secretKey
    })
  });
  const data = tokenRes.data || {};
  const accessToken = safeText(data.access_token);
  const expiresIn = Number(data.expires_in || 0);
  if (!accessToken) {
    throw new Error(data.error_description || data.error_msg || '获取百度OCR access_token 失败');
  }
  cachedAccessToken = accessToken;
  cachedAccessTokenExpireAt = now + Math.max(0, expiresIn - 300) * 1000;
  return cachedAccessToken;
}

async function getFileBufferFromCloud(fileId) {
  const tempUrl = await getTempFileUrlFromCloud(fileId);
  const fileRes = await uniCloud.httpclient.request(tempUrl, {
    method: 'GET',
    responseType: 'arraybuffer'
  });
  const rawData = fileRes.data;
  if (!rawData) {
    throw new Error('下载云存储文件失败');
  }
  if (Buffer.isBuffer(rawData)) {
    return rawData;
  }
  if (rawData instanceof ArrayBuffer) {
    return Buffer.from(rawData);
  }
  if (ArrayBuffer.isView(rawData)) {
    return Buffer.from(rawData.buffer, rawData.byteOffset, rawData.byteLength);
  }
  return Buffer.from(rawData);
}

async function getTempFileUrlFromCloud(fileId) {
  const safeFileId = safeText(fileId);
  if (!safeFileId) {
    throw new Error('fileId不能为空');
  }
  const tempRes = await uniCloud.getTempFileURL({
    fileList: [safeFileId]
  });
  const tempInfo = tempRes.fileList && tempRes.fileList[0];
  const tempUrl = tempInfo && (tempInfo.tempFileURL || tempInfo.download_url || tempInfo.tempFileUrl);
  if (!tempUrl) {
    throw new Error('获取云存储临时地址失败');
  }
  return tempUrl;
}

function bufferToBase64(buffer) {
  if (!buffer || !buffer.length) {
    throw new Error('图片内容为空');
  }
  return buffer.toString('base64');
}

async function recognizeIdCard({ imageBase64, imageUrl, side }) {
  const normalizedSide = side === 'back' ? 'back' : 'front';
  const token = await getBaiduAccessToken();
  const config = getBaiduOcrConfig();
  const url = `${config.idcardUrl}?access_token=${encodeURIComponent(token)}`;
  const payload = {
    id_card_side: normalizedSide,
    detect_risk: 'true',
    detect_quality: 'true',
    detect_direction: 'true'
  };
  if (safeText(imageUrl)) {
    payload.url = imageUrl;
  } else {
    payload.image = imageBase64;
  }
  const response = await uniCloud.httpclient.request(url, {
    method: 'POST',
    dataType: 'json',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: toFormUrlEncoded(payload)
  });
  const raw = response.data || {};
  if (raw.error_code) {
    throw new Error(raw.error_msg || '身份证识别失败');
  }
  return raw;
}

async function recognizeBusinessLicense({ imageBase64, imageUrl }) {
  const token = await getBaiduAccessToken();
  const config = getBaiduOcrConfig();
  const url = `${config.businessLicenseUrl}?access_token=${encodeURIComponent(token)}`;
  const payload = {
    detect_quality: 'true',
    risk_warn: 'true'
  };
  if (safeText(imageUrl)) {
    payload.url = imageUrl;
  } else {
    payload.image = imageBase64;
  }
  const response = await uniCloud.httpclient.request(url, {
    method: 'POST',
    dataType: 'json',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: toFormUrlEncoded(payload)
  });
  const raw = response.data || {};
  if (raw.error_code) {
    throw new Error(raw.error_msg || '营业执照识别失败');
  }
  return raw;
}

function normalizeIdCardResult(raw, side) {
  const wordsResult = raw && raw.words_result ? raw.words_result : {};
  if (side === 'back') {
    const parsedDate = parseIdCardValidDate(getWordValue(wordsResult, '失效日期'));
    return {
      parsed: {
        issueAuthority: getWordValue(wordsResult, '签发机关'),
        validDate: parsedDate.validDate,
        validFrom: parsedDate.validFrom,
        validTo: parsedDate.validTo
      },
      quality: summarizeIdCardQuality(raw),
      risk: summarizeRisk(raw)
    };
  }
  return {
    parsed: {
      name: getWordValue(wordsResult, '姓名'),
      idCardNumber: getWordValue(wordsResult, '公民身份号码'),
      gender: getWordValue(wordsResult, '性别'),
      nation: getWordValue(wordsResult, '民族'),
      birthday: normalizeDateText(getWordValue(wordsResult, '出生')),
      address: getWordValue(wordsResult, '住址')
    },
    quality: summarizeIdCardQuality(raw),
    risk: summarizeRisk(raw)
  };
}

function normalizeBusinessLicenseResult(raw) {
  const wordsResult = raw && raw.words_result ? raw.words_result : {};
  return {
    parsed: {
      companyName: getWordValue(wordsResult, '单位名称') || getWordValue(wordsResult, '企业名称'),
      creditCode: getWordValue(wordsResult, '社会信用代码'),
      legalPerson: getWordValue(wordsResult, '法人'),
      companyType: getWordValue(wordsResult, '类型'),
      address: getWordValue(wordsResult, '地址'),
      establishDate: normalizeDateText(getWordValue(wordsResult, '成立日期')),
      validPeriod: getWordValue(wordsResult, '有效期'),
      businessScope: getWordValue(wordsResult, '经营范围'),
      licenseNumber: getWordValue(wordsResult, '证照编号')
    },
    quality: summarizeBusinessQuality(raw),
    risk: summarizeRisk(raw)
  };
}

exports.main = async (event, context) => {
  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '未登录，请先登录');
    }

    const scene = safeText(event.scene);
    const docType = safeText(event.docType);
    const fileId = safeText(event.fileId);
    if (!scene || !docType || !fileId) {
      return res(400, '参数错误：scene、docType、fileId 不能为空');
    }

    const imageUrl = await getTempFileUrlFromCloud(fileId);

    if (scene === 'realname' && (docType === 'idcard_front' || docType === 'idcard_back')) {
      const side = docType === 'idcard_back' ? 'back' : 'front';
      let raw;
      try {
        raw = await recognizeIdCard({ imageUrl, side });
      } catch (err) {
        if (!String(err.message || '').includes('image format error')) {
          throw err;
        }
        const buffer = await getFileBufferFromCloud(fileId);
        const imageBase64 = bufferToBase64(buffer);
        raw = await recognizeIdCard({ imageBase64, side });
      }
      const normalized = normalizeIdCardResult(raw, side);
      return res(200, '识别成功', {
        ok: true,
        scene,
        docType,
        parsed: normalized.parsed,
        quality: normalized.quality,
        risk: normalized.risk,
        raw
      });
    }

    if (scene === 'enterprise' && docType === 'business_license') {
      let raw;
      try {
        raw = await recognizeBusinessLicense({ imageUrl });
      } catch (err) {
        if (!String(err.message || '').includes('image format error')) {
          throw err;
        }
        const buffer = await getFileBufferFromCloud(fileId);
        const imageBase64 = bufferToBase64(buffer);
        raw = await recognizeBusinessLicense({ imageBase64 });
      }
      const normalized = normalizeBusinessLicenseResult(raw);
      return res(200, '识别成功', {
        ok: true,
        scene,
        docType,
        parsed: normalized.parsed,
        quality: normalized.quality,
        risk: normalized.risk,
        raw
      });
    }

    return res(400, '不支持的识别场景或证件类型');
  } catch (err) {
    console.error('recognizeAuthOcr error:', err && err.message ? err.message : err);
    return res(500, err.message || 'OCR识别失败，请稍后重试', {
      ok: false
    });
  }
};
