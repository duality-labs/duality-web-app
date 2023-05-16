import { useState, useEffect } from 'react';

type OnAnimationFrame = (
  timestamp: DOMHighResTimeStamp
) => typeof StopAnimation | void;
type OnTransitionAnimationFrame = (
  timestamp: DOMHighResTimeStamp,
  progress: number,
  lastProgress: number
) => void;

const StopAnimation = Symbol('StopAnimation');
export function useTransitionAnimation(
  onTransitionAnimationFrame: OnTransitionAnimationFrame,
  dependencyTriggers: unknown[],
  duration = 1000,
  frameRateHz = 0
): void {
  // bundle all state together as the state changes together
  const [state, setState] = useState<
    | {
        dependencyTriggers: unknown[];
        onAnimationFrame?: OnAnimationFrame;
      }
    | undefined
  >();

  // this effect is not recommended practice
  // this effect can easily cause an infinite loop if setState is called on
  // every invocation of this callback. we carefully ensure that doesn't happen
  useEffect(() => {
    if (
      state &&
      dependencyTriggers.length === state.dependencyTriggers.length
    ) {
      let same = true;
      for (let i = 0; i < dependencyTriggers.length; i += 1) {
        if (dependencyTriggers[i] !== state.dependencyTriggers[i]) {
          same = false;
          break;
        }
      }
      // dependencies are the same: don't change state
      if (same) return;
    }
    // dependencies haves changed: set new transition callback
    let lastProgress = 0;
    const start = Date.now();
    const end = start + duration;
    return setState({
      dependencyTriggers: dependencyTriggers,
      // skip animation on load (on first execution where state is undefined)
      onAnimationFrame: state
        ? (timestamp: DOMHighResTimeStamp) => {
            // end animation when completed by sending a StopAnimation signal
            const progress = (Date.now() - start) / (end - start);
            if (progress > 1) {
              return StopAnimation;
            }
            // else continue
            onTransitionAnimationFrame(timestamp, progress, lastProgress);
            lastProgress = progress;
          }
        : undefined,
    });
  }, [state, dependencyTriggers, duration, onTransitionAnimationFrame]);

  useAnimation(state?.onAnimationFrame, frameRateHz);
}

export function useAnimation(
  onAnimationFrame?: OnAnimationFrame,
  frameRateHz = 0
): void {
  const userPrefersMotion = usePrefersMotion();

  useEffect(() => {
    let lastTimeStamp = 0;
    let animationFrame = window?.requestAnimationFrame(onFrame);
    return () => cancelAnimationFrame(animationFrame);

    function onFrame(timestamp: DOMHighResTimeStamp) {
      if (onAnimationFrame) {
        // don't animate too frequently: redraw only if enough time has passed
        // animate only if user allows it
        const hasAnimation = canUseMotion(userPrefersMotion);
        // animate only if below current refresh rate speed
        const hasFrameTime =
          !frameRateHz || timestamp - lastTimeStamp > frameRateHz;
        // animate if all conditions are met
        if (hasAnimation && hasFrameTime) {
          lastTimeStamp = timestamp;
          const result = onAnimationFrame(timestamp);
          // stop requesting animation frames
          if (result === StopAnimation) {
            return;
          }
        }
        animationFrame = window?.requestAnimationFrame(onFrame);
      }
    }
  }, [userPrefersMotion, onAnimationFrame, frameRateHz]);
}

// determine if the user has flagged reduced motion
// and determine this by the timestamp that we detected the change
// we test the timestamp so that we can avoid the first "hyperjump" animation
// when the page is first loaded
function canUseMotion(userPrefersMotion: number | false) {
  // empirical 100ms delay between first page navigation and media query result
  return userPrefersMotion !== false && Date.now() - userPrefersMotion > 100;
}
function usePrefersMotion() {
  const [userPrefersMotionSince, setUserPrefersMotion] = useState<
    number | false
  >(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    // execute immediately
    onPrefersMotionChange();
    if (mediaQuery) {
      // execute on change
      mediaQuery.addEventListener('change', onPrefersMotionChange);
      // remove when no longer needed
      return () =>
        mediaQuery.removeEventListener('change', onPrefersMotionChange);
    }

    function onPrefersMotionChange() {
      setUserPrefersMotion(mediaQuery?.matches ? false : Date.now());
    }
  }, []);

  return userPrefersMotionSince;
}
