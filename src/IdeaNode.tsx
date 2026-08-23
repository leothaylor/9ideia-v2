import { ExternalLink } from 'lucide-react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { IdeaNode } from './types';
import { STATUS_META, TYPE_META } from './types';

export function IdeaNodeCard({ data, selected }: NodeProps<IdeaNode>) {
  const status = STATUS_META[data.status];
  return (
    <article className={`idea-node${selected ? ' is-selected' : ''}`} style={{ '--node-color': data.color } as React.CSSProperties}>
      <Handle className="node-handle" type="target" position={Position.Left} />
      <div className="node-meta">
        <span className="node-type">{TYPE_META[data.type].label}</span>
        <span className="node-status" style={{ '--status-color': status.color } as React.CSSProperties}>{status.label}</span>
      </div>
      <h3>{data.title || 'Sem título'}</h3>
      {data.description && <p>{data.description}</p>}
      {(data.tags.length > 0 || data.url) && (
        <footer>
          <div className="node-tags">{data.tags.slice(0, 2).map((tag) => <span key={tag}>#{tag}</span>)}</div>
          {data.url && <ExternalLink size={12} />}
        </footer>
      )}
      <Handle className="node-handle" type="source" position={Position.Right} />
    </article>
  );
}
