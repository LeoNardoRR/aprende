import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import { AnimatedFavicon } from '../components/animated-favicon';
import '../app/globals.css';
import '../app/phase3-finalization.css';
import '../app/phase12-finalization.css';
createRoot(document.getElementById('root')!).render(
  <>
    <AnimatedFavicon />
    <Home />
  </>,
);
