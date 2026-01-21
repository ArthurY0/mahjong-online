/**
 * 麻将牌渲染器
 */

const TileRenderer = {
    // 牌类型映射
    typeNames: {
        wan: '万',
        tong: '筒',
        tiao: '条',
        feng: '',
        jian: '',
        hua: ''
    },

    // 数字映射
    numberNames: ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'],

    // 风牌映射
    windNames: {
        east: '东',
        south: '南',
        west: '西',
        north: '北'
    },

    // 箭牌映射
    dragonNames: {
        zhong: '中',
        fa: '发',
        bai: '白'
    },

    // 花牌映射
    flowerNames: {
        chun: '春',
        xia: '夏',
        qiu: '秋',
        dong: '冬',
        mei: '梅',
        lan: '兰',
        zhu: '竹',
        ju: '菊'
    },

    // Unicode麻将牌符号基础码点
    unicodeBase: 0x1F000,

    /**
     * 获取牌的显示名称
     */
    getTileName(tile) {
        if (!tile) return '';

        const { type, value } = tile;

        switch (type) {
            case 'wan':
                return `${this.numberNames[value]}万`;
            case 'tong':
                return `${this.numberNames[value]}筒`;
            case 'tiao':
                return `${this.numberNames[value]}条`;
            case 'feng':
                return this.windNames[value];
            case 'jian':
                return this.dragonNames[value];
            case 'hua':
                return this.flowerNames[value];
            default:
                return '?';
        }
    },

    /**
     * 获取牌的Unicode符号
     */
    getTileUnicode(tile) {
        if (!tile) return '🀫';

        const { type, value } = tile;

        if (type === 'wan') {
            return String.fromCodePoint(this.unicodeBase + 6 + value); // 🀇-🀏
        }
        if (type === 'tong') {
            return String.fromCodePoint(this.unicodeBase + 24 + value - 1); // 🀙-🀡
        }
        if (type === 'tiao') {
            return String.fromCodePoint(this.unicodeBase + 15 + value); // 🀐-🀘
        }
        if (type === 'feng') {
            const windOrder = { east: 0, south: 1, west: 2, north: 3 };
            return String.fromCodePoint(this.unicodeBase + windOrder[value]); // 🀀-🀃
        }
        if (type === 'jian') {
            const dragonOrder = { zhong: 0, fa: 1, bai: 2 };
            return String.fromCodePoint(this.unicodeBase + 4 + dragonOrder[value]); // 🀄-🀆
        }
        if (type === 'hua') {
            return '🌸'; // 花牌使用通用符号
        }

        return '🀫';
    },

    /**
     * 创建牌元素
     */
    createTileElement(tile, options = {}) {
        const {
            showBack = false,
            small = false,
            horizontal = false,
            selectable = false,
            selected = false,
            onClick = null,
            className = ''
        } = options;

        const div = document.createElement('div');
        div.className = `tile ${className}`;
        
        if (small) div.classList.add('tile-small');
        if (horizontal) div.classList.add('tile-horizontal');
        if (selected) div.classList.add('selected');
        if (selectable) div.classList.add('selectable');

        if (showBack || !tile) {
            div.classList.add('tile-back');
        } else {
            // 添加类型类名
            div.classList.add(`tile-${tile.type}`);
            if (tile.type === 'jian') {
                div.classList.add(`tile-${tile.value}`);
            }

            // 创建内容
            const content = document.createElement('div');
            content.className = 'tile-content';

            const valueSpan = document.createElement('span');
            valueSpan.className = 'tile-value tile-unicode';
            valueSpan.textContent = this.getTileUnicode(tile);
            content.appendChild(valueSpan);

            div.appendChild(content);

            // 存储牌数据
            div.dataset.tileId = tile.id;
            div.dataset.tileType = tile.type;
            div.dataset.tileValue = tile.value;
        }

        if (onClick && selectable) {
            div.addEventListener('click', () => onClick(tile, div));
        }

        return div;
    },

    /**
     * 渲染手牌
     */
    renderHand(container, tiles, options = {}) {
        container.innerHTML = '';
        
        tiles.forEach(tile => {
            const elem = this.createTileElement(tile, {
                selectable: options.selectable,
                onClick: options.onClick,
                className: options.className
            });
            container.appendChild(elem);
        });
    },

    /**
     * 渲染副露
     */
    renderMelds(container, melds) {
        container.innerHTML = '';

        melds.forEach(meld => {
            const meldDiv = document.createElement('div');
            meldDiv.className = `meld ${meld.concealed ? 'concealed' : ''}`;

            meld.tiles.forEach((tile, index) => {
                // 对于明杠/明碰，显示吃碰杠来源的牌横放
                const horizontal = !meld.concealed && index === 0 && meld.fromPlayer !== undefined;
                const showBack = meld.concealed && (index === 1 || index === 2);
                
                const elem = this.createTileElement(tile, {
                    horizontal,
                    showBack,
                    small: true
                });
                meldDiv.appendChild(elem);
            });

            container.appendChild(meldDiv);
        });
    },

    /**
     * 渲染弃牌
     */
    renderDiscards(container, discards, lastDiscard = null) {
        container.innerHTML = '';

        discards.forEach((tile, index) => {
            const isLast = lastDiscard && tile.id === lastDiscard.id;
            const elem = this.createTileElement(tile, {
                small: true,
                className: isLast ? 'last-discard' : ''
            });
            container.appendChild(elem);
        });
    },

    /**
     * 渲染花牌
     */
    renderFlowers(container, flowers) {
        container.innerHTML = '';

        flowers.forEach(tile => {
            const elem = this.createTileElement(tile, { small: true });
            container.appendChild(elem);
        });
    },

    /**
     * 渲染对手手牌（背面）
     */
    renderOpponentHand(container, tileCount) {
        container.innerHTML = '';

        for (let i = 0; i < tileCount; i++) {
            const elem = this.createTileElement(null, {
                showBack: true,
                small: true
            });
            container.appendChild(elem);
        }
    },

    /**
     * 创建吃牌选项
     */
    createChowOptions(container, options, onSelect) {
        container.innerHTML = '';

        options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'chow-option';

            option.forEach(value => {
                // 这里需要根据吃的牌的类型创建临时牌对象
                const tile = { type: 'temp', value };
                const elem = this.createTileElement(tile);
                optionDiv.appendChild(elem);
            });

            optionDiv.addEventListener('click', () => onSelect(option, index));
            container.appendChild(optionDiv);
        });
    },

    /**
     * 高亮显示牌
     */
    highlightTile(container, tileId) {
        container.querySelectorAll('.tile').forEach(elem => {
            elem.classList.toggle('highlighted', elem.dataset.tileId === tileId);
        });
    },

    /**
     * 添加动画效果
     */
    animateTile(element, animationType) {
        element.classList.add(`tile-${animationType}`);
        element.addEventListener('animationend', () => {
            element.classList.remove(`tile-${animationType}`);
        }, { once: true });
    }
};

window.TileRenderer = TileRenderer;
