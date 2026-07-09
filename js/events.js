import * as state from './state.js';
import * as martial from './martial.js';
import * as hero from './hero.js';
import * as ui from './ui.js';
import * as battle from './battle.js';
import * as debug from './debug.js';
import * as map from './map.js';
import * as encounters from './encounters.js';
import * as intel from './intel.js';
import * as quests from './quests.js';
import * as inventory from './inventory.js';

let pendingNamedResolve = null;

const locationEvents = {
    '촉남촌': [
        {
            id: 'wanderer',
            explore: true,
            exploreWeight: 1,
            title: '위기에 처한 낭인',
            icon: '🧑‍🌾',
            desc: '촌 입구에서 산적에게 쫓기는 낭인을 발견했다. 낭인은 도움을 요청하며, "제발 살려주십시오!"라고 외친다.',
            once: 'savedWanderer',
            choices: [
                {
                    text: '🛡️ 낭인을 구해준다 (산적과 전투 · 협행 +5)',
                    type: 'battle',
                    effect: () => {
                        const bandit = { name: '산적', hp: 58, maxHp: 58, atk: 14, def: 5 };
                        battle.startBattleFromEnemy(bandit, 'normal', (won) => {
                            if (!won) return;
                            state.applyHyeophaengChange(5);
                            state.gameState.savedWanderer = true;
                            state.addLog('낭인을 구해주었다. 감사의 뜻으로 은전 20냥을 받았다.');
                            state.modifyStats({ gold: state.gameState.gold + 20 });
                        });
                    },
                },
                {
                    text: '🤫 못 본 척하고 지나간다',
                    type: 'neutral',
                    effect: () => {
                        state.addLog('낭인의 비명소리가 멀어졌다...');
                    },
                },
                {
                    text: '💰 낭인의 재물을 노린다 (협행 -5)',
                    type: 'evil',
                    effect: () => {
                        state.applyHyeophaengChange(-5);
                        state.modifyStats({ gold: state.gameState.gold + 30 });
                        state.addLog('낭인의 재물을 빼앗았다. 악명이 높아졌다.');
                    },
                },
            ],
        },
        {
            id: 'herb',
            explore: true,
            exploreWeight: 2,
            cooldownExplores: 12,
            title: '약초꾼의 부탁',
            icon: '🌿',
            desc: '마을 약초꾼이 산속 영초를 구해달라고 부탁한다. 위험할 수 있지만 보상이 좋다고 한다.',
            choices: [
                {
                    text: '🌿 약초를 구해준다',
                    type: 'good',
                    effect: () => {
                        if (Math.random() < 0.4) {
                            state.addLog('약초 채집 중 산적을 만났다!');
                            battle.startBattle('산적', 60, 12, 5);
                            return;
                        }
                        state.applyHyeophaengChange(2);
                        state.modifyStats({ gold: state.gameState.gold + 15 });
                        state.addLog('영초를 구해 약초꾼에게 전달했다.');
                    },
                },
                {
                    text: '거절한다',
                    type: 'neutral',
                    effect: () => state.addLog('약초꾼의 부탁을 거절했다.'),
                },
            ],
        },
    ],
    '성도부': [
        {
            id: 'rumor',
            explore: true,
            exploreWeight: 1,
            title: '강호의 소문',
            icon: '📜',
            desc: '주막에서 강호의 소문을 듣는다. 검각관에 흑사룡이 나타났다는 이야기가 돌고 있다.',
            once: 'heardCriminalRumor',
            choices: [
                {
                    text: '👂 소문을 자세히 듣는다',
                    type: 'neutral',
                    effect: () => {
                        state.gameState.heardCriminalRumor = true;
                        state.addLog('검각관에 흑사룡이 나타났다는 소문을 들었다.');
                    },
                },
                {
                    text: '🍶 술 한 잔 하며 쉰다 (체력 +20)',
                    type: 'good',
                    effect: () => {
                        state.modifyStats({ hp: Math.min(state.gameState.hp + 20, state.gameState.maxHp) });
                        state.addLog('주막에서 술 한 잔으로 기운을 돌렸다.');
                    },
                },
            ],
        },
        {
            id: 'merchant',
            explore: true,
            exploreWeight: 1,
            title: '떠돌이 상인',
            icon: '💰',
            desc: '떠돌이 상인이 비싼 내공 단약을 판다고 한다. 30냥이다.',
            choices: [
                {
                    text: '💊 내공 단약을 산다 (30냥, 내공 +30)',
                    type: 'good',
                    effect: () => {
                        if (state.gameState.gold < 30) {
                            state.addLog('은전이 부족하다.');
                            return;
                        }
                        state.modifyStats({
                            gold: state.gameState.gold - 30,
                            naegong: Math.min(state.gameState.naegong + 30, state.gameState.maxNaegong),
                        });
                        state.addLog('내공 단약을 복용했다. 내공이 회복되었다.');
                    },
                },
                {
                    text: '지나친다',
                    type: 'neutral',
                    effect: () => state.addLog('상인을 지나쳤다.'),
                },
            ],
        },
    ],
    '검각관': [
        {
            id: 'bandit',
            explore: false,
            title: '산적의 습격',
            icon: '🗡️',
            desc: '험한 산길에서 산적 무리가 길을 막고 있다. "지나가려면 통행료를 내놔!"',
            choices: [
                {
                    text: '⚔️ 싸운다',
                    type: 'battle',
                    effect: () => battle.startBattle('산적 두목', 90, 16, 8),
                },
                {
                    text: '💰 20냥을 준다',
                    type: 'neutral',
                    effect: () => {
                        if (state.gameState.gold < 20) {
                            state.addLog('은전이 없다! 산적이 달려든다!');
                            battle.startBattle('산적', 70, 14, 6);
                            return;
                        }
                        state.modifyStats({ gold: state.gameState.gold - 20 });
                        state.addLog('통행료 20냥을 내고 지나갔다.');
                    },
                },
                {
                    text: '🏃 도망친다',
                    type: 'neutral',
                    effect: () => {
                        state.modifyStats({ notoriety: state.gameState.notoriety + 1 });
                        state.addLog('산적을 피해 도망쳤다. 창피하지만 살았다.');
                    },
                },
            ],
        },
        {
            id: 'dragon',
            explore: false,
            title: '흑사룡의 등장',
            icon: '🐉',
            desc: '소문대로 흑사룡이 산정에 나타났다! 강력한 기운이 온몸을 압박한다.',
            condition: () => state.gameState.heardCriminalRumor,
            choices: [
                {
                    text: '⚔️ 흑사룡에 도전한다!',
                    type: 'battle',
                    effect: () => battle.startBattle('흑사룡', 150, 25, 12),
                },
                {
                    text: '몰래 지나간다',
                    type: 'neutral',
                    effect: () => state.addLog('흑사룡을 피해 조용히 지나갔다.'),
                },
            ],
        },
    ],
    '청성산': [
        {
            id: 'train',
            explore: true,
            exploreWeight: 1,
            title: '청성 심법 수련',
            icon: '☯️',
            desc: '청성파 도인이 심법 수련을 제안한다. 내공을 소모하지만 실력이 늘어난다.',
            choices: [
                {
                    text: '🗡️ 심법을 배운다 (내공 -20, 공격 +3)',
                    type: 'good',
                    disabled: (gs) => !martial.isNaegongUnlocked(gs) || gs.naegong < 20,
                    disabledReason: '내공 부족 (20 필요)',
                    effect: () => {
                        state.modifyStats({
                            naegong: state.gameState.naegong - 20,
                            atk: state.gameState.atk + 3,
                            fame: state.gameState.fame + 2,
                        });
                        state.addLog('청성 심법을 익혔다. 공격력이 상승했다.');
                        quests.setQuestFlag('didCheongseongTrain');
                    },
                },
                {
                    text: '사양한다',
                    type: 'neutral',
                    effect: () => state.addLog('수련을 사양했다.'),
                },
            ],
        },
    ],
    '아미금정': [
        {
            id: 'alliance',
            explore: false,
            title: '아미 입문 시험',
            icon: '🔔',
            desc: '아미파에 입문하려면 시험을 통과해야 한다. 명성 5 이상이어야 응시할 수 있다.',
            choices: [
                {
                    text: '📜 입맹 시험에 응한다',
                    type: 'good',
                    effect: () => {
                        if (state.gameState.fame < 5) {
                            state.addLog('명성이 부족하여 시험에 응할 수 없다. (필요: 명성 5)');
                            return;
                        }
                        battle.startBattle('시험관', 100, 18, 10);
                    },
                },
                {
                    text: '둘러본다',
                    type: 'neutral',
                    effect: () => state.addLog('아미금정의 웅장함에 감탄했다.'),
                },
            ],
        },
    ],
};

