import React, { useState, createContext, useEffect } from 'react';
import { Map, Scale, ArrowRightLeft, FileText, Loader2, Info, Globe2, BookOpen, Gavel, ChevronRight, Zap, Code2, LayoutDashboard, ScanLine, Cpu, Layers, ShieldCheck, Check, ExternalLink, User, LogIn, LogOut, ShieldAlert, BarChart3, RefreshCw, AlertCircle } from 'lucide-react';
import InputForm from './components/InputForm';
import AnalysisResult from './components/AnalysisResult';
import CodeLibrary from './components/CodeLibrary';
import { PolicyLab } from './components/PolicyLab';
import ChatAssistant from './components/ChatAssistant';
import { analyzeZoning, translateReport, fetchUsageStatus, fetchAdminStats, toggleAdminKillSwitch, QuotaStatus } from './services/geminiService';
import { subscribeToAuth, signInWithGoogle, signOutUser, AuthUser } from './services/firebaseClient';
import { PlotData, AnalysisMode, AnalysisState, Language } from './types';

// --- Language Context ---
export const LanguageContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Record<string, string>;
}>({
  language: 'en',
  setLanguage: () => {},
  t: {},
});

// --- Typewriter Component ---
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
    }, 20);

    return () => clearInterval(timer);
  }, [text]);

  return (
    <span className="inline-block text-slate-600 font-medium tracking-tight">
      {displayedText}
      <span className="inline-block w-0.5 h-5 bg-brand-500 ml-0.5 animate-pulse align-middle"></span>
    </span>
  );
};

