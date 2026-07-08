import { NAEGONG_UNLOCK_LEVEL, getRealm } from './realm.js';

export let gameState = {
    fame: 0,
    notoriety: 0,
    chivalry: 0,
    hp: 120,
    maxHp: 120,
    naegong: 0,
    maxNaegong: 0,
    naegongUnlocked: false,
    atk: 18,
    def: 12,
    level: 1,
    exp: 0,
    gold: 50,
    day: 1,
    currentRegion: '사천',
    currentArea: '촉남촌',
    currentLocation: '촉남촌',
    mapView: 'region',
    viewRegion: '사천',
    visitedRegions: ['사천'],
    visitedAreas: ['촉남촌'],
    visitedLocations: ['촉남촌'],
    heardCriminalRumor: false,
    savedWanderer: false,
    defeatedBandit: false,
    eventLog: [],
    currentEvent: null,
    autoBattle: true,
    inventory: [],
    defeatedNamed: [],
    defeatedHeukSaryong: false,
    defeatedHyeolmaGeom: false,
    defeatedCheongpung: false,
    defeatedDoksaGungju: false,
    sectAffinity: {},
    sectStanding: null,
    placeUI: null,
    hero: {
        name: '',
        alias: '',
        subtitle: '복면을 쓴 행인',
        masked: true,
    },
    enlightenment: {
        counts: { battle: 0, spar: 0, dojo: 0, gather: 0 },
        total: 0,
    },
    intelJournal: [],
    intelGatherAttempts: 0,
    martialArts: {
        learned: [
            { id: 'samjae_sword', level: 1, exp: 0 },
            { id: 'ohaeng_step', level: 1, exp: 0 },
        ],
    },
    evasion: 7,
};

export function toggleAutoBattle() {
    gameState.autoBattle = !gameState.autoBattle;
}

export const locations = [
    { id: '촉남촌', icon: '🏘️', desc: '사천 성도부 근교의 작은 촌락. 협객의 여정이 시작되는 곳.' },
    { id: '성도부', icon: '🏯', desc: '촉중 제일의 번화 도시. 강호 각가의 정보가 모인다.' },
    { id: '청성산', icon: '☯️', desc: '도가 명문 청성파가 있는 명산.' },
    { id: '검각관', icon: '⚠️', desc: '산적과 사파 무인이 출몰하는 험한 관문.' },
    { id: '峨嵋금정', icon: '🔔', desc: '峨嵋파 본산. 정파 여협의 성지.' },
];

/**
 * 협의 변동 — 양립불가
 * 협의↑ → 명성↑ / 협의↓ → 악명↑ (동시에 오르지 않음)
 */
export function applyChivalryChange(delta) {
    if (!delta) return;
    const gs = gameState;
    if (delta > 0) {
        gs.chivalry += delta;
        gs.fame += delta;
    } else {
        const loss = Math.abs(delta);
        gs.chivalry = Math.max(0, gs.chivalry - loss);
        gs.notoriety += loss;
    }
}

function applyReputationChanges(changes) {
    const gs = gameState;
    let chivalryDelta = 0;

    if ('chivalry' in changes) {
        chivalryDelta += changes.chivalry - gs.chivalry;
        delete changes.chivalry;
    }
    if ('fame' in changes) {
        const fameDelta = changes.fame - gs.fame;
        if (fameDelta > 0) chivalryDelta += fameDelta;
        else gs.fame = Math.max(0, changes.fame);
        delete changes.fame;
    }
    if ('notoriety' in changes) {
        const ngDelta = changes.notoriety - gs.notoriety;
        if (ngDelta > 0) chivalryDelta -= ngDelta;
        else gs.notoriety = Math.max(0, changes.notoriety);
        delete changes.notoriety;
    }

    if (chivalryDelta > 0) applyChivalryChange(chivalryDelta);
    else if (chivalryDelta < 0) applyChivalryChange(chivalryDelta);
}

