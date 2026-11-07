import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { loadBackend } from './data';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

loadBackend().then(({ store, auth }) => {
  root.render(<App store={store} auth={auth} />);
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
