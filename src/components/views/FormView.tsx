import React, { useEffect } from 'react';
import type { FormDataRepository } from '../../ports/formDataRepository';
import { useFormViewModel } from '../../hooks/useFormViewModel';
import { Save } from 'lucide-react';

export interface FormViewProps {
  projectId: string;
  tabId: string;
  tabMeta: any;
  repository?: FormDataRepository;
}

export const FormView: React.FC<FormViewProps> = ({ projectId, tabId, tabMeta, repository }) => {
  const {
    formData,
    isSaved,
    updateField,
    save,
  } = useFormViewModel({
    projectId,
    tabId,
    repository,
  });

  const modules = tabMeta?.modules || [];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  return (
    <div className="flex-1 h-screen flex flex-col justify-between bg-[var(--ink-bg)] text-[var(--ink-text)] p-6 select-none overflow-hidden">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-[var(--ink-border)]">
          <div>
            <h2 className="text-lg font-bold">{tabMeta?.name || '设定表单'}</h2>
            <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">{tabMeta?.description || '结构化设定表单'}</p>
          </div>
          <button
            onClick={save}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shadow transition-all ${isSaved ? "bg-[var(--ink-bg-card)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]" : "bg-[var(--ink-accent)] text-white hover:opacity-90"}`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaved ? '已保存' : '保存修改 (Ctrl+S)'}</span>
          </button>
        </div>

        <div className="mt-4 max-h-[calc(100vh-180px)] overflow-y-auto space-y-6 pr-2">
          {modules.map((mod: any, idx: number) => (
            <div key={idx} className="bg-[var(--ink-bg-card)] border border-[var(--ink-border)] rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[var(--ink-accent)] mb-3 pb-2 border-b border-[var(--ink-border)]/50">
                {mod.name}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mod.fields.map((field: any, fIdx: number) => {
                  const val = formData[field.name] || '';
                  return (
                    <div key={fIdx} className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--ink-text)] flex items-center justify-between">
                        <span>{field.name}</span>
                        {field.desc && (
                          <span className="text-[10px] text-[var(--ink-text-faint)] truncate max-w-[200px]" title={field.desc}>
                            {field.desc}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder={field.example || ''}
                        value={val}
                        onChange={(e) => updateField(field.name, e.target.value)}
                        className="w-full p-2 text-xs rounded-lg bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-text)] placeholder-[var(--ink-text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)] transition-all"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

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
    </div>
  );
};

