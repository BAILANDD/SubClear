import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import IphonePreviewShell from './components/IphonePreviewShell.tsx'
import { isIphonePreviewSearch } from './components/iphonePreviewConfig.ts'

const isIphonePreview = isIphonePreviewSearch(window.location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isIphonePreview ? <IphonePreviewShell /> : <App />}
  </StrictMode>,
)
