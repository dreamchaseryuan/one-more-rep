import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installAudioUnlock } from './lib/alert';
import './styles.css';

// iOS 要求 AudioContext 在手势里解锁。挂在这里，第一次触摸就完成，
// 不必让每个会响的组件自己记得这件事。见 lib/alert.ts
installAudioUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
