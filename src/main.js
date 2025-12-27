import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

import { GUIManager } from './GUIManager.js';
import { DropletController } from './DropletController.js';
import { ExplosionController } from './ExplosionController.js';
import { FleetController } from './FleetController.js';

// --- 场景 Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000); // 远裁剪面设大点以防高速飞出可视范围
camera.position.set(0, 5, -10);

// --- Audio Setup ---
const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();

const playlist = [
    { url: '/music/S.T.A.Y.mp3', title: 'S.T.A.Y.' },
    { url: '/music/The Imperial March.mp3', title: 'The Imperial March' },
    { url: '/music/The Philadelphia Orchestra.flac', title: 'The Philadelphia Orchestra' }
];

let currentSongIndex = -1;

function playRandomSong() {
    if (playlist.length === 0) return;
    
    let newIndex;
    // Try to pick a different song
    if (playlist.length > 1) {
        do {
            newIndex = Math.floor(Math.random() * playlist.length);
        } while (newIndex === currentSongIndex);
    } else {
        newIndex = 0;
    }
    
    currentSongIndex = newIndex;
    const song = playlist[currentSongIndex];
    
    if (typeof guiManager !== 'undefined') guiManager.updateMusicUI(song.title, false);

    audioLoader.load(song.url, function(buffer) {
        if (sound.isPlaying) sound.stop();
        sound.setBuffer(buffer);
        sound.setLoop(false); 
        sound.setVolume(0.5);
        sound.play();
        if (typeof guiManager !== 'undefined') guiManager.updateMusicUI(song.title, true);
        
        sound.onEnded = function() {
            playRandomSong();
        };
    });
}

function toggleMusic() {
    if (sound.isPlaying) {
        sound.pause();
        if (typeof guiManager !== 'undefined') guiManager.updateMusicUI(playlist[currentSongIndex].title, false);
    } else {
        if (sound.buffer) {
            sound.play();
            if (typeof guiManager !== 'undefined') guiManager.updateMusicUI(playlist[currentSongIndex].title, true);
        } else {
            playRandomSong();
        }
    }
}

// Resume audio context on user interaction
window.addEventListener('click', () => {
    if (listener.context.state === 'suspended') {
        listener.context.resume();
    }
    if (!sound.isPlaying && !sound.buffer) {
        playRandomSong();
    }
});

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio); // 适配高分屏
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; 
renderer.toneMappingExposure = 1.0; 
document.body.appendChild(renderer.domElement);

// --- Post Processing (Selective Bloom) ---
const BLOOM_SCENE = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);

const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
const materials = {};

const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio()), 1.5, 0.4, 0.85);
bloomPass.threshold = 0;
bloomPass.strength = 0.5; 
bloomPass.radius = 0;

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

const mixPass = new ShaderPass(
    new THREE.ShaderMaterial({
        uniforms: {
            baseTexture: { value: null },
            bloomTexture: { value: bloomComposer.renderTarget2.texture }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,
        fragmentShader: `
            uniform sampler2D baseTexture;
            uniform sampler2D bloomTexture;
            varying vec2 vUv;
            void main() {
                gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );
            }
        `,
        defines: {}
    }), 'baseTexture'
);
mixPass.needsSwap = true;

const outputPass = new OutputPass();

const smaaPass = new SMAAPass(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());

// --- 配置 MSAA RenderTarget ---
// 为了解决水滴边缘锯齿和远景飞船闪烁，我们需要启用多重采样 (MSAA)
// EffectComposer 默认会禁用 Canvas 的 MSAA，所以我们需要手动创建一个支持 MSAA 的 RenderTarget
const renderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth * renderer.getPixelRatio(),
    window.innerHeight * renderer.getPixelRatio(),
    {
        type: THREE.HalfFloatType, // 使用半浮点纹理以支持 HDR
        format: THREE.RGBAFormat,
        samples: 8 // 开启 8x MSAA，这是消除几何边缘锯齿的关键
    }
);

const finalComposer = new EffectComposer(renderer, renderTarget);
finalComposer.addPass(renderScene);
finalComposer.addPass(mixPass);
finalComposer.addPass(outputPass);
finalComposer.addPass(smaaPass);

