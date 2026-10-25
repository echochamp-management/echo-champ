'use client';

import { useEffect } from 'react';

export default function ClientStorageCleanup() {
  useEffect(() => {
    window.localStorage.removeItem('echo-champ-customer-name');
    window.localStorage.removeItem('echo-champ-customer-firstname');
    window.localStorage.removeItem('echo-champ-catalogue-order-id');
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('echo-champ-pin-'))
      .forEach((key) => window.localStorage.removeItem(key));
  }, []);

  return null;
}
