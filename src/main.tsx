import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 只引单一字族：包的 style.css 会 @import 全部 4 个字族（GB/R/Screen/ScreenR，共 18.4MB），
// 而 --ink-font-wenkai 只用到 'LXGW WenKai Screen'，这一个字族是 97 个子集 / 4.9MB。
import 'lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css'
import './index.css'
import App from './App.tsx'
import { RootErrorBoundary } from './core/RootErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
