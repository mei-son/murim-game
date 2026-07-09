import * as martial from './martial.js';
import * as inventory from './inventory.js';

/** 전투 템포 — HP 축소·공격 상향 */
export const BATTLE_HP_TUNE = 0.68;
export const BATTLE_ATK_TUNE = 1.14;
export const BATTLE_DMG_MULT = 1.38;
export const UNARMED_ATK_RATIO = 0.62;
export const INITIATIVE_DMG_BONUS = 1.1;

export const DEFEND_CHIP_MULT = 0.3;
export const DEFEND_VS_ATTACK_MULT = 0.58;
export const EVADE_FAIL_MULT = 1.6;
export const CRITICAL_STRIKE_MULT = 2.85;
export const CLASH_WEAPON_CHANCE = 0.44;
export const CLASH_CHIP_MULT = 0.22;

const EVADE_ACTION_BONUS = 15;
const LOW_HP_EVADE_MAX_BONUS = 20;
const MAX_ACTIVE_EVADE_CHANCE = 85;

/** 묵찌바: 공→회피→방→공 */
const RPS_BEATS = { attack: 'evade', evade: 'defend', defend: 'attack' };
const RPS_LABELS = { attack: '공격', defend: '방어', evade: '회피' };

export function getRpsWinner(a, b) {
    if (!RPS_BEATS[a] || !RPS_BEATS[b]) return null;
    if (a === b) return 'tie';
    if (RPS_BEATS[a] === b) return 'a';
    if (RPS_BEATS[b] === a) return 'b';
    return null;
}

export function describeRpsRelation(winner, loser) {
    return `${RPS_LABELS[winner]} → ${RPS_LABELS[loser]} 상성`;
}

export function tuneEnemyForBattle(enemy) {
    if (!enemy) return enemy;
    const hp = Math.max(6, Math.floor((enemy.maxHp || enemy.hp) * BATTLE_HP_TUNE));
    const atk = Math.max(3, Math.floor(enemy.atk * BATTLE_ATK_TUNE));
    return { ...enemy, hp, maxHp: hp, atk };
}

export function initEnemyWeapon(enemy) {
    if (!enemy) return enemy;
    if (enemy.weaponDurability != null) return enemy;
    const grade = enemy.weaponGrade
        || (enemy.named ? 'rare' : enemy.atk >= 20 ? 'fine' : 'common');
    return {
        ...enemy,
        weaponGrade: grade,
        weaponDurability: inventory.getWeaponMaxDurability(grade),
        weaponBroken: false,
    };
}

export function wearEnemyWeapon(enemy, baseWear = 14) {
    if (!enemy || enemy.weaponBroken) return { enemy, worn: 0, broken: true };
    const g = enemy.weaponGrade || 'common';
    const wear = Math.max(1, Math.floor(baseWear * ((inventory.WEAPON_CLASH_WEAR[g] ?? 12) / inventory.WEAPON_CLASH_WEAR.common)));
    const before = enemy.weaponDurability ?? inventory.getWeaponMaxDurability(g);
    const after = Math.max(0, before - wear);
    const next = { ...enemy, weaponDurability: after, weaponBroken: after <= 0 };
    return { enemy: next, worn: wear, before, after, broken: after <= 0 };
}

export function isPlayerArmed(gs) {
    const w = inventory.getEquippedWeaponState(gs);
    return w.equipped && !w.broken;
}

export function isEnemyArmed(enemy) {
    return !enemy?.weaponBroken && (enemy?.weaponDurability == null || enemy.weaponDurability > 0);
}

export function getPlayerBattleStyle(gs) {
    return martial.getPlayerCombatStyle(gs, isPlayerArmed(gs));
}

