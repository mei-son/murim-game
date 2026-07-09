import * as state from './state.js';
import * as map from './map.js';
import * as places from './places.js';
import * as quests from './quests.js';

/** 정보 수집 — 거점당 한도 절대 상한 */
export const MAX_INTEL_CAP = 10;

/** 거점 규모별 머무름 한도 [최소, 최대] — 도착 시 랜덤 */
const SCALE_INTEL_RANGE = {
    metropolis: [7, 10],
    city: [5, 8],
    town: [4, 7],
    village: [2, 5],
    remote: [2, 4],
    pass: [1, 3],
};

const INTEL_STAY_STATUS = [
    { minRatio: 0.65, text: '아직 들을 소문이 많다' },
    { minRatio: 0.35, text: '새 소식이 줄어들고 있다' },
    { minRatio: 0.12, text: '물을 곳이 거의 없다' },
    { minRatio: 0, text: '이 거점의 소식은 고갈되었다' },
];

/** 정보 수집 기본 성공률 */
export const BASE_INTEL_SUCCESS = 0.78;
/** 강호첩 누적 1건당 */
export const INTEL_SUCCESS_DROP_GLOBAL = 0.04;
/** 이번 머무름에서 이미 얻은 정보 1건당 */
export const INTEL_SUCCESS_DROP_PER_STAY = 0.14;
export const MIN_INTEL_SUCCESS = 0.1;

export const INTEL_CATEGORIES = {
    person: { label: '인물', icon: '👤', color: 'text-blue-300' },
    wanted: { label: '수배', icon: '📋', color: 'text-red-300' },
    quest:  { label: '의뢰', icon: '📜', color: 'text-amber-300' },
    rumor:  { label: '소문', icon: '💬', color: 'text-zinc-300' },
    place:  { label: '거점', icon: '📍', color: 'text-emerald-300' },
};

/**
 * 정보 수집 풀 — id 중복 시 강호첩에 한 번만 기록
 * effect는 수집 시 1회 실행 (은전·아이템 등)
 */
