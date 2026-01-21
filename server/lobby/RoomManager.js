/**
 * 房间管理器
 * Room Manager - 管理游戏房间
 */

const { v4: uuidv4 } = require('uuid');

class RoomManager {
    constructor(io, gameManager) {
        this.io = io;
        this.gameManager = gameManager;
        this.rooms = new Map(); // roomId -> room info
        this.playerRooms = new Map(); // playerId -> roomId
    }

    /**
     * 创建房间
     */
    createRoom(socket, options) {
        const roomId = uuidv4().substring(0, 8).toUpperCase();
        
        const room = {
            id: roomId,
            name: options.name || `${socket.username}的房间`,
            host: socket.userId,
            hostName: socket.username,
            password: options.password || null,
            isPrivate: !!options.password,
            maxPlayers: 4,
            players: [{
                id: socket.userId,
                username: socket.username,
                socket: socket,
                ready: false,
                seatIndex: 0
            }],
            options: {
                ruleSet: options.ruleSet || 'chinese',
                includeFlowers: options.includeFlowers !== false,
                timeLimit: options.timeLimit || 30,
                autoStart: options.autoStart || false
            },
            status: 'waiting', // waiting, playing
            createdAt: Date.now()
        };

        this.rooms.set(roomId, room);
        this.playerRooms.set(socket.userId, roomId);

        // 加入Socket房间
        socket.join(`room:${roomId}`);
        socket.currentRoom = roomId;

        socket.emit('roomCreated', {
            roomId,
            room: this.getRoomPublicInfo(room)
        });

        this.broadcastRoomList();
        
        console.log(`房间 ${roomId} 创建成功，房主: ${socket.username}`);
        
        return room;
    }

    /**
     * 加入房间
     */
    joinRoom(socket, roomId, password = null) {
        const room = this.rooms.get(roomId);
        
        if (!room) {
            socket.emit('joinRoomError', { error: '房间不存在' });
            return false;
        }

        if (room.status === 'playing') {
            socket.emit('joinRoomError', { error: '游戏已经开始' });
            return false;
        }

        if (room.players.length >= room.maxPlayers) {
            socket.emit('joinRoomError', { error: '房间已满' });
            return false;
        }

        if (room.password && room.password !== password) {
            socket.emit('joinRoomError', { error: '密码错误' });
            return false;
        }

        // 如果玩家已在其他房间，先离开
        if (this.playerRooms.has(socket.userId)) {
            this.leaveRoom(socket);
        }

        // 找到空座位
        const takenSeats = room.players.map(p => p.seatIndex);
        let seatIndex = 0;
        while (takenSeats.includes(seatIndex)) {
            seatIndex++;
        }

        room.players.push({
            id: socket.userId,
            username: socket.username,
            socket: socket,
            ready: false,
            seatIndex
        });

        this.playerRooms.set(socket.userId, roomId);
        socket.join(`room:${roomId}`);
        socket.currentRoom = roomId;

        // 通知房间内所有人
        this.broadcastToRoom(roomId, 'playerJoined', {
            player: {
                id: socket.userId,
                username: socket.username,
                seatIndex
            },
            room: this.getRoomPublicInfo(room)
        });

        socket.emit('roomJoined', {
            roomId,
            room: this.getRoomPublicInfo(room)
        });

        this.broadcastRoomList();

        console.log(`玩家 ${socket.username} 加入房间 ${roomId}`);
        
        return true;
    }

    /**
     * 离开房间
     */
    leaveRoom(socket) {
        const roomId = this.playerRooms.get(socket.userId);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) {
            this.playerRooms.delete(socket.userId);
            return;
        }

        // 从房间移除玩家
        const playerIndex = room.players.findIndex(p => p.id === socket.userId);
        if (playerIndex !== -1) {
            room.players.splice(playerIndex, 1);
        }

        this.playerRooms.delete(socket.userId);
        socket.leave(`room:${roomId}`);
        socket.currentRoom = null;

        // 如果房间空了，删除房间
        if (room.players.length === 0) {
            this.rooms.delete(roomId);
            console.log(`房间 ${roomId} 已删除（无玩家）`);
        } else {
            // 如果离开的是房主，转移房主
            if (room.host === socket.userId) {
                room.host = room.players[0].id;
                room.hostName = room.players[0].username;
            }

            this.broadcastToRoom(roomId, 'playerLeft', {
                playerId: socket.userId,
                username: socket.username,
                room: this.getRoomPublicInfo(room)
            });
        }

        socket.emit('roomLeft');
        this.broadcastRoomList();