// --- 纹理优化函数 ---
// 解决远景贴图闪烁问题
function optimizeModelTextures(object) {
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    object.traverse((child) => {
        if (child.isMesh) {
            if (child.material.map) child.material.map.anisotropy = maxAnisotropy;
            if (child.material.emissiveMap) child.material.emissiveMap.anisotropy = maxAnisotropy;
            if (child.material.roughnessMap) child.material.roughnessMap.anisotropy = maxAnisotropy;
            if (child.material.metalnessMap) child.material.metalnessMap.anisotropy = maxAnisotropy;
            if (child.material.normalMap) child.material.normalMap.anisotropy = maxAnisotropy;
        }
    });
}

function darkenNonBloomed(obj) {
    if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
        materials[obj.uuid] = obj.material;
        obj.material = darkMaterial;
    }
}

function restoreMaterial(obj) {
    if (materials[obj.uuid]) {
        obj.material = materials[obj.uuid];
        delete materials[obj.uuid];
    }
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false; 
controls.minDistance = 3;
controls.maxDistance = 100;
// 限制极角，防止相机翻转导致的控制突变
controls.minPolarAngle = 0.1; 
controls.maxPolarAngle = Math.PI - 0.1;

// --- Loading Manager & Stats ---
const loadingManager = new THREE.LoadingManager();
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.querySelector('.loading-progress');
const loadSpeedEl = document.getElementById('load-speed');
const loadTotalEl = document.getElementById('load-total');

// Custom Progress Tracking
const progressMap = new Map(); // url -> { loaded, total }
let lastTime = performance.now();
let lastLoadedBytes = 0;

function onUrlProgress(url, xhr) {
    if (xhr.lengthComputable) {
        progressMap.set(url, { loaded: xhr.loaded, total: xhr.total });
        updateLoadingStats();
    }
}

function updateLoadingStats() {
    let totalLoaded = 0;
    progressMap.forEach(val => totalLoaded += val.loaded);

    // Update Total Size Display
    if (loadTotalEl) {
        loadTotalEl.innerText = (totalLoaded / (1024 * 1024)).toFixed(2) + ' MB';
    }

    // Update Speed
    const now = performance.now();
    const timeDiff = (now - lastTime) / 1000; // seconds
    if (timeDiff > 0.2) { // Update every 200ms
        const bytesDiff = totalLoaded - lastLoadedBytes;
        const speed = bytesDiff / timeDiff; // bytes/s
        
        if (loadSpeedEl) {
            if (speed > 1024 * 1024) {
                loadSpeedEl.innerText = (speed / (1024 * 1024)).toFixed(2) + ' MB/s';
            } else {
                loadSpeedEl.innerText = (speed / 1024).toFixed(2) + ' KB/s';
            }
        }

        lastTime = now;
        lastLoadedBytes = totalLoaded;
    }
}

loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
    const progress = Math.floor((itemsLoaded / itemsTotal) * 100);
    if (loadingProgress) loadingProgress.innerText = progress + '%';
};

loadingManager.onLoad = function () {
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            // Try to play music
            if (sound.buffer && !sound.isPlaying) {
                sound.play();
            } else if (!sound.buffer) {
                playRandomSong();
            }
        }, 500);
    }
};

// --- 灯光 ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 降低环境光
scene.add(ambientLight);

// 移除平行光，添加中心点光源 (小太阳)
const sunLight = new THREE.PointLight(0xffffff, 20000, 0, 1.5); // 强度加大，衰减距离无限
scene.add(sunLight);

// 添加太阳本体 (发光球体)
const sunGeo = new THREE.SphereGeometry(5, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
// 让太阳发光 (Bloom)
sunMesh.layers.enable(1); 
scene.add(sunMesh);

new EXRLoader(loadingManager).load('/hdr/NightSkyHDRI008_8K_HDR.exr', function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
}, (xhr) => onUrlProgress('/hdr/NightSkyHDRI008_8K_HDR.exr', xhr));

