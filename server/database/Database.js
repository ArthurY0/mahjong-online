/**
 * 数据库管理
 * Database Management using sql.js
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
    constructor() {
        this.dbPath = path.join(__dirname, '../../data/mahjong.db');
        this.db = null;
        this.ready = this.init();
    }

    /**
     * 初始化数据库
     */
    async init() {
        const SQL = await initSqlJs();
        
        // 尝试加载现有数据库
        try {
            if (fs.existsSync(this.dbPath)) {
                const buffer = fs.readFileSync(this.dbPath);
                this.db = new SQL.Database(buffer);
            } else {
                this.db = new SQL.Database();
            }
        } catch (error) {
            console.log('创建新数据库');
            this.db = new SQL.Database();
        }

        this.createTables();
        console.log('数据库初始化完成');
        return this;
    }

    /**
     * 创建数据库表
     */
    createTables() {
        // 用户表
        this.db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )
        `);

        // 用户统计表
        this.db.run(`
            CREATE TABLE IF NOT EXISTS user_stats (
                user_id INTEGER PRIMARY KEY,
                games_played INTEGER DEFAULT 0,
                wins INTEGER DEFAULT 0,
                total_score INTEGER DEFAULT 0,
                highest_score INTEGER DEFAULT 0,
                rating INTEGER DEFAULT 1500,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // 游戏记录表
        this.db.run(`
            CREATE TABLE IF NOT EXISTS game_records (
                id TEXT PRIMARY KEY,
                players TEXT NOT NULL,
                winner_id INTEGER,
                rule_set TEXT,
                final_scores TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                duration INTEGER
            )
        `);

        // 回放数据表
        this.db.run(`
            CREATE TABLE IF NOT EXISTS replays (
                game_id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES game_records(id)
            )
        `);

        this.save();
    }

    /**
     * 保存数据库到文件
     */
    save() {
        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            
            // 确保目录存在
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.dbPath, buffer);
        } catch (error) {
            console.error('保存数据库失败:', error);
        }
    }

    /**
     * 执行查询并返回所有结果
     */
    all(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        } catch (error) {
            console.error('查询错误:', error);
            return [];
        }
    }

    /**
     * 执行查询并返回第一个结果
     */
    get(sql, params = []) {
        const results = this.all(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * 执行写操作
     */
    run(sql, params = []) {
        try {
            this.db.run(sql, params);
            this.save();
            return { 
                lastInsertRowid: this.db.exec("SELECT last_insert_rowid()")[0]?.values[0][0],
                changes: this.db.getRowsModified()
            };
        } catch (error) {
            console.error('执行错误:', error);
            throw error;
        }
    }

    /**
     * 创建用户
     */
    createUser(username, passwordHash) {
        try {
            this.run(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                [username, passwordHash]
            );
            
            const user = this.get('SELECT id FROM users WHERE username = ?', [username]);
            
            if (user) {
                // 创建用户统计
                this.run('INSERT INTO user_stats (user_id) VALUES (?)', [user.id]);
                return { success: true, userId: user.id };
            }
            
            return { success: false, error: '创建用户失败' };
        } catch (error) {
            if (error.message && error.message.includes('UNIQUE')) {
                return { success: false, error: '用户名已存在' };
            }
            return { success: false, error: error.message };
        }
    }

    /**
     * 获取用户
     */
    getUser(username) {
        return this.get('SELECT * FROM users WHERE username = ?', [username]);
    }

    /**
     * 获取用户（通过ID）
     */
    getUserById(userId) {
        return this.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    /**
     * 更新最后登录时间
     */
    updateLastLogin(userId) {
        this.run(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [userId]
        );
    }

    /**
     * 获取用户统计
     */
    getUserStats(userId) {
        return this.get(`
            SELECT u.username, s.*
            FROM users u
            JOIN user_stats s ON u.id = s.user_id
            WHERE u.id = ?
        `, [userId]);
    }

    /**
     * 更新用户统计
     */
    updateUserStats(userId, stats) {
        const current = this.getUserStats(userId);
        if (!current) return;

        const newGamesPlayed = current.games_played + (stats.gamesPlayed || 0);
        const newWins = current.wins + (stats.wins || 0);
        const newTotalScore = current.total_score + (stats.score || 0);
        const newHighestScore = Math.max(current.highest_score, stats.score || 0);
        
        // 简单的ELO评分更新
        let ratingChange = 0;
        if (stats.wins) {
            ratingChange = 25;
        } else if (stats.gamesPlayed) {
            ratingChange = -10;
        }
        const newRating = Math.max(100, current.rating + ratingChange);

        this.run(`
            UPDATE user_stats SET
                games_played = ?,
                wins = ?,
                total_score = ?,
                highest_score = ?,
                rating = ?
            WHERE user_id = ?
        `, [newGamesPlayed, newWins, newTotalScore, newHighestScore, newRating, userId]);
    }

    /**
     * 获取排行榜
     */
    getRankings(limit = 50) {
        return this.all(`
            SELECT u.id, u.username, s.games_played, s.wins, s.rating,
                   CASE WHEN s.games_played > 0 
                        THEN ROUND(s.wins * 100.0 / s.games_played, 1)
                        ELSE 0 END as win_rate
            FROM users u
            JOIN user_stats s ON u.id = s.user_id
            WHERE s.games_played > 0
            ORDER BY s.rating DESC
            LIMIT ?
        `, [limit]);
    }

    /**
     * 保存游戏记录
     */
    saveGameRecord(record) {
        this.run(`
            INSERT INTO game_records (id, players, winner_id, rule_set, final_scores, duration)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            record.id,
            JSON.stringify(record.players),
            record.winnerId,
            record.ruleSet,
            JSON.stringify(record.finalScores),
            record.duration
        ]);
    }

    /**
     * 获取用户游戏记录
     */
    getUserGameRecords(userId, limit = 20) {
        const records = this.all(`
            SELECT * FROM game_records
            WHERE players LIKE ?
            ORDER BY created_at DESC
            LIMIT ?
        `, [`%"${userId}"%`, limit]);
        
        return records.map(r => ({
            ...r,
            players: JSON.parse(r.players),
            final_scores: JSON.parse(r.final_scores)
        }));
    }

    /**
     * 保存回放数据
     */
    saveReplay(gameId, data) {
        this.run(
            'INSERT OR REPLACE INTO replays (game_id, data) VALUES (?, ?)',
            [gameId, JSON.stringify(data)]
        );
    }

    /**
     * 获取回放数据
     */
    getReplay(gameId) {
        const result = this.get('SELECT * FROM replays WHERE game_id = ?', [gameId]);
        if (result) {
            result.data = JSON.parse(result.data);
        }
        return result;
    }

    /**
     * 获取用户的回放列表
     */
    getUserReplays(userId, limit = 20) {
        const replays = this.all(`
            SELECT r.game_id, r.created_at, g.players, g.winner_id, g.rule_set
            FROM replays r
            JOIN game_records g ON r.game_id = g.id
            WHERE g.players LIKE ?
            ORDER BY r.created_at DESC
            LIMIT ?
        `, [`%"${userId}"%`, limit]);
        
        return replays.map(r => ({
            ...r,
            players: JSON.parse(r.players)
        }));
    }

    /**
     * 清理旧回放（保留最近30天）
     */
    cleanOldReplays() {
        const result = this.run(`
            DELETE FROM replays
            WHERE created_at < datetime('now', '-30 days')
        `);
        console.log(`清理了 ${result.changes} 条旧回放数据`);
    }
}

module.exports = DatabaseManager;