import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cameraControlEmbodiedActionsVersion,
  cameraControlActionKinds,
  cameraControlSourceFamilies,
  createCameraControls,
  gpuCameraControlsTouchActions,
  gpuCameraControlsViewModes,
} from "../src/index.js";
import {
  createAnalogPadController,
  createBrowserCameraControlsBindings,
  normalizeKeyEvent,
  normalizeWheelEvent,
} from "../src/browser.js";
import {
  createXrCameraControlsBridge,
  recognizeXrHandGesture,
} from "../src/xr.js";

function approxEqual(actual, expected, epsilon = 1e-4) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} ~= ${expected}`);
}

function cameraAt(position = [0, 0, 10], target = [0, 0, 0]) {
  return {
    id: "test",
    transform: { position, target, up: [0, 1, 0] },
    projection: { kind: "perspective", fovY: 60, near: 0.1, far: 100, aspect: 1 },
  };
}

test("exports multimodal view modes, actions, and source families", () => {
  assert.equal(cameraControlEmbodiedActionsVersion, 1);
  assert.deepEqual(gpuCameraControlsViewModes, [
    "editor",
    "spectator",
    "third-person",
    "first-person",
    "top-down",
    "isometric",
    "inspect",
    "xr-vr",
    "xr-ar",
  ]);
  assert.deepEqual(gpuCameraControlsTouchActions, [
    "none",
    "rotate",
    "look",
    "dolly-truck",
    "truck",
  ]);
  assert.ok(cameraControlActionKinds.includes("teleport"));
  assert.ok(cameraControlActionKinds.includes("jump"));
  assert.ok(cameraControlActionKinds.includes("crouch"));
  assert.ok(cameraControlActionKinds.includes("swim"));
  assert.ok(cameraControlActionKinds.includes("mode-transition"));
  assert.ok(cameraControlSourceFamilies.includes("xr-hand"));
});

test("normalizes edge-aware jump, crouch, and swim actions", () => {
  const controls = createCameraControls({
    viewMode: "first-person",
    camera: cameraAt([0, 1.7, 0], [0, 1.7, -1]),
    draggingSmoothTime: 0,
  });

  controls.handleKeyDown({ code: "Space" });
  let frame = controls.update(1 / 60);
  assert.equal(frame.actions.schemaVersion, 1);
  assert.deepEqual(frame.actions.jump, {
    active: true,
    pressed: true,
    released: false,
  });
  assert.deepEqual(frame.actions.crouch, {
    active: false,
    pressed: false,
    released: false,
  });
  assert.equal(frame.actions.swim.vertical, 1);

  frame = controls.update(1 / 60);
  assert.equal(frame.actions.jump.active, true);
  assert.equal(frame.actions.jump.pressed, false);

  controls.handleKeyUp({ code: "Space" });
  frame = controls.update(1 / 60);
  assert.deepEqual(frame.actions.jump, {
    active: false,
    pressed: false,
    released: true,
  });
  assert.equal(frame.actions.swim.vertical, 0);

  controls.applyInputFrame({
    crouch: true,
    swim: { vertical: -4 },
    source: {
      id: "touch-actions",
      family: "touch",
      kind: "action-pad",
    },
  });
  frame = controls.update(1 / 60);
  assert.equal(frame.actions.crouch.active, true);
  assert.equal(frame.actions.crouch.pressed, true);
  assert.equal(frame.actions.swim.vertical, -1);

  frame = controls.update(1 / 60);
  assert.equal(frame.actions.crouch.active, false);
  assert.equal(frame.actions.crouch.released, true);
});

test("begins, commits, and cancels explicit view-mode transitions", () => {
  const controls = createCameraControls({
    viewMode: "spectator",
    camera: cameraAt([10, 6, 20], [10, 2, 10]),
    draggingSmoothTime: 0,
  });
  const selectedWorldPosition = [...controls.getFrame().targetCamera.transform.target];

  controls.handleKeyDown({ code: "KeyW" });
  controls.setAnalogInput({
    move: { x: 1, y: 1 },
    jump: true,
    swimVertical: 1,
  });
  const transition = controls.beginViewModeTransition({
    id: "overview-to-first-person",
    to: "first-person",
    preserveWorldPosition: true,
  });

  assert.equal(transition.phase, "began");
  assert.equal(transition.cancelledInputEpoch, 1);
  let frame = controls.update(1 / 10);
  assert.equal(frame.viewMode, "spectator");
  assert.equal(frame.actions.modeTransition.phase, "began");
  assert.equal(frame.actions.jump.active, false);
  assert.deepEqual(frame.targetCamera.transform.position, [10, 6, 20]);

  controls.handleKeyDown({ code: "KeyW" });
  frame = controls.update(1 / 10);
  assert.deepEqual(frame.targetCamera.transform.position, [10, 6, 20]);

  controls.handleKeyUp({ code: "KeyW" });
  const committed = controls.commitViewModeTransition("overview-to-first-person");
  assert.equal(committed.phase, "committed");
  frame = controls.update(0);
  assert.equal(frame.viewMode, "first-person");
  assert.equal(frame.actions.modeTransition.phase, "committed");
  assert.deepEqual(frame.targetCamera.transform.target, selectedWorldPosition);

  const committedPosition = [...frame.targetCamera.transform.position];
  controls.handleKeyDown({ code: "KeyW" });
  frame = controls.update(1 / 10);
  assert.notDeepEqual(frame.targetCamera.transform.position, committedPosition);
  controls.handleKeyUp({ code: "KeyW" });

  controls.beginViewModeTransition({
    id: "first-person-to-isometric",
    to: "isometric",
  });
  assert.throws(
    () => controls.cancelViewModeTransition("wrong-transition"),
    /does not match/
  );
  const cancelled = controls.cancelViewModeTransition(
    "first-person-to-isometric",
    "streaming-aborted"
  );
  assert.equal(cancelled.phase, "cancelled");
  frame = controls.update(0);
  assert.equal(frame.viewMode, "first-person");
  assert.equal(frame.actions.modeTransition.phase, "cancelled");
  assert.equal(frame.actions.modeTransition.reason, "streaming-aborted");
});

test("suppresses cancelled gamepad input until the device returns to neutral", () => {
  const controls = createCameraControls({
    viewMode: "first-person",
    camera: cameraAt([0, 1.7, 0], [0, 1.7, -1]),
    draggingSmoothTime: 0,
  });
  const pressedButtons = new Array(11)
    .fill(null)
    .map((_, index) => ({
      pressed: index === 0,
      touched: index === 0,
      value: index === 0 ? 1 : 0,
    }));

  controls.ingestGamepads([
    {
      id: "Standard Pad",
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: pressedButtons,
    },
  ]);
  let frame = controls.update(1 / 60);
  assert.equal(frame.actions.jump.pressed, true);
  assert.equal(frame.actions.swim.vertical, 1);

  controls.cancelInputSources({ reason: "mode-transition" });
  controls.ingestGamepads([
    {
      id: "Standard Pad",
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: pressedButtons,
    },
  ]);
  frame = controls.update(1 / 60);
  assert.equal(frame.actions.jump.active, false);
  assert.equal(frame.actions.jump.released, true);

  controls.ingestGamepads([
    {
      id: "Standard Pad",
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: new Array(11)
        .fill(null)
        .map(() => ({ pressed: false, touched: false, value: 0 })),
    },
  ]);
  controls.update(1 / 60);
  controls.ingestGamepads([
    {
      id: "Standard Pad",
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: pressedButtons,
    },
  ]);
  frame = controls.update(1 / 60);
  assert.equal(frame.actions.jump.pressed, true);
});

test("one-finger rotate still works for orbit-centric modes", () => {
  const controls = createCameraControls({
    viewMode: "inspect",
    camera: cameraAt(),
    draggingSmoothTime: 0,
  });

  controls.handlePointerDown({ pointerId: 1, pointerType: "touch", clientX: 10, clientY: 10 });
  controls.handlePointerMove({ pointerId: 1, pointerType: "touch", clientX: 90, clientY: 10 });

  const frame = controls.update(1 / 60);
  assert.equal(frame.activeGesture, "rotate");
  assert.notEqual(frame.targetCamera.transform.position[0], 0);
});

test("manual action frames support truck, dolly, roll, and diagnostics", () => {
  const controls = createCameraControls({
    viewMode: "editor",
    camera: cameraAt(),
    draggingSmoothTime: 0,
  });

  controls.applyInputFrame({
    truck: { x: 0.5, y: -0.5 },
    dolly: 1.2,
    roll: 0.5,
    source: {
      id: "external:1",
      family: "external",
      kind: "tool",
      label: "Test tool",
    },
  });
  const beforeUp = controls.getFrame().targetCamera.transform.up;
  const frame = controls.update(1 / 4);

  assert.equal(frame.activeDevice, "external");
  assert.notDeepEqual(frame.targetCamera.transform.target, [0, 0, 0]);
  assert.ok(frame.distance < 10);
  assert.notDeepEqual(frame.targetCamera.transform.up, beforeUp);
  assert.equal(frame.diagnostics.activeDevice, "external");
});

test("gamepad ingestion drives movement and snap-turn haptics", () => {
  const controls = createCameraControls({
    viewMode: "first-person",
    camera: cameraAt([0, 1.7, 0], [0, 1.7, -1]),
    draggingSmoothTime: 0,
  });

  controls.ingestGamepads([
    {
      id: "Xbox Wireless Controller",
      connected: true,
      mapping: "standard",
      axes: [0.5, -1, 0.85, 0],
      buttons: new Array(11).fill(null).map(() => ({ pressed: false, touched: false, value: 0 })),
      hapticActuators: [],
    },
  ]);

  const frame = controls.update(1 / 2);
  assert.equal(frame.activeDevice, "gamepad");
  assert.ok(frame.targetCamera.transform.position[2] < 0);
  assert.ok(controls.consumeHapticEffects().length > 0);
});

test("xr viewer pose composes xr-vr locomotion frames", () => {
  const controls = createCameraControls({
    viewMode: "xr-vr",
    camera: cameraAt([0, 1.7, 0], [0, 1.7, -1]),
    draggingSmoothTime: 0,
  });

  controls.ingestXrFrame({
    sessionMode: "immersive-vr",
    referenceSpaceType: "local-floor",
    viewer: {
      position: [0.25, 1.65, 0.5],
      orientation: [0, 0, 0, 1],
      forward: [0, 0, -1],
      up: [0, 1, 0],
      emulatedPosition: false,
      views: [],
    },
    inputSources: [],
  });
  controls.applyInputFrame({
    move: { x: 0, y: 1 },
    viewerPose: {
      position: [0.25, 1.65, 0.5],
      orientation: [0, 0, 0, 1],
      forward: [0, 0, -1],
      up: [0, 1, 0],
      referenceSpaceType: "local-floor",
      emulatedPosition: false,
      views: [],
    },
    source: {
      id: "xr:right",
      family: "xr-controller",
      kind: "thumbstick",
      label: "right",
    },
  });

  const frame = controls.update(1 / 2);
  assert.equal(frame.viewMode, "xr-vr");
  assert.equal(frame.activeDevice, "xr-controller");
  assert.ok(frame.targetCamera.transform.position[2] < 0.5);
});

test("recording captures and replays camera frames deterministically", () => {
  const controls = createCameraControls({
    viewMode: "spectator",
    camera: cameraAt([0, 1.7, 0], [0, 1.7, -1]),
    draggingSmoothTime: 0,
  });

  controls.beginRecording("run");
  controls.setAnalogInput({
    move: { x: 0.2, y: 1 },
    look: { x: 0.2, y: 0 },
    altitude: 0.5,
    sprint: true,
  });
  const liveFrame = controls.update(1 / 3);
  const recording = controls.stopRecording();

  const replay = createCameraControls({
    viewMode: "spectator",
    camera: cameraAt([0, 1.7, 0], [0, 1.7, -1]),
    draggingSmoothTime: 0,
  });
  replay.playRecording(recording);
  const replayFrame = replay.update(1 / 3);

  assert.equal(recording.frames.length, 1);
  assert.deepEqual(replayFrame.targetCamera.transform.position, liveFrame.targetCamera.transform.position);
  assert.deepEqual(replayFrame.targetCamera.transform.target, liveFrame.targetCamera.transform.target);
});

test("analog pad controller normalizes touch-first thumb movement", () => {
  let published = null;
  const pad = createAnalogPadController({
    radius: 50,
    onChange: (state) => {
      published = state;
    },
  });
  const currentTarget = {
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 100, height: 100 };
    },
    setPointerCapture() {},
    hasPointerCapture() {
      return true;
    },
    releasePointerCapture() {},
  };

  pad.begin({
    pointerId: 1,
    clientX: 100,
    clientY: 0,
    currentTarget,
  });
  assert.ok(published);
  approxEqual(published.x, 0.707106, 1e-3);
  approxEqual(published.y, 0.707106, 1e-3);
  assert.equal(pad.isActive(), true);

  pad.move({
    pointerId: 1,
    clientX: 75,
    clientY: 50,
    currentTarget,
  });
  approxEqual(pad.getState().x, 0.5);
  approxEqual(pad.getState().y, 0);
  pad.setState({ x: -2, y: 0 });
  assert.deepEqual(pad.getState(), { x: -1, y: 0 });

  pad.cancel({
    pointerId: 1,
    clientX: 100,
    clientY: 0,
    currentTarget,
  });
  assert.deepEqual(pad.getState(), { x: 0, y: 0 });
  assert.equal(pad.isActive(), false);
});

test("browser event normalizers retain portable key and wheel fields", () => {
  assert.deepEqual(
    normalizeKeyEvent({ code: "Space", repeat: true, timeStamp: 12 }),
    { code: "Space", repeat: true, timeStamp: 12 }
  );
  assert.deepEqual(
    normalizeWheelEvent({ deltaY: -120, timeStamp: 15 }),
    { deltaY: -120, timeStamp: 15 }
  );
});

test("browser bindings poll gamepads and forward analog state", () => {
  const controls = createCameraControls({
    viewMode: "spectator",
    camera: cameraAt([0, 1.7, 0], [0, 1.7, -1]),
    draggingSmoothTime: 0,
  });
  const keyTarget = new EventTarget();
  const pointerListeners = new Map();
  const pointerTarget = {
    captures: new Set(),
    addEventListener(type, listener) {
      pointerListeners.set(type, listener);
    },
    removeEventListener(type) {
      pointerListeners.delete(type);
    },
    setPointerCapture(pointerId) {
      this.captures.add(pointerId);
    },
    hasPointerCapture(pointerId) {
      return this.captures.has(pointerId);
    },
    releasePointerCapture(pointerId) {
      this.captures.delete(pointerId);
    },
  };
  const bindings = createBrowserCameraControlsBindings({
    controller: controls,
    keyTarget,
    pointerTarget,
    wheelTarget: pointerTarget,
    gamepadProvider: () => [
      {
        id: "DualSense",
        connected: true,
        mapping: "standard",
        axes: [0, -1, 0, 0],
        buttons: new Array(11).fill(null).map(() => ({ pressed: false, touched: false, value: 0 })),
      },
    ],
  });

  bindings.attach().setAnalogState("move", { x: 0.3, y: 0.4 }).setSprint(true).update();
  const pointerDown = pointerListeners.get("pointerdown");
  const pointerUp = pointerListeners.get("pointerup");
  assert.equal(typeof pointerDown, "function");
  assert.equal(typeof pointerUp, "function");
  const pointerEvent = {
    pointerId: 7,
    pointerType: "touch",
    clientX: 20,
    clientY: 30,
    button: 0,
    buttons: 1,
    timeStamp: 12,
    currentTarget: pointerTarget,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  pointerDown(pointerEvent);
  assert.equal(pointerEvent.defaultPrevented, true);
  assert.equal(pointerTarget.hasPointerCapture(7), true);
  pointerUp(pointerEvent);
  assert.equal(pointerTarget.hasPointerCapture(7), false);
  const frame = controls.update(1 / 2);
  assert.equal(frame.activeDevice, "gamepad");
  assert.ok(frame.targetCamera.transform.position[2] < 0);
  bindings.detach();
});

test("browser bindings expose touch action state and cancel it on detach", () => {
  const controls = createCameraControls({
    viewMode: "first-person",
    camera: cameraAt([0, 1.7, 0], [0, 1.7, -1]),
    draggingSmoothTime: 0,
  });
  const bindings = createBrowserCameraControlsBindings({
    controller: controls,
    keyTarget: new EventTarget(),
    pointerTarget: new EventTarget(),
    gamepadProvider: () => [],
  });

  bindings
    .attach()
    .setAltitude(0.25)
    .setJump(true)
    .setCrouch(true)
    .setSwimVertical(-0.6);
  let frame = controls.update(1 / 60);
  assert.equal(frame.actions.jump.active, true);
  assert.equal(frame.actions.crouch.active, true);
  assert.equal(frame.actions.swim.vertical, -0.6);
  assert.equal(bindings.getDiagnostics().attached, true);

  controls.handleKeyDown({ code: "KeyW" });
  bindings.cancelObsoleteInputs("test-cancel");
  assert.equal(controls.getDiagnostics().lastInputCancellation.reason, "test-cancel");
  bindings.detach();
  controls.handleKeyDown({ code: "KeyW" });
  frame = controls.update(1 / 60);
  assert.equal(frame.actions.jump.active, false);
  assert.equal(frame.actions.jump.released, true);
  assert.equal(frame.actions.crouch.released, true);
  assert.ok(frame.targetCamera.transform.position[2] < 0);
  assert.deepEqual(bindings.getAnalogInput(), {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    altitude: 0,
    sprint: false,
    jump: false,
    crouch: false,
    swimVertical: 0,
  });
});

test("xr hand gesture recognition and bridge translate pinches into input", () => {
  const controls = createCameraControls({
    viewMode: "xr-ar",
    camera: cameraAt([0, 1.7, 0], [0, 1.7, -1]),
    draggingSmoothTime: 0,
  });
  const bridge = createXrCameraControlsBridge({ controller: controls });
  const pinchHand = {
    joints: [
      { name: "thumb-tip", pose: { position: [0, 0, 0] } },
      { name: "index-finger-tip", pose: { position: [0.01, 0, 0] } },
      { name: "middle-finger-tip", pose: { position: [0.02, 0, 0] } },
    ],
  };
  const gesture = recognizeXrHandGesture(pinchHand);
  assert.equal(gesture.pinch, true);

  const frameSnapshot = {
    inputSources: [
      {
        id: "left-hand",
        handedness: "left",
        kind: "hand",
        hand: pinchHand,
      },
      {
        id: "right-hand",
        handedness: "right",
        kind: "hand",
        hand: {
          joints: [
            { name: "thumb-tip", pose: { position: [0.1, 0, 0] } },
            { name: "index-finger-tip", pose: { position: [0.11, 0, 0] } },
          ],
        },
      },
    ],
  };

  bridge.syncFrame(frameSnapshot);
  bridge.syncFrame({
    inputSources: [
      {
        id: "left-hand",
        handedness: "left",
        kind: "hand",
        hand: {
          joints: [
            { name: "thumb-tip", pose: { position: [0.02, 0.01, 0] } },
            { name: "index-finger-tip", pose: { position: [0.03, 0.01, 0] } },
          ],
        },
      },
      {
        id: "right-hand",
        handedness: "right",
        kind: "hand",
        hand: {
          joints: [
            { name: "thumb-tip", pose: { position: [0.12, 0.01, 0] } },
            { name: "index-finger-tip", pose: { position: [0.13, 0.01, 0] } },
          ],
        },
      },
    ],
  });

  const frame = controls.update(1 / 4);
  assert.ok(frame.targetCamera.transform.position[0] !== 0 || frame.targetCamera.transform.target[0] !== 0);
});
