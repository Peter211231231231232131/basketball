const THREE = require('three');

class ServerWorld {
    constructor(scene) {
        this.scene = scene;
        this.collidables = [];
        this.triggers = []; // For scoring
        this.init();
    }

    init() {
        // Floor (Wood Court) - Physics Only (Box)
        const floorGeometry = new THREE.BoxGeometry(20, 1, 34);
        const floorMaterial = new THREE.MeshBasicMaterial(); // Material doesn't matter for physics
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.y = -0.5;
        this.scene.add(floor);
        floor.updateMatrixWorld(true);
        this.collidables.push(floor);

        // Side Walls
        this.createBox(new THREE.Vector3(10.5, 2, 0), new THREE.Vector3(1, 5, 34), true); // Right
        this.createBox(new THREE.Vector3(-10.5, 2, 0), new THREE.Vector3(1, 5, 34), true); // Left
        this.createBox(new THREE.Vector3(0, 2, -17.5), new THREE.Vector3(22, 5, 1), true); // Far
        this.createBox(new THREE.Vector3(0, 2, 17.5), new THREE.Vector3(22, 5, 1), true); // Near

        // Hoops
        // Hoop 1 (Far / Enemy Hoop) at Z = -15
        this.createHoop(new THREE.Vector3(0, 0, -15), true);
        // Hoop 2 (Near / Player Hoop) at Z = +15, rotated 180 (facing -Z)
        this.createHoop(new THREE.Vector3(0, 0, 15), false);
    }

    createBox(pos, size, isStatic) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const material = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(pos);

        // Update Matrix for collision calculations
        mesh.updateMatrixWorld(true); // Force update

        if (isStatic) {
            this.collidables.push(mesh);
        }

        this.scene.add(mesh);
        return mesh;
    }

    createHoop(pos, facingForward) {
        const zDir = facingForward ? 1 : -1;

        // Post
        this.createBox(new THREE.Vector3(pos.x, 1.5, pos.z - (0.5 * zDir)), new THREE.Vector3(0.3, 3, 0.3), true);

        // Backboard
        const boardPos = new THREE.Vector3(pos.x, 3, pos.z);
        this.createBox(boardPos, new THREE.Vector3(1.8, 1.2, 0.1), true);

        // Rim
        const rimCenter = new THREE.Vector3(pos.x, 2.8, pos.z + (0.45 * zDir));
        const radius = 0.3;
        const thickness = 0.05;

        // Simple square rim for collision
        this.createBox(new THREE.Vector3(rimCenter.x - radius, rimCenter.y, rimCenter.z), new THREE.Vector3(thickness, thickness, radius * 2), true);
        this.createBox(new THREE.Vector3(rimCenter.x + radius, rimCenter.y, rimCenter.z), new THREE.Vector3(thickness, thickness, radius * 2), true);
        this.createBox(new THREE.Vector3(rimCenter.x, rimCenter.y, rimCenter.z - radius), new THREE.Vector3(radius * 2, thickness, thickness), true);
        this.createBox(new THREE.Vector3(rimCenter.x, rimCenter.y, rimCenter.z + radius), new THREE.Vector3(radius * 2, thickness, thickness), true);

        // Score Trigger
        this.createTrigger(new THREE.Vector3(rimCenter.x, rimCenter.y - 0.3, rimCenter.z), new THREE.Vector3(0.5, 0.2, 0.5));
    }

    createTrigger(position, size) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        const trigger = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
        trigger.position.copy(position);
        trigger.updateMatrixWorld(true); // Force matrix update

        // Ensure bounding box is pre-calculated
        trigger.geometry.computeBoundingBox();

        this.scene.add(trigger);
        this.triggers.push(trigger);
    }

    getCollidables() { return this.collidables; }
    getTriggers() { return this.triggers; }
}

module.exports = { ServerWorld };
