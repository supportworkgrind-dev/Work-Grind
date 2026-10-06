'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

/* ─────────────────────────────────────────────────────────────────────────────
   WorkspaceOrb3D
   A cinematic, floating 3D scene representing a connected digital workspace.
   • Central icosahedron core with glass material
   • Orbiting feature satellites (Chat, Tasks, Meetings, Projects, AI, Calendar)
   • Dual orbit rings at different axes
   • Floating particle field
   • Mouse-responsive camera parallax
   • IntersectionObserver-based pause when off-screen
   • Proper resource disposal
───────────────────────────────────────────────────────────────────────────── */

interface WorkspaceOrb3DProps {
  className?: string;
  reducedMotion?: boolean;
}

/* Feature satellite descriptors */
const SATELLITES = [
  { label: 'Chat',      color: 0x3b82f6, radius: 0.28, orbit: 2.8, speed: 0.38, phase: 0 },
  { label: 'Tasks',     color: 0x6366f1, radius: 0.22, orbit: 2.2, speed: 0.55, phase: Math.PI / 3 },
  { label: 'Meetings',  color: 0x06b6d4, radius: 0.30, orbit: 3.2, speed: 0.29, phase: (2 * Math.PI) / 3 },
  { label: 'Projects',  color: 0x8b5cf6, radius: 0.24, orbit: 2.5, speed: 0.47, phase: Math.PI },
  { label: 'AI',        color: 0x38bdf8, radius: 0.32, orbit: 2.9, speed: 0.34, phase: (4 * Math.PI) / 3 },
  { label: 'Calendar',  color: 0x818cf8, radius: 0.20, orbit: 2.0, speed: 0.62, phase: (5 * Math.PI) / 3 },
];

