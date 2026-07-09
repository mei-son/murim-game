import * as state from './state.js';

export const STAMINA_MAX = 100;

/** 행동별 스테미나 소모 */
export const STAMINA_COST = {
    explore: 14,
    gather: 12,
    travelPerDay: 10,
    localTravelPerDay: 6,
    sectObserve: 10,
    sectSpar: 20,
    sectTrain: 18,
    sectDojo: 24,
    battleEvade: 28,
    battleRegen: 12,
};

/** 휴식 시 스테미나 회복 */
export const STAMINA_RESTORE = {
    camp: 22,
    inn: 55,
    premium: 100,
    dayPass: 8,
};

export function initStamina(gs = state.gameState) {
    if (gs.stamina == null) gs.stamina = STAMINA_MAX;
    if (gs.maxStamina == null) gs.maxStamina = STAMINA_MAX;
}

export function getStamina(gs = state.gameState) {
    initStamina(gs);
    return gs.stamina;
}

export function getMaxStamina(gs = state.gameState) {
    initStamina(gs);
    return gs.maxStamina;
}

export function canAfford(cost, gs = state.gameState) {
    return getStamina(gs) >= cost;
}

export function spend(cost, gs = state.gameState, silent = false) {
    initStamina(gs);
    const need = Math.max(0, cost);
    if (gs.stamina < need) return false;
    gs.stamina = Math.max(0, gs.stamina - need);
    return true;
}

export function restore(amount, gs = state.gameState) {
    initStamina(gs);
    gs.stamina = Math.min(gs.maxStamina, gs.stamina + Math.max(0, amount));
}

export function restoreFull(gs = state.gameState) {
    initStamina(gs);
    gs.stamina = gs.maxStamina;
}

export function getTravelStaminaCost(days, isLocal = false) {
    const per = isLocal ? STAMINA_COST.localTravelPerDay : STAMINA_COST.travelPerDay;
    return Math.max(per, days * per);
}

export function formatStamina(gs = state.gameState) {
    initStamina(gs);
    return `${gs.stamina}/${gs.maxStamina}`;
}

export function formatCostLabel(cost) {
    return `-${cost} SP`;
}

export function trySpendAction(actionKey, gs = state.gameState) {
    const cost = STAMINA_COST[actionKey];
    if (cost == null) return { ok: true, cost: 0 };
    if (!canAfford(cost, gs)) {
        return { ok: false, cost, current: getStamina(gs), reason: 'stamina' };
    }
    spend(cost, gs);
    return { ok: true, cost, current: getStamina(gs) };
}

export function trySpendTravel(days, isLocal, gs = state.gameState) {
    const cost = getTravelStaminaCost(days, isLocal);
    if (!canAfford(cost, gs)) {
        return { ok: false, cost, current: getStamina(gs), reason: 'stamina' };
    }
    spend(cost, gs);
    return { ok: true, cost, current: getStamina(gs) };
}

export function staminaBlockedMessage(actionLabel, cost, gs = state.gameState) {
    return `스테미나가 부족하여 ${actionLabel}할 수 없다. (필요 ${cost}, 보유 ${getStamina(gs)}) — 휴식으로 회복하세요.`;
}

export function onDayAdvanced(gs = state.gameState) {
    restore(STAMINA_RESTORE.dayPass, gs);
}