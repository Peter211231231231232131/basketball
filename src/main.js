import { Game } from './Game.js';

const lobbyUI = document.getElementById('lobby-ui');
const lobbyInput = document.getElementById('lobby-input');
const joinBtn = document.getElementById('join-btn');

function joinGame() {
    const lobbyName = lobbyInput.value.trim();
    if (!lobbyName) {
        alert("Please enter a lobby name!");
        return;
    }

    // Hide UI
    lobbyUI.style.display = 'none';

    // Start Game with Lobby ID
    try {
        const game = new Game(lobbyName);
    } catch (e) {
        console.error(e);
        alert("Game Init Error: " + e.message + "\n" + e.stack);
    }
}

joinBtn.addEventListener('click', joinGame);
lobbyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
});
