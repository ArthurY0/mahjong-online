/**
 * 胡牌判定和计分系统
 * Winning Detection and Scoring System
 */

const { Tile, TileType, WindTile, DragonTile } = require('./Tile');

class WinningChecker {
    constructor(ruleSet = 'chinese') {
        this.ruleSet = ruleSet;
    }

    /**
     * 检查是否胡牌
     */
    checkWin(hand, winningTile, context = {}) {
        const allTiles = [...hand.getAllTiles()];
        if (winningTile) {
            allTiles.push(winningTile);
        }

        // 加入副露中的牌
        const melds = hand.melds;
        
        // 检查基本胡牌形式
        const patterns = this.findWinningPatterns(allTiles, melds);
        
        if (patterns.length === 0) {
            return { isWin: false };
        }

        // 计算番数
        const bestPattern = this.findBestPattern(patterns, hand, winningTile, context);
        
        return {
            isWin: true,
            pattern: bestPattern.pattern,
            yaku: bestPattern.yaku,
            score: bestPattern.score,
            han: bestPattern.han
        };
    }

    /**
     * 查找所有可能的胡牌组合
     */
    findWinningPatterns(tiles, melds) {
        const patterns = [];
        
        // 标准胡牌形式：4面子 + 1雀头
        const standardPatterns = this.findStandardPatterns(tiles, melds);
        patterns.push(...standardPatterns);

        // 七对子
        if (melds.length === 0) {
            const sevenPairs = this.checkSevenPairs(tiles);
            if (sevenPairs) {
                patterns.push({ type: 'sevenPairs', ...sevenPairs });
            }
        }

        // 国士无双（十三幺）
        if (melds.length === 0) {
            const thirteenOrphans = this.checkThirteenOrphans(tiles);
            if (thirteenOrphans) {
                patterns.push({ type: 'thirteenOrphans', ...thirteenOrphans });
            }
        }

        return patterns;
    }

    /**
     * 查找标准胡牌组合（4面子+1雀头）
     */
    findStandardPatterns(tiles, melds) {
        const patterns = [];
        const tileCounts = this.getTileCounts(tiles);
        
        // 尝试每种可能的雀头
        for (const key in tileCounts) {
            if (tileCounts[key] >= 2) {
                const remainingCounts = { ...tileCounts };
                remainingCounts[key] -= 2;
                
                const pair = this.getTileFromKey(key);
                const meldCombinations = this.findMelds(remainingCounts, 4 - melds.length);
                
                meldCombinations.forEach(combination => {
                    patterns.push({
                        type: 'standard',
                        pair,
                        melds: [...melds.map(m => m.tiles), ...combination]
                    });
                });
            }
        }
        
        return patterns;
    }

    /**
     * 递归查找面子组合
     */
    findMelds(tileCounts, numMelds) {
        if (numMelds === 0) {
            // 检查是否所有牌都用完
            const remaining = Object.values(tileCounts).reduce((a, b) => a + b, 0);
            return remaining === 0 ? [[]] : [];
        }

        const results = [];
        const keys = Object.keys(tileCounts).filter(k => tileCounts[k] > 0);
        
        if (keys.length === 0) return [];

        const firstKey = keys[0];
        const tile = this.getTileFromKey(firstKey);

        // 尝试刻子
        if (tileCounts[firstKey] >= 3) {
            const newCounts = { ...tileCounts };
            newCounts[firstKey] -= 3;
            const subResults = this.findMelds(newCounts, numMelds - 1);
            subResults.forEach(sub => {
                results.push([[tile, tile, tile], ...sub]);
            });
        }

        // 尝试顺子
        if (tile.isNumberTile() && tile.value <= 7) {
            const key2 = `${tile.type}_${tile.value + 1}`;
            const key3 = `${tile.type}_${tile.value + 2}`;
            
            if (tileCounts[key2] > 0 && tileCounts[key3] > 0) {
                const newCounts = { ...tileCounts };
                newCounts[firstKey] -= 1;
                newCounts[key2] -= 1;
                newCounts[key3] -= 1;
                
                const tile2 = this.getTileFromKey(key2);
                const tile3 = this.getTileFromKey(key3);
                
                const subResults = this.findMelds(newCounts, numMelds - 1);
                subResults.forEach(sub => {
                    results.push([[tile, tile2, tile3], ...sub]);
                });
            }
        }

        return results;
    }

