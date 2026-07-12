/** 주인공 완전 도트 스프라이트 — assets/hero-dot/ (scripts/make-hero-dot.py 생성) */

export const HERO_DOT_FRAMES = {
    idle: 'assets/hero-dot/hero-idle.png',
    attack: 'assets/hero-dot/hero-attack.png',
    defend: 'assets/hero-dot/hero-defend.png',
    evade: 'assets/hero-dot/hero-evade.png',
};

export const HERO_DOT_NATIVE_W = 68;
export const HERO_DOT_NATIVE_H = 52;
export const HERO_DOT_DISPLAY_SCALE = 2;

export const HERO_DOT_ENABLED = (() => {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('heroDot')) return params.get('heroDot') !== '0';
    } catch (_) { /* ignore */ }
    return true;
})();

export function isHeroDotEnabled() {
    return HERO_DOT_ENABLED;
}

export function getHeroDotFrames() {
    return { ...HERO_DOT_FRAMES };
}

export function mountHeroDotMode() {
    if (!HERO_DOT_ENABLED) return;
    document.body.classList.add('hero-dot-test');
    document.documentElement.style.setProperty('--hero-dot-scale', String(HERO_DOT_DISPLAY_SCALE));
    document.documentElement.style.setProperty('--hero-dot-w', `${HERO_DOT_NATIVE_W}px`);
    document.documentElement.style.setProperty('--hero-dot-h', `${HERO_DOT_NATIVE_H}px`);
}

export function heroAvatarHtml(src, alt = '', size = 'md') {
    const lg = size === 'lg';
    const wrapCls = lg ? 'sd-hero-dot-avatar sd-hero-dot-avatar--lg' : 'sd-hero-dot-avatar';
    const cls = 'sd-hero-sprite sd-hero-sprite--dot' + (lg ? ' sd-hero-sprite-lg sd-hero-sprite--dot-lg' : '');
    return `
        <span class="${wrapCls}">
            <img class="${cls}" src="${src}" alt="${alt}" title="${alt}" draggable="false" decoding="async">
        </span>
    `;
}