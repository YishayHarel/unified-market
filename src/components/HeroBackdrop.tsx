/**
 * Hero backdrop matching reference: red/green split, glowing green chart line
 * with arrow, scattered candlesticks, bear (red/orange, glowing red eye) and
 * bull (green tint, glowing green eye, light horns) face to face.
 */
export default function HeroBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden
    >
      {/* Scattered candlestick/bar charts – red on left, green on right */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
      >
        {/* Red bars left half */}
        {[
          [20, 85, 3, 18], [35, 78, 2, 25], [48, 82, 2, 15], [55, 70, 3, 22],
          [68, 75, 2, 20], [82, 65, 3, 28], [95, 72, 2, 18], [108, 58, 3, 25],
          [125, 68, 2, 22], [138, 55, 3, 30], [152, 62, 2, 20],
        ].map(([x, y, w, h], i) => (
          <rect key={`r-${i}`} x={x} y={y} width={w} height={h} fill="hsl(0 70% 45% / 0.5)" />
        ))}
        {/* Green bars right half */}
        {[
          [210, 72, 2, 22], [225, 65, 3, 28], [238, 70, 2, 25], [252, 58, 3, 30],
          [265, 62, 2, 25], [278, 50, 3, 35], [292, 55, 2, 28], [305, 42, 3, 38],
          [318, 48, 2, 30], [332, 38, 3, 42], [348, 45, 2, 32], [362, 35, 3, 40],
        ].map(([x, y, w, h], i) => (
          <rect key={`g-${i}`} x={x} y={y} width={w} height={h} fill="hsl(140 70% 45% / 0.5)" />
        ))}
      </svg>

      {/* Glowing green trend line (bottom-left to top-right) with minor dips + arrow */}
      <svg
        className="absolute inset-0 w-full h-full drop-shadow-[0 0 8px hsl(140_100%_50%_/_.6)]"
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M 0 98 L 22 84 L 30 90 L 48 72 L 56 78 L 72 58 L 80 65 L 98 48 L 106 54
             L 128 35 L 136 42 L 158 22 L 166 30 L 188 14 L 196 22 L 218 8 L 226 16
             L 248 4 L 256 12 L 278 2 L 286 10 L 308 0 L 316 8 L 338 2 L 346 10 L 368 4 L 376 12 L 392 6"
          fill="none"
          stroke="hsl(140 100% 50%)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#lineGlow)"
        />
        {/* Upward arrow at end of line */}
        <polygon
          points="392,6 384,2 384,10"
          fill="hsl(140 100% 50%)"
          filter="url(#lineGlow)"
        />
      </svg>

      {/* Bear – LEFT, side profile facing right, red/orange tint, glowing red eye, open mouth */}
      <svg
        className="absolute bottom-0 left-0 w-[55vw] max-w-[520px] h-[42vw] max-h-[380px]"
        style={{ minHeight: 260 }}
        viewBox="0 0 240 180"
        fill="none"
      >
        <defs>
          <linearGradient id="bearGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(15 65% 28%)" />
            <stop offset="100%" stopColor="hsl(8 70% 38%)" />
          </linearGradient>
          <filter id="bearEyeGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g stroke="hsl(0 0% 8%)" strokeWidth="1" fill="url(#bearGrad)">
          <path d="M 12 95 Q 8 92 10 88 Q 14 90 16 94 Z" />
          <path d="M 28 98 L 22 138 L 34 138 L 38 98 Z" />
          <path d="M 42 96 L 36 136 L 48 136 L 52 96 Z" />
          <path d="M 18 92 Q 14 82 22 72 Q 45 48 75 52 Q 105 58 125 72 Q 138 82 135 92 L 128 96 L 22 96 Z" />
          <path d="M 78 52 Q 68 38 75 28 Q 82 22 92 28 Q 100 38 98 52 Q 92 62 82 60 Z" />
          <path d="M 92 72 L 86 118 L 98 118 L 102 72 Z" />
          <path d="M 105 70 L 98 112 L 110 112 L 114 70 Z" />
          <path d="M 86 118 L 84 122 M 92 118 L 90 122 M 98 118 L 96 122" strokeWidth="0.8" />
          <path d="M 118 72 Q 108 58 112 42 Q 116 32 124 36 L 128 44 Q 126 56 120 66 Z" />
          <path d="M 124 36 Q 132 24 142 28 Q 152 36 148 50 Q 142 60 132 62 L 122 56 Q 120 44 124 36 Z" />
          <path d="M 140 30 Q 146 24 150 28 L 148 34 Q 144 32 140 30 Z" />
          {/* Glowing red eye */}
          <circle cx="134" cy="43" r="4" fill="hsl(0 90% 55%)" filter="url(#bearEyeGlow)" opacity="0.95" />
          <path d="M 132 42 Q 136 40 139 42 Q 137 46 132 44 Z" fill="hsl(0 0% 4%)" strokeWidth="0.5" />
          <path d="M 122 52 Q 114 56 110 52 Q 108 48 114 46 Q 120 48 122 52 Z" />
          <path d="M 110 52 L 108 56 L 112 56 Z" />
          {/* Open mouth / roar with teeth */}
          <path d="M 108 54 L 118 62 L 108 70 L 112 62 Z" fill="hsl(0 0% 98%)" strokeWidth="0.4" />
          <path d="M 114 58 L 116 66 M 118 56 L 120 64" stroke="hsl(0 0% 70%)" strokeWidth="0.5" />
        </g>
      </svg>

      {/* Bull – RIGHT, side profile facing left, green tint, glowing green eye, light horns */}
      <svg
        className="absolute bottom-0 right-0 w-[55vw] max-w-[520px] h-[42vw] max-h-[380px]"
        style={{ minHeight: 260 }}
        viewBox="0 0 240 180"
        fill="none"
      >
        <defs>
          <linearGradient id="bullGrad" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="hsl(140 50% 26%)" />
            <stop offset="100%" stopColor="hsl(140 55% 36%)" />
          </linearGradient>
          <filter id="bullEyeGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g stroke="hsl(0 0% 8%)" strokeWidth="1" fill="url(#bullGrad)">
          <path d="M 228 88 Q 235 82 232 76 Q 228 78 226 84 Q 224 90 228 92 Z" />
          <path d="M 232 76 Q 238 72 240 78 Q 236 84 230 86" strokeWidth="1.2" fill="none" />
          <path d="M 212 98 L 206 138 L 218 138 L 222 98 Z" />
          <path d="M 198 96 L 192 136 L 204 136 L 208 96 Z" />
          <path d="M 222 92 Q 218 82 210 72 Q 185 48 155 52 Q 125 58 105 72 Q 92 82 95 92 L 112 96 L 218 96 Z" />
          <path d="M 122 72 Q 112 62 118 48 Q 125 42 135 48 Q 142 58 138 72 Q 132 82 122 80 Z" />
          <path d="M 128 92 L 122 128 L 134 128 L 138 92 Z" />
          <path d="M 115 90 L 108 126 L 120 126 L 124 90 Z" />
          <path d="M 102 72 Q 92 58 88 42 Q 84 32 92 36 L 96 44 Q 98 56 102 66 Z" />
          <path d="M 92 36 Q 84 24 76 28 Q 68 36 72 50 Q 78 60 88 62 L 98 56 Q 96 44 92 36 Z" />
          {/* Light-colored horns */}
          <path d="M 76 32 Q 66 20 58 26 Q 54 32 60 38 Q 68 42 76 36" strokeWidth="2.2" stroke="hsl(45 25% 72%)" fill="none" />
          <path d="M 72 38 Q 64 30 58 34 Q 54 40 62 44" strokeWidth="1.8" stroke="hsl(45 25% 72%)" fill="none" />
          <path d="M 82 32 Q 78 26 74 30 L 76 36 Q 80 34 82 32 Z" />
          {/* Glowing green eye */}
          <circle cx="86" cy="45" r="4" fill="hsl(140 90% 55%)" filter="url(#bullEyeGlow)" opacity="0.95" />
          <path d="M 84 44 Q 88 42 91 44 Q 89 48 84 46 Z" fill="hsl(0 0% 4%)" strokeWidth="0.5" />
          <path d="M 98 52 L 102 55 L 98 58 Z" />
          <path d="M 96 56 Q 100 62 98 66 L 94 62 Q 95 58 96 56 Z" />
        </g>
      </svg>
    </div>
  );
}
