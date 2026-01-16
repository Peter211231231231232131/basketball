import * as THREE from 'three';

export class RemotePlayer {
    constructor(scene, id, initialData) {
        this.scene = scene;
        this.id = id;
        this.position = new THREE.Vector3().copy(initialData.position || { x: 0, y: 0, z: 0 });
        this.quaternion = new THREE.Quaternion().copy(initialData.quaternion || { x: 0, y: 0, z: 0, w: 1 });

        // Target for interpolation
        this.targetPosition = this.position.clone();
        this.targetQuaternion = this.quaternion.clone();

        // Mesh (Debug Box)
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red, unlit
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.position.copy(this.position);

        // Name tag or ID?
        // for now just mesh

        console.log(`[RemotePlayer] Created ${id} at ${this.position.x}, ${this.position.y}, ${this.position.z}`);
        this.scene.add(this.mesh);
    }

    updateData(data) {
        if (data.position) this.targetPosition.set(data.position.x, data.position.y, data.position.z);
        if (data.quaternion) this.targetQuaternion.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
    }

    update(delta) {
        // Interpolate smooth movement
        const lerpFactor = 10.0 * delta; // Adjust for smoothness
        this.mesh.position.lerp(this.targetPosition, lerpFactor);
        this.mesh.quaternion.slerp(this.targetQuaternion, lerpFactor);
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
