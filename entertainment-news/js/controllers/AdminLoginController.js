app.controller('AdminLoginController', function ($scope, $location, AuthService) {

    // view: 'login' | 'forgot'
    $scope.view = 'login';

    $scope.credentials = { username: '', password: '' };
    $scope.loginError = '';

    $scope.resetForm = { newPassword: '', confirmPassword: '' };
    $scope.resetError = '';
    $scope.resetSuccess = '';

    $scope.submitLogin = function () {
        if (AuthService.login($scope.credentials.username, $scope.credentials.password)) {
            $scope.loginError = '';
            $location.path('/admin/dashboard');
        } else {
            $scope.loginError = 'Invalid username or password. Please try again.';
        }
    };

    $scope.showForgotPassword = function () {
        $scope.view = 'forgot';
        $scope.resetForm = { newPassword: '', confirmPassword: '' };
        $scope.resetError = '';
        $scope.resetSuccess = '';
    };

    $scope.backToLogin = function () {
        $scope.view = 'login';
        $scope.loginError = '';
    };

    $scope.submitReset = function () {
        $scope.resetError = '';
        $scope.resetSuccess = '';

        if (!$scope.resetForm.newPassword || !$scope.resetForm.confirmPassword) {
            $scope.resetError = 'Please fill in both password fields.';
            return;
        }

        if ($scope.resetForm.newPassword !== $scope.resetForm.confirmPassword) {
            $scope.resetError = 'Passwords do not match.';
            return;
        }

        if ($scope.resetForm.newPassword.length < 6) {
            $scope.resetError = 'Password must be at least 6 characters long.';
            return;
        }

        AuthService.changePassword($scope.resetForm.newPassword);
        $scope.resetSuccess = 'Password updated successfully. You can now log in with your new password.';
        $scope.credentials.username = 'admin';
        $scope.credentials.password = '';
        $scope.view = 'login';
    };
});
