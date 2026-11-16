/**
 * @file main.tsx
 * @responsibility Ponto de entrada do cliente React para o QTA-NC Studio.
 * @version 1.0.0
 * @date 2026-11-15
 * @directory /src/main.tsx
 * @signature PO Zeh Sobrinho & Senior Agile DevOps Team (AI Framework)
 */

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
