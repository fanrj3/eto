import * as THREE from 'three';

// GUIManager.js
export class GUIManager {
    constructor(callbacks, soundManager) {
            // callbacks 用于当用户点击UI按钮时通知 Controller
            this.callbacks = callbacks || {};
            this.soundManager = soundManager;
            this.injectStyles();
            this.createLeftPanel();
            this.createRightPanel();
            this.createMusicPanel();
            this.createHelpModal();
    }

    playClickSound() {
        if (this.soundManager) this.soundManager.playClick();
    }

    createMusicPanel() {
        const div = document.createElement('div');
        div.className = 'sci-fi-panel';
        div.style.bottom = '150px';
        div.style.left = '50%';
        div.style.transform = 'translateX(-50%) skewX(-10deg)';
        div.style.padding = '8px 20px';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '15px';
        div.style.border = '1px solid rgba(0, 243, 255, 0.3)';
        div.style.background = 'rgba(0, 0, 0, 0.6)';
        div.style.zIndex = '1000';
        div.style.pointerEvents = 'auto';

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 5px; transform: skewX(10deg);">
                <span style="font-size: 10px; color: #888;">BGM:</span>
                <div id="music-title" style="font-size: 12px; color: #00f3ff; white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">INITIALIZING...</div>
            </div>
            <div style="display: flex; gap: 10px; transform: skewX(10deg);">
                <button id="btn-music-play" style="background:none; border:none; color:#fff; cursor:pointer; font-size:14px; padding: 0 5px;">⏸</button>
                <button id="btn-music-next" style="background:none; border:none; color:#fff; cursor:pointer; font-size:14px; padding: 0 5px;">⏭</button>
            </div>
        `;
        document.body.appendChild(div);

        this.dom.musicTitle = div.querySelector('#music-title');
        this.dom.btnMusicPlay = div.querySelector('#btn-music-play');
        this.dom.btnMusicNext = div.querySelector('#btn-music-next');

        this.dom.btnMusicPlay.onclick = () => {
            this.playClickSound();
            this.callbacks.onMusicPlay && this.callbacks.onMusicPlay();
        };
        this.dom.btnMusicNext.onclick = () => {
            this.playClickSound();
            this.callbacks.onMusicNext && this.callbacks.onMusicNext();
        };
    }

    updateMusicUI(title, isPlaying) {
        if (this.dom.musicTitle) this.dom.musicTitle.innerText = title;
        if (this.dom.btnMusicPlay) this.dom.btnMusicPlay.innerText = isPlaying ? '⏸' : '▶';
    }

    injectStyles() {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        const style = document.createElement('style');
        style.innerHTML = `
            body { user-select: none; overflow: hidden; background: #000; }
            .sci-fi-panel {
                position: absolute;
                padding: 20px;
                background: rgba(10, 20, 30, 0.6);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(0, 243, 255, 0.3);
                color: #00f3ff;
                font-family: 'Orbitron', sans-serif;
                box-shadow: 0 0 20px rgba(0, 243, 255, 0.1);
                transition: all 0.3s ease;
                pointer-events: none; /* 让鼠标事件穿透，除非是按钮 */
            }
            .panel-right { top: 20px; right: 20px; width: 280px; border-left: 4px solid #00f3ff; transform: skewX(-5deg); pointer-events: auto; }
            .panel-left { bottom: 20px; left: 20px; width: 320px; border-right: 4px solid #00f3ff; transform: skewX(5deg); pointer-events: auto; }
            
            .radar-container {
                margin-top: 15px;
                width: 100%;
                height: 150px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(0, 243, 255, 0.3);
                position: relative;
                overflow: hidden;
                pointer-events: auto; /* Ensure radar receives events */
            }
            .radar-canvas {
                width: 100%;
                height: 100%;
            }

            .hud-title { font-size: 16px; font-weight: 700; margin-bottom: 10px; border-bottom: 1px solid rgba(0, 243, 255, 0.3); padding-bottom: 5px; letter-spacing: 2px; }
            .stat-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
            .stat-value { font-weight: bold; color: #fff; text-shadow: 0 0 5px #00f3ff; }
            .bar-container { width: 100%; height: 4px; background: rgba(255,255,255,0.1); margin-top: 2px; }
            .bar-fill { height: 100%; background: #00f3ff; box-shadow: 0 0 8px #00f3ff; width: 0%; transition: width 0.1s; }
            .warning { color: #ff3366; text-shadow: 0 0 5px #ff3366; }
            
            /* 闪烁光标效果 */
            .blinking { animation: blink 1s infinite; }
            @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }

            .toggle-btn {
                width: 100%;
                padding: 8px;
                margin-bottom: 8px;
                background: rgba(0, 243, 255, 0.1);
                border: 1px solid #00f3ff;
                color: #00f3ff;
                font-family: 'Orbitron', sans-serif;
                font-size: 11px;
                cursor: pointer;
                text-transform: uppercase;
                transition: all 0.2s;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .toggle-btn:hover { background: rgba(0, 243, 255, 0.3); }
            .toggle-btn.active { 
                background: #00f3ff; 
                color: #000; 
                box-shadow: 0 0 10px #00f3ff;
            }
            .indicator {
                width: 8px; height: 8px; background: #333; border-radius: 50%;
                box-shadow: inset 0 0 2px #000;
            }
            .toggle-btn.active .indicator {
                background: #fff;
                box-shadow: 0 0 5px #fff;
            }

            /* Modal Styles */
            .modal-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex; justify-content: center; align-items: center;
                z-index: 2000;
                backdrop-filter: blur(5px);
            }
            .modal-content {
                width: 600px;
                background: rgba(10, 20, 30, 0.95);
                border: 1px solid #00f3ff;
                box-shadow: 0 0 30px rgba(0, 243, 255, 0.2);
                padding: 30px;
                color: #fff;
                font-family: 'Orbitron', sans-serif;
                position: relative;
            }
            .modal-title {
                font-size: 24px; color: #00f3ff; margin-bottom: 20px; text-align: center;
                border-bottom: 1px solid rgba(0, 243, 255, 0.3); padding-bottom: 10px;
            }
            .key-row {
                display: flex; justify-content: space-between; margin-bottom: 10px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 5px;
            }
            .key-name { color: #00f3ff; font-weight: bold; }
            .key-desc { color: #ccc; }
            .close-btn {
                display: block; width: 100%; padding: 10px; margin-top: 20px;
                background: #00f3ff; color: #000; border: none; font-weight: bold;
                cursor: pointer; font-family: 'Orbitron', sans-serif;
                transition: all 0.2s;
            }
            .close-btn:hover { background: #fff; box-shadow: 0 0 15px #00f3ff; }

            /* Plane Selection Buttons */
            .plane-btn {
                background: rgba(0, 243, 255, 0.1);
                border: 1px solid #00f3ff;
                color: #00f3ff;
                font-size: 10px;
                cursor: pointer;
                padding: 2px 5px;
                font-family: 'Orbitron', sans-serif;
            }
            .plane-btn:hover { background: rgba(0, 243, 255, 0.3); }
            .plane-btn.active { background: #00f3ff; color: #000; }

            /* Custom Scrollbar */
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: rgba(0, 20, 30, 0.5); }
            ::-webkit-scrollbar-thumb { background: #00f3ff; border-radius: 3px; box-shadow: 0 0 5px #00f3ff; }
            ::-webkit-scrollbar-thumb:hover { background: #fff; }

            /* Controller Layout */
            .controller-layout {
                display: flex; justify-content: space-between; align-items: center;
                margin-top: 20px; padding: 20px;
                border: 1px solid rgba(0, 243, 255, 0.2);
                background: rgba(0, 0, 0, 0.3);
                position: relative;
                height: 180px;
            }
            .c-group { display: flex; flex-direction: column; align-items: center; gap: 10px; }
            .c-btn { 
                width: 30px; height: 30px; border-radius: 50%; 
                border: 2px solid #555; display: flex; justify-content: center; align-items: center;
                font-size: 12px; font-weight: bold; color: #aaa;
            }
            .c-btn.y { border-color: #f1c40f; color: #f1c40f; margin-bottom: -10px; }
            .c-btn.x { border-color: #3498db; color: #3498db; margin-right: 30px; }
            .c-btn.b { border-color: #e74c3c; color: #e74c3c; margin-left: 30px; margin-top: -30px; }
            .c-btn.a { border-color: #2ecc71; color: #2ecc71; margin-top: -10px; }
            
            .c-stick {
                width: 40px; height: 40px; border-radius: 50%; border: 2px solid #00f3ff;
                background: rgba(0, 243, 255, 0.1);
                display: flex; justify-content: center; align-items: center;
                font-size: 10px; text-align: center;
            }
            .c-dpad {
                display: grid; grid-template-columns: 20px 20px 20px; grid-template-rows: 20px 20px 20px;
            }
            .d-btn { background: #333; width: 100%; height: 100%; }
            .d-up { grid-column: 2; grid-row: 1; border-radius: 3px 3px 0 0; }
            .d-left { grid-column: 1; grid-row: 2; border-radius: 3px 0 0 3px; }
            .d-right { grid-column: 3; grid-row: 2; border-radius: 0 3px 3px 0; }
            .d-down { grid-column: 2; grid-row: 3; border-radius: 0 0 3px 3px; }
            .d-center { grid-column: 2; grid-row: 2; background: #333; }
            
            .c-label { font-size: 10px; color: #00f3ff; margin-top: 5px; text-align: center; }
        `;
        document.head.appendChild(style);
    }

    createHelpModal() {
        const div = document.createElement('div');
        div.className = 'modal-overlay';
        div.id = 'help-modal';
        div.innerHTML = `
            <div class="modal-content" style="width: 700px;">
                <div class="modal-title">SYSTEM MANUAL / 操作说明</div>
                <div style="max-height: 500px; overflow-y: auto; padding-right: 10px;">
                    
                    <div style="margin-bottom: 20px;">
                        <div class="hud-title">KEYBOARD & MOUSE</div>
                        <div class="key-row"><span class="key-name">W / A / S / D</span> <span class="key-desc">Maneuver / 移动</span></div>
                        <div class="key-row"><span class="key-name">SPACE</span> <span class="key-desc">Boost / 加速</span></div>
                        <div class="key-row"><span class="key-name">P</span> <span class="key-desc">Brake / 刹车</span></div>
                        <div class="key-row"><span class="key-name">ALT (Hold)</span> <span class="key-desc">Tactical Turn / 战术急转</span></div>
                        <div class="key-row"><span class="key-name">H</span> <span class="key-desc">Attack Mode / 攻击模式</span></div>
                        <div class="key-row"><span class="key-name">J</span> <span class="key-desc">Auto Attack / 自动攻击</span></div>
                        <div class="key-row"><span class="key-name">U</span> <span class="key-desc">Universe Flicker / 宇宙闪烁</span></div>
                        <div class="key-row"><span class="key-name">T</span> <span class="key-desc">Radar Trail / 雷达轨迹</span></div>
                        <div class="key-row"><span class="key-name">O</span> <span class="key-desc">Observer Mode / 观察者模式</span></div>
                    </div>

                    <div>
                        <div class="hud-title">GAMEPAD (XBOX/PS)</div>
                        <div class="controller-layout">
                            <!-- Left Side -->
                            <div class="c-group">
                                <div style="font-size:10px; color:#ccc;">LB: Tactical Turn</div>
                                <div style="font-size:10px; color:#ccc;">LT: -</div>
                                <div class="c-stick">
                                    MOVE
                                </div>
                                <div class="c-dpad">
                                    <div class="d-btn d-up" title="Trail"></div>
                                    <div class="d-btn d-left" title="Auto Attack"></div>
                                    <div class="d-btn d-center"></div>
                                    <div class="d-btn d-right" title="Observer"></div>
                                    <div class="d-btn d-down" title="Help"></div>
                                </div>
                                <div class="c-label">D-PAD: ↑Trail ←Auto →Obs ↓Help</div>
                            </div>

                            <!-- Center -->
                            <div class="c-group" style="justify-content: center;">
                                <div style="font-size:10px; color:#ccc; margin-bottom:5px;">BACK: Observer</div>
                                <div style="font-size:10px; color:#ccc;">START: Close Help</div>
                            </div>

                            <!-- Right Side -->
                            <div class="c-group">
                                <div style="font-size:10px; color:#ccc;">RB: -</div>
                                <div style="font-size:10px; color:#ccc;">RT: -</div>
                                <div style="position: relative; width: 80px; height: 80px; display: flex; justify-content: center; align-items: center;">
                                    <div class="c-btn y" style="position: absolute; top: 0;">Y</div>
                                    <div class="c-btn x" style="position: absolute; left: 0; top: 25px;">X</div>
                                    <div class="c-btn b" style="position: absolute; right: 0; top: 25px; margin:0;">B</div>
                                    <div class="c-btn a" style="position: absolute; bottom: 0; margin:0;">A</div>
                                </div>
                                <div class="c-label">Y:Flicker X:Attack B:Brake A:Boost</div>
                                <div class="c-stick">
                                    CAM
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
                <button class="close-btn" id="close-help">INITIALIZE SYSTEM / 启动系统</button>
            </div>
        `;
        document.body.appendChild(div);
        
        this.isHelpOpen = true; // Default open

        document.getElementById('close-help').onclick = () => {
            this.playClickSound();
            this.closeHelp();
        };
    }

    openHelp() {
        document.getElementById('help-modal').style.display = 'flex';
        this.isHelpOpen = true;
    }

    closeHelp() {
        document.getElementById('help-modal').style.display = 'none';
        this.isHelpOpen = false;
    }

    createLeftPanel() {
        const div = document.createElement('div');
        div.className = 'sci-fi-panel panel-left';
        div.innerHTML = `
            <div class="hud-title">SYSTEM METRICS <span class="blinking">_</span></div>
            
            <div class="stat-row">
                <span>VELOCITY</span>
                <span id="hud-speed" class="stat-value">0 km/s</span>
            </div>
            <div class="bar-container"><div id="bar-speed" class="bar-fill" style="width: 0%"></div></div>
            <br>
            <div class="stat-row">
                <span>COORDINATES</span>
                <span id="hud-pos" class="stat-value" style="font-size: 10px">0 | 0 | 0</span>
            </div>
            <div class="stat-row">
                <span>HULL INTEGRITY</span>
                <span class="stat-value" style="color: #00ff66;">100% (STRONG INTERACTION)</span>
            </div>
            
            <div class="hud-title" style="margin-top: 15px;">TACTICAL RADAR</div>
            <div class="radar-container" style="position: relative;">
                <canvas id="radar-canvas" class="radar-canvas"></canvas>
                <div style="position: absolute; top: 5px; right: 5px; display: flex; gap: 2px;">
                    <button class="plane-btn active" data-plane="XZ" title="Top View (XZ)">XZ</button>
                    <button class="plane-btn" data-plane="XY" title="Front View (XY)">XY</button>
                    <button class="plane-btn" data-plane="YZ" title="Side View (YZ)">YZ</button>
                </div>
            </div>
            <div class="stat-row" style="margin-top:5px; font-size: 10px; color: #888;">
                <span>SECTOR: SOL SYSTEM</span>
                <span>SCALE: 1:10000</span>
            </div>

            <div class="stat-row" style="margin-top: 10px;">
                <span>MODE</span>
                <span id="hud-mode" class="stat-value" style="color: #ffaa00;">CRUISE</span>
            </div>
            
            <div style="margin-top: 15px; font-size: 10px; opacity: 0.7; line-height: 1.5;">
                <button id="btn-show-help" style="background:none; border:none; color:#00f3ff; cursor:pointer; text-decoration:underline; padding:0; font-family:inherit; font-size:inherit;">
                    SHOW MANUAL / 显示说明
                </button>
            </div>
        `;
        document.body.appendChild(div);
        
        this.dom = {
            speed: document.getElementById('hud-speed'),
            barSpeed: document.getElementById('bar-speed'),
            pos: document.getElementById('hud-pos'),
            mode: document.getElementById('hud-mode'),
            radarCanvas: document.getElementById('radar-canvas')
        };

        document.getElementById('btn-show-help').onclick = () => {
            this.playClickSound();
            this.openHelp();
        };

        const planeBtns = div.querySelectorAll('.plane-btn');
        planeBtns.forEach(btn => {
            btn.onclick = () => {
                this.playClickSound();
                planeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (this.radarState) this.radarState.plane = btn.dataset.plane;
            };
        });
        
        this.initRadar();
    }

    initRadar() {
        const canvas = this.dom.radarCanvas;
        if (!canvas) return;
        // Set canvas resolution
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        this.radarCtx = canvas.getContext('2d');
        
        // Radar State
        this.radarState = {
            scale: 0.05, // Zoom level (smaller = zoomed out)
            offsetX: 0,
            offsetY: 0,
            isDragging: false,
            lastMouseX: 0,
            lastMouseY: 0,
            hoveredShip: null,
            showTrail: false,
            trail: [], // Array of {x, z}
            plane: 'XZ' // Default plane
        };

        // Event Listeners for Interaction
        canvas.addEventListener('mousedown', (e) => {
            this.radarState.isDragging = true;
            this.radarState.lastMouseX = e.clientX;
            this.radarState.lastMouseY = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            this.radarState.isDragging = false;
        });

        canvas.addEventListener('mousemove', (e) => {
            if (this.radarState.isDragging) {
                const dx = e.clientX - this.radarState.lastMouseX;
                const dy = e.clientY - this.radarState.lastMouseY;
                this.radarState.offsetX += dx;
                this.radarState.offsetY += dy;
                this.radarState.lastMouseX = e.clientX;
                this.radarState.lastMouseY = e.clientY;
            }
            
            // Handle Hover
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.checkRadarHover(mouseX, mouseY);
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.0001;
            this.radarState.scale += e.deltaY * -zoomSpeed;
            this.radarState.scale = Math.max(0.001, Math.min(0.5, this.radarState.scale));
        });

        canvas.addEventListener('click', (e) => {
            if (this.radarState.hoveredShip && this.callbacks.onShipSelected) {
                this.callbacks.onShipSelected(this.radarState.hoveredShip);
            }
        });
    }

    projectPoint(v) {
        const plane = this.radarState.plane;
        if (plane === 'XY') return { x: v.x, y: -v.y }; // Invert Y for screen coords if needed, but canvas Y is down. World Y is up. So -v.y might be better if we want up to be up.
        // Actually, in 3D, Y is up. In 2D Canvas, Y is down.
        // For XZ: Z is "depth" (forward/back). Usually mapped to screen Y. +Z is towards camera (in Three.js +Z is out of screen, -Z is into screen).
        // Let's keep it simple.
        if (plane === 'XY') return { x: v.x, y: -v.y }; 
        if (plane === 'YZ') return { x: v.z, y: -v.y };
        return { x: v.x, y: v.z }; // XZ
    }

    checkRadarHover(mouseX, mouseY) {
        if (!this.lastFleetData) return;
        
        const w = this.radarCtx.canvas.width;
        const h = this.radarCtx.canvas.height;
        const cx = w / 2 + this.radarState.offsetX;
        const cy = h / 2 + this.radarState.offsetY;
        const scale = this.radarState.scale;

        let found = null;
        
        // Check Alive Ships
        for (const ship of this.lastFleetData.ships) {
            const p = this.projectPoint(ship.mesh.position);
            const screenX = cx + p.x * scale;
            const screenZ = cy + p.y * scale;
            
            // Simple distance check (hitbox 5px)
            const dx = mouseX - screenX;
            const dy = mouseY - screenZ;
            if (dx*dx + dy*dy < 25) {
                found = ship;
                break;
            }
        }
        
        this.radarState.hoveredShip = found;
        this.dom.radarCanvas.style.cursor = found ? 'pointer' : (this.radarState.isDragging ? 'grabbing' : 'grab');
    }


    updateRadar(fleetController, droplet) {
        if (!this.radarCtx || !fleetController) return;
        
        this.lastFleetData = fleetController; // Store for interaction
        
        const ctx = this.radarCtx;
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        
        // Center with offset
        const cx = w / 2 + this.radarState.offsetX;
        const cy = h / 2 + this.radarState.offsetY;
        const scale = this.radarState.scale;

        // Clear
        ctx.fillStyle = 'rgba(0, 20, 30, 0.9)';
        ctx.fillRect(0, 0, w, h);

        // Draw Grid (Dynamic based on scale)
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        const gridSize = 1000 * scale;
        const startX = (cx % gridSize) - gridSize;
        const startY = (cy % gridSize) - gridSize;

        for(let x = startX; x < w; x += gridSize) {
            ctx.moveTo(x, 0); ctx.lineTo(x, h);
        }
        for(let y = startY; y < h; y += gridSize) {
            ctx.moveTo(0, y); ctx.lineTo(w, y);
        }
        ctx.stroke();

        // Draw Droplet Trail
        if (this.radarState.showTrail && droplet && droplet.container) {
            const currentPos = droplet.container.position;
            const trail = this.radarState.trail;

            // Store full 3D position
            const newPoint = { x: currentPos.x, y: currentPos.y, z: currentPos.z };
            const lastPoint = trail.length > 0 ? trail[trail.length - 1] : null;

            const movedEnough = !lastPoint ||
                currentPos.distanceToSquared(
                    new THREE.Vector3(lastPoint.x, lastPoint.y, lastPoint.z)
                ) > 100;

            if (movedEnough) {
                trail.push(newPoint);
                if (trail.length > 2000) trail.shift();
            }

            // Draw Trail
            if (trail.length > 1) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                
                const startP = this.projectPoint(trail[0]);
                ctx.moveTo(cx + startP.x * scale, cy + startP.y * scale);
                
                for (let i = 1; i < trail.length; i++) {
                    const p = this.projectPoint(trail[i]);
                    ctx.lineTo(cx + p.x * scale, cy + p.y * scale);
                }
                // Connect to current
                const currP = this.projectPoint(currentPos);
                ctx.lineTo(cx + currP.x * scale, cy + currP.y * scale);
                ctx.stroke();
            }
        }

        // Draw Destroyed Ships (Red Triangles)
        fleetController.destroyedShips.forEach(shipData => {
            const p = this.projectPoint(shipData.position);
            const x = cx + p.x * scale;
            const z = cy + p.y * scale;
            
            // Blink effect
            if (Math.random() > 0.1) {
                ctx.fillStyle = '#ff3366';
                ctx.beginPath();
                ctx.moveTo(x, z - 3);
                ctx.lineTo(x - 3, z + 3);
                ctx.lineTo(x + 3, z + 3);
                ctx.fill();
            }
        });

        // Draw Alive Ships (Blue Rectangles)
        fleetController.ships.forEach(ship => {
            const p = this.projectPoint(ship.mesh.position);
            const x = cx + p.x * scale;
            const z = cy + p.y * scale;
            
            // Draw Trajectory if hovered
            if (this.radarState.hoveredShip === ship) {
                this.drawShipTrajectory(ctx, fleetController, ship, cx, cy, scale);
            }

            ctx.fillStyle = '#00f3ff';
            ctx.fillRect(x - 2, z - 2, 4, 4);
            
            // Highlight if hovered or Zoomed in
            const isHovered = this.radarState.hoveredShip === ship;
            const isZoomed = scale > 0.15;

            if (isHovered) {
                ctx.strokeStyle = '#fff';
                ctx.strokeRect(x - 4, z - 4, 8, 8);
            }

            if (isHovered || isZoomed) {
                // Calculate Speed
                let speed = 0;
                if (ship.mesh.userData.velocity) {
                    speed = ship.mesh.userData.velocity.length();
                }

                // Draw Text
                ctx.fillStyle = '#fff';
                ctx.font = isHovered ? 'bold 11px Arial' : '10px Arial';
                ctx.fillText(ship.name, x + 6, z);
                
                ctx.fillStyle = '#aaa';
                ctx.font = '9px Arial';
                ctx.fillText(speed.toFixed(1) + ' km/s', x + 6, z + 10);
            }
        });

        // Draw Droplet (Player) - White Circle
        if (droplet && droplet.container) {
            const p = this.projectPoint(droplet.container.position);
            const x = cx + p.x * scale;
            const z = cy + p.y * scale;
            
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, z, 3, 0, Math.PI*2);
            ctx.fill();
            
            // View Cone (approx) - Only makes sense in XZ plane really, but let's try to project rotation?
            // Rotation is tricky in 2D projection. Let's just draw a simple direction indicator if in XZ.
            if (this.radarState.plane === 'XZ') {
                const rot = droplet.container.rotation.y; // Yaw
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath();
                ctx.moveTo(x, z);
                ctx.lineTo(x + Math.sin(rot + 0.5) * 20, z + Math.cos(rot + 0.5) * 20);
                ctx.moveTo(x, z);
                ctx.lineTo(x + Math.sin(rot - 0.5) * 20, z + Math.cos(rot - 0.5) * 20);
                ctx.stroke();
            }

            // Droplet Label if zoomed
            if (scale > 0.15) {
                ctx.fillStyle = '#fff';
                ctx.font = '10px Arial';
                ctx.fillText("DROPLET", x + 6, z);
            }
        }

        // Draw Scale Bar
        this.drawScaleBar(ctx, w, h, scale);
    }

    drawScaleBar(ctx, w, h, scale) {
        const barWidthPx = 100;
        const worldDist = barWidthPx / scale;
        
        const x = 200;
        const y = h - 20;

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + barWidthPx, y);
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.moveTo(x + barWidthPx, y - 5);
        ctx.lineTo(x + barWidthPx, y + 5);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${worldDist.toFixed(0)} km`, x + barWidthPx / 2, y - 8);
        ctx.textAlign = 'left'; // Reset
    }

    drawShipTrajectory(ctx, fleetController, ship, cx, cy, scale) {
        // Calculate current distance along path
        let currentDist = 0;
        if (ship.state === 'maneuvering' && fleetController.maneuverStartTime) {
            const t = (Date.now() - fleetController.maneuverStartTime) / 1000;
            currentDist = 0.5 * ship.acceleration * t * t;
        }

        // Draw future path
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.lineWidth = 1;

        // Sample points
        const steps = 50;
        const stepSize = 100; // Check every 100km
        const lookAhead = 5000; // Look ahead 5000km

        let first = true;
        for (let s = currentDist; s <= currentDist + lookAhead; s += stepSize) {
            const pos = fleetController.getShipPositionAtDistance(ship, s);
            const p = this.projectPoint(pos);
            const sx = cx + p.x * scale;
            const sz = cy + p.y * scale;

            if (first) {
                ctx.moveTo(sx, sz);
                first = false;
            } else {
                ctx.lineTo(sx, sz);
            }
        }
        ctx.stroke();
    }

    createRightPanel() {
        const div = document.createElement('div');
        div.className = 'sci-fi-panel panel-right';
        div.innerHTML = `
            <div class="hud-title">CONTROLS</div>
            <div id="btn-attack" class="toggle-btn">
                <span>[H] ATTACK MODE / 攻击模式</span>
                <div class="indicator"></div>
            </div>
            <div id="btn-auto-attack" class="toggle-btn">
                <span>[J] AUTO ATTACK / 自动攻击</span>
                <div class="indicator"></div>
            </div>
            <div id="btn-flicker" class="toggle-btn">
                <span>[U] UNIVERSE FLICKER / 宇宙闪烁</span>
                <div class="indicator"></div>
            </div>
            <div id="btn-radar-trail" class="toggle-btn">
                <span>[T] RADAR TRAIL / 雷达轨迹</span>
                <div class="indicator"></div>
            </div>
            <div id="btn-observer" class="toggle-btn">
                <span>[O] OBSERVER MODE / 观察者模式</span>
                <div class="indicator"></div>
            </div>
            
            <div class="hud-title" style="margin-top: 15px;">SYSTEM STATUS</div>
            <div class="stat-row" style="color: #aaa;">
                <span>THRUSTERS</span> <span style="color:#00f3ff">ONLINE</span>
            </div>
            <div class="stat-row" style="color: #aaa;">
                <span>GUIDANCE</span> <span style="color:#00f3ff">ACTIVE</span>
            </div>
            
            <div style="margin-top: 15px; border-top: 1px solid rgba(0,243,255,0.3); padding-top: 10px;">
                <div class="stat-row" style="color: #888;"><span>[W/A/S/D]</span> <span>MANEUVER</span></div>
                <div class="stat-row" style="color: #888;"><span>[SPACE]</span> <span>BOOST</span></div>
                <div class="stat-row" style="color: #888;"><span>[ALT]</span> <span>PREDICT</span></div>
            </div>
        `;
        document.body.appendChild(div);

        // 绑定按钮事件
        div.querySelector('#btn-attack').addEventListener('click', () => {
            this.playClickSound();
            if(this.callbacks.onToggleAttack) this.callbacks.onToggleAttack();
        });
        div.querySelector('#btn-auto-attack').addEventListener('click', () => {
            this.playClickSound();
            if(this.callbacks.onToggleAutoAttack) this.callbacks.onToggleAutoAttack();
        });
        div.querySelector('#btn-flicker').addEventListener('click', () => {
            this.playClickSound();
            if(this.callbacks.onToggleFlicker) this.callbacks.onToggleFlicker();
        });
        
        this.dom.btnAttack = document.getElementById('btn-attack');
        this.dom.btnAutoAttack = document.getElementById('btn-auto-attack');
        this.dom.btnFlicker = document.getElementById('btn-flicker');
        this.dom.btnRadarTrail = document.getElementById('btn-radar-trail');
        this.dom.btnObserver = document.getElementById('btn-observer');

        // Bind click events for buttons that don't have keyboard shortcuts handled elsewhere
        // (Attack, AutoAttack, Flicker are handled via callbacks from main/droplet controller usually, 
        // but we can also bind clicks here to trigger those callbacks if we want. 
        // For now, let's just bind the new Radar Trail button locally since it's UI only)
        
        if (this.dom.btnRadarTrail) {
            this.dom.btnRadarTrail.addEventListener('click', () => {
                this.playClickSound();
                this.toggleRadarTrail();
            });
        }

        if (this.dom.btnObserver) {
            this.dom.btnObserver.addEventListener('click', () => {
                this.playClickSound();
                if (this.callbacks.onToggleObserver) this.callbacks.onToggleObserver();
            });
        }
        
        // Also listen for 'T' key
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 't') {
                this.toggleRadarTrail();
            }
        });
    }

    toggleRadarTrail() {
        this.radarState.showTrail = !this.radarState.showTrail;
        if (this.radarState.showTrail) {
            this.dom.btnRadarTrail.classList.add('active');
        } else {
            this.dom.btnRadarTrail.classList.remove('active');
            this.radarState.trail = []; // Clear trail when disabled? Or keep it? Let's keep it but not draw? 
            // User said "switch", usually implies visibility. Let's clear to save memory/clutter if turned off.
            this.radarState.trail = [];
        }
    }

    setAttackModeActive(isActive) {
        if (isActive) this.dom.btnAttack.classList.add('active');
        else this.dom.btnAttack.classList.remove('active');
    }

    setAutoAttackActive(isActive) {
        if (isActive) this.dom.btnAutoAttack.classList.add('active');
        else this.dom.btnAutoAttack.classList.remove('active');
    }

    setFlickerActive(isActive) {
        if (isActive) this.dom.btnFlicker.classList.add('active');
        else this.dom.btnFlicker.classList.remove('active');
    }

    setObserverActive(isActive) {
        if (this.dom.btnObserver) {
            if (isActive) this.dom.btnObserver.classList.add('active');
            else this.dom.btnObserver.classList.remove('active');
        }
    }

    update(data) {
        // 速度显示 (0 - 3000)
        this.dom.speed.innerText = data.speed.toFixed(0) + ' km/s';
        const speedPercent = Math.min((data.speed / 3000) * 100, 100);
        this.dom.barSpeed.style.width = speedPercent + '%';
        
        // 变色逻辑：速度越快颜色越红
        this.dom.barSpeed.style.background = speedPercent > 80 ? '#ff3366' : '#00f3ff';
        this.dom.barSpeed.style.boxShadow = `0 0 8px ${this.dom.barSpeed.style.background}`;

        this.dom.pos.innerText = `${data.pos.x.toFixed(0)} | ${data.pos.y.toFixed(0)} | ${data.pos.z.toFixed(0)}`;
        
        // 模式显示
        if (data.isSharpTurning) this.dom.mode.innerText = "TACTICAL TURN PREP";
        else if (data.isAttackMode) this.dom.mode.innerText = "ATTACK ENGAGED";
        else this.dom.mode.innerText = "CRUISE";
    }

    // Old drawRadar removed, replaced by updateRadar
    drawRadar_deprecated(playerPos) {
        // Deprecated
    }

    // 提供方法供 Controller 调用以同步 UI 按钮状态（例如按键盘时更新按钮样式）
    setAttackModeActive(isActive) {
        if(isActive) this.dom.btnAttack.classList.add('active');
        else this.dom.btnAttack.classList.remove('active');
    }

    setFlickerActive(isActive) {
        if(isActive) this.dom.btnFlicker.classList.add('active');
        else this.dom.btnFlicker.classList.remove('active');
    }
}