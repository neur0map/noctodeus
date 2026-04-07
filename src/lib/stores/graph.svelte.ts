import type { FileNode } from '../types/core';
import { graphLinks, graphStats as fetchGraphStats } from '../bridge/commands';

export interface GraphStats {
  totalLinks: number;
  avgLinksPerNote: number;
  mostConnected: { path: string; title: string; count: number }[];
  orphanCount: number;
  orphanPaths: string[];
}

export interface GraphNode {
  id: string;
  path: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  linkCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

let graphStatsState = $state<GraphStats>({
  totalLinks: 0,
  avgLinksPerNote: 0,
  mostConnected: [],
  orphanCount: 0,
  orphanPaths: [],
});

let graphNodes = $state<GraphNode[]>([]);
let graphEdges = $state<GraphEdge[]>([]);
let scanning = $state(false);

export function getGraphState() {
  return {
    get stats() { return graphStatsState; },
    get nodes() { return graphNodes; },
    get edges() { return graphEdges; },
    get scanning() { return scanning; },

    async scan(files: Map<string, FileNode>) {
      scanning = true;

      const noteFiles = Array.from(files.values()).filter(f => !f.is_directory && (f.extension === 'md' || f.extension === 'markdown'));
      const pathSet = new Set(noteFiles.map(f => f.path));

      try {
        const [backendLinks, backendStats] = await Promise.all([
          graphLinks(),
          fetchGraphStats(),
        ]);

        // Build edges from backend data, filtering to files that exist in the current tree.
        const edges: GraphEdge[] = backendLinks
          .filter(link => pathSet.has(link.sourcePath) && pathSet.has(link.targetPath))
          .map(link => ({ source: link.sourcePath, target: link.targetPath }));

        // Compute per-node link counts from edges (needed for node sizing in graph view).
        const linkCounts = new Map<string, number>();
        for (const edge of edges) {
          linkCounts.set(edge.source, (linkCounts.get(edge.source) ?? 0) + 1);
          linkCounts.set(edge.target, (linkCounts.get(edge.target) ?? 0) + 1);
        }

        graphStatsState = {
          totalLinks: backendStats.totalLinks,
          avgLinksPerNote: Math.round(backendStats.avgLinksPerNote * 10) / 10,
          mostConnected: backendStats.mostConnected.map(n => ({
            path: n.path,
            title: n.title ?? '',
            count: n.count,
          })),
          orphanCount: backendStats.orphanCount,
          orphanPaths: backendStats.orphanPaths,
        };

        // Build graph nodes with random initial positions
        graphNodes = noteFiles.map((f) => ({
          id: f.path,
          path: f.path,
          title: f.title || f.name.replace(/\.(md|markdown)$/i, ''),
          x: Math.random() * 600 - 300,
          y: Math.random() * 400 - 200,
          vx: 0,
          vy: 0,
          linkCount: linkCounts.get(f.path) ?? 0,
        }));

        graphEdges = edges;
      } catch {
        // If backend queries fail, reset to empty state
      }

      scanning = false;
    },

    reset() {
      graphStatsState = {
        totalLinks: 0,
        avgLinksPerNote: 0,
        mostConnected: [],
        orphanCount: 0,
        orphanPaths: [],
      };
      graphNodes = [];
      graphEdges = [];
      scanning = false;
    },
  };
}
