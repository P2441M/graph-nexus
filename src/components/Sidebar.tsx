import React, { useState, useEffect } from 'react';
import { Settings, Share2, Info, ArrowRight, RefreshCw, Layers, Zap, Anchor, GitBranch, Plus, X, Edit2, Check, Trash2, Eye, EyeOff } from 'lucide-react';
import { GraphType, Node, GraphState, LayoutMode } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  graphs: GraphState[];
  activeGraphId: string;
  visibleGraphIds: Set<string>;
  onAddGraph: () => void;
  onSwitchGraph: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onDeleteGraph: (id: string) => void;
  activeGraph: GraphState;
  updateActiveGraph: (updates: Partial<GraphState>) => void;
  onGraphUpdate: (input: string) => void;
  repulsion: number;
  setRepulsion: (val: number) => void;
  linkDistance: number;
  setLinkDistance: (val: number) => void;
  onFixAll: () => void;
  onUnfixAll: () => void;
  onUpdateNodeLabel: (nodeId: string, label: string) => void;
  mergeAcrossGraphs: boolean;
  setMergeAcrossGraphs: (val: boolean) => void;
  selectedColor: string | null;
  setSelectedColor: (color: string | null) => void;
  showGrid: boolean;
  setShowGrid: (val: boolean) => void;
  onExportSVG: () => void;
  onExportPNG: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  graphs,
  activeGraphId,
  visibleGraphIds,
  onAddGraph,
  onSwitchGraph,
  onToggleVisibility,
  onDeleteGraph,
  activeGraph,
  updateActiveGraph,
  onGraphUpdate,
  repulsion,
  setRepulsion,
  linkDistance,
  setLinkDistance,
  onFixAll,
  onUnfixAll,
  onUpdateNodeLabel,
  mergeAcrossGraphs,
  setMergeAcrossGraphs,
  selectedColor,
  setSelectedColor,
  showGrid,
  setShowGrid,
  onExportSVG,
  onExportPNG,
}) => {
  const [input, setInput] = useState(activeGraph.input);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [nodeLabel, setNodeLabel] = useState<string>('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  // Sync local input state when switching graphs
  useEffect(() => {
    setInput(activeGraph.input);
  }, [activeGraphId, activeGraph.input]);

  useEffect(() => {
    if (selectedNodeId) {
      const selectedNode = activeGraph.data.nodes.find(n => n.id === selectedNodeId);
      setNodeLabel(selectedNode?.label || '');
    } else {
      setNodeLabel('');
    }
  }, [selectedNodeId, activeGraph.data.nodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        handleUpdate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [input]);

  const handleUpdate = () => {
    onGraphUpdate(input);
  };

  const handleRandom = () => {
    const nodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const newEdges: string[] = [];
    for (let i = 0; i < 10; i++) {
      const s = nodes[Math.floor(Math.random() * nodes.length)];
      const t = nodes[Math.floor(Math.random() * nodes.length)];
      const w = Math.floor(Math.random() * 20) + 1;
      newEdges.push(`${s} -> ${t} [${w}]`);
    }
    const newInput = newEdges.join('\n');
    setInput(newInput);
    onGraphUpdate(newInput);
  };

  const handleSetLabel = () => {
    if (selectedNodeId) {
      onUpdateNodeLabel(selectedNodeId, nodeLabel);
    }
  };

  return (
    <div className="w-80 h-full border-r border-[#262626] bg-[#0a0a0a] flex flex-col font-sans">
      <div className="p-6 border-b border-[#262626]">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">Graph Nexus</h1>
            <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">v1.2.0 PRO</p>
          </div>
        </div>

        {/* Graph Tabs */}
        <div className="flex flex-wrap gap-2">
          {graphs.map(g => {
            const isVisible = visibleGraphIds.has(g.id);
            return (
              <div 
                key={g.id}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border group",
                  g.id === activeGraphId 
                    ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400" 
                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800"
                )}
                onClick={() => onSwitchGraph(g.id)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(g.id);
                  }}
                  className={cn(
                    "p-0.5 rounded hover:bg-white/10 transition-colors",
                    isVisible ? "text-indigo-400" : "text-neutral-600"
                  )}
                  title={isVisible ? "Hide from canvas" : "Show on canvas"}
                >
                  {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
                <span className="truncate max-w-[60px]">{g.name}</span>
                {graphs.length > 1 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteGraph(g.id); }}
                    className="p-0.5 hover:bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-neutral-500 hover:text-red-400" />
                  </button>
                )}
              </div>
            );
          })}
          <button 
            onClick={onAddGraph}
            className="px-2 py-1.5 rounded-lg border border-dashed border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-500 transition-all flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Global Options */}
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-neutral-500" />
              <span className="text-xs text-neutral-400">Merge Nodes Across Graphs</span>
            </div>
            <button
              onClick={() => setMergeAcrossGraphs(!mergeAcrossGraphs)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                mergeAcrossGraphs ? "bg-indigo-600" : "bg-neutral-700"
              )}
            >
              <span
                className={cn(
                  "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                  mergeAcrossGraphs ? "translate-x-5" : "translate-x-1"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-neutral-500" />
              <span className="text-xs text-neutral-400">Show Background Grid</span>
            </div>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                showGrid ? "bg-indigo-600" : "bg-neutral-700"
              )}
            >
              <span
                className={cn(
                  "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                  showGrid ? "translate-x-5" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Active Graph Settings */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Layers className="w-3 h-3 text-indigo-500" />
              Graph Name
            </label>
          </div>
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <>
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (editNameValue.trim()) {
                        updateActiveGraph({ name: editNameValue.trim() });
                      }
                      setIsEditingName(false);
                    }
                  }}
                  className="flex-1 bg-[#0a0a0a] border border-indigo-500/50 rounded-lg p-2 text-sm text-white focus:outline-none"
                  autoFocus
                />
                <button 
                  onClick={() => {
                    if (editNameValue.trim()) {
                      updateActiveGraph({ name: editNameValue.trim() });
                    }
                    setIsEditingName(false);
                  }} 
                  className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/30"
                >
                  <Check className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 text-sm font-medium text-white truncate">{activeGraph.name}</div>
                <button 
                  onClick={() => {
                    setEditNameValue(activeGraph.name);
                    setIsEditingName(true);
                  }} 
                  className="p-2 text-neutral-500 hover:text-neutral-300"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </section>

        {/* Edge Input */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <ArrowRight className="w-3 h-3 text-indigo-500" />
              Graph Definition
            </label>
            <div className="flex gap-1">
              <button 
                onClick={() => setInput('')}
                className="p-1.5 hover:bg-neutral-800 rounded-md transition-colors text-neutral-500 hover:text-red-400"
                title="Clear All"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={handleRandom}
                className="p-1.5 hover:bg-neutral-800 rounded-md transition-colors text-neutral-500 hover:text-indigo-400"
                title="Random Graph"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={handleUpdate}
                className="p-1.5 hover:bg-neutral-800 rounded-md transition-colors text-neutral-500 hover:text-white"
                title="Update Graph"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="relative group">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full h-48 bg-[#111] border border-[#262626] rounded-xl p-4 text-sm font-mono text-neutral-300 focus:outline-none focus:border-indigo-500/50 transition-all resize-none shadow-inner"
              placeholder="A -> B [10]&#10;B -> C : 5&#10;C -> A 2"
            />
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="text-[9px] text-neutral-600 bg-black/50 px-2 py-1 rounded backdrop-blur-sm">CMD+ENTER to sync</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-1">
            <div className="w-1 h-1 rounded-full bg-indigo-500" />
            <p className="text-[10px] text-neutral-500 font-medium">
              Weights: <code className="text-neutral-400 bg-neutral-900 px-1 rounded">[w]</code>, <code className="text-neutral-400 bg-neutral-900 px-1 rounded">:w</code>, or <code className="text-neutral-400 bg-neutral-900 px-1 rounded">space w</code>
            </p>
          </div>
        </section>

        {/* Configuration */}
        <section className="space-y-4">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <Layers className="w-3 h-3 text-indigo-500" />
            Graph Settings
          </label>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateActiveGraph({ type: 'undirected' })}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all shadow-sm",
                  activeGraph.type === 'undirected' 
                    ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400" 
                    : "bg-neutral-900/50 border-neutral-800 text-neutral-500 hover:border-neutral-700"
                )}
              >
                Undirected
              </button>
              <button
                onClick={() => updateActiveGraph({ type: 'directed' })}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all shadow-sm",
                  activeGraph.type === 'directed' 
                    ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400" 
                    : "bg-neutral-900/50 border-neutral-800 text-neutral-500 hover:border-neutral-700"
                )}
              >
                Directed
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onFixAll}
                className="py-2.5 px-3 rounded-xl text-xs font-semibold border bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-red-500/30 hover:text-red-400 transition-all shadow-sm"
              >
                Fix All
              </button>
              <button
                onClick={onUnfixAll}
                className="py-2.5 px-3 rounded-xl text-xs font-semibold border bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:border-indigo-500/30 hover:text-indigo-400 transition-all shadow-sm"
              >
                Unfix All
              </button>
            </div>
          </div>
        </section>

        {/* Layout Mode */}
        <section className="space-y-4">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <GitBranch className="w-3 h-3 text-indigo-500" />
            Layout Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'force', label: 'Force' },
              { id: 'tree', label: 'Tree' },
              { id: 'circular', label: 'Circular' },
              { id: 'grid', label: 'Grid' }
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => updateActiveGraph({ layoutMode: mode.id as LayoutMode })}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all shadow-sm",
                  activeGraph.layoutMode === mode.id 
                    ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400" 
                    : "bg-neutral-900/50 border-neutral-800 text-neutral-500 hover:border-neutral-700"
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {activeGraph.layoutMode === 'tree' && (
            <div className="space-y-3 p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                <Anchor className="w-3 h-3 text-indigo-400" />
                <span>Hierarchy Root</span>
              </div>
              <select
                value={activeGraph.rootNodeId || ''}
                onChange={(e) => updateActiveGraph({ rootNodeId: e.target.value || null })}
                className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-xs text-neutral-300 focus:outline-none focus:border-indigo-500/50 transition-all"
              >
                <option value="">Select Root Node...</option>
                {activeGraph.data.nodes.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Node Labels */}
        <section className="space-y-4">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <Info className="w-3 h-3 text-indigo-500" />
            Node Annotations
          </label>
          <div className="space-y-3 p-4 bg-neutral-900/30 border border-neutral-800/50 rounded-xl">
            <div className="space-y-2">
              <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Coloring Tool</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'None', value: 'none', class: 'bg-neutral-800 border-neutral-700' },
                  { name: 'Indigo', value: '#6366f1', class: 'bg-[#6366f1]' },
                  { name: 'Emerald', value: '#10b981', class: 'bg-[#10b981]' },
                  { name: 'Rose', value: '#f43f5e', class: 'bg-[#f43f5e]' },
                  { name: 'Amber', value: '#f59e0b', class: 'bg-[#f59e0b]' },
                  { name: 'Sky', value: '#0ea5e9', class: 'bg-[#0ea5e9]' },
                  { name: 'Violet', value: '#8b5cf6', class: 'bg-[#8b5cf6]' },
                ].map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setSelectedColor(selectedColor === c.value ? null : c.value)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      c.class,
                      selectedColor === c.value ? "border-white scale-110 shadow-lg shadow-white/20" : "border-transparent hover:scale-105"
                    )}
                    title={c.name}
                  />
                ))}
              </div>
              {selectedColor && (
                <p className="text-[9px] text-indigo-400 animate-pulse">Click nodes on canvas to color them</p>
              )}
            </div>

            <div className="h-px bg-neutral-800 my-2" />

            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-xs text-neutral-300 focus:outline-none focus:border-indigo-500/50 transition-all"
            >
              <option value="">Select Node...</option>
              {activeGraph.data.nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <div className="flex gap-2 w-full">
              <input
                type="text"
                value={nodeLabel}
                onChange={(e) => setNodeLabel(e.target.value)}
                placeholder="Enter label..."
                className="flex-1 min-w-0 w-full bg-[#0a0a0a] border border-[#262626] rounded-lg p-2.5 text-xs text-neutral-300 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
              <button
                onClick={handleSetLabel}
                disabled={!selectedNodeId}
                className="shrink-0 px-4 py-2 bg-indigo-500/10 border border-indigo-500/50 text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Set
              </button>
            </div>
          </div>
        </section>

        {/* Physics Engine */}
        <section className="space-y-6">
          <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <Settings className="w-3 h-3 text-indigo-500" />
            Physics Engine
          </label>
          
          <div className="space-y-6 px-1">
            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                <span>Node Repulsion</span>
                <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{repulsion}</span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="1000" 
                step="50"
                value={repulsion}
                onChange={(e) => setRepulsion(parseInt(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                <span>Link Distance</span>
                <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{linkDistance}px</span>
              </div>
              <input 
                type="range" 
                min="20" 
                max="300" 
                step="10"
                value={linkDistance}
                onChange={(e) => setLinkDistance(parseInt(e.target.value))}
                className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="p-6 border-t border-[#262626] flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={onExportSVG}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-[10px] font-bold text-neutral-400 hover:text-white hover:border-neutral-700 transition-all"
          >
            Export SVG
          </button>
          <button 
            onClick={onExportPNG}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-[10px] font-bold text-neutral-400 hover:text-white hover:border-neutral-700 transition-all"
          >
            Export PNG
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button className="text-neutral-500 hover:text-white transition-colors">
              <Info className="w-4 h-4" />
            </button>
            <button className="text-neutral-500 hover:text-white transition-colors">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
          <div className="text-[10px] text-neutral-600 font-mono">
            STATUS: READY
          </div>
        </div>
      </div>
    </div>
  );
};
