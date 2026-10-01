app.controller('AdminDashboardController', function ($scope, $location, AuthService, ContentService) {

    var TABS = {
        movies: 'Movies',
        music: 'Music',
        celebrities: 'Celebrities',
        trending: 'Trending',
        influencers: 'Influencers'
    };

    $scope.activeTab = 'movies';
    $scope.activeSection = 'content'; // content | ticker | profile
    $scope.searchQuery = '';
    $scope.showModal = false;
    $scope.editMode = false;
    $scope.formItem = {};
    $scope.confirmDeleteItem = null;
    $scope.adminUsername = 'admin';

    function refreshList() {
        $scope.contentList = ContentService.getByCategory(TABS[$scope.activeTab]);
    }
    refreshList();
    $scope.$on('contentUpdated', refreshList);

    $scope.setTab = function (tab) {
        $scope.activeTab = tab;
        $scope.activeSection = 'content';
        $scope.searchQuery = '';
        refreshList();
    };

    $scope.setSection = function (section) {
        $scope.activeSection = section;
    };

    $scope.filteredList = function () {
        var q = ($scope.searchQuery || '').toLowerCase().trim();
        if (!q) return $scope.contentList;
        return $scope.contentList.filter(function (item) {
            return item.title.toLowerCase().indexOf(q) > -1 ||
                (item.year || '').indexOf(q) > -1 ||
                (item.status || '').toLowerCase().indexOf(q) > -1;
        });
    };

    // ---------- Add / Edit Modal ----------
    $scope.openAddModal = function () {
        $scope.editMode = false;
        $scope.saveError = '';
        $scope.formItem = {
            category: TABS[$scope.activeTab],
            status: 'Published',
            rating: '',
            year: '',
            image: '',
            trailer: '',
            title: '',
            summary: '',
            content: ''
        };
        $scope.showModal = true;
    };

    $scope.openEditModal = function (item) {
        $scope.editMode = true;
        $scope.saveError = '';
        $scope.formItem = angular.copy(item);
        $scope.showModal = true;
    };

    $scope.closeModal = function () {
        if ($scope.saving || $scope.imageLoading) return;
        $scope.showModal = false;
        $scope.formItem = {};
    };

    $scope.onImageFileSelected = function (files) {
        if (!files || !files.length) return;
        $scope.imageLoading = true;
        ContentService.fileToBase64(files[0], function (base64) {
            $scope.$evalAsync(function () { $scope.formItem.image = base64; $scope.imageLoading = false; });
        }, function (message) {
            $scope.$evalAsync(function () { $scope.saveError = message; $scope.imageLoading = false; });
        });
    };

    function perform(operation, success) {
        if ($scope.saving) return;
        $scope.saving = true;
        $scope.saveError = '';
        operation().then(function () {
            if (success) success();
        }, function (error) { $scope.saveError = error.message; })
            .finally(function () { $scope.saving = false; refreshList(); });
    }

    $scope.saveItem = function () {
        if (!$scope.formItem.title || !$scope.formItem.category || $scope.imageLoading) return;
        perform(function () {
            return $scope.editMode ? ContentService.update($scope.formItem) : ContentService.add($scope.formItem);
        }, function () { $scope.showModal = false; $scope.formItem = {}; });
    };

    // ---------- Pin ----------
    $scope.togglePin = function (item) {
        perform(function () { return ContentService.togglePin(item.id); });
    };

    // ---------- Delete ----------
    $scope.askDelete = function (item) {
        $scope.confirmDeleteItem = item;
    };

    $scope.cancelDelete = function () {
        $scope.confirmDeleteItem = null;
    };

    $scope.confirmDelete = function () {
        if ($scope.confirmDeleteItem) {
            perform(function () { return ContentService.remove($scope.confirmDeleteItem.id); },
                function () { $scope.confirmDeleteItem = null; });
        }
    };

    // ---------- Breaking News Ticker ----------
    $scope.tickerText = ContentService.getTicker();
    $scope.saveTicker = function () {
        perform(function () { return ContentService.setTicker($scope.tickerText); },
            function () { $scope.storageMessage = 'Ticker saved to Drive.'; });
    };

    $scope.importBackup = function (files) {
        if (!files || !files.length || $scope.saving) return;
        if (!window.confirm('Import this backup? Items with matching IDs will be replaced. Keep a copy of the backup file.')) return;
        var reader = new FileReader();
        reader.onerror = function () { $scope.$evalAsync(function () { $scope.saveError = 'Backup could not be read.'; }); };
        reader.onload = function () {
            $scope.$evalAsync(function () {
                var data;
                try { data = JSON.parse(reader.result); }
                catch (e) { $scope.saveError = 'Choose a valid JSON backup.'; return; }
                perform(function () {
                    return ContentService.importLegacy(data, function (count, total) {
                        $scope.storageMessage = 'Imported ' + count + ' of ' + total + ' items.';
                    });
                }, function () { $scope.storageMessage = 'Import completed. Check published content in another browser.'; });
            });
        };
        reader.readAsText(files[0]);
    };

    // ---------- Account ----------
    $scope.logout = function () {
        AuthService.logout().then(function () { $location.path('/home'); },
            function () { $scope.saveError = 'Logout failed. Please retry.'; });
    };
});