// --- Translation Dictionary ---
const dictionary: Record<Language, Record<string, string>> = {
  en: {
    alertLocation: "Please enter a location (Address or GPS) to open Maps.",
    addressNotFound: "Address not found. Please verify spelling or use GPS coordinates.",
    locationDetails: "Location Details",
    drawBoundary: "Draw Boundary",
    locateMaps: "Locate on Maps",
    country: "Country",
    city: "City",
    address: "Address",
    district: "District",
    gps: "GPS Coordinates",
    plotGeometry: "Plot Geometry",
    width: "Width (m)",
    depth: "Depth (m)",
    streetWidth: "Main Street Width (m)",
    secondaryStreetWidth: "Side Street Width (m) (Optional)",
    plotArea: "Plot Area",
    projectType: "Proposed Project Type",
    projectPlaceholder: "e.g., Residential Complex, Office Tower, Mixed-Use...",
    projectDescription: "Detailed Project Program (Optional)",
    descPlaceholder: "Describe the full program: e.g., Ground floor retail, 3 floors office, rooftop restaurant, requiring heavy visitor parking...",
    specificFocus: "Specific Focus (Optional)",
    focusPlaceholder: "e.g., parking requirements, height limit...",
    focusHint: "Leave empty for full regulation analysis",
    // File Upload
    uploadDocs: "Upload Official Codes (PDF)",
    uploadHint: "Attach zoning regulations or municipal codes to prioritize them in analysis.",
    fileTooLarge: "File is too large. Max 10MB per file.",
    removeFile: "Remove",
    // App Headings
    appTitle: "CodeScout",
    appSubtitle: "AI",
    mainTitle: "Intelligent Zoning Engine",
    mainDesc: "Transform complex municipal codes into clear, actionable development parameters. Extract setbacks, FAR, and height limits in seconds.",
    singleMode: "Single Plot",
    compareMode: "Compare Plots",
    libraryMode: "Library",
    policyMode: "Policy Lab",
    optionA: "Option A (Base Scenario)",
    optionB: "Option B (Alternative Scenario)",
    plotDetails: "Plot Data",
    analyzeBtn: "Run AI Analysis",
    analyzing: "Processing Neural Network...",
    analysisFailed: "Analysis Failed",
    footer: "CodeScout AI. Engineering Intelligence.",
    translateTo: "Translate to Arabic",
    developedBy: "Developed by Mohammed Sayed. All rights reserved.",
    researchPurpose: "Research Preview: Verify all outputs with official authorities.",
    downloadReport: "Download HTML",
    printReport: "Print / Save PDF",
    // Library
    myLibrary: "My Library",
    communityHub: "Community Hub",
    searchLib: "Search by title, city, or country...",
    filterCountry: "Filter Country...",
    allTypes: "All Types",
    uploadRegulation: "Upload Regulation",
    addRegulation: "Add Regulation",
    privateOnlyMe: "Private (Only Me)",
    shareCommunity: "Share with Community",
    uploadPdf: "Upload PDF",
    addLink: "Add Link",
    startUpload: "Start Upload",
    saveLink: "Save Link",
    cancel: "Cancel",
    docTitle: "Document Title",
    codeType: "Code Type",
    authority: "Authority",
    year: "Year / Version",
    notes: "Notes",
    officialUrl: "Official Document URL",
    // Policy Lab
    authorityMode: "Authority Mode",
    decisionWizard: "Decision Wizard",
    policyFocus: "Policy Focus",
    workshopReality: "Workshop Reality",
    configuration: "Configuration",
    domain: "Domain",
    objectives: "Objectives",
    sector: "Sector",
    openBoard: "Open Board",
    manageBoard: "Manage Board",
    integrateFindings: "Integrate Findings",
    priorities: "Priorities (Weights)",
    outputFormat: "Output Format",
    detailLevel: "Detail Level",
    updateConfig: "Update Configuration",
    generateDraft: "Generate Policy Draft",
    defineScope: "1. Define Scope",
    evidenceWorkshop: "2. Evidence & Workshop",
    policyContext: "Policy Context",
    painPoints: "Key Pain Points",
    qualitativeContext: "Qualitative Context",
    uploadEvidence: "Upload Evidence / Data",
    nextEvidence: "Next: Evidence",
    back: "Back",
    // Workshop Board
    workshopBoard: "Workshop Board",
    startFindings: "Start from Findings",
    editCard: "Edit Card",
    title: "Title",
    type: "Type",
    description: "Description",
    stakeholder: "Stakeholder",
    saveChanges: "Save Changes",
    markApproved: "Mark as Approved",
    approved: "Approved",
    draft: "Draft",
    cards: "Cards",
    links: "Links",
    // Common
    loading: "Loading...",
    emptyLib: "Your library is empty",
    emptyCommunity: "No community docs found",
    verified: "VERIFIED"
  },
  ar: {
    alertLocation: "يرجى إدخال الموقع (العنوان أو الإحداثيات) لفتح الخرائط.",
    addressNotFound: "العنوان غير موجود. يرجى التحقق من الإملاء أو استخدام إحداثيات GPS.",
    locationDetails: "تفاصيل الموقع",
    drawBoundary: "رسم الحدود",
    locateMaps: "تحديد على الخريطة",
    country: "الدولة",
    city: "المدينة",
    address: "العنوان",
    district: "الحي / المنطقة",
    gps: "الإحداثيات (GPS)",
    plotGeometry: "أبعاد الأرض",
    width: "العرض (م)",
    depth: "العمق (م)",
    streetWidth: "عرض الشارع الرئيسي (م)",
    secondaryStreetWidth: "عرض الشارع الفرعي (م) (اختياري)",
    plotArea: "مساحة الأرض",
    projectType: "نوع المشروع المقترح",
    projectPlaceholder: "مثال: مجمع سكني، برج مكتبي، متعدد الاستخدامات...",
    projectDescription: "برنامج المشروع التفصيلي (اختياري)",
    descPlaceholder: "صف البرنامج بالكامل: مثال: تجاري أرضي، 3 طوابق مكاتب، مطعم بالسطح، احتياج مواقف زوار...",
    specificFocus: "تركيز محدد (اختياري)",
    focusPlaceholder: "مثال: متطلبات المواقف، حد الارتفاع...",
    focusHint: "اتركه فارغاً للحصول على تحليل شامل",
    // File Upload
    uploadDocs: "رفع ملفات الكود (PDF)",
    uploadHint: "أرفق أنظمة البناء أو الكود البلدي لاستخدامها كمصدر أساسي للتحليل.",
    fileTooLarge: "الملف كبير جداً. الحد الأقصى 10 ميجابايت للملف.",
    removeFile: "إزالة",
    // App Headings
    appTitle: "كود سكاوت",
    appSubtitle: "الذكاء الاصطناعي",
    mainTitle: "محرك تحليل الأنظمة الذكي",
    mainDesc: "حول أكواد البناء المعقدة إلى محددات تطوير واضحة. استخرج الارتدادات، نسب البناء، وحدود الارتفاع في ثوانٍ.",
    singleMode: "تحليل أرض واحدة",
    compareMode: "مقارنة الخيارات",
    libraryMode: "المكتبة الرقمية",
    policyMode: "مختبر السياسات",
    optionA: "الخيار الأول (الأساسي)",
    optionB: "الخيار الثاني (البديل)",
    plotDetails: "بيانات الأرض",
    analyzeBtn: "بدء تحليل الذكاء الاصطناعي",
    analyzing: "جاري المعالجة العصبية...",
    analysisFailed: "فشل التحليل",
    footer: "كود سكاوت AI. ذكاء هندسي.",
    translateTo: "ترجم إلى الإنجليزية",
    developedBy: "تم التطوير بواسطة محمد سيد. جميع الحقوق محفوظة.",
    researchPurpose: "نسخة بحثية: يجب التحقق من المخرجات مع الجهات الرسمية.",
    downloadReport: "تحميل HTML",
    printReport: "طباعة / PDF",
    // Library
    myLibrary: "مكتبتي",
    communityHub: "المجتمع",
    searchLib: "بحث بالعنوان، المدينة، أو الدولة...",
    filterCountry: "تصفية بالدولة...",
    allTypes: "كل الأنواع",
    uploadRegulation: "إضافة لائحة",
    addRegulation: "إضافة وثيقة",
    privateOnlyMe: "خاص (لي فقط)",
    shareCommunity: "مشاركة مع المجتمع",
    uploadPdf: "رفع ملف PDF",
    addLink: "إضافة رابط",
    startUpload: "بدء الرفع",
    saveLink: "حفظ الرابط",
    cancel: "إلغاء",
    docTitle: "عنوان الوثيقة",
    codeType: "نوع الكود",
    authority: "الجهة المسؤولة",
    year: "السنة / الإصدار",
    notes: "ملاحظات",
    officialUrl: "رابط الوثيقة الرسمي",
    // Policy Lab
    authorityMode: "وضع الهيئة",
    decisionWizard: "معالج القرارات",
    policyFocus: "محور السياسة",
    workshopReality: "واقع الورشة",
    configuration: "الإعدادات",
    domain: "المجال",
    objectives: "الأهداف",
    sector: "القطاع",
    openBoard: "فتح اللوحة",
    manageBoard: "إدارة اللوحة",
    integrateFindings: "دمج النتائج",
    priorities: "الأولويات (الأوزان)",
    outputFormat: "تنسيق المخرجات",
    detailLevel: "مستوى التفاصيل",
    updateConfig: "تحديث الإعدادات",
    generateDraft: "إنشاء مسودة السياسة",
    defineScope: "1. تحديد النطاق",
    evidenceWorkshop: "2. الأدلة وورشة العمل",
    policyContext: "سياق السياسة",
    painPoints: "نقاط الألم الرئيسية",
    qualitativeContext: "السياق النوعي / الواقع",
    uploadEvidence: "رفع الأدلة / البيانات",
    nextEvidence: "التالي: الأدلة",
    back: "رجوع",
    // Workshop Board
    workshopBoard: "لوحة ورشة العمل",
    startFindings: "البدء من النتائج",
    editCard: "تعديل البطاقة",
    title: "العنوان",
    type: "النوع",
    description: "الوصف",
    stakeholder: "صاحب المصلحة",
    saveChanges: "حفظ التغييرات",
    markApproved: "تعيين كمعتمد",
    approved: "معتمد",
    draft: "مسودة",
    cards: "بطاقات",
    links: "روابط",
    // Common
    loading: "جاري التحميل...",
    emptyLib: "مكتبتك فارغة",
    emptyCommunity: "لا توجد مستندات مجتمعية",
    verified: "تم التحقق"
  }
};

