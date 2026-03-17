import { FaceTracker } from './FaceTracker.js'
import { Scene3D } from './Scene3D.js'

const statusEl = document.getElementById('status')
const videoPreview = document.getElementById('video-preview')

async function main() {
  statusEl.textContent = 'Запуск камеры...'
  const tracker = new FaceTracker()
  await tracker.init()
  videoPreview.srcObject = tracker.stream

  statusEl.textContent = 'Загрузка TF.js модели...'
  await tracker.loadModel()

  statusEl.textContent = 'Инициализация 3D сцены...'
  const scene = new Scene3D(document.getElementById('app'))
  scene.init()

  statusEl.textContent = 'Отслеживание...'

  let frames = 0
  async function loop() {
    const landmarks = await tracker.detect()
    if (landmarks && landmarks.length > 0) {
      scene.updateFace(landmarks, tracker.videoWidth, tracker.videoHeight)
      frames++
      if (frames % 60 === 0) {
        statusEl.textContent = `Точек: ${landmarks.length} | Активно`
      }
    } else if (frames > 0) {
      statusEl.textContent = 'Лицо не обнаружено'
    }
    requestAnimationFrame(loop)
  }

  loop()
}

main().catch((err) => {
  statusEl.textContent = `Ошибка: ${err.message}`
  console.error(err)
})
