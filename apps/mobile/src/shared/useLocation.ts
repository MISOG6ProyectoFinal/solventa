import { useCallback, useEffect, useRef, useState } from 'react';

import { readLocation, type Place } from './location';

export function useLocation() {
  const [location, setLocation] = useState<Place | null>(null);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);

  const load = useCallback((fresh = false) => {
    const current = ++request.current;

    if (fresh) {
      setLocation(null);
      setFailed(false);
    }

    readLocation(fresh ? { fresh: true } : undefined)
      .then((place) => {
        if (request.current !== current) {
          return;
        }
        setLocation(place);
        setFailed(false);
      })
      .catch(() => {
        if (request.current !== current) {
          return;
        }
        setLocation(null);
        setFailed(true);
      });
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return { location, failed, refresh: () => load(true) };
}
