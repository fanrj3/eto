// GUIManager.js
export class GUIManager {
    constructor(callbacks) {
            // callbacks 用于当用户点击UI按钮时通知 Controller
            this.callbacks = callbacks || {};
            this.injectStyles();
            this.createLeftPanel();
            this.createRightPanel();
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
            .panel-left { bottom: 20px; left: 20px; width: 320px; border-right: 4px solid #00f3ff; transform: skewX(5deg); }
            
            .radar-container {
                margin-top: 15px;
                width: 100%;
                height: 150px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(0, 243, 255, 0.3);
                position: relative;
                overflow: hidden;
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
        `;
        document.head.appendChild(style);
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
            <div class="radar-container">
                <canvas id="radar-canvas" class="radar-canvas"></canvas>
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
                [SPACE] ACCEL | [P] BRAKE<br>
                [ALT] TACTICAL TURN (HOLD)<br>
                [H] ATTACK MODE TOGGLE<br>
                [U] UNIVERSE FLICKER
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
        
        this.initRadar();
    }

    initRadar() {
        const canvas = this.dom.radarCanvas;
        if (!canvas) return;
        // Set canvas resolution
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        this.radarCtx = canvas.getContext('2d');
        
        // Fake solar system objects relative to 0,0,0
        this.radarObjects = [
            { name: 'Sun', x: 0, z: 0, size: 4, color: '#ffaa00' },
            { name: 'Earth', x: 200, z: 100, size: 2, color: '#00aaff' },
            { name: 'Jupiter', x: -300, z: 400, size: 3, color: '#ffcc99' },
            { name: 'Fleet', x: 500, z: -500, size: 2, color: '#ff0000' }
        ];
    }

    createRightPanel() {
        const div = document.createElement('div');
        div.className = 'sci-fi-panel panel-right';
        div.innerHTML = `
            <div class="hud-title">CONTROLS</div>
            <div id="btn-attack" class="toggle-btn">
                <span>[H] ATTACK MODE</span>
                <div class="indicator"></div>
            </div>
            <div id="btn-flicker" class="toggle-btn">
                <span>[U] UNIVERSE FLICKER</span>
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
            if(this.callbacks.onToggleAttack) this.callbacks.onToggleAttack();
        });
        div.querySelector('#btn-flicker').addEventListener('click', () => {
            if(this.callbacks.onToggleFlicker) this.callbacks.onToggleFlicker();
        });
        
        this.dom.btnAttack = document.getElementById('btn-attack');
        this.dom.btnFlicker = document.getElementById('btn-flicker');
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

        this.drawRadar(data.pos);
    }

    drawRadar(playerPos) {
        if (!this.radarCtx) return;
        const ctx = this.radarCtx;
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        // Clear
        ctx.fillStyle = 'rgba(0, 20, 30, 0.8)';
        ctx.fillRect(0, 0, w, h);

        // Draw Grid
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Concentric circles
        for(let r=20; r<Math.max(w,h); r+=30) {
            ctx.arc(cx, cy, r, 0, Math.PI*2);
        }
        // Crosshair
        ctx.moveTo(0, cy); ctx.lineTo(w, cy);
        ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
        ctx.stroke();

        // Scale: 1 pixel = 10 units
        const scale = 0.1;

        // Draw Objects (relative to player)
        this.radarObjects.forEach(obj => {
            // Calculate relative position
            const relX = (obj.x - playerPos.x) * scale;
            const relZ = (obj.z - playerPos.z) * scale; // Z maps to Y on 2D radar

            // Check if within bounds (roughly)
            if (Math.abs(relX) < w/2 && Math.abs(relZ) < h/2) {
                ctx.fillStyle = obj.color;
                ctx.beginPath();
                ctx.arc(cx + relX, cy + relZ, obj.size, 0, Math.PI*2);
                ctx.fill();
                
                // Label
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = '8px Arial';
                ctx.fillText(obj.name, cx + relX + 5, cy + relZ);
            }
        });

        // Draw Player (Center)
        ctx.fillStyle = '#00f3ff';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 4);
        ctx.lineTo(cx - 3, cy + 3);
        ctx.lineTo(cx + 3, cy + 3);
        ctx.fill();
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