'use client';

interface FoxMascotProps {
  isHiding: boolean;
}

export function FoxMascot({ isHiding }: FoxMascotProps) {
  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: 120, height: 120 }}>
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* ── Body ── */}
        <ellipse cx="60" cy="92" rx="22" ry="16" fill="#E8844A" />
        {/* Belly */}
        <ellipse cx="60" cy="95" rx="13" ry="10" fill="#F5C8A0" />

        {/* ── Head ── */}
        <ellipse cx="60" cy="62" rx="26" ry="24" fill="#E8844A" />

        {/* ── Ears ── */}
        {/* Left ear */}
        <polygon points="38,46 30,22 50,38" fill="#E8844A" />
        <polygon points="39,44 33,26 48,38" fill="#D45A1A" />
        {/* Right ear */}
        <polygon points="82,46 90,22 70,38" fill="#E8844A" />
        <polygon points="81,44 87,26 72,38" fill="#D45A1A" />

        {/* ── Face muzzle ── */}
        <ellipse cx="60" cy="70" rx="14" ry="10" fill="#F5C8A0" />

        {/* ── Nose ── */}
        <ellipse cx="60" cy="69" rx="3.5" ry="2.5" fill="#2D1A0E" />

        {/* ── Mouth ── */}
        <path
          d="M 55 73 Q 60 77 65 73"
          stroke="#2D1A0E"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* ── Eyes — open state ── */}
        {!isHiding && (
          <g
            style={{
              transition: 'opacity 0.25s ease',
              opacity: 1,
            }}
          >
            {/* Left eye white */}
            <ellipse cx="50" cy="58" rx="6" ry="6.5" fill="white" />
            {/* Right eye white */}
            <ellipse cx="70" cy="58" rx="6" ry="6.5" fill="white" />
            {/* Left pupil */}
            <circle cx="50.5" cy="59" r="3.5" fill="#1A0A00" />
            {/* Right pupil */}
            <circle cx="70.5" cy="59" r="3.5" fill="#1A0A00" />
            {/* Left eye shine */}
            <circle cx="52" cy="57" r="1.2" fill="white" />
            {/* Right eye shine */}
            <circle cx="72" cy="57" r="1.2" fill="white" />
            {/* Eyebrows normal */}
            <path d="M 45 51.5 Q 50 49 55 51.5" stroke="#2D1A0E" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M 65 51.5 Q 70 49 75 51.5" stroke="#2D1A0E" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* ── Eyes closed — squint lines (visible while hiding) ── */}
        {isHiding && (
          <g style={{ transition: 'opacity 0.25s ease', opacity: 1 }}>
            <path d="M 45 58 Q 50 54 55 58" stroke="#2D1A0E" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M 65 58 Q 70 54 75 58" stroke="#2D1A0E" strokeWidth="2" strokeLinecap="round" fill="none" />
            {/* Concerned eyebrows */}
            <path d="M 45 52 Q 50 50 55 52" stroke="#2D1A0E" strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M 65 52 Q 70 50 75 52" stroke="#2D1A0E" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </g>
        )}

        {/* ── Tail ── */}
        <path
          d="M 80 100 Q 106 88 100 72 Q 96 62 88 70"
          stroke="#E8844A"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        {/* Tail tip */}
        <circle cx="100" cy="72" r="7" fill="#F5F5F5" />

        {/* ── Arms / Paws ── */}
        {/* Left arm - normal hanging */}
        <g
          style={{
            transformOrigin: '42px 88px',
            transform: isHiding ? 'rotate(-55deg) translateX(-4px) translateY(-8px)' : 'rotate(0deg)',
            transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Left arm */}
          <ellipse cx="40" cy="94" rx="7" ry="10" fill="#E8844A" transform="rotate(-10 40 94)" />
          {/* Left paw */}
          <ellipse cx="37" cy="103" rx="8" ry="6" fill="#D45A1A" transform="rotate(-10 37 103)" />
          {/* Paw toes */}
          <circle cx="32" cy="104" r="2.5" fill="#C44A10" />
          <circle cx="37" cy="107" r="2.5" fill="#C44A10" />
          <circle cx="43" cy="106" r="2.5" fill="#C44A10" />
        </g>

        {/* Right arm - normal hanging */}
        <g
          style={{
            transformOrigin: '78px 88px',
            transform: isHiding ? 'rotate(55deg) translateX(4px) translateY(-8px)' : 'rotate(0deg)',
            transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Right arm */}
          <ellipse cx="80" cy="94" rx="7" ry="10" fill="#E8844A" transform="rotate(10 80 94)" />
          {/* Right paw */}
          <ellipse cx="83" cy="103" rx="8" ry="6" fill="#D45A1A" transform="rotate(10 83 103)" />
          {/* Paw toes */}
          <circle cx="78" cy="106" r="2.5" fill="#C44A10" />
          <circle cx="83" cy="107" r="2.5" fill="#C44A10" />
          <circle cx="88" cy="104" r="2.5" fill="#C44A10" />
        </g>
      </svg>
    </div>
  );
}
