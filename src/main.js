import { Game } from './Game.js';

const lobbyUI = document.getElementById('lobby-ui');
const lobbyList = document.getElementById('lobby-list');
const createBtn = document.getElementById('create-btn');
const refreshBtn = document.getElementById('refresh-btn');
const lobbyInput = document.getElementById('lobby-input');

async function fetchLobbies() {
    lobbyList.innerHTML = '<div style="color: #888; text-align: center; margin-top: 50px;">Fetching...</div>';
    try {
        const res = await fetch('/api/lobbies');
        const lobbies = await res.json();

        lobbyList.innerHTML = '';
        if (lobbies.length === 0) {
            lobbyList.innerHTML = '<div style="color: #888; text-align: center; margin-top: 50px;">No active lobbies. Create one!</div>';
            return;
        }

        lobbies.forEach(lobby => {
            const div = document.createElement('div');
            div.style.background = 'rgba(255,255,255,0.05)';
            div.style.padding = '10px';
            div.style.marginBottom = '5px';
            div.style.borderRadius = '5px';
            div.style.cursor = 'pointer';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.onmouseover = () => div.style.background = 'rgba(0, 255, 0, 0.2)';
            div.onmouseout = () => div.style.background = 'rgba(255,255,255,0.05)';
            div.onclick = () => joinGame(lobby.id);

            const name = document.createElement('span');
            name.innerText = lobby.id;
            name.style.fontWeight = 'bold';

            const count = document.createElement('span');
            count.innerText = `${lobby.count} Players`;
            count.style.fontSize = '0.8em';
            count.style.color = '#aaa';

            div.appendChild(name);
            div.appendChild(count);
            lobbyList.appendChild(div);
        });

    } catch (e) {
        console.error(e);
        lobbyList.innerHTML = '<div style="color: red; text-align: center; margin-top: 50px;">Error fetching lobbies</div>';
    }
}

function joinGame(lobbyName) {
    if (!lobbyName) return;
    lobbyUI.style.display = 'none';
    new Game(lobbyName);
}

// Event Listeners
createBtn.addEventListener('click', () => {
    const name = lobbyInput.value.trim();
    if (name) joinGame(name);
    else alert("Please enter a lobby name");
});

refreshBtn.addEventListener('click', fetchLobbies);

// Initial Fetch
fetchLobbies();
// Auto-refresh every 5s?
// setInterval(fetchLobbies, 5000);
