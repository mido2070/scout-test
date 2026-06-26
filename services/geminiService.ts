
import { GoogleGenAI } from "@google/genai";
import { AnalysisMode, PlotData, Language, AttachedFile, CodeType, PolicyData, LibraryDocument, PolicyUpdate, PolicySector } from "../types";
import { libraryDB } from "./libraryDB";

// --- SELF-LEARNING MEMORY SYSTEM ---
// Uses LocalStorage to persist zoning knowledge by City/Country

const getMemoryKey = (city: string, country: string) => 
  `codescout_kb_${country.toLowerCase().trim()}_${city.toLowerCase().trim()}`;

const getLearnedContext = (city: string, country: string): string | null => {
  if (!city || !country) return null;
  // Check if running in browser
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(getMemoryKey(city, country));
};

const saveLearnedContext = (city: string, country: string, data: string) => {
  if (!city || !country || typeof window === 'undefined') return;
  
  // We save the raw JSON summary extracted from the AI model
  localStorage.setItem(getMemoryKey(city, country), data);
  console.log(`[CodeScout Memory] Updated knowledge base for ${city}, ${country}`);
};

const generatePrompt = (mode: AnalysisMode, dataA: PlotData, dataB: PlotData | undefined, language: Language, libraryContext: string = ""): string => {
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
    SOURCE OF TRUTH HIERARCHY (STRICT):
    1. **PRIMARY (Library Sources)**: 
       - **Uploaded PDFs & My Library**: Extract exact clauses and numeric requirements. 
       - **Community/Official Links**: Use search to verify.
       - These sources OVERRIDE general web search.
    2. **SECONDARY (Specific Web Search)**: 
       - Only if Library sources are missing specific data, search for Official Municipal Codes for this SPECIFIC District/Zone.
       - Use the provided District Name, GPS, or City to find the specific zoning sub-category (e.g., "Residential A", "R-3").
    3. **TERTIARY (Inference)**: 
       - If no data found, infer from general city rules (Mark Confidence as LOW).
  `;

  // --- MEMORY INJECTION ---
  const learnedData = getLearnedContext(dataA.city, dataA.country);
  const memoryBlock = learnedData 
    ? `
    *****************************************************
    [INTERNAL MEMORY / PRIOR KNOWLEDGE]
    You have previously analyzed this location (${dataA.city}, ${dataA.country}).
    Here is what you learned from previous sessions:
    
    ${learnedData}
    
    INSTRUCTION: Use this as a baseline, but valid Uploaded/Library PDFs still override this memory.
    *****************************************************
    `
    : `[No prior memory for ${dataA.city}. Start fresh analysis.]`;

  let prompt = `
    You are CodeScout Pro, an advanced Urban Planning, Zoning, and Real-Estate Development Analysis Engine.

    YOUR GOAL:
    Analyze specific plot data to produce a professional Due Diligence Report, strictly adhering to the source hierarchy.

    ${langInstruction}

    ${memoryBlock}

    ${libraryContext ? `
    *****************************************************
    [LIBRARY / OFFICIAL DOCUMENTS CONTEXT]
    The user has the following official documents/links in the library for this location:
    ${libraryContext}
    
    INSTRUCTION: Prioritize these sources. Note the "Source Type" (My Library vs Community) in your output notes if relevant.
    *****************************************************
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
          <!-- Rows for Setback calc vs Coverage calc -->
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
        <!-- Comparison rows -->
      </tbody>
    </table>
    ` : ''}

    -------------------------------------------------------------------
    SAFETY RULES:
    1. Never invent exact legal numbers. If unsure, state "Advisory" or "Needs Confirmation".
    2. If PDFs are uploaded (Direct or Library), they are the source of truth.
    
    -------------------------------------------------------------------
    SELF-LEARNING PROTOCOL (HIDDEN OUTPUT):
    At the absolute end of your response, after all HTML, you MUST generate a structured JSON block inside a comment.
    <!-- LEARNING_BLOCK_START
    {
      "city": "${dataA.city}",
      "country": "${dataA.country}",
      "zoning_summary": "Extracted regulations for [District]",
      "key_metrics": {
         "max_height": "...",
         "far": "...",
         "coverage": "...",
         "setbacks": "..."
      },
      "source_quality": "High (PDF) | Medium (Search) | Low (Inferred)"
    }
    LEARNING_BLOCK_END -->
  `;

  return prompt;
};

// --- POLICY LAB LOGIC ---

export const analyzePolicy = async (
    policyData: PolicyData,
    libraryDocs: LibraryDocument[],
    uiLanguage: Language
): Promise<string> => {
    if (!process.env.API_KEY) throw new Error("API Key is missing.");
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 1. Prepare Context from Library
    let sourceContext = libraryDocs.map(d => 
        `[Document ID: ${d.id}] Title: ${d.title} (${d.year}). Content Context: ${d.notes || 'No notes'}`
    ).join('\n');

    // 2. Prepare Context from Custom Session Sources (Links)
    const linkSources = policyData.customSources.filter(s => s.type === 'LINK');
    if (linkSources.length > 0) {
        sourceContext += '\n\n' + linkSources.map(l => `[Session Link] Title: ${l.title} URL: ${l.url}`).join('\n');
    }

    // 3. Prepare Multimedia (Evidence + Custom File Sources)
    const parts: any[] = [];
    
    // Add Evidence Files
    if (policyData.supportingFiles) {
        for (const file of policyData.supportingFiles) {
            parts.push({
                inlineData: { mimeType: file.type, data: file.data }
            });
        }
    }
    // Add Custom Session Source Files
    const fileSources = policyData.customSources.filter(s => s.type === 'FILE');
    if (fileSources) {
        for (const src of fileSources) {
            if (src.data) {
                parts.push({
                    inlineData: { mimeType: 'application/pdf', data: src.data }
                });
            }
        }
    }

    const priorities = policyData.priorities || { speed: 3, safety: 5, economy: 3, feasibility: 4 };

    // Determine Output Language Strategy
    const targetLang = policyData.outputLanguage === 'bilingual' ? 'bilingual' : uiLanguage;
    
    let langInstruction = "";
    let mainDir = "ltr";
    
    if (targetLang === 'ar') {
        langInstruction = `
        ** STRICT LANGUAGE RULE: ARABIC ONLY **
        The user wants the entire report in ARABIC. 
        - Translate all headers, bullet points, table cells, and reasoning to Arabic.
        - Do not include English unless necessary for citations.
        - Use <div dir="rtl"> for the main container.
        `;
        mainDir = "rtl";
    } else if (targetLang === 'en') {
        langInstruction = `
        ** STRICT LANGUAGE RULE: ENGLISH ONLY **
        The user wants the entire report in ENGLISH.
        - Translate all analysis to English.
        `;
    } else {
        // Bilingual
        langInstruction = `
        ** STRICT LANGUAGE RULE: BILINGUAL (ENGLISH + ARABIC) **
        1. Bilingual Lock: Output MUST be fully bilingual. 
        2. STRUCTURE: 
           - For Titles/Headers: English on top, Arabic below.
           - For Text Blocks: Use separate paragraphs for English and Arabic. DO NOT MIX in the same sentence.
           - For Tables: Use English in the cell, followed by <br/> and Arabic translation.
        3. ISOLATION: Wrap Arabic text in <span dir="rtl" lang="ar">...</span> tags to prevent scrambling.
        `;
    }

    const prompt = `
        SYSTEM / DEVELOPER (Highest Priority)
        You are CodeScout Pro – Policy Lab (Decision Desk). Produce a highly formal, executive "Official Memo" report.
        
        HARD RULES:
        ${langInstruction}
        2. Evidence-Based: Use Workshop Notes + Policy Updates as primary evidence. State if evidence is missing.
        3. No Hallucinations: Do not invent legal requirements. Mark uncertainties as "Needs confirmation".
        4. Citations: Always cite sources (Library PDFs, Links).
        
        INPUTS:
        - Scope: ${policyData.city}, ${policyData.country} (${policyData.district || 'City-wide'})
        - Sector: ${policyData.sector === PolicySector.OTHER ? policyData.sectorCustom || 'Unspecified' : policyData.sector}
        - Core Objective: ${policyData.objectives.join('; ')}
        - Policy Context: ${policyData.policyContext || "None provided"}
        - Evidence & Issues: Pain Points: [${policyData.painPoints.join(', ')}]. Qualitative: ${policyData.evidenceText}
        - Sources: ${sourceContext || "No library sources. Search online."}
        - Priority Sliders (0-5): Speed=${priorities.speed}, Safety=${priorities.safety}, Economy=${priorities.economy}, Feasibility=${priorities.feasibility}
        
        REQUIRED OUTPUT STRUCTURE (HTML Format):
        
        <div class="report-content policy-memo" dir="${mainDir}">
        
        <!-- OFFICIAL HEADER TABLE -->
        <table border="0" width="100%" style="border:none; margin-bottom: 30px; border-bottom: 2px solid #000;">
            <tr>
                <td width="30%" valign="top" style="border:none;">
                   <div style="font-size:10px; color:#666;">AUTHORITY / MUNICIPALITY</div>
                   <div style="font-weight:bold; font-size:14px; text-transform:uppercase;">${policyData.city} URBAN LAB</div>
                </td>
                <td width="40%" align="center" valign="middle" style="border:none;">
                   <h1 style="margin:0; font-size:18px; text-transform:uppercase;">DECISION MEMORANDUM</h1>
                   ${targetLang !== 'en' ? '<h1 style="margin:5px 0 0 0; font-size:18px; font-family:Cairo, sans-serif;">مذكرة قرار سياسات</h1>' : ''}
                </td>
                <td width="30%" align="right" valign="top" style="border:none;">
                   <div style="font-size:10px;">DATE: ${new Date().toLocaleDateString()}</div>
                   <div style="font-size:10px;">REF: PL-${Math.floor(Math.random()*10000)}</div>
                </td>
            </tr>
        </table>

        <!-- 1. EXECUTIVE SUMMARY (Boxed) -->
        <div style="border: 1px solid #000; padding: 15px; margin-bottom: 30px; background-color: #f9f9f9;">
            <h3 style="margin-top:0; border-bottom:1px solid #ccc; padding-bottom:5px;">EXECUTIVE SUMMARY ${targetLang !== 'en' ? ' / الملخص التنفيذي' : ''}</h3>
            <p><strong>Subject:</strong> ...</p>
            <p><strong>Recommendation:</strong> ...</p>
        </div>

        <!-- 2. PROBLEM DEFINITION -->
        <h2>1.0 PROBLEM DEFINITION ${targetLang !== 'en' ? '<span style="float:right; font-family:Cairo;">1.0 تعريف المشكلة</span>' : ''}</h2>
        <p>Analysis of regulatory ambiguity, conflicts, and data gaps.</p>
        <ul>
            <li>...</li>
        </ul>

        <!-- 3. POLICY OPTIONS -->
        <h2>2.0 POLICY OPTIONS ${targetLang !== 'en' ? '<span style="float:right; font-family:Cairo;">2.0 خيارات السياسات</span>' : ''}</h2>
        <table border="1" cellpadding="8" cellspacing="0" width="100%">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th width="20%">CRITERIA ${targetLang !== 'en' ? '<br/>المعيار' : ''}</th>
                    <th width="26%">OPTION A (Quick) ${targetLang !== 'en' ? '<br/>خيار (أ)' : ''}</th>
                    <th width="26%">OPTION B (Recommended) ${targetLang !== 'en' ? '<br/>خيار (ب)' : ''}</th>
                    <th width="26%">OPTION C (Structural) ${targetLang !== 'en' ? '<br/>خيار (ج)' : ''}</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>Mechanism</strong> ${targetLang !== 'en' ? '<br/><span dir="rtl">الآلية</span>' : ''}</td>
                    <td>...</td>
                    <td>...</td>
                    <td>...</td>
                </tr>
            </tbody>
        </table>

        <!-- 4. TRADE-OFF ANALYSIS -->
        <h2>3.0 TRADE-OFF ANALYSIS ${targetLang !== 'en' ? '<span style="float:right; font-family:Cairo;">3.0 تحليل المفاضلة</span>' : ''}</h2>
        <p>Weighted scoring based on user priorities.</p>
        <table border="1" cellpadding="5" cellspacing="0" width="100%">
             <!-- Scoring table -->
        </table>

        <!-- 5. DRAFT AMENDMENT TEXT -->
        <h2>4.0 DRAFT REGULATION TEXT ${targetLang !== 'en' ? '<span style="float:right; font-family:Cairo;">4.0 مسودة التنظيم</span>' : ''}</h2>
        <table border="1" cellpadding="8" cellspacing="0" width="100%">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th width="40%">CURRENT GAP ${targetLang !== 'en' ? '<br/>الفجوة الحالية' : ''}</th>
                    <th width="40%">PROPOSED TEXT ${targetLang !== 'en' ? '<br/>النص المقترح' : ''}</th>
                    <th width="20%">REASONING ${targetLang !== 'en' ? '<br/>السبب' : ''}</th>
                </tr>
            </thead>
            <tbody>
                <!-- Rows -->
            </tbody>
        </table>

        <!-- 6. NEXT STEPS -->
        <h2>5.0 IMPLEMENTATION ${targetLang !== 'en' ? '<span style="float:right; font-family:Cairo;">5.0 التنفيذ</span>' : ''}</h2>
        <ul>
            <li><strong>Immediate:</strong> ...</li>
        </ul>

        <div style="margin-top:50px; border-top:1px solid #000; padding-top:10px; font-size:10px; text-align:center;">
            GENERATED BY CODESCOUT PRO POLICY LAB - OFFICIAL USE ONLY
        </div>

        </div>
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts: [{ text: prompt }, ...parts] }
        });
        const fullHtml = response.text || "";
        
        return fullHtml;
    } catch (error) {
        console.error("Policy Refinement Error", error);
        throw error;
    }
};

