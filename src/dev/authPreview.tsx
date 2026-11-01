import { createStore, Provider } from 'jotai';
import { createRoot } from 'react-dom/client';
import { App } from '../app/App';
import { authDialogAtom } from '../app/atoms';
import '../styles/tokens.css';
import '../styles/app.css';

/** Dev only: the start screen with the account dialog open. `?mode=login|signup`. */
const store = createStore();
const mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login';
store.set(authDialogAtom, mode);

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <App />
  </Provider>,
);
