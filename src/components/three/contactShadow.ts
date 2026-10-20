import * as THREE from "three";
import { HorizontalBlurShader } from "three/examples/jsm/shaders/HorizontalBlurShader.js";
import { VerticalBlurShader } from "three/examples/jsm/shaders/VerticalBlurShader.js";

// One-shot contact shadow bake (same idea as drei's <ContactShadows>, but
// rendered once): an orthographic camera looks up from the ground plane,
// renders the car as height-attenuated darkness and blurs the result. The
// plane is parented to the car, so it stays correct while the car moves and
// costs nothing per frame.

export type ShadowRig = {
  group: THREE.Group;
  tight: THREE.MeshBasicMaterial;
  soft: THREE.MeshBasicMaterial;
  bake: (gl: THREE.WebGLRenderer, scene: THREE.Scene, hide?: THREE.Object3D[]) => void;
  dispose: () => void;
};

export function createContactShadow(width: number, depth: number, far = 1.4, res = 1024): ShadowRig {
  const group = new THREE.Group();
  group.rotation.x = Math.PI / 2;
  group.position.y = 0.002;

  const rtOpts = { type: THREE.HalfFloatType } as const;
  const rtTight = new THREE.WebGLRenderTarget(res, res, rtOpts);
  const rtSoft = new THREE.WebGLRenderTarget(res, res, rtOpts);
  const rtTemp = new THREE.WebGLRenderTarget(res, res, rtOpts);
  [rtTight, rtSoft, rtTemp].forEach((rt) => (rt.texture.generateMipmaps = false));

  const plane = new THREE.PlaneGeometry(width, depth).rotateX(Math.PI / 2);
  const tight = new THREE.MeshBasicMaterial({ map: rtTight.texture, transparent: true, depthWrite: false, opacity: 0 });
  const soft = new THREE.MeshBasicMaterial({ map: rtSoft.texture, transparent: true, depthWrite: false, opacity: 0 });
  const softMesh = new THREE.Mesh(plane, soft);
  const tightMesh = new THREE.Mesh(plane, tight);
  for (const m of [softMesh, tightMesh]) {
    m.scale.set(1, -1, 1);
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = -5;
    group.add(m);
  }
  softMesh.scale.multiplyScalar(1.0);

  const cam = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0, far);
  group.add(cam);

  const darkMat = new THREE.ShaderMaterial({
    uniforms: { uFar: { value: far } },
    vertexShader: /* glsl */ `
      varying float vDepth;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uFar;
      varying float vDepth;
      void main() {
        float d = clamp(vDepth / uFar, 0.0, 1.0);
        gl_FragColor = vec4(0.0, 0.0, 0.0, pow(1.0 - d, 2.2));
      }
    `,
    side: THREE.DoubleSide,
  });

  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
  const vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
  hBlur.depthTest = vBlur.depthTest = false;

  const blur = (gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, amount: number, passes: number) => {
    for (let i = 0; i < passes; i++) {
      quad.material = hBlur;
      hBlur.uniforms.tDiffuse.value = target.texture;
      hBlur.uniforms.h.value = amount / 256;
      gl.setRenderTarget(rtTemp);
      gl.render(quadScene, quadCam);
      quad.material = vBlur;
      vBlur.uniforms.tDiffuse.value = rtTemp.texture;
      vBlur.uniforms.v.value = amount / 256;
      gl.setRenderTarget(target);
      gl.render(quadScene, quadCam);
    }
  };

  const bake = (gl: THREE.WebGLRenderer, scene: THREE.Scene, hide: THREE.Object3D[] = []) => {
    const prevTarget = gl.getRenderTarget();
    const prevOverride = scene.overrideMaterial;
    const prevBg = scene.background;
    const prevClip = gl.localClippingEnabled;
    const prevClear = gl.getClearAlpha();
    const prevColor = new THREE.Color();
    gl.getClearColor(prevColor);
    const hidden = hide.filter((o) => o.visible);
    hidden.forEach((o) => (o.visible = false));
    group.visible = false;
    scene.background = null;
    scene.overrideMaterial = darkMat;
    gl.localClippingEnabled = false;
    gl.setClearColor(0x000000, 0);
    group.updateWorldMatrix(true, true);

    gl.setRenderTarget(rtTight);
    gl.clear();
    gl.render(scene, cam);
    // copy into the soft target before blurring the tight one
    quad.material = new THREE.MeshBasicMaterial({ map: rtTight.texture, transparent: true });
    gl.setRenderTarget(rtSoft);
    gl.clear();
    gl.render(quadScene, quadCam);
    (quad.material as THREE.Material).dispose();

    blur(gl, rtTight, 0.9, 2);
    blur(gl, rtSoft, 4.5, 3);

    scene.overrideMaterial = prevOverride;
    scene.background = prevBg;
    gl.localClippingEnabled = prevClip;
    gl.setClearColor(prevColor, prevClear);
    gl.setRenderTarget(prevTarget);
    hidden.forEach((o) => (o.visible = true));
    group.visible = true;
  };

  const dispose = () => {
    [rtTight, rtSoft, rtTemp].forEach((rt) => rt.dispose());
    plane.dispose();
    tight.dispose();
    soft.dispose();
    darkMat.dispose();
    hBlur.dispose();
    vBlur.dispose();
  };

  return { group, tight, soft, bake, dispose };
}
