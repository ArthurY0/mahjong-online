/**
 * Game Helper — shared utilities for E2E socket-based tests
 *
 * Provides:
 *  - connectPlayer()      : create an authenticated guest socket
 *  - createAndStartGame() : spin up a 4-player room and start a game
 *  - waitForEvent()       : promise-based single-event listener with timeout
 *  - waitForGameState()   : wait until a specific game state condition is true
 *  - disconnectAll()      : clean up all open sockets
 *  - TileHelpers          : factories for common tile objects
 */

const { io: ioClient } = require('socket.io-client');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the server URL for the current test run.
 * Falls back to localhost:3000 if the env variable is absent (manual runs).
 */
function getServerUrl() {
    const port = process.env.TEST_SERVER_PORT || '3000';
    return `http://127.0.0.1:${port}`;
}

/**
 * Wait for a single named event on a socket, resolving with its payload.
 * Rejects if the event does not arrive within `timeoutMs`.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {string} event
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
function waitForEvent(socket, event, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`Timed out waiting for event "${event}" after ${timeoutMs}ms`));
        }, timeoutMs);

        function handler(data) {
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(data);
        }

        socket.once(event, handler);
    });
}

/**
 * Connect a single guest player to the test server.
 * Returns the connected socket with `.userId` and `.username` set.
 *
 * @param {string} nickname
 * @returns {Promise<import('socket.io-client').Socket>}
 */
async function connectPlayer(nickname) {
    const socket = ioClient(getServerUrl(), {
        transports: ['websocket'],
        forceNew: true
    });

    await waitForEvent(socket, 'connect');

    socket.emit('guestLogin', { nickname });
    const authResult = await waitForEvent(socket, 'authenticated');

    if (!authResult.success) {
        throw new Error(`Authentication failed for ${nickname}: ${authResult.error}`);
    }

    // Attach metadata for convenience in tests
    socket._testNickname = nickname;
    socket._testUserId = authResult.user.id;

    return socket;
}

/**
 * Connect 4 players, have the first create a room, the others join it,
 * all non-host players ready up, then the host starts the game.
 *
 * Returns { sockets, gameStates } where:
 *   - sockets[0] is the host/room-creator
 *   - gameStates[i] is the initial gameState received by sockets[i]
 *
 * @param {object} [roomOptions] - options forwarded to createRoom
 * @returns {Promise<{ sockets: import('socket.io-client').Socket[], gameStates: object[] }>}
 */
async function createAndStartGame(roomOptions = {}) {
    const defaultOptions = {
        ruleSet: 'chinese',
        includeFlowers: false,  // deterministic tile counts
        timeLimit: 30,
        ...roomOptions
    };

    // 1. Connect all four players
    const sockets = await Promise.all([
        connectPlayer('Host_Player'),
        connectPlayer('Player_2'),
        connectPlayer('Player_3'),
        connectPlayer('Player_4')
    ]);

    const [host, ...guests] = sockets;

    // 2. Host creates the room
    host.emit('createRoom', { name: 'E2E Test Room', ...defaultOptions });
    const roomCreated = await waitForEvent(host, 'roomCreated');
    const roomId = roomCreated.roomId;

    // 3. Guests join the room sequentially (the server is single-threaded so
    //    parallel joins can race on seat assignment)
    for (const guest of guests) {
        guest.emit('joinRoom', { roomId });
        await waitForEvent(guest, 'roomJoined');
    }

    // 4. Non-host players ready up
    const readyPromises = guests.map((g) => {
        g.emit('playerReady', { ready: true });
        // The server broadcasts 'playerReady' to the room; we don't strictly
        // need to await it, but waiting ensures the server processed it before
        // we ask the host to start.
        return waitForEvent(g, 'playerReady').catch(() => null);
    });
    await Promise.all(readyPromises);

    // Small synchronisation gap: give the server time to process all ready events
    await new Promise((r) => setTimeout(r, 200));

    // 5. Set up listeners for 'gameState' on all sockets BEFORE the host triggers
    //    startGame, so we don't miss the event.
    const gameStatePromises = sockets.map((s) => waitForEvent(s, 'gameState'));

    // 6. Host starts the game
    host.emit('startGame');

    // 7. Collect the initial game states for all players
    const gameStates = await Promise.all(gameStatePromises);

    return { sockets, gameStates, roomId };
}

