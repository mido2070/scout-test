import { GoogleGenAI } from "@google/genai";
import { AnalysisMode, PlotData, Language, PolicyData, LibraryDocument, PolicyUpdate, PolicySector } from "../types";

export interface ApiSecurityContext {
  request?: Request;
  env?: any;
  user?: {
    uid: string;
    email?: string;
  };
}

export const FREE_TIER_ALLOWED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

export const getSafeModelName = (env?: any): string => {
  const configured = env?.GEMINI_MODEL || (typeof process !== 'undefined' ? process.env.GEMINI_MODEL : undefined);
  if (configured && FREE_TIER_ALLOWED_MODELS.includes(configured)) {
    return configured;
  }
  return 'gemini-2.5-flash';
};

export const getApiKey = (ctx?: ApiSecurityContext): string => {
  // Cloudflare Worker environment secret
  if (ctx?.env?.GEMINI_API_KEY && typeof ctx.env.GEMINI_API_KEY === 'string') {
    const workerSecret = ctx.env.GEMINI_API_KEY.trim();
    if (workerSecret) return workerSecret;
  }

  // Local development fallback
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
    if (process.env.API_KEY) return process.env.API_KEY.trim();
  }

  return "";
};

const getVerifiedApiKey = (ctx?: ApiSecurityContext): string => {
  const apiKey = getApiKey(ctx);
  if (!apiKey) {
    throw new Error(
      "AI analysis is temporarily unavailable. Server-side Free Tier Gemini credentials are not yet configured."
    );
  }
  return apiKey;
};

