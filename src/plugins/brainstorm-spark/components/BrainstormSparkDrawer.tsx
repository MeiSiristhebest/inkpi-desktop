import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { BrainstormSparkEngine } from '../engine/BrainstormSparkEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import type { SparkSolution } from '../types'
export const BrainstormSparkDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <SparkDrawer key={props.projectId} {...props} />
)
const SparkDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [goal, setGoal] = useState('')
  const [constraints, setConstraints] = useState('')
  const [run, setRun] = useState<{ identity: string; solutions: SparkSolution[] } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const identity = JSON.stringify([projectId, currentText, goal, constraints])
  const solutions = run?.identity === identity ? run.solutions : []
  const generate = () => {
    if (!currentText.trim()) {
      setNotice('当前正文为空，先提供困境文本。')
      return
    }
    setRun({
      identity,
      solutions: BrainstormSparkEngine.generateSolutions({
        dilemmaType: 'dead_end',
        coreProblem: currentText,
        currentSituation: currentText,
        protagonistGoal: goal,
        enemyAdvantage: '',
        constraints: constraints.split('\n').filter(Boolean),
      }),
    })
    setNotice(null)
  }
  return (
    <div className="p-4 space-y-3 text-xs">
      <h3>写作卡文破局炉</h3>
      <p>按当前正文提供可选设计问题；缺少的目标、对方条件与筹码保持未提供。</p>
      <input
        aria-label="当前破局目标"
        placeholder="角色当前目标"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
      />
      <textarea
        aria-label="当前剧情限制"
        placeholder="不能改变的条件，每行一项"
        value={constraints}
        onChange={(e) => setConstraints(e.target.value)}
      />
      <button onClick={generate}>按当前正文推演</button>
      {notice && <p role="status">{notice}</p>}
      {!solutions.length && <p>未推演：补充当前目标与限制后运行。</p>}
      {solutions.slice(0, 3).map((solution) => (
        <article className="border p-2" key={solution.operatorId}>
          <strong>{solution.operatorName}</strong>
          <p>{solution.concretePlot}</p>
          <p>{solution.cons}</p>
          <button
            onClick={() =>
              void clipboardWriter
                .writeText(solution.concretePlot)
                .then(() => setNotice('已复制'))
                .catch((cause) => setNotice('复制失败：' + String(cause)))
            }
          >
            复制脑洞
          </button>
        </article>
      ))}
    </div>
  )
}
