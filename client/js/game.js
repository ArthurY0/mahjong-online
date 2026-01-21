/**
 * 游戏模块
 */

const Game = {
    gameState: null,
    selectedTile: null,
    timerInterval: null,
    pendingActions: null,

    /**
     * 初始化游戏
     */
    init(data) {
        this.gameState = null;
        this.selectedTile = null;
        this.pendingActions = null;

        this.setupSocketListeners();
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

        // 更新回合指示
        this.updateTurnIndicator();

        // 启动计时器
        if (state.currentPlayer === myIndex) {
            this.startTimer();
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

            // 副露
            const meldsContainer = container.querySelector('.player-melds');
            if (meldsContainer) {
                TileRenderer.renderMelds(meldsContainer, otherHand.hand.melds);
            }

            // 弃牌
            const discardsContainer = container.querySelector('.player-discards');
            if (discardsContainer) {
                TileRenderer.renderDiscards(
                    discardsContainer, 
                    otherHand.hand.discards,
                    state.lastDiscardedTile
                );
            }
        });
    },

    /**
     * 更新回合指示器
     */
    updateTurnIndicator() {
        const state = this.gameState;
        const indicator = document.getElementById('turn-indicator');
        
        const currentPlayer = state.players[state.currentPlayer];
        indicator.textContent = `${currentPlayer.username}的回合`;
        indicator.className = 'turn-indicator';

        // 根据位置调整
        const positions = ['bottom', 'right', 'top', 'left'];
        let relativePos = (state.currentPlayer - state.myIndex + 4) % 4;
        indicator.classList.add(positions[relativePos]);
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
            socketHandler.emit('declareKong', { type: data.type, tile: data.tile || data.tiles[0] });
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
            socketHandler.emit('declareChow', { tiles: options[0] });
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
                socketHandler.emit('declareChow', { tiles });
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
        socketHandler.emit('declarePong');
        this.hideActionButtons();
    },

    /**
     * 处理杠
     */
    handleKong() {
        socketHandler.emit('declareKong', { type: 'exposed' });
        this.hideActionButtons();
    },

    /**
     * 处理胡牌
     */
    handleMahjong() {
        socketHandler.emit('declareMahjong');
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
     * 启动计时器
     */
    startTimer() {
        this.clearTimer();
        
        let timeLeft = this.gameState.options?.timeLimit || 30;
        const timerEl = document.getElementById('action-timer');
        
        timerEl.textContent = timeLeft;
        timerEl.className = 'action-timer';

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
                // 自动打出最后一张牌或过牌
                if (this.gameState.myHand.drawnTile) {
                    this.discardTile(this.gameState.myHand.drawnTile);
                }
            }
        }, 1000);
    },

    /**
     * 启动动作计时器
     */
    startActionTimer() {
        this.clearTimer();
        
        let timeLeft = 10;
        const timerEl = document.getElementById('action-timer');
        
        timerEl.textContent = timeLeft;
        timerEl.className = 'action-timer warning';

        this.timerInterval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = timeLeft;

            if (timeLeft <= 3) {
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

        socketHandler.off('gameState');
        socketHandler.off('actionRequired');
        socketHandler.off('canMahjong');
        socketHandler.off('canKong');
        socketHandler.off('gameEnd');
        socketHandler.off('gameDraw');
    }
};

window.Game = Game;
