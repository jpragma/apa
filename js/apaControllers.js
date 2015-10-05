apaApp.controller('9bGameSetupController', function ($scope, Game9B, $location) {
    $scope.game = Game9B;
    $scope.swapPlayers = function() {
        var p = Game9B.players[0];
        Game9B.players[0] = Game9B.players[1];
        Game9B.players[1] = p;
    };
    $scope.startGame = function() {
        Game9B.init();
        Game9B.startNextRack();
        $location.path("/9bRack");
    };
});


apaApp.controller('9bRackController', function ($scope, Game9B, $location) {
    if (!Game9B.curRack) {
        $location.path("/");
        return;
    }

    $scope.game = Game9B;
    $scope.rack = Game9B.curRack;
    $scope.scratch = false;
    $scope.defense = false;
    $scope.scoreDisplayType = 0;
    $scope.changeDisplayType = function () {
        if ($scope.scoreDisplayType == 2) {
            $scope.scoreDisplayType = 0;
        } else {
            $scope.scoreDisplayType++;
        }
    };
    $scope.toggleBallSelect = function(idx) {
        if ($scope.rack.balls[idx] >= 1) {
            // already gone
            $scope.switchToOverride(idx);
            return;
        }
        $scope.rack.balls[idx] = Math.abs($scope.rack.balls[idx]) - 1;
    };
    $scope.switchToOverride = function(idx) {
        $scope.overrideMode = true;
        $scope.overrideBall = {idx: idx, value: $scope.rack.balls[idx]};
    };
    $scope.getBtnStyleSelected = function (val) {
        return (val == $scope.overrideBall.value) ? {opacity:0.3} : null;
    };
    $scope.updateBall = function (idx, value) {
        var cmd = new UpdateBallValueCommand($scope.game, idx, value);
        $scope.rack.commands.push(cmd);
        cmd.execute();
        $scope.overrideMode = false;
    };

    $scope.getBallText = function (idx) {
        var txt = idx;
        if ($scope.rack.balls[idx] == 99) {
            txt += " (D)";
        } else if ($scope.rack.balls[idx] >= 1) {
            txt += " (" +  $scope.rack.balls[idx] + ")";
        }
        return txt;
    };
    $scope.getBallSelectClass = function(idx) {
        var className = "ball" + idx;
        if ($scope.rack.balls[idx] == -1) {
            className += " ball-selected";
        } else if ($scope.rack.balls[idx] >= 1) {
            className += " ball-gone";
        }

        return className;
    };
    $scope.getScratchBtnClass = function () {
        return 'btnScratchDefense' + (($scope.scratch) ? ' ball-selected' : '');
    };
    $scope.getDefenseBtnClass = function () {
        return 'btnScratchDefense' + (($scope.defense) ? ' ball-selected' : '');
    };
    $scope.done = function () {
        var cmd = null;
        if ($scope.scratch) {
            cmd = new ScratchCommand($scope.game, $scope.defense);
            $scope.scratch = false;
        } else {
            if ($scope.rack.madeAnyBallThisInning()) {
                cmd = new MadeCommand($scope.game, $scope.defense);
            } else {
                cmd = new MissedCommand($scope.game, $scope.defense);
            }
        }

        $scope.rack.commands.push(cmd);
        cmd.execute();
        $scope.defense = false; // reset defense button
        if ($scope.rack.balls[9] >= 1) {
            $location.path("/9bResult");
        }
        if ($scope.game.isOver()) {
            $location.path("/9bResult");
        }
    };
    $scope.undo = function () {
        var cmd = $scope.rack.commands.pop();
        cmd.undo();
    };

});

apaApp.controller('9bResultController', function ($scope, Game9B, $location) {
    if (!Game9B.curRack) {
        $location.path("/");
        return;
    }

    $scope.game = Game9B;
    $scope.rack = Game9B.curRack;

    $scope.editRack = function () {
        $location.path("/9bRack");
    };

    var markNotPocketedBallsAsDead = function() {
        // all not pocketed balls become "dead"
        for (var i=1; i < $scope.rack.balls.length; i++) {
            if ($scope.rack.balls[i] == 0) {
                $scope.rack.balls[i] = 99;
            }
        }
    };
    markNotPocketedBallsAsDead();

    $scope.game.totalInnings += $scope.game.curRack.inningNumber;

    var calcPointsMadeBy = function(playerIdx) {
        var result = 0;
        for (var i=1; i < $scope.rack.balls.length; i++) {
            if ($scope.rack.balls[i] == [playerIdx]) {
                result += (i == 9) ? 2 : 1;
            }
        }
        return result;
    };

    $scope.pointsMade = [calcPointsMadeBy(1), calcPointsMadeBy(2)];
    $scope.dead = calcPointsMadeBy(99);
    $scope.origPointsMade = $scope.pointsMade.slice(0); // copy by value

    // Adjust score if match is over and score is more than max
    for (var i = 0; i <= 1; i++) {
        var delta = $scope.game.ptsLeft(i);
        if (delta < 0) {
            $scope.game.score[i] += delta;
            $scope.pointsMade[i] += delta;
            $scope.dead -= delta;
        }
    }

    $scope.isValid = function () {
        return ($scope.pointsMade[0] + $scope.pointsMade[1] + $scope.dead) == 10;
    };

    $scope.breakAndRun = function () {
        return $scope.rack.inningNumber == 0 && $scope.rack.breakerIdx == $scope.game.curPlayerIdx && $scope.dead == 0;
    };

    $scope.getAvgBallPerInning = function (playerIdx) {
        var effectiveInnings = ($scope.game.totalInnings - $scope.game.defensiveShots[playerIdx]);
        effectiveInnings = (effectiveInnings == 0) ? 1 : effectiveInnings;
        return $scope.game.score[playerIdx] / (effectiveInnings);
    };

    $scope.getTotalTime = function () {
        var totalMinutes =  (new Date() - $scope.game.startTime) / 1000 / 60;
        var h = Math.floor(totalMinutes / 60);
        var m = Math.floor(totalMinutes % 60);
        var result = m + " minutes";
        if (h > 0) {
            result = h + " hour(s) " + result;
        }
        return result;
    };

    $scope.next = function () {
        for (var i=0; i<=1; i++) {
            if ($scope.origPointsMade[i] != $scope.pointsMade[i]) {
                $scope.game.score[i] += ($scope.pointsMade[i] - $scope.origPointsMade[i]);
            }
        }
        if ($scope.game.isOver()) {
            $location.path("/9BallGameSetup");
        } else {
            $scope.game.startNextRack();
            $location.path("/9bRack");
        }
    };
});






apaApp.controller('teamController', function ($scope, $http) {

    $http.get('teams').success(function (data) {
        $scope.teams = data;
    });
});

apaApp.controller('DrawTableController', function ($scope, $location, $http) {

    $scope.owner = 'b899899f-6106-4790-a244-d68266335f53';
    $scope.forks = [];

    $scope.forkLayout = function () {
        $http.post('http://api.drawtable.com/fork', {_id: $scope.curId, owner: $scope.owner})
            .success(function (data) {
                var newId = data._id;
                $scope.forks.push({from: $scope.curId, to: newId});
                $scope.curId = newId;
            }).error(function(data) {
                console.log(data);
            });
    };

    $scope.showLayout = function (id) {
        document.getElementById('layout').src = "http://www.drawtable.com/" + id;
    };
});