export const INTEL_POOL = {
    '촉남촌': [
        {
            id: 'intel_chengdu_tavern',
            category: 'place',
            icon: '🍶',
            title: '성도부 주막',
            text: '촉남촌 주민: 성도부 강호주막에 소문이 모인다고 한다. 성도부에 가면 찾을 수 있다.',
            revealsSpot: '강호주막',
        },
        {
            id: 'intel_village_gate',
            category: 'place',
            icon: '🛤️',
            title: '촌 입구',
            text: '촌장: 촌 남쪽 입구로 나가면 큰길과 연결된다. 외곽 탐색에 쓸 만하다.',
            revealsSpot: '촌입구',
        },
        {
            id: 'intel_cheongpung_forest',
            category: 'person',
            icon: '🌬️',
            title: '청풍검',
            text: '행상인: 청풍검이 근처 숲에서 수련 중이라 한다. 유랑 검객으로 소문난다.',
        },
        {
            id: 'intel_pass_bandits',
            category: 'place',
            icon: '⚠️',
            title: '검각관 위험',
            text: '노인: 검각관 길은 산적뿐 아니라 사파 고수도 오간다. 성도부 동쪽 관문 쪽이다.',
            revealsSpot: '검각관',
            effect: (gs) => { gs.heardCriminalRumor = true; },
        },
        {
            id: 'intel_cheongseong_peak',
            category: 'place',
            icon: '☯️',
            title: '청성산',
            text: '행상인: 북쪽 청성산에 도가 명문이 자리 잡았다. 촉남촌에서 산길을 타면 간다.',
            revealsSpot: '청성산',
        },
        {
            id: 'intel_herb_spot',
            category: 'place',
            icon: '🌿',
            title: '산기슭 약초',
            text: '약초꾼: 영초가 촉남촌 뒷산 기슭에 자란다.',
            effect: () => import('./encounters.js').then(m => m.addItem('영초')),
        },
        {
            id: 'quest_village_guard',
            category: 'quest',
            icon: '⚔️',
            title: '촌 보초 모집',
            text: '촌장: 산적이 늘어 밤마다 검사를 구한다. 촉남촌 일대에서 산적·도적을 퇴치해 달라고 한다.',
        },
    ],
    '성도부': [
        {
            id: 'intel_heuk_saryong_rumor',
            category: 'wanted',
            icon: '🐉',
            title: '수배: 흑사룡',
            text: '주막 소문: 검각관에 흑사룡이 나타났다. 현상금이 걸린 마수라 한다.',
            effect: (gs) => { gs.heardCriminalRumor = true; state.applyHyeophaengChange(1); },
        },
        {
            id: 'intel_hyeolma_wanted',
            category: 'wanted',
            icon: '🩸',
            title: '수배: 혈마검',
            text: '상인: 혈마검이 최근 강호에서 소문난다. 사파 검객, 여러 문파에서 추적 중이다.',
            effect: () => state.applyHyeophaengChange(1),
        },
        {
            id: 'intel_chengdu_pawn',
            category: 'place',
            icon: '💰',
            title: '성도 당포',
            text: '상인: 성도부 중심에 큰 당포가 있다. 장비를 구하기 좋다.',
            revealsSpot: '당포',
        },
        {
            id: 'intel_chengdu_south_gate',
            category: 'place',
            icon: '🚪',
            title: '성도 남문',
            text: '무인: 성도부 남문 밖으로 나가면 검각관 방향 길이 이어진다.',
            revealsSpot: '성도남문',
        },
        {
            id: 'quest_tang_swordsman',
            category: 'quest',
            icon: '⚔️',
            title: '당가 검사 모집',
            text: '정보상: 성도부 당가 지국이 능숙한 검사를 찾고 있다. 당가를 방문해 보라.',
        },
        {
            id: 'intel_emei_rumor',
            category: 'place',
            icon: '🔔',
            title: '아미 금정',
            text: '승려: 성도부 북쪽 길 너머 아미 금정이 있다. 아미파 본산이라 한다.',
            revealsSpot: '아미금정',
        },
        {
            id: 'intel_murim_spy',
            category: 'rumor',
            icon: '🕵️',
            title: '무림맹 첩자',
            text: '정보상: 무림맹 첩자가 성도부에 숨어 있다는 말이 있다. 누군지는 불명.',
            effect: () => state.modifyStats({ gold: state.gameState.gold + 15 }),
        },
        {
            id: 'intel_doksa_sighting',
            category: 'wanted',
            icon: '🐍',
            title: '수배: 독사궁주',
            text: '주점: 독사궁주가 검각관 근처에서 목격됐다. 운남 독문 고수다.',
            effect: () => state.applyHyeophaengChange(1),
        },
        {
            id: 'quest_sogeom_spar',
            category: 'quest',
            icon: '🗡️',
            title: '소검파 대련',
            text: '무인: 소검파 지국이 실력 검증을 위해 외부 무인의 대련을 받는다고 한다.',
        },
    ],
    '검각관': [
        {
            id: 'intel_dragon_lair',
            category: 'place',
            icon: '🐉',
            title: '흑사룡 서식지',
            text: '낙서: 북동쪽 산적소굴 근처가 흑사룡 서식지로 표시되어 있다. 위험하다.',
            revealsSpot: '산적소굴',
            effect: () => state.applyHyeophaengChange(1),
        },
        {
            id: 'intel_pass_gate',
            category: 'place',
            icon: '🚧',
            title: '검각 관문',
            text: '산적: 관문을 지키면 촉으로 들어가는 길을 막을 수 있다.',
            revealsSpot: '관문',
        },
        {
            id: 'intel_sapa_traces',
            category: 'rumor',
            icon: '🗡️',
            title: '사파 흔적',
            text: '산적 시체 옆: 혈마도 흔적. 사파 고수가 최근 이 길을 지나갔다.',
            effect: () => state.applyHyeophaengChange(1),
        },
        {
            id: 'wanted_bandit_chief',
            category: 'wanted',
            icon: '💀',
            title: '수배: 산적 두목',
            text: '관문 게시: 검각관 산적 두목 현상금 — 생포 시 은전 50냥.',
        },
        {
            id: 'intel_abandoned_coin',
            category: 'rumor',
            icon: '💰',
            title: '버려진 행낭',
            text: '버려진 행낭에서 은전을 발견했다.',
            effect: () => state.modifyStats({ gold: state.gameState.gold + 25 }),
        },
    ],
    '청성산': [
        {
            id: 'intel_cheongpung_spy',
            category: 'person',
            icon: '🌬️',
            title: '청풍검 목격',
            text: '도인: 청풍검이 청성 심법을 엿보려 산중을 배회한다는 소문.',
            effect: () => state.applyHyeophaengChange(1),
        },
        {
            id: 'intel_mountain_herb',
            category: 'place',
            icon: '💊',
            title: '산중 약초',
            text: '수행승: 산중 약초를 나눠주었다.',
            effect: () => import('./encounters.js').then(m => m.addItem('내공단')),
        },
        {
            id: 'quest_cheongseong_train',
            category: 'quest',
            icon: '☯️',
            title: '청성파 수련',
            text: '도관 제자: 청성파 도관에서 기초 심법 수련을 받을 수 있다고 한다.',
            revealsSpot: '도관',
        },
        {
            id: 'intel_cheongseong_trail',
            category: 'place',
            icon: '🛤️',
            title: '청성 산길',
            text: '도인: 산 아래 산길에서 수행하는 이들을 자주 본다.',
            revealsSpot: '산길',
        },
    ],
    '아미금정': [
        {
            id: 'intel_unrest',
            category: 'rumor',
            icon: '🔔',
            title: '강호 정세',
            text: '여협: 강호 정세가 불안하다. 네임드 무인이 늘고 있다.',
            effect: () => state.applyHyeophaengChange(2),
        },
        {
            id: 'intel_emei_scroll',
            category: 'place',
            icon: '📜',
            title: '무림첩',
            text: '아미 제자: 무림첩을 나눠주었다.',
            effect: () => import('./encounters.js').then(m => m.addItem('무림첩')),
        },
        {
            id: 'intel_emei_hall',
            category: 'place',
            icon: '🏛️',
            title: '금정 대전',
            text: '제자: 금정 대전에서 아미 고수들이 무공을 겨룬다.',
            revealsSpot: '금정대전',
        },
        {
            id: 'intel_emei_temple',
            category: 'place',
            icon: '⛩️',
            title: '산사',
            text: '행자: 금정 아래 산사에서 정진하는 승려를 보았다.',
            revealsSpot: '산사',
        },
        {
            id: 'quest_emei_trial',
            category: 'quest',
            icon: '🔔',
            title: '아미 입문 시험',
            text: '제자: 아미파 입문 시험이 열린다. 명성이 있어야 응시할 수 있다.',
        },
    ],
};

