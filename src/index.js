import { applyCameraControl, cameraViewModes } from "@plasius/gpu-camera";

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

export const gpuCameraControlsTouchActions = Object.freeze([
  "none",
  "rotate",
  "look",
  "dolly-truck",
  "truck",
]);

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
    return viewMode === "editor" || viewMode === "third-person" ? "rotate" : "look";
  }
  return "none";
}

function settleAlpha(deltaSeconds, smoothTime) {
  if (smoothTime <= EPSILON) return 1;
  return clamp(1 - Math.exp(-Math.max(0, deltaSeconds) / smoothTime), 0, 1);
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

function smoothCamera(current, target, alpha) {
  const next = cloneCamera(target);
  next.transform.position = lerpVec3(current.transform.position, target.transform.position, alpha);
  next.transform.target = lerpVec3(current.transform.target, target.transform.target, alpha);
  next.transform.up = normalizeVec3(lerpVec3(current.transform.up, target.transform.up, alpha), DEFAULT_UP);
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
  let currentCamera = normalizeCamera(options.camera);
  let targetCamera = cloneCamera(currentCamera);
  let activeGesture = "none";
  let lastGestureCenter = null;
  let lastGestureDistance = 0;

  const pointers = new Map();
  const keys = new Set();
  let analogInput = {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    altitude: 0,
    sprint: false,
  };

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

  const applyControl = (control) => {
    targetCamera = applyCameraControl(targetCamera, control, controlOptions());
    targetCamera = applyFloor(targetCamera, terrainFloorProvider, config.terrainFloorOffset, viewMode);
  };

  const applyScreenTruck = (deltaX, deltaY) => {
    const { right, up } = cameraBasis(targetCamera);
    const distance = distanceVec3(targetCamera.transform.position, targetCamera.transform.target);
    const scale = Math.max(0.2, distance) * config.truckSensitivity;
    const delta = addVec3(scaleVec3(right, -deltaX * scale), scaleVec3(up, deltaY * scale));
    applyControl({ type: "truck", delta });
  };

  const controller = {
    setViewMode(nextViewMode) {
      viewMode = normalizeViewMode(nextViewMode);
      setGestureState();
      return controller;
    },

    setCamera(camera) {
      currentCamera = normalizeCamera(camera);
      targetCamera = cloneCamera(currentCamera);
      return controller;
    },

    setTerrainFloorProvider(provider) {
      terrainFloorProvider = typeof provider === "function" ? provider : null;
      targetCamera = applyFloor(targetCamera, terrainFloorProvider, config.terrainFloorOffset, viewMode);
      currentCamera = applyFloor(currentCamera, terrainFloorProvider, config.terrainFloorOffset, viewMode);
      return controller;
    },

    handlePointerDown(event) {
      const pointer = pointerFromEvent(event);
      if (!Number.isFinite(pointer.pointerId)) return controller;
      pointers.set(pointer.pointerId, pointer);
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
      if (viewMode === "editor" || viewMode === "third-person") {
        applyControl({
          type: "dolly",
          distance: -deltaY * config.wheelDollySensitivity,
        });
      }
      return controller;
    },

    handleKeyDown(event) {
      const code = String(event.code ?? "");
      if (code) keys.add(code);
      return controller;
    },

    handleKeyUp(event) {
      const code = String(event.code ?? "");
      if (code) keys.delete(code);
      return controller;
    },

    setAnalogInput(input = {}) {
      analogInput = {
        move: normalizeAnalogVector(input.move),
        look: normalizeAnalogVector(input.look),
        altitude: clamp(finiteNumber(input.altitude, 0), -1, 1),
        sprint: input.sprint === true,
      };
      return controller;
    },

    update(deltaSeconds = 0) {
      const delta = clamp(finiteNumber(deltaSeconds, 0), 0, 0.1);
      const move = applyDeadzone(normalizeAnalogVector(analogInput.move), config.analogDeadzone);
      const look = applyDeadzone(normalizeAnalogVector(analogInput.look), config.analogDeadzone);
      const keyForward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
      const keyRight = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      const keyAltitude = (keys.has("Space") ? 1 : 0)
        - (keys.has("ControlLeft") || keys.has("ControlRight") ? 1 : 0);
      const sprint = analogInput.sprint || keys.has("ShiftLeft") || keys.has("ShiftRight");
      const speed = (viewMode === "editor" || viewMode === "spectator"
        ? config.editorMoveSpeed
        : config.moveSpeed) * (sprint ? config.sprintMultiplier : 1);

      const moveX = clamp(move.x + keyRight, -1, 1);
      const moveY = clamp(move.y + keyForward, -1, 1);
      const moveLength = Math.hypot(moveX, moveY);
      if (moveLength > EPSILON) {
        const normalizedX = moveX / Math.max(1, moveLength);
        const normalizedY = moveY / Math.max(1, moveLength);
        const { flatForward, flatRight } = cameraBasis(targetCamera);
        const horizontal = addVec3(
          scaleVec3(flatRight, normalizedX * speed * delta),
          scaleVec3(flatForward, normalizedY * speed * delta)
        );
        applyControl({ type: "truck", delta: horizontal });
      }

      const altitude = clamp(analogInput.altitude + keyAltitude, -1, 1);
      if (Math.abs(altitude) > EPSILON && (viewMode === "editor" || viewMode === "spectator")) {
        applyControl({ type: "truck", delta: [0, altitude * speed * delta, 0] });
      }

      if (Math.abs(look.x) > EPSILON || Math.abs(look.y) > EPSILON) {
        const yawDelta = -look.x * config.analogLookSpeed * delta;
        const pitchDelta = -look.y * config.analogLookSpeed * delta;
        if (viewMode === "editor" || viewMode === "third-person") {
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

      const smoothTime = pointers.size > 0 || Math.abs(moveX) > EPSILON || Math.abs(moveY) > EPSILON
        ? config.draggingSmoothTime
        : config.smoothTime;
      currentCamera = smoothCamera(currentCamera, targetCamera, settleAlpha(delta, smoothTime));
      currentCamera = applyFloor(currentCamera, terrainFloorProvider, config.terrainFloorOffset, viewMode);
      return controller.getFrame();
    },

    getFrame() {
      const distance = distanceVec3(currentCamera.transform.position, currentCamera.transform.target);
      return {
        viewMode,
        camera: cloneCamera(currentCamera),
        targetCamera: cloneCamera(targetCamera),
        activeGesture,
        activePointerCount: pointers.size,
        analogInput: {
          move: { ...analogInput.move },
          look: { ...analogInput.look },
          altitude: analogInput.altitude,
          sprint: analogInput.sprint,
        },
        distance,
        resting: pointers.size === 0
          && keys.size === 0
          && Math.abs(distanceVec3(currentCamera.transform.position, targetCamera.transform.position)) < 1e-3
          && Math.abs(distanceVec3(currentCamera.transform.target, targetCamera.transform.target)) < 1e-3,
      };
    },
  };

  return controller;
}