        console.log(`玩家 ${socket.username} 离开房间 ${roomId}`);
    }

    /**
     * 处理聊天消息
     */
    handleChat(socket, message) {
        const roomId = this.playerRooms.get(socket.userId);
        if (!roomId) return;

        this.broadcastToRoom(roomId, 'roomChat', {
            playerId: socket.userId,
            username: socket.username,
            message: message.substring(0, 200), // 限制消息长度
            timestamp: Date.now()
        });
    }

    /**
     * 设置玩家准备状态
     */
    setPlayerReady(socket, ready) {
        const roomId = this.playerRooms.get(socket.userId);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.userId);
        if (player) {
            player.ready = ready;

            this.broadcastToRoom(roomId, 'playerReady', {
                playerId: socket.userId,
                ready,
                room: this.getRoomPublicInfo(room)
            });

            // 检查是否可以自动开始
            if (room.options.autoStart && this.canStartGame(room)) {
                this.startGame(socket);
            }
        }
    }

    /**
     * 检查是否可以开始游戏
     */
    canStartGame(room) {
        if (room.players.length !== 4) return false;
        return room.players.every(p => p.ready || p.id === room.host);
    }

    /**
     * 开始游戏
     */
    startGame(socket) {
        const roomId = this.playerRooms.get(socket.userId);
        if (!roomId) {
            socket.emit('error', { message: '不在房间中' });
            return;
        }

        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('error', { message: '房间不存在' });
            return;
        }

        // 只有房主可以开始游戏
        if (room.host !== socket.userId) {
            socket.emit('error', { message: '只有房主可以开始游戏' });
            return;
        }

        // 检查人数
        if (room.players.length !== 4) {
            socket.emit('error', { message: '需要4名玩家才能开始' });
            return;
        }

        // 检查准备状态（房主除外）
        const notReady = room.players.filter(p => p.id !== room.host && !p.ready);
        if (notReady.length > 0) {
            socket.emit('error', { message: '还有玩家未准备' });
            return;
        }

        // 创建游戏
        const gamePlayers = room.players
            .sort((a, b) => a.seatIndex - b.seatIndex)
            .map(p => ({
                id: p.id,
                username: p.username,
                socket: p.socket
            }));

        const game = this.gameManager.createGame(roomId, gamePlayers, room.options);
        
        room.status = 'playing';

        this.broadcastToRoom(roomId, 'gameStarting', {
            gameId: roomId,
            players: gamePlayers.map(p => ({ id: p.id, username: p.username }))
        });

        // 开始游戏
        this.gameManager.startGame(roomId);

        this.broadcastRoomList();

        console.log(`房间 ${roomId} 游戏开始`);
    }

    /**
     * 处理玩家断线
     */
    handleDisconnect(socket) {
        const roomId = this.playerRooms.get(socket.userId);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        if (room.status === 'waiting') {
            // 等待中直接离开
            this.leaveRoom(socket);
        } else {
            // 游戏中标记离线
            const player = room.players.find(p => p.id === socket.userId);
            if (player) {
                player.offline = true;
                player.socket = null;

                this.broadcastToRoom(roomId, 'playerOffline', {
                    playerId: socket.userId,
                    username: socket.username
                });
            }
        }
    }

    /**
     * 广播到房间
     */
    broadcastToRoom(roomId, event, data) {
        this.io.to(`room:${roomId}`).emit(event, data);
    }

    /**
     * 广播房间列表
     */
    broadcastRoomList() {
        const rooms = this.getPublicRooms();
        this.io.to('lobby').emit('roomList', rooms);
    }

    /**
     * 获取公开房间列表
     */
    getPublicRooms() {
        const rooms = [];
        this.rooms.forEach((room, id) => {
            if (!room.isPrivate && room.status === 'waiting') {
                rooms.push(this.getRoomPublicInfo(room));
            }
        });
        return rooms;
    }

    /**
     * 获取房间公开信息
     */
    getRoomPublicInfo(room) {
        return {
            id: room.id,
            name: room.name,
            hostName: room.hostName,
            playerCount: room.players.length,
            maxPlayers: room.maxPlayers,
            isPrivate: room.isPrivate,
            status: room.status,
            ruleSet: room.options.ruleSet,
            players: room.players.map(p => ({
                id: p.id,
                username: p.username,
                ready: p.ready,
                seatIndex: p.seatIndex,
                isHost: p.id === room.host
            }))
        };
    }

    /**
     * 获取房间数量
     */
    getRoomCount() {
        return this.rooms.size;
    }

    /**
     * 通过ID获取房间
     */
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
}

module.exports = RoomManager;
