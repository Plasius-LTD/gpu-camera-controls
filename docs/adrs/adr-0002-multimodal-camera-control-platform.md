# ADR 0002: Multimodal Camera Control Platform

## Status

Accepted

## Context

The initial `@plasius/gpu-camera-controls` package solved touch-first browser
camera control, but Plasius runtime surfaces now need one shared control layer
across flat-screen, gamepad, XR controller, XR hand, and future external
hardware.

Those integrations need consistent action mapping, damping, diagnostics,
recording/replay, and haptic output without pulling DOM, React, or renderer
details into the core package.

## Decision

Keep `@plasius/gpu-camera-controls` as the interaction layer above
`@plasius/gpu-camera`, and refactor it into:

- normalized input sources
- gesture recognizers
- action-frame mapping
- locomotion/orbit solvers
- damping and device arbitration
- diagnostics, haptics, and deterministic replay

The root package stays framework-agnostic. Browser- and XR-specific adaptation
ships through additive subpath exports:

- `@plasius/gpu-camera-controls/browser`
- `@plasius/gpu-camera-controls/xr`

## Consequences

- Routes can consume shared DOM and XR bindings instead of owning camera input
  glue locally.
- The control platform can grow to specialist or accessibility hardware through
  additive external adapters without redesigning the controller core.
- Camera math remains owned by `@plasius/gpu-camera`, while XR runtime object
  normalization remains owned by `@plasius/gpu-xr`.
