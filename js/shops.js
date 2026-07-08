import * as state from './state.js';
import * as ui from './ui.js';
import * as encounters from './encounters.js';
import { SHOPS, SHOP_STOCK } from './places.js';

export function buyFromShop(shopId, itemIndex) {
    const stock = SHOP_STOCK[shopId];
    if (!stock || !stock[itemIndex]) return;
    const item = stock[itemIndex];
    const gs = state.gameState;

    if (gs.gold < item.gold) {
        state.addLog('은전이 부족하다.');
        ui.updateAllUI();
        return;
    }

    state.modifyStats({ gold: gs.gold - item.gold });

    if (item.item) {
        if (encounters.addItem(item.item)) {
            state.addLog(`${SHOPS[shopId]?.icon || '🏪'} ${item.item} 구입 (${item.gold}냥)`);
        } else {
            state.modifyStats({ gold: gs.gold + item.gold });
            state.addLog('이미 갖고 있는 장비다.');
        }
    } else if (item.intel) {
        state.addLog('주막에서 강호 소문을 들었다. (정보 수집과 비슷)');
        state.modifyStats({ fame: gs.fame + 1 });
    } else {
        const changes = {};
        if (item.hp) changes.hp = Math.min(gs.maxHp, gs.hp + item.hp);
        if (item.naegong) changes.naegong = Math.min(gs.maxNaegong, gs.naegong + item.naegong);
        if (item.atk) {
            changes.atk = gs.atk + item.atk;
            if (gs._baseStats) gs._baseStats.atk += item.atk;
        }
        if (item.exp) state.gainExp(item.exp);
        if (item.fame !== undefined) changes.fame = gs.fame + item.fame;
        state.modifyStats(changes);
        state.addLog(`${item.icon || '📦'} ${item.name} 구입 (${item.gold}냥)`);
    }

    ui.updateAllUI();
}

export function getShopInfo(shopId) {
    return SHOPS[shopId] || { name: shopId, icon: '🏪', desc: '' };
}