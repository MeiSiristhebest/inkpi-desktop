import type { FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { ShadowReaderEngine } from '../engine/ShadowReaderEngine'
import { MessageSquare } from 'lucide-react'

export const ShadowReaderDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const sim = ShadowReaderEngine.simulate(currentText || '', 'drawer_ch')

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-500">
          <MessageSquare className="w-4 h-4" /> 读者视角问题
        </span>
        <span className="text-slate-500">原文复核</span>
      </div>

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-2">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">原文问题数:</span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {sim.danmakus.length} 条
          </span>
        </div>
        <p className="text-[10px] text-slate-500">
          词项不证明否定句、转述或假设中的事件发生，也不能证明安全或读者情绪。
        </p>
      </div>
    </div>
  )
}
