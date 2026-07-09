import * as state from './state.js';
import * as ui from './ui.js';
import * as battle from './battle.js';
import * as hero from './hero.js';
import * as realm from './realm.js';
import * as quests from './quests.js';
import * as martial from './martial.js';
import * as encounters from './encounters.js';

export const SECT_JOIN_AFFINITY = 50;

/** 문파별 입문 권유 보상 — 자진 입문에는 미적용 */
const SECT_JOIN_PACKAGES = {
    '청성파': {
        arts: [
            { id: 'cheongseong_sword', level: 2 },
            { id: 'cheongseong_step', level: 1 },
        ],
        masteryExp: 48,
        uniform: { name: '청성도포', icon: '☯️', desc: '청성파 제자 무복' },
    },
    '아미파': {
        arts: [
            { id: 'emei_sword', level: 2 },
            { id: 'emei_step', level: 1 },
        ],
        masteryExp: 48,
        uniform: { name: '아미제복', icon: '🔔', desc: '아미파 제자 무복' },
    },
    '소검파': {
        arts: [{ id: 'sogeom_sword', level: 2 }],
        masteryExp: 40,
        uniform: { name: '소검도복', icon: '⚔️', desc: '소검파 제자 무복' },
    },
    '당가': {
        arts: [{ id: 'tang_hidden', level: 2 }],
        masteryExp: 40,
        uniform: { name: '당가외가복', icon: '🎯', desc: '당가 제자 무복' },
    },
    '산적소굴': {
        arts: [{ id: 'sapa_brutal', level: 2 }],
        masteryExp: 36,
        uniform: { name: '사파망토', icon: '🗡️', desc: '사파 무인 무복' },
    },
};
export const SECT_LEADER_AFFINITY = 85;
export const SECT_LEADER_MIN_LEVEL = 28;
export const SECT_LEADER_MIN_REALM = 4;
export const GRAND_MASTER_LEVEL = 55;
export const GRAND_MASTER_REALM = 6;
/** 최소 레벨보다 2 이상 낮으면 대련 거부 (1 낮으면 대련비) */
export const SPAR_REJECT_GAP = 2;

/** 대련·견식 횟수 주기 (게임 내 일수) */
export const SPAR_CYCLE_DAYS = 10;
export const OBSERVE_CYCLE_DAYS = 7;

function getSparCycleLimit(sect) {
    if (sect?.sparCycleLimit != null) return sect.sparCycleLimit;
    if (sect?.sparDailyLimit != null) return sect.sparDailyLimit;
    if (sect?.tier === '본문') return 1;
    if (sect?.tier === '분파') return 2;
    return 3;
}

function getObserveCycleLimit(sect) {
    if (sect?.observeCycleLimit != null) return sect.observeCycleLimit;
    if (sect?.observeDailyLimit != null) return sect.observeDailyLimit;
    if (sect?.tier === '본문') return 1;
    if (sect?.tier === '분파') return 2;
    return 3;
}

function syncSectActivityCycle(gs, logKey, sectId, cycleDays) {
    if (!gs[logKey]) gs[logKey] = {};
    let entry = gs[logKey][sectId];
    if (!entry) {
        entry = { count: 0, cycleStartDay: gs.day };
        gs[logKey][sectId] = entry;
        return entry;
    }
    if (entry.cycleStartDay == null) entry.cycleStartDay = gs.day;
    if (gs.day - entry.cycleStartDay >= cycleDays) {
        entry.count = 0;
        entry.cycleStartDay = gs.day;
    }
    return entry;
}

function getSectActivityMeta(gs, logKey, sectId, cycleDays) {
    const entry = syncSectActivityCycle(gs, logKey, sectId, cycleDays);
    const elapsed = gs.day - entry.cycleStartDay;
    const daysLeft = Math.max(0, cycleDays - elapsed);
    return {
        used: entry.count || 0,
        cycleStartDay: entry.cycleStartDay,
        cycleDays,
        daysLeft,
        daysUntilReset: daysLeft > 0 ? daysLeft : cycleDays,
    };
}

function recordSectActivity(gs, logKey, sectId, cycleDays) {
    const entry = syncSectActivityCycle(gs, logKey, sectId, cycleDays);
    entry.count = (entry.count || 0) + 1;
    if (logKey === 'sectSparLog') {
        if (!gs.sectSparLifetime) gs.sectSparLifetime = {};
        gs.sectSparLifetime[sectId] = (gs.sectSparLifetime[sectId] || 0) + 1;
    }
}

/** 날짜 진행 훅 — 대련·견식은 주기 기반으로 자동 갱신 */
export function onDayAdvanced() {}

