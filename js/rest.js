import * as state from './state.js';
import * as martial from './martial.js';
import * as ui from './ui.js';
import * as places from './places.js';
import * as sects from './sects.js';

/** 노숙 — 체력만, 낮은 회복 */
const CAMP = { hpRate: 0.22, ngRate: 0, oneStat: true, cost: 0, days: 1 };
/** 숙소 — 체력·내공 보통 회복 */
const INN = { hpRate: 0.55, ngRate: 0.55, oneStat: false, days: 1 };
/** 기연 / 문파 숙박 — 높은 회복 + 경험치 */
const PREMIUM = { hpRate: 1, ngRate: 1, oneStat: false, exp: 18, days: 1 };

const INN_COST = { metropolis: 28, city: 22, town: 16, village: 10, remote: 14, pass: 12 };
const KIYEON_SPOTS = new Set(['청성산', '峨嵋금정', '약초원', '도관', '금정대전', '산사']);

function applyRecovery(gs, rates, fullRestore = false) {
    const ngOk = martial.isNaegongUnlocked(gs);
    if (fullRestore) {
        const changes = { hp: gs.maxHp };
        if (ngOk) changes.naegong = gs.maxNaegong;
        state.modifyStats(changes);
        return;
    }
    if (rates.oneStat) {
        const gain = Math.max(1, Math.floor(gs.maxHp * rates.hpRate));
        state.modifyStats({ hp: Math.min(gs.maxHp, gs.hp + gain) });
        return;
    }
    const hpGain = Math.max(1, Math.floor(gs.maxHp * rates.hpRate));
    const changes = { hp: Math.min(gs.maxHp, gs.hp + hpGain) };
    if (ngOk && rates.ngRate > 0) {
        const ngGain = Math.max(1, Math.floor(gs.maxNaegong * rates.ngRate));
        changes.naegong = Math.min(gs.maxNaegong, gs.naegong + ngGain);
    }
    state.modifyStats(changes);
}

/** 읍·도시·대도, 또는 주막이 있는 곳만 숙박 가능 */
function hasInn(gs) {
    const profile = places.getPlaceProfile(gs.currentLocation, gs.currentArea);
    if (profile.shops?.includes('tavern')) return true;
    return ['metropolis', 'city', 'town'].includes(profile.scale);
}

function getInnNotice(gs) {
    if (hasInn(gs)) return null;
    const profile = places.getPlaceProfile(gs.currentLocation, gs.currentArea);
    const scale = places.getScaleInfo(profile.scale);
    if (profile.scale === 'village') {
        return '시골 촌락이라 숙박할 만한 숙소가 없다. 노숙만 가능하다.';
    }
    if (profile.scale === 'pass' || profile.scale === 'remote') {
        return '험한 곳이라 여관이 없다. 노숙밖에 할 수 없다.';
    }
    return `${scale.label}이지만 숙박 가능한 숙소가 없다. 노숙만 가능하다.`;
}

function getInnCost(gs) {
    const profile = places.getPlaceProfile(gs.currentLocation, gs.currentArea);
    return INN_COST[profile.scale] ?? 12;
}

/** 기연 숙소 — 특정 명승·산중 거점 */
export function canKiyeonRest(gs) {
    return KIYEON_SPOTS.has(gs.currentLocation);
}

/** 거대 문파(본문) 우호 숙박 */
export function getSectLodgingOption(gs) {
    const profile = places.getPlaceProfile(gs.currentLocation, gs.currentArea);
    let best = null;
    for (const sectId of profile.sects || []) {
        const sect = sects.getSect(sectId);
        if (!sect) continue;
        const aff = sects.getAffinity(sectId);
        if (sect.tier === '본문' && aff >= 15) {
            best = { sectId, sect, aff, need: 15 };
        } else if (sect.tier === '분파' && aff >= 28 && (!best || best.sect.tier !== '본문')) {
            best = { sectId, sect, aff, need: 28 };
        } else if (sect.tier === '속가' && aff >= 40 && !best) {
            best = { sectId, sect, aff, need: 40 };
        }
    }
    return best;
}

