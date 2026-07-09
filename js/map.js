/** 유명 거점 — 미개척 지역이어도 이름·아이콘 표시 */
export const FAMOUS_TILES = new Set(['city', 'forest', 'village', 'sect']);

/** 천하도 — 소문으로 이름 아는 큰 도 */
export const FAMOUS_WORLD_REGIONS = new Set(['중원', '강남', '호광', '사천']);

export const TILE_TYPES = {
    grass:    { class: 'tile-grass',    label: '평원' },
    forest:   { class: 'tile-forest',   label: '숲',   icon: '🌲' },
    mountain: { class: 'tile-mountain', label: '산악', icon: '⛰️' },
    water:    { class: 'tile-water',    label: '강',   icon: '〰️' },
    road:     { class: 'tile-road',     label: '길' },
    village:  { class: 'tile-village',  label: '마을' },
    city:     { class: 'tile-city',     label: '성' },
    danger:   { class: 'tile-danger',   label: '험지' },
    sect:     { class: 'tile-sect',     label: '문파' },
    region:   { class: 'tile-region',   label: '지역' },
};

/* ── 1단계: 천하도 (대륙) ── */
export const worldRegions = {
    '관동': { x: 0, y: 0, icon: '🏔️', color: 'tile-region-north', desc: '관외 이북, 흉노·산적의 땅' },
    '중원': { x: 1, y: 0, icon: '🏯', color: 'tile-region-central', desc: '천하의 중심, 무림맹이 있는 곳' },
    '강남': { x: 2, y: 0, icon: '🌸', color: 'tile-region-south', desc: '강남수향, 부유한 상인들의 고장' },
    '서북': { x: 0, y: 1, icon: '🏜️', color: 'tile-region-west', desc: '사막과 초원, 기괴한 무공이 전해진다' },
    '사천': { x: 1, y: 1, icon: '🐼', color: 'tile-region-sichuan', desc: '촉중지국, 산세가 험하고 도가·도가 문파가 많다' },
    '호광': { x: 2, y: 1, icon: '🌊', color: 'tile-region-lake', desc: '동정호·양자강 유역, 수운이 발달한 곳' },
    '운남': { x: 0, y: 2, icon: '🌺', color: 'tile-region-yunnan', desc: '이국풍정, 독문독파가 숨어 있는 곳' },
    '민남': { x: 2, y: 2, icon: '⛵', color: 'tile-region-coast', desc: '해안 지역, 해적과 상인이 교차한다' },
};

export const WORLD_COLS = 3;
export const WORLD_ROWS = 3;

export const regionConnections = {
    '사천': ['중원', '호광', '운남', '서북'],
    '중원': ['사천', '관동', '강남', '호광'],
    '강남': ['중원', '호광', '민남'],
    '호광': ['사천', '중원', '강남', '민남'],
    '관동': ['중원', '서북'],
    '서북': ['사천', '관동', '운남'],
    '운남': ['사천', '서북', '민남'],
    '민남': ['강남', '호광', '운남'],
};

/* ── 2단계: 지역도 (도 내 주요 거점) ── */
export const regionAreas = {
    '사천': {
        cols: 5, rows: 5,
        grid: [
            ['mountain','mountain','forest','grass','grass'],
            ['mountain','sect','forest','grass','city'],
            ['forest','forest','road','road','grass'],
            ['grass','village','road','danger','mountain'],
            ['grass','grass','road','mountain','mountain'],
        ],
        spots: {
            '촉남촌': { x: 1, y: 3, icon: '🏘️', tile: 'village', playable: true },
            '성도부': { x: 4, y: 1, icon: '🏯', tile: 'city', playable: true },
            '청성산': { x: 1, y: 1, icon: '☯️', tile: 'sect', playable: true },
            '검각관': { x: 3, y: 3, icon: '⚠️', tile: 'danger', playable: true },
            '아미금정': { x: 1, y: 0, icon: '🔔', tile: 'sect', playable: true },
        },
        connections: {
            '촉남촌': ['성도부', '청성산'],
            '성도부': ['촉남촌', '검각관', '아미금정'],
            '청성산': ['촉남촌', '아미금정'],
            '검각관': ['성도부'],
            '아미금정': ['성도부', '청성산'],
        },
    },
    '중원': {
        cols: 5, rows: 5,
        grid: [
            ['city','road','grass','sect','grass'],
            ['road','grass','grass','grass','mountain'],
            ['grass','village','road','city','grass'],
            ['mountain','grass','grass','road','grass'],
            ['grass','grass','mountain','mountain','grass'],
        ],
        spots: {
            '낙양성': { x: 0, y: 0, icon: '🏯', tile: 'city', playable: true },
            '무림맹': { x: 3, y: 0, icon: '⚔️', tile: 'sect', playable: true },
            '소림사': { x: 2, y: 2, icon: '🙏', tile: 'sect', playable: true },
        },
        connections: {
            '낙양성': ['무림맹', '소림사'],
            '무림맹': ['낙양성'],
            '소림사': ['낙양성'],
        },
    },
};