/** 견식 가능 여부 — UI·로직 공통 */
export function getObserveAccess(sectId, gs = state.gameState) {
    const sect = getSect(sectId);
    if (!sect) return { ok: false, reason: 'unknown' };

    const cycleLimit = getObserveCycleLimit(sect);
    const meta = getSectActivityMeta(gs, 'sectObserveLog', sectId, OBSERVE_CYCLE_DAYS);
    if (meta.used >= cycleLimit) {
        return { ok: false, reason: 'limit', ...meta, cycleLimit };
    }
    return { ok: true, ...meta, cycleLimit };
}

export function formatObserveHint(access) {
    if (!access.ok) {
        if (access.reason === 'limit') {
            return `${access.cycleDays}일 주기 한도 소진 (${access.used}/${access.cycleLimit}회 · ${access.daysUntilReset}일 후 초기화)`;
        }
        return '견식 불가';
    }
    return `1일 소모 · 우호 상승 · ${access.cycleDays}일간 ${access.used}/${access.cycleLimit}회`;
}

/** 대련 가능 여부 — UI·로직 공통 */
export function getSparringAccess(sectId, gs = state.gameState) {
    const sect = getSect(sectId);
    if (!sect) return { ok: false, reason: 'unknown' };

    const cycleLimit = getSparCycleLimit(sect);
    const meta = getSectActivityMeta(gs, 'sectSparLog', sectId, SPAR_CYCLE_DAYS);
    const quota = { ...meta, cycleLimit, minLevel: sect.minSparLevel };

    if (meta.used >= cycleLimit) {
        return { ok: false, reason: 'limit', ...quota };
    }

    if (gs.level >= sect.minSparLevel) {
        return { ok: true, free: true, fee: 0, ...quota };
    }

    const gap = sect.minSparLevel - gs.level;
    if (gap >= SPAR_REJECT_GAP) {
        return { ok: false, reason: 'too_weak', gap, ...quota };
    }

    if (gs.gold < sect.sparFee) {
        return {
            ok: false,
            reason: 'no_gold',
            fee: sect.sparFee,
            gold: gs.gold,
            ...quota,
        };
    }

    return {
        ok: true,
        free: false,
        fee: sect.sparFee,
        ...quota,
    };
}

export function formatSparringHint(access, sect) {
    if (!access.ok) {
        if (access.reason === 'limit') {
            return `${access.cycleDays}일 주기 한도 소진 (${access.used}/${access.cycleLimit}회 · ${access.daysUntilReset}일 후 초기화)`;
        }
        if (access.reason === 'too_weak') {
            return `Lv.${access.minLevel} 미만 — 실력 부족으로 거부`;
        }
        if (access.reason === 'no_gold') {
            return `Lv.${access.minLevel} 미만 — ${access.fee}냥 필요 (보유 ${access.gold}냥)`;
        }
        return '대련 불가';
    }
    const quota = `${access.cycleDays}일간 ${access.used}/${access.cycleLimit}회`;
    if (access.free) return `Lv.${access.minLevel} 이상 — 대련 가능 · ${quota}`;
    return `Lv.${access.minLevel} 미만 — ${access.fee}냥으로 대련 · ${quota}`;
}

export function getSectFamilyName(sect) {
    if (!sect) return '';
    if (sect.familyName) return sect.familyName;
    const m = sect.name.match(/^(.+?파)/);
    if (m) return m[1];
    return sect.name.split(' ')[0];
}

function findBestSectAffiliation(gs) {
    const aff = gs.sectAffinity || {};
    const disp = hero.getDisposition(gs);
    let best = null;

    for (const [sectId, value] of Object.entries(aff)) {
        if (value < SECT_JOIN_AFFINITY) continue;
        const sect = getSect(sectId);
        if (!sect) continue;
        if (sect.faction === '사파' && disp.short !== '사') continue;
        if (sect.faction === '정파' && disp.short === '사' && value < 70) continue;
        if (!best || value > best.affinity) {
            best = { sectId, sect, affinity: value, family: getSectFamilyName(sect) };
        }
    }
    return best;
}

function promoteSectLeader(gs, best, prefix = '') {
    const prev = gs.sectStanding?.rank;
    gs.sectStanding = {
        sectId: best.sectId,
        sectName: best.sect.name,
        sectFamily: best.family,
        rank: 'leader',
        memberTitle: '문파장',
        joinedDay: gs.sectStanding?.joinedDay || gs.day,
    };
    if (prev !== 'leader') {
        state.addLog(`${prefix}【${best.family} 문파장】의 위칭을 얻었다! 강호에 문파명이 널리 알려진다.`);
    }
    return gs.sectStanding;
}

