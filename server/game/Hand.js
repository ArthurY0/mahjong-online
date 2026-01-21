/**
 * 手牌管理类
 * Hand Management
 */

const { Tile, TileType } = require('./Tile');

class Hand {
    constructor() {
        this.tiles = [];          // 手牌
        this.melds = [];          // 副露（吃碰杠）
        this.flowers = [];        // 花牌
        this.discards = [];       // 打出的牌
        this.drawnTile = null;    // 刚摸的牌
        this.riichi = false;      // 是否立直
        this.riichiTurn = -1;     // 立直的回合
    }

    /**
     * 添加牌到手牌
     */
    addTile(tile) {
        this.tiles.push(tile);
        this.sortTiles();
    }

    /**
     * 添加多张牌
     */
    addTiles(tiles) {
        this.tiles.push(...tiles);
        this.sortTiles();
    }

    /**
     * 设置摸到的牌
     */
    setDrawnTile(tile) {
        this.drawnTile = tile;
    }

    /**
     * 将摸到的牌加入手牌
     */
    acceptDrawnTile() {
        if (this.drawnTile) {
            this.tiles.push(this.drawnTile);
            this.drawnTile = null;
            this.sortTiles();
        }
    }

    /**
     * 排序手牌
     */
    sortTiles() {
        this.tiles.sort((a, b) => a.getSortValue() - b.getSortValue());
    }

    /**
     * 移除一张牌
     */
    removeTile(tile) {
        const index = this.tiles.findIndex(t => t.equals(tile));
        if (index !== -1) {
            return this.tiles.splice(index, 1)[0];
        }
        return null;
    }

    /**
     * 移除指定ID的牌
     */
    removeTileById(tileId) {
        const index = this.tiles.findIndex(t => t.id === tileId);
        if (index !== -1) {
            return this.tiles.splice(index, 1)[0];
        }
        // 检查是否是刚摸的牌
        if (this.drawnTile && this.drawnTile.id === tileId) {
            const tile = this.drawnTile;
            this.drawnTile = null;
            return tile;
        }
        return null;
    }

    /**
     * 打出一张牌
     */
    discard(tile) {
        let discarded = null;
        
        // 先检查是否是刚摸的牌
        if (this.drawnTile && this.drawnTile.id === tile.id) {
            discarded = this.drawnTile;
            this.drawnTile = null;
        } else {
            discarded = this.removeTileById(tile.id);
        }
        
        if (discarded) {
            this.discards.push(discarded);
            // 如果打出的不是摸到的牌，需要把摸到的牌放入手牌
            if (this.drawnTile) {
                this.acceptDrawnTile();
            }
        }
        
        return discarded;
    }

    /**
     * 添加副露
     */
    addMeld(meld) {
        this.melds.push(meld);
    }

    /**
     * 添加花牌
     */
    addFlower(tile) {
        this.flowers.push(tile);
    }

    /**
     * 检查是否有指定的牌
     */
    hasTile(tile) {
        return this.tiles.some(t => t.equals(tile));
    }

    /**
     * 统计指定牌的数量
     */
    countTile(tile) {
        return this.tiles.filter(t => t.equals(tile)).length;
    }

    /**
     * 获取所有牌（包括副露）的列表
     */
    getAllTiles() {
        let allTiles = [...this.tiles];
        if (this.drawnTile) {
            allTiles.push(this.drawnTile);
        }
        return allTiles;
    }

    /**
     * 获取完整手牌（包括副露中的牌）
     */
    getFullHand() {
        let fullHand = this.getAllTiles();
        this.melds.forEach(meld => {
            fullHand.push(...meld.tiles);
        });
        return fullHand;
    }

    /**
     * 检查是否可以碰
     */
    canPong(tile) {
        return this.countTile(tile) >= 2;
    }

    /**
     * 检查是否可以杠（明杠）
     */
    canKong(tile) {
        return this.countTile(tile) >= 3;
    }

