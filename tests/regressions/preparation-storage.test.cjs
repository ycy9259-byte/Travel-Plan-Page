const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
async function load(todos, additionalItems, hasSnapshot=true, todoRevisions=[]) {
  const snapshot={todos:structuredClone(todos),tickets:[]};
  const adapter={mode:'local',storageKey:'test-key',async load(){return structuredClone(snapshot)},async applyChange(collection,item){const i=snapshot.todos.findIndex(t=>t.id===item.id);if(i<0)snapshot.todos.push(item);else snapshot.todos[i]=item;}};
  const ctx=vm.createContext({document:{addEventListener(){}},localStorage:{getItem(){return hasSnapshot?'{}':null}},console});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../app.js'),'utf8')+'\nthis.testPrep={state,loadSharedState};',ctx);
  ctx.testPrep.state.runtimeAdapters={todos:adapter};
  ctx.testPrep.state.data={preTrip:{packingItems:[{id:'legacy',text:'Original test task'}],additionalItems,todoRevisions}};
  await ctx.testPrep.loadSharedState();
  return {todos:JSON.parse(JSON.stringify(ctx.testPrep.state.todos)),snapshot};
}
test('new checklist seeds original and additional items once',async()=>{
 const additional=[{id:'new',text:'Test item',category:'Test',scope:'personal',completed:false}];
 const first=await load([],additional,false);assert.equal(first.todos.length,2);
 const second=await load(first.todos,additional);assert.equal(second.todos.length,2);
});
test('upgrade preserves user edits and completion',async()=>{
 const result=await load([{id:'new',text:'User edit',completed:true}], [{id:'new',text:'Authored text',completed:false}]);
 assert.equal(result.todos[0].text,'User edit');assert.equal(result.todos[0].completed,true);assert.equal(result.todos.length,1);
});
test('deleted authored items stay deleted and text duplicates are skipped',async()=>{
 const result=await load([{id:'removed',text:'Removed item',deleted:true},{id:'custom',text:'Same text'}],[{id:'removed',text:'Removed item'},{id:'another',text:'Same text'}]);
 assert.equal(result.todos.length,2);assert.equal(result.todos[0].deleted,true);
});

test('authored todo corrections preserve completion and user customizations', async()=>{
 const revision=[{id:'legacy',previousTexts:['Old text'],text:'New text'}];
 const corrected=await load([{id:'legacy',text:'Old text',completed:true}],[],true,revision);
 assert.equal(corrected.todos[0].text,'New text');assert.equal(corrected.todos[0].completed,true);
 const edited=await load([{id:'legacy',text:'User customization',completed:false}],[],true,revision);
 assert.equal(edited.todos[0].text,'User customization');
 const removed=await load([{id:'legacy',text:'Old text',deleted:true}],[],true,revision);
 assert.equal(removed.todos[0].deleted,true);assert.equal(removed.todos[0].text,'Old text');
});
