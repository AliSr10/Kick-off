const crypto = require('node:crypto');
const TIME_ZONE = 'Asia/Beirut';
const SLOTS = [
  { label: '3:00 PM - 4:30 PM', start: '15:00', end: '16:30' },
  { label: '4:30 PM - 6:00 PM', start: '16:30', end: '18:00' },
  { label: '6:00 PM - 7:30 PM', start: '18:00', end: '19:30' },
  { label: '7:30 PM - 9:00 PM', start: '19:30', end: '21:00' },
  { label: '9:00 PM - 10:30 PM', start: '21:00', end: '22:30' },
  { label: '10:30 PM - 12:00 AM', start: '22:30', end: '24:00' }
];
const ALL_SLOTS = SLOTS.map(slot => slot.label);
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function venueNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
function dateValue(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, 'Use a valid date in YYYY-MM-DD format.');
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new HttpError(400, 'Choose a valid calendar date.');
  return value;
}
function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function dayOfWeek(date) { return new Date(`${dateValue(date)}T12:00:00Z`).getUTCDay(); }
function text(value, label, max, required = true) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text.`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(clean)) throw new HttpError(400, `${label} is required and must be at most ${max} characters.`);
  return clean;
}
function phoneValue(value, required = true) {
  const raw = text(value, 'Phone number', 40, required);
  if (!raw && !required) return '';
  if (!/^[+\d\s().-]+$/.test(raw)) throw new HttpError(400, 'Enter a valid phone number, including the country code for international numbers.');
  let number = raw.replace(/[\s().-]/g, '');
  if (number.startsWith('00')) number = `+${number.slice(2)}`;
  if (/^961\d+$/.test(number)) number = `+${number}`;
  if (/^0\d{7}$/.test(number)) number = `+961${number.slice(1)}`;
  else if (/^\d{7,8}$/.test(number)) number = `+961${number}`;
  if (!/^\+[1-9]\d{6,14}$/.test(number)) throw new HttpError(400, 'Enter a valid phone number, for example +961 3 696 325.');
  return number;
}
function slotValue(value) {
  const slot = SLOTS.find(item => item.label === value);
  if (!slot) throw new HttpError(400, 'Choose one of the available 90-minute slots.');
  return slot;
}
function futureSlot(date, slot, { maxDays = 365, now = new Date() } = {}) {
  const current = venueNow(now);
  if (date < current.date || (date === current.date && slot.start <= current.time)) throw new HttpError(400, 'This kickoff time has already passed.');
  if (date > addDays(current.date, maxDays)) throw new HttpError(400, `Bookings are available up to ${maxDays + 1} calendar days ahead.`);
}
function bookingInput(body = {}, { publicBooking = false, now } = {}) {
  const name = text(body.name, 'Name', 120);
  const phone = phoneValue(body.phone);
  const date = dateValue(body.date);
  const slot = slotValue(body.time);
  const notes = text(body.notes, 'Notes', 1000, false);
  futureSlot(date, slot, { maxDays: publicBooking ? 13 : 365, now });
  return { name, phone, date, time: slot.label, slot, notes };
}
function standingInput(body = {}) {
  const name = text(body.playerName, 'Player name', 120);
  const phone = phoneValue(body.phone);
  if (!Number.isInteger(body.dayOfWeek) || body.dayOfWeek < 0 || body.dayOfWeek > 6) throw new HttpError(400, 'Choose a valid day of the week.');
  return { name, phone, day: body.dayOfWeek, slot: slotValue(body.time) };
}
function idValue(value) { return text(value, 'Reservation ID', 50); }
function numericId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new HttpError(400, 'Invalid recurring booking ID.');
  return Number(value);
}
function safeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}
module.exports = { TIME_ZONE, SLOTS, ALL_SLOTS, HttpError, venueNow, dateValue, addDays, dayOfWeek, text, phoneValue, slotValue, futureSlot, bookingInput, standingInput, idValue, numericId, safeEqual };
