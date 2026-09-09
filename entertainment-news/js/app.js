var app = angular.module("entertainmentApp", ["ngRoute"]);

app.config(function ($routeProvider, $locationProvider) {
    $locationProvider.hashPrefix('!');

    $routeProvider
        .when("/home", {
            templateUrl: "pages/home.html",
            controller: "HomeController"
        })
        .when("/movies", {
            templateUrl: "pages/movies.html",
            controller: "MoviesController"
        })
        .when("/music", {
            templateUrl: "pages/music.html",
            controller: "MusicController"
        })
        .when("/celebrities", {
            templateUrl: "pages/celebrities.html",
            controller: "CelebrityController"
        })
        .when("/trending", {
            templateUrl: "pages/trending.html",
            controller: "TrendingController"
        })
        .when("/influencers", {
            templateUrl: "pages/influencers.html",
            controller: "InfluencerController"
        })
        .when("/bookmarks", {
            templateUrl: "pages/bookmarks.html",
            controller: "BookmarksController"
        })
        .when("/news/:id", {
            templateUrl: "pages/news-details.html",
            controller: "NewsController"
        })
        .when("/about", {
            templateUrl: "pages/about.html"
        })
        .when("/admin/login", {
            templateUrl: "pages/admin-login.html",
            controller: "AdminLoginController"
        })
        .when("/admin/dashboard", {
            templateUrl: "pages/admin-dashboard.html",
            controller: "AdminDashboardController",
            resolve: {
                authCheck: function ($q, $location, AuthService) {
                    if (AuthService.isLoggedIn()) {
                        return true;
                    }
                    $location.path('/admin/login');
                    return $q.reject('not-authenticated');
                }
            }
        })
        .otherwise({
            redirectTo: "/home"
        });
});

// Root Controller: Shared Bookmarks, Trailer Modal, Ticker & Admin State
app.controller('AppController', function ($scope, $sce, $location, AuthService, ContentService) {
    // Load Bookmarks from LocalStorage
    $scope.bookmarks = JSON.parse(localStorage.getItem('ep_bookmarks') || '[]');

    $scope.isBookmarked = function (id) {
        return $scope.bookmarks.some(function (item) { return item.id === id; });
    };

    $scope.toggleBookmark = function (item, $event) {
        if ($event) $event.stopPropagation();
        var idx = $scope.bookmarks.findIndex(function (b) { return b.id === item.id; });
        if (idx > -1) {
            $scope.bookmarks.splice(idx, 1);
        } else {
            $scope.bookmarks.push(item);
        }
        localStorage.setItem('ep_bookmarks', JSON.stringify($scope.bookmarks));
    };

    // Video Trailer Modal Logic
    $scope.activeTrailer = null;
    $scope.openTrailer = function (item, $event) {
        if ($event) $event.stopPropagation();
        $scope.activeTrailer = {
            title: item.title,
            videoUrl: $sce.trustAsResourceUrl(item.trailer || "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1")
        };
    };

    $scope.closeTrailer = function () {
        $scope.activeTrailer = null;
    };

    // Breaking News Ticker (managed live from Admin Panel)
    $scope.tickerText = ContentService.getTicker();
    $scope.$on('tickerUpdated', function (event, text) {
        $scope.tickerText = text;
    });

    // Admin Access State (drives the navbar lock icon)
    $scope.isAdminLoggedIn = AuthService.isLoggedIn();
    $scope.$on('$routeChangeSuccess', function () {
        $scope.isAdminLoggedIn = AuthService.isLoggedIn();
    });
});

app.controller('HomeController', function ($scope, ContentService) {
    $scope.allList = ContentService.getPublished();
    $scope.spotlightList = ContentService.getByCategory('Influencers', true).slice(0, 2)
        .concat(ContentService.getByCategory('Celebrities', true).slice(0, 2));
    $scope.selectedCategory = '';
    $scope.searchInput = '';
    $scope.activeSearch = '';
    $scope.searchResults = [];

    // Triggered on click of Search Button or Enter key
    $scope.executeSearch = function () {
        $scope.activeSearch = $scope.searchInput.trim();
        performFilter();
    };

    // Live search as you type
    $scope.onTyping = function () {
        $scope.activeSearch = $scope.searchInput.trim();
        performFilter();
    };

    // Clear Search Action
    $scope.clearSearch = function () {
        $scope.searchInput = '';
        $scope.activeSearch = '';
        $scope.searchResults = [];
    };

    // Category Pill Filter
    $scope.setCategory = function (cat) {
        $scope.selectedCategory = cat;
        if ($scope.activeSearch) {
            performFilter();
        }
    };

    function performFilter() {
        if (!$scope.activeSearch && !$scope.selectedCategory) {
            $scope.searchResults = [];
            return;
        }

        var query = $scope.activeSearch.toLowerCase();
        $scope.searchResults = $scope.allList.filter(function (item) {
            var matchQuery = !query ||
                item.title.toLowerCase().indexOf(query) > -1 ||
                item.category.toLowerCase().indexOf(query) > -1 ||
                item.year.indexOf(query) > -1 ||
                item.summary.toLowerCase().indexOf(query) > -1;

            var matchCategory = !$scope.selectedCategory || item.category === $scope.selectedCategory;

            return matchQuery && matchCategory;
        });
    }
});

app.controller('MoviesController', function ($scope, ContentService) {
    $scope.moviesList = ContentService.getByCategory("Movies", true);
});

app.controller('MusicController', function ($scope, ContentService) {
    $scope.musicList = ContentService.getByCategory("Music", true);
});

app.controller('CelebrityController', function ($scope, ContentService) {
    $scope.celebrityList = ContentService.getByCategory("Celebrities", true);
});

app.controller('TrendingController', function ($scope, ContentService) {
    $scope.trendingList = ContentService.getByCategory("Trending", true);
});

app.controller('InfluencerController', function ($scope, ContentService) {
    $scope.influencerList = ContentService.getByCategory("Influencers", true);
});

app.controller('BookmarksController', function ($scope) {
    // Uses parent scope bookmarks
});

app.controller('NewsController', function ($scope, $routeParams, ContentService) {
    var id = parseInt($routeParams.id);
    var found = ContentService.getById(id);
    $scope.article = found || ContentService.getAll()[0];
});
