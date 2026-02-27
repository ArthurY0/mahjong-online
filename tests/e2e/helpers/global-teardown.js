/**
 * Playwright Global Teardown
 *
 * Shuts down the test server that was started by global-setup.js.
 */

module.exports = async function globalTeardown() {
    const serverProcess = global.__TEST_SERVER__;
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
        await new Promise((resolve) => {
            serverProcess.once('exit', resolve);
            // Force-kill after 5 seconds if SIGTERM doesn't work
            setTimeout(() => {
                try { serverProcess.kill('SIGKILL'); } catch (_) {}
                resolve();
            }, 5000);
        });
        console.log('[global-teardown] Test server stopped');
    }
};
