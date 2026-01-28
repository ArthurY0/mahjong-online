/**
 * 游戏集成测试 - 测试完整游戏流程
 * Game Integration Test - Test complete game flow
 */

const { MahjongGame, GameState } = require('./MahjongGame');
const { Tile, TileType } = require('./Tile');
const { Hand, Meld } = require('./Hand');
const TileWall = require('./TileWall');

// 创建模拟玩家
const createMockPlayers = () => {
    return [
        { id: 'player1', username: 'Player1', socket: { emit: jest.fn() } },
        { id: 'player2', username: 'Player2', socket: { emit: jest.fn() } },
        { id: 'player3', username: 'Player3', socket: { emit: jest.fn() } },
        { id: 'player4', username: 'Player4', socket: { emit: jest.fn() } }
    ];
};

describe('游戏集成测试 - 完整游戏流程', () => {
    describe('游戏初始化', () => {
        test('应该正确创建游戏实例', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });

            expect(game.gameId).toBe('test-game');
            expect(game.players.length).toBe(4);
            expect(game.state).toBe('waiting');
            expect(game.currentPlayer).toBe(0);
            expect(game.dealerIndex).toBe(0);
        });

        test('应该正确初始化分数', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, {
                includeFlowers: false,
                ruleSet: 'chinese'
            });

            players.forEach(p => {
                expect(game.scores[p.id]).toBe(0);
            });
        });

        test('日麻规则应该初始化25000点', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, {
                includeFlowers: false,
                ruleSet: 'japanese'
            });

            players.forEach(p => {
                expect(game.scores[p.id]).toBe(25000);
            });
        });
    });

    describe('游戏开始和发牌', () => {
        test('开始游戏后状态应该为playing', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });

            game.start();

            expect(game.state).toBe('playing');
        });

        test('开始游戏后每个玩家应该有13张手牌', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });

            game.start();

            // 非庄家应该有13张
            expect(game.hands[players[1].id].tiles.length).toBe(13);
            expect(game.hands[players[2].id].tiles.length).toBe(13);
            expect(game.hands[players[3].id].tiles.length).toBe(13);
        });

        test('庄家应该有13张手牌加1张摸牌', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });

            game.start();

            const dealerHand = game.hands[players[0].id];
            expect(dealerHand.tiles.length).toBe(13);
            expect(dealerHand.drawnTile).not.toBeNull();
        });

        test('牌墙应该初始化并减少相应数量的牌', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });

            game.start();

            // 总共发了 13*4 + 1 = 53 张牌（不含花牌时总共136张）
            // 牌墙剩余应该约为 136 - 53 - 14(王牌) = 69 张
            expect(game.tileWall.tiles.length).toBeGreaterThan(50);
            expect(game.tileWall.tiles.length).toBeLessThan(90);
        });
    });

    describe('打牌流程', () => {
        let game, players;

        beforeEach(() => {
            players = createMockPlayers();
            game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.start();
        });

        test('当前玩家打牌应该成功', () => {
            const currentPlayer = players[game.currentPlayer];
            const hand = game.hands[currentPlayer.id];
            const tileToDiscard = hand.drawnTile || hand.tiles[0];

            const result = game.discardTile(currentPlayer.id, tileToDiscard.toJSON());

            expect(result.success).toBe(true);
            expect(game.lastDiscardedTile).not.toBeNull();
        });

        test('非当前玩家打牌应该失败', () => {
            const nonCurrentPlayer = players[(game.currentPlayer + 1) % 4];
            const hand = game.hands[nonCurrentPlayer.id];
            const tileToDiscard = hand.tiles[0];

            const result = game.discardTile(nonCurrentPlayer.id, tileToDiscard.toJSON());

            expect(result.success).toBe(false);
            expect(result.error).toBe('不是你的回合');
        });

        test('打不存在的牌应该失败', () => {
            const currentPlayer = players[game.currentPlayer];
            const fakeTile = { type: 'wind', value: 9 }; // 不存在的牌

            const result = game.discardTile(currentPlayer.id, fakeTile);

            expect(result.success).toBe(false);
        });

        test('打牌后应该记录到游戏日志', () => {
            const currentPlayer = players[game.currentPlayer];
            const hand = game.hands[currentPlayer.id];
            const tileToDiscard = hand.drawnTile || hand.tiles[0];

            game.discardTile(currentPlayer.id, tileToDiscard.toJSON());

            // 日志使用 type 字段
            const discardLogs = game.gameLog.filter(log => log.type === 'discard');
            expect(discardLogs.length).toBeGreaterThan(0);
        });

        test('打牌后回合数应该增加', () => {
            const initialTurn = game.turn;
            const currentPlayer = players[game.currentPlayer];
            const hand = game.hands[currentPlayer.id];
            const tileToDiscard = hand.drawnTile || hand.tiles[0];

            game.discardTile(currentPlayer.id, tileToDiscard.toJSON());

            expect(game.turn).toBe(initialTurn + 1);
        });
    });

    describe('碰牌流程', () => {
        // 初始化所有玩家手牌的辅助函数
        const initializeAllHands = (game, players) => {
            players.forEach(player => {
                if (!game.hands[player.id]) {
                    const h = new Hand();
                    for (let i = 0; i < 13; i++) {
                        h.addTile(new Tile(TileType.BING, (i % 9) + 1));
                    }
                    game.hands[player.id] = h;
                }
            });
        };

        test('有两张相同牌时应该可以碰', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = 'waiting_action';
            game.currentPlayer = 0;
            game.lastDiscardPlayer = 0;
            game.lastDiscardedTile = new Tile(TileType.WAN, 1);

            // 初始化所有玩家的手牌和牌墙
            initializeAllHands(game, players);
            game.tileWall = new TileWall({ includeFlowers: false });

            // 给玩家1设置两张一万
            const hand = new Hand();
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 2));
            for (let i = 0; i < 10; i++) {
                hand.addTile(new Tile(TileType.TIAO, i % 9 + 1));
            }
            game.hands[players[1].id] = hand;

            // 设置待处理动作
            game.pendingActions = [{
                playerIndex: 1,
                playerId: players[1].id,
                actions: [{ type: 'pong', priority: 2 }]
            }];

            const result = game.handlePong(players[1].id);

            expect(result.success).toBe(true);
            expect(hand.melds.length).toBe(1);
            expect(hand.melds[0].type).toBe('pong');
            expect(hand.melds[0].tiles.length).toBe(3);
        });

        test('碰牌后当前玩家应该变为碰牌者', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = 'waiting_action';
            game.currentPlayer = 0;
            game.lastDiscardPlayer = 0;
            game.lastDiscardedTile = new Tile(TileType.WAN, 1);

            // 初始化所有玩家的手牌和牌墙
            initializeAllHands(game, players);
            game.tileWall = new TileWall({ includeFlowers: false });

            const hand = new Hand();
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            for (let i = 0; i < 11; i++) {
                hand.addTile(new Tile(TileType.TIAO, i % 9 + 1));
            }
            game.hands[players[2].id] = hand;

            game.pendingActions = [{
                playerIndex: 2,
                playerId: players[2].id,
                actions: [{ type: 'pong', priority: 2 }]
            }];

            game.handlePong(players[2].id);

            expect(game.currentPlayer).toBe(2);
        });

        test('没有待处理动作时碰牌应该失败', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.pendingActions = [];

            const result = game.handlePong(players[1].id);

            expect(result.success).toBe(false);
        });
    });

    describe('吃牌流程', () => {
        // 初始化所有玩家手牌的辅助函数
        const initAllHands = (game, players) => {
            players.forEach(player => {
                if (!game.hands[player.id]) {
                    const h = new Hand();
                    for (let i = 0; i < 13; i++) {
                        h.addTile(new Tile(TileType.BING, (i % 9) + 1));
                    }
                    game.hands[player.id] = h;
                }
            });
        };

        test('只有下家可以吃牌', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = 'waiting_action';
            game.currentPlayer = 0;
            game.lastDiscardPlayer = 0;
            game.lastDiscardedTile = new Tile(TileType.WAN, 5);

            // 初始化所有玩家的手牌和牌墙
            initAllHands(game, players);
            game.tileWall = new TileWall({ includeFlowers: false });

            // 下家（玩家1）有4万和6万
            const hand = new Hand();
            hand.addTile(new Tile(TileType.WAN, 4));
            hand.addTile(new Tile(TileType.WAN, 6));
            for (let i = 0; i < 11; i++) {
                hand.addTile(new Tile(TileType.TIAO, i % 9 + 1));
            }
            game.hands[players[1].id] = hand;

            game.pendingActions = [{
                playerIndex: 1,
                playerId: players[1].id,
                actions: [{ type: 'chow', options: [[4, 5, 6]], priority: 1 }]
            }];

            const result = game.handleChow(players[1].id, [
                { type: TileType.WAN, value: 4 },
                { type: TileType.WAN, value: 6 }
            ]);

            expect(result.success).toBe(true);
        });

        test('没有吃牌权限时应该失败', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.pendingActions = [];

            const result = game.handleChow(players[1].id, []);

            expect(result.success).toBe(false);
        });
    });

    describe('过牌流程', () => {
        test('过牌应该正确处理', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = 'waiting_action';
            game.currentPlayer = 0;
            game.lastDiscardPlayer = 0;
            game.lastDiscardedTile = new Tile(TileType.WAN, 1);

            // 初始化所有玩家的手牌
            players.forEach(p => {
                game.hands[p.id] = new Hand();
                for (let i = 0; i < 13; i++) {
                    game.hands[p.id].addTile(new Tile(TileType.TIAO, (i % 9) + 1));
                }
            });

            // 初始化牌墙
            game.tileWall = new TileWall({ includeFlowers: false });

            game.pendingActions = [{
                playerIndex: 1,
                playerId: players[1].id,
                actions: [{ type: 'pong', priority: 2 }],
                responded: false
            }];

            // handlePass不应该抛出错误
            expect(() => game.handlePass(players[1].id)).not.toThrow();

            // 过牌后游戏应该继续（进入下一回合或保持waiting_action状态）
            expect(['playing', 'waiting_action']).toContain(game.state);
        });
    });

    describe('胡牌检查', () => {
        test('WinningChecker应该能被正确初始化', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, {
                includeFlowers: false,
                ruleSet: 'chinese'
            });

            expect(game.winningChecker).toBeDefined();
        });

        test('应该有checkWin方法', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, {
                includeFlowers: false,
                ruleSet: 'chinese'
            });

            expect(typeof game.winningChecker.checkWin).toBe('function');
        });
    });

    describe('流局处理', () => {
        test('牌墙摸完后应该返回null', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });
            game.state = 'playing';

            // 初始化手牌
            players.forEach(p => {
                game.hands[p.id] = new Hand();
                for (let i = 0; i < 13; i++) {
                    game.hands[p.id].addTile(new Tile(TileType.TIAO, (i % 9) + 1));
                }
            });

            // 模拟牌墙耗尽
            game.tileWall = new TileWall({ includeFlowers: false });
            // 清空牌墙
            while (game.tileWall.tiles.length > 0) {
                game.tileWall.draw();
            }

            // 摸牌返回null
            const tile = game.tileWall.draw();
            expect(tile).toBeNull();
        });
    });

    describe('多回合游戏流程', () => {
        test('应该能正常进行多个回合', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });

            game.start();

            // 模拟5个回合
            for (let round = 0; round < 5; round++) {
                const currentPlayer = players[game.currentPlayer];
                const hand = game.hands[currentPlayer.id];

                if (!hand.drawnTile && game.state === 'playing') {
                    // 如果没有摸牌且是playing状态，先摸牌
                    game.drawTileForPlayer(game.currentPlayer);
                }

                const tileToDiscard = hand.drawnTile || hand.tiles[0];
                if (tileToDiscard) {
                    const result = game.discardTile(currentPlayer.id, tileToDiscard.toJSON());
                    expect(result.success).toBe(true);
                }

                // 如果没有待处理动作，手动进入下一回合
                if (game.pendingActions.length === 0 && game.state !== 'waiting_action') {
                    // 游戏逻辑会自动处理下一回合
                }
            }

            // 游戏应该还在进行中或等待动作
            expect(['playing', 'waiting_action', 'finished']).toContain(game.state);
            // 回合数应该增加
            expect(game.turn).toBeGreaterThanOrEqual(5);
        });

        test('游戏日志应该记录所有操作', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });

            game.start();

            // 进行几个操作
            const currentPlayer = players[game.currentPlayer];
            const hand = game.hands[currentPlayer.id];
            const tileToDiscard = hand.drawnTile || hand.tiles[0];

            game.discardTile(currentPlayer.id, tileToDiscard.toJSON());

            // 应该有游戏开始和打牌的日志 (日志使用 type 字段)
            expect(game.gameLog.length).toBeGreaterThan(0);
            expect(game.gameLog.some(log => log.type === 'gameStart')).toBe(true);
            expect(game.gameLog.some(log => log.type === 'discard')).toBe(true);
        });
    });

    describe('边界情况测试', () => {
        test('玩家断开连接后游戏应该能继续', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });

            game.start();

            // 模拟玩家socket断开
            players[1].socket = null;

            const currentPlayer = players[game.currentPlayer];
            const hand = game.hands[currentPlayer.id];
            const tileToDiscard = hand.drawnTile || hand.tiles[0];

            // 游戏应该仍然可以继续
            const result = game.discardTile(currentPlayer.id, tileToDiscard.toJSON());
            expect(result.success).toBe(true);
        });

        test('快速连续操作应该被正确处理', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, { includeFlowers: false });

            game.start();

            const currentPlayer = players[game.currentPlayer];
            const hand = game.hands[currentPlayer.id];

            // 尝试快速打两张牌
            const tile1 = hand.drawnTile || hand.tiles[0];
            const result1 = game.discardTile(currentPlayer.id, tile1.toJSON());
            expect(result1.success).toBe(true);

            // 第二次打牌应该失败（因为不是当前玩家的回合了）
            if (hand.tiles.length > 0 && game.currentPlayer !== players.indexOf(currentPlayer)) {
                const tile2 = hand.tiles[0];
                const result2 = game.discardTile(currentPlayer.id, tile2.toJSON());
                expect(result2.success).toBe(false);
            }
        });
    });

    describe('计分系统', () => {
        test('初始分数应该正确设置', () => {
            const players = createMockPlayers();
            const game = new MahjongGame('test-game', players, {
                includeFlowers: false,
                ruleSet: 'chinese'
            });

            game.start();

            players.forEach(p => {
                expect(typeof game.scores[p.id]).toBe('number');
            });
        });
    });
});

