import * as state from './state.js';
import * as realm from './realm.js';

/** 무공 등급 — 하류일수록 레벨당 상승치가 낮음 */
export const TIER_META = {
    하류: { rank: 1, color: 'text-zinc-400', badge: 'bg-zinc-700/60', growth: 1 },
    중류: { rank: 2, color: 'text-emerald-400', badge: 'bg-emerald-900/40', growth: 1.4 },
    상류: { rank: 3, color: 'text-blue-400', badge: 'bg-blue-900/40', growth: 1.8 },
    상승: { rank: 4, color: 'text-purple-400', badge: 'bg-purple-900/40', growth: 2.5 },
    일류: { rank: 5, color: 'text-amber-300', badge: 'bg-amber-900/50', growth: 3.2 },
};

/**
 * 무공 정의
 * - 검법: 공격(대미지)·방어
 * - 보법: 공격·회피 (전반 보정)
 * - learnable: common(흔함) | kiyeon(기연·문파 등)
 */
export const MARTIAL_CATALOG = {
    samjae_sword: {
        id: 'samjae_sword',
        name: '삼재검법',
        type: '검법',
        tier: '하류',
        icon: '⚔️',
        learnable: 'common',
        desc: '삼재를 겹쳐 쓰는 기초 검법. 흔히 서원에서 배울 수 있다.',
        effectDesc: '공격력·방어력 보정',
        maxLevel: 10,
        potentialMax: 10,
        perLevel: { atk: 1, def: 1 },
    },
    ohaeng_step: {
        id: 'ohaeng_step',
        name: '오행보법',
        type: '보법',
        tier: '하류',
        icon: '🌀',
        learnable: 'common',
        desc: '오행의 기운을 발끝에 두르는 기초 보법. 도장·무관에서 흔히 전수된다.',
        effectDesc: '공격·회피 전반 보정',
        maxLevel: 10,
        potentialMax: 10,
        perLevel: { atk: 0.5, evasion: 2 },
    },
    cheongpung_sword: {
        id: 'cheongpung_sword',
        name: '청풍검법',
        type: '검법',
        tier: '상승',
        icon: '🌬️',
        learnable: 'kiyeon',
        desc: '바람처럼 가볍고 날카로운 상승 검법. 기연 없이는 배울 수 없다.',
        effectDesc: '공격력·방어력 대폭 보정',
        maxLevel: 20,
        potentialMax: 30,
        perLevel: { atk: 2.5, def: 1.5 },
    },
    taeguk_step: {
        id: 'taeguk_step',
        name: '태극보법',
        type: '보법',
        tier: '상승',
        icon: '☯️',
        learnable: 'kiyeon',
        desc: '음양이 어우러진 상승 보법. 명문·기연을 통해서만 전수된다.',
        effectDesc: '공격·회피 고도 보정',
        maxLevel: 20,
        potentialMax: 30,
        perLevel: { atk: 1.5, evasion: 4 },
    },
    eunhae_sword: {
        id: 'eunhae_sword',
        name: '은해검결',
        type: '검법',
        tier: '일류',
        icon: '🌙',
        learnable: 'kiyeon',
        desc: '달빛처럼 은은하나 치명적인 일류 검결. 강호에서 손에 넣기 어렵다.',
        effectDesc: '공격·방어 극한 보정',
        maxLevel: 30,
        potentialMax: 50,
        perLevel: { atk: 4, def: 2.5 },
    },
};

const BASE_EVASION = 5;

export function getDefaultLearned() {
    return [
        { id: 'samjae_sword', level: 1, exp: 0 },
        { id: 'ohaeng_step', level: 1, exp: 0 },
    ];
}

export function initMartialArts(gs = state.gameState) {
    if (!gs.martialArts?.learned?.length) {
        gs.martialArts = { learned: getDefaultLearned() };
    }
    if (!gs.hero) {
        gs.hero = {
            name: '',
            alias: '',
            subtitle: '복면을 쓴 행인',
            masked: true,
        };
    }
    if (gs.hero.disguise && !gs.hero.alias) gs.hero.alias = gs.hero.disguise;
    recalcCombatStats(gs);
}

export function isNaegongUnlocked(gs = state.gameState) {
    return !!gs.naegongUnlocked;
}

