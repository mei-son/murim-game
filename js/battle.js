import * as state from './state.js';
import * as ui from './ui.js';
import * as encounters from './encounters.js';
import * as martial from './martial.js';
import * as hero from './hero.js';
import * as enlightenment from './enlightenment.js';
import * as intel from './intel.js';
import * as battleSd from './battle-sd.js';
import * as debug from './debug.js';
import * as stamina from './stamina.js';
import * as inventory from './inventory.js';
import * as exchange from './battle-exchange.js';

let currentEnemy = null;
let battleLog = [];
let onVictory = null;
let battleContext = 'normal';
let playerHasInitiative = true;
let pendingTravelResolve = null;
let battleWasManual = false;
let battleRound = 0;
let victoryRewardMode = 'default';
let pendingBattleFinalize = null;
let enemyBattleStamina = 100;
let battleResolutionPending = false;
let battleResolutionTimer = null;
/** 전투 중 무공별 숙련 누적 { artId: exp } */
let battleMartialUsage = {};

function getPlayerBattleStamina(gs = state.gameState) {
    stamina.initStamina(gs);
    return gs.stamina;
}

export function getBattleDebugState() {
    return {
        battleContext,
        battleRound,
        battleWasManual,
        pendingTravelResolve: !!pendingTravelResolve,
        pendingBattleFinalize: !!pendingBattleFinalize,
        hasEnemy: !!currentEnemy,
        enemyName: currentEnemy?.name || null,
        enemyNamed: !!currentEnemy?.named,
    };
}

const EVADE_ACTION_BONUS = 15;
const BATTLE_STAMINA_MAX = 100;
const EVADE_STAMINA_COST = stamina.STAMINA_COST.battleEvade;
const STAMINA_REGEN_PER_EXCHANGE = stamina.STAMINA_COST.battleRegen;
const LOW_HP_EVADE_MAX_BONUS = 20;
const MAX_ACTIVE_EVADE_CHANCE = 85;

function resetBattleStance() {
    battleRound = 0;
    playerHasInitiative = Math.random() < 0.5;
    battleMartialUsage = {};
    battleResolutionPending = false;
    if (battleResolutionTimer) {
        window.clearTimeout(battleResolutionTimer);
        battleResolutionTimer = null;
    }
    stamina.initStamina(state.gameState);
    inventory.initInventory(state.gameState);
    martial.initMartialArts(state.gameState);
    enemyBattleStamina = BATTLE_STAMINA_MAX;
}

/** 마지막 타격 연출·HP 0 표시 후 승패 처리 */
function estimateExchangePresentationMs(playerAction, enemyAction, result) {
    let ms = 0;
    const pAnim = playerAction === 'skill' ? 'skill' : playerAction;
    if (['attack', 'defend', 'evade', 'skill'].includes(playerAction)) {
        ms = Math.max(ms, battleSd.getAnimMs(pAnim));
    }
    if (result.enemyDamage > 0) {
        ms = Math.max(ms, battleSd.getAnimMs('hit') + 200);
    } else if (enemyAction === 'attack') {
        ms = Math.max(ms, battleSd.getAnimMs('attack'));
    }
    if (result.playerDamage > 0) {
        ms = Math.max(ms, battleSd.getAnimMs('hit'));
    }
    return ms + 720;
}

function scheduleBattleResolution(callback, delayMs) {
    battleResolutionPending = true;
    battleResolutionTimer = window.setTimeout(() => {
        battleResolutionTimer = null;
        battleResolutionPending = false;
        callback();
    }, delayMs);
}

function presentBattleVictory(enemy, playerAction, enemyAction, result) {
    enemy.hp = 0;
    logBattle(`🎉 ${getEnemyDisplayName(enemy)}을(를) 물리쳤다!`, 'system');
    refreshBattleHud();
    updateBattleUI();
    scheduleBattleResolution(() => endBattle(true), estimateExchangePresentationMs(playerAction, enemyAction, result));
}

function presentBattleDefeat(gs, playerAction, enemyAction, result) {
    logBattle('💀 쓰러졌다...', 'system');
    refreshBattleHud();
    updateBattleUI();
    const delay = Math.max(estimateExchangePresentationMs(playerAction, enemyAction, result), battleSd.getAnimMs('hit') + 500);
    scheduleBattleResolution(() => endBattle(false, true), delay);
}

function recordBattleMartialUsage(gs, result, action) {
    const style = exchange.getPlayerBattleStyle(gs);
    martial.accumulateBattleMartialUsage(battleMartialUsage, style, result, action);
}