const DEFAULT_INTEL = [
    {
        id: 'intel_default_quiet',
        category: 'rumor',
        icon: '💤',
        title: '강호 정적',
        text: '강호에서는 별다른 소식이 없다.',
    },
    {
        id: 'intel_default_road',
        category: 'rumor',
        icon: '🚶',
        title: '길 묻기',
        text: '지나가는 무인에게 길을 물었다. 다음 마을 방향을 알았다.',
        effect: () => state.modifyStats({ gold: state.gameState.gold + 5 }),
    },
];

export function initIntel(gs = state.gameState) {
    if (!gs.intelJournal) gs.intelJournal = [];
    if (gs.intelGatherAttempts == null) gs.intelGatherAttempts = 0;
    if (gs.intelStayArea == null) gs.intelStayArea = gs.currentArea;
    if (gs.intelGathersThisStay == null) gs.intelGathersThisStay = 0;
    if (!gs.intelStayLimit) gs.intelStayLimit = rollIntelStayLimit(gs, gs.intelStayArea);
}

export function rollIntelStayLimit(gs, areaId = gs.currentArea) {
    const profile = places.getPlaceProfile(gs.currentLocation, areaId);
    const [min, max] = SCALE_INTEL_RANGE[profile.scale] || [2, 5];
    const span = Math.max(0, max - min);
    return Math.min(MAX_INTEL_CAP, min + Math.floor(Math.random() * (span + 1)));
}

