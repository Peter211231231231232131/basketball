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

// Game State
const lobbies = {};

function getLobby(lobbyId) {
    if (!lobbies[lobbyId]) {
        lobbies[lobbyId] = {
            players: {},
            ballState: {
                ownerId: null,
                position: { x: 0, y: 5, z: 0 },
                velocity: { x: 0, y: 0, z: 0 }
            }
        };
    }
    return lobbies[lobbyId];
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    // Wait for join_lobby

    socket.on('join_lobby', (lobbyId) => {
        socket.join(lobbyId);
        socket.lobbyId = lobbyId;

        const lobby = getLobby(lobbyId);

        // Add new player to lobby
        lobby.players[socket.id] = {
            id: socket.id,
            position: { x: 0, y: 2, z: 0 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 },
            animState: 'idle'
        };

        console.log(`Player ${socket.id} joined lobby ${lobbyId}`);

        // Send current lobby state to new player
        socket.emit('init', {
            players: lobby.players,
            ballState: lobby.ballState
        });

        // Broadcast new player to others in lobby
        socket.to(lobbyId).emit('player_joined', lobby.players[socket.id]);
    });

    // Handle Player Movement
    socket.on('player_update', (data) => {
        if (!socket.lobbyId) return;
        const lobby = lobbies[socket.lobbyId];

        if (lobby && lobby.players[socket.id]) {
            lobby.players[socket.id] = { ...lobby.players[socket.id], ...data };
            // Standard emit for reliability (was volatile)
            socket.to(socket.lobbyId).emit('player_moved', {
                id: socket.id,
                ...data
            });

            // Debug Log (Sampled)
            if (Math.random() < 0.01) {
                console.log(`Update from ${socket.id} in ${socket.lobbyId}`);
            }
        }
    });

    // Handle Ball Updates
    socket.on('ball_update', (data) => {
        if (!socket.lobbyId) return;
        const lobby = lobbies[socket.lobbyId];

        if (lobby) {
            lobby.ballState = { ...lobby.ballState, ...data };
            socket.to(socket.lobbyId).emit('ball_updated', lobby.ballState);
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

                // Reset ball if they had it
                if (lobby.ballState.ownerId === socket.id) {
                    lobby.ballState.ownerId = null;
                    lobby.ballState.velocity = { x: 0, y: 0, z: 0 };
                    lobby.ballState.position = { x: 0, y: 5, z: 0 };
                    io.to(lobbyId).emit('ball_updated', lobby.ballState);
                }

                // Cleanup empty lobby? (Optional, maybe later)
                if (Object.keys(lobby.players).length === 0) {
                    // delete lobbies[lobbyId]; 
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
