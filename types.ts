
export interface AttachedFile {
  name: string;
  type: string;
  data: string; // Base64 encoded string
}

// test

export interface PlotData {
  id: string;
  name: string; // "Option A" or "Option B"
  country: string;
  city: string;
  address: string;
  district?: string;
  gps?: string;
  width?: string;
  depth?: string;
  streetWidth?: string;
  secondaryStreetWidth?: string; // New field for corner plots
  plotOrientation?: string; // e.g., "Mid-block", "Corner", "3-Facades"
  projectType: string;
  projectDescription?: string; // New field for detailed program
  plotArea?: string;
  boundaryCoords?: string;
  specificFocus?: string; // e.g., "Parking only", "Height limits"
  attachments?: AttachedFile[]; // Array of uploaded PDF files
}

export interface AnalysisState {
  isLoading: boolean;
  result: string | null;
  error: string | null;
  groundingMetadata: any | null;
}

export enum AnalysisMode {
  SINGLE = 'SINGLE',
  COMPARISON = 'COMPARISON',
}

export type Language = 'en' | 'ar';

// --- LIBRARY TYPES ---

export enum CodeType {
  ZONING = "Zoning Regulation",
  BUILDING = "Building Code",
  FIRE = "Fire Safety",
  ACCESSIBILITY = "Accessibility/ADA",
  PARKING = "Parking Standards",
  HERITAGE = "Heritage/Conservation",
  ENVIRONMENTAL = "Environmental",
  OTHER = "Other"
}

export enum CoverageType {
  CITY_WIDE = "City-Wide",
  DISTRICT_SPECIFIC = "District-Specific",
  PLOT_SPECIFIC = "Plot-Specific"
}

export type LibraryVisibility = 'PRIVATE' | 'PUBLIC';

export interface LibraryDocument {
  id: string;
  title: string;
  fileName?: string; // Optional (if PDF)
  fileData?: string; // Base64 (Optional if URL)
  url?: string;      // New: Official Link (Optional if PDF)
  country: string;
  city?: string;
  district?: string;
  authority?: string;
  codeType: CodeType;
  codeTypeCustom?: string; // New: If codeType is OTHER
  year?: string;
  language?: string;
  coverage: CoverageType;
  notes?: string;
  dateUploaded: number;
  
  // New Community Features
  visibility: LibraryVisibility;
  verified?: boolean; // If true, shows a badge (Admin verified)
  uploaderName?: string; // "Anonymous" or user name
  reportCount?: number; // For moderation
  originalSourceId?: string; // If cloned from community
  isLocalOwner?: boolean; // New: To track ownership of publicly shared items
}

// --- POLICY LAB TYPES ---

export enum PolicySector {
  HOUSING = "Housing & Residential",
  COMMERCIAL = "Commercial & Retail",
  INDUSTRIAL = "Industrial & Logistics",
  HOSPITALITY = "Hospitality & Tourism",
  HEALTHCARE = "Healthcare",
  EDUCATION = "Education",
  HERITAGE = "Heritage & Culture",
  INFRASTRUCTURE = "Public Infrastructure",
  OTHER = "Other"
}

export type PolicyOutputLanguage = 'en' | 'ar' | 'bilingual';

export interface PolicyCustomSource {
  id: string;
  type: 'FILE' | 'LINK';
  title: string;
  data?: string; // Base64 for file
  url?: string;
}

// --- WORKSHOP BOARD TYPES ---
export type BoardNodeType = 'PROBLEM' | 'ROOT_CAUSE' | 'EVIDENCE' | 'POLICY_OPTION' | 'RISK' | 'STAKEHOLDER';

export interface BoardNode {
  id: string;
  type: BoardNodeType;
  title: string;
  description: string;
  stakeholder: string; // Who raised this?
  status: 'DRAFT' | 'APPROVED';
  x: number;
  y: number;
}

export interface BoardEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: 'CAUSES' | 'SOLVES' | 'BLOCKS' | 'DEPENDS_ON';
}

export interface PolicyData {
  country: string;
  city: string;
  district: string;
  sector: PolicySector;
  sectorCustom?: string; // New field for custom sector
  objectives: string[]; // e.g. "Increase density", "Reduce traffic"
  policyContext?: string; // New: Clarification field
  selectedSourceIds: string[]; // IDs of LibraryDocuments
  customSources: PolicyCustomSource[]; // New: Session-specific sources
  saveSourcesToLibrary: boolean; // New: Preference to save uploads
  painPoints: string[]; // "Permits rejected due to..."
  evidenceText: string; // Free text for delays/conflicts
  supportingFiles?: AttachedFile[];
  outputLanguage: PolicyOutputLanguage; // New field for reporting language
  boardNodes: BoardNode[]; // Persist board state
  boardEdges: BoardEdge[]; // Persist connections
  priorities: {
    speed: number;
    safety: number;
    economy: number;
    feasibility: number;
  };
}

// --- WORKSHOP UPDATE TYPES (NEW) ---

export type FocusArea = string;

export type WorkshopNoteType = 
  'DECISION_CIRCULAR' | 
  'MEETING_OUTCOME' | 
  'FIELD_ISSUE' | 
  'CONSTRAINT' | 
  'PROPOSAL' | 
  'CONFLICT_REPORT' | 
  'DATA_POINT' |
  'ASSUMPTION';

export type Stakeholder = 
  'MUNICIPALITY' | 
  'TRAFFIC' | 
  'CIVIL_DEFENSE' | 
  'DEVELOPER' | 
  'PUBLIC' | 
  'MAYOR' | 
  'ENGINEERING_OFFICE' | 
  'OTHER';

export type PolicyOutputFormat = 'BRIEF' | 'CONFLICT_MAP' | 'AMENDMENT' | 'PILOT' | 'CHECKLIST';

export interface WorkshopNote {
  id: string;
  type: WorkshopNoteType;
  stakeholder?: Stakeholder;
  stakeholderCustom?: string; // New field for custom stakeholder names
  text: string;
  date?: string;
  source?: string;
}

export interface PolicyUpdate {
  // Step 1: User Intent
  intent: string;
  domain?: string;
  
  // Added fields to support advanced generation
  focusAreas?: FocusArea[];
  constraints?: string[];
  successMetric?: { type: string; target: string };

  // Step 2: Ground Reality
  workshopNotes: WorkshopNote[];
  
  // New: Board Context for deep integration
  boardContext?: {
      nodes: BoardNode[];
      edges: BoardEdge[];
  };

  // Step 3: Output Config
  outputFormat: PolicyOutputFormat;
  detailLevel: 'FAST' | 'DETAILED';
  language: PolicyOutputLanguage;
}

export interface PolicyVersion {
  versionNumber: number;
  timestamp: number;
  htmlContent: string;
  changeLogSummary: string; // "Added Circular 123, updated Option B"
  userUpdates?: PolicyUpdate;
}