export function checkSectStanding(gs = state.gameState) {
    const r = realm.getRealm(gs.level);
    const best = findBestSectAffiliation(gs);
    const standing = gs.sectStanding;

    const isGrandMaster = gs.level >= GRAND_MASTER_LEVEL || r.rank >= GRAND_MASTER_REALM;

    if (isGrandMaster && best && best.affinity >= SECT_LEADER_AFFINITY) {
        return promoteSectLeader(gs, best, '대종사의 위격으로 ');
    }

    if (standing?.rank === 'leader') return standing;

    if (standing?.rank === 'disciple' && best
        && best.affinity >= SECT_LEADER_AFFINITY
        && gs.level >= SECT_LEADER_MIN_LEVEL
        && r.rank >= SECT_LEADER_MIN_REALM
        && standing.sectId === best.sectId) {
        return promoteSectLeader(gs, best, '');
    }

    return standing || null;
}

function memberTitleForTier(tier) {
    if (tier === '본문') return '내문제자';
    if (tier === '분파') return '외문제자';
    return '속가제자';
}

function passesSectJoinDisposition(sect, aff, gs = state.gameState) {
    const disp = hero.getDisposition(gs);
    if (sect.faction === '사파' && disp.short !== '사') return false;
    if (sect.faction === '정파' && disp.short === '사' && aff < 70) return false;
    return true;
}

function getSectJoinPackage(sect) {
    const family = getSectFamilyName(sect);
    return SECT_JOIN_PACKAGES[family] || null;
}

export function getSectJoinPreview(sectId) {
    const sect = getSect(sectId);
    const pkg = getSectJoinPackage(sect);
    if (!pkg) return null;
    return {
        artNames: (pkg.arts || []).map(a => martial.getArtDef(a.id)?.name || a.id),
        uniformName: pkg.uniform?.name || '무복',
    };
}

function markSectJoinOffered(sectId, status, gs = state.gameState) {
    if (!gs.sectJoinOffered) gs.sectJoinOffered = {};
    gs.sectJoinOffered[sectId] = status;
}

export function getSectJoinOfferStatus(sectId, gs = state.gameState) {
    return gs.sectJoinOffered?.[sectId] || null;
}

/** 입문 권유 가능 — 대련 승리 후 1회만 */
export function canInviteToSect(sectId, gs = state.gameState) {
    if (gs.sectStanding) return false;
    if (getSectJoinOfferStatus(sectId, gs)) return false;
    const sect = getSect(sectId);
    if (!sect) return false;
    const aff = getAffinity(sectId);
    if (aff < SECT_JOIN_AFFINITY) return false;
    return passesSectJoinDisposition(sect, aff, gs);
}

/** 자진 입문 — 우호 충분 시 언제든 가능, 숙련 보상 없음 */
export function canVoluntaryJoin(sectId, gs = state.gameState) {
    if (gs.sectStanding) return false;
    const sect = getSect(sectId);
    if (!sect) return false;
    const aff = getAffinity(sectId);
    if (aff < SECT_JOIN_AFFINITY) return false;
    if (!passesSectJoinDisposition(sect, aff, gs)) return false;
    const offer = getSectJoinOfferStatus(sectId, gs);
    if (offer === 'pending') return false;
    if (offer === 'accepted') return false;
    return true;
}

function applyInviteJoinRewards(sect, gs = state.gameState) {
    const pkg = getSectJoinPackage(sect);
    if (!pkg) return [];

    const notes = [];
    const artIds = [];

    for (const row of pkg.arts || []) {
        const result = martial.learnSectMartialArt(row.id, row.level);
        if (!result) continue;
        artIds.push(row.id);
        if (result.learned) {
            notes.push(`${result.name} 습득`);
        } else if (result.leveled) {
            notes.push(`${result.name} Lv.${result.level}`);
        }
    }

    if (pkg.masteryExp && artIds.length) {
        const ups = martial.grantMartialExpToArts(artIds, pkg.masteryExp, gs);
        if (ups.length) {
            const names = [...new Set(ups.map(u => u.name))];
            notes.push(`숙련 상승: ${names.join(', ')}`);
        } else {
            notes.push('문파 무공 숙련도 상승');
        }
    }

    if (pkg.uniform) {
        const family = getSectFamilyName(sect);
        gs.hero = gs.hero || {};
        gs.hero.uniform = { ...pkg.uniform, sectFamily: family };
        notes.push(`${pkg.uniform.name} 지급`);
    }

    return notes;
}

function joinSectCore(sectId, method = 'voluntary') {
    const gs = state.gameState;
    const sect = getSect(sectId);
    if (!sect || gs.sectStanding) return false;

    const family = getSectFamilyName(sect);
    gs.sectStanding = {
        sectId,
        sectName: sect.name,
        sectFamily: family,
        rank: 'disciple',
        memberTitle: memberTitleForTier(sect.tier),
        joinedDay: gs.day,
        joinMethod: method,
    };
    markSectJoinOffered(sectId, 'accepted', gs);
    return true;
}

