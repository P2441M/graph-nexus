import { useState, useCallback, useMemo, useEffect } from 'react';
import * as d3 from 'd3';
import { Sidebar } from './components/Sidebar';
import { GraphCanvas } from './components/GraphCanvas';
import { Node, Link, GraphType, GraphData, GraphState } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [graphs, setGraphs] = useState<GraphState[]>([
    {
      id: '1',
      name: 'Graph 1',
      data: { nodes: [], links: [] },
      type: 'directed',
      layoutMode: 'force',
      rootNodeId: null,
      input: 'A -> B\nB -> C\nC -> A\nD -> A\nD -> E'
    }
  ]);
  const [activeGraphId, setActiveGraphId] = useState<string>('1');
  const [visibleGraphIds, setVisibleGraphIds] = useState<Set<string>>(new Set(['1']));
  const [mergeAcrossGraphs, setMergeAcrossGraphs] = useState(false);
  const [repulsion, setRepulsion] = useState(300);
  const [linkDistance, setLinkDistance] = useState(100);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);

  const activeGraph = graphs.find(g => g.id === activeGraphId) || graphs[0];

  const updateActiveGraph = useCallback((updates: Partial<GraphState>) => {
    setGraphs(prev => prev.map(g => g.id === activeGraphId ? { ...g, ...updates } : g));
  }, [activeGraphId]);

  const parseInput = useCallback((input: string) => {
    const lines = input.split('\n').filter(line => line.trim() !== '');
    const nodeSet = new Set<string>();
    const rawLinks: { source: string; target: string; weight?: number }[] = [];

    lines.forEach(line => {
      // Handle weights in formats like A -> B [10], A -> B:10, A -> B 10
      const weightMatch = line.match(/\[(\d+)\]|:(\d+)|(?:\s+)(\d+)$/);
      let weight: number | undefined;
      let cleanLine = line;

      if (weightMatch) {
        weight = parseInt(weightMatch[1] || weightMatch[2] || weightMatch[3]);
        cleanLine = line.replace(weightMatch[0], '').trim();
      }

      const parts = cleanLine.split(/->|--|-|\s+/).map(p => p.trim()).filter(p => p !== '');
      if (parts.length >= 2) {
        const source = parts[0];
        const target = parts[1];
        nodeSet.add(source);
        nodeSet.add(target);
        rawLinks.push({ source, target, weight });
      } else if (parts.length === 1) {
        nodeSet.add(parts[0]);
      }
    });

    // Handle parallel edges and self-loops
    const linkCounts = new Map<string, number>();
    const links: Link[] = rawLinks.map(l => {
      const isSelfLoop = l.source === l.target;
      // Always sort to group A->B and B->A together to prevent overlapping
      const sorted = [l.source, l.target].sort();
      const pairKey = sorted.join('|');
      const isForward = l.source === sorted[0];
      
      const count = linkCounts.get(pairKey) || 0;
      linkCounts.set(pairKey, count + 1);

      return {
        ...l,
        isSelfLoop,
        linkIndex: count,
        isForward
      };
    });

    updateActiveGraph({
      input,
      data: {
        nodes: Array.from(nodeSet).map(id => {
          const existing = activeGraph.data.nodes.find(n => n.id === id);
          return {
            id,
            name: id,
            x: existing?.x,
            y: existing?.y,
            vx: existing?.vx,
            vy: existing?.vy,
            isFixed: existing?.isFixed ?? false,
            label: existing?.label
          };
        }),
        links
      }
    });
  }, [activeGraph.type, activeGraph.data.nodes, updateActiveGraph]);

  // Initial parse for the first graph
  useEffect(() => {
    if (activeGraph.data.nodes.length === 0 && activeGraph.input) {
      parseInput(activeGraph.input);
    }
  }, []);

  const handleToggleFixed = useCallback((nodeId: string) => {
    // nodeId might be "graphId:nodeId" if not merging
    let targetGraphId = activeGraphId;
    let targetNodeId = nodeId;

    if (!mergeAcrossGraphs && nodeId.includes(':')) {
      const parts = nodeId.split(':');
      targetGraphId = parts[0];
      targetNodeId = parts.slice(1).join(':');
    }

    setGraphs(prev => prev.map(g => {
      if (mergeAcrossGraphs) {
        // Update all graphs that have this node ID
        if (!visibleGraphIds.has(g.id)) return g;
        const nodeExists = g.data.nodes.some(n => n.id === targetNodeId);
        if (!nodeExists) return g;
        return {
          ...g,
          data: {
            ...g.data,
            nodes: g.data.nodes.map(n => n.id === targetNodeId ? { ...n, isFixed: !n.isFixed } : n)
          }
        };
      } else {
        // Update only the specific graph
        if (g.id !== targetGraphId) return g;
        return {
          ...g,
          data: {
            ...g.data,
            nodes: g.data.nodes.map(n => n.id === targetNodeId ? { ...n, isFixed: !n.isFixed } : n)
          }
        };
      }
    }));
  }, [activeGraphId, mergeAcrossGraphs, visibleGraphIds]);

  const handleUpdateNodeColor = useCallback((nodeId: string, color: string | null) => {
    let targetGraphId = activeGraphId;
    let targetNodeId = nodeId;

    if (!mergeAcrossGraphs && nodeId.includes(':')) {
      const parts = nodeId.split(':');
      targetGraphId = parts[0];
      targetNodeId = parts.slice(1).join(':');
    }

    setGraphs(prev => prev.map(g => {
      if (mergeAcrossGraphs) {
        if (!visibleGraphIds.has(g.id)) return g;
        const nodeExists = g.data.nodes.some(n => n.id === targetNodeId);
        if (!nodeExists) return g;
        return {
          ...g,
          data: {
            ...g.data,
            nodes: g.data.nodes.map(n => n.id === targetNodeId ? { ...n, color: color || undefined } : n)
          }
        };
      } else {
        if (g.id !== targetGraphId) return g;
        return {
          ...g,
          data: {
            ...g.data,
            nodes: g.data.nodes.map(n => n.id === targetNodeId ? { ...n, color: color || undefined } : n)
          }
        };
      }
    }));
  }, [activeGraphId, mergeAcrossGraphs, visibleGraphIds]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (selectedColor) {
      handleUpdateNodeColor(nodeId, selectedColor === 'none' ? null : selectedColor);
    } else {
      handleToggleFixed(nodeId);
    }
  }, [selectedColor, handleUpdateNodeColor, handleToggleFixed]);

  const exportToSVG = useCallback(() => {
    const svg = document.getElementById('main-graph-svg') as unknown as SVGSVGElement | null;
    if (!svg) return;
    
    // Clone the SVG to modify it for export
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    const { width, height } = svg.getBoundingClientRect();
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    // Add background rectangle
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', '#050505');
    clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(clonedSvg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'graph.svg';
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportToPNG = useCallback(() => {
    const svg = document.getElementById('main-graph-svg') as unknown as SVGSVGElement | null;
    if (!svg) return;
    const { width, height } = svg.getBoundingClientRect();
    
    // Create a temporary canvas
    const canvas = document.createElement('canvas');
    const scale = 2; // Higher resolution
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clone and prepare SVG for rendering
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
    clonedSvg.setAttribute('width', width.toString());
    clonedSvg.setAttribute('height', height.toString());
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Draw background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw SVG
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = 'graph.png';
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const handleFixAll = useCallback(() => {
    setGraphs(prev => prev.map(g => {
      if (!visibleGraphIds.has(g.id)) return g;
      return {
        ...g,
        data: {
          ...g.data,
          nodes: g.data.nodes.map(n => ({ ...n, isFixed: true }))
        }
      };
    }));
  }, [visibleGraphIds]);

  const handleUnfixAll = useCallback(() => {
    setGraphs(prev => prev.map(g => {
      if (!visibleGraphIds.has(g.id)) return g;
      return {
        ...g,
        data: {
          ...g.data,
          nodes: g.data.nodes.map(n => ({ ...n, isFixed: false }))
        }
      };
    }));
  }, [visibleGraphIds]);

  const handleUpdateNodeLabel = useCallback((nodeId: string, label: string) => {
    let targetGraphId = activeGraphId;
    let targetNodeId = nodeId;

    if (!mergeAcrossGraphs && nodeId.includes(':')) {
      const parts = nodeId.split(':');
      targetGraphId = parts[0];
      targetNodeId = parts.slice(1).join(':');
    }

    setGraphs(prev => prev.map(g => {
      if (mergeAcrossGraphs) {
        if (!visibleGraphIds.has(g.id)) return g;
        const nodeExists = g.data.nodes.some(n => n.id === targetNodeId);
        if (!nodeExists) return g;
        return {
          ...g,
          data: {
            ...g.data,
            nodes: g.data.nodes.map(n => n.id === targetNodeId ? { ...n, label } : n)
          }
        };
      } else {
        if (g.id !== targetGraphId) return g;
        return {
          ...g,
          data: {
            ...g.data,
            nodes: g.data.nodes.map(n => n.id === targetNodeId ? { ...n, label } : n)
          }
        };
      }
    }));
  }, [activeGraphId, mergeAcrossGraphs, visibleGraphIds]);

  const handleAddGraph = useCallback(() => {
    const newId = Date.now().toString();
    const defaultInput = 'A -> B';
    
    // Parse default input
    const nodes: Node[] = [];
    const links: Link[] = [];
    const nodeSet = new Set<string>();

    const lines = defaultInput.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let source = '';
      let target = '';
      let weight: number | undefined = undefined;

      const arrowMatch = trimmed.match(/^(.*?)(->|--)(.*?)$/);
      if (arrowMatch) {
        source = arrowMatch[1].trim();
        const rest = arrowMatch[3].trim();

        const weightMatch = rest.match(/^(.*?)(?:\[(\d+)\]|:(\d+)|\s+(\d+))$/);
        if (weightMatch) {
          target = weightMatch[1].trim();
          weight = parseInt(weightMatch[2] || weightMatch[3] || weightMatch[4]);
        } else {
          target = rest;
        }
      } else {
        source = trimmed;
      }

      if (source && !nodeSet.has(source)) {
        nodeSet.add(source);
        nodes.push({ id: source, name: source, isFixed: false });
      }
      if (target && !nodeSet.has(target)) {
        nodeSet.add(target);
        nodes.push({ id: target, name: target, isFixed: false });
      }

      if (source && target) {
        links.push({
          source,
          target,
          weight
        });
      }
    });

    // Handle parallel edges and self-loops
    const linkCounts = new Map<string, number>();
    const processedLinks: Link[] = links.map(l => {
      const isSelfLoop = l.source === l.target;
      const sorted = [l.source, l.target].sort();
      const pairKey = sorted.join('|');
      const isForward = l.source === sorted[0];
      
      const count = linkCounts.get(pairKey) || 0;
      linkCounts.set(pairKey, count + 1);

      return {
        ...l,
        isSelfLoop,
        linkIndex: count,
        isForward
      };
    });

    setGraphs(prev => [
      ...prev,
      {
        id: newId,
        name: `Graph ${prev.length + 1}`,
        data: { nodes, links: processedLinks },
        type: 'directed',
        layoutMode: 'force',
        rootNodeId: null,
        input: defaultInput
      }
    ]);
    setActiveGraphId(newId);
    setVisibleGraphIds(prev => new Set(prev).add(newId));
  }, []);

  const handleDeleteGraph = useCallback((id: string) => {
    setGraphs(prev => {
      if (prev.length === 1) return prev; // Don't delete the last graph
      const newGraphs = prev.filter(g => g.id !== id);
      if (activeGraphId === id) {
        setActiveGraphId(newGraphs[0].id);
      }
      setVisibleGraphIds(prevVisible => {
        const next = new Set(prevVisible);
        next.delete(id);
        if (next.size === 0) next.add(newGraphs[0].id);
        return next;
      });
      return newGraphs;
    });
  }, [activeGraphId]);

  const toggleGraphVisibility = useCallback((id: string) => {
    setVisibleGraphIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Compute tree edges and hierarchical layout if in tree mode
  const processedData = useMemo(() => {
    const visibleGraphs = graphs.filter(g => visibleGraphIds.has(g.id));
    
    // Combine nodes and links
    const combinedNodesMap = new Map<string, Node>();
    const combinedRawLinks: Link[] = [];

    visibleGraphs.forEach(g => {
      g.data.nodes.forEach(n => {
        const finalId = mergeAcrossGraphs ? n.id : `${g.id}:${n.id}`;
        if (!combinedNodesMap.has(finalId)) {
          combinedNodesMap.set(finalId, { ...n, id: finalId, name: n.name });
        } else if (mergeAcrossGraphs) {
          // Merge labels or other properties if needed
          const existing = combinedNodesMap.get(finalId)!;
          if (n.label && !existing.label) existing.label = n.label;
          if (n.isFixed) existing.isFixed = true;
        }
      });
      g.data.links.forEach(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as Node).id;
        const t = typeof l.target === 'string' ? l.target : (l.target as Node).id;
        const finalSource = mergeAcrossGraphs ? s : `${g.id}:${s}`;
        const finalTarget = mergeAcrossGraphs ? t : `${g.id}:${t}`;
        combinedRawLinks.push({ ...l, source: finalSource, target: finalTarget });
      });
    });

    const nodes = Array.from(combinedNodesMap.values());
    const layoutNodePositions = new Map<string, { x: number; y: number }>();
    const allTreeEdges = new Set<string>();

    // Apply layouts for each visible graph
    visibleGraphs.forEach(g => {
      if (g.layoutMode === 'tree' && g.rootNodeId && g.data.nodes.length > 0) {
        const visited = new Set<string>();
        const treeEdges = new Set<string>();
        const hierarchyData: { id: string; parentId: string | null }[] = [];
        
        const adj = new Map<string, string[]>();
        g.data.links.forEach(l => {
          const s = typeof l.source === 'string' ? l.source : (l.source as Node).id;
          const t = typeof l.target === 'string' ? l.target : (l.target as Node).id;
          if (s === t) return;
          
          const finalSource = mergeAcrossGraphs ? s : `${g.id}:${s}`;
          const finalTarget = mergeAcrossGraphs ? t : `${g.id}:${t}`;
          
          if (!adj.has(finalSource)) adj.set(finalSource, []);
          adj.get(finalSource)!.push(finalTarget);
          if (g.type === 'undirected') {
            if (!adj.has(finalTarget)) adj.set(finalTarget, []);
            adj.get(finalTarget)!.push(finalSource);
          }
        });

        const bfs = (startNodeId: string) => {
          const queue: [string, string | null][] = [[startNodeId, null]];
          visited.add(startNodeId);
          while (queue.length > 0) {
            const [u, p] = queue.shift()!;
            hierarchyData.push({ id: u, parentId: p });
            const neighbors = adj.get(u) || [];
            for (const v of neighbors) {
              if (!visited.has(v)) {
                visited.add(v);
                treeEdges.add(`${u}->${v}`);
                queue.push([v, u]);
              }
            }
          }
        };

        const rootId = g.rootNodeId;
        const finalRootId = mergeAcrossGraphs ? rootId : `${g.id}:${rootId}`;

        if (combinedNodesMap.has(finalRootId)) {
          bfs(finalRootId);
        }

        // Only process nodes belonging to THIS graph for its tree layout
        g.data.nodes.forEach(n => {
          const finalId = mergeAcrossGraphs ? n.id : `${g.id}:${n.id}`;
          if (!visited.has(finalId)) bfs(finalId);
        });

        try {
          const stratify = d3.stratify<{ id: string; parentId: string | null }>()
            .id(d => d.id)
            .parentId(d => d.parentId);
          
          const virtualRootId = `__virtual_root_${g.id}__`;
          const forestData = [
            { id: virtualRootId, parentId: null },
            ...hierarchyData.map(d => d.parentId === null ? { ...d, parentId: virtualRootId } : d)
          ];

          const root = stratify(forestData);
          const treeLayout = d3.tree<any>().nodeSize([100, 120]);
          treeLayout(root);

          root.descendants().forEach(d => {
            if (d.id && !d.id.startsWith('__virtual_root_')) {
              // Offset each graph's tree slightly if there are multiple
              const graphIndex = visibleGraphs.indexOf(g);
              const centerX = 400 + (graphIndex * 50);
              const centerY = 100 + (graphIndex * 50);
              layoutNodePositions.set(d.id, { x: centerX + d.x, y: centerY + d.y });
            }
          });

          treeEdges.forEach(e => allTreeEdges.add(e));
        } catch (e) {
          console.error(`Tree layout error for graph ${g.id}`, e);
        }
      } else if (g.layoutMode === 'circular' && g.data.nodes.length > 0) {
        const nodesInGraph = g.data.nodes.map(n => mergeAcrossGraphs ? n.id : `${g.id}:${n.id}`);
        const radius = Math.min(400, nodesInGraph.length * 25);
        const graphIndex = visibleGraphs.indexOf(g);
        const centerX = 400 + (graphIndex * 100);
        const centerY = 300 + (graphIndex * 100);
        nodesInGraph.forEach((id, i) => {
          const angle = (i / nodesInGraph.length) * 2 * Math.PI;
          layoutNodePositions.set(id, {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
          });
        });
      } else if (g.layoutMode === 'grid' && g.data.nodes.length > 0) {
        const nodesInGraph = g.data.nodes.map(n => mergeAcrossGraphs ? n.id : `${g.id}:${n.id}`);
        const cols = Math.ceil(Math.sqrt(nodesInGraph.length));
        const spacing = 120;
        const graphIndex = visibleGraphs.indexOf(g);
        const startX = 200 + (graphIndex * 100);
        const startY = 150 + (graphIndex * 100);
        nodesInGraph.forEach((id, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          layoutNodePositions.set(id, {
            x: startX + col * spacing,
            y: startY + row * spacing
          });
        });
      }
    });

    const processedNodes = nodes.map(n => {
      const pos = layoutNodePositions.get(n.id);
      if (pos) {
        return { ...n, fx: pos.x, fy: pos.y };
      }
      return n;
    });

    // Recalculate linkIndex and isForward for the combined set to handle cross-graph parallel edges
    const linkCounts = new Map<string, number>();
    const processedLinks: Link[] = combinedRawLinks.map(l => {
      const s = typeof l.source === 'string' ? l.source : (l.source as Node).id;
      const t = typeof l.target === 'string' ? l.target : (l.target as Node).id;
      
      const isSelfLoop = s === t;
      const sorted = [s, t].sort();
      const pairKey = sorted.join('|');
      const isForward = s === sorted[0];
      
      const count = linkCounts.get(pairKey) || 0;
      linkCounts.set(pairKey, count + 1);

      const edgeKey = `${s}->${t}`;
      const reverseEdgeKey = `${t}->${s}`;
      let isTreeEdge: boolean | undefined = undefined;
      
      const parentGraph = visibleGraphs.find(g => g.data.links.some(gl => {
        const gs = typeof gl.source === 'string' ? gl.source : (gl.source as Node).id;
        const gt = typeof gl.target === 'string' ? gl.target : (gl.target as Node).id;
        const fs = mergeAcrossGraphs ? gs : `${g.id}:${gs}`;
        const ft = mergeAcrossGraphs ? gt : `${g.id}:${gt}`;
        return (fs === s && ft === t) || (fs === t && ft === s);
      }));

      if (parentGraph?.layoutMode === 'tree' && !parentGraph.rootNodeId) {
        // If tree mode but no root, leave as solid (undefined)
        isTreeEdge = undefined;
      } else if (allTreeEdges.has(edgeKey)) {
        isTreeEdge = true;
        allTreeEdges.delete(edgeKey);
      } else if (allTreeEdges.has(reverseEdgeKey)) {
        // Check if any visible graph that contains this link is undirected
        if (parentGraph?.type === 'undirected') {
          isTreeEdge = true;
          allTreeEdges.delete(reverseEdgeKey);
        } else if (parentGraph?.layoutMode === 'tree') {
          isTreeEdge = false;
        }
      } else if (parentGraph?.layoutMode === 'tree') {
        // If any visible graph that contains this link is in tree mode, 
        // and it's not a tree edge, mark it as false (dashed)
        isTreeEdge = false;
      }

      return {
        ...l,
        isSelfLoop,
        linkIndex: count,
        isForward,
        isTreeEdge
      };
    });

    return { nodes: processedNodes, links: processedLinks };
  }, [graphs, visibleGraphIds, mergeAcrossGraphs]);

  const rootNodeIds = useMemo(() => {
    const ids = new Set<string>();
    graphs.filter(g => visibleGraphIds.has(g.id) && g.layoutMode === 'tree' && g.rootNodeId).forEach(g => {
      ids.add(mergeAcrossGraphs ? g.rootNodeId! : `${g.id}:${g.rootNodeId}`);
    });
    return ids;
  }, [graphs, visibleGraphIds, mergeAcrossGraphs]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar 
        graphs={graphs}
        activeGraphId={activeGraphId}
        visibleGraphIds={visibleGraphIds}
        onAddGraph={handleAddGraph}
        onSwitchGraph={setActiveGraphId}
        onToggleVisibility={toggleGraphVisibility}
        onDeleteGraph={handleDeleteGraph}
        activeGraph={activeGraph}
        updateActiveGraph={updateActiveGraph}
        onGraphUpdate={parseInput}
        repulsion={repulsion}
        setRepulsion={setRepulsion}
        linkDistance={linkDistance}
        setLinkDistance={setLinkDistance}
        onFixAll={handleFixAll}
        onUnfixAll={handleUnfixAll}
        onUpdateNodeLabel={handleUpdateNodeLabel}
        mergeAcrossGraphs={mergeAcrossGraphs}
        setMergeAcrossGraphs={setMergeAcrossGraphs}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        onExportSVG={exportToSVG}
        onExportPNG={exportToPNG}
      />
      <main className="flex-1 relative">
        <GraphCanvas 
          graphId={Array.from(visibleGraphIds).sort().join(',')}
          nodes={processedData.nodes}
          links={processedData.links}
          graphType={activeGraph.type}
          repulsion={repulsion}
          linkDistance={linkDistance}
          rootNodeIds={rootNodeIds}
          onNodeClick={handleNodeClick}
          showGrid={showGrid}
          layoutMode={activeGraph.layoutMode}
        />
        
        {/* Overlay Stats */}
        <div className="absolute top-8 left-8 pointer-events-none space-y-2">
          <div className="flex items-center gap-3 bg-[#0a0a0a]/80 backdrop-blur-md border border-[#262626] px-4 py-2 rounded-full">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
            <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-[0.2em]">
              {activeGraph.name}
            </span>
          </div>
          <div className="flex gap-6 px-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-indigo-400" />
              <span>Nodes: <span className="text-white font-bold">{activeGraph.data.nodes.length}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-indigo-400" />
              <span>Edges: <span className="text-white font-bold">{activeGraph.data.links.length}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-red-400" />
              <span>Fixed: <span className="text-red-400 font-bold">{activeGraph.data.nodes.filter(n => n.isFixed).length}</span></span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
