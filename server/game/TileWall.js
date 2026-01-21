/**
 * 牌墙/牌堆管理
 * Tile Wall Management
 */

const { Tile, TileType, WindTile, DragonTile, FlowerTile } = require('./Tile');

class TileWall {
    constructor(options = {}) {
        this.includeFlowers = options.includeFlowers !== false;
        this.tiles = [];
        this.deadWall = []; // 宝牌墙
        this.doraIndicators = []; // 宝牌指示牌
        this.init();
    }

    /**
     * 初始化牌墙
     */
    init() {
        this.tiles = [];
        this.createFullSet();
        this.shuffle();
        this.setupDeadWall();
    }

    /**
     * 创建完整的牌组
     */
    createFullSet() {
        // 每种牌4张
        const addTiles = (type, values, count = 4) => {
            values.forEach(value => {
                for (let i = 0; i < count; i++) {
                    this.tiles.push(new Tile(type, value));
                }
            });
        };

        // 万子 1-9
        addTiles(TileType.WAN, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
        
        // 筒子 1-9
        addTiles(TileType.TONG, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
        
        // 条子 1-9
        addTiles(TileType.TIAO, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
        
        // 风牌
        addTiles(TileType.FENG, Object.values(WindTile));
        
        // 箭牌
        addTiles(TileType.JIAN, Object.values(DragonTile));
        
        // 花牌 (每种1张)
        if (this.includeFlowers) {
            addTiles(TileType.HUA, Object.values(FlowerTile), 1);
        }
    }

    /**
     * 洗牌
     */
    shuffle() {
        for (let i = this.tiles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
        }
    }

    /**
     * 设置死牌墙（岭上牌、宝牌指示牌）
     */
    setupDeadWall() {
        // 取14张作为死牌墙
        this.deadWall = this.tiles.splice(-14);
        // 第一张作为宝牌指示牌
        this.doraIndicators = [this.deadWall[0]];
    }

    /**
     * 摸牌
     */
    draw() {
        if (this.tiles.length === 0) {
            return null;
        }
        return this.tiles.pop();
    }

    /**
     * 从岭上摸牌（杠后补牌）
     */
    drawFromDeadWall() {
        if (this.deadWall.length <= 4) {
            return null;
        }
        // 从死牌墙末尾摸牌
        return this.deadWall.pop();
    }

    /**
     * 翻开新的宝牌指示牌
     */
    revealDora() {
        if (this.doraIndicators.length < 4 && this.deadWall.length > this.doraIndicators.length + 1) {
            this.doraIndicators.push(this.deadWall[this.doraIndicators.length]);
        }
    }

    /**
     * 获取剩余牌数
     */
    getRemainingCount() {
        return this.tiles.length;
    }

    /**
     * 检查是否可以继续摸牌
     */
    canDraw() {
        return this.tiles.length > 0;
    }

    /**
     * 获取宝牌指示牌
     */
    getDoraIndicators() {
        return this.doraIndicators;
    }

    /**
     * 根据指示牌获取实际宝牌
     */
    static getDoraFromIndicator(indicator) {
        // 数字牌：指示牌+1（9后为1）
        if (indicator.isNumberTile()) {
            const newValue = indicator.value === 9 ? 1 : indicator.value + 1;
            return new Tile(indicator.type, newValue);
        }
        
        // 风牌：东南西北循环
        if (indicator.type === TileType.FENG) {
            const winds = [WindTile.EAST, WindTile.SOUTH, WindTile.WEST, WindTile.NORTH];
            const index = winds.indexOf(indicator.value);
            const nextIndex = (index + 1) % 4;
            return new Tile(TileType.FENG, winds[nextIndex]);
        }
        
        // 箭牌：中发白循环
        if (indicator.type === TileType.JIAN) {
            const dragons = [DragonTile.ZHONG, DragonTile.FA, DragonTile.BAI];
            const index = dragons.indexOf(indicator.value);
            const nextIndex = (index + 1) % 3;
            return new Tile(TileType.JIAN, dragons[nextIndex]);
        }
        
        return null;
    }

    /**
     * 序列化
     */
    toJSON() {
        return {
            remaining: this.tiles.length,
            doraIndicators: this.doraIndicators.map(t => t.toJSON())
        };
    }
}

module.exports = TileWall;
