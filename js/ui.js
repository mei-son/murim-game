import * as state from './state.js';
import * as map from './map.js';
import * as places from './places.js';
import * as sects from './sects.js';
import * as shops from './shops.js';
import { SHOP_STOCK } from './places.js';
import * as rest from './rest.js';
import * as martial from './martial.js';
import * as hero from './hero.js';
import * as realm from './realm.js';
import * as enlightenment from './enlightenment.js';
import * as intel from './intel.js';

let infoTab = 'character';

export function toggleInventoryPopover() {
    inventoryPopoverOpen = !inventoryPopoverOpen;
    renderToolbar();
}

export function closeInventoryPopover() {
    inventoryPopoverOpen = false;
    document.getElementById('inventory-popover')?.classList.add('hidden');
}

const INFO_MODAL_SIZE_KEY = 'murim-info-modal-size';

export function initUI() {
    document.addEventListener('click', (e) => {
        if (!inventoryPopoverOpen) return;
        const wrap = document.getElementById('header-inventory-btn')?.parentElement;
        if (wrap && !wrap.contains(e.target)) closeInventoryPopover();
    });
    initInfoModalResize();
    renderToolbar();
    renderStats();
    renderMap();
    renderMainPanel();
}

function initInfoModalResize() {
    const box = document.getElementById('info-modal-box');
    const handle = document.getElementById('info-modal-resize');
    if (!box || !handle) return;

    try {
        const saved = JSON.parse(localStorage.getItem(INFO_MODAL_SIZE_KEY) || 'null');
        if (saved?.width && saved?.height) {
            box.style.width = `${saved.width}px`;
            box.style.height = `${saved.height}px`;
        }
    } catch { /* ignore */ }

    let dragging = false;
    let startX = 0, startY = 0, startW = 0, startH = 0;

    const onMove = (e) => {
        if (!dragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const w = Math.max(520, Math.min(window.innerWidth * 0.98, startW + (clientX - startX)));
        const h = Math.max(360, Math.min(window.innerHeight * 0.92, startH + (clientY - startY)));
        box.style.width = `${w}px`;
        box.style.height = `${h}px`;
    };

    const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        document.body.style.userSelect = '';
        const rect = box.getBoundingClientRect();
        localStorage.setItem(INFO_MODAL_SIZE_KEY, JSON.stringify({
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        }));
    };

    const onStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        const rect = box.getBoundingClientRect();
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startW = rect.width;
        startH = rect.height;
        document.body.style.userSelect = 'none';
    };

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
}

export function updateAllUI() {
    renderToolbar();
    renderStats();
    renderMap();
    renderMainPanel();
    if (!document.getElementById('info-modal').classList.contains('hidden')) {
        renderInfoContent();
    }
}

let inventoryPopoverOpen = false;

