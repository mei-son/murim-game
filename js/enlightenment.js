import * as state from './state.js';
import * as martial from './martial.js';
import * as realm from './realm.js';

/** 전투·활동 유형별 랜덤 깨달음 확률 (매우 낮음) */
export const RANDOM_CHANCE = {
    battle: 0.012,
    spar: 0.008,
    dojo: 0.01,
    gather: 0.006,
    observe: 0.012,
};

/**
 * 천장 — 반복 횟수 도달 시 확정 깨달음
 * 상위 천장은 경지( rank )가 높아야 적용
 */
const PITY_THRESHOLDS = {
    battle: [
        { at: 100, minRealmRank: 1 },
        { at: 1000, minRealmRank: 3 },
        { at: 5000, minRealmRank: 4 },
        { at: 20000, minRealmRank: 5 },
    ],
    spar: [
        { at: 1000, minRealmRank: 2 },
        { at: 5000, minRealmRank: 4 },
    ],
    dojo: [
        { at: 500, minRealmRank: 3 },
        { at: 2000, minRealmRank: 5 },
    ],
    gather: [
        { at: 800, minRealmRank: 2 },
        { at: 3000, minRealmRank: 4 },
    ],
    observe: [
        { at: 500, minRealmRank: 2 },
        { at: 2000, minRealmRank: 4 },
    ],
};

const MARTIAL_EXP_BY_REALM = {
    1: 45,
    2: 70,
    3: 110,
    4: 180,
    5: 300,
    6: 480,
};

export function initEnlightenment(gs = state.gameState) {
    if (!gs.enlightenment) {
        gs.enlightenment = {
            counts: { battle: 0, spar: 0, dojo: 0, gather: 0, observe: 0 },
            total: 0,
        };
    }
    if (!gs.enlightenment.counts) {
        gs.enlightenment.counts = { battle: 0, spar: 0, dojo: 0, gather: 0, observe: 0 };
    }
    if (gs.enlightenment.counts.observe == null) {
        gs.enlightenment.counts.observe = 0;
    }
}

function mapCombatType(context) {
    if (context === 'spar') return 'spar';
    if (context === 'dojo') return 'dojo';
    if (context === 'gather') return 'gather';
    if (context === 'observe') return 'observe';
    return 'battle';
}

function getAvailablePityTiers(combatType, realmRank) {
    const tiers = PITY_THRESHOLDS[combatType] || PITY_THRESHOLDS.battle;
    return tiers.filter(t => realmRank >= t.minRealmRank);
}

function checkPity(gs, combatType, realmRank) {
    const count = gs.enlightenment.counts[combatType] || 0;
    const tiers = getAvailablePityTiers(combatType, realmRank);
    let hit = null;
    for (const tier of tiers) {
        if (count >= tier.at) hit = tier;
    }
    return hit;
}

function getNextPityTarget(combatType, realmRank, currentCount) {
    const tiers = getAvailablePityTiers(combatType, realmRank);
    for (const tier of tiers) {
        if (currentCount < tier.at) return tier.at;
    }
    const last = tiers[tiers.length - 1];
    return last ? last.at : null;
}

/** 전투 종료 후 호출 (도망 제외) */
export function tryEnlightenment(context = 'normal', fled = false) {
    if (fled) return null;

    const gs = state.gameState;
    initEnlightenment(gs);
    const combatType = mapCombatType(context);
    gs.enlightenment.counts[combatType] = (gs.enlightenment.counts[combatType] || 0) + 1;

    const r = realm.getRealm(gs.level);
    const pityTier = checkPity(gs, combatType, r.rank);
    const randomHit = !pityTier && Math.random() < (RANDOM_CHANCE[combatType] || RANDOM_CHANCE.battle);

    if (!pityTier && !randomHit) return null;

    const source = pityTier ? 'pity' : 'random';
    const martialExp = MARTIAL_EXP_BY_REALM[r.rank] || 45;
    const levelUps = martial.gainMartialEnlightenmentExp(martialExp);

    if (pityTier) {
        gs.enlightenment.counts[combatType] = 0;
    }

    gs.enlightenment.total = (gs.enlightenment.total || 0) + 1;

    const artNames = levelUps.map(u => `${u.name} Lv.${u.level}`).join(', ');
    const msg = source === 'pity'
        ? `✨ 천장 깨달음! (${combatType} ${pityTier.at}회) — ${artNames || '무공 숙련 상승'}`
        : `💡 우연한 깨달음! — ${artNames || '무공 숙련 상승'}`;

    state.addLog(msg);

    return {
        source,
        combatType,
        martialExp,
        levelUps,
        realm: r.name,
        message: msg,
        pityAt: pityTier?.at || null,
    };
}

/** 네임드 사사 등 — 확정 깨달음 */
export function forceEnlightenment(context = 'spar') {
    const gs = state.gameState;
    initEnlightenment(gs);
    const combatType = mapCombatType(context);
    const r = realm.getRealm(gs.level);
    const martialExp = Math.floor((MARTIAL_EXP_BY_REALM[r.rank] || 45) * 1.6);
    const levelUps = martial.gainMartialEnlightenmentExp(martialExp);
    gs.enlightenment.total = (gs.enlightenment.total || 0) + 1;
    const artNames = levelUps.map(u => `${u.name} Lv.${u.level}`).join(', ');
    const msg = `✨ 깨달음! — ${artNames || '무공 숙련이 깊어졌다'}`;
    state.addLog(msg);
    return {
        source: 'forced',
        combatType,
        martialExp,
        levelUps,
        realm: r.name,
        message: msg,
    };
}

export function getPityStatus(gs = state.gameState) {
    initEnlightenment(gs);
    const r = realm.getRealm(gs.level);
    const types = ['battle', 'spar', 'dojo', 'observe'];
    const labels = { battle: '전투', spar: '대련', dojo: '도장깨기', observe: '견식' };

    return types.map(type => {
        const count = gs.enlightenment.counts[type] || 0;
        const target = getNextPityTarget(type, r.rank, count);
        const tiers = getAvailablePityTiers(type, r.rank);
        const maxTier = tiers[tiers.length - 1];
        return {
            type,
            label: labels[type],
            count,
            target: target || maxTier?.at || '—',
            maxTier: maxTier?.at || null,
            realmLocked: !tiers.length,
        };
    });
}

export function renderEnlightenmentPanel(gs = state.gameState) {
    const rows = getPityStatus(gs);
    const total = gs.enlightenment?.total || 0;
    return `
        <div class="mt-4">
            <h4 class="text-sm text-zinc-500 mb-2"><i class="fas fa-lightbulb mr-1"></i>깨달음</h4>
            <p class="text-xs text-zinc-600 mb-2">전투·대련·견식·도장깨기 등에서 극히 낮은 확률로 깨달음. 천장 도달 시 확정 발동 — 상위 천장은 경지가 높아야 함.</p>
            <div class="text-xs text-zinc-500 mb-2">누적 깨달음 <span class="text-amber-400 font-bold">${total}</span>회</div>
            <div class="space-y-1.5 text-xs">
                ${rows.map(row => `
                    <div class="flex justify-between bg-zinc-800/40 rounded-lg px-3 py-1.5">
                        <span class="text-zinc-500">${row.label}</span>
                        <span class="text-zinc-400">
                            ${row.realmLocked
                                ? '<span class="text-zinc-600">경지 부족</span>'
                                : `<span class="text-cyan-400">${row.count}</span> / ${row.target}회`}
                        </span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}