/**
 * Procedural NYC G Train — Car B Interior + Scrolling Tunnel & Station Platforms.
 * Hyper-real, over-lit, clinical fluorescent interior:
 * - Scooped orange & yellow fiberglass benches along both walls
 * - Brushed stainless steel poles, overhead handrails, hanging grab straps (InstancedMesh)
 * - Speckled gray tile floor
 * - Framed paper wall ads (normal & anomalous)
 * - Black amber LED strip sign above doors + green 13-stop G line strip map above windows
 * - Black tunnel walls with cables, pipes, ribs, and signal lights sliding past windows
 */

import * as THREE from 'three';
import { AnomalyTargetId } from '../game/anomalies';
import { SubwayLineId } from '../game/route';
import {
  createBrushedMetalMap,
  createFloorTextures,
  createLedSignTexture,
  createPosterTexture,
  createStationWallTexture,
  createStripMapTexture,
  createTunnelWallTexture,
  DynamicLedTexture,
} from './textures';

export interface SubwayCarRig {
  root: THREE.Group;
  /** 6 overhead fluorescent ceiling tubes + matching point lights (4 point lights max for budget) */
  tubeMeshes: THREE.Mesh[];
  tubeMaterials: THREE.MeshStandardMaterial[];
  carLights: THREE.PointLight[];
  hemiLight: THREE.HemisphereLight;
  /** Sliding door leaves (left & right sides) */
  doorPairs: Array<{ leftLeaf: THREE.Mesh; rightLeaf: THREE.Mesh; baseZ: number }>;
  /** Dynamic LED sign texture */
  ledSign: DynamicLedTexture;
  /** Swappable anomaly textures/materials */
  rightPosterMaterial: THREE.MeshStandardMaterial;
  rightPosterNormalTex: THREE.CanvasTexture;
  rightPosterAnomalyTex: THREE.CanvasTexture;
  stripMapMaterial: THREE.MeshStandardMaterial;
  stripMapNormalTex: THREE.CanvasTexture;
  stripMapAnomalyTex: THREE.CanvasTexture;
  stripMapTexturesByLine: Record<
    SubwayLineId,
    { normal: THREE.CanvasTexture; anomaly: THREE.CanvasTexture }
  >;
  /** Scrolling tunnel & station platform walls outside windows */
  tunnelWallMat: THREE.MeshStandardMaterial;
  stationWallGroup: THREE.Group;
  signalLightMeshes: THREE.Mesh[];
  /** Raycastable targets inside Car B */
  interactables: THREE.Object3D[];
  dispose: () => void;
}

function tagTarget(obj: THREE.Object3D, id: AnomalyTargetId): void {
  obj.userData.targetId = id;
}

