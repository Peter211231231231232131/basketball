const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from Vite build
app.use(express.static(path.join(__dirname, 'dist')));

const THREE = require('three');
const { ServerPlayer } = require('./src/ServerPlayer.js');
const { ServerWorld } = require('./src/ServerWorld.js');

// Game State
const lobbies = {};

function getLobby(lobbyId) {
    if (!lobbies[lobbyId]) {
        const scene = new THREE.Scene();
        const world = new ServerWorld(scene);

        lobbies[lobbyId] = {
            scene: scene,
            world: world,
            players: {}, // Map<socketId, ServerPlayer>
            ballState: { // TODO: Move Ball physics to server too
                ownerId: null,
                position: { x: 0, y: 5, z: 0 },
                velocity: { x: 0, y: 0, z: 0 }
            },
            lastTime: Date.now()
        };

        console.log(`Created new lobby: ${lobbyId}`);
    }
    return lobbies[lobbyId];
}

// Server Game Loop
const TICK_RATE = 60;
setInterval(() => {
    const now = Date.now();

    for (const lobbyId in lobbies) {
        const lobby = lobbies[lobbyId];
        const delta = (now - lobby.lastTime) / 1000;
        lobby.lastTime = now;

        // Skip if huge delta (lag spike protection)
        if (delta > 0.1) continue;

        // Update Physics for all players
        const snapshots = {};
        for (const playerId in lobby.players) {
            const player = lobby.players[playerId];
            player.update(delta, lobby.world.getCollidables());

            snapshots[playerId] = {
                id: player.id,
                position: player.position,
                quaternion: player.quaternion // View direction from client
            };
        }

        // Broadcast World State
        // Only if players exist
        if (Object.keys(lobby.players).length > 0) {
            io.to(lobbyId).emit('world_state', {
                players: snapshots,
                ballState: lobby.ballState
            });
        }
    }
}, 1000 / TICK_RATE);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_lobby', (lobbyId) => {
        if (!lobbyId) return;

        socket.join(lobbyId);
        socket.lobbyId = lobbyId;

        const lobby = getLobby(lobbyId);

        // Create Server Player
        const player = new ServerPlayer(socket.id);
        lobby.players[socket.id] = player;

        console.log(`Player ${socket.id} joined lobby '${lobbyId}' (Server Authoritative)`);

        // Send Initial Confirmation ??
        // Actually client waits for world_state usually, but let's give init for immediate confirm
        socket.emit('init', {
            players: {}, // Deprecated, client should rely on world_state
            startPos: player.position
        });
    });

    // Receive Inputs
    socket.on('player_input', (data) => {
        if (!socket.lobbyId) return;
        const lobby = lobbies[socket.lobbyId];
        if (lobby && lobby.players[socket.id]) {
            lobby.players[socket.id].setInputs(data);
        }
    });

    // Handle Ball Updates (Still Client Auth for now? Or Hybrid?)
    // Plan: Server Auth movement, Client Auth Ball (for now, to limit scope)
    socket.on('ball_update', (data) => {
        if (!socket.lobbyId) return;
        const lobby = lobbies[socket.lobbyId];
        if (lobby) {
            lobby.ballState = { ...lobby.ballState, ...data };
            // We broadcast ball state in the tick loop
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);

        if (socket.lobbyId) {
            const lobbyId = socket.lobbyId;
            const lobby = lobbies[lobbyId];

            if (lobby && lobby.players[socket.id]) {
                delete lobby.players[socket.id];
                io.to(lobbyId).emit('player_left', socket.id);

                // Reset ball
                if (lobby.ballState.ownerId === socket.id) {
                    lobby.ballState.ownerId = null;
                    lobby.ballState.velocity = { x: 0, y: 0, z: 0 };
                    lobby.ballState.position = { x: 0, y: 5, z: 0 };
                }
            }
        }
    });
});

// Serve index.html for all other routes (SPA support)
// Serve index.html for all other routes (SPA support)
// Express 5 requires named wildcard or regex
// Serve index.html for all other routes (SPA support)
// Express 5 requires regex or named catch-all
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