const initialPlotData: PlotData = {
  id: '1',
  name: 'Option A',
  country: '',
  city: '',
  address: '',
  district: '',
  gps: '',
  projectType: '',
  width: '',
  depth: '',
  streetWidth: '',
  secondaryStreetWidth: '',
  plotArea: '',
  projectDescription: '',
  specificFocus: '',
  plotOrientation: 'Mid-block',
  attachments: []
};

type ViewMode = 'ANALYSIS' | 'LIBRARY' | 'POLICY';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('en');
  const [viewMode, setViewMode] = useState<ViewMode>('ANALYSIS');
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(AnalysisMode.SINGLE);
  
  const [dataA, setDataA] = useState<PlotData>({ ...initialPlotData, id: 'A', name: 'Option A' });
  const [dataB, setDataB] = useState<PlotData>({ ...initialPlotData, id: 'B', name: 'Option B' });

  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isLoading: false,
    result: null,
    error: null,
    groundingMetadata: null
  });

  // --- Authentication & Centralized Free Quota State ---
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus>({
    allowed: true,
    status: 200,
    userRemaining: 3,
    globalRemaining: 30,
    dateUtc: new Date().toISOString().split('T')[0],
  });

  // --- Admin Dashboard State ---
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminStats, setAdminStats] = useState<any | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  // --- Auth Flow State ---
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const isAdmin = authUser?.email?.toLowerCase().trim() === 'mahmedzsayed@gmail.com';

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setAuthUser(user);
      if (user) {
        fetchUsageStatus().then(setQuotaStatus).catch(() => {});
      }
    });
    fetchUsageStatus().then(setQuotaStatus).catch(() => {});
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setAuthError(null);
      const user = await signInWithGoogle();
      setAuthUser(user);
      setIsAuthModalOpen(false);
      const updated = await fetchUsageStatus();
      setQuotaStatus(updated);
    } catch (e: any) {
      console.warn("Sign-in notice:", e?.message || e);
      setAuthError(e?.message || "Sign-in was not completed. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setAuthUser(null);
      setIsUserMenuOpen(false);
      const updated = await fetchUsageStatus();
      setQuotaStatus(updated);
    } catch (e) {
      console.error("Sign-out failed:", e);
    }
  };

  const handleOpenAdmin = async () => {
    setIsAdminModalOpen(true);
    setIsUserMenuOpen(false);
    setAdminLoading(true);
    try {
      const stats = await fetchAdminStats();
      setAdminStats(stats);
    } catch (err: any) {
      console.error("Failed to load admin stats:", err);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleToggleKillSwitch = async () => {
    if (!adminStats) return;
    try {
      const res = await toggleAdminKillSwitch(!adminStats.aiDisabled);
      setAdminStats((prev: any) => ({ ...prev, aiDisabled: res.aiDisabled }));
      const updated = await fetchUsageStatus();
      setQuotaStatus(updated);
    } catch (err) {
      console.error("Kill switch error:", err);
    }
  };

  const t = dictionary[language];

  const handleAnalyze = async () => {
    if (!authUser) {
      setIsAuthModalOpen(true);
      return;
    }
    setAnalysisState({ isLoading: true, result: null, error: null, groundingMetadata: null });
    try {
      const { html, groundingMetadata } = await analyzeZoning(analysisMode, dataA, analysisMode === AnalysisMode.COMPARISON ? dataB : undefined, language);
      setAnalysisState({
        isLoading: false,
        result: html,
        error: null,
        groundingMetadata
      });
      fetchUsageStatus().then(setQuotaStatus).catch(() => {});
    } catch (error: any) {
      setAnalysisState({
        isLoading: false,
        result: null,
        error: error.message || "An unknown error occurred",
        groundingMetadata: null
      });
      fetchUsageStatus().then(setQuotaStatus).catch(() => {});
    }
  };

  const handleTranslateReportHandler = async (targetLang: Language) => {
    if (!analysisState.result) return;
    setLanguage(targetLang);
    try {
      const translatedHtml = await translateReport(analysisState.result, targetLang);
      setAnalysisState(prev => ({
        ...prev,
        result: translatedHtml
      }));
    } catch (e) {
      console.error("Translation failed", e);
    }
  };

  const updatePlotData = (plot: 'A' | 'B', field: keyof PlotData, value: any) => {
    if (plot === 'A') {
      setDataA(prev => ({ ...prev, [field]: value }));
    } else {
      setDataB(prev => ({ ...prev, [field]: value }));
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div className={`min-h-screen font-sans text-slate-800 ${language === 'ar' ? 'dir-rtl' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        
        {/* Light Glass Navbar */}
        <nav className="fixed top-0 inset-x-0 z-50 glass-panel transition-all duration-300">
          <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
            {/* Logo Area (Modernized) */}
            <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setViewMode('ANALYSIS')}>
              <div className="relative">
                 {/* Glowing Effect */}
                 <div className="absolute -inset-2 bg-gradient-to-tr from-brand-300/40 to-brand-100/40 rounded-full blur-md opacity-0 group-hover:opacity-100 transition duration-500"></div>
                 {/* Main Icon Container - Modern Stack */}
                 <div className="relative w-11 h-11 bg-gradient-to-br from-white to-sand-50 rounded-xl border border-sand-200 shadow-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                    <Layers className="absolute w-5 h-5 text-sand-400 translate-y-0.5 group-hover:translate-y-1 transition-transform" strokeWidth={1.5} />
                    <Cpu className="absolute w-5 h-5 text-brand-600 -translate-y-0.5 group-hover:-translate-y-1 transition-transform" strokeWidth={1.5} />
                 </div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none flex items-center gap-1.5 font-cairo">
                  {t.appTitle}
                  <div className="relative overflow-hidden rounded-md px-1.5 py-0.5 bg-slate-900 shadow-sm">
                      <span className="relative z-10 text-[10px] text-white font-mono font-bold tracking-widest">PRO</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-400 opacity-20 animate-shine"></div>
                  </div>
                </h1>
                <span className="text-[9px] text-slate-400 font-bold tracking-[0.2em] uppercase group-hover:text-brand-600 transition-colors">Neural Engine V2.0</span>
              </div>
            </div>
            
            {/* Center Navigation Pills (Modernized) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex bg-white/90 backdrop-blur-xl p-1.5 rounded-2xl border border-sand-200 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.1)] gap-1.5 ring-1 ring-white/50">
              {[
                  { id: 'ANALYSIS', icon: Scale, label: t.singleMode },
                  { id: 'LIBRARY', icon: BookOpen, label: t.libraryMode },
                  { id: 'POLICY', icon: LayoutDashboard, label: t.policyMode }
              ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as ViewMode)}
                    className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all duration-300 relative overflow-hidden group ${
                        viewMode === mode.id 
                        ? 'text-white shadow-lg shadow-brand-500/30 ring-1 ring-brand-400/20' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-sand-50'
                    }`}
                  >
                    {/* Active Background Gradient */}
                    {viewMode === mode.id && (
                        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-[length:200%_auto] animate-shine"></div>
                    )}
                    
                    <mode.icon className={`w-4 h-4 relative z-10 ${viewMode === mode.id ? 'text-brand-300' : 'group-hover:scale-110 transition-transform'}`} strokeWidth={viewMode === mode.id ? 2 : 1.5} />
                    <span className="relative z-10">{mode.label}</span>
                  </button>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* If Signed In: Live Quota Badge & Profile Menu */}
              {authUser ? (
                <div className="relative flex items-center gap-2">
                  {/* Quota Badge */}
                  <div
                    title={`Free AI Quota: ${quotaStatus.userRemaining} of 3 remaining today`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      quotaStatus.userRemaining > 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${quotaStatus.userRemaining > 0 ? 'text-emerald-500 fill-emerald-500' : 'text-rose-500'}`} />
                    <span className="hidden sm:inline">
                      {language === 'ar'
                        ? `${quotaStatus.userRemaining}/3 تحليلات متاحة`
                        : `${quotaStatus.userRemaining}/3 Free Today`}
                    </span>
                    <span className="sm:hidden">{quotaStatus.userRemaining}/3</span>
                  </div>

                  {/* User Profile Avatar Button */}
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-brand-400 transition"
                  >
                    {authUser.photoURL ? (
                      <img
                        src={authUser.photoURL}
                        alt={authUser.displayName || 'User'}
                        className="w-8 h-8 rounded-full border border-sand-300 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                        {(authUser.displayName || authUser.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </button>

                  {/* User Dropdown Menu */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-12 w-64 bg-white rounded-2xl shadow-2xl border border-sand-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-3 border-b border-sand-100">
                        <p className="font-bold text-xs text-slate-900 truncate">
                          {authUser.displayName || 'Authorized User'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{authUser.email}</p>
                        <div className="mt-2 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-1 rounded-lg">
                          {language === 'ar'
                            ? `باقي ${quotaStatus.userRemaining} من 3 تحليلات اليوم`
                            : `${quotaStatus.userRemaining} of 3 free analyses remaining today`}
                        </div>
                      </div>

                      {isAdmin && (
                        <button
                          onClick={handleOpenAdmin}
                          className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <BarChart3 className="w-4 h-4 text-brand-600" />
                          <span>Admin Usage Dashboard</span>
                        </button>
                      )}

                      <button
                        onClick={handleSignOut}
                        className="w-full px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* If Not Signed In: Google Sign-In Button */
                <button
                  onClick={handleSignIn}
                  className="flex items-center gap-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition px-3.5 py-2 rounded-xl shadow-sm"
                >
                  <LogIn className="w-3.5 h-3.5 text-brand-400" />
                  <span>{language === 'ar' ? 'دخول عبر Google' : 'Sign in with Google'}</span>
                </button>
              )}

              {/* Language Switcher */}
              <button 
                onClick={toggleLanguage}
                className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition px-3 py-2 rounded-xl hover:bg-white border border-transparent hover:border-sand-200 hover:shadow-sm"
              >
                <div className="w-6 h-6 bg-sand-100 rounded-full flex items-center justify-center border border-sand-200">
                    <Globe2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </div>
                {language === 'en' ? 'العربية' : 'English'}
              </button>
            </div>
          </div>
        </nav>

        {/* Spacer for fixed nav */}
        <div className="h-28"></div>

        {/* Main Content Area */}
        <main className={`mx-auto px-6 py-4 pb-20 ${viewMode === 'POLICY' ? 'max-w-[1600px]' : 'max-w-7xl'}`}>
          
          {viewMode === 'LIBRARY' ? (
            <CodeLibrary />
          ) : viewMode === 'POLICY' ? (
            <PolicyLab />
          ) : (
            <>
              {/* Hero Section */}
              <div className="relative text-center max-w-3xl mx-auto mb-16 animate-in slide-in-from-bottom-8 duration-700 fade-in fill-mode-backwards print:hidden">
                <h2 className="relative text-5xl md:text-7xl font-black tracking-tight text-slate-900 mb-6 leading-[1.1] drop-shadow-sm">
                    {t.mainTitle}
                </h2>
                <div className="relative text-lg text-slate-500 leading-relaxed font-medium max-w-2xl mx-auto min-h-[56px] flex items-start justify-center">
                  <TypewriterText text={t.mainDesc} />
                </div>
                
                {/* Mode Switcher */}
                <div className="relative mt-12 inline-flex bg-white/50 backdrop-blur-md p-1.5 rounded-2xl border border-white shadow-xl shadow-slate-200/50">
                  <button
                    onClick={() => setAnalysisMode(AnalysisMode.SINGLE)}
                    className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                      analysisMode === AnalysisMode.SINGLE 
                        ? 'bg-white border border-slate-100 text-slate-900 shadow-md transform scale-105' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/50 border border-transparent'
                    }`}
                  >
                    <div className={`p-1 rounded-md ${analysisMode === AnalysisMode.SINGLE ? 'bg-slate-900 text-white' : 'bg-sand-200 text-slate-400'}`}>
                        <Scale className="w-3.5 h-3.5" strokeWidth={2} />
                    </div>
                    {t.singleMode}
                  </button>
                  <button
                    onClick={() => setAnalysisMode(AnalysisMode.COMPARISON)}
                    className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                      analysisMode === AnalysisMode.COMPARISON 
                        ? 'bg-white border border-slate-100 text-slate-900 shadow-md transform scale-105' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-white/50 border border-transparent'
                    }`}
                  >
                    <div className={`p-1 rounded-md ${analysisMode === AnalysisMode.COMPARISON ? 'bg-slate-900 text-white' : 'bg-sand-200 text-slate-400'}`}>
                        <ArrowRightLeft className="w-3.5 h-3.5" strokeWidth={2} />
                    </div>
                    {t.compareMode}
                  </button>
                </div>
              </div>

              {/* Forms Grid */}
              <div className={`grid gap-8 ${analysisMode === AnalysisMode.COMPARISON ? 'lg:grid-cols-2' : 'max-w-4xl mx-auto'} print:hidden relative z-10`}>
                <InputForm 
                  data={dataA} 
                  onChange={(field, val) => updatePlotData('A', field, val)} 
                  title={analysisMode === AnalysisMode.COMPARISON ? t.optionA : t.plotDetails}
                  isActive={true}
                />
                
                <InputForm 
                  data={dataB} 
                  onChange={(field, val) => updatePlotData('B', field, val)} 
                  title={t.optionB}
                  isActive={analysisMode === AnalysisMode.COMPARISON}
                />
              </div>

              {/* Action Button */}
              <div className="mt-16 flex justify-center print:hidden relative z-20">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-sand-300 to-transparent opacity-50"></div>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={analysisState.isLoading}
                  className="relative group bg-slate-900 hover:bg-brand-600 text-white text-lg font-bold px-16 py-6 rounded-3xl shadow-2xl shadow-slate-900/20 hover:shadow-brand-500/40 transition-all duration-500 disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-1 active:translate-y-0 w-full max-w-md flex items-center justify-center gap-4 overflow-hidden border border-slate-800 ring-4 ring-white/50"
                >
                  {analysisState.isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin text-white/70" />
                      <span className="text-white">{t.analyzing}</span>
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                      <Zap className="w-6 h-6 fill-brand-300 text-brand-300 group-hover:text-white group-hover:fill-white transition-colors" />
                      <span className="tracking-wide">{t.analyzeBtn}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error Message */}
              {analysisState.error && (
                <div className="max-w-3xl mx-auto mt-10 p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 text-red-800 animate-in fade-in print:hidden shadow-sm">
                  <div className="bg-white p-2 rounded-full shadow-sm border border-red-50">
                    <Info className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-red-900">{t.analysisFailed}</h4>
                    <p className="text-sm opacity-80">{analysisState.error}</p>
                  </div>
                </div>
              )}

              {/* Result */}
              {analysisState.result && (
                <div className="max-w-5xl mx-auto mt-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <AnalysisResult 
                    htmlContent={analysisState.result} 
                    groundingMetadata={analysisState.groundingMetadata}
                    onTranslate={handleTranslateReportHandler}
                  />
                </div>
              )}
            </>
          )}

          {/* Chat Assistant */}
          <ChatAssistant 
             plotData={dataA} 
             analysisResult={analysisState.result} 
          />

        </main>

        {/* Footer */}
        <footer className="border-t border-sand-200 py-12 mt-20 print:hidden bg-white/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 mb-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                <div className="bg-white text-slate-900 p-1.5 rounded-lg border border-sand-200 shadow-sm">
                    <Cpu className="w-4 h-4" />
                </div>
                <span className="font-bold text-slate-900">{t.appTitle}</span>
            </div>
            <p className="text-sm font-semibold text-slate-500">{t.footer}</p>
            <p className="text-sm text-slate-400 mt-2">{t.developedBy}</p>
            <div className="mt-6">
                <span className="text-[10px] font-mono text-slate-400 border border-sand-200 px-2 py-1 rounded bg-white shadow-sm">
                    {t.researchPurpose}
                </span>
            </div>
          </div>
        </footer>

        {/* --- Sign-in Required Modal --- */}
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-sand-200 p-6 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-sand-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center">
                    <LogIn className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {language === 'ar' ? 'تسجيل الدخول مطلوب' : 'Sign In with Google'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {language === 'ar' ? 'وصول مجاني بدون إعداد مفاتيح' : 'Free Public AI Access'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-sand-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
                >
                  ✕
                </button>
              </div>

              <div className="py-6 space-y-4 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-3xl mx-auto flex items-center justify-center text-brand-600 shadow-inner">
                  <Zap className="w-8 h-8 fill-brand-500 text-brand-500" />
                </div>
                <h4 className="text-lg font-black text-slate-900">
                  {language === 'ar' ? 'ابدأ تحليلك المجاني اليوم' : '3 Free AI Analyses Available Today'}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                  {language === 'ar'
                    ? 'سجل دخولك بحساب Google لبدء التحليل الفوري. لا تحتاج إلى إدخال أي مفاتيح API أو بطاقات دفع.'
                    : 'Sign in with your Google account to run instant zoning and policy reports. No API key setup or payment required.'}
                </p>

                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-[11px] text-emerald-800 flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {language === 'ar'
                      ? 'خدمة مجانية بالكامل مدعومة بـ Cloudflare Workers و Google Gemini Free Tier'
                      : '100% Free Public Beta powered by Cloudflare Workers & Google Gemini'}
                  </span>
                </div>

                {authError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 text-left flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <span className="leading-tight">{authError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-70 text-white font-bold rounded-2xl flex items-center justify-center gap-3 transition shadow-lg hover:shadow-xl"
                >
                  {isSigningIn ? (
                    <Loader2 className="w-4 h-4 animate-spin text-brand-300" />
                  ) : (
                    <LogIn className="w-4 h-4 text-brand-300" />
                  )}
                  <span>
                    {isSigningIn
                      ? (language === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing in...')
                      : (language === 'ar' ? 'المتابعة باستخدام Google' : 'Continue with Google')}
                  </span>
                </button>
                <button
                  onClick={() => setIsAuthModalOpen(false)}
                  className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  {language === 'ar' ? 'تصفح كزائر (بدون ذكاء اصطناعي)' : 'Browse as Visitor (No AI)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- Admin Usage Dashboard Modal --- */}
        {isAdminModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-sand-200 p-6 relative overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-sand-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">CodeScout Admin — Usage & Safeguards</h3>
                    <p className="text-xs text-slate-400">Live Cloudflare Durable Object Quota Coordinator</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdminModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-sand-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
                >
                  ✕
                </button>
              </div>

              {adminLoading ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600 mb-2" />
                  <p className="text-xs text-slate-500">Loading quota statistics from SQLite Durable Object...</p>
                </div>
              ) : adminStats ? (
                <div className="py-5 space-y-6">
                  {/* Emergency Kill Switch Banner */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between transition ${
                    adminStats.aiDisabled
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}>
                    <div className="flex items-center gap-3">
                      <ShieldAlert className={`w-6 h-6 ${adminStats.aiDisabled ? 'text-rose-600' : 'text-emerald-600'}`} />
                      <div>
                        <h4 className="font-bold text-sm">
                          {adminStats.aiDisabled ? 'Global AI Status: PAUSED' : 'Global AI Status: ACTIVE'}
                        </h4>
                        <p className="text-xs opacity-80">
                          {adminStats.aiDisabled
                            ? 'All public AI calls are rejected with HTTP 503.'
                            : 'Public users can make up to 3 daily calls within the 30/day cap.'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleToggleKillSwitch}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                        adminStats.aiDisabled
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-rose-600 hover:bg-rose-700 text-white'
                      }`}
                    >
                      {adminStats.aiDisabled ? 'Resume AI' : 'Emergency Pause'}
                    </button>
                  </div>

                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-sand-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Total Calls Today</span>
                      <p className="text-2xl font-black text-slate-900 mt-1">{adminStats.totalCallsToday}</p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-sand-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Global Remaining</span>
                      <p className="text-2xl font-black text-emerald-600 mt-1">{adminStats.globalQuotaRemaining} / 30</p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-sand-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Successful Calls</span>
                      <p className="text-2xl font-black text-blue-600 mt-1">{adminStats.successfulCallsToday}</p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-sand-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Active Users</span>
                      <p className="text-2xl font-black text-purple-600 mt-1">{adminStats.activeUsersToday}</p>
                    </div>
                  </div>

                  {/* Feature Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Usage by Feature</h4>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-sand-200 space-y-2">
                      {Object.keys(adminStats.featureBreakdown || {}).length > 0 ? (
                        Object.entries(adminStats.featureBreakdown).map(([feature, count]) => (
                          <div key={feature} className="flex items-center justify-between text-xs">
                            <span className="font-mono text-slate-700 font-semibold">{feature}</span>
                            <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-sand-200">
                              {count as number} calls
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">No feature calls recorded today yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Financial Zero-Billing Architecture Status */}
                  <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 text-xs text-amber-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      Zero-Billing Financial Safety Active
                    </p>
                    <p className="text-[11px] opacity-90 leading-relaxed">
                      Google Search grounding is disabled. Free tier model allowlist enforced. Global hard limit capped at 30 Gemini calls/day in Durable Object storage.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="pt-4 border-t border-sand-100 flex items-center justify-between">
                <button
                  onClick={handleOpenAdmin}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => setIsAdminModalOpen(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LanguageContext.Provider>
  );
};

export default App;