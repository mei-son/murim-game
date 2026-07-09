import * as state from './state.js';
import * as martial from './martial.js';
import * as intel from './intel.js';
import * as hero from './hero.js';
import * as enlightenment from './enlightenment.js';
import * as quests from './quests.js';
import * as inventory from './inventory.js';

export const NAMED_FACTION = {
    RIGHTEOUS: '정파',
    DEMONIC: '사파',
};

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

/** 정보 수집 시 적 출현 확률 (1% 미만) */
export const GATHER_ENEMY_CHANCE = 0.008;
/** 정보 수집 적 조우 중 네임드 확률 */
export const GATHER_NAMED_CHANCE = 0.03;
/** 일반 전투 승리 시 아이템 */
export const NORMAL_ITEM_DROP_CHANCE = 0.08;
/** 산적·도적 처치 시 하급 무기 드롭 */
export const BANDIT_WEAPON_DROP_CHANCE = 0.26;
const BANDIT_WEAPON_POOL = [
    { id: '낡은단도', weight: 5 },
    { id: '쇠봉', weight: 4 },
    { id: '철검', weight: 2 },
];
/** 네임드 전투 승리 시 아이템 */
export const NAMED_ITEM_DROP_CHANCE = 0.28;

export { ITEMS } from './inventory.js';

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
        faction: NAMED_FACTION.DEMONIC,
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
        faction: NAMED_FACTION.DEMONIC,
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
        faction: NAMED_FACTION.RIGHTEOUS,
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
        faction: NAMED_FACTION.DEMONIC,
        defeatFlag: 'defeatedDoksaGungju',
    },
];

function tryRollQuestOffer(gs, openness, successRate) {
    const pool = intel.getAvailablePaidQuests(gs);
    if (!pool.length) return null;
    const chance = (0.65 - openness) * 0.45;
    if (Math.random() >= chance) return null;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    const goldCost = Math.floor(12 + (1 - openness) * 38);
    return { type: 'quest_offer', entry, goldCost, openness, successRate };
}

const INTEL_FAIL_MSGS = [
    '여기저기 물어봤지만 새로운 소식을 얻지 못했다.',
    '주막은 시끄럽지만 자네에게 도움이 될 만한 말은 없었다.',
    '정보상들이 입을 닫고 있다. 더 이상 물을 곳이 없다.',
    '같은 소문만 반복된다. 유의미한 정보는 없었다.',
];

export function pickTravelEnemy(travelDays, fame) {
    const pool = [
        { name: '산적', hp: 40, atk: 10, def: 4 },
        { name: '맹수', hp: 34, atk: 12, def: 3 },
        { name: '강호 도적', hp: 48, atk: 11, def: 5 },
    ];
    const e = { ...pool[Math.floor(Math.random() * pool.length)] };
    e.maxHp = e.hp;
    const profile = isBanditOrThief(e) ? 'bandit' : 'bandit';
    return scaleEnemyForBattle(e, state.gameState, { profile });
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
    const gs = state.gameState;
    let level;
    let scale;
    if (gs.level < EARLY_DIFFICULTY_MAX_LEVEL) {
        level = gs.level + 3 + Math.floor(Math.random() * 3);
        scale = 1 + (level - gs.level) * 0.14;
    } else {
        const estimated = estimateEnemyLevel({ ...raw, named: true, hp: raw.hp }, gs.level);
        level = Math.max(gs.level + 6, estimated + 5);
        scale = 1 + (level - gs.level) * 0.11;
    }
    const hp = Math.floor(raw.hp * scale);
    const atk = Math.floor(raw.atk * scale);
    const def = Math.floor(raw.def * scale);
    return scaleNamedEnemy({
        ...raw,
        hp,
        maxHp: hp,
        atk,
        def,
        level,
        named: true,
        faction: raw.faction || NAMED_FACTION.DEMONIC,
        displayName: `${raw.name} (${raw.title})`,
    }, gs);
}

export function getNamedLevelGap(gs, enemy) {
    const enemyLv = enemy.level || estimateEnemyLevel(enemy, gs.level);
    return enemyLv - gs.level;
}

export function pickRandomKiyeonArt(gs = state.gameState) {
    const learned = new Set((gs.martialArts?.learned || []).map(a => a.id));
    const pool = Object.values(martial.MARTIAL_CATALOG)
        .filter(a => a.learnable === 'kiyeon' && !learned.has(a.id));
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)].id;
}

