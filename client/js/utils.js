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
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
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

// 导出
window.Utils = Utils;
