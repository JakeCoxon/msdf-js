import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import pngFile from "url:./Roboto-Regular.png"
import fontData from "./Roboto-Regular.json"
import { createLayout, createMsdfFont } from '../src/font';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load(pngFile)
console.log(fontData)

const msdfFont = createMsdfFont({ texture: '', data: fontData })

// Custom Shader Material
const customShaderMaterial = new THREE.ShaderMaterial({
    vertexShader: `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D uTexture;
        varying vec2 vUv;

        uniform float pxRange; // set to distance field's pixel range

        float screenPxRange() {
            vec2 unitRange = vec2(pxRange)/vec2(textureSize(uTexture, 0));
            vec2 screenTexSize = vec2(1.0)/fwidth(vUv);
            return max(0.5*dot(unitRange, screenTexSize), 1.0);
        }

        float median(float r, float g, float b) {
            return max(min(r, g), min(max(r, g), b));
        }

        void main() {
            vec3 texel = texture2D(uTexture, vUv).rgb;
            float sd = median(texel.r, texel.g, texel.b);
            float screenPxDistance = screenPxRange()*(sd - 0.5);
            float opacity = clamp(screenPxDistance + 0.5, 0.0, 1.0);

            vec3 bgColor = vec3(0.0, 0.0, 0.0);
            vec3 fgColor = vec3(1.0, 1.0, 1.0);

            gl_FragColor = vec4(mix(bgColor, fgColor, opacity), 1);
        }
    `,
    uniforms: {
        uTexture: { value: texture },
        pxRange: { value: 1 }
    }
});

// Geometry
const planeGeometry = new THREE.BufferGeometry();
const plane = new THREE.Mesh(planeGeometry, customShaderMaterial);

const layout = createLayout(msdfFont, 'HelloWorld')
const subRect = layout.rects[0].glyph.subRect

const uvs: number[] = []
const vertices: number[] = []
const indices: number[] = []

layout.rects.forEach(({ rect, textureRect, glyph }) => {
  const subRect = glyph.subRect
  uvs.push(
    subRect[0], 1 - subRect[3],
    subRect[2], 1 - subRect[3],
    subRect[0], 1 - subRect[1],
    subRect[2], 1 - subRect[1],
  )
  const num = vertices.length / 3
  vertices.push(
    textureRect[0], textureRect[1], 0,
    textureRect[0] + textureRect[2], textureRect[1], 0,
    textureRect[0], textureRect[1] + textureRect[3], 0,
    textureRect[0] + textureRect[2], textureRect[1] + textureRect[3], 0,
  )

  indices.push(
    num, num + 3, num + 2,
    num, num + 1, num + 3
    // num + 1, num + 2, num + 3
  )
    


})
console.log(layout.font.data.common.scaleW)
const { scaleW, scaleH } = layout.font.data.common
const uvArray = new Float32Array(uvs);
const vertexArray = new Float32Array(vertices);

// const vertices = new Float32Array([
//     -1, 1, 0,
//     1, 1, 0,
//     -1, -1, 0,
//     1, -1, 0,
// ]);

console.log(uvs)
// const uvs = new Float32Array([
//     0.0, 1.0,
//     1.0, 1.0,
//     0.0, 0.0,
//     1.0, 0.0,
// ]);
planeGeometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
planeGeometry.setAttribute('position', new THREE.BufferAttribute(vertexArray, 3));
// planeGeometry.setAttribute('index', new THREE.BufferAttribute(new Uint16Array(indices), 1));
planeGeometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));

plane.scale.set(0.01,0.01,0.01)

scene.add(plane);

// Camera position
camera.position.z = 5;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Optional: to give an inertia-like effect
controls.dampingFactor = 0.05;


// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();
