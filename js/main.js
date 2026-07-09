import * as state from './state.js';
import * as ui from './ui.js';
import * as events from './events.js';
import * as battle from './battle.js';
import * as travel from './travel.js';
import * as encounters from './encounters.js';
import * as sects from './sects.js';
import * as shops from './shops.js';
import * as martial from './martial.js';
import * as hero from './hero.js';
import * as debug from './debug.js';


window.gameState = state.gameState;

debug.registerStateProvider(() => ({
    day: state.gameState.day,
    location: `${state.gameState.currentArea}/${state.gameState.currentLocation}`,
    autoBattle: state.gameState.autoBattle,
    currentEvent: state.gameState.currentEvent?.id || null,
    ...travel.getTravelDebugState(),
    ...battle.getBattleDebugState(),
}));

window.debugLog = {
    enable: (cats) => debug.enable(cats),
    disable: () => debug.disable(),
    log: (cat, msg, data) => debug.log(cat, msg, data),
    snapshot: (label, extra) => debug.snapshot(label, extra),
    dump: () => debug.dump(),
    printDump: () => debug.printDump(),
    clear: () => debug.clear(),
    status: () => debug.snapshot('status'),
    isEnabled: () => debug.isEnabled(),
};

document.addEventListener('DOMContentLoaded', () => {
    ui.initUI();
    events.loadInitialEvents();
    console.log('%c협객의 길 — 사천에서 시작', 'color: #ca8a04; font-weight: bold');
    if (!debug.isEnabled()) {
        console.log('%c디버그: debugLog.enable() 또는 URL ?debug=1', 'color:#71717a');
    }
});

window.resetGame = () => {
    if (confirm('초기화하시겠습니까? 저장된 이름도 삭제됩니다.')) {
        hero.clearStoredHeroProfile();
        location.reload();
    }
};

window.travelToLocal = events.travelToLocal;
window.travelToArea = events.travelToArea;
window.requestTravel = travel.requestTravel;
window.confirmTravel = travel.confirmTravel;
window.cancelTravel = travel.cancelTravel;
window.exploreLocation = events.exploreLocation;
window.makeChoice = events.makeChoice;
window.clearEvent = events.clearEvent;
window.rest = events.rest;
window.performRest = events.performRest;
window.openRestMenu = events.openRestMenu;
window.closeRestMenu = events.closeRestMenu;
window.startBattle = battle.startBattle;
window.battleAction = battle.playerAction;
window.runAutoBattle = battle.runAutoBattle;
window.toggleAutoBattle = () => {
    state.toggleAutoBattle();
    const on = state.gameState.autoBattle;
    state.addLog(on ? '🤖 자동전투 ON — 전투·이동 조우 시 자동 처리' : '✋ 자동전투 OFF — 수동 전투');
    ui.updateAllUI();
};
window.openInfoModal = ui.openInfoModal;
window.closeInfoModal = ui.closeInfoModal;
window.switchInfoTab = ui.switchInfoTab;
window.setMapView = ui.setMapView;
window.goToMyLocation = ui.goToMyLocation;
window.selectWorldRegion = ui.selectWorldRegion;
window.mapToast = ui.mapToast;
window.revealMapSpot = ui.revealMapSpot;
window.gatherIntel = events.gatherIntel;
window.useItem = (id) => {
    if (encounters.useItem(id)) ui.updateAllUI();
};
window.equipItem = (id) => {
    if (encounters.equipItem(id)) ui.updateAllUI();
};
window.unequipItem = (slot) => {
    if (encounters.unequipItem(slot)) ui.updateAllUI();
};
window.closeBattleResultModal = battle.finalizePendingBattleEnd;
window.toggleInventoryPopover = ui.toggleInventoryPopover;
window.openShopsList = sects.openShopsList;
window.openShop = sects.openShop;
window.openSectsList = sects.openSectsList;
window.openSect = sects.openSectPanel;
window.closePlaceUI = sects.closePlaceUI;
window.buyShopItem = shops.buyFromShop;
window.sectObserve = sects.observeSect;
window.sectSpar = sects.requestSparring;
window.sectChallenge = sects.challengeDojo;
window.sectTrain = sects.trainAtSect;
window.sectAcceptJoin = sects.acceptSectJoin;
window.sectDeclineJoin = sects.declineSectJoin;
window.sectVoluntaryJoin = sects.voluntaryJoinSect;
window.sectReopenJoin = sects.reopenSectJoinOffer;
window.learnMartialArt = martial.learnMartialArt;
window.saveHeroName = () => {
    const field = document.getElementById('hero-name-field');
    const name = field?.value?.trim();
    if (name && name.length >= 2) {
        hero.setHeroName(name);
        ui.updateAllUI();
    }
};
window.confirmHeroName = ui.confirmHeroName;
window.closeNameModal = ui.closeNameModal;