/** 경지 — 레벨이 오를수록 다음 경지까지 간격이 넓어짐 (제곱형 난이도) */
export const REALM_STAGES = [
    { id: 'choin', rank: 1, name: '무림초행인', minLevel: 1, color: 'text-zinc-400', badge: 'bg-zinc-700/50' },
    { id: 'imon', rank: 2, name: '입문', minLevel: 4, color: 'text-emerald-400', badge: 'bg-emerald-900/40' },
    { id: 'samryu', rank: 3, name: '삼류', minLevel: 9, color: 'text-blue-400', badge: 'bg-blue-900/40' },
    { id: 'iryu', rank: 4, name: '이류', minLevel: 20, color: 'text-purple-400', badge: 'bg-purple-900/40' },
    { id: 'ilyu', rank: 5, name: '일류', minLevel: 42, color: 'text-amber-300', badge: 'bg-amber-900/50' },
    { id: 'jeoljeong', rank: 6, name: '절정', minLevel: 75, color: 'text-rose-300', badge: 'bg-rose-900/40' },
];

/** 삼류 중반쯤 — 내공 개통 (레벨 기준, 추후 이벤트로 대체 가능) */
export const NAEGONG_UNLOCK_LEVEL = 13;

export function getRealm(level) {
    let current = REALM_STAGES[0];
    for (const stage of REALM_STAGES) {
        if (level >= stage.minLevel) current = stage;
        else break;
    }
    return current;
}

export function getNextRealm(level) {
    for (const stage of REALM_STAGES) {
        if (level < stage.minLevel) return stage;
    }
    return null;
}

export function getRealmProgress(level) {
    const current = getRealm(level);
    const next = getNextRealm(level);
    if (!next) return { current, next: null, pct: 100, need: 0 };
    const span = next.minLevel - current.minLevel;
    const prog = level - current.minLevel;
    return {
        current,
        next,
        pct: Math.min(100, Math.floor((prog / span) * 100)),
        need: next.minLevel - level,
    };
}