import { createRoot } from 'react-dom/client';
import { HeroCity } from '../app/screens/landing/HeroCity';

/** Dev only: mounts the landing diorama for the share-image page (og.html). */
createRoot(document.getElementById('city')!).render(<HeroCity />);
