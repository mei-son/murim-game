import * as state from './state.js';
import * as ui from './ui.js';
import * as encounters from './encounters.js';
import * as martial from './martial.js';
import * as hero from './hero.js';
import * as enlightenment from './enlightenment.js';
import * as intel from './intel.js';
import * as battleSd from './battle-sd.js';
import * as debug from './debug.js';

let currentEnemy = null;
let battleLog = [];
let onVictory = null;
let defending = false;
let battleContext = 'normal';
let pendingTravelResolve = null;
let battleWasManual = false;
let battleRound = 0;
let victoryRewardMode = 'default';
let pendingBattleFinalize = null;
let playerBattleStamina = 100;
let enemyBattleStamina = 100;

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
const COUNTER_DAMAGE_RATIO = 0.9;
const CRITICAL_STRIKE_MULT = 3;
const BATTLE_STAMINA_MAX = 100;
const EVADE_STAMINA_COST = 28;
const STAMINA_REGEN_PER_EXCHANGE = 12;
const LOW_HP_EVADE_MAX_BONUS = 20;
const MAX_ACTIVE_EVADE_CHANCE = 85;

function resetBattleStance() {
    defending = false;
    battleRound = 0;
    playerBattleStamina = BATTLE_STAMINA_MAX;
    enemyBattleStamina = BATTLE_STAMINA_MAX;
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

function pickEnemyAction(enemy, gs = state.gameState, stamina = enemyBattleStamina) {
    if (stamina < EVADE_STAMINA_COST) return 'attack';
    const enemyLv = getEnemyLevel(enemy);
    const gap = enemyLv - gs.level;
    let evadeWeight = 0.1 + Math.max(0, gap) * 0.1 + Math.max(0, enemyLv - 3) * 0.02;
    if (gap >= 2) evadeWeight += 0.14;
    if (enemy.maxHp > 0 && enemy.hp / enemy.maxHp < 0.4) evadeWeight += 0.1;
    evadeWeight = Math.min(0.7, evadeWeight);
    return Math.random() < evadeWeight ? 'evade' : 'attack';
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
    const stamina = isPlayer ? playerBattleStamina : enemyBattleStamina;
    return stamina >= EVADE_STAMINA_COST;
}

function spendEvadeStamina(isPlayer = true) {
    if (isPlayer) {
        playerBattleStamina = Math.max(0, playerBattleStamina - EVADE_STAMINA_COST);
    } else {
        enemyBattleStamina = Math.max(0, enemyBattleStamina - EVADE_STAMINA_COST);
    }
}

function regenBattleStamina() {
    playerBattleStamina = Math.min(BATTLE_STAMINA_MAX, playerBattleStamina + STAMINA_REGEN_PER_EXCHANGE);
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
    const passive = martial.getEvasionRate(gs);
    const active = getActiveEvadeChance(gs);
    const lowHpBonus = calcLowHpEvasionBonus(gs.hp, gs.maxHp);
    let evadeNote = '회피 기량이 낮다';
    if (passive >= 36) evadeNote = '보법이 몸에 배어 있다';
    else if (passive >= 21) evadeNote = '발놀림이 괜찮다';
    const lowHpNote = lowHpBonus > 0 ? ` · 위기 보너스 +${lowHpBonus}%` : '';
    logBattle(`회피 ${passive}% (${evadeNote}) · 적극 회피 ${active}%${lowHpNote} · 스테미나 ${EVADE_STAMINA_COST}/회`, 'player');
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
    const raw = gs.atk - enemy.def + Math.floor(Math.random() * 5);
    return Math.max(1, Math.floor(raw * mult));
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
        if (/치명타/.test(raw)) cls += ' battle-log-crit battle-log-player-atk';
        else if (/회피|💨/.test(raw)) cls += ' battle-log-evade';
        else if (/방어/.test(raw)) cls += ' battle-log-defend';
        else if (/도망/.test(raw)) cls += ' battle-log-flee';
        else cls += ' battle-log-player-atk';
    } else if (side === 'enemy') {
        if (/치명타/.test(raw)) cls += ' battle-log-crit battle-log-enemy-atk';
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

function applyAttackToEnemy(gs, enemy, mult = 1, logPrefix = '공격') {
    const dmg = calcAttackDamage(gs, enemy, mult);
    enemy.hp -= dmg;
    logBattle(`${logPrefix}! ${enemy.name}에게 ${dmg} 피해`, 'player');
    return dmg;
}

function checkVictoryAfterHit() {
    const enemy = currentEnemy;
    if (!enemy || enemy.hp > 0) return false;
    enemy.hp = 0;
    logBattle(`🎉 ${getEnemyDisplayName(enemy)}을(를) 물리쳤다!`, 'system');
    updateBattleUI();
    endBattle(true);
    return true;
}

function pickAutoPlayerAction(gs, enemy, stamina = BATTLE_STAMINA_MAX) {
    if (martial.isNaegongUnlocked(gs) && gs.naegong >= 15 && enemy.hp > gs.atk * 1.2 && Math.random() < 0.35) {
        return 'skill';
    }
    const roll = Math.random();
    if (roll < 0.52) return 'attack';
    if (roll < 0.72 && stamina >= EVADE_STAMINA_COST) return 'evade';
    return 'defend';
}

function autoBattleLog(log, text, side) {
    log.push({ type: 'line', text, side });
}

export function simulateAutoBattle(gs, enemy) {
    enemy = encounters.scaleEnemyForBattle(enemy, gs);
    const log = [];
    let pHp = gs.hp;
    let pNg = gs.naegong;
    let eHp = enemy.hp;
    let turn = 0;
    let autoDefending = false;
    let pStamina = BATTLE_STAMINA_MAX;
    let eStamina = BATTLE_STAMINA_MAX;
    const maxTurns = 50;

    while (pHp > 0 && eHp > 0 && turn < maxTurns) {
        turn++;
        pStamina = Math.min(BATTLE_STAMINA_MAX, pStamina + STAMINA_REGEN_PER_EXCHANGE);
        eStamina = Math.min(BATTLE_STAMINA_MAX, eStamina + STAMINA_REGEN_PER_EXCHANGE);
        log.push({ type: 'round', n: turn });
        const action = pickAutoPlayerAction({ ...gs, naegong: pNg }, { ...enemy, hp: eHp }, pStamina);
        let skipEnemyTurn = false;
        let dmg = 0;

        if (action === 'skill') {
            pNg -= 15;
            dmg = Math.max(1, gs.atk * 2 - enemy.def + Math.floor(Math.random() * 6));
            eHp -= dmg;
            autoBattleLog(log, `⚡ 내공술! ${enemy.name}에게 ${dmg} 피해 (적 HP ${Math.max(0, eHp)})`, 'player');
        } else if (action === 'attack') {
            dmg = calcAttackDamage(gs, enemy);
            eHp -= dmg;
            autoBattleLog(log, `🗡️ 공격! ${enemy.name}에게 ${dmg} 피해 (적 HP ${Math.max(0, eHp)})`, 'player');
        } else if (action === 'defend') {
            autoDefending = true;
            autoBattleLog(log, '🛡️ 방어 자세', 'player');
        } else if (action === 'evade') {
            if (pStamina < EVADE_STAMINA_COST) {
                autoBattleLog(log, '💨 스테미나 고갈 — 회피 불가', 'player');
            } else {
                pStamina -= EVADE_STAMINA_COST;
                if (rollActiveEvade(gs, pHp)) {
                    const evMsg = describeEvade(gs, true, pHp);
                    if (Math.random() < 0.5) {
                        dmg = calcAttackDamage(gs, enemy, COUNTER_DAMAGE_RATIO);
                        eHp -= dmg;
                        autoBattleLog(log, `💨 ${evMsg} → 반격! ${dmg} 피해 (적 HP ${Math.max(0, eHp)})`, 'player');
                    } else {
                        dmg = calcAttackDamage(gs, enemy, CRITICAL_STRIKE_MULT);
                        eHp -= dmg;
                        autoBattleLog(log, `💨 ${evMsg} → 빈틈 발견! 치명타 ${dmg} 피해 (적 HP ${Math.max(0, eHp)})`, 'player');
                    }
                    skipEnemyTurn = true;
                } else {
                    autoBattleLog(log, `💨 ${describeEvade(gs, false, pHp)}`, 'player');
                }
            }
        }

        if (eHp <= 0) break;
        if (skipEnemyTurn) continue;

        const enemyAction = pickEnemyAction({ ...enemy, hp: eHp }, gs, eStamina);
        if (enemyAction === 'evade' && eStamina >= EVADE_STAMINA_COST) {
            eStamina -= EVADE_STAMINA_COST;
            const enemySnap = { ...enemy, hp: eHp, maxHp: enemy.maxHp || enemy.hp };
            if (rollEnemyActiveEvade(enemySnap)) {
                const evMsg = describeEnemyEvade(enemySnap, true);
                if (Math.random() < 0.5) {
                    dmg = Math.max(1, Math.floor((enemy.atk - gs.def + Math.floor(Math.random() * 3)) * COUNTER_DAMAGE_RATIO));
                    if (autoDefending) {
                        dmg = Math.floor(dmg / 2);
                        autoDefending = false;
                        autoBattleLog(log, `💨 ${evMsg} → ${enemy.name} 반격 (방어) ${dmg} 피해 (내 HP ${Math.max(0, pHp - dmg)})`, 'enemy');
                    } else {
                        autoBattleLog(log, `💨 ${evMsg} → ${enemy.name} 반격! ${dmg} 피해 (내 HP ${Math.max(0, pHp - dmg)})`, 'enemy');
                    }
                } else {
                    dmg = Math.max(1, Math.floor((enemy.atk - gs.def + Math.floor(Math.random() * 3)) * CRITICAL_STRIKE_MULT));
                    if (autoDefending) {
                        dmg = Math.floor(dmg / 2);
                        autoDefending = false;
                        autoBattleLog(log, `💨 ${evMsg} → ${enemy.name} 치명타 (방어) ${dmg} 피해 (내 HP ${Math.max(0, pHp - dmg)})`, 'enemy');
                    } else {
                        autoBattleLog(log, `💨 ${evMsg} → ${enemy.name} 치명타! ${dmg} 피해 (내 HP ${Math.max(0, pHp - dmg)})`, 'enemy');
                    }
                }
                pHp -= dmg;
                continue;
            }
            autoBattleLog(log, `💨 ${describeEnemyEvade(enemySnap, false)}`, 'enemy');
        }

        dmg = Math.max(1, enemy.atk - gs.def + Math.floor(Math.random() * 3));
        if (autoDefending) {
            dmg = Math.floor(dmg / 2);
            autoDefending = false;
            autoBattleLog(log, `💥 ${enemy.name} 공격 (방어) ${dmg} 피해 (내 HP ${Math.max(0, pHp - dmg)})`, 'enemy');
        } else {
            autoBattleLog(log, `💥 ${enemy.name} 공격! ${dmg} 피해 (내 HP ${Math.max(0, pHp - dmg)})`, 'enemy');
        }
        pHp -= dmg;
    }

    const victory = eHp <= 0 && pHp > 0;
    const defeat = pHp <= 0 || (!victory && turn >= maxTurns);

    return {
        victory,
        defeat,
        playerHp: Math.max(0, pHp),
        playerNg: Math.max(0, pNg),
        enemyHp: Math.max(0, eHp),
        log,
        turns: turn,
    };
}

export function applyBattleStats(result) {
    state.modifyStats({ hp: result.playerHp, naegong: result.playerNg });
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
    const opts = { manual: battleWasManual };
    if (enemy.named) return encounters.applyNamedVictoryRewards(enemy, opts);
    return encounters.applyNormalVictoryRewards(enemy, opts);
}

function buildVictoryResultSubtitle(enemy, rewards) {
    const parts = [];
    if (enemy?.named && enemy.title) parts.push(enemy.title);
    if (rewards.martialExpGain) {
        let m = `무공 숙련 +${rewards.martialExpGain}`;
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
    const scaled = encounters.scaleEnemyForBattle(enemy, state.gameState, { context });
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
        const scaled = encounters.scaleEnemyForBattle(enemy, state.gameState, { context: 'travel' });
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
    battleLog = [{ type: 'line', text: `🤖 자동 전투 개시 (${result.turns}합)`, side: 'system' }];
    appendBattleIntro(state.gameState);
    for (const entry of result.log) {
        battleLog.push(normalizeLogEntry(entry));
    }
    currentEnemy.hp = result.enemyHp;
    applyBattleStats(result);

    if (result.victory) {
        logBattle(`🎉 ${getEnemyDisplayName(currentEnemy)}을(를) 물리쳤다!`, 'system');
        updateBattleUI();
        endBattle(true);
        return;
    }
    logBattle(result.defeat ? '💀 전투에서 패배했다...' : '⏱️ 승부가 나지 않아 후퇴했다.', 'system');
    updateBattleUI();
    endBattle(false, true);
}

/** 이동 중 조우 — 자동 전투 즉시 처리 */
export function resolveTravelEncounter(enemy) {
    battleWasManual = false;
    const result = simulateAutoBattle(state.gameState, enemy);
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
    if (playerStaminaBar) {
        playerStaminaBar.style.width = `${(playerBattleStamina / BATTLE_STAMINA_MAX) * 100}%`;
    }
    if (playerStaminaText) {
        playerStaminaText.textContent = `스테미나 ${playerBattleStamina}/${BATTLE_STAMINA_MAX}`;
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
    const autoDisabled = enemy.hp <= 0 || gs.hp <= 0;
    const showAutoBtn = !state.gameState.autoBattle || battleContext === 'travel' || battleContext === 'gather';
    actions.className = 'grid grid-cols-3 gap-3 battle-actions-grid';
    const evadeRate = getActiveEvadeChance(gs);
    const lowHpBonus = calcLowHpEvasionBonus(gs.hp, gs.maxHp);
    const evadeDisabled = autoDisabled || !canEvade(true);
    const moveHint = '공격 · 방어 · 회피 — 회피 성공 시 반격 또는 치명타(×3) · 합마다 스테미나 회복';
    actions.innerHTML = `
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
            title="기본 공격">
            <i class="fas fa-fist-raised mr-1"></i>공격
        </button>
        <button onclick="window.battleAction('defend')" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-3 bg-blue-900/50 hover:bg-blue-800 border border-blue-600 rounded-xl font-bold text-sm"
            title="받는 피해 절반">
            <i class="fas fa-shield-alt mr-1"></i>방어
        </button>
        <button onclick="window.battleAction('evade')" ${evadeDisabled ? 'disabled' : ''}
            class="choice-btn p-3 bg-cyan-900/50 hover:bg-cyan-800 border border-cyan-600 rounded-xl font-bold text-sm
            ${evadeDisabled && !autoDisabled ? 'opacity-40 cursor-not-allowed' : ''}"
            title="회피 ${evadeRate}%${lowHpBonus ? ` (위기 +${lowHpBonus}%)` : ''} · 스테미나 ${EVADE_STAMINA_COST} 소모">
            <i class="fas fa-wind mr-1"></i>회피 <span class="text-cyan-200">${evadeRate}%</span>
            <div class="text-xs font-normal text-cyan-300/80 mt-0.5">${playerBattleStamina}/${BATTLE_STAMINA_MAX} · -${EVADE_STAMINA_COST}</div>
        </button>
        <button onclick="window.battleAction('skill')" ${autoDisabled || !ngUnlocked ? 'disabled' : ''}
            class="choice-btn p-3 bg-orange-900/50 hover:bg-orange-800 border border-orange-600 rounded-xl font-bold text-sm
            ${!ngUnlocked ? 'opacity-40 cursor-not-allowed' : ''}"
            title="${ngUnlocked ? '내공 15 소모 · 강력' : '내공 미타동 (삼류 중반)'}">
            <i class="fas fa-fire mr-1"></i>내공술${!ngUnlocked ? ' 🔒' : ''}
        </button>
        <button onclick="window.battleAction('flee')" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl font-bold text-sm col-span-2">
            <i class="fas fa-running mr-1"></i>도망
        </button>
    `;
}

export function playerAction(type) {
    if (!currentEnemy) return;
    const gs = state.gameState;
    const enemy = currentEnemy;

    startExchange();

    switch (type) {
        case 'attack':
            battleSd.playBattleAnim('player', 'attack');
            applyAttackToEnemy(gs, enemy, 1, '공격');
            battleSd.playBattleAnim('enemy', 'hit');
            break;
        case 'defend': {
            defending = true;
            battleSd.playBattleAnim('player', 'defend');
            logBattle('방어 자세를 취했다.', 'player');
            enemyTurn();
            return;
        }
        case 'evade': {
            if (!canEvade(true)) {
                logBattle(`스테미나가 고갈되어 회피할 수 없다. (${playerBattleStamina}/${EVADE_STAMINA_COST} 필요)`, 'player');
                enemyTurn();
                return;
            }
            spendEvadeStamina(true);
            if (rollActiveEvade(gs)) {
                battleSd.playBattleAnim('player', 'evade');
                const evMsg = describeEvade(gs, true);
                if (Math.random() < 0.5) {
                    logBattle(`${evMsg} → 즉시 반격!`, 'player');
                    window.setTimeout(() => battleSd.playBattleAnim('player', 'attack'), 280);
                    applyAttackToEnemy(gs, enemy, COUNTER_DAMAGE_RATIO, '회피 후 반격');
                    battleSd.playBattleAnim('enemy', 'hit');
                    if (checkVictoryAfterHit()) return;
                    updateBattleUI();
                    return;
                }
                logBattle(`${evMsg} → 빈틈 발견! 치명타!`, 'player');
                window.setTimeout(() => battleSd.playBattleAnim('player', 'attack'), 280);
                applyAttackToEnemy(gs, enemy, CRITICAL_STRIKE_MULT, '치명타');
                battleSd.playBattleAnim('enemy', 'hit');
                if (checkVictoryAfterHit()) return;
                updateBattleUI();
                return;
            }
            battleSd.playBattleAnim('player', 'evade');
            logBattle(describeEvade(gs, false), 'player');
            enemyTurn();
            return;
        }
        case 'skill': {
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
            state.modifyStats({ naegong: gs.naegong - 15 });
            battleSd.playBattleAnim('player', 'skill');
            const dmg = Math.max(1, gs.atk * 2 - enemy.def + Math.floor(Math.random() * 8));
            enemy.hp -= dmg;
            logBattle(`내공술 발동! ${enemy.name}에게 ${dmg} 피해`, 'player');
            battleSd.playBattleAnim('enemy', 'hit');
            break;
        }
        case 'flee': {
            const fleeChance = enemy.named ? 0.25 : 0.5;
            if (Math.random() < fleeChance) {
                logBattle('도망에 성공했다!', 'player');
                endBattle(false, false, true);
                return;
            }
            logBattle('도망 실패!', 'player');
            break;
        }
        default:
            return;
    }

    if (checkVictoryAfterHit()) return;
    enemyTurn();
}

function applyEnemyHitToPlayer(gs, enemy, mult = 1, logPrefix = null) {
    let dmg = Math.max(1, enemy.atk - gs.def + Math.floor(Math.random() * 4));
    dmg = Math.max(1, Math.floor(dmg * mult));
    const prefix = logPrefix || `${enemy.name}의 공격`;
    if (defending) {
        dmg = Math.floor(dmg / 2);
        defending = false;
        logBattle(`${prefix}! (방어) ${dmg} 피해`, 'enemy');
    } else {
        logBattle(`${prefix}! ${dmg} 피해`, 'enemy');
    }
    state.modifyStats({ hp: gs.hp - dmg });
    return dmg;
}

function checkPlayerDefeatAfterHit() {
    const gs = state.gameState;
    if (gs.hp > 0) return false;
    logBattle('💀 쓰러졌다...', 'system');
    updateBattleUI();
    endBattle(false, true);
    return true;
}

function enemyTurn() {
    const gs = state.gameState;
    const enemy = currentEnemy;
    const action = pickEnemyAction(enemy, gs);

    if (action === 'evade') {
        spendEvadeStamina(false);
        if (rollEnemyActiveEvade(enemy)) {
            battleSd.playBattleAnim('enemy', 'evade');
            const evMsg = describeEnemyEvade(enemy, true);
            if (Math.random() < 0.5) {
                logBattle(`${evMsg} → ${enemy.name}의 반격!`, 'enemy');
                window.setTimeout(() => battleSd.playBattleAnim('enemy', 'attack'), 300);
                applyEnemyHitToPlayer(gs, enemy, COUNTER_DAMAGE_RATIO, `${enemy.name} 회피 후 반격`);
            } else {
                logBattle(`${evMsg} → 빈틈을 찔렀다! 치명타!`, 'enemy');
                window.setTimeout(() => battleSd.playBattleAnim('enemy', 'attack'), 300);
                applyEnemyHitToPlayer(gs, enemy, CRITICAL_STRIKE_MULT, `${enemy.name} 치명타`);
            }
            battleSd.playBattleAnim('player', 'hit');
            if (checkPlayerDefeatAfterHit()) return;
            updateBattleUI();
            return;
        }
        battleSd.playBattleAnim('enemy', 'evade');
        logBattle(describeEnemyEvade(enemy, false), 'enemy');
    }

    const wasDefending = defending;
    battleSd.playBattleAnim('enemy', 'attack');
    applyEnemyHitToPlayer(gs, enemy);
    battleSd.playBattleAnim('player', wasDefending ? 'defend' : 'hit');
    if (checkPlayerDefeatAfterHit()) return;
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