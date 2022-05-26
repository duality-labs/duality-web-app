import React, { useEffect, useState } from 'react';

import './Hint.scss';

interface HintProps {
  refList: React.RefObject<HTMLElement>[];
  children?: React.ReactNode | React.ReactNode[];
  index?: number;
}

export default function Hint({ refList, children, index }: HintProps) {
  const contentList = Array.isArray(children) ? children : [children];
  if (refList.length !== contentList.length)
    throw new Error('ref list count does not match children count');
  const [selectedIndex, setSelectedIndex] = useState(index ?? 0);
  const positions = refList.map((ref) => {
    const rect = ref.current?.getBoundingClientRect();
    return { top: (rect?.top ?? 0) - 100, left: rect?.left ?? 0 };
  });

  useEffect(() => {
    if (index) setSelectedIndex(index);
  }, [index]);

  return (
    <>
      {contentList.map((content, index) => (
        <div
          key={index}
          className={`hint-box ${selectedIndex === index ? 'active' : ''}`}
          style={{ top: positions[index].top, left: positions[index].left }}
        >
          {contentList[index]}
          <div className="button-group">
            <button
              type="button"
              className={index === 0 ? 'disabled' : ''}
              onClick={() => setSelectedIndex(selectedIndex - 1)}
            >
              Previous
            </button>
            <span>
              Step {selectedIndex + 1} / {contentList.length}
            </span>
            <button
              type="button"
              className={index === contentList.length - 1 ? 'disabled' : ''}
              onClick={() => setSelectedIndex(selectedIndex + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