export function getPlayerBattleAtk(gs) {
    if (!gs._baseStats) {
        gs._baseStats = { atk: gs.atk, def: gs.def, maxHp: gs.maxHp };
    }
    const martialBonus = martial.getMartialBonuses(gs);
    const armed = isPlayerArmed(gs);
    const style = martial.getPlayerCombatStyle(gs, armed);
    let atk = gs._baseStats.atk + martialBonus.atk;
    if (armed) {
        const weapon = inventory.getEquippedWeaponState(gs);
        if (weapon.equipped && !weapon.broken) atk += weapon.atk;
        atk += style.bonusAtk || 0;
    } else {
        atk = Math.floor(atk * style.atkMult) + (style.bonusAtk || 0);
    }
    return Math.max(2, Math.floor(atk));
}

export function getEnemyBattleAtk(enemy) {
    if (enemy.weaponBroken) {
        return Math.max(1, Math.floor(enemy.atk * UNARMED_ATK_RATIO));
    }
    return Math.max(1, enemy.atk);
}

export function calcBattleDamage(attackerAtk, defenderDef, mult = 1, initiative = false) {
    const ini = initiative ? INITIATIVE_DMG_BONUS : 1;
    const raw = attackerAtk * BATTLE_DMG_MULT * ini - defenderDef * 0.55 + Math.floor(Math.random() * 6);
    return Math.max(1, Math.floor(raw * mult));
}

