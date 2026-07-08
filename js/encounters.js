import * as state from './state.js';
import * as martial from './martial.js';
import * as intel from './intel.js';

/** 이동 중 일반 랜덤 조우 — 매우 낮음 */
export function getTravelEncounterChance(fame, totalDays) {
    const base = 0.025 - fame * 0.002;
    const distBonus = Math.min(0.03, totalDays * 0.004);
    return Math.min(0.06, Math.max(0.01, base + distBonus));
}

/** 이동 중 네임드 조우 — 극히 낮음 */
export function getNamedEncounterChance(fame, totalDays) {
    const base = 0.006 + Math.min(0.008, totalDays * 0.001);
    const fameBonus = fame >= 5 ? 0.003 : 0;
    return Math.min(0.02, base + fameBonus);
}

/** 정보 수집 시 적 출현 확률 (높음) */
export const GATHER_ENEMY_CHANCE = 0.34;
/** 정보 수집 적 조우 중 네임드 확률 */
export const GATHER_NAMED_CHANCE = 0.06;
/** 일반 전투 승리 시 아이템 */
export const NORMAL_ITEM_DROP_CHANCE = 0.08;
/** 네임드 전투 승리 시 아이템 */
export const NAMED_ITEM_DROP_CHANCE = 0.28;

export const ITEMS = {
    '영초': { id: '영초', name: '영초', icon: '🌿', desc: '체력 30 회복 (소모품)', type: 'consumable', heal: 30 },
    '내공단': { id: '내공단', name: '내공단', icon: '💊', desc: '내공 25 회복 (소모품)', type: 'consumable', naegong: 25 },
    '청강검': { id: '청강검', name: '청강검', icon: '⚔️', desc: '공격력 +4', type: 'gear', atk: 4 },
    '호신갑': { id: '호신갑', name: '호신갑', icon: '🛡️', desc: '방어력 +3', type: 'gear', def: 3 },
    '혈마도': { id: '혈마도', name: '혈마도', icon: '🗡️', desc: '공격력 +6, 명성 획득 시 악명 +1', type: 'gear', atk: 6, cursed: true },
    '흑룡비늘': { id: '흑룡비늘', name: '흑룡 비늘', icon: '🐲', desc: '방어력 +5, 체력 +20', type: 'gear', def: 5, maxHp: 20 },
    '무림첩': { id: '무림첩', name: '무림첩', icon: '📜', desc: '강호 기연. 명성 +2 (소모품)', type: 'consumable', fame: 2 },
};

export const NAMED_ENEMIES = [
    {
        id: 'heuk_saryong',
        name: '흑사룡',
        title: '검각관의 마수',
        icon: '🐉',
        hp: 165, atk: 26, def: 12,
        fameReward: 18, expReward: 45, goldReward: 60,
        itemPool: ['흑룡비늘', '혈마도'],
        areas: ['검각관', '성도부'],
        defeatFlag: 'defeatedHeukSaryong',
    },
    {
        id: 'hyeolma_geom',
        name: '혈마검',
        title: '사파 검객',
        icon: '🩸',
        hp: 130, atk: 22, def: 9,
        fameReward: 12, expReward: 35, goldReward: 40,
        itemPool: ['혈마도', '청강검'],
        areas: null,
        defeatFlag: 'defeatedHyeolmaGeom',
    },
    {
        id: 'cheongpung',
        name: '청풍검',
        title: '유랑 검객',
        icon: '🌬️',
        hp: 110, atk: 20, def: 11,
        fameReward: 10, expReward: 30, goldReward: 35,
        itemPool: ['청강검', '무림첩'],
        areas: ['청성산', '촉남촌'],
        defeatFlag: 'defeatedCheongpung',
    },
    {
        id: 'doksa_gungju',
        name: '독사궁주',
        title: '운남 독문',
        icon: '🐍',
        hp: 140, atk: 24, def: 8,
        fameReward: 14, expReward: 38, goldReward: 45,
        itemPool: ['내공단', '호신갑'],
        areas: ['검각관'],
        defeatFlag: 'defeatedDoksaGungju',
    },
];

