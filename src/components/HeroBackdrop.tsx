/**
 * Hero backdrop: left half red, right half green.
 * Bear (left) and bull (right), side profiles, face to face.
 * One upward trend line with minor dips (stock chart).
 */
export default function HeroBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none z-0"
      aria-hidden
    >
      {/* Upward trend line with minor dips – spans the split */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="trendLineGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(0 70% 45%)" />
            <stop offset="100%" stopColor="hsl(140 70% 42%)" />
          </linearGradient>
        </defs>
        <path
          d="M 0 95
             L 25 82 L 35 88 L 50 68 L 58 74 L 75 52 L 82 60 L 100 42 L 108 50
             L 130 28 L 138 36 L 160 18 L 168 26 L 190 12 L 198 22 L 220 8 L 228 18
             L 250 5 L 258 14 L 280 2 L 288 10 L 310 0 L 318 8 L 340 2 L 348 12
             L 370 5 L 378 14 L 400 8"
          fill="none"
          stroke="url(#trendLineGradient)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </svg>

      {/* Bear – LEFT side, side profile facing RIGHT (we see his left side), staring at bull */}
      <svg
        className="absolute bottom-0 left-0 w-[50vw] max-w-[480px] h-[40vw] max-h-[360px] opacity-[0.3]"
        style={{ minHeight: 240 }}
        viewBox="0 0 240 180"
        fill="none"
      >
        <g stroke="hsl(0 0% 6%)" strokeWidth="1" fill="hsl(0 0% 12%)">
          {/* Tail – short, left side */}
          <path d="M 12 95 Q 8 92 10 88 Q 14 90 16 94 Z" />
          {/* Hind legs – side profile */}
          <path d="M 28 98 L 22 138 L 34 138 L 38 98 Z" />
          <path d="M 42 96 L 36 136 L 48 136 L 52 96 Z" />
          {/* Rump and back */}
          <path d="M 18 92 Q 14 82 22 72 Q 45 48 75 52 Q 105 58 125 72 Q 138 82 135 92 L 128 96 L 22 96 Z" />
          {/* Shoulder hump – rounded */}
          <path d="M 78 52 Q 68 38 75 28 Q 82 22 92 28 Q 100 38 98 52 Q 92 62 82 60 Z" />
          {/* Front legs / paws */}
          <path d="M 92 72 L 86 118 L 98 118 L 102 72 Z" />
          <path d="M 105 70 L 98 112 L 110 112 L 114 70 Z" />
          <path d="M 86 118 L 84 122 M 92 118 L 90 122 M 98 118 L 96 122" strokeWidth="0.8" />
          {/* Neck – thick */}
          <path d="M 118 72 Q 108 58 112 42 Q 116 32 124 36 L 128 44 Q 126 56 120 66 Z" />
          {/* Head – side profile, facing right */}
          <path d="M 124 36 Q 132 24 142 28 Q 152 36 148 50 Q 142 60 132 62 L 122 56 Q 120 44 124 36 Z" />
          {/* Ear */}
          <path d="M 140 30 Q 146 24 150 28 L 148 34 Q 144 32 140 30 Z" />
          {/* Eye – side view with highlight */}
          <path d="M 132 42 Q 136 40 139 42 Q 137 46 132 44 Z" fill="hsl(0 0% 4%)" strokeWidth="0.5" />
          <circle cx="134" cy="43" r="1" fill="hsl(0 0% 70%)" />
          {/* Snout and nose */}
          <path d="M 122 52 Q 114 56 110 52 Q 108 48 114 46 Q 120 48 122 52 Z" />
          <path d="M 110 52 L 108 56 L 112 56 Z" />
          {/* Mouth line */}
          <path d="M 112 54 Q 116 58 114 62 L 110 58 Z" />
        </g>
      </svg>

      {/* Bull – RIGHT side, side profile facing LEFT (we see his left side), staring at bear */}
      <svg
        className="absolute bottom-0 right-0 w-[50vw] max-w-[480px] h-[40vw] max-h-[360px] opacity-[0.3]"
        style={{ minHeight: 240 }}
        viewBox="0 0 240 180"
        fill="none"
      >
        <g stroke="hsl(0 0% 6%)" strokeWidth="1" fill="hsl(0 0% 12%)">
          {/* Tail – long, right side, with tuft */}
          <path d="M 228 88 Q 235 82 232 76 Q 228 78 226 84 Q 224 90 228 92 Z" />
          <path d="M 232 76 Q 238 72 240 78 Q 236 84 230 86" strokeWidth="1.2" fill="none" />
          {/* Hind legs – side profile */}
          <path d="M 212 98 L 206 138 L 218 138 L 222 98 Z" />
          <path d="M 198 96 L 192 136 L 204 136 L 208 96 Z" />
          {/* Rump and back */}
          <path d="M 222 92 Q 218 82 210 72 Q 185 48 155 52 Q 125 58 105 72 Q 92 82 95 92 L 112 96 L 218 96 Z" />
          {/* Chest and shoulder – muscular */}
          <path d="M 122 72 Q 112 62 118 48 Q 125 42 135 48 Q 142 58 138 72 Q 132 82 122 80 Z" />
          {/* Front legs */}
          <path d="M 128 92 L 122 128 L 134 128 L 138 92 Z" />
          <path d="M 115 90 L 108 126 L 120 126 L 124 90 Z" />
          {/* Neck – thick, muscular */}
          <path d="M 102 72 Q 92 58 88 42 Q 84 32 92 36 L 96 44 Q 98 56 102 66 Z" />
          {/* Head – side profile, facing left */}
          <path d="M 92 36 Q 84 24 76 28 Q 68 36 72 50 Q 78 60 88 62 L 98 56 Q 96 44 92 36 Z" />
          {/* Horns – curved, side view */}
          <path d="M 76 32 Q 66 20 58 26 Q 54 32 60 38 Q 68 42 76 36" strokeWidth="2.2" fill="none" />
          <path d="M 72 38 Q 64 30 58 34 Q 54 40 62 44" strokeWidth="1.8" fill="none" />
          {/* Ear */}
          <path d="M 82 32 Q 78 26 74 30 L 76 36 Q 80 34 82 32 Z" />
          {/* Eye – side view with highlight */}
          <path d="M 84 44 Q 88 42 91 44 Q 89 48 84 46 Z" fill="hsl(0 0% 4%)" strokeWidth="0.5" />
          <circle cx="86" cy="45" r="1" fill="hsl(0 0% 70%)" />
          {/* Nostril */}
          <path d="M 98 52 L 102 55 L 98 58 Z" />
          {/* Mouth / jaw */}
          <path d="M 96 56 Q 100 62 98 66 L 94 62 Q 95 58 96 56 Z" />
        </g>
      </svg>
    </div>
  );
}
