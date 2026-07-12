/** 주인공 도트화 테스트 — 적·UI 레이아웃은 유지, 주인공 스프라이트만 픽셀 크러시 */

export const HERO_DOT_SCALE = 4;

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

export function mountHeroDotMode() {
    if (!HERO_DOT_ENABLED) return;
    document.body.classList.add('hero-dot-test');
}

export function heroBattleSpriteHtml(pose, frames) {
    const src = frames[pose] || frames.idle;
    return `
        <div class="sd-shadow"></div>
        <div class="sd-pose">
            <div class="sd-hero-dot-lens">
                <img class="sd-sprite sd-sprite--hero-dot" src="${src}" alt="" draggable="false" decoding="async">
            </div>
        </div>
    `;
}

export function heroAvatarHtml(src, alt = '', size = 'md') {
    const lg = size === 'lg';
    const cls = lg ? 'sd-hero-sprite sd-hero-sprite-lg sd-hero-sprite--dot' : 'sd-hero-sprite sd-hero-sprite--dot';
    const wrapCls = lg ? 'sd-hero-dot-avatar sd-hero-dot-avatar--lg' : 'sd-hero-dot-avatar';
    return `
        <span class="${wrapCls}">
            <img class="${cls}" src="${src}" alt="${alt}" title="${alt}" draggable="false" decoding="async">
        </span>
    `;
}