function lengthVec3(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function subVec3(left, right) {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function findJoint(hand, jointNames) {
  if (!hand || !Array.isArray(hand.joints)) {
    return null;
  }
  for (const jointName of jointNames) {
    const joint = hand.joints.find((entry) => entry.name === jointName);
    if (joint?.pose?.position) {
      return joint;
    }
  }
  return null;
}

export function recognizeXrHandGesture(hand, options = {}) {
  const pinchThreshold = Number.isFinite(options.pinchThreshold)
    ? options.pinchThreshold
    : 0.035;
  const grabThreshold = Number.isFinite(options.grabThreshold)
    ? options.grabThreshold
    : 0.055;
  const thumbTip = findJoint(hand, ["thumb-tip"]);
  const indexTip = findJoint(hand, ["index-finger-tip"]);
  const middleTip = findJoint(hand, ["middle-finger-tip"]);

  if (!thumbTip || !indexTip) {
    return {
      pinch: false,
      grab: false,
      confidence: 0,
      pinchPoint: null,
    };
  }

  const thumbToIndex = lengthVec3(
    subVec3(thumbTip.pose.position, indexTip.pose.position)
  );
  const thumbToMiddle = middleTip?.pose?.position
    ? lengthVec3(subVec3(thumbTip.pose.position, middleTip.pose.position))
    : Number.POSITIVE_INFINITY;
  const pinch = thumbToIndex <= pinchThreshold;
  const grab = pinch && thumbToMiddle <= grabThreshold;
  return {
    pinch,
    grab,
    confidence: pinch ? Math.max(0, 1 - thumbToIndex / pinchThreshold) : 0,
    pinchPoint: pinch
      ? [
          (thumbTip.pose.position[0] + indexTip.pose.position[0]) / 2,
          (thumbTip.pose.position[1] + indexTip.pose.position[1]) / 2,
          (thumbTip.pose.position[2] + indexTip.pose.position[2]) / 2,
        ]
      : null,
  };
}

export function createXrCameraControlsBridge(options = {}) {
  if (!options.controller) {
    throw new Error("createXrCameraControlsBridge requires a controller.");
  }

  const controller = options.controller;
  const dominantHand = options.dominantHand ?? "right";
  const pointerSensitivity = Number.isFinite(options.pointerSensitivity)
    ? options.pointerSensitivity
    : 12;
  const dollySensitivity = Number.isFinite(options.dollySensitivity)
    ? options.dollySensitivity
    : 8;
  const previousHands = new Map();

  const gestureState = (source) => {
    const gesture = recognizeXrHandGesture(source.hand, options);
    return {
      source,
      gesture,
      pinchPoint: gesture.pinchPoint,
    };
  };

  return {
    syncFrame(frameSnapshot) {
      controller.ingestXrFrame(frameSnapshot);

      const handSources = Array.isArray(frameSnapshot?.inputSources)
        ? frameSnapshot.inputSources
            .filter((source) => source.kind === "hand" && source.hand)
            .map((source) => gestureState(source))
        : [];
      const left = handSources.find((source) => source.source.handedness === "left") ?? null;
      const right = handSources.find((source) => source.source.handedness === dominantHand) ?? null;
      const previousLeft = previousHands.get("left") ?? null;
      const previousRight = previousHands.get(dominantHand) ?? null;

      if (left?.gesture?.pinch && previousLeft?.gesture?.pinch && left.pinchPoint && previousLeft.pinchPoint) {
        controller.applyInputFrame({
          truck: {
            x: (left.pinchPoint[0] - previousLeft.pinchPoint[0]) * pointerSensitivity,
            y: (left.pinchPoint[1] - previousLeft.pinchPoint[1]) * pointerSensitivity,
          },
          source: {
            id: left.source.id,
            family: "xr-hand",
            kind: "pinch-pan",
            label: "left-hand",
          },
        });
      }

      if (right?.gesture?.pinch && previousRight?.gesture?.pinch && right.pinchPoint && previousRight.pinchPoint) {
        controller.applyInputFrame({
          look: {
            x: (right.pinchPoint[0] - previousRight.pinchPoint[0]) * pointerSensitivity,
            y: (right.pinchPoint[1] - previousRight.pinchPoint[1]) * pointerSensitivity,
          },
          source: {
            id: right.source.id,
            family: "xr-hand",
            kind: "pinch-look",
            label: "right-hand",
          },
        });
      }

      if (
        left?.gesture?.pinch && right?.gesture?.pinch &&
        previousLeft?.gesture?.pinch && previousRight?.gesture?.pinch &&
        left.pinchPoint && right.pinchPoint &&
        previousLeft.pinchPoint && previousRight.pinchPoint
      ) {
        const currentDistance = lengthVec3(subVec3(left.pinchPoint, right.pinchPoint));
        const previousDistance = lengthVec3(
          subVec3(previousLeft.pinchPoint, previousRight.pinchPoint)
        );
        controller.applyInputFrame({
          dolly: (currentDistance - previousDistance) * dollySensitivity,
          source: {
            id: `${left.source.id}:${right.source.id}`,
            family: "xr-hand",
            kind: "pinch-dolly",
            label: "two-hand",
          },
        });
      }

      if (right?.gesture?.grab) {
        controller.applyInputFrame({
          sprint: true,
          source: {
            id: right.source.id,
            family: "xr-hand",
            kind: "grab-sprint",
            label: "right-hand",
          },
        });
      }

      previousHands.set("left", left);
      previousHands.set(dominantHand, right);
      return this;
    },
    consumeHaptics(dispatcher) {
      const effects = controller.consumeHapticEffects();
      if (typeof dispatcher === "function") {
        for (const effect of effects) {
          dispatcher(effect);
        }
      }
      return effects;
    },
  };
}
