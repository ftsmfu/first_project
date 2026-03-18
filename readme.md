# Face Mesh 3D — Avatar

Веб-приложение, которое захватывает видео с вебкамеры и в реальном времени управляет 3D-аватаром (Ready Player Me GLB) — мимикой и поворотом головы.

---

## Ветки

| Ветка | Описание |
|-------|----------|
| `main` | Стабильная версия: wireframe 3D-маска лица |
| `feature/avatar-integration` | **Текущая разработка**: интеграция GLB-аватара RPM с face tracking |

---

## feature/avatar-integration — что сделано

### Новое

- **`src/AvatarController.js`** — загрузка `avatar.glb` (Ready Player Me) через `GLTFLoader`, маппинг face landmarks на blend shapes и кость головы:
  - `eyeBlinkLeft / eyeBlinkRight` — моргание через Eye Aspect Ratio
  - `jawOpen` — открытие рта
  - `mouthSmileLeft / Right` — улыбка
  - `mouthFrownLeft / Right` — недовольство
  - `mouthPucker` — губы трубочкой
  - `browDownLeft / Right` — нахмуривание
  - `browOuterUpLeft / Right`, `browInnerUp` — поднятие бровей
  - `noseSneerLeft / Right` — морщины носа
  - Поворот кости `Head` по трём осям (yaw / pitch / roll)
  - Сглаживание через lerp (α=0.35 morph, α=0.2 ротация)

- **`src/Scene3D.js`** — переработана под аватар:
  - Камера: портрет головы (`position(0, 1.65, 0.75)`, `lookAt(0, 1.55, 0)`)
  - PBR-освещение: key + fill + rim
  - Асинхронная загрузка аватара при `init()`

- **`avatar.glb`** — модель аватара Ready Player Me (67 morph targets, ARKit-совместимые имена)

### Сохранено из main

- **`src/FaceTracker.js`** — захват камеры и детекция через MediaPipe Face Mesh (без изменений)
- Wireframe face mesh сохранён как overlay (`W` — включить/выключить)
- Превью камеры в правом нижнем углу

---

## Технологии

- **Three.js** — 3D-рендеринг, GLTFLoader, SkinnedMesh
- **TensorFlow.js** — запуск MediaPipe Face Mesh в браузере
- **MediaPipe Face Mesh** — детекция 468 ключевых точек лица
- **Ready Player Me** — GLB-аватар с ARKit blend shapes
- **Vite** — сборка и dev-сервер

## Структура проекта

```
avatar.glb                   — модель аватара Ready Player Me
src/
├── main.js                  — точка входа, главный цикл
├── FaceTracker.js           — захват камеры и детекция лица
├── Scene3D.js               — 3D-сцена, загрузка аватара, рендеринг
├── AvatarController.js      — маппинг landmarks → blend shapes + поворот головы
└── facemesh_tesselation.js  — индексы тесселяции (wireframe overlay)
```

## Запуск

```bash
npm install
npm run dev
```

Открыть в браузере: `http://localhost:5173`

> Требуется разрешение на доступ к камере.

## Управление

| Клавиша | Действие |
|---------|----------|
| `W` | Включить / выключить wireframe overlay лица |

## Как работает

1. `FaceTracker` запрашивает камеру и загружает модель MediaPipe Face Mesh через TensorFlow.js
2. `Scene3D.init()` загружает GLB-аватар в Three.js сцену
3. В каждом кадре — 468 точек лица передаются в `AvatarController.update()`
4. `AvatarController` вычисляет значения blend shapes и угол поворота головы, применяет их к SkinnedMesh и кости `Head`
5. Превью камеры отображается в правом нижнем углу
