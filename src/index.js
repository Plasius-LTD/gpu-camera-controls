import {
  applyCameraControl,
  cameraViewModes,
  resolveCameraComfortProfile,
  resolveCameraLocomotionState,
  resolveCameraRigFrame,
} from "@plasius/gpu-camera";

const EPSILON = 1e-6;
const DEFAULT_UP = Object.freeze([0, 1, 0]);
const DEFAULT_CAMERA = Object.freeze({
  id: "main",
  transform: {
    position: [0, 3, 8],
    target: [0, 1, 0],
    up: DEFAULT_UP,
  },
  projection: {
    kind: "perspective",
    fovY: 62,
    near: 0.1,
    far: 1000,
    aspect: 1,
  },
});

export const gpuCameraControlsViewModes = cameraViewModes;

export const cameraControlEmbodiedActionsVersion = 1;

export const gpuCameraControlsTouchActions = Object.freeze([
  "none",
  "rotate",
  "look",
  "dolly-truck",
  "truck",
]);

export const cameraControlActionKinds = Object.freeze([
  "move",
  "look",
  "orbit",
  "truck",
  "dolly",
  "elevate",
  "roll",
  "smooth-turn",
  "snap-turn",
  "teleport",
  "focus",
  "recenter",
  "sprint",
  "precision",
  "jump",
  "crouch",
  "swim",
  "mode-transition",
]);

export const cameraControlSourceFamilies = Object.freeze([
  "touch",
  "pen",
  "mouse",
  "keyboard",
  "gamepad",
  "xr-controller",
  "xr-hand",
  "external",
]);

const DEFAULT_BINDINGS = Object.freeze({
  keyboard: Object.freeze({
    moveForward: ["KeyW"],
    moveBackward: ["KeyS"],
    moveLeft: ["KeyA"],
    moveRight: ["KeyD"],
    elevateUp: ["Space"],
    elevateDown: ["ControlLeft", "ControlRight"],
    sprint: ["ShiftLeft", "ShiftRight"],
    recenter: ["KeyR"],
    precision: ["AltLeft", "AltRight"],
    jump: ["Space"],
    crouch: ["ControlLeft", "ControlRight"],
    swimUp: ["Space"],
    swimDown: ["ControlLeft", "ControlRight"],
  }),
  gamepad: Object.freeze({
    moveAxes: [0, 1],
    lookAxes: [2, 3],
    altitudeButtons: [6, 7],
    sprintButtons: [10, 0],
    precisionButtons: [4],
    focusButtons: [2],
    recenterButtons: [8],
    jumpButtons: [0],
    crouchButtons: [1],
    swimUpButtons: [0],
    swimDownButtons: [1],
  }),
  xr: Object.freeze({
    moveAxes: [2, 3],
    lookAxes: [0, 1],
    snapTurnAxis: 2,
    dominantHand: "right",
    jumpButtons: [0],
    crouchButtons: [1],
    swimUpButtons: [0],
    swimDownButtons: [1],
  }),
});