/**
 * Wait until a socket emits a 'gameState' that satisfies the predicate.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {(state: object) => boolean} predicate
 * @param {number} [timeoutMs]
 * @returns {Promise<object>}
 */
function waitForGameState(socket, predicate, timeoutMs = DEFAULT_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.off('gameState', handler);
            reject(new Error(`waitForGameState timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        function handler(state) {
            if (predicate(state)) {
                clearTimeout(timer);
                socket.off('gameState', handler);
                resolve(state);
            }
            // Otherwise keep listening for the next gameState
        }

        socket.on('gameState', handler);
    });
}

/**
 * Close all sockets in the given array.
 *
 * @param {import('socket.io-client').Socket[]} sockets
 */
function disconnectAll(sockets) {
    sockets.forEach((s) => {
        try { s.disconnect(); } catch (_) {}
    });
}

// ---------------------------------------------------------------------------
// Tile factories
// ---------------------------------------------------------------------------

/**
 * Create a plain tile object that matches the server's Tile.toJSON() shape.
 * id is omitted intentionally — the server will use type+value for matching
 * in Hand.discard() (which first tries by ID, then falls back to value-match
 * via Hand.removeTile → Tile.equals).
 *
 * Note: when discarding from a *real* game we must pass the tile's actual id.
 * Use `findTileInHand()` to locate the real tile object from a gameState.
 */
const TileHelpers = {
    wan: (value) => ({ type: 'wan', value }),
    tong: (value) => ({ type: 'tong', value }),
    tiao: (value) => ({ type: 'tiao', value }),
    wind: (value) => ({ type: 'feng', value }),   // value: 'east'|'south'|'west'|'north'
    dragon: (value) => ({ type: 'jian', value })  // value: 'zhong'|'fa'|'bai'
};

/**
 * Find the first tile in a player's hand (tiles + drawnTile) that matches
 * the given type and value. Returns the full tile JSON (including id).
 *
 * @param {object} myHand  - gameState.myHand
 * @param {string} type
 * @param {string|number} value
 * @returns {object|null}
 */
function findTileInHand(myHand, type, value) {
    const allTiles = [
        ...(myHand.tiles || []),
        ...(myHand.drawnTile ? [myHand.drawnTile] : [])
    ];
    return allTiles.find((t) => t.type === type && t.value === value) || null;
}

/**
 * Find ANY tile in the player's hand (preferring the drawnTile).
 * Useful when the test just needs to discard something without caring which.
 *
 * @param {object} myHand - gameState.myHand
 * @returns {object|null}
 */
function findAnyTileInHand(myHand) {
    if (myHand.drawnTile) return myHand.drawnTile;
    return (myHand.tiles && myHand.tiles[0]) || null;
}

/**
 * Force a specific game state onto the server-side MahjongGame instance by
 * directly manipulating the hand.  This is only possible in tests because we
 * operate in the same Node.js process via the global setup bridge.
 *
 * This helper is intentionally left as a no-op stub — tests that need
 * deterministic hands should use a fixed random seed or stub the TileWall.
 * The game-actions spec instead drives the game to the right state through
 * real socket events, which is more realistic.
 */
async function injectHandState(_gameId, _playerIndex, _tiles) {
    // Stub: deterministic hand injection is not implemented.
    // Tests work around this by playing through to the needed state.
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    getServerUrl,
    connectPlayer,
    createAndStartGame,
    waitForEvent,
    waitForGameState,
    disconnectAll,
    findTileInHand,
    findAnyTileInHand,
    injectHandState,
    TileHelpers,
    DEFAULT_TIMEOUT_MS
};
