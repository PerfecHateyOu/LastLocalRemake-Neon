/**
 * Procedural HTML5 2D Canvas Textures for Car B of the NYC G Train.
 * Zero external assets — all surfaces, signage, maps, and ads are synthesized in code.
 */

import * as THREE from 'three';
import { getLineDefinition, SubwayLineId } from '../game/route';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

/** Speckled gray MTA subway floor tile albedo + bump map */
export function createFloorTextures(anisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const [c, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = '#8b9094';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle tile grid (4x4)
  ctx.strokeStyle = 'rgba(55, 60, 64, 0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    const p = i * 128;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(512, p);
    ctx.stroke();
  }

  // Deterministic terrazzo/vinyl speckles
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 4200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 1 + rand() * 2.4;
    const pick = rand();
    ctx.fillStyle =
      pick < 0.35
        ? 'rgba(42, 46, 50, 0.42)'
        : pick < 0.72
          ? 'rgba(218, 222, 224, 0.45)'
          : 'rgba(115, 118, 114, 0.38)';
    ctx.fillRect(x, y, r, r);
  }

  // Subtle bump map
  const [bc, bctx] = makeCanvas(256, 256);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  bctx.strokeStyle = '#404040';
  bctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const p = i * 64;
    bctx.beginPath();
    bctx.moveTo(p, 0);
    bctx.lineTo(p, 256);
    bctx.stroke();
    bctx.beginPath();
    bctx.moveTo(0, p);
    bctx.lineTo(256, p);
    bctx.stroke();
  }
  const bumpMap = new THREE.CanvasTexture(bc);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 12);

  return {
    map: finalizeColorTexture(c, anisotropy, 3, 12),
    bumpMap,
  };
}

