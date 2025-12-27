import * as THREE from 'three';

export class ExplosionController {
    constructor(scene) {
        this.scene = scene;
        this.explosions = []; // Active particle systems
        this.debrisList = []; // Active debris
        this.dyingCrafts = []; // Crafts in the process of exploding
    }

    // Trigger the sequence
    triggerExplosion(craft, impactPoint) {
        this.dyingCrafts.push({
            mesh: craft,
            impactPoint: impactPoint.clone(),
            timer: 0,
            duration: 10.0, // 10 seconds of progressive explosions
            radius: craft.userData.radius || 20,
            velocity: craft.userData.velocity ? craft.userData.velocity.clone() : new THREE.Vector3()
        });
    }

    // Create a single burst of particles
    createBurst(position, scale = 1.0, colorType = 'fire', baseVelocity = new THREE.Vector3()) {
        const particleCount = Math.floor(50 * scale); // Increased count
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];
        const colors = [];
        const sizes = [];

        const color = new THREE.Color();

        for (let i = 0; i < particleCount; i++) {
            positions.push(position.x, position.y, position.z);
            
            // Velocity
            const speed = (Math.random() * 20 + 5) * scale;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            velocities.push(
                baseVelocity.x + speed * Math.sin(phi) * Math.cos(theta),
                baseVelocity.y + speed * Math.sin(phi) * Math.sin(theta),
                baseVelocity.z + speed * Math.cos(phi)
            );

            // Color
            if (colorType === 'fire') {
                const r = Math.random();
                if (r < 0.1) color.setHex(0xffffff);
                else if (r < 0.3) color.setHex(0xffff00);
                else if (r < 0.6) color.setHex(0xffaa00);
                else color.setHex(0xff4400); // Darker red/orange
            } else {
                color.setHex(0x888888);
            }
            
            colors.push(color.r, color.g, color.b);
            sizes.push((Math.random() * 15 + 5) * scale); // Larger sizes for volumetric look
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

        // Custom Shader for volumetric-looking particles (soft spheres)
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uOpacity: { value: 1.0 }
            },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float uOpacity;
                varying vec3 vColor;
                void main() {
                    // Distance from center of the point (0.0 to 0.5)
                    float d = distance(gl_PointCoord, vec2(0.5));
                    if(d > 0.5) discard;
                    
                    // Soft radial gradient for volumetric look
                    float strength = 1.0 - (d * 2.0);
                    strength = pow(strength, 2.0); 
                    
                    gl_FragColor = vec4(vColor, strength * uOpacity);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });

        const particles = new THREE.Points(geometry, material);
        particles.layers.enable(1); // Bloom
        this.scene.add(particles);

        this.explosions.push({
            mesh: particles,
            velocities: velocities,
            age: 0,
            maxAge: 2.0 * scale // Longer life
        });
    }

    createDebris(position, radius, count, baseVelocity = new THREE.Vector3()) {
        const geometry = new THREE.TetrahedronGeometry(1, 0);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            roughness: 0.4, 
            metalness: 0.8 
        });

        for(let i=0; i<count; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(position).add(new THREE.Vector3(
                (Math.random() - 0.5) * radius,
                (Math.random() - 0.5) * radius,
                (Math.random() - 0.5) * radius
            ));
            
            const s = Math.random() * radius * 0.3;
            mesh.scale.set(s, s, s);
            mesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            
            this.scene.add(mesh);
            
            const speed = Math.random() * 50 + 20;
            const velocity = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize().multiplyScalar(speed).add(baseVelocity);

            this.debrisList.push({
                mesh: mesh,
                velocity: velocity,
                rotVelocity: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5),
                age: 0,
                maxAge: 5.0
            });
        }
    }

    update(delta) {
        // 1. Update Dying Crafts
        for (let i = this.dyingCrafts.length - 1; i >= 0; i--) {
            const craftData = this.dyingCrafts[i];
            craftData.timer += delta;
            
            // Shake
            craftData.mesh.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            ));

            // Progressive explosions
            // Probability increases with time
            const progress = craftData.timer / craftData.duration;
            if (Math.random() < progress * 0.8) {
                // Random position on craft
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 2
                ).normalize().multiplyScalar(craftData.radius * Math.random());
                
                // Interpolate from impact point to full body
                const burstPos = craftData.impactPoint.clone().lerp(craftData.mesh.position.clone().add(offset), progress);
                
                this.createBurst(burstPos, 0.5 + progress, 'fire', craftData.velocity);
            }

            // Final Death
            if (craftData.timer >= craftData.duration) {
                // Big Boom
                this.createBurst(craftData.mesh.position, 3.0, 'fire', craftData.velocity);
                // Debris
                this.createDebris(craftData.mesh.position, craftData.radius, 20, craftData.velocity);
                
                // Remove craft
                this.scene.remove(craftData.mesh);
                this.dyingCrafts.splice(i, 1);
            }
        }

        // 2. Update Explosions (Particles)
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];
            explosion.age += delta;

            if (explosion.age >= explosion.maxAge) {
                this.scene.remove(explosion.mesh);
                explosion.mesh.geometry.dispose();
                explosion.mesh.material.dispose();
                this.explosions.splice(i, 1);
                continue;
            }

            const positions = explosion.mesh.geometry.attributes.position.array;
            const colors = explosion.mesh.geometry.attributes.color.array;
            const velocities = explosion.velocities;
            const lifeRatio = explosion.age / explosion.maxAge;
            
            for (let j = 0; j < velocities.length / 3; j++) {
                positions[j * 3] += velocities[j * 3] * delta;
                positions[j * 3 + 1] += velocities[j * 3 + 1] * delta;
                positions[j * 3 + 2] += velocities[j * 3 + 2] * delta;
                
                velocities[j * 3] *= 0.95; // Drag
                velocities[j * 3 + 1] *= 0.95;
                velocities[j * 3 + 2] *= 0.95;

                // Color shift to dark smoke at the end
                // Only apply to 'fire' type (which we can infer if it started bright)
                // Simple hack: darken all particles as they age
                if (lifeRatio > 0.5) {
                    const darkenFactor = 1.0 - ((lifeRatio - 0.5) * 2.0 * delta * 2.0); // Darken speed
                    colors[j * 3] *= darkenFactor;
                    colors[j * 3 + 1] *= darkenFactor;
                    colors[j * 3 + 2] *= darkenFactor;
                }
            }
            
            explosion.mesh.geometry.attributes.position.needsUpdate = true;
            explosion.mesh.geometry.attributes.color.needsUpdate = true;
            
            if (explosion.mesh.material.uniforms && explosion.mesh.material.uniforms.uOpacity) {
                explosion.mesh.material.uniforms.uOpacity.value = 1 - Math.pow(lifeRatio, 2);
            } else {
                explosion.mesh.material.opacity = 1 - Math.pow(lifeRatio, 2);
            }
        }

        // 3. Update Debris
        for (let i = this.debrisList.length - 1; i >= 0; i--) {
            const debris = this.debrisList[i];
            debris.age += delta;
            
            if (debris.age >= debris.maxAge) {
                this.scene.remove(debris.mesh);
                debris.mesh.geometry.dispose();
                debris.mesh.material.dispose();
                this.debrisList.splice(i, 1);
                continue;
            }

            debris.mesh.position.add(debris.velocity.clone().multiplyScalar(delta));
            debris.mesh.rotation.x += debris.rotVelocity.x * delta;
            debris.mesh.rotation.y += debris.rotVelocity.y * delta;
            debris.mesh.rotation.z += debris.rotVelocity.z * delta;
            
            // Fade out debris? Or just shrink
            const scale = 1 - (debris.age / debris.maxAge);
            debris.mesh.scale.multiplyScalar(0.99); // Slowly shrink
        }
    }
}