const generatePrompt = (
  mode: AnalysisMode, 
  dataA: PlotData, 
  dataB: PlotData | undefined, 
  language: Language, 
  libraryContext: string = "", 
  learnedContext: string | null = null
): string => {
  const formatPlotInfo = (p: PlotData, label: string) => `
    --- ${label} ---
    Address/Location: ${p.address}, ${p.city}, ${p.country}
    District/Neighborhood: ${p.district || "N/A"}
    GPS Coordinates: ${p.gps || "N/A"}
    Dimensions: Width ${p.width || "Unknown"}m x Depth ${p.depth || "Unknown"}m
    Plot Area: ${p.plotArea ? p.plotArea + " m²" : "Unknown / Not calculated"}
    Street Width: ${p.streetWidth || "Unknown"}m
    Secondary Street Width: ${p.secondaryStreetWidth || "N/A"}m
    Plot Orientation: ${p.plotOrientation || "Mid-block"}
    Proposed Project Type: ${p.projectType}
    Detailed Project Program: ${p.projectDescription || "None provided"}
    Specific Focus Request: ${p.specificFocus || "None - Full Report"}
    Attached Documents (Direct Upload): ${p.attachments?.map(f => f.name).join(', ') || "None"}
  `;

  const focusInstruction = dataA.specificFocus 
    ? `CRITICAL INSTRUCTION: The user only wants to check regulations regarding: "${dataA.specificFocus}". 
       FILTER your output to only relevant data. 
       - The Regulation Table must ONLY contain rows related to "${dataA.specificFocus}".
       - The Analysis/Interpretation must be specific to this topic.
       - Ignore unrelated categories.
       - Still use the same HTML structure, but reduce the content to this specific topic.`
    : "Analyze all standard zoning regulations.";

  // STRICT LANGUAGE CONTROL
  const langInstruction = language === 'ar' 
    ? `
    *****************************************************
    ⚠️ STRICT OUTPUT LANGUAGE: ARABIC (العربية) ⚠️
    *****************************************************
    The user has selected ARABIC interface. 
    1. The ENTIRE HTML response (Headers, Tables, Lists, Paragraphs, Notes) MUST be in ARABIC.
    2. Do NOT use English unless citing a specific English filename or variable code.
    3. Use professional Saudi/Middle Eastern engineering terminology:
       - FAR -> معامل مسطحات البناء
       - Setback -> الارتداد
       - Building Coverage -> نسبة التغطية
       - Land Use -> استخدام الأرض
       - Heights -> الارتفاعات
    4. Ensure the HTML has 'dir="rtl"' on the main container or paragraphs if needed for correct rendering.
    `
    : `
    *****************************************************
    ⚠️ STRICT OUTPUT LANGUAGE: ENGLISH ⚠️
    *****************************************************
    The user has selected ENGLISH interface.
    1. The ENTIRE HTML response MUST be in ENGLISH.
    2. Even if the input location is in an Arab country, TRANSLATE regulations to English.
    `;

  const sourceHierarchy = `
    SOURCE OF TRUTH HIERARCHY:
    1. **PRIMARY (Library Sources)**: Extract exact clauses and numeric requirements.
    2. **SECONDARY (Uploaded Documents)**: Use the attached regulatory PDFs.
    3. **TERTIARY (Zoning Norms)**: If specific local codes are missing, provide standard municipal code benchmarks and mark confidence as Low.
  `;

  const memoryBlock = learnedContext 
    ? `
    [INTERNAL MEMORY / PRIOR KNOWLEDGE]
    You have previously analyzed this location (${dataA.city}, ${dataA.country}).
    Baseline notes: ${learnedContext}
    `
    : `[No prior memory for ${dataA.city}. Start fresh analysis.]`;

  return `
    You are CodeScout Pro, an advanced Urban Planning, Zoning, and Real-Estate Development Analysis Engine.

    YOUR GOAL:
    Analyze specific plot data to produce a professional Due Diligence Report, strictly adhering to the source hierarchy.

    ${langInstruction}

    ${memoryBlock}

    ${libraryContext ? `
    [LIBRARY / OFFICIAL DOCUMENTS CONTEXT]
    ${libraryContext}
    ` : ''}

    INPUT DATA:
    ${formatPlotInfo(dataA, "PLOT DATA")}
    ${mode === AnalysisMode.COMPARISON && dataB ? formatPlotInfo(dataB, "PLOT B DATA") : ""}
    
    ${sourceHierarchy}
    ${focusInstruction}

    -------------------------------------------------------------------
    OUTPUT FORMAT REQUIREMENTS (STRICT HTML)
    Return the result as clean HTML only. No Markdown. No \`\`\`html blocks.
    
    Structure the report with the following EXACT hierarchy. 
    Use <h2> for Main Sections (numbered 1.0, 2.0). 
    Use <h3> for Subsections (1.1, 1.2).
    Use <table> for all data.

    <h2>1.0 ${language === 'ar' ? 'ملخص الاشتراطات التنظيمية' : 'SITE REGULATION SUMMARY'}</h2>
    <p>Context summary and source validation.</p>
    
    <h3>1.1 ${language === 'ar' ? 'جدول الاشتراطات' : 'Regulation Table'}</h3>
    <table border="1" cellpadding="5" cellspacing="0" width="100%">
      <thead>
        <tr>
          <th>${language === 'ar' ? 'التصنيف' : 'Category'}</th>
          <th>${language === 'ar' ? 'القيمة / النظام' : 'Requirement'}</th>
          <th>${language === 'ar' ? 'المصدر' : 'Source'}</th>
          <th>${language === 'ar' ? 'الثقة' : 'Confidence'}</th>
        </tr>
      </thead>
      <tbody>
        <!-- Rows for: Land Use, Max Height, FAR/BUA, Setbacks, Coverage %, Parking -->
      </tbody>
    </table>

    <h2>2.0 ${language === 'ar' ? 'تحليل الامتثال للمشروع' : 'PROJECT COMPLIANCE ANALYSIS'}</h2>
    <p>Review of the proposed project against regulations.</p>
    <ul>
       <li><strong>${language === 'ar' ? 'الاستخدام:' : 'Use:'}</strong> [Analysis]</li>
       <li><strong>${language === 'ar' ? 'الكتلة:' : 'Massing:'}</strong> [Analysis]</li>
    </ul>

    <h2>3.0 ${language === 'ar' ? 'حساب المساحات والكفاءة' : 'DEVELOPMENT YIELD CALCULATOR'}</h2>
    <p><strong>Plot Area:</strong> ${dataA.plotArea || "Calculated from dimensions"} m²</p>
    
    <h3>3.1 ${language === 'ar' ? 'مساحة الدور الأرضي (Footprint)' : 'Max Footprint Derivation'}</h3>
    <table border="1" cellpadding="5" cellspacing="0" width="100%">
       <thead>
          <tr>
             <th>${language === 'ar' ? 'المعيار' : 'Constraint'}</th>
             <th>${language === 'ar' ? 'طريقة الحساب' : 'Logic'}</th>
             <th>${language === 'ar' ? 'الناتج (م²)' : 'Area (m²)'}</th>
          </tr>
       </thead>
       <tbody>
          <tr style="font-weight:bold; background-color: #f8fafc;">
             <td>GOVERNING LIMIT</td>
             <td>(Lesser value)</td>
             <td>[Final Value]</td>
          </tr>
       </tbody>
    </table>

    <h3>3.2 ${language === 'ar' ? 'المؤشرات التخطيطية' : 'Capacity Metrics'}</h3>
    <table border="1" cellpadding="5" cellspacing="0" width="100%">
       <tbody>
          <tr><td><strong>Allowed FAR</strong></td><td>...</td></tr>
          <tr><td><strong>Max GFA</strong></td><td>...</td></tr>
          <tr><td><strong>Max Floors</strong></td><td>...</td></tr>
       </tbody>
    </table>

    <h2>4.0 ${language === 'ar' ? 'التوصيات والمخاطر' : 'RECOMMENDATIONS & RISKS'}</h2>
    <ul>
      <li>...</li>
    </ul>

    ${mode === AnalysisMode.COMPARISON ? `
    <h2>5.0 ${language === 'ar' ? 'مقارنة الخيارات' : 'COMPARISON ANALYSIS'}</h2>
    <table border="1" cellpadding="5" cellspacing="0" width="100%">
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Option A</th>
          <th>Option B</th>
          <th>Comment</th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    </table>
    ` : ''}

    -------------------------------------------------------------------
    DISCLAIMER & PREVIEW NOTICE:
    This report is an automated research preview for advisory planning purposes only. Verify all parameters with municipal zoning authorities.
    
    -------------------------------------------------------------------
    SELF-LEARNING PROTOCOL (HIDDEN OUTPUT):
    <!-- LEARNING_BLOCK_START
    {
      "city": "${dataA.city}",
      "country": "${dataA.country}",
      "zoning_summary": "Extracted regulations for ${dataA.district || dataA.city}",
      "key_metrics": {
         "max_height": "...",
         "far": "...",
         "coverage": "...",
         "setbacks": "..."
      },
      "source_quality": "High | Medium | Low"
    }
    LEARNING_BLOCK_END -->
  `;
};

