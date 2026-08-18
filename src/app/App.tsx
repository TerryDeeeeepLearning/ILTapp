import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from '@/features/home/Dashboard';
import { SetupPage } from '@/features/dictation/SetupPage';
import { SessionPage } from '@/features/dictation/SessionPage';
import { ResultPage } from '@/features/dictation/ResultPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ReviewPage } from '@/features/review/ReviewPage';
import { useSettings } from '@/store/useSettings';
import { requestPersistence } from '@/core/db/db';
import { hydrateAudioPack } from '@/content/seed/dictation';

export default function App() {
  const hydrate = useSettings(s => s.hydrate);
  const hydrated = useSettings(s => s.hydrated);

  useEffect(() => {
    void hydrate();
    void requestPersistence();
    void hydrateAudioPack();
  }, [hydrate]);

  if (!hydrated) return <div className="p-8 text-muted">載入中…</div>;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/practice/dictation" element={<SetupPage />} />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/session/result" element={<ResultPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