const INTEL_FAIL_MSGS = [
    '여기저기 물어봤지만 새로운 소식을 얻지 못했다.',
    '주막은 시끄럽지만 자네에게 도움이 될 만한 말은 없었다.',
    '정보상들이 입을 닫고 있다. 더 이상 물을 곳이 없다.',
    '같은 소문만 반복된다. 유의미한 정보는 없었다.',
];

export function pickTravelEnemy(travelDays, fame) {
    const scale = Math.max(1, Math.floor(travelDays / 3));
    const pool = [
        { name: '산적', hp: 40 + scale * 8, atk: 9 + scale * 2, def: 3 + scale },
        { name: '맹수', hp: 35 + scale * 6, atk: 13 + scale * 2, def: 2 },
        { name: '강호 도적', hp: 55 + scale * 10, atk: 12 + scale * 3, def: 5 + scale },
    ];
    const e = { ...pool[Math.floor(Math.random() * pool.length)] };
    e.maxHp = e.hp;
    return e;
}

export function pickNamedEnemy(area) {
    const gs = state.gameState;
    const pool = NAMED_ENEMIES.filter(n => {
        if (n.defeatFlag && gs[n.defeatFlag]) return false;
        if (!n.areas) return true;
        return n.areas.includes(area);
    });
    if (!pool.length) return null;
    const raw = pool[Math.floor(Math.random() * pool.length)];
    return buildNamedEnemy(raw);
}

export function buildNamedEnemy(raw) {
    return {
        ...raw,
        maxHp: raw.hp,
        named: true,
        displayName: `${raw.name} (${raw.title})`,
    };
}

export function pickGatherEnemy() {
    const scale = Math.max(1, Math.floor(state.gameState.level / 2));
    const pool = [
        { name: '산적', hp: 45 + scale * 10, atk: 10 + scale * 2, def: 4 + scale },
        { name: '사파 맹사', hp: 65 + scale * 12, atk: 14 + scale * 2, def: 6 + scale },
        { name: '첩자', hp: 55 + scale * 8, atk: 16 + scale * 2, def: 5 + scale },
    ];
    const e = { ...pool[Math.floor(Math.random() * pool.length)] };
    e.maxHp = e.hp;
    return e;
}

export function rollTravelEncounter(fame, totalDays, area) {
    if (Math.random() < getNamedEncounterChance(fame, totalDays)) {
        const named = pickNamedEnemy(area);
        if (named) return { type: 'named', enemy: named };
    }
    if (Math.random() < getTravelEncounterChance(fame, totalDays)) {
        return { type: 'normal', enemy: pickTravelEnemy(totalDays, fame) };
    }
    return null;
}

export function rollItemDrop(isNamed, itemPool = null) {
    const chance = isNamed ? NAMED_ITEM_DROP_CHANCE : NORMAL_ITEM_DROP_CHANCE;
    if (Math.random() >= chance) return null;
    if (itemPool?.length) {
        const id = itemPool[Math.floor(Math.random() * itemPool.length)];
        return ITEMS[id] ? { ...ITEMS[id] } : null;
    }
    const generic = ['영초', '내공단', '호신갑', '무림첩'];
    const id = generic[Math.floor(Math.random() * generic.length)];
    return { ...ITEMS[id] };
}

export function addItem(itemId) {
    const item = ITEMS[itemId];
    if (!item) return false;
    const gs = state.gameState;
    if (!gs.inventory) gs.inventory = [];
    const existing = gs.inventory.find(i => i.id === itemId && item.type === 'gear');
    if (existing && item.type === 'gear') return false;
    gs.inventory.push({ ...item });
    applyGearBonuses();
    return true;
}

