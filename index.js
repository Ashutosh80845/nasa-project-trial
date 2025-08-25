import * as THREE from "three";
import { OrbitControls } from 'jsm/controls/OrbitControls.js';

import getStarfield from "./src/getStarfield.js";
import { getFresnelMat } from "./src/getFresnelMat.js";

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 4000);
// move camera back and slightly above so outer planets are visible
camera.position.set(0, 120, 600);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);
// THREE.ColorManagement.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// ensure correct output encoding so color textures render properly
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

const earthGroup = new THREE.Group();
earthGroup.rotation.z = -23.4 * Math.PI / 180;
scene.add(earthGroup);
new OrbitControls(camera, renderer.domElement);
const detail = 12;
const loader = new THREE.TextureLoader();
const geometry = new THREE.IcosahedronGeometry(1, detail);
const material = new THREE.MeshPhongMaterial({
  map: loader.load("./textures/00_earthmap1k.jpg"),
  specularMap: loader.load("./textures/02_earthspec1k.jpg"),
  bumpMap: loader.load("./textures/01_earthbump1k.jpg"),
  bumpScale: 0.04,
});
// material.map.colorSpace = THREE.SRGBColorSpace;
// ensure earth textures use sRGB for correct colors
if (material.map) { if ('colorSpace' in material.map) material.map.colorSpace = THREE.SRGBColorSpace; if('encoding' in material.map) material.map.encoding = THREE.sRGBEncoding; }
if (material.specularMap) { if ('colorSpace' in material.specularMap) material.specularMap.colorSpace = THREE.LinearSRGBColorSpace; if('encoding' in material.specularMap) material.specularMap.encoding = THREE.LinearEncoding; }
if (material.bumpMap) { if ('colorSpace' in material.bumpMap) material.bumpMap.colorSpace = THREE.LinearSRGBColorSpace; if('encoding' in material.bumpMap) material.bumpMap.encoding = THREE.LinearEncoding; }

const earthMesh = new THREE.Mesh(geometry, material);
earthGroup.add(earthMesh);

const lightsMat = new THREE.MeshBasicMaterial({
  map: loader.load("./textures/03_earthlights1k.jpg"),
  blending: THREE.AdditiveBlending,
});
const lightsMesh = new THREE.Mesh(geometry, lightsMat);
earthGroup.add(lightsMesh);

const cloudsMat = new THREE.MeshStandardMaterial({
  map: loader.load("./textures/04_earthcloudmap.jpg"),
  transparent: true,
  opacity: 0.8,
  blending: THREE.AdditiveBlending,
  alphaMap: loader.load('./textures/05_earthcloudmaptrans.jpg'),
  // alphaTest: 0.3,
});
// clouds should not be additive (that makes them glow/overbright)
if (cloudsMat.map) { if ('colorSpace' in cloudsMat.map) cloudsMat.map.colorSpace = THREE.SRGBColorSpace; if('encoding' in cloudsMat.map) cloudsMat.map.encoding = THREE.sRGBEncoding; }
if (cloudsMat.alphaMap) { if ('colorSpace' in cloudsMat.alphaMap) cloudsMat.alphaMap.colorSpace = THREE.LinearSRGBColorSpace; if('encoding' in cloudsMat.alphaMap) cloudsMat.alphaMap.encoding = THREE.LinearEncoding; }
cloudsMat.blending = THREE.NormalBlending;
const cloudsMesh = new THREE.Mesh(geometry, cloudsMat);
cloudsMesh.scale.setScalar(1.003);
earthGroup.add(cloudsMesh);

const fresnelMat = getFresnelMat();
const glowMesh = new THREE.Mesh(geometry, fresnelMat);
glowMesh.scale.setScalar(1.01);
earthGroup.add(glowMesh);

// Add Mars (smaller, ~0.53 scale of Earth) positioned to the right of Earth
const marsGroup = new THREE.Group();
marsGroup.rotation.z = -25 * Math.PI / 180; // Mars axial tilt ~25°
marsGroup.position.x = 3; // place Mars to the right of Earth
scene.add(marsGroup);

