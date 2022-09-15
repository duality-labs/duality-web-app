import { useState, useEffect, useCallback, MouseEvent } from 'react';

export default function useOnDragMove(
  onMouseMove: EventListener,
  container: Node = document
) {
  // set dragging state and handlers
  const [dragging, setDragging] = useState(false);
  const startDrag = useCallback((e: MouseEvent<Node>) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const stopDrag = useCallback((e: MouseEvent<Node>) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  // remove dragging state on mouseup of container
  useEffect(() => {
    if (dragging) {
      const onMouseUp = () => setDragging(false);
      container.addEventListener('mouseup', onMouseUp);
      container.addEventListener('mouseleave', onMouseUp);
      return () => {
        container.removeEventListener('mouseup', onMouseUp);
        container.removeEventListener('mouseleave', onMouseUp);
      };
    }
  }, [container, dragging]);

  // handle dragging on mousemove inside container
  useEffect(() => {
    if (dragging) {
      container.addEventListener('mousemove', onMouseMove);
      return () => container.removeEventListener('mousemove', onMouseMove);
    }
  }, [container, dragging, onMouseMove]);

  return [startDrag, stopDrag];
}
