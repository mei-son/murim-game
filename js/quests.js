import * as state from './state.js';

/** 강호첩 의뢰(id = intel entry id) 정의 */
export const QUEST_DEFS = {
    quest_village_guard: {
        title: '촌 보초 모집',
        objectiveLabel: '촉남촌에서 산적·도적 퇴치',
        type: 'kill',
        targetPattern: /산적|도적|도둑/,
        count: 5,
        area: '촉남촌',
        rewards: { gold: 45, fame: 2, hyeophaeng: 5 },
        completeLog: '촌장이 은전과 감사 인사를 전했다. 밤길이 한결 안전해졌다.',
    },
    quest_tang_swordsman: {
        title: '당가 검사 모집',
        objectiveLabel: '성도부 당가 지국 방문',
        type: 'visit_sect',
        sectId: 'tang_clan',
        rewards: { gold: 20, fame: 1 },
        completeLog: '당가에 인사를 올렸다. 검사 모집 공고를 확인했다.',
    },
    quest_sogeom_spar: {
        title: '소검파 대련',
        objectiveLabel: '소검파 지국 대련 승리',
        type: 'spar_sect',
        sectId: 'sogeom',
        rewards: { gold: 25, fame: 2, hyeophaeng: 2 },
        completeLog: '소검파 대련에서 실력을 인정받았다.',
    },
    quest_cheongseong_train: {
        title: '청성파 수련',
        objectiveLabel: '청성산 도관에서 심법 수련 1회',
        type: 'flag',
        flag: 'didCheongseongTrain',
        rewards: { fame: 2, hyeophaeng: 2 },
        completeLog: '청성 심법 수련 의뢰를 마쳤다.',
    },
    quest_emei_trial: {
        title: '아미 입문 시험',
        objectiveLabel: '아미금정 입문 시험 통과 (명성 5+)',
        type: 'flag',
        flag: 'passedEmeiTrial',
        rewards: { fame: 3, gold: 30 },
        completeLog: '아미파 입문 시험에 합격했다.',
    },
};

export function initQuests(gs = state.gameState) {
    if (!gs.quests) gs.quests = {};
    syncQuestsFromJournal(gs);
}

function syncQuestsFromJournal(gs) {
    for (const entry of gs.intelJournal || []) {
        if (entry.category !== 'quest' || !QUEST_DEFS[entry.id]) continue;
        if (gs.quests[entry.id]) continue;
        gs.quests[entry.id] = { status: 'active', progress: 0, acceptedDay: entry.day || gs.day };
    }
}

export function isQuestIntelId(id) {
    return !!QUEST_DEFS[id];
}

export function activateQuest(questId, gs = state.gameState) {
    initQuests(gs);
    if (!QUEST_DEFS[questId]) return false;
    if (gs.quests[questId]?.status === 'completed') return false;
    if (gs.quests[questId]?.status === 'active') return false;
    gs.quests[questId] = {
        status: 'active',
        progress: 0,
        acceptedDay: gs.day,
    };
    const def = QUEST_DEFS[questId];
    state.addLog(`📜 의뢰 수주: ${def.title} — ${def.objectiveLabel}`);
    return true;
}

function applyQuestRewards(def, gs) {
    const r = def.rewards || {};
    const changes = {};
    if (r.gold) changes.gold = gs.gold + r.gold;
    if (r.fame) changes.fame = gs.fame + r.fame;
    if (Object.keys(changes).length) state.modifyStats(changes);
    if (r.hyeophaeng) state.applyHyeophaengChange(r.hyeophaeng);
}

export function completeQuest(questId, gs = state.gameState) {
    initQuests(gs);
    const def = QUEST_DEFS[questId];
    const q = gs.quests[questId];
    if (!def || !q || q.status !== 'active') return false;

    q.status = 'completed';
    q.completedDay = gs.day;
    applyQuestRewards(def, gs);
    state.addLog(`✅ 의뢰 완료: ${def.title} — ${def.completeLog}`);
    return true;
}

