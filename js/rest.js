import * as state from './state.js';
import * as martial from './martial.js';
import * as ui from './ui.js';
import * as places from './places.js';
import * as sects from './sects.js';
import * as stamina from './stamina.js';

/** 노숙 — 체력만, 낮은 회복 */
const CAMP = { hpRate: 0.22, ngRate: 0, oneStat: true, cost: 0, days: 1 };
/** 숙소 — 체력·내공 보통 회복 */
const INN = { hpRate: 0.55, ngRate: 0.55, oneStat: false, days: 1 };
/** 기연 / 문파 숙박 — 높은 회복 + 경험치 */
const PREMIUM = { hpRate: 1, ngRate: 1, oneStat: false, exp: 18, days: 1 };

const INN_COST = { metropolis: 28, city: 22, town: 16, village: 10, remote: 14, pass: 12 };
const KIYEON_SPOTS = new Set(['청성산', '아미금정', '약초원', '도관', '금정대전', '산사']);
export const KIYEON_REST_COOLDOWN_DAYS = 7;
export const SECT_LODGE_AFFINITY_COST = 5;

function initKiyeonTracking(gs) {
    if (!gs.kiyeonExpClaimed) gs.kiyeonExpClaimed = [];
    if (!gs.kiyeonRestLog) gs.kiyeonRestLog = {};
}

export function hasClaimedKiyeonExp(gs, spotId = gs.currentLocation) {
    initKiyeonTracking(gs);
    return gs.kiyeonExpClaimed.includes(spotId);
}

function claimKiyeonExp(gs, spotId = gs.currentLocation) {
    initKiyeonTracking(gs);
    if (hasClaimedKiyeonExp(gs, spotId)) return false;
    gs.kiyeonExpClaimed.push(spotId);
    return true;
}

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

function getInnCost(gs) {
    const profile = places.getPlaceProfile(gs.currentLocation, gs.currentArea);
    return INN_COST[profile.scale] ?? 12;
}

/** 기연 숙소 — 특정 명승·산중 거점 */
export function canKiyeonRest(gs) {
    return KIYEON_SPOTS.has(gs.currentLocation);
}

/** 기연 숙소 이용 가능 (쿨다운) */
export function getKiyeonRestAccess(gs) {
    const spot = gs.currentLocation;
    if (!canKiyeonRest(gs)) return { ok: false, reason: 'none' };
    initKiyeonTracking(gs);
    const last = gs.kiyeonRestLog[spot];
    if (last != null && gs.day - last < KIYEON_REST_COOLDOWN_DAYS) {
        return {
            ok: false,
            reason: 'cooldown',
            waitDays: KIYEON_REST_COOLDOWN_DAYS - (gs.day - last),
        };
    }
    return {
        ok: true,
        firstExp: !hasClaimedKiyeonExp(gs, spot),
        cooldownDays: KIYEON_REST_COOLDOWN_DAYS,
    };
}

/** 문파 우호 숙박 */
export function getSectLodgingOption(gs) {
    const profile = places.getPlaceProfile(gs.currentLocation, gs.currentArea);
    let best = null;
    for (const sectId of profile.sects || []) {
        const sect = sects.getSect(sectId);
        if (!sect) continue;
        const aff = sects.getAffinity(sectId);
        const need = sects.getSectLodgingNeed(sect.tier);
        if (aff < need || aff <= 0) continue;
        if (!best || aff > best.aff) {
            best = { sectId, sect, aff, need, cost: SECT_LODGE_AFFINITY_COST };
        }
    }
    return best;
}

/** 우호·기연 숙소가 열려 있으면 일반 숙박 숨김 */
export function hasActivePremiumLodging(gs) {
    if (getSectLodgingOption(gs)) return true;
    return getKiyeonRestAccess(gs).ok;
}

export function getRestOptions(gs) {
    const opts = [{
        id: 'camp',
        icon: '🌙',
        label: '노숙',
        desc: '체력만 약간 회복 (무료)',
        detail: `회복률 ${Math.round(CAMP.hpRate * 100)}% · 스테미나 +${stamina.STAMINA_RESTORE.camp} · 1일`,
        cost: 0,
    }];

    if (hasInn(gs) && !hasActivePremiumLodging(gs)) {
        const cost = getInnCost(gs);
        opts.push({
            id: 'inn',
            icon: '🏨',
            label: '숙박',
            desc: '주막·여관에서 하룻밤',
            detail: `체력·내공 ${Math.round(INN.hpRate * 100)}% · 스테미나 +${stamina.STAMINA_RESTORE.inn} · ${cost}냥 · 1일`,
            cost,
        });
    }

    const lodging = getSectLodgingOption(gs);
    if (lodging) {
        opts.push({
            id: 'sect',
            icon: lodging.sect.icon,
            label: `${lodging.sect.name} 숙박`,
            desc: `${sects.formatAffinityRequirement(lodging.need)} — 문파 초대 숙소`,
            detail: `전폭 회복 · 경험치 · 교분 -${lodging.cost} · 1일`,
            cost: 0,
            sectId: lodging.sectId,
        });
    }

    const kiyeon = getKiyeonRestAccess(gs);
    if (kiyeon.ok) {
        opts.push({
            id: 'kiyeon',
            icon: '✨',
            label: '기연 숙소',
            desc: '산중 기연·명승지',
            detail: kiyeon.firstExp
                ? `전폭 회복 · 경험치·무공 숙련 (장소당 1회) · ${kiyeon.cooldownDays}일마다 1회 · 1일`
                : `전폭 회복 · 기연 체득 완료 · ${kiyeon.cooldownDays}일마다 1회 · 1일`,
            cost: 0,
            kiyeonFirstExp: kiyeon.firstExp,
        });
    }

    return opts;
}

