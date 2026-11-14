// ============================================================
//  Procedural sample scenes — high contrast, flat-shaded,
//  dark outlines, distinct depths, subtle depth cues (haze, shadows, scale),
//  and strictly asymmetric to make flipping/mirroring bugs obvious.
// ============================================================

export type SampleSceneId = 'streetscape' | 'stilllife' | 'landscape';

export const SAMPLE_SCENES: { id: SampleSceneId; label: string; desc: string }[] = [
  { id: 'streetscape', label: 'City Street', desc: 'Asymmetric street with shops, hydrants, signs and layered buildings' },
  { id: 'stilllife',   label: 'Desk Still Life', desc: 'Geometric solids, lamp, mug, books and potted plant' },
  { id: 'landscape',   label: 'Alpine Valley', desc: 'Mountain peak, cabin, stone bridge, river, and ancient oak' },
];

export async function renderScene(id: SampleSceneId): Promise<{ canvas: HTMLCanvasElement; bitmap: ImageBitmap }> {
  const W = 1024;
  const H = 768;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  if (id === 'streetscape') {
    drawStreetscape(ctx, W, H);
  } else if (id === 'stilllife') {
    drawStillLife(ctx, W, H);
  } else {
    drawLandscape(ctx, W, H);
  }

  const bitmap = await createImageBitmap(canvas);
  return { canvas, bitmap };
}

