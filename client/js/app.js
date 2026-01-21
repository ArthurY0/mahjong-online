/**
 * 应用入口
 */

(async function() {
    const loadingText = document.getElementById('loading-text');

    try {
        // 连接服务器
        console.log('开始连接服务器...');
        loadingText.textContent = '连接服务器中...';
        await socketHandler.connect();
        console.log('服务器连接成功');
        
        loadingText.textContent = '初始化游戏...';
        console.log('开始初始化认证模块...');
        
        // 初始化认证模块
        Auth.init();
        console.log('认证模块初始化完成');

        // 切换到认证界面
        console.log('切换到认证界面...');
        Utils.switchScreen('auth-screen');
        console.log('界面切换完成');

        console.log('🀄 麻将在线 - 初始化完成');

    } catch (error) {
        console.error('初始化失败:', error);
        loadingText.textContent = '连接失败，请刷新页面重试';
        loadingText.style.color = '#f44336';
    }
})();