// --- 加载城市模型 ---
let cityModel = null;
const gltfLoader = new GLTFLoader(loadingManager);
gltfLoader.load('/model/ZhuhaiFinal_7.glb', function (gltf) {
    const rawModel = gltf.scene;
    
    // 1. 计算包围盒中心 (在未缩放、未旋转的状态下)
    const box = new THREE.Box3().setFromObject(rawModel);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // 2. 修正模型位置，使其几何中心位于 (0,0,0)
    rawModel.position.sub(center);

    // 3. 创建父级容器 (Pivot)
    const wrapper = new THREE.Group();
    wrapper.add(rawModel);

    // 4. 对容器进行变换 (位置、旋转、缩放)
    wrapper.position.set(10, 10, 10); 
    wrapper.scale.set(10, 10, 10); 
    wrapper.rotation.x = Math.PI / 2; // 旋转90度

    // 5. 解决双面渲染
    rawModel.traverse((child) => {
        if (child.isMesh) {
            child.material.side = THREE.DoubleSide;
        }
    });
    
    // 优化纹理
    optimizeModelTextures(wrapper);

    scene.add(wrapper);
    cityModel = wrapper; // 赋值给全局变量，供 animate 使用

    // 6. 太阳放在容器中心
    sunLight.position.copy(wrapper.position);
    sunMesh.position.copy(wrapper.position);

    // --- 加载光环模型 ---
    gltfLoader.load('/model/ZhuhaiFinal_guanghuan.glb', function (gltfRing) {
        const ringModel = gltfRing.scene;
        
        // 同样的修正位置
        ringModel.position.sub(center); // 使用和城市模型一样的 center

        const ringWrapper = new THREE.Group();
        ringWrapper.add(ringModel);

        // 同样的变换
        ringWrapper.position.copy(wrapper.position);
        ringWrapper.scale.copy(wrapper.scale);
        ringWrapper.rotation.copy(wrapper.rotation);

        // 设置自发光
        ringModel.traverse((child) => {
            if (child.isMesh) {
                // 启用 Bloom
                child.layers.enable(1);
                
                if (child.material) {
                    child.material.emissive = new THREE.Color(0x00f3ff); // 青色光
                    child.material.emissiveIntensity = 5.0; // 强度大一些
                    child.material.transparent = true;
                    child.material.opacity = 0.8;
                }
            }
        });

        scene.add(ringWrapper);
        // 让光环跟着城市转 (如果城市转的话)
        // 简单起见，把 ringWrapper 加到 cityModel (wrapper) 里？
        // 不行，wrapper 已经旋转过了。
        // 我们可以把 ringWrapper 加到 scene，然后在 animate 里同步旋转
        // 或者直接加到 wrapper 里，但是要注意 ringWrapper 自身的变换
        // 最简单：把 ringModel 加到 wrapper 里！
        // wrapper.add(ringModel); -> 这样 ringModel 会继承 wrapper 的变换，所以 ringModel 不需要再缩放旋转了，只需要位移修正
        
        // Re-do:
        // ringModel.position.sub(center);
        // wrapper.add(ringModel);
        // 但是上面已经创建了 ringWrapper 并设置了变换，如果直接加到 scene，需要同步动画
        // 让我们采用 "加到 wrapper" 的方案，这样最稳
        
        // Reset ringWrapper transforms because it will inherit from wrapper
        // ringModel is already centered relative to (0,0,0) by .sub(center)
        // So just adding it to wrapper should work perfectly.
        
        wrapper.add(ringModel);
    });
});

// --- 加载飞船模型 ---
const spacecrafts = []; // 存储所有飞船对象
gltfLoader.load('/model/spacecraft.glb', function (gltf) {
    const rawModel = gltf.scene;

    // 1. 计算包围盒并居中
    const box = new THREE.Box3().setFromObject(rawModel);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    // 计算碰撞半径 (取最大维度的 0.6 倍，确保容易撞到)
    const radius = Math.max(size.x, size.y, size.z) * 0.6;

    // 修正模型位置，使其几何中心位于 (0,0,0)
    rawModel.position.sub(center);
    
    // 创建 Wrapper 作为新的 baseSpacecraft
    const baseSpacecraft = new THREE.Group();
    baseSpacecraft.add(rawModel);
    
    // 优化基础模型的纹理，克隆后会自动继承
    optimizeModelTextures(baseSpacecraft);
    
    const rows = 10;
    const cols = 10;
    const wholePosX = 0;
    const wholePosY = 0;
    const wholePosZ = 1500;
    const spacing = 150; // 间距

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const spacecraft = baseSpacecraft.clone();
            
            // 排列成 10x10 矩阵，居中放置
            const x = (i - (rows - 1) / 2) * spacing + wholePosX; // x上分布
            const y = 20 + (j - (cols - 1) / 2) * spacing + wholePosY; // y上分布
            const z = 0 + wholePosZ; // z上不分布

            spacecraft.position.set(x, y, z);
            spacecraft.rotation.z = Math.PI; // roll 180度
            spacecraft.scale.set(1, 1, 1); 
            
            // 存储半径到 userData
            spacecraft.userData.radius = radius;

            // 添加到场景和数组
            scene.add(spacecraft);
            spacecrafts.push(spacecraft);
        }
    }
    
    // Initialize Fleet Controller after ships are created
    fleetController.initShips(spacecrafts);
});

