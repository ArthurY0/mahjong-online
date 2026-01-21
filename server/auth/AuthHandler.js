/**
 * 用户认证处理
 * Authentication Handler
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mahjong-secret-key-change-in-production';
const SALT_ROUNDS = 10;

class AuthHandler {
    constructor(db) {
        this.db = db;
    }

    /**
     * 注册新用户
     */
    async register(username, password) {
        // 验证输入
        if (!username || username.length < 2 || username.length > 20) {
            return { success: false, error: '用户名长度需要在2-20个字符之间' };
        }

        if (!password || password.length < 6) {
            return { success: false, error: '密码至少需要6个字符' };
        }

        // 检查用户名格式
        if (!/^[a-zA-Z0-9\u4e00-\u9fa5_]+$/.test(username)) {
            return { success: false, error: '用户名只能包含字母、数字、中文和下划线' };
        }

        try {
            // 加密密码
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
            
            // 创建用户
            const result = this.db.createUser(username, passwordHash);
            
            if (!result.success) {
                return result;
            }

            // 生成token
            const token = this.generateToken(result.userId, username);

            return {
                success: true,
                user: {
                    id: result.userId,
                    username
                },
                token
            };
        } catch (error) {
            console.error('注册错误:', error);
            return { success: false, error: '注册失败，请稍后重试' };
        }
    }

    /**
     * 用户登录
     */
    async login(username, password) {
        try {
            const user = this.db.getUser(username);
            
            if (!user) {
                return { success: false, error: '用户名或密码错误' };
            }

            const isValid = await bcrypt.compare(password, user.password_hash);
            
            if (!isValid) {
                return { success: false, error: '用户名或密码错误' };
            }

            // 更新最后登录时间
            this.db.updateLastLogin(user.id);

            // 获取用户统计
            const stats = this.db.getUserStats(user.id);

            // 生成token
            const token = this.generateToken(user.id, user.username);

            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    stats: {
                        gamesPlayed: stats.games_played,
                        wins: stats.wins,
                        rating: stats.rating
                    }
                },
                token
            };
        } catch (error) {
            console.error('登录错误:', error);
            return { success: false, error: '登录失败，请稍后重试' };
        }
    }

    /**
     * 生成JWT token
     */
    generateToken(userId, username) {
        return jwt.sign(
            { id: userId, username },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
    }

    /**
     * 验证token
     */
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            return decoded;
        } catch (error) {
            return null;
        }
    }

    /**
     * 刷新token
     */
    refreshToken(token) {
        const user = this.verifyToken(token);
        if (!user) {
            return null;
        }
        return this.generateToken(user.id, user.username);
    }
}

module.exports = AuthHandler;
