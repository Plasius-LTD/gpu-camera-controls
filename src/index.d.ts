import type {
  CameraCollisionProvider,
  CameraComfortProfile,
  CameraDefinition,
  CameraLocomotionState,
  CameraPose,
  CameraState,
  CameraViewMode,
  Vec3,
} from "@plasius/gpu-camera";

export type GpuCameraControlsViewMode = CameraViewMode;

export type GpuCameraControlsTouchAction =
  | "none"
  | "rotate"
  | "look"
  | "dolly-truck"
  | "truck";

export type CameraControlActionKind =
  | "move"
  | "look"
  | "orbit"
  | "truck"
  | "dolly"
  | "elevate"
  | "roll"
  | "smooth-turn"
  | "snap-turn"
  | "teleport"
  | "focus"
  | "recenter"
  | "sprint"
  | "precision";

export type CameraControlSourceFamily =
  | "touch"
  | "pen"
  | "mouse"
  | "keyboard"
  | "gamepad"
  | "xr-controller"
  | "xr-hand"
  | "external";

export interface GpuCameraControlsPointerEvent {
  pointerId: number;
  pointerType?: string;
  clientX: number;
  clientY: number;
  button?: number;
  buttons?: number;
  timeStamp?: number;
}

export interface GpuCameraControlsWheelEvent {
  deltaY: number;
  timeStamp?: number;
}

export interface GpuCameraControlsKeyEvent {
  code: string;
  repeat?: boolean;
  timeStamp?: number;
}

export interface GpuCameraControlsVector2 {
  x?: number;
  y?: number;
}

export interface GpuCameraControlsAnalogInput {
  move?: GpuCameraControlsVector2;
  look?: GpuCameraControlsVector2;
  altitude?: number;
  sprint?: boolean;
}

export interface CameraControlSourceDescriptor {
  id?: string;
  family?: CameraControlSourceFamily | string;
  kind?: string;
  label?: string | null;
}

export interface CameraControlHapticEffect {
  target?: { id?: string | null } | null;
  amplitude?: number;
  durationMs?: number;
  family?: CameraControlSourceFamily | string | null;
}

export interface CameraControlInputFrame {
  move?: GpuCameraControlsVector2;
  look?: GpuCameraControlsVector2;
  orbit?: GpuCameraControlsVector2;
  truck?: GpuCameraControlsVector2;
  dolly?: number;
  elevate?: number;
  roll?: number;
  smoothTurn?: number;
  snapTurn?: number;
  sprint?: boolean;
  precision?: boolean;
  focus?: boolean;
  recenter?: boolean;
  teleport?: {
    position?: Vec3 | null;
    target?: Vec3 | null;
  } | null;
  source?: CameraControlSourceDescriptor | null;
  viewerPose?: CameraPose | null;
  locomotion?: CameraLocomotionState | null;
  haptics?: CameraControlHapticEffect[];
  debug?: Record<string, unknown> | null;
}

export interface CameraControlBindingMap {
  keyboard?: Record<string, unknown>;
  gamepad?: Record<string, unknown>;
  xr?: Record<string, unknown>;
}

export interface CameraControlDeviceState {
  id: string;
  family: string;
  kind: string;
  label: string | null;
  lastSeenAt: number;
}

export interface CameraControlDiagnostics {
  activeDevice: string;
  activeGesture: GpuCameraControlsTouchAction;
  activeSourceIds: string[];
  sources: CameraControlDeviceState[];
  bindings: CameraControlBindingMap;
  comfortProfile: Required<CameraComfortProfile>;
  recordingActive: boolean;
  xrMode: string | null;
  hasViewerPose: boolean;
  context: Record<string, unknown>;
}

export interface CameraControlRecordingFrame {
  deltaSeconds: number;
  viewMode: GpuCameraControlsViewMode;
  camera: CameraState;
  targetCamera: CameraState;
  activeDevice: string;
}

export interface CameraControlRecording {
  label: string | null;
  frames: CameraControlRecordingFrame[];
}

export interface GpuCameraControlsTerrainFloorProvider {
  (
    x: number,
    z: number,
    context: {
      viewMode: GpuCameraControlsViewMode;
      camera: CameraState;
    }
  ): number;
}

