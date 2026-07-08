const fs = require('fs');
const path = require('path');

const frontDB = "c:\\Users\\Administrator\\Desktop\\XIAOPU\\软件测试\\新建文件夹\\修改版2agriconnect_release_ready_fixed\\修改版agriconnect_release_ready_fixed\\uniCloud-aliyun\\database";
const adminDB = "C:\\Users\\Administrator\\Desktop\\XIAOPU\\软件测试\\农鲜通后端管理平台\\农鲜通后台管理平台\\uniCloud-aliyun\\database";

if (!fs.existsSync(frontDB)) {
  console.log("ERROR: Frontend database dir not found at: " + frontDB);
  process.exit(1);
}
if (!fs.existsSync(adminDB)) {
  console.log("Admin database dir not found, creating: " + adminDB);
  fs.mkdirSync(adminDB, { recursive: true });
}

const frontFiles = fs.readdirSync(frontDB).filter(f => f.endsWith('.json'));
const adminFiles = fs.readdirSync(adminDB).filter(f => f.endsWith('.json'));

const migrated = [];
const identical = [];
const conflicts = [];
const adminOnly = [];

// Check admin-only files
for (const af of adminFiles) {
  if (!frontFiles.includes(af)) {
    adminOnly.push(af);
  }
}

// Compare and migrate
for (const ff of frontFiles) {
  const srcPath = path.join(frontDB, ff);
  const destPath = path.join(adminDB, ff);
  
  if (!adminFiles.includes(ff)) {
    // Missing in Admin -> copy
    fs.copyFileSync(srcPath, destPath);
    migrated.push(ff);
  } else {
    // Both exist -> compare
    const srcContent = fs.readFileSync(srcPath, 'utf8').trim();
    const destContent = fs.readFileSync(destPath, 'utf8').trim();
    
    if (srcContent === destContent) {
      identical.push(ff);
    } else {
      // Log the conflict with key differences
      let srcKeys = [], destKeys = [];
      try {
        srcKeys = Object.keys(JSON.parse(srcContent).properties || {});
      } catch(e) {}
      try {
        destKeys = Object.keys(JSON.parse(destContent).properties || {});
      } catch(e) {}
      
      const onlyInFront = srcKeys.filter(k => !destKeys.includes(k));
      const onlyInAdmin = destKeys.filter(k => !srcKeys.includes(k));
      
      conflicts.push({
        file: ff,
        frontFields: srcKeys.length,
        adminFields: destKeys.length,
        onlyInFront,
        onlyInAdmin
      });
    }
  }
}

// Also copy non-json files (like .jql files) that are in front but not in admin
const frontAllFiles = fs.readdirSync(frontDB);
const adminAllFiles = fs.readdirSync(adminDB);
const otherMigrated = [];
for (const ff of frontAllFiles) {
  if (ff.endsWith('.json')) continue; // already handled
  const srcPath = path.join(frontDB, ff);
  const destPath = path.join(adminDB, ff);
  const stat = fs.statSync(srcPath);
  if (stat.isFile() && !adminAllFiles.includes(ff)) {
    fs.copyFileSync(srcPath, destPath);
    otherMigrated.push(ff);
  }
}

// Final listing
const finalAdminFiles = fs.readdirSync(adminDB).filter(f => f.endsWith('.json')).sort();

console.log("=== MIGRATION RESULT ===");
console.log("\n--- Newly Migrated (Frontend -> Admin) ---");
migrated.forEach(f => console.log("  + " + f));
if (otherMigrated.length > 0) {
  console.log("\n--- Other Files Migrated ---");
  otherMigrated.forEach(f => console.log("  + " + f));
}
console.log("\n--- Identical (no action) ---");
identical.forEach(f => console.log("  = " + f));
console.log("\n--- Conflicts (both exist, content differs, Admin version KEPT) ---");
conflicts.forEach(c => {
  console.log("  ! " + c.file + " (Front:" + c.frontFields + " fields, Admin:" + c.adminFields + " fields)");
  if (c.onlyInFront.length > 0) console.log("      Only in Frontend: " + c.onlyInFront.join(", "));
  if (c.onlyInAdmin.length > 0) console.log("      Only in Admin:    " + c.onlyInAdmin.join(", "));
});
console.log("\n--- Admin-Only (not in Frontend) ---");
adminOnly.forEach(f => console.log("  * " + f));
console.log("\n--- Final Admin database file list (" + finalAdminFiles.length + " files) ---");
finalAdminFiles.forEach(f => console.log("  " + f));