// --- 初始化系统 ---
const guiManager = new GUIManager(); 

// Bind Music Callbacks
guiManager.callbacks.onMusicPlay = toggleMusic;
guiManager.callbacks.onMusicNext = playRandomSong;
// Start music if not already playing (will be triggered by click anyway, but let's try)
// playRandomSong(); // Better wait for user interaction or loading finish

const droplet = new DropletController(scene, renderer, guiManager, loadingManager);
const explosionController = new ExplosionController(scene);
const fleetController = new FleetController(scene, camera, (targetShip) => {
    if (targetShip) {
        droplet.lockTarget(targetShip);
    } else {
        droplet.lockTarget(null);
    }
});

// Auto Attack Logic
let isAutoAttack = false;
guiManager.callbacks.onToggleAutoAttack = () => {
    isAutoAttack = !isAutoAttack;
    guiManager.setAutoAttackActive(isAutoAttack);
    if (!isAutoAttack) {
        droplet.lockTarget(null);
    }
};

// --- Observer Mode Setup ---
const fixedCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
fixedCamera.position.set(0, 0, 3000);
fixedCamera.lookAt(0, 0, 0);

let isObserverMode = false;

function toggleObserverMode() {
    isObserverMode = !isObserverMode;
    if (typeof guiManager !== 'undefined') guiManager.setObserverActive(isObserverMode);
    
    if (isObserverMode) {
        // Enter Observer Mode: Fix Camera & Enable Auto-Pilot
        fixedCamera.position.set(0, 0, 3000);
        fixedCamera.lookAt(0, 0, 0);
        
        // Force Auto Attack ON
        if (!isAutoAttack) {
            isAutoAttack = true;
            if (typeof guiManager !== 'undefined') guiManager.setAutoAttackActive(true);
        }
    } else {
        // Exit Observer Mode: Restore Control
        // Turn off Auto Attack
        if (isAutoAttack) {
            isAutoAttack = false;
            if (typeof guiManager !== 'undefined') guiManager.setAutoAttackActive(false);
            if (droplet) droplet.lockTarget(null);
        }
    }
}

guiManager.callbacks.onToggleObserver = toggleObserverMode;

