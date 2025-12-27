import * as THREE from 'three';

const SHIP_NAMES = [
    "汉号", "马萨达号", "侏儒号", "杨臻号", "炎帝号", "努曼西亚号", "苏世黎号", "鹤然号", "海狼号", "无限边疆号", 
    "安阳号", "维克拉玛蒂亚号", "圣保罗号", "牛顿号", "瑞典号", "刑天号", "罗德岛号", "胜利号", "魔杰号", "跨乌特莫号", 
    "亨特号", "复仇者号", "阿尔比恩号", "明治号", "大远号", "多伦多号", "肯塔基号", "飓风号", "托内尔号", "万年鲲鹏号", 
    "南极洲号", "金斯顿号", "独立日号", "德里号", "本图斯号", "哥伦比亚号", "许哲欣号", "秋雨号", "圣特立尼达号", "沙皇号", 
    "观畴号", "皮察号", "尼泰罗伊号", "辉煌号", "钢铁侠号", "虎鲸号", "华盛顿号", "泽兰号", "雪莲号", "胡志明号", 
    "洛杉矶号", "玉树号", "大力神号", "迈索尔号", "伏尔加河号", "密苏里号", "斯大林号", "蓝色骑士号", "战车号", "罗斯福号", 
    "云号", "忆澜号", "弗吉尼亚号", "大和号", "泰安号", "中国猫号", "维多利亚号", "金狮号", "八方号", "远方号", 
    "费恩曼号", "食蚊鱼号", "东方号", "德鲁蒙德号", "阿嫩巴斯肯人号", "白垩纪号", "无畏号", "伊洛魁人号", "大都会号", "西北风号", 
    "响尾蛇号", "福旭号", "前进号", "鹦鹉螺号", "笛卡尔号", "香格里拉号", "猫化崎号", "浩源号", "千里马号", "珠穆朗玛峰号", 
    "水晶公主号", "荷兰号", "雪见号", "启蒙号", "游骑兵号", "纳尔逊号", "列克星敦号", "孟买号", "北方号", "雾角号", 
    "曼德拉号", "感恩节号", "美秋雨号", "迪克斯梅德号", "委内瑞拉号", "俄亥俄号", "提康德罗加号", "北冰洋号", "维京人号", "伊丽莎白号", 
    "琳琅号", "薛定谔号", "无寒号", "瓦尔密号", "凯尔经号", "极限号", "阿利伯克号", "复仇者号", "亚当号", "格罗宁根号", 
    "海洋之子号", "可怖号", "圣地亚哥号", "质子号", "商号", "镇远号", "恒河号", "致远号", "基洛号", "东风号", 
    "萨尔塔号", "阿尔冈金人号", "神游万物号", "喜悦号", "哥伦比亚号", "爱因斯坦号", "夏号", "保护者号", "绿号", "皇家方舟号", 
    "首陀罗号", "伊津号", "莫斯科号", "哈利法克斯号", "费米号", "皇家橡树号", "暴风雨号", "大西洋号"
];

export class FleetController {
    constructor(scene, camera, onShipSelected) {
        this.scene = scene;
        this.camera = camera;
        this.onShipSelected = onShipSelected; // Callback function
        this.ships = []; // { mesh, name, velocity, state, trajectoryLine, labelEl }
        this.isAlerted = false;
        this.alertTime = 0;
        this.isCountingDown = false;
        this.countdownDuration = 0;
        this.maneuverStartTime = 0;
        
        this.destroyedShips = []; // List of destroyed ship names
        
        this.labelContainer = document.getElementById('ship-labels');
        this.selectedShip = null;
        
        // Countdown UI
        this.countdownEl = document.createElement('div');
        this.countdownEl.id = 'fleet-countdown';
        this.countdownEl.style.position = 'fixed';
        this.countdownEl.style.top = '100px';
        this.countdownEl.style.left = '50%';
        this.countdownEl.style.transform = 'translateX(-50%)';
        this.countdownEl.style.color = '#ff0000';
        this.countdownEl.style.fontSize = '32px';
        this.countdownEl.style.fontWeight = 'bold';
        this.countdownEl.style.fontFamily = "'Orbitron', sans-serif";
        this.countdownEl.style.textShadow = '0 0 10px #ff0000';
        this.countdownEl.style.display = 'none';
        this.countdownEl.style.zIndex = '1000';
        document.body.appendChild(this.countdownEl);
        
        if (!this.labelContainer) {
            this.labelContainer = document.createElement('div');
            this.labelContainer.id = 'ship-labels';
            document.body.appendChild(this.labelContainer);
        }

        // Interaction
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(-1000, -1000); // Off-screen default
        
        window.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        window.addEventListener('click', (event) => {
            // Only handle left click
            if (event.button !== 0) return;

            // Check if we are hovering over a ship or label
            const hoveredShip = this.ships.find(s => s.isHovered || s.labelHovered);
            
            if (hoveredShip) {
                if (this.selectedShip === hoveredShip) {
                    // Deselect if clicking same ship
                    this.selectedShip = null;
                } else {
                    this.selectedShip = hoveredShip;
                }
            } else {
                // Clicked on empty space? Maybe deselect?
                // Let's keep selection unless explicitly clicking another or clicking background
                // For now, if we click background, we deselect
                // But we need to be careful not to deselect when clicking UI
                // Since we don't have easy UI check, let's just say if no ship is hovered, deselect
                this.selectedShip = null;
            }

            if (this.onShipSelected) {
                this.onShipSelected(this.selectedShip);
            }
        });
        
        this.createStatusUI();
    }