export function loadInitialEvents() {
    const gs = state.gameState;
    gs.currentEvent = null;
    gs._baseStats = { atk: gs.atk, def: gs.def, maxHp: gs.maxHp };
    martial.initMartialArts(gs);
    inventory.initInventory(gs);
    if (!gs.sectJoinOffered) gs.sectJoinOffered = {};
    if (gs.sectJoinDeclined) {
        for (const [id, declined] of Object.entries(gs.sectJoinDeclined)) {
            if (declined && !gs.sectJoinOffered[id]) gs.sectJoinOffered[id] = 'declined';
        }
        delete gs.sectJoinDeclined;
    }
    quests.initQuests(gs);
    martial.recalcCombatStats(gs);
    state.checkNaegongUnlock();
    hero.applyStoredHeroName(gs);
    ui.updateAllUI();
    if (hero.shouldPromptHeroName()) {
        ui.showNameModal();
    }
}

function showIntelQuestOffer(result) {
    const gs = state.gameState;
    const { entry, goldCost } = result;
    gs.currentEvent = {
        id: 'intel_quest_offer',
        icon: entry.icon || '📜',
        title: '은전으로 받는 의뢰',
        desc: `소문이 줄어들자 정보상이 입을 닫았다. 은전 <span class="text-amber-400">${goldCost}냥</span>을 내면 「${entry.title}」 의뢰를 받을 수 있다고 한다.<br><br><span class="text-zinc-400">${entry.text}</span>`,
        choices: [
            {
                text: `💰 ${goldCost}냥을 내고 의뢰를 받는다`,
                type: 'good',
                disabled: (g) => g.gold < goldCost,
                disabledReason: '은전이 부족하다',
                effect: () => {
                    if (gs.gold < goldCost) return;
                    state.modifyStats({ gold: gs.gold - goldCost });
                    intel.addIntelEntry(entry, gs, gs.currentArea);
                    state.addLog(`📡 [의뢰] 은전을 건네 의뢰를 받았다 — ${entry.title}`);
                },
            },
            {
                text: '거절한다',
                type: 'neutral',
                effect: () => state.addLog('📡 의뢰를 거절하고 자리를 떠났다.'),
            },
        ],
    };
    state.addLog('📡 돈을 주면 의뢰를 받을 수 있다는 말을 들었다.');
    ui.updateAllUI();
}

