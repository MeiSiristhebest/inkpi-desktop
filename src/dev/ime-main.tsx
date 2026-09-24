import { createRoot } from 'react-dom/client'
import 'lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css'
import '../index.css'
import ImeHarness from './ImeHarness'

createRoot(document.getElementById('root')!).render(<ImeHarness />)
