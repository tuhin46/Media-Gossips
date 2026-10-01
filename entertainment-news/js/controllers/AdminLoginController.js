app.controller('AdminLoginController', function ($scope, $location, AuthService) {
    $scope.view = 'login';
    $scope.credentials = { username: '', password: '' };
    $scope.loginError = '';
    $scope.submitLogin = function () {
        if ($scope.loggingIn) return;
        $scope.loggingIn = true;
        $scope.loginError = '';
        AuthService.login($scope.credentials.username, $scope.credentials.password).then(function () {
            $scope.credentials.password = '';
            $location.path('/admin/dashboard');
        }, function (error) { $scope.loginError = error.message; })
            .finally(function () { $scope.loggingIn = false; });
    };
});