const marsScale = 0.53; // Mars radius ≈ 0.53 * Earth radius
const marsGeometry = new THREE.IcosahedronGeometry(1, detail);
const marsMaterial = new THREE.MeshPhongMaterial({
  map: loader.load("./textures/mars/mars-texture.png"),
  shininess: 25,
  specular: new THREE.Color(0x444444),
});
// strengthen mars texture encoding if present
if (marsMaterial.map) { if ('colorSpace' in marsMaterial.map) marsMaterial.map.colorSpace = THREE.SRGBColorSpace; if('encoding' in marsMaterial.map) marsMaterial.map.encoding = THREE.sRGBEncoding; }
const marsMesh = new THREE.Mesh(marsGeometry, marsMaterial);
marsMesh.scale.setScalar(marsScale);
marsGroup.add(marsMesh);

// subtle fresnel glow for Mars, scaled down
const marsFresnel = getFresnelMat();
const marsGlow = new THREE.Mesh(marsGeometry, marsFresnel);
marsGlow.scale.setScalar(1.01 * marsScale);
marsGroup.add(marsGlow);

// -- Add other planets (Mercury, Venus, Jupiter, Saturn) --
// We'll create smaller groups that orbit the scene center. Use simple colored materials
// and a ring for Saturn. Scales are relative to Earth used visually (not real distances).
const AU = 4.0; // scene units per astronomical unit (increase spacing)
const SIZE_SCALE = 0.6; // visual size scale for planet radii (Earth = 1 * SIZE_SCALE)
// Sun visual scaling factor (keeps Sun proportional but not overwhelming)
const SUN_RADIUS_REL = 109; // Sun radius in Earth radii (for ratio)
const SUN_SCALE_FACTOR = 0.02; // further scale-down so Sun fits the scene

const planetDetail = 8;
const planetGeo = new THREE.IcosahedronGeometry(1, planetDetail);

const planets = [];

// create a visible orbit line (circle) at given radius
function createOrbit(radius, segments = 256, color = 0x888888) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 });
  const line = new THREE.LineLoop(geo, mat);
  scene.add(line);
  return line;
}

function createPlanet({ name, color, radiusRel, au, orbitSpeed, rotationSpeed, inclination = 0 }) {
  const group = new THREE.Group();
  group.rotation.z = inclination;
  group.userData = { angle: Math.random() * Math.PI * 2 };
  scene.add(group);

  // Increase saturation/contrast for the base color so planets are vivid
  const colorObj = new THREE.Color(color);
  // convert to HSL, boost saturation and lightness a bit
  const hsl = {};
  colorObj.getHSL(hsl);
  hsl.s = Math.min(1.0, hsl.s * 1.4 + 0.05);
  hsl.l = Math.min(0.9, hsl.l * 1.1 + 0.02);
  colorObj.setHSL(hsl.h, hsl.s, hsl.l);

  // stronger emissive to make colors pop under distant lighting
  const emissiveTint = colorObj.clone().multiplyScalar(0.32);
  const mat = new THREE.MeshPhongMaterial({
    color: colorObj,
    emissive: emissiveTint,
    shininess: 45,
    specular: new THREE.Color(0x666666),
  });

  const mesh = new THREE.Mesh(planetGeo, mat);
  const scaled = radiusRel * SIZE_SCALE;
  mesh.scale.setScalar(scaled);
  group.add(mesh);

  const orbitRadius = au * AU;
  group.position.set(Math.cos(group.userData.angle) * orbitRadius, 0, Math.sin(group.userData.angle) * orbitRadius);

  const orbitLine = createOrbit(orbitRadius);

  const obj = { name, group, mesh, orbitRadius, orbitSpeed, rotationSpeed, orbitLine };
  planets.push(obj);
  return obj;
}