export function getRestOptions(gs) {
    const opts = [{
        id: 'camp',
        icon: '🌙',
        label: '노숙',
        desc: '체력만 약간 회복 (무료)',
        detail: `회복률 ${Math.round(CAMP.hpRate * 100)}% · 1일`,
        cost: 0,
    }];

    if (hasInn(gs)) {
        const cost = getInnCost(gs);
        opts.push({
            id: 'inn',
            icon: '🏨',
            label: '숙박',
            desc: '주막·여관에서 하룻밤',
            detail: `체력·내공 ${Math.round(INN.hpRate * 100)}% 회복 · ${cost}냥 · 1일`,
            cost,
        });
    }

    const lodging = getSectLodgingOption(gs);
    if (lodging) {
        opts.push({
            id: 'sect',
            icon: lodging.sect.icon,
            label: `${lodging.sect.name} 숙박`,
            desc: `우호 ${lodging.aff} — 문파 초대 숙소`,
            detail: '전폭 회복 · 경험치 · 1일',
            cost: 0,
            sectId: lodging.sectId,
        });
    }

    if (canKiyeonRest(gs)) {
        opts.push({
            id: 'kiyeon',
            icon: '✨',
            label: '기연 숙소',
            desc: '산중 기연·명승지',
            detail: '전폭 회복 · 경험치 증가 · 1일',
            cost: 0,
        });
    }

    return opts;
}

export function getRestMenuMeta(gs) {
    const innAvailable = hasInn(gs);
    return {
        innAvailable,
        notice: innAvailable ? null : getInnNotice(gs),
    };
}

export function performRest(type, sectId) {
    const gs = state.gameState;

    if (type === 'camp') {
        if (Math.random() < 0.08 && !KIYEON_SPOTS.has(gs.currentLocation)) {
            state.addLog('🌙 노숙 중 기연의 기운이 느껴진다…');
            doPremiumRest('🌟 노숙 중 기연을 만나 체력이 가득 차고 심득이 든다.');
            closeRestMenu();
            ui.updateAllUI();
            return;
        }
        applyRecovery(gs, CAMP);
        gs.day += CAMP.days;
        state.addLog(`🌙 길에서 노숙. 체력만 ${Math.round(CAMP.hpRate * 100)}% 회복 (제 ${gs.day}일)`);
        closeRestMenu();
        ui.updateAllUI();
        return;
    }

    if (type === 'inn') {
        const cost = getInnCost(gs);
        if (gs.gold < cost) {
            state.addLog(`숙박비 ${cost}냥이 필요하다.`);
            ui.updateAllUI();
            return;
        }
        state.modifyStats({ gold: gs.gold - cost });
        applyRecovery(gs, INN);
        gs.day += INN.days;
        state.addLog(`🏨 숙박하여 하룻밤. 체력·내공 ${Math.round(INN.hpRate * 100)}% 회복 (${cost}냥, 제 ${gs.day}일)`);
        closeRestMenu();
        ui.updateAllUI();
        return;
    }

    if (type === 'sect' && sectId) {
        const sect = sects.getSect(sectId);
        if (!sect) return;
        applyRecovery(gs, PREMIUM, true);
        gs.day += PREMIUM.days;
        state.gainExp(PREMIUM.exp + gs.level * 2);
        const aff = sects.modifyAffinity(sectId, 2);
        state.addLog(`🏠 ${sect.name} 초대 숙박. 전폭 회복·경험치 (우호 +2, ${sects.getAffinityLabel(aff).label}, 제 ${gs.day}일)`);
        closeRestMenu();
        ui.updateAllUI();
        return;
    }

    if (type === 'kiyeon') {
        doPremiumRest('✨ 기연 숙소에서 몸과 심법이 한층 깊어졌다.');
        closeRestMenu();
        ui.updateAllUI();
    }
}

function doPremiumRest(logText) {
    const gs = state.gameState;
    applyRecovery(gs, PREMIUM, true);
    gs.day += PREMIUM.days;
    state.gainExp(PREMIUM.exp + gs.level * 3);
    state.addLog(`${logText} (제 ${gs.day}일)`);
}

/** 하위 호환 — 노숙 */
export function rest() {
    performRest('camp');
}

export function openRestMenu() {
    state.gameState.placeUI = { view: 'rest' };
    ui.updateAllUI();
}

export function closeRestMenu() {
    if (state.gameState.placeUI?.view === 'rest') {
        state.gameState.placeUI = null;
        ui.updateAllUI();
    }
}