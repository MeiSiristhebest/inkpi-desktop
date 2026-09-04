import React from 'react';
import type { TableRowRecord } from '../../types';
import type { TableRecordRepository } from '../../ports/tableRecordRepository';
import { useTableViewModel } from '../../hooks/useTableViewModel';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { confirmDialog } from '../../adapters/confirmDialog';

export interface TableViewProps {
  projectId: string;
  tabId: string;
  tabMeta: any;
  repository?: TableRecordRepository;
}

export const TableView: React.FC<TableViewProps> = ({ projectId, tabId, tabMeta, repository }) => {
  const {
    rows,
    editingRow,
    isNewRow,
    setEditingRow,
    createRow,
    saveEditing,
    deleteRow,
    cancelEditing,
  } = useTableViewModel({
    projectId,
    tabId,
    codeRule: tabMeta?.codeRule,
    repository,
  });

  const columns = tabMeta?.columns || [{ name: '名称' }, { name: '说明' }];

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog.confirm('确定删除该行记录？'))) return;
    await deleteRow(id);
  };

  return (
    <div className="flex-1 h-screen flex flex-col justify-between bg-[var(--ink-bg)] text-[var(--ink-text)] p-6 select-none overflow-hidden">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-[var(--ink-border)]">
          <div>
            <h2 className="text-lg font-bold">{tabMeta?.name || '设定台账'}</h2>
            <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">{tabMeta?.description || '台账记录与管理'}</p>
          </div>
          <button
            onClick={createRow}
            className="px-3.5 py-1.5 bg-[var(--ink-accent)] text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            新增行记录
          </button>
        </div>

        <div className="mt-4 border border-[var(--ink-border)] rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[calc(100vh-180px)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] border-b border-[var(--ink-border)] sticky top-0 z-10">
                <tr>
                  <th className="p-3 font-semibold w-12 text-center">#</th>
                  {columns.map((col: any, idx: number) => (
                    <th key={idx} className="p-3 font-semibold whitespace-nowrap">
                      {col.name}
                    </th>
                  ))}
                  <th className="p-3 font-semibold w-24 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ink-border)]">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 2} className="p-8 text-center text-[var(--ink-text-muted)] text-xs">
                      暂无记录，点击右上角「新增行记录」添加
                    </td>
                  </tr>
                ) : (
                  rows.map((row: TableRowRecord, idx: number) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[var(--ink-bg-hover)] transition-colors group cursor-pointer"
                      onClick={() => setEditingRow({ ...row })}
                    >
                      <td className="p-3 text-center text-[var(--ink-text-muted)]">{idx + 1}</td>
                      {columns.map((col: any, cIdx: number) => (
                        <td key={cIdx} className="p-3 text-[var(--ink-text)] truncate max-w-xs">
                          {row.data[col.name] !== undefined ? String(row.data[col.name]) : '-'}
                        </td>
                      ))}
                      <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingRow({ ...row })}
                            className="p-1 rounded hover:bg-[var(--ink-border)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]"
                            title="编辑"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(row.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-[var(--ink-text-muted)] hover:text-red-500"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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

      {/* 编辑抽屉 / 弹窗 */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end animate-in fade-in duration-150">
          <div className="w-[450px] bg-[var(--ink-bg-card)] border-l border-[var(--ink-border)] h-full p-6 shadow-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--ink-border)]">
              <h3 className="text-sm font-bold">{isNewRow ? '新增记录' : '编辑记录'}</h3>
              <button
                onClick={cancelEditing}
                className="p-1 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              {columns.map((col: any, idx: number) => {
                const val = editingRow.data[col.name] || '';
                return (
                  <div key={idx} className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--ink-text)]">{col.name}</label>
                    {col.options ? (
                      <select
                        value={val}
                        onChange={(e) =>
                          setEditingRow({
                            ...editingRow,
                            data: { ...editingRow.data, [col.name]: e.target.value },
                          })
                        }
                        className="w-full p-2 text-xs rounded-lg bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
                      >
                        <option value="">-- 请选择 --</option>
                        {col.options.map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={val}
                        onChange={(e) =>
                          setEditingRow({
                            ...editingRow,
                            data: { ...editingRow.data, [col.name]: e.target.value },
                          })
                        }
                        className="w-full p-2 text-xs rounded-lg bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
                      />
                    )}
                  </div>
                );
              })}
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
