'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

export function ReactDevToolsBridge() {
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    setHost(window.location.hostname === 'localhost' ? 'localhost' : '192.168.0.102');
  }, []);

  if (!host) return null;

  return <Script src={`http://${host}:8097`} strategy="lazyOnload" />;
}
