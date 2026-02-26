# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start development server (with auto-reload)
npm run dev

# Start production server
npm start

# Run all tests
npm test

# Run a single test file
npx jest server/game/WinningChecker.test.js

# Run tests matching a pattern
npx jest --testNamePattern="七对子"
```

Server runs at `http://localhost:3000`. The client is served as static files from `client/`.

## Architecture

### Server (Node.js + Express + Socket.IO)

`server/index.js` is the entry point. It initializes the server and all managers **after** the database is ready (async init via `dbManager.ready` promise). Manager creation order matters: `GameManager` → `RoomManager` → `LobbyManager`.

**Game logic layer** (`server/game/`):
- `MahjongGame.js` — Core game state machine. States: `WAITING → PLAYING → WAITING_ACTION → FINISHED`. Holds tile wall, player hands, action timers, and game log (for replay).
- `GameManager.js` — Manages active games (`Map<gameId, MahjongGame>`). Routes socket actions to the correct game instance. Handles discard, pong, kong, chow, hu, pass.
- `WinningChecker.js` — Validates win conditions (standard 4-meld + pair, seven pairs, kokushi), calculates yaku/han/score. Supports `chinese` and `japanese` rule sets.
- `Hand.js` / `Tile.js` / `TileWall.js` — Pure data structures.
- `RuleSets.js` — Rule configuration per game mode.

**Lobby layer** (`server/lobby/`):
- `LobbyManager.js` — Tracks online players (idle/inRoom/playing), broadcasts lobby updates.
- `RoomManager.js` — Room lifecycle (create/join/leave/ready/start), relays chat, triggers game creation when all 4 players are ready.

**Other**:
- `server/database/Database.js` — sql.js (SQLite in-memory with file persistence to `data/mahjong.db`). Exposes async methods for users, stats, game records, replays.
- `server/auth/AuthHandler.js` — Auth utilities.
- `server/replay/ReplayManager.js` — Saves/loads game replay logs.

**Auth note**: The HTTP API uses a weak base64 token (`userId:timestamp`), not JWT despite the dependency being present. Socket auth decodes this same token.

### Client (Vanilla JS SPA)

All JS files are loaded via `<script>` tags in `client/index.html`. No bundler is used for client code (the `client/package.json` with webpack/React is a legacy artifact — not used).

Global object pattern — each module exposes a global:
| File | Global | Role |
|------|--------|------|
| `utils.js` | `Utils`, `OrientationManager` | Screen switching, toast, localStorage, orientation lock |
| `socket-handler.js` | `socketHandler` | Wraps Socket.IO, event pub/sub |
| `auth.js` | `Auth` | Login/register/guest flow |
| `lobby.js` | `Lobby` | Lobby UI and room list |
| `room.js` | `Room` | Room waiting screen, chat |
| `game.js` | `Game` | Game UI, action handling |
| `tile-renderer.js` | `TileRenderer` | Renders tile elements |
| `replay.js` | `Replay` | Replay playback |
| `app.js` | — | Entry point, calls `socketHandler.connect()` then `Auth.init()` |

Screen flow: `loading-screen → auth-screen → lobby-screen → room-screen → game-screen`

`Utils.switchScreen(id)` controls the active screen by toggling `.active` CSS class. It also triggers `OrientationManager.enterGameScreen()` / `exitGameScreen()` on game screen transitions.

**Mobile layout**: `game-screen` enforces landscape orientation via `screen.orientation.lock('landscape')` with an overlay fallback. Game CSS uses `@media (orientation: landscape) and (max-height: 500px)` for mobile-specific rules, not width-based queries.

### Tests

Jest tests live alongside server source files:
- `server/game/WinningChecker.test.js`
- `server/game/Hand.test.js`
- `server/game/MahjongGame.test.js`
- `server/game/GameIntegration.test.js`
- `server/lobby/RoomManager.test.js`

Client code has no test infrastructure.

## Key Constraints

- **Database**: sql.js keeps the entire SQLite DB in memory and writes to `data/mahjong.db` on save. All DB operations must `await dbManager.ready` before use. The `data/` directory must exist.
- **Socket events**: All game actions route through `server/index.js` socket handlers → `GameManager` methods. Game state is authoritative on the server; client only renders.
- **Rule sets**: `chinese` and `japanese` are the two supported modes. Japanese mode starts players at 25000 points; Chinese at 0.
