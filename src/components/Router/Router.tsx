import { ReactElement, useState, useEffect, useCallback, useRef } from 'react';
import { RouterPageProps } from './RouterPage';

interface RouterProps {
  children: ReactElement[];
  scrollCount: number;
}

function useURL() {
  const getURL = useCallback(
    () => new URL(window.location.href).pathname.replace(/^\//, ''),
    []
  );
  const [url, setURL] = useState(getURL());

  useEffect(() => {
    document.body.addEventListener('click', listener);
    return () => document.body.removeEventListener('click', listener);

    function listener(event: Event) {
      let target = event.target as HTMLElement | null;
      while (target && !(target instanceof HTMLAnchorElement))
        target = target.parentElement;
      if (!target) return;
      event.preventDefault();
      window.history.pushState('', '', target.href);
      setURL(getURL());
    }
  }, [getURL]);

  return url;
}

function usePageHeight(container: HTMLElement | null) {
  const [height, setHeight] = useState(container?.offsetHeight ?? 0);

  useEffect(() => {
    window.addEventListener('resize', onResize);
    setHeight(container?.offsetHeight ?? 0);
    return () => window.removeEventListener('resize', onResize);

    function onResize() {
      setHeight(container?.offsetHeight ?? 0);
    }
  }, [container]);

  return height;
}

export function Router({ children, scrollCount }: RouterProps) {
  const pageProps = children.map((child) => child.props as RouterPageProps);
  const [previousPage, setPreviousPage] = useState(<></>);
  const [currentPage, setCurrentPage] = useState(<></>);
  const [nextPage, setNextPage] = useState(<></>);
  const container = useRef<HTMLDivElement>(null);
  const pageHeight = usePageHeight(container.current);
  const componentHeight = `${pageHeight}px`;
  const url = useURL();

  useEffect(() => {
    setPreviousPage(pageProps[0].element);
    setCurrentPage(pageProps[1].element);
    setNextPage(pageProps[2].element);
    if (!container.current) return;
    const index = pageProps.findIndex((child) =>
      child.index ? /^\/?$/.test(url) : child.path === url
    );
    container.current.scrollTop = index * pageHeight;
  }, [url, pageProps, pageHeight]);

  const onScroll = useCallback(
    function (direction: number) {
      if (!container.current) return;
      if (direction > 0) {
        container.current.scrollTop += pageHeight / scrollCount;
      } else if (direction < 0) {
        container.current.scrollTop -= pageHeight / scrollCount;
      }
    },
    [pageHeight, scrollCount]
  );

  return (
    <div
      className="router"
      style={{
        flex: '0 0 ' + pageHeight ? componentHeight : '100%',
        width: '100%',
        overflow: 'hidden',
        scrollBehavior: 'smooth',
        position: 'relative',
      }}
      onWheel={(event) => onScroll(event.deltaY)}
      ref={container}
    >
      <div
        style={{ position: 'absolute', height: '100%', top: '0%' }}
        className="router-page"
      >
        {previousPage}
      </div>
      <div
        style={{ position: 'absolute', height: '100%', top: '100%' }}
        className="router-page"
      >
        {currentPage}
      </div>
      <div
        style={{ position: 'absolute', height: '100%', top: '200%' }}
        className="router-page"
      >
        {nextPage}
      </div>
    </div>
  );
}