export function gatherIntel() {
    const result = encounters.rollGatherIntel();
    if (result.type === 'quest_offer') {
        showIntelQuestOffer(result);
        return;
    }
    if (result.type === 'named') {
        state.addLog(`📡 정보 수집 중 ${result.enemy.name}과 마주쳤다!`);
        beginNamedEncounter(result.enemy, 'gather');
        return;
    }
    if (result.type === 'battle') {
        state.addLog(`📡 정보 수집 중 ${result.enemy.name}의 매복!`);
        battle.startBattleFromEnemy(result.enemy, 'gather');
        return;
    }
    if (result.type === 'fail') {
        state.addLog(`📡 ${result.text}`);
        ui.updateAllUI();
        return;
    }
    if (map.discoverCurrentPlace(state.gameState)) {
        state.addLog(`📍 이곳의 정소를 파악했다 — ${state.gameState.currentLocation}`);
    }
    state.addLog(`📡 [${result.category}] ${result.text} — 강호첩에 기록 (${result.journalCount}건)`);
    ui.updateAllUI();
}

/** 주변 탐색 — 대부분 무사, 가끔 약초꾼 부탁 등 이벤트 */
const EXPLORE_EVENT_CHANCE = 0.34;

const EXPLORE_NOTHING_MSGS = [
    '주변을 샅샅이 둘러보았으나 아무 일도 없었다.',
    '바람만 스치고 지나간다. 특별한 일은 없었다.',
    '사람 구경만 하고 돌아왔다. 별다른 소득이 없다.',
    '한참을 걸어다녔지만 눈에 띄는 일이 없었다.',
];

