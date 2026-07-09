import * as state from './state.js';

function refreshCombatStats(gs) {
    import('./martial.js').then(m => m.recalcCombatStats(gs));
}

export const ITEM_GRADES = {
    common: { label: '하', color: 'text-zinc-400' },
    fine: { label: '중', color: 'text-blue-300' },
    rare: { label: '상', color: 'text-purple-300' },
    kiyeon: { label: '기연', color: 'text-amber-400' },
};

export const GEAR_SLOTS = {
    weapon: '무기',
    armor: '방어구',
};

/** 방어구는 등급이 높을수록 실전 보정이 줄어듦 */
const ARMOR_EFFECT_MULT = {
    common: 1,
    fine: 0.88,
    rare: 0.72,
    kiyeon: 0.55,
};

export const ITEMS = {
    '영초': { id: '영초', name: '영초', icon: '🌿', desc: '체력 30 회복', type: 'consumable', heal: 30 },
    '내공단': { id: '내공단', name: '내공단', icon: '💊', desc: '내공 25 회복', type: 'consumable', naegong: 25 },
    '무림첩': { id: '무림첩', name: '무림첩', icon: '📜', desc: '강호 기연. 명성 +2', type: 'consumable', fame: 2 },
    '낡은단도': {
        id: '낡은단도', name: '낡은 단도', icon: '🔪', desc: '공격력 +1',
        type: 'gear', slot: 'weapon', grade: 'common', atk: 1,
    },
    '철검': {
        id: '철검', name: '철검', icon: '🗡️', desc: '공격력 +2',
        type: 'gear', slot: 'weapon', grade: 'common', atk: 2,
    },
    '쇠봉': {
        id: '쇠봉', name: '쇠봉', icon: '🏏', desc: '공격력 +1',
        type: 'gear', slot: 'weapon', grade: 'common', atk: 1,
    },
    '청강검': {
        id: '청강검', name: '청강검', icon: '⚔️', desc: '공격력 +4',
        type: 'gear', slot: 'weapon', grade: 'fine', atk: 4,
    },
    '혈마도': {
        id: '혈마도', name: '혈마도', icon: '🗡️', desc: '공격력 +6 · 명성 획득 시 악명 +1',
        type: 'gear', slot: 'weapon', grade: 'rare', atk: 6, cursed: true,
    },
    '경갑': {
        id: '경갑', name: '경갑', icon: '🥋', desc: '가벼운 회피복 · 회피 +1',
        type: 'gear', slot: 'armor', grade: 'common', evasion: 1,
    },
    '비천의': {
        id: '비천의', name: '비천의', icon: '👘', desc: '경량 회피의 · 회피 +2',
        type: 'gear', slot: 'armor', grade: 'fine', evasion: 2,
    },
    '호신갑': {
        id: '호신갑', name: '호신갑', icon: '🛡️', desc: '기연 방갑 · 방어·회피 소폭 (고급일수록 체감 제한)',
        type: 'gear', slot: 'armor', grade: 'kiyeon', def: 3, evasion: 1,
    },
    '흑룡비늘': {
        id: '흑룡비늘', name: '흑룡 비늘', icon: '🐲', desc: '기연 비늘갑 · 방어·체력·회피 (실전 보정 제한)',
        type: 'gear', slot: 'armor', grade: 'kiyeon', def: 5, maxHp: 20, evasion: 2,
    },
};

export function initInventory(gs = state.gameState) {
    if (!gs.equipped) gs.equipped = { weapon: null, armor: null };
    if (!gs.inventory) gs.inventory = [];
    migrateLegacyInventory(gs);
}

function migrateLegacyInventory(gs) {
    if (gs._inventoryMigrated) return;
    const bag = [];
    for (const row of gs.inventory) {
        if (!row?.id) continue;
        const def = ITEMS[row.id];
        if (!def) continue;
        if (def.type === 'gear') {
            if (bag.some(i => i.id === row.id)) continue;
            bag.push({ ...def });
        } else {
            bag.push({ ...def });
        }
    }
    gs.inventory = bag;
    gs.equipped = { weapon: null, armor: null };
    gs._inventoryMigrated = true;
}

export function getItemDef(itemId) {
    return ITEMS[itemId] ? { ...ITEMS[itemId] } : null;
}

export function countBagItems(gs = state.gameState) {
    initInventory(gs);
    return (gs.inventory || []).length;
}

export function getEquippedItems(gs = state.gameState) {
    initInventory(gs);
    const out = [];
    for (const slot of Object.keys(GEAR_SLOTS)) {
        const id = gs.equipped[slot];
        if (!id) continue;
        const def = ITEMS[id];
        if (def) out.push({ ...def, _slot: slot });
    }
    return out;
}

function armorMult(grade) {
    return ARMOR_EFFECT_MULT[grade] ?? 0.7;
}

