/**
 * 回放模块
 */

const Replay = {
    replayData: null,
    currentStep: 0,
    isPlaying: false,
    playInterval: null,
    speed: 1,

    /**
     * 加载回放
     */
    async load(gameId) {
        try {
            Utils.showToast('加载回放中...', 'info');
            
            const response = await fetch(`/api/replays/${gameId}`);
            const result = await response.json();

            if (!result.success) {
                Utils.showToast(result.error || '加载失败', 'error');
                return;
            }

            this.replayData = result.replay;
            this.currentStep = 0;
            this.isPlaying = false;

            this.setupEventListeners();
            this.render();
            
            Utils.switchScreen('replay-screen');
            document.getElementById('replay-title').textContent = 
                `回放 - ${this.replayData.players.map(p => p.username).join(' vs ')}`;

        } catch (error) {
            console.error('加载回放失败:', error);
            Utils.showToast('加载回放失败', 'error');
        }
    },

    /**
     * 设置事件监听
     */
    setupEventListeners() {
        document.getElementById('exit-replay-btn').onclick = () => this.exit();
        document.getElementById('replay-prev').onclick = () => this.prevStep();
        document.getElementById('replay-play').onclick = () => this.togglePlay();
        document.getElementById('replay-next').onclick = () => this.nextStep();
        
        document.getElementById('replay-speed').onchange = (e) => {
            this.speed = parseFloat(e.target.value);
        };

        document.getElementById('replay-slider').oninput = (e) => {
            this.goToStep(parseInt(e.target.value));
        };
    },

    /**
     * 渲染当前状态
     */
    render() {
        if (!this.replayData) return;

        const log = this.replayData.log;
        const totalSteps = log.length;

        // 更新进度条
        document.getElementById('replay-slider').max = totalSteps - 1;
        document.getElementById('replay-slider').value = this.currentStep;
        document.getElementById('replay-step').textContent = 
            `${this.currentStep + 1} / ${totalSteps}`;

        // 重建游戏状态
        const gameState = this.rebuildState(this.currentStep);
        this.renderGameState(gameState);

        // 更新播放按钮
        document.getElementById('replay-play').textContent = 
            this.isPlaying ? '⏸ 暂停' : '▶ 播放';
    },

    /**
     * 重建指定步骤的游戏状态
     */
    rebuildState(stepIndex) {
        const replay = this.replayData;
        
        // 初始状态
        const state = {
            players: replay.players,
            options: replay.options,
            hands: {},
            discards: {},
            melds: {},
            currentPlayer: 0,
            dealerIndex: 0,
            lastAction: null
        };

        // 初始化每个玩家
        replay.players.forEach((player, index) => {
            state.hands[index] = [];
            state.discards[index] = [];
            state.melds[index] = [];
        });

        // 逐步应用动作
        for (let i = 0; i <= stepIndex && i < replay.log.length; i++) {
            const action = replay.log[i];
            this.applyAction(state, action);
            state.lastAction = action;
        }

        return state;
    },

    /**
     * 应用动作到状态
     */
    applyAction(state, action) {
        switch (action.type) {
            case 'gameStart':
                state.dealerIndex = action.data.dealer;
                state.currentPlayer = action.data.dealer;
                break;

            case 'draw':
                if (action.data.tile) {
                    state.hands[action.data.player].push(action.data.tile);
                }
                state.currentPlayer = action.data.player;
                break;

            case 'discard':
                const hand = state.hands[action.data.player];
                const tileIndex = hand.findIndex(t => 
                    t.type === action.data.tile.type && t.value === action.data.tile.value
                );
                if (tileIndex !== -1) {
                    hand.splice(tileIndex, 1);
                }
                state.discards[action.data.player].push(action.data.tile);
                break;

            case 'pong':
            case 'kong':
            case 'chow':
                state.melds[action.data.player].push({
                    type: action.type,
                    tiles: action.data.tiles
                });
                // 从手牌移除
                action.data.tiles.forEach(tile => {
                    const hand = state.hands[action.data.player];
                    const idx = hand.findIndex(t => 
                        t.type === tile.type && t.value === tile.value
                    );
                    if (idx !== -1) hand.splice(idx, 1);
                });
                state.currentPlayer = action.data.player;
                break;

            case 'mahjong':
                state.winner = action.data.player;
                state.winningTile = action.data.tile;
                state.result = action.data.result;
                break;
        }
    },

    /**
     * 渲染游戏状态
     */
    renderGameState(state) {
        const container = document.getElementById('replay-game-container');
        
        // 简化的回放渲染
        let html = '<div class="replay-state">';

        // 当前动作
        if (state.lastAction) {
            html += `<div class="replay-action">动作: ${this.getActionText(state.lastAction)}</div>`;
        }

        // 显示每个玩家
        state.players.forEach((player, index) => {
            html += `
                <div class="replay-player ${index === state.currentPlayer ? 'current' : ''}">
                    <div class="replay-player-name">${player.username}</div>
                    <div class="replay-player-hand">
                        ${state.hands[index].map(tile => 
                            `<span class="tile-mini">${TileRenderer.getTileUnicode(tile)}</span>`
                        ).join('')}
                    </div>
                    <div class="replay-player-discards">
                        弃牌: ${state.discards[index].map(tile => 
                            TileRenderer.getTileUnicode(tile)
                        ).join(' ')}
                    </div>
                </div>
            `;
        });

        // 胜利者
        if (state.winner !== undefined) {
            html += `
                <div class="replay-winner">
                    🎉 ${state.players[state.winner].username} 胡牌!
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * 获取动作文本
     */
    getActionText(action) {
        const player = this.replayData.players[action.data?.player]?.username || '';
        
        switch (action.type) {
            case 'gameStart': return '游戏开始';
            case 'draw': return `${player} 摸牌`;
            case 'discard': 
                return `${player} 打出 ${TileRenderer.getTileName(action.data.tile)}`;
            case 'pong': return `${player} 碰`;
            case 'kong': return `${player} 杠`;
            case 'chow': return `${player} 吃`;
            case 'mahjong': return `${player} 胡牌!`;
            default: return action.type;
        }
    },

    /**
     * 上一步
     */
    prevStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.render();
        }
    },

    /**
     * 下一步
     */
    nextStep() {
        if (this.currentStep < this.replayData.log.length - 1) {
            this.currentStep++;
            this.render();
        } else {
            this.pause();
        }
    },

    /**
     * 跳转到指定步骤
     */
    goToStep(step) {
        this.currentStep = Math.max(0, Math.min(step, this.replayData.log.length - 1));
        this.render();
    },

    /**
     * 切换播放/暂停
     */
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    },

    /**
     * 播放
     */
    play() {
        if (this.currentStep >= this.replayData.log.length - 1) {
            this.currentStep = 0;
        }

        this.isPlaying = true;
        this.render();

        this.playInterval = setInterval(() => {
            this.nextStep();
            if (this.currentStep >= this.replayData.log.length - 1) {
                this.pause();
            }
        }, 1000 / this.speed);
    },

    /**
     * 暂停
     */
    pause() {
        this.isPlaying = false;
        if (this.playInterval) {
            clearInterval(this.playInterval);
            this.playInterval = null;
        }
        this.render();
    },

    /**
     * 退出回放
     */
    exit() {
        this.pause();
        this.replayData = null;
        this.currentStep = 0;
        Utils.switchScreen('lobby-screen');
    }
};

window.Replay = Replay;
