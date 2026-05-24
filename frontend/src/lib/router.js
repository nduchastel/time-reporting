// frontend/src/lib/router.js
import { useEffect, useState, useCallback } from 'react';

function parse(hash) {
  const path = (hash || '#/').replace(/^#/, '') || '/';
  const [pathname, query = ''] = path.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return { path: pathname, params };
}

export function useHashRoute() {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = useCallback((to) => { window.location.hash = to.startsWith('#') ? to : `#${to}`; }, []);
  return { ...route, navigate };
}
