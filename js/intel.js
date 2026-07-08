import * as state from './state.js';

/** 정보 수집 기본 성공률 — 수집할수록 감소 */
export const BASE_INTEL_SUCCESS = 0.84;
export const INTEL_SUCCESS_DECAY = 0.028;
export const MIN_INTEL_SUCCESS = 0.32;

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
            text: '촉남촌 주민: 성도부 주막에 강호 소문이 모인다고 한다.',
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
            category: 'rumor',
            icon: '⚠️',
            title: '검각관 위험',
            text: '노인: 검각관 길은 산적뿐 아니라 사파 고수도 오간다고 한다.',
            effect: (gs) => { gs.heardCriminalRumor = true; },
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
            text: '촌장: 산적이 늘어 밤마다 검사를 구한다. 이곳에서 며칠 머물며 도와주면 보상을 주겠다고 한다.',
        },
    ],
    '성도부': [
        {
            id: 'intel_heuk_saryong_rumor',
            category: 'wanted',
            icon: '🐉',
            title: '수배: 흑사룡',
            text: '주막 소문: 검각관에 흑사룡이 나타났다. 현상금이 걸린 마수라 한다.',
            effect: (gs) => { gs.heardCriminalRumor = true; state.applyChivalryChange(1); },
        },
        {
            id: 'intel_hyeolma_wanted',
            category: 'wanted',
            icon: '🩸',
            title: '수배: 혈마검',
            text: '상인: 혈마검이 최근 강호에서 소문난다. 사파 검객, 여러 문파에서 추적 중이다.',
            effect: () => state.applyChivalryChange(1),
        },
        {
            id: 'quest_tang_swordsman',
            category: 'quest',
            icon: '⚔️',
            title: '당가 검사 모집',
            text: '정보상: 성도부 당가 지국이 능숙한 검사를 찾고 있다. 당가를 방문해 보라.',
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
            effect: () => state.applyChivalryChange(1),
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
            text: '낙서: 흑사룡의 서식지 표시. 위험하지만 큰 보상이 따른다.',
            effect: () => state.applyChivalryChange(1),
        },
        {
            id: 'intel_sapa_traces',
            category: 'rumor',
            icon: '🗡️',
            title: '사파 흔적',
            text: '산적 시체 옆: 혈마도 흔적. 사파 고수가 최근 이 길을 지나갔다.',
            effect: () => state.applyChivalryChange(1),
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
            effect: () => state.applyChivalryChange(1),
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
        },
    ],
    '峨嵋금정': [
        {
            id: 'intel_unrest',
            category: 'rumor',
            icon: '🔔',
            title: '강호 정세',
            text: '여협: 강호 정세가 불안하다. 네임드 무인이 늘고 있다.',
            effect: () => state.applyChivalryChange(2),
        },
        {
            id: 'intel_emei_scroll',
            category: 'place',
            icon: '📜',
            title: '무림첩',
            text: '峨嵋 제자: 무림첩을 나눠주었다.',
            effect: () => import('./encounters.js').then(m => m.addItem('무림첩')),
        },
        {
            id: 'quest_emei_trial',
            category: 'quest',
            icon: '🔔',
            title: '峨嵋 입문 시험',
            text: '제자: 峨嵋파 입문 시험이 열린다. 명성이 있어야 응시할 수 있다.',
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
}

export function getIntelSuccessRate(gs = state.gameState) {
    initIntel(gs);
    const count = gs.intelJournal.length;
    return Math.max(MIN_INTEL_SUCCESS, BASE_INTEL_SUCCESS - count * INTEL_SUCCESS_DECAY);
}

export function getIntelSuccessPercent(gs = state.gameState) {
    return Math.round(getIntelSuccessRate(gs) * 100);
}

function getKnownIds(gs) {
    return new Set((gs.intelJournal || []).map(e => e.id));
}

export function getAvailableIntelPool(area, gs = state.gameState) {
    const known = getKnownIds(gs);
    const pool = (INTEL_POOL[area] || []).filter(e => !known.has(e.id));
    if (pool.length) return pool;
    return DEFAULT_INTEL.filter(e => !known.has(e.id));
}

export function addIntelEntry(entry, gs = state.gameState, area = gs.currentArea) {
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

    if (entry.effect) {
        const r = entry.effect(gs);
        if (r?.then) r.catch(() => {});
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
                <p class="text-xs text-zinc-600 mt-2">현재 수집 성공률 약 <span class="text-blue-400">${rate}%</span> · 수집할수록 낮아짐</p>
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
                <span class="text-xs text-zinc-500">${journal.length}건 · 성공률 <span class="text-blue-400">${rate}%</span></span>
            </div>
            ${sections}
        </div>
    `;
}