import * as THREE from 'three';

export class RemotePlayer {
    constructor(scene, camera, id, initialData) {
        this.scene = scene;
        this.camera = camera;
        this.id = id;
        this.position = new THREE.Vector3().copy(initialData.position || { x: 0, y: 0, z: 0 });
        this.quaternion = new THREE.Quaternion().copy(initialData.quaternion || { x: 0, y: 0, z: 0, w: 1 });

        // Target for interpolation
        this.targetPosition = this.position.clone();
        this.targetQuaternion = this.quaternion.clone();

        // Mesh (Confirmed Visible: Blue Sphere)
        const geometry = new THREE.SphereGeometry(0.5, 16, 16);
        geometry.translate(0, 2, 0); // LIFT IT UP! (Replicating the "High Sphere" that worked)
        const material = new THREE.MeshBasicMaterial({
            color: 0x0000ff,
            depthTest: false, // FORCE SEE THROUGH WALLS/FLOOR
            transparent: true
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;

        // Ensure standard rendering
        this.mesh.renderOrder = 9999; // ON TOP
        this.mesh.frustumCulled = false;

        console.log(`[RemotePlayer] Created ${id} at ${this.position.x}, ${this.position.y}, ${this.position.z}`);
        this.scene.add(this.mesh);

        // Verify attachment
        setTimeout(() => {
            if (this.mesh.parent !== this.scene) {
                console.error("[RemotePlayer] Mesh NOT attached to scene!");
            } else {
                console.log("[RemotePlayer] Mesh successfully attached to scene UUID:", this.scene.uuid);
            }
        }, 100);

        // HTML Label (Debug Overlay)
        this.label = document.createElement('div');
        this.label.innerText = `PLAYER ${id.slice(0, 4)}`;
        this.label.style.position = 'absolute';
        this.label.style.color = 'red';
        this.label.style.fontWeight = 'bold';
        this.label.style.background = 'rgba(0,0,0,0.5)';
        this.label.style.padding = '2px 5px';
        this.label.style.pointerEvents = 'none';
        this.label.style.transform = 'translate(-50%, -50%)'; // Center
        document.body.appendChild(this.label);
    }

    updateData(data) {
        if (data.position) {
            this.targetPosition.set(data.position.x, data.position.y, data.position.z);
        }
        if (data.quaternion) this.targetQuaternion.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
    }

    update(delta) {
        // Interpolate smooth movement
        const lerpFactor = 10.0 * delta; // Adjust for smoothness
        this.mesh.position.lerp(this.targetPosition, lerpFactor);
        this.mesh.quaternion.slerp(this.targetQuaternion, lerpFactor);

        // Update Label Position
        if (this.label && this.camera) {
            const tempV = this.mesh.position.clone();
            tempV.y += 2.5; // Above head

            // Project to screen
            tempV.project(this.camera);

            const x = (tempV.x * .5 + .5) * window.innerWidth;
            const y = (tempV.y * -.5 + .5) * window.innerHeight;

            // Check if in front of camera (z < 1)
            if (tempV.z < 1) {
                this.label.style.display = 'block';
                this.label.style.left = `${x}px`;
                this.label.style.top = `${y}px`;
            } else {
                this.label.style.display = 'none';
            }
        }
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        if (this.label) {
            this.label.remove();
        }
    }
}
