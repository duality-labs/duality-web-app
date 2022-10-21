import { useState, useEffect, useCallback, MouseEvent, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

export default function useOnDragMove(
  onMouseMove: (
    evt: Event,
    originalScreenPosition: Position | undefined
  ) => void,
  onMouseUp?: (evt: Event) => void,
  container: Node = document
): [
  startDrag: (e: MouseEvent<Node>) => void,
  isDragging: boolean,
  stopDrag: (e: MouseEvent<Node>) => void
] {
  const originalPosition = useRef<Position>();

  // set dragging state and handlers
  const [dragging, setDragging] = useState(false);
  const startDrag = useCallback((e: MouseEvent<Node>) => {
    e.preventDefault();
    originalPosition.current = {
      x: e.screenX,
      y: e.screenY,
    };
    setDragging(true);
  }, []);
  const stopDrag = useCallback((e: MouseEvent<Node>) => {
    e.preventDefault();
    originalPosition.current = undefined;
    setDragging(false);
  }, []);

  // remove dragging state on mouseup of container
  useEffect(() => {
    if (dragging) {
      const wrappedMouseUp = (e: MouseEventInit) => {
        setDragging(false);
        if (onMouseUp) {
          onMouseUp(e as Event);
        }
      };
      container.addEventListener('mouseup', wrappedMouseUp);
      container.addEventListener('mouseleave', wrappedMouseUp);
      return () => {
        container.removeEventListener('mouseup', wrappedMouseUp);
        container.removeEventListener('mouseleave', wrappedMouseUp);
      };
    }
  }, [container, dragging, onMouseUp]);

  const listener = useCallback(
    (e: MouseEventInit) => {
      const displacement =
        originalPosition.current &&
        e.screenX !== undefined &&
        e.screenY !== undefined
          ? {
              x: e.screenX - originalPosition.current.x,
              y: e.screenY - originalPosition.current.y,
            }
          : undefined;

      return onMouseMove(e as Event, displacement);
    },
    [onMouseMove]
  );

  // handle dragging on mousemove inside container
  useEffect(() => {
    if (dragging) {
      container.addEventListener('mousemove', listener);
      return () => container.removeEventListener('mousemove', listener);
    }
  }, [container, dragging, listener]);

  return [startDrag, dragging, stopDrag];
}
