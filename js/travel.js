import * as state from './state.js';
import * as map from './map.js';
import * as events from './events.js';
import * as ui from './ui.js';
import * as battle from './battle.js';
import * as encounters from './encounters.js';

let pending = null;
let journeyRunning = false;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

export function requestTravel(type, targetId) {
    const gs = state.gameState;

    if (type === 'area') {
        if (!map.canTravelArea(gs.currentRegion, gs.currentArea, targetId)) {
            ui.mapToast(`${targetId} — 인접 거점이 아니다.`);
            return;
        }
        const days = map.getAreaTravelDays(gs.currentRegion, gs.currentArea, targetId);
        pending = { type, targetId, days, from: gs.currentArea };
        showConfirm(targetId, days, map.getTerrainLabel(targetId, gs.currentRegion), '지역 이동');
    } else if (type === 'local') {
        if (!map.canTravelLocal(gs.currentArea, gs.currentLocation, targetId)) {
            ui.mapToast(`${targetId} — 인접하지 않다.`);
            return;
        }
        const days = map.getLocalTravelDays(gs.currentArea, gs.currentLocation, targetId);
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
    const normalPct = Math.round(encounters.getTravelEncounterChance(gs.fame, days) * 100);
    const namedPct = Math.round(encounters.getNamedEncounterChance(gs.fame, days) * 100);

    document.getElementById('travel-target-name').textContent = name;
    document.getElementById('travel-target-icon').textContent = icon;
    document.getElementById('travel-days').textContent = state.formatDayLabel(days);
    document.getElementById('travel-terrain').textContent = terrain;
    document.getElementById('travel-kind').textContent = kind;
    document.getElementById('travel-from').textContent = pending.from;
    document.getElementById('travel-risk').textContent = `${normalPct}%`;
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
    if (!pending || journeyRunning) return;
    const trip = { ...pending };
    cancelTravel();
    startJourney(trip);
}

async function startJourney(trip) {
    journeyRunning = true;
    const { type, targetId, days, from } = trip;
    const gs = state.gameState;
    showTravelLoading(from, targetId, days);
    let aborted = false;
    let encounterCount = 0;

    for (let d = 1; d <= days; d++) {
        const progress = (d / days) * 100;
        updateTravelProgress(progress, `${d} / ${days}일째 — 길 위를 걷는 중...`);
        appendTravelLog(`🚶 ${d}일째: ${from}에서 ${targetId} 방향으로 이동 중`);
        await delay(550);

        const encounterArea = type === 'area' ? targetId : gs.currentArea;
        const roll = encounters.rollTravelEncounter(gs.fame, days, encounterArea);
        if (roll) {
            encounterCount++;
            const enemy = roll.enemy;
            const label = enemy.displayName || enemy.name;
            if (roll.type === 'named') {
                appendTravelLog(`🌟 <b class="text-amber-300">네임드 조우!</b> ${label}이 나타났다!`);
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

            const result = await battle.handleTravelEncounter(enemy);

            if (!gs.autoBattle) showTravelLoading(from, targetId, days);

            if (result.log) {
                for (const line of result.log) {
                    appendTravelLog(line);
                    await delay(gs.autoBattle ? 80 : 0);
                }
            }

            if (result.victory) {
                const mode = gs.autoBattle ? `자동 ${result.turns}턴` : '수동';
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
            } else {
                appendTravelLog('💀 패배! 여정이 중단되었다.');
                aborted = true;
                state.modifyStats({ hp: Math.max(1, Math.floor(gs.maxHp * 0.25)) });
                state.addLog(`이동 중 ${label}에게 패배하여 후퇴했다.`);
                hideTravelLoading();
                journeyRunning = false;
                ui.updateAllUI();
                return;
            }
            await delay(350);
        }

        gs.day += 1;
    }

    if (!aborted) {
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

    hideTravelLoading();
    journeyRunning = false;
    ui.updateAllUI();
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