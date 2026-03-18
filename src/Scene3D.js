import * as THREE from 'three'
import { FACEMESH_TESSELATION } from './facemesh_tesselation.js'
import { AvatarController } from './AvatarController.js'

export class Scene3D {
  constructor(container) {
    this.container = container
    this.renderer  = null
    this.scene     = null
    this.camera    = null

    // Wireframe overlay (face mesh поверх аватара)
    this.wireGeometry  = null
    this.lineSegments  = null
    this.pointsMesh    = null
    this.posArr        = null
    this.wireInitialized = false
    this.wireVisible     = false  // по умолчанию скрыт

    // Аватар
    this.avatar = null
    this.avatarReady = false
  }

  async init() {
    // ── Сцена ──────────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0d12)
    this.scene.fog = new THREE.FogExp2(0x0a0d12, 0.08)

    // ── Камера: портрет головы аватара ────────────────────────────────────────
    this.camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.01,
      50
    )
    this.camera.position.set(0, 1.65, 0.75)
    this.camera.lookAt(0, 1.55, 0)

    // ── Рендерер ───────────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.container.appendChild(this.renderer.domElement)

    // ── Освещение ──────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
    keyLight.position.set(1, 3, 3)
    this.scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x8090ff, 0.8)
    fillLight.position.set(-2, 1, 2)
    this.scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0x00ccff, 0.6)
    rimLight.position.set(0, -1, -2)
    this.scene.add(rimLight)

    // ── Пол (атмосфера) ───────────────────────────────────────────────────────
    const grid = new THREE.GridHelper(6, 24, 0x001122, 0x001122)
    grid.position.y = 0
    this.scene.add(grid)

    // ── Клавиши ───────────────────────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
      if (e.key === 'w' || e.key === 'W') this._toggleWire()
    })

    // ── Ресайз ────────────────────────────────────────────────────────────────
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })

    // ── Загрузка аватара ──────────────────────────────────────────────────────
    this.avatar = new AvatarController(this.scene)
    try {
      await this.avatar.load('/avatar.glb')
      this.avatarReady = true
    } catch (err) {
      console.error('Ошибка загрузки аватара:', err)
      throw err
    }

    this._animate()
  }

  // Wireframe face mesh (overlay поверх аватара, W для переключения)
  _buildWire(numLandmarks) {
    this.posArr = new Float32Array(numLandmarks * 3)

    this.wireGeometry = new THREE.BufferGeometry()
    this.wireGeometry.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3))

    const lineIdx = []
    for (const conn of FACEMESH_TESSELATION) lineIdx.push(conn[0], conn[1])
    this.wireGeometry.setIndex(lineIdx)

    const wireMat = new THREE.LineBasicMaterial({
      color: 0x00ccff,
      transparent: true,
      opacity: 0.45,
    })
    this.lineSegments = new THREE.LineSegments(this.wireGeometry, wireMat)
    this.lineSegments.visible = this.wireVisible
    this.scene.add(this.lineSegments)

    const pointMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.006,
      transparent: true,
      opacity: 0.7,
    })
    this.pointsMesh = new THREE.Points(this.wireGeometry, pointMat)
    this.pointsMesh.visible = this.wireVisible
    this.scene.add(this.pointsMesh)
  }

  _toggleWire() {
    this.wireVisible = !this.wireVisible
    if (this.lineSegments) this.lineSegments.visible = this.wireVisible
    if (this.pointsMesh)   this.pointsMesh.visible   = this.wireVisible
  }

  updateFace(landmarks, videoWidth, videoHeight) {
    // Обновляем аватар
    if (this.avatarReady) {
      this.avatar.update(landmarks, videoWidth, videoHeight)
    }

    // Wireframe overlay (если включён)
    if (this.wireVisible) {
      if (!this.wireInitialized) {
        this._buildWire(landmarks.length)
        this.wireInitialized = true
      }

      const sx = 1.6 / videoWidth
      const sy = 1.6 / videoHeight

      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i]
        this.posArr[i * 3]     = -(lm.x - videoWidth  / 2) * sx
        this.posArr[i * 3 + 1] = -(lm.y - videoHeight / 2) * sy + 1.55
        this.posArr[i * 3 + 2] =  (lm.z ?? 0) * 0.004
      }

      this.wireGeometry.attributes.position.needsUpdate = true
      this.wireGeometry.computeBoundingSphere()
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate())
    this.renderer.render(this.scene, this.camera)
  }
}
