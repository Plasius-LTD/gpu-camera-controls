# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- **Added**
  - Added `CameraControlEmbodiedActionsV1` with edge-aware jump/crouch,
    normalized vertical swim intent, and runtime schema version `1`.
  - Added explicit begin, commit, and cancel view-mode transition APIs with
    selected-world-position preservation.
  - Added browser action-pad setters for jump, crouch, and swim input.

- **Changed**
  - Routed reviewed CI through the organisation's quarantined public runner group while retaining explicit platform labels.
  - Updated the lockfile to the surviving `@plasius/gpu-shared` 1.0.14 line and the fixed esbuild resolution.
  - Bound npm publication to the exact prepared `main` commit after successful push-triggered CI.
  - Enabled exact-head manual CI dispatch for reviewed release validation.
  - Cancel obsolete keyboard, pointer, analog, gamepad, XR, playback, and haptic
    input when a coordinated view transition begins.
  - Suppress held device input until it returns to neutral after cancellation.
  - Route maintenance and release-preparation automation through self-hosted
    Linux runners.

- **Fixed**
  - Disabled package-manager caching on self-hosted CI to prevent cache-save
    cleanup stalls from blocking the validation queue.
  - Clear browser action state on detach without retaining unobservable
    held-key suppression latches.
  - Use the pinned Codecov action with GitHub OIDC on self-hosted CI instead of
    requiring a runner-global Python `pip` installation or repository token.

- **Security**
  - Pinned patched transitive npm dependencies to clear the current audit baseline.
  - Added fail-closed source and npm-package admission for the administrative contributor registry and pinned the CI/CD runtime to Node.js 24.18.0 LTS.
  - Removed the npm write-token path, added a fail-closed npm 11.5.1-or-newer OIDC guard, and denied fork PR code access to self-hosted CI.
  - (placeholder)

## [0.1.1] - 2026-07-11

- **Added**
  - Added multimodal control contracts for action frames, bindings, diagnostics,
    haptic effects, and deterministic recording/replay.
  - Added browser and XR subpath exports for DOM bindings, analog pads, XR hand
    gesture recognition, and XR-frame bridging.

- **Changed**
  - Expanded the controller from a touch-focused input layer into the shared
    browser/XR/gamepad/external camera interaction platform for Plasius
    surfaces.

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)

## [0.1.0] - 2026-07-10

- **Added**
  - Created `@plasius/gpu-camera-controls` as the touch, pointer, keyboard,
    analog, and damping layer for `@plasius/gpu-camera`.
  - Added CameraControls-style one-finger rotate/look, two-finger dolly/truck,
    three-finger truck, keyboard, wheel, analog input, and terrain-floor
    clamping support without depending on Three.js or `camera-controls`.

- **Changed**
  - (placeholder)

- **Fixed**
  - (placeholder)

- **Security**
  - (placeholder)


[0.1.0]: https://github.com/Plasius-LTD/gpu-camera-controls/releases/tag/v0.1.0
[0.1.1]: https://github.com/Plasius-LTD/gpu-camera-controls/releases/tag/v0.1.1
