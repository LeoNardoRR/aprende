import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import { AnimatedFavicon } from '../components/animated-favicon';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(
  <>
    <AnimatedFavicon />
    <Home />
  </>,
);