/* ── 3단계: 현장도 (거점 주변 타일) ── */
export const localMaps = {
    '촉남촌': {
        cols: 7, rows: 5,
        grid: [
            ['forest','forest','mountain','mountain','forest','forest','grass'],
            ['forest','grass','grass','road','grass','grass','forest'],
            ['grass','grass','village','road','grass','grass','grass'],
            ['grass','road','road','road','road','grass','grass'],
            ['grass','grass','grass','road','grass','water','water'],
        ],
        spots: {
            '촉남촌': { x: 2, y: 2, icon: '🏘️', tile: 'village' },
            '촌주막': { x: 4, y: 1, icon: '🍶', tile: 'city' },
            '약초원': { x: 1, y: 1, icon: '🌿', tile: 'forest' },
            '촌입구': { x: 2, y: 4, icon: '🛤️', tile: 'road' },
        },
        connections: {
            '촉남촌': ['촌주막', '약초원', '촌입구'],
            '촌주막': ['촉남촌'],
            '약초원': ['촉남촌'],
            '촌입구': ['촉남촌'],
        },
    },
    '성도부': {
        cols: 7, rows: 5,
        grid: [
            ['city','road','city','road','grass','grass','grass'],
            ['road','road','road','road','road','grass','grass'],
            ['grass','city','road','city','road','grass','mountain'],
            ['grass','road','road','road','grass','grass','mountain'],
            ['grass','grass','grass','road','grass','grass','grass'],
        ],
        spots: {
            '성도부': { x: 0, y: 0, icon: '🏯', tile: 'city' },
            '강호주막': { x: 2, y: 0, icon: '🍶', tile: 'city' },
            '당포': { x: 3, y: 2, icon: '💰', tile: 'city' },
            '성도남문': { x: 3, y: 4, icon: '🚪', tile: 'road' },
        },
        connections: {
            '성도부': ['강호주막', '당포'],
            '강호주막': ['성도부', '당포'],
            '당포': ['성도부', '강호주막', '성도남문'],
            '성도남문': ['당포'],
        },
    },
    '청성산': {
        cols: 5, rows: 5,
        grid: [
            ['mountain','mountain','sect','mountain','mountain'],
            ['mountain','forest','road','forest','mountain'],
            ['forest','road','grass','road','forest'],
            ['grass','grass','road','grass','grass'],
            ['grass','village','road','grass','grass'],
        ],
        spots: {
            '청성산': { x: 2, y: 0, icon: '☯️', tile: 'sect' },
            '도관': { x: 2, y: 2, icon: '🏛️', tile: 'sect' },
            '산길': { x: 2, y: 4, icon: '🛤️', tile: 'road' },
        },
        connections: {
            '청성산': ['도관', '산길'],
            '도관': ['청성산'],
            '산길': ['청성산'],
        },
    },
    '검각관': {
        cols: 5, rows: 5,
        grid: [
            ['mountain','mountain','mountain','mountain','mountain'],
            ['mountain','danger','road','danger','mountain'],
            ['mountain','road','road','road','mountain'],
            ['mountain','danger','road','danger','mountain'],
            ['mountain','mountain','road','mountain','mountain'],
        ],
        spots: {
            '검각관': { x: 2, y: 2, icon: '⚠️', tile: 'danger' },
            '산적소굴': { x: 1, y: 1, icon: '🗡️', tile: 'danger' },
            '관문': { x: 2, y: 4, icon: '🚧', tile: 'road' },
        },
        connections: {
            '검각관': ['산적소굴', '관문'],
            '산적소굴': ['검각관'],
            '관문': ['검각관'],
        },
    },
    '아미금정': {
        cols: 5, rows: 5,
        grid: [
            ['mountain','sect','mountain','mountain','mountain'],
            ['mountain','road','road','forest','mountain'],
            ['forest','road','grass','road','forest'],
            ['grass','grass','road','grass','grass'],
            ['grass','grass','grass','grass','grass'],
        ],
        spots: {
            '아미금정': { x: 1, y: 0, icon: '🔔', tile: 'sect' },
            '금정대전': { x: 2, y: 2, icon: '🏛️', tile: 'sect' },
            '산사': { x: 2, y: 4, icon: '⛩️', tile: 'sect' },
        },
        connections: {
            '아미금정': ['금정대전', '산사'],
            '금정대전': ['아미금정'],
            '산사': ['아미금정'],
        },
    },
};