// -- Helpers for High-Contrast Outlines and Depth Cues ---------
function strokeShape(ctx: CanvasRenderingContext2D, lineWidth = 2.5, strokeColor = '#0F172A') {
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = strokeColor;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, alpha = 0.35) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(15, 23, 42, ${alpha})`;
  ctx.fill();
  ctx.restore();
}

// -- Scene 1: Architectural City Streetscape (Asymmetric) ------
function drawStreetscape(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // 1. Sky & Atmospheric Haze (Far, Depth ~ 0.05)
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, '#1E293B');
  sky.addColorStop(1, '#475569');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Distant pale moon (Upper Left)
  ctx.beginPath();
  ctx.arc(160, 100, 45, 0, Math.PI * 2);
  ctx.fillStyle = '#FEF08A';
  ctx.fill();
  strokeShape(ctx, 2, '#CA8A04');

  // 2. Far Distant Buildings (Asymmetric, Left-Heavy, Depth ~ 0.2)
  ctx.fillStyle = '#334155';
  ctx.fillRect(40, 140, 110, 320); // Tall skyscraper left
  ctx.strokeRect(40, 140, 110, 320);
  ctx.fillRect(160, 200, 80, 260);
  ctx.strokeRect(160, 200, 80, 260);

  // Spire on tall skyscraper
  ctx.beginPath();
  ctx.moveTo(95, 140);
  ctx.lineTo(95, 70);
  ctx.stroke();

  // Low mid buildings on Right
  ctx.fillStyle = '#475569';
  ctx.fillRect(620, 250, 140, 210);
  ctx.strokeRect(620, 250, 140, 210);
  ctx.fillRect(780, 220, 120, 240);
  ctx.strokeRect(780, 220, 120, 240);

  // 3. Mid-Distance Clock Tower (Left-Center, Depth ~ 0.4)
  ctx.fillStyle = '#78350F'; // Dark amber brick
  ctx.fillRect(260, 160, 120, 300);
  strokeShape(ctx);
  // Clock face
  ctx.beginPath();
  ctx.arc(320, 220, 32, 0, Math.PI * 2);
  ctx.fillStyle = '#FEF3C7';
  ctx.fill();
  strokeShape(ctx, 2);
  // Clock hands
  ctx.beginPath();
  ctx.moveTo(320, 220);
  ctx.lineTo(320, 200);
  ctx.moveTo(320, 220);
  ctx.lineTo(335, 220);
  ctx.stroke();

  // 4. Bakery Storefront with Awning (Center-Right, Depth ~ 0.5)
  ctx.fillStyle = '#CBD5E1';
  ctx.fillRect(410, 240, 200, 220);
  strokeShape(ctx);
  // Sign "BAKERY"
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(430, 250, 160, 32);
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('BAKERY', 475, 272);
  // Striped Awning
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#EF4444' : '#FFFFFF';
    ctx.fillRect(410 + i * 25, 285, 25, 30);
    ctx.strokeRect(410 + i * 25, 285, 25, 30);
  }

  // Pavement / Road Plane with Perspective Line
  ctx.fillStyle = '#64748B';
  ctx.fillRect(0, 460, W, H - 460);
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 520, W, H - 520);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 520);
  ctx.lineTo(W, 520);
  ctx.stroke();

  // 5. Deciduous Green Tree (Right, Depth ~ 0.6)
  drawShadow(ctx, 720, 560, 50, 14);
  // Trunk
  ctx.fillStyle = '#78350F';
  ctx.fillRect(705, 360, 30, 180);
  strokeShape(ctx);
  // Foliage
  ctx.beginPath();
  ctx.arc(720, 340, 75, 0, Math.PI * 2);
  ctx.fillStyle = '#16A34A';
  ctx.fill();
  strokeShape(ctx);

  // 6. Red Park Bench (Right of Tree, Depth ~ 0.7)
  drawShadow(ctx, 840, 580, 55, 12);
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(790, 510, 100, 20);
  ctx.fillRect(790, 535, 100, 14);
  ctx.strokeRect(790, 510, 100, 20);
  ctx.strokeRect(790, 535, 100, 14);
  // Legs
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(800, 549, 10, 28);
  ctx.fillRect(870, 549, 10, 28);

  // 7. Blue Mailbox (Foreground Left, Depth ~ 0.8)
  drawShadow(ctx, 220, 670, 45, 16);
  ctx.fillStyle = '#2563EB';
  ctx.beginPath();
  ctx.roundRect(180, 540, 80, 110, [35, 35, 6, 6]);
  ctx.fill();
  strokeShape(ctx, 3);
  // Mail slot
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(195, 570, 50, 10);

  // 8. Yellow Fire Hydrant (Foreground Center-Left, Depth ~ 0.9)
  drawShadow(ctx, 360, 720, 40, 15);
  ctx.fillStyle = '#EAB308';
  // Base & body
  ctx.fillRect(330, 620, 60, 90);
  strokeShape(ctx, 3);
  // Cap
  ctx.beginPath();
  ctx.arc(360, 620, 30, Math.PI, 0);
  ctx.fillStyle = '#CA8A04';
  ctx.fill();
  strokeShape(ctx, 3);
  // Side nozzles
  ctx.fillStyle = '#EAB308';
  ctx.fillRect(315, 645, 15, 20);
  ctx.strokeRect(315, 645, 15, 20);
  ctx.fillRect(390, 645, 15, 20);
  ctx.strokeRect(390, 645, 15, 20);

  // 9. Street Sign Post reading "1ST AVE" (Foreground Far Left, Depth ~ 0.95)
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(60, 400, 14, 340);
  strokeShape(ctx, 2.5);
  // Sign plate
  ctx.fillStyle = '#059669'; // Emerald street sign
  ctx.fillRect(30, 420, 140, 36);
  strokeShape(ctx, 2.5);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('1ST AVE', 58, 444);
}

// -- Scene 2: Geometric Desk Still Life (Asymmetric) -----------
function drawStillLife(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // 1. Studio Backdrop (Depth ~ 0.1)
  const bg = ctx.createLinearGradient(0, 0, W, H * 0.7);
  bg.addColorStop(0, '#1E1E2E');
  bg.addColorStop(1, '#313244');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Notice board on far right wall (Depth ~ 0.15)
  ctx.fillStyle = '#D97706';
  ctx.fillRect(720, 60, 240, 160);
  strokeShape(ctx, 3);
  // Pinned note "MEMO"
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(760, 90, 100, 80);
  strokeShape(ctx, 1.5);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('STUDIO', 780, 135);

  // Dark polished desk surface (Depth ~ 0.4 to 1.0)
  ctx.fillStyle = '#181825';
  ctx.fillRect(0, 380, W, H - 380);
  ctx.strokeStyle = '#45475A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 380);
  ctx.lineTo(W, 380);
  ctx.stroke();

  // 2. Terracotta Potted Plant (Far Left, Depth ~ 0.35)
  drawShadow(ctx, 130, 470, 50, 16);
  // Pot
  ctx.fillStyle = '#EA580C';
  ctx.beginPath();
  ctx.moveTo(90, 380);
  ctx.lineTo(170, 380);
  ctx.lineTo(155, 460);
  ctx.lineTo(105, 460);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx);
  // Cactus ribbed lobes
  ctx.fillStyle = '#15803D';
  ctx.beginPath();
  ctx.ellipse(130, 320, 35, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx);
  ctx.beginPath();
  ctx.ellipse(100, 330, 18, 30, -0.4, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx);

  // 3. Wooden Triangular Ruler (Left-Center, Depth ~ 0.5)
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.moveTo(250, 480);
  ctx.lineTo(390, 480);
  ctx.lineTo(250, 330);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, 2.5);

  // 4. Isometric Cyan Cube (Center, Depth ~ 0.6)
  drawShadow(ctx, 470, 510, 60, 20);
  // Top face
  ctx.fillStyle = '#67E8F9';
  ctx.beginPath();
  ctx.moveTo(470, 380);
  ctx.lineTo(530, 410);
  ctx.lineTo(470, 440);
  ctx.lineTo(410, 410);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx);
  // Left face
  ctx.fillStyle = '#06B6D4';
  ctx.beginPath();
  ctx.moveTo(410, 410);
  ctx.lineTo(470, 440);
  ctx.lineTo(470, 500);
  ctx.lineTo(410, 470);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx);
  // Right face
  ctx.fillStyle = '#0891B2';
  ctx.beginPath();
  ctx.moveTo(470, 440);
  ctx.lineTo(530, 410);
  ctx.lineTo(530, 470);
  ctx.lineTo(470, 500);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx);

  // 5. Magenta Sphere (Center-Right, Depth ~ 0.7)
  drawShadow(ctx, 620, 570, 55, 18);
  ctx.beginPath();
  ctx.arc(620, 500, 55, 0, Math.PI * 2);
  ctx.fillStyle = '#D946EF';
  ctx.fill();
  strokeShape(ctx, 3);
  // Highlight
  ctx.beginPath();
  ctx.arc(605, 480, 16, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fill();

  // 6. Yellow Gooseneck Lamp (Far Right, Depth ~ 0.8)
  drawShadow(ctx, 880, 680, 70, 20);
  // Base
  ctx.fillStyle = '#CA8A04';
  ctx.fillRect(830, 640, 100, 25);
  strokeShape(ctx, 3);
  // Neck
  ctx.beginPath();
  ctx.moveTo(880, 640);
  ctx.bezierCurveTo(900, 460, 800, 320, 750, 360);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#EAB308';
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();
  // Lamp head
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  ctx.ellipse(740, 380, 35, 50, -0.6, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx, 3);

  // 7. Stack of Three Books (Foreground Left, Depth ~ 0.88)
  drawShadow(ctx, 220, 710, 90, 22);
  // Bottom book (Blue)
  ctx.fillStyle = '#3B82F6';
  ctx.fillRect(130, 650, 180, 32);
  strokeShape(ctx, 2.5);
  // Middle book (Red)
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(145, 620, 160, 30);
  strokeShape(ctx, 2.5);
  // Top book (Emerald)
  ctx.fillStyle = '#10B981';
  ctx.fillRect(155, 595, 140, 25);
  strokeShape(ctx, 2.5);

  // 8. Ceramic Coffee Mug labeled "COFFEE" (Foreground Center, Depth ~ 0.96)
  drawShadow(ctx, 420, 730, 50, 18);
  ctx.fillStyle = '#F43F5E';
  // Cup body
  ctx.beginPath();
  ctx.roundRect(380, 600, 80, 105, [6, 6, 20, 20]);
  ctx.fill();
  strokeShape(ctx, 3);
  // Handle
  ctx.beginPath();
  ctx.arc(465, 650, 22, -Math.PI / 2, Math.PI / 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#F43F5E';
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();
  // Label text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('COFFEE', 393, 658);
}

// -- Scene 3: Layered Alpine Valley (Asymmetric) ---------------
function drawLandscape(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // 1. Alpine Sky & Cloud (Depth ~ 0.05)
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  sky.addColorStop(0, '#0284C7');
  sky.addColorStop(1, '#BAE6FD');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Fluffy cloud (Left)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(220, 110, 35, 0, Math.PI * 2);
  ctx.arc(260, 95, 45, 0, Math.PI * 2);
  ctx.arc(300, 110, 35, 0, Math.PI * 2);
  ctx.fill();

  // 2. Snow-Capped Granite Mountain (Far Right Exclusively, Depth ~ 0.2)
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(560, 440);
  ctx.lineTo(820, 90);
  ctx.lineTo(1040, 440);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, 3);
  // Snow cap
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(820, 90);
  ctx.lineTo(760, 180);
  ctx.lineTo(790, 170);
  ctx.lineTo(820, 200);
  ctx.lineTo(855, 175);
  ctx.lineTo(885, 190);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, 2);

  // 3. Purple Distant Ridge (Left-Center, Depth ~ 0.35)
  ctx.fillStyle = '#6366F1';
  ctx.beginPath();
  ctx.moveTo(0, 440);
  ctx.lineTo(0, 280);
  ctx.lineTo(240, 230);
  ctx.lineTo(460, 320);
  ctx.lineTo(600, 440);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, 2);

  // 4. Pine Forest Belt (Mid-distance, Depth ~ 0.5)
  const drawPine = (x: number, y: number, h: number) => {
    ctx.fillStyle = '#065F46';
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x - h * 0.35, y);
    ctx.lineTo(x + h * 0.35, y);
    ctx.closePath();
    ctx.fill();
    strokeShape(ctx, 1.5);
  };
  for (let px = 60; px < 560; px += 35) {
    drawPine(px, 440, 55 + (px % 25));
  }

  // Rolling Grass Foothill
  ctx.fillStyle = '#15803D';
  ctx.beginPath();
  ctx.moveTo(0, 440);
  ctx.quadraticCurveTo(W * 0.4, 420, W, 480);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // 5. Wooden Log Cabin with Smoking Chimney (Mid Left, Depth ~ 0.6)
  drawShadow(ctx, 260, 510, 60, 18);
  // Walls
  ctx.fillStyle = '#78350F';
  ctx.fillRect(200, 410, 120, 80);
  strokeShape(ctx, 2.5);
  // Roof
  ctx.fillStyle = '#991B1B';
  ctx.beginPath();
  ctx.moveTo(185, 410);
  ctx.lineTo(260, 350);
  ctx.lineTo(335, 410);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, 2.5);
  // Chimney & smoke
  ctx.fillStyle = '#475569';
  ctx.fillRect(285, 330, 18, 40);
  strokeShape(ctx);
  // Smoke puffs
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(295, 310, 10, 0, Math.PI * 2);
  ctx.arc(310, 285, 14, 0, Math.PI * 2);
  ctx.fill();

  // 6. Winding Blue River across Middle Ground (Depth ~ 0.7)
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.moveTo(W, 490);
  ctx.bezierCurveTo(680, 500, 520, 600, 0, 620);
  ctx.lineTo(0, 690);
  ctx.bezierCurveTo(550, 670, 720, 540, W, 550);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, 2.5, '#0369A1');

  // 7. Stone Arch Bridge over River (Center-Right, Depth ~ 0.75)
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.roundRect(580, 500, 140, 45, [8, 8, 0, 0]);
  ctx.fill();
  strokeShape(ctx, 2.5);
  // Arch cutout
  ctx.fillStyle = '#0284C7';
  ctx.beginPath();
  ctx.arc(650, 545, 35, Math.PI, 0);
  ctx.fill();
  strokeShape(ctx, 2.5);

  // 8. Wildflower Meadow (Foreground Right, Depth ~ 0.85)
  const drawFlower = (fx: number, fy: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(fx, fy, 7, 0, Math.PI * 2);
    ctx.fill();
    strokeShape(ctx, 1);
  };
  drawFlower(780, 640, '#EF4444');
  drawFlower(830, 660, '#EAB308');
  drawFlower(880, 630, '#EC4899');
  drawFlower(920, 670, '#F97316');
  drawFlower(860, 690, '#A855F7');

  // 9. Giant Ancient Oak Tree (Foreground Far Left Exclusively, Depth ~ 0.95)
  drawShadow(ctx, 150, 750, 80, 22);
  // Trunk
  ctx.fillStyle = '#451A03';
  ctx.beginPath();
  ctx.moveTo(110, 740);
  ctx.quadraticCurveTo(140, 550, 130, 390);
  ctx.lineTo(170, 390);
  ctx.quadraticCurveTo(175, 550, 195, 740);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, 3.5);
  // Canopy
  ctx.fillStyle = '#15803D';
  ctx.beginPath();
  ctx.arc(150, 360, 110, 0, Math.PI * 2);
  ctx.fill();
  strokeShape(ctx, 3.5);

  // 10. Wooden Trail Sign reading "TRAIL" (Foreground Left under tree, Depth ~ 0.98)
  ctx.fillStyle = '#78350F';
  ctx.fillRect(80, 620, 12, 110);
  strokeShape(ctx, 2.5);
  // Arrow pointing right
  ctx.fillStyle = '#F59E0B';
  ctx.beginPath();
  ctx.moveTo(50, 630);
  ctx.lineTo(130, 630);
  ctx.lineTo(150, 645);
  ctx.lineTo(130, 660);
  ctx.lineTo(50, 660);
  ctx.closePath();
  ctx.fill();
  strokeShape(ctx, 2.5);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('TRAIL ?', 60, 649);
}
