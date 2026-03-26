import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";
import { io } from "socket.io-client";

// 🌐 ⭐️ (가장 중요) 서동필님의 진짜 Render 서버 주소 연결 완료!
const SERVER_URL = "https://fps-game-f6x1.onrender.com"; 

const socket = io(SERVER_URL);

function App() {
  const mountRef = useRef(null);

  // 🕹️ 게임 상태 관리 (React State)
  const [isPlaying, setIsPlaying] = useState(false); // 게임 플레이 중?
  const [activeMenu, setActiveMenu] = useState(null); // 현재 켜진 메뉴 ('settings', 'mode', null)
  
  // ⚙️ 설정 값 저장 (감도, 소리)
  const [sensitivity, setSensitivity] = useState(0.5); // 마우스 감도 (0.1 ~ 1.0)
  const [volume, setVolume] = useState(0.7); // 소리 크기 (0.0 ~ 1.0)
  
  // 🎮 게임 모드 저장
  const [gameMode, setGameMode] = useState("zombie"); // ('1v1', 'zombie', 'survival')

  // THREE.js 객체 저장을 위한 Ref
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());

  // 플레이어 및 멀티플레이어 상태
  const playerRef = useRef({ x: 0, z: 0, hp: 100, score: 0 });
  const [players, setPlayers] = useState({});
  const keys = useRef({});

  // 🚀 키보드 입력 및 메뉴 토글 처리
  useEffect(() => {
    const handleKeyDown = (e) => {
      keys.current[e.key.toLowerCase()] = true;

      // Esc 키로 포인터 락 풀렸을 때 처리
      if (e.key === "Escape") {
        setIsPlaying(false);
        setActiveMenu(null);
      }

      // ⚙️ G키: 설정 메뉴 토글
      if (e.key.toLowerCase() === "g") {
        if (activeMenu === "settings") {
          setActiveMenu(null);
          if (controlsRef.current) controlsRef.current.lock();
        } else {
          setActiveMenu("settings");
          if (controlsRef.current) controlsRef.current.unlock();
          setIsPlaying(false);
        }
      }

      // 🎮 M키: 모드 변경 메뉴 토글
      if (e.key.toLowerCase() === "m") {
        if (activeMenu === "mode") {
          setActiveMenu(null);
          if (controlsRef.current) controlsRef.current.lock();
        } else {
          setActiveMenu("mode");
          if (controlsRef.current) controlsRef.current.unlock();
          setIsPlaying(false);
        }
      }
    };

    const handleKeyUp = (e) => {
      keys.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [activeMenu]);

  // 🎮 THREE.js 초기화 및 게임 루프
  useEffect(() => {
    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = 2; // 눈높이
    cameraRef.current = camera;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Lighting & Floor (맵)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // 4. Controls (PointerLock)
    const controls = new PointerLockControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // 5.멀티플레이어 (다른 플레이어) 표현을 위한 그룹
    const otherPlayersGroup = new THREE.Group();
    scene.add(otherPlayersGroup);

    // 🚀 게임 루프 (애니메이션)
    const animate = () => {
      requestAnimationFrame(animate);

      if (controls.isLocked === true) {
        // 플레이어 이동 로직 (W, A, S, D)
        const moveSpeed = 0.1;
        if (keys.current['w']) controls.moveForward(moveSpeed);
        if (keys.current['s']) controls.moveForward(-moveSpeed);
        if (keys.current['a']) controls.moveRight(-moveSpeed);
        if (keys.current['d']) controls.moveRight(moveSpeed);

        // 현재 내 위치를 서버로 전송
        socket.emit("move", {
          x: camera.position.x,
          z: camera.position.z,
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    // 🌐 서버에서 다른 플레이어 정보 업데이트 수신
    socket.on("state", (serverPlayers) => {
      // 내 정보 제외한 다른 플레이어만 렌더링
      otherPlayersGroup.clear();
      for (const id in serverPlayers) {
        if (id !== socket.id) {
          const p = serverPlayers[id];
          const geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
          const material = new THREE.MeshStandardMaterial({ color: 0xff4444 });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(p.x, 1, p.z);
          otherPlayersGroup.add(mesh);
        }
      }
    });

    // 화면 리사이즈 처리
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      mountRef.current.removeChild(renderer.domElement);
    };
  }, []);

  // ⚙️ 설정 값 변경 시 PointerLock 감도 조절
  useEffect(() => {
    if (controlsRef.current) {
      // 기본값 1.0에 서동필님의 감도를 곱해서 조절
      controlsRef.current.pointerSpeed = 1.0 * sensitivity;
    }
  }, [sensitivity]);

  // 게임 시작 버튼 클릭
  const startGame = () => {
    if (controlsRef.current) {
      controlsRef.current.lock();
      setIsPlaying(true);
      setActiveMenu(null);
    }
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* 🎮 THREE.js 게임 화면 마운트 */}
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* 🎯 에임 (Crosshair) - 게임 중일 때만 표시 */}
      {isPlaying && !activeMenu && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          width: "10px", height: "10px",
          backgroundColor: "red", borderRadius: "50%",
          transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 1
        }} />
      }

      {/* 🚀 시작 화면 (Overlay) */}
      {!isPlaying && !activeMenu && (
        <div style={overlayStyle}>
          <h1 style={{ fontSize: "60px", color: "red", textShadow: "2px 2px 5px black" }}>ZOMBIE SURVIVAL FPS</h1>
          <p style={{ color: "white", fontSize: "18px" }}>
            [WASD] 이동 / [Mouse] 조준 / [Click] 사격<br />
            <strong>[G]</strong> 설정 / <strong>[M]</strong> 모드 변경
          </p>
          <button onClick={startGame} style={buttonStyle}>게임 시작 (Click)</button>
        </div>
      }

      {/* ⚙️ G키: 설정 메뉴 (Settings Menu) */}
      {activeMenu === "settings" && (
        <div style={overlayStyle}>
          <h2 style={{ fontSize: "40px", color: "yellow" }}>⚙️ 설정 (SETTINGS)</h2>
          <div style={settingItemStyle}>
            <label>🖱️ 마우스 감도 (Sensitivity)</label>
            <input 
              type="range" min="0.1" max="1.0" step="0.05" 
              value={sensitivity} 
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              style={rangeStyle}
            />
            <span style={{color: 'white'}}>{sensitivity.toFixed(2)}</span>
          </div>
          <div style={settingItemStyle}>
            <label>🔊 소리 크기 (Volume)</label>
            <input 
              type="range" min="0.0" max="1.0" step="0.1" 
              value={volume} 
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={rangeStyle}
            />
            <span style={{color: 'white'}}>{(volume * 100).toFixed(0)}%</span>
          </div>
          <p style={{ color: "#aaa" }}>[G] 키를 다시 눌러 게임으로 돌아가기</p>
        </div>
      }

      {/* 🎮 M키: 모드 변경 메뉴 (Mode Selection) */}
      {activeMenu === "mode" && (
        <div style={overlayStyle}>
          <h2 style={{ fontSize: "40px", color: "cyan" }}>🎮 모드 선택 (MODE)</h2>
          <div style={{display: 'flex', gap: '20px', marginBottom: '30px'}}>
            <button onClick={() => setGameMode("1v1")} style={gameMode === "1v1" ? activeModeButtonStyle : modeButtonStyle}>
              🔫 1대1 FPS (PVP)
            </button>
            <button onClick={() => setGameMode("zombie")} style={gameMode === "zombie" ? activeModeButtonStyle : modeButtonStyle}>
              🧟‍♂️ 무한 좀비 아케이드
            </button>
            <button onClick={() => setGameMode("survival")} style={gameMode === "survival" ? activeModeButtonStyle : modeButtonStyle}>
              💥 단체 개인 서바이벌
            </button>
          </div>
          <h3 style={{color: 'white'}}>현재 선택된 모드: <span style={{color: 'lime'}}>{
            gameMode === "1v1" ? "1대1 FPS (PVP)" :
            gameMode === "zombie" ? "무한 좀비 아케이드" : "단체 개인 서바이벌"
          }</span></h3>
          <p style={{ color: "#aaa" }}>[M] 키를 다시 눌러 게임으로 돌아가기</p>
        </div>
      }
    </div>
  );
}

// 🎨 화면 스타일 (CSS-in-JS)
const overlayStyle = {
  position: "absolute", top: 0, left: 0,
  width: "100%", height: "100%",
  backgroundColor: "rgba(0, 0, 0, 0.8)",
  display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
  zIndex: 10, color: "white", textAlign: "center", gap: "20px"
};

const buttonStyle = {
  padding: "15px 40px", fontSize: "24px",
  backgroundColor: "#ff4444", color: "white", border: "none", borderRadius: "10px",
  cursor: "pointer", transition: "0.2s",
  ":hover": { backgroundColor: "#cc0000" }
};

const settingItemStyle = {
  display: 'flex', alignItems: 'center', gap: '15px',
  fontSize: '20px', color: 'white', margin: '10px 0'
};

const rangeStyle = {
  width: '300px', cursor: 'pointer'
};

const modeButtonStyle = {
  padding: "20px 30px", fontSize: "18px",
  backgroundColor: "#333", color: "white", border: "2px solid white", borderRadius: "10px",
  cursor: "pointer", opacity: 0.7,
  transition: "0.2s"
};

const activeModeButtonStyle = {
  ...modeButtonStyle,
  backgroundColor: "cyan", color: "black", border: "2px solid cyan", opacity: 1, fontWeight: 'bold'
};

export default App;