export const spotToRegion = {};
for (const [regionId, data] of Object.entries(regionAreas)) {
    for (const spotId of Object.keys(data.spots)) {
        spotToRegion[spotId] = regionId;
    }
}

export const murimLore = {
    '촉남촌': { faction: '중립', danger: '하', desc: '사천 성도부 근교의 작은 촌락. 협객의 여정이 시작되는 곳.', rumor: '촌 뒤 숲에서 이상한 기운이 느껴진다.' },
    '성도부': { faction: '중립', danger: '중', desc: '촉중 제일의 번화 도시. 강호 각가의 정보가 모인다.', rumor: '검각관에 산적 두목이 나타났다는 소문이 있다.' },
    '청성산': { faction: '정파', danger: '중', desc: '도가 명산. 청성파가 자리 잡고 있다.', rumor: '청성 심법은 수심검법의 기초라 한다.' },
    '검각관': { faction: '사파', danger: '상', desc: '촉으로 들어가는 관문. 산적과 사파 무인이 출몰한다.', rumor: '흑사룡이 근처 산정에 거처한다는 이야기가 있다.' },
    '아미금정': { faction: '정파', danger: '중', desc: '아미파의 본산. 여협들의 무공이 뛰어나기로 한다.', rumor: '아미 검법은 정·속을 겸비한 절예라 한다.' },
    '사천': { faction: '-', danger: '-', desc: '산세가 험준한 촉중. 도가·도가·사파 세력이 교차한다.', rumor: '촉은 천하에서 가장 험한 땅 중 하나다.' },
    '중원': { faction: '-', danger: '-', desc: '천하의 중심. 무림맹과 소림사가 위치한다.', rumor: '정사와 사파의 대결은 중원에서 갈린다.' },
};

export function getSpotRegion(spotId) {
    return spotToRegion[spotId] ?? null;
}

export function getRegionConnections(regionId) {
    return regionConnections[regionId] ?? [];
}

export function getAreaConnections(regionId, spotId) {
    return regionAreas[regionId]?.connections[spotId] ?? [];
}

export function getLocalConnections(areaId, spotId) {
    const map = localMaps[areaId];
    if (!map) return getAreaConnections(getSpotRegion(areaId), areaId).map(id => ({ id, type: 'region' }));
    return (map.connections[spotId] ?? []).map(id => ({ id, type: 'local' }));
}

export function canTravelArea(regionId, from, to) {
    return regionAreas[regionId]?.connections[from]?.includes(to) ?? false;
}

export function canTravelLocal(areaId, from, to) {
    return localMaps[areaId]?.connections[from]?.includes(to) ?? false;
}

export function getLocalSpotAt(areaId, x, y) {
    const map = localMaps[areaId];
    if (!map) return null;
    return Object.entries(map.spots).find(([, s]) => s.x === x && s.y === y)?.[0] ?? null;
}

export function getAreaSpotAt(regionId, x, y) {
    const data = regionAreas[regionId];
    if (!data) return null;
    return Object.entries(data.spots).find(([, s]) => s.x === x && s.y === y)?.[0] ?? null;
}

export function getWorldRegionAt(x, y) {
    return Object.entries(worldRegions).find(([, r]) => r.x === x && r.y === y)?.[0] ?? null;
}

