import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const dist2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// MediaPipe Face Mesh landmark indices (468-point model)
const LM = {
  // Left eye
  leftEyeOuter:  33,
  leftEyeInner:  133,
  leftEyeTop:    159,
  leftEyeBottom: 145,
  // Right eye
  rightEyeOuter:  263,
  rightEyeInner:  362,
  rightEyeTop:    386,
  rightEyeBottom: 374,
  // Eyebrows
  leftBrowInner:  55,
  leftBrowMid:    105,
  leftBrowOuter:  46,
  rightBrowInner: 285,
  rightBrowMid:   334,
  rightBrowOuter: 276,
  // Nose
  noseTip: 4,
  // Mouth outer
  mouthLeft:   61,
  mouthRight:  291,
  mouthTop:    0,
  mouthBottom: 17,
  // Mouth inner (gap)
  upperLipInner: 13,
  lowerLipInner: 14,
  // Face height ref
  chin:     152,
  forehead: 10,
}

export class AvatarController {
  constructor(scene) {
    this.scene = scene
    this.mesh = null
    this.headBone = null
    this.neckBone = null
    this.ready = false
    this._smoothed = {}
    this._smoothRot = { x: 0, y: 0, z: 0 }
  }

  async load(url) {
    const loader = new GLTFLoader()
    const gltf = await new Promise((resolve, reject) =>
      loader.load(url, resolve, undefined, reject)
    )

    gltf.scene.traverse(node => {
      if (node.isSkinnedMesh) this.mesh = node
      if (node.isBone && node.name === 'Head') this.headBone = node
      if (node.isBone && node.name === 'Neck') this.neckBone = node
    })

    if (!this.mesh) throw new Error('SkinnedMesh не найден в GLB')

    // Three.js GLTFLoader строит morphTargetDictionary из mesh.extras.targetNames
    if (!this.mesh.morphTargetDictionary || Object.keys(this.mesh.morphTargetDictionary).length === 0) {
      throw new Error('Morph targets не найдены в меше')
    }

    this.scene.add(gltf.scene)
    this.ready = true
    console.log(
      `Аватар загружен. Morph targets: ${Object.keys(this.mesh.morphTargetDictionary).length}`,
      'Head bone:', !!this.headBone
    )
    return gltf.scene
  }

  // Плавное обновление одного morph target
  _setMorph(name, targetValue, alpha = 0.35) {
    const idx = this.mesh.morphTargetDictionary[name]
    if (idx === undefined) return
    const prev = this._smoothed[name] ?? targetValue
    const val = prev + (targetValue - prev) * alpha
    this._smoothed[name] = val
    this.mesh.morphTargetInfluences[idx] = val
  }

