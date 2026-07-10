# ADR 0001: Framework-Agnostic Touch Camera Controls

- Status: Accepted
- Date: 2026-07-10

## Context

Plasius world-generation demos and game surfaces need touch-first camera
navigation that feels like CameraControls-style orbit, dolly, and truck
interaction, while keeping renderers independent from Three.js and avoiding a
direct `camera-controls` dependency.

`@plasius/gpu-camera` already owns camera state, transforms, projection data,
rig modes, and control primitives. Input interpretation, gesture tracking,
analog pads, and damping are a separate concern.

## Decision

Create `@plasius/gpu-camera-controls` as a framework-agnostic input and gesture
package that depends on `@plasius/gpu-camera`.

- Accept normalized pointer, wheel, key, and analog inputs.
- Implement one-finger rotate/look, two-finger dolly/truck, and three-finger
  truck semantics without importing or copying `camera-controls`.
- Delegate camera primitive mutations to `@plasius/gpu-camera`.
- Return plain camera frames for WebGPU, workers, React, and non-DOM consumers.

## Consequences

- Positive: Apps share one touch interaction model instead of duplicating
  gesture code.
- Positive: The package remains renderer-agnostic and testable without a DOM.
- Positive: `@plasius/gpu-camera` remains the math and rig authority.
- Negative: Browser-specific UI affordances, such as visual thumb pads, still
  belong in consuming applications.

## Alternatives Considered

- Keep controls in `plasius-ltd-site`: rejected because generator and game
  surfaces would drift.
- Add controls directly to `@plasius/gpu-camera`: rejected to keep the camera
  math package independent from input lifecycle concerns.
- Depend on `camera-controls`: rejected due to Three.js coupling and source
  ownership requirements.
