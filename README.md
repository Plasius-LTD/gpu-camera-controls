# @plasius/gpu-camera-controls

[![npm version](https://img.shields.io/npm/v/@plasius/gpu-camera-controls.svg)](https://www.npmjs.com/package/@plasius/gpu-camera-controls)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/gpu-camera-controls/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/gpu-camera-controls/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Plasius-LTD/gpu-camera-controls)](./LICENSE)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Framework-agnostic multimodal camera controls for Plasius GPU renderers.

`@plasius/gpu-camera-controls` is the input and gesture layer for
`@plasius/gpu-camera`. It implements CameraControls-style interaction semantics
without depending on Three.js or importing `camera-controls` source, then
extends them across browser, gamepad, XR controller, XR hand, and external
device inputs.

## Install

```sh
npm install @plasius/gpu-camera-controls @plasius/gpu-camera
```

## Features

- one-finger orbit for editor, third-person, top-down, and inspect views,
- one-finger look for spectator, first-person, and XR views,
- two-finger pinch dolly plus centroid truck/pan,
- three-finger truck/pan alias,
- normalized analog movement and look vectors,
- keyboard, mouse, and standard gamepad fallback inputs,
- XR frame ingestion, hand-gesture recognition, and haptic effect queues,
- browser and XR subpath adapters,
- deterministic recording/replay and device diagnostics,
- smooth camera damping,
- terrain-floor clamping plus collision-provider integration.

## Usage

```js
import { createCameraControls } from "@plasius/gpu-camera-controls";
import { createBrowserCameraControlsBindings } from "@plasius/gpu-camera-controls/browser";

const controls = createCameraControls({
  viewMode: "third-person",
  camera: {
    id: "main",
    transform: {
      position: [0, 4, 12],
      target: [0, 1, 0],
      up: [0, 1, 0],
    },
    projection: {
      kind: "perspective",
      fovY: 62,
      near: 0.1,
      far: 1000,
      aspect: 16 / 9,
    },
  },
  terrainFloorProvider: (x, z) => sampleTerrainHeight(x, z),
});

const bindings = createBrowserCameraControlsBindings({
  controller: controls,
  element: canvas,
  pointerTarget: canvas,
  wheelTarget: canvas,
  keyTarget: window,
});
bindings.attach();

function frame(deltaSeconds) {
  bindings.update();
  const cameraFrame = controls.update(deltaSeconds);
  render(cameraFrame.camera);
}
```

## API

- `createCameraControls(options)`
- `controller.setViewMode(mode)`
- `controller.setCamera(camera)`
- `controller.setTerrainFloorProvider(provider)`
- `controller.handlePointerDown/Move/Up/Cancel(event)`
- `controller.handleWheel(event)`
- `controller.handleKeyDown/Up(event)`
- `controller.setAnalogInput(input)`
- `controller.applyInputFrame(input)`
- `controller.ingestGamepads(gamepads)`
- `controller.ingestXrFrame(snapshot)`
- `controller.queueHapticEffect(effect)`
- `controller.consumeHapticEffects()`
- `controller.beginRecording(label) / stopRecording() / playRecording(recording)`
- `controller.getDiagnostics()`
- `controller.update(deltaSeconds)`
- `controller.getFrame()`

Subpath exports:

- `@plasius/gpu-camera-controls/browser`
  - `createBrowserCameraControlsBindings(...)`
  - `createAnalogPadController(...)`
  - DOM event normalizers
- `@plasius/gpu-camera-controls/xr`
  - `createXrCameraControlsBridge(...)`
  - `recognizeXrHandGesture(...)`

The package accepts normalized event objects. Browser `PointerEvent`,
`WheelEvent`, and `KeyboardEvent` instances can be passed directly because the
controller reads only portable fields.

## Touch Defaults

| View mode | One finger | Two fingers | Three fingers |
| --- | --- | --- | --- |
| `editor` | Orbit | Dolly + truck | Truck |
| `third-person` | Orbit | Dolly + truck | Truck |
| `spectator` | Look | Dolly + truck | Truck |
| `first-person` | Look | Dolly + truck | Truck |
| `inspect` | Orbit | Dolly + truck | Truck |
| `xr-vr` | Look | Dolly + truck | Truck |
| `xr-ar` | Look | Dolly + truck | Truck |

Analog pads are supplied through `setAnalogInput(...)`, which lets each UI
render its own controls while keeping movement semantics deterministic.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run pack:check
```