export function getRestMenuMeta() {
    return { innAvailable: false, notice: null };
}

export function performRest(type, sectId) {
    const gs = state.gameState;

    if (type === 'camp') {
        if (Math.random() < 0.08 && !KIYEON_SPOTS.has(gs.currentLocation) && !hasClaimedKiyeonExp(gs)) {
            state.addLog('🌙 노숙 중 기연의 기운이 느껴진다…');
            claimKiyeonExp(gs);
            doPremiumRest('🌟 노숙 중 기연을 만나 체력이 가득 차고 심득이 든다.', { firstKiyeon: true });
            closeRestMenu();
            ui.updateAllUI();
            return;
        }
        applyRecovery(gs, CAMP);
        stamina.restore(stamina.STAMINA_RESTORE.camp, gs);
        gs.day += CAMP.days;
        sects.onDayAdvanced(gs, 'rest');
        stamina.onDayAdvanced(gs);
        state.addLog(`🌙 길에서 노숙. 체력 ${Math.round(CAMP.hpRate * 100)}% · 스테미나 +${stamina.STAMINA_RESTORE.camp} (제 ${gs.day}일)`);
        closeRestMenu();
        ui.updateAllUI();
        return;
    }

    if (type === 'inn') {
        if (hasActivePremiumLodging(gs)) {
            ui.updateAllUI();
            return;
        }
        const cost = getInnCost(gs);
        if (gs.gold < cost) {
            state.addLog(`숙박비 ${cost}냥이 필요하다.`);
            ui.updateAllUI();
            return;
        }
        state.modifyStats({ gold: gs.gold - cost });
        applyRecovery(gs, INN);
        stamina.restore(stamina.STAMINA_RESTORE.inn, gs);
        gs.day += INN.days;
        sects.onDayAdvanced(gs, 'rest');
        stamina.onDayAdvanced(gs);
        state.addLog(`🏨 숙박하여 하룻밤. 체력·내공 ${Math.round(INN.hpRate * 100)}% · 스테미나 +${stamina.STAMINA_RESTORE.inn} (${cost}냥, 제 ${gs.day}일)`);
        closeRestMenu();
        ui.updateAllUI();
        return;
    }

    if (type === 'sect' && sectId) {
        const sect = sects.getSect(sectId);
        if (!sect) return;
        const lodging = getSectLodgingOption(gs);
        if (!lodging || lodging.sectId !== sectId) {
            ui.updateAllUI();
            return;
        }
        const { next, spent } = sects.spendAffinity(sectId, SECT_LODGE_AFFINITY_COST);
        if (spent <= 0) {
            ui.updateAllUI();
            return;
        }
        applyRecovery(gs, PREMIUM, true);
        stamina.restoreFull(gs);
        gs.day += PREMIUM.days;
        sects.onDayAdvanced(gs, 'rest');
        stamina.onDayAdvanced(gs);
        state.gainExp(PREMIUM.exp + gs.level * 2);
        state.addLog(`🏠 ${sect.name} 초대 숙박. 전폭 회복·스테미나 만충 (교분 -${spent} → ${sects.getAffinityLabel(next).label} ${next}, 제 ${gs.day}일)`);
        closeRestMenu();
        ui.updateAllUI();
        return;
    }

    if (type === 'kiyeon') {
        const access = getKiyeonRestAccess(gs);
        if (!access.ok) {
            ui.updateAllUI();
            return;
        }
        const spot = gs.currentLocation;
        initKiyeonTracking(gs);
        gs.kiyeonRestLog[spot] = gs.day;
        const firstKiyeon = access.firstExp && claimKiyeonExp(gs, spot);
        if (firstKiyeon) {
            doPremiumRest('✨ 기연 숙소에서 몸과 심법이 한층 깊어졌다.', { firstKiyeon: true });
        } else {
            applyRecovery(gs, PREMIUM, true);
            stamina.restoreFull(gs);
            gs.day += PREMIUM.days;
            sects.onDayAdvanced(gs, 'rest');
            stamina.onDayAdvanced(gs);
            state.addLog(`✨ 기연 숙소에서 몸을 추스렸다. 스테미나 만충 (제 ${gs.day}일)`);
        }
        closeRestMenu();
        ui.updateAllUI();
    }
}

function doPremiumRest(logText, { firstKiyeon = true } = {}) {
    const gs = state.gameState;
    applyRecovery(gs, PREMIUM, true);
    stamina.restoreFull(gs);
    gs.day += PREMIUM.days;
    sects.onDayAdvanced(gs, 'rest');
    stamina.onDayAdvanced(gs);
    if (firstKiyeon) {
        state.gainExp(PREMIUM.exp + gs.level * 3);
        const martialUps = martial.gainMartialEnlightenmentExp(32 + gs.level * 3);
        const upNote = martialUps.length
            ? ` · 무공 ${martialUps.map(u => `${u.name} Lv.${u.level}`).join(', ')}`
            : ' · 무공 숙련 상승';
        state.addLog(`${logText} (경험치·무공 기연${upNote}, 제 ${gs.day}일)`);
        return;
    }
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