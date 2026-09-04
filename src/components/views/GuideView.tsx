import React from 'react';
import { TAB_DEFINITIONS as tabDefinitions } from '../../config/tabDefinitions';
import { ListOrdered, BookOpen, Lightbulb, ArrowRight, HelpCircle } from 'lucide-react';

interface GuideViewProps {
  onNavigate: (tabId: string) => void;
}

const RECOMMENDED_ORDER = [
  'positioning',
  'worldbase',
  'power',
  'char-main',
  'char-secondary',
  'history',
  'master',
  'volume-outline',
  'chapter-master',
  'chapter-outline',
];

const GROUPS = ['开书定位', '大纲规划', '角色管理', '世界构建', '创作管理', '运营维护', '灵感工具'];

const METHODOLOGY = [
  { title: '先定位再动笔', body: '开书前先填作品定位：赛道、平台、读者、卖点没想清楚就动笔，多半会切书。' },
  { title: '全书总纲先行', body: '动笔前总纲必填：主线一句话、大结局、分卷规划一览；每卷结束回看修订一次。' },
  { title: '世界观三层填法', body: '底层法则（定了不改）→社会文明（前十章展开）→细节（随写随补）。世界观是舞台不是字典。' },
  { title: '等级表是宪法', body: '力量体系的等级一旦正文发布尽量不改；定稿前先写三章试水，检验数值是否膨胀。' },
  { title: '角色三档分级', body: '主要角色=核心；次要角色=阶段性宿敌/导师/配角；NPC=功能型。戏份变了及时升降级。' },
  { title: '问答法深挖动机', body: '对着角色卡连问三个“为什么”，问到第三个为什么，动机才立得住。' },
  { title: '随写随登记', body: '正文里每写出一个新设定立刻回表登记，连载百万字后你会感谢这套表。' },
  { title: '伏笔与前置条件', body: '伏笔登记时同步写清“回收前读者需要知道什么”——前置没铺就强行回收，效果大打折扣。' },
  { title: '每章结尾必有钩子', body: '网文和传统文学最大的区别；连载形态下章末平淡=流失读者。' },
  { title: '改设定先过设定变更', body: '连载中要改设定，先登记旧值新值、影响范围、已发布冲突——冲突未处理前不发布后续章节。' },
  { title: '知情权限随时登记', body: '读者对“谁知道什么”记得比你牢；每当有角色知悉秘密当天登记，防泄密穿帮。' },
  { title: '灵感即时入库', body: '灵感出现的当天就登记；写细纲卡壳先翻素材库再硬编。' },
];

export const GuideView: React.FC<GuideViewProps> = ({ onNavigate }) => {
  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[var(--ink-bg)] text-[var(--ink-text)] p-6 select-none">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">使用指南</h1>
          <HelpCircle className="w-4 h-4 text-[var(--ink-text-muted)]" />
        </div>
        <p className="mt-1 text-xs text-[var(--ink-text-muted)]">
          网文创作全景指南 · 推荐填写顺序 · 全部功能页签 · 核心创作方法论
        </p>
      </header>

      {/* 推荐填写顺序 */}
      <section className="mb-6 bg-[var(--ink-bg-card)] rounded-xl border border-[var(--ink-border)] overflow-hidden">
        <div className="px-5 py-3 bg-[var(--ink-bg-hover)] border-b border-[var(--ink-border)] flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-[var(--ink-accent)]" />
          <h2 className="text-xs font-semibold">推荐填写顺序</h2>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            {RECOMMENDED_ORDER.map((tabId, idx) => {
              const item = tabDefinitions.find((t) => t.id === tabId);
              if (!item) return null;
              return (
                <div key={tabId} className="flex items-center gap-2">
                  <button
                    onClick={() => onNavigate(tabId)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--ink-bg)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] hover:border-[var(--ink-accent)] hover:text-[var(--ink-accent)] transition-colors"
                  >
                    {idx + 1}. {item.name}
                  </button>
                  {idx < RECOMMENDED_ORDER.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-[var(--ink-text-muted)]" />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-[var(--ink-text-muted)]">
            历史事件用倒推法（从大结局倒推到开篇）；写作期间持续维护伏笔、时间脉络与设定变更。
          </p>
        </div>
      </section>

      {/* 全部功能页签 */}
      <section className="mb-6 bg-[var(--ink-bg-card)] rounded-xl border border-[var(--ink-border)] overflow-hidden">
        <div className="px-5 py-3 bg-[var(--ink-bg-hover)] border-b border-[var(--ink-border)] flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--ink-accent)]" />
          <h2 className="text-xs font-semibold">全部功能页签 ({tabDefinitions.length})</h2>
        </div>
        <div className="p-5 space-y-6">
          {GROUPS.map((group) => {
            const tabs = tabDefinitions.filter(
              (t) => t.type !== 'dashboard' && t.type !== 'guide' && t.group === group
            );
            if (tabs.length === 0) return null;
            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-1 h-3 rounded-full bg-[var(--ink-accent)]" />
                  <span className="text-xs font-semibold text-[var(--ink-text)]">{group}</span>
                  <span className="text-[10px] text-[var(--ink-text-muted)]">{tabs.length} 项</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-2">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onNavigate(t.id)}
                      className="group text-left py-2 border-b border-[var(--ink-border)]/40 hover:border-[var(--ink-accent)]/50 transition-colors cursor-pointer"
                    >
                      <div className="text-xs font-medium text-[var(--ink-text)] group-hover:text-[var(--ink-accent)] transition-colors">
                        {t.name}
                      </div>
                      <div className="text-[10px] text-[var(--ink-text-muted)] mt-0.5 line-clamp-1">
                        {t.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 核心创作方法论 */}
      <section className="bg-[var(--ink-bg-card)] rounded-xl border border-[var(--ink-border)] overflow-hidden">
        <div className="px-5 py-3 bg-[var(--ink-bg-hover)] border-b border-[var(--ink-border)] flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-[var(--ink-accent)]" />
          <h2 className="text-xs font-semibold">核心创作方法论 (12 条心法)</h2>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {METHODOLOGY.map((item, idx) => (
            <div
              key={idx}
              className="rounded-lg bg-[var(--ink-bg)] border border-[var(--ink-border)] px-4 py-3"
            >
              <div className="text-xs font-semibold text-[var(--ink-accent)]">{item.title}</div>
              <div className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed mt-1">{item.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