// --- 循环 ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Auto Attack Update
    if (isAutoAttack && droplet.container) {
        // If no target or target is dead (mesh removed from scene OR marked destroyed)
        if (!droplet.lockedTarget || !droplet.lockedTarget.mesh.parent || droplet.lockedTarget.isDestroyed) {
            // Find nearest alive ship
            let nearestDist = Infinity;
            let nearestShip = null;
            const dropletPos = droplet.container.position;

            fleetController.ships.forEach(ship => {
                if (ship.mesh.parent && !ship.isDestroyed) { // Is alive and not marked destroyed
                    const dist = dropletPos.distanceTo(ship.mesh.position);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestShip = ship;
                    }
                }
            });

            if (nearestShip) {
                droplet.lockTarget(nearestShip);
            } else {
                // No ships left
                isAutoAttack = false;
                guiManager.setAutoAttackActive(false);
                droplet.lockTarget(null);
            }
        }
    }

    // 更新逻辑
    if (cityModel) {
        cityModel.rotation.y += 0.0218483459143118 * delta;
    }
    droplet.update(delta, elapsed, camera);
    explosionController.update(delta);
    
    // Pass the active camera to FleetController so labels and raycasting work correctly
    const activeCamera = isObserverMode ? fixedCamera : camera;
    fleetController.update(delta, activeCamera);

    // 碰撞检测
    if (droplet.container && spacecrafts.length > 0) {
        const dropletPos = droplet.container.position;
        
        for (let i = spacecrafts.length - 1; i >= 0; i--) {
            const craft = spacecrafts[i];
            // 使用计算出的半径，如果没有则默认 20
            const threshold = craft.userData.radius || 20;
            
            if (dropletPos.distanceTo(craft.position) < threshold) {
                // 发生碰撞
                // Calculate impact point (approximate)
                const impactPoint = craft.position.clone().sub(dropletPos).normalize().multiplyScalar(threshold).add(dropletPos);
                
                explosionController.triggerExplosion(craft, impactPoint);
                
                // Alert the fleet!
                fleetController.alertFleet();
                
                // Mark as destroyed immediately
                // Find the ship object in fleetController
                const shipObj = fleetController.ships.find(s => s.mesh === craft);
                if (shipObj) {
                    fleetController.markShipAsDestroyed(shipObj);
                }

                // Unlock target if we hit the locked one (or just unlock anyway)
                droplet.lockTarget(null);

                // Remove from collision list immediately so we don't hit it again
                spacecrafts.splice(i, 1);
            }
        }
    }
    
    // 更新相机 (传入 camera 和 controls 以便内部操纵)
    droplet.updateCamera(camera, controls, delta);

    // Update HUD
    if (droplet && droplet.container) {
        const pos = droplet.container.position;
        const rot = droplet.container.rotation;
        
        guiManager.updateRadar(fleetController, droplet);

        const posXEl = document.getElementById('pos-x');
        const posYEl = document.getElementById('pos-y');
        const posZEl = document.getElementById('pos-z');
        
        // Compass Elements
        const compassDisc = document.getElementById('compass-disc');
        const rotYawValueEl = document.getElementById('rot-yaw-value');

        if (posXEl) posXEl.innerText = pos.x.toFixed(1);
        if (posYEl) posYEl.innerText = pos.y.toFixed(1);
        if (posZEl) posZEl.innerText = pos.z.toFixed(1);
        
        if (compassDisc) {
            let yawDeg = THREE.MathUtils.radToDeg(rot.y) % 360;
            if (yawDeg < 0) yawDeg += 360;
            
            // 旋转罗盘盘面，方向与 Yaw 相反，使得“北”总是指向世界北
            compassDisc.style.transform = `rotate(${-yawDeg}deg)`;
            
            if (rotYawValueEl) {
                rotYawValueEl.innerText = yawDeg.toFixed(0) + '°';
            }
        }

        // Speed HUD
        const speed = droplet.speed; 
        const maxSpeed = droplet.maxSpeed;
        const speedFillEl = document.getElementById('speed-fill');
        const speedKmEl = document.getElementById('speed-km');
        const speedLightEl = document.getElementById('speed-light');

        if (speedFillEl) {
            const pct = Math.min((speed / maxSpeed) * 100, 100);
            speedFillEl.style.width = pct + '%';
        }
        
        if (speedKmEl) {
            speedKmEl.innerText = speed.toFixed(0) + ' KM/S';
        }
        
        if (speedLightEl) {
            // c ≈ 300,000 km/s
            const cPct = (speed / 300000) * 100;
            speedLightEl.innerText = cPct.toFixed(2) + '% C';
        }
    }

    controls.update();
    
    // 1. Render Bloom
    scene.traverse(darkenNonBloomed);
    const originalBackground = scene.background; // 保存背景
    scene.background = null; // 移除背景，确保 Bloom 只作用于物体
    
    // Update camera for render pass
    renderScene.camera = isObserverMode ? fixedCamera : camera;
    
    bloomComposer.render();
    scene.background = originalBackground; // 恢复背景
    scene.traverse(restoreMaterial);

    // 2. Render Final
    // renderScene.camera is already set above
    finalComposer.render();

    // 3. PIP Render (Observer Mode Only)
    if (isObserverMode) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const pipWidth = 320;
        const pipHeight = 180;
        const padding = 20;
        
        // Bottom Right
        const left = width - pipWidth - padding;
        const bottom = padding;
        
        renderer.setScissorTest(true);
        renderer.setScissor(left, bottom, pipWidth, pipHeight);
        renderer.setViewport(left, bottom, pipWidth, pipHeight);
        
        renderer.clearDepth(); // Clear depth buffer so PIP draws on top
        
        // Draw Border (Optional)
        // const border = 2;
        // renderer.setScissor(left - border, bottom - border, pipWidth + border*2, pipHeight + border*2);
        // renderer.setClearColor(0x00f3ff);
        // renderer.clear(true, false, false);
        // renderer.setScissor(left, bottom, pipWidth, pipHeight);
        
        renderer.render(scene, camera); // Render with Chase Camera
        
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, width, height);
    }
}
animate();

window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    fixedCamera.aspect = width / height;
    fixedCamera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // 更新 RenderTarget 尺寸
    finalComposer.renderTarget1.setSize(width * window.devicePixelRatio, height * window.devicePixelRatio);
    finalComposer.renderTarget2.setSize(width * window.devicePixelRatio, height * window.devicePixelRatio);
    
    bloomComposer.setSize(width, height);
    finalComposer.setSize(width, height);
    
    // 更新 Bloom Pass 分辨率
    bloomPass.resolution.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio());
});