export function renderToolbar() {
    const gs = state.gameState;
    const levelEl = document.getElementById('header-level');
    const expEl = document.getElementById('header-exp');
    const goldEl = document.getElementById('header-gold');
    const ngEl = document.getElementById('header-naegong');
    const ngFillEl = document.getElementById('header-ng-fill');
    const invCountEl = document.getElementById('header-inventory-count');
    const invListEl = document.getElementById('inventory-popover-list');
    const invPopover = document.getElementById('inventory-popover');
    const toggleEl = document.getElementById('auto-battle-toggle');

    if (levelEl) levelEl.textContent = gs.level;
    if (expEl) {
        const need = gs.level * 30;
        expEl.textContent = `EXP ${gs.exp}/${need}`;
    }
    if (goldEl) goldEl.textContent = gs.gold;
    const ngUnlocked = martial.isNaegongUnlocked(gs);
    if (ngEl) ngEl.textContent = ngUnlocked ? `${gs.naegong}/${gs.maxNaegong}` : '내공 미타동';
    if (ngFillEl) {
        const pct = ngUnlocked && gs.maxNaegong > 0 ? (gs.naegong / gs.maxNaegong) * 100 : 0;
        ngFillEl.style.width = `${pct}%`;
        ngFillEl.parentElement?.classList.toggle('opacity-40', !ngUnlocked);
    }
    const items = gs.inventory || [];
    if (invCountEl) invCountEl.textContent = items.length;
    if (invListEl) {
        invListEl.innerHTML = items.length
            ? items.map(item => `
                <div class="inv-pop-item">
                    <span>${item.icon} ${item.name}</span>
                    ${item.type === 'consumable' ? `
                    <button onclick="window.useItem('${item.id}')"
                        class="px-2 py-0.5 text-xs bg-amber-800 hover:bg-amber-700 rounded choice-btn">사용</button>` : `
                    <span class="text-xs text-zinc-500">장비</span>`}
                </div>`).join('')
            : '<p class="inv-pop-empty">소지품이 없습니다</p>';
    }
    if (invPopover) {
        invPopover.classList.toggle('hidden', !inventoryPopoverOpen);
    }
    if (toggleEl) {
        const on = gs.autoBattle;
        toggleEl.className = `auto-battle-toggle choice-btn ${on ? 'auto-on' : 'auto-off'}`;
        toggleEl.innerHTML = on
            ? '<i class="fas fa-robot mr-2"></i><span>자동전투</span><span class="toggle-badge on">ON</span>'
            : '<i class="fas fa-hand-paper mr-2"></i><span>자동전투</span><span class="toggle-badge off">OFF</span>';
        toggleEl.title = on
            ? '클릭하여 OFF — 전투·이동 조우 시 수동 전투'
            : '클릭하여 ON — 전투·이동 조우 시 자동 처리';
        toggleEl.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
}

function renderStats() {
    const bar = document.getElementById('stats-bar');
    const gs = state.gameState;
    const cards = [
        { label: '명성', value: gs.fame, icon: 'fa-star', color: 'text-yellow-400' },
        { label: '악명', value: gs.notoriety, icon: 'fa-skull', color: 'text-red-400' },
        { label: '협의', value: gs.chivalry, icon: 'fa-hand-holding-heart', color: 'text-blue-400' },
        { label: '체력', value: `${gs.hp}/${gs.maxHp}`, icon: 'fa-heart', color: 'text-rose-400' },
        { label: '내공', value: martial.isNaegongUnlocked(gs) ? `${gs.naegong}/${gs.maxNaegong}` : '내공 미타동', icon: 'fa-fire', color: 'text-orange-400' },
    ];
    bar.innerHTML = cards.map(c => `
        <div class="section-card p-4 text-center rounded-2xl">
            <i class="fas ${c.icon} ${c.color} text-xl mb-1"></i>
            <div class="text-xs text-zinc-400">${c.label}</div>
            <div class="text-lg font-bold">${c.value}</div>
        </div>
    `).join('');

    const alignEl = document.getElementById('alignment-badge');
    if (alignEl) {
        const align = state.getAlignment();
        alignEl.className = `text-sm font-bold ${align.color}`;
        alignEl.textContent = align.label;
    }
    const dayEl = document.getElementById('day-badge');
    if (dayEl) dayEl.textContent = `강호 제 ${gs.day}일`;
}

function getMapContext(gs) {
    if (gs.mapView === 'local') {
        const area = gs.currentArea;
        return {
            layout: map.localNodeLayout[area],
            connections: map.localMaps[area]?.connections ?? {},
            current: gs.currentLocation,
            travelType: 'local',
            title: `${area} · 현장`,
            subtitle: `📍 ${gs.currentLocation}`,
            getDays: (to) => map.getLocalTravelDays(area, gs.currentLocation, to),
            canReach: (to) => map.canTravelLocal(area, gs.currentLocation, to),
            getIcon: (id) => map.getLocalSpotIcon(area, id),
            getLabel: (id) => id,
        };
    }
    if (gs.mapView === 'world') {
        return {
            layout: map.worldNodeLayout,
            connections: map.regionConnections,
            current: gs.currentRegion,
            travelType: null,
            title: '천하도',
            subtitle: `현재 도: ${gs.currentRegion}`,
            getDays: (to) => map.getRegionTravelDays(gs.currentRegion, to),
            canReach: (to) => {
                const adj = map.getRegionConnections(gs.currentRegion).includes(to);
                return adj || gs.visitedRegions.includes(to) || to === gs.currentRegion;
            },
            getIcon: (id) => map.worldRegions[id]?.icon ?? '📍',
            getLabel: (id) => gs.visitedRegions.includes(id) || id === gs.currentRegion ? id : '???',
            onClick: (id) => `window.selectWorldRegion('${id}')`,
        };
    }
    const region = gs.viewRegion;
    const data = map.regionAreas[region];
    return {
        layout: map.regionNodeLayout[region] ?? {},
        connections: data?.connections ?? {},
        current: gs.currentArea,
        travelType: region === gs.currentRegion ? 'area' : null,
        title: `${region} · 지역`,
        subtitle: region === gs.currentRegion ? `📍 ${gs.currentArea}` : '먼 곳을 열람 중',
        getDays: (to) => map.getAreaTravelDays(region, gs.currentArea, to),
        canReach: (to) => region === gs.currentRegion && map.canTravelArea(region, gs.currentArea, to),
        getIcon: (id) => data?.spots[id]?.icon ?? '📍',
        getLabel: (id) => {
            const visited = gs.visitedAreas.includes(id);
            return visited || id === gs.currentArea ? id : '???';
        },
    };
}

export function renderMap() {
    const gs = state.gameState;
    const ctx = getMapContext(gs);

    const breadcrumb = document.getElementById('map-breadcrumb');
    if (breadcrumb) {
        breadcrumb.innerHTML = `
            <button onclick="window.setMapView('region')" class="map-crumb ${gs.mapView === 'region' ? 'active' : ''}">${gs.currentRegion}</button>
            <span class="text-zinc-600">›</span>
            <button onclick="window.goToMyLocation()" class="map-crumb ${gs.mapView === 'local' ? 'active' : ''}">${gs.currentLocation}</button>
            <span class="text-zinc-600 mx-1">|</span>
            <button onclick="window.setMapView('world')" class="map-crumb ${gs.mapView === 'world' ? 'active' : ''}">천하</button>
        `;
    }

    const titleEl = document.getElementById('map-title');
    if (titleEl) titleEl.textContent = ctx.title;
    const subEl = document.getElementById('map-subtitle');
    if (subEl) subEl.textContent = ctx.subtitle;

    const svgEl = document.getElementById('node-map-svg');
    if (svgEl) svgEl.innerHTML = buildNodeSvg(ctx, gs);

    const listEl = document.getElementById('travel-list');
    if (listEl) listEl.innerHTML = buildTravelList(ctx, gs);
}

function buildNodeSvg(ctx, gs) {
    if (!ctx.layout || !Object.keys(ctx.layout).length) {
        return '<text x="50" y="50" text-anchor="middle" fill="#71717a" font-size="4">지도 없음</text>';
    }

    const edges = map.getGraphEdges(ctx.connections);
    let svg = '';

    for (const [a, b] of edges) {
        const pa = ctx.layout[a];
        const pb = ctx.layout[b];
        if (!pa || !pb) continue;
        const active = ctx.canReach(b) && ctx.current === a || ctx.canReach(a) && ctx.current === b;
        svg += `<line x1="${pa.x}" y1="${pa.y}" x2="${pb.x}" y2="${pb.y}"
            class="map-edge${active ? ' map-edge-active' : ''}" />`;
        if (active) {
            const days = ctx.current === a ? ctx.getDays(b) : ctx.getDays(a);
            const mx = (pa.x + pb.x) / 2;
            const my = (pa.y + pb.y) / 2;
            svg += `<text x="${mx}" y="${my - 1}" class="map-edge-days">${state.formatDayLabel(days)}</text>`;
        }
    }

    for (const [id, pos] of Object.entries(ctx.layout)) {
        const isHere = ctx.current === id;
        const canGo = ctx.canReach(id) && !isHere;
        const visited = gs.visitedAreas.includes(id) || gs.visitedRegions.includes(id) || isHere;
        const label = ctx.getLabel(id);
        const icon = visited || gs.mapView === 'world' ? ctx.getIcon(id) : '❓';

        let nodeClass = 'map-node';
        if (isHere) nodeClass += ' map-node-current';
        else if (canGo) nodeClass += ' map-node-reachable';
        else if (!visited && ctx.travelType) nodeClass += ' map-node-fog';

        let click = '';
        if (isHere) {
            click = '';
        } else if (canGo && ctx.travelType) {
            click = `onclick="window.requestTravel('${ctx.travelType}','${id}')"`;
        } else if (ctx.onClick && ctx.canReach(id)) {
            click = `onclick="${ctx.onClick(id)}"`;
        } else if (ctx.onClick) {
            click = `onclick="window.mapToast('아직 ${id}(으)로 가는 길을 모른다.')"`;
        }

        svg += `
            <g class="${nodeClass}" transform="translate(${pos.x},${pos.y})" ${click}>
                <circle r="5.5" class="map-node-bg" />
                ${isHere ? '<circle r="7" class="map-node-ring" />' : ''}
                <text class="map-node-icon" y="1.8">${icon}</text>
                <text class="map-node-label" y="11">${label}</text>
                ${isHere ? '<text class="map-node-player" x="6" y="-5">🥷</text>' : ''}
            </g>
        `;
    }
    return svg;
}

function buildTravelList(ctx, gs) {
    if (!ctx.travelType) {
        if (gs.mapView === 'world') {
            return `<p class="text-xs text-zinc-500 p-2">도를 클릭하면 지역도를 열람합니다.</p>`;
        }
        return `<p class="text-xs text-zinc-500 p-2">먼 곳을 보고 있습니다.<br>이동은 ${gs.currentRegion} 지역도에서.</p>`;
    }

    const from = ctx.travelType === 'local' ? gs.currentLocation : gs.currentArea;
    const dests = (ctx.connections[from] ?? [])
        .map(id => ({
            id,
            days: ctx.getDays(id),
            icon: ctx.getIcon(id),
            label: ctx.getLabel(id),
        }))
        .sort((a, b) => a.days - b.days);

    if (!dests.length) {
        return `<p class="text-xs text-zinc-500 p-2">이동 가능한 곳이 없습니다.</p>`;
    }

    return `
        <div class="text-xs text-zinc-500 px-2 py-1 border-b border-zinc-700">이동 가능</div>
        ${dests.map(d => `
            <button onclick="window.requestTravel('${ctx.travelType}','${d.id}')"
                class="travel-item choice-btn w-full text-left px-3 py-2.5 border-b border-zinc-800 hover:bg-zinc-800/60">
                <div class="flex items-center gap-2">
                    <span class="text-lg">${d.icon}</span>
                    <span class="flex-1 text-sm font-medium">${d.label}</span>
                    <span class="travel-days-badge">${state.formatDayLabel(d.days)}</span>
                </div>
            </button>
        `).join('')}
    `;
}

export function setMapView(level) {
    const gs = state.gameState;
    gs.mapView = level;
    if (level === 'region') gs.viewRegion = gs.currentRegion;
    if (level === 'world') state.visitRegion(gs.currentRegion);
    updateAllUI();
}

export function goToMyLocation() {
    const gs = state.gameState;
    gs.mapView = 'local';
    gs.viewRegion = gs.currentRegion;
    updateAllUI();
}

export function selectWorldRegion(regionId) {
    const gs = state.gameState;
    state.visitRegion(regionId);
    gs.viewRegion = regionId;
    gs.mapView = 'region';
    if (regionId !== gs.currentRegion) {
        state.addLog(`${regionId} 지역도를 펼쳐보았다.`);
    }
    updateAllUI();
}

export function mapToast(msg) {
    const el = document.getElementById('map-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden', 'opacity-0');
    clearTimeout(mapToast._t);
    mapToast._t = setTimeout(() => el.classList.add('opacity-0'), 2500);
}

export function renderMainPanel() {
    const panel = document.getElementById('main-panel');
    const gs = state.gameState;
    const meta = map.getLocationMeta(gs.currentArea);

    if (gs.currentEvent) {
        panel.innerHTML = renderEvent(gs.currentEvent);
        return;
    }

    if (gs.placeUI?.view === 'rest') {
        panel.innerHTML = renderRestMenu(gs);
        return;
    }

    if (gs.placeUI) {
        panel.innerHTML = renderPlaceSubView(gs);
        return;
    }

    const subLoc = gs.currentLocation !== gs.currentArea
        ? `<span class="text-amber-500"> › ${gs.currentLocation}</span>` : '';

    const heroDisp = hero.getHeroDisplay(gs);
    const evRate = martial.getEvasionRate(gs);
    const intelRate = intel.getIntelSuccessPercent(gs);
    panel.innerHTML = `
        <div class="flex items-center gap-4 mb-6">
            ${renderHeroAvatar(heroDisp)}
            <div class="flex-1">
                <h2 class="text-2xl font-bold text-amber-300">${heroDisp.name}</h2>
                <p class="text-zinc-500 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>별호 <span class="text-zinc-300">${heroDisp.aliasDisplay}</span></span>
                    <span class="text-zinc-600">·</span>
                    <span>성향 <span class="${heroDisp.disposition.color}">${heroDisp.disposition.label}</span></span>
                    ${heroDisp.sectStanding?.rank === 'leader'
                        ? `<span class="text-zinc-600">·</span><span class="text-amber-400/90">${heroDisp.publicLabel.sect} 문파장</span>`
                        : ''}
                    <span class="text-zinc-600">·</span>
                    <span class="${heroDisp.realm.color} font-medium">【${heroDisp.realmName}】</span>
                </p>
                <p class="text-zinc-400 mt-1">Lv.${gs.level} · 공격 ${gs.atk} · 방어 ${gs.def} · 회피 ${evRate}%</p>
                <p class="text-zinc-500 text-sm mt-1">${gs.currentRegion}${subLoc} · <span class="text-amber-600">제 ${gs.day}일</span></p>
            </div>
        </div>
        ${renderPlaceHub(gs, meta)}
        <div class="grid grid-cols-3 gap-3 mb-6">
            <button onclick="window.exploreLocation()"
                class="choice-btn p-4 bg-amber-800/40 hover:bg-amber-700/60 border border-amber-600 rounded-xl font-bold">
                <i class="fas fa-compass mr-2"></i>주변 탐색
            </button>
            <button onclick="window.gatherIntel()"
                class="choice-btn p-4 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-600 rounded-xl font-bold">
                <i class="fas fa-ear-listen mr-2"></i>정보 수집
                <div class="text-xs font-normal text-blue-300/80 mt-1">성공 ~${intelRate}% · 적 조우 34%</div>
            </button>
            <button onclick="window.openRestMenu()"
                class="choice-btn p-4 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-600 rounded-xl font-bold">
                <i class="fas fa-bed mr-2"></i>휴식·숙박
                <div class="text-xs font-normal text-emerald-300/80 mt-1">노숙 / 숙박 / 기연</div>
            </button>
        </div>
        ${renderLog(gs.eventLog)}
    `;
}

function renderRestMenu(gs) {
    const options = rest.getRestOptions(gs);
    const meta = rest.getRestMenuMeta(gs);
    return `
        <div class="event-card p-6 rounded-2xl">
            <button onclick="window.closeRestMenu()" class="text-sm text-zinc-500 hover:text-amber-400 mb-4 choice-btn">← 돌아가기</button>
            <h3 class="text-xl font-bold text-emerald-400 mb-2"><i class="fas fa-bed mr-2"></i>휴식·숙박</h3>
            <p class="text-sm text-zinc-500 mb-2">${gs.currentLocation} — 회복 방식을 선택하세요.</p>
            ${meta.notice ? `
            <p class="text-sm text-amber-600/90 bg-amber-950/30 border border-amber-800/50 rounded-lg px-3 py-2 mb-4">
                <i class="fas fa-info-circle mr-1"></i>${meta.notice}
            </p>` : ''}
            <div class="space-y-3">
                ${options.map(o => `
                    <button onclick="window.performRest('${o.id}'${o.sectId ? `,'${o.sectId}'` : ''})"
                        class="choice-btn w-full text-left p-4 rounded-xl border transition-all
                            ${o.id === 'camp' ? 'border-zinc-600 bg-zinc-800/40 hover:bg-zinc-700/50' :
                              o.id === 'inn' ? 'border-emerald-700 bg-emerald-900/25 hover:bg-emerald-900/40' :
                              'border-amber-600 bg-amber-900/25 hover:bg-amber-900/40'}">
                        <div class="flex justify-between items-start gap-2">
                            <div>
                                <b>${o.icon} ${o.label}</b>
                                <div class="text-sm text-zinc-400 mt-1">${o.desc}</div>
                                <div class="text-xs text-zinc-500 mt-1">${o.detail}</div>
                            </div>
                            ${o.cost > 0 ? `<span class="text-amber-400 font-bold shrink-0">${o.cost}냥</span>` :
                              o.id === 'camp' ? '<span class="text-zinc-500 text-xs shrink-0">무료</span>' :
                              '<span class="text-amber-300 text-xs shrink-0">우대</span>'}
                        </div>
                    </button>
                `).join('')}
            </div>
        </div>
        ${renderLog(gs.eventLog)}
    `;
}

function renderPlaceHub(gs, meta) {
    const profile = places.getPlaceProfile(gs.currentLocation, gs.currentArea);
    const scale = places.getScaleInfo(profile.scale);
    const shopIds = profile.shops || [];
    const sectIds = profile.sects || [];

    const shopChips = shopIds.map(id => {
        const s = places.SHOPS[id];
        return s ? `<span class="place-chip">${s.icon} ${s.name}</span>` : '';
    }).join('');

    const sectChips = sectIds.map(id => {
        const s = sects.getSect(id);
        if (!s) return '';
        const aff = sects.getAffinityLabel(sects.getAffinity(id));
        return `<span class="place-chip sect-chip">${s.icon} ${s.name} <span class="${aff.color} text-xs">(${aff.label})</span></span>`;
    }).join('');

    return `
        <div class="event-card p-6 rounded-2xl mb-6">
            <div class="flex flex-wrap items-center gap-2 mb-3">
                <h3 class="text-xl font-bold text-amber-400">${meta.icon} ${gs.currentLocation}</h3>
                <span class="scale-badge" title="${scale.desc}">${scale.icon} ${scale.label}</span>
            </div>
            <p class="text-zinc-300 leading-relaxed">${meta.desc}</p>
            <p class="text-zinc-500 text-sm mt-2">${scale.desc}</p>
            ${shopIds.length ? `
            <div class="mt-4">
                <div class="text-xs text-zinc-500 mb-2"><i class="fas fa-store mr-1"></i>상점 ${shopIds.length}곳</div>
                <div class="flex flex-wrap gap-2 mb-2">${shopChips}</div>
                <button onclick="window.openShopsList()"
                    class="choice-btn px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl text-sm font-bold">
                    <i class="fas fa-shopping-bag mr-1"></i>상점 방문
                </button>
            </div>` : ''}
            ${sectIds.length ? `
            <div class="mt-4">
                <div class="text-xs text-zinc-500 mb-2"><i class="fas fa-yin-yang mr-1"></i>문파 ${sectIds.length}곳</div>
                <div class="flex flex-wrap gap-2 mb-2">${sectChips}</div>
                <button onclick="window.openSectsList()"
                    class="choice-btn px-4 py-2 bg-blue-900/50 hover:bg-blue-800/60 border border-blue-600 rounded-xl text-sm font-bold">
                    <i class="fas fa-torii-gate mr-1"></i>문파 방문
                </button>
            </div>` : `
            <p class="text-zinc-600 text-sm mt-4">이 규모의 거점에는 머무는 문파가 없다.</p>`}
            <p class="text-zinc-500 mt-4 text-sm">이곳에서 무엇을 하시겠습니까?</p>
        </div>
    `;
}

function renderPlaceSubView(gs) {
    const uiState = gs.placeUI;
    const profile = places.getPlaceProfile(gs.currentLocation, gs.currentArea);

    if (uiState.view === 'shops') {
        const items = (profile.shops || []).map(id => {
            const s = places.SHOPS[id];
            if (!s) return '';
            return `
                <button onclick="window.openShop('${id}')"
                    class="choice-btn w-full text-left p-4 rounded-xl border border-zinc-600 bg-zinc-800/50 hover:bg-zinc-700/50">
                    <span class="text-2xl mr-3">${s.icon}</span>
                    <span class="font-bold">${s.name}</span>
                    <span class="text-zinc-500 text-sm ml-2">${s.desc}</span>
                </button>`;
        }).join('');
        return wrapPlacePanel('상점', items || '<p class="text-zinc-500">상점이 없다.</p>');
    }

    if (uiState.view === 'shop') {
        const shopId = uiState.shopId;
        const info = shops.getShopInfo(shopId);
        const stock = SHOP_STOCK[shopId] || [];
        const items = stock.map((item, i) => {
            const label = item.name || item.item || '물품';
            const icon = item.icon || (item.item ? encountersItemIcon(item.item) : '📦');
            const effect = itemDesc(item);
            return `
                <button onclick="window.buyShopItem('${shopId}',${i})"
                    class="choice-btn w-full text-left p-3 rounded-xl border border-amber-800/50 bg-zinc-800/40 hover:bg-amber-900/30">
                    <div class="flex justify-between items-center">
                        <span>${icon} <b>${label}</b> <span class="text-zinc-500 text-xs">${effect}</span></span>
                        <span class="text-amber-400 font-bold">${item.gold}냥</span>
                    </div>
                </button>`;
        }).join('');
        return wrapPlacePanel(`${info.icon} ${info.name}`, items, true);
    }

    if (uiState.view === 'sects') {
        const items = (profile.sects || []).map(id => {
            const s = sects.getSect(id);
            if (!s) return '';
            const aff = sects.getAffinityLabel(sects.getAffinity(id));
            const tierLabel = { 본문: '정파 본문', 분파: '분파', 속가: '속가제자' }[s.tier] || s.tier;
            return `
                <button onclick="window.openSect('${id}')"
                    class="choice-btn w-full text-left p-4 rounded-xl border border-blue-800/50 bg-blue-900/20 hover:bg-blue-900/40">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">${s.icon}</span>
                        <div class="flex-1">
                            <div class="font-bold text-amber-200">${s.name}</div>
                            <div class="text-xs text-zinc-500">${tierLabel} · ${s.faction}</div>
                        </div>
                        <span class="${aff.color} text-sm font-bold">${aff.label}</span>
                    </div>
                </button>`;
        }).join('');
        return wrapPlacePanel('문파', items || '<p class="text-zinc-500">문파가 없다.</p>');
    }

    if (uiState.view === 'sect') {
        return renderSectPanel(uiState.sectId);
    }

    return '';
}

function encountersItemIcon(itemId) {
    const icons = { 영초: '🌿', 내공단: '💊', 청강검: '⚔️', 호신갑: '🛡️', 무림첩: '📜' };
    return icons[itemId] || '📦';
}

function itemDesc(item) {
    const parts = [];
    if (item.hp) parts.push(`체력+${item.hp}`);
    if (item.naegong) parts.push(`내공+${item.naegong}`);
    if (item.atk) parts.push(`공격+${item.atk}`);
    if (item.exp) parts.push(`EXP+${item.exp}`);
    if (item.intel) parts.push('소문');
    return parts.length ? `(${parts.join(', ')})` : '';
}

function renderSectPanel(sectId) {
    const s = sects.getSect(sectId);
    const gs = state.gameState;
    if (!s) return wrapPlacePanel('문파', '<p>알 수 없는 문파</p>');

    const aff = sects.getAffinity(sectId);
    const affLabel = sects.getAffinityLabel(aff);
    const levelOk = gs.level >= s.minSparLevel;
    const sparHint = levelOk
        ? `Lv.${s.minSparLevel} 이상 — 대련 가능`
        : `Lv.${s.minSparLevel} 미만 — ${s.sparFee}냥 필요 또는 거부`;
    const lodgeNeed = s.tier === '본문' ? 15 : s.tier === '분파' ? 28 : 40;
    const canLodge = aff >= lodgeNeed;
    const dojoInfo = sects.getDojoChallengeInfo(sectId);
    const dojoStages = dojoInfo
        ? dojoInfo.stageNames.map((n, i) => `<span class="text-xs text-zinc-500">${i + 1}. ${n}</span>`).join(' · ')
        : '';

    return `
        <div class="event-card p-6 rounded-2xl">
            <button onclick="window.openSectsList()" class="text-sm text-zinc-500 hover:text-amber-400 mb-4 choice-btn">← 문파 목록</button>
            <div class="flex items-center gap-4 mb-4">
                <div class="sd-placeholder text-3xl">${s.icon}</div>
                <div>
                    <h3 class="text-xl font-bold text-amber-300">${s.name}</h3>
                    <p class="text-sm text-zinc-500">${s.tier} · ${s.faction} · 우호 <span class="${affLabel.color} font-bold">${affLabel.label} (${aff})</span></p>
                </div>
            </div>
            <p class="text-zinc-300 mb-6">${s.desc}</p>
            <div class="space-y-3">
                <button onclick="window.sectSpar('${sectId}')"
                    class="choice-btn w-full text-left p-4 rounded-xl border border-orange-600 bg-orange-900/30 hover:bg-orange-800/50">
                    <b>⚔️ 대련</b> — ${sparHint}
                    <div class="text-xs text-orange-300/70 mt-1">우호 대결 · 승리 시 명성·우호↑ · 패배해도 우호 하락 미미</div>
                </button>
                <button onclick="window.sectObserve('${sectId}')"
                    class="choice-btn w-full text-left p-4 rounded-xl border border-blue-600 bg-blue-900/30 hover:bg-blue-800/50">
                    <b>🙏 견식</b> — 1일, 우호 상승·경험치 (전투 없음)
                </button>
                <button onclick="window.sectChallenge('${sectId}')"
                    class="choice-btn w-full text-left p-4 rounded-xl border border-red-600 bg-red-900/30 hover:bg-red-800/50">
                    <b>🏯 도장깨기</b> — ${dojoInfo?.stageCount ?? '?'}단계 (${dojoInfo?.note ?? ''})
                    <div class="text-xs text-red-300/70 mt-1">문파 모욕 · 완료·패배 시 명성·우호↓ · 최종 ${s.guardian.name}</div>
                    ${dojoStages ? `<div class="text-xs text-zinc-600 mt-1 leading-relaxed">${dojoStages}</div>` : ''}
                </button>
                ${s.canTrain ? `
                <button onclick="window.sectTrain('${sectId}')"
                    class="choice-btn w-full text-left p-4 rounded-xl border border-emerald-600 bg-emerald-900/30 hover:bg-emerald-800/50">
                    <b>🧘 수련</b> — ${s.train.gold}냥·내공 ${s.train.naegong}, ${s.train.day}일 (분파·속가)
                </button>` : ''}
                ${canLodge ? `
                <button onclick="window.performRest('sect','${sectId}')"
                    class="choice-btn w-full text-left p-4 rounded-xl border border-amber-600 bg-amber-900/30 hover:bg-amber-800/50">
                    <b>🏠 초대 숙박</b> — 전폭 회복·경험치 (우호 ${aff})
                    <div class="text-xs text-amber-300/70 mt-1">거대 문파 우대 · 회복률 높음</div>
                </button>` : `
                <p class="text-xs text-zinc-600 px-2">숙박 우대: 우호 ${lodgeNeed} 이상 (${s.tier === '본문' ? '본문' : s.tier})</p>`}
            </div>
        </div>
    `;
}

function wrapPlacePanel(title, bodyHtml, backToShops = false) {
    const back = backToShops
        ? `onclick="window.openShopsList()"`
        : `onclick="window.closePlaceUI()"`;
    const backLabel = backToShops ? '← 상점 목록' : '← 거점으로';
    return `
        <div class="event-card p-6 rounded-2xl">
            <button ${back} class="text-sm text-zinc-500 hover:text-amber-400 mb-4 choice-btn">${backLabel}</button>
            <h3 class="text-xl font-bold text-amber-400 mb-4">${title}</h3>
            <div class="space-y-2">${bodyHtml}</div>
        </div>
        ${renderLog(state.gameState.eventLog)}
    `;
}

function renderEvent(event) {
    return `
        <div class="event-card p-6 rounded-2xl">
            <div class="flex items-center gap-4 mb-4">
                <div class="sd-placeholder text-3xl">${event.icon || '❓'}</div>
                <h3 class="text-xl font-bold text-amber-400">${event.title}</h3>
            </div>
            <p class="text-zinc-300 leading-relaxed mb-6">${event.desc}</p>
            <div class="space-y-3">
                ${event.choices.map((c, i) => `
                    <button onclick="window.makeChoice(${i})"
                        class="choice-btn w-full text-left p-4 rounded-xl border transition-all
                            ${c.type === 'good' ? 'border-blue-600 bg-blue-900/30 hover:bg-blue-800/50' :
                              c.type === 'evil' ? 'border-red-600 bg-red-900/30 hover:bg-red-800/50' :
                              c.type === 'battle' ? 'border-orange-600 bg-orange-900/30 hover:bg-orange-800/50' :
                              'border-zinc-600 bg-zinc-800/50 hover:bg-zinc-700/50'}">
                        ${c.text}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function renderLog(log) {
    if (!log.length) return '';
    return `
        <div class="mt-4">
            <h4 class="text-sm text-zinc-500 mb-2"><i class="fas fa-scroll mr-1"></i>강호 일지</h4>
            <div class="space-y-1 max-h-32 overflow-y-auto">
                ${log.map(l => `<p class="text-sm text-zinc-400 border-l-2 border-amber-700 pl-3">${l}</p>`).join('')}
            </div>
        </div>
    `;
}

export function showNameModal() {
    const modal = document.getElementById('name-modal');
    const input = document.getElementById('hero-name-input');
    if (!modal) return;
    modal.classList.remove('hidden');
    if (input) {
        input.value = state.gameState.hero?.name || '';
        setTimeout(() => input.focus(), 50);
    }
}

export function closeNameModal() {
    document.getElementById('name-modal')?.classList.add('hidden');
}

export function confirmHeroName() {
    const input = document.getElementById('hero-name-input');
    const name = input?.value?.trim();
    if (!name || name.length < 2) return;
    hero.setHeroName(name);
    closeNameModal();
    updateAllUI();
}

export function showEnlightenmentToast(result) {
    const el = document.getElementById('enlightenment-toast');
    if (!el || !result) return;
    const arts = result.levelUps?.length
        ? result.levelUps.map(u => `${u.name} Lv.${u.level}`).join(', ')
        : '무공 숙련 상승';
    el.innerHTML = `
        <div class="enlightenment-toast-inner">
            <div class="text-2xl mb-1">${result.source === 'pity' ? '✨' : '💡'}</div>
            <div class="font-bold text-amber-200">${result.source === 'pity' ? '천장 깨달음!' : '깨달음!'}</div>
            <div class="text-sm text-zinc-300 mt-1">${arts}</div>
            <div class="text-xs text-zinc-500 mt-1">무공 경험 +${result.martialExp} · ${result.realm}</div>
        </div>
    `;
    el.classList.remove('hidden', 'opacity-0');
    clearTimeout(showEnlightenmentToast._t);
    showEnlightenmentToast._t = setTimeout(() => el.classList.add('opacity-0'), 4200);
    setTimeout(() => el.classList.add('hidden'), 4600);
}

export function openInfoModal(tab = 'character') {
    infoTab = tab;
    document.getElementById('info-modal').classList.remove('hidden');
    document.querySelectorAll('.info-tab').forEach(btn => {
        btn.classList.toggle('info-tab-active', btn.dataset.tab === tab);
    });
    renderInfoContent();
}

export function closeInfoModal() {
    document.getElementById('info-modal').classList.add('hidden');
}

export function switchInfoTab(tab) {
    infoTab = tab;
    document.querySelectorAll('.info-tab').forEach(btn => {
        btn.classList.toggle('info-tab-active', btn.dataset.tab === tab);
    });
    renderInfoContent();
}

export function renderInfoContent() {
    document.getElementById('info-content').innerHTML =
        infoTab === 'character' ? renderCharacterPanel() : renderMurimPanel();
}

function renderHeroAvatar(hero, size = 'md') {
    const cls = size === 'lg' ? 'sd-hero-masked sd-hero-lg' : 'sd-hero-masked';
    return `
        <div class="${cls}" title="${hero.subtitle}">
            <div class="hero-body"></div>
            <div class="hero-mask"></div>
            <div class="hero-hat"></div>
        </div>
    `;
}

function renderCharacterPanel() {
    const gs = state.gameState;
    const align = state.getAlignment();
    const heroDisp = hero.getHeroDisplay(gs);
    const evRate = martial.getEvasionRate(gs);
    const realmProg = realm.getRealmProgress(gs.level);
    const ngUnlocked = martial.isNaegongUnlocked(gs);
    const expNeed = gs.level * 30;
    const expPct = Math.floor((gs.exp / expNeed) * 100);
    const ngLabel = ngUnlocked
        ? `${gs.naegong}/${gs.maxNaegong}`
        : `내공 미타동 (Lv.${realm.NAEGONG_UNLOCK_LEVEL})`;

    return `
        <div class="flex gap-6">
            <div class="text-center shrink-0 w-36">
                ${renderHeroAvatar(heroDisp, 'lg')}
                <div class="mt-3 space-y-1.5">
                    <div class="flex gap-1">
                        <input id="hero-name-field" type="text" maxlength="12" value="${heroDisp.name === '이름 미정' ? '' : heroDisp.name}"
                            placeholder="협객 이름"
                            class="flex-1 min-w-0 text-sm bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1 text-amber-200 text-center">
                        <button onclick="window.saveHeroName()"
                            class="px-2 py-1 text-xs bg-amber-800 hover:bg-amber-700 rounded-lg choice-btn" title="이름 저장">✓</button>
                    </div>
                    <div class="text-xs space-y-1">
                        <div><span class="text-zinc-500">별호</span> <span class="text-zinc-200 font-medium">${heroDisp.aliasDisplay}</span></div>
                        <div><span class="text-zinc-500">성향</span> <span class="${heroDisp.disposition.color} font-medium">${heroDisp.disposition.label}</span></div>
                    </div>
                    ${heroDisp.sectStanding ? `
                    <div class="text-xs text-zinc-500">
                        문파 <span class="text-emerald-400/90">${heroDisp.sectStanding.sectFamily}</span>
                        ${heroDisp.sectStanding.rank === 'leader'
                            ? '<span class="text-amber-400 ml-1">문파장</span>'
                            : `<span class="text-zinc-400 ml-1">${heroDisp.sectStanding.memberTitle}</span>`}
                    </div>` : '<div class="text-xs text-zinc-600">문파 미소속</div>'}
                    <span class="inline-block text-xs px-2 py-0.5 rounded-md ${heroDisp.realm.badge} ${heroDisp.realm.color} font-bold">【${heroDisp.realmName}】</span>
                </div>
                <div class="${align.color} text-sm mt-2">${align.label}</div>
            </div>
            <div class="flex-1 space-y-4 min-w-0">
                <div>
                    <div class="flex justify-between text-sm mb-1">
                        <span>레벨 ${gs.level}</span>
                        <span class="text-zinc-500">${gs.exp}/${expNeed} EXP</span>
                    </div>
                    <div class="hp-bar"><div class="hp-fill ng-fill" style="width:${expPct}%"></div></div>
                    ${realmProg.next ? `
                    <div class="flex justify-between text-xs text-zinc-500 mt-1">
                        <span>다음 경지: ${realmProg.next.name}</span>
                        <span>${realmProg.need}레벨 남음</span>
                    </div>` : '<div class="text-xs text-rose-300 mt-1 text-right">절정의 경지</div>'}
                </div>
                <div class="grid grid-cols-3 gap-3 text-center text-sm">
                    <div class="bg-zinc-800/60 rounded-xl p-3"><div class="text-blue-400 font-bold text-lg">${gs.chivalry}</div><div class="text-zinc-500">협의</div></div>
                    <div class="bg-zinc-800/60 rounded-xl p-3"><div class="text-yellow-400 font-bold text-lg">${gs.fame}</div><div class="text-zinc-500 text-xs">명성</div></div>
                    <div class="bg-zinc-800/60 rounded-xl p-3"><div class="text-red-400 font-bold text-lg">${gs.notoriety}</div><div class="text-zinc-500 text-xs">악명</div></div>
                </div>
                <p class="text-xs text-zinc-600 -mt-2">협의 상승 → 명성 · 협의 하락 → 악명 (양립 불가)</p>
                <div class="grid grid-cols-2 gap-2 text-sm">
                    ${[
                        ['체력', `${gs.hp}/${gs.maxHp}`, 'text-rose-400'],
                        ['내공', ngLabel, ngUnlocked ? 'text-blue-400' : 'text-zinc-500'],
                        ['경지', heroDisp.realmName, heroDisp.realm.color],
                        ['별호', heroDisp.aliasDisplay, 'text-zinc-300'],
                        ['성향', heroDisp.disposition.label, heroDisp.disposition.color],
                        ['공격력', gs.atk, 'text-orange-400'],
                        ['방어력', gs.def, 'text-emerald-400'],
                        ['회피율', `${evRate}%`, 'text-cyan-400'],
                        ['은전', `${gs.gold}냥`, 'text-amber-400'],
                        ['위치', `${gs.currentRegion} · ${gs.currentLocation}`, 'text-zinc-300'],
                        ['강호력', `제 ${gs.day}일`, 'text-amber-400'],
                        ['격파 네임드', `${(gs.defeatedNamed || []).length}명`, 'text-red-400'],
                    ].map(([k, v, c]) => `
                        <div class="flex justify-between bg-zinc-800/40 rounded-lg px-3 py-2">
                            <span class="text-zinc-500">${k}</span><span class="${c} font-bold">${v}</span>
                        </div>
                    `).join('')}
                </div>
                ${martial.renderMartialArtsPanel(gs)}
                ${enlightenment.renderEnlightenmentPanel(gs)}
                ${renderInventory(gs)}
                ${renderSectAffinities(gs)}
            </div>
        </div>
    `;
}

function renderSectAffinities(gs) {
    const aff = gs.sectAffinity || {};
    const entries = Object.entries(aff).filter(([, v]) => v !== 0);
    if (!entries.length) return '';
    return `
        <div class="mt-3">
            <h4 class="text-sm text-zinc-500 mb-2"><i class="fas fa-handshake mr-1"></i>문파 우호도</h4>
            <div class="space-y-1 text-sm">
                ${entries.map(([id, val]) => {
                    const s = sects.getSect(id);
                    const lab = sects.getAffinityLabel(val);
                    return `<div class="flex justify-between bg-zinc-800/40 rounded-lg px-3 py-1.5">
                        <span>${s?.icon || '☯️'} ${s?.name || id}</span>
                        <span class="${lab.color} font-bold">${lab.label} (${val})</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;
}

function renderInventory(gs) {
    const items = gs.inventory || [];
    if (!items.length) {
        return '<p class="text-xs text-zinc-500 mt-2">소지품 없음</p>';
    }
    return `
        <div class="mt-3">
            <h4 class="text-sm text-zinc-500 mb-2"><i class="fas fa-box-open mr-1"></i>소지품</h4>
            <div class="space-y-2">
                ${items.map(item => `
                    <div class="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2 text-sm">
                        <span>${item.icon} <span class="font-medium">${item.name}</span>
                            <span class="text-zinc-500 text-xs ml-1">${item.desc}</span></span>
                        ${item.type === 'consumable' ? `
                        <button onclick="window.useItem('${item.id}')"
                            class="px-2 py-1 text-xs bg-amber-900/60 hover:bg-amber-800 rounded-lg choice-btn">사용</button>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderMurimPanel() {
    const gs = state.gameState;
    const regionCards = Object.keys(map.worldRegions).map(id => {
        const visited = gs.visitedRegions.includes(id);
        const lore = map.murimLore[id];
        const r = map.worldRegions[id];
        return `
            <div class="murim-loc-card ${visited ? '' : 'opacity-50'} ${gs.currentRegion === id ? 'ring-2 ring-amber-500' : ''}">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-2xl">${visited ? r.icon : '❓'}</span>
                    <div class="font-bold ${visited ? 'text-amber-300' : 'text-zinc-500'}">${visited ? id : '미탐색'}</div>
                    ${gs.currentRegion === id ? '<span class="ml-auto text-xs text-amber-400">현재 도</span>' : ''}
                </div>
                ${visited && lore ? `<p class="text-sm text-zinc-400">${lore.desc}</p>` : ''}
            </div>
        `;
    }).join('');

    const spotCards = state.locations.map(loc => {
        const visited = gs.visitedAreas.includes(loc.id);
        const lore = map.murimLore[loc.id];
        let rumor = lore?.rumor;
        if (loc.id === '검각관' && !gs.heardCriminalRumor) rumor = '??? (성도부 주막에서 소문을 들어야 한다)';

        return `
            <div class="murim-loc-card ${visited ? '' : 'opacity-50'}">
                <div class="flex items-center gap-2 mb-2">
                    <span>${visited ? loc.icon : '❓'}</span>
                    <div class="font-bold">${visited ? loc.id : '미탐색'}</div>
                </div>
                ${visited ? `<p class="text-sm text-zinc-400">${lore.desc}</p><p class="text-xs text-zinc-500 mt-1">${rumor}</p>` : ''}
            </div>
        `;
    }).join('');

    const intelRate = intel.getIntelSuccessPercent(gs);
    return `
        <div class="mb-4 p-4 bg-amber-900/20 border border-amber-800/50 rounded-xl">
            <h4 class="text-amber-400 font-bold mb-1">강호 정세</h4>
            <p class="text-sm text-zinc-400">촉중 사천에서 여정을 시작했다. 정보 수집으로 얻은 소식이 아래에 쌓인다.</p>
            <p class="text-xs text-zinc-600 mt-1">정보 수집 성공률 <span class="text-blue-400">${intelRate}%</span> · 수집 ${(gs.intelJournal || []).length}건일수록 감소</p>
        </div>
        ${intel.renderIntelJournalPanel(gs)}
        <h4 class="text-sm text-zinc-500 mb-2">천하 도(道)</h4>
        <div class="grid grid-cols-2 gap-2 mb-4">${regionCards}</div>
        <h4 class="text-sm text-zinc-500 mb-2">사천 거점</h4>
        <div class="grid grid-cols-1 gap-2">${spotCards}</div>
    `;
}

export function showBattleResultModal({ icon, title, subtitle, fame, exp, gold, item }) {
    const modal = document.getElementById('battle-result-modal');
    if (!modal) return;
    document.getElementById('result-icon').textContent = icon || '🏆';
    document.getElementById('result-title').textContent = title || '승리!';
    document.getElementById('result-subtitle').textContent = subtitle || '';
    document.getElementById('result-fame').textContent = `+${fame}`;
    document.getElementById('result-exp').textContent = `+${exp}`;
    document.getElementById('result-gold').textContent = `+${gold}냥`;
    const itemEl = document.getElementById('result-item');
    if (item) {
        itemEl.classList.remove('hidden');
        itemEl.innerHTML = `<span class="text-2xl">${item.icon}</span> <span class="font-bold text-amber-300">${item.name}</span> 획득!`;
    } else {
        itemEl.classList.add('hidden');
        itemEl.innerHTML = '';
    }
    modal.classList.remove('hidden');
}

export function closeBattleResultModal() {
    document.getElementById('battle-result-modal')?.classList.add('hidden');
}

export function showMessage(title, text) {
    document.getElementById('main-panel').innerHTML = `
        <div class="event-card p-8 rounded-2xl text-center">
            <h3 class="text-2xl font-bold text-amber-400 mb-4">${title}</h3>
            <p class="text-zinc-300 mb-6">${text}</p>
            <button onclick="window.clearEvent()" class="px-8 py-3 bg-amber-700 hover:bg-amber-600 rounded-xl font-bold choice-btn">계속</button>
        </div>
    `;
}

// 하위 호환
export const renderTileMap = renderMap;