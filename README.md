# @plasius/gpu-camera-controls

[![npm version](https://img.shields.io/npm/v/@plasius/gpu-camera-controls.svg)](https://www.npmjs.com/package/@plasius/gpu-camera-controls)
[![Build Status](https://img.shields.io/github/actions/workflow/status/Plasius-LTD/gpu-camera-controls/ci.yml?branch=main&label=build&style=flat)](https://github.com/Plasius-LTD/gpu-camera-controls/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Plasius-LTD/gpu-camera-controls)](./LICENSE)
[![Changelog](https://img.shields.io/badge/changelog-md-blue.svg)](./CHANGELOG.md)

Framework-agnostic touch, pointer, keyboard, and analog camera controls for
Plasius GPU renderers.

`@plasius/gpu-camera-controls` is the input and gesture layer for
`@plasius/gpu-camera`. It implements CameraControls-style interaction semantics
without depending on Three.js or importing `camera-controls` source.

## Install

```sh
npm install @plasius/gpu-camera-controls @plasius/gpu-camera
```

## Features

- one-finger orbit for editor and third-person views,
- one-finger look for spectator and first-person views,
- two-finger pinch dolly plus centroid truck/pan,
- three-finger truck/pan alias,
- normalized analog movement and look vectors,
- keyboard and mouse fallback inputs,
- smooth camera damping,
- terrain-floor clamping for collision-safe preview cameras.

## Usage

```js
import { createCameraControls } from "@plasius/gpu-camera-controls";

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

canvas.addEventListener("pointerdown", event => {
  controls.handlePointerDown(event);
});

canvas.addEventListener("pointermove", event => {
  controls.handlePointerMove(event);
});

canvas.addEventListener("pointerup", event => {
  controls.handlePointerUp(event);
});

function frame(deltaSeconds) {
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
- `controller.update(deltaSeconds)`
- `controller.getFrame()`

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
