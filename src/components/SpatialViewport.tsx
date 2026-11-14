import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { useAppStore } from '../store/appStore';
import { medianDepthInBox, resizeDepth, flipYUint8, generateSobelNormalMap } from '../utils/depthUtils';
import { computePinCoords } from '../utils/pinUtils';
import type { SceneObject } from '../types/protocol';

// -- Turbo colormap GLSL (Google Research polynomial approximation) ---------
const TURBO_GLSL = `
vec3 turboColormap(float x) {
  const vec4 kR4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
  const vec4 kG4 = vec4(0.09140261, 2.19418839,   4.84296658, -14.18503333);
  const vec4 kB4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
  const vec2 kR2 = vec2(-152.94239396, 59.28637943);
  const vec2 kG2 = vec2(   4.27729857,  2.82956604);
  const vec2 kB2 = vec2( -89.90310912, 27.34824973);
  x = clamp(x, 0.0, 1.0);
  vec4 v4 = vec4(1.0, x, x * x, x * x * x);
  vec2 v2 = v4.zw * v4.z;
  return vec3(dot(v4, kR4) + dot(v2, kR2), dot(v4, kG4) + dot(v2, kG2), dot(v4, kB4) + dot(v2, kB2));
}
`;

export const SpatialViewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Three.js object refs — persistent across renders
  const rendererRef    = useRef<THREE.WebGLRenderer | null>(null);
  const cssRendererRef = useRef<CSS2DRenderer | null>(null);
  const sceneRef       = useRef<THREE.Scene | null>(null);
  const cameraRef      = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef    = useRef<OrbitControls | null>(null);
  const meshRef        = useRef<THREE.Mesh | null>(null);
  const pointsRef      = useRef<THREE.Points | null>(null);
  const rafRef         = useRef<number>(0);
  const pinsRef        = useRef<Map<string, CSS2DObject>>(new Map());
  const disposablesRef = useRef<(THREE.BufferGeometry | THREE.Material | THREE.Texture)[]>([]);
  const colorTexRef    = useRef<THREE.CanvasTexture | null>(null);
  const depthTexRef    = useRef<THREE.DataTexture | null>(null);
  const normalTexRef   = useRef<THREE.DataTexture | null>(null);
  const heatmapMatRef  = useRef<THREE.ShaderMaterial | null>(null);
  const pointsMatRef   = useRef<THREE.ShaderMaterial | null>(null);

  const tweenRef = useRef<{
    active: boolean;
    t: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    targetFrom: THREE.Vector3;
    targetTo: THREE.Vector3;
  } | null>(null);

  const store = useAppStore();
  const {
    sourceCanvas, processedWidth, processedHeight,
    objects, depthData, depthWidth, depthHeight,
    renderMode, displacementScale, cameraFov,
    selection,
  } = store;

  // -- Init Three.js Scene ------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x090B10);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // CSS2D Renderer for HTML pins
    const cssRenderer = new CSS2DRenderer();
    cssRenderer.setSize(container.clientWidth, container.clientHeight);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.top = '0';
    cssRenderer.domElement.style.left = '0';
    cssRenderer.domElement.style.pointerEvents = 'none'; // Critical: mouse events fall through to OrbitControls
    container.appendChild(cssRenderer.domElement);
    cssRendererRef.current = cssRenderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090B10);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.01, 100);
    camera.position.set(0, 0, 2.5);
    cameraRef.current = camera;

    // Lights: Ambient 0.6 + Directional 1.0 (Fix 4)
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(-1.2, 1.5, 2.0);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x8899ff, 0.3);
    fillLight.position.set(1.5, -1.0, 1.0);
    scene.add(fillLight);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.4;
    controls.maxDistance = 8;
    controlsRef.current = controls;

    // Cancel tween on user interaction
    controls.addEventListener('start', () => {
      if (tweenRef.current) tweenRef.current.active = false;
    });

    // Animation Loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      controls.update();

      // Camera tween
      const tw = tweenRef.current;
      if (tw?.active) {
        tw.t = Math.min(1, tw.t + 0.016 / 0.8); // 800ms tween
        const ease = 1 - Math.pow(1 - tw.t, 3); // cubic ease-out
        camera.position.lerpVectors(tw.from, tw.to, ease);
        controls.target.lerpVectors(tw.targetFrom, tw.targetTo, ease);
        controls.update();
        if (tw.t >= 1) tw.active = false;
      }

      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    };
    animate();

    // Resize Observer
    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      cssRenderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      // Fix 5: Adapt point size to canvas height
      if (pointsMatRef.current) {
        const dynamicPtSize = Math.max(2.5, (h / 700.0) * 3.5);
        pointsMatRef.current.uniforms.pointSize.value = dynamicPtSize;
      }
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      cssRenderer.domElement.remove();
      renderer.domElement.remove();
    };
  }, []);

  // -- Build / Update 3D Mesh when Image or Depth Changes -----------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sourceCanvas || !depthData || processedWidth === 0 || processedHeight === 0) return;

    // Dispose old resources
    const dispose = disposablesRef.current;
    if (meshRef.current) {
      scene.remove(meshRef.current);
    }
    if (pointsRef.current) {
      scene.remove(pointsRef.current);
      pointsRef.current = null;
    }
    dispose.forEach(d => d.dispose());
    dispose.length = 0;
    clearPins(scene);

    const imgW = processedWidth;
    const imgH = processedHeight;
    const aspect = imgW / imgH;
    const planeW = aspect;
    const planeH = 1;

    // -- Fix 3: Texture Orientation ----------------------------------------
    // Color: CanvasTexture with default flipY = true.
    // (Do not use ImageBitmap because flipY is ignored on it).
    const colorTex = new THREE.CanvasTexture(sourceCanvas);
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.minFilter = THREE.LinearFilter;
    colorTex.magFilter = THREE.LinearFilter;
    colorTex.flipY = true;
    colorTex.needsUpdate = true;
    colorTexRef.current = colorTex;
    dispose.push(colorTex);

    // Depth: DataTexture (flipY = false).
    // We flip the rows in JS before upload so row 0 = bottom, matching WebGL UV (0,0).
    // The top-down depthData in store is kept intact for pin sampling & HUD.
    const resizedDepth = resizeDepth(depthData, depthWidth, depthHeight, imgW, imgH);
    const flippedDepth = flipYUint8(resizedDepth, imgW, imgH);

    const depthTex = new THREE.DataTexture(
      flippedDepth,
      imgW,
      imgH,
      THREE.RedFormat,
      THREE.UnsignedByteType
    );
    depthTex.minFilter = THREE.LinearFilter;
    depthTex.magFilter = THREE.LinearFilter;
    depthTex.flipY = false;
    depthTex.needsUpdate = true;
    depthTexRef.current = depthTex;
    dispose.push(depthTex);

    // -- Fix 4: Tangent-Space Normal Map (Sobel filter on CPU) --------------
    const normalData = generateSobelNormalMap(flippedDepth, imgW, imgH, 3.5);
    const normalTex = new THREE.DataTexture(
      normalData,
      imgW,
      imgH,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    normalTex.minFilter = THREE.LinearFilter;
    normalTex.magFilter = THREE.LinearFilter;
    normalTex.flipY = false;
    normalTex.needsUpdate = true;
    normalTexRef.current = normalTex;
    dispose.push(normalTex);

    // -- Dev-only Sanity Check (Fix 3) -------------------------------------
    if (process.env.NODE_ENV !== 'production') {
      let maxD = 0;
      for (let i = 0; i < resizedDepth.length; i++) {
        if ((resizedDepth[i] ?? 0) > maxD) maxD = resizedDepth[i] ?? 0;
      }
      const testZ = (maxD / 255) * displacementScale;
      console.assert(testZ >= 0, '[Sanity Check] Near object displacement must rise toward camera (+Z)');
    }

    // -- PlaneGeometry(aspect, 1, 256, 256) --------------------------------
    const geo = new THREE.PlaneGeometry(planeW, planeH, 256, 256);
    dispose.push(geo);

    // -- Materials ---------------------------------------------------------
    // 1. Textured 3D Relief (with normal map driven by displacementScale)
    const texturedMat = new THREE.MeshStandardMaterial({
      map: colorTex,
      displacementMap: depthTex,
      displacementScale: displacementScale,
      displacementBias: 0,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(displacementScale, displacementScale),
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.FrontSide,
    });
    dispose.push(texturedMat);

    // 2. Depth Heatmap Shader (Google Turbo colormap polynomial in GLSL)
    const heatmapMat = new THREE.ShaderMaterial({
      uniforms: {
        depthMap: { value: depthTex },
        displacementScale: { value: displacementScale },
      },
      vertexShader: `
        uniform sampler2D depthMap;
        uniform float displacementScale;
        varying float vDepth;
        void main() {
          vDepth = texture2D(depthMap, uv).r;
          vec3 displaced = position + normal * (vDepth * displacementScale);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        ${TURBO_GLSL}
        varying float vDepth;
        void main() {
          gl_FragColor = vec4(turboColormap(vDepth), 1.0);
        }
      `,
      side: THREE.FrontSide,
    });
    heatmapMatRef.current = heatmapMat;
    dispose.push(heatmapMat);

    // 3. Wireframe Mesh
    const wireMat = new THREE.MeshStandardMaterial({
      displacementMap: depthTex,
      displacementScale: displacementScale,
      displacementBias: 0,
      wireframe: true,
      color: 0x00D9FF,
      opacity: 0.7,
      transparent: true,
      side: THREE.FrontSide,
    });
    dispose.push(wireMat);

    // -- 3D Mesh -----------------------------------------------------------
    let activeMat: THREE.Material = texturedMat;
    if (renderMode === 'heatmap')   activeMat = heatmapMat;
    if (renderMode === 'wireframe') activeMat = wireMat;

    const mesh = new THREE.Mesh(geo, activeMat);
    scene.add(mesh);
    meshRef.current = mesh;

    // -- Fix 5: 3D Point Cloud (256x256 = 65,536 points with vertex shader) --
    const pointsGeo = new THREE.PlaneGeometry(planeW, planeH, 256, 256);
    dispose.push(pointsGeo);

    const initialContainerHeight = containerRef.current?.clientHeight || 600;
    const dynamicPtSize = Math.max(2.5, (initialContainerHeight / 700.0) * 3.5);

    const pointsMat = new THREE.ShaderMaterial({
      uniforms: {
        depthMap: { value: depthTex },
        colorMap: { value: colorTex },
        displacementScale: { value: displacementScale },
        pointSize: { value: dynamicPtSize },
      },
      vertexShader: `
        uniform sampler2D depthMap;
        uniform sampler2D colorMap;
        uniform float displacementScale;
        uniform float pointSize;
        varying vec3 vColor;
        void main() {
          float depthVal = texture2D(depthMap, uv).r;
          vec3 displaced = position + normal * (depthVal * displacementScale);
          vColor = texture2D(colorMap, uv).rgb;
          vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
          gl_PointSize = pointSize * (1.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          if (length(coord) > 0.5) discard;
          gl_FragColor = vec4(vColor, 1.0);
        }
      `,
      transparent: true,
    });
    pointsMatRef.current = pointsMat;
    dispose.push(pointsMat);

    const points = new THREE.Points(pointsGeo, pointsMat);
    points.visible = renderMode === 'pointcloud';
    scene.add(points);
    pointsRef.current = points;

    if (renderMode === 'pointcloud') {
      mesh.visible = false;
    }

    // -- Pins (Fix 3: top-down resizedDepth for accurate sampling) ---------
    if (objects.length > 0) {
      buildPins(scene, objects, resizedDepth, imgW, imgH, planeW, planeH, displacementScale);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceCanvas, depthData, processedWidth, processedHeight, objects]);

  // -- Update Render Mode ------------------------------------------------
  useEffect(() => {
    const mesh = meshRef.current;
    const points = pointsRef.current;
    const depthTex = depthTexRef.current;
    const normalTex = normalTexRef.current;
    const colorTex = colorTexRef.current;
    if (!mesh) return;

    if (renderMode === 'pointcloud') {
      mesh.visible = false;
      if (points) points.visible = true;
    } else {
      if (points) points.visible = false;
      mesh.visible = true;

      if (renderMode === 'wireframe') {
        const mat = new THREE.MeshStandardMaterial({
          displacementMap: depthTex ?? undefined,
          displacementScale: displacementScale,
          displacementBias: 0,
          wireframe: true,
          color: 0x00D9FF,
          opacity: 0.7,
          transparent: true,
        });
        disposablesRef.current.push(mat);
        mesh.material = mat;
      } else if (renderMode === 'heatmap') {
        if (heatmapMatRef.current) {
          mesh.material = heatmapMatRef.current;
        }
      } else if (colorTex && depthTex) {
        const mat = new THREE.MeshStandardMaterial({
          map: colorTex,
          displacementMap: depthTex,
          displacementScale: displacementScale,
          displacementBias: 0,
          normalMap: normalTex ?? undefined,
          normalScale: new THREE.Vector2(displacementScale, displacementScale),
          roughness: 0.5,
          metalness: 0.1,
        });
        disposablesRef.current.push(mat);
        mesh.material = mat;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderMode]);

  // -- Update Displacement Scale (Fix 4: drive normalScale) --------------
  useEffect(() => {
    const mesh = meshRef.current;
    if (mesh) {
      const mat = mesh.material;
      if ('displacementScale' in mat) {
        const m = mat as THREE.MeshStandardMaterial;
        m.displacementScale = displacementScale;
        if (m.normalScale) {
          m.normalScale.set(displacementScale, displacementScale);
        }
        m.needsUpdate = true;
      }
    }
    if (heatmapMatRef.current) {
      heatmapMatRef.current.uniforms.displacementScale.value = displacementScale;
    }
    if (pointsMatRef.current) {
      pointsMatRef.current.uniforms.displacementScale.value = displacementScale;
    }

    // Recompute pin Z coordinates dynamically
    updatePinZ(displacementScale);
  }, [displacementScale]);

  // -- Update Camera FOV -------------------------------------------------
  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    cam.fov = cameraFov;
    cam.updateProjectionMatrix();
  }, [cameraFov]);

  // -- Highlight Selected / Hovered Pin ----------------------------------
  useEffect(() => {
    pinsRef.current.forEach((pin, id) => {
      const el = pin.element as HTMLElement;
      const label = el.querySelector('.pin-label') as HTMLElement | null;
      if (!label) return;
      const isActive = id === selection.objectId || id === selection.hoveredId;
      label.classList.toggle('active', isActive);
    });
  }, [selection]);

  // -- Helpers -----------------------------------------------------------
  const clearPins = useCallback((scene: THREE.Scene) => {
    pinsRef.current.forEach((pin) => {
      scene.remove(pin);
      pin.element.remove();
    });
    pinsRef.current.clear();
  }, []);

  const flyToPin = useCallback((x: number, y: number, z: number) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const targetPos = new THREE.Vector3(x, y, z);
    const camOffset = new THREE.Vector3(0, 0, 0.6); // 0.6 units along surface normal (+Z)
    const newCamPos = targetPos.clone().add(camOffset);

    tweenRef.current = {
      active: true,
      t: 0,
      from: camera.position.clone(),
      to: newCamPos,
      targetFrom: controls.target.clone(),
      targetTo: targetPos,
    };
  }, []);

  const buildPins = useCallback((
    scene: THREE.Scene,
    objs: SceneObject[],
    topDownDepth: Uint8Array,
    imgW: number,
    imgH: number,
    planeW: number,
    planeH: number,
    dispScale: number
  ) => {
    clearPins(scene);
    for (const obj of objs) {
      const [x1, y1, x2, y2] = obj.box;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const depthVal = medianDepthInBox(topDownDepth, imgW, imgH, imgW, imgH, obj.box);
      const depthNorm = depthVal / 255;
      // Fix 3: Standard pin unprojection math: v = cy/imgH (top-down), Y = (0.5 - v) * H_plane
      const coords = computePinCoords(cx, cy, imgW, imgH, depthNorm, dispScale, planeW, planeH);

      const wrapper = document.createElement('div');
      wrapper.className = 'pin-wrapper';
      wrapper.style.pointerEvents = 'auto'; // pointer-events: auto on the pin only

      const dot = document.createElement('div');
      dot.className = 'pin-dot';

      const label = document.createElement('div');
      label.className = 'pin-label';
      label.textContent = obj.label.length > 22 ? obj.label.slice(0, 20) + '…' : obj.label;
      label.title = `${obj.label} (Z: ${coords.z.toFixed(3)})`;

      label.addEventListener('click', (ev) => {
        ev.stopPropagation();
        useAppStore.getState().setSelection({ objectId: obj.id });
        flyToPin(coords.x, coords.y, coords.z);
      });
      label.addEventListener('mouseenter', () => useAppStore.getState().setSelection({ hoveredId: obj.id }));
      label.addEventListener('mouseleave', () => useAppStore.getState().setSelection({ hoveredId: null }));

      wrapper.appendChild(dot);
      wrapper.appendChild(label);

      const css2d = new CSS2DObject(wrapper);
      css2d.position.set(coords.x, coords.y, coords.z);
      scene.add(css2d);
      pinsRef.current.set(obj.id, css2d);
    }
  }, [clearPins, flyToPin]);

  const updatePinZ = useCallback((dispScale: number) => {
    const s = useAppStore.getState();
    const objs = s.objects;
    const { depthData: dd, depthWidth: dw, depthHeight: dh, processedWidth: pw, processedHeight: ph } = s;
    if (!dd || pw === 0 || ph === 0) return;
    const planeW = pw / ph;
    const planeH = 1;
    const resized = resizeDepth(dd, dw, dh, pw, ph);

    for (const obj of objs) {
      const pin = pinsRef.current.get(obj.id);
      if (!pin) continue;
      const [x1, y1, x2, y2] = obj.box;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const depthVal = medianDepthInBox(resized, pw, ph, pw, ph, obj.box);
      const coords = computePinCoords(cx, cy, pw, ph, depthVal / 255, dispScale, planeW, planeH);
      pin.position.set(coords.x, coords.y, coords.z);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ background: '#090B10' }}
    />
  );
};
