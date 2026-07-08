const fs = require('fs');
const path = require('path');

const adminDir = "C:\\Users\\Administrator\\Desktop\\XIAOPU\\软件测试\\农鲜通后端管理平台\\农鲜通后台管理平台\\uniCloud-aliyun\\cloudfunctions";

const targets = [
  "auditCustomerTransferApply",
  "createCustomerTransferApply",
  "exportCustomerProfileData",
  "exportMemberOrderData"
];

for (const folder of targets) {
  const file = path.join(adminDir, folder, 'index.js');
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. replace require
    content = content.replace(/const uniID = require\('uni-id-common'\);?/g, "const { verifyToken } = require('./common/authHelper');");
    
    // 2. remove createInstance
    content = content.replace(/const uniIDIns = uniID\.createInstance\(\{ context \}\);?/g, "");
    
    // 3. replace token check logic
    const tokenCheckRegex1 = /const\s+token\s*=\s*(?:event\.uniIdToken\s*\|\|\s*event\.token\s*\|\|\s*'');[\s\S]*?const\s+payload\s*=\s*await\s+uniIDIns\.checkToken\(token\);[\s\S]*?if\s*\(payload\.errCode\)\s*\{[\s\S]*?return\s+res\(401,\s*'[^']+'\);?\s*\}/g;
    
    const replacement = `const tokenResult = verifyToken(event);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }`;
    
    if (tokenCheckRegex1.test(content)) {
      content = content.replace(tokenCheckRegex1, replacement);
    } else {
      console.log(`Regex 1 NOT MATCHED for ${folder}`);
    }
    
    // 4. replace payload.uid
    content = content.replace(/payload\.uid/g, "tokenResult.userId");
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${folder}`);
  }
}