const DEFAULT_OPTIONS = Object.freeze({
  viewMode: "spectator",
  minDistance: 2.5,
  maxDistance: 80,
  minPolarAngle: 0.08,
  maxPolarAngle: Math.PI - 0.08,
  moveSpeed: 9,
  editorMoveSpeed: 13,
  sprintMultiplier: 2.1,
  rotateSensitivity: 0.0042,
  lookSensitivity: 0.0032,
  analogLookSpeed: 1.9,
  truckSensitivity: 0.0028,
  dollySensitivity: 0.018,
  wheelDollySensitivity: 0.01,
  rollSensitivity: 0.85,
  smoothTurnSpeed: Math.PI,
  snapTurnDegrees: 30,
  precisionMultiplier: 0.35,
  analogDeadzone: 0.12,
  smoothTime: 0.22,
  draggingSmoothTime: 0.1,
  terrainFloorOffset: 1.7,
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cloneVec3(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length < 3) {
    return [...fallback];
  }
  return [
    finiteNumber(value[0], fallback[0]),
    finiteNumber(value[1], fallback[1]),
    finiteNumber(value[2], fallback[2]),
  ];
}

function addVec3(left, right) {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subVec3(left, right) {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scaleVec3(vector, scalar) {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function crossVec3(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function lengthVec3(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalizeVec3(vector, fallback = [0, 0, -1]) {
  const length = lengthVec3(vector);
  if (length <= EPSILON) {
    return [...fallback];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function distanceVec3(left, right) {
  return lengthVec3(subVec3(left, right));
}

function lerp(left, right, alpha) {
  return left + (right - left) * alpha;
}

function lerpVec3(left, right, alpha) {
  return [
    lerp(left[0], right[0], alpha),
    lerp(left[1], right[1], alpha),
    lerp(left[2], right[2], alpha),
  ];
}

function normalizeViewMode(value) {
  const viewMode = String(value ?? "").trim();
  return cameraViewModes.includes(viewMode) ? viewMode : DEFAULT_OPTIONS.viewMode;
}

function requireViewMode(value) {
  const viewMode = String(value ?? "").trim();
  if (!cameraViewModes.includes(viewMode)) {
    throw new RangeError(`Unsupported camera view mode "${viewMode}".`);
  }
  return viewMode;
}

function normalizeCamera(camera = DEFAULT_CAMERA) {
  const base = camera && typeof camera === "object" ? camera : DEFAULT_CAMERA;
  const transform = base.transform ?? {};
  return applyCameraControl(
    {
      ...DEFAULT_CAMERA,
      ...base,
      transform: {
        position: cloneVec3(transform.position, DEFAULT_CAMERA.transform.position),
        target: cloneVec3(transform.target, DEFAULT_CAMERA.transform.target),
        up: normalizeVec3(cloneVec3(transform.up, DEFAULT_UP), DEFAULT_UP),
      },
      projection: {
        ...DEFAULT_CAMERA.projection,
        ...(base.projection ?? {}),
      },
    },
    {
      type: "set-look-at",
      position: cloneVec3(transform.position, DEFAULT_CAMERA.transform.position),
      target: cloneVec3(transform.target, DEFAULT_CAMERA.transform.target),
      up: normalizeVec3(cloneVec3(transform.up, DEFAULT_UP), DEFAULT_UP),
    }
  );
}

function cloneCamera(camera) {
  return {
    ...camera,
    transform: {
      position: cloneVec3(camera.transform.position),
      target: cloneVec3(camera.transform.target),
      up: cloneVec3(camera.transform.up, DEFAULT_UP),
    },
    projection: {
      ...camera.projection,
    },
    viewport: camera.viewport ? { ...camera.viewport } : undefined,
    metadata: camera.metadata ? { ...camera.metadata } : undefined,
  };
}

function cameraBasis(camera) {
  const forward = normalizeVec3(
    subVec3(camera.transform.target, camera.transform.position),
    [0, 0, -1]
  );
  const right = normalizeVec3(crossVec3(forward, camera.transform.up), [1, 0, 0]);
  const up = normalizeVec3(crossVec3(right, forward), DEFAULT_UP);
  const flatForward = normalizeVec3([forward[0], 0, forward[2]], [0, 0, -1]);
  const flatRight = normalizeVec3([right[0], 0, right[2]], [1, 0, 0]);
  return { forward, right, up, flatForward, flatRight };
}

function normalizeAnalogVector(vector = {}) {
  const x = finiteNumber(vector.x, 0);
  const y = finiteNumber(vector.y, 0);
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return { x: x / length, y: y / length };
}

function applyDeadzone(vector, deadzone) {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= deadzone) {
    return { x: 0, y: 0 };
  }
  const scaledLength = clamp((length - deadzone) / (1 - deadzone), 0, 1);
  return {
    x: (vector.x / length) * scaledLength,
    y: (vector.y / length) * scaledLength,
  };
}

function pointerFromEvent(event) {
  return {
    pointerId: Number(event.pointerId),
    pointerType: String(event.pointerType ?? "mouse"),
    clientX: finiteNumber(event.clientX, 0),
    clientY: finiteNumber(event.clientY, 0),
    button: finiteNumber(event.button, 0),
    buttons: finiteNumber(event.buttons, 1),
    timeStamp: finiteNumber(event.timeStamp, 0),
  };
}

function centroid(pointers) {
  const total = pointers.reduce(
    (acc, pointer) => {
      acc.x += pointer.clientX;
      acc.y += pointer.clientY;
      return acc;
    },
    { x: 0, y: 0 }
  );
  return {
    x: total.x / pointers.length,
    y: total.y / pointers.length,
  };
}

function averageDistanceFromCentroid(pointers, center) {
  if (pointers.length === 0) return 0;
  return pointers.reduce((sum, pointer) => {
    return sum + Math.hypot(pointer.clientX - center.x, pointer.clientY - center.y);
  }, 0) / pointers.length;
}

function gestureForPointers(viewMode, pointers) {
  if (pointers.length >= 3) return "truck";
  if (pointers.length === 2) return "dolly-truck";
  if (pointers.length === 1) {
    return viewMode === "editor" || viewMode === "third-person" || viewMode === "inspect"
      || viewMode === "isometric"
      ? "rotate"
      : "look";
  }
  return "none";
}

function settleAlpha(deltaSeconds, smoothTime) {
  if (smoothTime <= EPSILON) return 1;
  return clamp(1 - Math.exp(-Math.max(0, deltaSeconds) / smoothTime), 0, 1);
}

function smoothCamera(current, target, alpha) {
  const next = cloneCamera(target);
  next.transform.position = lerpVec3(current.transform.position, target.transform.position, alpha);
  next.transform.target = lerpVec3(current.transform.target, target.transform.target, alpha);
  next.transform.up = normalizeVec3(lerpVec3(current.transform.up, target.transform.up, alpha), DEFAULT_UP);
  return next;
}

function normalizeBindings(bindings = {}) {
  return {
    keyboard: {
      ...DEFAULT_BINDINGS.keyboard,
      ...(bindings.keyboard ?? {}),
    },
    gamepad: {
      ...DEFAULT_BINDINGS.gamepad,
      ...(bindings.gamepad ?? {}),
    },
    xr: {
      ...DEFAULT_BINDINGS.xr,
      ...(bindings.xr ?? {}),
    },
  };
}

function normalizeActionFrame(input = {}) {
  const swimVertical = typeof input.swim === "number"
    ? input.swim
    : input.swim?.vertical;
  return {
    move: normalizeAnalogVector(input.move),
    look: normalizeAnalogVector(input.look),
    orbit: normalizeAnalogVector(input.orbit),
    truck: normalizeAnalogVector(input.truck),
    dolly: finiteNumber(input.dolly, 0),
    elevate: clamp(finiteNumber(input.elevate, 0), -1, 1),
    roll: clamp(finiteNumber(input.roll, 0), -1, 1),
    smoothTurn: clamp(finiteNumber(input.smoothTurn, 0), -1, 1),
    snapTurn: clamp(finiteNumber(input.snapTurn, 0), -1, 1),
    sprint: input.sprint === true,
    precision: input.precision === true,
    focus: input.focus === true,
    recenter: input.recenter === true,
    jump: input.jump === true,
    crouch: input.crouch === true,
    swim: {
      vertical: clamp(finiteNumber(swimVertical, 0), -1, 1),
    },
    teleport:
      input.teleport && typeof input.teleport === "object"
        ? {
            position: Array.isArray(input.teleport.position)
              ? cloneVec3(input.teleport.position)
              : null,
            target: Array.isArray(input.teleport.target)
              ? cloneVec3(input.teleport.target)
              : null,
          }
        : null,
    source:
      input.source && typeof input.source === "object"
        ? {
            id: String(input.source.id ?? "external"),
            family: String(input.source.family ?? "external"),
            kind: String(input.source.kind ?? "input"),
            label: input.source.label == null ? null : String(input.source.label),
          }
        : null,
    viewerPose:
      input.viewerPose && typeof input.viewerPose === "object"
        ? { ...input.viewerPose }
        : null,
    locomotion:
      input.locomotion && typeof input.locomotion === "object"
        ? { ...input.locomotion }
        : null,
    haptics: Array.isArray(input.haptics) ? [...input.haptics] : [],
    debug:
      input.debug && typeof input.debug === "object"
        ? { ...input.debug }
        : null,
  };
}

function mergeActionFrames(base, input) {
  const next = normalizeActionFrame(base);
  const normalized = normalizeActionFrame(input);
  return {
    move: {
      x: clamp(next.move.x + normalized.move.x, -1, 1),
      y: clamp(next.move.y + normalized.move.y, -1, 1),
    },
    look: {
      x: clamp(next.look.x + normalized.look.x, -1, 1),
      y: clamp(next.look.y + normalized.look.y, -1, 1),
    },
    orbit: {
      x: clamp(next.orbit.x + normalized.orbit.x, -1, 1),
      y: clamp(next.orbit.y + normalized.orbit.y, -1, 1),
    },
    truck: {
      x: clamp(next.truck.x + normalized.truck.x, -1, 1),
      y: clamp(next.truck.y + normalized.truck.y, -1, 1),
    },
    dolly: next.dolly + normalized.dolly,
    elevate: clamp(next.elevate + normalized.elevate, -1, 1),
    roll: clamp(next.roll + normalized.roll, -1, 1),
    smoothTurn: clamp(next.smoothTurn + normalized.smoothTurn, -1, 1),
    snapTurn: normalized.snapTurn !== 0 ? normalized.snapTurn : next.snapTurn,
    sprint: next.sprint || normalized.sprint,
    precision: next.precision || normalized.precision,
    focus: next.focus || normalized.focus,
    recenter: next.recenter || normalized.recenter,
    jump: next.jump || normalized.jump,
    crouch: next.crouch || normalized.crouch,
    swim: {
      vertical: clamp(
        next.swim.vertical + normalized.swim.vertical,
        -1,
        1
      ),
    },
    teleport: normalized.teleport ?? next.teleport,
    source: normalized.source ?? next.source,
    viewerPose: normalized.viewerPose ?? next.viewerPose,
    locomotion: normalized.locomotion ?? next.locomotion,
    haptics: [...next.haptics, ...normalized.haptics],
    debug: normalized.debug ?? next.debug,
  };
}

function createEmptyActionFrame() {
  return normalizeActionFrame({});
}

function normalizeGamepadSnapshot(gamepad, index) {
  if (!gamepad) {
    return null;
  }
  const axes = Array.isArray(gamepad.axes)
    ? gamepad.axes.map((axis) => clamp(finiteNumber(axis, 0), -1, 1))
    : [];
  const buttons = Array.isArray(gamepad.buttons)
    ? gamepad.buttons.map((button, buttonIndex) => ({
        index: buttonIndex,
        pressed: button?.pressed === true,
        touched: button?.touched === true,
        value: clamp(finiteNumber(button?.value, 0), 0, 1),
      }))
    : [];
  return {
    id: String(gamepad.id ?? `gamepad-${index}`),
    index,
    mapping: String(gamepad.mapping ?? ""),
    connected: gamepad.connected !== false,
    axes,
    buttons,
    hapticActuators: Array.isArray(gamepad.hapticActuators)
      ? [...gamepad.hapticActuators]
      : [],
  };
}

function normalizeXrSourceSnapshot(source, index) {
  return {
    id: String(source?.id ?? `xr-source-${index}`),
    family: source?.kind === "hand" ? "xr-hand" : "xr-controller",
    handedness: String(source?.handedness ?? "none"),
    kind: String(source?.kind ?? "controller"),
    gamepad: source?.gamepad ?? null,
    hand: source?.hand ?? null,
    targetRayPose: source?.targetRayPose ?? null,
    gripPose: source?.gripPose ?? null,
    selectPressed: source?.selectPressed === true,
    squeezePressed: source?.squeezePressed === true,
  };
}

function describeSource(input) {
  if (!input) {
    return null;
  }
  return {
    id: String(input.id ?? "external"),
    family: String(input.family ?? "external"),
    kind: String(input.kind ?? "input"),
    label: input.label == null ? null : String(input.label),
  };
}

function applyFloor(camera, terrainFloorProvider, floorOffset, viewMode) {
  if (typeof terrainFloorProvider !== "function") {
    return camera;
  }
  const next = cloneCamera(camera);
  const floor = finiteNumber(
    terrainFloorProvider(
      next.transform.position[0],
      next.transform.position[2],
      { viewMode, camera: next }
    ),
    Number.NEGATIVE_INFINITY
  );
  const minY = floor + floorOffset;
  if (Number.isFinite(minY) && next.transform.position[1] < minY) {
    const deltaY = minY - next.transform.position[1];
    next.transform.position[1] += deltaY;
    next.transform.target[1] += deltaY;
  }
  return next;
}

function applyCollision(camera, collisionProvider, viewMode) {
  if (typeof collisionProvider !== "function") {
    return {
      camera,
      blocked: false,
      metadata: null,
    };
  }
  const resolution = collisionProvider(
    [...camera.transform.position],
    [...camera.transform.target],
    { viewMode, camera: cloneCamera(camera) }
  );
  if (!resolution || typeof resolution !== "object") {
    return {
      camera,
      blocked: false,
      metadata: null,
    };
  }
  const next = cloneCamera(camera);
  if (Array.isArray(resolution.position)) {
    next.transform.position = cloneVec3(resolution.position, next.transform.position);
  }
  if (Array.isArray(resolution.target)) {
    next.transform.target = cloneVec3(resolution.target, next.transform.target);
  }
  if (Array.isArray(resolution.up)) {
    next.transform.up = normalizeVec3(cloneVec3(resolution.up, next.transform.up), DEFAULT_UP);
  }
  return {
    camera: next,
    blocked: resolution.blocked === true,
    metadata:
      resolution.metadata && typeof resolution.metadata === "object"
        ? { ...resolution.metadata }
        : null,
  };
}

function shallowEqualVec3(left, right, epsilon = 1e-3) {
  return (
    Math.abs(left[0] - right[0]) <= epsilon &&
    Math.abs(left[1] - right[1]) <= epsilon &&
    Math.abs(left[2] - right[2]) <= epsilon
  );
}

function normalizeBindingValues(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value == null ? [] : [value];
}

function createButtonAction(active, previousActive) {
  return {
    active,
    pressed: active && !previousActive,
    released: !active && previousActive,
  };
}

function cloneModeTransition(transition) {
  if (!transition) {
    return null;
  }
  return {
    ...transition,
    worldPosition: transition.worldPosition
      ? cloneVec3(transition.worldPosition)
      : null,
  };
}

function translateCameraTarget(camera, worldPosition) {
  const next = cloneCamera(camera);
  const target = cloneVec3(worldPosition, next.transform.target);
  const delta = subVec3(target, next.transform.target);
  next.transform.position = addVec3(next.transform.position, delta);
  next.transform.target = target;
  return next;
}

export function createCameraControls(options = {}) {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
    viewMode: normalizeViewMode(options.viewMode),
    analogDeadzone: clamp(finiteNumber(options.analogDeadzone, DEFAULT_OPTIONS.analogDeadzone), 0, 0.95),
    minDistance: Math.max(EPSILON, finiteNumber(options.minDistance, DEFAULT_OPTIONS.minDistance)),
    maxDistance: Math.max(
      finiteNumber(options.minDistance, DEFAULT_OPTIONS.minDistance) + EPSILON,
      finiteNumber(options.maxDistance, DEFAULT_OPTIONS.maxDistance)
    ),
  };

  let viewMode = config.viewMode;
  let terrainFloorProvider = typeof options.terrainFloorProvider === "function"
    ? options.terrainFloorProvider
    : null;
  let collisionProvider = typeof options.collisionProvider === "function"
    ? options.collisionProvider
    : null;
  let bindings = normalizeBindings(options.bindings);
  let comfortProfile = resolveCameraComfortProfile(options.comfortProfile ?? {});
  let currentCamera = normalizeCamera(options.camera);
  let targetCamera = cloneCamera(currentCamera);
  let activeGesture = "none";
  let lastGestureCenter = null;
  let lastGestureDistance = 0;
  let queuedFrameInput = createEmptyActionFrame();
  let playback = null;
  let activeDevice = "none";
  let diagnosticsContext = {};
  let lastRecording = null;
  let inputEpoch = 0;
  let lastInputCancellation = null;
  let gamepadSuppressedUntilNeutral = false;
  let xrSuppressedUntilNeutral = false;
  let transitionSequence = 0;
  let activeModeTransition = null;
  let queuedModeTransitionEvent = null;
  let previousEmbodiedState = {
    jump: false,
    crouch: false,
  };
  let lastEmbodiedActions = {
    schemaVersion: cameraControlEmbodiedActionsVersion,
    jump: createButtonAction(false, false),
    crouch: createButtonAction(false, false),
    swim: { vertical: 0 },
    modeTransition: null,
  };

  const pointers = new Map();
  const keys = new Set();
  const blockedKeys = new Set();
  const deviceStates = new Map();
  let analogInput = {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    altitude: 0,
    sprint: false,
    jump: false,
    crouch: false,
    swimVertical: 0,
  };
  let hapticQueue = [];
  let recording = {
    active: false,
    label: null,
    frames: [],
  };
  let gamepads = [];
  let xrState = {
    frame: null,
    sources: [],
    viewer: null,
    locomotion: resolveCameraLocomotionState({}),
    mode: null,
  };
  let gamepadTurnLatch = 0;
  let xrTurnLatch = 0;

  const controlOptions = () => ({
    minDistance: config.minDistance,
    maxDistance: config.maxDistance,
    minPolarAngle: config.minPolarAngle,
    maxPolarAngle: config.maxPolarAngle,
  });

  const setGestureState = () => {
    const activePointers = [...pointers.values()];
    activeGesture = gestureForPointers(viewMode, activePointers);
    if (activePointers.length >= 2) {
      lastGestureCenter = centroid(activePointers);
      lastGestureDistance = averageDistanceFromCentroid(activePointers, lastGestureCenter);
    } else if (activePointers.length === 1) {
      lastGestureCenter = {
        x: activePointers[0].clientX,
        y: activePointers[0].clientY,
      };
      lastGestureDistance = 0;
    } else {
      lastGestureCenter = null;
      lastGestureDistance = 0;
    }
  };

  const queueHapticEffect = (effect = {}) => {
    hapticQueue.push({
      target: effect.target ?? null,
      amplitude: clamp(finiteNumber(effect.amplitude, 0.5), 0, 1),
      durationMs: Math.max(1, finiteNumber(effect.durationMs, 35)),
      family: effect.family == null ? null : String(effect.family),
    });
    return controller;
  };

  const applyControl = (control) => {
    targetCamera = applyCameraControl(targetCamera, control, controlOptions());
    const collision = applyCollision(targetCamera, collisionProvider, viewMode);
    targetCamera = collision.camera;
    targetCamera = applyFloor(targetCamera, terrainFloorProvider, config.terrainFloorOffset, viewMode);
  };

  const applyScreenTruck = (deltaX, deltaY) => {
    const { right, up } = cameraBasis(targetCamera);
    const distance = distanceVec3(targetCamera.transform.position, targetCamera.transform.target);
    const scale = Math.max(0.2, distance) * config.truckSensitivity;
    const delta = addVec3(scaleVec3(right, -deltaX * scale), scaleVec3(up, deltaY * scale));
    applyControl({ type: "truck", delta });
  };

  const setRigForMode = () => {
    if (viewMode === "xr-vr" || viewMode === "xr-ar") {
      return;
    }
    const basis = cameraBasis(targetCamera);
    const rigFrame = resolveCameraRigFrame({
      viewMode,
      camera: targetCamera,
      anchors: {
        target: cloneVec3(targetCamera.transform.target),
        head: cloneVec3(targetCamera.transform.position),
        forward: basis.flatForward,
        up: [0, 1, 0],
      },
      activeControl: true,
    });
    targetCamera = rigFrame.camera;
    currentCamera = rigFrame.camera;
  };

  const updateActiveSource = (source) => {
    const descriptor = describeSource(source);
    if (!descriptor) {
      return;
    }
    activeDevice = descriptor.family;
    deviceStates.set(descriptor.id, {
      ...descriptor,
      lastSeenAt: Date.now(),
    });
  };

  const hasBoundKey = (bindingName) => normalizeBindingValues(
    bindings.keyboard[bindingName]
  ).some((code) => keys.has(String(code)));

  const isButtonPressed = (snapshot, index) => {
    const button = snapshot?.buttons?.[Number(index)];
    return button?.pressed === true || finiteNumber(button?.value, 0) > 0.5;
  };

  const hasBoundButton = (snapshot, values) => normalizeBindingValues(values)
    .some((index) => isButtonPressed(snapshot, index));

  const isGamepadNeutral = (snapshot) => {
    if (!snapshot) {
      return true;
    }
    const axesNeutral = snapshot.axes.every(
      (axis) => Math.abs(finiteNumber(axis, 0)) <= config.analogDeadzone
    );
    const buttonsNeutral = snapshot.buttons.every(
      (button) => button?.pressed !== true && finiteNumber(button?.value, 0) <= 0.1
    );
    return axesNeutral && buttonsNeutral;
  };

  const isXrNeutral = () => xrState.sources.every((source) => {
    const gamepad = source?.gamepad;
    const axes = Array.isArray(gamepad?.axes) ? gamepad.axes : [];
    const buttons = Array.isArray(gamepad?.buttons) ? gamepad.buttons : [];
    return source?.selectPressed !== true
      && source?.squeezePressed !== true
      && axes.every((axis) => Math.abs(finiteNumber(axis, 0)) <= config.analogDeadzone)
      && buttons.every(
        (button) => button?.pressed !== true && finiteNumber(button?.value, 0) <= 0.1
      );
  });

  const performInputCancellation = (request = {}) => {
    const suppressHeldInputs = request.suppressHeldInputs !== false;
    if (suppressHeldInputs) {
      for (const code of keys) {
        blockedKeys.add(code);
      }
    } else {
      blockedKeys.clear();
    }
    keys.clear();
    pointers.clear();
    setGestureState();
    analogInput = {
      move: { x: 0, y: 0 },
      look: { x: 0, y: 0 },
      altitude: 0,
      sprint: false,
      jump: false,
      crouch: false,
      swimVertical: 0,
    };
    queuedFrameInput = createEmptyActionFrame();
    hapticQueue = [];
    playback = null;
    gamepadTurnLatch = 0;
    xrTurnLatch = 0;
    gamepadSuppressedUntilNeutral = suppressHeldInputs && gamepads.some(
      (gamepad) => !isGamepadNeutral(gamepad)
    );
    xrSuppressedUntilNeutral = suppressHeldInputs && !isXrNeutral();
    deviceStates.clear();
    activeDevice = "none";
    inputEpoch += 1;
    lastInputCancellation = {
      schemaVersion: 1,
      epoch: inputEpoch,
      reason: String(request.reason ?? "cancelled"),
    };
    return { ...lastInputCancellation };
  };

  const buildKeyboardState = () => {
    const moveForward = (hasBoundKey("moveForward") ? 1 : 0)
      - (hasBoundKey("moveBackward") ? 1 : 0);
    const moveRight = (hasBoundKey("moveRight") ? 1 : 0)
      - (hasBoundKey("moveLeft") ? 1 : 0);
    const elevate = (hasBoundKey("elevateUp") ? 1 : 0)
      - (hasBoundKey("elevateDown") ? 1 : 0);
    return {
      move: { x: moveRight, y: moveForward },
      elevate,
      sprint: hasBoundKey("sprint"),
      precision: hasBoundKey("precision"),
      recenter: hasBoundKey("recenter"),
      jump: hasBoundKey("jump"),
      crouch: hasBoundKey("crouch"),
      swim: {
        vertical: (hasBoundKey("swimUp") ? 1 : 0)
          - (hasBoundKey("swimDown") ? 1 : 0),
      },
    };
  };

  const deriveGamepadInput = () => {
    const primary = gamepads.find((gamepad) => gamepad?.connected);
    if (!primary) {
      gamepadTurnLatch = 0;
      return createEmptyActionFrame();
    }

    if (gamepadSuppressedUntilNeutral) {
      if (!isGamepadNeutral(primary)) {
        return createEmptyActionFrame();
      }
      gamepadSuppressedUntilNeutral = false;
    }

    const moveAxes = normalizeBindingValues(bindings.gamepad.moveAxes);
    const lookAxes = normalizeBindingValues(bindings.gamepad.lookAxes);
    const altitudeButtons = normalizeBindingValues(
      bindings.gamepad.altitudeButtons
    );
    const leftX = finiteNumber(primary.axes[moveAxes[0] ?? 0], 0);
    const leftY = -finiteNumber(primary.axes[moveAxes[1] ?? 1], 0);
    const rightX = finiteNumber(primary.axes[lookAxes[0] ?? 2], 0);
    const rightY = -finiteNumber(primary.axes[lookAxes[1] ?? 3], 0);
    const leftTrigger = finiteNumber(
      primary.buttons[altitudeButtons[0] ?? 6]?.value,
      0
    );
    const rightTrigger = finiteNumber(
      primary.buttons[altitudeButtons[1] ?? 7]?.value,
      0
    );
    let snapTurn = 0;
    if (Math.abs(rightX) > 0.78 && gamepadTurnLatch === 0) {
      snapTurn = rightX > 0 ? 1 : -1;
      gamepadTurnLatch = snapTurn;
    } else if (Math.abs(rightX) < 0.45) {
      gamepadTurnLatch = 0;
    }

    updateActiveSource({
      id: primary.id,
      family: "gamepad",
      kind: "standard",
      label: primary.id,
    });

    return normalizeActionFrame({
      move: { x: leftX, y: leftY },
      look: { x: rightX, y: rightY },
      smoothTurn: 0,
      snapTurn,
      elevate: rightTrigger - leftTrigger,
      sprint: hasBoundButton(primary, bindings.gamepad.sprintButtons),
      precision: hasBoundButton(primary, bindings.gamepad.precisionButtons),
      focus: hasBoundButton(primary, bindings.gamepad.focusButtons),
      recenter: hasBoundButton(primary, bindings.gamepad.recenterButtons),
      jump: hasBoundButton(primary, bindings.gamepad.jumpButtons),
      crouch: hasBoundButton(primary, bindings.gamepad.crouchButtons),
      swim: {
        vertical:
          (hasBoundButton(primary, bindings.gamepad.swimUpButtons) ? 1 : 0)
          - (hasBoundButton(primary, bindings.gamepad.swimDownButtons) ? 1 : 0),
      },
      source: {
        id: primary.id,
        family: "gamepad",
        kind: "standard",
        label: primary.id,
      },
    });
  };

  const deriveXrInput = () => {
    if (!xrState.viewer) {
      xrTurnLatch = 0;
      return createEmptyActionFrame();
    }

    if (xrSuppressedUntilNeutral) {
      if (!isXrNeutral()) {
        return createEmptyActionFrame();
      }
      xrSuppressedUntilNeutral = false;
    }

    const controllers = xrState.sources.filter((source) => source.family === "xr-controller");
    const dominantHand = bindings.xr.dominantHand;
    const moveSource = controllers.find((source) => source.handedness === "left") ?? controllers[0] ?? null;
    const lookSource = controllers.find((source) => source.handedness === dominantHand)
      ?? controllers[1]
      ?? moveSource;

    let snapTurn = 0;
    const turnAxis = finiteNumber(lookSource?.gamepad?.axes?.[bindings.xr.snapTurnAxis], 0);
    if (Math.abs(turnAxis) > 0.78 && xrTurnLatch === 0) {
      snapTurn = turnAxis > 0 ? 1 : -1;
      xrTurnLatch = snapTurn;
    } else if (Math.abs(turnAxis) < 0.45) {
      xrTurnLatch = 0;
    }

    if (lookSource) {
      updateActiveSource({
        id: lookSource.id,
        family: lookSource.family,
        kind: lookSource.kind,
        label: lookSource.handedness,
      });
    }

    const moveAxes = normalizeBindingValues(bindings.xr.moveAxes);
    const lookAxes = normalizeBindingValues(bindings.xr.lookAxes);
    const readXrButton = (source, values) => hasBoundButton(
      source?.gamepad,
      values
    );
    return normalizeActionFrame({
      move: {
        x: finiteNumber(moveSource?.gamepad?.axes?.[moveAxes[0] ?? 2], 0),
        y: -finiteNumber(moveSource?.gamepad?.axes?.[moveAxes[1] ?? 3], 0),
      },
      look: {
        x: finiteNumber(lookSource?.gamepad?.axes?.[lookAxes[0] ?? 0], 0),
        y: -finiteNumber(lookSource?.gamepad?.axes?.[lookAxes[1] ?? 1], 0),
      },
      snapTurn,
      sprint: moveSource?.squeezePressed === true || lookSource?.squeezePressed === true,
      focus: lookSource?.selectPressed === true,
      jump: readXrButton(moveSource, bindings.xr.jumpButtons),
      crouch: readXrButton(moveSource, bindings.xr.crouchButtons),
      swim: {
        vertical:
          (readXrButton(moveSource, bindings.xr.swimUpButtons) ? 1 : 0)
          - (readXrButton(moveSource, bindings.xr.swimDownButtons) ? 1 : 0),
      },
      source: lookSource
        ? {
            id: lookSource.id,
            family: lookSource.family,
            kind: lookSource.kind,
            label: lookSource.handedness,
          }
        : null,
      viewerPose: {
        position: xrState.viewer.position,
        orientation: xrState.viewer.orientation,
        forward: xrState.viewer.forward,
        up: xrState.viewer.up,
        referenceSpaceType: xrState.frame?.referenceSpaceType ?? "local-floor",
        emulatedPosition: xrState.viewer.emulatedPosition,
        views: xrState.viewer.views,
      },
      locomotion: xrState.locomotion,
    });
  };

  const applyXrRig = (delta, inputState, speedMultiplier) => {
    const viewerForward = normalizeVec3(xrState.viewer.forward, [0, 0, -1]);
    const viewerRight = normalizeVec3(crossVec3(viewerForward, xrState.viewer.up ?? DEFAULT_UP), [1, 0, 0]);
    const flatForward = normalizeVec3([viewerForward[0], 0, viewerForward[2]], [0, 0, -1]);
    const flatRight = normalizeVec3([viewerRight[0], 0, viewerRight[2]], [1, 0, 0]);
    const speed = config.moveSpeed * comfortProfile.movementSpeed * speedMultiplier;
    const locomotion = resolveCameraLocomotionState(xrState.locomotion);

    if (Math.abs(inputState.snapTurn) > EPSILON) {
      locomotion.yaw += (Math.PI / 180) * config.snapTurnDegrees * Math.sign(inputState.snapTurn);
      queueHapticEffect({
        target: inputState.source ? { id: inputState.source.id } : null,
        amplitude: 0.45,
        durationMs: 18,
        family: "xr-controller",
      });
    }

    if (Math.abs(inputState.smoothTurn) > EPSILON || Math.abs(inputState.look.x) > EPSILON) {
      locomotion.yaw += -(inputState.smoothTurn + inputState.look.x) * config.smoothTurnSpeed * delta;
    }
    if (Math.abs(inputState.look.y) > EPSILON) {
      locomotion.pitch = clamp(
        locomotion.pitch - inputState.look.y * config.analogLookSpeed * delta,
        -Math.PI / 3,
        Math.PI / 3
      );
    }

    const moveX = inputState.move.x;
    const moveY = inputState.move.y;
    if (Math.abs(moveX) > EPSILON || Math.abs(moveY) > EPSILON) {
      const horizontal = addVec3(
        scaleVec3(flatRight, moveX * speed * delta),
        scaleVec3(flatForward, moveY * speed * delta)
      );
      locomotion.origin = addVec3(locomotion.origin, horizontal);
    }

    if (Math.abs(inputState.elevate) > EPSILON && comfortProfile.grounded === false) {
      locomotion.origin = addVec3(
        locomotion.origin,
        [0, inputState.elevate * speed * delta, 0]
      );
    }

    if (inputState.teleport?.position) {
      locomotion.origin = cloneVec3(inputState.teleport.position, locomotion.origin);
      queueHapticEffect({
        target: inputState.source ? { id: inputState.source.id } : null,
        amplitude: 0.6,
        durationMs: 28,
        family: inputState.source?.family ?? "xr-controller",
      });
    }

    if (inputState.recenter) {
      locomotion.origin = [0, 0, 0];
      locomotion.yaw = 0;
      locomotion.pitch = 0;
      locomotion.roll = 0;
    }

    xrState.locomotion = locomotion;
    const rigFrame = resolveCameraRigFrame({
      viewMode,
      camera: targetCamera,
      pose: inputState.viewerPose,
      locomotion,
      comfort: comfortProfile,
      collisionProvider: collisionProvider ?? undefined,
    });
    targetCamera = applyFloor(rigFrame.camera, terrainFloorProvider, config.terrainFloorOffset, viewMode);
  };

  const applyPlaybackFrame = () => {
    if (!playback || playback.index >= playback.frames.length) {
      playback = null;
      return false;
    }
    const frame = playback.frames[playback.index];
    playback.index += 1;
    if (frame?.targetCamera) {
      targetCamera = normalizeCamera(frame.targetCamera);
    }
    if (frame?.camera) {
      currentCamera = normalizeCamera(frame.camera);
    } else {
      currentCamera = cloneCamera(targetCamera);
    }
    viewMode = normalizeViewMode(frame?.viewMode ?? viewMode);
    return true;
  };

  const controller = {
    setViewMode(nextViewMode) {
      viewMode = normalizeViewMode(nextViewMode);
      activeModeTransition = null;
      queuedModeTransitionEvent = null;
      setGestureState();
      setRigForMode();
      return controller;
    },

    beginViewModeTransition(request = {}) {
      if (activeModeTransition) {
        throw new Error(
          `View-mode transition "${activeModeTransition.id}" is already active.`
        );
      }
      const to = requireViewMode(request.to);
      const id = String(
        request.id ?? `mode-transition-${transitionSequence + 1}`
      ).trim();
      if (!id) {
        throw new TypeError("A view-mode transition id cannot be empty.");
      }
      transitionSequence += 1;
      const cancellation = request.cancelObsoleteInputs === false
        ? null
        : performInputCancellation({
            reason: request.reason ?? "mode-transition",
          });
      activeModeTransition = {
        schemaVersion: 1,
        id,
        from: viewMode,
        to,
        phase: "began",
        preserveWorldPosition: request.preserveWorldPosition !== false,
        worldPosition: request.preserveWorldPosition === false
          ? null
          : cloneVec3(
              request.worldPosition,
              targetCamera.transform.target
            ),
        cancelledInputEpoch: cancellation?.epoch ?? null,
        reason: request.reason == null ? null : String(request.reason),
      };
      queuedModeTransitionEvent = cloneModeTransition(activeModeTransition);
      return cloneModeTransition(activeModeTransition);
    },

    commitViewModeTransition(id = activeModeTransition?.id) {
      if (!activeModeTransition) {
        throw new Error("No view-mode transition is active.");
      }
      if (String(id ?? "") !== activeModeTransition.id) {
        throw new Error(
          `View-mode transition "${String(id ?? "")}" does not match active transition "${activeModeTransition.id}".`
        );
      }
      const committed = {
        ...activeModeTransition,
        phase: "committed",
      };
      viewMode = activeModeTransition.to;
      setGestureState();
      setRigForMode();
      if (
        activeModeTransition.preserveWorldPosition
        && activeModeTransition.worldPosition
      ) {
        targetCamera = translateCameraTarget(
          targetCamera,
          activeModeTransition.worldPosition
        );
        currentCamera = translateCameraTarget(
          currentCamera,
          activeModeTransition.worldPosition
        );
      }
      activeModeTransition = null;
      queuedModeTransitionEvent = cloneModeTransition(committed);
      return cloneModeTransition(committed);
    },

    cancelViewModeTransition(
      id = activeModeTransition?.id,
      reason = "cancelled"
    ) {
      if (!activeModeTransition) {
        throw new Error("No view-mode transition is active.");
      }
      if (String(id ?? "") !== activeModeTransition.id) {
        throw new Error(
          `View-mode transition "${String(id ?? "")}" does not match active transition "${activeModeTransition.id}".`
        );
      }
      const cancelled = {
        ...activeModeTransition,
        phase: "cancelled",
        reason: String(reason ?? "cancelled"),
      };
      activeModeTransition = null;
      queuedModeTransitionEvent = cloneModeTransition(cancelled);
      return cloneModeTransition(cancelled);
    },

    getViewModeTransition() {
      return cloneModeTransition(activeModeTransition);
    },

    cancelInputSources(request = {}) {
      performInputCancellation(request);
      return controller;
    },

    setCamera(camera) {
      currentCamera = normalizeCamera(camera);
      targetCamera = cloneCamera(currentCamera);
      setRigForMode();
      return controller;
    },

    setTerrainFloorProvider(provider) {
      terrainFloorProvider = typeof provider === "function" ? provider : null;
      targetCamera = applyFloor(targetCamera, terrainFloorProvider, config.terrainFloorOffset, viewMode);
      currentCamera = applyFloor(currentCamera, terrainFloorProvider, config.terrainFloorOffset, viewMode);
      return controller;
    },

    setCollisionProvider(provider) {
      collisionProvider = typeof provider === "function" ? provider : null;
      return controller;
    },

    setBindings(nextBindings) {
      bindings = normalizeBindings(nextBindings);
      return controller;
    },

    getBindings() {
      return bindings;
    },

    setComfortProfile(profile = {}) {
      comfortProfile = resolveCameraComfortProfile(profile);
      return controller;
    },

    getComfortProfile() {
      return comfortProfile;
    },

    setContext(context = {}) {
      diagnosticsContext = context && typeof context === "object" ? { ...context } : {};
      return controller;
    },

    handlePointerDown(event) {
      const pointer = pointerFromEvent(event);
      if (!Number.isFinite(pointer.pointerId)) return controller;
      pointers.set(pointer.pointerId, pointer);
      updateActiveSource({
        id: `pointer:${pointer.pointerId}`,
        family: pointer.pointerType === "pen" ? "pen" : pointer.pointerType === "mouse" ? "mouse" : "touch",
        kind: pointer.pointerType,
        label: pointer.pointerType,
      });
      setGestureState();
      return controller;
    },

    handlePointerMove(event) {
      const pointer = pointerFromEvent(event);
      const previous = pointers.get(pointer.pointerId);
      if (!previous) return controller;
      pointers.set(pointer.pointerId, pointer);

      const activePointers = [...pointers.values()];
      const nextGesture = gestureForPointers(viewMode, activePointers);
      if (nextGesture !== activeGesture) {
        setGestureState();
        return controller;
      }

      if (activePointers.length === 1) {
        const deltaX = pointer.clientX - previous.clientX;
        const deltaY = pointer.clientY - previous.clientY;
        if (activeGesture === "rotate") {
          applyControl({
            type: "orbit",
            deltaAzimuth: -deltaX * config.rotateSensitivity,
            deltaPolar: deltaY * config.rotateSensitivity,
          });
        } else if (activeGesture === "look") {
          applyControl({
            type: "look",
            deltaYaw: -deltaX * config.lookSensitivity,
            deltaPitch: -deltaY * config.lookSensitivity,
          });
        }
        lastGestureCenter = { x: pointer.clientX, y: pointer.clientY };
        return controller;
      }

      const nextCenter = centroid(activePointers);
      if (lastGestureCenter) {
        applyScreenTruck(
          nextCenter.x - lastGestureCenter.x,
          nextCenter.y - lastGestureCenter.y
        );
      }

      if (activeGesture === "dolly-truck") {
        const nextDistance = averageDistanceFromCentroid(activePointers, nextCenter);
        applyControl({
          type: "dolly",
          distance: (nextDistance - lastGestureDistance) * config.dollySensitivity,
        });
        lastGestureDistance = nextDistance;
      }

      lastGestureCenter = nextCenter;
      return controller;
    },

    handlePointerUp(event) {
      const pointer = pointerFromEvent(event);
      pointers.delete(pointer.pointerId);
      setGestureState();
      return controller;
    },

    handlePointerCancel(event) {
      const pointer = pointerFromEvent(event);
      pointers.delete(pointer.pointerId);
      setGestureState();
      return controller;
    },

    handleWheel(event) {
      const deltaY = finiteNumber(event.deltaY, 0);
      if (viewMode === "editor" || viewMode === "third-person" || viewMode === "inspect"
        || viewMode === "top-down" || viewMode === "isometric") {
        applyControl({
          type: "dolly",
          distance: -deltaY * config.wheelDollySensitivity,
        });
      }
      return controller;
    },

    handleKeyDown(event) {
      const code = String(event.code ?? "");
      if (blockedKeys.has(code)) {
        return controller;
      }
      if (code) {
        keys.add(code);
        updateActiveSource({
          id: "keyboard",
          family: "keyboard",
          kind: "keys",
          label: "Keyboard",
        });
      }
      return controller;
    },

    handleKeyUp(event) {
      const code = String(event.code ?? "");
      if (code) {
        keys.delete(code);
        blockedKeys.delete(code);
      }
      return controller;
    },

    setAnalogInput(input = {}) {
      analogInput = {
        move: normalizeAnalogVector(input.move),
        look: normalizeAnalogVector(input.look),
        altitude: clamp(finiteNumber(input.altitude, 0), -1, 1),
        sprint: input.sprint === true,
        jump: input.jump === true,
        crouch: input.crouch === true,
        swimVertical: clamp(finiteNumber(input.swimVertical, 0), -1, 1),
      };
      return controller;
    },

    applyInputFrame(input = {}) {
      queuedFrameInput = mergeActionFrames(queuedFrameInput, input);
      if (queuedFrameInput.source) {
        updateActiveSource(queuedFrameInput.source);
      }
      if (queuedFrameInput.viewerPose) {
        xrState.viewer = queuedFrameInput.viewerPose;
      }
      if (queuedFrameInput.locomotion) {
        xrState.locomotion = resolveCameraLocomotionState(queuedFrameInput.locomotion);
      }
      for (const haptic of queuedFrameInput.haptics) {
        queueHapticEffect(haptic);
      }
      return controller;
    },

    ingestGamepads(inputGamepads = []) {
      gamepads = Array.from(inputGamepads)
        .map((gamepad, index) => normalizeGamepadSnapshot(gamepad, index))
        .filter(Boolean);
      return controller;
    },

    ingestXrFrame(snapshot = {}) {
      xrState.frame = snapshot;
      xrState.mode = snapshot.sessionMode ?? xrState.mode;
      xrState.viewer = snapshot.viewer ?? xrState.viewer;
      xrState.sources = Array.isArray(snapshot.inputSources)
        ? snapshot.inputSources.map((source, index) => normalizeXrSourceSnapshot(source, index))
        : [];
      return controller;
    },

    queueHapticEffect,

    consumeHapticEffects() {
      const effects = hapticQueue.map((effect) => ({ ...effect }));
      hapticQueue = [];
      return effects;
    },

    beginRecording(label = null) {
      recording = {
        active: true,
        label: label == null ? null : String(label),
        frames: [],
      };
      return controller;
    },

    stopRecording() {
      recording = {
        ...recording,
        active: false,
      };
      lastRecording = {
        label: recording.label,
        frames: recording.frames.map((frame) => ({
          ...frame,
          camera: cloneCamera(frame.camera),
          targetCamera: cloneCamera(frame.targetCamera),
        })),
      };
      return lastRecording;
    },

    clearRecording() {
      recording = {
        active: false,
        label: null,
        frames: [],
      };
      lastRecording = null;
      playback = null;
      return controller;
    },

    playRecording(nextRecording) {
      const frames = Array.isArray(nextRecording?.frames) ? nextRecording.frames : [];
      playback = {
        index: 0,
        frames,
      };
      return controller;
    },

    getRecording() {
      return lastRecording ?? {
        label: recording.label,
        frames: recording.frames,
      };
    },

    getDiagnostics() {
      return {
        activeDevice,
        activeGesture,
        activeSourceIds: [...deviceStates.keys()],
        sources: [...deviceStates.values()].map((value) => ({ ...value })),
        bindings,
        comfortProfile,
        recordingActive: recording.active,
        xrMode: xrState.mode,
        hasViewerPose: Boolean(xrState.viewer),
        inputEpoch,
        lastInputCancellation: lastInputCancellation
          ? { ...lastInputCancellation }
          : null,
        modeTransition: cloneModeTransition(activeModeTransition),
        context: {
          ...diagnosticsContext,
        },
      };
    },

    update(deltaSeconds = 0) {
      if (applyPlaybackFrame()) {
        return controller.getFrame();
      }

      const delta = clamp(finiteNumber(deltaSeconds, 0), 0, 0.1);
      const analogMove = applyDeadzone(normalizeAnalogVector(analogInput.move), config.analogDeadzone);
      const analogLook = applyDeadzone(normalizeAnalogVector(analogInput.look), config.analogDeadzone);
      const keyboard = buildKeyboardState();
      const gamepadInput = deriveGamepadInput();
      const xrInput = deriveXrInput();
      const queued = queuedFrameInput;
      queuedFrameInput = createEmptyActionFrame();
      const modeTransitionEvent = queuedModeTransitionEvent;
      queuedModeTransitionEvent = null;

      const moveState = normalizeAnalogVector({
        x: clamp(
          analogMove.x + keyboard.move.x + gamepadInput.move.x + xrInput.move.x + queued.move.x,
          -1,
          1
        ),
        y: clamp(
          analogMove.y + keyboard.move.y + gamepadInput.move.y + xrInput.move.y + queued.move.y,
          -1,
          1
        ),
      });
      const lookState = normalizeAnalogVector({
        x: clamp(
          analogLook.x + gamepadInput.look.x + xrInput.look.x + queued.look.x,
          -1,
          1
        ),
        y: clamp(
          analogLook.y + gamepadInput.look.y + xrInput.look.y + queued.look.y,
          -1,
          1
        ),
      });
      const orbitState = normalizeAnalogVector(queued.orbit);
      const truckState = normalizeAnalogVector(queued.truck);
      const elevateState = clamp(
        analogInput.altitude + keyboard.elevate + gamepadInput.elevate + xrInput.elevate + queued.elevate,
        -1,
        1
      );
      const sprint = analogInput.sprint
        || keyboard.sprint
        || gamepadInput.sprint
        || xrInput.sprint
        || queued.sprint;
      const precision = keyboard.precision
        || gamepadInput.precision
        || xrInput.precision
        || queued.precision;
      const speedMultiplier = (sprint ? config.sprintMultiplier : 1)
        * (precision ? config.precisionMultiplier : 1);
      const jump = analogInput.jump
        || keyboard.jump
        || gamepadInput.jump
        || xrInput.jump
        || queued.jump;
      const crouch = analogInput.crouch
        || keyboard.crouch
        || gamepadInput.crouch
        || xrInput.crouch
        || queued.crouch;
      const swimVertical = clamp(
        analogInput.swimVertical
          + keyboard.swim.vertical
          + gamepadInput.swim.vertical
          + xrInput.swim.vertical
          + queued.swim.vertical,
        -1,
        1
      );
      lastEmbodiedActions = {
        schemaVersion: cameraControlEmbodiedActionsVersion,
        jump: createButtonAction(jump, previousEmbodiedState.jump),
        crouch: createButtonAction(crouch, previousEmbodiedState.crouch),
        swim: {
          vertical: swimVertical,
        },
        modeTransition: cloneModeTransition(modeTransitionEvent),
      };
      previousEmbodiedState = {
        jump,
        crouch,
      };

      if (queued.teleport || gamepadInput.focus || xrInput.focus || queued.focus) {
        queueHapticEffect({
          target: queued.source ? { id: queued.source.id } : null,
          amplitude: 0.35,
          durationMs: 16,
          family: queued.source?.family ?? null,
        });
      }

      const usingXrRig = (viewMode === "xr-vr" || viewMode === "xr-ar") && xrState.viewer;
      if (usingXrRig) {
        applyXrRig(delta, mergeActionFrames(mergeActionFrames(gamepadInput, xrInput), queued), speedMultiplier);
      } else {
        const speed = (viewMode === "editor" || viewMode === "spectator" || viewMode === "top-down"
          ? config.editorMoveSpeed
          : config.moveSpeed) * speedMultiplier;

        if (Math.abs(moveState.x) > EPSILON || Math.abs(moveState.y) > EPSILON) {
          const { flatForward, flatRight } = cameraBasis(targetCamera);
          const horizontal = addVec3(
            scaleVec3(flatRight, moveState.x * speed * delta),
            scaleVec3(flatForward, moveState.y * speed * delta)
          );
          applyControl({ type: "truck", delta: horizontal });
        }

        if (Math.abs(elevateState) > EPSILON && (viewMode === "editor" || viewMode === "spectator")) {
          applyControl({ type: "truck", delta: [0, elevateState * speed * delta, 0] });
        }

        if (Math.abs(queued.snapTurn) > EPSILON || Math.abs(gamepadInput.snapTurn) > EPSILON) {
          const snapDirection = Math.sign(queued.snapTurn || gamepadInput.snapTurn);
          applyControl({
            type: viewMode === "editor" || viewMode === "third-person" || viewMode === "inspect"
              ? "orbit"
              : "look",
            deltaAzimuth: 0,
            deltaYaw: 0,
            deltaPolar: 0,
            deltaPitch: 0,
          });
          const yawDelta = -(Math.PI / 180) * config.snapTurnDegrees * snapDirection;
          if (viewMode === "editor" || viewMode === "third-person" || viewMode === "inspect"
            || viewMode === "isometric") {
            applyControl({ type: "orbit", deltaAzimuth: yawDelta, deltaPolar: 0 });
          } else {
            applyControl({ type: "look", deltaYaw: yawDelta, deltaPitch: 0 });
          }
          queueHapticEffect({
            target: queued.source ? { id: queued.source.id } : null,
            amplitude: 0.45,
            durationMs: 18,
            family: queued.source?.family ?? null,
          });
        }

        if (Math.abs(queued.smoothTurn) > EPSILON) {
          const yawDelta = -queued.smoothTurn * config.smoothTurnSpeed * delta;
          if (viewMode === "editor" || viewMode === "third-person" || viewMode === "inspect"
            || viewMode === "isometric") {
            applyControl({ type: "orbit", deltaAzimuth: yawDelta, deltaPolar: 0 });
          } else {
            applyControl({ type: "look", deltaYaw: yawDelta, deltaPitch: 0 });
          }
        }

        if (Math.abs(lookState.x) > EPSILON || Math.abs(lookState.y) > EPSILON) {
          const yawDelta = -lookState.x * config.analogLookSpeed * delta;
          const pitchDelta = -lookState.y * config.analogLookSpeed * delta;
          if (viewMode === "editor" || viewMode === "third-person" || viewMode === "inspect"
            || viewMode === "isometric") {
            applyControl({
              type: "orbit",
              deltaAzimuth: yawDelta,
              deltaPolar: -pitchDelta,
            });
          } else {
            applyControl({
              type: "look",
              deltaYaw: yawDelta,
              deltaPitch: pitchDelta,
            });
          }
        }

        if (Math.abs(orbitState.x) > EPSILON || Math.abs(orbitState.y) > EPSILON) {
          applyControl({
            type: "orbit",
            deltaAzimuth: -orbitState.x * config.rotateSensitivity,
            deltaPolar: orbitState.y * config.rotateSensitivity,
          });
        }

        if (Math.abs(truckState.x) > EPSILON || Math.abs(truckState.y) > EPSILON) {
          applyScreenTruck(
            truckState.x * 140 * delta,
            truckState.y * 140 * delta
          );
        }

        if (Math.abs(queued.dolly) > EPSILON) {
          applyControl({
            type: "dolly",
            distance: queued.dolly,
          });
        }

        if (Math.abs(queued.roll) > EPSILON) {
          applyControl({
            type: "roll",
            deltaRoll: queued.roll * config.rollSensitivity * delta,
          });
        }

        if (queued.teleport?.position) {
          const offset = subVec3(
            targetCamera.transform.target,
            targetCamera.transform.position
          );
          const nextPosition = cloneVec3(queued.teleport.position, targetCamera.transform.position);
          const nextTarget = queued.teleport.target
            ? cloneVec3(queued.teleport.target, targetCamera.transform.target)
            : addVec3(nextPosition, offset);
          applyControl({
            type: "set-look-at",
            position: nextPosition,
            target: nextTarget,
            up: targetCamera.transform.up,
          });
        }

        if (queued.recenter || keyboard.recenter || gamepadInput.recenter) {
          setRigForMode();
        }
      }

      const smoothTime = pointers.size > 0 || Math.abs(moveState.x) > EPSILON || Math.abs(moveState.y) > EPSILON
        ? config.draggingSmoothTime
        : config.smoothTime;
      currentCamera = smoothCamera(currentCamera, targetCamera, settleAlpha(delta, smoothTime));
      currentCamera = applyFloor(currentCamera, terrainFloorProvider, config.terrainFloorOffset, viewMode);

      if (recording.active) {
        recording.frames.push({
          deltaSeconds: delta,
          viewMode,
          camera: cloneCamera(currentCamera),
          targetCamera: cloneCamera(targetCamera),
          activeDevice,
        });
      }

      return controller.getFrame();
    },

    getFrame() {
      const distance = distanceVec3(currentCamera.transform.position, currentCamera.transform.target);
      return {
        viewMode,
        rigMode: viewMode,
        camera: cloneCamera(currentCamera),
        targetCamera: cloneCamera(targetCamera),
        activeGesture,
        activePointerCount: pointers.size,
        analogInput: {
          move: { ...analogInput.move },
          look: { ...analogInput.look },
          altitude: analogInput.altitude,
          sprint: analogInput.sprint,
          jump: analogInput.jump,
          crouch: analogInput.crouch,
          swimVertical: analogInput.swimVertical,
        },
        actions: {
          schemaVersion: lastEmbodiedActions.schemaVersion,
          jump: { ...lastEmbodiedActions.jump },
          crouch: { ...lastEmbodiedActions.crouch },
          swim: { ...lastEmbodiedActions.swim },
          modeTransition: cloneModeTransition(
            lastEmbodiedActions.modeTransition
          ),
        },
        distance,
        activeDevice,
        activeSources: [...deviceStates.values()].map((value) => ({ ...value })),
        comfortProfile,
        diagnostics: controller.getDiagnostics(),
        hapticEffects: hapticQueue.map((effect) => ({ ...effect })),
        recordingActive: recording.active,
        resting: pointers.size === 0
          && keys.size === 0
          && !lastEmbodiedActions.jump.active
          && !lastEmbodiedActions.crouch.active
          && Math.abs(lastEmbodiedActions.swim.vertical) <= EPSILON
          && shallowEqualVec3(currentCamera.transform.position, targetCamera.transform.position)
          && shallowEqualVec3(currentCamera.transform.target, targetCamera.transform.target),
      };
    },
  };

  return controller;
}
