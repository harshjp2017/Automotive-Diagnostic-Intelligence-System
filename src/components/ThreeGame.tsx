import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Play, RotateCcw, Volume2, VolumeX, Trophy, Shield, Zap, Sparkles, ChevronDown, ChevronUp, Trash2, Edit3, Check } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, deleteDoc, doc, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface ThreeGameProps {
  user: any;
  onRequireAuth: () => void;
}

interface ScoreRecord {
  id: string;
  userDisplayName: string;
  score: number;
  crystalsCollected: number;
  createdAt: string;
}

export const ThreeGame: React.FC<ThreeGameProps> = ({ user, onRequireAuth }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<'title' | 'playing' | 'gameover'>('title');
  const [score, setScore] = useState(0);
  const [crystals, setCrystals] = useState(0);
  const [shield, setShield] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // References for mutable game loop state to avoid React re-renders breaking 60fps
  const gameRef = useRef<{
    score: number;
    crystals: number;
    shield: number;
    speed: number;
    keys: { [key: string]: boolean };
    probeGroup: THREE.Group | null;
    crystalsPool: THREE.Group[];
    obstaclesPool: THREE.Group[];
    starfield: THREE.Points | null;
    active: boolean;
  }>({
    score: 0,
    crystals: 0,
    shield: 100,
    speed: 18,
    keys: {},
    probeGroup: null,
    crystalsPool: [],
    obstaclesPool: [],
    starfield: null,
    active: false,
  });

  // Audio Synth context (procedural Web Audio API - zero 404s)
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSynthSound = (type: 'thrust' | 'pickup' | 'hit' | 'start') => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'pickup') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(1040, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'start') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Listen to leaderboard from Firestore
  useEffect(() => {
    if (!user) return;
    try {
      const q = query(collection(db, 'gameScores'), orderBy('score', 'desc'), limit(5));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: ScoreRecord[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            list.push({
              id: doc.id,
              userDisplayName: data.userDisplayName || 'Anonymous Explorer',
              score: data.score || 0,
              crystalsCollected: data.crystalsCollected || 0,
              createdAt: data.createdAt || '',
            });
          });
          setLeaderboard(list);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'gameScores');
        }
      );
      return () => unsubscribe();
    } catch (e) {
      console.warn('Leaderboard offline or not authenticated yet.');
    }
  }, [user]);

  const handleDeleteScore = async (scoreId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      if (user) {
        await deleteDoc(doc(db, 'gameScores', scoreId));
      }
      setLeaderboard((prev) => prev.filter((s) => s.id !== scoreId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'gameScores');
      setLeaderboard((prev) => prev.filter((s) => s.id !== scoreId));
    }
  };

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL per Three.js skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 560;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060913, 0.012);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 800);
    camera.position.set(0, 4.5, 12);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Studio Environment map via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Studio 3-point Lighting
    const keyLight = new THREE.DirectionalLight(0xfff3db, 2.8);
    keyLight.position.set(12, 20, 10);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x73a5ff, 0x060913, 1.2);
    scene.add(hemiLight);

    // Procedural Starfield Particle Grid
    const starCount = 600;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 140;
      starPositions[i + 1] = Math.random() * 50 - 5;
      starPositions[i + 2] = (Math.random() - 0.5) * 300;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x90b8ff,
      size: 0.6,
      transparent: true,
      opacity: 0.8,
    });
    const starfield = new THREE.Points(starGeo, starMat);
    scene.add(starfield);
    gameRef.current.starfield = starfield;

    // Grid Floor
    const gridHelper = new THREE.GridHelper(160, 40, 0x2563eb, 0x1e293b);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // Composite Procedural Player Probe (8-part composite model)
    const probe = new THREE.Group();

    // 1. Central Aerodynamic Fuselage
    const fuselageGeo = new THREE.ConeGeometry(0.8, 3.2, 7);
    fuselageGeo.rotateX(Math.PI / 2);
    const fuselageMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.2,
    });
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    probe.add(fuselage);

    // 2. Glowing Plasma Cockpit Core
    const coreGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(0, 0.2, 0.4);
    probe.add(core);

    // 3. Port Swept Wing
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(-1.8, -0.6);
    wingShape.lineTo(-1.6, -1.2);
    wingShape.lineTo(0, -0.8);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.02 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.7, roughness: 0.3 });
    const portWing = new THREE.Mesh(wingGeo, wingMat);
    portWing.position.set(-0.2, 0, 0.2);
    portWing.rotateX(Math.PI / 2);
    probe.add(portWing);

    // 4. Starboard Swept Wing
    const stbdWing = portWing.clone();
    stbdWing.scale.set(-1, 1, 1);
    stbdWing.position.set(0.2, 0, 0.2);
    probe.add(stbdWing);

    // 5. Thruster Engine Cylinders
    const engineGeo = new THREE.CylinderGeometry(0.25, 0.35, 0.8, 12);
    engineGeo.rotateX(Math.PI / 2);
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.1 });
    const leftEngine = new THREE.Mesh(engineGeo, engineMat);
    leftEngine.position.set(-0.55, -0.1, -1.2);
    probe.add(leftEngine);

    const rightEngine = leftEngine.clone();
    rightEngine.position.set(0.55, -0.1, -1.2);
    probe.add(rightEngine);

    // 6. Engine Exhaust Plumes
    const plumeGeo = new THREE.ConeGeometry(0.2, 0.7, 8);
    plumeGeo.rotateX(-Math.PI / 2);
    const plumeMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const leftPlume = new THREE.Mesh(plumeGeo, plumeMat);
    leftPlume.position.set(-0.55, -0.1, -1.7);
    probe.add(leftPlume);

    const rightPlume = leftPlume.clone();
    rightPlume.position.set(0.55, -0.1, -1.7);
    probe.add(rightPlume);

    // 7. Ground Contact Shadow
    const shadowGeo = new THREE.PlaneGeometry(3, 3);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.48;
    probe.add(shadow);

    probe.position.set(0, 1.2, 4);
    scene.add(probe);
    gameRef.current.probeGroup = probe;

    // Collectible Quantum Crystals (Procedural Octahedrons)
    const crystalsPool: THREE.Group[] = [];
    const crystalGeo = new THREE.OctahedronGeometry(0.65, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.4,
    });

    for (let i = 0; i < 7; i++) {
      const cGroup = new THREE.Group();
      const cMesh = new THREE.Mesh(crystalGeo, crystalMat);
      cGroup.add(cMesh);
      cGroup.position.set((Math.random() - 0.5) * 16, 1.2, -30 - i * 25);
      scene.add(cGroup);
      crystalsPool.push(cGroup);
    }
    gameRef.current.crystalsPool = crystalsPool;

    // Quantum Anomaly Obstacles (Procedural Spire Asteroids)
    const obstaclesPool: THREE.Group[] = [];
    const obsGeo = new THREE.IcosahedronGeometry(1.2, 0);
    const obsMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.4,
      roughness: 0.7,
      metalness: 0.2,
    });

    for (let i = 0; i < 5; i++) {
      const oGroup = new THREE.Group();
      const oMesh = new THREE.Mesh(obsGeo, obsMat);
      oGroup.add(oMesh);
      oGroup.position.set((Math.random() - 0.5) * 18, 1.2, -45 - i * 35);
      scene.add(oGroup);
      obstaclesPool.push(oGroup);
    }
    gameRef.current.obstaclesPool = obstaclesPool;

    // Controls listeners
    const onKeyDown = (e: KeyboardEvent) => {
      gameRef.current.keys[e.key.toLowerCase()] = true;
      if (e.code === 'Space' && gameState !== 'playing') {
        startGame();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      gameRef.current.keys[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Animation Loop
    let lastTime = performance.now();
    let animId = 0;

    const animate = (currentTime: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      const g = gameRef.current;

      // Rotate crystals & obstacles
      g.crystalsPool.forEach((c) => {
        c.rotation.y += 2.2 * dt;
        c.rotation.x += 1.1 * dt;
      });
      g.obstaclesPool.forEach((o) => {
        o.rotation.y -= 1.4 * dt;
        o.rotation.z += 0.8 * dt;
      });

      if (g.active && g.probeGroup) {
        // Player Movement
        const speedX = 14;
        let moveX = 0;
        if (g.keys['a'] || g.keys['arrowleft']) moveX -= speedX * dt;
        if (g.keys['d'] || g.keys['arrowright']) moveX += speedX * dt;

        g.probeGroup.position.x = THREE.MathUtils.clamp(
          g.probeGroup.position.x + moveX,
          -8.5,
          8.5
        );
        // Bank roll
        const targetRoll = -moveX * 0.28;
        g.probeGroup.rotation.z = THREE.MathUtils.damp(
          g.probeGroup.rotation.z,
          targetRoll,
          10,
          dt
        );

        // Forward world simulation
        const currentSpeed = g.speed;
        g.score += Math.round(currentSpeed * dt * 8);

        // Advance crystals towards player
        g.crystalsPool.forEach((c) => {
          c.position.z += currentSpeed * dt;
          if (c.position.z > 8) {
            c.position.z = -120 - Math.random() * 30;
            c.position.x = (Math.random() - 0.5) * 16;
          }
          // Collision Check with Crystal
          const dist = c.position.distanceTo(g.probeGroup!.position);
          if (dist < 1.6) {
            c.position.z = -130;
            c.position.x = (Math.random() - 0.5) * 16;
            g.crystals += 1;
            g.score += 250;
            playSynthSound('pickup');
          }
        });

        // Advance obstacles towards player
        g.obstaclesPool.forEach((o) => {
          o.position.z += currentSpeed * dt;
          if (o.position.z > 8) {
            o.position.z = -140 - Math.random() * 40;
            o.position.x = (Math.random() - 0.5) * 16;
          }
          // Collision Check with Obstacle
          const dist = o.position.distanceTo(g.probeGroup!.position);
          if (dist < 1.8) {
            o.position.z = -150;
            g.shield -= 25;
            playSynthSound('hit');
            if (g.shield <= 0) {
              endGame();
            }
          }
        });

        // Loop Starfield
        if (g.starfield) {
          const positions = g.starfield.geometry.attributes.position.array as Float32Array;
          for (let i = 2; i < positions.length; i += 3) {
            positions[i] += currentSpeed * dt * 1.5;
            if (positions[i] > 20) positions[i] = -250;
          }
          g.starfield.geometry.attributes.position.needsUpdate = true;
        }

        // Camera follow with soft exponential damping
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          g.probeGroup.position.x * 0.45,
          6,
          dt
        );

        // Periodically sync React UI state
        setScore(g.score);
        setCrystals(g.crystals);
        setShield(Math.max(0, g.shield));
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // Resize handling
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 560;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const startGame = () => {
    gameRef.current.score = 0;
    gameRef.current.crystals = 0;
    gameRef.current.shield = 100;
    gameRef.current.active = true;
    setScore(0);
    setCrystals(0);
    setShield(100);
    setGameState('playing');
    playSynthSound('start');
  };

  const endGame = async () => {
    gameRef.current.active = false;
    setGameState('gameover');

    // Save score to Firestore if user is logged in
    const finalScore = gameRef.current.score;
    const finalCrystals = gameRef.current.crystals;

    if (user && finalScore > 0) {
      try {
        await addDoc(collection(db, 'gameScores'), {
          id: `score_${Date.now()}`,
          userId: user.uid,
          userDisplayName: user.displayName || 'Pilot',
          score: finalScore,
          crystalsCollected: finalCrystals,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to submit score to Firestore:', e);
      }
    }
  };

  return (
    <div className="relative w-full h-[620px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl select-none">
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* World-Matched Minimal HUD Header (Unobstructed Playfield) */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-6 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800 text-xs text-white">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="font-mono font-bold text-sm tabular-nums">{score.toLocaleString()} PTS</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="font-mono font-bold tabular-nums">{crystals} CRYSTALS</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${shield < 30 ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${shield}%` }}
              />
            </div>
            <span className="font-mono tabular-nums">{shield}%</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-20">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/20">
            <Zap className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Quantum Probe 3D
          </h1>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            Pilot a procedural deep-space probe across the neural subspace. Collect quantum data crystals and evade unstable red anomalies.
          </p>

          <div className="flex items-center gap-3 mb-8">
            <button
              onClick={startGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              <span>Launch Probe (Space)</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-4 bg-slate-900/80 px-4 py-2 rounded-lg border border-slate-800 font-mono">
            <span>A / D or Left / Right: Steer</span>
            <span>·</span>
            <span>Space: Launch</span>
            <span>·</span>
            <span>Composite 3D Mesh</span>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-20">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">Probe Shield Depleted</h2>
          <p className="text-xs text-slate-400 mb-6">Simulation telemetry concluded.</p>

          <div className="grid grid-cols-2 gap-4 max-w-xs w-full bg-slate-900/90 p-4 rounded-xl border border-slate-800 mb-6 font-mono text-center">
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Final Score</span>
              <span className="text-xl font-bold text-amber-400 tabular-nums">{score.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase block">Crystals</span>
              <span className="text-xl font-bold text-cyan-400 tabular-nums">{crystals}</span>
            </div>
          </div>

          {user ? (
            <p className="text-xs text-emerald-400 mb-4 flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Score recorded to Firestore leaderboard</span>
            </p>
          ) : (
            <button
              onClick={onRequireAuth}
              className="text-xs text-blue-400 hover:underline mb-4 cursor-pointer"
            >
              Sign in with Google to save scores to the global leaderboard
            </button>
          )}

          <button
            onClick={startGame}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
        </div>
      )}

      {/* Collapsible Ergonomic Bottom Dock (Three.js Directive) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-10 pointer-events-auto">
        <div className="bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-800 shadow-lg overflow-hidden text-xs text-slate-300">
          <button
            onClick={() => setDockCollapsed(!dockCollapsed)}
            className="w-full px-4 py-1.5 flex items-center justify-between text-slate-400 hover:text-white transition-colors cursor-pointer border-b border-slate-800/60"
          >
            <span className="font-semibold text-[11px] uppercase tracking-wider">
              {dockCollapsed ? 'Show Flight Controls & Leaderboard' : 'Flight Console'}
            </span>
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {!dockCollapsed && (
            <div className="p-3 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase block mb-1">Flight Telemetry</span>
                <div className="space-y-1 text-[11px] font-mono text-slate-400">
                  <div>Engine: Plasma Fusion Core</div>
                  <div>Shaders: ACES Filmic + PMREM</div>
                  <div>FPS: 60 (Damped Kinematics)</div>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase block mb-1">Top Pilot High Scores</span>
                {leaderboard.length > 0 ? (
                  <div className="space-y-1.5 text-[11px]">
                    {leaderboard.slice(0, 4).map((lb, i) => (
                      <div key={lb.id} className="flex items-center justify-between font-mono bg-slate-800/40 px-1.5 py-1 rounded">
                        <span className="text-slate-300 truncate max-w-[90px]">
                          {i + 1}. {lb.userDisplayName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-400 font-semibold">{lb.score.toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newName = window.prompt('Edit pilot display name:', lb.userDisplayName);
                              if (newName && newName.trim()) {
                                setLeaderboard((prev) =>
                                  prev.map((item) =>
                                    item.id === lb.id ? { ...item, userDisplayName: newName.trim() } : item
                                  )
                                );
                              }
                            }}
                            className="text-slate-400 hover:text-blue-400 p-0.5 rounded cursor-pointer"
                            title="Edit pilot name"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteScore(lb.id, e)}
                            className="text-slate-400 hover:text-red-400 p-0.5 rounded cursor-pointer"
                            title="Delete this score entry"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 italic">No scores logged yet</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
