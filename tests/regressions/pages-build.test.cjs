const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const source=path.resolve(__dirname,'../../scripts/build-pages.mjs');
function fixture(t, trip) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pages-build-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'scripts'));fs.copyFileSync(source,path.join(root,'scripts/build-pages.mjs'));
 fs.writeFileSync(path.join(root,'trip-data.json'),JSON.stringify(trip));
 fs.mkdirSync(path.join(root,'assets/maps/templates'),{recursive:true});fs.writeFileSync(path.join(root,'assets/maps/templates/manifest.json'),JSON.stringify({templates:[]}));
 for(const name of ['index.html','styles.css','ledger.css','app.js','ledger.js','overview-map.js','route-ui.js','runtime-storage.js','site-navigation.js','ticket-pdf-preview.js','LICENSE','THIRD_PARTY_NOTICES.md'])fs.writeFileSync(path.join(root,name),'Test fixture');
 fs.writeFileSync(path.join(root,'.env'),'PRIVATE_TEST_VALUE');
 const run=()=>spawnSync(process.execPath,[path.join(root,'scripts/build-pages.mjs')],{encoding:'utf8'});
 return {root,run};
}
test('Pages copies only public files and preserves travel JSON',t=>{
 const trip={config:{persistence:{mode:'local'}},days:[{date:'2000-01-01'}]};const {root,run}=fixture(t,trip);const r=run();assert.equal(r.status,0,r.stderr);assert(!fs.existsSync(path.join(root,'_site/.env')));assert(!fs.existsSync(path.join(root,'_site/scripts')));assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'_site/trip-data.json'))),trip);
});
test('Pages blocks backend mode rather than silently deleting backend features',t=>{
 const {run}=fixture(t,{config:{persistence:{mode:'d1'}}});assert.notEqual(run().status,0);
});
test('Pages blocks sensitive fields and document publication pending review',t=>{
 for(const extra of [{phone:'fictional-private-field'},{ticketPlanning:{items:[{document:{url:'private.pdf'}}]}}]){const {run}=fixture(t,{config:{persistence:{mode:'local'}},...extra});assert.notEqual(run().status,0);}
});
