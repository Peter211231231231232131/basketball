const THREE = require('three');

class ServerPlayer {
    constructor(id, startPos) {
        this.id = id;
        this.position = new THREE.Vector3().copy(startPos || { x: 0, y: 5, z: 0 });
        this.velocity = new THREE.Vector3();
        this.quaternion = new THREE.Quaternion(); // For facing direction (sent by client)

        // Physics Params
        this.speed = 6.0;
        this.sprintMultiplier = 1.7;
        this.jumpForce = 12.0;
        this.gravity = 30.0;

        this.height = 1.6;
        this.width = 0.6;
        this.onGround = false;

        // Inputs (Current Frame)
        this.inputs = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
            viewQuaternion: { x: 0, y: 0, z: 0, w: 1 } // Client sends camera quat for direction
        };

        // Helpers
        this.playerBox = new THREE.Box3();
        this.elementBox = new THREE.Box3();
        this.tempVec = new THREE.Vector3();
        this.tempDir = new THREE.Vector3();
    }

    setInputs(data) {
        if (data.inputs) this.inputs = { ...this.inputs, ...data.inputs };
        if (data.quaternion) this.quaternion.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
    }

    update(delta, collidables) {
        // --- 1. Physics ---
        const damping = 10.0;
        this.velocity.x -= this.velocity.x * damping * delta;
        this.velocity.z -= this.velocity.z * damping * delta;
        this.velocity.y -= this.gravity * delta;

        // --- 2. Movement from Inputs ---
        const { forward, backward, left, right, jump, sprint } = this.inputs;

        const targetSpeed = this.speed * (sprint ? this.sprintMultiplier : 1.0);
        const acceleration = 200.0;

        this.tempDir.set(0, 0, 0);

        // Direction must be based on View Quaternion (sent by client)
        // Forward
        this.tempVec.set(0, 0, -1).applyQuaternion(this.quaternion);
        this.tempVec.y = 0;
        this.tempVec.normalize();
        if (forward) this.tempDir.add(this.tempVec);
        if (backward) this.tempDir.sub(this.tempVec);

        // Right
        this.tempVec.set(1, 0, 0).applyQuaternion(this.quaternion);
        this.tempVec.y = 0;
        this.tempVec.normalize();
        if (right) this.tempDir.add(this.tempVec);
        if (left) this.tempDir.sub(this.tempVec);

        if (this.tempDir.lengthSq() > 0) {
            this.tempDir.normalize();
            this.velocity.x += this.tempDir.x * acceleration * delta;
            this.velocity.z += this.tempDir.z * acceleration * delta;
        }

        // Cap speed
        const currentHorizSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
        if (currentHorizSpeed > targetSpeed) {
            const ratio = targetSpeed / currentHorizSpeed;
            this.velocity.x *= ratio;
            this.velocity.z *= ratio;
        }

        // Jump
        if (jump && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.inputs.jump = false; // Consume jump
        }

        // --- 3. Collision Resolution ---
        this.onGround = false;

        // X Axis
        this.position.x += this.velocity.x * delta;
        this.resolveCollisions(collidables, 'x');

        // Z Axis
        this.position.z += this.velocity.z * delta;
        this.resolveCollisions(collidables, 'z');

        // Y Axis
        this.position.y += this.velocity.y * delta;
        this.resolveCollisions(collidables, 'y');

        // Floor Safety
        if (this.position.y < -20) {
            this.position.set(0, 5, 0);
            this.velocity.set(0, 0, 0);
        }
    }

    resolveCollisions(collidables, axis) {
        const pos = this.position;
        const w = this.width / 2;
        const h = this.height;

        this.playerBox.set(
            new THREE.Vector3(pos.x - w, pos.y - h, pos.z - w),
            new THREE.Vector3(pos.x + w, pos.y, pos.z + w)
        );

        for (const object of collidables) {
            if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
            this.elementBox.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);

            if (this.playerBox.intersectsBox(this.elementBox)) {
                const overlapX = Math.min(this.playerBox.max.x, this.elementBox.max.x) - Math.max(this.playerBox.min.x, this.elementBox.min.x);
                const overlapY = Math.min(this.playerBox.max.y, this.elementBox.max.y) - Math.max(this.playerBox.min.y, this.elementBox.min.y);
                const overlapZ = Math.min(this.playerBox.max.z, this.elementBox.max.z) - Math.max(this.playerBox.min.z, this.elementBox.min.z);

                if (Math.abs(overlapX) < 0.001 || Math.abs(overlapY) < 0.001 || Math.abs(overlapZ) < 0.001) continue;

                if (axis === 'x') {
                    if (overlapX > 0) {
                        const dir = pos.x - this.elementBox.getCenter(this.tempVec).x;
                        const sign = (this.velocity.x !== 0) ? -Math.sign(this.velocity.x) : Math.sign(dir);
                        pos.x += overlapX * sign;
                        this.velocity.x = 0;
                    }
                } else if (axis === 'z') {
                    if (overlapZ > 0) {
                        const dir = pos.z - this.elementBox.getCenter(this.tempVec).z;
                        const sign = (this.velocity.z !== 0) ? -Math.sign(this.velocity.z) : Math.sign(dir);
                        pos.z += overlapZ * sign;
                        this.velocity.z = 0;
                    }
                } else if (axis === 'y') {
                    if (overlapY > 0) {
                        if (this.velocity.y < 0) {
                            pos.y += overlapY;
                            this.onGround = true;
                            this.velocity.y = 0;
                        } else if (this.velocity.y > 0) {
                            pos.y -= overlapY;
                            this.velocity.y = 0;
                        } else {
                            pos.y += overlapY;
                            this.onGround = true;
                        }
                    }
                }

                this.playerBox.set(
                    new THREE.Vector3(pos.x - w, pos.y - h, pos.z - w),
                    new THREE.Vector3(pos.x + w, pos.y, pos.z + w)
                );
            }
        }
    }
}

module.exports = { ServerPlayer };