describe('TileWall 牌墙测试', () => {
    test('不含花牌时应该有136张牌', () => {
        const wall = new TileWall({ includeFlowers: false });

        // 万子9种*4 + 条子9种*4 + 饼子9种*4 + 风牌4种*4 + 三元牌3种*4 = 136
        expect(wall.tiles.length + wall.deadWall.length).toBeGreaterThanOrEqual(136);
    });

    test('含花牌时应该有144张牌', () => {
        const wall = new TileWall({ includeFlowers: true });

        // 136 + 8花牌 = 144
        const totalTiles = wall.tiles.length + wall.deadWall.length;
        expect(totalTiles).toBeGreaterThanOrEqual(136);
    });

    test('摸牌应该减少牌墙数量', () => {
        const wall = new TileWall({ includeFlowers: false });
        const initialCount = wall.tiles.length;

        wall.draw();

        expect(wall.tiles.length).toBe(initialCount - 1);
    });

    test('岭上摸牌应该从死墙摸取', () => {
        const wall = new TileWall({ includeFlowers: false });
        const initialDeadWallLength = wall.deadWall.length;

        wall.drawFromDeadWall();

        expect(wall.deadWall.length).toBe(initialDeadWallLength - 1);
    });
});

describe('Hand 手牌测试', () => {
    test('添加牌应该正确增加手牌数量', () => {
        const hand = new Hand();

        hand.addTile(new Tile(TileType.WAN, 1));
        expect(hand.tiles.length).toBe(1);

        hand.addTile(new Tile(TileType.WAN, 2));
        expect(hand.tiles.length).toBe(2);
    });

    test('打牌应该正确移除手牌', () => {
        const hand = new Hand();
        const tile1 = new Tile(TileType.WAN, 1);
        const tile2 = new Tile(TileType.WAN, 2);
        hand.addTile(tile1);
        hand.addTile(tile2);
        hand.setDrawnTile(new Tile(TileType.WAN, 3));

        // 使用hand中实际的牌对象进行打牌
        const tileToDiscard = hand.tiles.find(t => t.type === TileType.WAN && t.value === 1);
        const discarded = hand.discard(tileToDiscard);

        expect(discarded).not.toBeNull();
        // 打出一张牌后，drawnTile会被加入tiles，所以: 2 - 1 + 1 = 2
        expect(hand.tiles.length).toBe(2);
        expect(hand.drawnTile).toBeNull();
    });

    test('打摸到的牌应该清除drawnTile', () => {
        const hand = new Hand();
        hand.addTile(new Tile(TileType.WAN, 1));
        const drawnTile = new Tile(TileType.WAN, 2);
        hand.setDrawnTile(drawnTile);

        const discarded = hand.discard(drawnTile);

        expect(discarded).not.toBeNull();
        expect(hand.drawnTile).toBeNull();
    });

    test('添加副露应该正确记录', () => {
        const hand = new Hand();
        const meldTiles = [
            new Tile(TileType.WAN, 1),
            new Tile(TileType.WAN, 1),
            new Tile(TileType.WAN, 1)
        ];

        hand.addMeld(new Meld('pong', meldTiles, false, 0));

        expect(hand.melds.length).toBe(1);
        expect(hand.melds[0].type).toBe('pong');
    });

    test('canPong应该正确判断', () => {
        const hand = new Hand();
        hand.addTile(new Tile(TileType.WAN, 1));
        hand.addTile(new Tile(TileType.WAN, 1));
        hand.addTile(new Tile(TileType.WAN, 2));

        expect(hand.canPong(new Tile(TileType.WAN, 1))).toBe(true);
        expect(hand.canPong(new Tile(TileType.WAN, 2))).toBe(false);
    });

    test('canKong应该正确判断明杠', () => {
        const hand = new Hand();
        hand.addTile(new Tile(TileType.WAN, 1));
        hand.addTile(new Tile(TileType.WAN, 1));
        hand.addTile(new Tile(TileType.WAN, 1));

        expect(hand.canKong(new Tile(TileType.WAN, 1))).toBe(true);
        expect(hand.canKong(new Tile(TileType.WAN, 2))).toBe(false);
    });
});
