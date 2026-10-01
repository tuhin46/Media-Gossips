const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const handler = require('../entertainment-news/api/storage');

function backend() {
    const props = new Map([['DRIVE_API_KEY', 'a'.repeat(64)], ['ADMIN_PASSWORD', 'test-private-password-long'], ['DRIVE_FOLDER_ID', 'folder']]);
    const files = new Map();
    let counter = 0;
    function file(name, content) {
        const id = String(++counter);
        const f = { name, content, getId: () => id, getBlob: () => ({ getDataAsString: () => f.content }),
            setContent: text => { f.content = text; } };
        files.set(id, f); return f;
    }
    const folder = { createFile: file, getFilesByName: name => {
        const list = Array.from(files.values()).filter(f => f.name === name);
        return { hasNext: () => !!list.length, next: () => list.shift() };
    } };
    file('seed-content.json', fs.readFileSync('storage/seed-content.json', 'utf8'));
    const context = { console, Session: { getEffectiveUser: () => ({ getEmail: () => 'smtuhin46@gmail.com' }) }, PropertiesService: { getScriptProperties: () => ({
        getProperty: key => props.get(key), setProperty: (key, value) => props.set(key, value) }) },
        DriveApp: { getFolderById: () => folder, getFileById: id => files.get(id) },
        Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_, value) => Array.from(crypto.createHash('sha256').update(value).digest()),
            newBlob: value => ({ getBytes: () => Array.from(Buffer.from(value)) }) },
        LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
        ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
        MimeType: { PLAIN_TEXT: 'text/plain' } };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync('storage/apps-script/Code.gs', 'utf8'), context);
    context.setupStorage();
    return { props, files, context, call(action, input = {}, key = 'a'.repeat(64)) {
        return JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ key, action, input }) } }).text);
    } };
}
function operation(action, input = {}) {
    return Object.assign({ requestId: crypto.randomBytes(16).toString('hex') }, input);
}
const item = { title: 'New story', category: 'Movies', status: 'Published', image: 'data:image/jpeg;base64,YWJj', trailer: '', content: 'Story text' };

test('Drive stores shared content, images and backups; hides drafts and rejects stale writes', () => {
    const b = backend();
    assert.equal(b.call('read').data.items.length, 11);
    const request = operation('add', { item });
    const added = b.call('add', request).data.items.at(-1);
    assert.equal(b.call('add', request).data.items.length, 12, 'same request must not duplicate a post');
    assert.match(added.image, /^\/api\/storage\?action=image/);
    assert.equal(b.call('image', { id: added.id }).data.base64, 'YWJj');
    let result = b.call('update', operation('update', { id: added.id, version: 1, item: { ...added, status: 'Draft' } }));
    assert.equal(result.ok, true);
    assert.equal(b.call('read').data.items.length, 11);
    assert.equal(b.call('read', { admin: true }).data.items.length, 12);
    assert.equal(b.call('image', { id: added.id }).status, 404);
    assert.equal(b.call('image', { id: added.id, admin: true }).ok, true);
    assert.equal(b.call('update', operation('update', { id: added.id, version: 1, item })).status, 409);
    assert.equal(b.call('read', {}, 'wrong-key').status, 403);
    assert.equal(b.call('add', operation('add', { item: { ...item, image: 'javascript:alert(1)' } })).status, 400);
    assert.equal(b.call('add', operation('add', { item: { ...item, trailer: 'https://evil.example/embed/x' } })).status, 400);
    assert.ok(Array.from(b.files.values()).some(f => f.name === 'backup-1.json'));
    b.context.setupStorage();
    assert.equal(b.call('read', { admin: true }).data.items.length, 12, 'setup must preserve existing data');
});

test('pin, ticker, delete and import persist; backups retain previous data and rotate', () => {
    const b = backend();
    b.call('importOne', operation('importOne', { id: 555, item }));
    b.call('pin', operation('pin', { id: 555, version: 1 }));
    assert.equal(b.call('read').data.items.find(x => x.id === 555).pinned, true);
    assert.equal(b.call('remove', operation('remove', { id: 555, version: 1 })).status, 409);
    assert.equal(b.call('remove', operation('remove', { id: 555, version: 2 })).ok, true);
    for (let i = 0; i < 12; i++) b.call('ticker', operation('ticker', { text: 'Ticker ' + i }));
    assert.equal(b.call('read').data.ticker, 'Ticker 11');
    const backups = Array.from(b.files.values()).filter(f => f.name.startsWith('backup-'));
    assert.equal(backups.length, 10);
    assert.ok(backups.some(f => JSON.parse(f.content).ticker === 'Ticker 10'));
});