function matchesKillTarget(enemyName, def) {
    return def.targetPattern?.test(enemyName);
}

export function onEnemyDefeated(enemy, gs = state.gameState) {
    initQuests(gs);
    const name = enemy?.name || enemy;
    if (!name) return;

    for (const [questId, q] of Object.entries(gs.quests)) {
        if (q.status !== 'active') continue;
        const def = QUEST_DEFS[questId];
        if (!def || def.type !== 'kill') continue;
        if (def.area && gs.currentArea !== def.area) continue;
        if (!matchesKillTarget(name, def)) continue;

        q.progress = (q.progress || 0) + 1;
        if (q.progress >= def.count) {
            completeQuest(questId, gs);
        } else {
            state.addLog(`📜 의뢰 진행 — ${def.objectiveLabel} (${q.progress}/${def.count})`);
        }
    }

    if (name === '시험관' && gs.currentArea === '아미금정') {
        setQuestFlag('passedEmeiTrial', gs);
    }
}

export function onVisitLocation(locationId, gs = state.gameState) {
    initQuests(gs);
    for (const [questId, q] of Object.entries(gs.quests)) {
        if (q.status !== 'active') continue;
        const def = QUEST_DEFS[questId];
        if (def?.type === 'visit_location' && def.location === locationId) {
            completeQuest(questId, gs);
        }
    }
}

export function onVisitSect(sectId, gs = state.gameState) {
    initQuests(gs);
    for (const [questId, q] of Object.entries(gs.quests)) {
        if (q.status !== 'active') continue;
        const def = QUEST_DEFS[questId];
        if (def?.type === 'visit_sect' && def.sectId === sectId) {
            completeQuest(questId, gs);
        }
    }
}

export function onSparVictory(sectId, gs = state.gameState) {
    initQuests(gs);
    for (const [questId, q] of Object.entries(gs.quests)) {
        if (q.status !== 'active') continue;
        const def = QUEST_DEFS[questId];
        if (def?.type === 'spar_sect' && def.sectId === sectId) {
            completeQuest(questId, gs);
        }
    }
}

export function setQuestFlag(flag, gs = state.gameState) {
    gs[flag] = true;
    initQuests(gs);
    for (const [questId, q] of Object.entries(gs.quests)) {
        if (q.status !== 'active') continue;
        const def = QUEST_DEFS[questId];
        if (def?.type === 'flag' && def.flag === flag) {
            completeQuest(questId, gs);
        }
    }
}

export function getQuestProgressText(questId, gs = state.gameState) {
    initQuests(gs);
    const def = QUEST_DEFS[questId];
    const q = gs.quests[questId];
    if (!def) return '';

    if (q?.status === 'completed') {
        return '✅ 완료';
    }
    if (q?.status !== 'active') {
        return `📋 달성 조건: ${def.objectiveLabel}`;
    }

    switch (def.type) {
        case 'kill':
            return `📋 달성: ${def.objectiveLabel} (${q.progress || 0}/${def.count})`;
        case 'visit_location':
            return `📋 달성: ${def.objectiveLabel}${gs.currentLocation === def.location ? ' — 이곳 도착!' : ''}`;
        case 'visit_sect':
            return `📋 달성: ${def.objectiveLabel}`;
        case 'spar_sect':
            return `📋 달성: ${def.objectiveLabel}`;
        case 'flag':
            return `📋 달성: ${def.objectiveLabel}${gs[def.flag] ? ' — 조건 충족!' : ''}`;
        default:
            return `📋 달성: ${def.objectiveLabel}`;
    }
}

export function renderQuestObjectiveHtml(questId, gs = state.gameState) {
    const text = getQuestProgressText(questId, gs);
    if (!text) return '';
    const q = gs.quests?.[questId];
    const cls = q?.status === 'completed'
        ? 'text-emerald-400'
        : q?.status === 'active'
            ? 'text-amber-300'
            : 'text-zinc-500';
    return `<p class="text-xs ${cls} mt-1.5 pt-1.5 border-t border-zinc-700/80 font-medium">${text}</p>`;
}