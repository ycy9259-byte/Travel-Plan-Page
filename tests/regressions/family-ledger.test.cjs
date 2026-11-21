const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function fixture() {
 const source=fs.readFileSync(path.join(__dirname,'../../ledger.js'),'utf8').replace('  const publicApi = {',`  globalThis.ledgerTest = { normalizeData, calculateStats, renderFinancialSummary, setPlanning(items) { plannedCosts = items; }, billScope, viewAmount, viewTotal, settlementBills, familyFor, setData(raw) { ledgerData = normalizeData(raw); }, setFilter(value) { familyFilter = value; }, snapshot() { return JSON.parse(JSON.stringify(ledgerData)); } };\n  const publicApi = {`);
 const ctx=vm.createContext({console});vm.runInContext(source,ctx);return ctx.ledgerTest;
}
function bill(id,amount,extra={}) { return {id,originalAmountCents:amount,baseAmountCents:amount,currency:'CNY',category:'其他',payerId:'a',participantIds:['a','b'],...extra}; }
function data(bills) { return {settings:{baseCurrency:'CNY'},travelers:[{id:'a',name:'Test A',family:'家庭一'},{id:'b',name:'Test B',family:'家庭二'}],bills}; }
test('legacy paid bills retain identity, shares and custom fields',()=>{
 const f=fixture();f.setData(data([bill('old',10001,{customField:'preserve'})]));const s=f.snapshot();assert.equal(s.bills[0].customField,'preserve');assert.equal(s.travelers[0].family,'家庭一');assert.equal(f.calculateStats().totalCents,10001);assert.equal(f.calculateStats().transfers[0].amountCents,5000);
});
test('estimated, unpaid, unassigned and explicitly excluded bills never create transfers',()=>{
 const f=fixture();f.setData(data([bill('estimate',10000,{paymentStatus:'estimated'}),bill('unpaid',20000,{paymentStatus:'unpaid'}),bill('pending',30000,{paymentStatus:'paid',payerId:'',participantIds:[]}),bill('excluded',194400,{includeInStatistics:false})]));assert.equal(f.calculateStats().totalCents,0);assert.equal(f.calculateStats().transfers.length,0);assert.equal(f.snapshot().bills.length,4);
});
test('family filtering is read-only and shared expense is not counted twice',()=>{
 const f=fixture();f.setData(data([bill('shared',10001,{familyScope:'shared'})]));const before=JSON.stringify(f.snapshot());f.setFilter('家庭A');const a=f.viewAmount(f.snapshot().bills[0]);f.setFilter('家庭B');const b=f.viewAmount(f.snapshot().bills[0]);assert.equal(a+b,10001);assert.equal(before,JSON.stringify(f.snapshot()));assert.equal(f.calculateStats().totalCents,10001);
});
test('unknown family members are never automatically split between households',()=>{
 const f=fixture();const raw=data([bill('shared',10000,{familyScope:'shared'})]);raw.travelers[1].family='';f.setData(raw);f.setFilter('家庭A');assert.equal(f.viewAmount(f.snapshot().bills[0]),null);f.setFilter('all');assert.equal(f.viewAmount(f.snapshot().bills[0]),10000);
});

test('paid hotel orders are shown separately and never reimported into manual bills',()=>{
 const f=fixture();f.setData(data([]));f.setPlanning([{name:'Test paid hotel',paymentStatus:'paid',totalCents:506990,category:'住宿',optional:false,familyScope:'pending',date:'2000-01-01'},{name:'Test estimated rail',paymentStatus:'estimated',totalCents:1000,optional:false,familyScope:'pending',date:'2000-01-02'}]);const markup=f.renderFinancialSummary();assert(markup.includes('CNY 10.00'));assert(markup.includes('CNY 5069.90'));assert.equal(f.snapshot().bills.length,0);assert.equal(f.calculateStats().totalCents,0);
});
