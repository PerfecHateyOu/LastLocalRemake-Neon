/**
 * Isolated Three.js WebGL Viewport for Car B of the NYC G Train.
 * - Mounted once via useEffect(..., []); React state lives in refs so HUD updates never rebuild WebGL.
 * - Detects software WebGL (SwiftShader/llvmpipe) and paces frames with afterDraw() sync fence.
 * - Populates scene.environment via RoomEnvironment + PMREMGenerator on every device.
 * - Zero per-frame GC allocations; raycasts strictly against small interactables array.
 */

import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AnomalyTargetId } from '../game/anomalies';
import { CAR_BOUNDS, InputState } from '../game/input';
import { getBreathingFov } from '../game/sanity';
import { GameState, getCurrentLedText } from '../game/state';
import { buildPassengers } from './passengers';
import { buildSubwayCar } from './subwayCar';
import { createBlankNewspaperTexture } from './textures';

export interface SubwaySceneHandle {
  capturePolaroidDataUrl: () => string | null;
  requestPointerLock: () => void;
  exitPointerLock: () => void;
}

interface SubwaySceneProps {
  gameStateRef: React.MutableRefObject<GameState>;
  inputStateRef: React.MutableRefObject<InputState>;
  onSimTick: (
    dt: number,
    lookingTarget: AnomalyTargetId | null,
    isPointerLocked: boolean,
  ) => void;
  onAimTargetChange: (target: AnomalyTargetId | null) => void;
  onPointerLockChange: (locked: boolean) => void;
}

const BASE_FOV = 64;
const _raycaster = new THREE.Raycaster();
const _centerNdc = new THREE.Vector2(0, 0);
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

let cachedSoftwareWebGL: boolean | null = null;

function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareWebGL !== null) return cachedSoftwareWebGL;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) {
      cachedSoftwareWebGL = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareWebGL = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareWebGL;
  } catch {
    cachedSoftwareWebGL = true;
    return true;
  }
}

function disposeObjectTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => materials.add(m));
      } else {
        materials.add(mesh.material);
      }
    }
  });

  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}

