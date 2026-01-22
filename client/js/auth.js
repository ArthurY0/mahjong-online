/**
 * 认证模块
 */

const Auth = {
    currentUser: null,

    /**
     * 初始化认证界面
     */
    init() {
        this.setupTabs();
        this.setupForms();
        this.checkSavedAuth();
    },

    /**
     * 设置Tab切换
     */
    setupTabs() {
        const tabs = document.querySelectorAll('#auth-screen .tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // 切换Tab按钮
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // 切换表单
                document.querySelectorAll('.auth-form').forEach(form => {
                    form.classList.remove('active');
                });
                document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');

                // 清除错误
                document.getElementById('auth-error').textContent = '';
            });
        });
    },

    /**
     * 设置表单提交
     */
    setupForms() {
        // 登录表单
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            await this.login(username, password);
        });

        // 注册表单
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('register-username').value.trim();
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;

            if (password !== confirm) {
                this.showError('两次输入的密码不一致');
                return;
            }

            await this.register(username, password);
        });

        // 游客表单
        document.getElementById('guest-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const nickname = document.getElementById('guest-nickname').value.trim();
            this.guestLogin(nickname);
        });
    },

    /**
     * 检查保存的认证信息
     */
    checkSavedAuth() {
        const token = Utils.storage.get('authToken');
        const user = Utils.storage.get('user');

        if (token && user) {
            // 尝试使用保存的token认证
            this.authenticateWithToken(token, user);
        }
    },

    /**
     * 登录
     */
    async login(username, password) {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.success) {
                this.handleAuthSuccess(result.token, result.user);
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('登录错误:', error);
            this.showError('网络错误，请稍后重试');
        }
    },

    /**
     * 注册
     */
    async register(username, password) {
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await response.json();

            if (result.success) {
                this.handleAuthSuccess(result.token, result.user);
                Utils.showToast('注册成功！', 'success');
            } else {
                this.showError(result.error);
            }
        } catch (error) {
            console.error('注册错误:', error);
            this.showError('网络错误，请稍后重试');
        }
    },

    /**
     * 游客登录
     */
    guestLogin(nickname) {
        socketHandler.emit('guestLogin', { nickname });
        
        socketHandler.once('authenticated', (result) => {
            if (result.success) {
                this.currentUser = result.user;
                this.onAuthSuccess();
            } else {
                this.showError(result.error);
            }
        });
    },

    /**
     * 使用Token认证
     */
    authenticateWithToken(token, savedUser) {
        socketHandler.emit('authenticate', { token });

        socketHandler.once('authenticated', (result) => {
            if (result.success) {
                this.currentUser = result.user;
                this.onAuthSuccess();
            } else {
                // Token无效，清除保存的信息
                Utils.storage.remove('authToken');
                Utils.storage.remove('user');
            }
        });
    },

    /**
     * 处理认证成功
     */
    handleAuthSuccess(token, user) {
        // 保存认证信息
        Utils.storage.set('authToken', token);
        Utils.storage.set('user', user);

        // 发送认证到Socket
        socketHandler.emit('authenticate', { token });

        socketHandler.once('authenticated', (result) => {
            if (result.success) {
                this.currentUser = result.user;
                this.onAuthSuccess();
            } else {
                this.showError('认证失败');
            }
        });
    },

    /**
     * 认证成功后的处理
     */
    onAuthSuccess() {
        // 更新UI
        document.getElementById('user-display').textContent = 
            `${this.currentUser.username}${this.currentUser.isGuest ? ' (游客)' : ''}`;

        // 切换到大厅
        Utils.switchScreen('lobby-screen');
        Lobby.init();

        Utils.showToast(`欢迎, ${this.currentUser.username}!`, 'success');
    },

    /**
     * 显示错误
     */
    showError(message) {
        document.getElementById('auth-error').textContent = message;
    },

    /**
     * 退出登录
     */
    logout() {
        // 清除所有存储的认证信息
        Utils.storage.remove('authToken');
        Utils.storage.remove('user');
        this.currentUser = null;

        // 断开 socket 连接
        if (socketHandler && socketHandler.socket) {
            socketHandler.disconnect();
        }
        
        // 直接切换到认证界面，不刷新页面
        Utils.switchScreen('auth-screen');
        
        // 重新连接服务器
        socketHandler.connect().then(() => {
            console.log('重新连接服务器成功');
        }).catch((error) => {
            console.error('重新连接失败:', error);
            // 如果重新连接失败，刷新页面
            window.location.reload();
        });
    },

    /**
     * 获取当前用户
     */
    getUser() {
        return this.currentUser;
    }
};

window.Auth = Auth;
