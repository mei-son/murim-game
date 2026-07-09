import * as state from './state.js';
import * as map from './map.js';
import * as events from './events.js';
import * as ui from './ui.js';
import * as battle from './battle.js';
import * as encounters from './encounters.js';
import * as sects from './sects.js';
import * as debug from './debug.js';
import * as stamina from './stamina.js';

let pending = null;
let journeyRunning = false;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

export function getTravelDebugState() {
    return {
        journeyRunning,
        travelPending: pending ? { ...pending } : null,
    };
}

export function requestTravel(type, targetId) {
    const gs = state.gameState;
    debug.log('travel', 'requestTravel', { type, targetId, from: type === 'local' ? gs.currentLocation : gs.currentArea, journeyRunning });

    if (type === 'area') {
        if (!map.canTravelArea(gs.currentRegion, gs.currentArea, targetId)) {
            ui.mapToast(`${targetId} — 인접 거점이 아니다.`);
            return;
        }
        const days = map.getAreaTravelDays(gs.currentRegion, gs.currentArea, targetId);
        const stCost = stamina.getTravelStaminaCost(days, false);
        if (!stamina.canAfford(stCost, gs)) {
            ui.mapToast(stamina.staminaBlockedMessage('이동', stCost, gs));
            return;
        }
        pending = { type, targetId, days, from: gs.currentArea };
        showConfirm(targetId, days, map.getTerrainLabel(targetId, gs.currentRegion), '지역 이동');
    } else if (type === 'local') {
        if (!map.canTravelLocal(gs.currentArea, gs.currentLocation, targetId)) {
            ui.mapToast(`${targetId} — 인접하지 않다.`);
            return;
        }
        const days = map.getLocalTravelDays(gs.currentArea, gs.currentLocation, targetId);
        const stCost = stamina.getTravelStaminaCost(days, true);
        if (!stamina.canAfford(stCost, gs)) {
            ui.mapToast(stamina.staminaBlockedMessage('이동', stCost, gs));
            return;
        }
        const local = map.localMaps[gs.currentArea];
        const tile = local?.spots[targetId]?.tile ?? 'road';
        pending = { type, targetId, days, from: gs.currentLocation };
        showConfirm(targetId, days, map.TILE_TYPES[tile]?.label ?? '장소', '현장 이동');
    }
}

function showConfirm(name, days, terrain, kind) {
    const gs = state.gameState;
    const modal = document.getElementById('travel-modal');
    const icon = pending?.type === 'local'
        ? map.getLocalSpotIcon(gs.currentArea, name)
        : (map.regionAreas[gs.currentRegion]?.spots[name]?.icon ?? '📍');
    const destArea = pending?.type === 'area' ? name : gs.currentArea;
    const destLoc = pending?.type === 'local' ? name : gs.currentLocation;
    const destTerrain = map.getSpotTile(
        pending?.type === 'local' ? name : name,
        pending?.type === 'local' ? gs.currentArea : null,
        gs.currentRegion,
    ) || 'road';
    const wildRisk = encounters.formatWildernessRisk(destArea, destLoc, destTerrain, days, gs);
    const normalPct = wildRisk
        ? Math.round(encounters.getWildernessTravelChance(gs.fame, days, destTerrain) * 100)
        : Math.round(encounters.getTravelEncounterChance(gs.fame, days) * 100);
    const namedPct = Math.round(encounters.getNamedEncounterChance(gs.fame, days) * 100);

    document.getElementById('travel-target-name').textContent = name;
    document.getElementById('travel-target-icon').textContent = icon;
    document.getElementById('travel-days').textContent = state.formatDayLabel(days);
    document.getElementById('travel-terrain').textContent = terrain;
    document.getElementById('travel-kind').textContent = kind;
    document.getElementById('travel-from').textContent = pending.from;
    document.getElementById('travel-risk').textContent = wildRisk ? wildRisk : `${normalPct}%`;
    const travelStaminaEl = document.getElementById('travel-stamina-cost');
    if (travelStaminaEl) {
        const stCost = stamina.getTravelStaminaCost(days, pending?.type === 'local');
        travelStaminaEl.textContent = `${stCost} SP`;
        travelStaminaEl.className = stamina.canAfford(stCost, gs)
            ? 'text-lime-400 font-bold text-lg'
            : 'text-red-400 font-bold text-lg';
    }
    const travelStaminaCur = document.getElementById('travel-stamina-current');
    if (travelStaminaCur) travelStaminaCur.textContent = stamina.formatStamina(gs);
    const namedRiskEl = document.getElementById('travel-named-risk');
    if (namedRiskEl) namedRiskEl.textContent = `${namedPct}%`;
    const modeEl = document.getElementById('travel-battle-mode');
    if (modeEl) {
        modeEl.textContent = gs.autoBattle ? '자동' : '수동';
        modeEl.className = gs.autoBattle ? 'text-green-400 font-bold' : 'text-amber-400 font-bold';
    }
    modal.classList.remove('hidden');
}

