import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initTooltips } from '@jessespencer/bible-ui/tooltip'
import '@fontsource-variable/eb-garamond/wght.css'
import '@fontsource-variable/eb-garamond/wght-italic.css'
import '@fontsource/im-fell-great-primer/400.css'
import '@fontsource/im-fell-great-primer/400-italic.css'
import './styles.css'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

// bible-ui's tips in place of the browser's; their look is in styles.css, in By Heart's paper and ink.
initTooltips()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
