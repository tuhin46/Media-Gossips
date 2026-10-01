app.factory('ContentService', function ($rootScope, $http, $q) {
    var db = [];
    var ticker = '';
    var pending = {};
    var svc = {};
    function apply(state) {
        db = state.items;
        ticker = state.ticker;
        $rootScope.$broadcast('contentUpdated');
        $rootScope.$broadcast('tickerUpdated', ticker);
        return state;
    }
    function error(response) {
        return $q.reject(new Error(response.data && response.data.error ||
            'Storage could not be reached. Check the website before retrying.'));
    }
    function requestId() {
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.prototype.map.call(bytes, function (byte) { return ('0' + byte.toString(16)).slice(-2); }).join('');
    }
    function write(action, input) {
        var body = angular.extend({ action: action }, input);
        var fingerprint = JSON.stringify(body);
        body.requestId = pending[fingerprint] || requestId();
        pending[fingerprint] = body.requestId;
        return $http.post('/api/storage', body).then(function (response) {
            delete pending[fingerprint];
            return apply(response.data);
        }, error);
    }
    function sort(list) {
        return list.slice().sort(function (a, b) {
            return ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (b.id - a.id);
        });
    }
    svc.load = function (admin) {
        return $http.get('/api/storage', { params: { action: admin ? 'admin' : 'public' } })
            .then(function (response) { return apply(response.data); }, error);
    };
    svc.getAll = function () { return sort(db); };
    svc.getPublished = function () { return sort(db.filter(function (item) { return item.status === 'Published'; })); };
    svc.getByCategory = function (category, publishedOnly) {
        return sort(db.filter(function (item) {
            return item.category === category && (!publishedOnly || item.status === 'Published');
        }));
    };
    svc.getById = function (id) {
        return db.filter(function (item) { return item.id === Number(id); })[0];
    };
    svc.add = function (item) { return write('add', { item: item }); };
    svc.update = function (item) { return write('update', { id: item.id, version: item.version, item: item }); };
    svc.remove = function (id) {
        var item = svc.getById(id);
        return write('remove', { id: id, version: item && item.version });
    };
    svc.togglePin = function (id) {
        var item = svc.getById(id);
        return write('pin', { id: id, version: item && item.version });
    };
    svc.getTicker = function () { return ticker; };
    svc.setTicker = function (text) { return write('ticker', { text: text }); };
    svc.fileToBase64 = function (file, callback, onError) {
        var reader = new FileReader();
        reader.onerror = function () { if (onError) onError('Image could not be read.'); };
        reader.onload = function () {
            var image = new Image();
            image.onerror = function () { if (onError) onError('Choose a valid image.'); };
            image.onload = function () {
                var scale = Math.min(1, 800 / Math.max(image.width, image.height));
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                var result = canvas.toDataURL('image/jpeg', 0.7);
                if (result.length > 1000000) { if (onError) onError('Use a smaller image.'); return; }
                callback(result);
            };
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    };
    svc.importLegacy = function (data, progress) {
        var items = Array.isArray(data) ? data : data.items;
        if (!Array.isArray(items)) return $q.reject(new Error('The backup must contain a content array.'));
        var chain = $q.when();
        items.forEach(function (item, index) {
            chain = chain.then(function () {
                var prepared = angular.copy(item);
                var ready = $q.when(prepared);
                if (/^data:image\//.test(prepared.image || '') && prepared.image.length > 1000000) {
                    ready = $q(function (resolve, reject) {
                        try {
                            var parts = prepared.image.split(',');
                            var decoded = atob(parts[1]);
                            var bytes = new Uint8Array(decoded.length);
                            for (var i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
                            svc.fileToBase64(new Blob([bytes]), function (value) {
                                prepared.image = value;
                                resolve(prepared);
                            }, function (message) { reject(new Error(message)); });
                        } catch (error) { reject(new Error('An imported image could not be read.')); }
                    });
                }
                return ready.then(function (preparedItem) {
                    return write('importOne', { id: Number(preparedItem.id), item: preparedItem });
                });
            }).then(function () { if (progress) progress(index + 1, items.length); });
        });
        if (typeof data.ticker === 'string') chain = chain.then(function () { return svc.setTicker(data.ticker); });
        return chain;
    };
    return svc;
});