export function getIntelStayLimit(gs = state.gameState) {
    initIntel(gs);
    return gs.intelStayLimit || rollIntelStayLimit(gs);
}

export function resetIntelStayIfNeeded(gs, areaId) {
    initIntel(gs);
    if (gs.intelStayArea !== areaId) {
        gs.intelStayArea = areaId;
        gs.intelGathersThisStay = 0;
        gs.intelStayLimit = rollIntelStayLimit(gs, areaId);
    }
}

export function getIntelStayStatusText(gs = state.gameState) {
    initIntel(gs);
    const limit = getIntelStayLimit(gs);
    const used = getIntelGathersThisStay(gs);
    const ratio = limit > 0 ? (limit - used) / limit : 0;
    for (const row of INTEL_STAY_STATUS) {
        if (ratio >= row.minRatio) return row.text;
    }
    return INTEL_STAY_STATUS[INTEL_STAY_STATUS.length - 1].text;
}

export function getIntelGathersThisStay(gs = state.gameState) {
    initIntel(gs);
    return gs.intelGathersThisStay || 0;
}

/** 거점 정보 개방도 — 1에 가까울수록 아직 들을 소식이 많음 */
export function getIntelOpennessRatio(gs = state.gameState) {
    initIntel(gs);
    const limit = getIntelStayLimit(gs);
    if (limit <= 0) return 0;
    const used = getIntelGathersThisStay(gs);
    return Math.max(0, (limit - used) / limit);
}

/** 은전 의뢰로 받을 수 있는 미수집 퀘스트 */
export function getAvailablePaidQuests(gs = state.gameState) {
    initIntel(gs);
    quests.initQuests(gs);
    const known = getKnownIds(gs);
    return (INTEL_POOL[gs.currentArea] || []).filter(e =>
        e.category === 'quest'
        && quests.isQuestIntelId(e.id)
        && !known.has(e.id)
        && gs.quests[e.id]?.status !== 'active'
        && gs.quests[e.id]?.status !== 'completed'
    );
}

export function canGatherMoreIntel(gs = state.gameState) {
    return getIntelGathersThisStay(gs) < getIntelStayLimit(gs);
}

const NAMED_CONTEXT_LABEL = {
    travel: '이동 중',
    gather: '정보 수집 중',
    explore: '주변 탐색 중',
    normal: '강호에서',
};

/** 이동·탐색·정보 수집 중 만난 네임드 — 강호첩 등록 (한도 미포함) */
export function registerNamedEncounterIntel(enemy, gs = state.gameState, context = 'normal') {
    initIntel(gs);
    const id = `intel_met_${enemy.id}`;
    if (getKnownIds(gs).has(id)) return false;
    const ctxLabel = NAMED_CONTEXT_LABEL[context] || NAMED_CONTEXT_LABEL.normal;
    return addIntelEntry({
        id,
        category: 'person',
        icon: enemy.icon || '⚔️',
        title: enemy.name,
        text: `${enemy.title || '네임드 무인'}. ${ctxLabel} ${gs.currentLocation} 부근에서 목격했다. 실력은 일반 무인과 비교할 수 없을 정도로 강하다.`,
    }, gs, gs.currentArea, { countsTowardLimit: false });
}

export function getIntelSuccessRate(gs = state.gameState) {
    initIntel(gs);
    const journal = gs.intelJournal.length;
    const stayCount = getIntelGathersThisStay(gs);
    let rate = BASE_INTEL_SUCCESS;
    rate -= journal * INTEL_SUCCESS_DROP_GLOBAL;
    rate -= stayCount * INTEL_SUCCESS_DROP_PER_STAY;
    return Math.max(MIN_INTEL_SUCCESS, rate);
}

export function getIntelSuccessPercent(gs = state.gameState) {
    return Math.round(getIntelSuccessRate(gs) * 100);
}

function getKnownIds(gs) {
    return new Set((gs.intelJournal || []).map(e => e.id));
}

