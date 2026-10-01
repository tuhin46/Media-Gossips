app.factory('AuthService', function ($http, $q, $rootScope) {
    var loggedIn = false;
    function set(value) {
        loggedIn = value;
        $rootScope.$broadcast('authUpdated', value);
        return value;
    }
    return {
        isLoggedIn: function () { return loggedIn; },
        check: function () {
            return $http.get('/api/storage?action=session').then(function (response) {
                return set(!!response.data.authenticated);
            }, function () { return set(false); });
        },
        login: function (username, password) {
            return $http.post('/api/storage', { action: 'login', username: username, password: password })
                .then(function () { return set(true); }, function (response) {
                    set(false);
                    return $q.reject(new Error(response.data && response.data.error || 'Login could not be completed.'));
                });
        },
        logout: function () {
            return $http.post('/api/storage', { action: 'logout' }).then(function () { set(false); });
        }
    };
});
