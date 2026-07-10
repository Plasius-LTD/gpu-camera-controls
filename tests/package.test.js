import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCameraControls,
  gpuCameraControlsTouchActions,
  gpuCameraControlsViewModes,
} from "../src/index.js";

function approxEqual(actual, expected, epsilon = 1e-4) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} ~= ${expected}`);
}

function distance(camera) {
  const position = camera.transform.position;
  const target = camera.transform.target;
  return Math.hypot(
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2]
  );
}

function cameraAt(position = [0, 0, 10], target = [0, 0, 0]) {
  return {
    id: "test",
    transform: { position, target, up: [0, 1, 0] },
    projection: { kind: "perspective", fovY: 60, near: 0.1, far: 100, aspect: 1 },
  };
}

test("exports controls view modes and touch actions", () => {
  assert.deepEqual(gpuCameraControlsViewModes, [
    "editor",
    "spectator",
    "third-person",
    "first-person",
  ]);
  assert.deepEqual(gpuCameraControlsTouchActions, [
    "none",
    "rotate",
    "look",
    "dolly-truck",
    "truck",
  ]);
});

test("one-finger touch rotates orbit modes", () => {
  const controls = createCameraControls({
    viewMode: "third-person",
    camera: cameraAt(),
    draggingSmoothTime: 0,
  });

  controls.handlePointerDown({ pointerId: 1, pointerType: "touch", clientX: 10, clientY: 10 });
  controls.handlePointerMove({ pointerId: 1, pointerType: "touch", clientX: 90, clientY: 10 });

  const frame = controls.update(1 / 60);
  assert.equal(frame.activeGesture, "rotate");
  assert.notEqual(frame.targetCamera.transform.position[0], 0);
  assert.equal(frame.targetCamera.transform.target[0], 0);
});

test("one-finger touch looks in spectator and first-person modes", () => {
  const controls = createCameraControls({
    viewMode: "spectator",
    camera: cameraAt([0, 1.7, 0], [0, 1.7, -1]),
    draggingSmoothTime: 0,
  });

  controls.handlePointerDown({ pointerId: 1, pointerType: "touch", clientX: 10, clientY: 10 });
  controls.handlePointerMove({ pointerId: 1, pointerType: "touch", clientX: 90, clientY: 10 });

  const frame = controls.update(1 / 60);
  assert.equal(frame.activeGesture, "look");
  assert.notEqual(frame.targetCamera.transform.target[0], 0);
  approxEqual(frame.targetCamera.transform.position[0], 0);
});

test("two-finger touch dollies and trucks", () => {
  const controls = createCameraControls({
    viewMode: "editor",
    camera: cameraAt(),
    draggingSmoothTime: 0,
  });

  controls.handlePointerDown({ pointerId: 1, pointerType: "touch", clientX: 0, clientY: 0 });
  controls.handlePointerDown({ pointerId: 2, pointerType: "touch", clientX: 100, clientY: 0 });
  const beforeDistance = distance(controls.getFrame().targetCamera);

  controls.handlePointerMove({ pointerId: 1, pointerType: "touch", clientX: -20, clientY: 10 });
  controls.handlePointerMove({ pointerId: 2, pointerType: "touch", clientX: 140, clientY: 10 });

  const frame = controls.update(1 / 60);
  assert.equal(frame.activeGesture, "dolly-truck");
  assert.ok(distance(frame.targetCamera) < beforeDistance);
  assert.notDeepEqual(frame.targetCamera.transform.target, [0, 0, 0]);
});

test("three-finger touch aliases truck without changing dolly distance", () => {
  const controls = createCameraControls({
    viewMode: "editor",
    camera: cameraAt(),
    draggingSmoothTime: 0,
  });

  controls.handlePointerDown({ pointerId: 1, pointerType: "touch", clientX: 0, clientY: 0 });
  controls.handlePointerDown({ pointerId: 2, pointerType: "touch", clientX: 100, clientY: 0 });
  controls.handlePointerDown({ pointerId: 3, pointerType: "touch", clientX: 50, clientY: 100 });
  const beforeDistance = distance(controls.getFrame().targetCamera);

  controls.handlePointerMove({ pointerId: 1, pointerType: "touch", clientX: 20, clientY: 0 });
  controls.handlePointerMove({ pointerId: 2, pointerType: "touch", clientX: 120, clientY: 0 });
  controls.handlePointerMove({ pointerId: 3, pointerType: "touch", clientX: 70, clientY: 100 });

  const frame = controls.update(1 / 60);
  assert.equal(frame.activeGesture, "truck");
  approxEqual(distance(frame.targetCamera), beforeDistance);
  assert.notDeepEqual(frame.targetCamera.transform.target, [0, 0, 0]);
});

test("analog input normalizes movement, look, altitude, and sprint", () => {
  const controls = createCameraControls({
    viewMode: "spectator",
    camera: cameraAt([0, 3, 10], [0, 3, 9]),
    draggingSmoothTime: 0,
    analogDeadzone: 0.1,
  });

  controls.setAnalogInput({
    move: { x: 4, y: 4 },
    look: { x: 2, y: -2 },
    altitude: 1,
    sprint: true,
  });
  const frame = controls.update(1);

  assert.equal(frame.analogInput.sprint, true);
  approxEqual(Math.hypot(frame.analogInput.move.x, frame.analogInput.move.y), 1);
  approxEqual(Math.hypot(frame.analogInput.look.x, frame.analogInput.look.y), 1);
  assert.ok(frame.targetCamera.transform.position[1] > 3);
  assert.notEqual(frame.targetCamera.transform.target[0], 0);
});

test("keyboard and wheel fallbacks use the same camera frame semantics", () => {
  const controls = createCameraControls({
    viewMode: "third-person",
    camera: cameraAt(),
    draggingSmoothTime: 0,
  });

  const beforeDistance = distance(controls.getFrame().targetCamera);
  controls.handleWheel({ deltaY: -120 });
  controls.handleKeyDown({ code: "KeyW" });
  controls.handleKeyDown({ code: "ShiftLeft" });
  const frame = controls.update(1 / 2);

  assert.ok(distance(frame.targetCamera) < beforeDistance);
  assert.ok(frame.targetCamera.transform.position[2] < 10);
  controls.handleKeyUp({ code: "KeyW" });
  controls.handleKeyUp({ code: "ShiftLeft" });
  assert.equal(controls.update(1 / 60).activePointerCount, 0);
});

test("pointer cancel clears stale gesture state", () => {
  const controls = createCameraControls({ viewMode: "editor", camera: cameraAt() });

  controls.handlePointerDown({ pointerId: 1, pointerType: "touch", clientX: 0, clientY: 0 });
  assert.equal(controls.getFrame().activeGesture, "rotate");
  controls.handlePointerCancel({ pointerId: 1, pointerType: "touch", clientX: 0, clientY: 0 });

  const frame = controls.update(1);
  assert.equal(frame.activeGesture, "none");
  assert.equal(frame.activePointerCount, 0);
});

test("terrain floor provider keeps camera above world collision floor", () => {
  const controls = createCameraControls({
    viewMode: "spectator",
    camera: cameraAt([0, -10, 0], [0, -10, -1]),
    terrainFloorProvider: () => 4,
    terrainFloorOffset: 2,
    draggingSmoothTime: 0,
  });

  const frame = controls.update(1 / 60);
  assert.equal(frame.camera.transform.position[1], 6);
  assert.equal(frame.camera.transform.target[1], 6);
});
