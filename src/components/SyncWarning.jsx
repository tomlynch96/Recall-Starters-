import { useEffect, useState } from 'react';

// Shown when a save to the server fails, so lost changes are noticed straight
// away rather than on the next login. Usually means the Firestore rules for a
// new feature haven't been published yet.
export default function SyncWarning() {
  const [code, setCode] = useState(null);

  useEffect(() => {
    const onError = e => setCode(c => c || e.detail?.code || 'unknown');
    window.addEventListener('rs-write-error', onError);
    return () => window.removeEventListener('rs-write-error', onError);
  }, []);

  if (!code) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-xl w-[calc(100%-2rem)] bg-red-600 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-start gap-3">
      <span className="text-xl leading-none">⚠</span>
      <div className="flex-1 text-sm">
        <p className="font-semibold">Changes aren't saving to the server</p>
        <p className="opacity-90 mt-0.5">
          {code === 'permission-denied'
            ? 'The database is refusing the save. Your HoD needs to publish the latest Firestore rules.'
            : `The save failed (${code}). Check your connection.`}{' '}
          Your work is kept on this device for now and will be re-sent when you next sign in.
        </p>
      </div>
      <button onClick={() => setCode(null)} className="text-white/80 hover:text-white text-xl leading-none" title="Dismiss">×</button>
    </div>
  );
}
