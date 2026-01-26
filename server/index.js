const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const DatabaseManager = require('./database/Database');
const LobbyManager = require('./lobby/LobbyManager');
const RoomManager = require('./lobby/RoomManager');
const GameManager = require('./game/GameManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 提供静态文件服务 - 指向 client 目录
app.use(express.static(path.join(__dirname, '../client')));

const dbManager = new DatabaseManager();

// 初始化管理器
let lobbyManager, roomManager, gameManager;

// 等待数据库初始化后再创建管理器
dbManager.ready.then(() => {
    gameManager = new GameManager(io, dbManager, null);
    roomManager = new RoomManager(io, gameManager);
    lobbyManager = new LobbyManager(io, roomManager, dbManager);
    console.log('管理器初始化完成');
});

// Middleware to check if the database is ready
app.use(async (req, res, next) => {
    await dbManager.ready;
    next();
});

// 首页路由 - 返回前端页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// API 路由 - 登录
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await dbManager.getUserByUsername(username);
        
        if (!user) {
            return res.json({ success: false, error: '用户名不存在' });
        }
        
        const valid = await dbManager.verifyPassword(password, user.password_hash);
        if (!valid) {
            return res.json({ success: false, error: '密码错误' });
        }
        
        // 更新最后登录时间
        dbManager.updateLastLogin(user.id);
        
        // 简单的 token（实际应用中应该使用 JWT）
        const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
        
        res.json({ 
            success: true, 
            token,
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.json({ success: false, error: '登录失败' });
    }
});

// API 路由 - 注册
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || username.length < 2) {
            return res.json({ success: false, error: '用户名至少2个字符' });
        }
        
        if (!password || password.length < 6) {
            return res.json({ success: false, error: '密码至少6个字符' });
        }
        
        const existingUser = await dbManager.getUserByUsername(username);
        if (existingUser) {
            return res.json({ success: false, error: '用户名已存在' });
        }
        
        const result = await dbManager.createUser(username, password);
        if (result.success) {
            const token = Buffer.from(`${result.userId}:${Date.now()}`).toString('base64');
            res.json({ 
                success: true, 
                token,
                user: { id: result.userId, username }
            });
        } else {
            res.json({ success: false, error: result.error });
        }
    } catch (error) {
        console.error('注册错误:', error);
        res.json({ success: false, error: '注册失败' });
    }
});

// API 路由 - 排行榜
app.get('/api/rankings', async (req, res) => {
    try {
        const rankings = await dbManager.getRankings(20);
        res.json(rankings || []);
    } catch (error) {
        console.error('获取排行榜错误:', error);
        res.json([]);
    }
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 用户认证
    socket.on('authenticate', async (data) => {
        try {
            if (data.token) {
                // 解析 token
                const decoded = Buffer.from(data.token, 'base64').toString();
                const [userId] = decoded.split(':');
                const user = await dbManager.getUserById(parseInt(userId));
                
                if (user) {
                    socket.userId = user.id;
                    socket.username = user.username;
                    socket.isGuest = false;
                    
                    // 加入大厅
                    if (lobbyManager) {
                        lobbyManager.addPlayer(socket);
                    }
                    
                    socket.emit('authenticated', { 
                        success: true, 
                        user: { id: user.id, username: user.username }
                    });
                    console.log(`用户 ${socket.username} 已认证`);
                    return;
                }
            }
            
            socket.emit('authenticated', { success: false, error: '认证失败' });
        } catch (error) {
            console.error('认证错误:', error);
            socket.emit('authenticated', { success: false, error: '认证失败' });
        }
    });

    // 游客登录
    socket.on('guestLogin', (data) => {
        const nickname = data.nickname || '游客' + Math.floor(Math.random() * 10000);
        socket.userId = 'guest_' + socket.id;
        socket.username = nickname;
        socket.isGuest = true;
        
        // 加入大厅
        if (lobbyManager) {
            lobbyManager.addPlayer(socket);
        }
        
        socket.emit('authenticated', { 
            success: true, 
            user: { id: socket.userId, username: nickname, isGuest: true }
        });
        console.log(`游客 ${nickname} 已登录`);
    });

    // 获取大厅信息
    socket.on('getLobbyInfo', () => {
        if (lobbyManager) {
            lobbyManager.sendLobbyInfo(socket);
        }
    });

    // 获取房间列表
    socket.on('getRooms', () => {
        if (roomManager) {
            const rooms = roomManager.getPublicRooms();
            socket.emit('roomList', rooms);
        }
    });

    // 创建房间
    socket.on('createRoom', (options) => {
        if (roomManager) {
            roomManager.createRoom(socket, options);
            if (lobbyManager) {
                lobbyManager.updatePlayerStatus(socket.id, 'inRoom');
            }
        }
    });

    // 加入房间
    socket.on('joinRoom', (data) => {
        if (roomManager) {
            const success = roomManager.joinRoom(socket, data.roomId, data.password);
            if (success && lobbyManager) {
                lobbyManager.updatePlayerStatus(socket.id, 'inRoom');
            }
        }
    });

    // 离开房间
    socket.on('leaveRoom', () => {
        if (roomManager) {
            roomManager.leaveRoom(socket);
            if (lobbyManager) {
                lobbyManager.updatePlayerStatus(socket.id, 'idle');
            }
        }
    });

    // 玩家准备
    socket.on('playerReady', (data) => {
        if (roomManager) {
            roomManager.setPlayerReady(socket, data.ready);
        }
    });

    // 房间聊天
    socket.on('roomChat', (data) => {
        if (roomManager && data && data.message) {
            roomManager.handleChat(socket, data.message);
        }
    });

    // 开始游戏
    socket.on('startGame', () => {
        if (roomManager) {
            roomManager.startGame(socket);
        }
    });

    // 游戏操作 - 打牌
    socket.on('discardTile', (data) => {
        if (gameManager) {
            gameManager.handleDiscardTile(socket, data.tile);
        }
    });

    // 游戏操作 - 碰
    socket.on('pong', () => {
        if (gameManager) {
            gameManager.handlePong(socket);
        }
    });

    // 游戏操作 - 杠
    socket.on('kong', (data) => {
        if (gameManager) {
            gameManager.handleKong(socket, data.type);
        }
    });

    // 游戏操作 - 吃
    socket.on('chow', (data) => {
        if (gameManager) {
            gameManager.handleChow(socket, data.tiles);
        }
    });

    // 游戏操作 - 胡
    socket.on('hu', () => {
        if (gameManager) {
            gameManager.handleHu(socket);
        }
    });

    // 游戏操作 - 跳过
    socket.on('pass', () => {
        if (gameManager) {
            gameManager.handlePass(socket);
        }
    });

    // 获取用户回放列表
    socket.on('getUserReplays', async () => {
        try {
            if (socket.userId && !socket.isGuest) {
                const replays = await dbManager.getUserReplays(socket.userId, 20);
                socket.emit('userReplays', replays || []);
            } else {
                socket.emit('userReplays', []);
            }
        } catch (error) {
            console.error('获取回放错误:', error);
            socket.emit('userReplays', []);
        }
    });

    // 断开连接
    socket.on('disconnect', () => {
        console.log('用户断开:', socket.id);
        
        if (lobbyManager) {
            lobbyManager.removePlayer(socket);
        }
        
        if (roomManager) {
            roomManager.handleDisconnect(socket);
        }
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});