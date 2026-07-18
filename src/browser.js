function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeVector(vector = {}) {
  const x = finiteNumber(vector.x, 0);
  const y = finiteNumber(vector.y, 0);
  const length = Math.hypot(x, y);
  if (length <= 1) {
    return { x, y };
  }
  return { x: x / length, y: y / length };
}

export function normalizePointerEvent(event) {
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

export function normalizeWheelEvent(event) {
  return {
    deltaY: finiteNumber(event.deltaY, 0),
    timeStamp: finiteNumber(event.timeStamp, 0),
  };
}

export function normalizeKeyEvent(event) {
  return {
    code: String(event.code ?? ""),
    repeat: event.repeat === true,
    timeStamp: finiteNumber(event.timeStamp, 0),
  };
}

function readRelativePadVector(event, options) {
  const rect = event.currentTarget?.getBoundingClientRect?.();
  if (!rect) {
    return { x: 0, y: 0 };
  }
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radius = Math.max(
    1,
    finiteNumber(options.radius, Math.min(rect.width, rect.height) / 2)
  );
  const x = clamp((finiteNumber(event.clientX, centerX) - centerX) / radius, -1, 1);
  const rawY = clamp((finiteNumber(event.clientY, centerY) - centerY) / radius, -1, 1);
  return normalizeVector({
    x,
    y: options.invertY === false ? rawY : -rawY,
  });
}

export function createAnalogPadController(options = {}) {
  let activePointerId = null;
  let state = { x: 0, y: 0 };

  const update = (nextState) => {
    state = normalizeVector(nextState);
    if (typeof options.onChange === "function") {
      options.onChange(state);
    }
    return state;
  };

  return {
    begin(event) {
      activePointerId = event.pointerId;
      if (typeof event.currentTarget?.setPointerCapture === "function") {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      return update(readRelativePadVector(event, options));
    },
    move(event) {
      if (activePointerId !== event.pointerId) {
        return state;
      }
      return update(readRelativePadVector(event, options));
    },
    end(event) {
      if (activePointerId !== event.pointerId) {
        return state;
      }
      activePointerId = null;
      if (typeof event.currentTarget?.hasPointerCapture === "function"
        && event.currentTarget.hasPointerCapture(event.pointerId)
        && typeof event.currentTarget?.releasePointerCapture === "function") {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return update({ x: 0, y: 0 });
    },
    cancel(event) {
      return this.end(event);
    },
    setState(nextState) {
      return update(nextState);
    },
    getState() {
      return { ...state };
    },
    isActive() {
      return activePointerId != null;
    },
  };
}

export function createBrowserCameraControlsBindings(options = {}) {
  if (!options.controller) {
    throw new Error("createBrowserCameraControlsBindings requires a controller.");
  }

  const controller = options.controller;
  const pointerTarget = options.pointerTarget ?? options.element ?? null;
  const wheelTarget = options.wheelTarget ?? pointerTarget;
  const keyTarget = options.keyTarget ?? globalThis.window ?? null;
  const gamepadProvider = typeof options.gamepadProvider === "function"
    ? options.gamepadProvider
    : () => globalThis.navigator?.getGamepads?.() ?? [];
  let attached = false;
  let analogInput = {
    move: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
    altitude: 0,
    sprint: false,
    jump: false,
    crouch: false,
    swimVertical: 0,
  };
  let lastGamepadIds = [];

  const applyAnalogInput = () => {
    controller.setAnalogInput(analogInput);
  };

  const shouldPreventDefault = options.preventDefault !== false;
  const shouldCapturePointer = options.capturePointer !== false;

  const preventDefault = (event) => {
    if (shouldPreventDefault && typeof event?.preventDefault === "function") {
      event.preventDefault();
    }
  };

  const setPointerCapture = (target, pointerId) => {
    if (!shouldCapturePointer || pointerId == null) {
      return;
    }
    if (typeof target?.setPointerCapture === "function") {
      target.setPointerCapture(pointerId);
    }
  };

  const releasePointerCapture = (target, pointerId) => {
    if (!shouldCapturePointer || pointerId == null) {
      return;
    }
    if (typeof target?.hasPointerCapture === "function"
      && target.hasPointerCapture(pointerId)
      && typeof target?.releasePointerCapture === "function") {
      target.releasePointerCapture(pointerId);
    }
  };

  const onKeyDown = (event) => {
    if (event.code === "Space") {
      event.preventDefault();
    }
    controller.handleKeyDown(normalizeKeyEvent(event));
  };

  const onKeyUp = (event) => {
    controller.handleKeyUp(normalizeKeyEvent(event));
  };

  const onPointerDown = (event) => {
    preventDefault(event);
    setPointerCapture(event.currentTarget, event.pointerId);
    controller.handlePointerDown(normalizePointerEvent(event));
  };

  const onPointerMove = (event) => {
    preventDefault(event);
    controller.handlePointerMove(normalizePointerEvent(event));
  };

  const onPointerUp = (event) => {
    preventDefault(event);
    releasePointerCapture(event.currentTarget, event.pointerId);
    controller.handlePointerUp(normalizePointerEvent(event));
  };

  const onPointerCancel = (event) => {
    preventDefault(event);
    releasePointerCapture(event.currentTarget, event.pointerId);
    controller.handlePointerCancel(normalizePointerEvent(event));
  };

  const onWheel = (event) => {
    event.preventDefault();
    controller.handleWheel(normalizeWheelEvent(event));
  };

  const resetAnalogInput = () => {
    analogInput = {
      move: { x: 0, y: 0 },
      look: { x: 0, y: 0 },
      altitude: 0,
      sprint: false,
      jump: false,
      crouch: false,
      swimVertical: 0,
    };
    applyAnalogInput();
  };

  return {
    attach() {
      if (attached) {
        return this;
      }
      if (keyTarget?.addEventListener) {
        keyTarget.addEventListener("keydown", onKeyDown);
        keyTarget.addEventListener("keyup", onKeyUp);
      }
      if (pointerTarget?.addEventListener) {
        pointerTarget.addEventListener("pointerdown", onPointerDown);
        pointerTarget.addEventListener("pointermove", onPointerMove);
        pointerTarget.addEventListener("pointerup", onPointerUp);
        pointerTarget.addEventListener("pointercancel", onPointerCancel);
      }
      if (wheelTarget?.addEventListener) {
        wheelTarget.addEventListener("wheel", onWheel, { passive: false });
      }
      attached = true;
      return this;
    },
    detach() {
      if (!attached) {
        return this;
      }
      if (keyTarget?.removeEventListener) {
        keyTarget.removeEventListener("keydown", onKeyDown);
        keyTarget.removeEventListener("keyup", onKeyUp);
      }
      if (pointerTarget?.removeEventListener) {
        pointerTarget.removeEventListener("pointerdown", onPointerDown);
        pointerTarget.removeEventListener("pointermove", onPointerMove);
        pointerTarget.removeEventListener("pointerup", onPointerUp);
        pointerTarget.removeEventListener("pointercancel", onPointerCancel);
      }
      if (wheelTarget?.removeEventListener) {
        wheelTarget.removeEventListener("wheel", onWheel);
      }
      resetAnalogInput();
      controller.cancelInputSources({
        reason: "browser-detach",
        suppressHeldInputs: false,
      });
      lastGamepadIds = [];
      attached = false;
      return this;
    },
    update() {
      const gamepads = Array.from(gamepadProvider() ?? []).filter(Boolean);
      controller.ingestGamepads(gamepads);
      lastGamepadIds = gamepads.map((gamepad) => String(gamepad.id ?? ""));
      return this;
    },
    setAnalogState(kind, state) {
      if (kind !== "move" && kind !== "look") {
        return this;
      }
      analogInput = {
        ...analogInput,
        [kind]: normalizeVector(state),
      };
      applyAnalogInput();
      return this;
    },
    setAltitude(value) {
      analogInput = {
        ...analogInput,
        altitude: clamp(finiteNumber(value, 0), -1, 1),
      };
      applyAnalogInput();
      return this;
    },
    setSprint(value) {
      analogInput = {
        ...analogInput,
        sprint: value === true,
      };
      applyAnalogInput();
      return this;
    },
    setJump(value) {
      analogInput = {
        ...analogInput,
        jump: value === true,
      };
      applyAnalogInput();
      return this;
    },
    setCrouch(value) {
      analogInput = {
        ...analogInput,
        crouch: value === true,
      };
      applyAnalogInput();
      return this;
    },
    setSwimVertical(value) {
      analogInput = {
        ...analogInput,
        swimVertical: clamp(finiteNumber(value, 0), -1, 1),
      };
      applyAnalogInput();
      return this;
    },
    cancelObsoleteInputs(reason = "browser-cancel") {
      resetAnalogInput();
      controller.cancelInputSources({ reason });
      lastGamepadIds = [];
      return this;
    },
    getAnalogInput() {
      return {
        move: { ...analogInput.move },
        look: { ...analogInput.look },
        altitude: analogInput.altitude,
        sprint: analogInput.sprint,
        jump: analogInput.jump,
        crouch: analogInput.crouch,
        swimVertical: analogInput.swimVertical,
      };
    },
    getDiagnostics() {
      return {
        attached,
        gamepadIds: [...lastGamepadIds],
        analogInput: this.getAnalogInput(),
      };
    },
  };
}