export const refinePolicyReport = async (
    currentHtml: string,
    policyData: PolicyData,
    updatePayload: PolicyUpdate,
    versionNumber: number
): Promise<{ html: string; changeLog: string }> => {
    if (!process.env.API_KEY) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Prepare board summary if available
    let boardSummary = "No workshop board data.";
    if (updatePayload.boardContext && updatePayload.boardContext.nodes.length > 0) {
        const nodes = updatePayload.boardContext.nodes.map(n => 
            `- [${n.type}] "${n.title}" by ${n.stakeholder} (${n.status})`
        ).join('\n');
        
        const edges = updatePayload.boardContext.edges.map(e => {
            const from = updatePayload.boardContext?.nodes.find(n => n.id === e.fromId);
            const to = updatePayload.boardContext?.nodes.find(n => n.id === e.toId);
            return from && to ? `- "${from.title}" ${e.relation} "${to.title}"` : '';
        }).join('\n');

        boardSummary = `
        WORKSHOP BOARD CARDS:
        ${nodes}
        
        RELATIONSHIPS:
        ${edges}
        `;
    }

    const targetLang = updatePayload.language; 
    const langInstruction = targetLang === 'ar' 
        ? "STRICTLY OUTPUT THE ENTIRE UPDATE IN ARABIC. Do not mix English."
        : targetLang === 'en' 
            ? "STRICTLY OUTPUT THE ENTIRE UPDATE IN ENGLISH." 
            : "Keep output BILINGUAL (English then Arabic).";

    const prompt = `
        SYSTEM: You are CodeScout Pro Policy Editor.
        TASK: Update an existing Policy Report (HTML) based on new user instructions (Policy Update).
        
        CONTEXT:
        Country: ${policyData.country}
        City: ${policyData.city}
        
        CURRENT REPORT HTML:
        ${currentHtml}

        USER UPDATE INSTRUCTIONS:
        - Intent: ${updatePayload.intent}
        - Domain: ${updatePayload.domain || 'Unspecified'}
        - Workshop Notes (Evidence/Feedback): ${JSON.stringify(updatePayload.workshopNotes.map(n => `${n.type} from ${n.stakeholder}: ${n.text}`))}
        - Requested Output Format: ${updatePayload.outputFormat}
        - Detail Level: ${updatePayload.detailLevel}
        - Language Setting: ${updatePayload.language}

        ${boardSummary}

        RULES:
        1. Return the FULL updated HTML document. Do not return just the changed parts.
        2. Maintain the professional styling (Official Memo format with Header Table).
        3. If "Output Format" changed, adjust the document structure accordingly.
        4. Update the report to Version ${versionNumber}.
        5. ${langInstruction}

        **CRITICAL INSTRUCTION - DRAFT POLICY UPDATE (SECTION 4.0):**
        - Ensure Section 4.0 covers ALL affected policies. Do NOT limit it to one single amendment. 
        - If multiple regulations (e.g., Parking, Setbacks, Usage) are affected, create a row for EACH in the table.
        - The first column "Current Status / Regulatory Gap" must describe the status quo or the gap if no text exists, not just "Current Text".

        **CRITICAL INSTRUCTION - WORKSHOP IMPACT ANALYSIS:**
        If Workshop Board Data is present:
        1. Create a NEW section "6.0 Workshop Impact Assessment" (${targetLang === 'ar' ? '6.0 تقييم أثر ورشة العمل' : '6.0 Workshop Impact Assessment'}) at the end.
        2. Analyze the connections: If a "POLICY_OPTION" solves a "PROBLEM", describe it.
        3. For "APPROVED" cards, explicitly state they are now directives.
        4. Assess IMPACT: State clearly if the proposed changes make the situation BETTER or WORSE compared to the status quo, and why.
           - Use format: "Proposed: [Title] -> Addresses: [Problem] -> Impact: [Positive/Negative] because..."
        5. Ensure this new section follows the selected language (${targetLang}).
        
        OUTPUT:
        Return ONLY the HTML string.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt
        });
        const html = response.text || "";
        const changeLog = `v${versionNumber}: ${updatePayload.intent.substring(0, 50)}...`;
        
        return { html, changeLog };
    } catch (error) {
        console.error("Refinement Error", error);
        throw error;
    }
};

// --- ZONING ANALYSIS LOGIC ---

export const analyzeZoning = async (
  mode: AnalysisMode,
  dataA: PlotData,
  dataB: PlotData | undefined,
  language: Language
): Promise<{ html: string; groundingMetadata: any }> => {
  if (!process.env.API_KEY) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. Fetch relevant library documents (Context Retrieval)
  let libraryContext = "";
  try {
      const docs = await libraryDB.findRelevantDocuments(dataA.country, dataA.city);
      if (docs.length > 0) {
          libraryContext = docs.map(d => 
              `- [${d.visibility === 'PUBLIC' ? 'Community' : 'My Library'}] ${d.title} (${d.codeType}): ${d.notes || ''} ${d.url ? `(${d.url})` : ''}`
          ).join('\n');
      }
  } catch (e) {
      console.warn("Failed to retrieve library docs", e);
  }

  // 2. Generate Prompt
  const promptText = generatePrompt(mode, dataA, dataB, language, libraryContext);

  // 3. Prepare Multi-modal Parts
  const parts: any[] = [{ text: promptText }];
  
  // Attach PDFs from A
  if (dataA.attachments) {
      for (const file of dataA.attachments) {
          parts.push({
              inlineData: { mimeType: file.type, data: file.data }
          });
      }
  }
  // Attach PDFs from B (Comparison)
  if (mode === AnalysisMode.COMPARISON && dataB?.attachments) {
       for (const file of dataB.attachments) {
          parts.push({
              inlineData: { mimeType: file.type, data: file.data }
          });
      }
  }

  // 4. Call Gemini
  const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Use Pro for complex reasoning
      contents: { parts },
      config: {
          tools: [{ googleSearch: {} }], // Use Search for grounding
      }
  });

  const html = response.text || "";
  
  // 5. Self-Learning Extraction
  const jsonMatch = html.match(/<!-- LEARNING_BLOCK_START([\s\S]*?)LEARNING_BLOCK_END -->/);
  if (jsonMatch && jsonMatch[1]) {
     saveLearnedContext(dataA.city, dataA.country, jsonMatch[1]);
  }

  return {
      html,
      groundingMetadata: response.candidates?.[0]?.groundingMetadata
  };
};

export const translateReport = async (htmlContent: string, targetLang: Language): Promise<string> => {
    if (!process.env.API_KEY) throw new Error("API Key is missing.");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
        Translate the following HTML content to ${targetLang === 'ar' ? 'Arabic' : 'English'}.
        
        RULES:
        1. Keep all HTML tags structure EXACTLY as is. Only translate the text content inside tags.
        2. Use professional Urban Planning / Legal terminology.
        3. Do not translate proper nouns if they are better kept in original (or provide transliteration).
        4. If translating to Arabic, ensure numeric values use Western Arabic numerals (0-9) inside technical tables if appropriate for the context, or standard Arabic numerals.
        
        HTML:
        ${htmlContent}
    `;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview", // Flash is fast and sufficient for translation
        contents: prompt
    });

    return response.text || htmlContent;
};

