import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-700.css';
import './styles/global.css';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';

// Each route is its own chunk: phones never download three.js or the physics engine.
const TvApp = lazy(() => import('./tv/TvApp'));
const PadApp = lazy(() => import('./pad/PadApp'));
const Landing = lazy(() => import('./landing/Landing'));

function Route() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/tv') return <TvApp />;
  if (path === '/pad') return <PadApp />;
  return <Landing />;
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Suspense fallback={null}>
        <Route />
      </Suspense>
    </StrictMode>,
  );
}
