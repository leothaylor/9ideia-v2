import { MarkerType } from '@xyflow/react';
import type { AppData, IdeaNode, IdeaNodeData, IdeaStatus, IdeaType, Weave } from './types';
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
  const starter = createNode('Início da luta', 'ideia', 0, 0);
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

function cloneWeave(source: Weave): Weave {
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

export function duplicateWeave(source: Weave): Weave {
  return cloneWeave(source);
}

type JsonRecord = Record<string, unknown>;
type SimpleConnection = { source: string; target: string };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeKey(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function normalizeType(value: unknown): IdeaType {
  if (typeof value !== 'string') return 'acao';
  const key = normalizeKey(value);
  const aliases: Record<string, IdeaType> = {
    ideia: 'ideia',
    inicio: 'ideia',
    acao: 'acao',
    decisao: 'decisao',
    posicao: 'decisao',
    experimento: 'experimento',
    reacao: 'experimento',
    resultado: 'resultado',
    finalizacao: 'resultado',
    nota: 'nota',
  };
  return aliases[key] ?? 'acao';
}

function normalizeStatus(value: unknown): IdeaStatus {
  if (typeof value !== 'string') return 'rascunho';
  const key = normalizeKey(value);
  const aliases: Record<string, IdeaStatus> = {
    rascunho: 'rascunho',
    proximo: 'proximo',
    'proximo passo': 'proximo',
    andamento: 'andamento',
    'em andamento': 'andamento',
    bloqueado: 'bloqueado',
    concluido: 'concluido',
  };
  return aliases[key] ?? 'rascunho';
}

function parseConnection(value: unknown): SimpleConnection | null {
  if (Array.isArray(value) && value.length >= 2 && typeof value[0] === 'string' && typeof value[1] === 'string') {
    return { source: value[0], target: value[1] };
  }
  if (isRecord(value) && typeof value.source === 'string' && typeof value.target === 'string') {
    return { source: value.source, target: value.target };
  }
  return null;
}

function isFullWeave(value: unknown): value is Weave {
  if (!isRecord(value) || typeof value.name !== 'string' || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return false;
  return value.nodes.every((node) => isRecord(node) && isRecord(node.data) && isRecord(node.position));
}

function simpleWeaveToInternal(source: JsonRecord): Weave {
  if (typeof source.name !== 'string' || !source.name.trim() || !Array.isArray(source.nodes) || source.nodes.length === 0) {
    throw new Error('Teia simplificada inválida');
  }

  const rawConnections = Array.isArray(source.connections)
    ? source.connections
    : Array.isArray(source.edges)
      ? source.edges
      : [];
  const connections = rawConnections.map(parseConnection);
  if (connections.some((connection) => connection === null)) throw new Error('Conexão inválida');
  const validConnections = connections as SimpleConnection[];

  const timestamp = now();
  const specs = source.nodes.map((rawNode, index) => {
    if (!isRecord(rawNode)) throw new Error('Nó inválido');
    const logicalId = typeof rawNode.id === 'string' && rawNode.id.trim() ? rawNode.id.trim() : `n${index + 1}`;
    const title = typeof rawNode.title === 'string' && rawNode.title.trim() ? rawNode.title.trim() : `Nó ${index + 1}`;
    const type = normalizeType(rawNode.type);
    const position = isRecord(rawNode.position) ? rawNode.position : null;
    const x = typeof rawNode.x === 'number' ? rawNode.x : typeof position?.x === 'number' ? position.x : null;
    const y = typeof rawNode.y === 'number' ? rawNode.y : typeof position?.y === 'number' ? position.y : null;
    return { rawNode, logicalId, title, type, x, y };
  });

  const logicalIds = new Set(specs.map((spec) => spec.logicalId));
  if (logicalIds.size !== specs.length) throw new Error('IDs de nós duplicados');
  if (validConnections.some(({ source: from, target: to }) => !logicalIds.has(from) || !logicalIds.has(to))) {
    throw new Error('Conexão aponta para nó inexistente');
  }

  const indegree = new Map(specs.map((spec) => [spec.logicalId, 0]));
  const outgoing = new Map(specs.map((spec) => [spec.logicalId, [] as string[]]));
  validConnections.forEach(({ source: from, target: to }) => {
    indegree.set(to, (indegree.get(to) ?? 0) + 1);
    outgoing.get(from)?.push(to);
  });

  const depth = new Map(specs.map((spec) => [spec.logicalId, 0]));
  const queue = specs.filter((spec) => (indegree.get(spec.logicalId) ?? 0) === 0).map((spec) => spec.logicalId);
  const indegreeWork = new Map(indegree);
  while (queue.length) {
    const current = queue.shift()!;
    for (const target of outgoing.get(current) ?? []) {
      depth.set(target, Math.max(depth.get(target) ?? 0, (depth.get(current) ?? 0) + 1));
      const next = (indegreeWork.get(target) ?? 1) - 1;
      indegreeWork.set(target, next);
      if (next === 0) queue.push(target);
    }
  }

  const groups = new Map<number, typeof specs>();
  specs.forEach((spec) => {
    const d = depth.get(spec.logicalId) ?? 0;
    const group = groups.get(d) ?? [];
    group.push(spec);
    groups.set(d, group);
  });

  const idMap = new Map<string, string>();
  const nodes = specs.map((spec) => {
    const d = depth.get(spec.logicalId) ?? 0;
    const group = groups.get(d) ?? [spec];
    const row = group.findIndex((item) => item.logicalId === spec.logicalId);
    const x = spec.x ?? d * 340;
    const y = spec.y ?? (row - (group.length - 1) / 2) * 190;
    const node = createNode(spec.title, spec.type, x, y);
    idMap.set(spec.logicalId, node.id);
    node.data.description = typeof spec.rawNode.description === 'string' ? spec.rawNode.description : '';
    node.data.status = normalizeStatus(spec.rawNode.status);
    node.data.tags = Array.isArray(spec.rawNode.tags) ? spec.rawNode.tags.filter((tag): tag is string => typeof tag === 'string') : [];
    node.data.url = typeof spec.rawNode.url === 'string' ? spec.rawNode.url : '';
    node.data.createdAt = timestamp;
    node.data.updatedAt = timestamp;
    return node;
  });

  const edges = validConnections.map(({ source: from, target: to }) => ({
    id: newId(),
    source: idMap.get(from)!,
    target: idMap.get(to)!,
    type: 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  }));

  return {
    id: newId(),
    name: `${source.name.trim()} — importada`,
    createdAt: timestamp,
    updatedAt: timestamp,
    nodes,
    edges,
    snapToGrid: typeof source.snapToGrid === 'boolean' ? source.snapToGrid : false,
  };
}

export function importWeaves(value: unknown): Weave[] {
  const incoming = isRecord(value) && value.version === 2 && Array.isArray(value.weaves)
    ? value.weaves
    : [value];
  if (incoming.length === 0) throw new Error('Arquivo vazio');

  return incoming.map((item) => {
    if (isFullWeave(item)) {
      const copy = cloneWeave(item);
      return { ...copy, name: `${item.name} — importada` };
    }
    if (isRecord(item) && Array.isArray(item.nodes) && (Array.isArray(item.connections) || Array.isArray(item.edges))) {
      return simpleWeaveToInternal(item);
    }
    throw new Error('Formato de teia incompatível');
  });
}

export function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
