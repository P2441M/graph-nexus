import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { Node, Link, GraphType, LayoutMode } from '../types';

interface GraphCanvasProps {
  graphId: string;
  nodes: Node[];
  links: Link[];
  graphType: GraphType;
  repulsion: number;
  linkDistance: number;
  rootNodeIds: Set<string>;
  onNodeClick: (nodeId: string) => void;
  showGrid: boolean;
  layoutMode: LayoutMode;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graphId,
  nodes,
  links,
  graphType,
  repulsion,
  linkDistance,
  rootNodeIds,
  onNodeClick,
  showGrid,
  layoutMode,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const nodePositionsRef = useRef<Map<string, {x: number, y: number, vx: number, vy: number}>>(new Map());
  const prevGraphIdRef = useRef<string>(graphId);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Clear saved positions and zoom if we switched to a different graph
    if (prevGraphIdRef.current !== graphId) {
      nodePositionsRef.current.clear();
      zoomTransformRef.current = d3.zoomIdentity;
      prevGraphIdRef.current = graphId;
    } else if (simulationRef.current) {
      // Save current positions before re-initializing
      simulationRef.current.nodes().forEach(n => {
        if (n.x !== undefined && n.y !== undefined) {
          nodePositionsRef.current.set(n.id, { x: n.x, y: n.y, vx: n.vx || 0, vy: n.vy || 0 });
        }
      });
    }

    // Restore positions to the new nodes array to prevent layout reset
    nodes.forEach(n => {
      const pos = nodePositionsRef.current.get(n.id);
      
      // If fx/fy are already set (e.g., by Tree Mode layout), preserve them
      const hasPresetFx = n.fx !== undefined && n.fx !== null;
      
      if (pos) {
        n.x = pos.x;
        n.y = pos.y;
        n.vx = pos.vx;
        n.vy = pos.vy;
        
        if (!hasPresetFx) {
          if (n.isFixed) {
            if (!isNaN(pos.x)) n.fx = pos.x;
            if (!isNaN(pos.y)) n.fy = pos.y;
          } else {
            n.fx = null;
            n.fy = null;
          }
        }
      } else if (!hasPresetFx) {
        // If it's fixed but has no position, we can't really fix it at a specific spot yet,
        // but we'll let D3 assign it a position first.
        n.fx = null;
        n.fy = null;
      }
    });

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Add subtle grid pattern
    const gridPattern = svg.append('defs')
      .append('pattern')
      .attr('id', 'grid')
      .attr('width', 40)
      .attr('height', 40)
      .attr('patternUnits', 'userSpaceOnUse');
    
