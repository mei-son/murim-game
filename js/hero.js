import * as state from './state.js';
import * as realm from './realm.js';

export const HERO_PROFILE_KEY = 'murim-hero-profile';

export function loadStoredHeroProfile() {
    try {
        const raw = localStorage.getItem(HERO_PROFILE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function persistHeroProfile(name) {
    const trimmed = (name || '').trim().slice(0, 12);
    if (!trimmed) return;
    localStorage.setItem(HERO_PROFILE_KEY, JSON.stringify({ name: trimmed, savedAt: Date.now() }));
}

export function clearStoredHeroProfile() {
    localStorage.removeItem(HERO_PROFILE_KEY);
}

export function shouldPromptHeroName() {
    const saved = loadStoredHeroProfile();
    return !(saved?.name || '').trim();
}

export function applyStoredHeroName(gs = state.gameState) {
    const saved = loadStoredHeroProfile();
    if (!saved?.name) return false;
    if (!gs.hero) gs.hero = { alias: '', masked: true };
    gs.hero.name = saved.name;
    return true;
}

export function getAliasDisplay(gs = state.gameState) {
    const alias = (gs.hero?.alias || '').trim();
    return alias || '없음';
}

/** 강호 성향 — 정·중·사 (표기: 중립 등) */
export function getDisposition(gs = state.gameState) {
    const { fame, notoriety } = gs;
    const diff = fame - notoriety;

    if (notoriety > fame + 3 || (notoriety >= 5 && diff < 0)) {
        return { short: '사', label: '사의', color: 'text-red-400', badge: 'bg-red-900/50 border-red-700' };
    }
    if (fame > notoriety + 3 || (fame >= 5 && diff > 0)) {
        return { short: '정', label: '정의', color: 'text-blue-400', badge: 'bg-blue-900/50 border-blue-700' };
    }
    return { short: '중', label: '중립', color: 'text-zinc-400', badge: 'bg-zinc-700/50 border-zinc-600' };
}

export function getPublicLabel(gs = state.gameState) {
    const disp = getDisposition(gs);
    const standing = gs.sectStanding;
    const alias = getAliasDisplay(gs);
    const hasAlias = !!(gs.hero?.alias || '').trim();

    if (standing?.rank === 'leader') {
        const sect = standing.sectFamily || standing.sectName;
        return {
            role: '문파장',
            sect,
            alias,
            hasAlias,
            disposition: disp,
            text: `${sect} 문파장`,
            withDisposition: `${sect} 문파장 · ${disp.label}`,
            publicName: `${sect} 문파장`,
            subtitle: `별호 ${alias} · 성향 ${disp.label} · ${standing.sectName}`,
        };
    }

    if (standing?.rank === 'disciple') {
        return {
            role: hasAlias ? alias : '없음',
            sect: standing.sectFamily,
            memberTitle: standing.memberTitle,
            alias,
            hasAlias,
            disposition: disp,
            text: hasAlias ? alias : '없음',
            withDisposition: hasAlias ? `${alias} · ${disp.label}` : `별호 없음 · ${disp.label}`,
            publicName: hasAlias ? alias : '무명객',
            subtitle: `${standing.sectFamily} ${standing.memberTitle} · 성향 ${disp.label}`,
        };
    }

    return {
        role: hasAlias ? alias : '없음',
        sect: '',
        alias,
        hasAlias,
        disposition: disp,
        text: hasAlias ? alias : '없음',
        withDisposition: hasAlias ? `${alias} · ${disp.label}` : `별호 없음 · ${disp.label}`,
        publicName: hasAlias ? alias : '무명객',
        subtitle: `별호 ${alias} · 성향 ${disp.label} · 복면을 쓴 행인`,
    };
}

export function getHeroDisplay(gs = state.gameState) {
    const h = gs.hero || {};
    const r = realm.getRealm(gs.level);
    const pub = getPublicLabel(gs);
    const name = (h.name || '').trim() || '이름 미정';

    return {
        name,
        alias: pub.alias,
        aliasDisplay: pub.alias,
        publicLabel: pub,
        publicName: pub.publicName,
        publicNameFull: pub.withDisposition,
        disposition: pub.disposition,
        sectStanding: gs.sectStanding || null,
        realm: r,
        realmName: r.name,
        subtitle: pub.subtitle,
        masked: h.masked !== false,
        fullTitle: `${name} · ${pub.withDisposition}`,
    };
}

export function setHeroName(name) {
    const gs = state.gameState;
    if (!gs.hero) gs.hero = { alias: '', masked: true };
    gs.hero.name = (name || '').trim().slice(0, 12);
    if (gs.hero.name) {
        persistHeroProfile(gs.hero.name);
        const pub = getPublicLabel(gs);
        state.addLog(`이름을 "${gs.hero.name}"(으)로 밝혔다. 별호 ${pub.alias} · 성향 ${pub.disposition.label}.`);
    }
    return gs.hero.name;
}

/** 별칭 획득 (예: 하급무사 위장) */
export function setHeroAlias(alias) {
    const gs = state.gameState;
    if (!gs.hero) gs.hero = { masked: true };
    gs.hero.alias = (alias || '').trim();
    if (gs.hero.alias) {
        state.addLog(`강호 별호를 【${gs.hero.alias}】로 쓰게 되었다.`);
    }
}