function calcLowHpEvasionBonus(hp, maxHp) {
    if (!maxHp || maxHp <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    return Math.floor((1 - ratio) * LOW_HP_EVADE_MAX_BONUS);
}

function getActiveEvadeChance(hp, maxHp, passiveRate) {
    const lowHpBonus = calcLowHpEvasionBonus(hp, maxHp);
    return Math.min(MAX_ACTIVE_EVADE_CHANCE, passiveRate + EVADE_ACTION_BONUS + lowHpBonus);
}

export function rollPlayerEvade(gs) {
    const passive = martial.getEvasionRate(gs);
    return Math.random() * 100 < getActiveEvadeChance(gs.hp, gs.maxHp, passive);
}

export function rollEnemyEvade(enemy) {
    const passive = enemy.evasionRate ?? Math.min(38, 5 + Math.floor((enemy.def || 0) * 0.5) + Math.floor((enemy.level || 1) * 1.2));
    return Math.random() * 100 < getActiveEvadeChance(enemy.hp, enemy.maxHp || enemy.hp, passive);
}

function normalizeAction(action) {
    if (action === 'skill') return { kind: 'attack', mult: 2.1, label: '내공술', isSkill: true };
    if (action === 'flee') return { kind: 'flee', mult: 1, label: '도망' };
    return { kind: action, mult: 1, label: action };
}

function pushLog(lines, text, side) {
    lines.push({ text, side });
}

function resolveAttackVsAttack(ctx) {
    const { gs, enemy, playerInitiative, lines, effects } = ctx;
    const pArmed = isPlayerArmed(gs);
    const eArmed = isEnemyArmed(enemy);
    const pStyle = getPlayerBattleStyle(gs);

    if (!pArmed && eArmed) {
        resolveUnarmedVsArmedAttack(ctx, pStyle);
        return;
    }
    if (pArmed && !eArmed) {
        resolveArmedVsUnarmedAttack(ctx, pStyle);
        return;
    }

    const canClash = pArmed && eArmed;
    const clashRoll = canClash && Math.random() < CLASH_WEAPON_CHANCE;

    if (clashRoll) {
        pushLog(lines, '⚔️ 검이 부딪혀 불꽃이 튄다 — 무기 대치!', 'system');
        const pWeapon = inventory.getEquippedWeaponState(gs);
        if (pWeapon.equipped && !pWeapon.broken) {
            const w = inventory.wearEquippedWeapon(gs, inventory.WEAPON_CLASH_WEAR[pWeapon.grade] ?? 14, pWeapon.grade);
            effects.playerWeaponWear = w.worn;
            if (w.broken) {
                effects.playerWeaponBroken = true;
                pushLog(lines, `💥 ${pWeapon.def.name}이 부러져 맨손으로 싸운다!`, 'player');
            } else {
                const wMax = w.max ?? w.weapon?.max ?? inventory.getWeaponMaxDurability(pWeapon.grade);
                pushLog(lines, `🗡️ ${pWeapon.def.name} 내구 -${w.worn} (${w.after}/${wMax})`, 'player');
            }
        }
        if (eArmed) {
            const ew = wearEnemyWeapon(enemy, inventory.WEAPON_CLASH_WEAR[enemy.weaponGrade] ?? 14);
            effects.enemy = ew.enemy;
            effects.enemyWeaponWear = ew.worn;
            if (ew.broken) {
                effects.enemyWeaponBroken = true;
                pushLog(lines, `💥 ${enemy.name}의 무기가 부서졌다!`, 'enemy');
            } else {
                pushLog(lines, `🗡️ ${enemy.name} 무기 내구 -${ew.worn}`, 'enemy');
            }
        }
        const pAtk = getPlayerBattleAtk(gs);
        const eAtk = getEnemyBattleAtk(effects.enemy || enemy);
        const chipP = calcBattleDamage(eAtk, gs.def, CLASH_CHIP_MULT, !playerInitiative);
        const chipE = calcBattleDamage(pAtk, (effects.enemy || enemy).def, CLASH_CHIP_MULT, playerInitiative);
        effects.playerDamage = chipP;
        effects.enemyDamage = chipE;
        pushLog(lines, `대치 여파 — 서로 ${chipP} / ${chipE} 피해`, 'system');
        return;
    }

    const pAtk = getPlayerBattleAtk(gs);
    const eAtk = getEnemyBattleAtk(enemy);
    const eDef = enemy.def;
    const flavor = martial.rollCombatFlavor(pStyle);
    if (playerInitiative) {
        effects.enemyDamage = calcBattleDamage(pAtk, eDef, 1, true);
        effects.playerDamage = calcBattleDamage(eAtk, gs.def, 1, false);
        pushLog(lines, `🗡️ [${pStyle.label}] 선공 — ${flavor} · 적 ${effects.enemyDamage} · 나 ${effects.playerDamage} 피해`, 'player');
    } else {
        effects.playerDamage = calcBattleDamage(eAtk, gs.def, 1, true);
        effects.enemyDamage = calcBattleDamage(pAtk, eDef, 1, false);
        pushLog(lines, `💥 적 선공 — [${pStyle.label}] ${flavor} · 나 ${effects.playerDamage} · 적 ${effects.enemyDamage} 피해`, 'system');
    }
}

/** 맨손(권각) vs 무장 적 — 대치 없음, 권법 피해 정상 적용 */
function resolveUnarmedVsArmedAttack(ctx, pStyle) {
    const { gs, enemy, playerInitiative, lines, effects } = ctx;
    const pAtk = getPlayerBattleAtk(gs);
    const eAtk = getEnemyBattleAtk(enemy);
    const flavor = martial.rollCombatFlavor(pStyle);
    const armedBonus = 1.12;

    if (playerInitiative) {
        effects.enemyDamage = calcBattleDamage(pAtk, enemy.def, 1, true);
        effects.playerDamage = calcBattleDamage(eAtk, gs.def, armedBonus, false);
    } else {
        effects.playerDamage = calcBattleDamage(eAtk, gs.def, armedBonus, true);
        effects.enemyDamage = calcBattleDamage(pAtk, enemy.def, 1, false);
    }
    pushLog(lines, `👊 [${pStyle.label}] ${flavor} — 적 ${effects.enemyDamage} · 나 ${effects.playerDamage} 피해`, 'player');
    effects.noWeaponWear = true;
}

/** 무장 vs 맨손 적 */
function resolveArmedVsUnarmedAttack(ctx, pStyle) {
    const { gs, enemy, playerInitiative, lines, effects } = ctx;
    const pAtk = getPlayerBattleAtk(gs);
    const eAtk = getEnemyBattleAtk(enemy);
    const flavor = martial.rollCombatFlavor(pStyle);

    if (playerInitiative) {
        effects.enemyDamage = calcBattleDamage(pAtk, enemy.def, 1.08, true);
        effects.playerDamage = calcBattleDamage(eAtk, gs.def, 0.85, false);
    } else {
        effects.playerDamage = calcBattleDamage(eAtk, gs.def, 1, true);
        effects.enemyDamage = calcBattleDamage(pAtk, enemy.def, 1, false);
    }
    pushLog(lines, `🗡️ [${pStyle.label}] ${flavor} — 적 ${effects.enemyDamage} · 나 ${effects.playerDamage} 피해`, 'player');
}

function resolveAttackVsDefend(ctx, attackerIsPlayer) {
    const { gs, enemy, playerInitiative, lines, effects } = ctx;
    if (attackerIsPlayer) {
        const style = getPlayerBattleStyle(gs);
        const pAtk = getPlayerBattleAtk(gs);
        const blocked = calcBattleDamage(pAtk, enemy.def, DEFEND_VS_ATTACK_MULT, playerInitiative);
        const chip = calcBattleDamage(pAtk, enemy.def, DEFEND_CHIP_MULT, false);
        effects.enemyDamage = Math.max(blocked, chip);
        const icon = style.mode === 'unarmed' ? '👊' : '🗡️';
        pushLog(lines, `${icon} [${style.label}] vs 🛡️ ${enemy.name} 방어 — ${effects.enemyDamage} 피해`, 'player');
    } else {
        const eAtk = getEnemyBattleAtk(enemy);
        const blocked = calcBattleDamage(eAtk, gs.def, DEFEND_VS_ATTACK_MULT, !playerInitiative);
        const chip = calcBattleDamage(eAtk, gs.def, DEFEND_CHIP_MULT, false);
        effects.playerDamage = Math.max(blocked, chip);
        pushLog(lines, `🛡️ 방어 자세 — ${effects.playerDamage} 피해를 막아냈다`, 'system');
    }
    effects.noWeaponWear = true;
}

/**
 * 회피 판정 — RPS 결과와 내공 개통 여부에 따라 회심/회피만 구분
 * @param {{ rpsWon?: boolean, naegongUnlocked?: boolean }} evadeOpts
 */
function resolveEvadeSide(ctx, evaderIsPlayer, opponentAction, evadeOpts = {}) {
    const { gs, enemy, lines, effects, playerInitiative } = ctx;
    const { rpsWon = false, naegongUnlocked = false } = evadeOpts;
    const success = evaderIsPlayer ? rollPlayerEvade(gs) : rollEnemyEvade(enemy);
    const canCritOnEvade = !naegongUnlocked;

    if (success) {
        if (canCritOnEvade && (rpsWon || opponentAction === 'attack')) {
            const atk = evaderIsPlayer ? getPlayerBattleAtk(gs) : getEnemyBattleAtk(enemy);
            const def = evaderIsPlayer ? enemy.def : gs.def;
            const ini = evaderIsPlayer ? playerInitiative : !playerInitiative;
            const dmg = calcBattleDamage(atk, def, CRITICAL_STRIKE_MULT, ini);
            if (evaderIsPlayer) {
                const style = getPlayerBattleStyle(gs);
                effects.enemyDamage = dmg;
                pushLog(lines, `💨 [${style.label}] 회피 → 회심! ${martial.rollCombatFlavor(style)} · ${dmg} 피해`, 'player');
            } else {
                effects.playerDamage = dmg;
                pushLog(lines, `💨 ${enemy.name} 회피 성공 → 회심! ${dmg} 피해`, 'enemy');
            }
            return;
        }
        if (rpsWon) {
            const atk = evaderIsPlayer ? getPlayerBattleAtk(gs) : getEnemyBattleAtk(enemy);
            const def = evaderIsPlayer ? enemy.def : gs.def;
            const ini = evaderIsPlayer ? playerInitiative : !playerInitiative;
            const bypassMult = opponentAction === 'defend' ? 1.15 : 1;
            const dmg = calcBattleDamage(atk, def, bypassMult, ini);
            if (evaderIsPlayer) {
                const style = getPlayerBattleStyle(gs);
                effects.enemyDamage = dmg;
                pushLog(lines, `💨 [${style.label}] 회피 관통 — ${martial.rollCombatFlavor(style)} · ${dmg} 피해`, 'player');
            } else {
                effects.playerDamage = dmg;
                pushLog(lines, `💨 ${enemy.name} 회피 관통 — ${dmg} 피해`, 'enemy');
            }
            return;
        }
        if (evaderIsPlayer) {
            pushLog(lines, '💨 회피 성공 — 공격을 피했다!', 'player');
        } else {
            pushLog(lines, `💨 ${enemy.name} 회피 성공 — 공격을 피했다!`, 'enemy');
        }
        return;
    }

    const oppAtk = evaderIsPlayer ? getEnemyBattleAtk(enemy) : getPlayerBattleAtk(gs);
    const oppDef = evaderIsPlayer ? gs.def : enemy.def;
    const mult = opponentAction === 'defend' ? DEFEND_CHIP_MULT * 1.2 : EVADE_FAIL_MULT;
    const dmg = calcBattleDamage(oppAtk, oppDef, mult, !evaderIsPlayer);
    if (evaderIsPlayer) {
        effects.playerDamage = dmg;
        pushLog(lines, `💨 회피 실패 — 빈틈! ${dmg} 피해`, 'player');
    } else {
        effects.enemyDamage = dmg;
        pushLog(lines, `💨 ${enemy.name} 회피 실패 — ${dmg} 피해`, 'enemy');
    }
}

function logRpsAdvantage(lines, winnerKind, loserKind, winnerIsPlayer) {
    const rel = describeRpsRelation(winnerKind, loserKind);
    if (winnerIsPlayer) {
        pushLog(lines, `✊ ${rel} — 내가 유리`, 'player');
    } else {
        pushLog(lines, `✊ ${rel} — ${loserKind === 'attack' ? '적' : '상대'} 유리`, 'enemy');
    }
}

function resolveRpsExchange(ctx, pKind, eKind, naegongUnlocked) {
    const { gs, enemy, playerInitiative, lines, effects } = ctx;
    const rps = getRpsWinner(pKind, eKind);

    if (rps === 'tie') {
        if (pKind === 'attack') {
            resolveAttackVsAttack(ctx);
        } else if (pKind === 'defend') {
            resolveDefendVsDefend(ctx);
        } else {
            resolveEvadeSide(ctx, true, 'evade', { rpsWon: false, naegongUnlocked });
            resolveEvadeSide(ctx, false, 'evade', { rpsWon: false, naegongUnlocked });
        }
        return;
    }

    const playerWon = rps === 'a';
    const winnerKind = playerWon ? pKind : eKind;
    const loserKind = playerWon ? eKind : pKind;
    logRpsAdvantage(lines, winnerKind, loserKind, playerWon);

    if (winnerKind === 'attack') {
        if (loserKind === 'evade') {
            resolveEvadeSide(ctx, !playerWon, 'attack', { rpsWon: false, naegongUnlocked });
            return;
        }
        if (playerWon) {
            const style = getPlayerBattleStyle(gs);
            const dmg = calcBattleDamage(getPlayerBattleAtk(gs), enemy.def, 1, playerInitiative);
            effects.enemyDamage = dmg;
            const icon = style.mode === 'unarmed' ? '👊' : '🗡️';
            pushLog(lines, `${icon} [${style.label}] ${martial.rollCombatFlavor(style)} — ${enemy.name}에게 ${dmg} 피해`, 'player');
        } else {
            effects.playerDamage = calcBattleDamage(getEnemyBattleAtk(enemy), gs.def, 1, !playerInitiative);
            pushLog(lines, `💥 ${enemy.name} 공격 — ${effects.playerDamage} 피해`, 'enemy');
        }
        return;
    }

    if (winnerKind === 'defend') {
        resolveAttackVsDefend(ctx, playerWon);
        return;
    }

    if (winnerKind === 'evade') {
        resolveEvadeSide(ctx, playerWon, loserKind, { rpsWon: true, naegongUnlocked });
        return;
    }
}

function resolveDefendVsDefend(ctx) {
    const { gs, enemy, lines, effects } = ctx;
    effects.playerDamage = calcBattleDamage(getEnemyBattleAtk(enemy), gs.def, DEFEND_CHIP_MULT * 0.6, false);
    effects.enemyDamage = calcBattleDamage(getPlayerBattleAtk(gs), enemy.def, DEFEND_CHIP_MULT * 0.6, false);
    pushLog(lines, `🛡️ 서로 견제 — 미세한 피해 ${effects.playerDamage} / ${effects.enemyDamage}`, 'system');
    effects.noWeaponWear = true;
}

/**
 * 한 합 동시 입력 해석
 * @returns {{ lines, playerDamage, enemyDamage, enemy, fleeSuccess, naegongCost, playerWeaponBroken, enemyWeaponBroken }}
 */
export function resolveExchange(gs, enemy, playerAction, enemyAction, playerInitiative, opts = {}) {
    const lines = [];
    const effects = {
        playerDamage: 0,
        enemyDamage: 0,
        enemy: { ...enemy },
        naegongCost: 0,
        fleeSuccess: null,
        playerWeaponBroken: false,
        enemyWeaponBroken: false,
        playerWeaponWear: 0,
        enemyWeaponWear: 0,
        noWeaponWear: false,
    };

    const p = normalizeAction(playerAction);
    const e = normalizeAction(enemyAction);

    pushLog(lines, `— 나: ${actionLabel(p)} · 적: ${actionLabel(e)} —`, 'system');

    if (p.kind === 'flee') {
        const fleeChance = enemy.named ? 0.22 : 0.48;
        if (Math.random() < fleeChance) {
            effects.fleeSuccess = true;
            pushLog(lines, '도망에 성공했다!', 'player');
            return packResult(lines, effects);
        }
        effects.fleeSuccess = false;
        pushLog(lines, '도망 실패! 상대의 공세가 이어진다.', 'player');
        p.kind = 'idle';
    }

    if (p.isSkill) {
        if (!opts.naegongOk) {
            pushLog(lines, '내공이 막혀 술식이 실패했다.', 'player');
            p.kind = 'attack';
            p.mult = 0.75;
            p.isSkill = false;
        } else {
            effects.naegongCost = 15;
        }
    }

    const pKind = p.kind === 'idle' ? 'defend' : p.kind;
    const eKind = e.kind;
    const ctx = { gs, enemy: effects.enemy, playerInitiative, lines, effects };
    const naegongUnlocked = !!opts.naegongUnlocked;

    if (p.isSkill) {
        resolveSkillExchange(ctx, p, eKind, naegongUnlocked);
    } else if (pKind === 'attack' || pKind === 'defend' || pKind === 'evade') {
        if (eKind === 'attack' || eKind === 'defend' || eKind === 'evade') {
            resolveRpsExchange(ctx, pKind, eKind, naegongUnlocked);
        } else if (pKind === 'attack') {
            const style = getPlayerBattleStyle(gs);
            const dmg = calcBattleDamage(getPlayerBattleAtk(gs), enemy.def, 1, playerInitiative);
            effects.enemyDamage = dmg;
            pushLog(lines, `${style.mode === 'unarmed' ? '👊' : '🗡️'} [${style.label}] ${martial.rollCombatFlavor(style)} — ${enemy.name}에게 ${dmg} 피해`, 'player');
        }
    } else if (eKind === 'attack') {
        effects.playerDamage = calcBattleDamage(getEnemyBattleAtk(enemy), gs.def, 1, !playerInitiative);
        pushLog(lines, `💥 ${enemy.name} 공격 — ${effects.playerDamage} 피해`, 'enemy');
    }

    return packResult(lines, effects);
}

function resolveSkillExchange(ctx, p, eKind, naegongUnlocked) {
    const { gs, enemy, playerInitiative, lines, effects } = ctx;
    const pAtk = getPlayerBattleAtk(gs);
    const critMult = naegongUnlocked ? CRITICAL_STRIKE_MULT : p.mult;

    if (eKind === 'defend') {
        const pierceMult = naegongUnlocked
            ? CRITICAL_STRIKE_MULT * 0.52
            : p.mult * DEFEND_VS_ATTACK_MULT * 1.15;
        const blocked = calcBattleDamage(pAtk, enemy.def, pierceMult, playerInitiative);
        const chip = calcBattleDamage(pAtk, enemy.def, DEFEND_CHIP_MULT * 1.4, false);
        effects.enemyDamage = Math.max(blocked, chip);
        const tag = naegongUnlocked ? '필살 관통' : '방어 관통';
        pushLog(lines, `⚡ ${p.label} — ${tag} ${effects.enemyDamage} 피해`, 'player');
    } else if (eKind === 'evade') {
        if (rollEnemyEvade(enemy)) {
            if (!naegongUnlocked) {
                effects.playerDamage = calcBattleDamage(getEnemyBattleAtk(enemy), gs.def, CRITICAL_STRIKE_MULT * 0.95, !playerInitiative);
                pushLog(lines, `⚡ ${p.label} 허공 — ${enemy.name} 회피 후 회심! ${effects.playerDamage} 피해`, 'enemy');
            } else {
                pushLog(lines, `⚡ ${p.label} 허공 — ${enemy.name} 회피 성공`, 'enemy');
            }
        } else {
            effects.enemyDamage = calcBattleDamage(pAtk, enemy.def, critMult, playerInitiative);
            const tag = naegongUnlocked ? '필살' : '명중';
            pushLog(lines, `⚡ ${p.label} — 적 회피 실패 · ${tag}! ${effects.enemyDamage} 피해`, 'player');
        }
    } else if (eKind === 'attack') {
        effects.enemyDamage = calcBattleDamage(pAtk, enemy.def, critMult, playerInitiative);
        effects.playerDamage = calcBattleDamage(getEnemyBattleAtk(enemy), gs.def, 0.72, !playerInitiative);
        const tag = naegongUnlocked ? '필살' : '강격';
        pushLog(lines, `⚡ ${p.label} ${tag}! 적 ${effects.enemyDamage} · 나 ${effects.playerDamage} 피해`, 'player');
    } else {
        effects.enemyDamage = calcBattleDamage(pAtk, enemy.def, critMult * 0.85, playerInitiative);
        pushLog(lines, `⚡ ${p.label}! ${effects.enemyDamage} 피해`, 'player');
    }
    effects.noWeaponWear = true;
}

function actionLabel(a) {
    if (a.kind === 'attack' && a.isSkill) return '내공술';
    if (a.kind === 'attack') return '공격';
    if (a.kind === 'defend') return '방어';
    if (a.kind === 'evade') return '회피';
    if (a.kind === 'flee') return '도망';
    return a.kind;
}

function packResult(lines, effects) {
    return {
        lines,
        playerDamage: effects.playerDamage || 0,
        enemyDamage: effects.enemyDamage || 0,
        enemy: effects.enemy,
        fleeSuccess: effects.fleeSuccess,
        naegongCost: effects.naegongCost || 0,
        playerWeaponBroken: effects.playerWeaponBroken,
        enemyWeaponBroken: effects.enemyWeaponBroken,
    };
}

export function pickEnemyBattleAction(enemy, gs, eStamina, evadeCost) {
    if (eStamina < evadeCost) {
        const r = Math.random();
        if (r < 0.35) return 'defend';
        return 'attack';
    }
    const gap = (enemy.level || 1) - gs.level;
    let evadeW = 0.12 + Math.max(0, gap) * 0.06;
    let defendW = 0.14;
    if (enemy.hp / (enemy.maxHp || enemy.hp) < 0.35) {
        evadeW += 0.1;
        defendW += 0.08;
    }
    const r = Math.random();
    if (r < 0.48) return 'attack';
    if (r < 0.48 + evadeW) return 'evade';
    if (r < 0.48 + evadeW + defendW) return 'defend';
    return 'attack';
}