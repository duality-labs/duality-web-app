import { useRef } from 'react';
import './Drawer.scss';

export default function Drawer({
  expanded = false,
  className,
  containerClassName,
  children,
}: {
  expanded: boolean;
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={['drawer', containerClassName].filter(Boolean).join(' ')}
      style={{
        height:
          expanded && contentRef.current ? contentRef.current.offsetHeight : 0,
      }}
    >
      <div
        ref={contentRef}
        className={['drawer-panel', className].filter(Boolean).join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
