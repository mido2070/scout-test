import React, { useState, useEffect, useContext, useRef } from 'react';
import { Building2, FileText, CheckCircle, AlertTriangle, ArrowRight, UploadCloud, Gavel, Scale, Briefcase, Plus, X, Search, Loader2, Globe, History, Send, MessageSquare, ChevronDown, ChevronUp, RefreshCw, Zap, Sliders, AlertOctagon, Lightbulb, Link2, BookOpen, Trash2, Link as LinkIcon, Calendar, Target, Activity, FileWarning, PenTool, ShieldCheck, Play, Save, Users, Clock, AlertCircle, Wand2, LayoutGrid, ChevronLeft, ChevronRight as ChevronRightIcon, Download, Printer, Settings2 } from 'lucide-react';
import { LanguageContext } from '../App';
import { PolicyData, PolicySector, LibraryDocument, AttachedFile, PolicyOutputLanguage, PolicyVersion, PolicyUpdate, FocusArea, WorkshopNote, WorkshopNoteType, Stakeholder, PolicyOutputFormat, CodeType, CoverageType, BoardNode, BoardEdge } from '../types';
import { libraryDB } from '../services/libraryDB';
import { analyzePolicy, refinePolicyReport, chatWithAssistant } from '../services/geminiService';
import AnalysisResult from './AnalysisResult';
import WorkshopBoard from './WorkshopBoard';

// --- Typewriter Component (Local) ---
const TypewriterText = ({ text }: { text: string }) => {
  const [displayedText, setDisplayedText] = useState('');
  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.substring(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, 25);
    return () => clearInterval(timer);
  }, [text]);
  return (
    <span className="inline-block text-brand-600 font-mono font-medium">
      {displayedText}
      <span className="inline-block w-0.5 h-4 bg-brand-500 ml-0.5 animate-pulse align-middle"></span>
    </span>
  );
};

const SidebarSection = ({ title, icon: Icon, isOpen, onToggle, children, collapsed }: any) => (
    <div className={`border-b border-sand-200 ${collapsed ? 'py-4 flex justify-center' : ''}`}>
        {collapsed ? (
            <button onClick={onToggle} title={title} className="text-slate-500 hover:text-slate-900 bg-sand-50 p-2 rounded-lg hover:bg-white transition shadow-sm border border-transparent hover:border-sand-200">
                <Icon className="w-6 h-6" strokeWidth={1.5} />
            </button>
        ) : (
            <>
                <button 
                    onClick={onToggle}
                    className="w-full px-5 py-4 flex items-center justify-between bg-white hover:bg-sand-50 transition-colors group"
                >
                    <div className="flex items-center gap-3 font-bold text-slate-800 text-sm uppercase tracking-wide">
                        <div className="w-8 h-8 rounded-lg bg-sand-50 border border-sand-200 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition">
                            <Icon className="w-4 h-4 text-slate-500" strokeWidth={1.5} />
                        </div>
                        {title}
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {isOpen && <div className="p-5 bg-sand-50/30 border-t border-sand-100 animate-in slide-in-from-top-2 duration-200">{children}</div>}
            </>
        )}
    </div>
);

// Helper for Sector Translation
const getSectorLabel = (sector: string, lang: string) => {
    if (lang !== 'ar') return sector;
    const mapping: Record<string, string> = {
        [PolicySector.HOUSING]: "الإسكان والقطاع السكني",
        [PolicySector.COMMERCIAL]: "التجاري والتجزئة",
        [PolicySector.INDUSTRIAL]: "الصناعي واللوجستي",
        [PolicySector.HOSPITALITY]: "الضيافة والسياحة",
        [PolicySector.HEALTHCARE]: "الرعاية الصحية",
        [PolicySector.EDUCATION]: "التعليم",
        [PolicySector.HERITAGE]: "التراث والثقافة",
        [PolicySector.INFRASTRUCTURE]: "البنية التحتية العامة",
        [PolicySector.OTHER]: "أخرى"
    };
    return mapping[sector] || sector;
};

