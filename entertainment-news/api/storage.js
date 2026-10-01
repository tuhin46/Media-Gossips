var crypto = require('node:crypto');

var COOKIE = '__Host-mg_admin';
var SESSION_SECONDS = 8 * 60 * 60;
var MAX_BODY = 1500000;
var WRITES = ['add', 'update', 'remove', 'pin', 'ticker', 'importOne'];

function digest(value) {
    return crypto.createHash('sha256').update(String(value)).digest();
}

function equal(a, b) {
    return crypto.timingSafeEqual(digest(a), digest(b));
}

function authenticated(req) {
    var secret = process.env.SESSION_SECRET || '';
    if (secret.length < 32) return false;
    var match = (req.headers.cookie || '').match(/(?:^|;\s*)__Host-mg_admin=([^;]+)/);
    if (!match) return false;
    var parts = match[1].split('.');
    if (parts.length !== 2) return false;
    var signature = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
    if (!equal(parts[1], signature)) return false;
    try {
        var data = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        return data.user === 'admin' && data.exp > Date.now() &&
            data.exp <= Date.now() + SESSION_SECONDS * 1000;
    } catch (e) { return false; }
}

function cookie(res, login) {
    var value = '';
    if (login) {
        var payload = Buffer.from(JSON.stringify({ user: 'admin', exp: Date.now() + SESSION_SECONDS * 1000,
            nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
        value = payload + '.' + crypto.createHmac('sha256', process.env.SESSION_SECRET)
            .update(payload).digest('base64url');
    }
    res.setHeader('Set-Cookie', COOKIE + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' +
        (login ? SESSION_SECONDS : 0));
}

function sameOrigin(req) {
    try {
        var origin = new URL(req.headers.origin);
        return origin.protocol === 'https:' && origin.host === req.headers.host;
    } catch (e) { return false; }
}

async function body(req) {
    var data = req.body;
    if (data === undefined) {
        var chunks = [];
        var length = 0;
        for await (var chunk of req) {
            length += chunk.length;
            if (length > MAX_BODY) throw { status: 413, message: 'Upload is too large. Use a smaller image.' };
            chunks.push(chunk);
        }
        data = Buffer.concat(chunks).toString('utf8');
    }
    if (Buffer.isBuffer(data)) data = data.toString('utf8');
    if (typeof data === 'string') {
        if (Buffer.byteLength(data) > MAX_BODY) throw { status: 413, message: 'Upload is too large.' };
        try { data = JSON.parse(data); } catch (e) { throw { status: 400, message: 'Invalid JSON.' }; }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw { status: 400, message: 'Invalid request.' };
    if (Buffer.byteLength(JSON.stringify(data)) > MAX_BODY) throw { status: 413, message: 'Upload is too large.' };
    return data;
}

async function drive(action, input) {
    var url = process.env.DRIVE_SCRIPT_URL || '';
    var key = process.env.DRIVE_API_KEY || '';
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url) ||
        key.length < 32 || (process.env.SESSION_SECRET || '').length < 32) {
        throw { status: 503, message: 'Shared storage is not configured yet.' };
    }
    var response;
    try {
        response = await fetch(url, { method: 'POST', redirect: 'follow',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key, action: action, input: input }),
            signal: AbortSignal.timeout(25000) });
    } catch (e) { throw { status: 502, message: 'Drive could not be reached. Check before retrying your save.' }; }
    var result;
    try { result = await response.json(); }
    catch (e) { throw { status: 502, message: 'Google returned an unexpected response. Check the web app deployment.' }; }
    if (!response.ok || !result.ok) {
        throw { status: result.status || 502, message: result.error || 'Drive request failed.' };
    }
    return result.data;
}

module.exports = async function (req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
        var admin = authenticated(req);
        var query = req.query || {};
        if (req.method === 'GET') {
            if (query.action === 'session') return res.status(200).json({ authenticated: admin });
            if (query.action === 'image') {
                var image = await drive('image', { id: Number(query.id), admin: admin });
                res.setHeader('Content-Type', image.mime);
                return res.status(200).send(Buffer.from(image.base64, 'base64'));
            }
            if (query.action === 'admin' && !admin) throw { status: 401, message: 'Please log in again.' };
            var state = await drive('read', { admin: query.action === 'admin' && admin });
            return res.status(200).json(state);
        }
        if (req.method !== 'POST') {
            res.setHeader('Allow', 'GET, POST');
            throw { status: 405, message: 'Method not allowed.' };
        }
        if (!sameOrigin(req)) throw { status: 403, message: 'This request must come from the website.' };
        var input = await body(req);
        if (input.action === 'login') {
            if (typeof input.password !== 'string' || input.password.length > 256) {
                throw { status: 400, message: 'Invalid login request.' };
            }
            var ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
            await drive('login', { username: input.username, password: input.password,
                client: digest(ip).toString('hex') });
            cookie(res, true);
            return res.status(200).json({ authenticated: true });
        }
        if (input.action === 'logout') {
            cookie(res, false);
            return res.status(200).json({ authenticated: false });
        }
        if (!admin) throw { status: 401, message: 'Please log in again.' };
        if (WRITES.indexOf(input.action) === -1) throw { status: 400, message: 'Unknown action.' };
        if (typeof input.requestId !== 'string' || !/^[a-f0-9]{32}$/.test(input.requestId)) {
            throw { status: 400, message: 'Invalid save identifier.' };
        }
        var saved = await drive(input.action, { item: input.item, id: input.id, version: input.version,
            text: input.text, requestId: input.requestId });
        return res.status(200).json(saved);
    } catch (error) {
        return res.status(error.status || 500).json({ error: error.status ? error.message : 'Storage request failed.' });
    }
};
