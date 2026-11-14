// ============================================================
//  Procedural sample scenes — no image files, no external assets
//  All drawn on OffscreenCanvas (1024x768) using 2D Canvas API
// ============================================================

export type SampleSceneId = 'streetscape' | 'stilllife' | 'landscape';

export const SAMPLE_SCENES: { id: SampleSceneId; label: string; desc: string }[] = [
  { id: 'streetscape', label: 'City Street',    desc: 'Architectural streetscape with layered buildings' },
  { id: 'stilllife',   label: 'Desk Still Life', desc: 'Geometric objects at distinct depths' },
  { id: 'landscape',   label: 'Landscape',       desc: 'Mountain, forest, river, meadow layers' },
];

export async function renderScene(id: SampleSceneId): Promise<{ canvas: HTMLCanvasElement; bitmap: ImageBitmap }> {
  const W = 1024, H = 768;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  if (id === 'streetscape')  drawStreetscape(ctx, W, H);
  else if (id === 'stilllife') drawStillLife(ctx, W, H);
  else                        drawLandscape(ctx, W, H);

  const bitmap = await createImageBitmap(canvas);
  return { canvas, bitmap };
}

// ── Scene 1: Architectural Streetscape ───────────────────────
function drawStreetscape(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0, '#1a2744');
  sky.addColorStop(1, '#3d6fa8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun/moon halo
  ctx.beginPath();
  ctx.arc(W * 0.75, H * 0.12, 60, 0, Math.PI * 2);
  const halo = ctx.createRadialGradient(W * 0.75, H * 0.12, 10, W * 0.75, H * 0.12, 60);
  halo.addColorStop(0, 'rgba(255,240,180,0.9)');
  halo.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = halo;
  ctx.fill();

  // Far background buildings (darkest / most receded)
  const farBuildings = [
    { x: 0,   w: 90,  h: 220, color: '#1c2a3e' },
    { x: 80,  w: 60,  h: 180, color: '#1e2d44' },
    { x: 130, w: 110, h: 260, color: '#1a2840' },
    { x: 230, w: 80,  h: 200, color: '#1c2b42' },
    { x: 300, w: 130, h: 300, color: '#1d2d45' },
    { x: 420, w: 90,  h: 240, color: '#1b2a40' },
    { x: 500, w: 70,  h: 190, color: '#1e2f46' },
    { x: 560, w: 150, h: 280, color: '#1c2c43' },
    { x: 700, w: 100, h: 220, color: '#1a2840' },
    { x: 790, w: 80,  h: 260, color: '#1d2d45' },
    { x: 860, w: 164, h: 210, color: '#1b2b41' },
  ];
  for (const b of farBuildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, H * 0.55 - b.h, b.w, b.h);
    // Windows
    for (let wy = H * 0.55 - b.h + 10; wy < H * 0.55 - 10; wy += 20) {
      for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 14) {
        if (Math.random() > 0.4) {
          ctx.fillStyle = `rgba(255,230,120,${0.3 + Math.random() * 0.5})`;
          ctx.fillRect(wx, wy, 6, 10);
        }
      }
    }
  }

  // Mid-distance apartment blocks (medium depth)
  const midBuildings = [
    { x: -10, w: 140, h: 310, color: '#2a3f5c' },
    { x: 120,  w: 100, h: 270, color: '#2d4360' },
    { x: 210,  w: 170, h: 340, color: '#283d58' },
    { x: 370,  w: 90,  h: 290, color: '#2b4060' },
    { x: 450,  w: 160, h: 320, color: '#2a3f5c' },
    { x: 600,  w: 120, h: 300, color: '#2d4262' },
    { x: 710,  w: 170, h: 350, color: '#283d58' },
    { x: 870,  w: 164, h: 290, color: '#2c4160' },
  ];
  for (const b of midBuildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, H * 0.6 - b.h, b.w, b.h);
    // Window rows
    for (let wy = H * 0.6 - b.h + 15; wy < H * 0.6 - 15; wy += 24) {
      for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 18) {
        ctx.fillStyle = Math.random() > 0.3
          ? `rgba(255,220,100,${0.5 + Math.random() * 0.4})`
          : 'rgba(50,70,100,0.6)';
        ctx.fillRect(wx, wy, 8, 14);
      }
    }
  }

  // Ground / road
  const road = ctx.createLinearGradient(0, H * 0.6, 0, H);
  road.addColorStop(0, '#1a1f28');
  road.addColorStop(1, '#0d1018');
  ctx.fillStyle = road;
  ctx.fillRect(0, H * 0.6, W, H * 0.4);

  // Road markings (perspective lines)
  ctx.strokeStyle = 'rgba(255,255,180,0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([30, 20]);
  ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.6); ctx.lineTo(W * 0.1, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.6); ctx.lineTo(W * 0.9, H); ctx.stroke();
  ctx.setLineDash([]);

  // Pavement
  ctx.fillStyle = '#252d3a';
  ctx.fillRect(0, H * 0.6, W, 20);
  ctx.fillRect(0, H - 20, W, 20);

  // Foreground: lamppost (left)
  ctx.fillStyle = '#8a9bb0';
  ctx.fillRect(W * 0.08 - 4, H * 0.42, 8, H * 0.58);
  ctx.fillStyle = 'rgba(255,230,100,0.9)';
  ctx.beginPath(); ctx.arc(W * 0.08, H * 0.42, 18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a0b0c0';
  ctx.fillRect(W * 0.065, H * 0.42 - 5, 60, 10);

  // Foreground: fire hydrant (right of lamppost)
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(W * 0.14, H * 0.76, 20, 28);
  ctx.fillRect(W * 0.137, H * 0.74, 26, 10);
  ctx.fillRect(W * 0.14, H * 0.80, 8, 6);
  ctx.fillRect(W * 0.168, H * 0.80, 8, 6);

  // Foreground: mailbox (far right)
  ctx.fillStyle = '#2255aa';
  ctx.fillRect(W * 0.84, H * 0.72, 48, 36);
  ctx.fillStyle = '#1a44aa';
  ctx.beginPath(); ctx.ellipse(W * 0.864, H * 0.72, 24, 12, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#8a9bb0';
  ctx.fillRect(W * 0.862, H * 0.73, 4, 50);

  // Foreground: parked car (bottom-right)
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.roundRect(W * 0.6, H * 0.78, 220, 70, 8);
  ctx.fill();
  ctx.fillStyle = '#a93226';
  ctx.fillRect(W * 0.6, H * 0.82, 220, 26);
  ctx.fillStyle = 'rgba(140,210,255,0.6)';
  ctx.fillRect(W * 0.63, H * 0.79, 60, 25);
  ctx.fillRect(W * 0.70, H * 0.79, 60, 25);
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(W * 0.636, H * 0.86, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(W * 0.78,  H * 0.86, 16, 0, Math.PI * 2); ctx.fill();
}

// ── Scene 2: Geometric Still-Life Desk ───────────────────────
function drawStillLife(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // Background wall
  const wall = ctx.createLinearGradient(0, 0, 0, H * 0.65);
  wall.addColorStop(0, '#1a1520');
  wall.addColorStop(1, '#251d30');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H * 0.65);

  // Subtle wall texture lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H * 0.65; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Desk surface (perspective)
  const desk = ctx.createLinearGradient(0, H * 0.65, 0, H);
  desk.addColorStop(0, '#3d2b1a');
  desk.addColorStop(1, '#1f160d');
  ctx.fillStyle = desk;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.65);
  ctx.lineTo(W, H * 0.65);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();

  // Desk edge highlight
  ctx.fillStyle = '#5a3f26';
  ctx.fillRect(0, H * 0.65, W, 6);

  // ── Far: stacked books (left) ─────────────────────────────
  const bookData = [
    { y: H * 0.35, h: 30, color: '#8B2252', label: true },
    { y: H * 0.32, h: 30, color: '#1a5276', label: true },
    { y: H * 0.29, h: 30, color: '#1e8449', label: true },
    { y: H * 0.26, h: 25, color: '#784212', label: true },
  ];
  for (const book of bookData) {
    ctx.fillStyle = book.color;
    ctx.fillRect(W * 0.07, book.y, 110, book.h + 5);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(W * 0.07 + 8, book.y + 4, 94, book.h - 2);
  }
  // Book spine labels
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('DESIGN PATTERNS', W * 0.075, H * 0.365);
  ctx.fillText('ALGORITHMS', W * 0.075, H * 0.336);
  ctx.fillText('MATHEMATICS', W * 0.075, H * 0.306);
  ctx.fillText('PHILOSOPHY', W * 0.075, H * 0.278);

  // Plant (back-left, slightly closer than books' wall)
  ctx.fillStyle = '#3d2b1a';
  ctx.fillRect(W * 0.03, H * 0.52, 50, 140);
  ctx.fillStyle = '#5a3f26';
  ctx.fillRect(W * 0.025, H * 0.515, 60, 10);
  // Leaves
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const lx = W * 0.055 + Math.cos(angle) * 35;
    const ly = H * 0.48 + Math.sin(angle) * 25;
    ctx.fillStyle = `hsl(${120 + i * 10},60%,${25 + i * 3}%)`;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 22, 10, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Mid: geometric solids ─────────────────────────────────
  // Cube
  const cubeX = W * 0.37, cubeY = H * 0.45, cubeS = 110;
  ctx.fillStyle = '#5d6d7e';
  ctx.fillRect(cubeX, cubeY, cubeS, cubeS);
  // Top face
  ctx.fillStyle = '#85929e';
  ctx.beginPath();
  ctx.moveTo(cubeX, cubeY);
  ctx.lineTo(cubeX + 40, cubeY - 30);
  ctx.lineTo(cubeX + cubeS + 40, cubeY - 30);
  ctx.lineTo(cubeX + cubeS, cubeY);
  ctx.fill();
  // Right face
  ctx.fillStyle = '#3d4f61';
  ctx.beginPath();
  ctx.moveTo(cubeX + cubeS, cubeY);
  ctx.lineTo(cubeX + cubeS + 40, cubeY - 30);
  ctx.lineTo(cubeX + cubeS + 40, cubeY + cubeS - 30);
  ctx.lineTo(cubeX + cubeS, cubeY + cubeS);
  ctx.fill();
  // Grid lines on cube face
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(cubeX + i * (cubeS / 4), cubeY); ctx.lineTo(cubeX + i * (cubeS / 4), cubeY + cubeS); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cubeX, cubeY + i * (cubeS / 4)); ctx.lineTo(cubeX + cubeS, cubeY + i * (cubeS / 4)); ctx.stroke();
  }

  // Sphere (center)
  const sphX = W * 0.56, sphY = H * 0.52, sphR = 72;
  const sphGrad = ctx.createRadialGradient(sphX - 20, sphY - 25, 5, sphX, sphY, sphR);
  sphGrad.addColorStop(0, '#d4ac0d');
  sphGrad.addColorStop(0.5, '#b7950b');
  sphGrad.addColorStop(1, '#6e2f0a');
  ctx.fillStyle = sphGrad;
  ctx.beginPath(); ctx.arc(sphX, sphY, sphR, 0, Math.PI * 2); ctx.fill();
  // Highlight
  ctx.fillStyle = 'rgba(255,255,220,0.3)';
  ctx.beginPath(); ctx.ellipse(sphX - 22, sphY - 28, 20, 14, -Math.PI / 4, 0, Math.PI * 2); ctx.fill();
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(sphX, H * 0.645, sphR * 0.9, 14, 0, 0, Math.PI * 2); ctx.fill();

  // Cone
  const conX = W * 0.72, conBaseY = H * 0.645;
  ctx.fillStyle = '#884ea0';
  ctx.beginPath();
  ctx.moveTo(conX, conBaseY - 160);
  ctx.lineTo(conX - 55, conBaseY);
  ctx.lineTo(conX + 55, conBaseY);
  ctx.closePath(); ctx.fill();
  const conGrad = ctx.createLinearGradient(conX - 55, 0, conX + 55, 0);
  conGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
  conGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  conGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = conGrad;
  ctx.beginPath();
  ctx.moveTo(conX, conBaseY - 160);
  ctx.lineTo(conX - 55, conBaseY);
  ctx.lineTo(conX + 55, conBaseY);
  ctx.closePath(); ctx.fill();
  // Ellipse base
  ctx.fillStyle = '#6c3483';
  ctx.beginPath(); ctx.ellipse(conX, conBaseY, 55, 16, 0, 0, Math.PI * 2); ctx.fill();

  // ── Near: desk lamp (right, tall) ────────────────────────
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(W * 0.88, H * 0.3, 10, H * 0.35);
  ctx.fillRect(W * 0.84, H * 0.63, 70, 12);
  // Lamp head
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(W * 0.885, H * 0.3);
  ctx.lineTo(W * 0.82, H * 0.22);
  ctx.lineTo(W * 0.955, H * 0.22);
  ctx.closePath(); ctx.fill();
  // Light cone
  const lampGrad = ctx.createRadialGradient(W * 0.887, H * 0.3, 0, W * 0.887, H * 0.3, 200);
  lampGrad.addColorStop(0, 'rgba(255,240,180,0.25)');
  lampGrad.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = lampGrad;
  ctx.beginPath();
  ctx.moveTo(W * 0.887, H * 0.3);
  ctx.arc(W * 0.887, H * 0.3, 200, Math.PI * 0.4, Math.PI * 0.75);
  ctx.fill();

  // ── Closest: coffee mug (foreground) ─────────────────────
  const mugX = W * 0.26, mugY = H * 0.57;
  ctx.fillStyle = '#ecf0f1';
  ctx.fillRect(mugX, mugY, 70, 80);
  // Mug handle
  ctx.strokeStyle = '#ecf0f1';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(mugX + 70, mugY + 35, 25, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
  // Coffee surface
  ctx.fillStyle = '#3d1f0a';
  ctx.beginPath(); ctx.ellipse(mugX + 35, mugY + 10, 33, 10, 0, 0, Math.PI * 2); ctx.fill();
  // Mug decoration
  ctx.fillStyle = '#3498db';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('⌨', mugX + 18, mugY + 55);
}

