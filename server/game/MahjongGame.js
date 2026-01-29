/**
 * 麻将游戏核心逻辑
 * Mahjong Game Core Logic
 */

const { Tile, TileType } = require('./Tile');
const { Hand, Meld } = require('./Hand');
const TileWall = require('./TileWall');
const WinningChecker = require('./WinningChecker');

// 游戏状态
const GameState = {
    WAITING: 'waiting',
    PLAYING: 'playing',
    WAITING_ACTION: 'waiting_action',
    FINISHED: 'finished'
};

// 玩家位置
const Position = {
    EAST: 0,
    SOUTH: 1,
    WEST: 2,
    NORTH: 3
};

class MahjongGame {
    constructor(gameId, players, options = {}) {
        this.gameId = gameId;
        this.players = players; // [{id, username, socket}]
        this.options = {
            ruleSet: options.ruleSet || 'chinese',
            includeFlowers: options.includeFlowers !== false,
            timeLimit: options.timeLimit || 30,
            ...options
        };

        this.state = GameState.WAITING;
        this.tileWall = null;
        this.hands = {};
        this.currentPlayer = 0;
        this.dealerIndex = 0;
        this.round = 1;
        this.turn = 0;
        this.lastDiscardedTile = null;
        this.lastDiscardPlayer = -1;
        this.pendingActions = [];
        this.actionTimer = null;
        this.winningChecker = new WinningChecker(this.options.ruleSet);
        this.gameLog = []; // 用于回放
        this.scores = {};
        
        // 初始化分数
        this.players.forEach((p, i) => {
            this.scores[p.id] = this.options.ruleSet === 'japanese' ? 25000 : 0;
        });
    }

    /**
     * 开始游戏
     */
    start() {
        this.state = GameState.PLAYING;
        this.tileWall = new TileWall({ includeFlowers: this.options.includeFlowers });
        
        // 初始化每个玩家的手牌
        this.players.forEach((player, index) => {
            this.hands[player.id] = new Hand();
        });

        // 发牌
        this.dealTiles();
        
        // 设置当前玩家为庄家
        this.currentPlayer = this.dealerIndex;
        
        // 庄家摸第14张
        this.drawTileForPlayer(this.dealerIndex);
        
        this.logAction('gameStart', { dealer: this.dealerIndex });
        this.broadcastGameState();
        
        return true;
    }

    /**
     * 发牌
     */
    dealTiles() {
        // 每人13张
        for (let round = 0; round < 13; round++) {
            this.players.forEach((player, index) => {
                let tile = this.tileWall.draw();
                if (tile) {
                    // 循环处理花牌，直到摸到非花牌
                    while (tile && tile.isFlowerTile()) {
                        this.hands[player.id].addFlower(tile);
                        // 补一张
                        tile = this.tileWall.draw();
                    }
                    // 添加非花牌到手牌
                    if (tile) {
                        this.hands[player.id].addTile(tile);
                    }
                }
            });
        }
    }

    /**
     * 为玩家摸牌
     */
    drawTileForPlayer(playerIndex) {
        const player = this.players[playerIndex];
        const tile = this.tileWall.draw();
        
        if (!tile) {
            this.handleDraw(); // 流局
            return null;
        }

        // 检查花牌
        if (tile.isFlowerTile()) {
            this.hands[player.id].addFlower(tile);
            this.logAction('flower', { player: playerIndex, tile: tile.toJSON() });
            // 从岭上补牌
            return this.drawFromDeadWall(playerIndex);
        }

        this.hands[player.id].setDrawnTile(tile);
        this.logAction('draw', { player: playerIndex, tile: tile.toJSON() });
        
        // 检查自摸
        this.checkSelfDrawWin(playerIndex, tile);
        
        return tile;
    }