/** Brushed stainless steel directional grain bump/roughness map */
export function createBrushedMetalMap(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 4201;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let y = 0; y < 256; y++) {
    const v = 115 + Math.floor(rand() * 34);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

/**
 * Green NYC G Line 13-stop strip map placed above the windows.
 * Shows all 13 stops in exact order with Court Sq dot glowing slightly brighter.
 * If anomalous=true ('map_stop_moved'), Classon Av / Court Sq dot shifts out of sequence.
 */
export function createStripMapTexture(
  anisotropy: number,
  anomalous: boolean,
  lineId: SubwayLineId = 'G',
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(1024, 160);
  const line = getLineDefinition(lineId);

  // Off-white laminated transit sign backing
  ctx.fillStyle = '#f2f3ef';
  ctx.fillRect(0, 0, 1024, 160);

  // Dark slim top bar
  ctx.fillStyle = '#141718';
  ctx.fillRect(0, 0, 1024, 24);
  ctx.fillStyle = '#e5e7e4';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.fillText(line.subtitle, 18, 16);
  ctx.fillText('CAR B · LOCAL SERVICE', 845, 16);

  // Line Color Bullet
  ctx.fillStyle = line.color;
  ctx.beginPath();
  ctx.arc(48, 86, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(line.id, 48, 88);

  // Horizontal route line
  const startX = 104;
  const endX = 984;
  const lineY = 76;
  ctx.strokeStyle = line.color;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(startX, lineY);
  ctx.lineTo(endX, lineY);
  ctx.stroke();

  // Plot all 13 stops in exact order
  const stops = [...line.stops];
  const step = (endX - startX) / (stops.length - 1);

  stops.forEach((stop, i) => {
    let x = startX + i * step;
    let y = lineY;

    // Subtle anomalous shift for 'map_stop_moved'
    if (anomalous && i === 5) {
      y = lineY - 22;
      x += 18;
    }

    const isTerminus = stop.index === 12;
    if (isTerminus) {
      // Terminus dot glows slightly brighter than the rest
      ctx.fillStyle =
        lineId === '7'
          ? 'rgba(240, 171, 252, 0.55)'
          : lineId === 'L'
            ? 'rgba(226, 232, 240, 0.6)'
            : 'rgba(134, 239, 172, 0.55)';
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isTerminus ? '#f8fafc' : '#ffffff';
    ctx.strokeStyle = isTerminus ? line.color : '#141718';
    ctx.lineWidth = isTerminus ? 3.5 : 2.5;
    ctx.beginPath();
    ctx.arc(x, y, isTerminus ? 7.5 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Angled station name below dot
    ctx.save();
    ctx.translate(x, lineY + 14);
    ctx.rotate(Math.PI / 5.2);
    ctx.fillStyle = isTerminus ? '#0f172a' : '#262b2d';
    ctx.font = isTerminus ? 'bold 11px Arial, sans-serif' : '600 10px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const label = anomalous && i === 5 ? `${stop.name.slice(0, 6).toUpperCase()}-???` : stop.name;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  return finalizeColorTexture(c, anisotropy);
}

/**
 * Dynamic overhead black LED dot-matrix sign glowing amber.
 */
export interface DynamicLedTexture {
  texture: THREE.CanvasTexture;
  updateText: (text: string) => void;
}

export function createLedSignTexture(anisotropy: number): DynamicLedTexture {
  const [canvas, ctx] = makeCanvas(768, 96);
  const texture = finalizeColorTexture(canvas, anisotropy);
  let lastText = '__init__';

  const updateText = (text: string) => {
    if (text === lastText) return;
    lastText = text;

    // Matte black LED casing
    ctx.fillStyle = '#090a0b';
    ctx.fillRect(0, 0, 768, 96);

    // Subtle unlit dot matrix grid
    ctx.fillStyle = '#181410';
    for (let x = 14; x < 754; x += 12) {
      for (let y = 14; y < 82; y += 12) {
        ctx.fillRect(x, y, 4, 4);
      }
    }

    if (text.trim().length > 0) {
      ctx.save();
      ctx.font = 'bold 42px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(text, 384, 50, 720);
      ctx.restore();
    }

    // Metallic frame border
    ctx.strokeStyle = '#33383b';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 762, 90);

    texture.needsUpdate = true;
  };

  updateText('NEXT STOP: HOYT-SCHERMERHORN');
  return { texture, updateText };
}

/** Framed subway wall paper posters (normal & anomalous 'poster_changed') */
export function createPosterTexture(
  anisotropy: number,
  variant: 'left_normal' | 'right_normal' | 'right_anomaly',
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 224);

  if (variant === 'left_normal') {
    ctx.fillStyle = '#eae8e1';
    ctx.fillRect(0, 0, 512, 224);
    ctx.fillStyle = '#1c4d8d';
    ctx.fillRect(0, 0, 512, 54);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillText('BROOKLYN PUBLIC LIBRARY', 22, 36);
    ctx.fillStyle = '#1e2428';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillText('Free Night Hours · Central Branch', 22, 108);
    ctx.font = '18px Arial, sans-serif';
    ctx.fillStyle = '#475056';
    ctx.fillText('Open until 9 PM Monday through Thursday.', 22, 148);
    ctx.fillText('Take the G to Fulton St or Hoyt-Schermerhorn.', 22, 178);
  } else if (variant === 'right_normal') {
    ctx.fillStyle = '#f4f2ea';
    ctx.fillRect(0, 0, 512, 224);
    ctx.fillStyle = '#1f6f43';
    ctx.fillRect(0, 0, 156, 224);
    // Clean geometric eye-care icon
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(78, 112, 42, 24, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(78, 112, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#14191b';
    ctx.font = 'bold 28px Arial, sans-serif';
    ctx.fillText('QUEENSBORO OPTICAL', 178, 72);
    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = '#384145';
    ctx.fillText('Same-day exams near Court Sq.', 178, 116);
    ctx.fillText('Jackson Ave · Open 7 Days', 178, 150);
    ctx.fillStyle = '#1f6f43';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('718-555-0194', 178, 192);
  } else {
    // Anomalous poster_changed: quiet, clinical wrongness — text shifts to counting / watching
    ctx.fillStyle = '#f4f2ea';
    ctx.fillRect(0, 0, 512, 224);
    ctx.fillStyle = '#181a19';
    ctx.fillRect(0, 0, 156, 224);
    // Unblinking wide eye staring slightly downward
    ctx.strokeStyle = '#e5e7e4';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(78, 112, 46, 30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e5e7e4';
    ctx.beginPath();
    ctx.arc(78, 112, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090a0b';
    ctx.beginPath();
    ctx.arc(78, 112, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#14191b';
    ctx.font = 'bold 27px Arial, sans-serif';
    ctx.fillText('DO NOT LOOK UP', 178, 74);
    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = '#2d3336';
    ctx.fillText('Keep your eyes on the floor.', 178, 118);
    ctx.fillText('Thirteen stops. Count them twice.', 178, 152);
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText('CAR B · LOCAL ONLY', 178, 192);
  }

  return finalizeColorTexture(c, anisotropy);
}

/** Blank white newspaper texture (subtle paper fold & fiber grain, completely blank pages) */
export function createBlankNewspaperTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#f1f0eb';
  ctx.fillRect(0, 0, 256, 256);
  // Center crease shadow
  const grad = ctx.createLinearGradient(118, 0, 138, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.14)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(116, 0, 24, 256);
  return finalizeColorTexture(c, anisotropy);
}

/** Dark subway tunnel wall texture with cables, pipes, and steel columns */
export function createTunnelWallTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = '#0d0f11';
  ctx.fillRect(0, 0, 512, 256);

  // Vertical concrete rib pilasters
  for (let x = 0; x < 512; x += 128) {
    ctx.fillStyle = '#171b1f';
    ctx.fillRect(x, 0, 24, 256);
    ctx.fillStyle = '#22272c';
    ctx.fillRect(x + 2, 0, 4, 256);
  }

  // Horizontal conduit pipes and thick power cables
  const cableYs = [52, 68, 84, 156, 174];
  cableYs.forEach((y, i) => {
    ctx.fillStyle = i % 2 === 0 ? '#24292e' : '#1b1f23';
    ctx.fillRect(0, y, 512, i === 3 ? 8 : 5);
  });

  // Occasional small tunnel emergency marker light
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(62, 112, 10, 16);

  return finalizeColorTexture(c, anisotropy, 6, 1);
}

/** Station platform tile wall texture (white NYC ceramic tiles + green trim band) */
export function createStationWallTexture(anisotropy: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = '#cfd4d0';
  ctx.fillRect(0, 0, 512, 256);

  // Ceramic subway brick tile lines
  ctx.strokeStyle = 'rgba(70, 76, 74, 0.28)';
  ctx.lineWidth = 1;
  for (let y = 0; y < 256; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
    const offset = (y / 16) % 2 === 0 ? 0 : 16;
    for (let x = offset; x < 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 16);
      ctx.stroke();
    }
  }

  // Classic green NYC mosaic trim stripe
  ctx.fillStyle = '#2f6d3c';
  ctx.fillRect(0, 54, 512, 26);
  ctx.fillStyle = '#1b2021';
  ctx.fillRect(0, 80, 512, 5);
  ctx.fillRect(0, 49, 512, 5);

  return finalizeColorTexture(c, anisotropy, 4, 1);
}
