/**
 * 游戏管理器
 * Game Manager - 管理所有进行中的游戏
 */

const { MahjongGame, GameState } = require('./MahjongGame');

class GameManager {
    constructor(io, db, replayManager) {
        this.io = io;
        this.db = db;
        this.replayManager = replayManager;
        this.games = new Map(); // gameId -> MahjongGame
        this.playerGames = new Map(); // playerId -> gameId
    }

    /**
     * 创建新游戏
     */
    createGame(gameId, players, options = {}) {
        const game = new MahjongGame(gameId, players, options);
        this.games.set(gameId, game);
        
        players.forEach(player => {
            this.playerGames.set(player.id, gameId);
        });

        return game;
    }

    /**
     * 开始游戏
     */
    startGame(gameId) {
        const game = this.games.get(gameId);
        if (!game) {
            return { success: false, error: '游戏不存在' };
        }

        game.start();
        return { success: true };
    }

    /**
     * 获取游戏
     */
    getGame(gameId) {
        return this.games.get(gameId);
    }

    /**
     * 获取玩家的游戏
     */
    getPlayerGame(playerId) {
        const gameId = this.playerGames.get(playerId);
        if (!gameId) return null;
        return this.games.get(gameId);
    }

    /**
     * 处理摸牌
     */
    handleDrawTile(socket) {
        const game = this.getPlayerGame(socket.userId);
        if (!game) {
            socket.emit('error', { message: '不在游戏中' });
            return;
        }
        
        // 摸牌逻辑在游戏中自动处理
    }

    /**
     * 处理打牌
     */
    handleDiscardTile(socket, tile) {
        const game = this.getPlayerGame(socket.userId);
        if (!game) {
            socket.emit('error', { message: '不在游戏中' });
            return;
        }

        const result = game.discardTile(socket.userId, tile);
        if (!result.success) {
            socket.emit('error', { message: result.error });
        }
        this._cleanupIfFinished(game);
    }

    /**
     * 处理碰
     */
    handlePong(socket) {
        const game = this.getPlayerGame(socket.userId);
        if (!game) {
            socket.emit('error', { message: '不在游戏中' });
            return;
        }

        const result = game.handlePong(socket.userId);
        if (!result.success) {
            socket.emit('error', { message: result.error });
        }
    }

    /**
     * 处理杠
     */
    handleKong(socket, type, tile) {
        const game = this.getPlayerGame(socket.userId);
        if (!game) {
            socket.emit('error', { message: '不在游戏中' });
            return;
        }

        const result = game.handleKong(socket.userId, type, tile);
        if (!result.success) {
            socket.emit('error', { message: result.error });
        }
        this._cleanupIfFinished(game);
    }

    /**
     * 处理吃
     */
    handleChow(socket, tiles) {
        const game = this.getPlayerGame(socket.userId);
        if (!game) {
            socket.emit('error', { message: '不在游戏中' });
            return;
        }

        const result = game.handleChow(socket.userId, tiles);
        if (!result.success) {
            socket.emit('error', { message: result.error });
        }
    }

    /**
     * 处理胡牌
     */
    handleMahjong(socket) {
        const game = this.getPlayerGame(socket.userId);
        if (!game) {
            socket.emit('error', { message: '不在游戏中' });
            return;
        }

        const result = game.handleMahjong(socket.userId);
        if (!result.success) {
            socket.emit('error', { message: result.error });
        } else {
            this._cleanupIfFinished(game);
        }
    }

    /**
     * 处理过牌
     */
    handlePass(socket) {
        const game = this.getPlayerGame(socket.userId);
        if (!game) {
            socket.emit('error', { message: '不在游戏中' });
            return;
        }

        game.handlePass(socket.userId);
        this._cleanupIfFinished(game);
    }

    /**
     * 处理玩家断线
     */
    handleDisconnect(socket) {
        const game = this.getPlayerGame(socket.userId);
        if (game) {
            game.handleDisconnect(socket.userId);
        }
    }

    /**
     * 处理玩家重连
     */
    handleReconnect(socket) {
        const game = this.getPlayerGame(socket.userId);
        if (game) {
            game.handleReconnect(socket.userId, socket);
            return true;
        }
        return false;
    }

    /**
     * 保存游戏回放
     */
    saveGameReplay(game) {
        const log = game.getGameLog();
        this.replayManager.saveReplay(log);
    }

    /**
     * 更新玩家统计
     */
    updatePlayerStats(game) {
        const log = game.getGameLog();

        // 从 game log 中找到胡牌记录，确定唯一胜者
        const mahjongEntry = log.log.find(entry => entry.type === 'mahjong');
        const winnerIndex = mahjongEntry ? mahjongEntry.data.player : -1;
        const winnerId = winnerIndex >= 0 ? game.players[winnerIndex]?.id : null;

        game.players.forEach(player => {
            if (!player.isGuest) {
                this.db.updateUserStats(player.id, {
                    gamesPlayed: 1,
                    wins: player.id === winnerId ? 1 : 0,
                    score: log.finalScores[player.id]
                });
            }
        });
    }

    /**
     * 若游戏已结束（胡牌或流局），保存回放、更新统计并清理实例
     */
    _cleanupIfFinished(game) {
        if (game.state === GameState.FINISHED && this.games.has(game.gameId)) {
            this.saveGameReplay(game);
            this.updatePlayerStats(game);
            this.endGame(game.gameId);
        }
    }

    /**
     * 结束游戏并清理
     */
    endGame(gameId) {
        const game = this.games.get(gameId);
        if (!game) return;

        // 清理玩家映射
        game.players.forEach(player => {
            this.playerGames.delete(player.id);
        });

        // 删除游戏
        this.games.delete(gameId);
    }

    /**
     * 获取活跃游戏数量
     */
    getActiveGameCount() {
        return this.games.size;
    }

    /**
     * 获取所有活跃游戏信息
     */
    getActiveGames() {
        const games = [];
        this.games.forEach((game, id) => {
            games.push({
                id,
                players: game.players.length,
                state: game.state,
                round: game.round
            });
        });
        return games;
    }
}

module.exports = GameManager;
