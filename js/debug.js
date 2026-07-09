/** 개발용 디버그 로그 — 콘솔 + 화면 패널 + 링 버퍼 */

const STORAGE_KEY = 'murim-debug';
const MAX_ENTRIES = 300;

const CONSOLE_STYLES = {
    travel: 'color:#22d3ee;font-weight:bold',
    battle: 'color:#f87171;font-weight:bold',
    event: 'color:#fbbf24;font-weight:bold',
    ui: 'color:#a1a1aa',
    error: 'color:#ef4444;font-weight:bold',
    debug: 'color:#a78bfa;font-weight:bold',
};

let enabled = false;
let activeCategories = new Set(['travel', 'battle', 'event', 'error']);
const buffer = [];
const stateProviders = [];

function readEnabledFromEnv() {
    try {
        if (localStorage.getItem(STORAGE_KEY) === '1') return true;
        return new URLSearchParams(window.location.search).has('debug');
    } catch {
        return false;
    }
}

function formatTime(ts = Date.now()) {
    const d = new Date(ts);
    return d.toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function safeStringify(data) {
    if (data == null) return '';
    if (typeof data === 'string') return data;
    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
}

function pushEntry(entry) {
    buffer.push(entry);
    if (buffer.length > MAX_ENTRIES) buffer.shift();
    refreshPanel();
}

function shouldLog(category) {
    return enabled && (activeCategories.has('all') || activeCategories.has(category));
}

export function isEnabled() {
    return enabled;
}

export function registerStateProvider(fn) {
    if (typeof fn === 'function') stateProviders.push(fn);
}

export function collectSnapshot() {
    const snap = { at: Date.now(), time: formatTime() };
    for (const fn of stateProviders) {
        try {
            Object.assign(snap, fn());
        } catch (err) {
            snap.providerError = err?.message || String(err);
        }
    }
    return snap;
}

export function enable(categories = null) {
    enabled = true;
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    if (categories) {
        activeCategories = new Set(Array.isArray(categories) ? categories : [categories]);
    }
    showPanel(true);
    log('debug', '디버그 로그 ON', { categories: [...activeCategories] });
    refreshPanel();
}

export function disable() {
    log('debug', '디버그 로그 OFF');
    enabled = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    showPanel(false);
}

export function setCategories(categories) {
    activeCategories = new Set(Array.isArray(categories) ? categories : [categories]);
    if (enabled) refreshPanel();
}

export function log(category, message, data = null) {
    if (!shouldLog(category)) return;
    const entry = {
        ts: Date.now(),
        time: formatTime(),
        category,
        message,
        data: data ?? null,
    };
    pushEntry(entry);
    const style = CONSOLE_STYLES[category] || CONSOLE_STYLES.debug;
    if (data != null) {
        console.log(`%c[${category}]%c ${message}`, style, 'color:inherit', data);
    } else {
        console.log(`%c[${category}]%c ${message}`, style, 'color:inherit');
    }
}

export function error(category, message, err = null) {
    const entry = {
        ts: Date.now(),
        time: formatTime(),
        category: 'error',
        message: `[${category}] ${message}`,
        data: err ? { name: err.name, message: err.message, stack: err.stack } : null,
    };
    if (enabled) {
        pushEntry(entry);
        refreshPanel();
    }
    console.error(`[${category}] ${message}`, err || '');
}

export function snapshot(label, extra = null) {
    const snap = { label, ...collectSnapshot(), ...(extra || {}) };
    log('debug', `snapshot: ${label}`, snap);
    return snap;
}

export function getRecent(count = 30) {
    return buffer.slice(-count);
}

export function dump() {
    return {
        enabled,
        categories: [...activeCategories],
        snapshot: collectSnapshot(),
        entries: [...buffer],
    };
}

export function printDump() {
    const data = dump();
    console.group('%c협객의 길 — debug dump', 'color:#ca8a04;font-weight:bold');
    console.log('snapshot', data.snapshot);
    console.table(data.entries.map(e => ({
        time: e.time,
        cat: e.category,
        msg: e.message,
        data: e.data ? safeStringify(e.data) : '',
    })));
    console.groupEnd();
    return data;
}

export function clear() {
    buffer.length = 0;
    refreshPanel();
}

function showPanel(visible) {
    const panel = document.getElementById('debug-panel');
    if (panel) panel.classList.toggle('hidden', !visible);
}

function refreshPanel() {
    const panel = document.getElementById('debug-panel');
    if (!panel || panel.classList.contains('hidden')) return;

    const snap = collectSnapshot();
    const flags = document.getElementById('debug-flags');
    const lines = document.getElementById('debug-lines');
    if (flags) {
        flags.textContent = [
            `day ${snap.day ?? '?'}`,
            snap.location || '?',
            `journey ${snap.journeyRunning ? 'ON' : 'off'}`,
            `battle ${snap.battleContext || 'none'}`,
            `travelResolve ${snap.pendingTravelResolve ? 'Y' : 'n'}`,
            `battleFinalize ${snap.pendingBattleFinalize ? 'Y' : 'n'}`,
        ].join(' · ');
    }
    if (lines) {
        const recent = getRecent(10).reverse();
        lines.innerHTML = recent.map(e => {
            const data = e.data ? ` <span class="text-zinc-600">${safeStringify(e.data)}</span>` : '';
            return `<div class="debug-line"><span class="text-zinc-500">${e.time}</span> <span class="debug-cat debug-cat--${e.category}">[${e.category}]</span> ${e.message}${data}</div>`;
        }).join('') || '<div class="text-zinc-600">로그 없음</div>';
    }
}

export function init() {
    enabled = readEnabledFromEnv();
    if (enabled) {
        showPanel(true);
        log('debug', '디버그 모드 자동 활성화 (?debug=1 또는 localStorage)');
    }
}

init();