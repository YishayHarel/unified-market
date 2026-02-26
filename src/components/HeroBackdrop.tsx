/**
 * Hero backdrop: diagonal red→green line (bottom-left to top-right),
 * large fierce bull (left) and bear (right) with heads meeting at center.
 */
export default function HeroBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden
    >
      {/* Single diagonal line: bottom-left to top-right, red to green */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id="diagonalRedToGreen"
            x1="0%"
            y1="100%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="hsl(0 75% 45%)" />
            <stop offset="50%" stopColor="hsl(30 60% 40%)" />
            <stop offset="100%" stopColor="hsl(140 70% 40%)" />
          </linearGradient>
        </defs>
        <line
          x1="0"
          y1="100"
          x2="100"
          y2="0"
          stroke="url(#diagonalRedToGreen)"
          strokeWidth="0.8"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>

      {/* Bull – large, left side, head toward center (right edge of this SVG) */}
      <svg
        className="absolute bottom-0 left-0 w-[58vw] max-w-[520px] h-[38vw] max-h-[340px] opacity-[0.28]"
        style={{ minHeight: 220 }}
        viewBox="0 0 220 160"
        fill="none"
      >
        <g stroke="hsl(0 0% 8%)" strokeWidth="1.1" fill="hsl(0 0% 10%)">
          {/* Hind legs – realistic stance */}
          <path d="M 58 108 L 52 142 L 62 142 L 68 108 Z" />
          <path d="M 72 105 L 66 140 L 76 140 L 80 105 Z" />
          {/* Rump and back */}
          <path d="M 55 100 Q 50 88 58 78 Q 85 52 115 55 Q 145 60 165 72 Q 178 82 175 95 L 168 100 L 62 100 Z" />
          {/* Chest and shoulder – rounded muscle */}
          <path d="M 155 72 Q 165 62 172 68 Q 178 78 172 88 L 165 92 Q 158 85 155 78 Z" />
          {/* Front legs */}
          <path d="M 168 92 L 162 128 L 172 128 L 178 92 Z" />
          <path d="M 178 90 L 172 124 L 182 124 L 186 90 Z" />
          {/* Neck – thick, muscular */}
          <path d="M 172 72 Q 182 55 192 48 Q 200 44 208 48 L 212 55 Q 208 68 198 78 Q 185 88 172 88 Z" />
          {/* Head – lowered, aggressive, facing right (center) */}
          <path d="M 208 48 Q 218 38 225 42 Q 232 50 228 62 Q 224 72 216 76 L 208 72 Q 212 58 208 48 Z" />
          {/* Horns – curved, threatening */}
          <path d="M 222 42 Q 232 28 242 34 Q 246 40 242 46 Q 236 50 228 44" strokeWidth="2.8" fill="none" />
          <path d="M 224 46 Q 232 38 238 42 Q 242 48 236 54 Q 230 56 224 50" strokeWidth="2.2" fill="none" />
          {/* Ear */}
          <path d="M 218 44 Q 222 38 226 42 L 224 48 Q 220 46 218 44 Z" />
          {/* Eye – detailed with highlight */}
          <path d="M 218 56 Q 222 54 225 56 Q 223 60 218 58 Z" fill="hsl(0 0% 6%)" strokeWidth="0.6" />
          <circle cx="220" cy="57" r="1.2" fill="hsl(0 0% 75%)" />
          {/* Nostril */}
          <path d="M 204 62 L 208 65 L 204 68 Z" />
          {/* Mouth / jaw line */}
          <path d="M 202 66 Q 206 72 204 76 L 200 72 Q 201 68 202 66 Z" />
          {/* Tail – long with tuft */}
          <path d="M 52 82 Q 28 72 18 82 Q 12 92 22 98 Q 35 96 52 88" strokeWidth="2" fill="none" />
          <path d="M 18 82 Q 10 88 14 96 Q 18 92 22 88" fill="hsl(0 0% 10%)" />
        </g>
      </svg>

      {/* Bear – large, right side, head toward center (left edge of this SVG) */}
      <svg
        className="absolute bottom-0 right-0 w-[58vw] max-w-[520px] h-[38vw] max-h-[340px] opacity-[0.28]"
        style={{ minHeight: 220 }}
        viewBox="0 0 220 160"
        fill="none"
      >
        <g stroke="hsl(0 0% 8%)" strokeWidth="1.1" fill="hsl(0 0% 10%)">
          {/* Hind legs */}
          <path d="M 162 108 L 156 142 L 166 142 L 172 108 Z" />
          <path d="M 148 105 L 142 140 L 152 140 L 158 105 Z" />
          {/* Body – bulky, rounded */}
          <path d="M 165 100 L 158 105 L 62 100 L 68 95 Q 78 78 92 72 Q 118 65 148 72 Q 168 82 172 95 Z" />
          {/* Shoulder hump */}
          <path d="M 92 72 Q 82 58 88 48 Q 95 42 108 48 Q 118 58 115 72 Q 108 82 95 82 Z" />
          {/* Front legs / paws */}
          <path d="M 88 88 L 80 128 L 94 128 L 102 88 Z" />
          <path d="M 78 86 L 70 122 L 80 122 L 86 86 Z" />
          {/* Paw toes */}
          <path d="M 80 128 L 78 132 M 86 128 L 84 132 M 92 128 L 90 132 M 98 128 L 96 132" strokeWidth="1" />
          {/* Neck */}
          <path d="M 72 72 Q 58 62 48 52 Q 40 44 32 38 L 28 42 Q 35 52 42 62 Q 52 75 65 82 Z" />
          {/* Head – rounded, ears */}
          <path d="M 32 38 Q 22 28 24 16 Q 28 8 38 14 Q 48 22 46 34 Q 42 42 35 46 Z" />
          <path d="M 38 18 Q 34 10 40 6 Q 46 10 44 20 Z" />
          <path d="M 26 24 Q 20 18 24 12 Q 28 16 28 24 Z" />
          {/* Snout */}
          <path d="M 42 38 Q 34 42 28 38 Q 24 34 30 32 Q 38 34 42 38 Z" />
          {/* Eye – detailed with highlight */}
          <path d="M 38 28 Q 42 26 45 28 Q 43 32 38 30 Z" fill="hsl(0 0% 6%)" strokeWidth="0.6" />
          <circle cx="40" cy="29" r="1.2" fill="hsl(0 0% 75%)" />
          {/* Mouth */}
          <path d="M 28 36 L 32 40 L 28 44 Z" />
          {/* Short tail */}
          <path d="M 62 88 Q 55 92 52 88 Q 54 84 60 86 Z" />
        </g>
      </svg>
    </div>
  );
}
