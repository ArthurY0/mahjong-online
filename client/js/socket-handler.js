/**
 * Socket.IO 事件处理
 */

class SocketHandler {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.eventHandlers = {};
    }

    /**
     * 连接服务器
     */
    connect() {
        return new Promise((resolve, reject) => {
            const serverUrl = window.location.origin;
            
            this.socket = io(serverUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000
            });

            this.socket.on('connect', () => {
                console.log('已连接到服务器');
                this.connected = true;
                this.reconnectAttempts = 0;
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('连接错误:', error);
                this.reconnectAttempts++;
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    reject(new Error('无法连接到服务器'));
                }
            });

            this.socket.on('disconnect', (reason) => {
                console.log('与服务器断开连接:', reason);
                this.connected = false;
                Utils.showToast('与服务器断开连接', 'warning');
            });

            this.socket.on('reconnect', () => {
                console.log('重新连接成功');
                Utils.showToast('重新连接成功', 'success');
                // 重新认证
                const token = Utils.storage.get('authToken');
                if (token) {
                    this.emit('authenticate', { token });
                }
            });

            this.socket.on('error', (error) => {
                console.error('Socket错误:', error);
                Utils.showToast(error.message || '发生错误', 'error');
            });

            // 设置超时
            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('连接超时'));
                }
            }, 10000);
        });
    }

    /**
     * 发送事件
     */
    emit(event, data) {
        if (this.socket && this.connected) {
            this.socket.emit(event, data);
        } else {
            console.warn('Socket未连接，无法发送:', event);
        }
    }

    /**
     * 监听事件（支持同一事件多次注册，off 时全部移除）
     */
    on(event, handler) {
        if (this.socket) {
            this.socket.on(event, handler);
            if (!this.eventHandlers[event]) {
                this.eventHandlers[event] = [];
            }
            this.eventHandlers[event].push(handler);
        }
    }

    /**
     * 移除事件监听（移除该事件的所有 handler）
     */
    off(event) {
        if (this.socket && this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(h => this.socket.off(event, h));
            delete this.eventHandlers[event];
        }
    }

    /**
     * 一次性监听
     */
    once(event, handler) {
        if (this.socket) {
            this.socket.once(event, handler);
        }
    }

    /**
     * 断开连接
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }

    /**
     * 获取Socket ID
     */
    getId() {
        return this.socket ? this.socket.id : null;
    }
}

// 创建全局实例
window.socketHandler = new SocketHandler();
