import React, { useState, useRef, useContext } from 'react';
import { X, Wand2, Link as LinkIcon, Maximize2, Trash2, CheckCircle } from 'lucide-react';
import { BoardNode, BoardEdge, BoardNodeType } from '../types';
import { LanguageContext } from '../App';

interface WorkshopBoardProps {
  nodes: BoardNode[];
  edges: BoardEdge[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (nodes: BoardNode[], edges: BoardEdge[]) => void;
  onAutoPopulate?: () => void;
}

// Updated Colors: Replaced Purple RISK with Rose (Brick Red)
const NODE_COLORS: Record<BoardNodeType, string> = {
  PROBLEM: 'bg-red-50 border-red-200 text-red-900',
  ROOT_CAUSE: 'bg-orange-50 border-orange-200 text-orange-900',
  EVIDENCE: 'bg-blue-50 border-blue-200 text-blue-900',
  POLICY_OPTION: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  RISK: 'bg-rose-50 border-rose-200 text-rose-900', // Changed from Purple to Rose
  STAKEHOLDER: 'bg-amber-50 border-amber-200 text-amber-900',
};

const WorkshopBoard: React.FC<WorkshopBoardProps> = ({ nodes, edges, isOpen, onClose, onUpdate, onAutoPopulate }) => {
  const { t, language } = useContext(LanguageContext);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [connectingSource, setConnectingSource] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<BoardNode | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Drag Logic ---
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (connectingSource) {
        if (connectingSource !== id) {
            addEdge(connectingSource, id);
            setConnectingSource(null);
        }
        return;
    }
    e.stopPropagation();
    const node = nodes.find(n => n.id === id);
    if (node) {
      setDraggingId(id);
      const rect = (e.target as Element).closest('.board-card')?.getBoundingClientRect();
      if (rect) {
          setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    const x = e.clientX - canvasRect.left - offset.x;
    const y = e.clientY - canvasRect.top - offset.y;

    const updatedNodes = nodes.map(n => 
      n.id === draggingId ? { ...n, x, y } : n
    );
    onUpdate(updatedNodes, edges);
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  // --- Card Management ---
  const addNode = (type: BoardNodeType) => {
    const newNode: BoardNode = {
      id: crypto.randomUUID(),
      type,
      title: 'New Card',
      description: '',
      stakeholder: 'MUNICIPALITY',
      status: 'DRAFT',
      x: 50 + Math.random() * 50,
      y: 50 + Math.random() * 50
    };
    onUpdate([...nodes, newNode], edges);
    setEditingNode(newNode);
  };

  const updateNode = (updated: BoardNode) => {
    const newNodes = nodes.map(n => n.id === updated.id ? updated : n);
    onUpdate(newNodes, edges);
  };

  const deleteNode = (id: string) => {
    const newNodes = nodes.filter(n => n.id !== id);
    const newEdges = edges.filter(e => e.fromId !== id && e.toId !== id);
    onUpdate(newNodes, newEdges);
    setEditingNode(null);
  };

  // --- Edge Management ---
  const addEdge = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    if (edges.some(e => e.fromId === fromId && e.toId === toId)) return;

    const newEdge: BoardEdge = {
        id: crypto.randomUUID(),
        fromId,
        toId,
        relation: 'DEPENDS_ON'
    };
    onUpdate(nodes, [...edges, newEdge]);
  };

  const deleteEdge = (id: string) => {
      onUpdate(nodes, edges.filter(e => e.id !== id));
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-y-0 right-0 w-[90%] md:w-[45%] bg-sand-50 shadow-2xl z-[60] border-l border-sand-200 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      
      {/* Header */}
      <div className="h-16 bg-white border-b border-sand-200 px-6 flex items-center justify-between shrink-0">
        <div>
            <h3 className="font-bold text-slate-900 text-lg">{t.workshopBoard}</h3>
            <p className="text-xs text-slate-500">
               {nodes.length} {t.cards} | {edges.length} {t.links} | {nodes.filter(n => n.status === 'APPROVED').length} {t.approved}
            </p>
        </div>
        <div className="flex items-center gap-2">
            {nodes.length === 0 && onAutoPopulate && (
                <button onClick={onAutoPopulate} className="text-xs font-bold bg-slate-800 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 hover:bg-slate-700 transition">
                    <Wand2 className="w-3.5 h-3.5" /> {t.startFindings}
                </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-sand-100 rounded-full text-slate-500">
                <X className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-sand-200 p-2 flex gap-2 overflow-x-auto shrink-0">
         {Object.keys(NODE_COLORS).map((type) => (
             <button
                key={type}
                onClick={() => addNode(type as BoardNodeType)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-md border border-slate-100 whitespace-nowrap hover:brightness-95 transition ${NODE_COLORS[type as BoardNodeType]}`}
             >
                 + {type.replace('_', ' ')}
             </button>
         ))}
      </div>

      {/* Canvas */}
      <div 
        ref={canvasRef}
        className="flex-1 relative overflow-hidden bg-[radial-gradient(#d6d3d1_1px,transparent_1px)] [background-size:20px_20px] bg-sand-50 cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
         {/* Edges Layer (SVG) */}
         <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#a8a29e" />
                </marker>
            </defs>
            {edges.map(edge => {
                const from = nodes.find(n => n.id === edge.fromId);
                const to = nodes.find(n => n.id === edge.toId);
                if (!from || !to) return null;
                return (
                    <g key={edge.id} className="pointer-events-auto group">
                        <line 
                            x1={from.x + 100} y1={from.y + 40}
                            x2={to.x + 100} y2={to.y + 40}
                            stroke="#d6d3d1" 
                            strokeWidth="2" 
                            markerEnd="url(#arrowhead)"
                            className="group-hover:stroke-slate-500 transition-colors cursor-pointer"
                            onClick={() => deleteEdge(edge.id)}
                        />
                        <text 
                            x={(from.x + to.x + 200) / 2} 
                            y={(from.y + to.y + 80) / 2} 
                            textAnchor="middle" 
                            fill="#78716c" 
                            fontSize="10" 
                            fontWeight="bold"
                            className="bg-white"
                        >
                            {edge.relation.toLowerCase()}
                        </text>
                    </g>
                );
            })}
            {connectingSource && (
                <rect width="100%" height="100%" fill="transparent" stroke="#334155" strokeWidth="4" className="pointer-events-none opacity-10" />
            )}
         </svg>

         {/* Nodes Layer */}
         {nodes.map(node => (
             <div
                key={node.id}
                className={`board-card absolute w-[200px] rounded-lg shadow-sm border p-3 flex flex-col gap-2 z-10 transition-all hover:shadow-lg ${NODE_COLORS[node.type]} ${connectingSource === node.id ? 'ring-2 ring-slate-800' : ''}`}
                style={{ 
                    left: node.x, 
                    top: node.y,
                    cursor: connectingSource ? 'crosshair' : 'grab'
                }}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
             >
                 <div className="flex justify-between items-start">
                     <span className="text-[10px] font-extrabold uppercase opacity-80 tracking-tight">{node.type.replace('_', ' ')}</span>
                     <div className="flex gap-1">
                        <button 
                            onMouseDown={(e) => { e.stopPropagation(); setConnectingSource(node.id === connectingSource ? null : node.id); }}
                            className={`p-1 rounded hover:bg-black/10 transition ${connectingSource === node.id ? 'bg-slate-800 text-white' : ''}`}
                            title="Connect"
                        >
                            <LinkIcon className="w-3 h-3" />
                        </button>
                        <button onMouseDown={(e) => { e.stopPropagation(); setEditingNode(node); }} className="p-1 rounded hover:bg-black/10 transition">
                            <Maximize2 className="w-3 h-3" />
                        </button>
                     </div>
                 </div>
                 
                 <div className="font-bold text-sm leading-tight line-clamp-3">{node.title}</div>
                 
                 <div className="mt-auto pt-2 border-t border-black/10 flex justify-between items-center">
                     <span className="text-[9px] font-mono truncate max-w-[80px] opacity-70">{node.stakeholder}</span>
                     {node.status === 'APPROVED' ? <CheckCircle className="w-3.5 h-3.5" /> : <div className="text-[9px] opacity-50 font-bold">{t.draft}</div>}
                 </div>
             </div>
         ))}
      </div>

      {/* Edit Node Panel */}
      {editingNode && (
          <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm z-[70] flex justify-end">
              <div className="w-full md:w-[350px] bg-white border-l border-sand-200 h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
                  <div className="flex justify-between items-center mb-6 border-b border-sand-100 pb-4">
                      <h4 className="font-bold text-slate-900">{t.editCard}</h4>
                      <button onClick={() => setEditingNode(null)} className="text-slate-400 hover:text-slate-800"><X className="w-5 h-5" /></button>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">{t.title}</label>
                          <input 
                            value={editingNode.title}
                            onChange={e => setEditingNode({...editingNode, title: e.target.value})}
                            className="w-full p-2.5 border border-sand-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">{t.type}</label>
                          <select 
                            value={editingNode.type}
                            onChange={e => setEditingNode({...editingNode, type: e.target.value as BoardNodeType})}
                            className="w-full p-2.5 border border-sand-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none"
                          >
                              {Object.keys(NODE_COLORS).map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">{t.description}</label>
                          <textarea 
                            value={editingNode.description}
                            onChange={e => setEditingNode({...editingNode, description: e.target.value})}
                            className="w-full p-2.5 border border-sand-300 rounded-lg text-sm min-h-[100px] focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">{t.stakeholder}</label>
                          <select 
                            value={editingNode.stakeholder}
                            onChange={e => setEditingNode({...editingNode, stakeholder: e.target.value})}
                            className="w-full p-2.5 border border-sand-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-slate-800 focus:border-slate-800 outline-none"
                          >
                             <option value="MUNICIPALITY">{language === 'ar' ? 'البلدية' : 'Municipality'}</option>
                             <option value="DEVELOPER">{language === 'ar' ? 'المطور' : 'Developer'}</option>
                             <option value="PUBLIC">{language === 'ar' ? 'الجمهور' : 'Public'}</option>
                             <option value="OTHER">{language === 'ar' ? 'آخر' : 'Other'}</option>
                          </select>
                      </div>
                      
                      <div className="pt-4 border-t border-sand-100 flex gap-2">
                          <button 
                            onClick={() => { 
                                const newStatus = editingNode.status === 'APPROVED' ? 'DRAFT' : 'APPROVED';
                                const updated = {...editingNode, status: newStatus};
                                setEditingNode(updated);
                                updateNode(updated); 
                            }}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-bold border transition ${editingNode.status === 'APPROVED' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-sand-50 text-slate-500 border-sand-200'}`}
                          >
                              {editingNode.status === 'APPROVED' ? t.approved : t.markApproved}
                          </button>
                          <button 
                            onClick={() => deleteNode(editingNode.id)}
                            className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                      
                      <button 
                        onClick={() => { updateNode(editingNode); setEditingNode(null); }}
                        className="w-full py-3 bg-slate-900 text-white rounded-lg font-bold text-sm hover:bg-slate-800 transition"
                      >
                          {t.saveChanges}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default WorkshopBoard;