export const SubwayScene = React.forwardRef<SubwaySceneHandle, SubwaySceneProps>(
  function SubwayScene(
    { gameStateRef, inputStateRef, onSimTick, onAimTargetChange, onPointerLockChange },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const [isContextLost, setIsContextLost] = useState(false);
    const [restoreEpoch, setRestoreEpoch] = useState(0);

    const callbacksRef = useRef({ onSimTick, onAimTargetChange, onPointerLockChange });
    callbacksRef.current = { onSimTick, onAimTargetChange, onPointerLockChange };

    useImperativeHandle(ref, () => ({
      capturePolaroidDataUrl: () => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        if (!renderer || !scene || !camera) return null;
        if (renderer.getContext().isContextLost()) return null;
        try {
          // Render right before toDataURL so the drawing buffer is fresh
          renderer.render(scene, camera);
          return renderer.domElement.toDataURL('image/jpeg', 0.85);
        } catch {
          return null;
        }
      },
      requestPointerLock: () => {
        const canvas = rendererRef.current?.domElement;
        if (canvas && document.pointerLockElement !== canvas) {
          try {
            const p = canvas.requestPointerLock?.() as unknown as Promise<void> | undefined;
            if (p && typeof p.catch === 'function') {
              p.catch(() => {});
            }
          } catch {
            // Ignore pointer lock rejection in headless/mobile environments
          }
        }
      },
      exitPointerLock: () => {
        if (document.pointerLockElement) {
          try {
            document.exitPointerLock?.();
          } catch {
            // Ignore
          }
        }
      },
    }));

    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = detectSoftwareWebGL();
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: !isSoftwareGl,
          powerPreference: 'default',
        });
      } catch {
        setIsContextLost(true);
        return;
      }

      const gl = renderer.getContext();
      let disposed = false;
      let contextLost = gl.isContextLost();
      let hadContextLoss = contextLost;
      let frameId = 0;

      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.94;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      // Car B uses unshadowed fluorescent lighting; disabling unused shadow maps avoids extra shader sampler pressure
      renderer.shadowMap.enabled = false;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.dataset.testid = 'subway-canvas';

      // Register context loss/restore listeners immediately before any shader/PMREM work
      const onContextLost = (e: Event) => {
        e.preventDefault();
        contextLost = true;
        hadContextLoss = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        if (!disposed) {
          setIsContextLost(true);
        }
      };
      const onContextRestored = () => {
        if (disposed) return;
        contextLost = false;
        setIsContextLost(false);
        setRestoreEpoch((n) => n + 1);
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x060708);
      // No heavy fog washout — just subtle far-end darkening depth matching the brief
      scene.fog = new THREE.Fog(0x090b0c, 8.5, 21.0);
      sceneRef.current = scene;

      // Mandatory procedural RoomEnvironment for realistic brushed stainless steel reflections
      let envTarget: THREE.WebGLRenderTarget | null = null;
      if (!contextLost && !gl.isContextLost()) {
        const pmrem = new THREE.PMREMGenerator(renderer);
        const roomEnv = new RoomEnvironment();
        envTarget = pmrem.fromScene(roomEnv, 0.04);
        scene.environment = envTarget.texture;
        scene.environmentIntensity = 0.65;
        roomEnv.dispose();
        pmrem.dispose();
      }

      const camera = new THREE.PerspectiveCamera(BASE_FOV, width / height, 0.08, 45);
      camera.position.set(CAR_BOUNDS.maxX * 0.45, CAR_BOUNDS.baseEyeY, 2.35);
      cameraRef.current = camera;

      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const car = buildSubwayCar(maxAniso);
      scene.add(car.root);

      const blankPaperTex = createBlankNewspaperTexture(maxAniso);
      const passengers = buildPassengers(blankPaperTex);
      car.root.add(
        passengers.momGroup,
        passengers.dadGroup,
        passengers.otherPassengersGroup,
        passengers.umbrellaGroup,
        passengers.extraPassengerGroup,
      );

      const allInteractables = [...car.interactables, ...passengers.interactables];

      if (!isSoftwareGl && !contextLost && !gl.isContextLost()) {
        renderer.compile(scene, camera);
      }

      if (gl.isContextLost()) {
        contextLost = true;
        hadContextLoss = true;
        setIsContextLost(true);
      } else {
        setIsContextLost(false);
      }

      const handlePointerLockChange = () => {
        const locked = document.pointerLockElement === renderer.domElement;
        callbacksRef.current.onPointerLockChange(locked);
      };
      document.addEventListener('pointerlockchange', handlePointerLockChange);

      const handleResize = () => {
        if (!container || disposed || contextLost || gl.isContextLost()) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      // Animation loop state
      let lastTimeMs = performance.now();
      let lastReportedAim: AnomalyTargetId | null = null;
      let aimThrottleAcc = 0;
      let tunnelOffset = 0;

      // Software WebGL afterDraw fence sync
      const afterDraw = (cb: () => void) => {
        if (disposed || contextLost || gl.isContextLost()) return;
        const gl2 = gl as WebGL2RenderingContext;
        if (!gl2 || typeof gl2.fenceSync !== 'function') {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        const poll = () => {
          if (disposed || contextLost || gl.isContextLost()) {
            if (sync && !gl.isContextLost()) gl2.deleteSync(sync);
            return;
          }
          const status = sync ? gl2.getSyncParameter(sync, gl2.SYNC_STATUS) : gl2.SIGNALED;
          if (status === gl2.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl2.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      };

      const tick = () => {
        if (disposed || contextLost) return;
        if (gl.isContextLost()) {
          contextLost = true;
          hadContextLoss = true;
          setIsContextLost(true);
          return;
        }

        const nowMs = performance.now();
        const rawDt = Math.max(0, (nowMs - lastTimeMs) / 1000);
        lastTimeMs = nowMs;
        const dt = Math.min(rawDt, 0.05);

        const gs = gameStateRef.current;

        // Raycast from screen center against small interactables list (throttled to ~10Hz)
        aimThrottleAcc += dt;
        if (aimThrottleAcc >= 0.09) {
          aimThrottleAcc = 0;
          if (gs.screen === 'playing' && gs.activePanel === 'none') {
            _raycaster.setFromCamera(_centerNdc, camera);
            _raycaster.far = 9.5;
            const hits = _raycaster.intersectObjects(allInteractables, true);
            const firstHit = hits.find((h) => h.object.visible && h.object.userData.targetId);
            const targetId = (firstHit?.object.userData.targetId as AnomalyTargetId) ?? null;
            if (targetId !== lastReportedAim) {
              lastReportedAim = targetId;
              callbacksRef.current.onAimTargetChange(targetId);
            }
          } else if (lastReportedAim !== null) {
            lastReportedAim = null;
            callbacksRef.current.onAimTargetChange(null);
          }
        }

        const isLocked = document.pointerLockElement === renderer.domElement;
        callbacksRef.current.onSimTick(dt, lastReportedAim, isLocked);

        // Read updated state after sim tick
        const state = gameStateRef.current;
        const input = inputStateRef.current;

        // 1. Camera placement & look
        if (state.screen === 'title' || state.screen === 'tutorial') {
          // Subtle seated ambient sway inside the moving subway car on title screen
          const t = nowMs * 0.001;
          camera.position.set(
            0.42 + Math.sin(t * 0.6) * 0.02,
            CAR_BOUNDS.baseEyeY + Math.sin(t * 2.1) * 0.005,
            2.68,
          );
          _euler.set(-0.02 + Math.sin(t * 0.4) * 0.01, 0.05 + Math.sin(t * 0.25) * 0.06, 0, 'YXZ');
          camera.quaternion.setFromEuler(_euler);
          if (Math.abs(camera.fov - BASE_FOV) > 0.1) {
            camera.fov = BASE_FOV;
            camera.updateProjectionMatrix();
          }
        } else {
          // Playing / Paused / Ending: zero drift when paused!
          const swaySpeed = state.screen === 'playing' ? state.trainSpeed : 0;
          const swayT = state.elapsedSec;
          const swayX = swaySpeed > 0.05 ? Math.sin(swayT * 4.4) * 0.007 * swaySpeed : 0;
          const swayY = swaySpeed > 0.05 ? Math.sin(swayT * 8.8) * 0.004 * swaySpeed : 0;

          camera.position.set(input.posX + swayX, CAR_BOUNDS.baseEyeY + swayY, input.posZ);
          _euler.set(input.pitch, input.yaw, swayX * 0.35, 'YXZ');
          camera.quaternion.setFromEuler(_euler);

          // Anxious breathing slightly narrows FOV by sanity tier
          const targetFov =
            state.screen === 'playing'
              ? getBreathingFov(BASE_FOV, state.sanity.value, state.elapsedSec)
              : BASE_FOV;
          if (Math.abs(camera.fov - targetFov) > 0.05) {
            camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, dt);
            camera.updateProjectionMatrix();
          }
        }

        // 2. Dynamic LED Strip Sign text
        const ledText =
          state.screen === 'title'
            ? `NEXT STOP: ${getCurrentLedText(state).replace(/^(THIS IS|NEXT STOP|APPROACHING):\s*/, '')}`
            : getCurrentLedText(state);
        car.ledSign.updateText(ledText);

        // 3. Apply Active Anomalies & Line Selection to 3D Scene
        const hasPosterAnomaly = state.activeAnomalies.some(
          (a) => a.definition.id === 'poster_changed',
        );
        const targetPosterTex = hasPosterAnomaly
          ? car.rightPosterAnomalyTex
          : car.rightPosterNormalTex;
        if (car.rightPosterMaterial.map !== targetPosterTex) {
          car.rightPosterMaterial.map = targetPosterTex;
          car.rightPosterMaterial.needsUpdate = true;
        }

        const hasMapAnomaly = state.activeAnomalies.some(
          (a) => a.definition.id === 'map_stop_moved',
        );
        const lineMaps = car.stripMapTexturesByLine[state.lineId] ?? car.stripMapTexturesByLine.G;
        const targetMapTex = hasMapAnomaly ? lineMaps.anomaly : lineMaps.normal;
        if (car.stripMapMaterial.map !== targetMapTex) {
          car.stripMapMaterial.map = targetMapTex;
          car.stripMapMaterial.needsUpdate = true;
        }

        const hasExtraPassenger = state.activeAnomalies.some(
          (a) => a.definition.id === 'extra_passenger',
        );
        const hasEmptyCar =
          state.phase === 'blackout' ||
          state.activeAnomalies.some((a) => a.definition.id === 'car_goes_empty');
        const hasFrozenParent = state.activeAnomalies.some(
          (a) => a.definition.id === 'parent_face_frozen',
        );

        passengers.otherPassengersGroup.visible = !hasEmptyCar;
        passengers.extraPassengerGroup.visible = hasExtraPassenger && state.phase !== 'blackout';
        passengers.umbrellaGroup.visible = !hasExtraPassenger;

        // 4. Parent head orientation (watching player vs looking straight ahead / frozen)
        const momBaseYaw = 0; // Mom looks straight across aisle (+X)
        const momWatchYaw = -0.68; // Turns toward player seat (+Z)
        const dadBaseYaw = -0.35; // Dad casually angled near player
        const dadWatchYaw = -0.82; // Dad turns directly to watch player

        const momTargetYaw = hasFrozenParent
          ? 0
          : state.parentWatching === 'mom'
            ? momWatchYaw
            : momBaseYaw;
        const dadTargetYaw = state.parentWatching === 'dad' ? dadWatchYaw : dadBaseYaw;

        const dampLambda = state.screen === 'paused' ? 0 : 4.2;
        if (dampLambda > 0) {
          passengers.momHead.rotation.y = THREE.MathUtils.damp(
            passengers.momHead.rotation.y,
            momTargetYaw,
            dampLambda,
            dt,
          );
          passengers.dadHead.rotation.y = THREE.MathUtils.damp(
            passengers.dadHead.rotation.y,
            dadTargetYaw,
            dampLambda,
            dt,
          );
          // Subtle breathing micro-motion unless Mom is frozen anomaly
          const subtleBob = hasFrozenParent ? 0 : Math.sin(state.elapsedSec * 1.4) * 0.012;
          passengers.momHead.rotation.x = subtleBob;
        }

        // 5. Fluorescent Lighting, Single-Tube Flicker, and Blackout Segment
        const isBlackout = state.phase === 'blackout';
        const flickerNoise =
          Math.sin(nowMs * 0.043) * Math.sin(nowMs * 0.019) > 0.15 ? 0.12 : 1.15;

        car.tubeMaterials.forEach((mat, idx) => {
          if (isBlackout) {
            if (idx === 2) {
              mat.emissiveIntensity = flickerNoise > 0.5 ? 0.45 : 0.02;
            } else {
              mat.emissiveIntensity = 0.0;
            }
          } else if (state.flickeringTubeIndex === idx) {
            mat.emissiveIntensity = flickerNoise;
          } else {
            mat.emissiveIntensity = idx >= 4 ? 1.1 : 1.75;
          }
        });

        const baseIntensities = [3.4, 3.2, 2.4, 1.1];
        car.carLights.forEach((pl, idx) => {
          if (isBlackout) {
            pl.intensity = idx === 1 ? (flickerNoise > 0.5 ? 1.1 : 0.06) : 0.03;
          } else {
            let intensity = baseIntensities[idx];
            // If the flickering tube is near this point light, dip it mildly (never whole car)
            if (state.flickeringTubeIndex >= 0) {
              const approxLightIdx = Math.min(3, Math.floor(state.flickeringTubeIndex / 1.5));
              if (approxLightIdx === idx) {
                intensity *= flickerNoise > 0.5 ? 1.0 : 0.42;
              }
            }
            pl.intensity = intensity;
          }
        });
        car.hemiLight.intensity = isBlackout ? 0.06 : 0.84;
        scene.environmentIntensity = isBlackout ? 0.05 : 0.55;

        // 6. Sliding Subway Doors (open during dwelling/arrived/trial)
        const doorSlide = state.doorOpen * 0.56;
        for (const pair of car.doorPairs) {
          pair.leftLeaf.position.z = pair.baseZ - 0.34 - doorSlide;
          pair.rightLeaf.position.z = pair.baseZ + 0.34 + doorSlide;
        }

        // 7. Scrolling Tunnel Walls, Signal Lights & Station Platform Visibility
        const effectiveSpeed =
          state.screen === 'title' ? 0.65 : state.screen === 'playing' ? state.trainSpeed : 0;
        tunnelOffset = (tunnelOffset + effectiveSpeed * dt * 2.4) % 1;
        if (car.tunnelWallMat.map) {
          car.tunnelWallMat.map.offset.x = tunnelOffset;
        }

        car.signalLightMeshes.forEach((bulb) => {
          bulb.position.z += effectiveSpeed * dt * 15;
          if (bulb.position.z > 8) {
            bulb.position.z -= 20;
          }
        });

        // Show station platform wall during dwelling, arrived, restraint, trial, and late braking
        const showStation =
          state.screen !== 'title' &&
          !isBlackout &&
          (state.phase === 'dwelling' ||
            state.phase === 'arrived' ||
            state.phase === 'restraint' ||
            state.phase === 'trial' ||
            (state.phase === 'braking' && state.trainSpeed < 0.38));
        car.stationWallGroup.visible = showStation;
        car.signalLightMeshes.forEach((bulb) => {
          bulb.visible = !showStation;
        });

        if (disposed || contextLost || gl.isContextLost()) {
          if (!contextLost && gl.isContextLost()) {
            contextLost = true;
            hadContextLoss = true;
            setIsContextLost(true);
          }
          return;
        }

        renderer.render(scene, camera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      };

      // Kick off render loop only if context is valid
      if (!contextLost && !gl.isContextLost()) {
        frameId = requestAnimationFrame(tick);
      }

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('pointerlockchange', handlePointerLockChange);
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
        // Only issue GL delete calls when the context was not lost; after context loss,
        // the browser already wiped all GPU handles and deleting stale handles emits INVALID_OPERATION.
        if (!hadContextLoss && !gl.isContextLost()) {
          car.dispose();
          blankPaperTex.dispose();
          envTarget?.dispose();
          disposeObjectTree(scene);
        }
        renderer.dispose();
        if (rendererRef.current === renderer) {
          rendererRef.current = null;
        }
      };
    }, [gameStateRef, inputStateRef, restoreEpoch]);

    return (
      <div className="fixed inset-0 w-full h-full bg-[#060708] z-0">
        <div
          ref={mountRef}
          className="w-full h-full"
          aria-label="3D G Train Car B View"
        />
        {isContextLost && (
          <div
            data-testid="webgl-context-lost-fallback"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#090b0c] text-[#e6e9e7] px-6 text-center"
          >
            <div className="font-mono text-xs tracking-[0.22em] uppercase text-[#ffb020] mb-2">
              CAR B VISUAL FEED INTERRUPTED
            </div>
            <p className="text-sm text-[#9ca3a0] max-w-sm mb-5">
              Graphics context was paused by the browser. Waiting for automatic recovery.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsContextLost(false);
                setRestoreEpoch((n) => n + 1);
              }}
              className="px-4 py-2 text-xs font-mono uppercase tracking-[0.16em] bg-[#171c1e] hover:bg-[#22292b] border border-[#3a4245] text-[#f0f3f1] cursor-pointer"
            >
              Reconnect View
            </button>
          </div>
        )}
      </div>
    );
  },
);
