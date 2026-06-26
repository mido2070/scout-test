import React, { useState, useEffect, useContext } from 'react';
import { UploadCloud, FileText, Search, Plus, Trash2, BookOpen, Building2, MapPin, Tag, Link as LinkIcon, Globe, X, ExternalLink, ShieldCheck, Copy, Flag, Info, Lock, Users } from 'lucide-react';
import { LibraryDocument, CodeType, CoverageType } from '../types';
import { libraryDB } from '../services/libraryDB';
import { LanguageContext } from '../App';

const CodeLibrary: React.FC = () => {
  const { t, language } = useContext(LanguageContext);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'MY_LIB' | 'COMMUNITY'>('MY_LIB');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCountry, setFilterCountry] = useState<string>('');

  // Form State
  const [uploadMode, setUploadMode] = useState<'FILE' | 'LINK'>('FILE');
  const [uploadForm, setUploadForm] = useState<Partial<LibraryDocument>>({
    country: '',
    city: '',
    district: '',
    authority: '',
    codeType: CodeType.ZONING,
    codeTypeCustom: '',
    coverage: CoverageType.CITY_WIDE,
    language: 'en',
    notes: '',
    url: '',
    visibility: 'PRIVATE'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [activeTab]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const visibility = activeTab === 'MY_LIB' ? 'PRIVATE' : 'PUBLIC';
      const docs = await libraryDB.getAllDocuments(visibility);
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to load library", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert("Only PDF files are supported.");
        return;
      }
      setSelectedFile(file);
      if (!uploadForm.title) {
        setUploadForm(prev => ({ ...prev, title: file.name.replace('.pdf', '') }));
      }
    }
  };

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.title || !uploadForm.country || !uploadForm.codeType) {
      alert("Please fill in required fields (Title, Country, Code Type)");
      return;
    }

    if (uploadForm.codeType === CodeType.OTHER && !uploadForm.codeTypeCustom?.trim()) {
        alert("Please specify the Custom Code Type.");
        return;
    }

    if (uploadMode === 'FILE' && !selectedFile) {
        alert("Please select a PDF file.");
        return;
    }
    if (uploadMode === 'LINK') {
        if (!uploadForm.url) {
            alert("Please enter the official URL.");
            return;
        }
        if (!validateUrl(uploadForm.url)) {
            alert("Please enter a valid URL (starting with http:// or https://).");
            return;
        }
    }

    let base64 = undefined;
    if (uploadMode === 'FILE' && selectedFile) {
        base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(selectedFile);
        });
    }

    const newDoc: LibraryDocument = {
      id: crypto.randomUUID(),
      title: uploadForm.title,
      fileName: selectedFile?.name,
      fileData: base64,
      url: uploadMode === 'LINK' ? uploadForm.url : undefined,
      country: uploadForm.country,
      city: uploadForm.city,
      district: uploadForm.district,
      authority: uploadForm.authority,
      codeType: uploadForm.codeType as CodeType,
      codeTypeCustom: uploadForm.codeType === CodeType.OTHER ? uploadForm.codeTypeCustom : undefined,
      year: uploadForm.year,
      language: uploadForm.language,
      coverage: uploadForm.coverage as CoverageType,
      notes: uploadForm.notes,
      dateUploaded: Date.now(),
      visibility: uploadForm.visibility || 'PRIVATE',
      uploaderName: uploadForm.visibility === 'PUBLIC' ? 'Community User' : 'Me',
      verified: false,
      reportCount: 0,
      isLocalOwner: true 
    };

    await libraryDB.addDocument(newDoc);
    setIsUploadOpen(false);
    resetForm();
    if (newDoc.visibility === 'PUBLIC') setActiveTab('COMMUNITY');
    else setActiveTab('MY_LIB');
    loadDocuments();
  };

  const resetForm = () => {
    setSelectedFile(null);
    setUploadForm({ 
        country: '', 
        city: '', 
        codeType: CodeType.ZONING, 
        codeTypeCustom: '', 
        coverage: CoverageType.CITY_WIDE, 
        url: '', 
        notes: '', 
        title: '',
        year: '',
        visibility: 'PRIVATE'
    });
    setUploadMode('FILE');
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this document permanently?")) return;

    const previousDocs = [...documents];
    setDocuments(prev => prev.filter(d => d.id !== id));

    try {
      const response = await libraryDB.deleteDocument(id);
      if (!response || !response.ok) throw new Error("API returned non-OK status");
    } catch (error) {
      alert("Failed to delete document. Restoring view.");
      setDocuments(previousDocs);
    }
  };

  const handleReport = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(language === 'ar' ? "هل تريد الإبلاغ عن هذا المستند؟" : "Report this document?")) {
        await libraryDB.reportDocument(id);
        alert("Report submitted.");
        loadDocuments(); 
    }
  };

  const handleCloneToMyLib = async (e: React.MouseEvent, doc: LibraryDocument) => {
    e.stopPropagation();
    const clone: LibraryDocument = {
        ...doc,
        id: crypto.randomUUID(),
        visibility: 'PRIVATE',
        originalSourceId: doc.id,
        dateUploaded: Date.now(),
        notes: `Cloned from Community (Orig: ${doc.title})`,
        isLocalOwner: true
    };
    await libraryDB.addDocument(clone);
    alert("Saved to My Library!");
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          doc.country.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || doc.codeType === filterType;
    const matchesCountry = !filterCountry || doc.country.toLowerCase().includes(filterCountry.toLowerCase());
    return matchesSearch && matchesType && matchesCountry;
  });

  return (
    <div className="animate-in fade-in duration-300">
      
      {/* Header & Upload */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white border border-sand-200 rounded-2xl flex items-center justify-center shadow-sm">
             <BookOpen className="w-7 h-7 text-slate-700" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight font-cairo">
                Code Library
            </h2>
            <p className="text-slate-500 mt-1 text-lg">
                {language === 'ar' ? 'إدارة اللوائح واستكشاف الأنظمة المشتركة.' : 'Manage regulations and discover shared codes.'}
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg text-sm group"
        >
          <Plus className="w-4 h-4 group-hover:scale-125 transition-transform" />
          {t.uploadRegulation}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-sand-100 p-1 rounded-xl w-fit border border-sand-200">
        <button
            onClick={() => setActiveTab('MY_LIB')}
            className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'MY_LIB' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-sand-200/50'}`}
        >
            <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {t.myLibrary}
            </div>
        </button>
        <button
            onClick={() => setActiveTab('COMMUNITY')}
            className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === 'COMMUNITY' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-sand-200/50'}`}
        >
             <div className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t.communityHub}
            </div>
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card bg-white p-5 rounded-2xl border border-sand-200 mb-8 flex flex-col lg:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder={t.searchLib} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 h-11 border border-sand-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition text-sm text-slate-900 placeholder:text-sand-400 bg-sand-50/30"
          />
        </div>
        
        <div className="w-full lg:w-48">
             <input 
                type="text"
                placeholder={t.filterCountry}
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="w-full h-11 px-3 border border-sand-200 rounded-lg bg-sand-50/30 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition text-slate-900 placeholder:text-sand-400"
             />
        </div>

        <div className="w-full lg:w-auto">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full h-11 px-3 border border-sand-200 rounded-lg bg-sand-50/30 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition text-slate-900"
          >
            <option value="ALL">{t.allTypes}</option>
            {Object.values(CodeType).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-32 text-slate-400 font-medium animate-pulse">{t.loading}</div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-32 bg-sand-50/50 rounded-2xl border-2 border-dashed border-sand-200">
          <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-sand-100">
              {activeTab === 'MY_LIB' ? <UploadCloud className="w-10 h-10 text-sand-300" /> : <Users className="w-10 h-10 text-sand-300" />}
          </div>
          <p className="text-slate-900 font-bold text-xl">{activeTab === 'MY_LIB' ? t.emptyLib : t.emptyCommunity}</p>
          <p className="text-slate-500 mt-2">
             {activeTab === 'MY_LIB' 
               ? (language === 'ar' ? "قم برفع اللوائح لتنظيمها." : "Upload regulations to keep them organized.")
               : (language === 'ar' ? "كن أول من يشارك لائحة لهذه المنطقة." : "Be the first to share a regulation for this region.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredDocs.map(doc => (
            <div 
                key={doc.id} 
                className="relative bg-white p-6 rounded-2xl border border-sand-200 hover:shadow-lg hover:shadow-sand-200/50 transition-all duration-300 flex flex-col md:flex-row justify-between gap-6 group cursor-pointer"
                onClick={() => {
                    if (doc.url) window.open(doc.url, '_blank');
                }}
            >
              <div className="absolute top-4 right-4 flex gap-2">
                 {doc.verified && (
                    <span className="flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-100 uppercase tracking-wide" title="Verified">
                        <ShieldCheck className="w-3 h-3" /> {t.verified}
                    </span>
                 )}
                 {doc.year && (
                    <span className="bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1 rounded-full border border-slate-800 shadow-sm">
                        {doc.year}
                    </span>
                 )}
              </div>

              <div className="flex items-start gap-5 flex-1">
                {/* Modern File Icon */}
                <div className={`w-16 h-16 rounded-2xl border shadow-sm flex items-center justify-center shrink-0 ${
                    doc.url 
                    ? 'bg-brand-50 border-brand-100 text-brand-600' 
                    : 'bg-sand-50 border-sand-200 text-slate-600'
                }`}>
                  {doc.url ? <LinkIcon className="w-7 h-7" strokeWidth={1.5} /> : <FileText className="w-7 h-7" strokeWidth={1.5} />}
                </div>

                <div className="flex-1 pr-16">
                  <h3 className="font-bold text-slate-900 group-hover:text-brand-600 transition flex items-center gap-2 text-lg leading-tight font-cairo">
                    {doc.title}
                    {doc.url && <ExternalLink className="w-4 h-4 text-slate-400" />}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-slate-600">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium text-xs border ${doc.codeType === CodeType.OTHER ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-sand-50 text-slate-600 border-sand-100'}`}>
                      <Tag className="w-3.5 h-3.5" /> 
                      {doc.codeType === CodeType.OTHER ? (doc.codeTypeCustom || 'Custom') : doc.codeType}
                    </span>
                    <span className="flex items-center gap-1.5 bg-white border border-sand-200 px-2.5 py-1 rounded-md text-xs">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {doc.city ? `${doc.city}, ${doc.country}` : doc.country}
                    </span>
                    <span className="flex items-center gap-1.5 bg-white border border-sand-200 px-2.5 py-1 rounded-md text-xs">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" /> {doc.authority || doc.coverage}
                    </span>
                    {activeTab === 'COMMUNITY' && (
                        <span className="flex items-center gap-1.5 text-slate-400 pl-2 border-l border-sand-200 text-xs">
                            <Users className="w-3.5 h-3.5" /> {doc.uploaderName || 'User'}
                        </span>
                    )}
                  </div>
                  
                  {doc.notes && <p className="text-sm text-slate-500 mt-3 border-l-2 border-sand-200 pl-3 leading-relaxed">{doc.notes}</p>}
                </div>
              </div>

              <div className="flex items-center gap-3 pl-6 md:border-l border-sand-100 shrink-0 self-center md:self-auto">
                 {(activeTab === 'MY_LIB' || doc.isLocalOwner) && (
                     <button 
                        onClick={(e) => handleDelete(e, doc.id)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete permanently"
                        >
                        <Trash2 className="w-5 h-5" />
                    </button>
                 )}

                 {activeTab === 'COMMUNITY' && !doc.isLocalOwner && (
                    <>
                        <button 
                            onClick={(e) => handleCloneToMyLib(e, doc)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition shadow-sm"
                            title="Save copy to My Library"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            {language === 'ar' ? 'حفظ عندي' : 'Save'}
                        </button>
                        <button 
                            onClick={(e) => handleReport(e, doc.id)}
                            className="p-2.5 text-slate-300 hover:text-red-500 rounded-lg transition"
                            title="Report Issue"
                        >
                            <Flag className="w-4 h-4" />
                        </button>
                    </>
                 )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload/Add Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh] border border-sand-200">
            <div className="p-6 border-b border-sand-100 bg-white">
              <h3 className="text-xl font-bold text-slate-900">{t.addRegulation}</h3>
              <p className="text-sm text-slate-500 mt-1">{language === 'ar' ? 'ساهم في المكتبة أو احفظ لاستخدامك الخاص.' : 'Contribute to the library or save for your private use.'}</p>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-sand-50/50">
              
              <div className="bg-brand-50/50 border border-brand-100 p-5 rounded-xl">
                 <label className="block text-xs font-bold text-brand-900 mb-3 uppercase tracking-wider">{language === 'ar' ? 'إعدادات الظهور' : 'Visibility Setting'}</label>
                 <div className="flex gap-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="radio" 
                          name="visibility" 
                          value="PRIVATE" 
                          checked={uploadForm.visibility === 'PRIVATE'} 
                          onChange={() => setUploadForm(p => ({...p, visibility: 'PRIVATE'}))}
                          className="w-4 h-4 accent-slate-900"
                        />
                        <span className="text-sm font-medium flex items-center gap-2 text-slate-700 group-hover:text-slate-900 transition">
                            <Lock className="w-4 h-4 text-slate-400" /> {t.privateOnlyMe}
                        </span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                        <input 
                          type="radio" 
                          name="visibility" 
                          value="PUBLIC" 
                          checked={uploadForm.visibility === 'PUBLIC'} 
                          onChange={() => setUploadForm(p => ({...p, visibility: 'PUBLIC'}))}
                          className="w-4 h-4 accent-brand-600"
                        />
                        <span className="text-sm font-medium flex items-center gap-2 text-brand-700 group-hover:text-brand-800 transition">
                            <Globe className="w-4 h-4" /> {t.shareCommunity}
                        </span>
                    </label>
                 </div>
              </div>

              <div className="flex gap-4">
                 <button 
                  onClick={() => setUploadMode('FILE')}
                  className={`flex-1 py-3.5 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                      uploadMode === 'FILE' 
                      ? 'bg-white border-slate-900 text-slate-900 ring-1 ring-slate-900 shadow-sm' 
                      : 'bg-white border-sand-200 text-slate-500 hover:bg-sand-50 hover:border-sand-300'
                  }`}
                 >
                    <FileText className="w-4 h-4" /> {t.uploadPdf}
                 </button>
                 <button 
                  onClick={() => setUploadMode('LINK')}
                  className={`flex-1 py-3.5 rounded-xl border font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                      uploadMode === 'LINK' 
                      ? 'bg-white border-slate-900 text-slate-900 ring-1 ring-slate-900 shadow-sm' 
                      : 'bg-white border-sand-200 text-slate-500 hover:bg-sand-50 hover:border-sand-300'
                  }`}
                 >
                    <LinkIcon className="w-4 h-4" /> {t.addLink}
                 </button>
              </div>

              {uploadMode === 'FILE' ? (
                 <div className="border-2 border-dashed border-sand-300 rounded-xl p-10 text-center hover:bg-sand-50 transition cursor-pointer relative bg-white group">
                    <input 
                    type="file" 
                    accept="application/pdf" 
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    {selectedFile ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-900">
                        <div className="w-12 h-12 bg-brand-50 rounded-full flex items-center justify-center">
                            <FileText className="w-6 h-6 text-brand-600" />
                        </div>
                        <span className="font-bold text-lg">{selectedFile.name}</span>
                        <span className="text-sm text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                        <button onClick={(e) => {e.preventDefault(); setSelectedFile(null);}} className="text-sm text-red-500 font-medium hover:underline mt-2 z-20 relative">Change File</button>
                    </div>
                    ) : (
                    <div className="text-slate-500">
                        <div className="w-16 h-16 bg-sand-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200 border border-sand-100">
                            <UploadCloud className="w-8 h-8 text-sand-400" />
                        </div>
                        <p className="text-base font-semibold text-slate-900">{t.uploadPdf}</p>
                        <p className="text-sm mt-1">{language === 'ar' ? 'السحب والإفلات مدعوم' : 'Drag and drop supported'}</p>
                    </div>
                    )}
                </div>
              ) : (
                <div>
                   <label className="block text-xs font-bold text-slate-700 mb-2">{t.officialUrl} *</label>
                   <div className="relative">
                     <LinkIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                     <input 
                      type="url" 
                      value={uploadForm.url}
                      onChange={e => setUploadForm({...uploadForm, url: e.target.value})}
                      placeholder="https://authority.gov/regulations/zoning.pdf"
                      className="w-full pl-10 p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
                     />
                   </div>
                   <p className="text-xs text-slate-400 mt-2">Must be a valid https:// URL accessible publicly.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-2">{t.docTitle} *</label>
                  <input 
                    type="text" 
                    value={uploadForm.title || ''}
                    onChange={e => setUploadForm({...uploadForm, title: e.target.value})}
                    placeholder="e.g. Riyadh Building Code 2024"
                    className="w-full p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">{t.codeType} *</label>
                  <select 
                    value={uploadForm.codeType}
                    onChange={e => setUploadForm({...uploadForm, codeType: e.target.value as CodeType, codeTypeCustom: ''})}
                    className="w-full p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none bg-white"
                  >
                    {Object.values(CodeType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {uploadForm.codeType === CodeType.OTHER && (
                   <div className="animate-in fade-in slide-in-from-top-1">
                    <label className="block text-xs font-bold text-slate-700 mb-2">Custom Code Type *</label>
                    <input 
                        type="text" 
                        value={uploadForm.codeTypeCustom}
                        onChange={e => setUploadForm({...uploadForm, codeTypeCustom: e.target.value})}
                        placeholder="e.g. Industrial Guidelines"
                        className="w-full p-3 border border-amber-300 bg-amber-50 rounded-xl focus:ring-2 focus:ring-amber-500/20 outline-none"
                    />
                   </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">{t.country} *</label>
                  <input 
                    type="text" 
                    value={uploadForm.country}
                    onChange={e => setUploadForm({...uploadForm, country: e.target.value})}
                    placeholder="e.g. Saudi Arabia"
                    className="w-full p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">{t.city}</label>
                  <input 
                    type="text" 
                    value={uploadForm.city}
                    onChange={e => setUploadForm({...uploadForm, city: e.target.value})}
                    placeholder="e.g. Riyadh"
                    className="w-full p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">{t.district}</label>
                  <input 
                    type="text" 
                    value={uploadForm.district}
                    onChange={e => setUploadForm({...uploadForm, district: e.target.value})}
                    placeholder="Optional"
                    className="w-full p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">{t.authority}</label>
                  <input 
                    type="text" 
                    value={uploadForm.authority}
                    onChange={e => setUploadForm({...uploadForm, authority: e.target.value})}
                    placeholder="e.g. RCRC"
                    className="w-full p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
                  />
                </div>
                 <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">{language === 'ar' ? 'نطاق التغطية' : 'Coverage Scope'}</label>
                  <select 
                    value={uploadForm.coverage}
                    onChange={e => setUploadForm({...uploadForm, coverage: e.target.value as CoverageType})}
                    className="w-full p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none bg-white"
                  >
                    {Object.values(CoverageType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">{t.year}</label>
                  <input 
                    type="text" 
                    value={uploadForm.year}
                    onChange={e => setUploadForm({...uploadForm, year: e.target.value})}
                    placeholder="e.g. 2024"
                    className="w-full p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
                  />
                </div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">{t.notes}</label>
                  <textarea 
                    value={uploadForm.notes}
                    onChange={e => setUploadForm({...uploadForm, notes: e.target.value})}
                    className="w-full p-3 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition"
                    rows={2}
                    placeholder="Any specific context about this document..."
                  />
              </div>
            </div>

            <div className="p-6 border-t border-sand-100 bg-white flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setIsUploadOpen(false)}
                className="px-5 py-2.5 text-slate-600 hover:bg-sand-50 rounded-lg font-medium transition"
              >
                {t.cancel}
              </button>
              <button 
                onClick={handleUpload}
                disabled={uploadMode === 'FILE' && !selectedFile}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 shadow-lg transition transform active:scale-95"
              >
                {uploadMode === 'FILE' ? <UploadCloud className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                {uploadMode === 'FILE' ? t.startUpload : t.saveLink}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeLibrary;