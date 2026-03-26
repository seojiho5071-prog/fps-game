import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import io from "socket.io-client";

const SERVER_URL = window.location.hostname === "localhost" ? "http://localhost:3001" : `http://${window.location.hostname}:3001`;
const socket = io(SERVER_URL);

// 🔫 무기 데미지 너프 (생존을 위해 약 15~20% 감소)
const WEAPONS = {
  // --- 근접 무기 (3번 슬롯) ---
  Knife: { name: '전술 단검', damage: 45, heavyDamage: 100, range: 2.5, fireRate: 400, heavyRate: 1000, type: 'melee', mag: Infinity },
  
  // --- 보조 무기 (2번 슬롯) ---
  Classic: { name: '클래식', damage: 20, headMult: 3, fireRate: 160, auto: false, recoilY: 0.01, recoilX: 0.005, mag: 12, reloadTime: 1500, type: 'sidearm' },
  Shorty: { name: '쇼티', damage: 90, headMult: 2, fireRate: 300, auto: false, recoilY: 0.05, recoilX: 0.02, mag: 2, reloadTime: 1800, type: 'sidearm', range: 7 },
  Frenzy: { name: '프렌지', damage: 20, headMult: 3, fireRate: 100, auto: true, recoilY: 0.02, recoilX: 0.02, mag: 13, reloadTime: 1500, type: 'sidearm' },
  Ghost: { name: '고스트', damage: 25, headMult: 3, fireRate: 150, auto: false, recoilY: 0.015, recoilX: 0.01, mag: 15, reloadTime: 1500, type: 'sidearm' },
  Sheriff: { name: '셰리프', damage: 45, headMult: 3, fireRate: 250, auto: false, recoilY: 0.04, recoilX: 0.01, mag: 6, reloadTime: 2000, type: 'sidearm' },

  // --- 주무기 (1번 슬롯) ---
  Stinger: { name: '스팅어', damage: 22, headMult: 2.5, fireRate: 55, auto: true, recoilY: 0.035, recoilX: 0.03, mag: 20, reloadTime: 2000, type: 'primary' },
  Spectre: { name: '스펙터', damage: 22, headMult: 3, fireRate: 75, auto: true, recoilY: 0.02, recoilX: 0.015, mag: 30, reloadTime: 2250, type: 'primary' },
  Bucky: { name: '버키', damage: 120, headMult: 1.5, fireRate: 800, auto: false, recoilY: 0.06, recoilX: 0.01, mag: 5, reloadTime: 2500, type: 'primary', range: 10 },
  Judge: { name: '저지', damage: 100, headMult: 1.5, fireRate: 250, auto: true, recoilY: 0.04, recoilX: 0.02, mag: 7, reloadTime: 2200, type: 'primary', range: 12 },
  Bulldog: { name: '불독', damage: 30, headMult: 3.3, fireRate: 100, auto: true, recoilY: 0.025, recoilX: 0.015, mag: 24, reloadTime: 2500, type: 'primary' },
  Guardian: { name: '가디언', damage: 55, headMult: 3, fireRate: 190, auto: false, recoilY: 0.04, recoilX: 0.01, mag: 12, reloadTime: 2500, type: 'primary' },
  Phantom: { name: '팬텀', damage: 33, headMult: 4, fireRate: 90, auto: true, recoilY: 0.02, recoilX: 0.015, mag: 30, reloadTime: 2500, type: 'primary' },
  Vandal: { name: '밴달', damage: 34, headMult: 4, fireRate: 105, auto: true, recoilY: 0.03, recoilX: 0.02, mag: 25, reloadTime: 2500, type: 'primary' },
  Marshal: { name: '마샬', damage: 85, headMult: 2, fireRate: 1200, auto: false, recoilY: 0.06, recoilX: 0.01, mag: 5, reloadTime: 2500, type: 'primary' },
  Outlaw: { name: '아웃로', damage: 120, headMult: 1.7, fireRate: 400, auto: false, recoilY: 0.08, recoilX: 0.02, mag: 2, reloadTime: 3800, type: 'primary' },
  Operator: { name: '오퍼레이터', damage: 130, headMult: 1.7, fireRate: 1500, auto: false, recoilY: 0.1, recoilX: 0.0, mag: 5, reloadTime: 3700, type: 'primary' },
  Ares: { name: '아레스', damage: 25, headMult: 2.4, fireRate: 75, auto: true, recoilY: 0.025, recoilX: 0.03, mag: 50, reloadTime: 3250, type: 'primary' },
  Odin: { name: '오딘', damage: 32, headMult: 2.5, fireRate: 60, auto: true, recoilY: 0.03, recoilX: 0.04, mag: 100, reloadTime: 5000, type: 'primary' }
};

