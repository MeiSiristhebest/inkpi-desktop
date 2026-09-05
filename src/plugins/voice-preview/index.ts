import type { DesktopPlugin } from '../../types/plugin'
import { Volume2 } from 'lucide-react'
import { VoicePreviewMasterView } from './components/VoicePreviewMasterView'
import { VoicePreviewDrawer } from './components/VoicePreviewDrawer'

export const VoicePreviewPlugin: DesktopPlugin = {
  id: 'voice-preview',
  name: '角色拟真有声对白试听器',
  description:
    '多角色广播剧级语音试听、音色自适应与章节台本智能编排（依赖本地 Web Speech / 系统中文 TTS 语音包）',
  version: '1.0.0',
  author: 'InkPi Core Team',
  category: 'flow',
  tags: ['有声试听', '广播剧', '角色声线', '对白质检', '系统TTS依赖'],
  enabledByDefault: false, // 依赖本地系统中文TTS环境，默认按需开启
  icon: Volume2,
  mainView: VoicePreviewMasterView,
  drawerSnippetView: VoicePreviewDrawer,
}

export * from './types'
export * from './engine/VoicePreviewEngine'
export * from './components/VoicePreviewMasterView'
export * from './components/VoicePreviewDrawer'