// ── Scene 3: Layered Landscape ────────────────────────────────
function drawLandscape(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  sky.addColorStop(0, '#0d1b2a');
  sky.addColorStop(0.5, '#1b4f72');
  sky.addColorStop(1, '#d35400');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Sun
  ctx.fillStyle = 'rgba(255,180,50,0.9)';
  ctx.beginPath(); ctx.arc(W * 0.78, H * 0.18, 55, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,80,0.3)';
  ctx.beginPath(); ctx.arc(W * 0.78, H * 0.18, 90, 0, Math.PI * 2); ctx.fill();

  // Clouds
  for (let i = 0; i < 4; i++) {
    const cx = W * (0.1 + i * 0.22), cy = H * (0.08 + i * 0.03);
    ctx.fillStyle = 'rgba(220,230,245,0.6)';
    ctx.beginPath(); ctx.ellipse(cx, cy, 60, 25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 30, cy + 8, 40, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 35, cy + 5, 45, 22, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ── Far: snow-capped mountains ────────────────────────────
  ctx.fillStyle = '#5d6d7e';
  ctx.beginPath();
  ctx.moveTo(0, H * 0.5);
  // mountain peaks
  ctx.lineTo(W * 0.05, H * 0.22);
  ctx.lineTo(W * 0.18, H * 0.38);
  ctx.lineTo(W * 0.28, H * 0.14);
  ctx.lineTo(W * 0.42, H * 0.32);
  ctx.lineTo(W * 0.55, H * 0.1);
  ctx.lineTo(W * 0.68, H * 0.28);
  ctx.lineTo(W * 0.78, H * 0.08);
  ctx.lineTo(W * 0.9,  H * 0.26);
  ctx.lineTo(W,        H * 0.18);
  ctx.lineTo(W,        H * 0.5);
  ctx.closePath(); ctx.fill();

  // Snow caps
  ctx.fillStyle = '#ecf0f1';
  const peaks = [
    [W * 0.05, H * 0.22, W * 0.03, H * 0.3],
    [W * 0.28, H * 0.14, W * 0.06, H * 0.26],
    [W * 0.55, H * 0.1,  W * 0.07, H * 0.22],
    [W * 0.78, H * 0.08, W * 0.055, H * 0.19],
  ];
  for (const [px, py, pw, pb] of peaks) {
    ctx.beginPath();
    ctx.moveTo(px - pw, pb);
    ctx.lineTo(px, py);
    ctx.lineTo(px + pw, pb);
    ctx.closePath(); ctx.fill();
  }

  // ── Mid: dark forest treeline ─────────────────────────────
  for (let tx = -20; tx < W + 20; tx += 28) {
    const th = 80 + Math.sin(tx * 0.05) * 30 + Math.random() * 20;
    const ty = H * 0.52 - th;
    ctx.fillStyle = `hsl(${130 + Math.sin(tx * 0.03) * 15}, 40%, ${12 + Math.random() * 8}%)`;
    ctx.beginPath();
    ctx.moveTo(tx + 14, ty);
    ctx.lineTo(tx, H * 0.52);
    ctx.lineTo(tx + 28, H * 0.52);
    ctx.closePath(); ctx.fill();
  }

  // ── Mid-near: river with reflections ──────────────────────
  const river = ctx.createLinearGradient(0, H * 0.57, 0, H * 0.68);
  river.addColorStop(0, '#1a5276');
  river.addColorStop(1, '#154360');
  ctx.fillStyle = river;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.6);
  ctx.quadraticCurveTo(W * 0.3, H * 0.57, W * 0.5, H * 0.6);
  ctx.quadraticCurveTo(W * 0.7, H * 0.63, W, H * 0.6);
  ctx.lineTo(W, H * 0.68);
  ctx.quadraticCurveTo(W * 0.7, H * 0.71, W * 0.5, H * 0.68);
  ctx.quadraticCurveTo(W * 0.3, H * 0.65, 0, H * 0.68);
  ctx.closePath(); ctx.fill();
  // River shimmer
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  for (let rx = 20; rx < W - 20; rx += 60) {
    ctx.beginPath();
    ctx.moveTo(rx, H * 0.62);
    ctx.quadraticCurveTo(rx + 20, H * 0.615, rx + 40, H * 0.62);
    ctx.stroke();
  }

  // Grass bank
  const bank = ctx.createLinearGradient(0, H * 0.68, 0, H);
  bank.addColorStop(0, '#27ae60');
  bank.addColorStop(0.3, '#229954');
  bank.addColorStop(1, '#1e8449');
  ctx.fillStyle = bank;
  ctx.fillRect(0, H * 0.68, W, H * 0.32);

  // ── Near: wildflower meadow ───────────────────────────────
  const flowerColors = ['#e74c3c', '#f39c12', '#9b59b6', '#3498db', '#e91e63', '#fff'];
  for (let i = 0; i < 120; i++) {
    const fx = Math.random() * W;
    const fy = H * 0.72 + Math.random() * H * 0.2;
    const fr = 3 + Math.random() * 5;
    ctx.fillStyle = flowerColors[Math.floor(Math.random() * flowerColors.length)] ?? '#fff';
    ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(fx, fy, fr * 0.4, 0, Math.PI * 2); ctx.fill();
    // Stem
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(fx, fy + fr); ctx.lineTo(fx, fy + fr + 15); ctx.stroke();
  }

  // ── Closest: single detailed tree (left) ──────────────────
  const trunkX = W * 0.1, trunkBot = H;
  ctx.fillStyle = '#5d4037';
  ctx.beginPath();
  ctx.moveTo(trunkX - 20, trunkBot);
  ctx.lineTo(trunkX - 15, H * 0.52);
  ctx.lineTo(trunkX + 15, H * 0.52);
  ctx.lineTo(trunkX + 20, trunkBot);
  ctx.fill();
  // Bark texture
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let by = H * 0.55; by < trunkBot; by += 18) {
    ctx.beginPath();
    ctx.moveTo(trunkX - 14, by);
    ctx.quadraticCurveTo(trunkX, by + 8, trunkX + 14, by);
    ctx.stroke();
  }
  // Branches
  ctx.strokeStyle = '#5d4037';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(trunkX, H * 0.52); ctx.lineTo(trunkX - 60, H * 0.44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(trunkX, H * 0.52); ctx.lineTo(trunkX + 50, H * 0.47); ctx.stroke();
  // Canopy — layered circles
  for (const [cx2, cy2, cr] of [
    [trunkX, H * 0.3, 90], [trunkX - 50, H * 0.36, 65],
    [trunkX + 55, H * 0.37, 60], [trunkX - 20, H * 0.22, 55],
    [trunkX + 25, H * 0.26, 50],
  ]) {
    const leafGrad = ctx.createRadialGradient(cx2 - 10, cy2 - 10, 5, cx2, cy2, cr);
    leafGrad.addColorStop(0, '#27ae60');
    leafGrad.addColorStop(1, '#1a7a42');
    ctx.fillStyle = leafGrad;
    ctx.beginPath(); ctx.arc(cx2, cy2, cr, 0, Math.PI * 2); ctx.fill();
  }
}
