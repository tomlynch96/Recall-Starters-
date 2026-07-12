// A cartoon brain that grows bigger, stronger and happier the more starters
// the teacher runs. Pure inline SVG — no assets.

const STAGES = [
  { min: 0,  size: 88,  label: 'a tiny seedling brain',   mouth: 'M48 76 Q60 78 72 76',                smileStroke: 3, blush: false, arms: false, sparkle: false },
  { min: 1,  size: 104, label: 'waking up',               mouth: 'M48 74 Q60 82 72 74',                smileStroke: 3, blush: false, arms: false, sparkle: false },
  { min: 5,  size: 122, label: 'getting into it',         mouth: 'M46 72 Q60 86 74 72',                smileStroke: 3.5, blush: true, arms: false, sparkle: false },
  { min: 15, size: 140, label: 'growing strong',          mouth: 'M44 70 Q60 90 76 70',                smileStroke: 4, blush: true, arms: true,  sparkle: false },
  { min: 30, size: 158, label: 'seriously buff',          mouth: 'M42 68 Q60 94 78 68',                smileStroke: 4, blush: true, arms: true,  sparkle: true },
  { min: 60, size: 176, label: 'an unstoppable genius',   mouth: 'M40 66 Q60 98 80 66',                smileStroke: 4.5, blush: true, arms: true,  sparkle: true },
];

export function getBrainStage(sessions) {
  let stage = STAGES[0];
  for (const s of STAGES) if (sessions >= s.min) stage = s;
  return stage;
}

export default function BrainBuddy({ sessions = 0 }) {
  const stage = getBrainStage(sessions);
  const happy = stage.min >= 5;

  return (
    <svg
      width={stage.size}
      height={stage.size}
      viewBox="0 0 120 120"
      className="shrink-0 transition-all duration-700"
      role="img"
      aria-label={`Brain buddy — ${stage.label}`}
    >
      {/* Sparkles for top stages */}
      {stage.sparkle && (
        <g fill="#fbbf24">
          <path d="M14 22 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 z" />
          <path d="M102 14 l2 4.5 4.5 2 -4.5 2 -2 4.5 -2 -4.5 -4.5 -2 4.5 -2 z" />
          <path d="M104 78 l1.6 3.8 3.8 1.6 -3.8 1.6 -1.6 3.8 -1.6 -3.8 -3.8 -1.6 3.8 -1.6 z" />
        </g>
      )}

      {/* Flexing arms for strong stages */}
      {stage.arms && (
        <g stroke="#f472b6" strokeWidth="7" strokeLinecap="round" fill="none">
          {/* Left arm flexing up with a bicep bump */}
          <path d="M18 62 Q6 54 10 42" />
          <circle cx="10" cy="40" r="7" fill="#f472b6" stroke="none" />
          {/* Right arm */}
          <path d="M102 62 Q114 54 110 42" />
          <circle cx="110" cy="40" r="7" fill="#f472b6" stroke="none" />
        </g>
      )}

      {/* Brain body — lumpy cloud of overlapping circles */}
      <g fill="#f9a8d4">
        <circle cx="42" cy="34" r="18" />
        <circle cx="62" cy="28" r="17" />
        <circle cx="80" cy="36" r="15" />
        <circle cx="88" cy="52" r="14" />
        <circle cx="84" cy="68" r="15" />
        <circle cx="36" cy="50" r="16" />
        <circle cx="38" cy="68" r="15" />
        <ellipse cx="60" cy="62" rx="32" ry="28" />
      </g>

      {/* Central groove + squiggles */}
      <g stroke="#ec4899" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.55">
        <path d="M60 20 Q57 34 60 44" />
        <path d="M34 36 Q44 38 46 30" />
        <path d="M76 28 Q72 38 82 42" />
        <path d="M28 56 Q38 54 36 62" />
        <path d="M88 56 Q80 58 84 66" />
      </g>

      {/* Face */}
      <g>
        {/* Eyes — dots that get bigger/twinklier as it grows */}
        {happy ? (
          <>
            <circle cx="48" cy="58" r="4.5" fill="#1f2937" />
            <circle cx="72" cy="58" r="4.5" fill="#1f2937" />
            <circle cx="49.5" cy="56.5" r="1.5" fill="white" />
            <circle cx="73.5" cy="56.5" r="1.5" fill="white" />
          </>
        ) : (
          <>
            <circle cx="48" cy="58" r="3.5" fill="#1f2937" />
            <circle cx="72" cy="58" r="3.5" fill="#1f2937" />
          </>
        )}

        {/* Blush */}
        {stage.blush && (
          <>
            <ellipse cx="38" cy="66" rx="5" ry="3" fill="#fb7185" opacity="0.45" />
            <ellipse cx="82" cy="66" rx="5" ry="3" fill="#fb7185" opacity="0.45" />
          </>
        )}

        {/* Mouth — grows into a bigger smile per stage */}
        <path d={stage.mouth} stroke="#1f2937" strokeWidth={stage.smileStroke} strokeLinecap="round" fill="none" />
      </g>
    </svg>
  );
}
