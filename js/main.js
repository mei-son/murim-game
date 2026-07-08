import * as state from './state.js';
import * as ui from './ui.js';
import * as events from './events.js';
import * as battle from './battle.js';
import * as travel from './travel.js';
import * as encounters from './encounters.js';
import * as sects from './sects.js';
import * as shops from './shops.js';


window.gameState = state.gameState;

document.addEventListener('DOMContentLoaded', () => {
    ui.initUI();
    events.loadInitialEvents();
    console.log('%c협객의 길 — 사천에서 시작', 'color: #ca8a04; font-weight: bold');
});

window.resetGame = () => {
    if (confirm('초기화하시겠습니까?')) location.reload();
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
window.gatherIntel = events.gatherIntel;
window.useItem = (id) => {
    if (encounters.useItem(id)) ui.updateAllUI();
};
window.closeBattleResultModal = ui.closeBattleResultModal;
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