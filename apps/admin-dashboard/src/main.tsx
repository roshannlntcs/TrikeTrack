import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import "maplibre-gl/dist/maplibre-gl.css"
import { registerTrikeTrackPwa } from "./pwa.ts"

registerTrikeTrackPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
