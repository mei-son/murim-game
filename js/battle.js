import * as state from './state.js';
import * as ui from './ui.js';
import * as encounters from './encounters.js';

let currentEnemy = null;
let battleLog = [];
let onVictory = null;
let defending = false;
let battleContext = 'normal';
let pendingTravelResolve = null;

export function simulateAutoBattle(gs, enemy) {
    const log = [];
    let pHp = gs.hp;
    let pNg = gs.naegong;
    let eHp = enemy.hp;
    let turn = 0;
    const maxTurns = 50;

    while (pHp > 0 && eHp > 0 && turn < maxTurns) {
        turn++;
        const useSkill = pNg >= 15 && eHp > gs.atk * 1.2;
        let dmg;
        if (useSkill) {
            pNg -= 15;
            dmg = Math.max(1, gs.atk * 2 - enemy.def + Math.floor(Math.random() * 6));
            log.push(`⚡ 내공술! ${enemy.name}에게 ${dmg} 피해 (적 HP ${Math.max(0, eHp - dmg)})`);
        } else {
            dmg = Math.max(1, gs.atk - enemy.def + Math.floor(Math.random() * 4));
            log.push(`🗡️ 공격! ${enemy.name}에게 ${dmg} 피해 (적 HP ${Math.max(0, eHp - dmg)})`);
        }
        eHp -= dmg;
        if (eHp <= 0) break;

        dmg = Math.max(1, enemy.atk - gs.def + Math.floor(Math.random() * 3));
        pHp -= dmg;
        log.push(`💥 ${enemy.name} 반격! ${dmg} 피해 (내 HP ${Math.max(0, pHp)})`);
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
    if (enemy.named) return encounters.applyNamedVictoryRewards(enemy);
    return encounters.applyNormalVictoryRewards(enemy);
}

function showNamedResultIfNeeded(enemy, rewards) {
    if (!enemy?.named) return;
    ui.showBattleResultModal({
        icon: enemy.icon || '⚔️',
        title: `${enemy.name} 격파!`,
        subtitle: enemy.title || '네임드 무인',
        fame: rewards.fameGain,
        exp: rewards.expGain,
        gold: rewards.goldGain,
        item: rewards.item,
    });
}

export function startBattle(enemyName, hp, atk, def, victoryCallback) {
    const enemy = { name: enemyName, hp, maxHp: hp, atk, def };
    startBattleFromEnemy(enemy, 'normal', victoryCallback);
}

export function startNamedBattle(enemy, context = 'normal') {
    startBattleFromEnemy(enemy, context);
}

export function startBattleFromEnemy(enemy, context = 'normal', victoryCallback) {
    currentEnemy = { ...enemy, maxHp: enemy.maxHp || enemy.hp };
    const label = getEnemyDisplayName(currentEnemy);
    battleLog = currentEnemy.named
        ? [`⚔️ 네임드 무인 ${label}(과)의 대결!`]
        : [`⚔️ ${label}(과)와 전투가 시작되었다!`];
    onVictory = victoryCallback || (() => finishDefaultVictory(currentEnemy));
    battleContext = context;
    defending = false;

    if (state.gameState.autoBattle) {
        runAutoBattle();
        return;
    }
    showBattleModal();
    updateBattleUI();
}

function finishDefaultVictory(enemy) {
    const rewards = buildVictoryRewards(enemy);
    const label = getEnemyDisplayName(enemy);
    if (enemy.named) {
        state.addLog(`🏆 ${label}을(를) 격파! 명성 +${rewards.fameGain}`);
        showNamedResultIfNeeded(enemy, rewards);
    } else {
        state.addLog(`${label}을(를) 물리쳤다! 명성 +${rewards.fameGain}, 은전 +${rewards.goldGain}`);
        if (rewards.item) state.addLog(`${rewards.item.icon} ${rewards.item.name} 획득!`);
    }
}

function travelVictoryReward(enemy) {
    const rewards = buildVictoryRewards(enemy);
    if (enemy.named) showNamedResultIfNeeded(enemy, rewards);
    else if (rewards.item) state.addLog(`${rewards.item.icon} ${rewards.item.name} 획득!`);
    return rewards;
}

/** 이동 중 조우 — 자동/수동 분기 */
export async function handleTravelEncounter(enemy) {
    if (state.gameState.autoBattle) {
        return resolveTravelEncounter(enemy);
    }
    return new Promise((resolve) => {
        pendingTravelResolve = resolve;
        battleContext = 'travel';
        currentEnemy = { ...enemy, maxHp: enemy.maxHp || enemy.hp };
        const label = getEnemyDisplayName(currentEnemy);
        battleLog = enemy.named
            ? [`⚔️ 이동 중 네임드 ${label} 조우!`]
            : [`⚔️ 이동 중 ${label}(과) 조우!`];
        onVictory = () => travelVictoryReward(enemy);
        defending = false;
        showBattleModal();
        updateBattleUI();
    });
}

export function runAutoBattle() {
    if (!currentEnemy) return;
    const result = simulateAutoBattle(state.gameState, currentEnemy);
    battleLog = [`🤖 자동 전투 개시 (${result.turns}턴)`];
    battleLog.push(...result.log);
    currentEnemy.hp = result.enemyHp;
    applyBattleStats(result);

    if (result.victory) {
        battleLog.push(`🎉 ${getEnemyDisplayName(currentEnemy)}을(를) 물리쳤다!`);
        updateBattleUI();
        endBattle(true);
        return;
    }
    battleLog.push(result.defeat ? '💀 전투에서 패배했다...' : '⏱️ 승부가 나지 않아 후퇴했다.');
    updateBattleUI();
    endBattle(false, true);
}

/** 이동 중 조우 — 자동 전투 즉시 처리 */
export function resolveTravelEncounter(enemy) {
    const result = simulateAutoBattle(state.gameState, enemy);
    applyBattleStats(result);
    let rewards = null;
    if (result.victory) rewards = travelVictoryReward(enemy);
    return { ...result, enemyName: enemy.name, fled: false, named: enemy.named, rewards };
}

function showBattleModal() {
    const titleEl = document.getElementById('battle-modal-title');
    if (titleEl) {
        if (battleContext === 'travel') {
            titleEl.textContent = currentEnemy?.named ? '⚔️ 이동 중 네임드 조우!' : '⚔️ 이동 중 조우!';
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
    const enemyIconEl = document.getElementById('enemy-icon');
    if (enemyIconEl) {
        enemyIconEl.textContent = currentEnemy?.named ? (currentEnemy.icon || '👹') : '👹';
    }
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
    document.getElementById('player-ng-bar').style.width = `${(gs.naegong / gs.maxNaegong) * 100}%`;
    document.getElementById('player-ng-text').textContent = `${gs.naegong}/${gs.maxNaegong}`;

    const nameEl = document.getElementById('enemy-name');
    nameEl.textContent = getEnemyDisplayName(enemy);
    if (enemy.named) nameEl.className = 'font-bold text-red-400';
    else nameEl.className = 'font-bold';

    document.getElementById('enemy-hp-bar').style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
    document.getElementById('enemy-hp-text').textContent = `${enemy.hp}/${enemy.maxHp}`;

    document.getElementById('battle-log').innerHTML = battleLog
        .map(l => `<p class="text-sm text-zinc-400">${l}</p>`)
        .join('');

    const actions = document.getElementById('battle-actions');
    const autoDisabled = enemy.hp <= 0 || gs.hp <= 0;
    const showAutoBtn = !state.gameState.autoBattle || battleContext === 'travel' || battleContext === 'gather';
    actions.innerHTML = `
        ${showAutoBtn ? `
        <button onclick="window.runAutoBattle()" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-4 bg-amber-900/60 hover:bg-amber-800 border-2 border-amber-500 rounded-xl font-bold col-span-2
            ${autoDisabled ? 'opacity-40 cursor-not-allowed' : ''}">
            <i class="fas fa-robot mr-2"></i>자동 전투 (즉시 결과)
        </button>` : `
        <p class="col-span-2 text-center text-xs text-amber-500 py-2">
            <i class="fas fa-robot mr-1"></i>자동 전투 ON — 수동 조작 중
        </p>`}
        <button onclick="window.battleAction('attack')" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-4 bg-red-900/50 hover:bg-red-800 border border-red-600 rounded-xl font-bold">
            <i class="fas fa-fist-raised mr-2"></i>공격
        </button>
        <button onclick="window.battleAction('defend')" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-4 bg-blue-900/50 hover:bg-blue-800 border border-blue-600 rounded-xl font-bold">
            <i class="fas fa-shield-alt mr-2"></i>방어
        </button>
        <button onclick="window.battleAction('skill')" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-4 bg-orange-900/50 hover:bg-orange-800 border border-orange-600 rounded-xl font-bold">
            <i class="fas fa-fire mr-2"></i>내공술
        </button>
        <button onclick="window.battleAction('flee')" ${autoDisabled ? 'disabled' : ''}
            class="choice-btn p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl font-bold">
            <i class="fas fa-running mr-2"></i>도망
        </button>
    `;
}

export function playerAction(type) {
    if (!currentEnemy) return;
    const gs = state.gameState;
    const enemy = currentEnemy;

    switch (type) {
        case 'attack': {
            const dmg = Math.max(1, gs.atk - enemy.def + Math.floor(Math.random() * 5));
            enemy.hp -= dmg;
            battleLog.push(`당신의 공격! ${enemy.name}에게 ${dmg} 피해`);
            break;
        }
        case 'defend': {
            defending = true;
            battleLog.push('방어 자세를 취했다.');
            enemyTurn();
            return;
        }
        case 'skill': {
            if (gs.naegong < 15) {
                battleLog.push('내공이 부족하다!');
                updateBattleUI();
                return;
            }
            state.modifyStats({ naegong: gs.naegong - 15 });
            const dmg = Math.max(1, gs.atk * 2 - enemy.def + Math.floor(Math.random() * 8));
            enemy.hp -= dmg;
            battleLog.push(`내공술 발동! ${enemy.name}에게 ${dmg} 피해`);
            break;
        }
        case 'flee': {
            const fleeChance = enemy.named ? 0.25 : 0.5;
            if (Math.random() < fleeChance) {
                battleLog.push('도망에 성공했다!');
                endBattle(false, false, true);
                return;
            }
            battleLog.push('도망 실패!');
            break;
        }
    }

    if (enemy.hp <= 0) {
        enemy.hp = 0;
        battleLog.push(`🎉 ${getEnemyDisplayName(enemy)}을(를) 물리쳤다!`);
        updateBattleUI();
        endBattle(true);
        return;
    }

    enemyTurn();
}

function enemyTurn() {
    const gs = state.gameState;
    const enemy = currentEnemy;
    let dmg = Math.max(1, enemy.atk - gs.def + Math.floor(Math.random() * 4));
    if (defending) {
        dmg = Math.floor(dmg / 2);
        defending = false;
        battleLog.push(`${enemy.name}의 공격! (방어) ${dmg} 피해`);
    } else {
        battleLog.push(`${enemy.name}의 공격! ${dmg} 피해`);
    }
    state.modifyStats({ hp: gs.hp - dmg });

    if (gs.hp <= 0) {
        battleLog.push('💀 쓰러졌다...');
        updateBattleUI();
        endBattle(false, true);
        return;
    }

    updateBattleUI();
}

function endBattle(victory, defeated = false, fled = false) {
    hideBattleModal();
    const callback = onVictory;
    const ctx = battleContext;
    const travelResolve = pendingTravelResolve;
    const resolvedEnemy = currentEnemy ? { ...currentEnemy } : null;
    const resolvedEnemyName = resolvedEnemy?.name ?? '';

    currentEnemy = null;
    defending = false;
    onVictory = null;
    battleContext = 'normal';
    pendingTravelResolve = null;

    if (ctx === 'travel' && travelResolve) {
        if (victory && callback) callback();
        travelResolve({ victory, defeat: defeated, fled, enemyName: resolvedEnemyName, named: resolvedEnemy?.named });
        ui.updateAllUI();
        return;
    }

    if (ctx === 'spar' || ctx === 'dojo') {
        if (defeated) {
            state.modifyStats({ hp: Math.max(1, Math.floor(state.gameState.maxHp * 0.45)) });
        }
        if (callback) callback(victory && !fled);
    } else if (defeated) {
        if (ctx === 'gather') {
            state.modifyStats({ hp: Math.max(1, Math.floor(state.gameState.maxHp * 0.35)) });
            state.addLog('정보 수집 중 패배하여 후퇴했다.');
        } else {
            state.modifyStats({ hp: Math.floor(state.gameState.maxHp * 0.3) });
            state.addLog('혼절하여 마을로 끌려갔다. 체력이 회복되었다.');
            state.modifyStats({ currentRegion: '사천', currentArea: '촉남촌', currentLocation: '촉남촌' });
            state.gameState.mapView = 'local';
        }
    } else if (victory && callback) {
        callback(true);
    } else if (fled) {
        state.addLog('전투에서 도망쳤다.');
        if ((ctx === 'spar' || ctx === 'dojo') && callback) callback(false);
    }

    ui.updateAllUI();
}