    gridPattern.append('path')
      .attr('d', 'M 40 0 L 0 0 0 40')
      .attr('fill', 'none')
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 1);

    g.append('rect')
      .attr('x', -width * 5)
      .attr('y', -height * 5)
      .attr('width', width * 10)
      .attr('height', height * 10)
      .attr('fill', 'url(#grid)')
      .attr('opacity', showGrid ? 1 : 0);

    // Define arrow markers for directed graphs
    const defs = svg.append('defs');
    
    // Standard arrowhead
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10) // Tip at 10
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 12)
      .attr('markerHeight', 12)
      .append('path')
      .attr('d', 'M0,-3L10,0L0,3')
      .attr('fill', '#6366f1');

    // Root arrowhead (slightly larger radius)
    defs.append('marker')
      .attr('id', 'arrowhead-root')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10) // Tip at 10
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 12)
      .attr('markerHeight', 12)
      .append('path')
      .attr('d', 'M0,-3L10,0L0,3')
      .attr('fill', '#10b981');

    // Add glow filter for nodes
    const filter = defs.append('filter')
      .attr('id', 'glow');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '2.5')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'coloredBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform;
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Restore previous zoom transform
    if (zoomTransformRef.current !== d3.zoomIdentity) {
      svg.call(zoom.transform, zoomTransformRef.current);
      g.attr('transform', zoomTransformRef.current);
    }

    // Clone links and ensure source/target are IDs to prevent stale object references
    const linksCopy: Link[] = links.map(l => ({
      ...l,
      source: typeof l.source === 'object' ? (l.source as Node).id : l.source,
      target: typeof l.target === 'object' ? (l.target as Node).id : l.target,
    }));

    const simulation = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(linksCopy).id(d => d.id).distance(d => {
        return d.weight ? linkDistance * (1 + 1/d.weight) : linkDistance;
      }))
      .force('charge', d3.forceManyBody().strength(-repulsion))
      .force('collide', d3.forceCollide(25))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    simulationRef.current = simulation;

    const linkGroup = g.append('g').attr('class', 'links');
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const link = linkGroup
      .selectAll('g.link-group')
      .data(linksCopy)
      .join('g')
      .attr('class', 'link-group');

    const linkPath = link.append('path')
      .attr('fill', 'none')
      .attr('stroke', (d: Link) => d.isTreeEdge === false ? '#333' : '#6366f1')
      .attr('stroke-opacity', 0.8)
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', (d: Link) => d.isTreeEdge === false ? '5,5' : 'none')
      .attr('marker-end', (d: Link) => {
        if (graphType !== 'directed') return null;
        const targetId = typeof d.target === 'object' ? (d.target as Node).id : d.target;
        return rootNodeIds.has(targetId) ? 'url(#arrowhead-root)' : 'url(#arrowhead)';
      })
      .attr('class', 'transition-colors duration-300 hover:stroke-white hover:stroke-opacity-100');

    const linkLabels = link.filter(d => d.weight !== undefined)
      .append('text')
      .attr('class', 'edge-weight')
      .attr('fill', '#818cf8')
      .attr('font-size', '10px')
      .attr('font-family', 'var(--font-mono)')
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .text(d => d.weight!);

    const node = nodeGroup
      .selectAll<SVGGElement, Node>('g.node-group')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .on('click', (event, d: Node) => {
        if (event.defaultPrevented) return;
        onNodeClick(d.id);
      })
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', (d: Node) => rootNodeIds.has(d.id) ? 12 : 10)
      .attr('fill', (d: Node) => {
        if (d.color) return d.color;
        if (rootNodeIds.has(d.id)) return '#10b981';
        return '#6366f1';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', (d: Node) => d.isFixed ? 3 : 2)
      .attr('filter', 'url(#glow)');

    // Add pin icon for fixed nodes
    node.filter((d: Node) => !!d.isFixed)
      .append('path')
      .attr('d', 'M0,-4 L0,4 M-3,-1 L3,-1')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('pointer-events', 'none');

    node.append('text')
      .text((d: Node) => {
        let text = d.name;
        if (d.label) text += ` (${d.label})`;
        if (rootNodeIds.has(d.id)) text += ' (ROOT)';
        return text;
      })
      .attr('x', 16)
      .attr('y', 4)
      .attr('stroke', 'none')
      .attr('fill', '#fff')
      .style('font-size', '12px')
      .style('font-family', 'var(--font-sans)')
      .style('font-weight', (d: Node) => rootNodeIds.has(d.id) ? 'bold' : 'normal')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 2px 4px rgba(0,0,0,0.5)');

    const updatePositions = () => {
      linkPath.attr('d', (d: Link) => {
        const source = d.source as Node;
        const target = d.target as Node;
        if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return '';
        
        const targetRadius = rootNodeIds.has(target.id) ? 12 : 10;
        const sourceRadius = rootNodeIds.has(source.id) ? 12 : 10;

        if (d.isSelfLoop) {
          const x = source.x;
          const y = source.y;
          const dr = 30 + (d.linkIndex || 0) * 15;
          
          // Better circular loop
          // Control points are positioned to create a nice "ear" shape
          // cp1 is top-right, cp2 is top-left relative to node
          const cp1x = x + dr;
          const cp1y = y - dr;
          const cp2x = x - dr;
          const cp2y = y - dr;
          
          // Intersection with target node boundary
          // We want the arrow to point towards the node center
          // The tangent at the end of the bezier is cp2 -> target
          const tdx = x - cp2x;
          const tdy = y - cp2y;
          const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
          const edgeX = x - (tdx / tlen) * targetRadius;
          const edgeY = y - (tdy / tlen) * targetRadius;

          return `M${x},${y} C${cp1x},${cp1y} ${cp2x},${cp2y} ${edgeX},${edgeY}`;
        }

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        
        if (len === 0) return '';

        if ((d.linkIndex || 0) > 0) {
          const index = d.linkIndex || 0;
          const sign = index % 2 === 0 ? -1 : 1;
          const step = Math.ceil(index / 2);
          const offset = sign * step * 40;
          const actualOffset = d.isForward ? offset : -offset;

          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          
          const nx = -dy / len;
          const ny = dx / len;

          const cpX = midX + nx * actualOffset;
          const cpY = midY + ny * actualOffset;

          // Shorten path to end at target node boundary
          // Tangent at target is cp -> target
          const tdx = target.x - cpX;
          const tdy = target.y - cpY;
          const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
          const edgeX = target.x - (tdx / tlen) * targetRadius;
          const edgeY = target.y - (tdy / tlen) * targetRadius;

          return `M${source.x},${source.y} Q${cpX},${cpY} ${edgeX},${edgeY}`;
        }
        
        // Straight line shortened to end at target boundary
        const edgeX = target.x - (dx / len) * targetRadius;
        const edgeY = target.y - (dy / len) * targetRadius;
        return `M${source.x},${source.y}L${edgeX},${edgeY}`;
      });

      linkLabels.attr('transform', (d: Link) => {
        const source = d.source as Node;
        const target = d.target as Node;
        if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return '';

        if (d.isSelfLoop) {
          const dr = 30 + (d.linkIndex || 0) * 15;
          return `translate(${source.x}, ${source.y - dr - 10})`;
        }
        
        const x = (source.x + target.x) / 2;
        const y = (source.y + target.y) / 2;
        
        if ((d.linkIndex || 0) > 0) {
          const index = d.linkIndex || 0;
          const sign = index % 2 === 0 ? -1 : 1;
          const step = Math.ceil(index / 2);
          const offset = sign * step * 40;
          const actualOffset = d.isForward ? offset : -offset;

          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return `translate(${x}, ${y})`;

          const nx = -dy / len;
          const ny = dx / len;

          const curveX = x + nx * (actualOffset / 2);
          const curveY = y + ny * (actualOffset / 2);
          
          return `translate(${curveX}, ${curveY - 5})`;
        }
        
        return `translate(${x}, ${y - 5})`;
      });

      node.attr('transform', (d: Node) => {
        if (d.x === undefined || d.y === undefined) return '';
        return `translate(${d.x},${d.y})`;
      });
    };

    simulation.on('tick', updatePositions);

    function dragstarted(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, Node, Node>) {
      if (!event.active) simulation.alphaTarget(0);
      // In non-force modes, we want nodes to stay fixed at their layout positions
      // unless the user specifically wants to unfix them
      if (!event.subject.isFixed && layoutMode === 'force') {
        event.subject.fx = null;
        event.subject.fy = null;
      }
    }

    // Apply fixed positions (from Tree Mode layout or manual fixing)
    nodes.forEach(n => {
      // If the node has fx/fy from props (like tree/grid/circular layout), keep them
      // ONLY if we are in a layout mode that fixes positions
      const isFixedLayout = layoutMode !== 'force';
      
      if (isFixedLayout && n.fx !== undefined && n.fx !== null && !isNaN(n.fx)) {
        // Already set by layout
      } else if (n.isFixed) {
        if (n.x != null && !isNaN(n.x)) n.fx = n.x;
        if (n.y != null && !isNaN(n.y)) n.fy = n.y;
      } else {
        n.fx = null;
        n.fy = null;
      }
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, graphType, repulsion, linkDistance, rootNodeIds, onNodeClick, showGrid, layoutMode]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#050505] relative overflow-hidden">
      <svg id="main-graph-svg" ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-4 right-4 text-[10px] text-neutral-500 font-mono uppercase tracking-widest pointer-events-none">
        Graph Nexus Engine v1.0
      </div>
    </div>
  );
};
