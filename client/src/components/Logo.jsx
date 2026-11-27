// ZiiShe brand monogram — interlocking Z + H with a flowing ribbon and sparkles.
// Drawn with currentColor so it can sit on maroon surfaces or cream ones.
export default function Logo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="currentColor"
      role="img"
      aria-label="ZiiShe"
      focusable="false"
      className={className ? `brand-mark ${className}` : 'brand-mark'}
    >
      <defs>
        <mask
          id="ziishe-ribbon-gap"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="120"
          height="120"
        >
          <rect width="120" height="120" fill="#fff" />
          <path
            d="M2 88C24 88 42 76 60 66S96 50 118 58"
            fill="none"
            stroke="#000"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </mask>
      </defs>

      {/* Monogram letters, interrupted by the ribbon gap */}
      <g
        mask="url(#ziishe-ribbon-gap)"
        fontFamily="'ZiiShe Mark', 'Cormorant Garamond', 'Times New Roman', Georgia, serif"
        fontWeight="500"
      >
        <text x="4" y="80" fontSize="68" letterSpacing="-1.5">Z</text>
        <text x="48" y="86" fontSize="78">H</text>
      </g>

      {/* Ribbon */}
      <path
        d="M2 88C24 88 42 76 60 66S96 50 118 58"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Sparkles */}
      <path d="M67 19c.8 4.6 2.9 6.7 7.4 7.5-4.5.8-6.6 2.9-7.4 7.5-.8-4.6-2.9-6.7-7.4-7.5 4.5-.8 6.6-2.9 7.4-7.5Z" />
      <path d="M67 92c.6 3.2 2 4.6 5.2 5.2-3.2.6-4.6 2-5.2 5.2-.6-3.2-2-4.6-5.2-5.2 3.2-.6 4.6-2 5.2-5.2Z" />
    </svg>
  );
}
