/**
 * 房间模块
 */

const Room = {
    currentRoom: null,
    isReady: false,
    isHost: false,
    initialized: false,

    /**
     * 进入房间
     */
    enterRoom(room) {
        this.currentRoom = room;
        this.isHost = room.players.some(p => p.isHost && p.id === Auth.getUser().id);
        this.isReady = false;

        if (!this.initialized) {
            this.setupEventListeners();
            this.setupSocketListeners();
            this.initialized = true;
        }
        this.updateRoomUI();

        Utils.switchScreen('room-screen');
    },

    /**
     * 设置事件监听
     */
    setupEventListeners() {
        // 离开房间
        document.getElementById('leave-room-btn').addEventListener('click', () => {
            this.leaveRoom();
        });

        // 准备按钮
        document.getElementById('ready-btn').addEventListener('click', () => {
            this.toggleReady();
        });

        // 开始游戏按钮
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame();
        });

        // 聊天
        document.getElementById('chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const message = input.value.trim();
            if (message) {
                socketHandler.emit('roomChat', { message });
                input.value = '';
            }
        });
    },

    /**
     * 设置Socket监听
     */
    setupSocketListeners() {
        socketHandler.on('playerJoined', (data) => {
            this.currentRoom = data.room;
            this.updateRoomUI();
            this.addChatMessage({
                type: 'system',
                content: `${data.player.username} 加入了房间`
            });
        });

        socketHandler.on('playerLeft', (data) => {
            this.currentRoom = data.room;
            this.updateRoomUI();
            this.addChatMessage({
                type: 'system',
                content: `${data.username} 离开了房间`
            });
        });

        socketHandler.on('playerReady', (data) => {
            this.currentRoom = data.room;
            // 如果是自己的准备状态变化，同步本地状态
            if (data.playerId === Auth.getUser().id) {
                this.isReady = data.ready;
            }
            this.updateRoomUI();
        });

        socketHandler.on('playerOffline', (data) => {
            this.addChatMessage({
                type: 'system',
                content: `${data.username} 断开连接`
            });
        });

        socketHandler.on('roomChat', (data) => {
            this.addChatMessage({
                sender: data.username,
                content: data.message,
                time: data.timestamp
            });
        });

        socketHandler.on('roomLeft', () => {
            this.currentRoom = null;
            Utils.switchScreen('lobby-screen');
            Lobby.requestLobbyInfo();
        });

        socketHandler.on('gameStarting', (data) => {
            Utils.showToast('游戏即将开始!', 'success');
            Game.init(data);
        });

        socketHandler.on('error', (data) => {
            Utils.showToast(data.message, 'error');
        });
    },

    /**
     * 更新房间UI
     */
    updateRoomUI() {
        if (!this.currentRoom) return;

        const room = this.currentRoom;
        const userId = Auth.getUser().id;

        // 更新房间信息
        document.getElementById('room-title').textContent = room.name;
        document.getElementById('room-id-display').textContent = `房间号: ${room.id}`;
        document.getElementById('room-ruleset-display').textContent = 
            room.ruleSet === 'japanese' ? '日本麻将' : '中国麻将';

        // 更新座位
        const seats = document.querySelectorAll('.seat');
        seats.forEach(seat => {
            const seatIndex = parseInt(seat.dataset.seat);
            const player = room.players.find(p => p.seatIndex === seatIndex);

            const avatarEl = seat.querySelector('.seat-avatar');
            const nameEl = seat.querySelector('.seat-name');
            const statusEl = seat.querySelector('.seat-status');

            // 重置状态
            seat.classList.remove('occupied', 'ready', 'host');

            if (player) {
                seat.classList.add('occupied');
                if (player.ready) seat.classList.add('ready');
                if (player.isHost) seat.classList.add('host');

                avatarEl.textContent = player.id === userId ? '🀄' : '👤';
                nameEl.textContent = player.username + (player.isHost ? ' 👑' : '');
                
                if (player.id === userId) {
                    statusEl.textContent = this.isReady ? '已准备' : '点击准备';
                    statusEl.className = 'seat-status' + (this.isReady ? ' ready' : '');
                } else {
                    statusEl.textContent = player.ready ? '已准备' : '等待准备';
                    statusEl.className = 'seat-status' + (player.ready ? ' ready' : '');
                }
            } else {
                avatarEl.textContent = '🀫';
                nameEl.textContent = '等待加入...';
                statusEl.textContent = '';
            }
        });

        // 更新按钮状态
        this.isHost = room.players.some(p => p.isHost && p.id === userId);
        
        const readyBtn = document.getElementById('ready-btn');
        const startBtn = document.getElementById('start-btn');

        if (this.isHost) {
            readyBtn.style.display = 'none';
            startBtn.style.display = 'block';
            
            // 检查是否可以开始
            const canStart = room.players.length === 4 && 
                room.players.filter(p => !p.isHost).every(p => p.ready);
            startBtn.disabled = !canStart;
            startBtn.textContent = canStart ? '开始游戏' : `等待玩家 (${room.players.length}/4)`;
        } else {
            readyBtn.style.display = 'block';
            startBtn.style.display = 'none';
            readyBtn.textContent = this.isReady ? '取消准备' : '准备';
            readyBtn.className = `btn btn-large ${this.isReady ? 'btn-secondary' : 'btn-primary'}`;
        }
    },

    /**
     * 切换准备状态
     */
    toggleReady() {
        this.isReady = !this.isReady;
        socketHandler.emit('playerReady', { ready: this.isReady });
        // 立即更新本地UI，提供即时反馈
        this.updateRoomUI();
    },

    /**
     * 离开房间
     */
    leaveRoom() {
        socketHandler.emit('leaveRoom');
        // 不在这里调用 cleanup()，等待服务器返回 roomLeft 事件后再清理
        // 同时直接切换界面，防止用户等待
        this.currentRoom = null;
        Utils.switchScreen('lobby-screen');
        Lobby.requestLobbyInfo();
    },

    /**
     * 开始游戏
     */
    startGame() {
        socketHandler.emit('startGame');
    },

    /**
     * 添加聊天消息
     */
    addChatMessage(data) {
        const container = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message' + (data.type === 'system' ? ' system' : '');

        if (data.type === 'system') {
            messageDiv.textContent = data.content;
        } else {
            messageDiv.innerHTML = `
                <span class="sender">${this.escapeHtml(data.sender)}</span>
                <span class="content">${this.escapeHtml(data.content)}</span>
                <span class="time">${Utils.formatTime(data.time)}</span>
            `;
        }

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
    },

    /**
     * 清理
     */
    cleanup() {
        this.currentRoom = null;
        this.isReady = false;
        this.isHost = false;
        document.getElementById('chat-messages').innerHTML = '';
        
        // 移除事件监听
        socketHandler.off('playerJoined');
        socketHandler.off('playerLeft');
        socketHandler.off('playerReady');
        socketHandler.off('roomChat');
        socketHandler.off('roomLeft');
        socketHandler.off('gameStarting');
    },

    /**
     * 转义HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

window.Room = Room;