export function acceptSectJoin(sectId) {
    const gs = state.gameState;
    const sect = getSect(sectId);
    const offer = getSectJoinOfferStatus(sectId, gs);
    if (!sect || gs.sectStanding || offer !== 'pending') {
        ui.updateAllUI();
        return;
    }

    const family = getSectFamilyName(sect);
    if (!joinSectCore(sectId, 'invited')) {
        ui.updateAllUI();
        return;
    }

    const rewardNotes = applyInviteJoinRewards(sect, gs);
    const rewardText = rewardNotes.length ? ` · ${rewardNotes.join(' · ')}` : '';
    state.addLog(`🏯 ${family}에 입문했다 (권유 입문).${rewardText}`);
    gs.placeUI = { view: 'sect', sectId };
    ui.updateAllUI();
}

export function voluntaryJoinSect(sectId) {
    const gs = state.gameState;
    const sect = getSect(sectId);
    if (!sect || !canVoluntaryJoin(sectId, gs)) {
        ui.updateAllUI();
        return;
    }

    const family = getSectFamilyName(sect);
    joinSectCore(sectId, 'voluntary');
    state.addLog(`🏯 ${family}에 자진 입문했다. 문파 무공 전수·숙련 보상은 없다.`);
    gs.placeUI = { view: 'sect', sectId };
    ui.updateAllUI();
}

export function declineSectJoin(sectId) {
    const gs = state.gameState;
    const sect = getSect(sectId);
    if (getSectJoinOfferStatus(sectId, gs) !== 'pending') {
        ui.updateAllUI();
        return;
    }
    markSectJoinOffered(sectId, 'declined', gs);
    if (sect) {
        state.addLog(`${sect.name}의 입문 권유를 사양했다. 우호가 유지되면 나중에 자진 입문할 수 있다.`);
    }
    gs.placeUI = { view: 'sect', sectId };
    ui.updateAllUI();
}

export function reopenSectJoinOffer(sectId) {
    const gs = state.gameState;
    if (getSectJoinOfferStatus(sectId, gs) !== 'pending' || gs.sectStanding) {
        ui.updateAllUI();
        return;
    }
    gs.placeUI = { view: 'sectJoin', sectId };
    ui.updateAllUI();
}

function offerSectJoin(sectId) {
    markSectJoinOffered(sectId, 'pending', state.gameState);
    state.gameState.placeUI = { view: 'sectJoin', sectId };
    ui.updateAllUI();
}

export function tryFoundSect(gs = state.gameState) {
    const r = realm.getRealm(gs.level);
    if (gs.sectStanding?.rank === 'leader') return gs.sectStanding;
    if (gs.level < GRAND_MASTER_LEVEL && r.rank < GRAND_MASTER_REALM) return null;

    const name = (gs.hero?.name || '').trim();
    const family = name ? `${name}문` : '개인문파';
    gs.sectStanding = {
        sectId: 'founded',
        sectName: family,
        sectFamily: family,
        rank: 'leader',
        memberTitle: '문파장',
        founded: true,
        joinedDay: gs.day,
    };
    state.addLog(`🏔️ 대종사의 경지에 이르러 【${family}】을(를) 개문했다! 문파장으로 강호에 이름을 떨친다.`);
    return gs.sectStanding;
}

