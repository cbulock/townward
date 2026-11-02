import { createStore, Provider } from 'jotai';
import { createRoot } from 'react-dom/client';
import { App } from '../app/App';
import { authDialogAtom, authProvidersAtom } from '../app/atoms';
import '../styles/tokens.css';
import '../styles/app.css';

/** Dev only: the start screen with the account dialog open. `?mode=login|signup`, `&github=1` shows the GitHub button. */
const store = createStore();
const mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login';
store.set(authDialogAtom, mode);
if (new URLSearchParams(location.search).get('github') === '1') {
  // Re-applied after startup, which reads the real server's settings.
  const on = () => store.set(authProvidersAtom, { github: true });
  on();
  setTimeout(on, 1500);
}

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <App />
  </Provider>,
);
