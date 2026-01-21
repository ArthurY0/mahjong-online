/**
 * 大厅管理器
 * Lobby Manager - 管理游戏大厅
 */

class LobbyManager {
    constructor(io, roomManager, db) {
        this.io = io;
        this.roomManager = roomManager;
        this.db = db;
        this.onlinePlayers = new Map(); // socketId -> player info
    }

    /**
     * 添加玩家到大厅
     */
    addPlayer(socket) {
        this.onlinePlayers.set(socket.id, {
            id: socket.userId,
            username: socket.username,
            isGuest: socket.isGuest || false,
            socket: socket,
            status: 'idle' // idle, inRoom, playing
        });

        // 加入大厅房间
        socket.join('lobby');

        // 广播玩家上线
        this.broadcastLobbyUpdate();

        console.log(`玩家 ${socket.username} 进入大厅`);
    }

    /**
     * 从大厅移除玩家
     */
    removePlayer(socket) {
        this.onlinePlayers.delete(socket.id);
        socket.leave('lobby');
        this.broadcastLobbyUpdate();
        console.log(`玩家 ${socket.username} 离开大厅`);
    }

    /**
     * 发送大厅信息
     */
    sendLobbyInfo(socket) {
        const info = {
            onlineCount: this.onlinePlayers.size,
            roomCount: this.roomManager.getRoomCount(),
            playingCount: this.getPlayingCount()
        };
        socket.emit('lobbyInfo', info);
    }

    /**
     * 发送房间列表
     */
    sendRoomList(socket) {
        const rooms = this.roomManager.getPublicRooms();
        socket.emit('roomList', rooms);
    }

    /**
     * 广播大厅更新
     */
    broadcastLobbyUpdate() {
        const info = {
            onlineCount: this.onlinePlayers.size,
            roomCount: this.roomManager.getRoomCount(),
            playingCount: this.getPlayingCount()
        };
        this.io.to('lobby').emit('lobbyUpdate', info);
    }

    /**
     * 获取正在游戏的玩家数量
     */
    getPlayingCount() {
        let count = 0;
        this.onlinePlayers.forEach(player => {
            if (player.status === 'playing') {
                count++;
            }
        });
        return count;
    }

    /**
     * 更新玩家状态
     */
    updatePlayerStatus(socketId, status) {
        const player = this.onlinePlayers.get(socketId);
        if (player) {
            player.status = status;
            this.broadcastLobbyUpdate();
        }
    }

    /**
     * 获取玩家信息
     */
    getPlayer(socketId) {
        return this.onlinePlayers.get(socketId);
    }

    /**
     * 获取在线玩家列表
     */
    getOnlinePlayers() {
        const players = [];
        this.onlinePlayers.forEach((player, socketId) => {
            players.push({
                id: player.id,
                username: player.username,
                status: player.status
            });
        });
        return players;
    }

    /**
     * 发送系统消息
     */
    sendSystemMessage(message) {
        this.io.to('lobby').emit('systemMessage', {
            type: 'system',
            content: message,
            timestamp: Date.now()
        });
    }
}

module.exports = LobbyManager;
