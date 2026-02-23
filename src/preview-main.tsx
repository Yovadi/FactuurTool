import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewWindow } from './components/PreviewWindow';
import './index.css';

createRoot(document.getElementById('preview-root')!).render(
  <StrictMode>
    <PreviewWindow />
  </StrictMode>
);
