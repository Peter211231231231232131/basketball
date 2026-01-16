import * as THREE from 'three';
import { io } from 'socket.io-client';
import { Player } from './Player.js';
import { World } from './World.js';
import { Ball } from './Ball.js';
import { ParticleSystem } from './ParticleSystem.js';
import { RemotePlayer } from './RemotePlayer.js';
// import { Bot } from './Bot.js'; // Disabled for Multiplayer

export class Game {
    constructor(lobbyId) {
        this.container = document.body;
        this.score = 0;
        this.botScore = 0;
        this.lobbyId = lobbyId; // Store lobby ID
        this.init();
    }

    init() {
        // ... (Renderer setup omitted for brevity in replacement, but kept in mind) ...
        // Note: I will only replace the top part to inject lobby logic

        // Networking
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Connected to server:', this.socket.id);
            // Join Lobby immediately on connect
            this.socket.emit('join_lobby', this.lobbyId);
        });

        this.socket.on('connect_error', (err) => {
            console.error('Connection Error:', err);
            // Force transport if needed?
        });
        // Renderer
        // Optimization: Antialias OFF to boost FPS
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x to prevent 4K lag
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Efficient shadows
        this.container.appendChild(this.renderer.domElement);

        // UI
        this.createUI();

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 2, 5);

        // World
        this.world = new World(this.scene);

        // Ball
        this.ball = new Ball(this.scene);

        // Particles
        this.particleSystem = new ParticleSystem(this.scene);

        // Player
        this.player = new Player(this.camera, this.scene);
        this.player.assignBall(this.ball);

        // Bot - REPLACED by Remote Players
        // this.bot = new Bot(this.scene, this.ball);
        this.remotePlayers = {};

        // DEBUG: Line Renderer
        const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
        this.debugLine = new THREE.Line(lineGeo, lineMat);
        this.debugLine.frustumCulled = false; // Always draw
        this.scene.add(this.debugLine);

        // Networking (Initialized in init start for join_lobby)
        // this.socket assigned above

        // Handle Throw Event
        this.player.onThrow((pos, vel) => {
            this.socket.emit('ball_update', {
                ownerId: null, // Released
                position: pos,
                velocity: vel
            });
        });


        this.socket.on('init', (data) => {
            console.log("Received INIT payload:", data);
            console.log("Existing players count:", Object.keys(data.players || {}).length);
            // Spawn existing players
            for (const id in data.players) {
                if (id !== this.socket.id) {
                    console.log("Spawning existing player:", id);
                    this.remotePlayers[id] = new RemotePlayer(this.scene, id, data.players[id]);
                }
            }
            // Sync Ball
            if (data.ballState && data.ballState.position) {
                this.ball.mesh.position.copy(data.ballState.position);
                this.ball.velocity.copy(data.ballState.velocity);
                if (data.ballState.ownerId === this.socket.id) {
                    // I own it? Should not happen on fresh connect usually
                } else if (data.ballState.ownerId) {
                    // Someone else owns it
                    // Visual only for now
                }
            }
        });

        this.socket.on('player_joined', (data) => {
            console.log('EVENT: player_joined:', data.id);
            this.remotePlayers[data.id] = new RemotePlayer(this.scene, data.id, data);
        });

        this.socket.on('player_moved', (data) => {
            if (this.remotePlayers[data.id]) {
                this.remotePlayers[data.id].updateData(data);
            }
        });

        this.socket.on('player_left', (id) => {
            console.log('Player left:', id);
            if (this.remotePlayers[id]) {
                this.remotePlayers[id].dispose();
                delete this.remotePlayers[id];
            }
        });

        this.socket.on('world_state', (state) => {
            // Sync Players
            for (const id in state.players) {
                const pData = state.players[id];

                if (id === this.socket.id) {
                    // Update MYSELF (Server Authority)
                    this.player.setServerPosition(pData.position);
                } else {
                    // Update Remote
                    if (!this.remotePlayers[id]) {
                        console.log(`[Game] Found new remote player ${id} in world_state`);
                        this.remotePlayers[id] = new RemotePlayer(this.scene, id, pData);
                    }
                    this.remotePlayers[id].updateData(pData);
                }
            }

            // Update Debug Overlay
            let debugText = `<b>Packet: ${Date.now()}</b><br>`;
            debugText += `My ID: ${this.socket.id}<br>`;
            for (const id in state.players) {
                const p = state.players[id].position;
                debugText += `${id.slice(0, 4)}: [${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}]<br>`;
            }
            this.debugDiv.innerHTML = debugText;

            // Sync Ball (if not owned by me)
            if (state.ballState && !this.player.hasBall) {
                // Hybrid: Server echoes ball state
                this.ball.mesh.position.copy(state.ballState.position);
                this.ball.velocity.copy(state.ballState.velocity);
                if (state.ballState.ownerId) {
                    // TODO: Visual attach to remote player
                }
            }
        });

        this.socket.on('ball_updated', (data) => {
            // If I don't own the ball, trust the server/network
            if (!this.player.hasBall) {
                this.ball.mesh.position.copy(data.position);
                this.ball.velocity.copy(data.velocity);
                this.ball.owner = data.ownerId ? (data.ownerId === this.socket.id ? this.player : null) : null;
            }
        });

        // Event Listeners
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Start Loop
        this.clock = new THREE.Clock();
        this.animate();
    }

    createUI() {
        // Score
        this.uiContainer = document.createElement('div');
        this.uiContainer.style.position = 'absolute';
        this.uiContainer.style.top = '20px';
        this.uiContainer.style.left = '20px';
        this.uiContainer.style.color = 'white';
        this.uiContainer.style.fontFamily = 'Arial, sans-serif';
        this.uiContainer.style.fontSize = '24px';
        this.uiContainer.style.fontWeight = 'bold';
        this.uiContainer.style.textShadow = '2px 2px 2px black';
        this.uiContainer.innerHTML = 'Player: 0 | Bot: 0';
        document.body.appendChild(this.uiContainer);

        // Crosshair
        const crosshair = document.createElement('div');
        crosshair.style.position = 'absolute';
        crosshair.style.top = '50%';
        crosshair.style.left = '50%';
        crosshair.style.width = '10px';
        crosshair.style.height = '10px';
        crosshair.style.backgroundColor = 'white';
        crosshair.style.border = '1px solid black';
        crosshair.style.borderRadius = '50%';
        crosshair.style.transform = 'translate(-50%, -50%)';
        crosshair.style.pointerEvents = 'none';
        document.body.appendChild(crosshair);

        // Charge Bar Container
        this.chargeBarContainer = document.createElement('div');
        this.chargeBarContainer.style.position = 'absolute';
        this.chargeBarContainer.style.bottom = '20px';
        this.chargeBarContainer.style.left = '50%';
        this.chargeBarContainer.style.transform = 'translateX(-50%)';
        this.chargeBarContainer.style.width = '200px';
        this.chargeBarContainer.style.height = '20px';
        this.chargeBarContainer.style.border = '2px solid white';
        this.chargeBarContainer.style.borderRadius = '10px';
        this.chargeBarContainer.style.overflow = 'hidden';
        document.body.appendChild(this.chargeBarContainer);

        // Sprint Bar Container
        this.sprintBarContainer = document.createElement('div');
        this.sprintBarContainer.style.position = 'absolute';
        this.sprintBarContainer.style.bottom = '50px'; // Above charge bar
        this.sprintBarContainer.style.left = '50%';
        this.sprintBarContainer.style.transform = 'translateX(-50%)';
        this.sprintBarContainer.style.width = '200px';
        this.sprintBarContainer.style.height = '10px';
        this.sprintBarContainer.style.border = '2px solid white';
        this.sprintBarContainer.style.borderRadius = '5px';
        this.sprintBarContainer.style.overflow = 'hidden';
        document.body.appendChild(this.sprintBarContainer);

        // Sprint Bar Fill
        this.sprintBarFill = document.createElement('div');
        this.sprintBarFill.style.width = '100%';
        this.sprintBarFill.style.height = '100%';
        this.sprintBarFill.style.backgroundColor = 'cyan';
        this.sprintBarContainer.appendChild(this.sprintBarFill);

        // Charge Bar Fill
        this.chargeBarFill = document.createElement('div');
        this.chargeBarFill.style.width = '0%';
        this.chargeBarFill.style.height = '100%';
        this.chargeBarFill.style.backgroundColor = 'lime';
        this.chargeBarContainer.appendChild(this.chargeBarFill);

        // Version Header
        const version = document.createElement('div');
        version.style.position = 'absolute';
        version.style.top = '10px';
        version.style.right = '10px';
        version.style.color = 'yellow';
        version.style.fontFamily = 'monospace';
        version.innerText = 'v1.6';
        document.body.appendChild(version);

        // FPS Counter
        this.fpsCounter = document.createElement('div');
        this.fpsCounter.style.position = 'absolute';
        this.fpsCounter.style.top = '10px';
        this.fpsCounter.style.left = '50%';
        this.fpsCounter.style.transform = 'translateX(-50%)';
        this.fpsCounter.style.color = 'lime';
        this.fpsCounter.style.fontFamily = 'monospace';
        this.fpsCounter.innerText = 'FPS: 60';
        document.body.appendChild(this.fpsCounter);

        // Debug Overlay
        this.debugDiv = document.createElement('div');
        this.debugDiv.style.position = 'absolute';
        this.debugDiv.style.top = '100px';
        this.debugDiv.style.left = '10px';
        this.debugDiv.style.color = 'white';
        this.debugDiv.style.fontFamily = 'monospace';
        this.debugDiv.style.fontSize = '12px';
        this.debugDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.debugDiv.style.padding = '5px';
        document.body.appendChild(this.debugDiv);

        this.lastTime = performance.now();
        this.frameCount = 0;
        this.lastFpsTime = this.lastTime;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        const now = performance.now();
        const delta = Math.min(this.clock.getDelta(), 0.1);

        // FPS Calculation
        this.frameCount++;
        if (now - this.lastFpsTime >= 1000) {
            this.fpsCounter.innerText = `FPS: ${this.frameCount}`;
            this.frameCount = 0;
            this.lastFpsTime = now;
        }

        // --- NETWORK SYNC ---
        if (this.socket && this.socket.connected) {
            // Emit Inputs (Server Authoritative)
            // We read inputs from this.player.getInputs()
            const inputs = this.player.getInputs();
            const viewQuat = this.player.camera.quaternion;

            // Explicitly serialize to avoid internal property issues (_x vs x)
            const q = this.player.camera.quaternion;
            this.socket.emit('player_input', {
                inputs: inputs,
                quaternion: { x: q.x, y: q.y, z: q.z, w: q.w }
            });

            // Emit Ball State if I own it
            if (this.player.hasBall) {
                this.socket.emit('ball_update', {
                    ownerId: this.socket.id,
                    position: this.ball.mesh.position,
                    velocity: this.ball.velocity
                });
            } else {
                // If I just threw it, I need to send the initial Velocity!
                // This is tricky. The 'ball_update' listener on server adds to state.
                // If I am not owner, I should not emit.
                // The throw logic in Player.js needs to set velocity, and we need to send that ONE time.
                // Or better: Server handles physics, so if I throw, I declare "I release ball with Velocity V".
            }
        }

        // Listen for World State (should be in init really, but placing here for context)
        // Moved to init()


        // Updates
        const collidables = this.world.getCollidables();
        // Add remote players to collidables?
        // For now, let's just make them ghosts to prevent stuck issues

        this.player.update(delta, collidables);

        // Update Remote Players
        for (const id in this.remotePlayers) {
            this.remotePlayers[id].update(delta);
        }

        // DEBUG: Update Line to first remote player
        const ids = Object.keys(this.remotePlayers);
        if (ids.length > 0) {
            const target = this.remotePlayers[ids[0]];
            const start = this.player.camera.position;
            const end = target.mesh.position;

            const points = [start, end];
            this.debugLine.geometry.setFromPoints(points);

            if (this.frameCount % 60 === 0) {
                console.log(`[Debug Line] Dist: ${start.distanceTo(end).toFixed(2)}, Start: ${start.y.toFixed(1)}, End: ${end.y.toFixed(1)}`);
            }
        }

        this.ball.update(delta, collidables);
        this.particleSystem.update(delta);

        // Update Power UI
        const ratio = this.player.getPowerRatio();
        this.chargeBarFill.style.width = `${ratio * 100}%`;
        const hue = 120 * (1 - ratio);
        this.chargeBarFill.style.backgroundColor = `hsl(${hue}, 100%, 50%)`;

        // Update Sprint UI
        if (this.player.maxStamina) {
            const sprintRatio = this.player.stamina / this.player.maxStamina;
            this.sprintBarFill.style.width = `${sprintRatio * 100}%`;
        }

        // Possession Text (Quick Overlay)
        if (!this.possessionText) {
            this.possessionText = document.createElement('div');
            this.possessionText.style.position = 'absolute';
            this.possessionText.style.width = '100%';
            this.possessionText.style.textAlign = 'center';
            this.possessionText.style.top = '-25px';
            this.possessionText.style.color = 'white';
            this.possessionText.style.fontWeight = 'bold';
            this.chargeBarContainer.appendChild(this.possessionText);
        }
        this.possessionText.innerText = this.player.hasBall ? "HOLDING BALL (CLICK TO SHOOT)" : "FIND BALL";

        this.checkScoring();

        this.renderer.render(this.scene, this.camera);
    }

    checkScoring() {
        if (!this.ball.active) return;

        const triggers = this.world.getTriggers();
        if (triggers.length === 0) return;

        // Check vs Hoop Triggers
        for (const trigger of triggers) {
            if (!trigger.geometry.boundingBox) trigger.geometry.computeBoundingBox();

            const triggerBox = trigger.geometry.boundingBox.clone().applyMatrix4(trigger.matrixWorld);

            if (triggerBox.intersectsBox(this.ball.ballBox)) {
                // Ball is in trigger logic
                if (this.ball.velocity.y < 0) {
                    // Which Hoop?
                    // Trigger Centers:
                    // Far (Enemy) Z ~ -15. Player scores here.
                    // Near (Player) Z ~ 15. Bot scores here.

                    const triggerZ = trigger.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(trigger.matrixWorld).z;

                    if (!this.justScored) {
                        if (triggerZ < 0) {
                            // Player Scored!
                            this.score++;
                            this.uiContainer.innerHTML = `Player: ${this.score} | Bot: ${this.botScore || 0}`;
                            console.log("Player Score!");
                            this.particleSystem.emit(this.ball.mesh.position, 100);
                        } else {
                            // Bot Scored!
                            this.botScore = (this.botScore || 0) + 1;
                            this.uiContainer.innerHTML = `Player: ${this.score} | Bot: ${this.botScore}`;
                            console.log("Bot Score!");
                            this.particleSystem.emit(this.ball.mesh.position, 100); // Bot Particles
                        }

                        this.justScored = true;

                        // Respawn Ball
                        setTimeout(() => {
                            this.ball.reset();
                            this.justScored = false;
                        }, 1000);
                    }
                } // End velocity check
            }
        }
    }
}
