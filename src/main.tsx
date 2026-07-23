import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { startSkillGapSync } from './lib/skillGapSync.ts'
// Last import on purpose: the mobile layer overrides rules it ties with on
// specificity, so it has to land after every stylesheet the tree above pulls in.
import './responsive.css'

// Only installs a callback; nothing is sent until matching actually meets a
// skill the taxonomy cannot place.
startSkillGapSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
