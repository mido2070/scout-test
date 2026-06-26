import React, { useState, useContext, useRef, useEffect } from 'react';
import { PlotData, AttachedFile, LibraryDocument, CodeType, CoverageType } from '../types';
import { MapPin, Ruler, Map as MapIcon, PenTool, FileText, UploadCloud, X, File as FileIcon, Loader2, Navigation, BookPlus, Hash } from 'lucide-react';
import MapModal from './MapModal';
import { LanguageContext } from '../App';
import { libraryDB } from '../services/libraryDB';

interface InputFormProps {
  data: PlotData;
  onChange: (field: keyof PlotData, value: any) => void;
  title: string;
  isActive: boolean;
}

const InputForm: React.FC<InputFormProps> = ({ data, onChange, title, isActive }) => {
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [isLocatingAddress, setIsLocatingAddress] = useState(false);
  const [isLocatingCity, setIsLocatingCity] = useState(false);
  const [isAutoLocating, setIsAutoLocating] = useState(false);
  const { t, language } = useContext(LanguageContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isActive || !data.gps) return;

    const match = data.gps.match(/(-?\d+(\.\d+)?)[,\s]+[^\d-]*(-?\d+(\.\d+)?)/);
    const numbers = data.gps.match(/-?\d+(\.\d+)?/g);
    
    let lat: number | null = null;
    let lng: number | null = null;

    if (match) {
        lat = parseFloat(match[1]);
        lng = parseFloat(match[3]);
    } else if (numbers && numbers.length >= 2) {
        lat = parseFloat(numbers[0]);
        lng = parseFloat(numbers[1]);
    }

    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    const timer = setTimeout(async () => {
      setIsAutoLocating(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
          { headers: { 'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8' } }
        );

        if (response.ok) {
          const result = await response.json();
          const addr = result.address || {};
          const country = addr.country || '';
          const city = addr.city || addr.town || addr.village || addr.county || addr.state || '';
          const district = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || '';
          const road = addr.road ? `${addr.house_number ? addr.house_number + ' ' : ''}${addr.road}` : '';

          onChange('country', country);
          onChange('city', city);
          onChange('district', district);
          onChange('address', road);
        }
      } catch (error) {
        console.error("Auto-location failed", error);
      } finally {
        setIsAutoLocating(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [data.gps, isActive]);

  if (!isActive) return null;

  const handleOpenMaps = () => {
    let query = '';
    if (data.gps) {
      query = data.gps;
    } else {
      const parts = [data.address, data.district, data.city, data.country].filter(Boolean);
      if (parts.length > 0) query = parts.join(', ');
    }

    if (query) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
    } else {
      alert(t['alertLocation'] || "Please enter a location (Address or GPS) to open Maps.");
    }
  };

  const handleCityLookup = async () => {
    const parts = [data.city, data.country].filter(Boolean);
    if (parts.length === 0) {
        setIsMapModalOpen(true);
        return;
    }
    setIsLocatingCity(true);
    try {
        const query = parts.join(', ');
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const results = await response.json();
        if (results && results.length > 0) {
            const { lat, lon } = results[0];
            onChange('gps', `${lat}, ${lon}`);
            setIsMapModalOpen(true);
        } else {
            alert(t['addressNotFound'] || "Location not found");
        }
    } catch (e) {
        setIsMapModalOpen(true);
    } finally {
        setIsLocatingCity(false);
    }
  };

  const handleAddressLookup = async () => {
    const parts = [data.address, data.district, data.city, data.country].filter(Boolean);
    if (parts.length === 0) {
        setIsMapModalOpen(true);
        return;
    }
    setIsLocatingAddress(true);
    try {
        const query = parts.join(', ');
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const results = await response.json();
        if (results && results.length > 0) {
            const { lat, lon } = results[0];
            onChange('gps', `${lat}, ${lon}`);
            setIsMapModalOpen(true);
        } else {
            alert(t['addressNotFound'] || "Address not found.");
        }
    } catch (e) {
        setIsMapModalOpen(true);
    } finally {
        setIsLocatingAddress(false);
    }
  };

  const handleBoundarySave = (coords: string, area: string, location?: any) => {
    onChange('boundaryCoords', coords);
    onChange('plotArea', area);
    if (location) {
      onChange('gps', `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
      if (location.country !== undefined) onChange('country', location.country);
      if (location.city !== undefined) onChange('city', location.city);
      if (location.district !== undefined) onChange('district', location.district);
      if (location.address !== undefined) onChange('address', location.address);
    } else if (!data.gps && coords) {
      try {
        const parsed = JSON.parse(coords);
        if (parsed.length > 0) onChange('gps', `${parsed[0].lat.toFixed(6)}, ${parsed[0].lng.toFixed(6)}`);
      } catch (e) {}
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files: File[] = Array.from(e.target.files);
      const newAttachments: AttachedFile[] = [];
      for (const file of files) {
        if (file.type !== 'application/pdf') continue;
        if (file.size > 10 * 1024 * 1024) {
            alert(t.fileTooLarge);
            continue;
        }
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve((ev.target?.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        newAttachments.push({ name: file.name, type: file.type, data: base64 });
      }
      onChange('attachments', [...(data.attachments || []), ...newAttachments]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    const updated = [...(data.attachments || [])];
    updated.splice(index, 1);
    onChange('attachments', updated);
  };

  const saveToLibrary = async (file: AttachedFile) => {
    if (!data.country || !data.city) {
        alert(language === 'ar' ? "يرجى تعبئة الدولة والمدينة أولاً لحفظ الملف." : "Please fill in Country and City first to save this file.");
        return;
    }
    const doc: LibraryDocument = {
        id: crypto.randomUUID(),
        title: file.name.replace('.pdf', ''),
        fileName: file.name,
        fileData: file.data,
        country: data.country,
        city: data.city,
        district: data.district,
        codeType: CodeType.ZONING,
        coverage: CoverageType.PLOT_SPECIFIC,
        dateUploaded: Date.now(),
        language: language,
        notes: `Imported from Single Plot Analysis for ${data.projectType || 'Project'}`,
        visibility: 'PRIVATE'
    };
    try {
        await libraryDB.addDocument(doc);
        alert(language === 'ar' ? "تم الحفظ في المكتبة بنجاح!" : "Saved to Library successfully!");
    } catch (e) {
        console.error(e);
        alert(language === 'ar' ? "فشل الحفظ في المكتبة." : "Failed to save to Library.");
    }
  };

  // Modern Technical Header
  const SectionHeader = ({ icon: Icon, title, number }: any) => (
    <div className="flex items-center gap-4 mb-8 pb-4 border-b border-sand-200/60">
        <div className="relative group">
            <div className="absolute inset-0 bg-brand-100 rounded-xl blur-sm opacity-50 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative w-10 h-10 bg-white border border-sand-200 rounded-xl flex items-center justify-center shadow-sm">
                <Icon className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
            </div>
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] font-mono font-bold shadow border border-white">
                {number}
            </div>
        </div>
        <div>
            <h4 className="text-lg font-bold text-slate-800 tracking-tight font-cairo">
                {title}
            </h4>
            <div className="h-0.5 w-8 bg-brand-500/30 rounded mt-1"></div>
        </div>
    </div>
  );

  return (
    // Light Glass Card
    <div className="glass-card p-8 md:p-10 rounded-3xl animate-in fade-in duration-500 relative overflow-hidden group">
      
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold text-slate-900 font-cairo drop-shadow-sm">
            {title}
        </h3>
        <div className="px-2 py-1 bg-white/50 backdrop-blur rounded text-[10px] font-mono font-medium text-slate-500 border border-white">
            DATA_ENTRY
        </div>
      </div>
      
      {/* SECTION 01: LOCATION */}
      <div className="mb-10">
          <SectionHeader icon={MapPin} title={t['locationDetails']} number="01" />
          
          <div className="space-y-6">
            <div className="flex justify-end mb-2 gap-2">
              <button
                onClick={() => setIsMapModalOpen(true)}
                type="button"
                className="text-xs flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium bg-white hover:bg-slate-50 px-4 py-2 rounded-lg transition border border-sand-200 shadow-sm"
              >
                <PenTool className="w-3.5 h-3.5" />
                {t['drawBoundary']}
              </button>
              <button
                onClick={handleOpenMaps}
                type="button"
                className="text-xs flex items-center gap-1.5 text-brand-600 hover:text-brand-800 font-medium bg-brand-50/50 hover:bg-brand-50 px-4 py-2 rounded-lg transition border border-brand-200 shadow-sm"
              >
                <MapIcon className="w-3.5 h-3.5" />
                {t['locateMaps']}
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
                <div className="group/input">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">{t['country']}</label>
                    <input
                        type="text"
                        placeholder={language === 'ar' ? 'مثال: المملكة العربية السعودية' : 'e.g. Saudi Arabia'}
                        value={data.country}
                        onChange={(e) => onChange('country', e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-sand-200 bg-white/80 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-sand-400"
                    />
                </div>
                <div className="relative group/input">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">{t['city']}</label>
                    <div className="relative">
                        <input
                        type="text"
                        placeholder={language === 'ar' ? 'مثال: الرياض' : 'e.g. Riyadh'}
                        value={data.city}
                        onChange={(e) => onChange('city', e.target.value)}
                        className={`w-full h-12 px-4 border border-sand-200 bg-white/80 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition text-sm font-medium text-slate-900 placeholder:text-sand-400 ${language === 'ar' ? 'pl-10' : 'pr-10'}`}
                        />
                        {data.city && (
                        <button
                            type="button"
                            onClick={handleCityLookup}
                            disabled={isLocatingCity}
                            className={`absolute top-2 bottom-2 ${language === 'ar' ? 'left-2' : 'right-2'} aspect-square bg-sand-100 hover:bg-sand-200 text-slate-500 rounded-lg flex items-center justify-center transition`}
                        >
                            {isLocatingCity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                        </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="relative group/input">
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">{t['address']}</label>
                <div className="relative">
                    <input
                        type="text"
                        placeholder={language === 'ar' ? 'ابحث عن شارع أو معلم...' : 'Search for street or landmark...'}
                        value={data.address}
                        onChange={(e) => onChange('address', e.target.value)}
                        className={`w-full h-12 px-4 border border-sand-200 bg-white/80 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition text-sm font-medium text-slate-900 placeholder:text-sand-400 ${language === 'ar' ? 'pl-12' : 'pr-12'}`}
                    />
                    <button
                        type="button"
                        onClick={handleAddressLookup}
                        disabled={isLocatingAddress}
                        className={`absolute top-2 bottom-2 ${language === 'ar' ? 'left-2' : 'right-2'} aspect-square bg-sand-100 hover:bg-sand-200 text-slate-500 rounded-lg flex items-center justify-center transition`}
                    >
                        {isLocatingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="group/input">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">{t['district']}</label>
                    <input
                    type="text"
                    placeholder={t['district']}
                    value={data.district}
                    onChange={(e) => onChange('district', e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-sand-200 bg-white/80 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-sand-400"
                    />
                </div>
                <div className="relative group/input">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">{t['gps']}</label>
                    <div className="relative">
                        <MapPin className={`absolute top-4 w-4 h-4 text-slate-400 ${language === 'ar' ? 'right-4' : 'left-4'}`} />
                        <input
                            type="text"
                            placeholder="00.0000, 00.0000"
                            value={data.gps}
                            onChange={(e) => onChange('gps', e.target.value)}
                            className={`w-full h-12 px-4 border border-sand-200 bg-white/80 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition text-sm font-mono text-slate-900 placeholder:text-sand-400 ${language === 'ar' ? 'pr-10 pl-12' : 'pl-10 pr-12'}`}
                        />
                        <div className={`absolute top-2 bottom-2 ${language === 'ar' ? 'left-2' : 'right-2'} flex gap-1`}>
                            {isAutoLocating && (
                            <div className="flex items-center justify-center w-8 h-full bg-brand-50 rounded text-brand-600">
                                <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                            )}
                            <button
                            type="button"
                            onClick={() => setIsMapModalOpen(true)}
                            className="aspect-square bg-sand-100 hover:bg-sand-200 text-slate-500 rounded-lg flex items-center justify-center transition"
                            >
                            <PenTool className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          </div>
      </div>

      {/* SECTION 02: SPECS */}
      <div className="mb-8">
          <SectionHeader icon={Ruler} title={t['plotGeometry']} number="02" />
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
             {['width', 'depth', 'streetWidth'].map(field => (
                 <div key={field} className="group/input">
                     <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono truncate">{t[field]}</label>
                     <input
                      type="text"
                      placeholder="0.0"
                      value={(data as any)[field]}
                      onChange={(e) => onChange(field as any, e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border border-sand-200 bg-white/80 text-slate-900 text-sm font-mono focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-sand-400"
                    />
                 </div>
             ))}
            <div className="relative group/input">
              <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">{t['plotArea']}</label>
              <div className="relative">
                <input
                    type="text"
                    placeholder="0.0"
                    value={data.plotArea || ''}
                    readOnly
                    className="w-full h-12 px-4 bg-sand-50/50 border border-sand-200 rounded-xl focus:outline-none text-slate-600 font-mono text-sm cursor-not-allowed"
                />
                <span className={`absolute top-4 text-xs text-slate-400 pointer-events-none ${language === 'ar' ? 'left-4' : 'right-4'}`}>m²</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 group/input">
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">{t['projectType']}</label>
                <input
                  type="text"
                  placeholder={t['projectPlaceholder']}
                  value={data.projectType}
                  onChange={(e) => onChange('projectType', e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-sand-200 bg-white/80 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-sand-400"
                />
              </div>
              
              <div className="md:col-span-2 group/input">
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono flex items-center gap-1">
                  {t['projectDescription']}
                </label>
                <textarea
                  placeholder={t['descPlaceholder']}
                  value={data.projectDescription || ''}
                  onChange={(e) => onChange('projectDescription', e.target.value)}
                  rows={2}
                  className="w-full p-4 bg-white/80 border border-sand-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition text-sm text-slate-900 placeholder:text-sand-400 min-h-[48px] max-h-[120px]"
                />
              </div>
            </div>

            {/* Specific Focus */}
            <div className="relative group/input">
              <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider font-mono">
                {t['specificFocus']}
              </label>
              <div className="relative">
                <Hash className={`absolute top-4 w-4 h-4 text-slate-400 ${language === 'ar' ? 'right-4' : 'left-4'}`} />
                <input
                  type="text"
                  placeholder={t['focusPlaceholder']}
                  value={data.specificFocus || ''}
                  onChange={(e) => onChange('specificFocus', e.target.value)}
                  className={`w-full h-12 px-4 bg-white/80 border border-sand-200 rounded-xl border-dashed focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition text-sm text-slate-900 placeholder:text-sand-400 ${language === 'ar' ? 'pr-10' : 'pl-10'}`}
                />
              </div>
            </div>
          </div>
      </div>

      {/* SECTION 03: FILES */}
      <div>
         <SectionHeader icon={FileText} title={t['uploadDocs']} number="03" />

         <div className="bg-white/30 border-2 border-sand-200 border-dashed rounded-2xl p-8 text-center hover:bg-white/60 transition-colors group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="flex flex-col items-center gap-4">
                 <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-6 h-6 text-brand-500" />
                 </div>
                 <div className="space-y-1">
                    <button
                    type="button"
                    className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition"
                    >
                    {t['uploadDocs']}
                    </button>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-mono">
                    {t['uploadHint']}
                    </p>
                 </div>
                 <input 
                   ref={fileInputRef}
                   type="file" 
                   accept="application/pdf" 
                   multiple 
                   className="hidden"
                   onChange={handleFileChange}
                 />
            </div>
         </div>

         {/* Attachments List */}
         {data.attachments && data.attachments.length > 0 && (
            <div className="mt-4 space-y-2">
            {data.attachments.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white border border-sand-200 rounded-xl text-sm group shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 text-slate-700 truncate">
                    <div className="p-2 bg-sand-50 rounded-lg border border-sand-100">
                    <FileIcon className="w-4 h-4 text-slate-500" />
                    </div>
                    <span className="truncate font-bold font-mono text-xs">{file.name}</span>
                </div>
                <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => saveToLibrary(file)}
                        className="text-brand-600 hover:text-brand-800 p-2 hover:bg-brand-50 rounded-lg transition"
                        title={language === 'ar' ? "حفظ في المكتبة" : "Save to Library"}
                    >
                        <BookPlus className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => removeAttachment(idx)}
                        className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition"
                        title={t['removeFile']}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                </div>
            ))}
            </div>
        )}
      </div>

      <MapModal 
        isOpen={isMapModalOpen} 
        onClose={() => setIsMapModalOpen(false)} 
        onSave={handleBoundarySave}
        initialCoords={data.gps}
        t={t}
      />
    </div>
  );
};

export default InputForm;