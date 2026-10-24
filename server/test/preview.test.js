const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPreviewApp, start } = require('../server');

test('visual preview serves layout and illustrative availability without loading production services', async () => {
  const server = createPreviewApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(origin + '/');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Kickoff/i);
    assert.equal((await fetch(origin + '/app.js')).status, 200);
    assert.equal((await fetch(origin + '/admin/dashboard.html')).status, 200);
    const session = await (await fetch(origin + '/api/session')).json();
    assert.equal(session.preview, true); assert.equal(session.user, null);
    const slots = await (await fetch(origin + '/api/availability?date=2026-10-24')).json();
    assert.equal(slots.schedule.length, 6); assert(slots.schedule.every(slot => slot.available));
    assert.equal((await (await fetch(origin + '/api/admin/reservations')).json()).reservations.length, 0);
    assert.equal((await fetch(origin + '/api/auth/google')).status, 503);
    for (const [method, path] of [['POST', '/api/reservations'], ['POST', '/api/admin/login'], ['PATCH', '/api/admin/reservations/example/confirm'], ['DELETE', '/api/admin/reservations/cancelled']]) {
      const blocked = await fetch(origin + path, { method });
      assert.equal(blocked.status, 503); assert.match((await blocked.json()).error, /Visual preview only/);
    }
    for (const module of ['../config/env', '../config/db', '../app']) assert(!require.cache[require.resolve(module)]);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('visual preview startup refuses a production process', async () => {
  const argv = process.argv, mode = process.env.NODE_ENV;
  try {
    process.argv = [...argv, '--preview']; process.env.NODE_ENV = 'production';
    await assert.rejects(start(), /unavailable in production/);
  } finally { process.argv = argv; if (mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = mode; }
});