/** tier: 본문(대도 정파) | 분파(외곽) | 속가(촌·속가제자) */
export const SECTS = {
    cheongseong_main: {
        id: 'cheongseong_main',
        name: '청성파',
        familyName: '청성파',
        tier: '본문',
        icon: '☯️',
        faction: '정파',
        desc: '도가 정파 명문. 청성 심법과 검법의 본산.',
        minSparLevel: 6,
        sparFee: 40,
        sparEnemy: { name: '청성 제자', hp: 70, atk: 16, def: 8 },
        guardian: { name: '청성 검사', hp: 130, atk: 22, def: 12 },
        canTrain: false,
    },
    cheongseong_hq: {
        id: 'cheongseong_hq',
        name: '청성파 성도 지국',
        tier: '본문',
        icon: '☯️',
        faction: '정파',
        desc: '성도부에 둔 청성파 본문 지국. 제자 다수가 상주한다.',
        minSparLevel: 5,
        sparFee: 35,
        sparEnemy: { name: '지국 제자', hp: 65, atk: 15, def: 7 },
        guardian: { name: '지국 검사', hp: 115, atk: 20, def: 10 },
        canTrain: false,
    },
    cheongseong_branch: {
        id: 'cheongseong_branch',
        name: '청성파 도관',
        tier: '분파',
        icon: '🏛️',
        faction: '정파',
        desc: '청성산 아래 분파. 기초 심법을 가르친다.',
        minSparLevel: 3,
        sparFee: 15,
        sparEnemy: { name: '도관 수련생', hp: 50, atk: 12, def: 5 },
        guardian: { name: '도관 관주', hp: 90, atk: 17, def: 8 },
        canTrain: true,
        train: { gold: 12, naegong: 18, atk: 2, day: 1, affinity: 3 },
    },
    cheongseong_lay: {
        id: 'cheongseong_lay',
        name: '청성파 속가제자원',
        tier: '속가',
        icon: '📿',
        faction: '정파',
        desc: '촌에 머무는 속가제자들. 누구나 기초 수련을 받을 수 있다.',
        minSparLevel: 2,
        sparFee: 10,
        sparEnemy: { name: '속가 제자', hp: 42, atk: 10, def: 4 },
        guardian: { name: '원주', hp: 75, atk: 14, def: 6 },
        canTrain: true,
        train: { gold: 8, naegong: 12, atk: 1, def: 1, day: 1, affinity: 2 },
    },
    emei_main: {
        id: 'emei_main',
        name: '아미파',
        tier: '본문',
        icon: '🔔',
        faction: '정파',
        desc: '여협 정파의 성지. 아미 검법의 본문.',
        minSparLevel: 7,
        sparFee: 50,
        sparEnemy: { name: '아미 제자', hp: 80, atk: 18, def: 10 },
        guardian: { name: '금정 검사', hp: 145, atk: 24, def: 14 },
        canTrain: false,
    },
    emei_branch: {
        id: 'emei_branch',
        name: '아미파 금정 분파',
        tier: '분파',
        icon: '⛩️',
        faction: '정파',
        desc: '금정대전 분파. 여협 검법 기초를 전수한다.',
        minSparLevel: 4,
        sparFee: 20,
        sparEnemy: { name: '분파 제자', hp: 58, atk: 14, def: 7 },
        guardian: { name: '분파 검사', hp: 100, atk: 19, def: 9 },
        canTrain: true,
        train: { gold: 15, naegong: 20, def: 2, day: 1, affinity: 3 },
    },
    emei_lay: {
        id: 'emei_lay',
        name: '아미 속가 암자',
        tier: '속가',
        icon: '🕯️',
        faction: '정파',
        desc: '산사 속가제자 암자. 기본 심신 수련.',
        minSparLevel: 2,
        sparFee: 8,
        sparEnemy: { name: '암자 수련생', hp: 40, atk: 9, def: 5 },
        guardian: { name: '암자 주지', hp: 70, atk: 13, def: 7 },
        canTrain: true,
        train: { gold: 6, naegong: 10, def: 1, day: 1, affinity: 2 },
    },
    sogeom: {
        id: 'sogeom',
        name: '소검파',
        tier: '본문',
        icon: '⚔️',
        faction: '정파',
        desc: '성도부 소검파 지국. 가벼운 검법으로 유명.',
        minSparLevel: 5,
        sparFee: 30,
        sparEnemy: { name: '소검 제자', hp: 60, atk: 17, def: 6 },
        guardian: { name: '소검 장로', hp: 110, atk: 21, def: 9 },
        canTrain: false,
    },
    tang_clan: {
        id: 'tang_clan',
        name: '당가 지국',
        familyName: '당가',
        tier: '분파',
        icon: '🎯',
        faction: '정파',
        desc: '성도부 당가 외가 분가. 암기 술법.',
        minSparLevel: 4,
        sparFee: 25,
        sparEnemy: { name: '당가 제자', hp: 55, atk: 16, def: 5 },
        guardian: { name: '당가 호법', hp: 95, atk: 18, def: 8 },
        canTrain: true,
        train: { gold: 20, naegong: 15, atk: 3, day: 1, affinity: 2 },
    },
    wanderer_camp: {
        id: 'wanderer_camp',
        name: '산적소굴',
        tier: '속가',
        icon: '🗡️',
        faction: '사파',
        desc: '검각관 산적소굴. 사파 무인들의 거점.',
        minSparLevel: 3,
        sparFee: 15,
        sparEnemy: { name: '산적', hp: 55, atk: 14, def: 4 },
        guardian: { name: '산적 두목', hp: 100, atk: 18, def: 7 },
        canTrain: false,
    },
};

export function getSect(id) {
    return SECTS[id] || null;
}

/** 도장깨기 최소 레벨 — 대련보다 한 단계 높은 문파별 기준 */
export function getMinDojoLevel(sect) {
    if (!sect) return 99;
    if (sect.minDojoLevel != null) return sect.minDojoLevel;
    const bonus = sect.tier === '본문' ? 4 : sect.tier === '분파' ? 3 : 2;
    return sect.minSparLevel + bonus;
}

export function canChallengeDojo(sectId, gs = state.gameState) {
    const sect = getSect(sectId);
    if (!sect) return { ok: false, minLevel: 99, reason: '알 수 없는 문파' };
    const minLevel = getMinDojoLevel(sect);
    if (gs.level >= minLevel) return { ok: true, minLevel };
    return { ok: false, minLevel, reason: `Lv.${minLevel} 이상 필요 (현재 Lv.${gs.level})` };
}

