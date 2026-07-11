import type { CameraControlHapticEffect, GpuCameraControls } from "./index.js";

export interface XrHandGesture {
  pinch: boolean;
  grab: boolean;
  confidence: number;
  pinchPoint: [number, number, number] | null;
}

export function recognizeXrHandGesture(
  hand: {
    joints?: Array<{
      name: string;
      pose: {
        position: [number, number, number];
      } | null;
    }>;
  } | null | undefined,
  options?: {
    pinchThreshold?: number;
    grabThreshold?: number;
  }
): XrHandGesture;

export interface XrCameraControlsBridge {
  syncFrame(frameSnapshot: {
    inputSources?: Array<{
      id: string;
      handedness?: string;
      kind?: string;
      hand?: {
        joints?: Array<{
          name: string;
          pose: {
            position: [number, number, number];
          } | null;
        }>;
      } | null;
    }>;
  }): XrCameraControlsBridge;
  consumeHaptics(
    dispatcher?: ((effect: CameraControlHapticEffect) => void) | null
  ): CameraControlHapticEffect[];
}

export function createXrCameraControlsBridge(options: {
  controller: GpuCameraControls;
  dominantHand?: string;
  pointerSensitivity?: number;
  dollySensitivity?: number;
  pinchThreshold?: number;
  grabThreshold?: number;
}): XrCameraControlsBridge;
