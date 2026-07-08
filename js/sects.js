import * as state from './state.js';
import * as ui from './ui.js';
import * as battle from './battle.js';
import * as hero from './hero.js';
import * as realm from './realm.js';

export const SECT_JOIN_AFFINITY = 50;
export const SECT_LEADER_AFFINITY = 85;
export const SECT_LEADER_MIN_LEVEL = 28;
export const SECT_LEADER_MIN_REALM = 4;
export const GRAND_MASTER_LEVEL = 55;
export const GRAND_MASTER_REALM = 6;

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

    if (!standing && best) {
        const memberTitle = best.sect.tier === '본문' ? '내문제자' : best.sect.tier === '분파' ? '외문제자' : '속가제자';
        gs.sectStanding = {
            sectId: best.sectId,
            sectName: best.sect.name,
            sectFamily: best.family,
            rank: 'disciple',
            memberTitle,
            joinedDay: gs.day,
        };
        state.addLog(`🏯 ${best.family}에 입문했다. 별호는 아직 없으나 문파 소속이 붙었다.`);
        return gs.sectStanding;
    }

    return standing || null;
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
        name: '峨嵋파',
        tier: '본문',
        icon: '🔔',
        faction: '정파',
        desc: '여협 정파의 성지. 峨嵋 검법의 본문.',
        minSparLevel: 7,
        sparFee: 50,
        sparEnemy: { name: '峨嵋 제자', hp: 80, atk: 18, def: 10 },
        guardian: { name: '금정 검사', hp: 145, atk: 24, def: 14 },
        canTrain: false,
    },
    emei_branch: {
        id: 'emei_branch',
        name: '峨嵋파 금정 분파',
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
        name: '峨嵋 속가 암자',
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
    hero.checkSectStanding(gs);
    return next;
}

export function getAffinityLabel(value) {
    if (value >= 60) return { label: '맹우', color: 'text-amber-300' };
    if (value >= 25) return { label: '우호', color: 'text-green-400' };
    if (value >= 5) return { label: '호의', color: 'text-blue-400' };
    if (value >= -5) return { label: '중립', color: 'text-zinc-400' };
    if (value >= -25) return { label: '냉담', color: 'text-zinc-500' };
    return { label: '적대', color: 'text-red-400' };
}

/** 견식 — 우호 소폭 상승 */
export function observeSect(sectId) {
    const sect = getSect(sectId);
    if (!sect) return;
    const gs = state.gameState;
    gs.day += 1;
    const gain = sect.tier === '본문' ? 4 : sect.tier === '분파' ? 5 : 6;
    const aff = modifyAffinity(sectId, gain);
    state.gainExp(8 + gs.level);
    state.addLog(`🙏 ${sect.name}에서 견식. 우호도 +${gain} (${getAffinityLabel(aff).label})`);
    closeSectPanel();
    ui.updateAllUI();
}

/** 대련 — 레벨 낮으면 비용 or 거부 */
export function requestSparring(sectId) {
    const sect = getSect(sectId);
    const gs = state.gameState;
    if (!sect) return;

    const levelOk = gs.level >= sect.minSparLevel;
    const paid = !levelOk && gs.gold >= sect.sparFee;

    if (!levelOk && !paid) {
        if (gs.level < sect.minSparLevel - 2) {
            state.addLog(`⚔️ ${sect.name}: "실력이 부족하다. 나중에 오라." (필요 Lv.${sect.minSparLevel})`);
        } else {
            state.addLog(`⚔️ ${sect.name}: "대련은 ${sect.sparFee}냥을 내야 한다." (은전 부족)`);
        }
        ui.updateAllUI();
        return;
    }

    if (paid) {
        state.modifyStats({ gold: gs.gold - sect.sparFee });
        state.addLog(`${sect.name}에 대련비 ${sect.sparFee}냥을 냈다.`);
    }

    const enemy = { ...sect.sparEnemy, maxHp: sect.sparEnemy.hp };
    battle.startBattleFromEnemy(enemy, 'spar', (won) => {
        const g = state.gameState;
        if (won) {
            const affGain = paid ? 3 : 6;
            const fameGain = sect.faction === '사파' ? 0 : 2;
            const aff = modifyAffinity(sectId, affGain);
            state.gainExp(12 + g.level * 2);
            if (fameGain) state.applyChivalryChange(fameGain);
            state.addLog(`⚔️ ${sect.name} 대련 승! 우호 +${affGain}${fameGain ? `, 명성 +${fameGain}` : ''} (${getAffinityLabel(aff).label})`);
        } else {
            const aff = modifyAffinity(sectId, -1);
            state.gainExp(5);
            state.addLog(`⚔️ ${sect.name} 대련 패배. 우호 -1 (미미) (${getAffinityLabel(aff).label})`);
        }
        closeSectPanel();
        ui.updateAllUI();
    });
}

