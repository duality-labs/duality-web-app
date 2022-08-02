export interface RouterPageProps {
  element: JSX.Element;
  fallback?: boolean;
  index?: boolean;
  path?: string;
}

export function RouterPage({
  element,
  path,
  index = false,
  fallback = false,
}: RouterPageProps) {
  if (!index && !path && !fallback)
    throw new Error('No path supplied to router page');

  return <>{element}</>;
}
