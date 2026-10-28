'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';

type IntentLinkProps = Omit<ComponentProps<typeof Link>, 'prefetch'>;

/**
 * A Link that prefetches only once the user shows intent (pointer hover,
 * touch, or keyboard focus) instead of when it scrolls into view.
 *
 * Every app route renders per request (the CSP nonce makes it dynamic), so a
 * viewport prefetch costs a server render. Navigation lists with many links
 * use this to avoid rendering pages nobody opens.
 */
export function IntentLink({ onMouseEnter, onTouchStart, onFocus, ...props }: IntentLinkProps) {
  const [active, setActive] = useState(false);
  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(event) => { setActive(true); onMouseEnter?.(event); }}
      onTouchStart={(event) => { setActive(true); onTouchStart?.(event); }}
      onFocus={(event) => { setActive(true); onFocus?.(event); }}
    />
  );
}
