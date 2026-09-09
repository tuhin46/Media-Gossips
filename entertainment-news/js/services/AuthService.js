app.factory('AuthService', function () {

    var SESSION_KEY = 'ep_admin_session';
    var PASSWORD_KEY = 'ep_admin_password';
    var VALID_USER = 'admin';
    var DEFAULT_PASS = 'pulse@2026';

    var svc = {};

    function getCurrentPassword() {
        return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASS;
    }

    svc.login = function (username, password) {
        if (username === VALID_USER && password === getCurrentPassword()) {
            sessionStorage.setItem(SESSION_KEY, 'true');
            return true;
        }
        return false;
    };

    svc.logout = function () {
        sessionStorage.removeItem(SESSION_KEY);
    };

    svc.isLoggedIn = function () {
        return sessionStorage.getItem(SESSION_KEY) === 'true';
    };

    // Persists a new admin password (used by the "Forgot Password" flow)
    svc.changePassword = function (newPassword) {
        if (!newPassword || newPassword.length < 6) {
            return false;
        }
        localStorage.setItem(PASSWORD_KEY, newPassword);
        return true;
    };

    return svc;
});