// --- POLICY LAB LOGIC ---

export const analyzePolicy = async (
  policyData: PolicyData,
  libraryDocs: LibraryDocument[],
  uiLanguage: Language,
  ctx?: ApiSecurityContext
): Promise<string> => {
  const apiKey = getVerifiedApiKey(ctx);
  const model = getSafeModelName(ctx?.env);
  const ai = new GoogleGenAI({ apiKey });

  let sourceContext = libraryDocs.map(d => 
      `[Document ID: ${d.id}] Title: ${d.title} (${d.year}). Context: ${d.notes || 'None'}`
  ).join('\n');

  const linkSources = policyData.customSources.filter(s => s.type === 'LINK');
  if (linkSources.length > 0) {
      sourceContext += '\n\n' + linkSources.map(l => `[Session Link] Title: ${l.title} URL: ${l.url}`).join('\n');
  }

  const parts: any[] = [];
  
  if (policyData.supportingFiles) {
      for (const file of policyData.supportingFiles.slice(0, 3)) { // Max 3 files to preserve free limits
          parts.push({
              inlineData: { mimeType: file.type, data: file.data }
          });
      }
  }

  const priorities = policyData.priorities || { speed: 3, safety: 5, economy: 3, feasibility: 4 };
  const targetLang = policyData.outputLanguage === 'bilingual' ? 'bilingual' : uiLanguage;
  
  let langInstruction = targetLang === 'ar'
    ? "** STRICT LANGUAGE RULE: ARABIC ONLY ** Use <div dir=\"rtl\"> for Arabic text."
    : targetLang === 'en'
      ? "** STRICT LANGUAGE RULE: ENGLISH ONLY **"
      : "** STRICT LANGUAGE RULE: BILINGUAL (ENGLISH + ARABIC) **";

  const prompt = `
      You are CodeScout Pro – Policy Lab (Decision Desk). Produce an executive Official Policy Memo in HTML format.
      
      RULES:
      ${langInstruction}
      No hallucinations. Mark uncertainties as "Needs confirmation".
      
      INPUTS:
      - Scope: ${policyData.city}, ${policyData.country} (${policyData.district || 'City-wide'})
      - Sector: ${policyData.sector === PolicySector.OTHER ? policyData.sectorCustom || 'Unspecified' : policyData.sector}
      - Core Objective: ${policyData.objectives.join('; ')}
      - Policy Context: ${policyData.policyContext || "None provided"}
      - Pain Points: [${policyData.painPoints.join(', ')}]. Evidence: ${policyData.evidenceText}
      - Priority Weights: Speed=${priorities.speed}, Safety=${priorities.safety}, Economy=${priorities.economy}, Feasibility=${priorities.feasibility}
      
      OUTPUT: Clean HTML only. Include Executive Summary, Problem Definition, Policy Options Table, Trade-off Matrix, and Draft Amendments.
  `;

  try {
      const response = await ai.models.generateContent({
          model,
          contents: { parts: [{ text: prompt }, ...parts] }
      });
      return response.text || "";
  } catch (error: any) {
      console.error("[geminiServer] Policy Analysis Error:", error?.message || error);
      throw error;
  }
};