export function calcAppliedGearStat(item, stat) {
    const raw = item[stat] || 0;
    if (!raw) return 0;
    if (item.slot === 'armor') return Math.max(0, Math.floor(raw * armorMult(item.grade)));
    return raw;
}

export function getGearBonuses(gs = state.gameState) {
    initInventory(gs);
    let atk = 0, def = 0, evasion = 0, maxHp = 0;
    for (const item of getEquippedItems(gs)) {
        if (item.slot === 'weapon') {
            atk += item.atk || 0;
            continue;
        }
        if (item.slot === 'armor') {
            def += calcAppliedGearStat(item, 'def');
            evasion += calcAppliedGearStat(item, 'evasion');
            maxHp += calcAppliedGearStat(item, 'maxHp');
        }
    }
    return { atk, def, evasion, maxHp };
}

export function formatGearEffect(item) {
    if (!item || item.type !== 'gear') return item?.desc || '';
    const parts = [];
    if (item.slot === 'weapon' && item.atk) parts.push(`공격+${item.atk}`);
    if (item.slot === 'armor') {
        const def = calcAppliedGearStat(item, 'def');
        const eva = calcAppliedGearStat(item, 'evasion');
        const hp = calcAppliedGearStat(item, 'maxHp');
        if (def) parts.push(`방어+${def}`);
        if (eva) parts.push(`회피+${eva}`);
        if (hp) parts.push(`체력+${hp}`);
        if (item.grade === 'kiyeon' && (item.def || item.maxHp)) {
            parts.push('(실전 보정)');
        }
    }
    return parts.length ? parts.join(' · ') : item.desc;
}

export function formatGradeBadge(grade) {
    const g = ITEM_GRADES[grade];
    if (!g) return '';
    return `<span class="text-[0.65rem] ${g.color} font-bold">[${g.label}]</span>`;
}

export function addToBag(itemId, gs = state.gameState) {
    const item = ITEMS[itemId];
    if (!item) return false;
    initInventory(gs);
    if (item.type === 'gear') {
        const inBag = gs.inventory.some(i => i.id === itemId);
        const equipped = Object.values(gs.equipped).includes(itemId);
        if (inBag || equipped) return false;
    }
    gs.inventory.push({ ...item });
    return true;
}

export function removeFromBag(itemId, gs = state.gameState) {
    initInventory(gs);
    const idx = gs.inventory.findIndex(i => i.id === itemId);
    if (idx < 0) return false;
    gs.inventory.splice(idx, 1);
    return true;
}

export function equipItem(itemId, gs = state.gameState) {
    const item = ITEMS[itemId];
    if (!item || item.type !== 'gear' || !item.slot) return false;
    initInventory(gs);
    const idx = gs.inventory.findIndex(i => i.id === itemId);
    if (idx < 0) return false;

    const slot = item.slot;
    const prevId = gs.equipped[slot];
    if (prevId) {
        const prev = ITEMS[prevId];
        if (prev) gs.inventory.push({ ...prev });
    }

    gs.equipped[slot] = itemId;
    gs.inventory.splice(idx, 1);
    refreshCombatStats(gs);
    state.addLog(`🎒 ${item.icon} ${item.name} 장착 (${GEAR_SLOTS[slot]})`);
    return true;
}

export function unequipItem(slot, gs = state.gameState) {
    initInventory(gs);
    const itemId = gs.equipped[slot];
    if (!itemId) return false;
    const item = ITEMS[itemId];
    if (!item) {
        gs.equipped[slot] = null;
        refreshCombatStats(gs);
        return false;
    }
    gs.equipped[slot] = null;
    gs.inventory.push({ ...item });
    refreshCombatStats(gs);
    state.addLog(`🎒 ${item.name} 해제`);
    return true;
}

export function useConsumable(itemId, gs = state.gameState) {
    initInventory(gs);
    const idx = gs.inventory.findIndex(i => i.id === itemId);
    if (idx < 0) return false;
    const item = gs.inventory[idx];
    if (item.type !== 'consumable') return false;

    if (item.heal) state.modifyStats({ hp: Math.min(gs.maxHp, gs.hp + item.heal) });
    if (item.naegong) {
        if (!gs.naegongUnlocked) {
            state.addLog('아직 내공이 개통되지 않아 약효를 받을 수 없다.');
            return false;
        }
        state.modifyStats({ naegong: Math.min(gs.maxNaegong, gs.naegong + item.naegong) });
    }
    if (item.fame) {
        state.modifyStats({
            fame: gs.fame + item.fame,
            notoriety: item.cursed ? gs.notoriety + 1 : gs.notoriety,
        });
    }
    gs.inventory.splice(idx, 1);
    state.addLog(`${item.icon} ${item.name} 사용`);
    return true;
}

export function applyGearBonuses(gs = state.gameState) {
    refreshCombatStats(gs);
}