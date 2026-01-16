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

// API Endpoint to list lobbies
app.get('/api/lobbies', (req, res) => {
    const list = Object.keys(lobbies).map(id => ({
        id: id,
        count: Object.keys(lobbies[id].players).length
    }));
    res.json(list);
});

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

        // Update Ball Physics (Simple Server Authoritative)
        const ball = lobby.ballState;
        if (!ball.ownerId) {
            // Gravity
            ball.velocity.y -= 25.0 * delta; // Gravity
            // Air Resistance
            ball.velocity.x -= ball.velocity.x * 2.0 * delta;
            ball.velocity.z -= ball.velocity.z * 2.0 * delta;

            // Move
            ball.position.x += ball.velocity.x * delta;
            ball.position.y += ball.velocity.y * delta;
            ball.position.z += ball.velocity.z * delta;

            // Simple Floor Collision
            if (ball.position.y < 0.5) {
                ball.position.y = 0.5;
                ball.velocity.y = Math.abs(ball.velocity.y) * 0.7; // Bounce
                if (ball.velocity.y < 1.0) ball.velocity.y = 0;
            }

            // Wall Collisions (Simple Bounds)
            if (ball.position.x > 10 || ball.position.x < -10) ball.velocity.x *= -0.8;
            if (ball.position.z > 17 || ball.position.z < -17) ball.velocity.z *= -0.8;
        } else {
            // Owned by player: Position update logic handled by receiving client input?
            // No, usually receiving client tells us where it is, OR we attach to player server-side.
            // For now, let's keep the client telling us (Hybrid) via 'ball_update'
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
        // Randomize Start Position to prevent overlap
        const startX = (Math.random() * 10) - 5;
        const startZ = (Math.random() * 10) + 10; // Near hoop area
        const player = new ServerPlayer(socket.id, { x: startX, y: 5, z: startZ });
        lobby.players[socket.id] = player;

        console.log(`Player ${socket.id} joined lobby '${lobbyId}' at ${startX.toFixed(2)}, ${startZ.toFixed(2)}`);

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

            // Debug Log (Sampled)
            if (Math.random() < 0.01) {
                console.log(`Input accepted for ${socket.id}:`, data.inputs);
            }
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
