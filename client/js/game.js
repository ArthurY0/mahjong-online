/**
 * 游戏模块
 */

const Game = {
    gameState: null,
    selectedTile: null,
    timerInterval: null,
    pendingActions: null,
    chatOpen: false,
    unreadCount: 0,
    mediaRecorder: null,
    audioChunks: [],
    isRecording: false,

    /**
     * 初始化游戏
     */
    init(data) {
        this.gameState = null;
        this.selectedTile = null;
        this.pendingActions = null;
        this.chatOpen = false;
        this.unreadCount = 0;

        this.setupSocketListeners();
        this.setupChatListeners();
        Utils.switchScreen('game-screen');

        Utils.showToast('游戏开始!', 'success');
    },

    /**
     * 设置Socket监听
     */
    setupSocketListeners() {
        socketHandler.on('gameState', (state) => {
            this.gameState = state;
            this.renderGame();
        });

        socketHandler.on('actionRequired', (data) => {
            this.pendingActions = data;
            this.showActionButtons(data);
        });

        socketHandler.on('canMahjong', (data) => {
            this.showMahjongButton();
        });

        socketHandler.on('canKong', (data) => {
            this.showKongButton(data);
        });

        socketHandler.on('gameEnd', (data) => {
            this.showGameResult(data);
        });

        socketHandler.on('gameDraw', (data) => {
            this.showDrawResult(data);
        });

        socketHandler.on('error', (data) => {
            Utils.showToast(data.message, 'error');
        });

        // 游戏内聊天消息
        socketHandler.on('gameChat', (data) => {
            this.addGameChatMessage(data);
        });

        // 语音消息
        socketHandler.on('voiceMessage', (data) => {
            this.playVoiceMessage(data);
        });
    },

    /**
     * 设置聊天监听
     */
    setupChatListeners() {
        const toggleBtn = document.getElementById('game-chat-toggle');
        const closeBtn = document.getElementById('game-chat-close');
        const chatPanel = document.getElementById('game-chat-panel');
        const chatInput = document.getElementById('game-chat-input');
        const sendBtn = document.getElementById('game-chat-send-btn');
        const voiceBtn = document.getElementById('game-chat-voice-btn');
        const quickMsgBtns = document.querySelectorAll('.quick-msg-btn');

        if (!toggleBtn || !chatPanel) return;

        // 切换聊天面板
        toggleBtn.addEventListener('click', () => {
            this.toggleChatPanel();
        });

        // 关闭聊天面板
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeChatPanel();
            });
        }

        // 发送文字消息
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendTextMessage();
            });
        }

        // 输入框回车发送
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.sendTextMessage();
                }
            });
        }

        // 快捷消息按钮
        quickMsgBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const msg = btn.getAttribute('data-msg');
                if (msg) {
                    this.sendQuickMessage(msg);
                }
            });
        });

        // 语音按钮 - 按住说话
        if (voiceBtn) {
            voiceBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.startVoiceRecording();
            });

            voiceBtn.addEventListener('mouseup', () => {
                this.stopVoiceRecording();
            });

            voiceBtn.addEventListener('mouseleave', () => {
                if (this.isRecording) {
                    this.stopVoiceRecording();
                }
            });

            // 触摸设备支持
            voiceBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startVoiceRecording();
            });

            voiceBtn.addEventListener('touchend', () => {
                this.stopVoiceRecording();
            });

            voiceBtn.addEventListener('touchcancel', () => {
                if (this.isRecording) {
                    this.stopVoiceRecording();
                }
            });
        }
    },

    /**
     * 切换聊天面板
     */
    toggleChatPanel() {
        const chatPanel = document.getElementById('game-chat-panel');
        if (this.chatOpen) {
            this.closeChatPanel();
        } else {
            chatPanel.classList.add('open');
            this.chatOpen = true;
            this.clearUnreadBadge();
        }
    },

    /**
     * 关闭聊天面板
     */
    closeChatPanel() {
        const chatPanel = document.getElementById('game-chat-panel');
        chatPanel.classList.remove('open');
        this.chatOpen = false;
    },

    /**
     * 清除未读消息标记
     */
    clearUnreadBadge() {
        this.unreadCount = 0;
        const badge = document.getElementById('chat-unread-badge');
        if (badge) {
            badge.classList.add('hidden');
            badge.textContent = '0';
        }
    },

    /**
     * 更新未读消息标记
     */
    updateUnreadBadge() {
        if (this.chatOpen) return;

        this.unreadCount++;
        const badge = document.getElementById('chat-unread-badge');
        if (badge) {
            badge.classList.remove('hidden');
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
        }
    },

    /**
     * 发送文字消息
     */
    sendTextMessage() {
        const chatInput = document.getElementById('game-chat-input');
        if (!chatInput) return;

        const message = chatInput.value.trim();
        if (!message) return;

        socketHandler.emit('gameChat', {
            message: message,
            type: 'text'
        });

        chatInput.value = '';
    },

    /**
     * 发送快捷消息
     */
    sendQuickMessage(message) {
        socketHandler.emit('gameChat', {
            message: message,
            type: 'quick'
        });
    },

    /**
     * 添加游戏聊天消息
     */
    addGameChatMessage(data) {
        const container = document.getElementById('game-chat-messages');
        if (!container) return;

        const messageDiv = document.createElement('div');
        const isMe = data.playerId === Auth.getUser().id;
        messageDiv.className = `game-chat-message ${isMe ? 'mine' : ''} ${data.type === 'quick' ? 'quick' : ''}`;

        if (data.type === 'voice') {
            messageDiv.innerHTML = `
                <span class="chat-sender">${this.escapeHtml(data.username)}</span>
                <span class="chat-voice" onclick="Game.playVoiceFromUrl('${data.audioUrl}')">
                    🔊 语音消息 (${data.duration || '?'}s)
                </span>
            `;
        } else {
            messageDiv.innerHTML = `
                <span class="chat-sender">${this.escapeHtml(data.username)}</span>
                <span class="chat-content">${this.escapeHtml(data.message)}</span>
            `;
        }

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        // 更新未读消息
        if (!isMe) {
            this.updateUnreadBadge();
        }
    },

    /**
     * 开始语音录制
     */
    async startVoiceRecording() {
        if (this.isRecording) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processVoiceRecording();
                // 停止所有音轨
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.recordingStartTime = Date.now();

            // 更新按钮状态
            const voiceBtn = document.getElementById('game-chat-voice-btn');
            if (voiceBtn) {
                voiceBtn.classList.add('recording');
                voiceBtn.textContent = '🔴';
            }

            Utils.showToast('正在录音...松开发送', 'info');
        } catch (error) {
            console.error('无法启动录音:', error);
            Utils.showToast('无法访问麦克风', 'error');
        }
    },

    /**
     * 停止语音录制
     */
    stopVoiceRecording() {
        if (!this.isRecording || !this.mediaRecorder) return;

        this.mediaRecorder.stop();
        this.isRecording = false;

        // 恢复按钮状态
        const voiceBtn = document.getElementById('game-chat-voice-btn');
        if (voiceBtn) {
            voiceBtn.classList.remove('recording');
            voiceBtn.textContent = '🎤';
        }
    },

    /**
     * 处理语音录制
     */
    processVoiceRecording() {
        if (this.audioChunks.length === 0) return;

        const duration = Math.round((Date.now() - this.recordingStartTime) / 1000);

        // 如果录音太短，忽略
        if (duration < 1) {
            Utils.showToast('录音太短', 'warning');
            return;
        }

        // 如果录音太长，也忽略
        if (duration > 60) {
            Utils.showToast('录音超过60秒限制', 'warning');
            return;
        }

        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

        // 将音频转换为base64发送
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Audio = reader.result;
            socketHandler.emit('gameChat', {
                type: 'voice',
                audio: base64Audio,
                duration: duration
            });
        };
        reader.readAsDataURL(audioBlob);
    },

    /**
     * 播放语音消息
     */
    playVoiceMessage(data) {
        if (data.audio) {
            this.playVoiceFromUrl(data.audio);
        }
        this.addGameChatMessage(data);
    },

    /**
     * 从URL播放语音
     */
    playVoiceFromUrl(audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().catch(err => {
            console.error('播放语音失败:', err);
            Utils.showToast('播放语音失败', 'error');
        });
    },

    /**
     * 转义HTML
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * 渲染游戏
     */
    renderGame() {
        if (!this.gameState) return;

        const state = this.gameState;
        const myIndex = state.myIndex;

        // 渲染中央信息
        this.renderCenterInfo();

        // 渲染自己的手牌
        this.renderMyHand();

        // 渲染其他玩家
        this.renderOtherPlayers();

        // 渲染中央弃牌区（所有玩家的弃牌按顺序）
        this.renderCenterDiscards();

        // 更新回合指示和计时器
        this.updateTurnIndicator();

        // 启动计时器（显示在当前玩家区域）
        if (state.currentPlayer === myIndex) {
            this.startTimer();
        } else {
            this.clearTimer();
            this.clearAllTimerDisplays();
        }
    },

    /**
     * 清除所有玩家的计时器显示
     */
    clearAllTimerDisplays() {
        // 清除其他玩家的计时器
        ['top', 'left', 'right'].forEach(pos => {
            const container = document.getElementById(`player-${pos}`);
            if (container) {
                const timerEl = container.querySelector('.player-timer');
                if (timerEl) {
                    timerEl.textContent = '';
                    timerEl.className = 'player-timer';
                }
            }
        });
        // 清除自己的计时器
        const myTimer = document.getElementById('my-timer');
        if (myTimer) {
            myTimer.textContent = '';
            myTimer.className = 'player-timer';
        }
    },

    /**
     * 渲染中央信息
     */
    renderCenterInfo() {
        const state = this.gameState;
        const winds = ['东', '南', '西', '北'];

        document.getElementById('wind-indicator').textContent = 
            `${winds[state.dealerIndex]}${state.round}局`;
        document.getElementById('tiles-remaining').textContent = 
            `剩余: ${state.tileWall.remaining}`;

        // 渲染宝牌指示牌
        const doraContainer = document.getElementById('dora-indicators');
        doraContainer.innerHTML = '';
        state.tileWall.doraIndicators.forEach(tile => {
            const elem = TileRenderer.createTileElement(tile, { small: true });
            doraContainer.appendChild(elem);
        });
    },

    /**
     * 渲染自己的手牌
     */
    renderMyHand() {
        const state = this.gameState;
        const hand = state.myHand;
        const isMyTurn = state.currentPlayer === state.myIndex;

        // 手牌
        const handContainer = document.getElementById('my-hand');
        TileRenderer.renderHand(handContainer, hand.tiles, {
            selectable: isMyTurn,
            onClick: (tile, elem) => this.onTileClick(tile, elem)
        });

        // 摸到的牌
        const drawnContainer = document.getElementById('my-drawn-tile');
        drawnContainer.innerHTML = '';
        if (hand.drawnTile) {
            const elem = TileRenderer.createTileElement(hand.drawnTile, {
                selectable: isMyTurn,
                onClick: (tile, elem) => this.onTileClick(tile, elem)
            });
            drawnContainer.appendChild(elem);
        }

        // 副露
        const meldsContainer = document.getElementById('my-melds');
        TileRenderer.renderMelds(meldsContainer, hand.melds);

        // 花牌
        const flowersContainer = document.getElementById('my-flowers');
        TileRenderer.renderFlowers(flowersContainer, hand.flowers);

        // 玩家信息
        document.getElementById('my-name').textContent = 
            state.players[state.myIndex].username;
        document.getElementById('my-score').textContent = 
            state.scores[state.players[state.myIndex].id];
    },

    /**
     * 渲染其他玩家
     */
    renderOtherPlayers() {
        const state = this.gameState;
        const positions = ['bottom', 'right', 'top', 'left'];

        state.otherHands.forEach(otherHand => {
            // 计算相对位置
            let relativePos = (otherHand.index - state.myIndex + 4) % 4;
            const position = positions[relativePos];

            const container = document.getElementById(`player-${position}`);
            if (!container || position === 'bottom') return;

            // 玩家信息
            const playerInfo = container.querySelector('.player-info');
            if (playerInfo) {
                playerInfo.querySelector('.player-name').textContent = otherHand.username;
                playerInfo.querySelector('.player-score').textContent =
                    state.scores[state.players[otherHand.index].id];
            }

            // 手牌背面
            const handContainer = container.querySelector('.hand-tiles');
            if (handContainer) {
                TileRenderer.renderOpponentHand(handContainer, otherHand.hand.tileCount);
            }

            // 副露（吃碰杠的牌）
            const meldsContainer = container.querySelector('.player-melds');
            if (meldsContainer) {
                TileRenderer.renderMelds(meldsContainer, otherHand.hand.melds);
            }
        });
    },

    /**
     * 渲染中央弃牌区（所有玩家的弃牌按出牌顺序显示）
     */
    renderCenterDiscards() {
        const state = this.gameState;
        const container = document.getElementById('center-discards');
        if (!container) return;

        container.innerHTML = '';

        // 收集所有玩家的弃牌并按顺序合并
        let allDiscards = [];

        // 获取所有玩家的弃牌
        for (let i = 0; i < 4; i++) {
            const playerIndex = (state.myIndex + i) % 4;
            const isMe = playerIndex === state.myIndex;

            let discards = [];
            if (isMe) {
                discards = state.myHand?.discards || [];
            } else {
                const otherHand = state.otherHands.find(h => h.index === playerIndex);
                discards = otherHand?.hand?.discards || [];
            }

            // 添加弃牌到总列表，附带顺序信息
            discards.forEach(tile => {
                allDiscards.push({
                    tile: tile,
                    order: tile.discardOrder || tile.id // 使用出牌顺序或id
                });
            });
        }

        // 按出牌顺序排序
        allDiscards.sort((a, b) => a.order - b.order);

        // 渲染所有弃牌
        allDiscards.forEach(item => {
            const isLast = state.lastDiscardedTile &&
                           item.tile.id === state.lastDiscardedTile.id;
            const elem = TileRenderer.createTileElement(item.tile, {
                small: true,
                className: isLast ? 'last-discard' : ''
            });
            container.appendChild(elem);
        });
    },

    /**
     * 更新回合指示器（高亮当前玩家区域）
     */
    updateTurnIndicator() {
        const state = this.gameState;
        const positions = ['bottom', 'right', 'top', 'left'];
        let relativePos = (state.currentPlayer - state.myIndex + 4) % 4;
        const currentPosition = positions[relativePos];

        // 移除所有玩家区域的当前回合标记
        document.querySelectorAll('.player-area').forEach(area => {
            area.classList.remove('current-turn');
        });
        document.querySelector('.my-hand-area')?.classList.remove('current-turn');

        // 添加当前回合玩家的标记
        if (currentPosition === 'bottom') {
            document.querySelector('.my-hand-area')?.classList.add('current-turn');
        } else {
            const container = document.getElementById(`player-${currentPosition}`);
            if (container) {
                container.classList.add('current-turn');
            }
        }
    },

    /**
     * 获取当前回合玩家的计时器元素
     */
    getCurrentPlayerTimerElement() {
        const state = this.gameState;
        if (!state) return null;

        const positions = ['bottom', 'right', 'top', 'left'];
        let relativePos = (state.currentPlayer - state.myIndex + 4) % 4;
        const currentPosition = positions[relativePos];

        if (currentPosition === 'bottom') {
            return document.getElementById('my-timer');
        } else {
            const container = document.getElementById(`player-${currentPosition}`);
            return container?.querySelector('.player-timer');
        }
    },

    /**
     * 点击牌
     */
    onTileClick(tile, elem) {
        if (!this.gameState || this.gameState.currentPlayer !== this.gameState.myIndex) {
            return;
        }

        // 取消之前的选中
        document.querySelectorAll('.tile.selected').forEach(t => t.classList.remove('selected'));

        if (this.selectedTile && this.selectedTile.id === tile.id) {
            // 双击打出
            this.discardTile(tile);
            this.selectedTile = null;
        } else {
            // 选中
            this.selectedTile = tile;
            elem.classList.add('selected');
        }
    },

    /**
     * 打出牌
     */
    discardTile(tile) {
        socketHandler.emit('discardTile', { tile });
        this.hideActionButtons();
    },

    /**
     * 显示动作按钮
     */
    showActionButtons(data) {
        const container = document.getElementById('action-buttons');
        container.classList.remove('hidden');

        // 隐藏所有按钮
        container.querySelectorAll('.action-btn').forEach(btn => {
            btn.classList.add('hidden');
        });

        // 显示可用的按钮
        data.actions.forEach(action => {
            const btn = document.getElementById(`btn-${action}`);
            if (btn) {
                btn.classList.remove('hidden');
            }
        });

        // 总是显示过牌按钮
        document.getElementById('btn-pass').classList.remove('hidden');

        // 设置按钮事件
        document.getElementById('btn-chow').onclick = () => this.handleChow(data.chowOptions);
        document.getElementById('btn-pong').onclick = () => this.handlePong();
        document.getElementById('btn-kong').onclick = () => this.handleKong();
        document.getElementById('btn-mahjong').onclick = () => this.handleMahjong();
        document.getElementById('btn-pass').onclick = () => this.handlePass();

        // 启动动作计时器
        this.startActionTimer();
    },

    /**
     * 显示胡牌按钮
     */
    showMahjongButton() {
        const container = document.getElementById('action-buttons');
        container.classList.remove('hidden');

        document.getElementById('btn-mahjong').classList.remove('hidden');
        document.getElementById('btn-pass').classList.remove('hidden');

        document.getElementById('btn-mahjong').onclick = () => this.handleMahjong();
        document.getElementById('btn-pass').onclick = () => this.handlePass();
    },

    /**
     * 显示杠按钮
     */
    showKongButton(data) {
        const container = document.getElementById('action-buttons');
        container.classList.remove('hidden');

        document.getElementById('btn-kong').classList.remove('hidden');
        document.getElementById('btn-pass').classList.remove('hidden');

        document.getElementById('btn-kong').onclick = () => {
            socketHandler.emit('kong', { type: data.type, tile: data.tile || data.tiles[0] });
            this.hideActionButtons();
        };
    },

    /**
     * 隐藏动作按钮
     */
    hideActionButtons() {
        document.getElementById('action-buttons').classList.add('hidden');
        this.pendingActions = null;
    },

    /**
     * 处理吃
     */
    handleChow(options) {
        if (!options || options.length === 0) return;

        if (options.length === 1) {
            // 只有一种选择，直接吃
            socketHandler.emit('chow', { tiles: options[0] });
        } else {
            // 显示选择界面
            this.showChowOptions(options);
        }
        this.hideActionButtons();
    },

    /**
     * 显示吃牌选项
     */
    showChowOptions(options) {
        const container = document.getElementById('chow-options');
        const tile = this.gameState.lastDiscardedTile;
        
        container.innerHTML = '';
        options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'chow-option';

            option.forEach(value => {
                const t = { type: tile.type, value };
                const elem = TileRenderer.createTileElement(t);
                optionDiv.appendChild(elem);
            });

            optionDiv.addEventListener('click', () => {
                const tiles = option.map(v => ({ type: tile.type, value: v }));
                socketHandler.emit('chow', { tiles });
                Utils.hideModal('chow-modal');
            });

            container.appendChild(optionDiv);
        });

        document.getElementById('cancel-chow').onclick = () => {
            Utils.hideModal('chow-modal');
            socketHandler.emit('pass');
        };

        Utils.showModal('chow-modal');
    },

    /**
     * 处理碰
     */
    handlePong() {
        socketHandler.emit('pong');
        this.hideActionButtons();
    },

    /**
     * 处理杠
     */
    handleKong() {
        socketHandler.emit('kong', { type: 'exposed' });
        this.hideActionButtons();
    },

    /**
     * 处理胡牌
     */
    handleMahjong() {
        socketHandler.emit('hu');
        this.hideActionButtons();
    },

    /**
     * 处理过牌
     */
    handlePass() {
        socketHandler.emit('pass');
        this.hideActionButtons();
    },

    /**
     * 启动计时器（显示在当前玩家区域）
     */
    startTimer() {
        this.clearTimer();
        this.clearAllTimerDisplays();

        if (!this.gameState) return;

        let timeLeft = this.gameState.options?.timeLimit || 30;
        const timerEl = this.getCurrentPlayerTimerElement();

        if (!timerEl) return;

        timerEl.textContent = timeLeft;
        timerEl.className = 'player-timer active';

        this.timerInterval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = timeLeft;

            if (timeLeft <= 10) {
                timerEl.classList.add('warning');
            }
            if (timeLeft <= 5) {
                timerEl.classList.remove('warning');
                timerEl.classList.add('danger');
            }

            if (timeLeft <= 0) {
                this.clearTimer();
                this.autoDiscard();
            }
        }, 1000);
    },

    /**
     * 自动出牌（倒计时结束时）
     */
    autoDiscard() {
        if (!this.gameState) return;

        const hand = this.gameState.myHand;
        if (!hand) return;

        // 优先打出刚摸到的牌
        if (hand.drawnTile) {
            this.discardTile(hand.drawnTile);
            return;
        }

        // 如果没有摸到的牌，打出手牌最后一张
        if (hand.tiles && hand.tiles.length > 0) {
            const lastTile = hand.tiles[hand.tiles.length - 1];
            this.discardTile(lastTile);
            return;
        }

        // 如果有待处理的动作，自动过牌
        if (this.pendingActions) {
            this.handlePass();
        }
    },

    /**
     * 启动动作计时器（用于响应其他玩家的出牌，显示在自己区域）
     */
    startActionTimer() {
        this.clearTimer();
        this.clearAllTimerDisplays();

        let timeLeft = 10;
        const timerEl = document.getElementById('my-timer');

        if (!timerEl) return;

        timerEl.textContent = timeLeft;
        timerEl.className = 'player-timer active warning';

        this.timerInterval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = timeLeft;

            if (timeLeft <= 3) {
                timerEl.classList.remove('warning');
                timerEl.classList.add('danger');
            }

            if (timeLeft <= 0) {
                this.clearTimer();
                this.handlePass();
            }
        }, 1000);
    },

    /**
     * 清除计时器
     */
    clearTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    /**
     * 显示游戏结果
     */
    showGameResult(data) {
        this.clearTimer();
        
        const content = document.getElementById('result-content');
        const title = document.getElementById('result-title');

        title.textContent = data.isSelfDraw ? '自摸!' : '胡牌!';

        let html = `
            <div class="result-winner">
                <span class="winner-name">${data.winner.username}</span> 获胜!
            </div>
        `;

        // 显示番种
        if (data.result.yaku && data.result.yaku.length > 0) {
            html += `
                <div class="result-yaku">
                    <h4>番种</h4>
                    <div class="yaku-list">
                        ${data.result.yaku.map(y => `
                            <div class="yaku-item">
                                <span class="yaku-name">${y.name}</span>
                                <span class="yaku-value">${y.fan || y.han}番</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // 显示分数
        html += `
            <div class="result-scores">
                <h4>分数</h4>
                <div class="score-list">
                    ${data.hands.map(h => {
                        const score = data.scores[this.gameState.players[h.index].id];
                        const isWinner = h.index === data.winner.index;
                        return `
                            <div class="score-item ${isWinner ? 'winner' : ''}">
                                <span>${h.username}</span>
                                <span class="score-change ${score >= 0 ? 'positive' : 'negative'}">
                                    ${score >= 0 ? '+' : ''}${score}
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        content.innerHTML = html;

        // 按钮事件
        document.getElementById('result-replay').onclick = () => {
            Utils.hideModal('game-result-modal');
            Replay.load(this.gameState.gameId);
        };

        document.getElementById('result-continue').onclick = () => {
            Utils.hideModal('game-result-modal');
            this.returnToRoom();
        };

        Utils.showModal('game-result-modal');
    },

    /**
     * 显示流局结果
     */
    showDrawResult(data) {
        this.clearTimer();

        const content = document.getElementById('result-content');
        const title = document.getElementById('result-title');

        title.textContent = '流局';

        let html = '<div class="result-winner">牌墙摸完，本局流局</div>';

        if (data.tenpaiPlayers && data.tenpaiPlayers.length > 0) {
            html += `
                <div class="result-tenpai">
                    <h4>听牌玩家</h4>
                    ${data.tenpaiPlayers.map(p => `
                        <div>${this.gameState.players[p.index].username}</div>
                    `).join('')}
                </div>
            `;
        }

        content.innerHTML = html;

        document.getElementById('result-replay').style.display = 'none';
        document.getElementById('result-continue').onclick = () => {
            Utils.hideModal('game-result-modal');
            this.returnToRoom();
        };

        Utils.showModal('game-result-modal');
    },

    /**
     * 返回房间
     */
    returnToRoom() {
        this.cleanup();
        Utils.switchScreen('room-screen');
    },

    /**
     * 清理
     */
    cleanup() {
        this.clearTimer();
        this.gameState = null;
        this.selectedTile = null;
        this.pendingActions = null;

        // 清理聊天状态
        this.chatOpen = false;
        this.unreadCount = 0;
        this.isRecording = false;
        this.audioChunks = [];
        if (this.mediaRecorder) {
            if (this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
            }
            this.mediaRecorder = null;
        }

        // 关闭聊天面板
        const chatPanel = document.getElementById('game-chat-panel');
        if (chatPanel) {
            chatPanel.classList.remove('open');
        }

        // 清空聊天记录
        const chatMessages = document.getElementById('game-chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }

        socketHandler.off('gameState');
        socketHandler.off('actionRequired');
        socketHandler.off('canMahjong');
        socketHandler.off('canKong');
        socketHandler.off('gameEnd');
        socketHandler.off('gameDraw');
        socketHandler.off('gameChat');
        socketHandler.off('voiceMessage');
    }
};

window.Game = Game;
