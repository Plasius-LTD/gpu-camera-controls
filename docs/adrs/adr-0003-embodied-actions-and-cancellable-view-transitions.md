# ADR 0003: Embodied Actions and Cancellable View Transitions

## Status

Accepted

## Date

2026-07-18

## Context

The persistent-world viewer needs to move between overview, first-person,
third-person, and isometric analysis without carrying stale input from the old
mode into the new one. First-person physics also needs device-independent jump,
crouch, and swim intent from keyboard, touch, gamepad, XR, and external
adapters.

Camera controls must not implement character collision, gravity, buoyancy, or
camera mathematics. Those responsibilities remain with `@plasius/gpu-physics`
and `@plasius/gpu-camera`.

## Decision

Add a non-breaking `CameraControlEmbodiedActionsV1` output to each control
frame:

- jump and crouch expose active, pressed-edge, and released-edge state;
- swim exposes a normalized vertical intent in the inclusive range `[-1, 1]`;
- mode transitions expose explicit `began`, `committed`, and `cancelled`
  events.

Add an explicit transition lifecycle:

- `beginViewModeTransition()` records the source and destination modes,
  captures the selected world position by default, and cancels obsolete input;
- `commitViewModeTransition()` applies the destination camera rig and
  translates the rig back to the captured world position;
- `cancelViewModeTransition()` leaves the current mode and position unchanged.

Cancellation clears queued pointer, keyboard, analog, gamepad, XR, playback,
and haptic work. Held keyboard, gamepad, and XR controls remain suppressed until
they return to neutral so an input from the previous view cannot leak into the
new view. Browser detach is the exception: it clears local state without
retaining suppression latches because release events cannot be observed while
detached.

The existing immediate `setViewMode()` API remains available and retains its
existing behavior. Consumers opt into the explicit lifecycle when they need to
coordinate view changes with streaming or physics.

## Consequences

- Physics receives deterministic device-neutral intent without importing DOM
  or camera-control details.
- View switching can cancel old work before detailed world data is ready.
- Touch UIs can publish the same embodied action state as keyboard, gamepad,
  and XR devices.
- Transition callers must commit or cancel each active transition before
  starting another.
- Character state such as grounded, swimming, falling, or crouched remains
  authoritative in the physics layer, not this package.

## Alternatives Considered

- Apply gravity and jumping inside camera controls: rejected because it would
  duplicate `@plasius/gpu-physics` and couple input to world collision.
- Change `setViewMode()` to cancel every input implicitly: rejected because it
  would alter existing consumers without an explicit migration.
- Let each site view normalize its own actions: rejected because keyboard,
  touch, gamepad, and XR semantics would drift.