    /**
     * 检查七对子
     */
    checkSevenPairs(tiles) {
        if (tiles.length !== 14) return null;
        
        const counts = this.getTileCounts(tiles);
        const pairs = [];
        
        for (const key in counts) {
            if (counts[key] !== 2 && counts[key] !== 4) {
                return null;
            }
            for (let i = 0; i < counts[key] / 2; i++) {
                pairs.push(this.getTileFromKey(key));
            }
        }
        
        if (pairs.length !== 7) return null;
        
        return { pairs };
    }

    /**
     * 检查十三幺
     */
    checkThirteenOrphans(tiles) {
        if (tiles.length !== 14) return null;
        
        const requiredTiles = [
            { type: TileType.WAN, value: 1 },
            { type: TileType.WAN, value: 9 },
            { type: TileType.TONG, value: 1 },
            { type: TileType.TONG, value: 9 },
            { type: TileType.TIAO, value: 1 },
            { type: TileType.TIAO, value: 9 },
            { type: TileType.FENG, value: WindTile.EAST },
            { type: TileType.FENG, value: WindTile.SOUTH },
            { type: TileType.FENG, value: WindTile.WEST },
            { type: TileType.FENG, value: WindTile.NORTH },
            { type: TileType.JIAN, value: DragonTile.ZHONG },
            { type: TileType.JIAN, value: DragonTile.FA },
            { type: TileType.JIAN, value: DragonTile.BAI }
        ];

        const counts = this.getTileCounts(tiles);
        let pairTile = null;

        for (const req of requiredTiles) {
            const key = `${req.type}_${req.value}`;
            if (!counts[key] || counts[key] === 0) {
                return null;
            }
            if (counts[key] === 2) {
                if (pairTile) return null; // 只能有一对
                pairTile = req;
            }
            if (counts[key] > 2) return null;
        }

        // 确保只有13种牌
        if (Object.keys(counts).length !== 13) return null;

        return { pairTile };
    }

    /**
     * 检查听牌
     */
    checkTenpai(hand) {
        const tiles = hand.getAllTiles();
        const waitingTiles = [];

        // 尝试添加每种可能的牌来检查是否能胡
        const allPossibleTiles = this.getAllPossibleTiles();
        
        for (const tile of allPossibleTiles) {
            const testTiles = [...tiles, tile];
            const patterns = this.findWinningPatterns(testTiles, hand.melds);
            if (patterns.length > 0) {
                waitingTiles.push(tile);
            }
        }

        return {
            isTenpai: waitingTiles.length > 0,
            waitingTiles
        };
    }

    /**
     * 获取所有可能的牌
     */
    getAllPossibleTiles() {
        const tiles = [];
        
        // 数字牌
        [TileType.WAN, TileType.TONG, TileType.TIAO].forEach(type => {
            for (let i = 1; i <= 9; i++) {
                tiles.push(new Tile(type, i));
            }
        });
        
        // 风牌
        Object.values(WindTile).forEach(wind => {
            tiles.push(new Tile(TileType.FENG, wind));
        });
        
        // 箭牌
        Object.values(DragonTile).forEach(dragon => {
            tiles.push(new Tile(TileType.JIAN, dragon));
        });
        
        return tiles;
    }

