import { useEffect, useRef, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { AuthorOpsProfileRecord, MetricLogEntry } from '../types'
import { indexedDbAuthorOpsRepository } from '../../../adapters/indexedDbAuthorOpsRepository'
import { AuthorOpsEngine } from '../engine/AuthorOpsEngine'
import { clock } from '../../../adapters/clock'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { blobFileDownloader } from '../../../adapters/blobFileDownloader'

const emptyLog = () => ({
  date: '',
  period: '',
  cohort: '',
  metricDefinition: '',
  chasingReadCount: '',
  averageSubscription: '',
  retentionRate: '',
  dropOffChapter: '',
  dropOffReason: '',
  counterAction: '',
})
export const AuthorOpsMasterView: FC<DesktopPluginViewProps> = (props) => (
  <AuthorOpsSession key={props.projectId} {...props} />
)
const AuthorOpsSession: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [profile, setProfile] = useState<AuthorOpsProfileRecord>({
    projectId,
    authorName: '',
    bio: '',
    works: [],
    supportChannels: {},
    metricLogs: [],
    updatedAt: 0,
  })
  const [tab, setTab] = useState<'metrics' | 'card'>('metrics')
  const [draft, setDraft] = useState(emptyLog)
  const [work, setWork] = useState({
    title: '',
    genre: '',
    totalWords: '',
    status: 'planning' as 'planning' | 'serialized' | 'finished',
  })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const saving = useRef(false)
  const profileRef = useRef(profile)
  profileRef.current = profile
  useEffect(() => {
    let stale = false
    setLoading(true)
    indexedDbAuthorOpsRepository
      .get(projectId)
      .then((saved) => {
        if (stale) return
        if (saved && saved.projectId !== projectId) throw new Error('台账不属于当前项目。')
        if (saved) setProfile(saved)
        setError(null)
      })
      .catch((cause) => {
        if (!stale) setError(String(cause))
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  useEffect(() => {
    onStats?.({
      title: '连载运营台账',
      wordCount: profile.works.reduce((sum, w) => sum + w.totalWords, 0),
      updatedAt: profile.updatedAt,
    })
  }, [profile, onStats])
  const analyses = AuthorOpsEngine.analyzeDropOff(profile.metricLogs, profile.reminderThreshold)
  let card = ''
  let cardError = ''
  try {
    card = AuthorOpsEngine.generateBusinessCard(
      profile.authorName,
      profile.bio,
      profile.works,
      profile.supportChannels.customUrl,
    )
  } catch (cause) {
    cardError = String(cause)
  }
  const persist = async (next: AuthorOpsProfileRecord, baseline = profile, addLog = false) => {
    if (saving.current) return
    saving.current = true
    setBusy(true)
    setError(null)
    const saved = { ...next, updatedAt: clock.now() }
    try {
      await indexedDbAuthorOpsRepository.save(saved)
      if (profileRef.current === baseline) {
        setProfile(saved)
        setNotice('资料已保存。')
      } else {
        if (addLog) setProfile((current) => ({ ...current, metricLogs: saved.metricLogs }))
        setNotice('本次资料已保存，保存期间的后续编辑尚未保存。')
      }
    } catch (cause) {
      setError('保存失败：' + String(cause))
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  const addLog = async () => {
    try {
      if (
        [
          'date',
          'period',
          'cohort',
          'metricDefinition',
          'chasingReadCount',
          'averageSubscription',
          'retentionRate',
          'dropOffChapter',
        ].some((key) => !draft[key as keyof typeof draft].trim())
      )
        throw new Error('请填齐日期、统计口径与观测数据。')
      const log: MetricLogEntry = {
        ...draft,
        chasingReadCount: Number(draft.chasingReadCount),
        averageSubscription: Number(draft.averageSubscription),
        retentionRate: Number(draft.retentionRate),
        dropOffChapter: Number(draft.dropOffChapter),
      }
      AuthorOpsEngine.validateLog(log)
      if (
        profile.metricLogs.some(
          (l) =>
            l.date === log.date &&
            l.dropOffChapter === log.dropOffChapter &&
            l.cohort === log.cohort &&
            l.period === log.period &&
            l.metricDefinition === log.metricDefinition,
        )
      )
        throw new Error('已有同日期、章节与口径的记录，请先核对。')
      await persist({ ...profile, metricLogs: [...profile.metricLogs, log] }, profile, true)
    } catch (cause) {
      setError(String(cause))
    }
  }
  const addWork = () => {
    if (
      !work.title.trim() ||
      !work.totalWords.trim() ||
      !Number.isInteger(Number(work.totalWords)) ||
      Number(work.totalWords) < 0
    ) {
      setError('请输入作品名和非负整数字数。')
      return
    }
    setProfile((current) => ({
      ...current,
      works: [...current.works, { ...work, totalWords: Number(work.totalWords) }],
    }))
    setWork({ title: '', genre: '', totalWords: '', status: 'planning' })
    setNotice('作品已加入当前资料，尚未保存。')
  }
  const copyCard = async () => {
    try {
      if (cardError) throw new Error(cardError)
      await clipboardWriter.writeText(card)
      setNotice('名片已复制。')
    } catch (cause) {
      setError('复制失败：' + String(cause))
    }
  }
  return (
    <div className="p-6 space-y-4">
      <h2>连载运营台账与作者商业名片 (AuthorOps)</h2>
      <p>仅使用作者录入的数据。差分以百分点表示，不能从留存率推断读者退订原因。</p>
      <p>来源：作者登记的运营指标与相邻章序差分。</p>
      <button onClick={() => setTab('metrics')}>运营台账与留存分析</button>
      <button onClick={() => setTab('card')}>商业名片生成器</button>
      {loading && <p>读取台账中…</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <fieldset disabled={loading} className="space-y-4">
        {tab === 'metrics' ? (
          <>
            <label>
              作者提醒阈值（百分点，留空不提醒）
              <input
                type="number"
                min={0}
                max={100}
                value={profile.reminderThreshold ?? ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? undefined : Number(e.target.value)
                  if (value === undefined || (Number.isFinite(value) && value >= 0 && value <= 100))
                    setProfile((current) => ({ ...current, reminderThreshold: value }))
                }}
              />
            </label>
            <p>缺少群体、周期、留存口径或相邻章序的记录不做差分。</p>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>统计口径</th>
                  <th>追读</th>
                  <th>均订</th>
                  <th>留存率</th>
                  <th>章节</th>
                  <th>作者归因 / 动作</th>
                </tr>
              </thead>
              <tbody>
                {profile.metricLogs.map((log, i) => (
                  <tr key={i}>
                    <td>{log.date}</td>
                    <td>
                      {log.period || '周期未知'} / {log.cohort || '群体未知'} /{' '}
                      {log.metricDefinition || '口径未知'}
                    </td>
                    <td>{log.chasingReadCount}</td>
                    <td>{log.averageSubscription}</td>
                    <td>{log.retentionRate}%</td>
                    <td>{log.dropOffChapter}</td>
                    <td>
                      {log.dropOffReason || '未记录原因'} / {log.counterAction || '未记录动作'}
                      <button
                        disabled={busy}
                        onClick={() =>
                          void persist({
                            ...profile,
                            metricLogs: profile.metricLogs.filter((_, index) => i !== index),
                          })
                        }
                      >
                        删除记录
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!profile.metricLogs.length && <p>本书还没有任何台账记录。</p>}
            {analyses.map((a, i) => (
              <article key={i} className="border p-2">
                <p>
                  第 {a.previousChapter}–{a.dropOffChapter} 章留存下降 {a.gradientLoss} 个百分点 ·{' '}
                  {a.cohort} / {a.period}
                </p>
                {a.isSevereCliff && <p>达到作者设置的提醒阈值。</p>}
                <p>作者记录：{a.probableReason}</p>
                <p>{a.recommendedCounterAction}</p>
              </article>
            ))}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries({
                date: '日期 YYYY-MM-DD',
                period: '统计周期',
                cohort: '读者群体',
                metricDefinition: '留存口径',
                chasingReadCount: '追读数',
                averageSubscription: '均订',
                retentionRate: '留存率%',
                dropOffChapter: '章节序号',
                dropOffReason: '作者归因与依据',
                counterAction: '已采取或计划的动作',
              }).map(([key, label]) => (
                <input
                  key={key}
                  aria-label={label}
                  placeholder={label}
                  value={draft[key as keyof typeof draft]}
                  onChange={(e) => setDraft((current) => ({ ...current, [key]: e.target.value }))}
                />
              ))}
            </div>
            <button disabled={busy} onClick={() => void addLog()}>
              追加今日数据
            </button>
            <button disabled={busy} onClick={() => void persist(profile)}>
              保存台账设置
            </button>
          </>
        ) : (
          <>
            <label>
              笔名
              <input
                aria-label="笔名"
                value={profile.authorName}
                onChange={(e) =>
                  setProfile((current) => ({ ...current, authorName: e.target.value }))
                }
              />
            </label>
            <label>
              创作简介
              <textarea
                aria-label="创作简介"
                value={profile.bio}
                onChange={(e) => setProfile((current) => ({ ...current, bio: e.target.value }))}
              />
            </label>
            <label>
              联系或支持链接
              <input
                aria-label="联系或支持链接"
                value={profile.supportChannels.customUrl ?? ''}
                onChange={(e) =>
                  setProfile((current) => ({
                    ...current,
                    supportChannels: { ...current.supportChannels, customUrl: e.target.value },
                  }))
                }
              />
            </label>
            <input
              aria-label="作品名"
              placeholder="作品名"
              value={work.title}
              onChange={(e) => setWork((current) => ({ ...current, title: e.target.value }))}
            />
            <input
              aria-label="作品类型"
              placeholder="作品类型"
              value={work.genre}
              onChange={(e) => setWork((current) => ({ ...current, genre: e.target.value }))}
            />
            <input
              aria-label="登记字数"
              placeholder="登记字数"
              value={work.totalWords}
              onChange={(e) => setWork((current) => ({ ...current, totalWords: e.target.value }))}
            />
            <select
              aria-label="作品状态"
              value={work.status}
              onChange={(e) =>
                setWork((current) => ({ ...current, status: e.target.value as typeof work.status }))
              }
            >
              <option value="planning">筹备中</option>
              <option value="serialized">连载中</option>
              <option value="finished">已完结</option>
            </select>
            <button onClick={addWork}>添加登记作品</button>
            <button disabled={busy || Boolean(cardError)} onClick={() => void persist(profile)}>
              保存名片档案
            </button>
            {cardError ? (
              <p role="alert">{cardError}</p>
            ) : (
              <>
                <pre className="whitespace-pre-wrap">{card}</pre>
                <button onClick={() => void copyCard()}>复制名片</button>
                <button
                  onClick={() => {
                    try {
                      blobFileDownloader.downloadBlob(
                        '作者名片.md',
                        new Blob([card], { type: 'text/markdown;charset=utf-8' }),
                      )
                    } catch (cause) {
                      setError(String(cause))
                    }
                  }}
                >
                  导出名片 Markdown
                </button>
              </>
            )}
          </>
        )}
      </fieldset>
    </div>
  )
}
