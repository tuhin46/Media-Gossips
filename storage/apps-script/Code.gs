var CATEGORIES = ['Movies', 'Music', 'Celebrities', 'Trending', 'Influencers'];
var DB_NAME = 'media-gossips-data.json';
var MAX_IMAGE = 1000000;
var MAX_DATABASE = 20000000;
var MAX_RESPONSE = 3000000;

function fail_(status, message) {
    var error = new Error(message);
    error.status = status;
    throw error;
}

function json_(value) {
    return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function properties_() {
    return PropertiesService.getScriptProperties();
}

function constantEqual_(a, b) {
    var left = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(a));
    var right = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(b));
    var diff = 0;
    for (var i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
    return diff === 0;
}

function database_() {
    var id = properties_().getProperty('DATA_FILE_ID');
    if (!id) fail_(503, 'Run setupStorage before deploying.');
    var file = DriveApp.getFileById(id);
    return { file: file, state: JSON.parse(file.getBlob().getDataAsString('UTF-8')) };
}

function folder_() {
    return DriveApp.getFolderById(properties_().getProperty('DRIVE_FOLDER_ID'));
}

function snapshot_(state, admin) {
    return { revision: state.revision, ticker: state.ticker,
        items: state.items.filter(function (item) { return admin || item.status === 'Published'; })
            .map(function (item) {
                var copy = JSON.parse(JSON.stringify(item));
                if (/^data:image\//.test(copy.image)) {
                    copy.image = '/api/storage?action=image&id=' + copy.id + '&v=' + copy.version;
                }
                return copy;
            }) };
}

function validate_(item, old) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail_(400, 'Invalid content.');
    var result = {};
    var limits = { title: 300, rating: 20, year: 20, summary: 4000, content: 100000, trailer: 1000 };
    Object.keys(limits).forEach(function (key) {
        var value = item[key] === undefined ? '' : String(item[key]);
        if (value.length > limits[key]) fail_(400, key + ' is too long.');
        result[key] = value;
    });
    if (!result.title.trim() || CATEGORIES.indexOf(item.category) === -1) fail_(400, 'Title and category are required.');
    result.category = item.category;
    result.status = item.status || 'Published';
    if (['Published', 'Draft'].indexOf(result.status) === -1) fail_(400, 'Invalid status.');
    result.pinned = !!item.pinned;
    var image = String(item.image || '');
    if (old && image === '/api/storage?action=image&id=' + old.id + '&v=' + old.version) image = old.image;
    if (image.length > MAX_IMAGE) fail_(413, 'Image is too large. Upload a smaller image.');
    if (image && !/^https:\/\/[^\s]+$/i.test(image) &&
        !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) {
        fail_(400, 'Use an HTTPS image URL or upload a JPEG, PNG, or WebP image.');
    }
    result.image = image;
    if (result.trailer && !/^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\/[A-Za-z0-9_-]+(?:\?[^\s]*)?$/.test(result.trailer)) {
        fail_(400, 'Use a YouTube embed URL for the trailer.');
    }
    return result;
}

function save_(db, requestId) {
    db.state.revision += 1;
    db.state.requests = (db.state.requests || []).concat(requestId).slice(-100);
    var encoded = JSON.stringify(db.state);
    if (Utilities.newBlob(encoded).getBytes().length > MAX_DATABASE) fail_(413, 'The storage limit for this integration was reached.');
    if (Utilities.newBlob(JSON.stringify(snapshot_(db.state, true))).getBytes().length > MAX_RESPONSE) fail_(413, 'The content response is too large.');
    var slot = 'backup-' + (db.state.revision % 10) + '.json';
    var files = folder_().getFilesByName(slot);
    var before = db.file.getBlob().getDataAsString('UTF-8');
    if (files.hasNext()) files.next().setContent(before);
    else folder_().createFile(slot, before, MimeType.PLAIN_TEXT);
    db.file.setContent(encoded);
}

function login_(input) {
    var password = properties_().getProperty('ADMIN_PASSWORD') || '';
    if (password.length < 16) fail_(503, 'Set an admin password with at least 16 characters.');
    var props = properties_();
    var now = Date.now();
    var buckets = JSON.parse(props.getProperty('LOGIN_FAILURES') || '{"since":0,"total":0,"clients":{}}');
    if (now - buckets.since >= 600000) buckets = { since: now, total: 0, clients: {} };
    var client = /^[a-f0-9]{64}$/.test(input.client || '') ? input.client : 'unknown';
    var attempts = Number(buckets.clients[client] || 0);
    if (attempts >= 10 || buckets.total >= 100) fail_(429, 'Too many login attempts. Wait 10 minutes.');
    if (input.username !== 'admin' || !constantEqual_(input.password || '', password)) {
        buckets.clients[client] = attempts + 1;
        buckets.total += 1;
        props.setProperty('LOGIN_FAILURES', JSON.stringify(buckets));
        fail_(401, 'Invalid username or password.');
    }
    delete buckets.clients[client];
    props.setProperty('LOGIN_FAILURES', JSON.stringify(buckets));
    return { authenticated: true };
}

function doGet() {
    return json_({ ok: true, service: 'Media Gossips storage', note: 'Website requests use authenticated POST.' });
}

