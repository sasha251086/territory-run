import { useEffect, useState } from 'react';
import { getApiLoadingState, subscribeApiLoading } from '../api/loading';

export default function ApiSlowLoadingBanner() {
  const [slow, setSlow] = useState(() => getApiLoadingState().slow);

  useEffect(() => {
    return subscribeApiLoading(() => {
      setSlow(getApiLoadingState().slow);
    });
  }, []);

  if (!slow) {
    return null;
  }

  return (
    <div className="api-slow-banner" role="status" aria-live="polite">
      Подключаемся к серверу… первый запрос может занять до 30 секунд
    </div>
  );
}
