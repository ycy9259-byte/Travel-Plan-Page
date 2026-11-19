const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = vm.createContext({ document: { addEventListener() {} } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app.js'), 'utf8') + '\nthis.rentalTest = { rentalStatus, rentalPriceText };', context);
const { rentalStatus, rentalPriceText } = context.rentalTest;
test('pending booking never produces a return deadline or overdue state', () => {
  const status = rentalStatus({ status: 'pending', pickup: {}, dropoff: {} });
  assert.equal(status.label, '待预订');
  assert.equal(status.target, null);
  assert.equal(status.complete, false);
});
test('unknown price is distinct from a genuine zero or confirmed price', () => {
  for (const value of [null, undefined, '', '待补充', NaN]) assert.equal(rentalPriceText({ payAtCounter: value }), '待确认');
  assert.equal(rentalPriceText({ currency: 'CNY', payAtCounter: 0 }), 'CNY 0.00');
  assert.equal(rentalPriceText({ currency: 'CNY', payAtCounter: 123.45 }), 'CNY 123.45');
});
test('confirmed bookings retain future and overdue behavior', () => {
  const rental = { pickup: { date: '2099-01-01', time: '08:00', utcOffset: '+08:00' }, dropoff: { date: '2099-01-02', time: '08:00', utcOffset: '+08:00' } };
  assert.equal(rentalStatus(rental).label, '距取车');
  rental.pickup.date = rental.dropoff.date = '2000-01-01';
  assert.equal(rentalStatus(rental).complete, true);
  rental.dropoff.time = '待确认';
  assert.equal(rentalStatus(rental).target, null);
});