    /**
     * 检查是否可以暗杠
     */
    canConcealedKong() {
        const tileCounts = this.getTileCounts();
        for (const key in tileCounts) {
            if (tileCounts[key] >= 4) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取可以暗杠的牌
     */
    getConcealedKongTiles() {
        const tileCounts = this.getTileCounts();
        const kongTiles = [];
        for (const key in tileCounts) {
            if (tileCounts[key] >= 4) {
                const tile = this.tiles.find(t => t.getKey() === key);
                if (tile) kongTiles.push(tile);
            }
        }
        return kongTiles;
    }

    /**
     * 检查是否可以加杠（在已有的碰上加杠）
     */
    canAddKong(tile) {
        // 检查是否有该牌
        if (!this.hasTile(tile) && (!this.drawnTile || !this.drawnTile.equals(tile))) {
            return false;
        }
        // 检查是否有对应的碰
        return this.melds.some(meld => 
            meld.type === 'pong' && meld.tiles[0].equals(tile)
        );
    }

    /**
     * 检查是否可以吃
     */
    canChow(tile) {
        if (!tile.isNumberTile()) {
            return false;
        }

        const value = tile.value;
        const type = tile.type;
        const hand = this.getAllTiles();

        // 检查三种吃的可能
        const possibilities = [];

        // 吃成 tile-2, tile-1, tile
        if (value >= 3) {
            const has1 = hand.some(t => t.type === type && t.value === value - 2);
            const has2 = hand.some(t => t.type === type && t.value === value - 1);
            if (has1 && has2) {
                possibilities.push([value - 2, value - 1, value]);
            }
        }

        // 吃成 tile-1, tile, tile+1
        if (value >= 2 && value <= 8) {
            const has1 = hand.some(t => t.type === type && t.value === value - 1);
            const has2 = hand.some(t => t.type === type && t.value === value + 1);
            if (has1 && has2) {
                possibilities.push([value - 1, value, value + 1]);
            }
        }

        // 吃成 tile, tile+1, tile+2
        if (value <= 7) {
            const has1 = hand.some(t => t.type === type && t.value === value + 1);
            const has2 = hand.some(t => t.type === type && t.value === value + 2);
            if (has1 && has2) {
                possibilities.push([value, value + 1, value + 2]);
            }
        }

        return possibilities;
    }

    /**
     * 获取牌的统计
     */
    getTileCounts() {
        const counts = {};
        const allTiles = this.getAllTiles();
        allTiles.forEach(tile => {
            const key = tile.getKey();
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }

    /**
     * 检查手牌是否门清（无副露，或只有暗杠）
     */
    isClosed() {
        return this.melds.every(meld => meld.concealed);
    }

    /**
     * 宣布立直
     */
    declareRiichi(turn) {
        this.riichi = true;
        this.riichiTurn = turn;
    }

    /**
     * 获取手牌数量
     */
    getTileCount() {
        let count = this.tiles.length;
        if (this.drawnTile) count++;
        return count;
    }

    /**
     * 序列化（对自己显示全部）
     */
    toJSON() {
        return {
            tiles: this.tiles.map(t => t.toJSON()),
            drawnTile: this.drawnTile ? this.drawnTile.toJSON() : null,
            melds: this.melds,
            flowers: this.flowers.map(t => t.toJSON()),
            discards: this.discards.map(t => t.toJSON()),
            riichi: this.riichi,
            tileCount: this.getTileCount()
        };
    }

    /**
     * 序列化（对其他玩家隐藏手牌）
     */
    toPublicJSON() {
        return {
            tileCount: this.getTileCount(),
            melds: this.melds,
            flowers: this.flowers.map(t => t.toJSON()),
            discards: this.discards.map(t => t.toJSON()),
            riichi: this.riichi,
            hasDrawnTile: this.drawnTile !== null
        };
    }
}

/**
 * 副露类
 */
class Meld {
    constructor(type, tiles, concealed = false, fromPlayer = null) {
        this.type = type;       // 'chow', 'pong', 'kong'
        this.tiles = tiles;
        this.concealed = concealed;
        this.fromPlayer = fromPlayer; // 从哪个玩家处获得
    }

    toJSON() {
        return {
            type: this.type,
            tiles: this.tiles.map(t => t.toJSON()),
            concealed: this.concealed,
            fromPlayer: this.fromPlayer
        };
    }
}

module.exports = { Hand, Meld };
