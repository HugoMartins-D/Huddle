import { AnchorHTMLAttributes, useEffect, useState } from "react";

function current() {
  return location.hash
    .replace(/^#\/?/, "")
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
}

/** Rota atual como lista de segmentos: `#/reunioes/abc/sala` → ["reunioes", "abc", "sala"]. */
export function useRoute() {
  const [segments, setSegments] = useState(current);
  useEffect(() => {
    const onChange = () => {
      setSegments(current());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return segments;
}

export function go(path: string) {
  location.hash = path.startsWith("/") ? path : `/${path}`;
}

export function Link({ to, ...props }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={`#${to}`} {...props} />;
}
