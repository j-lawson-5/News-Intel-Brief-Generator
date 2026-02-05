import React, { useState, useEffect, useMemo } from 'react';
import { DateRange, Article, Briefing, BriefingContent, Version, RegionalData } from './types';
import { generateBriefingContent, tuneBriefingSection, BRIEFING_SCHEMA } from './geminiService';

type Phase = 'input' | 'analysis' | 'generating' | 'preview' | 'editing' | 'public-view';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyD8ZzB7nWNcxu8zMhFmyRsFhmcxYhirD08nvM9HUEO8JNhGq3fkAqYitgghY-xSs_x/exec';
const BRIEFINGS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxaWzFfEpvgpjwJJtj0_rUYQJyWAAimnUay6cBKQQJXsWx8YzvoOLPjrraKJIsR44-k/exec';

const industryKeywords = ['Energy', 'Healthcare', 'Finance', 'Education', 'Environment', 'Transportation', 'Tech', 'Labor', 'Housing', 'Cannabis', 'Agriculture', 'Retail', 'Manufacturing'];

const detectIndustry = (text: string): string => {
  const lower = (text || '').toLowerCase();
  for (const keyword of industryKeywords) {
    if (lower.includes(keyword.toLowerCase())) return keyword;
  }
  return 'General Policy';
};

const INTEL_STEPS = [
  "Scanning State Legislative Archives...",
  "Filtering Noise from Strategic Signals...",
  "Analyzing Regulatory Trajectories...",
  "Identifying Market Catalysts...",
  "Synthesizing Regional Impacts...",
  "Calibrating Future Risk Vectors...",
  "Mapping Strategic Action Items...",
  "Drafting Executive Intelligence...",
  "Finalizing Architect Protocol..."
];

const DEFAULT_SYSTEM_PROMPT = `
WRITING STYLE REQUIREMENTS:
- Be SPECIFIC and CONCRETE, never vague or generic
- Include specific bill numbers, dollar amounts, dates, company names when available
- Quantify impact: "affects 12 utilities" not "affects several utilities"
- Name specific stakeholders: "Duke Energy, Dominion, AEP" not "major utilities"
- Reference specific legislation: "HB 1234" not "recent legislation"
- If data is unavailable, say so rather than being vague
- Every claim must be traceable to a source article
`.trim();

// --- Icons ---
const TargetIcon = ({ className = "w-5 h-5", color = "#4f46e5" }: { className?: string, color?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const HistoryIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="m12 7 0 5 3 3" />
  </svg>
);

const LibraryIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16 6 4 14" />
    <path d="M12 6v14" />
    <path d="M8 8v12" />
    <path d="M4 4v16" />
  </svg>
);

const EditIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const EyeIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const LinkIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const SettingsIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const RefreshIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const ChevronIcon = ({ className = "w-4 h-4", isOpen = false }: { className?: string; isOpen?: boolean }) => (
  <svg 
    className={`${className} transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} 
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const SparkleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707" />
  </svg>
);

const TrashIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const PlusIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const MAX_SOURCES = 50;

/**
 * Robustly renders text containing Markdown-style bolding (**text**) 
 * and footnote markers ([n]). Citations link directly to article URLs.
 */
const renderTextWithFootnotes = (text: string, sources: { title: string; url: string }[]) => {
  if (!text) return null;

  const parseFootnotes = (rawText: string, keyPrefix: string) => {
    // Match both single [1] and comma-separated [1, 2, 3] citations
    const parts = rawText.split(/(\[\d+(?:,\s*\d+)*\])/);
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
      if (match) {
        // Split the numbers (handles "1" or "1, 2, 3")
        const nums = match[1].split(/,\s*/).map(n => parseInt(n.trim(), 10));
        return (
          <sup key={`${keyPrefix}-${i}`} className="text-[10px] font-black text-indigo-600 px-0.5 select-none">
            [
            {nums.map((num, j) => {
              const source = sources?.[num - 1];
              return (
                <span key={`${keyPrefix}-${i}-${j}`}>
                  {j > 0 && ', '}
                  {source?.url ? (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{num}</a>
                  ) : (
                    <span>{num}</span>
                  )}
                </span>
              );
            })}
            ]
          </sup>
        );
      }
      return part;
    });
  };

  const boldParts = text.split(/(\*\*.*?\*\*)/);
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2);
      return (
        <strong key={`bold-${i}`} className="font-black text-slate-950">
          {parseFootnotes(content, `bold-content-${i}`)}
        </strong>
      );
    }
    return parseFootnotes(part, `normal-${i}`);
  });
};

// --- Sub-components moved to top level for render stability ---

interface EditableTextProps {
  value: string;
  onSave: (v: string) => void;
  isEditable?: boolean;
  sources: { title: string; url: string }[];
  className?: string;
  isTextArea?: boolean;
}

const EditableText = ({ value, onSave, isEditable, sources, className = "", isTextArea = false }: EditableTextProps) => {
  if (!isEditable) return <span className={className}>{renderTextWithFootnotes(value, sources)}</span>;
  return isTextArea ? (
    <textarea 
      value={value} 
      onChange={e => onSave(e.target.value)} 
      className={`w-full bg-transparent border-b border-indigo-200 focus:border-indigo-600 outline-none p-1 transition-colors min-h-[60px] resize-y ${className}`}
    />
  ) : (
    <input 
      value={value} 
      onChange={e => onSave(e.target.value)} 
      className={`w-full bg-transparent border-b border-indigo-200 focus:border-indigo-600 outline-none p-1 transition-colors ${className}`}
    />
  );
};

interface SectionHeaderProps {
  num?: string;
  title: string;
  id: string;
  canRemove?: boolean;
  onRemove?: () => void;
  onEditSection?: (section: string) => void;
  isEditable?: boolean;
}

const SectionHeader = ({ num, title, id, canRemove = false, onRemove, onEditSection, isEditable }: SectionHeaderProps) => (
  <div className="flex items-center justify-between group">
    <div className="flex items-center gap-4">
      {num && <span className="bg-slate-950 text-white text-[9px] font-black px-4 py-1.5 rounded-lg">{num}</span>}
      <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-950 antialiased">{title}</h2>
    </div>
    <div className="flex gap-2">
      {onEditSection && (
        <button 
          onClick={() => onEditSection(id)}
          className="p-2 text-indigo-600 bg-indigo-50/50 hover:bg-indigo-100 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-indigo-100"
        >
          <SparkleIcon className="w-3 h-3" /> AI Tune
        </button>
      )}
      {isEditable && canRemove && (
        <button 
          onClick={onRemove}
          className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-red-100"
        >
          <TrashIcon className="w-3 h-3" /> Delete Section
        </button>
      )}
    </div>
  </div>
);

interface BriefingContentPreviewProps {
  content: BriefingContent;
  industry: string;
  dateRange?: DateRange;
  isEditable?: boolean;
  onEditSection?: (section: string) => void;
  onUpdateContent?: (newContent: BriefingContent) => void;
}

const BriefingContentPreview = ({ content, industry, dateRange, isEditable, onEditSection, onUpdateContent }: BriefingContentPreviewProps) => {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  const refCode = (industry || 'UNK').slice(0, 3).toUpperCase();

  const updateField = (path: string, value: any) => {
    if (!onUpdateContent) return;
    const newContent = JSON.parse(JSON.stringify(content));
    const parts = path.split('.');
    let current = newContent;
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    onUpdateContent(newContent);
  };

  return (
    <div className="pdf-stable-container break-words-safe text-slate-900 space-y-12">
      <header className="pb-8 space-y-8 pt-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-[64px] font-[900] hero-title uppercase tracking-[-0.04em] text-slate-950 leading-[0.9] antialiased">
            INTELLIGENCE BRIEFING
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-[#4f46e5] font-[900] text-[13px] tracking-[0.2em] uppercase">{industry} Vertical</span>
            <span className="w-[6px] h-[6px] rounded-full bg-slate-200"></span>
            <span className="text-[#94a3b8] font-[700] text-[10px] uppercase tracking-[0.15em] antialiased">State Affairs Advisory Hub</span>
          </div>
        </div>
        <div className="bg-[#f8fafc] border border-[#e2e8f0] flex justify-between items-center px-10 py-5 rounded-[18px] shadow-sm">
           <div className="text-[10px] font-[900] uppercase tracking-[0.2em] text-[#94a3b8]">Ref: SA-{refCode}</div>
           <div className="text-[10px] font-[900] uppercase tracking-[0.2em] text-[#4f46e5]">Classification: Proprietary</div>
           <div className="text-[10px] font-[900] uppercase tracking-[0.2em] text-[#94a3b8]">{dateStr}</div>
        </div>
        <div className="flex justify-between items-center px-1">
          <div className="h-[4px] bg-slate-950 flex-1"></div>
        </div>
        {dateRange && (
          <div className="flex justify-end -mt-4">
             <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest bg-white px-3">Synthesis Look-Back: {dateRange} Days</span>
          </div>
        )}
      </header>

      {/* Strategic Outlook Section */}
      <section className="pdf-section bg-white rounded-3xl p-8 text-slate-900 shadow-xl relative overflow-hidden border border-slate-100 border-l-[12px] border-indigo-600 group">
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {onEditSection && (
            <button onClick={() => onEditSection('strategicInsight')} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all">
              <SparkleIcon className="w-3 h-3" /> AI Tune
            </button>
          )}
        </div>
        <div className="flex items-start gap-6 relative z-10">
          <div className="mt-1"><TargetIcon className="w-8 h-8" /></div>
          <div className="space-y-4 flex-1">
            <EditableText 
              value={content.strategicInsight.title} 
              onSave={v => updateField('strategicInsight.title', v)} 
              isEditable={isEditable}
              sources={content.sources}
              className="text-xl font-black uppercase tracking-tight text-slate-900 antialiased underline decoration-indigo-100 decoration-4 underline-offset-4 block"
            />
            <EditableText 
              value={content.strategicInsight.insight} 
              onSave={v => updateField('strategicInsight.insight', v)} 
              isEditable={isEditable}
              sources={content.sources}
              isTextArea 
              className="text-lg font-medium leading-relaxed opacity-90 border-l-2 border-slate-100 pl-6 py-1 antialiased italic text-slate-700 block"
            />
          </div>
        </div>
      </section>

      {/* BLUF Section */}
      <section className="pdf-section space-y-8">
        <SectionHeader num="01" title="Bottom Line Up Front" id="bluf" onEditSection={onEditSection} isEditable={isEditable} />
        <div className="border-l-[8px] border-indigo-600 pl-8 py-2">
           <EditableText 
              value={content.bluf.intro} 
              onSave={v => updateField('bluf.intro', v)} 
              isEditable={isEditable}
              sources={content.sources}
              isTextArea 
              className="text-2xl font-medium text-slate-800 italic leading-snug tracking-tight antialiased block"
           />
        </div>
        <div className="pdf-grid-2">
           <div className="pdf-grid-item-2 space-y-6">
              <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-[0.4em] flex items-center gap-4 antialiased">
                <span className="w-8 h-[2px] bg-slate-100"></span> Pulse Observations
              </h3>
              <ul className="space-y-4">
                 {content.bluf.bullets.map((b, i) => (
                   <li key={i} className="flex gap-4 text-base font-bold text-slate-700 leading-tight antialiased group">
                      <span className="text-brand text-2xl font-black opacity-30 mt-[-4px]">/</span>
                      <div className="flex-1">
                        <EditableText value={b} onSave={v => {
                          const newList = [...content.bluf.bullets];
                          newList[i] = v;
                          updateField('bluf.bullets', newList);
                        }} isEditable={isEditable} sources={content.sources} isTextArea />
                      </div>
                      {isEditable && (
                        <button onClick={() => {
                          const newList = content.bluf.bullets.filter((_, idx) => idx !== i);
                          updateField('bluf.bullets', newList);
                        }} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-1">
                          <TrashIcon />
                        </button>
                      )}
                   </li>
                 ))}
                 {isEditable && (
                    <button onClick={() => updateField('bluf.bullets', [...content.bluf.bullets, "New observation bullet..."])} className="w-full py-2 border-2 border-dashed border-slate-100 rounded-xl text-[10px] font-black uppercase text-slate-300 hover:text-indigo-600 hover:border-indigo-100 transition-all flex items-center justify-center gap-2">
                       <PlusIcon /> Add Observation
                    </button>
                 )}
              </ul>
           </div>
           <div className="pdf-grid-item-2 space-y-6">
              <h3 className="text-[9px] font-black uppercase text-indigo-400 tracking-[0.4em] flex items-center gap-4 antialiased">
                <span className="w-8 h-[2px] bg-indigo-100"></span> Strategic Actions
              </h3>
              <div className="space-y-4">
                 {content.bluf.actions.map((a, i) => (
                   <div key={i} className="bg-slate-50 border border-slate-100 p-6 rounded-2xl flex items-center gap-4 shadow-sm group">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black shrink-0 shadow-md">{i+1}</div>
                      <div className="flex-1">
                        <EditableText value={a} onSave={v => {
                          const newList = [...content.bluf.actions];
                          newList[i] = v;
                          updateField('bluf.actions', newList);
                        }} isEditable={isEditable} sources={content.sources} className="text-base font-black text-indigo-900 leading-tight block" />
                      </div>
                      {isEditable && (
                        <button onClick={() => {
                          const newList = content.bluf.actions.filter((_, idx) => idx !== i);
                          updateField('bluf.actions', newList);
                        }} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-1">
                          <TrashIcon />
                        </button>
                      )}
                   </div>
                 ))}
                 {isEditable && (
                    <button onClick={() => updateField('bluf.actions', [...content.bluf.actions, "New strategic action item..."])} className="w-full py-4 border-2 border-dashed border-indigo-50 rounded-2xl text-[10px] font-black uppercase text-indigo-200 hover:text-indigo-600 hover:border-indigo-100 transition-all flex items-center justify-center gap-2 bg-indigo-50/20">
                       <PlusIcon /> Add Strategic Action
                    </button>
                 )}
              </div>
           </div>
        </div>
      </section>

      {/* Market Catalyst */}
      {content.forcingFunction && (
        <section className="pdf-section bg-slate-50 text-slate-950 p-10 rounded-3xl space-y-8 relative overflow-hidden border border-slate-100">
          <SectionHeader num="02" title="Market Catalyst" id="forcingFunction" canRemove onRemove={() => updateField('forcingFunction', undefined)} onEditSection={onEditSection} isEditable={isEditable} />
          <EditableText 
            value={content.forcingFunction.what} 
            onSave={v => updateField('forcingFunction.what', v)} 
            isEditable={isEditable}
            sources={content.sources}
            className="text-3xl font-black text-slate-900 leading-tight tracking-tighter antialiased underline decoration-amber-500/30 underline-offset-[8px] decoration-4 block"
          />
          <div className="pdf-grid-2 pt-4">
             <div className="pdf-grid-item-2 space-y-6">
                <h4 className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-300 antialiased">Forecast Spectrum</h4>
                <div className="space-y-4">
                   {content.forcingFunction.forecast.map((f, i) => (
                     <div key={i} className="flex gap-4 text-lg font-black text-slate-700 antialiased tracking-tighter group">
                        <span className="text-amber-500">→</span>
                        <div className="flex-1">
                          <EditableText value={f} onSave={v => {
                            const newList = [...content.forcingFunction!.forecast];
                            newList[i] = v;
                            updateField('forcingFunction.forecast', newList);
                          }} isEditable={isEditable} sources={content.sources} />
                        </div>
                        {isEditable && (
                          <button onClick={() => {
                            const newList = content.forcingFunction!.forecast.filter((_, idx) => idx !== i);
                            updateField('forcingFunction.forecast', newList);
                          }} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-1">
                            <TrashIcon />
                          </button>
                        )}
                     </div>
                   ))}
                   {isEditable && (
                      <button onClick={() => updateField('forcingFunction.forecast', [...content.forcingFunction!.forecast, "New forecast projection..."])} className="w-full py-2 border-2 border-dashed border-emerald-100 rounded-xl text-[10px] font-black uppercase text-emerald-600 hover:text-emerald-800 hover:border-emerald-300 transition-all flex items-center justify-center gap-2">
                         <PlusIcon /> Add Forecast
                      </button>
                   )}
                </div>
             </div>
             <div className="pdf-grid-item-2 space-y-6">
                <h4 className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-300 antialiased">Intelligence Synthesis</h4>
                <div className="text-base text-slate-500 italic leading-relaxed pl-6 border-l-2 border-slate-200 antialiased">
                   <EditableText value={content.forcingFunction.why} onSave={v => updateField('forcingFunction.why', v)} isEditable={isEditable} sources={content.sources} isTextArea />
                </div>
             </div>
          </div>
        </section>
      )}

      {/* Regional Impact */}
      {content.regional && (
        <section className="pdf-section space-y-8">
          <SectionHeader num="03" title="Regional Impact Analysis" id="regional" onEditSection={onEditSection} isEditable={isEditable} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {content.regional.map((r, i) => (
              <div key={i} className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-3 relative group overflow-hidden">
                <div className="flex justify-between items-center gap-4">
                  <EditableText value={r.state} onSave={v => {
                    const newList = [...content.regional];
                    newList[i].state = v;
                    updateField('regional', newList);
                  }} isEditable={isEditable} sources={content.sources} className="text-[10px] font-black uppercase tracking-widest text-indigo-600" />
                  <EditableText value={r.status} onSave={v => {
                    const newList = [...content.regional];
                    newList[i].status = v;
                    updateField('regional', newList);
                  }} isEditable={isEditable} sources={content.sources} className="text-[9px] font-black uppercase text-slate-400 text-right whitespace-nowrap" />
                </div>
                <EditableText value={r.impact} onSave={v => {
                  const newList = [...content.regional];
                  newList[i].impact = v;
                  updateField('regional', newList);
                }} isEditable={isEditable} sources={content.sources} isTextArea className="text-sm font-bold text-slate-800 leading-snug block" />
                {isEditable && (
                  <button onClick={() => {
                    const newList = content.regional.filter((_, idx) => idx !== i);
                    updateField('regional', newList);
                  }} className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-1">
                    <TrashIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {isEditable && (
              <button onClick={() => updateField('regional', [...content.regional, { state: "STATE", status: "STATUS", impact: "Projected impact analysis..." }])} className="p-6 border-2 border-dashed border-indigo-50 rounded-2xl text-[11px] font-black uppercase text-indigo-200 hover:text-indigo-600 hover:border-indigo-100 transition-all flex flex-col items-center justify-center gap-3 bg-white/50 min-h-[140px]">
                 <PlusIcon className="w-6 h-6" /> Add Impact Node
              </button>
            )}
          </div>
        </section>
      )}

      {/* Strategic Signals */}
      {content.signals && (
        <section className="pdf-section space-y-8">
          <SectionHeader num="04" title="Strategic Signals" id="signals" onEditSection={onEditSection} isEditable={isEditable} />
          <div className="space-y-12">
            {content.signals.map((s, i) => (
              <div key={i} className="space-y-4 border-l-4 border-slate-100 pl-8 pb-4 relative group">
                {isEditable && (
                  <button onClick={() => {
                    const newList = content.signals.filter((_, idx) => idx !== i);
                    updateField('signals', newList);
                  }} className="absolute top-0 right-0 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-1">
                    <TrashIcon />
                  </button>
                )}
                <EditableText value={s.title} onSave={v => {
                  const newList = [...content.signals];
                  newList[i].title = v;
                  updateField('signals', newList);
                }} isEditable={isEditable} sources={content.sources} className="text-xl font-black text-slate-950 uppercase tracking-tight block" />
                <EditableText value={s.activity} onSave={v => {
                  const newList = [...content.signals];
                  newList[i].activity = v;
                  updateField('signals', newList);
                }} isEditable={isEditable} sources={content.sources} isTextArea className="text-base font-medium text-slate-600 italic leading-relaxed block" />
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 pt-2">
                  {s.developments.map((d, j) => (
                    <li key={j} className="flex gap-4 text-sm font-bold text-slate-700 leading-tight group/item">
                      <span className="text-brand text-xl font-black opacity-20">/</span>
                      <div className="flex-1">
                        <EditableText value={d} onSave={v => {
                          const newList = [...content.signals];
                          newList[i].developments[j] = v;
                          updateField('signals', newList);
                        }} isEditable={isEditable} sources={content.sources} />
                      </div>
                      {isEditable && (
                        <button onClick={() => {
                          const newList = [...content.signals];
                          newList[i].developments = newList[i].developments.filter((_, idx) => idx !== j);
                          updateField('signals', newList);
                        }} className="text-red-400 opacity-0 group-hover/item:opacity-100 hover:text-red-600 transition-all p-1">
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      )}
                    </li>
                  ))}
                  {isEditable && (
                    <button onClick={() => {
                      const newList = [...content.signals];
                      newList[i].developments.push("New strategic development node...");
                      updateField('signals', newList);
                    }} className="col-span-1 md:col-span-2 py-2 border border-dashed border-slate-100 rounded-lg text-[9px] font-black uppercase text-slate-300 hover:text-indigo-600 transition-all">
                      + Add Development
                    </button>
                  )}
                </ul>
              </div>
            ))}
            {isEditable && (
              <button onClick={() => updateField('signals', [...content.signals, { title: "NEW SIGNAL", activity: "Trajectory subtext...", developments: ["Initial strategic development..."] }])} className="w-full py-8 border-4 border-dashed border-slate-50 rounded-3xl text-[11px] font-black uppercase text-slate-200 hover:text-indigo-600 hover:border-indigo-50 transition-all flex items-center justify-center gap-3">
                 <PlusIcon className="w-6 h-6" /> Architect New Signal Stream
              </button>
            )}
          </div>
        </section>
      )}

      {/* Watch List */}
      {content.watchList && (
        <section className="pdf-section space-y-8">
          <SectionHeader num="05" title="The Watch List" id="watchList" onEditSection={onEditSection} isEditable={isEditable} />
          <div className="flex flex-wrap gap-4">
            {content.watchList.map((w, i) => (
              <div key={i} className="relative group">
                <span className="px-8 py-4 bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg block">
                  <EditableText value={w} onSave={v => {
                    const newList = [...content.watchList];
                    newList[i] = v;
                    updateField('watchList', newList);
                  }} isEditable={isEditable} sources={content.sources} />
                </span>
                {isEditable && (
                  <button onClick={() => {
                    const newList = content.watchList.filter((_, idx) => idx !== i);
                    updateField('watchList', newList);
                  }} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-75">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {isEditable && (
              <button onClick={() => updateField('watchList', [...content.watchList, "NEW ENTITY"])} className="px-8 py-4 border-2 border-dashed border-slate-200 text-slate-300 text-[11px] font-black uppercase tracking-[0.2em] rounded-full hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center gap-2">
                <PlusIcon /> Add Target
              </button>
            )}
          </div>
        </section>
      )}

      {/* Sources */}
      <section className="pdf-section space-y-8 pt-12 border-t-2 border-slate-100">
        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Original News References</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
          {content.sources.slice(0, MAX_SOURCES).map((src, i) => (
            <div key={i} id={`source-${i+1}`} className="flex gap-4 scroll-mt-24 group">
              <span className="text-[10px] font-black text-indigo-200 mt-0.5">{String(i+1).padStart(2, '0')}</span>
              <div className="flex-1 overflow-hidden">
                <EditableText value={src.title} onSave={v => {
                  const newList = [...content.sources];
                  newList[i].title = v;
                  updateField('sources', newList);
                }} isEditable={isEditable} sources={content.sources} className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors truncate block" />
                {isEditable && (
                  <EditableText value={src.url} onSave={v => {
                    const newList = [...content.sources];
                    newList[i].url = v;
                    updateField('sources', newList);
                  }} isEditable={isEditable} sources={content.sources} className="text-[8px] text-slate-300 block truncate" />
                )}
              </div>
              {isEditable && (
                <button onClick={() => {
                  const newList = content.sources.filter((_, idx) => idx !== i);
                  updateField('sources', newList);
                }} className="text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all p-1">
                  <TrashIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {isEditable && (
            <button onClick={() => updateField('sources', [...content.sources, { title: "New Source Reference", url: "https://" }])} className="p-4 border border-dashed border-slate-100 rounded-xl text-[9px] font-black uppercase text-slate-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
               <PlusIcon /> Add Source Reference
            </button>
          )}
        </div>
      </section>

      <footer className="pt-24 flex flex-col items-center pb-8">
        <div className="opacity-10 text-[8px] font-black uppercase tracking-[1em] text-slate-900 antialiased mb-8">END OF PROPRIETARY ADVISORY HUB DOCUMENT</div>
      </footer>
    </div>
  );
};

// --- Main App Component ---

const App = () => {
  const [phase, setPhase] = useState<Phase>('input');
  const [topic, setTopic] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange>(DateRange.Past30);
  const [context, setContext] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [prospectDomain, setProspectDomain] = useState("");
  const [showProspectFields, setShowProspectFields] = useState(false);
  const [intelStepIndex, setIntelStepIndex] = useState(0);
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  
  const [systemPrompt, setSystemPrompt] = useState<string>(() => {
    return localStorage.getItem('sa_system_prompt') || DEFAULT_SYSTEM_PROMPT;
  });
  
  const [savedBriefings, setSavedBriefings] = useState<Briefing[]>(() => {
    const saved = localStorage.getItem('sa_briefing_vault');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentBriefing, setCurrentBriefing] = useState<Briefing | null>(null);
  const [draftContent, setDraftContent] = useState<BriefingContent | null>(null);

  const [showLibraryDrawer, setShowLibraryDrawer] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [showLinkDropdown, setShowLinkDropdown] = useState(false);
  const [isLoadingSharedBriefing, setIsLoadingSharedBriefing] = useState(false);
  const [showGatedForm, setShowGatedForm] = useState(false);
  const [gatedBriefingId, setGatedBriefingId] = useState<string | null>(null);
  const [gatedFormData, setGatedFormData] = useState({ firstName: '', lastName: '', email: '' });
  const [gatedFormError, setGatedFormError] = useState<string | null>(null);

  const [isTuning, setIsTuning] = useState<string | null>(null);
  const [tuningPrompt, setTuningPrompt] = useState("");
  const [isProcessingTune, setIsProcessingTune] = useState(false);
  const [isExternalViewer, setIsExternalViewer] = useState(false);

  // Mapping for targeted section tuning schemas
  const SECTION_SCHEMAS: Record<string, any> = useMemo(() => ({
    bluf: BRIEFING_SCHEMA.properties.bluf,
    forcingFunction: BRIEFING_SCHEMA.properties.forcingFunction,
    signals: BRIEFING_SCHEMA.properties.signals,
    regional: BRIEFING_SCHEMA.properties.regional,
    watchList: BRIEFING_SCHEMA.properties.watchList,
    sources: BRIEFING_SCHEMA.properties.sources,
    strategicInsight: BRIEFING_SCHEMA.properties.strategicInsight,
  }), []);

  // Settings & Data Cache
  const [cachedArticles, setCachedArticles] = useState<Article[]>(() => {
    const cached = localStorage.getItem('sa_cached_articles');
    return cached ? JSON.parse(cached) : [];
  });
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(() => {
    return localStorage.getItem('sa_last_refreshed');
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // Fetch briefing from Google Sheets (for shared links)
  const fetchBriefingFromSheets = async (id: string, isGated: boolean = false) => {
    setIsLoadingSharedBriefing(true);
    try {
      const response = await fetch(`${BRIEFINGS_SCRIPT_URL}?briefingId=${id}`);
      const result = await response.json();
      if (result.success && result.briefing) {
        if (isGated) {
          // Show form first, store briefing ID for after form submission
          setGatedBriefingId(id);
          setShowGatedForm(true);
          setCurrentBriefing(result.briefing); // Pre-load but don't show yet
        } else {
          setCurrentBriefing(result.briefing);
          setPhase('public-view');
        }
      } else {
        alert('Briefing not found or expired');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load briefing');
    } finally {
      setIsLoadingSharedBriefing(false);
    }
  };

  // Submit gated form and reveal briefing
  const submitGatedForm = async () => {
    const { firstName, lastName, email } = gatedFormData;
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setGatedFormError('All fields are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGatedFormError('Please enter a valid email address');
      return;
    }
    setGatedFormError(null);

    try {
      // Save form submission to Google Sheets
      await fetch(BRIEFINGS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({
          formSubmission: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            briefingId: gatedBriefingId,
            timestamp: new Date().toISOString()
          }
        }),
      });
      // Show the briefing
      setShowGatedForm(false);
      setPhase('public-view');
    } catch (err) {
      console.error(err);
      setGatedFormError('Failed to submit. Please try again.');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    const isGated = params.get('gated') === 'true';

    if (viewId) {
      // First check localStorage (for internal users) - skip gated form for internal
      const brief = savedBriefings.find(b => b.id === viewId);
      if (brief && !isGated) {
        setCurrentBriefing(brief);
        setPhase('public-view');
      } else {
        // Not in localStorage or gated - fetch from Google Sheets (external viewer)
        setIsExternalViewer(true);
        fetchBriefingFromSheets(viewId, isGated);
      }
    }
  }, []); // Empty dependency - only run once on mount (fixes URL bug)

  useEffect(() => {
    let interval: any;
    if (phase === 'generating') {
      interval = setInterval(() => {
        setIntelStepIndex(prev => (prev + 1) % INTEL_STEPS.length);
      }, 2500);
    } else {
      setIntelStepIndex(0);
    }
    return () => clearInterval(interval);
  }, [phase]);

  const fetchArticleData = async () => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams({ days: '90' });
      const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        const data = result.data || [];
        setCachedArticles(data);
        const timestamp = new Date().toISOString();
        setLastRefreshed(timestamp);
        localStorage.setItem('sa_last_refreshed', timestamp);
        localStorage.setItem('sa_cached_articles', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Handshake protocol failure.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const computePivotData = () => {
    const pivot: Record<string, Record<string, number>> = {};
    cachedArticles.forEach(article => {
      let topicHeader = article.category?.trim() || detectIndustry(article.topic || article.summary || article.title || '');
      const subtopic = (article.topic || 'Unspecified').substring(0, 60) + ((article.topic?.length || 0) > 60 ? '...' : '');
      if (!pivot[topicHeader]) pivot[topicHeader] = {};
      if (!pivot[topicHeader][subtopic]) pivot[topicHeader][subtopic] = 0;
      pivot[topicHeader][subtopic]++;
    });
    return Object.fromEntries(Object.entries(pivot).sort((a, b) => 
      Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0)
    ));
  };

  const getAvailableTopics = (): string[] => {
    const topics = new Set<string>();
    cachedArticles.forEach(article => {
      const topicLabel = article.category?.trim() || detectIndustry(article.topic || article.summary || article.title || '');
      if (topicLabel) topics.add(topicLabel);
    });
    return Array.from(topics).sort();
  };

  const toggleTopic = (topicName: string) => {
    const next = new Set(expandedTopics);
    if (next.has(topicName)) next.delete(topicName);
    else next.add(topicName);
    setExpandedTopics(next);
  };

  const handleGenerate = async () => {
    if (!topic) return;
    setPhase('generating');
    try {
      // 1. Filter articles from the already cached pool first to check for availability
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - dateRange);
      
      let relevantArticles = cachedArticles.filter((a: Article) => {
        const articleDate = new Date(a.date);
        const isRecent = articleDate >= cutoff;
        const articleTopic = a.category?.trim() || detectIndustry(a.topic || a.summary || a.title || '');
        return isRecent && articleTopic.toLowerCase() === topic.toLowerCase();
      });

      // 2. If cache is insufficient, attempt a fresh fetch for the specific range
      if (relevantArticles.length === 0) {
        const params = new URLSearchParams({ days: dateRange.toString() });
        const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`);
        if (!response.ok) throw new Error("Database link failed.");
        const result = await response.json();
        const rawArticles = Array.isArray(result.data) ? result.data : [];
        relevantArticles = rawArticles.filter((a: Article) => {
          const articleTopic = a.category?.trim() || detectIndustry(a.topic || a.summary || a.title || '');
          return articleTopic.toLowerCase() === topic.toLowerCase();
        });
      }

      if (relevantArticles.length === 0) {
        alert(`No articles found for the "${topic}" sector within the last ${dateRange} days. Try increasing the temporal look-back range or ensuring the article vault is synchronized in the Data Console.`);
        setPhase('input');
        return;
      }
      
      // 3. Limit articles to stay within model reasoning/token limits
      const limitedArticles = relevantArticles.slice(0, 40);
      const content = await generateBriefingContent(topic, context, limitedArticles, prospectName, prospectDomain, systemPrompt);
      
      if (!content) throw new Error("AI engine returned empty synthesis.");

      const newBriefing: Briefing = {
        id: `brf_${Date.now()}`,
        topic,
        dateRange,
        context,
        articleCount: limitedArticles.length,
        versions: [{ num: 1, createdAt: new Date().toISOString(), createdBy: 'AI Synthesis', content }],
        currentVersion: 1
      };

      setCurrentBriefing(newBriefing);
      setSavedBriefings(prev => {
        const updatedVault = [newBriefing, ...prev].slice(0, 40);
        localStorage.setItem('sa_briefing_vault', JSON.stringify(updatedVault));
        return updatedVault;
      });
      setPhase('preview');
    } catch (err) {
      console.error('[Architect Hub] Critical synthesis error:', err);
      alert(`Synthesis failed: ${err instanceof Error ? err.message : 'Unknown Protocol Error'}. Please verify your network and check the Data Console.`);
      setPhase('input');
    }
  };

  const commitManualChanges = () => {
    if (!currentBriefing || !draftContent || !hasUnsavedEdits) {
      setPhase('preview');
      return;
    }
    
    const newVersionNum = currentBriefing.versions.length + 1;
    const newVersion: Version = {
      num: newVersionNum,
      createdAt: new Date().toISOString(),
      createdBy: 'Manual Architect Revision',
      content: draftContent
    };
    const updatedBriefing = {
      ...currentBriefing,
      versions: [...currentBriefing.versions, newVersion],
      currentVersion: newVersionNum
    };
    setCurrentBriefing(updatedBriefing);
    setSavedBriefings(prev => {
      const updated = prev.map(b => b.id === updatedBriefing.id ? updatedBriefing : b);
      localStorage.setItem('sa_briefing_vault', JSON.stringify(updated));
      return updated;
    });
    setHasUnsavedEdits(false);
    setPhase('preview');
  };

  const handleTune = async () => {
    if (!currentBriefing || !isTuning || !tuningPrompt) return;
    setIsProcessingTune(true);
    try {
      const currentContent = getCurrentContent()!;
      let sectionData = (currentContent as any)[isTuning];
      const updatedSection = await tuneBriefingSection(isTuning, sectionData, tuningPrompt, SECTION_SCHEMAS[isTuning] || {});
      
      const newContent = { ...currentContent, [isTuning]: updatedSection };
      const newVersionNum = currentBriefing.versions.length + 1;
      const newVersion: Version = {
        num: newVersionNum,
        createdAt: new Date().toISOString(),
        createdBy: 'Refinement Protocol',
        content: newContent
      };

      const updatedBriefing = {
        ...currentBriefing,
        versions: [...currentBriefing.versions, newVersion],
        currentVersion: newVersionNum
      };

      setCurrentBriefing(updatedBriefing);
      setSavedBriefings(prev => {
        const updated = prev.map(b => b.id === updatedBriefing.id ? updatedBriefing : b);
        localStorage.setItem('sa_briefing_vault', JSON.stringify(updated));
        return updated;
      });
      setIsTuning(null);
      setTuningPrompt("");
    } catch (err) {
      console.error('Tuning failure');
      alert("AI tuning failed. Please try rephrasing your instructions.");
    } finally {
      setIsProcessingTune(false);
    }
  };

  const getCurrentContent = () => currentBriefing?.versions.find(v => v.num === currentBriefing.currentVersion)?.content || null;

  const pivotData = computePivotData();
  const availableTopics = getAvailableTopics();

  // Loading screen for shared briefings
  if (isLoadingSharedBriefing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-sm font-black uppercase tracking-widest text-slate-400">Loading Intelligence Briefing...</p>
        </div>
      </div>
    );
  }

  // Gated form for lead capture
  if (showGatedForm) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 mb-2">Intelligence Briefing</h1>
            <p className="text-sm text-slate-500">Enter your details to access this briefing</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">First Name</label>
              <input
                type="text"
                value={gatedFormData.firstName}
                onChange={(e) => setGatedFormData(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-600 outline-none transition-all"
                placeholder="John"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Last Name</label>
              <input
                type="text"
                value={gatedFormData.lastName}
                onChange={(e) => setGatedFormData(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-600 outline-none transition-all"
                placeholder="Smith"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Email</label>
              <input
                type="email"
                value={gatedFormData.email}
                onChange={(e) => setGatedFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-600 outline-none transition-all"
                placeholder="john@company.com"
              />
            </div>

            {gatedFormError && (
              <p className="text-red-500 text-xs font-bold text-center">{gatedFormError}</p>
            )}

            <button
              onClick={submitGatedForm}
              className="w-full py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all text-sm mt-4"
            >
              View Briefing
            </button>
          </div>

          <p className="text-[10px] text-slate-400 text-center mt-6">Your information will be shared with the briefing author</p>
        </div>
      </div>
    );
  }

  if (phase === 'public-view' && currentBriefing) {
    const currentViewContent = getCurrentContent();
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {!isExternalViewer && (
          <div className="bg-slate-900 text-white px-8 py-3 flex justify-between items-center no-print">
            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Live Public View Preview</span>
            <button onClick={() => setPhase('preview')} className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-all">Back to Platform</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto py-12 px-6 bg-slate-50 flex flex-col items-center">
          <div className="max-w-4xl w-full border border-slate-100 shadow-2xl rounded-[48px] p-12 md:p-20 bg-white mt-12 mb-24 overflow-hidden">
            {currentViewContent && <BriefingContentPreview content={currentViewContent} industry={currentBriefing.topic} dateRange={currentBriefing.dateRange} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col antialiased text-slate-900 overflow-x-hidden">
      <header className="border-b border-slate-100 bg-white/90 backdrop-blur-md sticky top-0 z-[100] px-8 py-5 flex items-center justify-between no-print shadow-sm">
        <div className="flex items-center gap-8">
          <div onClick={() => setPhase('input')} className="cursor-pointer group flex flex-col">
            <h1 className="text-xl font-black tracking-tighter text-slate-900 group-hover:text-indigo-600 transition-colors uppercase leading-none">State Affairs</h1>
            <span className="text-[9px] font-black uppercase text-indigo-600 tracking-widest mt-1">Architect Hub</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => setShowLibraryDrawer(true)} title="Vault / Library" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <LibraryIcon className="w-6 h-6" />
          </button>
          <button onClick={() => setShowSettingsPanel(true)} title="Data Console" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <SettingsIcon className="w-5 h-5" />
          </button>
          {currentBriefing && (
            <button onClick={() => setShowHistoryDrawer(!showHistoryDrawer)} title="Version History" className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <HistoryIcon className="w-5 h-5" />
            </button>
          )}
          {phase !== 'input' && <button onClick={() => setPhase('input')} className="text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest border-l border-slate-100 pl-6">New Briefing</button>}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center py-12 px-6 overflow-y-auto relative bg-slate-50/20">
        {phase === 'input' && (
          <div className="w-full max-w-xl space-y-12 animate-in fade-in duration-700 mt-12 pb-24 text-center">
            <div className="space-y-4">
              <h1 className="text-[64px] font-black uppercase tracking-tighter leading-[0.9] text-slate-950">POLICY INTEL <br/> <span className="text-indigo-600">ARCHITECT</span></h1>
              <p className="text-slate-400 font-bold text-sm tracking-tight pt-4">Generate high-stakes policy briefings using semantic AI analysis.</p>
              
              {availableTopics.length === 0 && !isRefreshing && (
                <div className="pt-8 animate-in zoom-in duration-500">
                  <button 
                    onClick={fetchArticleData} 
                    className="mx-auto flex items-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-full text-[11px] font-black uppercase tracking-[0.1em] shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 group"
                  >
                    <RefreshIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                    Synchronize Article Vault
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-8 text-left">
              <div className="grid grid-cols-2 gap-6 items-start">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sector Vertical</label>
                  <div className="relative group/sel h-[64px]">
                    <select value={topic} onChange={(e) => setTopic(e.target.value)} className={`w-full h-full bg-white border-2 rounded-[24px] px-8 py-0 text-sm font-black uppercase focus:border-indigo-600 focus:bg-white outline-none transition-all shadow-sm appearance-none ${topic ? 'border-indigo-600 shadow-xl shadow-indigo-100/20' : 'border-slate-100'}`}>
                      <option value="" disabled>Select a Vertical...</option>
                      {availableTopics.length === 0 && <option disabled>Vault is Empty</option>}
                      {availableTopics.map(t => {
                        const count = cachedArticles.filter(a => (a.category?.trim() || detectIndustry(a.topic || '')) === t).length;
                        return <option key={t} value={t}>{t} ({count})</option>;
                      })}
                    </select>
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      {isRefreshing ? <div className="w-4 h-4 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Temporal Look-Back</label>
                  <div className="flex bg-white border-2 border-slate-100 rounded-[24px] p-1.5 shadow-sm h-[64px] items-center">
                    {[30, 60, 90].map((d) => (
                      <button key={d} onClick={() => setDateRange(d as DateRange)} className={`flex-1 h-full rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all ${dateRange === d ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
                        {d}D
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <button onClick={() => setShowProspectFields(!showProspectFields)} className={`w-full flex items-center justify-between p-6 border-2 rounded-3xl transition-all shadow-sm ${showProspectFields ? 'border-indigo-600 bg-indigo-50/50 text-indigo-600' : 'border-slate-100 text-slate-400 hover:border-slate-300 bg-white'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest">Prospect Personalization</span>
                  <span>{showProspectFields ? '−' : '+'}</span>
                </button>
                {showProspectFields && (
                  <div className="grid grid-cols-2 gap-4 p-8 bg-white border-2 border-slate-100 rounded-3xl animate-in slide-in-from-top-4 duration-300">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Company</label>
                      <input value={prospectName} onChange={e => setProspectName(e.target.value)} placeholder="Acme Corp" className="w-full px-5 py-3 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-600 bg-white text-slate-900" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Domain</label>
                      <input value={prospectDomain} onChange={e => setProspectDomain(e.target.value)} placeholder="acme.com" className="w-full px-5 py-3 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-600 bg-white text-slate-900" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Strategic Context</label>
                <textarea value={context} onChange={e => setContext(e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-3xl p-8 text-sm font-bold min-h-[140px] shadow-sm outline-none focus:border-indigo-600 transition-all resize-none text-slate-900" placeholder="Target specific policy threats..." />
              </div>
              <button onClick={handleGenerate} disabled={!topic || isRefreshing} className="w-full py-6 rounded-3xl bg-indigo-600 text-white font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.01] active:scale-95 disabled:opacity-30 transition-all">Generate Intelligence</button>
            </div>
          </div>
        )}

        {(phase === 'preview' || phase === 'editing') && currentBriefing && (
          <div className="w-full max-w-5xl animate-in fade-in duration-500 mt-4 pb-32">
            <div className="sticky top-20 z-50 mb-8 no-print">
              <div className="flex flex-wrap gap-4 justify-between items-center bg-white/95 backdrop-blur-md border border-slate-200 p-6 rounded-[32px] shadow-2xl transition-all hover:shadow-indigo-100/20">
                 <div className="flex items-center gap-5 px-2">
                   <div className="w-2 h-10 bg-indigo-600 rounded-full"></div>
                   <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">V{currentBriefing.currentVersion} DRAFT</h2>
                 </div>
                 <div className="flex gap-4">
                   <button 
                    onClick={() => {
                      if (phase === 'editing') {
                        commitManualChanges();
                      } else {
                        setDraftContent(getCurrentContent());
                        setPhase('editing');
                        setHasUnsavedEdits(false);
                      }
                    }} 
                    className={`px-6 py-4 border text-[11px] font-black uppercase rounded-2xl tracking-widest transition-all flex items-center gap-2 shadow-sm ${phase === 'editing' ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200' : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'}`}
                   >
                     <EditIcon className="w-4 h-4" /> {phase === 'editing' ? (hasUnsavedEdits ? 'Save Changes' : 'Exit Edit Mode') : 'Edit Intelligence'}
                   </button>
                   <div className="relative">
                     <button
                      onClick={() => setShowLinkDropdown(!showLinkDropdown)}
                      className="px-6 py-4 bg-white border border-slate-200 text-slate-900 text-[11px] font-black uppercase rounded-2xl tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                     >
                       <LinkIcon className="w-4 h-4" /> {copySuccess ? `${copySuccess}!` : 'Copy Link'}
                       <svg className={`w-3 h-3 transition-transform ${showLinkDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"/></svg>
                     </button>
                     {showLinkDropdown && (
                       <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[200px]">
                         <button
                           onClick={async () => {
                             try {
                               const response = await fetch(BRIEFINGS_SCRIPT_URL, {
                                 method: 'POST',
                                 body: JSON.stringify({ briefing: currentBriefing }),
                               });
                               const result = await response.json();
                               if (result.success && result.id) {
                                 const url = `${window.location.origin}${window.location.pathname}?view=${result.id}`;
                                 await navigator.clipboard.writeText(url);
                                 setCopySuccess('Public Copied');
                                 setTimeout(() => setCopySuccess(null), 2000);
                                 setShowLinkDropdown(false);
                               } else {
                                 alert('Failed to generate link');
                               }
                             } catch (err) {
                               console.error(err);
                               alert('Failed to generate link');
                             }
                           }}
                           className="w-full px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all border-b border-slate-100"
                         >
                           🔓 Public Link
                           <span className="block text-[9px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">Anyone can view directly</span>
                         </button>
                         <button
                           onClick={async () => {
                             try {
                               const response = await fetch(BRIEFINGS_SCRIPT_URL, {
                                 method: 'POST',
                                 body: JSON.stringify({ briefing: currentBriefing }),
                               });
                               const result = await response.json();
                               if (result.success && result.id) {
                                 const url = `${window.location.origin}${window.location.pathname}?view=${result.id}&gated=true`;
                                 await navigator.clipboard.writeText(url);
                                 setCopySuccess('Gated Copied');
                                 setTimeout(() => setCopySuccess(null), 2000);
                                 setShowLinkDropdown(false);
                               } else {
                                 alert('Failed to generate link');
                               }
                             } catch (err) {
                               console.error(err);
                               alert('Failed to generate link');
                             }
                           }}
                           className="w-full px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                         >
                           🔒 Gated Link
                           <span className="block text-[9px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">Requires name & email first</span>
                         </button>
                       </div>
                     )}
                   </div>
                   <button 
                    onClick={() => window.print()} 
                    className="px-6 py-4 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-2xl tracking-widest hover:scale-105 transition-transform shadow-xl shadow-indigo-100"
                   >
                    Export PDF
                   </button>
                   <button onClick={() => setPhase('public-view')} className="px-6 py-4 bg-white border border-slate-200 text-slate-900 text-[11px] font-black uppercase rounded-2xl tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><EyeIcon className="w-4 h-4" /> Public Preview</button>
                   <button onClick={() => setPhase('input')} className="px-6 py-4 bg-slate-950 text-white text-[11px] font-black uppercase rounded-2xl tracking-widest hover:scale-105 transition-transform shadow-lg">Back to Input</button>
                 </div>
              </div>
              {phase === 'editing' && (
                <div className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-center text-[11px] font-black uppercase tracking-[0.2em] shadow-lg animate-in fade-in slide-in-from-top-2 mt-2">
                  Intelligence Architect Mode: Manual Editing Active • Click 'AI Tune' for Refinement
                </div>
              )}
            </div>

            <div className={`bg-white border rounded-[56px] shadow-3xl p-16 md:p-24 mx-auto max-w-[880px] transition-all ring-1 overflow-hidden ${phase === 'editing' ? 'ring-indigo-300 bg-slate-50/30' : 'ring-slate-100'}`}>
              <BriefingContentPreview 
                content={(phase === 'editing' ? draftContent : getCurrentContent())!} 
                industry={currentBriefing.topic} 
                dateRange={currentBriefing.dateRange} 
                isEditable={phase === 'editing'}
                onEditSection={(s) => setIsTuning(s)}
                onUpdateContent={(newContent) => {
                  setDraftContent(newContent);
                  setHasUnsavedEdits(true);
                }}
              />
            </div>
          </div>
        )}

        {phase === 'generating' && (
          <div className="py-32 text-center space-y-12 animate-in fade-in duration-1000 flex flex-col items-center">
            <div className="relative">
              <div className="w-32 h-32 border-[6px] border-slate-50 border-t-indigo-600 rounded-full animate-spin shadow-xl"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <TargetIcon className="w-8 h-8 animate-pulse text-indigo-400" />
              </div>
            </div>
            <div className="space-y-6 max-w-xs">
              <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900">SYNTHESIZING...</h3>
              <div className="h-20 flex items-center justify-center">
                <p key={intelStepIndex} className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500 animate-in slide-in-from-bottom-2 fade-in duration-500 italic text-center">
                  {INTEL_STEPS[intelStepIndex]}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-slate-100 no-print bg-white/50">
        <div className="max-w-xl mx-auto flex flex-col items-center">
           <div className="text-center text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] select-none">
             © 2026 State Affairs • Intelligence Platform
           </div>
        </div>
      </footer>

      {/* Side Panels */}
      {/* Tuning Panel */}
      <div className={`fixed inset-y-0 right-0 w-[440px] bg-slate-950 text-white z-[200] transform transition-transform duration-500 shadow-3xl ${isTuning ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-10 h-full flex flex-col">
          <div className="flex justify-between items-center mb-12">
            <div className="flex flex-col">
               <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI Section Refinement</span>
               <h3 className="text-2xl font-black uppercase tracking-tighter">Tune: {isTuning}</h3>
            </div>
            <button onClick={() => setIsTuning(null)} className="text-slate-500 hover:text-white transition-colors">✕</button>
          </div>
          <div className="space-y-8 flex-1">
             <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Refinement Instructions</label>
                <textarea 
                  value={tuningPrompt}
                  onChange={e => setTuningPrompt(e.target.value)}
                  placeholder="e.g. 'Make it more aggressive', 'Focus on the Massachusetts budget implications'..."
                  className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-sm font-bold min-h-[160px] shadow-sm outline-none focus:border-indigo-600 transition-all resize-none text-white"
                />
             </div>
             <button 
               onClick={handleTune}
               disabled={isProcessingTune || !tuningPrompt}
               className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-indigo-500/20 hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
             >
               {isProcessingTune ? (
                 <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Recalibrating Intelligence...
                 </>
               ) : (
                 <>
                  <SparkleIcon className="w-4 h-4" /> Execute Refinement
                 </>
               )}
             </button>
          </div>
        </div>
      </div>

      {/* History Drawer */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-white border-l border-slate-100 z-[120] transform transition-transform duration-500 shadow-2xl ${showHistoryDrawer ? 'translate-x-0' : 'translate-x-full'}`}>
         <div className="p-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black uppercase tracking-tighter">History</h3>
              <button onClick={() => setShowHistoryDrawer(false)} className="text-slate-400 hover:text-slate-900 transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-none">
               {currentBriefing?.versions.map(v => (
                 <div 
                   key={v.num} 
                   onClick={() => {
                     setCurrentBriefing({...currentBriefing, currentVersion: v.num});
                     setShowHistoryDrawer(false);
                   }} 
                   className={`p-5 rounded-[20px] cursor-pointer transition-all border group ${currentBriefing.currentVersion === v.num ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 text-slate-900 border-slate-100 hover:bg-slate-100'}`}
                 >
                    <div className="flex justify-between items-center mb-1">
                       <span className={`text-[10px] font-black uppercase tracking-widest ${currentBriefing.currentVersion === v.num ? 'text-white' : 'text-indigo-600'}`}>Version {v.num}</span>
                       <span className="text-[8px] font-bold opacity-50">{new Date(v.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[11px] font-black leading-tight">{v.createdBy}</p>
                 </div>
               ))}
            </div>
         </div>
      </div>

      {/* Vault (Library) Drawer - Positioned on the Right */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-slate-950 text-white z-[120] transform transition-transform duration-500 shadow-2xl ${showLibraryDrawer ? 'translate-x-0' : 'translate-x-full'}`}>
         <div className="p-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black uppercase tracking-tighter">Vault</h3>
              <button onClick={() => setShowLibraryDrawer(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-none">
               {savedBriefings.map(b => (
                 <div key={b.id} onClick={() => { setCurrentBriefing(b); setPhase('preview'); setShowLibraryDrawer(false); }} className="p-6 bg-white/5 rounded-[24px] cursor-pointer hover:bg-white/10 transition-all border border-white/5 group relative overflow-hidden">
                    <div className="text-[9px] font-black text-indigo-400 uppercase mb-2">{b.topic}</div>
                    <h4 className="text-xs font-black uppercase tracking-tight line-clamp-2 mb-2">{b.context || 'Synthesis Project'}</h4>
                    <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{b.articleCount} Articles Analyzed</div>
                 </div>
               ))}
               {savedBriefings.length === 0 && <p className="text-slate-600 text-[10px] font-black uppercase text-center mt-20">No archived briefings</p>}
            </div>
         </div>
      </div>

      {/* Data Console (Settings) Panel */}
      <div className={`fixed inset-y-0 right-0 w-[480px] bg-white border-l border-slate-100 z-[150] transform transition-transform duration-500 shadow-3xl ${showSettingsPanel ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-10 h-full flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              <SettingsIcon className="w-6 h-6 text-indigo-600" />
              Data Console
            </h3>
            <button onClick={() => setShowSettingsPanel(false)} className="text-slate-400 hover:text-slate-950 transition-colors">✕</button>
          </div>
          <div className="space-y-8 flex-1 overflow-y-auto pr-4 scrollbar-none">
            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-8 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isRefreshing ? 'bg-indigo-500 animate-pulse' : (lastRefreshed ? 'bg-emerald-500' : 'bg-amber-500')}`}></div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">
                    {isRefreshing ? 'Synchronizing...' : 'Vault Optimized'}
                  </span>
                </div>
                <div className="text-[9px] font-bold text-slate-400">
                  {lastRefreshed ? `Last Handshake: ${new Date(lastRefreshed).toLocaleString()}` : 'No sync history'}
                </div>
              </div>
              <button 
                onClick={fetchArticleData}
                disabled={isRefreshing}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all ${isRefreshing ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700'}`}
              >
                {isRefreshing ? 'Processing...' : 'Force Global Refresh'}
              </button>
            </div>
            
            <div className="space-y-4">
               <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Intelligence Tuning Prompt</h4>
               <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">Core Persona & Writing Requirements</p>
                  <textarea 
                    value={systemPrompt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSystemPrompt(val);
                      localStorage.setItem('sa_system_prompt', val);
                    }}
                    className="w-full h-48 bg-white border border-slate-100 rounded-xl p-4 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-600 transition-all resize-none shadow-inner"
                    placeholder="Enter instructions for intelligence synthesis style..."
                  />
                  <div className="mt-4 flex justify-end">
                    <button 
                      onClick={() => {
                        setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
                        localStorage.setItem('sa_system_prompt', DEFAULT_SYSTEM_PROMPT);
                      }}
                      className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                    >
                      Reset to Default
                    </button>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Article Index</h4>
              <div className="space-y-4">
                {Object.entries(pivotData).map(([topicHeader, subtopics]) => {
                  const isExpanded = expandedTopics.has(topicHeader);
                  return (
                    <div key={topicHeader} className="space-y-2">
                      <button onClick={() => toggleTopic(topicHeader)} className="w-full text-xs font-black uppercase text-indigo-950 flex justify-between items-center hover:bg-slate-50 p-1 rounded-lg">
                        <div className="flex items-center gap-2"><ChevronIcon isOpen={isExpanded} className="w-3 h-3" /><span>{topicHeader}</span></div>
                        <span className="opacity-30">{Object.values(subtopics).reduce((a, b) => a + b, 0)}</span>
                      </button>
                      {isExpanded && (
                        <div className="grid grid-cols-1 gap-1.5 pl-6 border-l border-indigo-50">
                          {Object.entries(subtopics).map(([sub, count]) => (
                            <div key={sub} className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                              <span className="truncate pr-2">{sub}</span>
                              <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-400">{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
