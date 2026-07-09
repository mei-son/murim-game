import { NAEGONG_UNLOCK_LEVEL, getRealm } from './realm.js';

/** 협행·악행 100당 명성·악명 1 */
export const REPUTATION_PER_POINT = 100;

export let gameState = {
    fame: 0,
    notoriety: 0,
    hyeophaeng: 0,
    aekhaeng: 0,
    hp: 120,
    maxHp: 120,
    stamina: 100,
    maxStamina: 100,
    naegong: 0,
    maxNaegong: 0,
    naegongUnlocked: false,
    naegongLevel: 1,
    naegongExp: 0,
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
    /** 탐색·정보 수집으로 파악한 정소 — 없으면 지도에 ❓ */
    discoveredSpots: ['촉남촌'],
    heardCriminalRumor: false,
    savedWanderer: false,
    defeatedBandit: false,
    eventLog: [],
    currentEvent: null,
    autoBattle: false,
    inventory: [],
    equipped: { weapon: null, armor: null },
    gearDurability: {},
    defeatedNamed: [],
    defeatedHeukSaryong: false,
    defeatedHyeolmaGeom: false,
    defeatedCheongpung: false,
    defeatedDoksaGungju: false,
    defeatedBanditChiefGeomgak: false,
    defeatedForestRogueChief: false,
    defeatedMountainBanditLord: false,
    /** 숲·산 조우 진행 { 'area:loc': { weakKills, normalKills, strongKills, encounters, cycleStartDay } } */
    wildernessThreat: {},
    sectAffinity: {},
    /** 문파별 일일 대련 횟수 { [sectId]: { day, count } } */
    sectSparLog: {},
    /** 문파별 누적 대련 횟수 */
    sectSparLifetime: {},
    /** 문파별 일일 견식 횟수 { [sectId]: { day, count } } */
    sectObserveLog: {},
    sectStanding: null,
    placeUI: null,
    hero: {
        name: '',
        alias: '',
        subtitle: '복면을 쓴 행인',
        masked: true,
    },
    enlightenment: {
        counts: { battle: 0, spar: 0, dojo: 0, gather: 0, observe: 0 },
        total: 0,
    },
    intelJournal: [],
    intelGatherAttempts: 0,
    intelStayArea: '촉남촌',
    intelGathersThisStay: 0,
    intelStayLimit: 0,
    exploreCooldowns: {},
    /** 기연 숙소·노숙 기연 — 장소당 캐릭터/무공 경험 1회 */
    kiyeonExpClaimed: [],
    /** 기연 숙소 이용일 { [장소]: day } */
    kiyeonRestLog: {},
    quests: {},
    didCheongseongTrain: false,
    passedEmeiTrial: false,
    martialArts: {
        learned: [
            { id: 'samjae_sword', level: 1, exp: 0 },
            { id: 'gwongak_basic', level: 1, exp: 0 },
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
    { id: '아미금정', icon: '🔔', desc: '아미파 본산. 정파 여협의 성지.' },
];

export function syncFame() {
    gameState.fame = Math.floor(gameState.hyeophaeng / REPUTATION_PER_POINT);
}

export function syncNotoriety() {
    gameState.notoriety = Math.floor(gameState.aekhaeng / REPUTATION_PER_POINT);
}

/**
 * 협행 변동 — 도덕 선택
 * 협행↑ → (100당) 명성↑ / 협행↓ → 악행↑ → (100당) 악명↑
 */
export function applyHyeophaengChange(delta) {
    if (!delta) return;
    const gs = gameState;
    if (delta > 0) {
        gs.hyeophaeng += delta;
    } else {
        const loss = Math.abs(delta);
        gs.hyeophaeng = Math.max(0, gs.hyeophaeng - loss);
        gs.aekhaeng += loss;
        syncNotoriety();
    }
    syncFame();
}

/** 협행 직접 추가 (전투·아이템 보상 등) */
export function addHyeophaeng(amount) {
    if (!amount) return;
    gameState.hyeophaeng += amount;
    syncFame();
}

/** 악행 직접 추가 */
export function addAekhaeng(amount) {
    if (!amount) return;
    gameState.aekhaeng += amount;
    syncNotoriety();
}

function applyReputationChanges(changes) {
    const gs = gameState;

    if ('hyeophaeng' in changes) {
        gs.hyeophaeng = Math.max(0, changes.hyeophaeng);
        delete changes.hyeophaeng;
        syncFame();
    }
    if ('fame' in changes) {
        const fameDelta = changes.fame - gs.fame;
        if (fameDelta !== 0) {
            gs.hyeophaeng = Math.max(0, gs.hyeophaeng + fameDelta * REPUTATION_PER_POINT);
        }
        delete changes.fame;
        syncFame();
    }
    if ('aekhaeng' in changes) {
        gs.aekhaeng = Math.max(0, changes.aekhaeng);
        delete changes.aekhaeng;
        syncNotoriety();
    }
    if ('notoriety' in changes) {
        const notDelta = changes.notoriety - gs.notoriety;
        if (notDelta !== 0) {
            gs.aekhaeng = Math.max(0, gs.aekhaeng + notDelta * REPUTATION_PER_POINT);
        }
        delete changes.notoriety;
        syncNotoriety();
    }
}

export function modifyStats(changes) {
    const rep = {};
    if ('hyeophaeng' in changes) rep.hyeophaeng = changes.hyeophaeng;
    if ('fame' in changes) rep.fame = changes.fame;
    if ('aekhaeng' in changes) rep.aekhaeng = changes.aekhaeng;
    if ('notoriety' in changes) rep.notoriety = changes.notoriety;
    if (Object.keys(rep).length) {
        const rest = { ...changes };
        delete rest.hyeophaeng;
        delete rest.fame;
        delete rest.aekhaeng;
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
    import('./stamina.js').then(s => {
        for (let i = 0; i < days; i++) s.onDayAdvanced(gameState);
    });
    import('./sects.js').then(s => s.onDayAdvanced(gameState, 'travel'));
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
    gs.naegongLevel = 1;
    gs.naegongExp = 0;
    addLog(`🌀 삼류 중반의 경지에 이르러 단전이 열렸다! 내공을 다룰 수 있게 되었다. (Lv.${unlockLevel})`);
    return true;
}

/** 전투 승리 등으로 내공 숙련 상승 — 개통 후에만 적용 */
export function gainNaegongExp(amount) {
    const gs = gameState;
    if (!amount || !gs.naegongUnlocked) return null;
    if (!gs.naegongLevel) gs.naegongLevel = 1;
    if (gs.naegongExp == null) gs.naegongExp = 0;

    gs.naegongExp += amount;
    const leveled = [];
    while (gs.naegongExp >= gs.naegongLevel * 30) {
        gs.naegongExp -= gs.naegongLevel * 30;
        gs.naegongLevel += 1;
        gs.maxNaegong += 10;
        leveled.push(gs.naegongLevel);
    }
    if (gs.naegong > gs.maxNaegong) gs.naegong = gs.maxNaegong;

    for (const lv of leveled) {
        addLog(`🌀 내공 숙련 상승! 내공 Lv.${lv} (최대 내공 +10)`);
    }

    return { gained: amount, level: gs.naegongLevel, leveled };
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