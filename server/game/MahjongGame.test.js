/**
 * MahjongGame 单元测试
 */

const { MahjongGame, GameState, Position } = require('./MahjongGame');
const { Tile, TileType, FlowerTile } = require('./Tile');
const { Hand, Meld } = require('./Hand');
const TileWall = require('./TileWall');

// Mock players
const createMockPlayers = () => [
    { id: 'player1', username: 'Player1', socket: null },
    { id: 'player2', username: 'Player2', socket: null },
    { id: 'player3', username: 'Player3', socket: null },
    { id: 'player4', username: 'Player4', socket: null }
];

describe('MahjongGame', () => {
    describe('发牌逻辑 - dealTiles', () => {
        test('每个玩家应该有13张手牌', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.start();

            // 庄家摸了第14张，所以有14张
            expect(game.hands[players[0].id].getTileCount()).toBe(14);
            // 其他玩家应该有13张
            expect(game.hands[players[1].id].getTileCount()).toBe(13);
            expect(game.hands[players[2].id].getTileCount()).toBe(13);
            expect(game.hands[players[3].id].getTileCount()).toBe(13);
        });

        test('花牌应该被分离到flowers数组', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: true });
            game.start();

            // 检查每个玩家的手牌中不应该有花牌
            players.forEach(player => {
                const hand = game.hands[player.id];
                const hasFlowerInTiles = hand.tiles.some(t => t.isFlowerTile());
                expect(hasFlowerInTiles).toBe(false);

                // 如果摸到了花牌，应该在flowers数组中
                hand.flowers.forEach(flower => {
                    expect(flower.isFlowerTile()).toBe(true);
                });
            });
        });
    });

    // 初始化所有玩家的hands
    const initializeAllHands = (game, players) => {
        players.forEach(player => {
            if (!game.hands[player.id]) {
                game.hands[player.id] = new Hand();
            }
        });
    };

    describe('暗杠逻辑 - handleKong', () => {
        test('手牌4张相同牌可以暗杠', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = GameState.PLAYING;
            game.currentPlayer = 0;

            // 初始化所有玩家的手牌
            initializeAllHands(game, players);

            // 手动设置手牌
            const hand = new Hand();
            const kongTile = new Tile(TileType.WAN, 1);
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 2));
            game.hands[players[0].id] = hand;

            // 初始化牌墙（用于杠后补牌）
            game.tileWall = new TileWall({ includeFlowers: false });

            const result = game.handleKong(players[0].id, 'concealed', kongTile.toJSON());

            expect(result.success).toBe(true);
            expect(hand.melds.length).toBe(1);
            expect(hand.melds[0].type).toBe('kong');
            expect(hand.melds[0].concealed).toBe(true);
            expect(hand.melds[0].tiles.length).toBe(4);
        });

        test('手牌3张+drawnTile1张可以暗杠（修复后的逻辑）', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = GameState.PLAYING;
            game.currentPlayer = 0;

            // 初始化所有玩家的手牌
            initializeAllHands(game, players);

            // 手动设置手牌：手牌3张 + drawnTile 1张
            const hand = new Hand();
            const kongTile = new Tile(TileType.WAN, 1);
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.setDrawnTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 2));
            game.hands[players[0].id] = hand;

            // 初始化牌墙
            game.tileWall = new TileWall({ includeFlowers: false });

            const result = game.handleKong(players[0].id, 'concealed', kongTile.toJSON());

            expect(result.success).toBe(true);
            expect(hand.melds.length).toBe(1);
            expect(hand.melds[0].tiles.length).toBe(4);
            // 暗杠后会从岭上摸牌，所以drawnTile应该是新牌
            expect(hand.drawnTile).not.toBeNull();
        });

        test('手牌不足4张不能暗杠', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = GameState.PLAYING;
            game.currentPlayer = 0;

            const hand = new Hand();
            const kongTile = new Tile(TileType.WAN, 1);
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            // 只有3张，不能暗杠
            game.hands[players[0].id] = hand;

            game.tileWall = new TileWall({ includeFlowers: false });

            const result = game.handleKong(players[0].id, 'concealed', kongTile.toJSON());

            expect(result.success).toBe(false);
            expect(result.error).toBe('不能暗杠');
        });

        test('不是自己回合不能暗杠', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = GameState.PLAYING;
            game.currentPlayer = 1; // 当前是玩家2的回合

            const hand = new Hand();
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            game.hands[players[0].id] = hand;

            const result = game.handleKong(players[0].id, 'concealed', new Tile(TileType.WAN, 1).toJSON());

            expect(result.success).toBe(false);
            expect(result.error).toBe('不是你的回合');
        });
    });

    describe('加杠逻辑 - handleKong added', () => {
        test('有碰且有第四张牌可以加杠', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = GameState.PLAYING;
            game.currentPlayer = 0;

            // 初始化所有玩家的手牌
            initializeAllHands(game, players);

            const hand = new Hand();
            // 先添加一个碰
            const pongTiles = [
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1)
            ];
            hand.addMeld(new Meld('pong', pongTiles, false, 1));
            // 手牌中有第四张
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 2));
            game.hands[players[0].id] = hand;

            game.tileWall = new TileWall({ includeFlowers: false });

            const result = game.handleKong(players[0].id, 'added', new Tile(TileType.WAN, 1).toJSON());

            expect(result.success).toBe(true);
            expect(hand.melds[0].type).toBe('kong');
            expect(hand.melds[0].tiles.length).toBe(4);
        });
    });

    describe('明杠逻辑 - handleKong exposed', () => {
        test('手牌3张可以明杠别人打出的牌', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = GameState.WAITING_ACTION;
            game.currentPlayer = 0;
            game.lastDiscardPlayer = 0;
            game.lastDiscardedTile = new Tile(TileType.WAN, 1);

            // 初始化所有玩家的手牌
            initializeAllHands(game, players);

            const hand = new Hand();
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 2));
            game.hands[players[1].id] = hand;

            // 设置待处理动作
            game.pendingActions = [{
                playerIndex: 1,
                playerId: players[1].id,
                actions: [{ type: 'kong', priority: 2 }]
            }];

            game.tileWall = new TileWall({ includeFlowers: false });

            const result = game.handleKong(players[1].id, 'exposed');

            expect(result.success).toBe(true);
            expect(hand.melds.length).toBe(1);
            expect(hand.melds[0].type).toBe('kong');
            expect(hand.melds[0].concealed).toBe(false);
        });
    });

    describe('游戏状态', () => {
        test('游戏开始后状态应为PLAYING', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.start();

            expect(game.state).toBe(GameState.PLAYING);
        });

        test('当前玩家应为庄家', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.start();

            expect(game.currentPlayer).toBe(game.dealerIndex);
        });
    });
});
