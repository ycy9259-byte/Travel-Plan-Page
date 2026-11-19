const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function fixture(raw) {
 const ctx=vm.createContext({document:{addEventListener(){}},localStorage:{getItem(){return raw;}},URL});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../../app.js'),'utf8')+'\nthis.foodTest={state,loadFoodState,foodSection};',ctx);
 ctx.foodTest.state.data={metadata:{tripId:'test-trip'},foodRecommendations:{notice:'Optional',items:[{id:'test-food',date:'2000-01-01',dishes:'Test dish',reason:'Test reason',routeRelation:'Near route',address:'Unverified address',addressVerified:false,referencePrice:{perPerson:null}}]}};
 return ctx.foodTest;
}
test('food state reads only valid statuses for authored IDs',()=>{
 const f=fixture('{"test-food":"tried","foreign-id":"want"}');f.loadFoodState();assert.equal(f.state.foodStatuses['test-food'],'tried');assert.equal(Object.keys(f.state.foodStatuses).length,1);
});
test('malformed food preferences never block the itinerary',()=>{
 for(const raw of ['broken','null','[]','{"test-food":"reserved"}']){const f=fixture(raw);f.loadFoodState();assert.equal(Object.keys(f.state.foodStatuses).length,0);}
});
test('unverified food has no navigation or fabricated price',()=>{
 const f=fixture('{}');const markup=f.foodSection({date:'2000-01-01'});assert(!markup.includes('地图导航'));assert(!markup.includes('参考人均'));assert(markup.includes('想去'));assert(markup.includes('已体验'));assert.equal(f.foodSection({date:'2000-01-02'}),'');
});
