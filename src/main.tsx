import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
// Last import on purpose: the mobile layer overrides rules it ties with on
// specificity, so it has to land after every stylesheet the tree above pulls in.
import './responsive.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