export function modifyStats(changes) {
    const rep = {};
    if ('chivalry' in changes) rep.chivalry = changes.chivalry;
    if ('fame' in changes) rep.fame = changes.fame;
    if ('notoriety' in changes) rep.notoriety = changes.notoriety;
    if (Object.keys(rep).length) {
        const rest = { ...changes };
        delete rest.chivalry;
        delete rest.fame;
        delete rest.notoriety;
        applyReputationChanges(rep);
        Object.assign(gameState, rest);
    } else {
        Object.assign(gameState, changes);
    }
    if (gameState.hp > gameState.maxHp) gameState.hp = gameState.maxHp;
    if (gameState.hp < 0) gameState.hp = 0;
    if (gameState.naegong > gameState.maxNaegong) gameState.naegong = gameState.maxNaegong;
    if (gameState.naegong < 0) gameState.naegong = 0;
}

export function visitLocation(id) {
    if (!gameState.visitedLocations.includes(id)) gameState.visitedLocations.push(id);
    if (!gameState.visitedAreas.includes(id)) gameState.visitedAreas.push(id);
}

export function visitRegion(id) {
    if (!gameState.visitedRegions.includes(id)) gameState.visitedRegions.push(id);
}

export function addLog(text) {
    gameState.eventLog.unshift(text);
    if (gameState.eventLog.length > 8) gameState.eventLog.pop();
}

export function advanceDays(days, destination) {
    if (days <= 0) return;
    gameState.day += days;
    addLog(`🚶 ${days}일 소요 — ${destination}(에) 도착 (제 ${gameState.day}일)`);
    if (days >= 3) {
        const fatigue = Math.floor(days / 3);
        modifyStats({ hp: gameState.hp - fatigue });
        if (fatigue > 0) addLog(`장거리 이동으로 체력 ${fatigue} 소모.`);
    }
}

export function formatDayLabel(days) {
    if (days <= 0) return '0일';
    if (days < 1) return '반일';
    return `${days}일`;
}

export function gainExp(amount) {
    gameState.exp += amount;
    while (gameState.exp >= gameState.level * 30) {
        gameState.exp -= gameState.level * 30;
        levelUp();
    }
}

export function checkNaegongUnlock() {
    const gs = gameState;
    if (gs.naegongUnlocked) return false;
    const unlockLevel = NAEGONG_UNLOCK_LEVEL;
    if (gs.level < unlockLevel) return false;
    gs.naegongUnlocked = true;
    gs.maxNaegong = 60;
    gs.naegong = 60;
    addLog(`🌀 삼류 중반의 경지에 이르러 단전이 열렸다! 내공을 다룰 수 있게 되었다. (Lv.${unlockLevel})`);
    return true;
}

export function levelUp() {
    const prevRealm = getRealmLabel(gameState.level);
    gameState.level += 1;
    gameState.maxHp += 20;
    gameState.hp = gameState.maxHp;
    if (gameState.naegongUnlocked) {
        gameState.maxNaegong += 15;
        gameState.naegong = gameState.maxNaegong;
    }
    gameState.atk += 4;
    gameState.def += 2;
    if (gameState._baseStats) {
        gameState._baseStats.atk += 4;
        gameState._baseStats.def += 2;
        gameState._baseStats.maxHp += 20;
    }
    const newRealm = getRealmLabel(gameState.level);
    if (newRealm !== prevRealm) {
        addLog(`🏔️ 경지 상승! 【${newRealm}】에 이르렀다.`);
    }
    checkNaegongUnlock();
    addLog(`🎉 레벨 ${gameState.level} 달성! 능력이 상승했다.`);
    queueMicrotask(() => {
        import('./sects.js').then(s => {
            s.checkSectStanding(gameState);
            s.tryFoundSect(gameState);
        });
    });
}

function getRealmLabel(level) {
    return getRealm(level).name;
}

export function getAlignment() {
    const { fame, notoriety } = gameState;
    if (notoriety > fame + 8) return { label: '사파', color: 'text-red-400' };
    if (fame > notoriety + 8) return { label: '정파', color: 'text-blue-400' };
    return { label: '방랑', color: 'text-zinc-300' };
}