export interface GpuCameraControlsOptions {
  viewMode?: GpuCameraControlsViewMode | string;
  camera?: CameraDefinition;
  terrainFloorProvider?: GpuCameraControlsTerrainFloorProvider;
  collisionProvider?: CameraCollisionProvider | null;
  bindings?: CameraControlBindingMap;
  comfortProfile?: CameraComfortProfile;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  moveSpeed?: number;
  editorMoveSpeed?: number;
  sprintMultiplier?: number;
  rotateSensitivity?: number;
  lookSensitivity?: number;
  analogLookSpeed?: number;
  truckSensitivity?: number;
  dollySensitivity?: number;
  wheelDollySensitivity?: number;
  rollSensitivity?: number;
  smoothTurnSpeed?: number;
  snapTurnDegrees?: number;
  precisionMultiplier?: number;
  analogDeadzone?: number;
  smoothTime?: number;
  draggingSmoothTime?: number;
  terrainFloorOffset?: number;
}

export interface GpuCameraControlsFrame {
  viewMode: GpuCameraControlsViewMode;
  rigMode: GpuCameraControlsViewMode;
  camera: CameraState;
  targetCamera: CameraState;
  activeGesture: GpuCameraControlsTouchAction;
  activePointerCount: number;
  analogInput: Required<GpuCameraControlsAnalogInput> & {
    move: Required<GpuCameraControlsVector2>;
    look: Required<GpuCameraControlsVector2>;
  };
  distance: number;
  activeDevice: string;
  activeSources: CameraControlDeviceState[];
  comfortProfile: Required<CameraComfortProfile>;
  diagnostics: CameraControlDiagnostics;
  hapticEffects: CameraControlHapticEffect[];
  recordingActive: boolean;
  resting: boolean;
}

export interface GpuCameraControls {
  setViewMode(viewMode: GpuCameraControlsViewMode | string): GpuCameraControls;
  setCamera(camera: CameraDefinition): GpuCameraControls;
  setTerrainFloorProvider(
    provider: GpuCameraControlsTerrainFloorProvider | null | undefined
  ): GpuCameraControls;
  setCollisionProvider(provider: CameraCollisionProvider | null | undefined): GpuCameraControls;
  setBindings(bindings: CameraControlBindingMap): GpuCameraControls;
  getBindings(): CameraControlBindingMap;
  setComfortProfile(profile: CameraComfortProfile): GpuCameraControls;
  getComfortProfile(): Required<CameraComfortProfile>;
  setContext(context: Record<string, unknown>): GpuCameraControls;
  handlePointerDown(event: GpuCameraControlsPointerEvent): GpuCameraControls;
  handlePointerMove(event: GpuCameraControlsPointerEvent): GpuCameraControls;
  handlePointerUp(event: GpuCameraControlsPointerEvent): GpuCameraControls;
  handlePointerCancel(event: GpuCameraControlsPointerEvent): GpuCameraControls;
  handleWheel(event: GpuCameraControlsWheelEvent): GpuCameraControls;
  handleKeyDown(event: GpuCameraControlsKeyEvent): GpuCameraControls;
  handleKeyUp(event: GpuCameraControlsKeyEvent): GpuCameraControls;
  setAnalogInput(input: GpuCameraControlsAnalogInput): GpuCameraControls;
  applyInputFrame(input: CameraControlInputFrame): GpuCameraControls;
  ingestGamepads(gamepads?: unknown[] | ArrayLike<unknown>): GpuCameraControls;
  ingestXrFrame(snapshot?: Record<string, unknown>): GpuCameraControls;
  queueHapticEffect(effect: CameraControlHapticEffect): GpuCameraControls;
  consumeHapticEffects(): CameraControlHapticEffect[];
  beginRecording(label?: string | null): GpuCameraControls;
  stopRecording(): CameraControlRecording;
  clearRecording(): GpuCameraControls;
  playRecording(recording: CameraControlRecording): GpuCameraControls;
  getRecording(): CameraControlRecording;
  getDiagnostics(): CameraControlDiagnostics;
  update(deltaSeconds?: number): GpuCameraControlsFrame;
  getFrame(): GpuCameraControlsFrame;
}

export function createCameraControls(
  options?: GpuCameraControlsOptions
): GpuCameraControls;

export const gpuCameraControlsViewModes: readonly [
  "editor",
  "spectator",
  "third-person",
  "first-person",
  "top-down",
  "isometric",
  "inspect",
  "xr-vr",
  "xr-ar"
];

export const gpuCameraControlsTouchActions: readonly [
  "none",
  "rotate",
  "look",
  "dolly-truck",
  "truck"
];

export const cameraControlActionKinds: readonly CameraControlActionKind[];
export const cameraControlSourceFamilies: readonly CameraControlSourceFamily[];

export type { CameraDefinition, CameraState, CameraViewMode, CameraComfortProfile, CameraCollisionProvider, CameraLocomotionState, CameraPose, Vec3 };