export const refinePolicyReport = async (
  currentHtml: string,
  policyData: PolicyData,
  updatePayload: PolicyUpdate,
  versionNumber: number,
  ctx?: ApiSecurityContext
): Promise<{ html: string; changeLog: string }> => {
  const apiKey = getVerifiedApiKey(ctx);
  const model = getSafeModelName(ctx?.env);
  const ai = new GoogleGenAI({ apiKey });

  let boardSummary = "No workshop board data.";
  if (updatePayload.boardContext && updatePayload.boardContext.nodes.length > 0) {
      const nodes = updatePayload.boardContext.nodes.map(n => 
          `- [${n.type}] "${n.title}" by ${n.stakeholder} (${n.status})`
      ).join('\n');
      boardSummary = `WORKSHOP BOARD CARDS:\n${nodes}`;
  }

  const prompt = `
      SYSTEM: You are CodeScout Pro Policy Editor.
      TASK: Update this Policy Report HTML based on user instructions to Version ${versionNumber}.
      Language: ${updatePayload.language}
      Intent: ${updatePayload.intent}
      Format: ${updatePayload.outputFormat}
      ${boardSummary}
      
      EXISTING HTML:
      ${currentHtml.substring(0, 8000)}

      Return the full updated HTML string only.
  `;

  try {
      const response = await ai.models.generateContent({
          model,
          contents: prompt
      });
      const html = response.text || "";
      const changeLog = `v${versionNumber}: ${updatePayload.intent.substring(0, 50)}...`;
      return { html, changeLog };
  } catch (error: any) {
      console.error("[geminiServer] Refinement Error:", error?.message || error);
      throw error;
  }
};

// --- ZONING ANALYSIS LOGIC ---

export const analyzeZoning = async (
  mode: AnalysisMode,
  dataA: PlotData,
  dataB: PlotData | undefined,
  language: Language,
  libraryContext: string,
  learnedContext: string | null,
  ctx?: ApiSecurityContext
): Promise<{ html: string; groundingMetadata: any }> => {
  const apiKey = getVerifiedApiKey(ctx);
  const model = getSafeModelName(ctx?.env);
  const ai = new GoogleGenAI({ apiKey });

  const promptText = generatePrompt(mode, dataA, dataB, language, libraryContext, learnedContext);
  const parts: any[] = [{ text: promptText }];
  
  if (dataA.attachments) {
      for (const file of dataA.attachments.slice(0, 2)) { // Max 2 files for safety
          parts.push({
              inlineData: { mimeType: file.type, data: file.data }
          });
      }
  }
  if (mode === AnalysisMode.COMPARISON && dataB?.attachments) {
       for (const file of dataB.attachments.slice(0, 2)) {
          parts.push({
              inlineData: { mimeType: file.type, data: file.data }
          });
      }
  }

  // Pure zero-cost Gemini Free Tier execution: NO billable search grounding
  const response = await ai.models.generateContent({
      model,
      contents: { parts }
  });

  const html = response.text || "";
  
  return {
      html,
      groundingMetadata: response.candidates?.[0]?.groundingMetadata || null
  };
};

export const translateReport = async (
  htmlContent: string, 
  targetLang: Language,
  ctx?: ApiSecurityContext
): Promise<string> => {
    const apiKey = getVerifiedApiKey(ctx);
    const model = getSafeModelName(ctx?.env);
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
        Translate the following HTML report to ${targetLang === 'ar' ? 'Arabic' : 'English'}.
        Keep HTML structure exactly intact. Use professional urban planning terminology.
        
        HTML:
        ${htmlContent.substring(0, 10000)}
    `;

    const response = await ai.models.generateContent({
        model,
        contents: prompt
    });

    return response.text || htmlContent;
};

export const chatWithAssistant = async (
    history: any[], 
    lastMessage: string, 
    context: { plot?: PlotData, analysisResult?: string | null, language: Language, policyContext?: any },
    ctx?: ApiSecurityContext
): Promise<string> => {
     const apiKey = getVerifiedApiKey(ctx);
     const model = getSafeModelName(ctx?.env);
     const ai = new GoogleGenAI({ apiKey });

     let systemInstruction = `You are CodeScout Assistant, an expert AI in Zoning and Construction Law.
     Reply in ${context.language === 'ar' ? 'Arabic' : 'English'}.
     Keep paragraphs concise and professional.
     `;
     
     if (context.plot) {
        systemInstruction += ` Plot Type: ${context.plot.projectType} in ${context.plot.city}, ${context.plot.country}.`;
     }

     const chatHistory = history.slice(-6).map(h => ({
         role: h.role === 'model' ? 'model' : 'user',
         parts: h.parts
     }));

     const chat = ai.chats.create({
         model,
         config: { systemInstruction },
         history: chatHistory
     });

     const result = await chat.sendMessage({ message: lastMessage });
     return result.text || "";
};
