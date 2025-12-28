import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class DropletController {
    constructor(scene, renderer, guiManager, loadingManager) {
        this.scene = scene;
        this.renderer = renderer; // 需要操作 toneMappingExposure
        this.gui = guiManager;
        this.loadingManager = loadingManager;
        
        // --- 物理参数 ---
        this.speed = 0;
        this.maxSpeed = 3000;
        this.boostFactor = 0; // 0 to 1, used for camera effects
        this.container = new THREE.Group(); 
        
        // Initial Position & Rotation
        this.container.position.set(0, 0, 3000);
        this.container.rotation.y = Math.PI; // Face -Z (towards origin)
        
        scene.add(this.container);

        // --- 状态开关 ---
        this.state = {
            attackMode: false,
            flickerMode: false,
            sharpTurnMode: false, // Alt key status
        };

        // --- 锁定目标 ---
        this.lockedTarget = null; // { mesh, ... } from FleetController

        // --- 相机参数 ---
        this.cameraBaseDistance = 8;      // 基础距离
        this.cameraCurrentDistance = 8;   // 当前距离
        this.cameraMaxExtraDistance = 2;  // 加速时最大额外拉远距离（减小了）

        // --- 核心对象 ---
        this.mesh = null;      // 真实模型 (银色水滴)
        this.ghostMesh = null; // 幽灵模型 (线框)
        this.trailPoints = []; // 轨迹点
        this.trailLine = null; // 轨迹线
        this.ringMaterials = []; // 光环材质引用

        // --- 输入状态 ---
        this.keys = { w:false, a:false, s:false, d:false, space:false, p:false, alt:false };
        this.gamepadIndex = null;
        this.gamepadState = {
            hPressed: false,
            uPressed: false,
            tPressed: false,
            oPressed: false,
            helpPressed: false,
            autoAttackPressed: false,
            startPressed: false
        };
        this.cameraInput = { x: 0, y: 0 };

        this.initInput();
        this.loadModel();
        
        // 初始化轨迹线几何体
        const trailGeo = new THREE.BufferGeometry();
        const trailMat = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.5 });
        this.trailLine = new THREE.Line(trailGeo, trailMat);
        this.scene.add(this.trailLine);
    }

    initInput() {
        // 键盘监听
        window.addEventListener('keydown', (e) => this.handleKey(e, true));
        window.addEventListener('keyup', (e) => this.handleKey(e, false));

        // Gamepad Connection
        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
                e.gamepad.index, e.gamepad.id,
                e.gamepad.buttons.length, e.gamepad.axes.length);
            this.gamepadIndex = e.gamepad.index;
        });

        window.addEventListener("gamepaddisconnected", (e) => {
            console.log("Gamepad disconnected from index %d: %s",
                e.gamepad.index, e.gamepad.id);
            if (this.gamepadIndex === e.gamepad.index) {
                this.gamepadIndex = null;
            }
        });

        // 绑定 GUI 回调
        this.gui.callbacks.onToggleAttack = () => this.toggleAttackMode();
        this.gui.callbacks.onToggleFlicker = () => this.toggleFlicker();
    }

    updateGamepadInput() {
        if (this.gamepadIndex === null) return;

        const gamepad = navigator.getGamepads()[this.gamepadIndex];
        if (!gamepad) return;

        // --- Global Inputs (Always Active) ---
        
        // Start Button (Button 9) - Close Help / Pause?
        if (gamepad.buttons[9] && gamepad.buttons[9].pressed) {
            if (!this.gamepadState.startPressed) {
                if (this.gui.isHelpOpen) {
                    this.gui.closeHelp();
                    this.gui.playClickSound();
                }
                this.gamepadState.startPressed = true;
            }
        } else {
            this.gamepadState.startPressed = false;
        }

        // If Help is open, block other inputs
        if (this.gui.isHelpOpen) return;

        // Threshold for sticks
        const threshold = 0.1;

        // Left Stick for Pitch/Yaw (W/S/A/D equivalent)
        // Axis 1: Vertical (Pitch) -> W/S
        // Axis 0: Horizontal (Yaw) -> A/D
        const axisY = gamepad.axes[1];
        const axisX = gamepad.axes[0];

        // Right Stick (Camera)
        // Axis 2: Horizontal (Yaw)
        // Axis 3: Vertical (Pitch)
        this.cameraInput = {
            x: Math.abs(gamepad.axes[2]) > threshold ? gamepad.axes[2] : 0,
            y: Math.abs(gamepad.axes[3]) > threshold ? gamepad.axes[3] : 0
        };

        this.keys.w = axisY < -threshold;
        this.keys.s = axisY > threshold;
        this.keys.a = axisX < -threshold;
        this.keys.d = axisX > threshold;

        // Buttons
        // Standard Mapping (Xbox/PS):
        // 0: A/Cross (Boost)
        // 1: B/Circle (Brake)
        // 2: X/Square (Attack Mode)
        // 3: Y/Triangle (Flicker)
        // 4: LB/L1 (Tactical Turn)
        // 5: RB/R1
        // 6: LT/L2 (Analog Trigger)
        // 7: RT/R2 (Analog Trigger)
        // 8: Back/Select
        // 9: Start
        // 12: D-Pad Up (Radar Trail)
        // 13: D-Pad Down (Help Menu)
        // 14: D-Pad Left (Auto Attack)
        // 15: D-Pad Right (Observer Mode)

        this.keys.space = gamepad.buttons[0].pressed; // A -> Boost
        this.keys.p = gamepad.buttons[1].pressed;     // B -> Brake
        
        // Tactical Turn (Hold)
        const altPressed = gamepad.buttons[4].pressed; // LB
        if (this.keys.alt !== altPressed) {
            this.keys.alt = altPressed;
            this.handleSharpTurnLogic(altPressed);
        }

        // Toggles (Press once)
        
        // Attack Mode (X)
        if (gamepad.buttons[2].pressed) {
            if (!this.gamepadState.hPressed) {
                this.toggleAttackMode();
                this.gamepadState.hPressed = true;
            }
        } else {
            this.gamepadState.hPressed = false;
        }

        // Flicker (Y)
        if (gamepad.buttons[3].pressed) {
            if (!this.gamepadState.uPressed) {
                this.toggleFlicker();
                this.gamepadState.uPressed = true;
            }
        } else {
            this.gamepadState.uPressed = false;
        }

        // Radar Trail (D-Pad Up - Button 12)
        if (gamepad.buttons[12] && gamepad.buttons[12].pressed) {
            if (!this.gamepadState.tPressed) {
                if (this.gui.dom.btnRadarTrail) this.gui.dom.btnRadarTrail.click();
                this.gamepadState.tPressed = true;
            }
        } else {
            this.gamepadState.tPressed = false;
        }

        // Help Menu (D-Pad Down - Button 13)
        if (gamepad.buttons[13] && gamepad.buttons[13].pressed) {
            if (!this.gamepadState.helpPressed) {
                const btn = document.getElementById('btn-show-help');
                if (btn) btn.click();
                this.gamepadState.helpPressed = true;
            }
        } else {
            this.gamepadState.helpPressed = false;
        }

        // Auto Attack (D-Pad Left - Button 14)
        if (gamepad.buttons[14] && gamepad.buttons[14].pressed) {
            if (!this.gamepadState.autoAttackPressed) {
                if (this.gui.dom.btnAutoAttack) this.gui.dom.btnAutoAttack.click();
                this.gamepadState.autoAttackPressed = true;
            }
        } else {
            this.gamepadState.autoAttackPressed = false;
        }

        // Observer Mode (D-Pad Right - Button 15)
        if (gamepad.buttons[15] && gamepad.buttons[15].pressed) {
            if (!this.gamepadState.oPressed) {
                if (this.gui.dom.btnObserver) this.gui.dom.btnObserver.click();
                this.gamepadState.oPressed = true;
            }
        } else {
            this.gamepadState.oPressed = false;
        }
    }

    handleKey(e, isDown) {
        const key = e.key.toLowerCase();
        
        // 阻止所有控制按键的浏览器默认行为
        const controlKeys = ['w', 'a', 's', 'd', ' ', 'p', 'h', 'u', 'alt'];
        if (controlKeys.includes(key)) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        switch(key) {
            case 'w': this.keys.w = isDown; break;
            case 's': this.keys.s = isDown; break;
            case 'a': this.keys.a = isDown; break;
            case 'd': this.keys.d = isDown; break;
            case ' ': this.keys.space = isDown; break;
            case 'p': this.keys.p = isDown; break; // Brake
            case 'h': if(isDown) this.toggleAttackMode(); break;
            case 'u': if(isDown) this.toggleFlicker(); break;
            case 'alt': 
                if (this.keys.alt !== isDown) {
                    this.keys.alt = isDown;
                    this.handleSharpTurnLogic(isDown);
                }
                break;
        }
    }

    loadModel() {
        // 创建一个组来包含水滴和光环
        this.mesh = new THREE.Group();
        this.container.add(this.mesh);

        // 创建 Ghost 容器
        this.ghostMesh = new THREE.Group();
        this.scene.add(this.ghostMesh);
        this.ghostMesh.visible = false;

        const loader = new GLTFLoader(this.loadingManager);

        // 定义 Ghost 材质应用函数
        const applyGhostStyle = (obj) => {
            obj.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshBasicMaterial({
                        color: 0x00f3ff,
                        wireframe: true,
                        transparent: true,
                        opacity: 0.4
                    });
                }
            });
        };

        // 1. 加载水滴实体 (不发光)
        loader.load('/model/trisolaran_droplet.glb', (gltf) => {
            const droplet = gltf.scene;
            droplet.rotation.y = -Math.PI / 2; // 修正朝向
            this.mesh.add(droplet);

            // 添加到 Ghost
            const ghostPart = droplet.clone();
            applyGhostStyle(ghostPart);
            this.ghostMesh.add(ghostPart);
        });

        // 2. 加载光环 (发光)
        loader.load('/model/LightRing.glb', (gltf) => {
            const ring = gltf.scene;
            ring.rotation.y = -Math.PI / 2; // 修正朝向

            // 设置发光材质
            ring.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.emissive = new THREE.Color(0x00f3ff);
                    child.material.emissiveIntensity = 2.0;
                    // 启用 Layer 1 用于 Selective Bloom
                    child.layers.enable(1);
                    this.ringMaterials.push(child.material);
                }
            });
            this.mesh.add(ring);

            // 添加到 Ghost
            const ghostPart = ring.clone();
            applyGhostStyle(ghostPart);
            this.ghostMesh.add(ghostPart);
        });
    }

    toggleAttackMode() {
        this.state.attackMode = !this.state.attackMode;
        this.gui.setAttackModeActive(this.state.attackMode);
    }

    toggleFlicker() {
        this.state.flickerMode = !this.state.flickerMode;
        this.gui.setFlickerActive(this.state.flickerMode);
        // 关闭时重置亮度
        if (!this.state.flickerMode) this.renderer.toneMappingExposure = 1.0;
    }

    lockTarget(target) {
        this.lockedTarget = target;
        if (target) {
            console.log(`Locked on target: ${target.name}`);
        } else {
            console.log("Target unlocked");
        }
    }

    handleSharpTurnLogic(isActive) {
        this.state.sharpTurnMode = isActive;
        if (!this.mesh || !this.ghostMesh) return;

        if (isActive) {
            // --- 按下 Alt ---
            // 1. 隐藏实体，显示 Ghost
            this.mesh.visible = false;
            this.ghostMesh.visible = true;
            // 2. Ghost 同步位置和旋转
            this.ghostMesh.position.copy(this.container.position);
            this.ghostMesh.rotation.copy(this.container.rotation);
            // 3. 清空并开始绘制轨迹
            this.trailPoints = [];
        } else {
            // --- 松开 Alt ---
            // 1. 实体瞬间继承 Ghost 的旋转
            this.container.rotation.copy(this.ghostMesh.rotation);
            // 2. 恢复显示
            this.mesh.visible = true;
            this.ghostMesh.visible = false;
            // 3. 清除轨迹线
            this.trailLine.geometry.setFromPoints([]);
        }
    }

    update(deltaTime, elapsedTime, camera) {
        this.updateGamepadInput();

        if (!this.mesh) return;

        // --- 1. 物理引擎 (非线性加速) ---
        if (this.keys.space) {
            // 降低加速度，让加速过程更平缓
            const acc = this.speed < 300 ? 100 : 50; 
            this.speed += acc * deltaTime;
            
            // 增加 Boost Factor
            this.boostFactor += deltaTime * 1.0; // 同时也减缓相机拉远的速度
        } else {
            // 减少 Boost Factor (快速回弹)
            this.boostFactor -= deltaTime * 3.0;
        }
        this.boostFactor = Math.max(0, Math.min(1, this.boostFactor));

        if (this.keys.p) {
            // 刹车
            const dec = this.speed < 300 ? 300 : 100;
            this.speed -= dec * deltaTime;
            if (this.speed < 0) this.speed = 0;
        }
        // 限制最大速度
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        
        // 注意：没有阻力代码，所以松开空格会保持惯性滑行

        // --- 2. 旋转逻辑 ---
        const targetObj = this.state.sharpTurnMode ? this.ghostMesh : this.container;

        if (this.lockedTarget && !this.state.sharpTurnMode) {
            // --- 自动锁定模式 ---
            // 如果有锁定目标，且不在 Alt 模式下，强制朝向目标
            const targetPos = this.lockedTarget.mesh.position.clone();
            
            // 使用 lookAt 简单粗暴地朝向目标
            // 注意：lookAt 会瞬间改变朝向。如果需要平滑，可以用 Quaternion.slerp
            const dummy = new THREE.Object3D();
            dummy.position.copy(targetObj.position);
            dummy.lookAt(targetPos);
            
            targetObj.quaternion.slerp(dummy.quaternion, 5.0 * deltaTime); // 平滑转向

        } else {
            // --- 手动控制模式 ---
            const rotateSpeed = 2.0 * deltaTime;
            
            // 获取相机四元数
            const camQuat = camera.quaternion.clone();
            
            // 构建基于相机视角的旋转轴
            const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camQuat);
            
            const rotQuat = new THREE.Quaternion();

            // W/S 控制俯仰 (Pitch) - 绕相机右轴
            if (this.keys.w) {
                const q = new THREE.Quaternion().setFromAxisAngle(camRight, rotateSpeed);
                rotQuat.multiply(q);
            }
            if (this.keys.s) {
                const q = new THREE.Quaternion().setFromAxisAngle(camRight, -rotateSpeed);
                rotQuat.multiply(q);
            }

            // A/D 控制偏航 (Yaw) - 绕相机上轴 (camUp)
            const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camQuat);
            
            if (this.keys.a) {
                const q = new THREE.Quaternion().setFromAxisAngle(camUp, rotateSpeed);
                rotQuat.multiply(q);
                // 滚转效果
                const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1).applyQuaternion(targetObj.quaternion), rotateSpeed * 0.5);
                rotQuat.multiply(rollQ);
            }
            if (this.keys.d) {
                const q = new THREE.Quaternion().setFromAxisAngle(camUp, -rotateSpeed);
                rotQuat.multiply(q);
                // 滚转效果
                const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1).applyQuaternion(targetObj.quaternion), -rotateSpeed * 0.5);
                rotQuat.multiply(rollQ);
            }

            // 应用旋转
            targetObj.quaternion.premultiply(rotQuat);
            targetObj.quaternion.normalize();
        }

        // 如果在 Alt 模式，Ghost 需要跟随水滴位置移动
        if (this.state.sharpTurnMode) {
            this.ghostMesh.position.copy(this.container.position);
            
            // 绘制转弯预测轨迹
            // 简单模拟：假设以当前速度向 Ghost 的前方移动一段距离
            this.updateTrail(this.ghostMesh);
        }

        // --- 3. 位移更新 ---
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.container.quaternion);
        this.container.position.add(forward.multiplyScalar(this.speed * deltaTime));

        // --- 4. 宇宙闪烁 (Universe Flicker) ---
        if (this.state.flickerMode) {
            // sin 值在 -1 到 1，映射到 0.5 到 1.0
            // math: (sin + 1) / 2 * 0.5 + 0.5
            const val = (Math.sin(elapsedTime * 3) + 1) / 2 * 0.5 + 0.5;
            this.renderer.toneMappingExposure = val;
        }

        // --- 5. UI 更新 ---
        this.gui.update({
            speed: this.speed,
            pos: this.container.position,
            isAttackMode: this.state.attackMode,
            isSharpTurning: this.state.sharpTurnMode
        });

        // Update Target Info UI
        if (this.lockedTarget && this.lockedTarget.mesh.parent && !this.lockedTarget.isDestroyed) {
            const dist = this.container.position.distanceTo(this.lockedTarget.mesh.position);
            const eta = this.speed > 10 ? (dist / this.speed).toFixed(1) : 'N/A';
            
            if (!this.targetInfoEl) {
                this.targetInfoEl = document.createElement('div');
                this.targetInfoEl.style.position = 'absolute';
                this.targetInfoEl.style.bottom = '200px';
                this.targetInfoEl.style.left = '50%';
                this.targetInfoEl.style.transform = 'translateX(-50%)';
                this.targetInfoEl.style.color = '#ff3366';
                this.targetInfoEl.style.fontFamily = "'Orbitron', sans-serif";
                this.targetInfoEl.style.fontSize = '14px';
                this.targetInfoEl.style.textAlign = 'center';
                this.targetInfoEl.style.textShadow = '0 0 5px #ff3366';
                this.targetInfoEl.style.pointerEvents = 'none';
                document.body.appendChild(this.targetInfoEl);
            }
            this.targetInfoEl.style.display = 'block';
            this.targetInfoEl.innerHTML = `
                <div>TARGET LOCKED: ${this.lockedTarget.name}</div>
                <div style="font-size: 20px; font-weight: bold; margin: 5px 0;">${dist.toFixed(0)} KM</div>
                <div>IMPACT IN: ${eta} s</div>
            `;
        } else {
            if (this.targetInfoEl) this.targetInfoEl.style.display = 'none';
        }

        // --- 6. 光环动态效果 (呼吸 + 抖动) ---
        if (this.ringMaterials.length > 0) {
            const baseIntensity = 2.0;
            // 呼吸: 周期约 2 秒
            const pulse = Math.sin(elapsedTime * 3.0) * 0.5; 
            // 抖动: 高频随机微扰
            const jitter = (Math.random() - 0.5) * 0.5; 
            
            // 速度越快，光环越亮且抖动越剧烈
            const speedFactor = this.speed / this.maxSpeed;
            const speedBoost = speedFactor * 2.0;

            const finalIntensity = Math.max(0, baseIntensity + pulse + jitter + speedBoost);
            
            this.ringMaterials.forEach(mat => {
                mat.emissiveIntensity = finalIntensity;
            });
        }
    }

    updateTrail(ghostObj) {
        // 计算未来的一段轨迹
        const points = [];
        const simPos = ghostObj.position.clone();
        const simDir = new THREE.Vector3(0, 0, 1).applyQuaternion(ghostObj.quaternion);
        
        // 预测 10 帧
        for(let i=0; i<10; i++) {
            points.push(simPos.clone());
            simPos.add(simDir.clone().multiplyScalar(this.speed * 0.1)); // 0.1s step
        }
        this.trailLine.geometry.setFromPoints(points);
    }

    // --- 核心：高级相机控制 ---
    updateCamera(camera, controls, deltaTime) {
        // Alt 模式：视角拉远，不跟随旋转，只跟随位置
        if (this.state.sharpTurnMode) {
            controls.enabled = false; // 禁用轨道控制，手动接管

            // 目标位置：水滴上方较远处，俯视
            const offset = new THREE.Vector3(0, 20, -30).applyQuaternion(this.container.quaternion);
            const targetPos = this.container.position.clone().add(offset);
            
            camera.position.lerp(targetPos, 0.05);
            camera.lookAt(this.container.position);
            return;
        }

        // 攻击模式 (H键)：锁定视角在身后，WASD 改变方向时相机也跟着转
        if (this.state.attackMode) {
            controls.enabled = true;
            controls.target.copy(this.container.position);
            
            // --- 基于 Boost Factor 的相机距离调整 ---
            // 使用 boostFactor 而不是 speedRatio，这样松开空格就会回弹
            const targetDistance = this.cameraBaseDistance + 2.0 * this.boostFactor; // 拉远距离
            
            // 平滑过渡当前距离
            const distanceLerpSpeed = 0.1; 
            this.cameraCurrentDistance += (targetDistance - this.cameraCurrentDistance) * distanceLerpSpeed;
            
            // 理想位置：水滴正后方 (Chase Cam)
            // 水滴前进方向是 +Z，相机需要在 -Z 处
            const idealOffset = new THREE.Vector3(0, 3, -this.cameraCurrentDistance); 
            idealOffset.applyQuaternion(this.container.quaternion);
            const idealPos = this.container.position.clone().add(idealOffset);

            // 强力回弹
            const t = 0.1; 
            camera.position.lerp(idealPos, t);
            
            return;
        }

        // 默认模式 (自由视角)
        controls.enabled = true;
        controls.target.lerp(this.container.position, 0.1); 

        // Apply Gamepad Camera Input
        if (this.cameraInput && (this.cameraInput.x !== 0 || this.cameraInput.y !== 0)) {
            const rotateSpeed = 2.0 * deltaTime;
            
            // Calculate offset from target to camera
            const offset = new THREE.Vector3().copy(camera.position).sub(controls.target);
            
            // Convert to spherical
            const spherical = new THREE.Spherical().setFromVector3(offset);
            
            // Apply rotation
            // Rotate Left/Right (Azimuth) - Adjust Theta
            // In OrbitControls, rotateLeft usually subtracts from theta.
            spherical.theta -= this.cameraInput.x * rotateSpeed;
            
            // Rotate Up/Down (Polar) - Adjust Phi
            // In OrbitControls, rotateUp usually subtracts from phi.
            spherical.phi -= this.cameraInput.y * rotateSpeed;
            
            // Clamp Phi to avoid gimbal lock / flipping
            spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi));
            
            // Convert back to Cartesian
            offset.setFromSpherical(spherical);
            
            // Apply new position
            camera.position.copy(controls.target).add(offset);
        }
    }
}