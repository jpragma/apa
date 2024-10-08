screen.orientation.lock('portrait');

var apaApp = angular.module('apaApp', ['ngRoute','ui.bootstrap', 'LocalStorageModule']);
apaApp.directive('onLongPress', function ($timeout) {
    return {
        restrict: 'A',
        link: function($scope, $elm, $attrs) {
            $elm.bind('touchstart', function (evt) {
                $scope.longPress = true;
                $timeout(function () {
                    if ($scope.longPress) {
                        $scope.$apply(function () {
                            $scope.$eval($attrs.onLongPress)
                        });
                    }
                }, 2000);
            });
            $elm.bind('touchend', function (evt) {
                $scope.longPress = false;
                if ($attrs.onTouchEnd) {
                    $scope.$apply(function () {
                        $scope.$eval($attrs.onTouchEnd)
                    });
                }
            });
        }
    }
});
apaApp.directive('selectOnClick', ['$window', function ($window) {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            element.on('click', function () {
                if (!$window.getSelection().toString()) {
                    // Required for mobile Safari
                    this.setSelectionRange(0, this.value.length)
                }
            });
        }
    };
}]);

var Command = function(execute, undo) {
    this.execute = execute;
    this.undo = undo;
};

var addPoints = function (game, command, balls) {
    var points = 0;
    for (var i=0; i<balls.length; i++) {
        points += (balls[i] == 9) ? 2 : 1;
        game.curRack.balls[balls[i]] = (game.curPlayerIdx + 1); // mark ball that is gone
    }
    game.curRack.rackScore[game.curPlayerIdx] += points;
    game.score[game.curPlayerIdx] += points;
};
var removePoints = function (game, command, balls) {
    var points = 0;
    for (var i=0; i<balls.length; i++) {
        points += (balls[i] == 9) ? 2 : 1;
        game.curRack.balls[balls[i]] = 0; // re-enable the ball
    }
    game.curRack.rackScore[game.curPlayerIdx] -= points;
    game.score[game.curPlayerIdx] -= points;
};
var addDefenseIfNecessary = function(game, command, defense) {
    command.defense = defense;
    if (defense) {
        game.defensiveShots[game.curPlayerIdx]++;
    }
};
var removeDefenseIfNecessary = function(game, command) {
    if (command.defense) {
        game.defensiveShots[game.curPlayerIdx]--;
    }
};
var MadeCommand = function(game, defense) {
    var rack = game.curRack;
    var execute = function() {
        addDefenseIfNecessary(game, this, defense);
        var balls = rack.thisInningMadeBalls();
        this.balls = balls; // save for ref in undo
        addPoints(game, this, balls);
    };
    var undo = function () {
        removeDefenseIfNecessary(game, this);
        var balls = this.balls;
        removePoints(game, this, balls);
    };
    return new Command(execute, undo);
};
var MissedCommand = function(game, defense) {
    var rack = game.curRack;
    var execute = function() {
        addDefenseIfNecessary(game, this, defense);
        if (game.curPlayerIdx == 1) {
            rack.inningNumber++;
            this.inningAdded = true;
        }
        this.curPlayerIdx = game.curPlayerIdx;
        game.flipPlayers();
        // Mark Dead Balls
        this.deadBalls = rack.thisInningMadeBalls();
        for (var i=0; i<this.deadBalls.length; i++) {
            game.curRack.balls[this.deadBalls[i]] = (this.deadBalls[i] == 9) ? 0 : 99; // 9 is re-spotted
        }
    };
    var undo = function () {
        game.curPlayerIdx = this.curPlayerIdx;
        removeDefenseIfNecessary(game, this);
        if (this.inningAdded == true) {
            rack.inningNumber--;
        }
        // Un-mark Dead Balls
        for (var i=0; i<this.deadBalls.length; i++) {
            game.curRack.balls[this.deadBalls[i]] = 0;
        }
    };
    return new Command(execute, undo);
};
var ScratchCommand = function(game, defense) {
    return new MissedCommand(game, defense);
};
var UpdateBallValueCommand = function (game, ballIdx, newValue) {
    var rack = game.curRack;
    var execute = function() {
        this.oldValue = rack.balls[ballIdx]; // can be 1, 2, 99
        handlePoints(game, ballIdx, this.oldValue, newValue);
    };
    var undo = function () {
        handlePoints(game, ballIdx, newValue, this.oldValue);
    };
    var handlePoints = function(rack, ballIdx, oldValue, newValue) {
        var rack = game.curRack;
        var points = (ballIdx == 9) ? 2 : 1;
        if (oldValue != 99) {
            rack.rackScore[oldValue-1] -= points;
            game.score[oldValue-1] -= points;
        }
        rack.rackScore[newValue-1] += points;
        game.score[newValue-1] += points;
        rack.balls[ballIdx] = newValue;
    };
    return new Command(execute, undo);
};