test('login is throttled using shared state', () => {
    const b = backend();
    for (let i = 0; i < 10; i++) assert.equal(b.call('login', { username: 'admin', password: 'wrong', client: 'b'.repeat(64) }).status, 401);
    assert.equal(b.call('login', { username: 'admin', password: 'test-private-password-long', client: 'b'.repeat(64) }).status, 429);
    assert.equal(b.call('login', { username: 'admin', password: 'test-private-password-long', client: 'c'.repeat(64) }).ok, true);
});

async function invoke(req) {
    const headers = {};
    const res = { headers, setHeader: (key, value) => { headers[key] = value; }, status(code) { this.code = code; return this; },
        json(value) { this.value = value; return this; }, send(value) { this.value = value; return this; } };
    await handler(req, res); return res;
}
test('Vercel proxy protects writes, sessions and draft images end to end', async () => {
    const b = backend();
    process.env.DRIVE_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
    process.env.DRIVE_API_KEY = 'a'.repeat(64); process.env.SESSION_SECRET = 's'.repeat(64);
    const realFetch = global.fetch;
    global.fetch = async (_, options) => {
        const payload = JSON.parse(options.body);
        const data = b.call(payload.action, payload.input, payload.key);
        return { ok: true, json: async () => data };
    };
    try {
        const headers = { host: 'site.example', origin: 'https://site.example' };
        let r = await invoke({ method: 'POST', headers, body: { action: 'add', ...operation('add', { item }) } });
        assert.equal(r.code, 401);
        r = await invoke({ method: 'POST', headers, body: { action: 'login', username: 'admin', password: 'test-private-password-long' } });
        assert.equal(r.code, 200);
        assert.match(r.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/);
        const adminHeaders = { ...headers, cookie: r.headers['Set-Cookie'].split(';')[0] };
        r = await invoke({ method: 'POST', headers: adminHeaders, body: { action: 'add', ...operation('add', { item: { ...item, status: 'Draft' } }) } });
        assert.equal(r.code, 200);
        const id = r.value.items.at(-1).id;
        r = await invoke({ method: 'GET', headers, query: { action: 'public' } });
        assert.equal(r.value.items.some(x => x.id === id), false);
        r = await invoke({ method: 'GET', headers, query: { action: 'image', id } }); assert.equal(r.code, 404);
        r = await invoke({ method: 'GET', headers: adminHeaders, query: { action: 'image', id } });
        assert.equal(r.value.toString(), 'abc'); assert.equal(r.headers['Content-Type'], 'image/jpeg');
        r = await invoke({ method: 'POST', headers: { ...adminHeaders, origin: 'https://evil.example' }, body: { action: 'remove' } });
        assert.equal(r.code, 403);
        r = await invoke({ method: 'GET', headers: { ...headers, cookie: '__Host-mg_admin=forged.signature' }, query: { action: 'admin' } });
        assert.equal(r.code, 401);
        r = await invoke({ method: 'POST', headers: adminHeaders, body: { action: 'logout' } });
        assert.match(r.headers['Set-Cookie'], /Max-Age=0/);
    } finally { global.fetch = realFetch; }
});

test('proxy returns useful configuration and Google failure errors', async () => {
    delete process.env.DRIVE_SCRIPT_URL;
    let r = await invoke({ method: 'GET', headers: {}, query: {} });
    assert.equal(r.code, 503); assert.match(r.value.error, /not configured/);
    process.env.DRIVE_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
    const realFetch = global.fetch;
    global.fetch = async () => ({ ok: true, json: async () => { throw new Error('HTML sign-in page'); } });
    try { r = await invoke({ method: 'GET', headers: {}, query: {} }); assert.equal(r.code, 502); }
    finally { global.fetch = realFetch; }
});
