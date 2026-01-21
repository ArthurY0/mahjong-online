/**
 * 回放管理器
 * Replay Manager
 */

class ReplayManager {
    constructor(db) {
        this.db = db;
    }

    /**
     * 保存回放
     */
    saveReplay(gameLog) {
        const { gameId, players, options, log, finalScores } = gameLog;

        // 保存游戏记录
        const winnerId = this.findWinner(players, finalScores);
        this.db.saveGameRecord({
            id: gameId,
            players: players.map(p => ({ id: p.id, username: p.username })),
            winnerId,
            ruleSet: options.ruleSet,
            finalScores,
            duration: this.calculateDuration(log)
        });

        // 保存详细回放数据
        this.db.saveReplay(gameId, {
            players,
            options,
            log,
            finalScores
        });

        console.log(`回放已保存: ${gameId}`);
    }

    /**
     * 获取回放
     */
    getReplay(gameId) {
        const replay = this.db.getReplay(gameId);
        if (!replay) {
            return { success: false, error: '回放不存在' };
        }
        return { success: true, replay: replay.data };
    }

    /**
     * 获取用户的回放列表
     */
    getUserReplays(userId) {
        return this.db.getUserReplays(userId);
    }

    /**
     * 找出获胜者
     */
    findWinner(players, finalScores) {
        let maxScore = -Infinity;
        let winnerId = null;

        players.forEach(player => {
            if (finalScores[player.id] > maxScore) {
                maxScore = finalScores[player.id];
                winnerId = player.id;
            }
        });

        return winnerId;
    }

    /**
     * 计算游戏时长
     */
    calculateDuration(log) {
        if (log.length < 2) return 0;
        const start = log[0].timestamp;
        const end = log[log.length - 1].timestamp;
        return Math.floor((end - start) / 1000); // 秒
    }
}

module.exports = ReplayManager;
