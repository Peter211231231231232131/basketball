import * as THREE from 'three';

export class RemotePlayer {
    constructor(id, initialData) {
        this.id = id;

        // Data State (No Visuals)
        this.position = new THREE.Vector3();
        this.quaternion = new THREE.Quaternion();

        if (initialData && initialData.position) {
            this.position.set(initialData.position.x, initialData.position.y, initialData.position.z);
        }
        if (initialData && initialData.quaternion) {
            this.quaternion.set(initialData.quaternion.x, initialData.quaternion.y, initialData.quaternion.z, initialData.quaternion.w);
        }

        // Target for interpolation
        this.targetPosition = this.position.clone();
        this.targetQuaternion = this.quaternion.clone();

        console.log(`[RemotePlayer] Initialized Data for ${id}`);
    }

    updateData(data) {
        if (data.position) {
            this.targetPosition.set(data.position.x, data.position.y, data.position.z);
        }
        if (data.quaternion) this.targetQuaternion.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
    }

    update(delta) {
        // Interpolate smooth movement of the DATA
        const lerpFactor = 10.0 * delta;
        this.position.lerp(this.targetPosition, lerpFactor);
        this.quaternion.slerp(this.targetQuaternion, lerpFactor);
    }

    dispose() {
        if (this.label) {
            this.label.remove();
        }
    }
}
