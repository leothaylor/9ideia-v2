import type { Edge, Node } from '@xyflow/react';

export type IdeaType = 'ideia' | 'acao' | 'decisao' | 'experimento' | 'resultado' | 'nota';
export type IdeaStatus = 'rascunho' | 'proximo' | 'andamento' | 'bloqueado' | 'concluido';

export interface IdeaNodeData extends Record<string, unknown> {
  title: string;
  description: string;
  type: IdeaType;
  status: IdeaStatus;
  color: string;
  tags: string[];
  url: string;
  createdAt: string;
  updatedAt: string;
}

export type IdeaNode = Node<IdeaNodeData, 'idea'>;

export interface Weave {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  nodes: IdeaNode[];
  edges: Edge[];
  snapToGrid: boolean;
}

export interface AppData {
  version: 2;
  weaves: Weave[];
}

export const TYPE_META: Record<IdeaType, { label: string; color: string }> = {
  ideia: { label: 'Início', color: '#8ea8e8' },
  acao: { label: 'Ação', color: '#f2c46d' },
  decisao: { label: 'Posição', color: '#c69cf2' },
  experimento: { label: 'Reação', color: '#ef947a' },
  resultado: { label: 'Finalização', color: '#7dc7b4' },
  nota: { label: 'Nota', color: '#a5abb3' },
};

export const STATUS_META: Record<IdeaStatus, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: '#7d858e' },
  proximo: { label: 'Próximo passo', color: '#f2c46d' },
  andamento: { label: 'Em andamento', color: '#8ea8e8' },
  bloqueado: { label: 'Bloqueado', color: '#ef7a7a' },
  concluido: { label: 'Concluído', color: '#7dc7b4' },
};