export const PolicyLab: React.FC = () => {
  const { t, language } = useContext(LanguageContext);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number>(0);

  // Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState({ focus: true, workshop: true, config: true });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({...prev, [section]: !prev[section]}));
  };

  // Step 1: Scope & Objectives
  const [intent, setIntent] = useState(''); 
  const [domain, setDomain] = useState('Zoning & Land Use');
  const [isCustomDomain, setIsCustomDomain] = useState(false);

  // Step 2
  const [workshopNotes, setWorkshopNotes] = useState<WorkshopNote[]>([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNote, setNewNote] = useState<Partial<WorkshopNote>>({
      type: 'DECISION_CIRCULAR',
      stakeholder: 'MUNICIPALITY',
      stakeholderCustom: '',
      text: '',
      date: new Date().toISOString().split('T')[0], // Default to today
      source: ''
  });

  // Workshop Board State
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [boardNodes, setBoardNodes] = useState<BoardNode[]>([]);
  const [boardEdges, setBoardEdges] = useState<BoardEdge[]>([]);

  // Step 3
  const [outputFormat, setOutputFormat] = useState<PolicyOutputFormat>('BRIEF');
  const [detailLevel, setDetailLevel] = useState<'FAST' | 'DETAILED'>('FAST');
  const [outputLang, setOutputLang] = useState<PolicyOutputLanguage>('bilingual'); // Default to bilingual as per rules

  // Chat
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{id: string, role: 'user' | 'model', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<PolicyData>({
    country: '',
    city: '',
    district: '',
    sector: PolicySector.HOUSING,
    sectorCustom: '',
    objectives: [],
    policyContext: '',
    selectedSourceIds: [],
    customSources: [],
    saveSourcesToLibrary: false,
    painPoints: [],
    evidenceText: '',
    supportingFiles: [],
    outputLanguage: 'bilingual',
    boardNodes: [],
    boardEdges: [],
    priorities: { speed: 3, safety: 5, economy: 3, feasibility: 4 }
  });

  const [availableDocs, setAvailableDocs] = useState<LibraryDocument[]>([]);
  const [newObjective, setNewObjective] = useState('');
  const [newPainPoint, setNewPainPoint] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Sync available docs on load
  useEffect(() => {
    libraryDB.getAllDocuments().then(docs => setAvailableDocs(docs));
  }, []);

  // Sync Policy Data Language with Global App Language automatically
  useEffect(() => {
    setData(d => ({ 
        ...d, 
        outputLanguage: language === 'ar' ? 'ar' : 'en' 
    }));
    setOutputLang(language === 'ar' ? 'ar' : 'en');
  }, [language]);

  // Sync board state to persistent data
  useEffect(() => {
      setData(prev => ({...prev, boardNodes, boardEdges}));
  }, [boardNodes, boardEdges]);

  useEffect(() => {
    if (isChatOpen) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  const handleGenerate = async () => {
      setIsLoading(true);
      try {
          // Construct intent from objectives if explicit intent is empty
          let activeIntent = intent;
          if (!activeIntent && data.objectives.length > 0) {
              activeIntent = data.objectives.join('. ');
          }
          if (!activeIntent) activeIntent = "Analyze current regulations";

          if (data.saveSourcesToLibrary && data.customSources.length > 0) {
              for (const src of data.customSources) {
                  const doc: LibraryDocument = {
                      id: crypto.randomUUID(),
                      title: src.title,
                      fileName: src.type === 'FILE' ? src.title : undefined,
                      fileData: src.data,
                      url: src.url,
                      country: data.country || 'Unknown',
                      city: data.city,
                      codeType: CodeType.ZONING,
                      coverage: CoverageType.CITY_WIDE,
                      dateUploaded: Date.now(),
                      visibility: 'PRIVATE',
                      isLocalOwner: true,
                      notes: `Auto-saved from Policy Lab session: ${data.sector}`
                  };
                  await libraryDB.addDocument(doc);
              }
          }

          const selectedDocs = availableDocs.filter(d => data.selectedSourceIds.includes(d.id));
          
          const initialUpdate: PolicyUpdate = {
              intent: activeIntent,
              domain: domain,
              workshopNotes: [],
              outputFormat: 'BRIEF',
              detailLevel: 'FAST',
              language: outputLang
          };

          const html = await analyzePolicy(data, selectedDocs, language);
          
          const v1: PolicyVersion = {
              versionNumber: 1,
              timestamp: Date.now(),
              htmlContent: html,
              changeLogSummary: "Initial Generation"
          };
          
          setVersions([v1]);
          setCurrentVersionIndex(0);
          setStep(3);
      } catch (error) {
          console.error(error);
          alert("Analysis Failed. Please try again.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleUpdateRegenerate = async () => {
      if (versions.length === 0) return;
      setIsLoading(true);

      const currentVer = versions[currentVersionIndex];
      const nextVerNum = versions.length + 1;

      // Ensure data has the latest board state
      const currentData = { ...data, boardNodes, boardEdges };

      const updatePayload: PolicyUpdate = {
          intent: intent || data.objectives.join('. '),
          domain: domain,
          workshopNotes: workshopNotes,
          boardContext: { nodes: boardNodes, edges: boardEdges },
          outputFormat: outputFormat,
          detailLevel: detailLevel,
          language: outputLang
      };

      try {
          const { html, changeLog } = await refinePolicyReport(
              currentVer.htmlContent, 
              currentData, 
              updatePayload, 
              nextVerNum
          );

          const newVer: PolicyVersion = {
              versionNumber: nextVerNum,
              timestamp: Date.now(),
              htmlContent: html,
              changeLogSummary: changeLog || `Format: ${outputFormat}`,
              userUpdates: updatePayload
          };

          setVersions(prev => [...prev, newVer]);
          setCurrentVersionIndex(prev => prev + 1);
          setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: `Report updated to v${nextVerNum} based on workshop findings.` }]);

      } catch (error) {
          console.error("Refinement failed", error);
          alert("Failed to update report.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleSourceToggle = (id: string) => { setData(prev => ({...prev, selectedSourceIds: prev.selectedSourceIds.includes(id) ? prev.selectedSourceIds.filter(s => s!==id) : [...prev.selectedSourceIds, id]})) };
  const handleRemoveItem = (field: 'objectives' | 'painPoints', index: number) => { setData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) })) };
  
  const handleAddObjective = () => {
    if (!newObjective.trim()) return;
    setData(prev => ({ ...prev, objectives: [...prev.objectives, newObjective] }));
    setNewObjective('');
  };

  const handleAddPainPoint = () => {
    if (!newPainPoint.trim()) return;
    setData(prev => ({ ...prev, painPoints: [...prev.painPoints, newPainPoint] }));
    setNewPainPoint('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'EVIDENCE' | 'SOURCE') => {
      if (e.target.files && e.target.files.length > 0) {
          const files: File[] = Array.from(e.target.files);
          for (const file of files) {
              const base64 = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1]);
                  reader.readAsDataURL(file);
              });
              if (target === 'EVIDENCE') {
                  setData(prev => ({ ...prev, supportingFiles: [...(prev.supportingFiles || []), { name: file.name, type: file.type, data: base64 }] }));
              } else {
                  setData(prev => ({ ...prev, customSources: [...prev.customSources, { id: crypto.randomUUID(), type: 'FILE', title: file.name, data: base64 }] }));
              }
          }
      }
  };
  const handleAddLinkSource = () => { if (!newLinkUrl.trim()) return; setData(prev => ({ ...prev, customSources: [...prev.customSources, { id: crypto.randomUUID(), type: 'LINK', title: newLinkUrl, url: newLinkUrl }] })); setNewLinkUrl(''); };
  const removeCustomSource = (id: string) => { setData(prev => ({ ...prev, customSources: prev.customSources.filter(s => s.id !== id) })); };

  const removeSupportingFile = (index: number) => {
      const files = [...(data.supportingFiles || [])];
      files.splice(index, 1);
      setData(prev => ({ ...prev, supportingFiles: files }));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
      if (!versions[currentVersionIndex]) return;
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="UTF-8" />
          <title>CodeScout Pro - Decision Desk Report</title>
          <style>
            body { font-family: sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; color: #111; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #ccc; }
            th, td { padding: 10px; border: 1px solid #ccc; text-align: left; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          ${versions[currentVersionIndex].htmlContent}
        </body>
        </html>
      `;
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Decision_Brief_v${versions[currentVersionIndex].versionNumber}_${new Date().toISOString().slice(0,10)}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  // Helper for Input Styling
  const inputClass = "w-full h-11 px-3 border border-sand-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition text-sm text-slate-900 placeholder:text-sand-400 bg-white group-hover/input:border-sand-300";
  const labelClass = "block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono";

  return (
    <div className={`glass-card bg-white rounded-2xl border border-sand-200 shadow-xl overflow-hidden animate-in fade-in duration-300 relative group ${step === 3 ? 'w-full max-w-none border-none shadow-none rounded-none' : 'max-w-4xl mx-auto'}`}>
      
      {/* Decorative Top Line */}
      {step < 3 && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>}

      {/* Workshop Board Drawer */}
      <WorkshopBoard 
        nodes={boardNodes}
        edges={boardEdges}
        isOpen={isBoardOpen}
        onClose={() => setIsBoardOpen(false)}
        onUpdate={(n, e) => { setBoardNodes(n); setBoardEdges(e); }}
      />

      {/* App Header (Step 1&2 only) */}
      {step < 3 && (
        <div className="bg-sand-50/50 p-8 flex justify-between items-start border-b border-sand-200">
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">{t.authorityMode}</span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-cairo">{t.policyMode}</h2>
                <h3 className="text-xl font-semibold text-slate-700 mt-1 font-cairo">
                    {language === 'ar' ? 'الحوكمة العمرانية الاستراتيجية' : 'Strategic Urban Governance'}
                </h3>
                <div className="text-sm mt-3 font-medium min-h-[20px]">
                    <TypewriterText 
                        text={language === 'ar' 
                            ? 'بيئة ذكية لمحاكاة وتحديث الأنظمة العمرانية.' 
                            : 'Intelligent sandbox for simulating and updating urban codes.'} 
                    />
                </div>
            </div>
            <div className="flex gap-2.5">
                {[1,2,3].map(i => <div key={i} className={`w-3 h-3 rounded-full transition-colors ${step >= i ? 'bg-brand-500' : 'bg-sand-200'}`} />)}
            </div>
        </div>
      )}

      {step === 3 && versions.length > 0 ? (
          <div className="w-full mx-auto bg-sand-100 min-h-[calc(100vh-100px)] flex shadow-2xl rounded-xl overflow-hidden border border-sand-200">
             {/* LEFT SIDEBAR */}
             <aside className={`border-r border-sand-200 bg-white transition-all duration-300 flex flex-col ${isSidebarCollapsed ? 'w-16' : 'w-[400px] shrink-0'}`}>
                {/* Sidebar Header/Toggle */}
                <div className="p-4 border-b border-sand-200 flex items-center justify-between bg-white h-18">
                    {!isSidebarCollapsed && (
                        <div>
                             <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2"><Settings2 className="w-4 h-4" /> {t.decisionWizard}</h3>
                             <div className="text-[10px] text-slate-500 font-mono mt-0.5">{data.city}, {data.country}</div>
                        </div>
                    )}
                    <button 
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                        className={`p-2 rounded-lg hover:bg-sand-100 text-slate-400 hover:text-slate-900 transition ${isSidebarCollapsed ? 'mx-auto' : ''}`}
                    >
                        {isSidebarCollapsed ? <ChevronRightIcon className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* SECTION 1: POLICY FOCUS */}
                    <SidebarSection 
                        title={t.policyFocus} 
                        icon={Target} 
                        isOpen={openSections.focus} 
                        onToggle={() => toggleSection('focus')}
                        collapsed={isSidebarCollapsed}
                    >
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>{t.domain}</label>
                                <div className="text-sm font-medium text-slate-800 bg-white p-2 rounded border border-sand-200">{domain}</div>
                            </div>
                            <div>
                                <label className={labelClass}>{t.objectives}</label>
                                <ul className="space-y-1">
                                    {data.objectives.map((obj, i) => (
                                        <li key={i} className="text-xs text-brand-700 bg-brand-50/50 p-2 rounded border border-brand-100/50">{obj}</li>
                                    ))}
                                    {data.objectives.length === 0 && <span className="text-xs text-slate-400 italic">None</span>}
                                </ul>
                            </div>
                        </div>
                    </SidebarSection>

                    {/* SECTION 2: WORKSHOP REALITY */}
                    <SidebarSection 
                        title={t.workshopReality} 
                        icon={Users} 
                        isOpen={openSections.workshop} 
                        onToggle={() => toggleSection('workshop')}
                        collapsed={isSidebarCollapsed}
                    >
                        <div className="space-y-4">
                            <button 
                                onClick={() => setIsBoardOpen(true)}
                                className="w-full py-3 bg-white hover:bg-sand-50 text-slate-800 font-bold rounded-xl border border-sand-200 flex items-center justify-center gap-2 transition text-sm group shadow-sm"
                            >
                                <LayoutGrid className="w-4 h-4 group-hover:scale-110 transition-transform text-brand-500" />
                                {boardNodes.length > 0 ? `${t.manageBoard} (${boardNodes.length})` : t.openBoard}
                            </button>
                            
                            {boardNodes.length > 0 ? (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div className="bg-sand-50 p-2 rounded text-center border border-sand-200">
                                            <strong className="block text-base text-slate-900">{boardNodes.length}</strong> {t.cards}
                                        </div>
                                        <div className="bg-green-50 p-2 rounded text-center border border-green-100">
                                            <strong className="block text-base text-green-700">{boardNodes.filter(n => n.status === 'APPROVED').length}</strong> {t.approved}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleUpdateRegenerate}
                                        disabled={isLoading}
                                        className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-xs shadow-sm transition-all disabled:opacity-50"
                                    >
                                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                                        {t.integrateFindings}
                                    </button>
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-400 text-center italic">
                                    {language === 'ar' ? 'أضف بطاقات للوحة لدمج النتائج.' : 'Add cards to the board to enable integration.'}
                                </p>
                            )}
                        </div>
                    </SidebarSection>

                    {/* SECTION 3: CONFIGURATION */}
                    <SidebarSection 
                        title={t.configuration} 
                        icon={Sliders} 
                        isOpen={openSections.config} 
                        onToggle={() => toggleSection('config')}
                        collapsed={isSidebarCollapsed}
                    >
                         <div className="space-y-5">
                             {/* Priority Sliders */}
                             <div>
                                <label className={labelClass}>{t.priorities}</label>
                                <div className="space-y-3">
                                    {Object.entries(data.priorities).map(([key, val]) => (
                                        <div key={key} className="flex items-center gap-3">
                                            <span className="text-[10px] uppercase font-bold text-slate-400 w-16">{key}</span>
                                            <input 
                                                type="range" min="0" max="5" step="1"
                                                value={val}
                                                onChange={(e) => setData(prev => ({...prev, priorities: {...prev.priorities, [key]: parseInt(e.target.value)}}))}
                                                className="flex-1 accent-slate-900 h-1.5 bg-sand-200 rounded-lg appearance-none cursor-pointer"
                                            />
                                            <span className="text-xs font-mono font-bold w-4 text-right">{val}</span>
                                        </div>
                                    ))}
                                </div>
                             </div>

                             {/* Format Selection */}
                             <div className="grid grid-cols-1 gap-2">
                                {[
                                    { id: 'BRIEF', label: language === 'ar' ? 'موجز القرار' : 'Decision Brief' },
                                    { id: 'CONFLICT_MAP', label: language === 'ar' ? 'خريطة التعارضات' : 'Conflict Map' },
                                    { id: 'AMENDMENT', label: language === 'ar' ? 'مسودة التعديل' : 'Draft Amendment' },
                                    { id: 'PILOT', label: language === 'ar' ? 'حزمة تجريبية' : 'Pilot Package' },
                                    { id: 'CHECKLIST', label: language === 'ar' ? 'قائمة التحقق' : 'Review Checklist' }
                                ].map(opt => (
                                    <button 
                                        key={opt.id} 
                                        onClick={() => setOutputFormat(opt.id as PolicyOutputFormat)}
                                        className={`py-2 px-3 text-left rounded-lg text-xs font-bold transition-all border flex justify-between items-center ${outputFormat === opt.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-sand-200 text-slate-500 hover:border-sand-300'}`}
                                    >
                                        {opt.label}
                                        {outputFormat === opt.id && <CheckCircle className="w-3.5 h-3.5" />}
                                    </button>
                                ))}
                             </div>

                             <div className="flex gap-2">
                                <div className="flex-1">
                                    <div className="flex bg-sand-100 p-1 rounded-lg">
                                        <button onClick={() => setDetailLevel('FAST')} className={`flex-1 text-[10px] py-1.5 rounded-md font-semibold transition-all ${detailLevel === 'FAST' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>{language === 'ar' ? 'سريع' : 'Fast'}</button>
                                        <button onClick={() => setDetailLevel('DETAILED')} className={`flex-1 text-[10px] py-1.5 rounded-md font-semibold transition-all ${detailLevel === 'DETAILED' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>{language === 'ar' ? 'مفصل' : 'Detailed'}</button>
                                    </div>
                                </div>
                             </div>

                             <button 
                                onClick={handleUpdateRegenerate}
                                disabled={isLoading}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg transition-all transform active:scale-95 disabled:opacity-50"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                {t.updateConfig}
                            </button>
                         </div>
                    </SidebarSection>
                </div>
             </aside>

             {/* MAIN REPORT AREA - A4 VIEW */}
             <main className="flex-1 min-w-0 bg-sand-100/80 relative flex flex-col h-[calc(100vh-100px)]">
                 
                 {/* Sticky Top Bar */}
                 <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-sand-200 px-6 py-3 flex items-center justify-between shrink-0 h-18 shadow-sm">
                     {/* Left: Version Selector */}
                     <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                        <div className="flex bg-sand-100 p-1 rounded-lg gap-1 shrink-0">
                            {versions.map((v, idx) => (
                                <button
                                    key={v.versionNumber}
                                    onClick={() => setCurrentVersionIndex(idx)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${currentVersionIndex === idx ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    v{v.versionNumber}
                                </button>
                            ))}
                        </div>
                        <span className="text-xs text-slate-400 font-medium hidden md:inline-block border-l border-sand-200 pl-3 ml-1">
                           {new Date(versions[currentVersionIndex].timestamp).toLocaleTimeString()}
                        </span>
                     </div>

                     {/* Right: Actions */}
                     <div className="flex items-center gap-2">
                        <button onClick={handleDownload} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-sand-100 rounded-lg transition" title={t.downloadReport}>
                            <Download className="w-4 h-4" />
                        </button>
                        <button onClick={handlePrint} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-sand-100 rounded-lg transition" title={t.printReport}>
                            <Printer className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-sand-200 mx-1"></div>
                        <button onClick={() => setStep(1)} className="text-xs font-bold text-slate-500 hover:text-red-600 transition px-2">
                            {language === 'ar' ? 'خروج' : 'Exit'}
                        </button>
                     </div>
                 </div>

                 {/* Scrollable Report Content - A4 Simulator */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {/* Container to center the paper and provide padding */}
                      <div className="min-h-full py-12 px-4 md:px-8 flex justify-center items-start">
                           {/* The A4 Paper */}
                           <div className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-xl shadow-slate-200/60 border border-sand-200 relative animate-in zoom-in-95 duration-300 flex flex-col">
                                {/* Decorative "Hole Punch" circles for realistic feel (Optional, subtle) */}
                                <div className="absolute left-3 top-0 bottom-0 w-8 hidden print:hidden md:flex flex-col justify-between py-12 pointer-events-none opacity-20">
                                    <div className="w-3 h-3 rounded-full bg-sand-200/50"></div>
                                    <div className="w-3 h-3 rounded-full bg-sand-200/50"></div>
                                    <div className="w-3 h-3 rounded-full bg-sand-200/50"></div>
                                </div>

                                {/* Actual Content */}
                                <div className="p-8 md:p-16 print:p-0 flex-1">
                                     <AnalysisResult htmlContent={versions[currentVersionIndex].htmlContent} hideHeader={true} />
                                </div>

                                {/* Paper Footer */}
                                <div className="h-16 mt-auto border-t border-sand-100 flex items-center justify-between px-8 md:px-16 text-[10px] text-slate-400 font-mono bg-white rounded-b-sm">
                                    <span className="uppercase tracking-widest opacity-50">CodeScout Pro Policy Lab</span>
                                    <span className="opacity-50">Confidential</span>
                                </div>
                           </div>
                      </div>
                      
                      {/* Bottom Spacer to ensure comfortable scrolling past the end */}
                      <div className="h-12"></div>
                 </div>
             </main>
          </div>
      ) : (
        <div className="p-8 md:p-10 bg-white">
            {/* STEPS 1 & 2 VIEW (Pre-Analysis) - Remains centered */}
            <div className="space-y-8">
                {step === 1 && (
                    <div className="space-y-8 animate-in fade-in">
                        <div className="border-b border-sand-200 pb-5 mb-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-white border border-sand-200 rounded-xl flex items-center justify-center shadow-sm">
                                <Scale className="w-6 h-6 text-slate-700" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 font-cairo">{t.defineScope}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {['country', 'city', 'district'].map(field => (
                                <div key={field} className="group/input">
                                    <label className={labelClass}>{t[field] || field}</label>
                                    <input type="text" value={(data as any)[field]} onChange={e => setData({...data, [field]: e.target.value})} className={inputClass} placeholder={t[field] || field} />
                                </div>
                            ))}
                            <div className="group/input">
                                <label className={labelClass}>{t.sector}</label>
                                <select value={data.sector} onChange={e => setData({...data, sector: e.target.value as PolicySector})} className={inputClass}>
                                    {Object.values(PolicySector).map(s => <option key={s} value={s}>{getSectorLabel(s, language)}</option>)}
                                </select>
                                {data.sector === PolicySector.OTHER && (
                                    <input 
                                        type="text" 
                                        placeholder={language === 'ar' ? "حدد القطاع..." : "Specify Custom Sector..."} 
                                        value={data.sectorCustom || ''} 
                                        onChange={e => setData({...data, sectorCustom: e.target.value})}
                                        className={`${inputClass} mt-2 animate-in fade-in slide-in-from-top-1`}
                                    />
                                )}
                            </div>
                        </div>
                        
                        <div className="bg-sand-50/50 p-6 rounded-xl border border-sand-200 mt-4 space-y-6">
                            {/* Objectives */}
                            <div>
                                <label className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-brand-600" />
                                    {t.objectives}
                                </label>
                                <div className="flex gap-3 mb-3">
                                    <input 
                                        type="text" 
                                        value={newObjective} 
                                        onChange={e => setNewObjective(e.target.value)} 
                                        placeholder={language === 'ar' ? "مثال: زيادة الكثافة السكانية قرب المترو..." : "e.g. Increase housing density near metro stations..."}
                                        className={inputClass}
                                        onKeyDown={e => e.key === 'Enter' && handleAddObjective()} 
                                    />
                                    <button onClick={handleAddObjective} className="bg-white px-5 rounded-lg hover:bg-sand-50 transition border border-sand-200">
                                        <Plus className="w-5 h-5 text-slate-600" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2.5 min-h-[30px]">
                                    {data.objectives.length === 0 && <span className="text-xs text-slate-400 italic py-1">{language === 'ar' ? 'أضف هدفاً واحداً على الأقل.' : 'Add at least one objective.'}</span>}
                                    {data.objectives.map((obj, i) => (
                                        <span key={i} className="bg-brand-50 text-brand-700 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-2 border border-brand-100">
                                            {obj} 
                                            <button onClick={() => handleRemoveItem('objectives', i)} className="hover:text-brand-900"><X className="w-3.5 h-3.5" /></button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Context */}
                            <div>
                                <label className="block text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-amber-500" /> 
                                    {t.policyContext}
                                </label>
                                <textarea 
                                    value={data.policyContext || ''} 
                                    onChange={e => setData({...data, policyContext: e.target.value})} 
                                    className={`${inputClass} min-h-[100px] h-auto`}
                                    rows={3} 
                                    placeholder={language === 'ar' ? "صف الوضع الحالي، القيود السياسية، أو الأهداف الاستراتيجية..." : "Describe current situation, political constraints, or strategic goals..."} 
                                />
                            </div>

                            {/* Policy Domain */}
                            <div className="group/input">
                                <label className={labelClass}>{t.domain}</label>
                                <select 
                                    value={isCustomDomain ? 'Other' : domain}
                                    onChange={e => {
                                        if (e.target.value === 'Other') {
                                            setIsCustomDomain(true);
                                            setDomain('');
                                        } else {
                                            setIsCustomDomain(false);
                                            setDomain(e.target.value);
                                        }
                                    }}
                                    className={`${inputClass} mb-2`}
                                >
                                    <option>{language === 'ar' ? 'تقسيم المناطق واستخدام الأراضي' : 'Zoning & Land Use'}</option>
                                    <option>{language === 'ar' ? 'كود البناء' : 'Building Code'}</option>
                                    <option>{language === 'ar' ? 'الحريق والسلامة' : 'Fire & Safety'}</option>
                                    <option>{language === 'ar' ? 'النقل والمواقف' : 'Transportation & Parking'}</option>
                                    <option>{language === 'ar' ? 'بيئي' : 'Environmental'}</option>
                                    <option>{language === 'ar' ? 'تراث' : 'Heritage'}</option>
                                    <option>{language === 'ar' ? 'إداري وتراخيص' : 'Administrative & Permitting'}</option>
                                    <option value="Other">{language === 'ar' ? 'أخرى / مخصص' : 'Other / Custom'}</option>
                                </select>
                                
                                {isCustomDomain && (
                                    <input 
                                        type="text"
                                        value={domain}
                                        onChange={e => setDomain(e.target.value)}
                                        placeholder={language === 'ar' ? "حدد المجال..." : "Specify custom domain..."}
                                        className={`${inputClass} border-brand-200 bg-brand-50/50 focus:ring-brand-100`}
                                        autoFocus
                                    />
                                )}
                            </div>

                            {/* Policy Sources Upload */}
                            <div className="bg-white border border-sand-200 rounded-xl p-4">
                                <label className="block text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-slate-500" />
                                    {language === 'ar' ? 'وثائق السياسة ذات الصلة (اختياري)' : 'Relevant Policy Documents (Optional)'}
                                </label>
                                <div className="flex flex-col gap-3">
                                    <label className="flex items-center justify-center gap-2 px-4 py-3 bg-sand-50 border border-dashed border-sand-300 rounded-xl cursor-pointer hover:bg-sand-100 transition group">
                                        <UploadCloud className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                                        <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">{t.uploadPdf}</span>
                                        <input type="file" accept="application/pdf" multiple onChange={(e) => handleFileUpload(e, 'SOURCE')} className="hidden" />
                                    </label>
                                    
                                    {data.customSources.length > 0 && (
                                        <div className="space-y-2">
                                            {data.customSources.map(src => (
                                                <div key={src.id} className="flex justify-between items-center bg-white border border-sand-200 p-2.5 rounded-lg text-xs font-medium text-slate-700 shadow-sm">
                                                    <div className="flex items-center gap-2 truncate">
                                                        {src.type === 'FILE' ? <FileText className="w-3.5 h-3.5 text-brand-500" /> : <LinkIcon className="w-3.5 h-3.5 text-green-500" />}
                                                        <span className="truncate">{src.title}</span>
                                                    </div>
                                                    <button onClick={() => removeCustomSource(src.id)} className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-8 animate-in fade-in">
                        <div className="border-b border-sand-200 pb-5 mb-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-white border border-sand-200 rounded-xl flex items-center justify-center shadow-sm">
                                <Briefcase className="w-6 h-6 text-slate-700" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 font-cairo">{t.evidenceWorkshop}</h3>
                        </div>
                        
                        {/* LOCKED BOARD MSG */}
                        <div className="bg-sand-50/50 border border-sand-200 rounded-xl p-6 text-center">
                            <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-sand-200">
                                <LayoutGrid className="w-6 h-6 text-slate-300" />
                            </div>
                            <h4 className="text-slate-900 font-bold mb-1">{language === 'ar' ? 'لوحة الورشة مقفلة' : 'Workshop Board Locked'}</h4>
                            <p className="text-sm text-slate-500 mb-4">{language === 'ar' ? 'قم بتشغيل تحليل السياسة الأولي لفتح اللوحة التعاونية.' : 'Run the initial policy analysis first to unlock the collaborative board.'}</p>
                        </div>

                        {/* KEY PAIN POINTS */}
                        <div>
                            <label className={labelClass}>{t.painPoints}</label>
                            <div className="flex gap-3 mb-3">
                                <input 
                                    type="text" 
                                    value={newPainPoint} 
                                    onChange={e => setNewPainPoint(e.target.value)} 
                                    placeholder={language === 'ar' ? "مثال: كود الحريق يتعارض مع قواعد التراث" : "e.g. Fire safety code contradicts heritage rules"}
                                    className={inputClass}
                                    onKeyDown={e => e.key === 'Enter' && handleAddPainPoint()} 
                                />
                                <button onClick={handleAddPainPoint} className="bg-white px-5 rounded-lg hover:bg-sand-50 transition border border-sand-200 shadow-sm">
                                    <Plus className="w-5 h-5 text-slate-600" />
                                </button>
                            </div>
                            <ul className="space-y-2">
                                {data.painPoints.map((pt, i) => (
                                    <li key={i} className="text-sm flex items-center gap-3 text-slate-700 bg-amber-50/50 p-2.5 rounded-lg border border-amber-100">
                                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                                        {pt}
                                        <button onClick={() => handleRemoveItem('painPoints', i)} className="text-slate-400 hover:text-red-500 ml-auto p-1">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* QUALITATIVE CONTEXT */}
                        <div>
                            <label className={labelClass}>{t.qualitativeContext}</label>
                            <textarea 
                                value={data.evidenceText} 
                                onChange={e => setData({...data, evidenceText: e.target.value})} 
                                className={`${inputClass} min-h-[100px] h-auto`}
                                placeholder={language === 'ar' ? "صف حوادث معينة، ملاحظات أصحاب المصلحة، أو مشاهدات ميدانية..." : "Describe specific incidents, stakeholder feedback, or field observations..."}
                            />
                        </div>

                        {/* EVIDENCE FILE UPLOAD */}
                        <div className="bg-white border border-sand-200 rounded-xl p-4">
                            <label className="block text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <UploadCloud className="w-4 h-4 text-slate-500" />
                                {t.uploadEvidence}
                            </label>
                            <div className="flex flex-col gap-3">
                                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-sand-50 border border-dashed border-sand-300 rounded-xl cursor-pointer hover:bg-sand-100 transition group">
                                    <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">{t.uploadPdf}</span>
                                    <input type="file" multiple onChange={(e) => handleFileUpload(e, 'EVIDENCE')} className="hidden" />
                                </label>
                                {/* List uploaded evidence files */}
                                {data.supportingFiles && data.supportingFiles.length > 0 && (
                                    <div className="space-y-2">
                                        {data.supportingFiles.map((file, idx) => (
                                            <div key={idx} className="flex justify-between items-center bg-white border border-sand-200 p-2.5 rounded-lg text-xs font-medium text-slate-700 shadow-sm">
                                                <div className="flex items-center gap-2 truncate">
                                                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="truncate">{file.name}</span>
                                                </div>
                                                <button onClick={() => removeSupportingFile(idx)} className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Output Language */}
                        <div className="border-t border-sand-200 pt-6 bg-sand-50/50 p-6 rounded-xl border border-sand-200">
                            <label className="block text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><Globe className="w-5 h-5" /> {language === 'ar' ? 'لغة المخرجات' : 'Output Language'}</label>
                            <div className="flex gap-6">
                                {['en', 'ar', 'bilingual'].map(l => (
                                    <label key={l} className="flex items-center gap-3 cursor-pointer group">
                                        <input 
                                            type="radio" 
                                            name="lang" 
                                            value={l} 
                                            checked={data.outputLanguage === l} 
                                            onChange={() => {
                                                setData({...data, outputLanguage: l as any});
                                                setOutputLang(l as any);
                                            }} 
                                            className="w-4 h-4 accent-slate-900" 
                                        />
                                        <span className="text-sm font-semibold text-slate-600 uppercase group-hover:text-slate-900 transition">{l}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-10 pt-8 border-t border-sand-200 flex justify-end gap-4">
                    {step > 1 && <button onClick={() => setStep(prev => (prev - 1) as any)} className="px-6 py-3 text-slate-600 font-bold hover:bg-sand-100 rounded-xl transition">{t.back}</button>}
                    {step === 1 && <button onClick={() => setStep(2)} disabled={!data.country || !data.city || data.objectives.length === 0} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-3 shadow-lg transition transform active:scale-95">{t.nextEvidence} <ArrowRight className="w-5 h-5" /></button>}
                    {step === 2 && <button onClick={handleGenerate} disabled={isLoading || (!data.painPoints.length && data.objectives.length === 0)} className="bg-slate-900 text-white px-10 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-3 shadow-lg transition transform active:scale-95">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gavel className="w-5 h-5" />} {isLoading ? (language === 'ar' ? 'جاري التحليل...' : 'Analyzing...') : t.generateDraft}</button>}
                </div>
            </div>
        </div>
      )}

    </div>
  );
};
export default PolicyLab;