import * as THREE from 'three'
import { FACEMESH_TESSELATION } from '@mediapipe/face_mesh'

export class Scene3D {
  constructor(container) {
    this.container = container
    this.renderer = null
    this.scene = null
    this.camera = null
    this.wireGeometry = null
    this.lineSegments = null
    this.pointsMesh = null
    this.posArr = null
    this.initialized = false
    this.wireframeMode = true
  }

  init() {
    // Scene
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x000000, 0.15)

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.001,
      100
    )
    this.camera.position.z = 2.8

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0x020408, 1)
    this.container.appendChild(this.renderer.domElement)

    // Lights
    const ambient = new THREE.AmbientLight(0x0a1a2a, 4)
    this.scene.add(ambient)

    const keyLight = new THREE.DirectionalLight(0x00ccff, 5)
    keyLight.position.set(1, 2, 3)
    this.scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0x0044ff, 2)
    rimLight.position.set(-2, -1, 2)
    this.scene.add(rimLight)

    // Grid floor (subtle)
    const gridHelper = new THREE.GridHelper(6, 20, 0x001122, 0x001122)
    gridHelper.position.y = -1.5
    this.scene.add(gridHelper)

    // Keyboard toggle
    window.addEventListener('keydown', (e) => {
      if (e.key === 'w' || e.key === 'W') this.toggleMode()
    })

    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })

    this.animate()
  }

  buildMesh(numLandmarks) {
    this.posArr = new Float32Array(numLandmarks * 3)

    this.wireGeometry = new THREE.BufferGeometry()
    this.wireGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.posArr, 3)
    )

    // Line indices from FACEMESH_TESSELATION
    const lineIdx = []
    for (const conn of FACEMESH_TESSELATION) {
      lineIdx.push(conn[0], conn[1])
    }
    this.wireGeometry.setIndex(lineIdx)

    // Wireframe lines
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x00ccff,
      transparent: true,
      opacity: 0.55,
    })
    this.lineSegments = new THREE.LineSegments(this.wireGeometry, wireMat)
    this.scene.add(this.lineSegments)

    // Landmark points
    const pointMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.007,
      transparent: true,
      opacity: 0.85,
    })
    this.pointsMesh = new THREE.Points(this.wireGeometry, pointMat)
    this.scene.add(this.pointsMesh)
  }

  toggleMode() {
    this.wireframeMode = !this.wireframeMode
    if (this.lineSegments) {
      this.lineSegments.material.opacity = this.wireframeMode ? 0.55 : 0.15
    }
    if (this.pointsMesh) {
      this.pointsMesh.visible = this.wireframeMode
    }
  }

  updateFace(landmarks, videoWidth, videoHeight) {
    if (!this.initialized) {
      this.buildMesh(landmarks.length)
      this.initialized = true
    }

    const sx =  2.2 / videoWidth
    const sy =  2.2 / videoHeight

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i]
      // Mirror X so it behaves like a mirror reflection
      this.posArr[i * 3]     = -(lm.x - videoWidth  / 2) * sx
      this.posArr[i * 3 + 1] = -(lm.y - videoHeight / 2) * sy
      this.posArr[i * 3 + 2] =  (lm.z ?? 0) * 0.004
    }

    this.wireGeometry.attributes.position.needsUpdate = true
    this.wireGeometry.computeBoundingSphere()
  }

  animate() {
    requestAnimationFrame(() => this.animate())
    this.renderer.render(this.scene, this.camera)
  }
}
