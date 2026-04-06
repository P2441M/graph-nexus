import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export interface Node extends SimulationNodeDatum {
  id: string;
  name: string;
  label?: string;
  isFixed?: boolean;
  color?: string;
}

export interface Link extends SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  weight?: number;
  isTreeEdge?: boolean;
  linkIndex?: number; // Index for parallel edges (0, 1, 2...)
  isSelfLoop?: boolean;
  isForward?: boolean; // Whether the edge direction matches the sorted order of its nodes
}

export type GraphType = 'directed' | 'undirected';
export type LayoutMode = 'force' | 'tree' | 'circular' | 'grid';

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export interface GraphState {
  id: string;
  name: string;
  data: GraphData;
  type: GraphType;
  layoutMode: LayoutMode;
  rootNodeId: string | null;
  input: string;
}