export function gainMartialEnlightenmentExp(totalExp) {
    const gs = state.gameState;
    const learned = gs.martialArts?.learned || [];
    if (!learned.length) return [];

    const levelUps = [];
    const primaryIdx = Math.floor(Math.random() * learned.length);
    const primaryShare = Math.floor(totalExp * 0.72);
    let remainder = totalExp - primaryShare;

    for (let i = 0; i < learned.length; i++) {
        const entry = learned[i];
        const def = getArtDef(entry.id);
        if (!def) continue;
        let gained;
        if (i === primaryIdx) {
            gained = primaryShare + (learned.length === 1 ? remainder : 0);
        } else if (learned.length === 2) {
            gained = remainder;
        } else {
            gained = Math.floor(remainder / (learned.length - 1));
        }
        levelUps.push(...applyMartialExp(entry, def, gained));
    }

    recalcCombatStats(gs);
    return levelUps;
}

function applyMartialExp(entry, def, amount) {
    const ups = [];
    entry.exp = (entry.exp || 0) + amount;
    const cap = Math.min(def.maxLevel, def.potentialMax);
    while (entry.level < cap && entry.exp >= entry.level * 20) {
        entry.exp -= entry.level * 20;
        entry.level += 1;
        ups.push({ id: def.id, name: def.name, level: entry.level });
    }
    return ups;
}

export function getArtDef(id) {
    return MARTIAL_CATALOG[id] || null;
}

export function getLearnedArts(gs = state.gameState) {
    return (gs.martialArts?.learned || []).map(entry => {
        const def = getArtDef(entry.id);
        if (!def) return null;
        return { ...entry, def, bonuses: calcBonuses(def, entry.level) };
    }).filter(Boolean);
}

export function getLockedArts(gs = state.gameState) {
    const learned = new Set((gs.martialArts?.learned || []).map(a => a.id));
    return Object.values(MARTIAL_CATALOG)
        .filter(a => a.learnable === 'kiyeon' && !learned.has(a.id));
}

function scalePerLevel(value, tier) {
    const growth = TIER_META[tier]?.growth ?? 1;
    return value * growth;
}

export function calcBonuses(def, level) {
    const lv = Math.max(1, Math.min(level, def.potentialMax));
    const atkRaw = (def.perLevel.atk || 0) * lv;
    const defRaw = (def.perLevel.def || 0) * lv;
    const evaRaw = (def.perLevel.evasion || 0) * lv;
    return {
        atk: Math.floor(atkRaw),
        def: Math.floor(defRaw),
        evasion: Math.floor(evaRaw),
        atkNext: Math.floor(atkRaw + scalePerLevel(def.perLevel.atk || 0, def.tier)),
        defNext: Math.floor(defRaw + scalePerLevel(def.perLevel.def || 0, def.tier)),
        evasionNext: Math.floor(evaRaw + scalePerLevel(def.perLevel.evasion || 0, def.tier)),
    };
}

export function getMartialBonuses(gs = state.gameState) {
    let atk = 0, def = 0, evasion = 0;
    for (const entry of getLearnedArts(gs)) {
        atk += entry.bonuses.atk;
        def += entry.bonuses.def;
        evasion += entry.bonuses.evasion;
    }
    return { atk, def, evasion };
}

export function getEvasionRate(gs = state.gameState) {
    const ev = gs.evasion ?? BASE_EVASION;
    return Math.min(45, Math.floor(ev * 3));
}

export function rollEvasion(gs = state.gameState) {
    return Math.random() * 100 < getEvasionRate(gs);
}

export function recalcCombatStats(gs = state.gameState) {
    if (!gs._baseStats) {
        gs._baseStats = { atk: gs.atk, def: gs.def, maxHp: gs.maxHp };
    }
    const b = gs._baseStats;
    const martial = getMartialBonuses(gs);

    let gearAtk = 0, gearDef = 0, gearHp = 0;
    for (const item of gs.inventory || []) {
        if (item.type !== 'gear') continue;
        gearAtk += item.atk || 0;
        gearDef += item.def || 0;
        gearHp += item.maxHp || 0;
    }

    const hpRatio = gs.maxHp > 0 ? gs.hp / gs.maxHp : 1;
    const newMaxHp = b.maxHp + gearHp;
    gs.atk = b.atk + martial.atk + gearAtk;
    gs.def = b.def + martial.def + gearDef;
    gs.maxHp = newMaxHp;
    gs.hp = Math.min(newMaxHp, Math.max(1, Math.floor(hpRatio * newMaxHp)));
    gs.evasion = BASE_EVASION + martial.evasion;
    gs._baseEvasion = BASE_EVASION;
}