function tickExploreCooldowns(gs) {
    if (!gs.exploreCooldowns) gs.exploreCooldowns = {};
    for (const id of Object.keys(gs.exploreCooldowns)) {
        if (gs.exploreCooldowns[id] > 0) gs.exploreCooldowns[id] -= 1;
    }
}

function isExploreOnCooldown(eventId, gs = state.gameState) {
    return (gs.exploreCooldowns?.[eventId] || 0) > 0;
}

function setExploreCooldown(event, gs = state.gameState) {
    if (!event.cooldownExplores) return;
    if (!gs.exploreCooldowns) gs.exploreCooldowns = {};
    gs.exploreCooldowns[event.id] = event.cooldownExplores;
}

function getExploreEventPool(loc) {
    const gs = state.gameState;
    return (locationEvents[loc] || []).filter(e => {
        if (e.explore === false) return false;
        if (e.once && gs[e.once]) return false;
        if (e.condition && !e.condition()) return false;
        if (isExploreOnCooldown(e.id, gs)) return false;
        return true;
    });
}

function pickExploreEvent(pool) {
    const weights = pool.map(e => e.exploreWeight ?? 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
}

function revealPlaceFromExplore(gs) {
    if (map.discoverCurrentPlace(gs)) {
        state.addLog(`📍 주변을 살피며 정소를 파악했다 — ${gs.currentLocation}`);
    }
}

export function exploreLocation() {
    const gs = state.gameState;
    const loc = gs.currentArea;
    tickExploreCooldowns(gs);
    const pool = getExploreEventPool(loc);

    gs.currentEvent = null;
    revealPlaceFromExplore(gs);

    if (!pool.length || Math.random() > EXPLORE_EVENT_CHANCE) {
        const msg = EXPLORE_NOTHING_MSGS[Math.floor(Math.random() * EXPLORE_NOTHING_MSGS.length)];
        state.addLog(`🔍 ${msg}`);
        ui.updateAllUI();
        return;
    }

    const event = pickExploreEvent(pool);
    setExploreCooldown(event, gs);
    gs.currentEvent = event;
    state.addLog(`🔍 주변 탐색 중 — ${event.title}`);
    ui.updateAllUI();
}

function isChoiceDisabled(choice, gs = state.gameState) {
    if (!choice?.disabled) return false;
    return typeof choice.disabled === 'function' ? choice.disabled(gs) : !!choice.disabled;
}

function finishNamedEncounter(result) {
    debug.log('event', 'finishNamedEncounter', result);
    const resolve = pendingNamedResolve;
    pendingNamedResolve = null;
    if (resolve) resolve(result);
}

function clearNamedEvent() {
    state.gameState.currentEvent = null;
}

function handleNamedVanish(enemy, context, reason) {
    clearNamedEvent();
    state.addLog(reason || `${enemy.name}의 모습이 안개 속으로 스며들었다.`);
    finishNamedEncounter({ vanished: true, named: true, enemyName: enemy.name });
    ui.updateAllUI();
}

function handleNamedTalk(enemy, context, gap) {
    clearNamedEvent();
    if (gap >= 5 && Math.random() < 0.72) {
        handleNamedVanish(enemy, context, `${enemy.name}에게 말을 걸었으나, 눈깜짝할 새 그곳에서 묘연하게 사라졌다.`);
        return;
    }
    if (gap >= 3 && Math.random() < 0.45) {
        handleNamedVanish(enemy, context, `${enemy.name}은 대답 없이 뒤돌아 걸어가더니 금세 시야에서 사라졌다.`);
        return;
    }
    state.addLog(`${enemy.name}: "강호는 좁고도 넓다. 조심하게."`);
    finishNamedEncounter({ talked: true, named: true, enemyName: enemy.name });
    ui.updateAllUI();
}

/** 레벨 차이가 클수록 사사(화해 비무) 확률 상승 */
function calcNamedPeaceChance(gap) {
    return Math.min(0.78, 0.06 + Math.max(0, gap) * 0.11);
}

function handleNamedSparRequest(enemy, context, gap) {
    clearNamedEvent();
    const peaceChance = calcNamedPeaceChance(gap);
    if (Math.random() < peaceChance) {
        const result = encounters.resolveNamedPeacefully(enemy);
        if (result.enlight) ui.showEnlightenmentToast(result.enlight);
        const gapNote = gap >= 4 ? ' 깊은 경지의 고수가 제자처럼 겨루어 주었다.' : '';
        state.addLog(`⚔️ ${enemy.name}과 겨루다 서로의 무공을 인정했다. 사사로 마무리!${gapNote} EXP +${result.expGain}${result.manualNote}`);
        finishNamedEncounter({ peaceful: true, named: true, enemyName: enemy.name });
        ui.updateAllUI();
        return;
    }
    if (gap >= 3) {
        state.addLog(`${enemy.name}이 고개를 젓는다. "실력이 너무 차이 나는데, 비무할 이유가 없지."`);
        finishNamedEncounter({ refused: true, named: true, enemyName: enemy.name });
        ui.updateAllUI();
        return;
    }
    state.addLog(`${enemy.name}에게 대련을 청했다.`);
    launchNamedBattle(enemy, context, true);
}

function launchNamedBattle(enemy, context, isSpar) {
    state.gameState.currentEvent = null;

    if (isSpar) {
        battle.startNamedBattle(enemy, 'named_spar', (won) => {
            if (won) {
                const rewards = encounters.applyNamedSparRewards(enemy, { manual: true });
                state.addLog(`⚔️ ${enemy.name}과 대련 승! 명성 +${rewards.fameGain} · EXP +${rewards.expGain}`);
            } else {
                state.addLog(`⚔️ ${enemy.name}과의 대련에서 밀렸다.`);
            }
            finishNamedEncounter({ victory: won, defeat: !won, fled: false, named: true, spar: true, enemyName: enemy.name });
        });
        return;
    }

    if (context === 'travel') {
        debug.log('event', 'launchNamedBattle → travel combat', { enemy: enemy?.name });
        battle.handleTravelEncounter(enemy).then((result) => {
            finishNamedEncounter({ ...result, spar: false });
        }).catch((err) => {
            debug.error('event', 'travel named battle failed', err);
            finishNamedEncounter({ victory: false, defeat: true, fled: false, named: true, enemyName: enemy?.name });
        });
        return;
    }

    battle.startNamedBattle(enemy, context, () => {
        finishNamedEncounter({ victory: true, defeat: false, fled: false, named: true, spar: false, enemyName: enemy.name });
    });
}

export function beginNamedEncounter(enemy, context, onDone = null) {
    const gs = state.gameState;
    pendingNamedResolve = onDone || null;

    if (intel.registerNamedEncounterIntel(enemy, gs, context)) {
        state.addLog(`📜 ${enemy.name}에 대한 정보를 강호첩에 기록했다.`);
    }

    if (encounters.shouldForceNamedBattle(gs, enemy)) {
        state.addLog(encounters.getForcedNamedBattleMessage(gs, enemy));
        launchNamedBattle(enemy, context, false);
        ui.updateAllUI();
        return;
    }

    const gap = encounters.getNamedLevelGap(gs, enemy);
    const disp = hero.getDisposition(gs);
    const faction = enemy.faction || encounters.NAMED_FACTION.DEMONIC;
    const label = enemy.displayName || enemy.name;
    const gapNote = gap >= 4
        ? '압도적인 기세. 강자는 가끔 사사로 겨루어 주기도 한다.'
        : gap >= 2
            ? '상대가 한 수 위다. 대련을 청하면 사사로 끝날 수도 있다.'
            : '비슷한 기운이 통한다. 비무가 성립할 것 같다.';

    gs.currentEvent = {
        id: 'named_encounter',
        icon: enemy.icon || '⚔️',
        title: `${enemy.name} 조우`,
        desc: `${label}이(가) 눈앞에 나타났다. (${faction} · 추정 Lv.${enemy.level || '?'}) ${gapNote} 성향 <span class="${disp.color}">${disp.label}</span>.`,
        choices: [
            {
                text: '🗣️ 말을 건다',
                type: 'neutral',
                effect: () => handleNamedTalk(enemy, context, gap),
            },
            {
                text: gap >= 3 ? '⚔️ 대련을 요청한다 (사사 가능)' : '⚔️ 대련을 요청한다 (비무)',
                type: 'good',
                effect: () => handleNamedSparRequest(enemy, context, gap),
            },
            {
                text: '🗡️ 강제로 공격한다',
                type: 'evil',
                effect: () => {
                    clearNamedEvent();
                    state.applyHyeophaengChange(-3);
                    state.addLog(`${enemy.name}에게 선제공격을 감행했다!`);
                    launchNamedBattle(enemy, context, false);
                },
            },
            {
                text: '👣 물러난다',
                type: 'neutral',
                effect: () => {
                    clearNamedEvent();
                    state.addLog(`${enemy.name}을(를) 놓쳤다.`);
                    finishNamedEncounter({ fled: true, named: true, enemyName: enemy.name });
                },
            },
        ],
    };
    ui.updateAllUI();
}

export function awaitNamedEncounterChoice(enemy, context) {
    return new Promise((resolve) => beginNamedEncounter(enemy, context, resolve));
}

export function makeChoice(index) {
    const event = state.gameState.currentEvent;
    if (!event) return;
    const choice = event.choices[index];
    if (isChoiceDisabled(choice)) return;
    if (choice?.effect) choice.effect();
    if (event.id !== 'named_encounter') {
        state.gameState.currentEvent = null;
    }
    ui.updateAllUI();
}

export function clearEvent() {
    state.gameState.currentEvent = null;
    ui.updateAllUI();
}

export { rest, performRest, openRestMenu, closeRestMenu } from './rest.js';

export function applyTravelDestination(type, targetId) {
    if (type === 'local') {
        state.modifyStats({ currentLocation: targetId });
    } else {
        intel.resetIntelStayIfNeeded(state.gameState, targetId);
        state.modifyStats({ currentArea: targetId, currentLocation: targetId });
        state.visitLocation(targetId);
        state.gameState.mapView = 'local';
    }
    state.gameState.currentEvent = null;
    state.gameState.placeUI = null;
}

/** 직접 이동 (여정 없이, 이벤트·전투 콜백용) */
export function travelToLocal(spotId) {
    const area = state.gameState.currentArea;
    const from = state.gameState.currentLocation;
    if (from === spotId) return;
    if (!map.canTravelLocal(area, from, spotId)) {
        state.addLog('인접하지 않은 곳이다.');
        ui.updateAllUI();
        return;
    }
    const days = map.getLocalTravelDays(area, from, spotId);
    state.advanceDays(days, spotId);
    applyTravelDestination('local', spotId);
    ui.updateAllUI();
}

export function travelToArea(spotId) {
    const region = state.gameState.currentRegion;
    const from = state.gameState.currentArea;
    if (from === spotId) return;
    if (!map.canTravelArea(region, from, spotId)) {
        state.addLog(`${spotId}(은)는 인접 거점이 아니다.`);
        ui.updateAllUI();
        return;
    }
    const days = map.getAreaTravelDays(region, from, spotId);
    state.advanceDays(days, spotId);
    applyTravelDestination('area', spotId);
    ui.updateAllUI();
}