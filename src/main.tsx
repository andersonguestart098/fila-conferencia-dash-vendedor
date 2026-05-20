// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import './index.css'
import App from './App.tsx'
import PedidosSomenteLista from './pages/PedidosSomenteLista'
import HistoricoConferencia from './pages/HistoricoConferencia'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/lista" element={<PedidosSomenteLista />} />
        <Route path="/historico" element={<HistoricoConferencia />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
