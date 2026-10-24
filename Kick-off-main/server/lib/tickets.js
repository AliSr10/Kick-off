const crypto = require('node:crypto');
const { HttpError, safeEqual } = require('./booking');
function createTickets(secret) {
  function sign(payload) { return crypto.createHmac('sha256', secret).update(`kickoff-ticket:v1:${payload}`).digest('base64url'); }
  function token(id) {
    const payload = Buffer.from(id, 'utf8').toString('base64url');
    return `${payload}.${sign(payload)}`;
  }
  function verify(value) {
    if (typeof value !== 'string' || value.length > 180 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) throw new HttpError(404, 'This match pass is invalid.');
    const [payload, signature] = value.split('.');
    if (!safeEqual(signature, sign(payload))) throw new HttpError(404, 'This match pass is invalid.');
    const id = Buffer.from(payload, 'base64url').toString('utf8');
    if (!id || id.length > 50 || Buffer.from(id).toString('base64url') !== payload) throw new HttpError(404, 'This match pass is invalid.');
    return id;
  }
  return { token, verify, url: id => `/ticket.html?token=${encodeURIComponent(token(id))}`, qrUrl: id => `/api/tickets/${token(id)}/qr.svg` };
}
module.exports = { createTickets };