    createStatusUI() {
        const container = document.createElement('div');
        container.id = 'fleet-status-panel';
        container.className = 'sci-fi-panel'; // Use shared class
        container.style.top = '20px';
        container.style.left = '20px';
        container.style.width = '280px';
        container.style.height = '30vh'; // Reduced height
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.pointerEvents = 'auto';
        container.style.borderRight = '4px solid #00f3ff'; // Match left panel style
        container.style.transform = 'skewX(5deg)'; // Match left panel skew

        // Un-skew content
        const contentWrapper = document.createElement('div');
        contentWrapper.style.transform = 'skewX(-5deg)';
        contentWrapper.style.display = 'flex';
        contentWrapper.style.flexDirection = 'column';
        contentWrapper.style.height = '100%';
        contentWrapper.style.width = '100%';
        container.appendChild(contentWrapper);

        // Header & Counter
        this.statusHeader = document.createElement('div');
        this.statusHeader.className = 'hud-title';
        this.statusHeader.style.marginBottom = '10px';
        this.statusHeader.style.flexShrink = '0';
        contentWrapper.appendChild(this.statusHeader);

        // Lists Container
        const listsContainer = document.createElement('div');
        listsContainer.style.display = 'flex';
        listsContainer.style.flexDirection = 'column';
        listsContainer.style.gap = '10px';
        listsContainer.style.flex = '1';
        listsContainer.style.minHeight = '0';
        contentWrapper.appendChild(listsContainer);

        // Alive List Section
        const aliveSection = document.createElement('div');
        aliveSection.style.display = 'flex';
        aliveSection.style.flexDirection = 'column';
        aliveSection.style.flex = '1';
        aliveSection.style.minHeight = '0';
        aliveSection.style.border = '1px solid rgba(0, 243, 255, 0.3)';
        aliveSection.style.background = 'rgba(0, 0, 0, 0.3)';
        aliveSection.style.padding = '5px';
        
        aliveSection.innerHTML = '<div style="color: #00f3ff; margin-bottom: 5px; font-weight: bold; flex-shrink: 0; font-size: 12px;">ACTIVE UNITS</div>';
        
        const aliveListContainer = document.createElement('div');
        aliveListContainer.style.overflowY = 'auto';
        aliveListContainer.style.flex = '1';
        // Custom scrollbar style
        aliveListContainer.style.scrollbarWidth = 'thin';
        aliveListContainer.style.scrollbarColor = '#00f3ff rgba(0,0,0,0.5)';
        
        this.aliveList = document.createElement('ul');
        this.aliveList.style.listStyle = 'none';
        this.aliveList.style.padding = '0';
        this.aliveList.style.margin = '0';
        
        aliveListContainer.appendChild(this.aliveList);
        aliveSection.appendChild(aliveListContainer);
        listsContainer.appendChild(aliveSection);

        // Destroyed List Section
        const destroyedSection = document.createElement('div');
        destroyedSection.style.display = 'flex';
        destroyedSection.style.flexDirection = 'column';
        destroyedSection.style.flex = '1';
        destroyedSection.style.minHeight = '0';
        destroyedSection.style.border = '1px solid rgba(255, 51, 102, 0.3)';
        destroyedSection.style.background = 'rgba(20, 0, 0, 0.3)';
        destroyedSection.style.padding = '5px';

        destroyedSection.innerHTML = '<div style="color: #ff3366; margin-bottom: 5px; font-weight: bold; flex-shrink: 0; font-size: 12px;">CASUALTIES</div>';
        
        const destroyedListContainer = document.createElement('div');
        destroyedListContainer.style.overflowY = 'auto';
        destroyedListContainer.style.flex = '1';
        destroyedListContainer.style.scrollbarWidth = 'thin';
        destroyedListContainer.style.scrollbarColor = '#ff3366 rgba(0,0,0,0.5)';

        this.destroyedList = document.createElement('ul');
        this.destroyedList.style.listStyle = 'none';
        this.destroyedList.style.padding = '0';
        this.destroyedList.style.margin = '0';
        
        destroyedListContainer.appendChild(this.destroyedList);
        destroyedSection.appendChild(destroyedListContainer);
        listsContainer.appendChild(destroyedSection);

        document.body.appendChild(container);
    }

