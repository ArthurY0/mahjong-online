/**
 * Playwright Global Setup
 *
 * Starts the mahjong server on an ephemeral port before any test runs.
 * Stores the server URL in an environment variable so all workers can
 * discover it without hard-coding a port.
 */

const { spawn } = require('child_process');
const path = require('path');
const net = require('net');

/**
 * Find a free TCP port.
 */
function getFreePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
        srv.on('error', reject);
    });
}

/**
 * Poll until the server responds on the given port, or throw after timeout.
 */
function waitForServer(port, timeoutMs = 20000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const attempt = () => {
            const sock = new net.Socket();
            sock.setTimeout(500);
            sock
                .once('connect', () => { sock.destroy(); resolve(); })
                .once('timeout', () => { sock.destroy(); retry(); })
                .once('error', () => { sock.destroy(); retry(); })
                .connect(port, '127.0.0.1');
        };
        const retry = () => {
            if (Date.now() - start > timeoutMs) {
                reject(new Error(`Server did not start on port ${port} within ${timeoutMs}ms`));
                return;
            }
            setTimeout(attempt, 300);
        };
        attempt();
    });
}

module.exports = async function globalSetup() {
    const port = await getFreePort();
    process.env.TEST_SERVER_PORT = String(port);

    const serverPath = path.resolve(__dirname, '../../../server/index.js');

    const serverProcess = spawn('node', [serverPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: 'pipe'
    });

    // Surface server stderr for debugging
    serverProcess.stderr.on('data', (d) => {
        process.stderr.write('[server] ' + d.toString());
    });

    serverProcess.on('error', (err) => {
        console.error('Failed to start test server:', err);
    });

    // Store the process handle so global teardown can kill it
    global.__TEST_SERVER__ = serverProcess;

    await waitForServer(port);
    console.log(`[global-setup] Test server started on port ${port}`);
};
