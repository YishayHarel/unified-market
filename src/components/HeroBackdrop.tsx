/**
 * Hero backdrop: chart-line patterns + fierce bull (left) vs bear (right),
 * faded, for the red/green market split.
 */
export default function HeroBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden
    >
      {/* Stock-chart style lines (left = downtrend, right = uptrend) */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 500 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="chartLineRed" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.2)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="chartLineGreen" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.18)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {/* Bearish downtrend line (left side) */}
        <path
          d="M 0 85 Q 8 75 18 82 T 36 68 T 54 78 T 72 62 T 90 72 T 108 58 T 126 68 T 144 52 T 162 62 L 180 55"
          fill="none"
          stroke="url(#chartLineRed)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 0 62 Q 12 72 24 65 T 48 78 T 72 60 T 96 72 T 120 58 T 144 70 L 160 64"
          fill="none"
          stroke="url(#chartLineRed)"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
        {/* Bullish uptrend line (right side) */}
        <path
          d="M 100 90 L 118 78 L 136 85 L 154 72 L 172 82 L 190 68 L 208 78 L 226 65 L 244 76 L 262 62 L 280 74 L 298 68 L 316 78 L 334 72 L 352 82 L 370 75 L 388 85 L 406 78 L 424 88 L 442 80 L 460 90 L 500 82"
          fill="none"
          stroke="url(#chartLineGreen)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 320 95 L 338 88 L 356 94 L 374 86 L 392 92 L 410 85 L 428 92 L 446 86 L 464 94 L 500 88"
          fill="none"
          stroke="url(#chartLineGreen)"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      </svg>

      {/* Bull – left side, facing right, fierce */}
      <svg
        className="absolute bottom-0 left-0 w-[min(42vw,320px)] h-[min(28vw,200px)] opacity-[0.26]"
        viewBox="0 0 200 140"
        fill="none"
      >
        <g stroke="hsl(0 0% 12%)" strokeWidth="1.2" fill="hsl(0 0% 12%)">
          {/* Hind leg */}
          <path d="M 52 95 L 48 118 L 55 118 L 58 95 Z" />
          <path d="M 62 92 L 58 116 L 65 116 L 68 92 Z" />
          {/* Body bulk */}
          <path d="M 50 88 Q 45 82 50 75 Q 75 55 95 58 Q 115 62 125 72 Q 132 80 128 88 L 122 92 L 55 92 Z" />
          {/* Shoulder / chest muscle */}
          <path d="M 98 72 Q 105 68 112 72 Q 118 78 115 86 L 108 88 Q 102 85 98 78 Z" />
          {/* Front legs */}
          <path d="M 108 88 L 105 112 L 112 112 L 116 88 Z" />
          <path d="M 120 86 L 116 110 L 123 110 L 126 86 Z" />
          {/* Neck */}
          <path d="M 125 72 Q 135 58 142 48 Q 148 42 152 38 L 158 42 Q 155 50 152 58 Q 148 68 138 75 Z" />
          {/* Head – lowered, aggressive */}
          <path d="M 152 38 Q 162 28 172 32 Q 178 38 176 48 Q 174 58 168 62 L 162 58 Q 165 48 162 42 Z" />
          {/* Horns */}
          <path d="M 168 36 Q 178 22 188 28 Q 192 34 188 40 Q 182 44 174 38" strokeWidth="2.5" fill="none" />
          <path d="M 170 40 Q 180 32 186 38 Q 190 44 184 50 Q 178 52 172 46" strokeWidth="2" fill="none" />
          {/* Ear */}
          <path d="M 174 34 Q 178 28 182 32 L 180 38 Q 176 36 174 34 Z" />
          {/* Eye */}
          <path d="M 164 46 Q 167 44 170 46 Q 168 50 164 48 Z" fill="hsl(0 0% 18%)" strokeWidth="0.8" />
          {/* Nostril */}
          <path d="M 158 54 L 162 56 L 158 58 Z" />
          {/* Mouth / jaw */}
          <path d="M 156 58 Q 160 62 158 66 L 154 64 Q 155 60 156 58 Z" />
          {/* Tail – tense */}
          <path d="M 48 78 Q 28 70 22 78 Q 20 88 28 92 Q 38 90 48 84" strokeWidth="1.5" fill="none" />
        </g>
      </svg>

      {/* Bear – right side, facing left, fierce */}
      <svg
        className="absolute bottom-0 right-0 w-[min(42vw,320px)] h-[min(28vw,200px)] opacity-[0.26]"
        viewBox="0 0 200 140"
        fill="none"
      >
        <g stroke="hsl(0 0% 12%)" strokeWidth="1.2" fill="hsl(0 0% 12%)">
          {/* Hind legs */}
          <path d="M 148 92 L 144 116 L 152 116 L 156 92 Z" />
          <path d="M 138 90 L 134 114 L 142 114 L 146 90 Z" />
          {/* Body – bulky */}
          <path d="M 72 88 L 68 92 L 75 95 L 78 90 Q 85 75 95 72 Q 115 68 135 72 Q 150 78 152 88 L 148 92 L 78 88 Z" />
          {/* Shoulder hump */}
          <path d="M 95 72 Q 88 62 92 52 Q 98 48 108 52 Q 115 58 112 70 Q 108 78 98 78 Z" />
          {/* Front legs / paws */}
          <path d="M 88 88 L 82 112 L 92 112 L 98 88 Z" />
          <path d="M 78 86 L 72 108 L 80 108 L 84 86 Z" />
          {/* Neck */}
          <path d="M 72 72 Q 62 62 55 52 Q 50 45 48 38 L 42 35 Q 38 42 42 50 Q 48 60 58 68 Z" />
          {/* Head – rounded, ears */}
          <path d="M 48 38 Q 38 28 42 18 Q 48 12 58 18 Q 65 25 62 35 Q 58 42 50 45 Z" />
          <path d="M 52 22 Q 48 12 54 8 Q 60 12 58 22 Z" />
          <path d="M 42 28 Q 36 20 40 14 Q 44 18 44 26 Z" />
          {/* Snout */}
          <path d="M 50 38 Q 42 42 38 38 Q 35 34 40 32 Q 46 34 50 38 Z" />
          {/* Eye */}
          <path d="M 54 28 Q 57 26 60 28 Q 58 32 54 30 Z" fill="hsl(0 0% 18%)" strokeWidth="0.8" />
          {/* Mouth */}
          <path d="M 42 36 L 46 40 L 42 44 Z" />
          {/* Claw suggestion on nearest paw */}
          <path d="M 82 108 L 80 112 M 86 108 L 84 112 M 90 108 L 88 112" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}
