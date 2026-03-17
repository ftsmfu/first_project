import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection'

export class FaceTracker {
  constructor() {
    this.detector = null
    this.video = null
    this.stream = null
    this.videoWidth = 640
    this.videoHeight = 480
  }

  async init() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      },
      audio: false,
    })

    this.video = document.createElement('video')
    this.video.srcObject = this.stream
    this.video.autoplay = true
    this.video.playsInline = true
    this.video.muted = true
    this.video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;'
    document.body.appendChild(this.video)

    await new Promise((resolve) => {
      this.video.onloadedmetadata = () => {
        this.videoWidth = this.video.videoWidth
        this.videoHeight = this.video.videoHeight
        resolve()
      }
    })

    await this.video.play()
  }

  async loadModel() {
    await tf.ready()
    const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh
    this.detector = await faceLandmarksDetection.createDetector(model, {
      runtime: 'tfjs',
      refineLandmarks: false,
      maxFaces: 1,
    })
  }

  async detect() {
    if (!this.detector || this.video.readyState < 2) return null
    try {
      const faces = await this.detector.estimateFaces(this.video, {
        flipHorizontal: false,
      })
      return faces.length > 0 ? faces[0].keypoints : null
    } catch (e) {
      console.error('detect error:', e)
      return null
    }
  }
}