    /**
     * 统计牌的数量
     */
    getTileCounts(tiles) {
        const counts = {};
        tiles.forEach(tile => {
            const key = tile.getKey();
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }

    /**
     * 从key创建牌
     */
    getTileFromKey(key) {
        const [type, value] = key.split('_');
        const numValue = parseInt(value);
        return new Tile(type, isNaN(numValue) ? value : numValue);
    }

    /**
     * 找出最佳胡牌组合
     */
    findBestPattern(patterns, hand, winningTile, context) {
        let best = null;
        let bestScore = 0;

        patterns.forEach(pattern => {
            const result = this.calculateScore(pattern, hand, winningTile, context);
            if (result.score > bestScore) {
                bestScore = result.score;
                best = { pattern, ...result };
            }
        });

        return best;
    }

    /**
     * 计算分数
     */
    calculateScore(pattern, hand, winningTile, context) {
        const yaku = [];
        let han = 0;

        // 根据规则集计算
        if (this.ruleSet === 'chinese') {
            return this.calculateChineseScore(pattern, hand, winningTile, context);
        } else if (this.ruleSet === 'japanese') {
            return this.calculateJapaneseScore(pattern, hand, winningTile, context);
        }

        return { yaku, han, score: 0 };
    }

    /**
     * 计算中国麻将分数（简化版国标）
     */
    calculateChineseScore(pattern, hand, winningTile, context) {
        const yaku = [];
        let fan = 0;

        // 特殊牌型
        if (pattern.type === 'sevenPairs') {
            yaku.push({ name: '七对', fan: 24 });
            fan += 24;
        } else if (pattern.type === 'thirteenOrphans') {
            yaku.push({ name: '十三幺', fan: 88 });
            fan += 88;
        } else {
            // 标准牌型检查
            const allMelds = pattern.melds;
            
            // 检查清一色
            if (this.checkFlush(allMelds, pattern.pair)) {
                yaku.push({ name: '清一色', fan: 24 });
                fan += 24;
            }
            
            // 检查对对胡（碰碰和）
            if (this.checkAllPongs(allMelds)) {
                yaku.push({ name: '碰碰和', fan: 6 });
                fan += 6;
            }

            // 检查混一色
            if (this.checkHalfFlush(allMelds, pattern.pair)) {
                yaku.push({ name: '混一色', fan: 6 });
                fan += 6;
            }

            // 检查全带幺
            if (this.checkAllTerminals(allMelds, pattern.pair)) {
                yaku.push({ name: '全带幺', fan: 4 });
                fan += 4;
            }

            // 门前清
            if (hand.isClosed()) {
                yaku.push({ name: '门前清', fan: 2 });
                fan += 2;
            }

            // 自摸
            if (context.isSelfDraw) {
                yaku.push({ name: '自摸', fan: 1 });
                fan += 1;
            }

            // 平和
            if (this.checkPinfu(allMelds, pattern.pair, context)) {
                yaku.push({ name: '平和', fan: 2 });
                fan += 2;
            }
        }

        // 基础分8分
        if (fan === 0) fan = 8;

        const score = fan * 100; // 简化计分

        return { yaku, han: fan, score };
    }

    /**
     * 计算日本麻将分数（简化版）
     */
    calculateJapaneseScore(pattern, hand, winningTile, context) {
        const yaku = [];
        let han = 0;
        let fu = 20; // 基础符

        // 特殊牌型
        if (pattern.type === 'sevenPairs') {
            yaku.push({ name: '七対子', han: 2 });
            han += 2;
            fu = 25;
        } else if (pattern.type === 'thirteenOrphans') {
            yaku.push({ name: '国士無双', han: 13 }); // 役满
            han += 13;
        } else {
            // 立直
            if (hand.riichi) {
                yaku.push({ name: '立直', han: 1 });
                han += 1;
            }

            // 门前清自摸
            if (hand.isClosed() && context.isSelfDraw) {
                yaku.push({ name: '門前清自摸和', han: 1 });
                han += 1;
            }

            // 断幺九
            if (this.checkTanyao(pattern.melds, pattern.pair)) {
                yaku.push({ name: '断幺九', han: 1 });
                han += 1;
            }

            // 平和
            if (hand.isClosed() && this.checkPinfu(pattern.melds, pattern.pair, context)) {
                yaku.push({ name: '平和', han: 1 });
                han += 1;
            }

            // 清一色
            if (this.checkFlush(pattern.melds, pattern.pair)) {
                const flushHan = hand.isClosed() ? 6 : 5;
                yaku.push({ name: '清一色', han: flushHan });
                han += flushHan;
            }
        }

        // 计算分数
        const score = this.calculateJapanesePoints(han, fu, context);

        return { yaku, han, fu, score };
    }

    /**
     * 计算日麻点数
     */
    calculateJapanesePoints(han, fu, context) {
        if (han >= 13) return context.isDealer ? 48000 : 32000; // 役满
        if (han >= 11) return context.isDealer ? 36000 : 24000;
        if (han >= 8) return context.isDealer ? 24000 : 16000;
        if (han >= 6) return context.isDealer ? 18000 : 12000;
        if (han >= 5) return context.isDealer ? 12000 : 8000;

        // 基本计算
        let basePoints = fu * Math.pow(2, han + 2);
        if (basePoints > 2000) basePoints = 2000; // 满贯

        if (context.isDealer) {
            return Math.ceil(basePoints * 6 / 100) * 100;
        } else {
            return Math.ceil(basePoints * 4 / 100) * 100;
        }
    }

    // 辅助检查方法
    checkFlush(melds, pair) {
        // 清一色：全部由同一花色的数牌组成，不能有字牌
        // 检查雀头是否为字牌
        if (pair.isHonorTile()) return false;

        const types = new Set();
        types.add(pair.type);

        for (const meld of melds) {
            for (const tile of meld) {
                // 如果有字牌，不是清一色
                if (tile.isHonorTile()) return false;
                types.add(tile.type);
            }
        }

        // 只有一种花色
        return types.size === 1;
    }

    checkHalfFlush(melds, pair) {
        // 混一色：由一种花色的数牌和字牌组成，必须同时有数牌和字牌
        const numberTypes = new Set();
        let hasHonor = false;
        let hasNumber = false;

        for (const meld of melds) {
            for (const tile of meld) {
                if (tile.isNumberTile()) {
                    numberTypes.add(tile.type);
                    hasNumber = true;
                }
                if (tile.isHonorTile()) {
                    hasHonor = true;
                }
            }
        }

        if (pair.isNumberTile()) {
            numberTypes.add(pair.type);
            hasNumber = true;
        }
        if (pair.isHonorTile()) {
            hasHonor = true;
        }

        // 混一色需要：只有一种数牌花色，并且同时有数牌和字牌
        return numberTypes.size === 1 && hasHonor && hasNumber;
    }

    checkAllPongs(melds) {
        // 检查所有面子是否都是刻子或杠（3张或4张相同的牌）
        return melds.every(m => {
            if (m.length < 3 || m.length > 4) return false;
            // 检查所有牌是否相同
            return m.every(tile => tile.equals(m[0]));
        });
    }

    checkAllTerminals(melds, pair) {
        const checkTiles = (tiles) => tiles.some(t => t.isTerminalOrHonor());
        return melds.every(m => checkTiles(m)) && pair.isTerminalOrHonor();
    }

    checkTanyao(melds, pair) {
        const checkNoTerminals = (tiles) => tiles.every(t => !t.isTerminalOrHonor());
        return melds.every(m => checkNoTerminals(m)) && !pair.isTerminalOrHonor();
    }

    checkPinfu(melds, pair, context) {
        // 平和：全顺子，雀头不是役牌，两面听
        const isSequence = (meld) => {
            // 顺子必须是3张牌
            if (meld.length !== 3) return false;
            // 必须是数牌
            if (!meld[0].isNumberTile()) return false;
            // 检查是否连续且同花色
            const sorted = [...meld].sort((a, b) => a.value - b.value);
            return sorted[0].type === sorted[1].type &&
                   sorted[1].type === sorted[2].type &&
                   sorted[1].value === sorted[0].value + 1 &&
                   sorted[2].value === sorted[1].value + 1;
        };

        const allSequence = melds.every(m => isSequence(m));

        if (!allSequence) return false;
        if (pair.isHonorTile()) return false;

        return true;
    }
}

module.exports = WinningChecker;
