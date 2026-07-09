/** 전투 SD — 주인공(hero-*) · 적(other/*) 모션 PNG */

export const HERO_FRAMES = {
    idle: 'assets/hero-idle.png',
    attack: 'assets/hero-attack.png',
    defend: 'assets/hero-defend.png',
    evade: 'assets/hero-evade.png',
};

/** other.png 분리 캐릭터 — 산적·도둑·3/2/1류 검객 */
export const OTHER_CHARACTERS = {
    bandit: 'bandit',
    thief: 'thief',
    swordsman_3: 'swordsman_3',
    swordsman_2: 'swordsman_2',
    swordsman_1: 'swordsman_1',
};

const ANIM_MS = {
    attack: 520,
    defend: 560,
    evade: 620,
    hit: 420,
    skill: 680,
};

const POSE_BY_ACTION = {
    attack: 'attack',
    defend: 'defend',
    evade: 'evade',
    hit: 'idle',
    skill: 'attack',
};

const ANIM_CLASSES = ['sd-anim-attack', 'sd-anim-defend', 'sd-anim-evade', 'sd-anim-hit', 'sd-anim-skill'];

let enemySpriteKey = 'thief';

const RIGHTEOUS_FACTIONS = new Set(['정파']);

function isRighteousEnemy(enemy) {
    return RIGHTEOUS_FACTIONS.has(enemy?.faction);
}

function getEnemySdType(enemy) {
    if (!enemy) return 'rogue';
    if (enemy.named) return 'named';
    if (isRighteousEnemy(enemy)) return 'sect';
    const name = `${enemy.name || ''} ${enemy.displayName || ''}`;
    if (/맹수|수|랑|호|괴|兽/.test(name)) return 'beast';
    if (/제자|검사|장로|장문|도관|암자|호법|관주|주지|비사|수련|검객|고수|직계/.test(name)) return 'sect';
    if (/산적|도적|맹사|첩자|두목/.test(name)) return 'bandit';
    return 'rogue';
}

/** 정파 — swordsman_3(3류) 이상만. 산적·도적 스프라이트 사용 안 함 */
function pickRighteousSpriteKey(enemy, name) {
    if (enemy?.named) return 'swordsman_1';
    if (/장문|장로|호법|직계/.test(name)) return 'swordsman_1';
    if (/검객|검사|고수|제자|수련|도인|승려|여협|관주|주지/.test(name)) return 'swordsman_2';
    return 'swordsman_3';
}

function getMotionFrames(spriteKey, isPlayer = true) {
    const base = isPlayer ? 'assets' : 'assets/other';
    const id = isPlayer ? 'hero' : spriteKey;
    return {
        idle: `${base}/${id}-idle.png`,
        attack: `${base}/${id}-attack.png`,
        defend: `${base}/${id}-defend.png`,
        evade: `${base}/${id}-evade.png`,
    };
}

/** 적 이름·유형·진영에 맞는 other 스프라이트 선택 */
export function pickEnemySpriteKey(enemy) {
    const name = `${enemy?.name || ''} ${enemy?.displayName || ''}`;

    if (isRighteousEnemy(enemy)) {
        return pickRighteousSpriteKey(enemy, name);
    }

    const type = getEnemySdType(enemy);

    if (type === 'named' || enemy?.named) {
        return enemy?.faction === '사파' ? 'bandit' : 'swordsman_1';
    }
    if (type === 'bandit') return 'bandit';
    if (type === 'beast') return 'bandit';
    if (type === 'sect') {
        if (enemy?.faction === '사파') return 'bandit';
        if (/장로|장문|호법|검사|원주|주지|직계/.test(name)) return 'swordsman_2';
        return 'swordsman_3';
    }
    if (/도둑|첩자/.test(name)) return 'thief';
    if (/산적|도적|두목|맹사/.test(name)) return 'bandit';
    return 'thief';
}

function spriteHtml(pose, frames) {
    const src = frames[pose] || frames.idle;
    return `
        <div class="sd-shadow"></div>
        <div class="sd-pose">
            <img class="sd-sprite" src="${src}" alt="" draggable="false" decoding="async">
        </div>
    `;
}

export function setBattlePose(side, pose = 'idle') {
    const id = side === 'player' ? 'player-battle-sd' : 'enemy-battle-sd';
    const el = document.getElementById(id);
    if (!el) return;
    const img = el.querySelector('.sd-sprite');
    if (!img) return;
    const valid = pose in HERO_FRAMES ? pose : 'idle';
    const frames = side === 'player'
        ? getMotionFrames('hero', true)
        : getMotionFrames(enemySpriteKey, false);
    const src = frames[valid] || frames.idle;
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
}

export function mountBattleSprites(enemy) {
    const playerEl = document.getElementById('player-battle-sd');
    const enemyEl = document.getElementById('enemy-battle-sd');
    if (playerEl) {
        playerEl.className = 'sd-fighter sd-fighter--player';
        playerEl.innerHTML = spriteHtml('idle', getMotionFrames('hero', true));
    }
    if (enemyEl) {
        enemySpriteKey = pickEnemySpriteKey(enemy);
        enemyEl.className = 'sd-fighter sd-fighter--enemy';
        enemyEl.innerHTML = spriteHtml('idle', getMotionFrames(enemySpriteKey, false));
    }
}

export function playBattleAnim(side, action) {
    const id = side === 'player' ? 'player-battle-sd' : 'enemy-battle-sd';
    const el = document.getElementById(id);
    if (!el || !action) return;

    const pose = POSE_BY_ACTION[action] || 'idle';
    setBattlePose(side, pose);

    el.classList.remove(...ANIM_CLASSES);
    void el.offsetWidth;
    el.classList.add(`sd-anim-${action}`);

    const ms = ANIM_MS[action] || 520;
    window.setTimeout(() => {
        el.classList.remove(`sd-anim-${action}`);
        setBattlePose(side, 'idle');
    }, ms);
}

export function playExchangeAnims(playerAction, enemyAction = null) {
    if (playerAction) playBattleAnim('player', playerAction);
    if (enemyAction) {
        window.setTimeout(() => playBattleAnim('enemy', enemyAction), playerAction === 'attack' ? 200 : 0);
    }
}

export const HERO_AVATAR_SRC = HERO_FRAMES.idle;

/** @deprecated */ export const MOTION_FRAMES = HERO_FRAMES;