// 🛡️ 보호구 3종 데이터
const SHIELDS = {
  Light: { name: '경형 보호구', armor: 25, color: '#00ffff' },
  Heavy: { name: '중형 보호구', armor: 50, color: '#0088ff' },
  Tactical: { name: '전술 보호구', armor: 75, color: '#aa00ff' }
};

const playSound = (fileName) => {
  const audio = new Audio(`/${fileName}.mp3`);
  audio.volume = 0.5;
  audio.play().catch(() => {}); 
};

export default function App() {
  const mountRef = useRef(null);
  
  const [inventory, setInventory] = useState({ 1: null, 2: WEAPONS.Classic, 3: WEAPONS.Knife });
  const [activeSlot, setActiveSlot] = useState(2);
  const [ammoData, setAmmoData] = useState({ 1: 0, 2: WEAPONS.Classic.mag, 3: Infinity });
  
  const [hitmarker, setHitmarker] = useState(null);
  const [hp, setHp] = useState(100);
  const [armor, setArmor] = useState(0); // 🛡️ 현재 보호구 수치
  const [maxArmor, setMaxArmor] = useState(0); // 🛡️ 장착 중인 최대 보호구 한도
  
  const [isReloading, setIsReloading] = useState(false);
  const [isNightUI, setIsNightUI] = useState(false);
  const [dashReady, setDashReady] = useState(true);
  const [grenadeReady, setGrenadeReady] = useState(true);
  const [isHealing, setIsHealing] = useState(false); 
  const [isBuyMenuOpen, setIsBuyMenuOpen] = useState(false); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [timeMode, setTimeMode] = useState('auto'); 
  const [sensitivity, setSensitivity] = useState(1.0); 
  const [zombieKills, setZombieKills] = useState(0); // 💀 좀비 처치 횟수

  const hpRef = useRef(100); 
  const armorRef = useRef(0); // 내부 로직용 쉴드 Ref
  const lastHitTimeRef = useRef(0); 
  const invRef = useRef({ 1: null, 2: WEAPONS.Classic, 3: WEAPONS.Knife });
  const slotRef = useRef(2);
  const ammoRef = useRef({ 1: 0, 2: WEAPONS.Classic.mag, 3: Infinity });
  const isReloadingRef = useRef(false);
  const isNightRef = useRef(false);
  const isBuyMenuOpenRef = useRef(isBuyMenuOpen);
  const isSettingsOpenRef = useRef(isSettingsOpen);
  const timeModeRef = useRef('auto');
  const sensitivityRef = useRef(1.0);
  const zombieKillsRef = useRef(0);

  isBuyMenuOpenRef.current = isBuyMenuOpen;
  isSettingsOpenRef.current = isSettingsOpen;
  timeModeRef.current = timeMode;
  sensitivityRef.current = sensitivity;

  const getCurrentWeapon = () => invRef.current[slotRef.current];

  const switchWeapon = (slot) => {
    if (!invRef.current[slot] || isReloadingRef.current) return;
    slotRef.current = slot;
    setActiveSlot(slot);
  };

  // 🩸 데미지 처리 함수 (보호구 우선 감소)
  const takeDamage = (amount) => {
    lastHitTimeRef.current = Date.now();
    let remainingDmg = amount;

    if (armorRef.current > 0) {
      if (armorRef.current >= remainingDmg) {
        armorRef.current -= remainingDmg;
        remainingDmg = 0;
      } else {
        remainingDmg -= armorRef.current;
        armorRef.current = 0;
      }
      setArmor(armorRef.current);
    }
    
    if (remainingDmg > 0) {
      hpRef.current -= remainingDmg;
      setHp(Math.max(0, hpRef.current));
    }
  };

  useEffect(() => {
    if (mountRef.current) mountRef.current.innerHTML = '';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 1.6;
    camera.rotation.order = 'YXZ';

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (mountRef.current) mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(10, 20, 10);
    scene.add(sunLight);

    const flashLight = new THREE.SpotLight(0xffffff, 0, 30, Math.PI / 6, 0.5, 1);
    flashLight.position.set(0, 0, 0);
    flashLight.target.position.set(0, 0, -1);
    camera.add(flashLight);
    camera.add(flashLight.target);
    scene.add(camera);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x555555 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    let zombies = [];
    const spawnZombies = (amount = 8) => {
      for(let i=0; i<amount; i++) { 
        const zGroup = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x335533 }); 
        const botBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.8), bodyMat);
        botBody.position.y = 0.7;
        botBody.userData = { isHead: false, parentZombie: zGroup };

        const headMat = new THREE.MeshStandardMaterial({ color: 0x113311 });
        const botHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), headMat);
        botHead.position.y = 1.6;
        botHead.userData = { isHead: true, parentZombie: zGroup };

        zGroup.add(botBody);
        zGroup.add(botHead);
        
        // 플레이어 주변에서 10m~30m 떨어져서 스폰
        const angle = Math.random() * Math.PI * 2;
        const radius = 10 + Math.random() * 20;
        zGroup.position.set(camera.position.x + Math.cos(angle)*radius, 0, camera.position.z + Math.sin(angle)*radius);
        
        zGroup.userData = { hp: 100, isDead: false, lastAttack: 0 };
        scene.add(zGroup);
        zombies.push(zGroup);
      }
    };

    const burnZombies = () => {
      zombies.forEach(z => {
        if(!z.userData.isDead) {
          z.children.forEach(mesh => mesh.material.color.set(0xffaa00)); 
          setTimeout(() => { scene.remove(z); }, 1000); 
        }
      });
      setTimeout(() => { zombies = []; }, 1100);
    };

    const regenInterval = setInterval(() => {
      // 💡 보호구는 자연 회복되지 않고 HP만 회복됨 (최대 100)
      if (hpRef.current > 0 && hpRef.current < 100) {
        if (Date.now() - lastHitTimeRef.current > 5000) {
          hpRef.current = Math.min(100, hpRef.current + 5);
          setHp(hpRef.current);
          setIsHealing(true);
        } else {
          setIsHealing(false);
        }
      } else {
        setIsHealing(false);
      }
    }, 1000);

    const controls = new PointerLockControls(camera, document.body);
    const keys = { w: false, a: false, s: false, d: false };
    
    let velocityY = 0;
    const gravity = 0.015;
    const jumpPower = 0.25;
    let isGrounded = true;

    let isDashing = false;
    let dashFrames = 0;
    let dashDirection = new THREE.Vector3();
    let lastDashTime = 0;
    let lastGrenadeTime = 0; 
    let isAiming = false;

    let grenades = [];
    let explosions = [];

    const onWheel = (e) => {
      if (isReloadingRef.current || isBuyMenuOpenRef.current || isSettingsOpenRef.current) return;
      let nextSlot = slotRef.current;
      if (e.deltaY > 0) nextSlot = nextSlot === 3 ? 1 : nextSlot + 1;
      else nextSlot = nextSlot === 1 ? 3 : nextSlot - 1;
      
      if (!invRef.current[nextSlot]) {
        nextSlot = e.deltaY > 0 ? (nextSlot === 3 ? 1 : nextSlot + 1) : (nextSlot === 1 ? 3 : nextSlot - 1);
      }
      switchWeapon(nextSlot);
    };

    const onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (keys.hasOwnProperty(k)) keys[k] = true;
      
      if (k === 'g') {
        setIsSettingsOpen(prev => {
          const nextState = !prev;
          if (nextState) { document.exitPointerLock(); setIsBuyMenuOpen(false); }
          else controls.lock();
          return nextState;
        });
      }

      if (k === 'b' && !isSettingsOpenRef.current) {
        setIsBuyMenuOpen(prev => {
          const nextState = !prev;
          if (nextState) document.exitPointerLock();
          else controls.lock();
          return nextState;
        });
      }

      if (!isBuyMenuOpenRef.current && !isSettingsOpenRef.current) {
        if (k === '1' && invRef.current[1]) switchWeapon(1);
        if (k === '2') switchWeapon(2);
        if (k === '3') switchWeapon(3);
        if (k === ' ' && isGrounded) { velocityY = jumpPower; isGrounded = false; }

        if (k === 'q' && !isDashing && Date.now() - lastDashTime > 3000) {
          isDashing = true; dashFrames = 10; lastDashTime = Date.now();
          setDashReady(false);
          playSound('shoot'); 
          
          const forward = new THREE.Vector3();
          camera.getWorldDirection(forward);
          forward.y = 0; forward.normalize();
          const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

          dashDirection.set(0, 0, 0);
          if (keys.w) dashDirection.add(forward);
          if (keys.s) dashDirection.sub(forward);
          if (keys.a) dashDirection.sub(right);
          if (keys.d) dashDirection.add(right);

          if (dashDirection.lengthSq() === 0) dashDirection.copy(forward);
          else dashDirection.normalize();

          setTimeout(() => setDashReady(true), 3000);
        }

        if (k === 'e' && Date.now() - lastGrenadeTime > 8000) {
          lastGrenadeTime = Date.now(); 
          setGrenadeReady(false);
          setTimeout(() => setGrenadeReady(true), 8000);
          playSound('empty'); 

          const gMesh = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }));
          gMesh.position.copy(camera.position);

          const throwDir = new THREE.Vector3();
          camera.getWorldDirection(throwDir);
          throwDir.add(new THREE.Vector3(0, 0.3, 0)).normalize(); 
          const gVelocity = throwDir.multiplyScalar(0.5); 

          scene.add(gMesh);
          grenades.push({ mesh: gMesh, velocity: gVelocity, timer: 120 }); 
        }

        if (k === 'r' && !isReloadingRef.current) {
          const wp = getCurrentWeapon();
          if (wp.type !== 'melee' && ammoRef.current[slotRef.current] < wp.mag) {
            setIsReloading(true);
            isReloadingRef.current = true;
            playSound('reload'); 
            setTimeout(() => {
              ammoRef.current[slotRef.current] = wp.mag; 
              setAmmoData({ ...ammoRef.current });
              setIsReloading(false);
              isReloadingRef.current = false;
            }, wp.reloadTime);
          }
        }
      }
    };
    
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (keys.hasOwnProperty(k)) keys[k] = false;
    };
    
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('wheel', onWheel);

    let lastShotTime = 0;
    let isFiring = false;
    let recoilAccumulator = 0;
    let shakeIntensity = 0;

    const executeAttack = (isHeavy = false) => {
      if (isReloadingRef.current || isBuyMenuOpenRef.current || isSettingsOpenRef.current) return; 

      const wp = getCurrentWeapon();
      const now = Date.now();

      if (wp.type === 'melee') {
        const attackRate = isHeavy ? wp.heavyRate : wp.fireRate;
        if (now - lastShotTime < attackRate) return;
        lastShotTime = now;
        playSound('empty'); 

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        raycaster.far = wp.range; 

        const aliveZombieParts = zombies.filter(z => !z.userData.isDead).map(z => z.children).flat();
        const intersects = raycaster.intersectObjects(aliveZombieParts);

        if (intersects.length > 0) {
          const hitPart = intersects[0].object;
          const zombieGroup = hitPart.userData.parentZombie;
          
          playSound('hit'); 
          setHitmarker('body'); 
          shakeIntensity = isHeavy ? 0.08 : 0.03; 
          
          hitPart.material.color.set(0xffffff);
          setTimeout(() => { if (hitPart.material) hitPart.material.color.set(hitPart.userData.isHead ? 0x113311 : 0x335533); }, 100);
          setTimeout(() => setHitmarker(null), 150);

          const dmg = isHeavy ? wp.heavyDamage : wp.damage;
          zombieGroup.userData.hp -= dmg;
          
          if (zombieGroup.userData.hp <= 0 && !zombieGroup.userData.isDead) {
            zombieGroup.userData.isDead = true;
            scene.remove(zombieGroup); 
            // 배열에서 제거하고 킬 카운트 상승
            zombies = zombies.filter(z => z !== zombieGroup);
            zombieKillsRef.current += 1;
            setZombieKills(zombieKillsRef.current);
          }
        }
        return;
      }

      if (ammoRef.current[slotRef.current] <= 0) { playSound('empty'); return; }
      if (now - lastShotTime < wp.fireRate) return;
      lastShotTime = now;

      ammoRef.current[slotRef.current] -= 1;
      setAmmoData({ ...ammoRef.current }); 
      playSound('shoot'); 

      recoilAccumulator = Math.min(recoilAccumulator + 1, 10);
      const recoilY = wp.recoilY + (Math.random() * 0.005);
      const isMoving = keys.w || keys.a || keys.s || keys.d || !isGrounded;
      const accuracyMod = isAiming ? 0.3 : 1; 
      const movementPenalty = isMoving ? 3 : 1; 
      
      const recoilX = (Math.random() - 0.5) * wp.recoilX * recoilAccumulator * movementPenalty * accuracyMod;
      camera.rotation.x += recoilY * movementPenalty * accuracyMod;
      camera.rotation.y += recoilX;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      if (wp.range) raycaster.far = wp.range;

      const aliveZombieParts = zombies.filter(z => !z.userData.isDead).map(z => z.children).flat();
      const intersects = raycaster.intersectObjects(aliveZombieParts);

      if (intersects.length > 0) {
        const hitPart = intersects[0].object;
        const isHeadshot = hitPart.userData.isHead;
        const zombieGroup = hitPart.userData.parentZombie;
        
        playSound(isHeadshot ? 'headshot' : 'hit'); 
        setHitmarker(isHeadshot ? 'head' : 'body');
        shakeIntensity = 0.05;
        
        hitPart.material.color.set(0xffff00);
        setTimeout(() => { if (hitPart.material) hitPart.material.color.set(isHeadshot ? 0x113311 : 0x335533); }, 100);
        setTimeout(() => setHitmarker(null), 150);

        const dmg = isHeadshot ? wp.damage * wp.headMult : wp.damage;
        zombieGroup.userData.hp -= dmg;
        if (zombieGroup.userData.hp <= 0 && !zombieGroup.userData.isDead) {
          zombieGroup.userData.isDead = true;
          scene.remove(zombieGroup); 
          zombies = zombies.filter(z => z !== zombieGroup);
          zombieKillsRef.current += 1;
          setZombieKills(zombieKillsRef.current);
        }
      }
      socket.emit("shoot", { x: camera.position.x, z: camera.position.z });
    };

    const onMouseDown = (e) => {
      if (!controls.isLocked || isBuyMenuOpenRef.current || isSettingsOpenRef.current) return;
      if (e.button === 0) { 
        isFiring = true;
        executeAttack(false);
      } else if (e.button === 2) { 
        const wp = getCurrentWeapon();
        if (wp.type === 'melee') executeAttack(true); 
        else { isAiming = true; camera.fov = 40; camera.updateProjectionMatrix(); }
      }
    };
    const onMouseUp = (e) => { 
      if (e.button === 0) isFiring = false; 
      if (e.button === 2) { isAiming = false; camera.fov = 75; camera.updateProjectionMatrix(); }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);

    let reqId;
    let timeCounter = 0; 

    const createExplosion = (pos) => {
      playSound('shoot'); 
      shakeIntensity = 0.2; 
      const expMesh = new THREE.Mesh(new THREE.SphereGeometry(4), new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 }));
      expMesh.position.copy(pos);
      scene.add(expMesh);
      explosions.push({ mesh: expMesh, frames: 15 });

      zombies.forEach(z => {
        if (z.userData.isDead) return;
        if (z.position.distanceTo(pos) < 5) {
          z.userData.hp -= 200; 
          if (z.userData.hp <= 0) { 
            z.userData.isDead = true; 
            scene.remove(z); 
            zombies = zombies.filter(zomb => zomb !== z);
            zombieKillsRef.current += 1;
            setZombieKills(zombieKillsRef.current);
          }
        }
      });

      if (camera.position.distanceTo(pos) < 5) {
        takeDamage(40); // 💣 나도 맞으면 아픔 (보호구 우선)
      }
    };

    const animate = () => {
      reqId = requestAnimationFrame(animate);

      if ('pointerSpeed' in controls) controls.pointerSpeed = sensitivityRef.current;

      if (controls.isLocked && hpRef.current > 0) {
        
        let cycle = 1; 
        if (timeModeRef.current === 'auto') {
          timeCounter += 0.002;
          cycle = Math.sin(timeCounter); 
        } else if (timeModeRef.current === 'day') {
          cycle = 1;
        } else if (timeModeRef.current === 'night') {
          cycle = -1;
        }

        const isNight = cycle < 0;
        
        scene.background.lerpColors(new THREE.Color(0x05051a), new THREE.Color(0x87ceeb), Math.max(0, cycle));
        ambientLight.intensity = Math.max(0.2, cycle * 0.6); 
        sunLight.intensity = Math.max(0, cycle * 0.8);
        flashLight.intensity = isNight ? 2.5 : 0; 
        
        if (isNight !== isNightRef.current) {
          isNightRef.current = isNight;
          setIsNightUI(isNight);
          if (isNight) spawnZombies(15); // 밤이 되면 초기 15마리 스폰
          else burnZombies(); 
        }

        // 🌙 무한 디펜스 모드 (밤일 때 좀비 숫자를 15마리로 계속 유지)
        if (isNight && zombies.filter(z => !z.userData.isDead).length < 15) {
          spawnZombies(1); // 1마리씩 부족할 때마다 채움
        }

        const wp = getCurrentWeapon();
        let baseSpeed = 0.15;
        if (wp.type === 'melee') baseSpeed = 0.23; 
        if (isAiming) baseSpeed = 0.08; 

        if (keys.w) controls.moveForward(baseSpeed);
        if (keys.s) controls.moveForward(-baseSpeed);
        if (keys.a) controls.moveRight(-baseSpeed);
        if (keys.d) controls.moveRight(baseSpeed);

        velocityY -= gravity;
        camera.position.y += velocityY;
        if (camera.position.y <= 1.6) {
          camera.position.y = 1.6;
          velocityY = 0;
          isGrounded = true;
        }

        if (isDashing) {
          camera.position.addScaledVector(dashDirection, 0.6); 
          dashFrames--;
          if (dashFrames <= 0) isDashing = false;
        }

        for (let i = grenades.length - 1; i >= 0; i--) {
          let g = grenades[i];
          g.velocity.y -= gravity; 
          g.mesh.position.add(g.velocity);
          if (g.mesh.position.y <= 0.15) {
            g.mesh.position.y = 0.15;
            g.velocity.y *= -0.5; g.velocity.x *= 0.8; g.velocity.z *= 0.8;
          }
          g.timer--;
          if (g.timer <= 0) {
            scene.remove(g.mesh);
            createExplosion(g.mesh.position);
            grenades.splice(i, 1);
          }
        }

        for (let i = explosions.length - 1; i >= 0; i--) {
          let exp = explosions[i];
          exp.mesh.scale.addScalar(0.2); 
          exp.mesh.material.opacity -= 0.06; 
          exp.frames--;
          if (exp.frames <= 0) { scene.remove(exp.mesh); explosions.splice(i, 1); }
        }

        if (isFiring && wp.auto && wp.type !== 'melee') executeAttack(false);
        if (!isFiring && wp.type !== 'melee') {
          recoilAccumulator = Math.max(0, recoilAccumulator - 0.5);
          if (camera.rotation.x > 0) camera.rotation.x -= 0.005;
        }

        if (shakeIntensity > 0) {
          camera.position.x += (Math.random() - 0.5) * shakeIntensity;
          camera.position.y += (Math.random() - 0.5) * shakeIntensity;
          shakeIntensity -= 0.01; 
        }

        camera.rotation.z = 0; 
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

        const now = Date.now();
        zombies.forEach(z => {
          if (z.userData.isDead) return;
          const targetPos = new THREE.Vector3(camera.position.x, z.position.y, camera.position.z);
          z.lookAt(targetPos);
          if (z.position.distanceTo(targetPos) > 1.5) {
            z.translateZ(0.04); 
          } else if (now - z.userData.lastAttack > 1000) {
            z.userData.lastAttack = now;
            takeDamage(15); // 🧟 좀비에게 15 데미지 입음 (보호구 우선)
            shakeIntensity = 0.1; 
            playSound('hit'); 
          }
        });
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleInitialClick = () => { 
      if(hpRef.current > 0 && !isBuyMenuOpenRef.current && !isSettingsOpenRef.current) controls.lock(); 
    };
    document.addEventListener('click', handleInitialClick);
    const blockContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', blockContextMenu);

    return () => {
      clearInterval(regenInterval); 
      cancelAnimationFrame(reqId);
      controls.disconnect();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('wheel', onWheel);
      document.removeEventListener('click', handleInitialClick);
      document.removeEventListener('contextmenu', blockContextMenu);
      if (mountRef.current) mountRef.current.innerHTML = '';
    };
  }, []); 

  const buyWeapon = (wpKey) => {
    const wp = WEAPONS[wpKey];
    const targetSlot = wp.type === 'primary' ? 1 : 2; 
    
    invRef.current[targetSlot] = wp;
    ammoRef.current[targetSlot] = wp.mag;
    setInventory({ ...invRef.current });
    setAmmoData({ ...ammoRef.current });
    switchWeapon(targetSlot); 
    setIsBuyMenuOpen(false); 
  };

  const buyShield = (shieldKey) => {
    const shield = SHIELDS[shieldKey];
    armorRef.current = shield.armor;
    setArmor(shield.armor);
    setMaxArmor(shield.armor);
    setIsBuyMenuOpen(false);
  };

  const activeWeapon = inventory[activeSlot];
  const primaryWeapons = Object.entries(WEAPONS).filter(([_, wp]) => wp.type === 'primary');
  const sidearmWeapons = Object.entries(WEAPONS).filter(([_, wp]) => wp.type === 'sidearm');

  const updateTimeMode = (mode) => { setTimeMode(mode); timeModeRef.current = mode; };
  const updateSensitivity = (val) => { setSensitivity(val); sensitivityRef.current = val; };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* 💀 좀비 킬 카운터 UI */}
      <div style={{
        position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
        color: '#ff4444', fontSize: '2rem', fontWeight: 'bold', textShadow: '2px 2px 4px black', zIndex: 20
      }}>
        💀 {zombieKills} KILLS
      </div>

      <div style={{ position: 'absolute', top: '50%', left: '50%', width: '4px', height: '4px', backgroundColor: '#00ff00', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 10 }} />

      {hitmarker && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '20px', height: '20px', transform: 'translate(-50%, -50%) rotate(45deg)', pointerEvents: 'none', zIndex: 11 }}>
          <div style={{ position: 'absolute', top: '9px', left: 0, width: '20px', height: '2px', backgroundColor: hitmarker === 'head' ? 'red' : 'white' }} />
          <div style={{ position: 'absolute', top: 0, left: '9px', width: '2px', height: '20px', backgroundColor: hitmarker === 'head' ? 'red' : 'white' }} />
        </div>
      )}

      {hp <= 0 && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(100,0,0,0.8)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <h1 style={{ fontSize: '5rem', margin: 0 }}>YOU DIED</h1>
          <p style={{ fontSize: '1.5rem' }}>{zombieKills}마리의 좀비를 죽이고 전사했습니다.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', fontSize: '1.2rem', marginTop: '20px', cursor: 'pointer' }}>다시 시작</button>
        </div>
      )}

      {isReloading && (
        <div style={{ position: 'absolute', top: '60%', left: '50%', transform: 'translate(-50%, -50%)', color: 'yellow', fontSize: '1.5rem', fontWeight: 'bold', textShadow: '2px 2px 2px black' }}>재장전 중...</div>
      )}

      <div style={{ position: 'absolute', bottom: '80px', right: '20px', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
        {[1, 2, 3].map(slot => (
          <div key={slot} style={{
            padding: '5px 15px', borderRadius: '5px', color: 'white', fontWeight: 'bold', textShadow: '1px 1px 2px black',
            backgroundColor: activeSlot === slot ? 'rgba(255, 165, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)', border: activeSlot === slot ? '2px solid orange' : '1px solid gray'
          }}>
            {slot}. {inventory[slot] ? inventory[slot].name : '[빈 슬롯]'}
          </div>
        ))}
      </div>

      <div style={{
        position: 'absolute', bottom: '20px', right: '20px', color: 'white', fontSize: '24px', fontWeight: 'bold', textShadow: '2px 2px 2px black', userSelect: 'none',
        backgroundColor: 'rgba(0,0,0,0.4)', padding: '15px', borderRadius: '10px', border: `2px solid ${isNightUI ? '#5555ff' : '#ffa500'}`
      }}>
        {activeWeapon ? activeWeapon.name : ''} | 탄약: {activeWeapon?.type === 'melee' ? '∞' : <span style={{ color: ammoData[activeSlot] <= 5 ? 'red' : 'white' }}>{ammoData[activeSlot]}</span>} {activeWeapon?.type !== 'melee' && `/ ${activeWeapon.mag}`}
      </div>

      <div style={{ position: 'absolute', bottom: '20px', left: '20px', width: '300px', backgroundColor: 'rgba(0,0,0,0.5)', border: '2px solid white', borderRadius: '5px', display: 'flex', flexDirection: 'column' }}>
        {/* 🛡️ 보호구 게이지바 (HP 위에 위치) */}
        {maxArmor > 0 && (
          <div style={{ width: '100%', height: '15px', backgroundColor: 'rgba(255,255,255,0.2)', borderBottom: '1px solid rgba(255,255,255,0.5)' }}>
            <div style={{ width: `${(armor / maxArmor) * 100}%`, height: '100%', backgroundColor: '#00ffff', transition: 'width 0.2s' }} />
          </div>
        )}
        {/* 🩸 체력 게이지바 */}
        <div style={{ width: '100%', height: '30px', position: 'relative' }}>
          <div style={{ width: `${hp}%`, height: '100%', backgroundColor: hp > 50 ? '#00ff00' : hp > 20 ? 'orange' : 'red', transition: 'width 0.2s' }} />
          <span style={{ position: 'absolute', top: '2px', left: '10px', color: 'white', fontWeight: 'bold', textShadow: '1px 1px 2px black' }}>
            HP: {hp} {armor > 0 && <span style={{ color: '#00ffff' }}>+ 🛡️{armor}</span>}
          </span>
        </div>
        {isHealing && <span style={{ position: 'absolute', top: '-25px', left: '10px', color: '#00ff00', fontWeight: 'bold', textShadow: '1px 1px 2px black', animation: 'fade 1s infinite' }}>+ 회복 중...</span>}
      </div>
      
      <div style={{ position: 'absolute', bottom: '70px', left: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ color: dashReady ? '#00ffff' : '#888888', fontWeight: 'bold', fontSize: '1.2rem', textShadow: '1px 1px 2px black' }}>[Q] 대쉬: {dashReady ? '준비 완료' : '쿨다운 중...'}</div>
        <div style={{ color: grenadeReady ? '#ff9900' : '#888888', fontWeight: 'bold', fontSize: '1.2rem', textShadow: '1px 1px 2px black' }}>[E] 수류탄: {grenadeReady ? '준비 완료' : '쿨다운 중...'}</div>
      </div>

      <div style={{ position: 'absolute', top: '20px', left: '20px', color: 'white', textShadow: '1px 1px 2px black', userSelect: 'none' }}>상점: B | 설정: G</div>

      {isBuyMenuOpen && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', color: 'white',
          display: 'flex', flexDirection: 'column', padding: '50px', zIndex: 30, overflowY: 'auto'
        }}>
          <h1 style={{ textAlign: 'center', color: '#ff4655', marginBottom: '10px' }}>무기고 및 상점 (B)</h1>

          <h2 style={{ borderBottom: '2px solid #555', paddingBottom: '10px' }}>🛡️ 보호구</h2>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '30px' }}>
            {Object.entries(SHIELDS).map(([key, shield]) => (
              <div key={key} onClick={() => buyShield(key)} style={{ padding: '15px', border: `2px solid ${shield.color}`, borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.1)', cursor: 'pointer', width: '150px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>{shield.name}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#00ffff' }}>방어력: +{shield.armor}</p>
              </div>
            ))}
          </div>

          <h2 style={{ borderBottom: '2px solid #555', paddingBottom: '10px' }}>보조 무기 (2번 슬롯)</h2>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '30px' }}>
            {sidearmWeapons.map(([key, wp]) => (
              <div key={key} onClick={() => buyWeapon(key)} style={{ padding: '15px', border: '1px solid #555', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.1)', cursor: 'pointer', width: '120px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>{wp.name}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#ccc' }}>DMG: {wp.damage}</p>
              </div>
            ))}
          </div>

          <h2 style={{ borderBottom: '2px solid #555', paddingBottom: '10px' }}>주무기 (1번 슬롯)</h2>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            {primaryWeapons.map(([key, wp]) => (
              <div key={key} onClick={() => buyWeapon(key)} style={{ padding: '15px', border: '1px solid #555', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.1)', cursor: 'pointer', width: '120px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>{wp.name}</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#ccc' }}>DMG: {wp.damage}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', color: 'white',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 40
        }}>
          <h1 style={{ color: '#00ffff', marginBottom: '40px', fontSize: '3rem' }}>게임 설정 (G)</h1>
          
          <div style={{ marginBottom: '30px', width: '400px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '15px', fontSize: '1.5rem' }}>낮/밤 환경 제어</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => updateTimeMode('auto')} style={{ flex: 1, padding: '15px', fontSize: '1.1rem', backgroundColor: timeMode === 'auto' ? 'orange' : '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>자동 (Auto)</button>
              <button onClick={() => updateTimeMode('day')} style={{ flex: 1, padding: '15px', fontSize: '1.1rem', backgroundColor: timeMode === 'day' ? 'orange' : '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>항상 낮 🌞</button>
              <button onClick={() => updateTimeMode('night')} style={{ flex: 1, padding: '15px', fontSize: '1.1rem', backgroundColor: timeMode === 'night' ? 'orange' : '#333', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>항상 밤 🌙</button>
            </div>
            <p style={{ marginTop: '10px', color: '#aaa' }}>※ '항상 밤'을 선택하면 끝없는 디펜스가 시작됩니다.</p>
          </div>

          <div style={{ marginBottom: '40px', width: '400px', textAlign: 'center' }}>
            <h3 style={{ marginBottom: '15px', fontSize: '1.5rem' }}>마우스 감도: {sensitivity.toFixed(1)}</h3>
            <input 
              type="range" min="0.1" max="3.0" step="0.1" 
              value={sensitivity} 
              onChange={(e) => updateSensitivity(parseFloat(e.target.value))} 
              style={{ width: '100%', cursor: 'pointer' }} 
            />
          </div>

          <button onClick={() => setIsSettingsOpen(false)} style={{ padding: '15px 50px', fontSize: '1.5rem', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>닫기</button>
        </div>
      )}

      <style>{`@keyframes fade { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-10px); } }`}</style>
    </div>
  );
}