    markShipAsDestroyed(ship) {
        if (ship.isDestroyed) return;
        
        ship.isDestroyed = true;
        
        // Move list item
        if (ship.listItemEl && this.destroyedList) {
            this.destroyedList.appendChild(ship.listItemEl);
            ship.listItemEl.style.color = '#ff3366'; // Red color for destroyed
            ship.listItemEl.style.textShadow = '0 0 5px #ff3366';
        }
        
        // Store object with position instead of just name
        this.destroyedShips.push({
            name: ship.name,
            position: ship.mesh.position.clone()
        });
        this.updateStatusCounts();
    }

    updateStatusCounts() {
        if (!this.statusHeader) return;
        const total = this.ships.length + this.destroyedShips.length;
        const alive = this.ships.length;
        this.statusHeader.innerText = `Fleet Status: ${alive}/${total} Operational`;
    }

    initShips(spacecrafts) {
        // Shuffle names
        const names = [...SHIP_NAMES].sort(() => Math.random() - 0.5);

        spacecrafts.forEach((craft, index) => {
            const name = names[index % names.length];
            
            // Create Trajectory Line (Solid, Dim Gray)
            const lineGeometry = new THREE.BufferGeometry();
            
            const highlightColor = new THREE.Color().setHSL(Math.random(), 1.0, 0.5);
            const baseColor = new THREE.Color(0x666666); // Slightly brighter dim gray

            const lineMaterial = new THREE.LineBasicMaterial({
                color: baseColor,
                opacity: 0.0, // Start invisible
                transparent: true,
                linewidth: 1
            });
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.frustumCulled = false; // Always render
            this.scene.add(line);

            // Create Label Element
            const label = document.createElement('div');
            label.className = 'ship-label';
            label.innerHTML = `<div class="name">${name}</div><div class="speed">0 km/s</div>`;
            this.labelContainer.appendChild(label);

            // Create List Item for Status Panel
            const listItem = document.createElement('li');
            listItem.innerText = name;
            listItem.style.padding = '2px 0';
            listItem.style.borderBottom = '1px solid #333';
            listItem.style.fontSize = '11px';
            this.aliveList.appendChild(listItem);

            // Generate random flight parameters
            const direction = new THREE.Vector3(
                Math.random() - 0.5, 
                Math.random() - 0.5, 
                Math.random() - 0.5
            ).normalize();

            // Random acceleration between 0.05 and 0.3 km/s^2
            const acceleration = 0.05 + Math.random() * 0.25;

            const ship = {
                mesh: craft,
                name: name,
                startPosition: craft.position.clone(),
                startRotation: craft.rotation.clone(),
                
                // Flight Parameters
                direction: direction,
                acceleration: acceleration,

                // Organic Curve Parameters (Multi-frequency sine waves)
                curveParams: {
                    // Primary wave (Large motion)
                    freq1: 0.002 + Math.random() * 0.004,
                    amp1: 50 + Math.random() * 50,
                    phase1: Math.random() * Math.PI * 2,
                    
                    // Secondary wave (Detail/Jitter)
                    freq2: 0.01 + Math.random() * 0.02,
                    amp2: 10 + Math.random() * 20,
                    phase2: Math.random() * Math.PI * 2,

                    // Tertiary wave (Slow drift)
                    freq3: 0.0005 + Math.random() * 0.001,
                    amp3: 20 + Math.random() * 40,
                    phase3: Math.random() * Math.PI * 2
                },
                
                state: 'idle',
                trajectoryLine: line,
                labelEl: label,
                listItemEl: listItem,
                
                // Interaction
                highlightColor: highlightColor,
                baseColor: baseColor,
                isHovered: false,
                labelHovered: false
            };

            // Pre-calculate initial offsets to ensure trajectory starts exactly at ship position
            const cp = ship.curveParams;
            cp.initialOffset1 = Math.sin(cp.phase1) * cp.amp1 + Math.sin(cp.phase2) * cp.amp2;
            cp.initialOffset2 = Math.cos(cp.phase1) * cp.amp1 + Math.sin(cp.phase3) * cp.amp3;

            // Label Hover Events
            label.addEventListener('mouseenter', () => { ship.labelHovered = true; });
            label.addEventListener('mouseleave', () => { ship.labelHovered = false; });

            this.ships.push(ship);
        });
        
        this.updateStatusCounts();
    }

