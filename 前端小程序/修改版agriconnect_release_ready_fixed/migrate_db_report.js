const fs = require('fs');
const path = require('path');

const frontDB = "c:\\Users\\Administrator\\Desktop\\XIAOPU\\软件测试\\新建文件夹\\修改版2agriconnect_release_ready_fixed\\修改版agriconnect_release_ready_fixed\\uniCloud-aliyun\\database";
const adminDB = "C:\\Users\\Administrator\\Desktop\\XIAOPU\\软件测试\\农鲜通后端管理平台\\农鲜通后台管理平台\\uniCloud-aliyun\\database";

const frontFiles = fs.readdirSync(frontDB).filter(f => f.endsWith('.json'));
const adminFiles = fs.readdirSync(adminDB).filter(f => f.endsWith('.json'));

const result = { migrated: [], identical: [], conflicts: [], adminOnly: [], finalList: [] };

for (const ff of frontFiles) {
  const src = path.join(frontDB, ff);
  const dest = path.join(adminDB, ff);
  if (!adminFiles.includes(ff)) {
    result.migrated.push(ff);
  } else {
    const s = fs.readFileSync(src, 'utf8').trim();
    const d = fs.readFileSync(dest, 'utf8').trim();
    if (s === d) {
      result.identical.push(ff);
    } else {
      let sK = [], dK = [];
      try { sK = Object.keys(JSON.parse(s).properties || {}); } catch(e) {}
      try { dK = Object.keys(JSON.parse(d).properties || {}); } catch(e) {}
      result.conflicts.push({
        file: ff,
        fFields: sK.length, aFields: dK.length,
        onlyFront: sK.filter(k => !dK.includes(k)),
        onlyAdmin: dK.filter(k => !sK.includes(k))
      });
    }
  }
}

for (const af of adminFiles) {
  if (!frontFiles.includes(af)) result.adminOnly.push(af);
}

result.finalList = fs.readdirSync(adminDB).filter(f => f.endsWith('.schema.json')).sort();

fs.writeFileSync('db_migration_result.json', JSON.stringify(result, null, 2), 'utf8');
console.log('Written to db_migration_result.json');
console.log('Migrated: ' + result.migrated.length);
console.log('Identical: ' + result.identical.length);
console.log('Conflicts: ' + result.conflicts.length);
console.log('AdminOnly: ' + result.adminOnly.length);
console.log('FinalSchemas: ' + result.finalList.length);
