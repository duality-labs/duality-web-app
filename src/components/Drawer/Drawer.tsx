import { useRef } from 'react';
import './Drawer.scss';

export default function Drawer({
  expanded = false,
  className,
  children,
}: {
  expanded: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="drawer"
      style={{
        height:
          expanded && contentRef.current ? contentRef.current.offsetHeight : 0,
      }}
    >
      <div ref={contentRef} className={className}>
        {children}
      </div>
    </div>
  );
}
