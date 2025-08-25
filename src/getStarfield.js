import * as THREE from "three";

export default function getStarfield({ numStars = 2000 } = {}) {
  function randomSpherePoint() {
    const radius = Math.random() * 200 + 50; // expand radius so stars surround outer planets
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    let x = radius * Math.sin(phi) * Math.cos(theta);
    let y = radius * Math.sin(phi) * Math.sin(theta);
    let z = radius * Math.cos(phi);

    return {
      pos: new THREE.Vector3(x, y, z),
      hue: 0.6,
      minDist: radius,
    };
  }
  const verts = [];
  const colors = [];
  const positions = [];
  let col;
  for (let i = 0; i < numStars; i += 1) {
    let p = randomSpherePoint();
    const { pos, hue } = p;
    positions.push(p);
    col = new THREE.Color().setHSL(hue, 0.2, Math.random() * 0.8 + 0.1);
    verts.push(pos.x, pos.y, pos.z);
    colors.push(col.r, col.g, col.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const starTex = new THREE.TextureLoader().load("./textures/stars/circle.png");
  if ('colorSpace' in starTex) starTex.colorSpace = THREE.SRGBColorSpace; if ('encoding' in starTex) starTex.encoding = THREE.sRGBEncoding;
  const mat = new THREE.PointsMaterial({
    size: 0.6,
    sizeAttenuation: true,
    vertexColors: true,
    map: starTex,
    transparent: true,
    alphaTest: 0.1,
  });
  const points = new THREE.Points(geo, mat);
  return points;
}
