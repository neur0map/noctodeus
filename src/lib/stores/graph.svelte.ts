import type { FileNode } from '../types/core';

export interface GraphStats {
  totalLinks: number;
  avgLinksPerNote: number;
  mostConnected: { path: string; title: string; count: number }[];
  orphanCount: number;
  orphanPaths: string[];
}

const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

let graphStats = $state<GraphStats>({
  totalLinks: 0,
  avgLinksPerNote: 0,
  mostConnected: [],
  orphanCount: 0,
  orphanPaths: [],
});

let scanning = $state(false);

export function getGraphState() {
  return {
    get stats() { return graphStats; },
    get scanning() { return scanning; },

    async scan(files: Map<string, FileNode>, readFile: (path: string) => Promise<{ content: string }>) {
      scanning = true;

      const linkCounts = new Map<string, number>();
      const noteFiles = Array.from(files.values()).filter(f => !f.is_directory && (f.extension === 'md' || f.extension === 'markdown'));

      for (const f of noteFiles) {
        linkCounts.set(f.path, 0);
      }

      let totalLinks = 0;

      for (const f of noteFiles) {
        try {
          const { content } = await readFile(f.path);
          const matches = content.matchAll(WIKI_LINK_RE);
          let outbound = 0;
          for (const match of matches) {
            outbound++;
            const target = match[1].split('|')[0].trim();
            const targetFile = noteFiles.find(n => {
              const nameNoExt = n.name.replace(/\.(md|markdown)$/i, '');
              return nameNoExt === target;
            });
            if (targetFile) {
              linkCounts.set(targetFile.path, (linkCounts.get(targetFile.path) ?? 0) + 1);
            }
          }
          linkCounts.set(f.path, (linkCounts.get(f.path) ?? 0) + outbound);
          totalLinks += outbound;
        } catch {
          // Skip unreadable files
        }
      }

      const sorted = Array.from(linkCounts.entries())
        .map(([path, count]) => {
          const file = files.get(path);
          return { path, title: file?.title || file?.name || path, count };
        })
        .sort((a, b) => b.count - a.count);

      const orphans = sorted.filter(n => n.count === 0);

      graphStats = {
        totalLinks,
        avgLinksPerNote: noteFiles.length > 0 ? Math.round((totalLinks / noteFiles.length) * 10) / 10 : 0,
        mostConnected: sorted.slice(0, 5),
        orphanCount: orphans.length,
        orphanPaths: orphans.map(o => o.path),
      };

      scanning = false;
    },

    reset() {
      graphStats = {
        totalLinks: 0,
        avgLinksPerNote: 0,
        mostConnected: [],
        orphanCount: 0,
        orphanPaths: [],
      };
      scanning = false;
    },
  };
}
