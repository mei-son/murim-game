import * as state from './state.js';
import * as martial from './martial.js';
import * as hero from './hero.js';
import * as ui from './ui.js';
import * as battle from './battle.js';
import * as map from './map.js';
import * as encounters from './encounters.js';

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
                    text: '🛡️ 낭인을 구해준다 (협의 +5)',
                    type: 'good',
                    effect: () => {
                        state.applyChivalryChange(5);
                        state.gameState.savedWanderer = true;
                        state.addLog('낭인을 구해주었다. 감사의 뜻으로 은전 20냥을 받았다.');
                        state.modifyStats({ gold: state.gameState.gold + 20 });
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
                    text: '💰 낭인의 재물을 노린다 (협의 -5)',
                    type: 'evil',
                    effect: () => {
                        state.applyChivalryChange(-5);
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
                        state.applyChivalryChange(2);
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
                    effect: () => {
                        if (state.gameState.naegong < 20) {
                            state.addLog('내공이 부족하여 수련할 수 없다.');
                            return;
                        }
                        state.modifyStats({ naegong: state.gameState.naegong - 20, atk: state.gameState.atk + 3, fame: state.gameState.fame + 2 });
                        state.addLog('청성 심법을 익혔다. 공격력이 상승했다.');
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
    '峨嵋금정': [
        {
            id: 'alliance',
            explore: false,
            title: '峨嵋 입문 시험',
            icon: '🔔',
            desc: '峨嵋파에 입문하려면 시험을 통과해야 한다. 명성 5 이상이어야 응시할 수 있다.',
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
                    effect: () => state.addLog('峨嵋금정의 웅장함에 감탄했다.'),
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
    state.checkNaegongUnlock();
    hero.applyStoredHeroName(gs);
    state.addLog('복면을 쓴 채 촉남촌에 들어섰다. 별호 없음, 성향 중립. 내공은 아직 닫혀 있다.');
    ui.updateAllUI();
    if (hero.shouldPromptHeroName()) {
        ui.showNameModal();
    }
}

export function gatherIntel() {
    const result = encounters.rollGatherIntel();
    if (result.type === 'named') {
        state.addLog(`📡 정보 수집 중 ${result.enemy.name}과 마주쳤다!`);
        battle.startNamedBattle(result.enemy, 'gather');
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

function getExploreEventPool(loc) {
    return (locationEvents[loc] || []).filter(e => {
        if (e.explore === false) return false;
        if (e.once && state.gameState[e.once]) return false;
        if (e.condition && !e.condition()) return false;
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

export function exploreLocation() {
    const loc = state.gameState.currentArea;
    const pool = getExploreEventPool(loc);

    state.gameState.currentEvent = null;

    if (!pool.length || Math.random() > EXPLORE_EVENT_CHANCE) {
        const msg = EXPLORE_NOTHING_MSGS[Math.floor(Math.random() * EXPLORE_NOTHING_MSGS.length)];
        state.addLog(`🔍 ${msg}`);
        ui.updateAllUI();
        return;
    }

    const event = pickExploreEvent(pool);
    state.gameState.currentEvent = event;
    state.addLog(`🔍 주변 탐색 중 — ${event.title}`);
    ui.updateAllUI();
}

export function makeChoice(index) {
    const event = state.gameState.currentEvent;
    if (!event) return;
    const choice = event.choices[index];
    if (choice?.effect) choice.effect();
    state.gameState.currentEvent = null;
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