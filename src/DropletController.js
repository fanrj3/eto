// DropletController.js
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
        scene.add(this.container);

        // --- 状态开关 ---
        this.state = {
            attackMode: false,
            flickerMode: false,
            sharpTurnMode: false, // Alt key status
        };

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

        // 绑定 GUI 回调
        this.gui.callbacks.onToggleAttack = () => this.toggleAttackMode();
        this.gui.callbacks.onToggleFlicker = () => this.toggleFlicker();
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

        // --- 2. 旋转逻辑 (基于相机视角，优化极点问题) ---
        const rotateSpeed = 2.0 * deltaTime;
        // 如果按住 Alt，控制的是 Ghost，否则控制的是 Container
        const targetObj = this.state.sharpTurnMode ? this.ghostMesh : this.container;
        
        // 获取相机四元数
        const camQuat = camera.quaternion.clone();
        
        // 构建基于相机视角的旋转轴
        // 注意：不直接使用 camera.up，因为它在极点会突变
        // 我们使用相机的 Right 轴作为 Pitch 轴，这是相对稳定的
        const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camQuat);
        
        // 对于 Yaw (左右转)，我们希望绕着“屏幕的垂直轴”转
        // 但为了避免极点突变，我们可以混合使用相机的 Up 和世界 Up，或者直接使用相机的 Up 但进行平滑处理
        // 这里采用一种更稳健的方法：构建一个临时的旋转四元数
        
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
        // 为了解决极点突变，我们不直接取 camera.up，而是取 camera 的 Y 轴方向
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

        // 自动回正 Roll (可选，增加飞行稳定性感)
        // 这里简单处理：如果没按 A/D，慢慢把 Z 轴旋转归零（相对于谁归零是个问题，暂时不加，保持自由度）

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
    }
}