'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export function Hero3DCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check for mobile or reduced motion
    const mediaQuery = window.matchMedia('(max-width: 768px), (prefers-reduced-motion: reduce)');
    setIsMobile(mediaQuery.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let width = container.clientWidth || 500;
    let height = container.clientHeight || 500;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8.5);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0x3b82f6, 3.5); // Brand Blue
    mainLight.position.set(5, 6, 6);
    scene.add(mainLight);

    const cyanLight = new THREE.DirectionalLight(0x06b6d4, 2.5); // Vibrant Cyan
    cyanLight.position.set(-6, -4, 4);
    scene.add(cyanLight);

    const violetLight = new THREE.PointLight(0x8b5cf6, 2.0, 15); // Indigo/Violet
    violetLight.position.set(0, 4, -2);
    scene.add(violetLight);

    // 4. Central 3D Geometry: Torus Knot
    const knotGeometry = new THREE.TorusKnotGeometry(1.6, 0.45, 128, 32, 2, 3);
    const knotMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x2563eb,
      metalness: 0.15,
      roughness: 0.18,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9,
      transmission: 0.1,
      thickness: 0.5,
    });
    const knotMesh = new THREE.Mesh(knotGeometry, knotMaterial);
    scene.add(knotMesh);

    // 5. Floating Satellite 1: Translucent Icosahedron
    const icoGeometry = new THREE.IcosahedronGeometry(0.75, 0);
    const icoMaterial = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.4,
      roughness: 0.2,
      wireframe: false,
    });
    const icoMesh = new THREE.Mesh(icoGeometry, icoMaterial);
    icoMesh.position.set(-2.8, 1.8, 0.5);
    scene.add(icoMesh);

    // 6. Floating Satellite 2: Frosted Sphere
    const sphereGeometry = new THREE.SphereGeometry(0.55, 32, 32);
    const sphereMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x6366f1,
      metalness: 0.1,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphereMesh.position.set(2.6, -1.8, 1);
    scene.add(sphereMesh);

    // 7. Ambient Orbiting Rings
    const ringGeometry = new THREE.TorusGeometry(3.6, 0.02, 16, 120);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0.35,
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotation.x = Math.PI / 3;
    ringMesh.rotation.y = Math.PI / 6;
    scene.add(ringMesh);

    // 8. Mouse Parallax Tracking
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      targetMouseX = x * 1.5;
      targetMouseY = -y * 1.5;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 9. Intersection Observer (Freeze when not in view)
    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // 10. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsedTime = clock.getElapsedTime();

      // Slow elegant rotation
      knotMesh.rotation.x = elapsedTime * 0.25;
      knotMesh.rotation.y = elapsedTime * 0.35;

      // Orbit satellites
      icoMesh.position.x = -2.8 + Math.sin(elapsedTime * 0.8) * 0.4;
      icoMesh.position.y = 1.8 + Math.cos(elapsedTime * 0.7) * 0.4;
      icoMesh.rotation.x += 0.01;
      icoMesh.rotation.y += 0.015;

      sphereMesh.position.x = 2.6 + Math.cos(elapsedTime * 0.6) * 0.3;
      sphereMesh.position.y = -1.8 + Math.sin(elapsedTime * 0.75) * 0.3;

      ringMesh.rotation.z = elapsedTime * 0.08;

      // Smooth mouse easing
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      camera.position.x = currentMouseX;
      camera.position.y = currentMouseY;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // 11. Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      observer.disconnect();
      resizeObserver.disconnect();

      knotGeometry.dispose();
      knotMaterial.dispose();
      icoGeometry.dispose();
      icoMaterial.dispose();
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      renderer.dispose();
    };
  }, [isMobile]);

  if (isMobile) {
    // Lightweight, GPU-accelerated CSS animated fallback for mobile
    return (
      <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
        <div className="w-56 h-56 rounded-full bg-gradient-to-tr from-blue-600/30 via-indigo-500/20 to-cyan-400/30 blur-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[340px] sm:min-h-[420px] flex items-center justify-center pointer-events-none select-none"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
