/**
 * 麻将牌类定义
 * Mahjong Tile Definitions
 */

// 牌的类型
const TileType = {
    WAN: 'wan',      // 万
    TONG: 'tong',    // 筒
    TIAO: 'tiao',    // 条
    FENG: 'feng',    // 风
    JIAN: 'jian',    // 箭 (中发白)
    HUA: 'hua'       // 花
};

// 风牌
const WindTile = {
    EAST: 'east',    // 东
    SOUTH: 'south',  // 南
    WEST: 'west',    // 西
    NORTH: 'north'   // 北
};

// 箭牌
const DragonTile = {
    ZHONG: 'zhong',  // 中
    FA: 'fa',        // 发
    BAI: 'bai'       // 白
};

// 花牌
const FlowerTile = {
    CHUN: 'chun',    // 春
    XIA: 'xia',      // 夏
    QIU: 'qiu',      // 秋
    DONG: 'dong',    // 冬
    MEI: 'mei',      // 梅
    LAN: 'lan',      // 兰
    ZHU: 'zhu',      // 竹
    JU: 'ju'         // 菊
};

/**
 * 麻将牌类
 */
class Tile {
    constructor(type, value, id = null) {
        this.type = type;
        this.value = value;
        this.id = id || `${type}_${value}_${Date.now()}_${Math.random()}`;
    }

    /**
     * 获取牌的显示名称
     */
    getDisplayName() {
        const numberNames = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
        const windNames = { east: '东', south: '南', west: '西', north: '北' };
        const dragonNames = { zhong: '中', fa: '发', bai: '白' };
        const flowerNames = {
            chun: '春', xia: '夏', qiu: '秋', dong: '冬',
            mei: '梅', lan: '兰', zhu: '竹', ju: '菊'
        };

        switch (this.type) {
            case TileType.WAN:
                return `${numberNames[this.value - 1]}万`;
            case TileType.TONG:
                return `${numberNames[this.value - 1]}筒`;
            case TileType.TIAO:
                return `${numberNames[this.value - 1]}条`;
            case TileType.FENG:
                return windNames[this.value];
            case TileType.JIAN:
                return dragonNames[this.value];
            case TileType.HUA:
                return flowerNames[this.value];
            default:
                return '未知';
        }
    }

    /**
     * 获取牌的Unicode符号
     */
    getUnicode() {
        // 麻将Unicode从 🀀 (U+1F000) 开始
        const baseCode = 0x1F000;
        
        if (this.type === TileType.WAN) {
            return String.fromCodePoint(baseCode + 6 + this.value); // 🀇-🀏
        }
        if (this.type === TileType.TONG) {
            return String.fromCodePoint(baseCode + 24 + this.value - 1); // 🀙-🀡
        }
        if (this.type === TileType.TIAO) {
            return String.fromCodePoint(baseCode + 15 + this.value); // 🀐-🀘
        }
        if (this.type === TileType.FENG) {
            const windOrder = { east: 0, south: 1, west: 2, north: 3 };
            return String.fromCodePoint(baseCode + windOrder[this.value]); // 🀀-🀃
        }
        if (this.type === TileType.JIAN) {
            const dragonOrder = { zhong: 0, fa: 1, bai: 2 };
            return String.fromCodePoint(baseCode + 4 + dragonOrder[this.value]); // 🀄-🀆
        }
        if (this.type === TileType.HUA) {
            const flowerOrder = {
                chun: 0, xia: 1, qiu: 2, dong: 3,
                mei: 4, lan: 5, zhu: 6, ju: 7
            };
            return String.fromCodePoint(baseCode + 34 + flowerOrder[this.value]); // 🀢-🀩
        }
        return '🀫'; // 背面
    }

    /**
     * 获取牌的排序值
     */
    getSortValue() {
        const typeOrder = {
            [TileType.WAN]: 0,
            [TileType.TONG]: 100,
            [TileType.TIAO]: 200,
            [TileType.FENG]: 300,
            [TileType.JIAN]: 400,
            [TileType.HUA]: 500
        };

        let valueOrder = 0;
        if (typeof this.value === 'number') {
            valueOrder = this.value;
        } else {
            const stringOrders = {
                east: 1, south: 2, west: 3, north: 4,
                zhong: 1, fa: 2, bai: 3,
                chun: 1, xia: 2, qiu: 3, dong: 4,
                mei: 5, lan: 6, zhu: 7, ju: 8
            };
            valueOrder = stringOrders[this.value] || 0;
        }

        return typeOrder[this.type] + valueOrder;
    }

    /**
     * 判断是否为数字牌
     */
    isNumberTile() {
        return [TileType.WAN, TileType.TONG, TileType.TIAO].includes(this.type);
    }

    /**
     * 判断是否为字牌
     */
    isHonorTile() {
        return [TileType.FENG, TileType.JIAN].includes(this.type);
    }

    /**
     * 判断是否为花牌
     */
    isFlowerTile() {
        return this.type === TileType.HUA;
    }

    /**
     * 判断是否为幺九牌
     */
    isTerminal() {
        return this.isNumberTile() && (this.value === 1 || this.value === 9);
    }

    /**
     * 判断是否为幺九字牌
     */
    isTerminalOrHonor() {
        return this.isTerminal() || this.isHonorTile();
    }

    /**
     * 判断两张牌是否相同
     */
    equals(other) {
        return this.type === other.type && this.value === other.value;
    }

    /**
     * 获取下一张牌（用于顺子判断）
     */
    getNext() {
        if (!this.isNumberTile() || this.value >= 9) {
            return null;
        }
        return new Tile(this.type, this.value + 1);
    }

    /**
     * 序列化
     */
    toJSON() {
        return {
            type: this.type,
            value: this.value,
            id: this.id
        };
    }

    /**
     * 从JSON创建
     */
    static fromJSON(json) {
        return new Tile(json.type, json.value, json.id);
    }

    /**
     * 创建牌的简短标识
     */
    getKey() {
        return `${this.type}_${this.value}`;
    }
}

module.exports = {
    Tile,
    TileType,
    WindTile,
    DragonTile,
    FlowerTile
};