export function WorkspaceOrb3D({ className = '', reducedMotion = false }: WorkspaceOrb3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef     = useRef<number>(0);
  const clockRef     = useRef(new THREE.Clock());

  const buildScene = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    /* ── Canvas ── */
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    container.appendChild(canvas);

    const W = container.clientWidth  || 600;
    const H = container.clientHeight || 600;

    /* ── Renderer ── */
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled  = false; // perf

    /* ── Scene ── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    camera.position.set(0, 0, 11);

    /* ── Lights ── */
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const blueLight = new THREE.DirectionalLight(0x3b82f6, 4.0);
    blueLight.position.set(6, 8, 6);
    scene.add(blueLight);

    const cyanLight = new THREE.DirectionalLight(0x06b6d4, 2.5);
    cyanLight.position.set(-8, -4, 4);
    scene.add(cyanLight);

    const violetPoint = new THREE.PointLight(0x8b5cf6, 3.0, 20);
    violetPoint.position.set(0, 3, -3);
    scene.add(violetPoint);

    const warmPoint = new THREE.PointLight(0x60a5fa, 1.5, 12);
    warmPoint.position.set(-4, -2, 5);
    scene.add(warmPoint);

    /* ── Central core (icosahedron, glass-like) ── */
    const coreGeo = new THREE.IcosahedronGeometry(1.35, 3);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color:               0x1e40af,
      metalness:           0.05,
      roughness:           0.08,
      clearcoat:           1.0,
      clearcoatRoughness:  0.06,
      transmission:        0.25,
      thickness:           1.2,
      reflectivity:        1.0,
      envMapIntensity:     1.2,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    /* Inner glow sphere */
    const glowGeo = new THREE.SphereGeometry(0.9, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color:       0x3b82f6,
      transparent: true,
      opacity:     0.12,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowMesh);

    /* ── Orbit rings ── */
    const makeRing = (radius: number, tube: number, rotX: number, rotZ: number, color: number, opacity: number) => {
      const geo  = new THREE.TorusGeometry(radius, tube, 16, 128);
      const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = rotX;
      mesh.rotation.z = rotZ;
      scene.add(mesh);
      return { mesh, mat, geo };
    };

    const ring1 = makeRing(2.6, 0.018, Math.PI / 4,   0.3,         0x60a5fa, 0.40);
    const ring2 = makeRing(3.3, 0.012, -Math.PI / 5,  -0.2,        0x818cf8, 0.28);
    const ring3 = makeRing(2.0, 0.010,  Math.PI / 2.5, Math.PI / 7, 0x06b6d4, 0.22);

    /* ── Satellites ── */
    const satelliteMeshes: THREE.Mesh[] = [];
    const satelliteMats:   THREE.MeshPhysicalMaterial[] = [];
    const satelliteGeos:   THREE.BufferGeometry[] = [];

    SATELLITES.forEach((sat) => {
      const geo = new THREE.IcosahedronGeometry(sat.radius, 1);
      const mat = new THREE.MeshPhysicalMaterial({
        color:             sat.color,
        metalness:         0.2,
        roughness:         0.15,
        clearcoat:         0.8,
        clearcoatRoughness: 0.08,
        emissive:          sat.color,
        emissiveIntensity: 0.18,
      });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      satelliteMeshes.push(mesh);
      satelliteMats.push(mat);
      satelliteGeos.push(geo);
    });

    /* ── Particles ── */
    const PARTICLE_COUNT = 320;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r     = 4 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat  = new THREE.PointsMaterial({
      color:       0x93c5fd,
      size:        0.045,
      transparent: true,
      opacity:     0.55,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    /* ── Mouse parallax state ── */
    let targetMX = 0, targetMY = 0;
    let curMX    = 0, curMY    = 0;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetMX =  ((e.clientX - rect.left) / rect.width  - 0.5) * 1.8;
      targetMY = -((e.clientY - rect.top)  / rect.height - 0.5) * 1.8;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    /* ── Visibility ── */
    let visible = true;
    const observer = new IntersectionObserver(
      ([e]) => { visible = e.isIntersecting; },
      { threshold: 0.05 }
    );
    observer.observe(container);

    /* ── Resize ── */
    const resizeObs = new ResizeObserver(() => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      if (!nw || !nh) return;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    resizeObs.observe(container);

    /* ── Animation ── */
    const speedMult = reducedMotion ? 0.15 : 1.0;

    const tick = () => {
      const t = clockRef.current.getElapsedTime() * speedMult;

      /* Core gentle rotation */
      coreMesh.rotation.x = t * 0.12;
      coreMesh.rotation.y = t * 0.18;
      glowMesh.rotation.y = -t * 0.08;

      /* Rings counter-rotate */
      ring1.mesh.rotation.y = t * 0.06;
      ring2.mesh.rotation.x = t * 0.04 + Math.PI / 4;
      ring3.mesh.rotation.z = t * 0.09;

      /* Satellites orbit on tilted planes */
      SATELLITES.forEach((sat, i) => {
        const angle     = t * sat.speed + sat.phase;
        const tiltAngle = (i / SATELLITES.length) * Math.PI; // spread on y-plane
        const orbitTilt = 0.4 + (i % 3) * 0.2;

        const x = sat.orbit * Math.cos(angle);
        const y = sat.orbit * Math.sin(angle) * Math.sin(orbitTilt);
        const z = sat.orbit * Math.sin(angle) * Math.cos(orbitTilt) * 0.5;

        satelliteMeshes[i].position.set(x, y, z);
        satelliteMeshes[i].rotation.x += 0.012;
        satelliteMeshes[i].rotation.y += 0.018;
      });

      /* Particles slow drift */
      particles.rotation.y = t * 0.015;
      particles.rotation.x = t * 0.008;

      /* Violet point light pulse */
      violetPoint.intensity = 2.5 + Math.sin(t * 1.4) * 0.8;

      /* Mouse easing */
      curMX += (targetMX - curMX) * 0.04;
      curMY += (targetMY - curMY) * 0.04;
      camera.position.x = curMX * 0.6;
      camera.position.y = curMY * 0.6;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(tick);
    };
    tick();

    /* ── Cleanup ── */
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      observer.disconnect();
      resizeObs.disconnect();

      /* Dispose all geometries & materials */
      coreGeo.dispose(); coreMat.dispose();
      glowGeo.dispose(); glowMat.dispose();
      ring1.geo.dispose(); ring1.mat.dispose();
      ring2.geo.dispose(); ring2.mat.dispose();
      ring3.geo.dispose(); ring3.mat.dispose();
      satelliteGeos.forEach(g => g.dispose());
      satelliteMats.forEach(m => m.dispose());
      particleGeo.dispose(); particleMat.dispose();
      renderer.dispose();

      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [reducedMotion]);

  useEffect(() => {
    /* Check WebGL support */
    try {
      const testCanvas  = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) return; // No WebGL — static fallback renders via CSS
    } catch { return; }

    const cleanup = buildScene();
    return cleanup;
  }, [buildScene]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${className}`}
      aria-hidden="true"
      role="presentation"
    >
      {/* CSS fallback glow — always visible, canvas layered on top */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-gradient-to-tr from-blue-600/20 via-indigo-500/15 to-cyan-400/20 blur-3xl" />
      </div>
    </div>
  );
}