export function cancelTravel() {
    pending = null;
    document.getElementById('travel-modal').classList.add('hidden');
}

export function confirmTravel() {
    if (journeyRunning) {
        debug.log('travel', 'confirmTravel blocked — journeyRunning', getTravelDebugState());
        ui.mapToast('이동이 아직 진행 중입니다. 전투 결과를 확인하거나 여정이 끝날 때까지 기다려 주세요.');
        return;
    }
    if (!pending) {
        debug.log('travel', 'confirmTravel blocked — no pending trip');
        return;
    }
    const gs = state.gameState;
    const trip = { ...pending };
    const stCost = stamina.getTravelStaminaCost(trip.days, trip.type === 'local');
    if (!stamina.canAfford(stCost, gs)) {
        ui.mapToast(stamina.staminaBlockedMessage('이동', stCost, gs));
        return;
    }
    debug.log('travel', 'confirmTravel → startJourney', trip);
    cancelTravel();
    startJourney(trip);
}

async function startJourney(trip) {
    journeyRunning = true;
    const { type, targetId, days, from } = trip;
    const gs = state.gameState;
    debug.log('travel', 'startJourney', { trip, day: gs.day, area: gs.currentArea });
    showTravelLoading(from, targetId, days);
    let aborted = false;
    let encounterCount = 0;

    const travelStaminaCost = stamina.getTravelStaminaCost(days, type === 'local');
    stamina.spend(travelStaminaCost, gs);
    state.addLog(`🚶 이동 준비 — 스테미나 ${travelStaminaCost} 소모 (${stamina.formatStamina(gs)})`);

    try {
        for (let d = 1; d <= days; d++) {
        const progress = (d / days) * 100;
        updateTravelProgress(progress, `${d} / ${days}일째 — 길 위를 걷는 중...`);
        appendTravelLog(`🚶 ${d}일째: ${from}에서 ${targetId} 방향으로 이동 중`);
        await delay(550);

        const encounterArea = type === 'area' ? targetId : gs.currentArea;
        const encounterLoc = type === 'local' ? targetId : gs.currentLocation;
        const encounterTerrain = map.getSpotTile(
            type === 'local' ? targetId : targetId,
            type === 'local' ? gs.currentArea : null,
            gs.currentRegion,
        ) || 'road';
        const roll = encounters.rollTravelEncounter(gs.fame, days, encounterArea, {
            terrain: encounterTerrain,
            location: encounterLoc,
        });
        if (roll) {
            encounterCount++;
            const enemy = roll.enemy;
            const label = enemy.displayName || enemy.name;
            let result;
            debug.log('travel', `day ${d} encounter`, { type: roll.type, enemy: label, autoBattle: gs.autoBattle });

            if (roll.type === 'named' && !encounters.shouldForceNamedBattle(gs, enemy)) {
                appendTravelLog(`🌟 <b class="text-amber-300">네임드 조우!</b> ${label} — 대응을 선택하세요.`);
                hideTravelLoading();
                result = await events.awaitNamedEncounterChoice(enemy, 'travel');
                showTravelLoading(from, targetId, days);
                updateTravelProgress(progress, `⚔️ ${label}과 교전...`);
            } else {
                if (roll.type === 'named') {
                    appendTravelLog(`🌟 <b class="text-amber-300">네임드 조우!</b> ${label} — ${encounters.getForcedNamedBattleMessage(gs, enemy)}`);
                } else {
                    appendTravelLog(`⚠️ <b class="text-red-400">돌발 조우!</b> ${enemy.name}이 길을 막았다!`);
                }
                updateTravelProgress(progress, `⚔️ ${label}과 교전 중...`);
                await delay(400);

                if (gs.autoBattle) {
                    appendTravelLog(`🤖 자동 전투 진행 중...`);
                } else {
                    appendTravelLog(`⚔️ 수동 전투! 전투창에서 대응하세요.`);
                    hideTravelLoading();
                }

                result = await battle.handleTravelEncounter(enemy);
                debug.log('travel', 'handleTravelEncounter resolved', { victory: result?.victory, fled: result?.fled, named: result?.named });

                if (!gs.autoBattle) showTravelLoading(from, targetId, days);
            }

            if (result.log) {
                for (const line of result.log) {
                    appendTravelLog(line);
                    await delay(gs.autoBattle ? 80 : 0);
                }
            }

            if (result.vanished) {
                appendTravelLog(`🌫️ <b class="text-zinc-400">${label}</b>이 묘연하게 사라졌다.`);
            } else if (result.peaceful) {
                appendTravelLog(`🤝 <b class="text-cyan-300">${label}</b>과 사사로 겨루었다.`);
            } else if (result.refused || result.talked) {
                appendTravelLog(`💬 ${label} — 대화만 나누고 헤어졌다.`);
            } else if (result.spar) {
                if (result.victory) {
                    appendTravelLog(`⚔️ <b class="text-cyan-300">${label}</b>과 비무에서 승리!`);
                } else {
                    appendTravelLog(`⚔️ ${label}과의 비무에서 밀렸다. 여정은 계속된다.`);
                }
            } else if (result.victory) {
                const mode = gs.autoBattle ? `자동 ${result.turns || '?'}턴` : '수동';
                if (result.named) {
                    appendTravelLog(`🏆 <b class="text-amber-400">${label}</b> 격파! 명성 대폭 상승 (${mode})`);
                } else {
                    appendTravelLog(`✅ ${enemy.name}을(를) 물리쳤다! (${mode})`);
                }
                if (result.rewards?.item) {
                    appendTravelLog(`${result.rewards.item.icon} ${result.rewards.item.name} 획득!`);
                }
            } else if (result.fled) {
                appendTravelLog(`🏃 ${label}(을)를 피해 도망쳤다.`);
            } else if (!result.spar) {
                appendTravelLog('💀 패배! 여정이 중단되었다.');
                aborted = true;
                state.modifyStats({ hp: Math.max(1, Math.floor(gs.maxHp * 0.25)) });
                state.addLog(`이동 중 ${label}에게 패배하여 후퇴했다.`);
                return;
            }
            await delay(350);
        }

        gs.day += 1;
        stamina.onDayAdvanced(gs);
    }

    if (!aborted) {
        sects.onDayAdvanced(gs, 'travel');
        events.applyTravelDestination(type, targetId);
        updateTravelProgress(100, `📍 ${targetId} 도착!`);
        appendTravelLog(`🎉 <b class="text-amber-400">${targetId}</b>(에) 무사히 도착 (제 ${gs.day}일)`);
        if (encounterCount > 0) {
            state.addLog(`${days}일간 이동, 돌발 전투 ${encounterCount}회 후 ${targetId} 도착.`);
        } else {
            state.addLog(`${days}일간 이동하여 ${targetId}(에) 도착했다.`);
        }
        if (days >= 3) {
            const fatigue = Math.floor(days / 3);
            state.modifyStats({ hp: gs.hp - fatigue });
            if (fatigue > 0) appendTravelLog(`😓 장거리 이동으로 체력 ${fatigue} 소모`);
        }
        await delay(900);
    }
    } catch (err) {
        debug.error('travel', 'startJourney failed', err);
        state.addLog('이동 중 문제가 발생해 여정이 중단되었다.');
    } finally {
        debug.log('travel', 'startJourney finally', { aborted, encounterCount, journeyRunning: false });
        hideTravelLoading();
        journeyRunning = false;
        ui.updateAllUI();
    }
}

function showTravelLoading(from, to, days) {
    const el = document.getElementById('travel-loading');
    document.getElementById('travel-loading-title').textContent = `${from} → ${to}`;
    document.getElementById('travel-loading-sub').textContent = `${state.formatDayLabel(days)} 여정`;
    document.getElementById('travel-loading-bar').style.width = '0%';
    document.getElementById('travel-loading-status').textContent = '길을 준비하는 중...';
    document.getElementById('travel-loading-log').innerHTML = '';
    el.classList.remove('hidden');
}

function updateTravelProgress(pct, status) {
    document.getElementById('travel-loading-bar').style.width = `${pct}%`;
    document.getElementById('travel-loading-status').textContent = status;
}

function appendTravelLog(html) {
    const log = document.getElementById('travel-loading-log');
    const p = document.createElement('p');
    p.className = 'text-sm text-zinc-400 border-l-2 border-amber-800 pl-2 py-0.5';
    p.innerHTML = html;
    log.prepend(p);
}

function hideTravelLoading() {
    document.getElementById('travel-loading').classList.add('hidden');
}