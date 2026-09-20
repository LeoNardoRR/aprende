import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import { AnimatedFavicon } from '../components/animated-favicon';
import '../app/globals.css';
import '../app/design-tokens.css';
import '../app/phase3-finalization.css';
import '../app/phase12-finalization.css';
import '../app/phase4-runtime.css';
import '../app/phase7-pedagogy.css';
createRoot(document.getElementById('root')!).render(
  <>
    <AnimatedFavicon />
    <Home />
  </>,
);
