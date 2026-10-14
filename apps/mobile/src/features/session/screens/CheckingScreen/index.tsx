import { useEffect } from 'react';

import { Screen } from '../../../../shared/ui';
import { useSessionStore } from '../../store/useSessionStore';

export default function CheckingScreen() {
  const restore = useSessionStore((state) => state.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  return <Screen testID="session-checking" header={{ hide: true }} />;
}