apaApp.config(function($routeProvider){
    $routeProvider.
        when('/9BallGameSetup', {templateUrl: '9bGameSetup.html', controller: '9bGameSetupController'}).
        when('/9bRack', {templateUrl: '9bRack.html', controller: '9bRackController'}).
        when('/9bResult', {templateUrl: '9bResult.html', controller: '9bResultController'}).
        when('/drawTable', {templateUrl: 'drawTable.html', controller: 'DrawTableController'}).
        when('/roster', {templateUrl: 'roster.html', controller: 'rosterController'}).
        when('/lineup', {templateUrl: 'lineup.html', controller: 'lineupController'}).
        when('/', {templateUrl: 'splash.html'}).
        otherwise({redirectTo: '/'});
});

apaApp.factory('Game9B', function() {
    var game = {};
    game.pointsToWin = [-1, 14, 19, 25, 31, 38, 46, 55, 65, 75];
    game.scoreOfMatch = [null,
        [0, 3, 4, 5, 7, 8, 9, 11, 12], // SL 1
        [0, 4, 6, 8, 9, 11, 13, 15, 17], // SL 2
        [0, 5, 7, 10, 12, 15, 17, 20, 22], // SL 3
        [0, 6, 9, 12, 15, 19, 22, 25, 28], // SL 4
        [0, 7, 11, 15, 19, 23, 27, 30, 34], // SL 5
        [0, 9, 13, 18, 23, 28, 32, 37, 41], // SL 6
        [0, 11, 16, 22, 27, 33, 38, 44, 50], // SL 7
        [0, 14, 20, 27, 33, 40, 46, 53, 59], // SL 8
        [0, 18, 25, 32, 39, 47, 54, 61, 68] // SL 9
    ];
    game.players = [{name:'A', handicap: 5}, {name:'B', handicap: 5}];
    game.curPlayerIdx = 0;

    game.init = function() {
        game.startTime = new Date();
        game.score = [0,0];
        game.defensiveShots = [0,0];
        game.totalInnings = 0;
        game.curRack = null;
    };

    game.ptsToWin = function(playerIdx) {
        return game.pointsToWin[game.players[playerIdx].handicap];
    };

    game.isOver = function() {
        return game.score[0] >= game.ptsToWin(0) || game.score[1] >= game.ptsToWin(1);
    };

    game.ptsLeft = function (playerIdx) {
        return game.ptsToWin(playerIdx) - game.score[playerIdx];
    };

    game.getWinner = function() {
        var winner = null;
        if (game.isOver()) {
            winner = (game.score[0] >= game.ptsToWin(0)) ? game.players[0] : game.players[1];
        }
        return winner;
    };

    game.getMatchScorePoints = function(idx) {
        var looserIdx = (game.score[0] >= game.ptsToWin(0)) ? 1 : 0;
        var looserScoreLine = game.scoreOfMatch[game.players[looserIdx].handicap];
        var looserPoints = 0;
        for (var i = looserScoreLine.length - 1; i >= 0; i--) {
            if (game.score[looserIdx] >= looserScoreLine[i]) {
                looserPoints = i;
                break;
            }
        }
        return (looserIdx == idx) ? looserPoints : 20 - looserPoints;
    };

    game.startNextRack = function() {
        var rack = {};
        rack.number = (game.curRack == null) ? 1 : (game.curRack.number + 1);
        rack.rackScore = [0,0];
        rack.inningNumber = 0;
        rack.balls = [null, 0,0,0,0,0,0,0,0,0]; // Values: -1=selected; 0=available; 1=made(1st player); 2=made(2nd player); 99=dead
        rack.commands = [];
        rack.thisInningMadeBalls = function () {
            var result = [];
            for (var i=1; i<rack.balls.length; i++) {
                if (rack.balls[i] == -1)
                    result.push(i);
            }
            return result;
        };
        rack.madeAnyBallThisInning = function () {
            return (rack.thisInningMadeBalls().length > 0);
        };
        rack.breakerIdx = game.curPlayerIdx;
        game.curRack = rack;
    };

    game.flipPlayers = function() {
        game.curPlayerIdx = (game.curPlayerIdx * -1) + 1;
    };

    return game;
});
