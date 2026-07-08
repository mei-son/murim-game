/** 거점 규모: 클수록 상점·정파 본문, 작/먼 곳은 분파·속가 */
export const SCALE = {
    metropolis: { id: 'metropolis', label: '대도', icon: '🏛️', desc: '여러 상점과 정파 본문이 모인다.' },
    city:       { id: 'city',       label: '도시', icon: '🏯', desc: '상점과 문파 지국이 있다.' },
    town:       { id: 'town',       label: '읍',   icon: '🏘️', desc: '소규모 상점과 분파가 있다.' },
    village:    { id: 'village',    label: '촌',   icon: '🛖', desc: '속가제자 문파가 수련을 받아준다.' },
    remote:     { id: 'remote',     label: '외곽', icon: '🏔️', desc: '분파·속가가 자리 잡은 먼 곳.' },
    pass:       { id: 'pass',       label: '관문', icon: '⚠️', desc: '험한 길. 문파보다 위험이 많다.' },
};

export const SHOPS = {
    tavern:    { id: 'tavern',    name: '주막',   icon: '🍶', desc: '소식과 술, 식사' },
    pawn:      { id: 'pawn',      name: '당포',   icon: '💰', desc: '장비·잡화 매매' },
    herb:      { id: 'herb',      name: '약방',   icon: '🌿', desc: '약재·단약' },
    weapon:    { id: 'weapon',    name: '무기점', icon: '⚔️', desc: '병기·갑옷' },
    book:      { id: 'book',      name: '서적상', icon: '📚', desc: '무공서·강호첩' },
    general:   { id: 'general',   name: '잡화점', icon: '🏪', desc: '일용잡화' },
};

export const SHOP_STOCK = {
    tavern: [
        { id: 'meal', name: '정식', icon: '🍚', gold: 8, hp: 25 },
        { id: 'wine', name: '강호술', icon: '🍶', gold: 12, naegong: 15, fame: 0 },
        { id: 'rumor', name: '소문 듣기', icon: '👂', gold: 5, intel: true },
    ],
    pawn: [
        { id: '호신갑', item: '호신갑', gold: 45 },
        { id: '영초', item: '영초', gold: 18 },
    ],
    herb: [
        { id: '영초', item: '영초', gold: 15 },
        { id: '내공단', item: '내공단', gold: 35 },
        { id: 'hp_potion', name: '회천단', icon: '💊', gold: 25, hp: 50 },
    ],
    weapon: [
        { id: '청강검', item: '청강검', gold: 80 },
        { id: 'iron_sword', name: '철검', icon: '🗡️', gold: 40, atk: 2 },
    ],
    book: [
        { id: '무림첩', item: '무림첩', gold: 30 },
        { id: 'manual', name: '기초심법첩', icon: '📜', gold: 50, exp: 20 },
    ],
    general: [
        { id: '영초', item: '영초', gold: 20 },
        { id: 'rope', name: '등반줄', icon: '🪢', gold: 10, desc: '탐색 보조' },
    ],
};

/** 거점별 프로필 — currentLocation 우선, 없으면 currentArea */
export const PLACE_PROFILES = {
    '성도부': {
        scale: 'metropolis',
        shops: ['tavern', 'pawn', 'herb', 'weapon', 'book'],
        sects: ['cheongseong_hq', 'sogeom', 'tang_clan'],
    },
    '강호주막': { scale: 'city', parent: '성도부', shops: ['tavern'], sects: [] },
    '당포':     { scale: 'city', parent: '성도부', shops: ['pawn'], sects: [] },

    '촉남촌': {
        scale: 'village',
        shops: ['general'],
        sects: ['cheongseong_lay'],
    },
    '촌주막': { scale: 'village', parent: '촉남촌', shops: ['tavern'], sects: [] },

    '청성산': {
        scale: 'remote',
        shops: [],
        sects: ['cheongseong_main'],
    },
    '도관': {
        scale: 'remote',
        parent: '청성산',
        shops: [],
        sects: ['cheongseong_branch'],
    },

    '峨嵋금정': {
        scale: 'remote',
        shops: [],
        sects: ['emei_main'],
    },
    '금정대전': { scale: 'remote', parent: '峨嵋금정', shops: [], sects: ['emei_branch'] },
    '산사':     { scale: 'remote', parent: '峨嵋금정', shops: [], sects: ['emei_lay'] },

    '검각관': { scale: 'pass', shops: [], sects: ['wanderer_camp'] },
    '관문':   { scale: 'pass', parent: '검각관', shops: [], sects: [] },

    '약초원': { scale: 'village', parent: '촉남촌', shops: ['herb'], sects: [] },
    '촌입구': { scale: 'village', parent: '촉남촌', shops: [], sects: [] },
    '성도남문': { scale: 'city', parent: '성도부', shops: [], sects: [] },
    '산길':   { scale: 'remote', parent: '청성산', shops: [], sects: [] },
    '산적소굴': { scale: 'pass', parent: '검각관', shops: [], sects: [] },
};

export function getPlaceProfile(locationId, areaId) {
    const direct = PLACE_PROFILES[locationId];
    if (direct) return { ...direct, id: locationId };
    const area = PLACE_PROFILES[areaId];
    if (area) return { ...area, id: areaId };
    return { scale: 'town', shops: ['general'], sects: [], id: locationId };
}

export function getScaleInfo(scaleId) {
    return SCALE[scaleId] || SCALE.town;
}