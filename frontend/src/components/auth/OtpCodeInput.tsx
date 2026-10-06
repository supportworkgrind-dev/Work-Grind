'use client';

import { useRef } from 'react';

interface OtpCodeInputProps {
  code: string;
  onChange: (code: string) => void;
  label?: string;
  disabled?: boolean;
}

export function OtpCodeInput({ code, onChange, label = 'Verification code', disabled = false }: OtpCodeInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const replaceCode = (value: string, focusEnd = true) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    onChange(digits);
    if (focusEnd && digits) inputs.current[Math.min(digits.length, 6) - 1]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length > 1) {
      replaceCode(digits);
      return;
    }
    const next = code.split('');
    if (digits) {
      next[index] = digits;
      onChange(next.join('').slice(0, 6));
      if (index < 5) inputs.current[index + 1]?.focus();
    } else {
      next[index] = '';
      onChange(next.join('').slice(0, 6));
    }
  };

  return (
    <div
      className="auth-otp"
      role="group"
      aria-label={label}
      onPaste={(event) => {
        const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (!pasted) return;
        event.preventDefault();
        replaceCode(pasted);
      }}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <input
          key={index}
          ref={(node) => { inputs.current[index] = node; }}
          aria-label={`${label}, digit ${index + 1} of 6`}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          autoFocus={index === 0}
          disabled={disabled}
          value={code[index] || ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !code[index] && index > 0) inputs.current[index - 1]?.focus();
            if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
            if (event.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