export function resolveNamedPeacefully(enemy, gs = state.gameState) {
    const expGain = 18 + (enemy.level || gs.level) * 6;
    state.gainExp(expGain);
    const enlight = enlightenment.forceEnlightenment('spar');
    let manualNote = '';
    if (Math.random() < 0.38) {
        const artId = pickRandomKiyeonArt(gs);
        if (artId && martial.learnMartialArt(artId)) {
            manualNote = ` · ${martial.MARTIAL_CATALOG[artId].name} 무공서 전수`;
        }
    }
    state.applyHyeophaengChange(3);
    return { expGain, enlight, manualNote };
}

/** 성향이 네임드 진영과 정면으로 대립하는지 */
export function isDispositionOppositeToNamed(gs, enemy) {
    const disp = hero.getDisposition(gs);
    if (disp.short === '중') return false;
    const faction = enemy.faction || NAMED_FACTION.DEMONIC;
    if (faction === NAMED_FACTION.RIGHTEOUS && disp.short === '사') return true;
    if (faction === NAMED_FACTION.DEMONIC && disp.short === '정') return true;
    return false;
}

/** 중립·동진영이면 선택, 반대 성향이면 강제 전투 */
export function shouldForceNamedBattle(gs, enemy) {
    return isDispositionOppositeToNamed(gs, enemy);
}

export function getForcedNamedBattleMessage(gs, enemy) {
    const disp = hero.getDisposition(gs);
    const faction = enemy.faction || NAMED_FACTION.DEMONIC;
    if (faction === NAMED_FACTION.RIGHTEOUS) {
        return `${enemy.name}이 당신의 ${disp.label} 기색을 보고 말없이 검을 뽑아든다!`;
    }
    return `${enemy.name}이 사악한 ${disp.label} 기운을 느끼고 선제공격을 감행한다!`;
}

export function applyNamedSparRewards(enemy, opts = {}) {
    const gs = state.gameState;
    const fameGain = Math.max(1, Math.floor((enemy.fameReward || 10) / 3));
    const exp = calcBattleExp(Math.floor((enemy.expReward || 30) * 0.45), opts.manual);
    state.gainExp(exp.total);
    state.modifyStats({ fame: gs.fame + fameGain });
    state.applyHyeophaengChange(2);
    let naegongResult = null;
    const ngGain = Math.floor(calcNaegongExpGain(enemy, opts) * 0.5);
    if (ngGain > 0) naegongResult = state.gainNaegongExp(ngGain);
    return {
        fameGain,
        expGain: exp.total,
        expBonus: 0,
        goldGain: 0,
        item: null,
        manual: opts.manual,
        spar: true,
        naegongExpGain: naegongResult?.gained ?? ngGain,
        naegongResult,
    };
}