    alertFleet() {
        if (this.isAlerted) return;
        this.isAlerted = true;
        this.isCountingDown = true;
        this.alertTime = Date.now();
        this.countdownDuration = 30 + Math.random() * 30; // 30-60 seconds
        
        this.countdownEl.style.display = 'block';
    }

    // Calculate position at a given distance 's' along the path
    getShipPositionAtDistance(ship, s) {
        const pos = ship.startPosition.clone();
        
        // Base movement along main direction
        pos.add(ship.direction.clone().multiplyScalar(s));

        // Add procedural offsets based on curve type
        // We need two perpendicular vectors to the direction
        const up = new THREE.Vector3(0, 1, 0);
        let right = new THREE.Vector3().crossVectors(ship.direction, up).normalize();
        if (right.lengthSq() < 0.01) { // direction is vertical
            right = new THREE.Vector3(1, 0, 0);
        }
        const localUp = new THREE.Vector3().crossVectors(right, ship.direction).normalize();

        const { freq1, amp1, phase1, freq2, amp2, phase2, freq3, amp3, phase3, initialOffset1, initialOffset2 } = ship.curveParams;

        // Combine multiple sine waves for organic, non-repeating motion
        // Axis 1 (Right-ish)
        let offset1 = Math.sin(s * freq1 + phase1) * amp1 + 
                       Math.sin(s * freq2 + phase2) * amp2;
        
        // Axis 2 (Up-ish) - Use different combinations
        let offset2 = Math.cos(s * freq1 + phase1) * amp1 + 
                       Math.sin(s * freq3 + phase3) * amp3;

        // Subtract initial offsets to ensure continuity from start position
        if (initialOffset1 !== undefined) offset1 -= initialOffset1;
        if (initialOffset2 !== undefined) offset2 -= initialOffset2;

        pos.add(right.multiplyScalar(offset1));
        pos.add(localUp.multiplyScalar(offset2));

        return pos;
    }

    update(delta, activeCamera = null) {
        const cam = activeCamera || this.camera;

        // Handle Countdown
        if (this.isCountingDown) {
            const now = Date.now();
            const elapsed = (now - this.alertTime) / 1000;
            const remaining = Math.max(0, this.countdownDuration - elapsed);
            
            this.countdownEl.innerText = `人类察觉攻击物是水滴还剩：${remaining.toFixed(1)} s`;
            
            if (remaining <= 0) {
                this.isCountingDown = false;
                this.maneuverStartTime = now;
                this.countdownEl.style.display = 'none';
                
                // Start maneuvering
                this.ships.forEach(ship => {
                    if (ship.state === 'idle') {
                        ship.state = 'maneuvering';
                    }
                });
            }
        }

        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4();
        projScreenMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);

        // Raycasting for hover
        this.raycaster.setFromCamera(this.mouse, cam);
        const intersects = this.raycaster.intersectObjects(this.ships.map(s => s.mesh), true);
        
        // Reset hover state for all ships (except label hover)
        this.ships.forEach(s => s.isHovered = false);
        
        if (intersects.length > 0) {
            let obj = intersects[0].object;
            const hitShip = this.ships.find(s => {
                let parent = obj;
                while(parent) {
                    if (parent === s.mesh) return true;
                    parent = parent.parent;
                }
                return false;
            });
            
            if (hitShip) hitShip.isHovered = true;
        }

