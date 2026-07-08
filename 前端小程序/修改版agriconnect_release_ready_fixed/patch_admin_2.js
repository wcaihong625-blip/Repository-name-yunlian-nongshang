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
    
    // We want to replace the whole `try { const payload = await uniIDIns.checkToken(token); ... } catch (e) { ... }` block.
    // Let's use a very broad regex to find `const payload = await uniIDIns.checkToken(token);` up to the next `const` or `let` or blank line after the catch block.
    
    const blockRegex = /try\s*\{\s*const\s+payload\s*=\s*await\s+uniIDIns\.checkToken\(token\);[\s\S]*?catch\s*\([^)]+\)\s*\{[\s\S]*?\}/;
    
    const tokenRegex2 = /const\s+payload\s*=\s*await\s+uniIDIns\.checkToken\(token\);[\s\S]*?if\s*\(payload\.errCode\)\s*\{[\s\S]*?return\s+res\(401,\s*'[^']+'\);?\s*\}/;

    const tokenRegex3 = /const\s+payload\s*=\s*await\s+uniIDIns\.checkToken\(token\);[\s\S]*?if\s*\(!payload\s*\|\|[\s\S]*?\)\s*\{[\s\S]*?return\s+\{\s*code:\s*401,\s*message:\s*'[^']+'\s*\};?\s*\}/;

    const replacementStandard = `const tokenResult = verifyToken(event);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }`;
    
    const replacementCustom = `const tokenResult = verifyToken(event);
    if (!tokenResult.success) {
      return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
    }`;

    // Replace the specific try-catch variation first:
    if (blockRegex.test(content)) {
        content = content.replace(blockRegex, replacementCustom);
    } else if (tokenRegex2.test(content)) {
        content = content.replace(tokenRegex2, replacementStandard);
    } else if (tokenRegex3.test(content)) {
        content = content.replace(tokenRegex3, replacementCustom);
    }
    
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated try/catch token logic for ${folder}`);
  }
}