// Create planets using approximate real radii (relative to Earth) and AU distances
createPlanet({ name: 'Mercury', color: 0x9e9e9e, radiusRel: 0.383, au: 0.387, orbitSpeed: 0.015, rotationSpeed: 0.004 });
createPlanet({ name: 'Venus', color: 0xe0c28f, radiusRel: 0.949, au: 0.723, orbitSpeed: 0.009, rotationSpeed: 0.0025 });
// Earth is centered (earthGroup)
// Mars: reuse existing marsGroup/mesh but set proper AU radius and add to planets
marsGroup.userData = { angle: Math.random() * Math.PI * 2 };
const marsOrbitRadius = 1.524 * AU;
marsGroup.position.set(Math.cos(marsGroup.userData.angle) * marsOrbitRadius, 0, Math.sin(marsGroup.userData.angle) * marsOrbitRadius);
planets.push({ name: 'Mars', group: marsGroup, mesh: marsMesh, orbitRadius: marsOrbitRadius, orbitSpeed: 0.005, rotationSpeed: 0.0018, orbitLine: createOrbit(marsOrbitRadius) });

createPlanet({ name: 'Jupiter', color: 0xd8a26b, radiusRel: 11.21, au: 5.204, orbitSpeed: 0.0012, rotationSpeed: 0.01 });
const saturn = createPlanet({ name: 'Saturn', color: 0xe3d2a5, radiusRel: 9.45, au: 9.582, orbitSpeed: 0.0008, rotationSpeed: 0.009, inclination: -0.05 });
// Saturn rings (use saturn.mesh.scale)
const ringInner = 1.2 * saturn.mesh.scale.x;
const ringOuter = 2.0 * saturn.mesh.scale.x;
const ringGeo = new THREE.RingGeometry(ringInner, ringOuter, 64);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xccc0a8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
const ringMesh = new THREE.Mesh(ringGeo, ringMat);
ringMesh.rotation.x = -Math.PI / 2;
ringMesh.position.y = 0;
saturn.group.add(ringMesh);

// create simple procedural canvas textures for planets (adds visual detail without external files)
function makeCanvasTexture(colorA, colorB, size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // base gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, colorA);
  grad.addColorStop(1, colorB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // add simple banded/noise detail
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 1 + Math.random() * 6;
    const h = 1 + Math.random() * 6;
    ctx.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.03) + ')';
    ctx.fillRect(x, y, w, h);
  }

  // subtle darker streaks
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    const y = Math.random() * size;
    ctx.ellipse(size/2, y, size*0.6, 6 + Math.random()*20, 0, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  if ('encoding' in tex) tex.encoding = THREE.sRGBEncoding;
  tex.needsUpdate = true;
  return tex;
}

// Create Uranus and Neptune with generated textures
(function addOuterPlanets(){
  // Uranus
  const uranusTex = makeCanvasTexture('#bfe7ef', '#79c7d6');
  // tint the procedural texture slightly and increase emissive for contrast
  const uranusMat = new THREE.MeshPhongMaterial({ map: uranusTex, shininess: 15 });
  uranusMat.emissive = new THREE.Color(0x7fcbd6).multiplyScalar(0.12);
  const uranusGroup = new THREE.Group();
  uranusGroup.userData = { angle: Math.random() * Math.PI * 2 };
  scene.add(uranusGroup);
  const uranusMesh = new THREE.Mesh(planetGeo, uranusMat);
  uranusMesh.scale.setScalar(4.01 * SIZE_SCALE); // Uranus radius ~4.01 Earth
  uranusGroup.add(uranusMesh);
  const uranusOrbit = 19.218 * AU;
  uranusGroup.position.set(Math.cos(uranusGroup.userData.angle)*uranusOrbit, 0, Math.sin(uranusGroup.userData.angle)*uranusOrbit);
  planets.push({ name: 'Uranus', group: uranusGroup, mesh: uranusMesh, orbitRadius: uranusOrbit, orbitSpeed: 0.0005, rotationSpeed: 0.005, orbitLine: createOrbit(uranusOrbit) });

  // Neptune
  const neptuneTex = makeCanvasTexture('#5aa1e6', '#134e7a');
  const neptuneMat = new THREE.MeshPhongMaterial({ map: neptuneTex, shininess: 15 });
  neptuneMat.emissive = new THREE.Color(0x2a6fb5).multiplyScalar(0.12);
  const neptuneGroup = new THREE.Group();
  neptuneGroup.userData = { angle: Math.random() * Math.PI * 2 };
  scene.add(neptuneGroup);
  const neptuneMesh = new THREE.Mesh(planetGeo, neptuneMat);
  neptuneMesh.scale.setScalar(3.88 * SIZE_SCALE); // Neptune radius ~3.88 Earth
  neptuneGroup.add(neptuneMesh);
  const neptuneOrbit = 30.11 * AU;
  neptuneGroup.position.set(Math.cos(neptuneGroup.userData.angle)*neptuneOrbit, 0, Math.sin(neptuneGroup.userData.angle)*neptuneOrbit);
  planets.push({ name: 'Neptune', group: neptuneGroup, mesh: neptuneMesh, orbitRadius: neptuneOrbit, orbitSpeed: 0.00035, rotationSpeed: 0.004, orbitLine: createOrbit(neptuneOrbit) });
})();

