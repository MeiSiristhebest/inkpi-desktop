import type { FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { GoldChaptersEngine } from '../engine/GoldChaptersEngine'
import { Award } from 'lucide-react'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { GoldChaptersEvidence } from './GoldChaptersEvidence'

export const GoldChaptersDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const res = GoldChaptersEngine.evaluate(currentText)

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-amber-500">
          <Award className="w-4 h-4" /> 黄金三章文本规则检查
        </span>
      </div>

      <ScoreProvenanceBadge
        source="rule"
        detail="仅定位所传正文中的词项；不读取真实平台或读者数据"
      />

      <GoldChaptersEvidence snapshot={res} />
    </div>
  )
}
