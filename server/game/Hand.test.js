/**
 * Hand 单元测试
 */

const { Hand, Meld } = require('./Hand');
const { Tile, TileType, WindTile } = require('./Tile');

describe('Hand', () => {
    let hand;

    beforeEach(() => {
        hand = new Hand();
    });

    describe('基本操作', () => {
        test('addTile 应该正确添加牌', () => {
            const tile = new Tile(TileType.WAN, 1);
            hand.addTile(tile);
            expect(hand.tiles.length).toBe(1);
            expect(hand.tiles[0].equals(tile)).toBe(true);
        });

        test('removeTile 应该正确移除牌', () => {
            const tile1 = new Tile(TileType.WAN, 1);
            const tile2 = new Tile(TileType.WAN, 2);
            hand.addTile(tile1);
            hand.addTile(tile2);

            const removed = hand.removeTile(tile1);
            expect(removed).not.toBeNull();
            expect(removed.equals(tile1)).toBe(true);
            expect(hand.tiles.length).toBe(1);
        });

        test('countTile 应该正确统计牌数量', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 2));

            expect(hand.countTile(new Tile(TileType.WAN, 1))).toBe(3);
            expect(hand.countTile(new Tile(TileType.WAN, 2))).toBe(1);
            expect(hand.countTile(new Tile(TileType.WAN, 3))).toBe(0);
        });
    });

    describe('canPong - 碰牌检查', () => {
        test('有2张相同牌时可以碰', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            expect(hand.canPong(new Tile(TileType.WAN, 1))).toBe(true);
        });

        test('只有1张相同牌时不能碰', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            expect(hand.canPong(new Tile(TileType.WAN, 1))).toBe(false);
        });
    });

    describe('canKong - 明杠检查', () => {
        test('有3张相同牌时可以杠', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            expect(hand.canKong(new Tile(TileType.WAN, 1))).toBe(true);
        });

        test('只有2张相同牌时不能杠', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            expect(hand.canKong(new Tile(TileType.WAN, 1))).toBe(false);
        });
    });

    describe('canConcealedKong - 暗杠检查', () => {
        test('手牌有4张相同牌时可以暗杠', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            expect(hand.canConcealedKong()).toBe(true);
        });

        test('手牌只有3张相同牌时不能暗杠', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            expect(hand.canConcealedKong()).toBe(false);
        });

        test('手牌3张+drawnTile1张时应该可以暗杠（通过getTileCounts检查）', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.setDrawnTile(new Tile(TileType.WAN, 1));
            // canConcealedKong 使用 getTileCounts，它包含 drawnTile
            expect(hand.canConcealedKong()).toBe(true);
        });
    });

    describe('canChow - 吃牌检查', () => {
        test('可以吃成顺子（tile在中间）', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            hand.addTile(new Tile(TileType.WAN, 3));
            const options = hand.canChow(new Tile(TileType.WAN, 2));
            expect(options.length).toBeGreaterThan(0);
            expect(options).toContainEqual([1, 2, 3]);
        });

        test('可以吃成顺子（tile在开头）', () => {
            hand.addTile(new Tile(TileType.WAN, 2));
            hand.addTile(new Tile(TileType.WAN, 3));
            const options = hand.canChow(new Tile(TileType.WAN, 1));
            expect(options.length).toBeGreaterThan(0);
            expect(options).toContainEqual([1, 2, 3]);
        });

        test('可以吃成顺子（tile在结尾）', () => {
            hand.addTile(new Tile(TileType.WAN, 7));
            hand.addTile(new Tile(TileType.WAN, 8));
            const options = hand.canChow(new Tile(TileType.WAN, 9));
            expect(options.length).toBeGreaterThan(0);
            expect(options).toContainEqual([7, 8, 9]);
        });

        test('字牌不能吃', () => {
            hand.addTile(new Tile(TileType.FENG, WindTile.SOUTH));
            hand.addTile(new Tile(TileType.FENG, WindTile.WEST));
            const options = hand.canChow(new Tile(TileType.FENG, WindTile.EAST));
            expect(options).toEqual(false);
        });

        test('不同花色不能吃', () => {
            hand.addTile(new Tile(TileType.TONG, 2));
            hand.addTile(new Tile(TileType.TIAO, 3));
            const options = hand.canChow(new Tile(TileType.WAN, 1));
            expect(options.length).toBe(0);
        });
    });

    describe('canAddKong - 加杠检查', () => {
        test('有碰且手牌有相同牌时可以加杠', () => {
            // 先添加一个碰
            const pongTiles = [
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1)
            ];
            hand.addMeld(new Meld('pong', pongTiles, false, 0));
            // 手牌中有第四张
            hand.addTile(new Tile(TileType.WAN, 1));

            expect(hand.canAddKong(new Tile(TileType.WAN, 1))).toBe(true);
        });

        test('有碰但手牌没有相同牌时不能加杠', () => {
            const pongTiles = [
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1)
            ];
            hand.addMeld(new Meld('pong', pongTiles, false, 0));

            expect(hand.canAddKong(new Tile(TileType.WAN, 1))).toBe(false);
        });

        test('drawnTile有相同牌时可以加杠', () => {
            const pongTiles = [
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1)
            ];
            hand.addMeld(new Meld('pong', pongTiles, false, 0));
            hand.setDrawnTile(new Tile(TileType.WAN, 1));

            expect(hand.canAddKong(new Tile(TileType.WAN, 1))).toBe(true);
        });
    });

    describe('isClosed - 门清检查', () => {
        test('没有副露时是门清', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            expect(hand.isClosed()).toBe(true);
        });

        test('只有暗杠时是门清', () => {
            const kongTiles = [
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1)
            ];
            hand.addMeld(new Meld('kong', kongTiles, true)); // concealed = true
            expect(hand.isClosed()).toBe(true);
        });

        test('有明副露时不是门清', () => {
            const pongTiles = [
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1)
            ];
            hand.addMeld(new Meld('pong', pongTiles, false, 0)); // concealed = false
            expect(hand.isClosed()).toBe(false);
        });
    });

    describe('discard - 打牌', () => {
        test('打出手牌中的牌', () => {
            const tile = new Tile(TileType.WAN, 1);
            hand.addTile(tile);
            hand.addTile(new Tile(TileType.WAN, 2));

            const discarded = hand.discard(tile);
            expect(discarded).not.toBeNull();
            expect(hand.tiles.length).toBe(1);
            expect(hand.discards.length).toBe(1);
        });

        test('打出drawnTile', () => {
            hand.addTile(new Tile(TileType.WAN, 1));
            const drawnTile = new Tile(TileType.WAN, 2);
            hand.setDrawnTile(drawnTile);

            const discarded = hand.discard(drawnTile);
            expect(discarded).not.toBeNull();
            expect(hand.drawnTile).toBeNull();
            expect(hand.discards.length).toBe(1);
        });

        test('打出手牌中的牌后，drawnTile应加入手牌', () => {
            const tile1 = new Tile(TileType.WAN, 1);
            hand.addTile(tile1);
            const drawnTile = new Tile(TileType.WAN, 2);
            hand.setDrawnTile(drawnTile);

            hand.discard(tile1);
            expect(hand.drawnTile).toBeNull();
            expect(hand.tiles.some(t => t.equals(drawnTile))).toBe(true);
        });
    });
});
