import { useState, useEffect } from 'react';
import BrainBuddy from './BrainBuddy.jsx';

// Session counts that hit each evolution stage of BrainBuddy, in order
const STAGE_STEPS = [0, 1, 5, 15, 30, 60];

// Loading indicator: the brain buddy grows through its full evolution on loop
export default function BrainLoader({ message = 'Loading…' }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % STAGE_STEPS.length), 650);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Fixed-size box so the page doesn't jump as the brain grows */}
      <div className="w-48 h-48 flex items-center justify-center">
        <BrainBuddy sessions={STAGE_STEPS[step]} />
      </div>
      <p className="text-gray-400 text-lg">{message}</p>
    </div>
  );
}
