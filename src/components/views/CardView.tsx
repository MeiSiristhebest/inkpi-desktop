import React from 'react';
import type { CardRecord } from '../../types';
import type { CardRecordRepository } from '../../ports/cardRecordRepository';
import { useCardViewModel } from '../../hooks/useCardViewModel';
import { Plus, User, Edit2, Trash2, X, Check } from 'lucide-react';
import { confirmDialog } from '../../adapters/confirmDialog';

export interface CardViewProps {
  projectId: string;
  tabId: string;
  tabMeta: any;
  repository?: CardRecordRepository;
}

export const CardView: React.FC<CardViewProps> = ({ projectId, tabId, tabMeta, repository }) => {
  const {
    cards,
    editingCard,
    isNewCard,
    setEditingCard,
    createCard,
    saveEditing,
    deleteCard,
    cancelEditing,
  } = useCardViewModel({
    projectId,
    tabId,
    repository,
  });

  const modules = tabMeta?.modules || [];

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog.confirm('确定删除该档案卡片？'))) return;
    await deleteCard(id);
  };

  return (
    <div className="flex-1 h-screen flex flex-col justify-between bg-[var(--ink-bg)] text-[var(--ink-text)] p-6 select-none overflow-hidden">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-[var(--ink-border)]">
          <div>
            <h2 className="text-lg font-bold">{tabMeta?.name || '设定卡片'}</h2>
            <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">{tabMeta?.description || '结构化卡片与档案管理'}</p>
          </div>
          <button
            onClick={createCard}
            className="px-3.5 py-1.5 bg-[var(--ink-accent)] text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            新建卡片
          </button>
        </div>

        <div className="mt-4 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
          {cards.length === 0 ? (
            <div className="p-12 text-center text-[var(--ink-text-muted)] border border-dashed border-[var(--ink-border)] rounded-xl mt-4">
              <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">暂无档案卡片，点击右上角「新建卡片」录入</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((card: CardRecord) => (
                <div
                  key={card.id}
                  onClick={() => setEditingCard({ ...card })}
                  className="p-4 bg-[var(--ink-bg-card)] border border-[var(--ink-border)] rounded-xl hover:border-[var(--ink-accent)] transition-all cursor-pointer shadow-xs group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--ink-border)]/50">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] flex items-center justify-center font-bold text-xs">
                          {card.name ? card.name.slice(0, 1) : '?'}
                        </div>
                        <h4 className="font-bold text-sm text-[var(--ink-text)]">{card.name || '未命名'}</h4>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEditingCard({ ...card })}
                          className="p-1 rounded hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]"
                          title="编辑卡片"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(card.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-[var(--ink-text-muted)] hover:text-red-500"
                          title="删除卡片"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-[var(--ink-text-muted)]">
                      {Object.entries(card.data || {})
                        .slice(0, 4)
                        .map(([k, v]) => (
                          <div key={k} className="flex items-baseline gap-2 truncate">
                            <span className="font-medium text-[var(--ink-text-faint)] shrink-0">{k}:</span>
                            <span className="truncate text-[var(--ink-text)]">{String(v || '-')}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-[var(--ink-border)]/30 text-[10px] text-[var(--ink-text-faint)] flex justify-between">
                    <span>更新于 {new Date(card.updatedAt || card.createdAt || 0).toLocaleDateString()}</span>
                    <span className="group-hover:text-[var(--ink-accent)] transition-colors">点击查看完整档案 →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部提示 */}
      {tabMeta?.tips && tabMeta.tips.length > 0 && (
        <div className="mt-4 p-3 bg-[var(--ink-bg-card)] border border-[var(--ink-border)] rounded-lg text-xs text-[var(--ink-text-muted)] space-y-1">
          {tabMeta.tips.map((tip: string, idx: number) => (
            <p key={idx} className="flex items-start gap-1.5">
              <span className="text-[var(--ink-accent)] font-bold shrink-0">•</span>
              <span>{tip}</span>
            </p>
          ))}
        </div>
      )}

      {/* 卡片编辑抽屉 */}
      {editingCard && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end animate-in fade-in duration-150">
          <div className="w-[500px] bg-[var(--ink-bg-card)] border-l border-[var(--ink-border)] h-full p-6 shadow-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ink-border)]">
              <h3 className="text-sm font-bold">{isNewCard ? '新建卡片档案' : '编辑卡片档案'}</h3>
              <button
                onClick={cancelEditing}
                className="p-1 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              <div>
                <label className="text-xs font-semibold text-[var(--ink-text)]">名称 / 标题 *</label>
                <input
                  type="text"
                  placeholder="如：陈渊、苍岚大陆等"
                  value={editingCard.name}
                  onChange={(e) => setEditingCard({ ...editingCard, name: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded-lg bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)] font-bold"
                />
              </div>

              {modules.map((mod: any, mIdx: number) => (
                <div key={mIdx} className="space-y-2 border-t border-[var(--ink-border)]/50 pt-3">
                  <h4 className="text-xs font-bold text-[var(--ink-accent)]">{mod.name}</h4>
                  <div className="space-y-2.5 pl-1">
                    {(mod.fields || []).map((field: any, fIdx: number) => {
                      const val = editingCard.data?.[field.name] || '';
                      return (
                        <div key={fIdx} className="space-y-1">
                          <label className="text-xs font-medium text-[var(--ink-text)] flex items-center justify-between">
                            <span>{field.name}</span>
                            {field.desc && <span className="text-[10px] text-[var(--ink-text-faint)]">{field.desc}</span>}
                          </label>
                          <input
                            type="text"
                            placeholder={field.example || ''}
                            value={val}
                            onChange={(e) =>
                              setEditingCard({
                                ...editingCard,
                                data: { ...editingCard.data, [field.name]: e.target.value },
                              })
                            }
                            className="w-full p-2 text-xs rounded-lg bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[var(--ink-border)] flex items-center justify-end gap-2">
              <button
                onClick={cancelEditing}
                className="px-3.5 py-1.5 rounded-lg border border-[var(--ink-border)] text-xs text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
              >
                取消
              </button>
              <button
                onClick={saveEditing}
                className="px-4 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium flex items-center gap-1 shadow hover:opacity-90"
              >
                <Check className="w-3.5 h-3.5" />
                确定保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