/** 기연·수련 등으로 무공 습득 (향후 이벤트용) */
export function learnMartialArt(artId, level = 1) {
    const gs = state.gameState;
    const def = getArtDef(artId);
    if (!def) return false;
    if (!gs.martialArts) gs.martialArts = { learned: [] };
    const existing = gs.martialArts.learned.find(a => a.id === artId);
    if (existing) {
        existing.level = Math.min(def.potentialMax, Math.max(existing.level, level));
        recalcCombatStats(gs);
        return true;
    }
    if (def.learnable !== 'kiyeon' && def.learnable !== 'common') return false;
    gs.martialArts.learned.push({ id: artId, level: Math.min(def.maxLevel, level), exp: 0 });
    state.addLog(`📜 ${def.name}을(를) 익혔다! (${def.tier} ${def.type})`);
    recalcCombatStats(gs);
    return true;
}

export function formatArtBonuses(bonuses, def) {
    const parts = [];
    if (def.type === '검법') {
        if (bonuses.atk) parts.push(`공격+${bonuses.atk}`);
        if (bonuses.def) parts.push(`방어+${bonuses.def}`);
    } else {
        if (bonuses.atk) parts.push(`공격+${bonuses.atk}`);
        if (bonuses.evasion) parts.push(`회피+${bonuses.evasion}`);
    }
    return parts.length ? parts.join(' · ') : '보정 없음';
}

export function renderMartialArtsPanel(gs = state.gameState) {
    const learned = getLearnedArts(gs);
    const locked = getLockedArts(gs);
    const evRate = getEvasionRate(gs);

    const learnedHtml = learned.map(({ def, level, exp, bonuses }) => {
        const tier = TIER_META[def.tier] || TIER_META.하류;
        const expNeed = level * 20;
        const expPct = Math.min(100, Math.floor((exp / expNeed) * 100));
        return `
            <div class="martial-card">
                <div class="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <span class="text-lg mr-1">${def.icon}</span>
                        <span class="font-bold text-amber-200">${def.name}</span>
                        <span class="martial-tier-badge ${tier.badge} ${tier.color} ml-1">${def.tier}</span>
                    </div>
                    <span class="text-xs text-zinc-500 shrink-0">${def.type}</span>
                </div>
                <p class="text-xs text-zinc-500 mb-2">${def.desc}</p>
                <div class="flex justify-between text-sm mb-1">
                    <span class="text-amber-400 font-bold">Lv.${level}</span>
                    <span class="text-zinc-500">최대 Lv.${def.maxLevel} · 잠재 Lv.${def.potentialMax}</span>
                </div>
                <div class="hp-bar mb-2"><div class="hp-fill ng-fill" style="width:${expPct}%"></div></div>
                <div class="text-xs text-zinc-400">
                    <span class="text-zinc-500">${def.effectDesc}:</span>
                    <span class="text-emerald-400 font-medium">${formatArtBonuses(bonuses, def)}</span>
                </div>
            </div>
        `;
    }).join('');

    const lockedHtml = locked.length ? `
        <div class="mt-4">
            <h4 class="text-xs text-zinc-500 mb-2"><i class="fas fa-lock mr-1"></i>미습득 상급 무공 <span class="text-purple-400/80">(기연·문파 필요)</span></h4>
            <div class="space-y-2">
                ${locked.map(def => {
                    const tier = TIER_META[def.tier] || TIER_META.상승;
                    return `
                        <div class="martial-card martial-locked opacity-70">
                            <div class="flex items-center gap-2">
                                <span>${def.icon}</span>
                                <span class="font-medium text-zinc-400">${def.name}</span>
                                <span class="martial-tier-badge ${tier.badge} ${tier.color}">${def.tier}</span>
                                <span class="text-xs text-zinc-600 ml-auto">${def.type}</span>
                            </div>
                            <p class="text-xs text-zinc-600 mt-1">${def.desc}</p>
                            <p class="text-xs text-purple-400/70 mt-1">잠재 Lv.${def.potentialMax} · 레벨당 상승치 높음</p>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    ` : '';

    return `
        <div class="mt-4">
            <h4 class="text-sm text-zinc-500 mb-2"><i class="fas fa-yin-yang mr-1"></i>습득 무공</h4>
            <p class="text-xs text-zinc-600 mb-3">기초 무공만 익힌 상태. 상승·일류 무공은 기연을 만나야 배울 수 있다.</p>
            <div class="space-y-3">${learnedHtml}</div>
            <div class="mt-3 text-xs text-center text-zinc-500 bg-zinc-800/40 rounded-lg py-2">
                회피율 <span class="text-cyan-400 font-bold">${evRate}%</span>
                <span class="text-zinc-600 mx-1">|</span>
                보법·기본 체질 반영
            </div>
            ${lockedHtml}
        </div>
    `;
}