        for (let i = this.ships.length - 1; i >= 0; i--) {
            const ship = this.ships[i];
            
            // Check if ship mesh is still in scene (might be exploded)
            if (!ship.mesh.parent) {
                // Clean up
                this.scene.remove(ship.trajectoryLine);
                if (ship.labelEl.parentNode) ship.labelEl.parentNode.removeChild(ship.labelEl);
                
                // If not already marked as destroyed (e.g. by collision), do it now
                if (!ship.isDestroyed) {
                    this.markShipAsDestroyed(ship);
                }
                
                // Remove from active ships array
                this.ships.splice(i, 1);
                // No need to call updateStatusCounts here as markShipAsDestroyed does it
                continue;
            }

            let currentSpeed = 0;
            let timeSinceManeuver = 0;

            if (ship.state === 'maneuvering') {
                const now = Date.now();
                timeSinceManeuver = (now - this.maneuverStartTime) / 1000; // seconds
                
                // s = 1/2 * a * t^2
                const currentDistance = 0.5 * ship.acceleration * Math.pow(timeSinceManeuver, 2);
                currentSpeed = ship.acceleration * timeSinceManeuver; // v = a * t

                // 1. Update Position
                const newPos = this.getShipPositionAtDistance(ship, currentDistance);
                ship.mesh.position.copy(newPos);

                // 2. Update Rotation (Look at slightly future position)
                const futurePos = this.getShipPositionAtDistance(ship, currentDistance + 10); // Look 10 units ahead
                ship.mesh.lookAt(futurePos);
                
                // Store velocity for explosion inheritance
                // Direction is roughly (futurePos - newPos).normalize()
                const moveDir = futurePos.clone().sub(newPos).normalize();
                ship.mesh.userData.velocity = moveDir.multiplyScalar(currentSpeed);
            } else {
                // Idle state, velocity is 0
                ship.mesh.userData.velocity = new THREE.Vector3(0, 0, 0);
            }

            // 3. Update Trajectory Line (Past + Future)
            // Only update if maneuvering, or just show static path?
            // If idle, show path from t=0
            this.updateTrajectory(ship, timeSinceManeuver);

            // 4. Update UI Label
            this.updateLabel(ship, frustum, currentSpeed, cam);

            // 5. Update Visual State (Fade)
            const isSelected = (this.selectedShip === ship);
            const isHighlighted = ship.isHovered || ship.labelHovered || isSelected;
            
            const targetColor = isHighlighted ? ship.highlightColor : ship.baseColor;
            
            // Opacity Logic:
            // If maneuvering (countdown finished), fade in to 0.1 (dim) or 1.0 (highlight)
            // If idle (countdown running or before), opacity is 0 unless highlighted
            let targetOpacity = 0.0;
            
            if (ship.state === 'maneuvering') {
                targetOpacity = isHighlighted ? 1.0 : 0.1; // Reduced base opacity to 0.1
            } else {
                // Even if idle, if highlighted, show it
                targetOpacity = isHighlighted ? 1.0 : 0.0;
            }

            ship.trajectoryLine.material.color.lerp(targetColor, delta * 10);
            ship.trajectoryLine.material.opacity += (targetOpacity - ship.trajectoryLine.material.opacity) * delta * 2; // Slower fade
            
            // Ensure depth sorting works for transparent lines
            ship.trajectoryLine.renderOrder = isHighlighted ? 999 : 0;

            // Highlight label if selected
            if (isSelected) {
                ship.labelEl.style.border = '1px solid #ff0000';
                ship.labelEl.style.backgroundColor = 'rgba(50, 0, 0, 0.8)';
            } else {
                ship.labelEl.style.border = 'none';
                ship.labelEl.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
            }
        }
    }

    updateTrajectory(ship, currentTime) {
        const points = [];
        const steps = 200; 
        const futureTime = 180; // Predict 180 seconds ahead
        const historyTime = 120; // Keep 120 seconds of history
        
        // Calculate time range
        const startTime = Math.max(0, currentTime - historyTime);
        const endTime = currentTime + futureTime;
        const duration = endTime - startTime;
        
        if (duration <= 0) return;

        for (let i = 0; i <= steps; i++) {
            const t = startTime + duration * (i / steps);
            const s = 0.5 * ship.acceleration * Math.pow(t, 2);
            const pos = this.getShipPositionAtDistance(ship, s);
            points.push(pos.x, pos.y, pos.z);
        }

        ship.trajectoryLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        ship.trajectoryLine.geometry.attributes.position.needsUpdate = true;
    }

    updateLabel(ship, frustum, speed, camera) {
        // Only show if in view
        if (frustum.containsPoint(ship.mesh.position)) {
            ship.labelEl.style.display = 'block';
            
            // Project 3D to 2D
            const pos = ship.mesh.position.clone();
            pos.y += 20; // Offset above ship
            pos.project(camera);

            const x = (pos.x * .5 + .5) * window.innerWidth;
            const y = (-(pos.y * .5) + .5) * window.innerHeight;

            ship.labelEl.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            
            // Update text
            ship.labelEl.querySelector('.speed').innerText = `${speed.toFixed(1)} km/s`;
        } else {
            ship.labelEl.style.display = 'none';
        }
    }
}