const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const trip=JSON.parse(fs.readFileSync(path.join(__dirname,'../../trip-data.json')));
test('latest return uses Yiwu and remains estimated rather than paid',()=>{
 const rail=trip.groundTransport.publicTransitAndRail.find(x=>x.id==='rail-12');assert.equal(rail.train,'G1372＋G8329');assert(rail.route.includes('义乌'));assert(!rail.route.includes('杭州'));assert.equal(rail.pricePerPerson*trip.trip.groupSize,5244);const cost=trip.planningCosts.items.find(x=>x.id==='rail-12');assert.equal(cost.totalCents,524400);assert.equal(cost.paymentStatus,'estimated');assert.equal(rail.purchaseStatus,'未购买');
});
test('Feb 11 is the free ancient town, not a second Songzanlin charge',()=>{
 const day=trip.days.find(x=>x.date==='2027-02-11');assert(day.schedule.some(x=>x.placeId==='dukezong'));assert(!day.schedule.some(x=>x.placeId==='songzanlin'));assert.equal(trip.planningCosts.items.filter(x=>x.id==='songzanlin').length,1);assert.equal(trip.planningCosts.items.find(x=>x.id==='songzanlin').date,'2027-02-10');
});
test('purchase viewing schedule is explicit and preserves separate official/package records',()=>{
 const task=trip.preTrip.additionalItems.find(x=>x.id==='purchase-rail-12');assert.equal(task.purchase.planDate,'2027-01-29');assert.equal(task.purchase.planTime,'08:30');assert(task.purchase.note.includes('仅为计划查看时间'));assert(trip.preTrip.additionalItems.some(x=>x.id==='purchase-yunshan-official'));assert(trip.preTrip.additionalItems.some(x=>x.id==='purchase-yunshan-package'));assert.equal(new Set(trip.preTrip.additionalItems.map(x=>x.id)).size,trip.preTrip.additionalItems.length);
});
test('two excluded airfare records are kept outside bills and estimates',()=>{
 const paid=trip.ledger.externalPaidItems;assert.equal(paid.length,2);assert.equal(paid.reduce((sum,x)=>sum+x.amountCents,0),388800);assert(paid.every(x=>x.paymentStatus==='paid'&&x.includeInStatistics===false));assert(!trip.planningCosts.items.some(x=>x.id.startsWith('flight-family')));
});
test('map uses only known coordinates; return has its own region and prior markers remain',()=>{
 const map=trip.routeMap;assert.equal(map.regions.length,2);const returning=map.regions.find(x=>x.id==='return-rail');assert.deepEqual(returning.routes[0].placeIds,['return-kunming-south','return-yiwu-station','return-wenzhou-north']);assert(!map.regions.some(r=>r.places.some(p=>['baima','cow-horse-coffee','gongbi'].includes(p.id))));const region=map.regions.find(x=>x.id==='yunnan-guizhou');for(const id of ['yulong','yunshanping','blue-moon'])assert(region.dailyLayouts['5'].places.includes(id));assert.equal(trip.days.length,8);assert.equal(trip.accommodations.length,5);
});