export function pickGatherEnemy() {
    const pool = [
        { name: '산적', hp: 42, atk: 10, def: 4 },
        { name: '사파 맹사', hp: 52, atk: 13, def: 5 },
        { name: '첩자', hp: 48, atk: 14, def: 5 },
    ];
    const e = { ...pool[Math.floor(Math.random() * pool.length)] };
    e.maxHp = e.hp;
    const profile = isBanditOrThief(e) ? 'bandit' : 'normal';
    return scaleEnemyForBattle(e, state.gameState, { profile });
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

export function isBanditOrThief(enemy) {
    const name = enemy?.name || enemy || '';
    return /산적|도적|도둑/.test(name);
}

function getOwnedGearIds(gs = state.gameState) {
    inventory.initInventory(gs);
    const ids = new Set((gs.inventory || []).map(i => i.id));
    for (const id of Object.values(gs.equipped || {})) {
        if (id) ids.add(id);
    }
    return ids;
}

function pickWeightedBanditWeapon(gs = state.gameState) {
    const owned = getOwnedGearIds(gs);
    const pool = BANDIT_WEAPON_POOL.filter(w => !owned.has(w.id));
    if (!pool.length) return null;
    const total = pool.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * total;
    for (const entry of pool) {
        roll -= entry.weight;
        if (roll <= 0) return inventory.getItemDef(entry.id);
    }
    return inventory.getItemDef(pool[pool.length - 1].id);
}

export function rollBanditWeaponDrop(enemy, gs = state.gameState) {
    if (!isBanditOrThief(enemy)) return null;
    if (Math.random() >= BANDIT_WEAPON_DROP_CHANCE) return null;
    return pickWeightedBanditWeapon(gs);
}

export function rollItemDrop(isNamed, itemPool = null, enemy = null) {
    const chance = isNamed ? NAMED_ITEM_DROP_CHANCE : NORMAL_ITEM_DROP_CHANCE;
    if (Math.random() >= chance) return null;
    if (itemPool?.length) {
        const id = itemPool[Math.floor(Math.random() * itemPool.length)];
        return inventory.getItemDef(id);
    }
    const generic = ['영초', '내공단', '무림첩'];
    const id = generic[Math.floor(Math.random() * generic.length)];
    return inventory.getItemDef(id);
}

export function addItem(itemId) {
    const ok = inventory.addToBag(itemId);
    if (ok) {
        const item = inventory.getItemDef(itemId);
        if (item?.type === 'gear') {
            state.addLog(`🎒 ${item.icon} ${item.name} 획득 — 인벤토리에서 장착할 수 있다`);
        }
    }
    return ok;
}

export function applyGearBonuses() {
    inventory.applyGearBonuses();
}

export function equipItem(itemId) {
    return inventory.equipItem(itemId);
}

export function unequipItem(slot) {
    return inventory.unequipItem(slot);
}

export function useItem(itemId) {
    return inventory.useConsumable(itemId);
}

/** 수동 전투 시 기본 경험치 대비 추가 비율 */
export const MANUAL_BATTLE_EXP_BONUS = 0.5;
/** 이 레벨 미만까지 일반 적을 주인공 수준으로 끌어올림 */
export const EARLY_DIFFICULTY_MAX_LEVEL = 20;

function randBetween(min, max) {
    return min + Math.random() * (max - min);
}

function inferEnemyProfile(enemy, context) {
    if (enemy?.named) return 'named';
    if (context === 'spar' || enemy?.sparScaled) return 'spar';
    if (isBanditOrThief(enemy) || /맹수/.test(enemy?.name || '')) return 'bandit';
    return 'normal';
}

/** 산적·도적 — 약간 약함 / 비슷 / 약간 강함 */
export function scaleBanditEnemy(enemy, gs = state.gameState) {
    const roll = Math.random();
    let hpMult;
    let atkMult;
    let defMult;
    let levelOffset;

    if (roll < 0.34) {
        hpMult = randBetween(0.80, 0.94);
        atkMult = randBetween(0.82, 0.95);
        defMult = randBetween(0.84, 0.96);
        levelOffset = Math.random() < 0.55 ? -1 : 0;
    } else if (roll < 0.67) {
        hpMult = randBetween(0.94, 1.06);
        atkMult = randBetween(0.93, 1.05);
        defMult = randBetween(0.92, 1.04);
        levelOffset = 0;
    } else {
        hpMult = randBetween(1.05, 1.15);
        atkMult = randBetween(1.04, 1.14);
        defMult = randBetween(1.02, 1.10);
        levelOffset = 1;
    }

    const hp = Math.max(8, Math.floor(gs.maxHp * hpMult));
    const atk = Math.max(4, Math.floor(gs.atk * atkMult));
    const def = Math.max(1, Math.floor(gs.def * defMult));
    const level = Math.max(1, gs.level + levelOffset);

    return {
        ...enemy,
        hp,
        maxHp: hp,
        atk,
        def,
        level,
    };
}

/** 네임드 — 플레이어보다 확실히 강함 */
export function scaleNamedEnemy(enemy, gs = state.gameState) {
    const gap = Math.max(3, (enemy.level || gs.level + 4) - gs.level);
    const hp = Math.max(enemy.hp || 0, Math.floor(gs.maxHp * (1.22 + gap * 0.1)));
    const atk = Math.max(enemy.atk || 0, Math.floor(gs.atk * (1.14 + gap * 0.09)));
    const def = Math.max(enemy.def || 0, Math.floor(gs.def * (1.08 + gap * 0.06)));
    const level = Math.max(enemy.level || 0, gs.level + gap);

    return {
        ...enemy,
        hp,
        maxHp: hp,
        atk,
        def,
        level,
        named: true,
    };
}

/**
 * 문파 대련 상대 — 레벨·대련 횟수에 따라 점점 강한 고수 등장
 */
export function buildSectSparEnemy(sect, sectId, gs = state.gameState, opts = {}) {
    const base = { ...sect.sparEnemy };
    const tierStep = sect.tier === '본문' ? 2 : sect.tier === '분파' ? 1 : 0;
    const cycleCount = opts.cycleCount || 0;
    const lifetime = opts.lifetimeCount || 0;
    const progression = Math.min(
        9,
        tierStep + cycleCount + Math.floor(lifetime / 2) + Math.floor(gs.level / 4),
    );
    const level = gs.level + progression;
    const statScale = 1 + progression * 0.09;

    const hp = Math.floor(gs.maxHp * statScale * randBetween(0.98, 1.06));
    const atk = Math.floor(gs.atk * statScale * randBetween(0.96, 1.05));
    const def = Math.floor(gs.def * statScale * randBetween(0.94, 1.04));

    const familyMatch = sect.familyName || sect.name.match(/^(.+?파)/)?.[1] || sect.name.split(' ')[0];
    let name = base.name;
    if (progression >= 7) name = `${familyMatch} 직계제자`;
    else if (progression >= 5) name = `${familyMatch} 검객`;
    else if (progression >= 3) name = `${familyMatch} 고수`;
    else if (progression >= 1) name = `${familyMatch} ${base.name.replace(/^.*\s/, '')}`;

    return {
        ...base,
        name,
        hp,
        maxHp: hp,
        atk,
        def,
        level,
        sparScaled: true,
        faction: sect.faction,
    };
}

/**
 * Lv.20 미만 일반 적 — 동등~약간 강함
 */
export function applyEarlyDifficulty(enemy, gs = state.gameState) {
    if (!enemy || enemy.named || enemy.sparScaled || gs.level >= EARLY_DIFFICULTY_MAX_LEVEL) return enemy;

    const targetHp = Math.floor(gs.maxHp * randBetween(1.02, 1.14));
    const targetAtk = Math.floor(gs.atk * randBetween(1.0, 1.12));
    const targetDef = Math.max(1, Math.floor(gs.def * randBetween(0.96, 1.08)));

    const curHp = enemy.maxHp || enemy.hp || 0;
    const hp = Math.max(curHp, targetHp);
    const atk = Math.max(enemy.atk || 0, targetAtk);
    const def = Math.max(enemy.def || 0, targetDef);
    const levelBump = Math.random() < 0.5 ? 0 : 1;
    const level = Math.max(enemy.level || 0, gs.level + levelBump);

    return {
        ...enemy,
        hp,
        maxHp: hp,
        atk,
        def,
        level,
    };
}

/** 전투 시작 시 적 유형별 스케일 */
export function scaleEnemyForBattle(enemy, gs = state.gameState, opts = {}) {
    if (!enemy) return enemy;
    const profile = opts.profile || inferEnemyProfile(enemy, opts.context);

    switch (profile) {
        case 'named':
            return scaleNamedEnemy(enemy, gs);
        case 'bandit':
            return scaleBanditEnemy(enemy, gs);
        case 'spar':
            return enemy;
        case 'normal':
        default:
            return applyEarlyDifficulty(enemy, gs);
    }
}

/** 상대 체력·공격력으로 추정 레벨 */
export function estimateEnemyLevel(enemy, playerLevel = state.gameState.level) {
    if (enemy.level) return enemy.level;
    if (enemy.named) {
        return Math.max(10, Math.floor((enemy.hp + enemy.atk * 4 + enemy.def * 2) / 18));
    }
    const hp = enemy.maxHp || enemy.hp;
    return Math.max(1, Math.min(playerLevel + 6, Math.floor(hp / 12 + enemy.atk / 3)));
}

/** 전투 승리 시 내공 경험치 — 상대 레벨·네임드 반영 */
export function calcNaegongExpGain(enemy, opts = {}) {
    const gs = state.gameState;
    if (!gs.naegongUnlocked) return 0;

    const playerLv = gs.level;
    const enemyLv = estimateEnemyLevel(enemy, playerLv);
    let base = Math.max(4, Math.floor(enemyLv * 2.5));

    if (enemy.named) {
        base += enemy.naegongExpReward ?? Math.floor((enemy.fameReward || 10) * 1.2);
    }

    const diff = enemyLv - playerLv;
    if (diff > 0) base += diff * 2;
    if (diff < -3) base = Math.max(2, base + diff);

    if (opts.manual) base = Math.floor(base * 1.25);
    return Math.max(1, base);
}

function applyNaegongVictoryExp(enemy, opts = {}) {
    const gain = calcNaegongExpGain(enemy, opts);
    if (!gain) return null;
    return state.gainNaegongExp(gain);
}

export function calcBattleExp(baseExp, manual = false) {
    const base = Math.max(1, Math.floor(baseExp));
    const bonus = manual ? Math.max(1, Math.floor(base * MANUAL_BATTLE_EXP_BONUS)) : 0;
    return { base, bonus, total: base + bonus };
}

export function applyNamedVictoryRewards(enemy, opts = {}) {
    const gs = state.gameState;
    const fameGain = enemy.fameReward || 10;
    const goldGain = enemy.goldReward || 30;
    const exp = calcBattleExp(enemy.expReward || 30, opts.manual);
    state.gainExp(exp.total);
    state.modifyStats({
        fame: gs.fame + fameGain,
        gold: gs.gold + goldGain,
    });
    if (enemy.defeatFlag) gs[enemy.defeatFlag] = true;
    if (!gs.defeatedNamed) gs.defeatedNamed = [];
    if (!gs.defeatedNamed.includes(enemy.id)) gs.defeatedNamed.push(enemy.id);

    const item = rollItemDrop(true, enemy.itemPool);
    if (item) addItem(item.id);

    const naegongResult = applyNaegongVictoryExp(enemy, opts);
    const martialResult = martial.applyMartialVictoryExp(enemy, opts);
    quests.onEnemyDefeated(enemy, gs);

    return {
        fameGain,
        expGain: exp.total,
        expBonus: exp.bonus,
        goldGain,
        item,
        manual: opts.manual,
        naegongExpGain: naegongResult?.gained ?? 0,
        naegongResult,
        martialExpGain: martialResult.gain,
        martialLevelUps: martialResult.levelUps,
    };
}

export function applyNormalVictoryRewards(enemy, opts = {}) {
    const exp = calcBattleExp((enemy.maxHp || enemy.hp) / 5, opts.manual);
    state.gainExp(exp.total);
    state.modifyStats({
        fame: state.gameState.fame + 1,
        gold: state.gameState.gold + 5,
    });
    let item = rollBanditWeaponDrop(enemy);
    if (!item) item = rollItemDrop(false, null, enemy);
    if (item) addItem(item.id);
    const naegongResult = applyNaegongVictoryExp(enemy, opts);
    const martialResult = martial.applyMartialVictoryExp(enemy, opts);
    quests.onEnemyDefeated(enemy, state.gameState);
    return {
        fameGain: 1,
        expGain: exp.total,
        expBonus: exp.bonus,
        goldGain: 5,
        item,
        manual: opts.manual,
        naegongExpGain: naegongResult?.gained ?? 0,
        naegongResult,
        martialExpGain: martialResult.gain,
        martialLevelUps: martialResult.levelUps,
    };
}

/** 정보 수집 시도 — { type: 'intel'|'fail'|'battle'|'named', ... } */
export function rollGatherIntel() {
    const gs = state.gameState;
    intel.initIntel(gs);
    gs.day += 1;
    import('./sects.js').then(s => s.onDayAdvanced(gs, 'intel'));
    gs.intelGatherAttempts += 1;

    const successRate = intel.getIntelSuccessRate(gs);

    if (Math.random() < GATHER_ENEMY_CHANCE) {
        if (Math.random() < GATHER_NAMED_CHANCE) {
            const named = pickNamedEnemy(gs.currentArea);
            if (named) return { type: 'named', enemy: named, successRate };
        }
        return { type: 'battle', enemy: pickGatherEnemy(), successRate };
    }

    const openness = intel.getIntelOpennessRatio(gs);
    if (openness < 0.65) {
        const questOffer = tryRollQuestOffer(gs, openness, successRate);
        if (questOffer) return questOffer;
    }

    if (!intel.canGatherMoreIntel(gs)) {
        return {
            type: 'fail',
            text: '이 거점에서 들을 수 있는 소식은 이미 고갈되었다. 다른 곳으로 옮겨 보자.',
            successRate,
        };
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