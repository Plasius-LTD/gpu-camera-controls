import type {
  CameraDefinition,
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

export type GpuCameraControlsTerrainFloorProvider = (
  x: number,
  z: number,
  context: {
    viewMode: GpuCameraControlsViewMode;
    camera: CameraState;
  }
) => number;

export interface GpuCameraControlsOptions {
  viewMode?: GpuCameraControlsViewMode | string;
  camera?: CameraDefinition;
  terrainFloorProvider?: GpuCameraControlsTerrainFloorProvider;
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
  analogDeadzone?: number;
  smoothTime?: number;
  draggingSmoothTime?: number;
  terrainFloorOffset?: number;
}

export interface GpuCameraControlsFrame {
  viewMode: GpuCameraControlsViewMode;
  camera: CameraState;
  targetCamera: CameraState;
  activeGesture: GpuCameraControlsTouchAction;
  activePointerCount: number;
  analogInput: Required<GpuCameraControlsAnalogInput> & {
    move: Required<GpuCameraControlsVector2>;
    look: Required<GpuCameraControlsVector2>;
  };
  distance: number;
  resting: boolean;
}

export interface GpuCameraControls {
  setViewMode(viewMode: GpuCameraControlsViewMode | string): GpuCameraControls;
  setCamera(camera: CameraDefinition): GpuCameraControls;
  setTerrainFloorProvider(
    provider: GpuCameraControlsTerrainFloorProvider | null | undefined
  ): GpuCameraControls;
  handlePointerDown(event: GpuCameraControlsPointerEvent): GpuCameraControls;
  handlePointerMove(event: GpuCameraControlsPointerEvent): GpuCameraControls;
  handlePointerUp(event: GpuCameraControlsPointerEvent): GpuCameraControls;
  handlePointerCancel(event: GpuCameraControlsPointerEvent): GpuCameraControls;
  handleWheel(event: GpuCameraControlsWheelEvent): GpuCameraControls;
  handleKeyDown(event: GpuCameraControlsKeyEvent): GpuCameraControls;
  handleKeyUp(event: GpuCameraControlsKeyEvent): GpuCameraControls;
  setAnalogInput(input: GpuCameraControlsAnalogInput): GpuCameraControls;
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
  "first-person"
];

export const gpuCameraControlsTouchActions: readonly [
  "none",
  "rotate",
  "look",
  "dolly-truck",
  "truck"
];

export type { CameraDefinition, CameraState, CameraViewMode, Vec3 };