function doPost(e) {
    var lock;
    try {
        if (!e || !e.postData || e.postData.contents.length > 1500000) fail_(413, 'Invalid or oversized request.');
        var request = JSON.parse(e.postData.contents);
        var key = properties_().getProperty('DRIVE_API_KEY') || '';
        if (key.length < 32 || !constantEqual_(request.key || '', key)) fail_(403, 'Access denied.');
        var input = request.input || {};
        lock = LockService.getScriptLock();
        if (!lock.tryLock(10000)) fail_(503, 'Storage is busy. Retry shortly.');
        if (request.action === 'login') return json_({ ok: true, data: login_(input) });
        var db = database_();
        if (request.action === 'read') return json_({ ok: true, data: snapshot_(db.state, !!input.admin) });
        if (request.action === 'image') {
            var found = db.state.items.filter(function (item) { return item.id === input.id; })[0];
            if (!found || (!input.admin && found.status !== 'Published')) fail_(404, 'Image not found.');
            var match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(found.image);
            if (!match) fail_(404, 'Image not found.');
            return json_({ ok: true, data: { mime: match[1], base64: match[2] } });
        }
        if (!/^[a-f0-9]{32}$/.test(input.requestId || '')) fail_(400, 'Invalid save identifier.');
        if ((db.state.requests || []).indexOf(input.requestId) !== -1) {
            return json_({ ok: true, data: snapshot_(db.state, true) });
        }
        var index = db.state.items.map(function (item) { return item.id; }).indexOf(input.id);
        var old = index >= 0 ? db.state.items[index] : null;
        if (['update', 'remove', 'pin'].indexOf(request.action) !== -1) {
            if (!old) fail_(404, 'Content not found.');
            if (input.version !== old.version) fail_(409, 'This content changed. Reload it before editing again.');
        }
        if (request.action === 'add') {
            var added = validate_(input.item);
            added.id = Math.max(Date.now(), Number(db.state.nextId || 0) + 1);
            db.state.nextId = added.id;
            added.version = 1;
            db.state.items.push(added);
        } else if (request.action === 'update') {
            var updated = validate_(input.item, old);
            updated.id = old.id;
            updated.version = old.version + 1;
            db.state.items[index] = updated;
        } else if (request.action === 'remove') {
            db.state.items.splice(index, 1);
        } else if (request.action === 'pin') {
            old.pinned = !old.pinned;
            old.version += 1;
        } else if (request.action === 'ticker') {
            if (typeof input.text !== 'string' || input.text.length > 4000) fail_(400, 'Ticker is too long.');
            db.state.ticker = input.text;
        } else if (request.action === 'importOne') {
            var imported = validate_(input.item, old);
            if (!Number.isSafeInteger(input.id) || input.id <= 0) fail_(400, 'Invalid import ID.');
            imported.id = input.id;
            imported.version = old ? old.version + 1 : 1;
            if (old) db.state.items[index] = imported;
            else db.state.items.push(imported);
            db.state.nextId = Math.max(Number(db.state.nextId || 0), imported.id);
        } else fail_(400, 'Unknown action.');
        save_(db, input.requestId);
        return json_({ ok: true, data: snapshot_(db.state, true) });
    } catch (error) {
        return json_({ ok: false, status: error.status || 500,
            error: error.status ? error.message : 'Drive operation failed. Check Apps Script executions.' });
    } finally {
        if (lock) lock.releaseLock();
    }
}

function setupStorage() {
    if (Session.getEffectiveUser().getEmail() !== 'smtuhin46@gmail.com') {
        throw new Error('Run setupStorage while signed in as smtuhin46@gmail.com.');
    }
    var props = properties_();
    if ((props.getProperty('DRIVE_API_KEY') || '').length < 32) throw new Error('Set DRIVE_API_KEY first (at least 32 characters).');
    if ((props.getProperty('ADMIN_PASSWORD') || '').length < 16) throw new Error('Set ADMIN_PASSWORD first (at least 16 characters).');
    if (!props.getProperty('DRIVE_FOLDER_ID')) throw new Error('Set DRIVE_FOLDER_ID first.');
    if (props.getProperty('DATA_FILE_ID')) {
        database_();
        console.log('Storage already initialized; existing data preserved.');
        return;
    }
    var folder = folder_();
    var existing = folder.getFilesByName(DB_NAME);
    if (existing.hasNext()) {
        props.setProperty('DATA_FILE_ID', existing.next().getId());
        database_();
        console.log('Existing storage file reused.');
        return;
    }
    var seeds = folder.getFilesByName('seed-content.json');
    if (!seeds.hasNext()) throw new Error('Upload seed-content.json into the selected Drive folder first.');
    var seed = JSON.parse(seeds.next().getBlob().getDataAsString('UTF-8'));
    var state = { revision: 0, ticker: seed.ticker || '', items: [], requests: [], nextId: 0 };
    seed.items.forEach(function (item) {
        var copy = validate_(item);
        copy.id = item.id;
        copy.version = 1;
        state.items.push(copy);
    });
    var file = folder.createFile(DB_NAME, JSON.stringify(state), MimeType.PLAIN_TEXT);
    props.setProperty('DATA_FILE_ID', file.getId());
    console.log('Storage ready. Data file created in the selected folder.');
}