function calcLowHpEvasionBonus(hp, maxHp) {
    if (!maxHp || maxHp <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    return Math.floor((1 - ratio) * LOW_HP_EVADE_MAX_BONUS);
}

function getEnemyLevel(enemy) {
    return encounters.estimateEnemyLevel(enemy, state.gameState.level);
}

function getEnemyPassiveEvasion(enemy) {
    if (enemy?.evasionRate != null) return enemy.evasionRate;
    const gs = state.gameState;
    const enemyLv = getEnemyLevel(enemy);
    const gap = enemyLv - gs.level;
    const defPart = Math.floor((enemy?.def || 0) * 0.55);
    const levelPart = Math.min(26, 3 + Math.floor(enemyLv * 1.15));
    const gapBonus = gap > 0 ? Math.min(16, gap * 3) : Math.max(-4, gap);
    return Math.min(40, 5 + defPart + levelPart + gapBonus);
}

function getEnemyEvadeTendency(enemy, gs = state.gameState) {
    const gap = getEnemyLevel(enemy) - gs.level;
    if (gap >= 4) return '매우 높음';
    if (gap >= 2) return '높음';
    if (gap >= 1) return '보통';
    return '낮음';
}

function pickEnemyAction(enemy, gs = state.gameState, eStamina = enemyBattleStamina) {
    return exchange.pickEnemyBattleAction(enemy, gs, eStamina, EVADE_STAMINA_COST);
}

function describeEnemyEvade(enemy, success) {
    const passive = getEnemyPassiveEvasion(enemy);
    const active = getEnemyActiveEvadeChance(enemy);
    const name = enemy.name;
    if (success) {
        if (passive >= 34) return `${name}의 보법이 안개처럼 흩어졌다 (회피 ${active}%) — 공격이 허공을 갈랐다!`;
        if (passive >= 22) return `${name}이 몸을 날렸다 (회피 ${active}%) — 간발의 차이로 비껴갔다!`;
        return `${name}이 어설프게 몸을 비틀었으나 맞지 않았다 (회피 ${active}%) — 가까스로 피했다!`;
    }
    if (passive >= 28) return `${name} — 거의 피했으나 빈틈이 드러났다 (회피 ${active}% 시도)`;
    if (passive >= 14) return `${name}의 몸놀림이 늦었다 (회피 ${active}% 시도) — 회피 실패!`;
    return `${name}의 회피 실패! 움직임이 굳었다 (회피 ${active}%)`;
}

function getActiveEvadeChanceFor(hp, maxHp, passiveRate) {
    const lowHpBonus = calcLowHpEvasionBonus(hp, maxHp);
    return Math.min(MAX_ACTIVE_EVADE_CHANCE, passiveRate + EVADE_ACTION_BONUS + lowHpBonus);
}

function canEvade(isPlayer = true) {
    if (isPlayer) return getPlayerBattleStamina() >= EVADE_STAMINA_COST;
    return enemyBattleStamina >= EVADE_STAMINA_COST;
}

function spendEvadeStamina(isPlayer = true) {
    if (isPlayer) {
        stamina.spend(EVADE_STAMINA_COST, state.gameState);
    } else {
        enemyBattleStamina = Math.max(0, enemyBattleStamina - EVADE_STAMINA_COST);
    }
}

function regenBattleStamina() {
    stamina.restore(STAMINA_REGEN_PER_EXCHANGE, state.gameState);
    enemyBattleStamina = Math.min(BATTLE_STAMINA_MAX, enemyBattleStamina + STAMINA_REGEN_PER_EXCHANGE);
}

function inferBattleLogSide(text) {
    const raw = String(text);
    if (/^(⚔️|🤖|⏱️)|전투가 시작|조우!|자동 전투|네임드 무인/.test(raw)) return 'system';
    if (/^(🎉|💀)|전투에서 패배|쓰러졌다|물리쳤다|승부가 나지/.test(raw)) return 'system';
    if (/^적 Lv\./.test(raw)) return 'enemy';
    if (/^💥/.test(raw)) return 'enemy';
    if (/의 공격!|회피 후 반격!| 치명타!/.test(raw) && !/^(공격|회피 후 반격|치명타)!/.test(raw)) return 'enemy';
    if (/→ .+의 반격|→ 빈틈을 찔렀다/.test(raw)) return 'enemy';
    if (/💨[^→]*→ [^즉].+ 반격/.test(raw)) return 'enemy';
    if (/💨[^→]*→ .+ 치명타/.test(raw) && !/빈틈 발견/.test(raw)) return 'enemy';
    if (/^[^—→]+(이|의) (보법|몸놀림|회피)/.test(raw)) return 'enemy';
    if (/— 거의 피했으나 빈틈/.test(raw)) return 'enemy';
    if (/^(공격|치명타|회피 후 반격|내공술)!|에게 \d+ 피해/.test(raw)) return 'player';
    if (/방어 자세|스테미나가 고갈|도망|아직 내공|내공이 부족/.test(raw)) return 'player';
    if (/^회피 \d+%/.test(raw)) return 'player';
    if (/^(⚡|🗡️|🛡️)/.test(raw)) return 'player';
    if (/^(발끝|오행보법|어설프게|거의 피했으나 맞|몸놀림이 늦|회피 실패! 움직)/.test(raw)) return 'player';
    if (/→ 즉시 반격|→ 빈틈 발견/.test(raw)) return 'player';
    if (/💨/.test(raw)) return 'player';
    return 'system';
}

function normalizeLogEntry(entry) {
    if (typeof entry === 'string') {
        return { type: 'line', text: entry, side: inferBattleLogSide(entry) };
    }
    if (entry.type === 'line' && !entry.side) {
        return { ...entry, side: inferBattleLogSide(entry.text) };
    }
    return entry;
}

function logBattle(text, side = 'system') {
    battleLog.push({ type: 'line', text, side });
}

function startExchange() {
    regenBattleStamina();
    battleRound += 1;
    battleLog.push({ type: 'round', n: battleRound });
}

function describeEvade(gs, success, hp = gs.hp) {
    const passive = martial.getEvasionRate(gs);
    const active = getActiveEvadeChanceFor(hp, gs.maxHp, passive);
    if (success) {
        if (passive >= 36) return `오행보법에 몸이 바람처럼 흐른다 (회피 ${active}%) — 공격을 흘려보냈다!`;
        if (passive >= 21) return `발끝이 가벼워졌다 (회피 ${active}%) — 간발의 차이로 비껴갔다!`;
        return `어설프게 몸을 비틀었으나 맞지 않았다 (회피 ${active}%) — 가까스로 피했다!`;
    }
    if (passive >= 30) return `거의 피했으나 맞았다 (회피 ${active}% 시도) — 회피 실패!`;
    if (passive >= 15) return `몸놀림이 늦었다 (회피 ${active}% 시도) — 빈틈이 드러났다!`;
    return `회피 실패! 움직임이 굳었다 (회피 ${active}%)`;
}

function appendBattleIntro(gs) {
    const initLabel = playerHasInitiative ? '선공' : '후공';
    const ngUnlocked = martial.isNaegongUnlocked(gs);
    logBattle(`🎲 ${initLabel} — 한합마다 동시에 행동을 정하고 겨룬다`, 'system');
    logBattle('✊ 묵찌바 — 공격→회피 · 회피→방어 · 방어→공격', 'system');
    const weaponNote = inventory.formatWeaponDurability(gs);
    const style = exchange.getPlayerBattleStyle(gs);
    logBattle(`무기: ${weaponNote} · 전투형 ${style.label}`, 'player');
    const passive = martial.getEvasionRate(gs);
    const active = getActiveEvadeChance(gs);
    const lowHpBonus = calcLowHpEvasionBonus(gs.hp, gs.maxHp);
    let evadeNote = '회피 기량이 낮다';
    if (passive >= 36) evadeNote = '보법이 몸에 배어 있다';
    else if (passive >= 21) evadeNote = '발놀림이 괜찮다';
    const lowHpNote = lowHpBonus > 0 ? ` · 위기 보너스 +${lowHpBonus}%` : '';
    const critNote = ngUnlocked
        ? '내공술=필살(회심) · 회피=회피만'
        : '회피 성공=회심(치명)';
    logBattle(`${critNote} · 회피 ${passive}% (${evadeNote}) · 적극 ${active}%${lowHpNote} · 실패×${exchange.EVADE_FAIL_MULT} · 스테미나 ${EVADE_STAMINA_COST}/회`, 'player');
    if (currentEnemy) {
        const enemyLv = getEnemyLevel(currentEnemy);
        const enemyPassive = getEnemyPassiveEvasion(currentEnemy);
        const enemyActive = getEnemyActiveEvadeChance(currentEnemy);
        const enemyLowHp = calcLowHpEvasionBonus(currentEnemy.hp, currentEnemy.maxHp);
        const enemyLowNote = enemyLowHp > 0 ? ` · 위기 +${enemyLowHp}%` : '';
        const tendency = getEnemyEvadeTendency(currentEnemy, gs);
        logBattle(`Lv.${enemyLv} · 회피 ${enemyPassive}% · 적극 회피 ${enemyActive}%${enemyLowNote} · 회피 성향 ${tendency}`, 'enemy');
    }
}

function calcAttackDamage(gs, enemy, mult = 1) {
    const pAtk = exchange.getPlayerBattleAtk(gs);
    return exchange.calcBattleDamage(pAtk, enemy.def, mult, playerHasInitiative);
}

function getActiveEvadeChance(gs) {
    return getActiveEvadeChanceFor(gs.hp, gs.maxHp, martial.getEvasionRate(gs));
}

function getEnemyActiveEvadeChance(enemy) {
    return getActiveEvadeChanceFor(enemy.hp, enemy.maxHp, getEnemyPassiveEvasion(enemy));
}

function rollActiveEvade(gs, hp = gs.hp) {
    const passive = martial.getEvasionRate(gs);
    return Math.random() * 100 < getActiveEvadeChanceFor(hp, gs.maxHp, passive);
}

function rollEnemyActiveEvade(enemy) {
    return Math.random() * 100 < getEnemyActiveEvadeChance(enemy);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function classifyBattleLine(raw, side) {
    let cls = 'battle-log-line';
    if (side === 'player') {
        if (/치명타|회심|필살/.test(raw)) cls += ' battle-log-crit battle-log-player-atk';
        else if (/회피|💨/.test(raw)) cls += ' battle-log-evade';
        else if (/방어/.test(raw)) cls += ' battle-log-defend';
        else if (/도망/.test(raw)) cls += ' battle-log-flee';
        else cls += ' battle-log-player-atk';
    } else if (side === 'enemy') {
        if (/치명타|회심|필살/.test(raw)) cls += ' battle-log-crit battle-log-enemy-atk';
        else if (/회피|💨/.test(raw)) cls += ' battle-log-evade battle-log-enemy-atk';
        else if (/방어/.test(raw)) cls += ' battle-log-defend battle-log-enemy-atk';
        else cls += ' battle-log-enemy-atk';
    } else if (/🎉|물리쳤다/.test(raw)) cls += ' battle-log-victory';
    else if (/💀|패배|쓰러/.test(raw)) cls += ' battle-log-defeat';
    else cls += ' battle-log-system';
    return cls;
}

function formatBattleLogEntry(entry) {
    const item = normalizeLogEntry(entry);
    if (item.type === 'round') {
        return `<div class="battle-round-divider"><span>제 ${item.n}합</span></div>`;
    }

    const raw = String(item.text);
    const side = item.side || inferBattleLogSide(raw);
    const cls = classifyBattleLine(raw, side);

    let html = escapeHtml(raw);

    html = html.replace(
        /^(⚡\s*)?(🗡️\s*)?(공격|치명타|회피 후 반격|내공술)(!)?/,
        (_, p1, p2, action, bang) => `${p1 || ''}${p2 || ''}<span class="battle-action">${action}${bang || ''}</span>`,
    );
    html = html.replace(/(\d+)\s*피해/g, '<span class="battle-dmg">$1</span> 피해');
    html = html.replace(/(회피 성공|회피 실패|💨\s*회피|반격|빈틈|치명타|내공술)/g, '<span class="battle-action">$1</span>');

    const whoLabel = side === 'player' ? '나' : (side === 'enemy' ? (currentEnemy?.name || '적') : '');
    const whoHtml = whoLabel
        ? `<span class="battle-log-who">${escapeHtml(whoLabel)}</span>`
        : '';

    return `<div class="battle-log-row battle-log-row--${side}"><p class="${cls}">${whoHtml}${html}</p></div>`;
}

function renderBattleLog() {
    const logEl = document.getElementById('battle-log');
    if (!logEl) return;
    const entries = battleLog.slice().reverse().map(formatBattleLogEntry).join('');
    logEl.innerHTML = entries;
    logEl.scrollTop = 0;
}

/** HP·전투 로그만 즉시 반영 (합 중간 갱신) */
function refreshBattleHud() {
    const gs = state.gameState;
    const enemy = currentEnemy;
    if (!enemy) return;

    document.getElementById('player-hp-bar').style.width = `${(gs.hp / gs.maxHp) * 100}%`;
    document.getElementById('player-hp-text').textContent = `${gs.hp}/${gs.maxHp}`;
    const ngUnlocked = martial.isNaegongUnlocked(gs);
    const ngPct = ngUnlocked && gs.maxNaegong > 0 ? (gs.naegong / gs.maxNaegong) * 100 : 0;
    document.getElementById('player-ng-bar').style.width = `${ngPct}%`;
    document.getElementById('player-ng-text').textContent = ngUnlocked
        ? `${gs.naegong}/${gs.maxNaegong}`
        : '내공 미타동';
    document.getElementById('enemy-hp-bar').style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
    document.getElementById('enemy-hp-text').textContent = `${enemy.hp}/${enemy.maxHp}`;
    renderBattleLog();
}

function pickAutoPlayerAction(gs, enemy, stamina = BATTLE_STAMINA_MAX) {
    if (martial.isNaegongUnlocked(gs) && gs.naegong >= 15 && enemy.hp > exchange.getPlayerBattleAtk(gs) * 1.5 && Math.random() < 0.28) {
        return 'skill';
    }
    const roll = Math.random();
    if (roll < 0.46) return 'attack';
    if (roll < 0.64 && stamina >= EVADE_STAMINA_COST) return 'evade';
    if (roll < 0.82) return 'defend';
    return 'attack';
}

function autoBattleLog(log, text, side) {
    log.push({ type: 'line', text, side });
}

export function simulateAutoBattle(gs, enemy) {
    enemy = exchange.initEnemyWeapon(exchange.tuneEnemyForBattle(
        encounters.scaleEnemyForBattle(enemy, gs),
    ));
    const log = [];
    let pHp = gs.hp;
    let pNg = gs.naegong;
    let eSnap = { ...enemy };
    let turn = 0;
    let pStamina = getPlayerBattleStamina(gs);
    let eStamina = BATTLE_STAMINA_MAX;
    const initiative = Math.random() < 0.5;
    const maxTurns = 36;
    const gsSnap = { ...gs };
    const martialUsage = {};

    while (pHp > 0 && eSnap.hp > 0 && turn < maxTurns) {
        turn++;
        pStamina = Math.min(gs.maxStamina || BATTLE_STAMINA_MAX, pStamina + STAMINA_REGEN_PER_EXCHANGE);
        eStamina = Math.min(BATTLE_STAMINA_MAX, eStamina + STAMINA_REGEN_PER_EXCHANGE);
        log.push({ type: 'round', n: turn });

        let pAction = pickAutoPlayerAction({ ...gsSnap, naegong: pNg, hp: pHp }, eSnap, pStamina);
        if (pAction === 'evade' && pStamina < EVADE_STAMINA_COST) pAction = 'attack';
        let eAction = pickEnemyAction(eSnap, gsSnap, eStamina);
        if (eAction === 'evade' && eStamina < EVADE_STAMINA_COST) eAction = 'attack';

        if (pAction === 'evade') pStamina -= EVADE_STAMINA_COST;
        if (eAction === 'evade') eStamina -= EVADE_STAMINA_COST;

        const result = exchange.resolveExchange(
            { ...gsSnap, hp: pHp, naegong: pNg },
            eSnap,
            pAction,
            eAction,
            initiative,
            {
                naegongOk: martial.isNaegongUnlocked(gsSnap) && pNg >= 15,
                naegongUnlocked: martial.isNaegongUnlocked(gsSnap),
            },
        );

        if (result.fleeSuccess === true) {
            autoBattleLog(log, '도망 성공', 'player');
            return {
                victory: false,
                defeat: false,
                fled: true,
                playerHp: pHp,
                playerNg: pNg,
                playerStamina: pStamina,
                enemyHp: eSnap.hp,
                log,
                turns: turn,
                martialUsage,
            };
        }

        if (result.naegongCost) pNg -= result.naegongCost;
        mergeEnemyWeaponState(eSnap, result.enemy);
        pHp = Math.max(0, pHp - result.playerDamage);
        eSnap.hp = Math.max(0, eSnap.hp - result.enemyDamage);
        martial.accumulateBattleMartialUsage(
            martialUsage,
            exchange.getPlayerBattleStyle({ ...gsSnap, hp: pHp }),
            result,
            pAction,
        );

        for (const line of result.lines) {
            autoBattleLog(log, line.text, line.side);
        }
        autoBattleLog(log, `(HP 나 ${Math.max(0, pHp)} / 적 ${Math.max(0, eSnap.hp)})`, 'system');
    }

    const victory = eSnap.hp <= 0 && pHp > 0;
    const defeat = pHp <= 0 || (!victory && turn >= maxTurns);

    return {
        victory,
        defeat,
        playerHp: Math.max(0, pHp),
        playerNg: Math.max(0, pNg),
        playerStamina: Math.max(0, pStamina),
        enemyHp: Math.max(0, eSnap.hp),
        log,
        turns: turn,
        martialUsage,
    };
}

export function applyBattleStats(result) {
    const changes = { hp: result.playerHp, naegong: result.playerNg };
    state.modifyStats(changes);
    if (result.playerStamina != null) {
        stamina.initStamina(state.gameState);
        state.gameState.stamina = Math.max(0, result.playerStamina);
    }
}

export function getDailyEncounterChance(fame, totalDays) {
    return encounters.getTravelEncounterChance(fame, totalDays);
}

export function pickTravelEnemy(travelDays, fame) {
    return encounters.pickTravelEnemy(travelDays, fame);
}

function getEnemyDisplayName(enemy) {
    return enemy.displayName || enemy.name;
}

function buildVictoryRewards(enemy) {
    const opts = { manual: battleWasManual, usageMap: { ...battleMartialUsage } };
    if (enemy.named) return encounters.applyNamedVictoryRewards(enemy, opts);
    return encounters.applyNormalVictoryRewards(enemy, opts);
}

function buildVictoryResultSubtitle(enemy, rewards) {
    const parts = [];
    if (enemy?.named && enemy.title) parts.push(enemy.title);
    if (rewards.martialExpGain) {
        let m = `무공 숙련 +${rewards.martialExpGain}`;
        if (rewards.martialByArt) {
            const detail = Object.entries(rewards.martialByArt)
                .map(([id, exp]) => `${martial.getArtDef(id)?.name || id} +${exp}`)
                .join(', ');
            if (detail) m += ` (${detail})`;
        }
        if (rewards.martialLevelUps?.length) {
            m += ` → ${rewards.martialLevelUps.map(u => `${u.name} Lv.${u.level}`).join(', ')}`;
        }
        parts.push(m);
    }
    if (rewards.naegongExpGain) parts.push(`내공 EXP +${rewards.naegongExpGain}`);
    if (rewards.manual && rewards.expBonus) parts.push(`수동 EXP 보너스 +${rewards.expBonus}`);
    return parts.join(' · ');
}

function showManualVictoryResult(enemy, rewards) {
    const label = getEnemyDisplayName(enemy);
    ui.showBattleResultModal({
        icon: enemy?.named ? (enemy.icon || '⚔️') : '⚔️',
        title: enemy?.named ? `${enemy.name} 격파!` : `${label} 격파!`,
        subtitle: buildVictoryResultSubtitle(enemy, rewards),
        fame: rewards.fameGain || 0,
        exp: rewards.expGain || 0,
        gold: rewards.goldGain || 0,
        item: rewards.item || null,
    });
}

export function finalizePendingBattleEnd() {
    if (!pendingBattleFinalize) {
        ui.closeBattleResultModal();
        return;
    }
    const fn = pendingBattleFinalize;
    pendingBattleFinalize = null;
    ui.closeBattleResultModal();
    fn();
}

export function startBattle(enemyName, hp, atk, def, victoryCallback) {
    const enemy = { name: enemyName, hp, maxHp: hp, atk, def };
    startBattleFromEnemy(enemy, 'normal', victoryCallback);
}

export function startNamedBattle(enemy, context = 'normal', victoryCallback) {
    startBattleFromEnemy(enemy, context, victoryCallback);
}

export function startBattleFromEnemy(enemy, context = 'normal', victoryCallback) {
    debug.log('battle', 'startBattleFromEnemy', { context, enemy: enemy?.name, named: enemy?.named });
    let scaled = encounters.scaleEnemyForBattle(enemy, state.gameState, { context });
    scaled = exchange.tuneEnemyForBattle(scaled);
    scaled = exchange.initEnemyWeapon(scaled);
    currentEnemy = { ...scaled, maxHp: scaled.maxHp || scaled.hp };
    const label = getEnemyDisplayName(currentEnemy);
    battleLog = [];
    logBattle(currentEnemy.named
        ? `⚔️ 네임드 무인 ${label}(과)의 대결!`
        : `⚔️ ${label}(과)와 전투가 시작되었다!`);
    victoryRewardMode = victoryCallback ? 'custom' : 'default';
    if (victoryCallback) {
        if (context === 'named_spar' || context === 'spar') {
            onVictory = (won) => victoryCallback(!!won);
        } else {
            onVictory = () => victoryCallback(true);
        }
    } else {
        onVictory = null;
    }
    battleContext = context;
    resetBattleStance();
    battleRound = 0;
    battleWasManual = !state.gameState.autoBattle;

    if (state.gameState.autoBattle) {
        battleWasManual = false;
        runAutoBattle();
        return;
    }
    appendBattleIntro(state.gameState);
    showBattleModal();
    updateBattleUI();
}

function formatExpRewardNote(rewards) {
    if (!rewards.manual || !rewards.expBonus) return '';
    return ` · 수동 전투 EXP +${rewards.expBonus} (보너스)`;
}

function formatNaegongRewardNote(rewards) {
    if (!rewards.naegongExpGain) return '';
    let note = ` · 내공 EXP +${rewards.naegongExpGain}`;
    const leveled = rewards.naegongResult?.leveled;
    if (leveled?.length) {
        note += ` → 내공 Lv.${leveled[leveled.length - 1]}`;
    }
    return note;
}

function formatMartialRewardNote(rewards) {
    if (!rewards.martialExpGain) return '';
    let note = ` · 무공 숙련 +${rewards.martialExpGain}`;
    if (rewards.martialByArt) {
        const detail = Object.entries(rewards.martialByArt)
            .map(([id, exp]) => `${martial.getArtDef(id)?.name || id} +${exp}`)
            .join(', ');
        if (detail) note += ` (${detail})`;
    }
    if (rewards.martialLevelUps?.length) {
        note += ` → ${rewards.martialLevelUps.map(u => `${u.name} Lv.${u.level}`).join(', ')}`;
    }
    return note;
}

function logVictoryRewards(enemy, rewards) {
    const label = getEnemyDisplayName(enemy);
    const expNote = formatExpRewardNote(rewards);
    const ngNote = formatNaegongRewardNote(rewards);
    const martialNote = formatMartialRewardNote(rewards);
    if (enemy.named) {
        state.addLog(`🏆 ${label}을(를) 격파! 명성 +${rewards.fameGain} · EXP +${rewards.expGain}${expNote}${ngNote}${martialNote}`);
    } else {
        state.addLog(`${label}을(를) 물리쳤다! 명성 +${rewards.fameGain}, 은전 +${rewards.goldGain} · EXP +${rewards.expGain}${expNote}${ngNote}${martialNote}`);
        if (rewards.item) state.addLog(`${rewards.item.icon} ${rewards.item.name} 획득!`);
    }
}

function finishDefaultVictory(enemy) {
    const rewards = buildVictoryRewards(enemy);
    logVictoryRewards(enemy, rewards);
}

function travelVictoryReward(enemy) {
    const rewards = buildVictoryRewards(enemy);
    if (!enemy.named && rewards.item) state.addLog(`${rewards.item.icon} ${rewards.item.name} 획득!`);
    return rewards;
}

/** 이동 중 조우 — 자동/수동 분기 */
export async function handleTravelEncounter(enemy) {
    debug.log('battle', 'handleTravelEncounter', { enemy: enemy?.name, autoBattle: state.gameState.autoBattle });
    if (state.gameState.autoBattle) {
        return resolveTravelEncounter(enemy);
    }
    return new Promise((resolve) => {
        pendingTravelResolve = resolve;
        battleContext = 'travel';
        debug.log('battle', 'travel encounter — manual battle open', { enemy: enemy?.name });
        let scaled = encounters.scaleEnemyForBattle(enemy, state.gameState, { context: 'travel' });
        scaled = exchange.tuneEnemyForBattle(scaled);
        scaled = exchange.initEnemyWeapon(scaled);
        currentEnemy = { ...scaled, maxHp: scaled.maxHp || scaled.hp };
        const label = getEnemyDisplayName(currentEnemy);
        battleLog = [];
        logBattle(scaled.named
            ? `⚔️ 이동 중 네임드 ${label} 조우!`
            : `⚔️ 이동 중 ${label}(과) 조우!`);
        appendBattleIntro(state.gameState);
        onVictory = () => travelVictoryReward(enemy);
        resetBattleStance();
        battleRound = 0;
        battleWasManual = true;
        showBattleModal();
        updateBattleUI();
    });
}

export function runAutoBattle() {
    if (!currentEnemy) return;
    battleWasManual = false;
    const result = simulateAutoBattle(state.gameState, currentEnemy);
    battleMartialUsage = { ...(result.martialUsage || {}) };
    battleLog = [{ type: 'line', text: `🤖 자동 전투 개시 (${result.turns}합)`, side: 'system' }];
    appendBattleIntro(state.gameState);
    for (const entry of result.log) {
        battleLog.push(normalizeLogEntry(entry));
    }
    currentEnemy.hp = result.enemyHp;
    applyBattleStats(result);

    if (result.victory) {
        currentEnemy.hp = 0;
        logBattle(`🎉 ${getEnemyDisplayName(currentEnemy)}을(를) 물리쳤다!`, 'system');
        updateBattleUI();
        scheduleBattleResolution(() => endBattle(true), 900);
        return;
    }
    logBattle(result.defeat ? '💀 전투에서 패배했다...' : '⏱️ 승부가 나지 않아 후퇴했다.', 'system');
    updateBattleUI();
    scheduleBattleResolution(() => endBattle(false, true), 600);
}

/** 이동 중 조우 — 자동 전투 즉시 처리 */
export function resolveTravelEncounter(enemy) {
    battleWasManual = false;
    const result = simulateAutoBattle(state.gameState, enemy);
    battleMartialUsage = { ...(result.martialUsage || {}) };
    applyBattleStats(result);
    let rewards = null;
    if (result.victory) rewards = travelVictoryReward(enemy);
    const enlight = enlightenment.tryEnlightenment('battle', false);
    if (enlight) ui.showEnlightenmentToast(enlight);
    return { ...result, enemyName: enemy.name, fled: false, named: enemy.named, rewards, enlightenment: enlight };
}

function showBattleModal() {
    const heroDisp = hero.getHeroDisplay(state.gameState);
    const nameEl = document.getElementById('player-battle-name');
    const subEl = document.getElementById('player-battle-sub');
    if (nameEl) nameEl.textContent = heroDisp.publicName;
    if (subEl) subEl.textContent = `별호 ${heroDisp.aliasDisplay} · 성향 ${heroDisp.disposition.label}`;

    const titleEl = document.getElementById('battle-modal-title');
    if (titleEl) {
        if (battleContext === 'travel') {
            titleEl.textContent = currentEnemy?.named ? '⚔️ 이동 중 네임드 조우!' : '⚔️ 이동 중 조우!';
        } else if (battleContext === 'named_spar') {
            titleEl.textContent = `⚔️ ${currentEnemy?.name || ''}와 비무`;
        } else if (battleContext === 'spar') {
            titleEl.textContent = '⚔️ 문파 대련';
        } else if (battleContext === 'dojo') {
            const st = currentEnemy?.dojoStage;
            const tot = currentEnemy?.dojoTotal;
            titleEl.textContent = st && tot
                ? `🏯 도장깨기 ${st}/${tot}단계`
                : '🏯 도장깨기';
        } else if (currentEnemy?.named) {
            titleEl.textContent = `⚔️ ${currentEnemy.icon || ''} 네임드 전투`;
        } else {
            titleEl.textContent = '⚔️ 전투';
        }
    }
    battleSd.mountBattleSprites(currentEnemy);
    document.getElementById('battle-modal').classList.remove('hidden');
}

function hideBattleModal() {
    document.getElementById('battle-modal').classList.add('hidden');
}

function updateBattleUI() {
    const gs = state.gameState;
    const enemy = currentEnemy;
    if (!enemy) return;

    document.getElementById('player-hp-bar').style.width = `${(gs.hp / gs.maxHp) * 100}%`;
    document.getElementById('player-hp-text').textContent = `${gs.hp}/${gs.maxHp}`;
    const ngUnlocked = martial.isNaegongUnlocked(gs);
    const ngPct = ngUnlocked && gs.maxNaegong > 0 ? (gs.naegong / gs.maxNaegong) * 100 : 0;
    document.getElementById('player-ng-bar').style.width = `${ngPct}%`;
    document.getElementById('player-ng-text').textContent = ngUnlocked
        ? `${gs.naegong}/${gs.maxNaegong}`
        : '내공 미타동';

    const nameEl = document.getElementById('enemy-name');
    nameEl.textContent = getEnemyDisplayName(enemy);
    nameEl.className = enemy.named ? 'battle-hud-name text-red-400' : 'battle-hud-name';

    document.getElementById('enemy-hp-bar').style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
    document.getElementById('enemy-hp-text').textContent = `${enemy.hp}/${enemy.maxHp}`;

    const playerStaminaBar = document.getElementById('player-stamina-bar');
    const playerStaminaText = document.getElementById('player-stamina-text');
    const playerSt = getPlayerBattleStamina(gs);
    const playerStMax = gs.maxStamina || BATTLE_STAMINA_MAX;
    if (playerStaminaBar) {
        playerStaminaBar.style.width = `${(playerSt / playerStMax) * 100}%`;
    }
    if (playerStaminaText) {
        playerStaminaText.textContent = `스테미나 ${playerSt}/${playerStMax}`;
    }

    const enemyStaminaBar = document.getElementById('enemy-stamina-bar');
    const enemyStaminaText = document.getElementById('enemy-stamina-text');
    if (enemyStaminaBar) {
        enemyStaminaBar.style.width = `${(enemyBattleStamina / BATTLE_STAMINA_MAX) * 100}%`;
    }
    if (enemyStaminaText) {
        enemyStaminaText.textContent = `스테미나 ${enemyBattleStamina}/${BATTLE_STAMINA_MAX}`;
    }

    renderBattleLog();

    const actions = document.getElementById('battle-actions');
    const autoDisabled = enemy.hp <= 0 || gs.hp <= 0 || battleResolutionPending;
    const showAutoBtn = !state.gameState.autoBattle || battleContext === 'travel' || battleContext === 'gather';
    actions.className = 'grid grid-cols-3 gap-3 battle-actions-grid';
    const evadeRate = getActiveEvadeChance(gs);
    const lowHpBonus = calcLowHpEvasionBonus(gs.hp, gs.maxHp);
    const evadeDisabled = autoDisabled || !canEvade(true);
    const initTag = playerHasInitiative ? '선공' : '후공';
    const style = exchange.getPlayerBattleStyle(gs);
    const weaponTag = inventory.formatWeaponDurability(gs);
    const rpsHint = '공→회피→방→공';
    const critHint = ngUnlocked ? '내공술=필살' : '회피=회심';
    const moveHint = `${initTag} · ${weaponTag} · ${style.label} — ${rpsHint} · ${critHint}`;
    const resolutionNote = battleResolutionPending
        ? (enemy.hp <= 0
            ? '<p class="col-span-3 text-center text-amber-400 text-sm py-2 animate-pulse">적 HP 0 — 승리 정산 중...</p>'
            : '<p class="col-span-3 text-center text-red-400/90 text-sm py-2">전투 종료...</p>')
        : '';
    actions.innerHTML = `
        ${resolutionNote}
        ${showAutoBtn ? `
        <button onclick="window.runAutoBattle()" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-3 bg-amber-900/60 hover:bg-amber-800 border-2 border-amber-500 rounded-xl font-bold col-span-3 text-sm
            ${autoDisabled ? 'opacity-40 cursor-not-allowed' : ''}">
            <i class="fas fa-robot mr-2"></i>자동 전투 (즉시 결과)
        </button>` : `
        <p class="col-span-3 text-center text-xs text-amber-500 py-1">
            <i class="fas fa-robot mr-1"></i>자동 전투 ON — 수동 조작 중
        </p>`}
        <p class="col-span-3 text-center text-xs text-zinc-500 -mt-1 mb-1">${moveHint}</p>
        <button onclick="window.battleAction('attack')" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-3 bg-red-900/50 hover:bg-red-800 border border-red-600 rounded-xl font-bold text-sm"
            title="묵찌바: 회피를 이김">
            <i class="fas fa-fist-raised mr-1"></i>공격
        </button>
        <button onclick="window.battleAction('defend')" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-3 bg-blue-900/50 hover:bg-blue-800 border border-blue-600 rounded-xl font-bold text-sm"
            title="묵찌바: 공격을 이김 · 무기 손상 없음">
            <i class="fas fa-shield-alt mr-1"></i>방어
        </button>
        <button onclick="window.battleAction('evade')" ${evadeDisabled ? 'disabled' : ''}
            class="choice-btn p-3 bg-cyan-900/50 hover:bg-cyan-800 border border-cyan-600 rounded-xl font-bold text-sm
            ${evadeDisabled && !autoDisabled ? 'opacity-40 cursor-not-allowed' : ''}"
            title="묵찌바: 방어를 이김 · ${ngUnlocked ? '회피만' : '성공=회심'} · ${evadeRate}%${lowHpBonus ? ` (위기 +${lowHpBonus}%)` : ''} · 스테미나 ${EVADE_STAMINA_COST}">
            <i class="fas fa-wind mr-1"></i>회피 <span class="text-cyan-200">${evadeRate}%</span>
            <div class="text-xs font-normal text-cyan-300/80 mt-0.5">${getPlayerBattleStamina(gs)}/${gs.maxStamina || BATTLE_STAMINA_MAX} · -${EVADE_STAMINA_COST}</div>
        </button>
        <button onclick="window.battleAction('skill')" ${autoDisabled || !ngUnlocked ? 'disabled' : ''}
            class="choice-btn p-3 bg-orange-900/50 hover:bg-orange-800 border border-orange-600 rounded-xl font-bold text-sm
            ${!ngUnlocked ? 'opacity-40 cursor-not-allowed' : ''}"
            title="${ngUnlocked ? '내공 15 소모 · 필살(회심) 역할' : '내공 미타동 (삼류 중반)'}">
            <i class="fas fa-fire mr-1"></i>내공술${!ngUnlocked ? ' 🔒' : ''}
        </button>
        <button onclick="window.battleAction('flee')" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl font-bold text-sm col-span-2">
            <i class="fas fa-running mr-1"></i>도망
        </button>
    `;
}

function playExchangeAnims(playerAction, enemyAction, result) {
    if (playerAction === 'skill') battleSd.playBattleAnim('player', 'skill');
    else if (playerAction === 'attack') battleSd.playBattleAnim('player', 'attack');
    else if (playerAction === 'defend') battleSd.playBattleAnim('player', 'defend');
    else if (playerAction === 'evade') battleSd.playBattleAnim('player', 'evade');

    if (enemyAction === 'attack' || result.enemyDamage > 0) battleSd.playBattleAnim('enemy', result.enemyDamage > 0 ? 'hit' : 'attack');
    if (result.playerDamage > 0) {
        if (playerAction === 'defend') battleSd.playBattleAnim('player', 'defend');
        else if (playerAction === 'attack' || playerAction === 'skill') {
            battleSd.playBattleAnim('player', 'hit', { pose: 'attack' });
        } else {
            battleSd.playBattleAnim('player', 'hit');
        }
    }
}

function mergeEnemyWeaponState(enemy, patch) {
    if (!patch) return;
    if (patch.weaponDurability != null) enemy.weaponDurability = patch.weaponDurability;
    if (patch.weaponBroken != null) enemy.weaponBroken = patch.weaponBroken;
    if (patch.weaponGrade != null) enemy.weaponGrade = patch.weaponGrade;
}

function applyExchangeResult(gs, enemy, result) {
    mergeEnemyWeaponState(enemy, result.enemy);
    if (result.naegongCost > 0) {
        state.modifyStats({ naegong: Math.max(0, gs.naegong - result.naegongCost) });
    }
    if (result.playerDamage > 0) {
        state.modifyStats({ hp: Math.max(0, gs.hp - result.playerDamage) });
    }
    if (result.enemyDamage > 0) {
        enemy.hp = Math.max(0, enemy.hp - result.enemyDamage);
    }
}

export function playerAction(type) {
    if (!currentEnemy || battleResolutionPending) return;
    const gs = state.gameState;
    const enemy = currentEnemy;

    if (type === 'skill') {
        if (!martial.isNaegongUnlocked(gs)) {
            logBattle('아직 내공이 개통되지 않았다!', 'player');
            updateBattleUI();
            return;
        }
        if (gs.naegong < 15) {
            logBattle('내공이 부족하다!', 'player');
            updateBattleUI();
            return;
        }
    }

    if (type === 'evade' && !canEvade(true)) {
        logBattle(`스테미나가 고갈되어 회피할 수 없다. (${getPlayerBattleStamina(gs)}/${EVADE_STAMINA_COST} 필요)`, 'player');
        updateBattleUI();
        return;
    }

    startExchange();

    if (type === 'evade') spendEvadeStamina(true);

    const enemyAction = pickEnemyAction(enemy, gs);
    if (enemyAction === 'evade') spendEvadeStamina(false);

    const result = exchange.resolveExchange(
        gs,
        enemy,
        type,
        enemyAction,
        playerHasInitiative,
        {
            naegongOk: martial.isNaegongUnlocked(gs) && gs.naegong >= 15,
            naegongUnlocked: martial.isNaegongUnlocked(gs),
        },
    );

    for (const line of result.lines) {
        logBattle(line.text, line.side);
    }

    if (result.fleeSuccess === true) {
        refreshBattleHud();
        endBattle(false, false, true);
        return;
    }

    applyExchangeResult(gs, enemy, result);
    recordBattleMartialUsage(gs, result, type);
    playExchangeAnims(type, enemyAction, result);
    refreshBattleHud();

    if (enemy.hp <= 0) {
        presentBattleVictory(enemy, type, enemyAction, result);
        return;
    }
    if (gs.hp <= 0) {
        presentBattleDefeat(gs, type, enemyAction, result);
        return;
    }
    updateBattleUI();
}

function runPostBattleEnlightenment(ctx, fled) {
    if (ctx === 'travel' || fled) return null;
    const enlightCtx = ctx === 'named_spar' ? 'spar' : ctx;
    const enlight = enlightenment.tryEnlightenment(enlightCtx, fled);
    if (enlight) ui.showEnlightenmentToast(enlight);
    return enlight;
}

function completeBattleEnd({
    victory, defeated, fled, ctx, travelResolve, resolvedEnemy, rewards, callback, rewardMode,
}) {
    debug.log('battle', 'completeBattleEnd', {
        victory, defeated, fled, ctx,
        hasTravelResolve: !!travelResolve,
        enemy: resolvedEnemy?.name,
        pendingFinalize: !!pendingBattleFinalize,
    });
    hideBattleModal();
    resetBattleStance();
    onVictory = null;
    battleContext = 'normal';
    pendingTravelResolve = null;
    victoryRewardMode = 'default';
    const resolvedEnemyName = resolvedEnemy?.name ?? '';

    if (ctx === 'travel' && travelResolve) {
        if (victory && rewards && resolvedEnemy) logVictoryRewards(resolvedEnemy, rewards);
        if (victory && rewardMode === 'custom' && callback) callback();
        const enlight = fled ? null : enlightenment.tryEnlightenment(ctx, fled);
        if (enlight) ui.showEnlightenmentToast(enlight);
        debug.log('battle', 'travelResolve called', { victory, fled, defeated });
        travelResolve({
            victory,
            defeat: defeated,
            fled,
            enemyName: resolvedEnemyName,
            named: resolvedEnemy?.named,
            enlightenment: enlight,
            rewards,
        });
        ui.updateAllUI();
        return;
    }

    if (ctx === 'named_spar') {
        if (defeated) state.modifyStats({ hp: Math.max(1, Math.floor(state.gameState.maxHp * 0.5)) });
        if (callback) callback(victory && !fled);
    } else if (ctx === 'spar' || ctx === 'dojo') {
        if (defeated) state.modifyStats({ hp: Math.max(1, Math.floor(state.gameState.maxHp * 0.45)) });
        if (callback) callback(victory && !fled);
    } else if (defeated) {
        if (ctx === 'gather') {
            state.modifyStats({ hp: Math.max(1, Math.floor(state.gameState.maxHp * 0.35)) });
            state.addLog('정보 수집 중 패배하여 후퇴했다.');
        } else {
            state.modifyStats({ hp: Math.floor(state.gameState.maxHp * 0.3) });
            state.addLog('혼절하여 마을로 끌려갔다. 체력이 회복되었다.');
            intel.resetIntelStayIfNeeded(state.gameState, '촉남촌');
            state.modifyStats({ currentRegion: '사천', currentArea: '촉남촌', currentLocation: '촉남촌' });
            state.gameState.mapView = 'local';
        }
    } else if (victory) {
        if (rewards && resolvedEnemy) logVictoryRewards(resolvedEnemy, rewards);
        if (rewardMode === 'custom' && callback) callback(true);
    } else if (fled) {
        state.addLog('전투에서 도망쳤다.');
        if ((ctx === 'spar' || ctx === 'named_spar' || ctx === 'dojo') && callback) callback(false);
    }

    runPostBattleEnlightenment(ctx, fled);
    ui.updateAllUI();
}

function endBattle(victory, defeated = false, fled = false) {
    debug.log('battle', 'endBattle', { victory, defeated, fled, ...getBattleDebugState() });
    const callback = onVictory;
    const ctx = battleContext;
    const travelResolve = pendingTravelResolve;
    const resolvedEnemy = currentEnemy ? { ...currentEnemy } : null;
    const wasManual = battleWasManual;
    const rewardMode = victoryRewardMode;

    if (victory && wasManual && !fled && resolvedEnemy && ctx !== 'named_spar') {
        const rewards = buildVictoryRewards(resolvedEnemy);
        currentEnemy = null;
        if (ctx === 'travel' && travelResolve) {
            completeBattleEnd({
                victory,
                defeated,
                fled,
                ctx,
                travelResolve,
                resolvedEnemy,
                rewards,
                callback,
                rewardMode,
            });
            showManualVictoryResult(resolvedEnemy, rewards);
            return;
        }
        pendingBattleFinalize = () => completeBattleEnd({
            victory,
            defeated,
            fled,
            ctx,
            travelResolve,
            resolvedEnemy,
            rewards,
            callback,
            rewardMode,
        });
        showManualVictoryResult(resolvedEnemy, rewards);
        return;
    }

    currentEnemy = null;
    let rewards = null;
    if (victory && resolvedEnemy && ctx !== 'named_spar' && rewardMode === 'default') {
        rewards = buildVictoryRewards(resolvedEnemy);
    }

    completeBattleEnd({
        victory,
        defeated,
        fled,
        ctx,
        travelResolve,
        resolvedEnemy,
        rewards,
        callback,
        rewardMode,
    });
}