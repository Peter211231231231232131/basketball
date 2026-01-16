import { Game } from './Game.js';

const lobbyUI = document.getElementById('lobby-ui');

// DEBUG: Force Auto-Join Global Lobby
if (lobbyUI) lobbyUI.style.display = 'none';
new Game("Global");

/*
// Original Logic
const lobbyInput = document.getElementById('lobby-name'); // Check HTML ID
const joinBtn = document.getElementById('join-btn');

function joinGame() {
    let lobbyName = lobbyInput.value.trim();
    if (!lobbyName) lobbyName = "lobby1";
    lobbyUI.style.display = 'none';
    new Game(lobbyName);
}

if (joinBtn) joinBtn.addEventListener('click', joinGame);
if (lobbyInput) lobbyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
});
*/