export function getAffinity(sectId) {
    const gs = state.gameState;
    if (!gs.sectAffinity) gs.sectAffinity = {};
    return gs.sectAffinity[sectId] ?? 0;
}

export function modifyAffinity(sectId, delta) {
    const gs = state.gameState;
    if (!gs.sectAffinity) gs.sectAffinity = {};
    const next = Math.max(-50, Math.min(100, (gs.sectAffinity[sectId] ?? 0) + delta));
    gs.sectAffinity[sectId] = next;
    checkSectStanding(gs);
    return next;
}

/** 우호 소모 — 0 미만으로 내려가지 않음 */
export function spendAffinity(sectId, amount, gs = state.gameState) {
    if (!gs.sectAffinity) gs.sectAffinity = {};
    const cur = gs.sectAffinity[sectId] ?? 0;
    const spent = Math.min(Math.max(0, amount), cur);
    const next = cur - spent;
    gs.sectAffinity[sectId] = next;
    checkSectStanding(gs);
    return { next, spent };
}

export function getAffinityLabel(value) {
    if (value >= 60) return { label: '맹우', color: 'text-amber-300' };
    if (value >= 25) return { label: '우호', color: 'text-green-400' };
    if (value >= 5) return { label: '호의', color: 'text-blue-400' };
    if (value >= -5) return { label: '중립', color: 'text-zinc-400' };
    if (value >= -25) return { label: '냉담', color: 'text-zinc-500' };
    return { label: '적대', color: 'text-red-400' };
}

/** 견식 — 우호 소폭 상승, 주기별 횟수 제한 */
export function observeSect(sectId) {
    const sect = getSect(sectId);
    if (!sect) return;

    const access = getObserveAccess(sectId);
    const gs = state.gameState;
    if (!access.ok) {
        if (access.reason === 'limit') {
            state.addLog(`🙏 ${sect.name}: "이번 주기 견식은 여기까지다." (${access.used}/${access.cycleLimit}회 · ${access.daysUntilReset}일 후)`);
        }
        gs.placeUI = { view: 'sect', sectId };
        ui.updateAllUI();
        return;
    }

    recordSectActivity(gs, 'sectObserveLog', sectId, OBSERVE_CYCLE_DAYS);
    const usedNow = getSectActivityMeta(gs, 'sectObserveLog', sectId, OBSERVE_CYCLE_DAYS).used;
    gs.day += 1;
    const gain = sect.tier === '본문' ? 4 : sect.tier === '분파' ? 5 : 6;
    const aff = modifyAffinity(sectId, gain);
    state.gainExp(8 + gs.level);
    state.addLog(`🙏 ${sect.name}에서 견식. 우호도 +${gain} (${getAffinityLabel(aff).label}) · ${OBSERVE_CYCLE_DAYS}일간 ${usedNow}/${access.cycleLimit}회`);
    gs.placeUI = { view: 'sect', sectId };
    ui.updateAllUI();
}

/** 대련 — 레벨 미달 시 대련비, 2렙 이상 차이면 거부, 일일 횟수 제한 */
export function requestSparring(sectId) {
    const gs = state.gameState;
    const sect = getSect(sectId);
    if (!sect) return;

    const access = getSparringAccess(sectId, gs);
    if (!access.ok) {
        if (access.reason === 'too_weak') {
            state.addLog(`⚔️ ${sect.name}: "실력이 부족하다. 나중에 오라." (필요 Lv.${access.minLevel})`);
        } else if (access.reason === 'no_gold') {
            state.addLog(`⚔️ ${sect.name}: "대련은 ${access.fee}냥을 내야 한다." (보유 ${access.gold}냥)`);
        } else if (access.reason === 'limit') {
            state.addLog(`⚔️ ${sect.name}: "이번 주기 대련은 여기까지다." (${access.used}/${access.cycleLimit}회 · ${access.daysUntilReset}일 후)`);
        }
        gs.placeUI = { view: 'sect', sectId };
        ui.updateAllUI();
        return;
    }

    const paid = !access.free;
    if (paid) {
        const cur = state.gameState;
        if (cur.gold < access.fee) {
            state.addLog(`⚔️ ${sect.name}: "대련은 ${access.fee}냥을 내야 한다." (보유 ${cur.gold}냥)`);
            ui.updateAllUI();
            return;
        }
        state.modifyStats({ gold: cur.gold - access.fee });
        state.addLog(`${sect.name}에 대련비 ${access.fee}냥을 냈다.`);
    }

    const sparMeta = getSectActivityMeta(gs, 'sectSparLog', sectId, SPAR_CYCLE_DAYS);
    const lifetime = gs.sectSparLifetime?.[sectId] || 0;
    const enemy = encounters.buildSectSparEnemy(sect, sectId, gs, {
        cycleCount: sparMeta.used,
        lifetimeCount: lifetime,
    });
    recordSectActivity(gs, 'sectSparLog', sectId, SPAR_CYCLE_DAYS);

    battle.startBattleFromEnemy(enemy, 'spar', (won) => {
        const g = gs;
        if (won) {
            const affGain = paid ? 3 : 6;
            const fameGain = sect.faction === '사파' ? 0 : 2;
            const aff = modifyAffinity(sectId, affGain);
            state.gainExp(12 + g.level * 2);
            if (fameGain) state.applyHyeophaengChange(fameGain);
            quests.onSparVictory(sectId);
            state.addLog(`⚔️ ${sect.name} 대련 승! 우호 +${affGain}${fameGain ? `, 협행 +${fameGain}` : ''} (${getAffinityLabel(aff).label})`);
            if (canInviteToSect(sectId, state.gameState)) {
                offerSectJoin(sectId);
                return;
            }
        } else {
            const aff = modifyAffinity(sectId, -1);
            state.gainExp(5);
            state.addLog(`⚔️ ${sect.name} 대련 패배. 우호 -1 (미미) (${getAffinityLabel(aff).label})`);
        }
        openSectPanel(sectId);
    });
}