// --- Sun at scene center ---
const sunBaseRadius = 1.5; // base geometry radius used for the sun mesh
const sunVisualRadius = SUN_RADIUS_REL * SIZE_SCALE * SUN_SCALE_FACTOR; // final visual radius in scene units
const sunGeo = new THREE.IcosahedronGeometry(sunBaseRadius, detail);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
// scale geometry so its radius equals sunVisualRadius
const sunScale = sunVisualRadius / sunBaseRadius;
sunMesh.scale.setScalar(sunScale);
scene.add(sunMesh);

// Point light at sun to illuminate planets. Use no distance attenuation so distant planets receive light
const sunLight = new THREE.PointLight(0xffffff, 2.2, 0, 1);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

// slightly stronger ambient to prevent distant planets from going fully dark
const ambient = new THREE.AmbientLight(0xffffff, 0.06);
ambient && (ambient.intensity = 0.12);
scene.add(ambient);

// Auxiliary: add a subtle emissive atmospheric glow for the sun (very soft)
const sunGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd88c, transparent: true, opacity: 0.08 });
const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(sunVisualRadius * 1.6, 16, 12), sunGlowMat);
sunGlow.position.set(0, 0, 0);
scene.add(sunGlow);

// Add Earth to planets so it orbits the sun
const earthOrbitRadius = 1.0 * AU; // 1 AU
// scale Earth mesh to match SIZE_SCALE used for other planets
earthMesh.scale.setScalar(SIZE_SCALE);
// place earthGroup at its orbit radius
earthGroup.position.set(Math.cos(Math.random() * Math.PI * 2) * earthOrbitRadius, 0, Math.sin(Math.random() * Math.PI * 2) * earthOrbitRadius);
planets.push({ name: 'Earth', group: earthGroup, mesh: earthMesh, orbitRadius: earthOrbitRadius, orbitSpeed: 0.006, rotationSpeed: 0.002, orbitLine: createOrbit(earthOrbitRadius) });

// increase star count for denser background
const stars = getStarfield({numStars: 8000});
scene.add(stars);

function animate() {
  requestAnimationFrame(animate);

  earthMesh.rotation.y += 0.002;
  lightsMesh.rotation.y += 0.002;
  cloudsMesh.rotation.y += 0.0023;
  glowMesh.rotation.y += 0.002;

  // Mars rotation (slightly different speed)
  marsMesh.rotation.y += 0.0018;
  marsGlow.rotation.y += 0.0018;

  // animate our added planets: orbit + self rotation
  for (const p of planets) {
    // ensure angle exists
    p.userData = p.userData || {};
    if (typeof p.userData.angle !== 'number') p.userData.angle = Math.random() * Math.PI * 2;
    p.userData.angle += p.orbitSpeed;
    p.group.position.x = Math.cos(p.userData.angle) * p.orbitRadius;
    p.group.position.z = Math.sin(p.userData.angle) * p.orbitRadius;
    // small vertical bob for depth
    p.group.position.y = Math.sin(p.userData.angle * 0.5) * 0.03;
    p.mesh.rotation.y += p.rotationSpeed;
  }

  stars.rotation.y -= 0.0002;
  renderer.render(scene, camera);
}

animate();

function handleWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);