const MAIN_HQ_IDS = new Set(['cheongseong_main', 'emei_main']);

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

function bossFighter(sect, gs) {
    const g = sect.guardian;
    return scaleFighter({
        name: `${sect.name} ${g.name}`,
        hp: g.hp,
        atk: g.atk,
        def: g.def,
    }, gs, 1.15);
}

/** 도장깨기 단계 구성 */
export function buildDojoPlan(sect, fame, level) {
    const gs = { level, fame };
    const g = sect.guardian;
    const spar = sect.sparEnemy;

    if (sect.tier === '속가') {
        if (fame >= 10) {
            return {
                stages: [bossFighter(sect, gs)],
                note: `명성 ${fame} — 원주(${g.name})와 직접 대결`,
            };
        }
        if (fame >= 5) {
            return {
                stages: [
                    scaleFighter({ name: `${sect.name} ${spar.name}`, ...spar }, gs, 0.9),
                    bossFighter(sect, gs),
                ],
                note: '2단계 — 제자 → 원주',
            };
        }
        return {
            stages: [
                scaleFighter({ name: `${sect.name} ${spar.name}`, ...spar }, gs, 0.85),
                scaleFighter({ name: `${sect.name} 호법`, hp: Math.floor(g.hp * 0.65), atk: Math.floor(g.atk * 0.75), def: Math.floor(g.def * 0.8) }, gs, 1),
                bossFighter(sect, gs),
            ],
            note: '3단계 — 제자 → 호법 → 원주',
        };
    }

    if (sect.tier === '분파') {
        if (fame >= 18) {
            return {
                stages: [bossFighter(sect, gs)],
                note: `명성 ${fame} — 원주(${g.name})와 직접 대결`,
            };
        }
        if (fame >= 8) {
            return {
                stages: [
                    scaleFighter({ name: `${sect.name} ${spar.name}`, ...spar }, gs, 0.95),
                    bossFighter(sect, gs),
                ],
                note: '2단계 — 제자 → 원주',
            };
        }
        return {
            stages: [
                scaleFighter({ name: `${sect.name} ${spar.name}`, ...spar }, gs, 0.9),
                scaleFighter({ name: `${sect.name} 검사`, hp: Math.floor(g.hp * 0.72), atk: Math.floor(g.atk * 0.8), def: Math.floor(g.def * 0.85) }, gs, 1),
                bossFighter(sect, gs),
            ],
            note: '3단계 — 제자 → 검사 → 원주',
        };
    }

    const stageCount = MAIN_HQ_IDS.has(sect.id) ? 5 : 4;
    const ladder = [
        scaleFighter({ name: `${sect.name} 외문 제자`, hp: 58, atk: 13, def: 5 }, gs, 0.9),
        scaleFighter({ name: `${sect.name} 내문 제자`, hp: 72, atk: 16, def: 7 }, gs, 0.95),
        scaleFighter({ name: `${sect.name} 호법`, hp: 92, atk: 19, def: 9 }, gs, 1),
        scaleFighter({ name: `${sect.name} 장로`, hp: 112, atk: 21, def: 11 }, gs, 1.05),
        bossFighter(sect, gs),
    ];
    return {
        stages: ladder.slice(ladder.length - stageCount),
        note: `${stageCount}단계 — 외문부터 ${g.name}까지`,
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