export function applyGearBonuses() {
    martial.recalcCombatStats();
}

export function useItem(itemId) {
    const gs = state.gameState;
    const idx = (gs.inventory || []).findIndex(i => i.id === itemId);
    if (idx < 0) return false;
    const item = gs.inventory[idx];
    if (item.type !== 'consumable') return false;
    if (item.heal) state.modifyStats({ hp: Math.min(gs.maxHp, gs.hp + item.heal) });
    if (item.naegong) {
        if (!martial.isNaegongUnlocked(gs)) {
            state.addLog('아직 내공이 개통되지 않아 약효를 받을 수 없다.');
            return false;
        }
        state.modifyStats({ naegong: Math.min(gs.maxNaegong, gs.naegong + item.naegong) });
    }
    if (item.fame) state.modifyStats({ fame: gs.fame + item.fame, notoriety: item.cursed ? gs.notoriety + 1 : gs.notoriety });
    gs.inventory.splice(idx, 1);
    state.addLog(`${item.icon} ${item.name} 사용`);
    return true;
}

export function applyNamedVictoryRewards(enemy) {
    const gs = state.gameState;
    const fameGain = enemy.fameReward || 10;
    const expGain = enemy.expReward || 30;
    const goldGain = enemy.goldReward || 30;
    state.gainExp(expGain);
    state.modifyStats({
        fame: gs.fame + fameGain,
        gold: gs.gold + goldGain,
    });
    if (enemy.defeatFlag) gs[enemy.defeatFlag] = true;
    if (!gs.defeatedNamed) gs.defeatedNamed = [];
    if (!gs.defeatedNamed.includes(enemy.id)) gs.defeatedNamed.push(enemy.id);

    const item = rollItemDrop(true, enemy.itemPool);
    if (item) addItem(item.id);

    return { fameGain, expGain, goldGain, item };
}

export function applyNormalVictoryRewards(enemy) {
    const reward = Math.floor((enemy.maxHp || enemy.hp) / 5);
    state.gainExp(reward);
    state.modifyStats({
        fame: state.gameState.fame + 1,
        gold: state.gameState.gold + 5,
    });
    const item = rollItemDrop(false);
    if (item) addItem(item.id);
    return { fameGain: 1, expGain: reward, goldGain: 5, item };
}

/** 정보 수집 시도 — { type: 'intel'|'fail'|'battle'|'named', ... } */
export function rollGatherIntel() {
    const gs = state.gameState;
    intel.initIntel(gs);
    gs.day += 1;
    gs.intelGatherAttempts += 1;

    const successRate = intel.getIntelSuccessRate(gs);

    if (Math.random() < GATHER_ENEMY_CHANCE) {
        if (Math.random() < GATHER_NAMED_CHANCE) {
            const named = pickNamedEnemy(gs.currentArea);
            if (named) return { type: 'named', enemy: named, successRate };
        }
        return { type: 'battle', enemy: pickGatherEnemy(), successRate };
    }

    const pool = intel.getAvailableIntelPool(gs.currentArea, gs);
    if (!pool.length) {
        return {
            type: 'fail',
            text: '이 지역에서 알 만한 소식은 이미 다 들은 것 같다. 강호첩을 확인해 보자.',
            successRate,
        };
    }

    if (Math.random() > successRate) {
        const text = INTEL_FAIL_MSGS[Math.floor(Math.random() * INTEL_FAIL_MSGS.length)];
        return { type: 'fail', text, successRate };
    }

    const entry = pool[Math.floor(Math.random() * pool.length)];
    intel.addIntelEntry(entry, gs, gs.currentArea);
    const cat = intel.INTEL_CATEGORIES[entry.category];
    return {
        type: 'intel',
        entry,
        text: entry.text,
        title: entry.title,
        category: cat?.label || '정보',
        successRate,
        journalCount: gs.intelJournal.length,
    };
}