export function buildSubwayCar(maxAnisotropy: number): SubwayCarRig {
  const root = new THREE.Group();
  const interactables: THREE.Object3D[] = [];
  const disposableTextures: THREE.Texture[] = [];

  const carLength = 14.4; // Z from -7.2 to +7.2
  const carWidth = 2.66; // X from -1.33 to +1.33
  const carHeight = 2.48; // Y from 0 to 2.48

  // Procedural textures
  const floorTex = createFloorTextures(maxAnisotropy);
  const brushedMap = createBrushedMetalMap();
  const leftPosterTex = createPosterTexture(maxAnisotropy, 'left_normal');
  const rightPosterNormalTex = createPosterTexture(maxAnisotropy, 'right_normal');
  const rightPosterAnomalyTex = createPosterTexture(maxAnisotropy, 'right_anomaly');
  const stripMapTexturesByLine: Record<
    SubwayLineId,
    { normal: THREE.CanvasTexture; anomaly: THREE.CanvasTexture }
  > = {
    G: {
      normal: createStripMapTexture(maxAnisotropy, false, 'G'),
      anomaly: createStripMapTexture(maxAnisotropy, true, 'G'),
    },
    L: {
      normal: createStripMapTexture(maxAnisotropy, false, 'L'),
      anomaly: createStripMapTexture(maxAnisotropy, true, 'L'),
    },
    '7': {
      normal: createStripMapTexture(maxAnisotropy, false, '7'),
      anomaly: createStripMapTexture(maxAnisotropy, true, '7'),
    },
  };
  const stripMapNormalTex = stripMapTexturesByLine.G.normal;
  const stripMapAnomalyTex = stripMapTexturesByLine.G.anomaly;
  const ledSign = createLedSignTexture(maxAnisotropy);
  const tunnelTex = createTunnelWallTexture(maxAnisotropy);
  const stationTex = createStationWallTexture(maxAnisotropy);

  disposableTextures.push(
    floorTex.map,
    floorTex.bumpMap,
    brushedMap,
    leftPosterTex,
    rightPosterNormalTex,
    rightPosterAnomalyTex,
    stripMapTexturesByLine.G.normal,
    stripMapTexturesByLine.G.anomaly,
    stripMapTexturesByLine.L.normal,
    stripMapTexturesByLine.L.anomaly,
    stripMapTexturesByLine['7'].normal,
    stripMapTexturesByLine['7'].anomaly,
    ledSign.texture,
    tunnelTex,
    stationTex,
  );

  // Shared PBR Materials (distinct roughness & metalness variation)
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: floorTex.map,
    bumpMap: floorTex.bumpMap,
    bumpScale: 0.008,
    roughness: 0.62,
    metalness: 0.04,
  });

  const wallPanelMat = new THREE.MeshStandardMaterial({
    color: 0xc8ceca,
    roughness: 0.48,
    metalness: 0.14,
  });

  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0xd4d9d5,
    roughness: 0.56,
    metalness: 0.08,
  });

  const stainlessMat = new THREE.MeshStandardMaterial({
    color: 0xd6dcdf,
    bumpMap: brushedMap,
    bumpScale: 0.004,
    roughness: 0.24,
    metalness: 0.86,
  });

  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x202427,
    roughness: 0.58,
    metalness: 0.28,
  });

  const orangeBenchMat = new THREE.MeshStandardMaterial({
    color: 0xd66824, // Classic NYC R46/R68 scooped orange fiberglass
    roughness: 0.34,
    metalness: 0.06,
  });

  const yellowBenchMat = new THREE.MeshStandardMaterial({
    color: 0xd8a328, // Classic NYC scooped yellow fiberglass
    roughness: 0.34,
    metalness: 0.06,
  });

  const windowGlassMat = new THREE.MeshStandardMaterial({
    color: 0x8ea4a8,
    roughness: 0.08,
    metalness: 0.12,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });

  // 1. FLOOR & CEILING
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(carWidth, carLength), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(carWidth, carLength), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = carHeight;
  root.add(ceiling);

  // Subtle curved upper ceiling coves on left & right
  const coveGeo = new THREE.BoxGeometry(0.24, 0.28, carLength);
  const leftCove = new THREE.Mesh(coveGeo, wallPanelMat);
  leftCove.position.set(-carWidth / 2 + 0.1, carHeight - 0.14, 0);
  leftCove.rotation.z = -0.35;
  const rightCove = new THREE.Mesh(coveGeo, wallPanelMat);
  rightCove.position.set(carWidth / 2 - 0.1, carHeight - 0.14, 0);
  rightCove.rotation.z = 0.35;
  root.add(leftCove, rightCove);

  // 2. SIDE WALLS WITH WINDOWS & DOOR OPENINGS
  // Layout along Z: [-7.2 .. -4.8 bench/window] [-4.8..-3.4 DOOR] [-3.4..0.2 bench/window] [0.2..1.6 DOOR] [1.6..5.2 bench/window]
  // Actually let's place doors symmetrically at Z = -3.4 and Z = +0.2 so player at Z=+2.35 sees benches, Mom/Dad at Z=+1.38/+2.02, and full aisle!
  // Let's refine Z layout so Mom & Dad sit cleanly on a bench on the left wall (Z = +0.9 to +2.8),
  // Door pair 1 at Z = -0.25 (visible mid-near), Bench/window from Z = -1.2 to -3.6, Door pair 2 at Z = -4.2? No, keep passengers on benches!
  // Passengers are at Z: Mom(1.38), Dad(2.02), SuitMan(-1.65), Woman(-2.85), Umbrella/Extra(-4.4), Teen(-4.65).
  // So let's put Door Openings at Z = +0.15 and Z = -5.75! That puts solid bench walls at:
  //   Near bench: Z = +0.85 .. +3.65 (Mom & Dad sit here on left; player sits on right/aisle)
  //   Mid bench:  Z = -0.55 .. -5.05 (Suit man, Grocery woman, Umbrella seat, Teenager all seated cleanly on benches!)
  const wallX = carWidth / 2;
  const doorZs = [-0.25, -5.85];
  const doorPairs: Array<{ leftLeaf: THREE.Mesh; rightLeaf: THREE.Mesh; baseZ: number }> = [];

  [-1, 1].forEach((side) => {
    const x = side * wallX;
    // Lower kick wall below windows (continuous except at doors)
    const benchZones: Array<[number, number]> = [
      [0.45, 7.2],
      [-5.15, -0.95],
      [-7.2, -6.55],
    ];
    for (const [zStart, zEnd] of benchZones) {
      const len = zEnd - zStart;
      const midZ = (zStart + zEnd) / 2;

      // Lower wall panel
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.96, len), wallPanelMat);
      lower.position.set(x, 0.48, midZ);
      root.add(lower);

      // Upper header above windows
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, len), wallPanelMat);
      upper.position.set(x, carHeight - 0.23, midZ);
      root.add(upper);

      // Window glass pane + dark rubber mullion frame
      const winH = 1.06;
      const winY = 1.49;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.06, winH), windowGlassMat);
      glass.position.set(x - side * 0.02, winY, midZ);
      glass.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      root.add(glass);

      // Vertical window mullions every ~1.4m
      const count = Math.max(1, Math.floor(len / 1.45));
      for (let i = 0; i <= count; i++) {
        const mz = zStart + (i / count) * len;
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.09, winH + 0.04, 0.08), darkTrimMat);
        mullion.position.set(x, winY, mz);
        root.add(mullion);
      }
    }

    // Sliding subway doors at each door opening
    for (const dz of doorZs) {
      // Door header above opening
      const header = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.44, 1.42), stainlessMat);
      header.position.set(x, carHeight - 0.22, dz);
      root.add(header);

      // Door jambs
      [-0.71, 0.71].forEach((off) => {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.11, 2.04, 0.07), darkTrimMat);
        jamb.position.set(x, 1.02, dz + off);
        root.add(jamb);
      });

      // Two brushed stainless sliding door leaves with recessed glass windows
      const buildLeaf = (dir: number) => {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.02, 0.67), stainlessMat);
        leaf.position.set(x - side * 0.02, 1.01, dz + dir * 0.34);
        // Door window frame
        const dw = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.78, 0.38), darkTrimMat);
        dw.position.set(0, 0.34, 0);
        leaf.add(dw);
        root.add(leaf);
        return leaf;
      };

      const leftLeaf = buildLeaf(-1);
      const rightLeaf = buildLeaf(1);
      doorPairs.push({ leftLeaf, rightLeaf, baseZ: dz });
    }
  });

  // 3. SCOOPED ORANGE & YELLOW FIBERGLASS BENCHES (Composite multi-part geometry)
  const buildBenchRow = (side: -1 | 1, zStart: number, zEnd: number) => {
    const len = zEnd - zStart;
    const midZ = (zStart + zEnd) / 2;
    const bx = side * (wallX - 0.28);
    const benchGroup = new THREE.Group();

    // Dark recessed steel base/heater grille
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, len - 0.06), darkTrimMat);
    base.position.set(bx + side * 0.04, 0.19, midZ);
    benchGroup.add(base);

    // Individual scooped seat pans alternating classic NYC orange & yellow bands
    const seatWidth = 0.54;
    const seatCount = Math.max(2, Math.floor(len / seatWidth));
    const actualW = len / seatCount;

    for (let i = 0; i < seatCount; i++) {
      const sz = zStart + (i + 0.5) * actualW;
      const mat = i % 2 === 0 ? orangeBenchMat : yellowBenchMat;

      // Seat pan
      const pan = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, actualW - 0.02), mat);
      pan.position.set(bx, 0.42, sz);
      pan.receiveShadow = true;

      // Front rounded lip
      const lip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.036, 0.036, actualW - 0.02, 10),
        mat,
      );
      lip.rotation.x = Math.PI / 2;
      lip.position.set(bx - side * 0.23, 0.415, sz);

      // Contoured backrest
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, actualW - 0.02), mat);
      back.position.set(bx + side * 0.2, 0.7, sz);
      back.rotation.z = side * 0.1;

      benchGroup.add(pan, lip, back);
    }

    // Stainless bench end-dividers (windscreens next to doors)
    [zStart + 0.02, zEnd - 0.02].forEach((ez) => {
      const divider = new THREE.Mesh(new THREE.BoxGeometry(0.54, 1.15, 0.04), stainlessMat);
      divider.position.set(bx, 0.58, ez);
      benchGroup.add(divider);
    });

    root.add(benchGroup);
  };

  // Place benches on both walls matching passenger seating zones
  buildBenchRow(-1, 0.5, 3.6);
  buildBenchRow(1, 0.5, 3.6);
  buildBenchRow(-1, -5.05, -1.02);
  buildBenchRow(1, -5.05, -1.02);

  // 4. BRUSHED STAINLESS STEEL POLES, HANDRAILS & HANGING GRAB STRAPS (InstancedMesh)
  const stanchionGeo = new THREE.CylinderGeometry(0.022, 0.022, carHeight, 12);
  const stanchionPositions: Array<[number, number]> = [
    [-0.58, 0.85],
    [0.58, 0.85],
    [-0.58, -0.58],
    [0.58, -0.58],
    [-0.58, -2.8],
    [0.58, -2.8],
    [-0.58, -5.0],
    [0.58, -5.0],
  ];
  for (const [px, pz] of stanchionPositions) {
    const pole = new THREE.Mesh(stanchionGeo, stainlessMat);
    pole.position.set(px, carHeight / 2, pz);
    root.add(pole);
  }

  // Two long overhead horizontal handrails running down the car
  const railGeo = new THREE.CylinderGeometry(0.018, 0.018, carLength - 1.2, 10);
  railGeo.rotateX(Math.PI / 2);
  [-0.58, 0.58].forEach((rx) => {
    const rail = new THREE.Mesh(railGeo, stainlessMat);
    rail.position.set(rx, 2.02, 0);
    root.add(rail);
  });

  // Hanging grab straps via InstancedMesh (24 straps along both rails)
  const strapGeo = new THREE.TorusGeometry(0.052, 0.009, 6, 12);
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0xcfd5d8,
    roughness: 0.35,
    metalness: 0.72,
  });
  const strapPositions: Array<[number, number]> = [];
  for (let z = 3.2; z >= -5.6; z -= 0.8) {
    strapPositions.push([-0.58, z]);
    strapPositions.push([0.58, z]);
  }
  const strapInst = new THREE.InstancedMesh(strapGeo, strapMat, strapPositions.length);
  const dummy = new THREE.Object3D();
  strapPositions.forEach(([sx, sz], idx) => {
    dummy.position.set(sx, 1.9, sz);
    dummy.rotation.set(0, Math.PI / 2, 0);
    dummy.updateMatrix();
    strapInst.setMatrixAt(idx, dummy.matrix);
  });
  strapInst.instanceMatrix.needsUpdate = true;
  strapInst.computeBoundingSphere();
  root.add(strapInst);

  // 5. FRONT & REAR BULKHEADS (Far end of Car B leading toward Car A is slightly darker)
  const buildBulkhead = (z: number, facing: number) => {
    const bh = new THREE.Group();
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.88, carHeight, 0.14), wallPanelMat);
    leftWall.position.set(-0.9, carHeight / 2, z);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.88, carHeight, 0.14), wallPanelMat);
    rightWall.position.set(0.9, carHeight / 2, z);
    const header = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.44, 0.14), wallPanelMat);
    header.position.set(0, carHeight - 0.22, z);

    // Connecting storm door to Car A / Car C
    const stormDoor = new THREE.Mesh(new THREE.BoxGeometry(0.88, 2.02, 0.08), stainlessMat);
    stormDoor.position.set(0, 1.01, z);
    const doorWindow = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.82, 0.095),
      new THREE.MeshStandardMaterial({ color: 0x0a0d0f, roughness: 0.15, metalness: 0.2 }),
    );
    doorWindow.position.set(0, 1.38, z);

    // Subtle "CAR A" / "CAR C" transom placard
    const placard = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.04), darkTrimMat);
    placard.position.set(0, 2.15, z + facing * 0.08);

    bh.add(leftWall, rightWall, header, stormDoor, doorWindow, placard);
    root.add(bh);
  };
  buildBulkhead(-carLength / 2, 1); // Far bulkhead toward Car A
  buildBulkhead(carLength / 2, -1); // Rear bulkhead toward Car C

  // 6. OVERHEAD BLACK AMBER LED STRIP SIGN (above doors / front bulkhead)
  const ledMat = new THREE.MeshStandardMaterial({
    map: ledSign.texture,
    emissiveMap: ledSign.texture,
    emissive: new THREE.Color(0xffb020),
    emissiveIntensity: 0.95,
    roughness: 0.32,
    metalness: 0.2,
  });
  const ledMesh = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.2, 0.07), ledMat);
  ledMesh.position.set(0, 2.16, -3.55); // Clearly visible down the aisle from seated view
  tagTarget(ledMesh, 'led_sign');
  interactables.push(ledMesh);
  root.add(ledMesh);

  // Secondary LED sign above the near right doors
  const sideLedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.17, 1.15), ledMat);
  sideLedMesh.position.set(wallX - 0.06, 2.18, 0.15);
  tagTarget(sideLedMesh, 'led_sign');
  interactables.push(sideLedMesh);
  root.add(sideLedMesh);

  // 7. GREEN G LINE 13-STOP STRIP ROUTE MAP (above right-side windows, framed in dark bezel)
  const stripMapMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: stripMapNormalTex,
    roughness: 0.42,
    metalness: 0.04,
  });
  const stripMapFrame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 2.18), darkTrimMat);
  stripMapFrame.position.set(wallX - 0.06, 2.12, -2.25);
  const stripMapMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.12, 0.32), stripMapMaterial);
  stripMapMesh.position.set(wallX - 0.08, 2.12, -2.25);
  stripMapMesh.rotation.y = -Math.PI / 2;
  tagTarget(stripMapMesh, 'route_map');
  interactables.push(stripMapMesh);
  root.add(stripMapFrame, stripMapMesh);

  // 8. FRAMED PAPER WALL ADS (Left & Right upper walls)
  const leftPosterMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: leftPosterTex,
    roughness: 0.72,
    metalness: 0.02,
  });
  const rightPosterMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: rightPosterNormalTex,
    roughness: 0.72,
    metalness: 0.02,
  });

  const leftPosterFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 1.04), darkTrimMat);
  leftPosterFrame.position.set(-wallX + 0.07, 2.14, -1.9);
  const leftPosterMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.38), leftPosterMat);
  leftPosterMesh.position.set(-wallX + 0.095, 2.14, -1.9);
  leftPosterMesh.rotation.y = Math.PI / 2;
  tagTarget(leftPosterMesh, 'poster_left');
  interactables.push(leftPosterMesh);
  root.add(leftPosterFrame, leftPosterMesh);

  const rightPosterFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 1.04), darkTrimMat);
  rightPosterFrame.position.set(wallX - 0.07, 2.14, 1.95);
  const rightPosterMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.38), rightPosterMaterial);
  rightPosterMesh.position.set(wallX - 0.095, 2.14, 1.95);
  rightPosterMesh.rotation.y = -Math.PI / 2;
  tagTarget(rightPosterMesh, 'poster_right');
  interactables.push(rightPosterMesh);
  root.add(rightPosterFrame, rightPosterMesh);

  // Also add a clearly visible ad frame further down the right wall so player sees it straight ahead
  const rightPosterAheadFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 1.04), darkTrimMat);
  rightPosterAheadFrame.position.set(wallX - 0.07, 2.14, -3.7);
  const rightPosterAhead = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.38), rightPosterMaterial);
  rightPosterAhead.position.set(wallX - 0.095, 2.14, -3.7);
  rightPosterAhead.rotation.y = -Math.PI / 2;
  tagTarget(rightPosterAhead, 'poster_right');
  interactables.push(rightPosterAhead);
  root.add(rightPosterAheadFrame, rightPosterAhead);

  // 9. FLUORESCENT CEILING TUBES (6 individual tubes in 2 rows + bright clinical lighting)
  const tubeMeshes: THREE.Mesh[] = [];
  const tubeMaterials: THREE.MeshStandardMaterial[] = [];
  const tubeZs = [2.6, 0.6, -1.4, -3.4, -5.2, -6.5];

  tubeZs.forEach((tz, i) => {
    const tMat = new THREE.MeshStandardMaterial({
      color: 0xf7fbf8,
      emissive: new THREE.Color(0xf3faee),
      emissiveIntensity: i >= 4 ? 1.1 : 1.75, // Far end of car is slightly darker
      roughness: 0.2,
    });
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 1.55), stainlessMat);
    housing.position.set(0, carHeight - 0.025, tz);
    const tube = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 1.48), tMat);
    tube.position.set(0, carHeight - 0.055, tz);
    root.add(housing, tube);
    tubeMeshes.push(tube);
    tubeMaterials.push(tMat);
  });

  // Clinical over-lit interior lighting (4 point lights max for budget; calibrated contrast, far end subtly darker)
  const hemiLight = new THREE.HemisphereLight(0xeef5f0, 0x62696c, 0.84);
  root.add(hemiLight);

  const carLights: THREE.PointLight[] = [];
  const lightConfigs: Array<{ z: number; intensity: number; distance: number }> = [
    { z: 2.3, intensity: 3.4, distance: 7.2 },
    { z: -0.5, intensity: 3.2, distance: 7.2 },
    { z: -3.3, intensity: 2.4, distance: 6.4 },
    { z: -5.9, intensity: 1.1, distance: 5.2 }, // Far end of Car B noticeably dimmer
  ];
  for (const cfg of lightConfigs) {
    const pl = new THREE.PointLight(0xf7fcf8, cfg.intensity, cfg.distance, 1.5);
    pl.position.set(0, 2.26, cfg.z);
    root.add(pl);
    carLights.push(pl);
  }

  // 10. OUTSIDE WINDOWS: SCROLLING BLACK TUNNEL WALLS, CABLES, SIGNAL LIGHTS & STATION PLATFORMS
  const tunnelWallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tunnelTex,
    roughness: 0.92,
    metalness: 0.1,
  });

  [-1, 1].forEach((side) => {
    const tWall = new THREE.Mesh(new THREE.PlaneGeometry(24, 4.2), tunnelWallMat);
    tWall.position.set(side * 2.45, 1.5, -1.0);
    tWall.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    root.add(tWall);
  });

  // Tunnel signal lights sliding past
  const signalLightMeshes: THREE.Mesh[] = [];
  const sigColors = [0xef4444, 0x22c55e, 0xf59e0b];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const mat = new THREE.MeshBasicMaterial({ color: sigColors[i % sigColors.length] });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), mat);
    bulb.position.set(side * 2.25, 1.55 + (i % 2) * 0.22, -8 + i * 3.4);
    root.add(bulb);
    signalLightMeshes.push(bulb);
  }

  // Station Platform Walls (appear when braking/dwelling at a stop)
  const stationWallGroup = new THREE.Group();
  const stationMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: stationTex,
    roughness: 0.55,
    metalness: 0.06,
  });
  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x6f7574,
    roughness: 0.85,
  });
  const yellowEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.5,
  });

  [-1, 1].forEach((side) => {
    const sWall = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.6), stationMat);
    sWall.position.set(side * 2.2, 1.5, -1.0);
    sWall.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    stationWallGroup.add(sWall);

    const plat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 22), platformMat);
    plat.position.set(side * 2.15, -0.05, -1.0);
    stationWallGroup.add(plat);

    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.21, 22), yellowEdgeMat);
    edge.position.set(side * 1.48, -0.04, -1.0);
    stationWallGroup.add(edge);
  });
  stationWallGroup.visible = false;
  root.add(stationWallGroup);

  return {
    root,
    tubeMeshes,
    tubeMaterials,
    carLights,
    hemiLight,
    doorPairs,
    ledSign,
    rightPosterMaterial,
    rightPosterNormalTex,
    rightPosterAnomalyTex,
    stripMapMaterial,
    stripMapNormalTex,
    stripMapAnomalyTex,
    stripMapTexturesByLine,
    tunnelWallMat,
    stationWallGroup,
    signalLightMeshes,
    interactables,
    dispose: () => {
      disposableTextures.forEach((t) => t.dispose());
    },
  };
}
