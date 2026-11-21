const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function fixture() {
 const source = fs.readFileSync(path.join(__dirname,'../../ledger.js'),'utf8').replace('  const publicApi = {',`  globalThis.ledgerTest = {
   calculateStats, expenseList, renderFinancialSummary, renderSettlement, settlementView, viewAmount, viewTotal,
   setOrders(flights, costs) { recordedOrders = makeRecordedOrders(flights, costs); familyGroups = ['家庭A','家庭B']; },
   setData(raw) { ledgerData = normalizeData(raw); },
   setFilter(value) { familyFilter = value; },
   snapshot() { return JSON.parse(JSON.stringify(ledgerData)); }
 };\n  const publicApi = {`);
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

test('count paid flights and hotels once and leave unconfirmed purchases out', () => {
 const f = fixture();
 const hotel = { id:'hotel', name:'Test hotel', paymentStatus:'paid', totalCents:10123, category:'住宿', familyScope:'pending' };
 f.setOrders([
   {id:'flight-a', name:'Test flight', paymentStatus:'paid', amountCents:15000, familyScope:'家庭A'},
   {id:'flight-b', name:'Test flight', paymentStatus:'paid', amountCents:15000, familyScope:'家庭B'}
 ], [hotel, {...hotel, id:'future', paymentStatus:'estimated'}]);
 const manual = bill('hotel-entry', 10123, { category:'住宿' });
 f.setData(data([manual, bill('food', 2510)]));
 assert.equal(f.expenseList().length, 5);
 assert.equal(f.viewTotal(f.expenseList()), 42633);
 assert.match(f.renderFinancialSummary(f.expenseList()), /核对后计入/);
 f.setData(data([{...manual, orderLink:'order:hotel'}, bill('food', 2510)]));
 assert.equal(f.expenseList().length, 4);
 assert.equal(f.viewTotal(f.expenseList()), 42633);
 assert.equal(f.calculateStats().totalCents, 12633);
 f.setFilter('家庭A');
 const flight = f.expenseList().find((item) => item.id === 'order:flight-a');
 assert.equal(f.viewAmount(flight), 15000);
 assert.equal(flight.payerId, '');
 assert.equal(flight.participantIds.length, 0);
 f.setData(data([{...manual, orderLink:'separate'}, bill('food', 2510)]));
 f.setFilter('all');
 assert.equal(f.viewTotal(f.expenseList()), 52756);
});

test('split a linked bill to the cent and keep the original bill after settlement', () => {
 const f = fixture();
 const raw = data([bill('shared', 12345, {payerId:'c', participantIds:['a','b','c'], familyScope:'shared'})]);
 raw.travelers.push({id:'c', name:'Test C', family:''});
 raw.settings.settlement = {names:['Test A','Test B','Test C'], billId:'shared'};
 f.setData(raw);
 const before = f.snapshot();
 const view = () => f.settlementView(f.expenseList());
 assert.deepEqual(Array.from(view().rows, (row) => row.amount), [6173, 6172]);
 assert.equal(view().stats.transfers.length, 0);
 assert.equal(view().stats.members[2].netCents, 12345);
 assert.deepEqual(f.snapshot(), before);
 raw.settings.settlement.paid = [6173, 0];
 f.setData(raw);
 assert.deepEqual(Array.from(view().stats.members, (member) => member.netCents), [0,-6172,6172]);
 raw.settings.settlement.paid[1] = 6172;
 f.setData(raw);
 assert.deepEqual(Array.from(view().stats.members, (member) => member.netCents), [0,0,0]);
 assert.deepEqual(Array.from(f.snapshot().bills[0].participantIds), ['a','b','c']);
 assert.equal(f.viewTotal(f.expenseList()), 12345);
 raw.settings.settlement.paid[0] = 0;
 f.setData(raw);
 assert.equal(view().stats.members[0].netCents, -6173);
});

test('an unlinked transfer starts blank and never adds an expense', () => {
 const f = fixture();
 const raw = data([]);
 raw.settings.settlement = {names:['Test A','Test B','Test C']};
 f.setData(raw);
 const view = () => f.settlementView(f.expenseList());
 assert.deepEqual(Array.from(view().rows, (row) => row.amount), [0,0]);
 raw.settings.settlement.amounts = [253,0];
 raw.settings.settlement.paid = [253,0];
 f.setData(raw);
 assert.equal(view().rows[0].paid, 253);
 assert.equal(view().stats.totalCents, 0);
 assert.equal(view().stats.transfers.length, 0);
});

test('calculated transfers are checkable without any manual settlement setup', () => {
 const f = fixture();
 const raw = data([bill('shared', 65430, {
   payerId:'c', participantIds:['a','b'], familyScope:'shared',
   createdAt:'2000-01-01T00:00:00Z', updatedAt:'2000-01-01T00:00:00Z'
 })]);
 raw.travelers.push({id:'c', name:'Test C', family:''});
 f.setData(raw);
 const view = () => f.settlementView(f.expenseList());
 const original = JSON.stringify(f.snapshot().bills);
 const markup = f.renderSettlement(view());
 assert.equal((markup.match(/type="checkbox"/g) || []).length, 2);
 assert.match(markup, /Test A → Test C/);
 assert.match(markup, /Test B → Test C/);
 assert.doesNotMatch(markup, /金额待确认/);

 raw.settings.settledTransfers = [{id:'transfer-1', fromId:'a', toId:'c', amountCents:32715}];
 f.setData(raw);
 assert.equal(view().stats.transfers.length, 1);
 assert.equal(view().stats.transfers[0].fromId, 'b');
 assert.equal(view().stats.members[0].netCents, 0);
 assert.match(f.renderSettlement(view()), /name="paid" checked/);

 raw.settings.settlement = {names:['Test A','Test B','Test C']};
 f.setData(raw);
 assert.equal((f.renderSettlement(view()).match(/type="checkbox"/g) || []).length, 2);
 raw.settings.settledTransfers = [];
 f.setData(raw);
 assert.equal(view().rows[0].amount, 32715);
 assert.equal(view().stats.members[0].netCents, -32715);
 assert.equal(JSON.stringify(f.snapshot().bills), original);
 assert.equal(f.viewTotal(f.expenseList()), 65430);
});