export function getLocationMeta(spotId) {
    const region = getSpotRegion(spotId);
    const area = regionAreas[region]?.spots[spotId];
    const defaults = {
        '촉남촌': { icon: '🏘️', desc: '평화로운 촌락. 협객의 길이 시작된다.' },
        '성도부': { icon: '🏯', desc: '번화한 촉중 도시.' },
        '청성산': { icon: '☯️', desc: '도가 명문 청성파.' },
        '검각관': { icon: '⚠️', desc: '험한 관문.' },
        '아미금정': { icon: '🔔', desc: '아미파 본산.' },
    };
    return {
        id: spotId,
        icon: area?.icon ?? defaults[spotId]?.icon ?? '📍',
        desc: murimLore[spotId]?.desc ?? defaults[spotId]?.desc ?? '',
        region,
    };
}

export const allPlayableSpots = Object.keys(spotToRegion);

const TERRAIN_EXTRA_DAYS = {
    forest: 1, mountain: 2, danger: 1,
    village: 0, city: 0, grass: 0, road: 0, sect: 0, water: 0,
};

function gridDist(a, b) {
    if (!a || !b) return 1;
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function getLocalTravelDays(areaId, from, to) {
    const local = localMaps[areaId];
    if (!local) return 1;
    const a = local.spots[from];
    const b = local.spots[to];
    if (!a || !b) return 1;
    const dist = gridDist(a, b);
    const destTile = b.tile || local.grid[b.y]?.[b.x] || 'grass';
    const extra = TERRAIN_EXTRA_DAYS[destTile] ?? 0;
    return Math.max(1, dist + extra);
}

export function getAreaTravelDays(regionId, from, to) {
    const data = regionAreas[regionId];
    if (!data) return 3;
    const a = data.spots[from];
    const b = data.spots[to];
    if (!a || !b) return 3;
    const dist = gridDist(a, b);
    const destTile = b.tile || 'grass';
    const extra = TERRAIN_EXTRA_DAYS[destTile] ?? 0;
    return Math.max(2, Math.ceil(dist * 1.5) + extra);
}

export function getRegionTravelDays(fromRegion, toRegion) {
    if (fromRegion === toRegion) return 0;
    const a = worldRegions[fromRegion];
    const b = worldRegions[toRegion];
    if (!a || !b) return 14;
    return Math.max(7, gridDist(a, b) * 7);
}

export function getSpotLabel(spotId, tileType) {
    if (spotId) return spotId;
    return TILE_TYPES[tileType]?.label ?? '길';
}

/* ── 노드 지도 레이아웃 (0~100 좌표, 넓게 펼쳐 선택 재미) ── */
export const regionNodeLayout = {
    '사천': {
        '아미금정': { x: 50, y: 6 },
        '청성산': { x: 8, y: 30 },
        '성도부': { x: 92, y: 24 },
        '촉남촌': { x: 22, y: 78 },
        '검각관': { x: 86, y: 88 },
    },
};

export const worldNodeLayout = {
    '관동': { x: 14, y: 12 },
    '중원': { x: 50, y: 8 },
    '강남': { x: 86, y: 12 },
    '서북': { x: 10, y: 50 },
    '사천': { x: 50, y: 52 },
    '호광': { x: 90, y: 50 },
    '운남': { x: 14, y: 90 },
    '민남': { x: 86, y: 90 },
};

export const localNodeLayout = {
    '촉남촌': {
        '약초원': { x: 8, y: 18 },
        '촌주막': { x: 92, y: 14 },
        '촉남촌': { x: 46, y: 46 },
        '촌입구': { x: 54, y: 90 },
    },
    '성도부': {
        '성도부': { x: 10, y: 20 },
        '강호주막': { x: 88, y: 12 },
        '당포': { x: 78, y: 52 },
        '성도남문': { x: 42, y: 92 },
    },
    '청성산': {
        '청성산': { x: 50, y: 8 },
        '도관': { x: 18, y: 52 },
        '산길': { x: 82, y: 86 },
    },
    '검각관': {
        '산적소굴': { x: 12, y: 16 },
        '검각관': { x: 56, y: 44 },
        '관문': { x: 88, y: 82 },
    },
    '아미금정': {
        '아미금정': { x: 48, y: 6 },
        '금정대전': { x: 20, y: 50 },
        '산사': { x: 84, y: 88 },
    },
};

export function getSpotTile(spotId, areaId = null, regionId = null) {
    if (areaId && localMaps[areaId]?.spots[spotId]?.tile) {
        return localMaps[areaId].spots[spotId].tile;
    }
    const reg = regionId ?? getSpotRegion(spotId);
    if (reg && regionAreas[reg]?.spots[spotId]?.tile) {
        return regionAreas[reg].spots[spotId].tile;
    }
    return null;
}

export function isFamousSpot(spotId, areaId = null, regionId = null) {
    if (!spotId) return false;
    if (FAMOUS_WORLD_REGIONS.has(spotId)) return true;
    const tile = getSpotTile(spotId, areaId, regionId);
    if (tile && FAMOUS_TILES.has(tile)) return true;
    const reg = regionId ?? getSpotRegion(spotId);
    if (reg && regionAreas[reg]?.spots[spotId]?.playable) return true;
    return false;
}

export function isSpotDiscovered(gs, spotId) {
    if (!spotId) return false;
    return gs.discoveredSpots?.includes(spotId) ?? false;
}

export function shouldShowQuestionMark(gs, spotId, mapLevel, areaId = null, regionId = null) {
    if (mapLevel === 'local') return false;
    if (isFamousSpot(spotId, areaId, regionId)) return false;
    if (mapLevel === 'world') {
        return !gs.visitedRegions?.includes(spotId) && spotId !== gs.currentRegion;
    }
    if (mapLevel === 'region' && regionId !== gs.currentRegion) return true;
    return false;
}

export function isSpotNameVisible(gs, spotId, mapLevel, areaId = null, regionId = null) {
    if (isSpotDiscovered(gs, spotId)) return true;
    if (isFamousSpot(spotId, areaId, regionId)) return true;
    if (mapLevel === 'world') {
        return gs.visitedRegions?.includes(spotId) || spotId === gs.currentRegion;
    }
    return false;
}

export function discoverSpot(gs, spotId) {
    if (!spotId) return false;
    if (!gs.discoveredSpots) gs.discoveredSpots = [];
    if (gs.discoveredSpots.includes(spotId)) return false;
    gs.discoveredSpots.push(spotId);
    return true;
}

/** 현재 위치·거점 — 주변 탐색·정보 수집 시 지명 해금 */
export function discoverCurrentPlace(gs) {
    const ids = [gs.currentLocation, gs.currentArea].filter(Boolean);
    let any = false;
    for (const id of ids) {
        if (discoverSpot(gs, id)) any = true;
    }
    return any;
}

export function getMapNodeIcon(gs, spotId, realIcon, mapLevel, areaId = null, regionId = null) {
    if (shouldShowQuestionMark(gs, spotId, mapLevel, areaId, regionId)) return '❓';
    return realIcon;
}

export function getMapNodeLabel(gs, spotId, mapLevel, areaId = null, regionId = null) {
    return isSpotNameVisible(gs, spotId, mapLevel, areaId, regionId) ? spotId : '';
}

/** 인접하면 이동 가능 — 지명은 탐색·정보 수집으로 해금 */
export function canNavigateToSpot() {
    return true;
}

export function getGraphEdges(connections) {
    const edges = [];
    const seen = new Set();
    for (const [from, tos] of Object.entries(connections)) {
        for (const to of tos) {
            const key = [from, to].sort().join('|');
            if (!seen.has(key)) {
                seen.add(key);
                edges.push([from, to]);
            }
        }
    }
    return edges;
}

export function getSpotIcon(spotId, regionId) {
    return regionAreas[regionId]?.spots[spotId]?.icon
        ?? localMaps[spotId]?.spots?.[spotId]?.icon
        ?? localMaps[Object.keys(localMaps).find(a => localMaps[a].spots[spotId])]?.spots[spotId]?.icon
        ?? worldRegions[spotId]?.icon
        ?? '📍';
}

export function getLocalSpotIcon(areaId, spotId) {
    return localMaps[areaId]?.spots[spotId]?.icon ?? '📍';
}

export function getTerrainLabel(spotId, regionId) {
    const tile = regionAreas[regionId]?.spots[spotId]?.tile;
    return TILE_TYPES[tile]?.label ?? '거점';
}