let dojoRun = null;

function scaleFighter(base, gs, mult = 1) {
    const lv = gs.level;
    const hp = Math.floor(base.hp * mult + lv * 2.5);
    return {
        name: base.name,
        hp,
        maxHp: hp,
        atk: Math.floor(base.atk * mult + lv * 0.45),
        def: Math.floor(base.def * mult + lv * 0.15),
    };
}

function dojoDirectDisciple(sect, gs) {
    const spar = sect.sparEnemy;
    const family = getSectFamilyName(sect);
    return {
        ...scaleFighter({
            name: `${family} 직계제자`,
            hp: Math.floor(spar.hp * 1.15),
            atk: Math.floor(spar.atk * 1.12),
            def: Math.floor(spar.def * 1.08),
        }, gs, 1.02),
        faction: sect.faction,
    };
}

function dojoElder(sect, gs) {
    const g = sect.guardian;
    const family = getSectFamilyName(sect);
    return {
        ...scaleFighter({
            name: `${family} 장로`,
            hp: Math.floor(g.hp * 0.8),
            atk: Math.floor(g.atk * 0.9),
            def: Math.floor(g.def * 0.88),
        }, gs, 1.1),
        faction: sect.faction,
    };
}

function dojoLeader(sect, gs) {
    const g = sect.guardian;
    const family = getSectFamilyName(sect);
    return {
        ...scaleFighter({
            name: `${family} 장문인`,
            hp: g.hp,
            atk: g.atk,
            def: g.def,
        }, gs, 1.2),
        faction: sect.faction,
    };
}

/** 도장깨기 — 고정 3단계: 직계제자 → 장로 → 장문인 */
export function buildDojoPlan(sect, fame, level) {
    const gs = { level, fame };
    return {
        stages: [
            dojoDirectDisciple(sect, gs),
            dojoElder(sect, gs),
            dojoLeader(sect, gs),
        ],
        note: '직계제자 → 장로 → 장문인',
    };
}

export function getDojoChallengeInfo(sectId) {
    const sect = getSect(sectId);
    if (!sect) return null;
    const gs = state.gameState;
    const plan = buildDojoPlan(sect, gs.fame, gs.level);
    return {
        stageCount: plan.stages.length,
        stageNames: plan.stages.map(s => s.name),
        note: plan.note,
        guardian: sect.guardian.name,
    };
}

function getDojoPenalties(sect) {
    return {
        fameLoss: sect.tier === '본문' ? 5 : sect.tier === '분파' ? 4 : 3,
        affLoss: sect.tier === '본문' ? 14 : sect.tier === '분파' ? 11 : 8,
    };
}

function finishDojoRunFailed() {
    if (!dojoRun) return;
    const { sectId, sect, fameLoss, affLoss, index, stages } = dojoRun;
    dojoRun = null;
    const cur = state.gameState;
    const newAff = modifyAffinity(sectId, -affLoss);
    state.modifyStats({
        fame: Math.max(0, cur.fame - fameLoss),
        notoriety: cur.notoriety + (sect.faction === '정파' ? 3 : 1),
    });
    state.addLog(`🏯 ${sect.name} 도장깨기 ${index + 1}/${stages.length}단계에서 패배. 명성 -${fameLoss}, 우호 -${affLoss} (${getAffinityLabel(newAff).label})`);
    closeSectPanel();
    ui.updateAllUI();
}

