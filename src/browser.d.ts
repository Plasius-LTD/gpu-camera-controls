import type {
  GpuCameraControls,
  GpuCameraControlsAnalogInput,
  GpuCameraControlsKeyEvent,
  GpuCameraControlsPointerEvent,
  GpuCameraControlsWheelEvent,
  GpuCameraControlsVector2,
} from "./index.js";

export function normalizePointerEvent(event: PointerEvent | GpuCameraControlsPointerEvent): GpuCameraControlsPointerEvent;
export function normalizeWheelEvent(event: WheelEvent | GpuCameraControlsWheelEvent): GpuCameraControlsWheelEvent;
export function normalizeKeyEvent(event: KeyboardEvent | GpuCameraControlsKeyEvent): GpuCameraControlsKeyEvent;

export interface BrowserAnalogPadController {
  begin(event: PointerEvent): GpuCameraControlsVector2;
  move(event: PointerEvent): GpuCameraControlsVector2;
  end(event: PointerEvent): GpuCameraControlsVector2;
  cancel(event: PointerEvent): GpuCameraControlsVector2;
  setState(state: GpuCameraControlsVector2): GpuCameraControlsVector2;
  getState(): Required<GpuCameraControlsVector2>;
  isActive(): boolean;
}

export function createAnalogPadController(options?: {
  radius?: number;
  invertY?: boolean;
  onChange?: (state: Required<GpuCameraControlsVector2>) => void;
}): BrowserAnalogPadController;

export interface BrowserCameraControlsBindings {
  attach(): BrowserCameraControlsBindings;
  detach(): BrowserCameraControlsBindings;
  update(): BrowserCameraControlsBindings;
  setAnalogState(kind: "move" | "look", state: GpuCameraControlsVector2): BrowserCameraControlsBindings;
  setAltitude(value: number): BrowserCameraControlsBindings;
  setSprint(value: boolean): BrowserCameraControlsBindings;
  setJump(value: boolean): BrowserCameraControlsBindings;
  setCrouch(value: boolean): BrowserCameraControlsBindings;
  setSwimVertical(value: number): BrowserCameraControlsBindings;
  cancelObsoleteInputs(reason?: string): BrowserCameraControlsBindings;
  getAnalogInput(): Required<GpuCameraControlsAnalogInput> & {
    move: Required<GpuCameraControlsVector2>;
    look: Required<GpuCameraControlsVector2>;
  };
  getDiagnostics(): {
    attached: boolean;
    gamepadIds: string[];
    analogInput: Required<GpuCameraControlsAnalogInput> & {
      move: Required<GpuCameraControlsVector2>;
      look: Required<GpuCameraControlsVector2>;
    };
  };
}

export function createBrowserCameraControlsBindings(options: {
  controller: GpuCameraControls;
  element?: EventTarget | null;
  pointerTarget?: EventTarget | null;
  wheelTarget?: EventTarget | null;
  keyTarget?: EventTarget | null;
  gamepadProvider?: () => ArrayLike<Gamepad | null> | null | undefined;
  capturePointer?: boolean;
  preventDefault?: boolean;
}): BrowserCameraControlsBindings;
