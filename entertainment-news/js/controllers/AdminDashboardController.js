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
        $scope.formItem = angular.copy(item);
        $scope.showModal = true;
    };

    $scope.closeModal = function () {
        $scope.showModal = false;
        $scope.formItem = {};
    };

    $scope.onImageFileSelected = function (files) {
        if (!files || !files.length) return;
        ContentService.fileToBase64(files[0], function (base64) {
            $scope.$apply(function () {
                $scope.formItem.image = base64;
            });
        });
    };

    $scope.saveItem = function () {
        if (!$scope.formItem.title || !$scope.formItem.category) return;

        if ($scope.editMode) {
            ContentService.update($scope.formItem);
        } else {
            ContentService.add($scope.formItem);
        }
        refreshList();
        $scope.closeModal();
    };

    // ---------- Pin ----------
    $scope.togglePin = function (item) {
        ContentService.togglePin(item.id);
        refreshList();
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
            ContentService.remove($scope.confirmDeleteItem.id);
            $scope.confirmDeleteItem = null;
            refreshList();
        }
    };

    // ---------- Breaking News Ticker ----------
    $scope.tickerText = ContentService.getTicker();
    $scope.saveTicker = function () {
        ContentService.setTicker($scope.tickerText);
    };

    // ---------- Account ----------
    $scope.logout = function () {
        AuthService.logout();
        $location.path('/home');
    };
});