export function getAvailableIntelPool(area, gs = state.gameState) {
    if (!canGatherMoreIntel(gs)) return [];
    const known = getKnownIds(gs);
    const pool = (INTEL_POOL[area] || []).filter(e => !known.has(e.id));
    if (pool.length) return pool;
    return DEFAULT_INTEL.filter(e => !known.has(e.id));
}

export function addIntelEntry(entry, gs = state.gameState, area = gs.currentArea, opts = {}) {
    initIntel(gs);
    if (getKnownIds(gs).has(entry.id)) return false;

    const cat = INTEL_CATEGORIES[entry.category] || INTEL_CATEGORIES.rumor;
    const record = {
        id: entry.id,
        category: entry.category,
        icon: entry.icon || cat.icon,
        title: entry.title,
        text: entry.text,
        area,
        day: gs.day,
    };
    gs.intelJournal.unshift(record);
    if (opts.countsTowardLimit !== false) {
        gs.intelGathersThisStay = (gs.intelGathersThisStay || 0) + 1;
    }

    if (entry.revealsSpot) {
        if (map.discoverSpot(gs, entry.revealsSpot)) {
            state.addLog(`📍 정소 파악: ${entry.revealsSpot}`);
        }
    }

    if (entry.effect) {
        const r = entry.effect(gs);
        if (r?.then) r.catch(() => {});
    }
    if (entry.category === 'quest' && quests.isQuestIntelId(entry.id)) {
        quests.activateQuest(entry.id, gs);
    }
    return true;
}

export function renderIntelJournalPanel(gs = state.gameState) {
    initIntel(gs);
    const journal = gs.intelJournal || [];
    const rate = getIntelSuccessPercent(gs);

    if (!journal.length) {
        return `
            <div class="mb-4 p-4 bg-zinc-800/40 border border-zinc-700 rounded-xl">
                <h4 class="text-amber-400 font-bold mb-1"><i class="fas fa-scroll mr-1"></i>수집 정보</h4>
                <p class="text-sm text-zinc-500">아직 기록된 정보가 없다. 정보 수집으로 강호첩을 채워 보자.</p>
                <p class="text-xs text-zinc-600 mt-2">수집 성공률 <span class="text-blue-400">${rate}%</span> · ${getIntelStayStatusText(gs)}</p>
            </div>
        `;
    }

    const grouped = {};
    for (const entry of journal) {
        if (!grouped[entry.category]) grouped[entry.category] = [];
        grouped[entry.category].push(entry);
    }

    const sections = Object.entries(INTEL_CATEGORIES).map(([key, meta]) => {
        const items = grouped[key];
        if (!items?.length) return '';
        return `
            <div class="mb-3">
                <h5 class="text-xs ${meta.color} font-bold mb-1.5">${meta.icon} ${meta.label} (${items.length})</h5>
                <div class="space-y-2">
                    ${items.map(e => `
                        <div class="intel-entry-card bg-zinc-800/50 border border-zinc-700/80 rounded-lg px-3 py-2">
                            <div class="flex items-start gap-2">
                                <span class="text-lg shrink-0">${e.icon}</span>
                                <div class="min-w-0">
                                    <div class="font-medium text-amber-200/90 text-sm">${e.title}</div>
                                    <p class="text-xs text-zinc-400 mt-0.5 leading-relaxed">${e.text}</p>
                                    ${e.category === 'quest' ? quests.renderQuestObjectiveHtml(e.id, gs) : ''}
                                    <div class="text-[0.65rem] text-zinc-600 mt-1">${e.area} · 제 ${e.day}일</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="mb-4 p-4 bg-amber-900/15 border border-amber-800/40 rounded-xl">
            <div class="flex justify-between items-center mb-2">
                <h4 class="text-amber-400 font-bold"><i class="fas fa-scroll mr-1"></i>수집 정보</h4>
                <span class="text-xs text-zinc-500">${journal.length}건 · 성공률 <span class="text-blue-400">${rate}%</span> · <span class="text-emerald-400">${getIntelStayStatusText(gs)}</span></span>
            </div>
            ${sections}
        </div>
    `;
}