    /**
     * 从岭上摸牌
     */
    drawFromDeadWall(playerIndex) {
        const player = this.players[playerIndex];
        const tile = this.tileWall.drawFromDeadWall();
        
        if (!tile) {
            this.handleDraw();
            return null;
        }

        if (tile.isFlowerTile()) {
            this.hands[player.id].addFlower(tile);
            return this.drawFromDeadWall(playerIndex);
        }

        this.hands[player.id].setDrawnTile(tile);
        this.logAction('drawDeadWall', { player: playerIndex, tile: tile.toJSON() });
        
        this.checkSelfDrawWin(playerIndex, tile);
        
        return tile;
    }

    /**
     * 打牌
     */
    discardTile(playerId, tileData) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentPlayer) {
            return { success: false, error: '不是你的回合' };
        }

        const hand = this.hands[playerId];
        const tile = Tile.fromJSON(tileData);
        const discarded = hand.discard(tile);

        if (!discarded) {
            return { success: false, error: '没有这张牌' };
        }

        this.lastDiscardedTile = discarded;
        this.lastDiscardPlayer = playerIndex;
        this.turn++;

        this.logAction('discard', { 
            player: playerIndex, 
            tile: discarded.toJSON() 
        });

        // 检查其他玩家的可能动作
        this.checkOtherPlayersActions(discarded, playerIndex);

        return { success: true, tile: discarded };
    }

    /**
     * 检查其他玩家的可能动作
     */
    checkOtherPlayersActions(tile, fromPlayer) {
        this.pendingActions = [];
        const actions = [];

        for (let i = 0; i < 4; i++) {
            if (i === fromPlayer) continue;

            const player = this.players[i];
            const hand = this.hands[player.id];
            const playerActions = [];

            // 检查胡牌
            const winResult = this.winningChecker.checkWin(hand, tile, {
                isSelfDraw: false,
                isDealer: i === this.dealerIndex
            });
            if (winResult.isWin) {
                playerActions.push({ type: 'mahjong', priority: 3 });
            }

            // 检查杠
            if (hand.canKong(tile)) {
                playerActions.push({ type: 'kong', priority: 2 });
            }

            // 检查碰
            if (hand.canPong(tile)) {
                playerActions.push({ type: 'pong', priority: 2 });
            }

            // 检查吃（只有下家可以吃）
            const nextPlayer = (fromPlayer + 1) % 4;
            if (i === nextPlayer) {
                const chowOptions = hand.canChow(tile);
                if (chowOptions.length > 0) {
                    playerActions.push({ type: 'chow', options: chowOptions, priority: 1 });
                }
            }

            if (playerActions.length > 0) {
                actions.push({
                    playerIndex: i,
                    playerId: player.id,
                    actions: playerActions
                });
            }
        }

        if (actions.length > 0) {
            this.state = GameState.WAITING_ACTION;
            this.pendingActions = actions;
            this.notifyPendingActions();
            this.startActionTimer();
        } else {
            this.nextTurn();
        }
    }

    /**
     * 通知有待处理动作
     */
    notifyPendingActions() {
        console.log('notifyPendingActions called, pendingActions:', JSON.stringify(this.pendingActions, null, 2));
        this.pendingActions.forEach(action => {
            const player = this.players[action.playerIndex];
            const data = {
                tile: this.lastDiscardedTile.toJSON(),
                actions: action.actions.map(a => a.type),
                chowOptions: action.actions.find(a => a.type === 'chow')?.options
            };
            console.log('Sending actionRequired to player', player.id, ':', data);
            if (player.socket) {
                player.socket.emit('actionRequired', data);
            } else {
                console.log('Player socket not available for', player.id);
            }
        });
    }

    /**
     * 开始动作计时器
     */
    startActionTimer() {
        if (this.actionTimer) {
            clearTimeout(this.actionTimer);
        }
        
        this.actionTimer = setTimeout(() => {
            this.handleActionTimeout();
        }, this.options.timeLimit * 1000);
    }

    /**
     * 处理动作超时
     */
    handleActionTimeout() {
        // 所有未响应的玩家视为过牌
        this.pendingActions.forEach(action => {
            const player = this.players[action.playerIndex];
            if (!action.responded) {
                this.handlePass(player.id);
            }
        });
    }

    /**
     * 处理碰
     */
    handlePong(playerId) {
        console.log('handlePong called for player:', playerId);
        console.log('Current pendingActions:', JSON.stringify(this.pendingActions, null, 2));

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        const action = this.pendingActions.find(a => a.playerId === playerId);

        console.log('Found action for player:', action);

        if (!action || !action.actions.some(a => a.type === 'pong')) {
            console.log('Cannot pong - action not found or pong not available');
            return { success: false, error: '不能碰' };
        }

        const hand = this.hands[playerId];
        const tile = this.lastDiscardedTile;

        // 从手牌中移除两张相同的牌
        const tiles = [tile];
        for (let i = 0; i < 2; i++) {
            const removed = hand.removeTile(tile);
            if (removed) tiles.push(removed);
        }

        // 添加副露
        hand.addMeld(new Meld('pong', tiles, false, this.lastDiscardPlayer));

        this.logAction('pong', { 
            player: playerIndex, 
            tiles: tiles.map(t => t.toJSON()),
            from: this.lastDiscardPlayer
        });

        // 清除待处理动作
        this.clearPendingActions();
        
        // 设置当前玩家
        this.currentPlayer = playerIndex;
        this.state = GameState.PLAYING;

        this.broadcastGameState();
        
        return { success: true };
    }

    /**
     * 处理杠
     */
    handleKong(playerId, type, tileData = null) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        const hand = this.hands[playerId];

        if (type === 'concealed') {
            // 暗杠
            if (playerIndex !== this.currentPlayer) {
                return { success: false, error: '不是你的回合' };
            }

            const tile = tileData ? Tile.fromJSON(tileData) : null;
            if (!tile) {
                return { success: false, error: '不能暗杠' };
            }

            // 计算手牌中该牌的数量（包括drawnTile）
            let totalCount = hand.countTile(tile);
            if (hand.drawnTile && hand.drawnTile.equals(tile)) {
                totalCount++;
            }

            if (totalCount < 4) {
                return { success: false, error: '不能暗杠' };
            }

            const tiles = [];
            // 先从drawnTile移除（如果匹配）
            if (hand.drawnTile && hand.drawnTile.equals(tile)) {
                tiles.push(hand.drawnTile);
                hand.drawnTile = null;
            }
            // 从手牌中移除剩余的牌
            while (tiles.length < 4) {
                const removed = hand.removeTile(tile);
                if (removed) {
                    tiles.push(removed);
                } else {
                    break;
                }
            }

            if (tiles.length !== 4) {
                return { success: false, error: '暗杠失败' };
            }

            hand.addMeld(new Meld('kong', tiles, true));

            this.logAction('concealedKong', { player: playerIndex, tiles: tiles.map(t => t.toJSON()) });

            // 翻宝牌
            this.tileWall.revealDora();

            // 从岭上摸牌
            this.drawFromDeadWall(playerIndex);

        } else if (type === 'added') {
            // 加杠
            if (playerIndex !== this.currentPlayer) {
                return { success: false, error: '不是你的回合' };
            }

            const tile = tileData ? Tile.fromJSON(tileData) : null;
            if (!tile || !hand.canAddKong(tile)) {
                return { success: false, error: '不能加杠' };
            }

            // 找到对应的碰
            const meldIndex = hand.melds.findIndex(m => 
                m.type === 'pong' && m.tiles[0].equals(tile)
            );
            
            if (meldIndex === -1) {
                return { success: false, error: '没有对应的碰' };
            }

            // 移除牌
            let addedTile = hand.removeTile(tile);
            if (!addedTile && hand.drawnTile && hand.drawnTile.equals(tile)) {
                addedTile = hand.drawnTile;
                hand.drawnTile = null;
            }

            // 更新副露
            hand.melds[meldIndex].type = 'kong';
            hand.melds[meldIndex].tiles.push(addedTile);

            this.logAction('addedKong', { player: playerIndex, tile: addedTile.toJSON() });

            // 检查抢杠胡
            // TODO: 实现抢杠胡逻辑

            this.tileWall.revealDora();
            this.drawFromDeadWall(playerIndex);

        } else {
            // 明杠
            const action = this.pendingActions.find(a => a.playerId === playerId);
            if (!action || !action.actions.some(a => a.type === 'kong')) {
                return { success: false, error: '不能杠' };
            }

            const tile = this.lastDiscardedTile;
            const tiles = [tile];
            for (let i = 0; i < 3; i++) {
                const removed = hand.removeTile(tile);
                if (removed) tiles.push(removed);
            }

            hand.addMeld(new Meld('kong', tiles, false, this.lastDiscardPlayer));

            this.logAction('kong', { 
                player: playerIndex, 
                tiles: tiles.map(t => t.toJSON()),
                from: this.lastDiscardPlayer
            });

            this.clearPendingActions();
            this.currentPlayer = playerIndex;
            
            this.tileWall.revealDora();
            this.drawFromDeadWall(playerIndex);
        }

        this.state = GameState.PLAYING;
        this.broadcastGameState();
        
        return { success: true };
    }

    /**
     * 处理吃
     */
    handleChow(playerId, selectedTiles) {
        console.log('handleChow called for player:', playerId, 'with tiles:', selectedTiles);
        console.log('Current pendingActions:', JSON.stringify(this.pendingActions, null, 2));

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        const action = this.pendingActions.find(a => a.playerId === playerId);

        console.log('Found action for player:', action);

        if (!action || !action.actions.some(a => a.type === 'chow')) {
            console.log('Cannot chow - action not found or chow not available');
            return { success: false, error: '不能吃' };
        }

        // 检查是否有更高优先级的动作未处理
        const higherPriority = this.pendingActions.some(a => 
            !a.responded && a.actions.some(act => act.priority > 1)
        );
        
        if (higherPriority) {
            // 等待更高优先级的动作
            action.responded = true;
            action.chosenAction = { type: 'chow', tiles: selectedTiles };
            return { success: true, waiting: true };
        }

        const hand = this.hands[playerId];
        const tile = this.lastDiscardedTile;

        // 从手牌中移除需要的牌
        const tiles = [tile];
        selectedTiles.forEach(t => {
            if (t.value !== tile.value) {
                const removed = hand.removeTile(Tile.fromJSON(t));
                if (removed) tiles.push(removed);
            }
        });

        // 排序
        tiles.sort((a, b) => a.value - b.value);

        hand.addMeld(new Meld('chow', tiles, false, this.lastDiscardPlayer));

        this.logAction('chow', { 
            player: playerIndex, 
            tiles: tiles.map(t => t.toJSON()),
            from: this.lastDiscardPlayer
        });

        this.clearPendingActions();
        this.currentPlayer = playerIndex;
        this.state = GameState.PLAYING;

        this.broadcastGameState();
        
        return { success: true };
    }

    /**
     * 处理胡牌
     */
    handleMahjong(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        const hand = this.hands[playerId];
        
        let winningTile;
        let isSelfDraw;

        if (playerIndex === this.currentPlayer && hand.drawnTile) {
            // 自摸
            winningTile = hand.drawnTile;
            isSelfDraw = true;
        } else if (this.lastDiscardedTile && this.pendingActions.some(a => a.playerId === playerId)) {
            // 荣和
            winningTile = this.lastDiscardedTile;
            isSelfDraw = false;
        } else {
            return { success: false, error: '不能胡牌' };
        }

        const result = this.winningChecker.checkWin(hand, winningTile, {
            isSelfDraw,
            isDealer: playerIndex === this.dealerIndex,
            roundWind: Position.EAST,
            seatWind: playerIndex
        });

        if (!result.isWin) {
            return { success: false, error: '不是胡牌牌型' };
        }

        // 计算分数
        this.calculateFinalScore(playerIndex, result, isSelfDraw);

        this.logAction('mahjong', {
            player: playerIndex,
            tile: winningTile.toJSON(),
            isSelfDraw,
            result
        });

        this.state = GameState.FINISHED;
        this.clearPendingActions();
        
        this.broadcastGameResult(playerIndex, result, isSelfDraw);
        
        return { success: true, result };
    }

    /**
     * 检查自摸胡
     */
    checkSelfDrawWin(playerIndex, tile) {
        const player = this.players[playerIndex];
        const hand = this.hands[player.id];
        
        const result = this.winningChecker.checkWin(hand, tile, {
            isSelfDraw: true,
            isDealer: playerIndex === this.dealerIndex
        });

        if (result.isWin) {
            player.socket?.emit('canMahjong', { tile: tile.toJSON(), result });
        }

        // 检查暗杠
        if (hand.canConcealedKong()) {
            const kongTiles = hand.getConcealedKongTiles();
            player.socket?.emit('canKong', { 
                type: 'concealed', 
                tiles: kongTiles.map(t => t.toJSON()) 
            });
        }

        // 检查加杠
        const allTiles = hand.getAllTiles();
        hand.melds.forEach(meld => {
            if (meld.type === 'pong') {
                const canAdd = allTiles.some(t => t.equals(meld.tiles[0]));
                if (canAdd) {
                    player.socket?.emit('canKong', { 
                        type: 'added', 
                        tile: meld.tiles[0].toJSON() 
                    });
                }
            }
        });
    }

    /**
     * 处理过牌
     */
    handlePass(playerId) {
        const action = this.pendingActions.find(a => a.playerId === playerId);
        if (action) {
            action.responded = true;
            action.chosenAction = null;
        }

        // 检查是否所有人都响应了
        const allResponded = this.pendingActions.every(a => a.responded);
        
        if (allResponded) {
            // 处理最高优先级的动作
            let highestAction = null;
            this.pendingActions.forEach(action => {
                if (action.chosenAction) {
                    if (!highestAction || 
                        action.actions.find(a => a.type === action.chosenAction.type)?.priority >
                        highestAction.priority) {
                        highestAction = {
                            ...action,
                            priority: action.actions.find(a => a.type === action.chosenAction.type)?.priority
                        };
                    }
                }
            });

            if (highestAction) {
                // 执行最高优先级动作
                const { chosenAction, playerId } = highestAction;
                if (chosenAction.type === 'chow') {
                    this.handleChow(playerId, chosenAction.tiles);
                }
            } else {
                // 没有人行动，进入下一回合
                this.clearPendingActions();
                this.nextTurn();
            }
        }

        return { success: true };
    }

    /**
     * 清除待处理动作
     */
    clearPendingActions() {
        if (this.actionTimer) {
            clearTimeout(this.actionTimer);
            this.actionTimer = null;
        }
        this.pendingActions = [];
    }

    /**
     * 下一回合
     */
    nextTurn() {
        this.currentPlayer = (this.currentPlayer + 1) % 4;
        
        if (!this.tileWall.canDraw()) {
            this.handleDraw();
            return;
        }

        this.drawTileForPlayer(this.currentPlayer);
        this.broadcastGameState();
    }

    /**
     * 处理流局
     */
    handleDraw() {
        this.state = GameState.FINISHED;
        
        // 检查听牌玩家
        const tenpaiPlayers = [];
        this.players.forEach((player, index) => {
            const hand = this.hands[player.id];
            const tenpai = this.winningChecker.checkTenpai(hand);
            if (tenpai.isTenpai) {
                tenpaiPlayers.push({ index, waitingTiles: tenpai.waitingTiles });
            }
        });

        this.logAction('draw', { tenpaiPlayers });
        
        // 广播流局结果
        this.broadcast('gameDraw', {
            tenpaiPlayers,
            scores: this.scores
        });
    }

    /**
     * 计算最终分数
     */
    calculateFinalScore(winnerIndex, result, isSelfDraw) {
        const winner = this.players[winnerIndex];
        const score = result.score;

        if (this.options.ruleSet === 'japanese') {
            if (isSelfDraw) {
                // 自摸：其他人支付
                const dealerPay = winnerIndex === this.dealerIndex ? 0 : Math.ceil(score / 2);
                const nonDealerPay = Math.ceil(score / 4);
                
                this.players.forEach((p, i) => {
                    if (i !== winnerIndex) {
                        const pay = i === this.dealerIndex ? dealerPay : nonDealerPay;
                        this.scores[p.id] -= pay;
                        this.scores[winner.id] += pay;
                    }
                });
            } else {
                // 荣和：放铳者支付
                const loser = this.players[this.lastDiscardPlayer];
                this.scores[loser.id] -= score;
                this.scores[winner.id] += score;
            }
        } else {
            // 中国麻将简化计分
            this.scores[winner.id] += score;
            if (!isSelfDraw) {
                const loser = this.players[this.lastDiscardPlayer];
                this.scores[loser.id] -= score;
            }
        }
    }

    /**
     * 记录游戏动作
     */
    logAction(type, data) {
        this.gameLog.push({
            type,
            data,
            timestamp: Date.now(),
            turn: this.turn
        });
    }

    /**
     * 广播游戏状态
     */
    broadcastGameState() {
        this.players.forEach((player, index) => {
            const state = this.getGameStateForPlayer(player.id);
            player.socket?.emit('gameState', state);
        });
    }

    /**
     * 获取玩家视角的游戏状态
     */
    getGameStateForPlayer(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        
        return {
            gameId: this.gameId,
            state: this.state,
            currentPlayer: this.currentPlayer,
            dealerIndex: this.dealerIndex,
            round: this.round,
            turn: this.turn,
            myIndex: playerIndex,
            myHand: this.hands[playerId].toJSON(),
            otherHands: this.players.map((p, i) => {
                if (i === playerIndex) return null;
                return {
                    index: i,
                    username: p.username,
                    hand: this.hands[p.id].toPublicJSON()
                };
            }).filter(h => h !== null),
            lastDiscardedTile: this.lastDiscardedTile?.toJSON(),
            lastDiscardPlayer: this.lastDiscardPlayer,
            tileWall: this.tileWall.toJSON(),
            scores: this.scores,
            players: this.players.map(p => ({
                id: p.id,
                username: p.username
            }))
        };
    }

    /**
     * 广播游戏结果
     */
    broadcastGameResult(winnerIndex, result, isSelfDraw) {
        this.broadcast('gameEnd', {
            winner: {
                index: winnerIndex,
                username: this.players[winnerIndex].username
            },
            result,
            isSelfDraw,
            scores: this.scores,
            hands: this.players.map((p, i) => ({
                index: i,
                username: p.username,
                hand: this.hands[p.id].toJSON()
            }))
        });
    }

    /**
     * 广播消息
     */
    broadcast(event, data) {
        this.players.forEach(player => {
            player.socket?.emit(event, data);
        });
    }

    /**
     * 获取游戏日志（用于回放）
     */
    getGameLog() {
        return {
            gameId: this.gameId,
            players: this.players.map(p => ({ id: p.id, username: p.username })),
            options: this.options,
            log: this.gameLog,
            finalScores: this.scores
        };
    }

    /**
     * 处理玩家断线
     */
    handleDisconnect(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;

        // 标记玩家离线
        this.players[playerIndex].offline = true;

        // 如果是当前玩家回合，自动打牌
        if (this.currentPlayer === playerIndex && this.state === GameState.PLAYING) {
            const hand = this.hands[playerId];
            if (hand.drawnTile) {
                // 自动打出刚摸的牌
                this.discardTile(playerId, hand.drawnTile.toJSON());
            }
        }
    }

    /**
     * 处理玩家重连
     */
    handleReconnect(playerId, socket) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return;

        this.players[playerIndex].socket = socket;
        this.players[playerIndex].offline = false;

        // 发送当前游戏状态
        socket.emit('gameState', this.getGameStateForPlayer(playerId));
    }
}

module.exports = { MahjongGame, GameState, Position };