function startDojoStage() {
    if (!dojoRun) return;
    const stage = dojoRun.stages[dojoRun.index];
    const total = dojoRun.stages.length;
    const num = dojoRun.index + 1;
    const enemy = {
        ...stage,
        faction: dojoRun.sect.faction,
        dojoStage: num,
        dojoTotal: total,
    };

    if (num === 1) {
        state.addLog(`🏯 ${dojoRun.sect.name} 도장깨기 개시! 총 ${total}단계 (${dojoRun.note})`);
    }

    battle.startBattleFromEnemy(enemy, 'dojo', (won) => {
        if (!won) {
            finishDojoRunFailed();
            return;
        }
        if (dojoRun.index < dojoRun.stages.length - 1) {
            dojoRun.index += 1;
            const next = dojoRun.stages[dojoRun.index];
            state.addLog(`✅ ${stage.name} 격파! (${num}/${total}) → 다음: ${next.name}`);
            startDojoStage();
            return;
        }
        const totalStages = dojoRun.stages.length;
        const { sect, fameLoss, affLoss } = dojoRun;
        const sectId = dojoRun.sectId;
        dojoRun = null;
        const cur = state.gameState;
        const newAff = modifyAffinity(sectId, -affLoss);
        state.modifyStats({
            fame: Math.max(0, cur.fame - fameLoss),
            notoriety: cur.notoriety + (sect.faction === '정파' ? 3 : 1),
        });
        state.gainExp(20 + cur.level * 2 + (sect.tier === '본문' ? 15 : 5));
        state.addLog(`🏯 ${sect.name} ${totalStages}단계 도장 돌파! 문파 원한 — 명성 -${fameLoss}, 우호 -${affLoss} (${getAffinityLabel(newAff).label})`);
        closeSectPanel();
        ui.updateAllUI();
    });
}

/** 도장깨기 — 단계제 전투. 승패 무관 최종 명성·우호 하락 */
export function challengeDojo(sectId) {
    const sect = getSect(sectId);
    const gs = state.gameState;
    if (!sect || dojoRun) return;

    const dojoCheck = canChallengeDojo(sectId, gs);
    if (!dojoCheck.ok) {
        state.addLog(`🏯 ${sect.name}: "감히 도장을 깨려 드느냐. 실력을 더 쌓고 오라." (${dojoCheck.reason})`);
        ui.updateAllUI();
        return;
    }

    const plan = buildDojoPlan(sect, gs.fame, gs.level);
    const pen = getDojoPenalties(sect);

    dojoRun = {
        sectId,
        sect,
        stages: plan.stages,
        note: plan.note,
        index: 0,
        ...pen,
    };

    startDojoStage();
}

/** 수련 — 분파·속가만 */
export function trainAtSect(sectId) {
    const sect = getSect(sectId);
    const gs = state.gameState;
    if (!sect?.canTrain || !sect.train) return;

    const t = sect.train;
    if (gs.gold < t.gold) {
        state.addLog(`수련비 ${t.gold}냥이 필요하다.`);
        ui.updateAllUI();
        return;
    }
    if (!gs.naegongUnlocked) {
        state.addLog('아직 내공이 개통되지 않아 문파 수련을 할 수 없다. (삼류 중반)');
        ui.updateAllUI();
        return;
    }
    if (gs.naegong < t.naegong) {
        state.addLog(`내공 ${t.naegong} 이상이어야 수련할 수 있다.`);
        ui.updateAllUI();
        return;
    }

    state.modifyStats({
        gold: gs.gold - t.gold,
        naegong: gs.naegong - t.naegong,
        atk: gs.atk + (t.atk || 0),
        def: gs.def + (t.def || 0),
    });
    if (t.atk || t.def) {
        if (gs._baseStats) {
            gs._baseStats.atk += t.atk || 0;
            gs._baseStats.def += t.def || 0;
        }
    }
    gs.day += t.day || 1;

    const aff = modifyAffinity(sectId, t.affinity || 2);
    state.gainExp(15);
    state.addLog(`🧘 ${sect.name}에서 ${t.day}일 수련. 우호 +${t.affinity} (${getAffinityLabel(aff).label})`);
    closeSectPanel();
    ui.updateAllUI();
}

export function openSectPanel(sectId) {
    quests.onVisitSect(sectId);
    state.gameState.placeUI = { view: 'sect', sectId };
    ui.updateAllUI();
}

export function closeSectPanel() {
    if (state.gameState.placeUI?.view === 'sect') {
        state.gameState.placeUI = { view: 'sects' };
    }
}

export function openShopsList() {
    state.gameState.placeUI = { view: 'shops' };
    ui.updateAllUI();
}

export function openShop(shopId) {
    state.gameState.placeUI = { view: 'shop', shopId };
    ui.updateAllUI();
}

export function openSectsList() {
    state.gameState.placeUI = { view: 'sects' };
    ui.updateAllUI();
}

export function closePlaceUI() {
    state.gameState.placeUI = null;
    ui.updateAllUI();
}