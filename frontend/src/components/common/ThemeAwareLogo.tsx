import React from 'react';
import { WorkGrindLogo, type LogoSize } from '@/components/common/WorkGrindLogo';

interface ThemeAwareLogoProps {
  size?: LogoSize;
  showWordmark?: boolean;
  className?: string;
  surface?: 'auto' | 'light' | 'dark';
}

export function ThemeAwareLogo({
  size = 'md',
  showWordmark = true,
  className = '',
  surface = 'auto',
}: ThemeAwareLogoProps) {
  return (
    <WorkGrindLogo
      size={size}
      showWordmark={showWordmark}
      className={className}
      theme={surface}
    />
  );
}

export default ThemeAwareLogo;
