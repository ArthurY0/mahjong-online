# CLAUDE.md

This file provides guidance for AI assistants working with the mahjong-online codebase.

## Project Overview

Mahjong Online is a web-based multiplayer mahjong game supporting Chinese (国标) and Japanese (riichi) rules. It features real-time 4-player gameplay via Socket.IO, user accounts with JWT authentication, room/lobby management, rankings, and game replay.

## Tech Stack

- **Backend**: Node.js + Express 4.18 + Socket.IO 4.6
- **Frontend**: Vanilla JavaScript (no framework), HTML5, CSS3
- **Database**: SQLite via sql.js (in-memory with file persistence to `data/mahjong.db`)
- **Auth**: bcryptjs for password hashing, base64 tokens (not full JWT despite jsonwebtoken dep)
- **Testing**: Jest 29.7
- **Deployment**: Docker + Docker Compose

## Quick Reference Commands

```bash
npm start          # Production: node server/index.js (port 3000)
npm run dev        # Development: nodemon with auto-reload
npm test           # Run all Jest tests (116 tests across 5 suites)
```

Note: If `npm test` fails with permission denied, run `chmod +x node_modules/.bin/jest` first.

## Project Structure

```
server/
  index.js              # Entry point: Express + Socket.IO setup, REST routes, socket event handlers
  auth/
    AuthHandler.js      # User registration, login, password hashing
  database/
    Database.js         # sql.js SQLite wrapper (tables: users, user_stats, game_records, replays)
  game/
    MahjongGame.js      # Core game engine: states, turns, dealing, actions
    Tile.js             # Tile class (types: WAN/TONG/TIAO/FENG/JIAN/HUA)
    Hand.js             # Player hand: tiles, melds, flowers, discards
    TileWall.js         # Draw deck: 108 tiles + 8 flowers + dead wall
    WinningChecker.js   # Win detection & scoring (standard, seven pairs, thirteen orphans)
    RuleSets.js         # Chinese/Japanese rule definitions and yaku database
    GameManager.js      # Routes player actions to correct game instance
  lobby/
    LobbyManager.js     # Online player tracking, lobby broadcasts
    RoomManager.js      # Room CRUD, seat assignment, password protection
  replay/
    ReplayManager.js    # Save/load game replays

client/
  index.html            # Single HTML page
  js/
    app.js              # App init, socket connection, screen management
    auth.js             # Login/register/guest UI
    lobby.js            # Room list, rankings, replays UI
    room.js             # Room UI, ready status, chat
    game.js             # Game board rendering, action buttons
    tile-renderer.js    # Tile rendering with Unicode mahjong characters
    socket-handler.js   # Socket.IO client wrapper
    replay.js           # Replay viewer
    utils.js            # Toast notifications, modal management, DOM helpers
  css/
    style.css           # Main styles (dark gaming theme)
    game.css            # Game board styles
    tiles.css           # Tile rendering styles

data/
  mahjong.db            # SQLite database file (auto-created)
```

## Architecture

### Server

The server is a single Node.js process (`server/index.js`) that:
1. Serves static files from `client/` via Express
2. Exposes REST endpoints: `POST /api/login`, `POST /api/register`, `GET /api/rankings`
3. Handles all real-time game logic via Socket.IO events

Manager initialization order: `DatabaseManager` → `GameManager` → `RoomManager` → `LobbyManager`

### Game Flow

1. Players join a room (max 4 seats, positions: EAST/SOUTH/WEST/NORTH)
2. All ready → game starts, TileWall shuffled, 13 tiles dealt per player (dealer gets 14)
3. Turn loop: draw → (optional: kong/win) → discard → other players react (pong/kong/chow/win/pass)
4. Game ends on win or exhausted deck

### Game States

`WAITING` → `PLAYING` → `WAITING_ACTION` (when discard needs response) → `FINISHED`

### Socket.IO Events

Key client→server events: `authenticate`, `guestLogin`, `createRoom`, `joinRoom`, `leaveRoom`, `playerReady`, `startGame`, `discardTile`, `pong`, `kong`, `chow`, `hu`, `pass`, `roomChat`, `gameChat`

Key server→client events: `authenticated`, `lobbyInfo`, `roomList`, `roomCreated`, `gameState`, `actionRequired`, `gameEnd`, `gameDraw`

### Frontend

Single-page app with mutually exclusive screens: Loading → Auth → Lobby → Room → Game → Result. All DOM manipulation is vanilla JS with `querySelector`/`classList`/`addEventListener`.

## Testing

Tests are colocated with source files using `*.test.js` naming:
- `server/game/MahjongGame.test.js` — Game state, dealing, kong logic
- `server/game/Hand.test.js` — Hand management, pong/kong detection
- `server/game/WinningChecker.test.js` — Win detection, pattern matching
- `server/game/GameIntegration.test.js` — Full game flow integration tests
- `server/lobby/RoomManager.test.js` — Room creation, joining, leaving

Run with: `npm test`

The GameIntegration tests may produce a "worker process failed to exit gracefully" warning due to timers — this is a known cosmetic issue, not a test failure.

## Environment Variables

Defined in `.env.example`:
- `DATABASE_URL` — SQLite path (default: `sqlite:./data/mahjong.db`)
- `PORT` — Server port (default: `3000`)
- `JWT_SECRET` — Token signing secret
- `NODE_ENV` — `development` or `production`
- `CLIENT_URL` — Frontend origin for CORS
- `API_URL` — Backend API base URL

## Code Conventions

- **Language**: Code comments and UI text are in Chinese (中文); variable/function names are in English
- **File naming**: PascalCase for classes (`MahjongGame.js`), camelCase for modules (`socket-handler.js`)
- **Test files**: `*.test.js` colocated with source
- **No linter/formatter**: No ESLint or Prettier configuration exists
- **No TypeScript**: Pure JavaScript throughout
- **No build step**: Client JS is served directly (no bundling/transpilation)
- **Database**: Direct SQL queries via sql.js, no ORM. Database exports to file after each write
- **State management**: Server-authoritative; game state lives on server, clients receive state snapshots
- **Error handling**: Console logging with Chinese descriptions, JSON error responses to clients

## Docker Deployment

```bash
docker-compose up -d    # Build and run on port 3000
```

Uses `node:18-alpine`, `npm ci --omit=dev`, persists data via named volume `mahjong-data`.

## Key Domain Concepts

| Term | Chinese | Meaning |
|------|---------|---------|
| Pong | 碰 | Claim discarded tile to form triplet |
| Kong | 杠 | Four identical tiles (concealed or melded) |
| Chow | 吃 | Claim discarded tile to form sequence |
| Hu/Mahjong | 胡 | Declare a winning hand |
| Fan | 番 | Scoring unit (Chinese rules: minimum 8 fan to win) |
| Tile types | 万/筒/条/风/箭/花 | WAN/TONG/TIAO/FENG/JIAN/HUA |
