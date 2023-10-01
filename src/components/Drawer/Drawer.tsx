import { useRef } from 'react';
import './Drawer.scss';

export default function Drawer({
  expanded = false,
  className,
  containerClassName,
  floating = false,
  children,
}: {
  expanded: boolean;
  className?: string;
  containerClassName?: string;
  floating?: boolean;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const dynamicHeight =
    expanded && contentRef.current ? contentRef.current.offsetHeight : 0;

  return (
    <div
      className={[
        'drawer',
        containerClassName,
        expanded && 'expanded',
        floating && 'floating',
      ]
        .filter(Boolean)
        .join(' ')}
      style={
        !floating
          ? {
              height: dynamicHeight,
            }
          : undefined
      }
    >
      <div
        className={['drawer-panel', className].filter(Boolean).join(' ')}
        style={{
          height: dynamicHeight,
        }}
      >
        <div className="drawer-content" ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
