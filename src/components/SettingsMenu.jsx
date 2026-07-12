// Permanent settings cog, top-right. Barely visible until hovered; hovering
// reveals a clear dropdown with timer controls and display toggles.
export default function SettingsMenu({
  timerSeconds,
  timerActive,
  onToggleTimer,
  onAdjustTimer,
  revealAll,
  onToggleRevealAll,
  scaffoldAll,
  onToggleScaffoldAll,
  onExit,
}) {
  const mm = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const ss = String(timerSeconds % 60).padStart(2, '0');

  return (
    <div className="group fixed top-0 right-0 z-20 pt-3 pr-4 pb-2 pl-2">
      {/* Cog — always present, unobtrusive until hovered */}
      <div className="flex justify-end">
        <span
          className="text-2xl leading-none text-gray-200 group-hover:text-gray-500 group-hover:rotate-45 transition-all duration-200 cursor-pointer select-none"
          title="Settings"
        >
          ⚙
        </span>
      </div>

      {/* Dropdown */}
      <div className="absolute right-3 top-full -mt-1 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 flex flex-col gap-0.5">
        {/* Timer row */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">Timer</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onAdjustTimer(-60)}
              title="1 minute less"
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold leading-none flex items-center justify-center"
            >
              −
            </button>
            <span className="font-mono text-base font-semibold text-gray-800 tabular-nums w-14 text-center">
              {mm}:{ss}
            </span>
            <button
              onClick={() => onAdjustTimer(60)}
              title="1 minute more"
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold leading-none flex items-center justify-center"
            >
              +
            </button>
            <button
              onClick={onToggleTimer}
              title={timerActive ? 'Pause timer' : 'Start timer'}
              className={`w-8 h-7 rounded-lg flex items-center justify-center text-sm transition-colors ${
                timerActive ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              {timerActive ? '⏸' : '▶'}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 mx-2" />

        {/* Show/hide all answers */}
        <button
          onClick={onToggleRevealAll}
          className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left"
        >
          <span className="text-sm font-semibold text-gray-700">
            {revealAll ? 'Hide all answers' : 'Show all answers'}
          </span>
          <span className={`w-9 h-5 rounded-full relative transition-colors ${revealAll ? 'bg-green-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${revealAll ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </button>

        {/* Show/hide all scaffolds */}
        <button
          onClick={onToggleScaffoldAll}
          className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left"
        >
          <span className="text-sm font-semibold text-gray-700">
            {scaffoldAll ? 'Hide scaffolds' : 'Show all scaffolds'}
          </span>
          <span className={`w-9 h-5 rounded-full relative transition-colors ${scaffoldAll ? 'bg-blue-500' : 'bg-gray-200'}`}>
            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${scaffoldAll ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </button>

        <div className="border-t border-gray-100 mx-2" />

        {/* Exit */}
        <button
          onClick={onExit}
          className="px-3 py-2.5 rounded-xl hover:bg-red-50 text-left text-sm font-semibold text-red-500"
        >
          End session ×
        </button>
      </div>
    </div>
  );
}