  update(landmarks, videoW, videoH) {
    if (!this.ready || !landmarks || landmarks.length < 468) return

    const kp = landmarks

    // Опорные расстояния
    const lo = kp[LM.leftEyeOuter]
    const ro = kp[LM.rightEyeOuter]
    const faceH = dist2D(kp[LM.chin], kp[LM.forehead])
    const iod    = dist2D(lo, ro)  // межглазное расстояние

    // ── Моргание ──────────────────────────────────────────────────────────────
    const leftEAR  = dist2D(kp[LM.leftEyeTop],  kp[LM.leftEyeBottom])  / dist2D(lo, kp[LM.leftEyeInner])
    const rightEAR = dist2D(kp[LM.rightEyeTop], kp[LM.rightEyeBottom]) / dist2D(ro, kp[LM.rightEyeInner])
    const EAR_OPEN = 0.28, EAR_CLOSE = 0.06
    const leftBlink  = 1 - clamp((leftEAR  - EAR_CLOSE) / (EAR_OPEN - EAR_CLOSE), 0, 1)
    const rightBlink = 1 - clamp((rightEAR - EAR_CLOSE) / (EAR_OPEN - EAR_CLOSE), 0, 1)

    this._setMorph('eyeBlinkLeft',  leftBlink)
    this._setMorph('eyeBlinkRight', rightBlink)
    this._setMorph('eyeSquintLeft',  clamp(leftBlink  * 0.5, 0, 1))
    this._setMorph('eyeSquintRight', clamp(rightBlink * 0.5, 0, 1))

    // ── Рот — открытие (jawOpen) ───────────────────────────────────────────────
    // Увеличен мёртвый порог (0.05 вместо 0.02): улыбка создаёт небольшой зазор,
    // который не должна триггерить jawOpen
    const jawDist = dist2D(kp[LM.upperLipInner], kp[LM.lowerLipInner])
    const jawOpen = clamp((jawDist / faceH - 0.05) / 0.10, 0, 1)
    this._setMorph('jawOpen', jawOpen, 0.45)
    // Нижняя губа вниз при открытии рта
    this._setMorph('mouthLowerDownLeft',  jawOpen * 0.55, 0.45)
    this._setMorph('mouthLowerDownRight', jawOpen * 0.55, 0.45)

    // ── Улыбка / недовольство ─────────────────────────────────────────────────
    const mouthTopY    = kp[LM.mouthTop].y
    const mouthBottomY = kp[LM.mouthBottom].y
    const mouthCenterY = (mouthTopY + mouthBottomY) / 2
    const leftCornerY  = kp[LM.mouthLeft].y
    const rightCornerY = kp[LM.mouthRight].y

    // Горизонтальное растяжение рта — дополнительный сигнал улыбки
    const mouthW     = dist2D(kp[LM.mouthLeft], kp[LM.mouthRight])
    const mouthWNorm = mouthW / iod  // ≈ 0.47 нейтраль, ≈ 0.60 широкая улыбка
    const widthSmile = clamp((mouthWNorm - 0.47) / 0.13, 0, 1)

    // Вертикальный подъём углов (уменьшен порог 0.022 вместо 0.03 — чувствительнее)
    const cornerUpL = clamp((mouthCenterY - leftCornerY)  / faceH / 0.022, 0, 1)
    const cornerUpR = clamp((mouthCenterY - rightCornerY) / faceH / 0.022, 0, 1)

    const smileL = clamp(cornerUpL + widthSmile * 0.4, 0, 1)
    const smileR = clamp(cornerUpR + widthSmile * 0.4, 0, 1)

    this._setMorph('mouthSmileLeft',  smileL, 0.45)
    this._setMorph('mouthSmileRight', smileR, 0.45)

    // Верхняя губа вверх при улыбке → показываем зубы
    this._setMorph('mouthUpperUpLeft',  smileL * 0.75, 0.45)
    this._setMorph('mouthUpperUpRight', smileR * 0.75, 0.45)

    // Ямочки при улыбке
    this._setMorph('mouthDimpleLeft',  smileL * 0.5, 0.45)
    this._setMorph('mouthDimpleRight', smileR * 0.5, 0.45)

    // Недовольство — только если нет улыбки (взаимоисключение)
    const frownL = clamp((leftCornerY  - mouthCenterY) / faceH / 0.022, 0, 1) * (1 - smileL)
    const frownR = clamp((rightCornerY - mouthCenterY) / faceH / 0.022, 0, 1) * (1 - smileR)
    this._setMorph('mouthFrownLeft',  frownL, 0.4)
    this._setMorph('mouthFrownRight', frownR, 0.4)

    // ── Губы трубочкой ────────────────────────────────────────────────────────
    const mouthPucker = clamp(1 - mouthWNorm / 0.52, 0, 1)
    this._setMorph('mouthPucker', mouthPucker, 0.4)

    // ── Брови ─────────────────────────────────────────────────────────────────
    const computeBrow = (browIn, browMid, browOut, eyeTop) => {
      const avgBrowY = (kp[browIn].y + kp[browMid].y + kp[browOut].y) / 3
      const diff = (kp[eyeTop].y - avgBrowY) / faceH
      // resting ≈ 0.075; выше (меньше diff) → нахмурен; ниже (больше diff) → поднят
      const down = clamp((0.07 - diff) / 0.025, 0, 1)
      const up   = clamp((diff - 0.07)  / 0.025, 0, 1)
      return { down, up }
    }

    const leftBrow  = computeBrow(LM.leftBrowInner,  LM.leftBrowMid,  LM.leftBrowOuter,  LM.leftEyeTop)
    const rightBrow = computeBrow(LM.rightBrowInner, LM.rightBrowMid, LM.rightBrowOuter, LM.rightEyeTop)

    this._setMorph('browDownLeft',    leftBrow.down)
    this._setMorph('browDownRight',   rightBrow.down)
    this._setMorph('browOuterUpLeft', leftBrow.up)
    this._setMorph('browOuterUpRight',rightBrow.up)
    this._setMorph('browInnerUp', clamp((leftBrow.up + rightBrow.up) / 2, 0, 1))

    // ── Нос (морщины) ─────────────────────────────────────────────────────────
    const sneer = clamp((leftBrow.down + rightBrow.down) * 0.3, 0, 1)
    this._setMorph('noseSneerLeft',  sneer)
    this._setMorph('noseSneerRight', sneer)

    // ── Поворот головы (кость Head) ───────────────────────────────────────────
    if (this.headBone) {
      const lec = { x: (lo.x + kp[LM.leftEyeInner].x)  / 2, y: (lo.y + kp[LM.leftEyeInner].y)  / 2 }
      const rec = { x: (ro.x + kp[LM.rightEyeInner].x) / 2, y: (ro.y + kp[LM.rightEyeInner].y) / 2 }
      const eyeMidX = (lec.x + rec.x) / 2
      const eyeMidY = (lec.y + rec.y) / 2
      const nose    = kp[LM.noseTip]

      // Рыскание (yaw): инвертируем — камера не зеркалит landmarks
      const yawTarget  = -((nose.x - eyeMidX) / iod) * 1.4

      // Наклон (pitch): нос ниже центра глаз → голова наклонена вниз
      const pitchTarget = ((nose.y - eyeMidY) / iod - 0.55) * 0.9

      // Крен (roll): угол линии глаз
      const rollTarget  = -Math.atan2(rec.y - lec.y, rec.x - lec.x) * 0.6

      const ALPHA_ROT = 0.2
      this._smoothRot.x += (pitchTarget - this._smoothRot.x) * ALPHA_ROT
      this._smoothRot.y += (yawTarget   - this._smoothRot.y) * ALPHA_ROT
      this._smoothRot.z += (rollTarget  - this._smoothRot.z) * ALPHA_ROT

      this.headBone.rotation.x = this._smoothRot.x
      this.headBone.rotation.y = this._smoothRot.y
      this.headBone.rotation.z = this._smoothRot.z
    }
  }
}
