/**
 * 规则集定义
 * Rule Sets Definition
 */

const RuleSets = {
    /**
     * 中国国标麻将规则
     */
    chinese: {
        name: '中国麻将（国标）',
        description: '基于中国国家体育总局制定的国际麻将规则',
        
        // 基本设置
        settings: {
            initialScore: 0,
            minWinningScore: 8,  // 最低8番起胡
            maxPlayers: 4,
            includeFlowers: true,
            canChow: true,
            canPong: true,
            canKong: true,
            hasRiichi: false,
            hasDora: false
        },

        // 番种定义
        yaku: {
            // 88番
            dasixi: { name: '大四喜', fan: 88, description: '四种风牌各四张' },
            dasanyuan: { name: '大三元', fan: 88, description: '中发白各四张' },
            jiulianbaodeng: { name: '九莲宝灯', fan: 88, description: '同花色1112345678999' },
            sianke: { name: '四暗刻', fan: 88, description: '四组暗刻' },
            yisetongguan: { name: '一色同顺', fan: 88, description: '同花色四组相同顺子' },
            yisesibugao: { name: '一色四步高', fan: 88, description: '同花色四组递增顺子' },
            
            // 64番
            xiaosixi: { name: '小四喜', fan: 64, description: '三组风牌刻子加一对风牌雀头' },
            xiaosanyuan: { name: '小三元', fan: 64, description: '两组箭牌刻子加一对箭牌雀头' },
            ziyise: { name: '字一色', fan: 64, description: '全部由字牌组成' },
            sigang: { name: '四杠', fan: 64, description: '四组杠' },
            
            // 48番
            yisesantongshun: { name: '一色三同顺', fan: 48, description: '同花色三组相同顺子' },
            yisesanbugao: { name: '一色三步高', fan: 48, description: '同花色三组递增顺子' },
            
            // 32番
            hunlao: { name: '混幺九', fan: 32, description: '由幺九牌和字牌组成' },
            sananke: { name: '三暗刻', fan: 32, description: '三组暗刻' },
            
            // 24番
            qidui: { name: '七对', fan: 24, description: '七组对子' },
            qingyise: { name: '清一色', fan: 24, description: '由同一花色组成' },
            yiseshuanglonghui: { name: '一色双龙会', fan: 24, description: '同花色两组147和369加5做雀头' },
            
            // 16番
            qinglong: { name: '清龙', fan: 16, description: '同花色123456789' },
            sangangu: { name: '三杠', fan: 16, description: '三组杠' },
            
            // 12番
            dayu5: { name: '大于5', fan: 12, description: '全由6789组成' },
            xiaoyu5: { name: '小于5', fan: 12, description: '全由1234组成' },
            
            // 8番
            hunyise: { name: '混一色', fan: 6, description: '由一种花色和字牌组成' },
            pengpenghu: { name: '碰碰和', fan: 6, description: '四组刻子加雀头' },
            
            // 4番
            quandaiyao: { name: '全带幺', fan: 4, description: '每组都含幺九牌' },
            shuanganke: { name: '双暗刻', fan: 4, description: '两组暗刻' },
            
            // 2番
            jianke: { name: '箭刻', fan: 2, description: '中发白任一刻子' },
            menqianqing: { name: '门前清', fan: 2, description: '没有吃碰杠' },
            pinghu: { name: '平和', fan: 2, description: '四组顺子加数牌雀头' },
            
            // 1番
            yibangao: { name: '一般高', fan: 1, description: '同花色两组相同顺子' },
            lianliu: { name: '连六', fan: 1, description: '同花色六张连续牌' },
            laoshao: { name: '老少副', fan: 1, description: '同花色123和789' },
            yaojiu: { name: '幺九刻', fan: 1, description: '幺九牌刻子' },
            mingang: { name: '明杠', fan: 1, description: '明杠' },
            zimo: { name: '自摸', fan: 1, description: '自摸和牌' },
            huapai: { name: '花牌', fan: 1, description: '每张花牌1番' }
        },

        /**
         * 计算番数
         */
        calculateScore(pattern, hand, winningTile, context) {
            let totalFan = 0;
            const yakuList = [];

            // 基础检查...
            // 这里应该实现详细的番种检测逻辑

            return {
                yaku: yakuList,
                fan: totalFan,
                score: totalFan >= 8 ? totalFan * 100 : 0 // 8番起胡
            };
        }
    },

    /**
     * 日本麻将（立直麻将）规则
     */
    japanese: {
        name: '日本麻将（立直）',
        description: '日本竞技麻将规则',
        
        settings: {
            initialScore: 25000,
            targetScore: 30000,
            maxPlayers: 4,
            includeFlowers: false,
            canChow: true,
            canPong: true,
            canKong: true,
            hasRiichi: true,
            hasDora: true,
            hasRedDora: true,
            hasUraDora: true
        },

        // 役种定义
        yaku: {
            // 役满 (13番)
            kokushimusou: { name: '国士無双', han: 13, yakuman: true, description: '十三种幺九牌各一张加一张重复' },
            suuankou: { name: '四暗刻', han: 13, yakuman: true, description: '四组暗刻' },
            daisangen: { name: '大三元', han: 13, yakuman: true, description: '三组箭牌刻子' },
            shousuushi: { name: '小四喜', han: 13, yakuman: true, description: '三组风牌刻子加一对风牌雀头' },
            daisuushi: { name: '大四喜', han: 26, yakuman: true, description: '四组风牌刻子' },
            tsuuiisou: { name: '字一色', han: 13, yakuman: true, description: '全部由字牌组成' },
            chinroutou: { name: '清老頭', han: 13, yakuman: true, description: '全部由幺九牌组成' },
            ryuuiisou: { name: '緑一色', han: 13, yakuman: true, description: '全部由23468条和发组成' },
            chuuren: { name: '九蓮宝燈', han: 13, yakuman: true, description: '同花色1112345678999' },
            suukantsu: { name: '四槓子', han: 13, yakuman: true, description: '四组杠' },
            tenhou: { name: '天和', han: 13, yakuman: true, description: '庄家第一巡自摸' },
            chiihou: { name: '地和', han: 13, yakuman: true, description: '闲家第一巡自摸' },

            // 6番
            chinitsu: { name: '清一色', han: 6, hanOpen: 5, description: '由同一花色组成' },

            // 3番
            ryanpeikou: { name: '二盃口', han: 3, closed: true, description: '两组一般高' },
            junchan: { name: '純全帯幺九', han: 3, hanOpen: 2, description: '每组都含幺九牌（不含字牌）' },
            honitsu: { name: '混一色', han: 3, hanOpen: 2, description: '由一种花色和字牌组成' },

            // 2番
            chiitoitsu: { name: '七対子', han: 2, closed: true, description: '七组对子' },
            toitoi: { name: '対々和', han: 2, description: '四组刻子' },
            sanankou: { name: '三暗刻', han: 2, description: '三组暗刻' },
            honroutou: { name: '混老頭', han: 2, description: '由幺九牌和字牌组成' },
            shousangen: { name: '小三元', han: 2, description: '两组箭牌刻子加一对箭牌雀头' },
            sankantsu: { name: '三槓子', han: 2, description: '三组杠' },
            sanshoku: { name: '三色同順', han: 2, hanOpen: 1, description: '三种花色同数字顺子' },
            sanshokudoukou: { name: '三色同刻', han: 2, description: '三种花色同数字刻子' },
            ittsu: { name: '一気通貫', han: 2, hanOpen: 1, description: '同花色123456789' },
            chanta: { name: '全帯幺九', han: 2, hanOpen: 1, description: '每组都含幺九牌或字牌' },
            daburi: { name: 'ダブル立直', han: 2, closed: true, description: '第一巡立直' },

            // 1番
            riichi: { name: '立直', han: 1, closed: true, description: '门清听牌后宣告立直' },
            ippatsu: { name: '一発', han: 1, closed: true, description: '立直后一巡内和牌' },
            tsumo: { name: '門前清自摸和', han: 1, closed: true, description: '门清自摸' },
            tanyao: { name: '断幺九', han: 1, description: '不含幺九牌和字牌' },
            pinfu: { name: '平和', han: 1, closed: true, description: '四组顺子、非役牌雀头、两面听' },
            iipeikou: { name: '一盃口', han: 1, closed: true, description: '同花色两组相同顺子' },
            yakuhai: { name: '役牌', han: 1, description: '场风、自风、三元牌刻子' },
            rinshan: { name: '嶺上開花', han: 1, description: '杠后从岭上摸牌和' },
            chankan: { name: '搶槓', han: 1, description: '抢杠和' },
            haitei: { name: '海底摸月', han: 1, description: '最后一张牌自摸' },
            houtei: { name: '河底撈魚', han: 1, description: '最后一张打牌荣和' },

            // 宝牌
            dora: { name: 'ドラ', han: 1, description: '宝牌' },
            uradora: { name: '裏ドラ', han: 1, closed: true, description: '里宝牌' },
            akadora: { name: '赤ドラ', han: 1, description: '红宝牌' }
        },

        /**
         * 计算符数
         */
        calculateFu(pattern, hand, winningTile, context) {
            let fu = 20; // 基础符

            // 和牌方式
            if (context.isSelfDraw && hand.isClosed()) {
                fu += 2; // 门清自摸
            } else if (!context.isSelfDraw) {
                fu += 10; // 荣和
            }

            // 刻子符数
            pattern.melds?.forEach(meld => {
                if (meld.type === 'pong' || meld.type === 'kong') {
                    const tile = meld.tiles[0];
                    let meldFu = 2;
                    
                    if (tile.isTerminalOrHonor && tile.isTerminalOrHonor()) {
                        meldFu = 4;
                    }
                    
                    if (meld.concealed) {
                        meldFu *= 2;
                    }
                    
                    if (meld.type === 'kong') {
                        meldFu *= 4;
                    }
                    
                    fu += meldFu;
                }
            });

            // 雀头符数
            if (pattern.pair) {
                // 役牌雀头+2符
            }

            // 听牌形式
            // 单骑、边张、嵌张+2符

            // 切上
            fu = Math.ceil(fu / 10) * 10;

            return fu;
        },

        /**
         * 计算点数
         */
        calculateScore(han, fu, context) {
            // 役满
            if (han >= 13) {
                return context.isDealer ? 48000 : 32000;
            }

            // 跳满以上
            if (han >= 11) return context.isDealer ? 36000 : 24000;
            if (han >= 8) return context.isDealer ? 24000 : 16000;
            if (han >= 6) return context.isDealer ? 18000 : 12000;
            if (han >= 5) return context.isDealer ? 12000 : 8000;

            // 基本点
            let basePoints = fu * Math.pow(2, han + 2);
            
            // 满贯封顶
            if (basePoints > 2000) {
                basePoints = 2000;
            }

            // 计算实际点数
            if (context.isSelfDraw) {
                if (context.isDealer) {
                    // 庄家自摸，每家付
                    return Math.ceil(basePoints * 2 / 100) * 100 * 3;
                } else {
                    // 闲家自摸
                    const dealerPay = Math.ceil(basePoints * 2 / 100) * 100;
                    const otherPay = Math.ceil(basePoints / 100) * 100;
                    return dealerPay + otherPay * 2;
                }
            } else {
                // 荣和
                if (context.isDealer) {
                    return Math.ceil(basePoints * 6 / 100) * 100;
                } else {
                    return Math.ceil(basePoints * 4 / 100) * 100;
                }
            }
        }
    }
};

module.exports = RuleSets;
