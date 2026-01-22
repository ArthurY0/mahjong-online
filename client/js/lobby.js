/**
 * 大厅模块
 */

const Lobby = {
    initialized: false,
    
    /**
     * 初始化大厅
     */
    init() {
        if (!this.initialized) {
            this.setupEventListeners();
            this.setupSocketListeners();
            this.initialized = true;
        }
        this.requestLobbyInfo();
        this.loadRankings();
    },

    /**
     * 设置事件监听
     */
    setupEventListeners() {
        // 退出按钮
        document.getElementById('logout-btn').addEventListener('click', () => {
            if (confirm('确定要退出登录吗？')) {
                Auth.logout();
            }
        });

        // 创建房间按钮
        document.getElementById('create-room-btn').addEventListener('click', () => {
            Utils.showModal('create-room-modal');
        });

        // 快速匹配按钮
        document.getElementById('quick-match-btn').addEventListener('click', () => {
            this.quickMatch();
        });

        // 创建房间表单
        document.getElementById('create-room-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createRoom();
        });

        // 取消创建按钮
        document.getElementById('cancel-create').addEventListener('click', () => {
            Utils.hideModal('create-room-modal');
        });

        // 加入房间密码表单
        document.getElementById('join-room-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('join-password').value;
            this.joinRoomWithPassword(password);
        });

        document.getElementById('cancel-join').addEventListener('click', () => {
            Utils.hideModal('join-room-modal');
            this.pendingRoomId = null;
        });

        // Tab切换
        const lobbyTabs = document.querySelector('.lobby-tabs');
        lobbyTabs.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                Utils.switchTab(tab.dataset.tab, lobbyTabs);
                
                // 加载对应内容
                if (tab.dataset.tab === 'rankings') {
                    this.loadRankings();
                } else if (tab.dataset.tab === 'replays') {
                    this.loadReplays();
                }
            });
        });

        // 房间搜索
        document.getElementById('room-search').addEventListener('input', 
            Utils.debounce((e) => this.filterRooms(e.target.value), 300)
        );

        // 房间筛选
        document.getElementById('room-filter').addEventListener('change', (e) => {
            this.filterRooms(document.getElementById('room-search').value, e.target.value);
        });
    },

    /**
     * 设置Socket监听
     */
    setupSocketListeners() {
        socketHandler.on('lobbyInfo', (info) => {
            this.updateLobbyStats(info);
        });

        socketHandler.on('lobbyUpdate', (info) => {
            this.updateLobbyStats(info);
        });

        socketHandler.on('roomList', (rooms) => {
            this.allRooms = rooms;
            this.renderRoomList(rooms);
        });

        socketHandler.on('roomCreated', (data) => {
            Utils.hideModal('create-room-modal');
            Room.enterRoom(data.room);
        });

        socketHandler.on('roomJoined', (data) => {
            Utils.hideModal('join-room-modal');
            Room.enterRoom(data.room);
        });

        socketHandler.on('joinRoomError', (data) => {
            Utils.showToast(data.error, 'error');
        });

        socketHandler.on('systemMessage', (data) => {
            Utils.showToast(data.content, 'info');
        });
    },

    /**
     * 请求大厅信息
     */
    requestLobbyInfo() {
        socketHandler.emit('getLobbyInfo');
        socketHandler.emit('getRooms');
    },

    /**
     * 更新大厅统计
     */
    updateLobbyStats(info) {
        document.getElementById('online-count').textContent = info.onlineCount || 0;
        document.getElementById('room-count').textContent = info.roomCount || 0;
        document.getElementById('playing-count').textContent = info.playingCount || 0;
    },

    /**
     * 渲染房间列表
     */
    renderRoomList(rooms) {
        const container = document.getElementById('room-list');
        container.innerHTML = '';

        if (rooms.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">暂无房间，创建一个吧！</p>';
            return;
        }

        rooms.forEach(room => {
            const card = document.createElement('div');
            card.className = 'room-card';
            card.innerHTML = `
                <div class="room-info">
                    <h3>${this.escapeHtml(room.name)} ${room.isPrivate ? '🔒' : ''}</h3>
                    <span>房主: ${this.escapeHtml(room.hostName)} | 规则: ${room.ruleSet === 'japanese' ? '日麻' : '国标'}</span>
                </div>
                <div class="room-right">
                    <span class="room-players">${room.playerCount}/${room.maxPlayers}</span>
                    <button class="btn btn-primary btn-small">加入</button>
                </div>
            `;

            card.querySelector('button').addEventListener('click', () => {
                this.joinRoom(room.id, room.isPrivate);
            });

            container.appendChild(card);
        });
    },

    /**
     * 筛选房间
     */
    filterRooms(searchText = '', ruleFilter = 'all') {
        if (!this.allRooms) return;

        let filtered = this.allRooms;

        if (searchText) {
            const search = searchText.toLowerCase();
            filtered = filtered.filter(room => 
                room.name.toLowerCase().includes(search) ||
                room.hostName.toLowerCase().includes(search)
            );
        }

        if (ruleFilter !== 'all') {
            filtered = filtered.filter(room => room.ruleSet === ruleFilter);
        }

        this.renderRoomList(filtered);
    },

    /**
     * 创建房间
     */
    createRoom() {
        const data = {
            name: document.getElementById('room-name').value.trim() || undefined,
            ruleSet: document.getElementById('room-ruleset').value,
            password: document.getElementById('room-password').value || undefined,
            includeFlowers: document.getElementById('room-flowers').checked,
            timeLimit: parseInt(document.getElementById('room-timelimit').value)
        };

        socketHandler.emit('createRoom', data);
    },

    /**
     * 加入房间
     */
    joinRoom(roomId, isPrivate) {
        if (isPrivate) {
            this.pendingRoomId = roomId;
            Utils.showModal('join-room-modal');
        } else {
            socketHandler.emit('joinRoom', { roomId });
        }
    },

    /**
     * 输入密码后加入房间
     */
    joinRoomWithPassword(password) {
        if (this.pendingRoomId) {
            socketHandler.emit('joinRoom', { 
                roomId: this.pendingRoomId, 
                password 
            });
        }
    },

    /**
     * 快速匹配
     */
    quickMatch() {
        Utils.showToast('正在寻找房间...', 'info');
        
        // 查找有空位的公开房间
        if (this.allRooms && this.allRooms.length > 0) {
            const availableRooms = this.allRooms.filter(r => 
                !r.isPrivate && r.playerCount < r.maxPlayers
            );
            
            if (availableRooms.length > 0) {
                // 随机加入一个房间
                const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];
                socketHandler.emit('joinRoom', { roomId: room.id });
                return;
            }
        }

        // 没有可用房间，创建一个
        Utils.showToast('没有可用房间，为您创建新房间', 'info');
        socketHandler.emit('createRoom', { name: '快速匹配房间' });
    },

    /**
     * 加载排行榜
     */
    async loadRankings() {
        try {
            const response = await fetch('/api/rankings');
            const rankings = await response.json();
            this.renderRankings(rankings);
        } catch (error) {
            console.error('加载排行榜失败:', error);
        }
    },

    /**
     * 渲染排行榜
     */
    renderRankings(rankings) {
        const tbody = document.getElementById('rankings-body');
        tbody.innerHTML = '';

        rankings.forEach((player, index) => {
            const tr = document.createElement('tr');
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
            
            tr.innerHTML = `
                <td>${rankEmoji} ${index + 1}</td>
                <td>${this.escapeHtml(player.username)}</td>
                <td>${player.rating}</td>
                <td>${player.win_rate}%</td>
                <td>${player.games_played}</td>
            `;
            tbody.appendChild(tr);
        });

        if (rankings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">暂无数据</td></tr>';
        }
    },

    /**
     * 加载回放列表
     */
    loadReplays() {
        socketHandler.emit('getUserReplays');
        
        socketHandler.once('userReplays', (replays) => {
            this.renderReplays(replays);
        });
    },

    /**
     * 渲染回放列表
     */
    renderReplays(replays) {
        const container = document.getElementById('replays-list');
        container.innerHTML = '';

        if (!replays || replays.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">暂无回放记录</p>';
            return;
        }

        replays.forEach(replay => {
            const card = document.createElement('div');
            card.className = 'replay-card';
            
            const players = replay.players.map(p => p.username).join(' vs ');
            
            card.innerHTML = `
                <div class="replay-info">
                    <div>${players}</div>
                    <div style="color: var(--text-secondary); font-size: 12px;">
                        ${Utils.formatDate(replay.created_at)} | ${replay.rule_set === 'japanese' ? '日麻' : '国标'}
                    </div>
                </div>
                <button class="btn btn-small btn-secondary">观看</button>
            `;

            card.querySelector('button').addEventListener('click', () => {
                Replay.load(replay.game_id);
            });

            container.appendChild(card);
        });
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

window.Lobby = Lobby;
