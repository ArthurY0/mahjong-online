/**
 * 工具函数
 */

const Utils = {
    /**
     * 显示Toast消息
     */
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * 格式化时间
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    /**
     * 格式化日期
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    },

    /**
     * 切换屏幕
     */
    switchScreen(screenId) {
        const previousScreen = document.querySelector('.screen.active');
        const previousId = previousScreen ? previousScreen.id : null;

        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');

        // 进入游戏界面时锁定横屏
        if (screenId === 'game-screen') {
            OrientationManager.enterGameScreen();
        } else if (previousId === 'game-screen') {
            OrientationManager.leaveGameScreen();
        }
    },

    /**
     * 切换Tab
     */
    switchTab(tabName, container) {
        // 切换按钮状态
        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // 切换内容显示
        const parent = container.parentElement;
        parent.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    },

    /**
     * 显示模态框
     */
    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    },

    /**
     * 隐藏模态框
     */
    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    /**
     * 本地存储
     */
    storage: {
        get(key) {
            const value = localStorage.getItem(key);
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        },
        set(key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        },
        remove(key) {
            localStorage.removeItem(key);
        }
    },

    /**
     * 播放音效
     */
    playSound(soundName) {
        // 简单的音效播放
        // 可以扩展为完整的音效系统
        const sounds = {
            tile: '/sounds/tile.mp3',
            pong: '/sounds/pong.mp3',
            kong: '/sounds/kong.mp3',
            mahjong: '/sounds/mahjong.mp3'
        };

        if (sounds[soundName]) {
            const audio = new Audio(sounds[soundName]);
            audio.volume = 0.5;
            audio.play().catch(() => {}); // 忽略自动播放限制
        }
    },

    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 深拷贝
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * 生成随机ID
     */
    generateId() {
        return Math.random().toString(36).substring(2, 10);
    }
};

// 全局错误处理
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error:', message, source, lineno, error);
    Utils.showToast('发生错误，请刷新页面', 'error');
};

/**
 * 屏幕方向管理器 - 游戏界面横屏锁定
 */
const OrientationManager = {
    _locked: false,
    _resizeHandler: null,

    async lockLandscape() {
        if (screen.orientation && screen.orientation.lock) {
            try {
                await screen.orientation.lock('landscape');
                this._locked = true;
                return true;
            } catch (e) {
                // 大多数浏览器不允许非全屏模式下锁定方向
                return false;
            }
        }
        return false;
    },

    unlockOrientation() {
        if (this._locked && screen.orientation && screen.orientation.unlock) {
            try {
                screen.orientation.unlock();
            } catch (e) {
                // ignore
            }
            this._locked = false;
        }
        this.stopOrientationWatch();
        this.hideOverlay();
    },

    isMobile() {
        return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
            || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    },

    isPortrait() {
        return window.innerHeight > window.innerWidth;
    },

    showOverlay() {
        const overlay = document.getElementById('landscape-overlay');
        if (overlay) overlay.classList.remove('hidden');
    },

    hideOverlay() {
        const overlay = document.getElementById('landscape-overlay');
        if (overlay) overlay.classList.add('hidden');
    },

    _checkOrientation() {
        if (!this.isMobile()) {
            this.hideOverlay();
            return;
        }
        if (this.isPortrait()) {
            this.showOverlay();
        } else {
            this.hideOverlay();
        }
    },

    startOrientationWatch() {
        this._resizeHandler = () => this._checkOrientation();
        window.addEventListener('resize', this._resizeHandler);
        window.addEventListener('orientationchange', this._resizeHandler);
        // Check immediately
        this._checkOrientation();
    },

    stopOrientationWatch() {
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
            window.removeEventListener('orientationchange', this._resizeHandler);
            this._resizeHandler = null;
        }
    },

    async enterGameScreen() {
        const locked = await this.lockLandscape();
        if (!locked) {
            // API lock failed, use overlay fallback
            this.startOrientationWatch();
        }
    },

    leaveGameScreen() {
        this.unlockOrientation();
    }
};

// 导出
window.Utils = Utils;
window.OrientationManager = OrientationManager;
