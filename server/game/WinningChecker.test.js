/**
 * WinningChecker 单元测试
 */

const WinningChecker = require('./WinningChecker');
const { Tile, TileType, WindTile, DragonTile } = require('./Tile');
const { Hand, Meld } = require('./Hand');

describe('WinningChecker', () => {
    let checker;

    beforeEach(() => {
        checker = new WinningChecker('chinese');
    });

    describe('checkAllPongs - 碰碰和检查', () => {
        test('应该正确识别四组刻子', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 1)],
                [new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 2)],
                [new Tile(TileType.TONG, 3), new Tile(TileType.TONG, 3), new Tile(TileType.TONG, 3)],
                [new Tile(TileType.TIAO, 4), new Tile(TileType.TIAO, 4), new Tile(TileType.TIAO, 4)]
            ];
            expect(checker.checkAllPongs(melds)).toBe(true);
        });

        test('应该正确识别含杠的碰碰和（修复前会失败）', () => {
            const melds = [
                // 杠：4张相同的牌
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 1)],
                [new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 2)],
                [new Tile(TileType.TONG, 3), new Tile(TileType.TONG, 3), new Tile(TileType.TONG, 3)],
                [new Tile(TileType.TIAO, 4), new Tile(TileType.TIAO, 4), new Tile(TileType.TIAO, 4)]
            ];
            expect(checker.checkAllPongs(melds)).toBe(true);
        });

        test('含顺子时应返回false', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)], // 顺子
                [new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 2)],
                [new Tile(TileType.TONG, 3), new Tile(TileType.TONG, 3), new Tile(TileType.TONG, 3)],
                [new Tile(TileType.TIAO, 4), new Tile(TileType.TIAO, 4), new Tile(TileType.TIAO, 4)]
            ];
            expect(checker.checkAllPongs(melds)).toBe(false);
        });
    });

    describe('checkFlush - 清一色检查', () => {
        test('应该正确识别清一色', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.WAN, 4), new Tile(TileType.WAN, 5), new Tile(TileType.WAN, 6)],
                [new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 7)],
                [new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.WAN, 8);
            expect(checker.checkFlush(melds, pair)).toBe(true);
        });

        test('雀头为字牌时不是清一色', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.WAN, 4), new Tile(TileType.WAN, 5), new Tile(TileType.WAN, 6)],
                [new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 7)],
                [new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.FENG, WindTile.EAST);
            expect(checker.checkFlush(melds, pair)).toBe(false);
        });

        test('有字牌面子时不是清一色', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.WAN, 4), new Tile(TileType.WAN, 5), new Tile(TileType.WAN, 6)],
                [new Tile(TileType.FENG, WindTile.EAST), new Tile(TileType.FENG, WindTile.EAST), new Tile(TileType.FENG, WindTile.EAST)],
                [new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.WAN, 8);
            expect(checker.checkFlush(melds, pair)).toBe(false);
        });

        test('多种花色时不是清一色', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.TONG, 4), new Tile(TileType.TONG, 5), new Tile(TileType.TONG, 6)], // 不同花色
                [new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 7)],
                [new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.WAN, 8);
            expect(checker.checkFlush(melds, pair)).toBe(false);
        });
    });

    describe('checkHalfFlush - 混一色检查', () => {
        test('应该正确识别混一色', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.WAN, 4), new Tile(TileType.WAN, 5), new Tile(TileType.WAN, 6)],
                [new Tile(TileType.FENG, WindTile.EAST), new Tile(TileType.FENG, WindTile.EAST), new Tile(TileType.FENG, WindTile.EAST)],
                [new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.WAN, 8);
            expect(checker.checkHalfFlush(melds, pair)).toBe(true);
        });

        test('全数牌（清一色）不是混一色', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.WAN, 4), new Tile(TileType.WAN, 5), new Tile(TileType.WAN, 6)],
                [new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 7)],
                [new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.WAN, 8);
            expect(checker.checkHalfFlush(melds, pair)).toBe(false);
        });

        test('多种数牌花色不是混一色', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.TONG, 4), new Tile(TileType.TONG, 5), new Tile(TileType.TONG, 6)],
                [new Tile(TileType.FENG, WindTile.EAST), new Tile(TileType.FENG, WindTile.EAST), new Tile(TileType.FENG, WindTile.EAST)],
                [new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.WAN, 8);
            expect(checker.checkHalfFlush(melds, pair)).toBe(false);
        });
    });

    describe('checkPinfu - 平和检查', () => {
        test('应该正确识别平和', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.TONG, 4), new Tile(TileType.TONG, 5), new Tile(TileType.TONG, 6)],
                [new Tile(TileType.TIAO, 2), new Tile(TileType.TIAO, 3), new Tile(TileType.TIAO, 4)],
                [new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 8), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.TONG, 5);
            expect(checker.checkPinfu(melds, pair, {})).toBe(true);
        });

        test('有刻子时不是平和', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.TONG, 4), new Tile(TileType.TONG, 5), new Tile(TileType.TONG, 6)],
                [new Tile(TileType.TIAO, 2), new Tile(TileType.TIAO, 2), new Tile(TileType.TIAO, 2)], // 刻子
                [new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 8), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.TONG, 5);
            expect(checker.checkPinfu(melds, pair, {})).toBe(false);
        });

        test('雀头为字牌时不是平和', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.TONG, 4), new Tile(TileType.TONG, 5), new Tile(TileType.TONG, 6)],
                [new Tile(TileType.TIAO, 2), new Tile(TileType.TIAO, 3), new Tile(TileType.TIAO, 4)],
                [new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 8), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.FENG, WindTile.EAST);
            expect(checker.checkPinfu(melds, pair, {})).toBe(false);
        });

        test('有杠时不是平和', () => {
            const melds = [
                [new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 3)],
                [new Tile(TileType.TONG, 4), new Tile(TileType.TONG, 5), new Tile(TileType.TONG, 6)],
                // 杠不是顺子
                [new Tile(TileType.TIAO, 2), new Tile(TileType.TIAO, 2), new Tile(TileType.TIAO, 2), new Tile(TileType.TIAO, 2)],
                [new Tile(TileType.WAN, 7), new Tile(TileType.WAN, 8), new Tile(TileType.WAN, 9)]
            ];
            const pair = new Tile(TileType.TONG, 5);
            expect(checker.checkPinfu(melds, pair, {})).toBe(false);
        });
    });

    describe('checkSevenPairs - 七对子检查', () => {
        test('应该正确识别七对子', () => {
            const tiles = [
                new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 2),
                new Tile(TileType.TONG, 3), new Tile(TileType.TONG, 3),
                new Tile(TileType.TIAO, 4), new Tile(TileType.TIAO, 4),
                new Tile(TileType.FENG, WindTile.EAST), new Tile(TileType.FENG, WindTile.EAST),
                new Tile(TileType.JIAN, DragonTile.ZHONG), new Tile(TileType.JIAN, DragonTile.ZHONG),
                new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9)
            ];
            const result = checker.checkSevenPairs(tiles);
            expect(result).not.toBeNull();
            expect(result.pairs.length).toBe(7);
        });

        test('含4张相同牌的七对子', () => {
            const tiles = [
                new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 1), // 4张相同，算2对
                new Tile(TileType.TONG, 3), new Tile(TileType.TONG, 3),
                new Tile(TileType.TIAO, 4), new Tile(TileType.TIAO, 4),
                new Tile(TileType.FENG, WindTile.EAST), new Tile(TileType.FENG, WindTile.EAST),
                new Tile(TileType.JIAN, DragonTile.ZHONG), new Tile(TileType.JIAN, DragonTile.ZHONG),
                new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 9)
            ];
            const result = checker.checkSevenPairs(tiles);
            expect(result).not.toBeNull();
            expect(result.pairs.length).toBe(7);
        });

        test('非七对子应返回null', () => {
            const tiles = [
                new Tile(TileType.WAN, 1), new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 2), new Tile(TileType.WAN, 2),
                new Tile(TileType.TONG, 3), new Tile(TileType.TONG, 3),
                new Tile(TileType.TIAO, 4), new Tile(TileType.TIAO, 4),
                new Tile(TileType.FENG, WindTile.EAST), new Tile(TileType.FENG, WindTile.EAST),
                new Tile(TileType.JIAN, DragonTile.ZHONG), new Tile(TileType.JIAN, DragonTile.ZHONG),
                new Tile(TileType.WAN, 9), new Tile(TileType.WAN, 8) // 不成对
            ];
            const result = checker.checkSevenPairs(tiles);
            expect(result).toBeNull();
        });
    });

    describe('checkThirteenOrphans - 十三幺检查', () => {
        test('应该正确识别十三幺', () => {
            const tiles = [
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 9),
                new Tile(TileType.TONG, 1),
                new Tile(TileType.TONG, 9),
                new Tile(TileType.TIAO, 1),
                new Tile(TileType.TIAO, 9),
                new Tile(TileType.FENG, WindTile.EAST),
                new Tile(TileType.FENG, WindTile.SOUTH),
                new Tile(TileType.FENG, WindTile.WEST),
                new Tile(TileType.FENG, WindTile.NORTH),
                new Tile(TileType.JIAN, DragonTile.ZHONG),
                new Tile(TileType.JIAN, DragonTile.FA),
                new Tile(TileType.JIAN, DragonTile.BAI),
                new Tile(TileType.WAN, 1) // 对子
            ];
            const result = checker.checkThirteenOrphans(tiles);
            expect(result).not.toBeNull();
        });

        test('缺少幺九牌应返回null', () => {
            const tiles = [
                new Tile(TileType.WAN, 1),
                new Tile(TileType.WAN, 9),
                new Tile(TileType.TONG, 1),
                new Tile(TileType.TONG, 9),
                new Tile(TileType.TIAO, 1),
                new Tile(TileType.TIAO, 9),
                new Tile(TileType.FENG, WindTile.EAST),
                new Tile(TileType.FENG, WindTile.SOUTH),
                new Tile(TileType.FENG, WindTile.WEST),
                new Tile(TileType.FENG, WindTile.NORTH),
                new Tile(TileType.JIAN, DragonTile.ZHONG),
                new Tile(TileType.JIAN, DragonTile.FA),
                new Tile(TileType.WAN, 5), // 非幺九牌
                new Tile(TileType.WAN, 1)
            ];
            const result = checker.checkThirteenOrphans(tiles);
            expect(result).toBeNull();
        });
    });
});
