import { MarkerType } from '@xyflow/react';
import type { AppData, IdeaNode, IdeaNodeData, IdeaType, Weave } from './types';
import { TYPE_META } from './types';

const STORAGE_KEY = 'teia-de-ideias-v2';
const now = () => new Date().toISOString();
export const newId = () => crypto.randomUUID();

export function createNode(title: string, type: IdeaType, x: number, y: number): IdeaNode {
  const timestamp = now();
  const data: IdeaNodeData = {
    title,
    description: '',
    type,
    status: 'rascunho',
    color: TYPE_META[type].color,
    tags: [],
    url: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { id: newId(), type: 'idea', position: { x, y }, data };
}

export function createWeave(name: string): Weave {
  const timestamp = now();
  const starter = createNode('Ideia central', 'ideia', 0, 0);
  return { id: newId(), name, createdAt: timestamp, updatedAt: timestamp, nodes: [starter], edges: [], snapToGrid: false };
}

function seedData(): AppData {
  const timestamp = now();
  const definitions: Array<[string, IdeaType, number, number]> = [
    ['Kit ACS', 'ideia', 0, 120],
    ['Pedir para usarem o kit', 'acao', 310, 0],
    ['Pegar feedback do uso', 'experimento', 610, 0],
    ['Fazer ajustes no kit', 'acao', 910, 0],
    ['Tentar primeira venda', 'resultado', 1200, 80],
    ['Melhorar página de venda', 'acao', 310, 250],
    ['Levar site para Hotmart', 'decisao', 610, 250],
    ['Melhorar página Hotmart', 'acao', 910, 250],
  ];
  const nodes = definitions.map(([title, type, x, y]) => createNode(title, type, x, y));
  nodes[1].data.status = 'proximo';
  const links = [[0,1], [1,2], [2,3], [3,4], [0,5], [5,6], [6,7], [7,4]];
  const edges = links.map(([source, target]) => ({
    id: newId(), source: nodes[source].id, target: nodes[target].id, type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
  return {
    version: 2,
    weaves: [{ id: newId(), name: 'Kit ACS — exemplo', createdAt: timestamp, updatedAt: timestamp, nodes, edges, snapToGrid: false }],
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData();
    const parsed = JSON.parse(raw) as AppData;
    if (parsed.version !== 2 || !Array.isArray(parsed.weaves)) throw new Error('Formato inválido');
    return parsed;
  } catch {
    return seedData();
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function duplicateWeave(source: Weave): Weave {
  const timestamp = now();
  const idMap = new Map<string, string>();
  const nodes = source.nodes.map((node) => {
    const id = newId();
    idMap.set(node.id, id);
    return { ...node, id, selected: false, data: { ...node.data, tags: [...node.data.tags], createdAt: timestamp, updatedAt: timestamp } };
  });
  const edges = source.edges.map((edge) => ({ ...edge, id: newId(), source: idMap.get(edge.source)!, target: idMap.get(edge.target)!, selected: false }));
  return { ...source, id: newId(), name: `${source.name} — cópia`, createdAt: timestamp, updatedAt: timestamp, nodes, edges };
}

export function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
