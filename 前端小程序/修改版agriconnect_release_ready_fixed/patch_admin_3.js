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
    
    // Fix the extra `}` left over by my bad regex
    const badSyntax1 = `    if (!tokenResult.success) {
      return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
    };
  }`;
    const goodSyntax1 = `    if (!tokenResult.success) {
      return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
    }`;

    // Also check for the standard replacement if it had an extra brace:
    const badSyntax2 = `    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    };
  }`;
    const badSyntax3 = `    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }\n  }`;
    
    const goodSyntax2 = `    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }`;

    if (content.includes(badSyntax1)) content = content.replace(badSyntax1, goodSyntax1);
    if (content.includes(badSyntax2)) content = content.replace(badSyntax2, goodSyntax2);
    if (content.includes(badSyntax3)) content = content.replace(badSyntax3, goodSyntax2);

    fs.writeFileSync(file, content, 'utf8');
    
    try {
        require('vm').createScript(content);
        console.log(`Syntax OK: ${folder}`);
    } catch (e) {
        console.error(`Syntax ERROR in ${folder}: ${e.message}`);
    }
  }
}