export const chatWithAssistant = async (
    history: any[], 
    lastMessage: string, 
    context: { plot?: PlotData, analysisResult?: string | null, language: Language, policyContext?: any }
): Promise<string> => {
     if (!process.env.API_KEY) throw new Error("API Key is missing.");
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

     let systemInstruction = `You are CodeScout Assistant, an expert AI in Zoning and Construction Law.
     
     CORE BEHAVIOR:
     1. LANGUAGE ADAPTABILITY: You MUST detect the language of the user's latest message.
        - If the user writes in Arabic, reply in ARABIC.
        - If the user writes in English, reply in ENGLISH.
        - Do not force the response language based on previous context if the user switches languages.
     
     2. FORMATTING & CLARITY:
        - Use clear line breaks between paragraphs.
        - Use bullet points (- ) for lists to ensure readability.
        - Avoid long, dense blocks of text. Keep paragraphs short (3-4 lines max).
        - When using technical terms in Arabic, optionally provide the English term in parentheses, e.g., "الارتداد (Setback)".
     `;
     
     // Specific Context Injection for Policy Mode vs Plot Analysis Mode
     if (context.policyContext) {
        systemInstruction += `
            ROLE: Policy Workshop Assistant.
            
            RULES:
            1. Keep answers SHORT (Max 6 lines).
            2. NO Markdown formatting (no bold, no lists, just plain text).
            3. If user asks to "Change" something, explicitly state: "You should add this change: [One Line Description]".
            
            CONTEXT:
            Current Report Draft Snippet: ${context.analysisResult ? context.analysisResult.substring(0, 1000) : 'None'}.
            User Updates: ${JSON.stringify(context.policyContext)}.
        `;
     } else if (context.plot) {
        systemInstruction += `
            MODE: ZONING ANALYSIS.
            Plot: ${context.plot.projectType} in ${context.plot.city}.
            Report Content (HTML): ${context.analysisResult ? context.analysisResult.replace(/<[^>]*>?/gm, ' ') : "N/A"}.
        `;
     }

     // Remove the last message from history passed by UI to avoid duplication, as we send it in sendMessage
     const chatHistory = history.slice(0, -1).map(h => ({
         role: h.role === 'model' ? 'model' : 'user',
         parts: h.parts
     }));

     const chat = ai.chats.create({
         model: "gemini-3-flash-preview",
         config: { systemInstruction },
         history: chatHistory
     });

     const result = await chat.sendMessage({ message: lastMessage });
     return result.text || "";
};
