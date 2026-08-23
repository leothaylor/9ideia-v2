import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  getViewportForBounds,
  MarkerType,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { toPng } from 'html-to-image';
import {
  ArrowLeft, Check, Copy, Download, ExternalLink, Focus, Grid3X3,
  ImageDown, Link2, Network, Plus, Search, Trash2, X,
} from 'lucide-react';
import { IdeaNodeCard } from './IdeaNode';
import { createNode, downloadJson, newId } from './storage';
import { STATUS_META, TYPE_META, type IdeaNode, type IdeaNodeData, type IdeaStatus, type IdeaType, type Weave } from './types';

const nodeTypes = { idea: IdeaNodeCard };
const colors = ['#8ea8e8', '#f2c46d', '#c69cf2', '#ef947a', '#7dc7b4', '#a5abb3', '#ef7a7a'];
const EXPORT_WIDTH = 1920;
const EXPORT_HEIGHT = 1080;
const EXPORT_EDGE_COLOR = '#66727e';
const EXPORT_EDGE_WIDTH = '1.6';
let exportSequence = 0;

function exportFilename(name: string) {
  const slug = name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'teia';
  const timestamp = new Date().toISOString().replace('T', '-').replace(/[:.]/g, '').replace('Z', '');
  exportSequence += 1;
  return `${slug}-${timestamp}-${exportSequence}.png`;
}

function exportSignature(nodes: IdeaNode[], edges: Edge[]) {
  return JSON.stringify({
    nodes: nodes.map((node) => ({
      id: node.id,
      position: node.position,
      data: node.data,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edge.type,
      markerEnd: edge.markerEnd,
    })),
  });
}

interface ExportStyleSnapshot {
  element: SVGElement;
  stroke: string;
  strokeWidth: string;
  fill: string;
}

function prepareEdgesForExport(viewport: HTMLElement) {
  const elements = viewport.querySelectorAll<SVGElement>(
    '.react-flow__edge-path, marker path, marker polygon, marker polyline',
  );
  const snapshots: ExportStyleSnapshot[] = [];

  elements.forEach((element) => {
    snapshots.push({
      element,
      stroke: element.style.stroke,
      strokeWidth: element.style.strokeWidth,
      fill: element.style.fill,
    });

    if (element.classList.contains('react-flow__edge-path')) {
      element.style.stroke = EXPORT_EDGE_COLOR;
      element.style.strokeWidth = EXPORT_EDGE_WIDTH;
    } else {
      element.style.stroke = EXPORT_EDGE_COLOR;
      element.style.fill = EXPORT_EDGE_COLOR;
    }
  });

  return () => {
    snapshots.forEach(({ element, stroke, strokeWidth, fill }) => {
      element.style.stroke = stroke;
      element.style.strokeWidth = strokeWidth;
      element.style.fill = fill;
    });
  };
}

interface Props {
  weave: Weave;
  onBack: () => void;
  onChange: (weave: Weave) => void;
}

interface PreparedPng {
  signature: string;
  filename: string;
  url: string;
}

function downloadPreparedPng(png: PreparedPng) {
  const anchor = document.createElement('a');
  anchor.download = png.filename;
  anchor.href = png.url;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function CanvasInner({ weave, onBack, onChange }: Props) {
  const [nodes, setNodes] = useState<IdeaNode[]>(weave.nodes);
  const [edges, setEdges] = useState<Edge[]>(weave.edges);
  const [snap, setSnap] = useState(weave.snapToGrid);
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshingExport, setRefreshingExport] = useState(false);
  const [exportError, setExportError] = useState('');
  const [preparedSignature, setPreparedSignature] = useState('');
  const exportingRef = useRef(false);
  const preparedPngRef = useRef<PreparedPng | null>(null);
  const exportGenerationRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, setCenter, getNodesBounds } = useReactFlow<IdeaNode, Edge>();
  const selectedNode = nodes.find((node) => node.selected);
  const currentExportSignature = useMemo(() => exportSignature(nodes, edges), [nodes, edges]);
  const currentExportSignatureRef = useRef(currentExportSignature);
  currentExportSignatureRef.current = currentExportSignature;

  useEffect(() => {
    setSaved(false);
    const timer = window.setTimeout(() => {
      onChange({ ...weave, nodes, edges, snapToGrid: snap, updatedAt: new Date().toISOString() });
      setSaved(true);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [nodes, edges, snap]);

  const onNodesChange = useCallback((changes: NodeChange<IdeaNode>[]) => {
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((current) => applyEdgeChanges(changes, current));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((current) => addEdge({ ...connection, id: newId(), type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, current));
  }, []);

  const addNode = useCallback((type: IdeaType, clientX?: number, clientY?: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const point = screenToFlowPosition({
      x: clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2),
      y: clientY ?? (rect ? rect.top + rect.height / 2 : window.innerHeight / 2),
    });
    const node = createNode(`Nova ${TYPE_META[type].label.toLowerCase()}`, type, point.x - 105, point.y - 55);
    node.selected = true;
    setNodes((current) => [...current.map((item) => ({ ...item, selected: false })), node]);
  }, [screenToFlowPosition]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select') || target.isContentEditable) return;
      if (event.key.toLowerCase() === 'n') addNode('ideia');
      if (event.key.toLowerCase() === 'f') fitView({ padding: .25, duration: 450 });
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addNode, fitView]);

  const updateSelected = (patch: Partial<IdeaNodeData>) => {
    if (!selectedNode) return;
    setNodes((current) => current.map((node) => node.id === selectedNode.id
      ? { ...node, data: { ...node.data, ...patch, updatedAt: new Date().toISOString() } }
      : node));
  };

  const deleteSelected = () => {
    const ids = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    setNodes((current) => current.filter((node) => !ids.has(node.id)));
    setEdges((current) => current.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target)));
  };

  const duplicateSelected = () => {
    if (!selectedNode) return;
    const copy: IdeaNode = {
      ...selectedNode,
      id: newId(),
      position: { x: selectedNode.position.x + 36, y: selectedNode.position.y + 36 },
      selected: true,
      data: { ...selectedNode.data, title: `${selectedNode.data.title} — cópia`, tags: [...selectedNode.data.tags], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), copy]);
  };

  const focusNode = (node: IdeaNode) => {
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })));
    setCenter(node.position.x + 110, node.position.y + 60, { zoom: 1.25, duration: 500 });
  };

  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return;
    const found = nodes.find((node) => `${node.data.title} ${node.data.description} ${node.data.tags.join(' ')}`.toLocaleLowerCase('pt-BR').includes(normalized));
    if (found) focusNode(found);
  };

  const renderPng = useCallback(async (exportNodes: IdeaNode[]) => {
    const viewport = wrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
    if (!viewport || exportNodes.length === 0) throw new Error('A teia não possui nós para exportar.');

    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    const restoreEdgeStyles = prepareEdgesForExport(viewport);

    try {
      const bounds = getNodesBounds(exportNodes);
      const exportViewport = getViewportForBounds(
        bounds,
        EXPORT_WIDTH,
        EXPORT_HEIGHT,
        0.1,
        2,
        0.12,
      );
      const dataUrl = await toPng(viewport, {
        backgroundColor: '#0d1014',
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT,
        pixelRatio: 2,
        cacheBust: true,
        style: {
          width: `${EXPORT_WIDTH}px`,
          height: `${EXPORT_HEIGHT}px`,
          transform: `translate(${exportViewport.x}px, ${exportViewport.y}px) scale(${exportViewport.zoom})`,
          transformOrigin: 'top left',
          '--xy-edge-stroke': EXPORT_EDGE_COLOR,
          '--xy-edge-stroke-default': EXPORT_EDGE_COLOR,
          '--xy-edge-stroke-selected': '#f2c46d',
          '--xy-edge-stroke-width': EXPORT_EDGE_WIDTH,
        } as Partial<CSSStyleDeclaration>,
      });
      return (await fetch(dataUrl)).blob();
    } finally {
      restoreEdgeStyles();
    }
  }, [getNodesBounds]);

  const preparePng = useCallback((blob: Blob, signature: string) => {
    const previous = preparedPngRef.current;
    const prepared = {
      signature,
      filename: exportFilename(weave.name),
      url: URL.createObjectURL(blob),
    };
    preparedPngRef.current = prepared;
    setPreparedSignature(signature);
    if (previous) URL.revokeObjectURL(previous.url);
    return prepared;
  }, [weave.name]);

  useEffect(() => {
    const prepared = preparedPngRef.current;
    if (!prepared || prepared.signature === currentExportSignature || exporting) {
      setRefreshingExport(false);
      return;
    }

    setRefreshingExport(true);
    const generation = ++exportGenerationRef.current;
    const exportNodes = nodes;
    const timer = window.setTimeout(async () => {
      try {
        const blob = await renderPng(exportNodes);
        if (
          exportGenerationRef.current === generation
          && currentExportSignatureRef.current === currentExportSignature
        ) {
          preparePng(blob, currentExportSignature);
          setExportError('');
        }
      } catch (error) {
        if (exportGenerationRef.current === generation) {
          console.error('Falha ao atualizar PNG', error);
          setExportError('Não foi possível atualizar o PNG. Tente novamente.');
        }
      } finally {
        if (exportGenerationRef.current === generation) setRefreshingExport(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      if (exportGenerationRef.current === generation) exportGenerationRef.current += 1;
    };
  }, [currentExportSignature, exporting, nodes, preparePng, preparedSignature, renderPng]);

  useEffect(() => () => {
    exportGenerationRef.current += 1;
    if (preparedPngRef.current) URL.revokeObjectURL(preparedPngRef.current.url);
  }, []);

  const exportImage = async () => {
    if (nodes.length === 0 || exportingRef.current || refreshingExport) return;

    const prepared = preparedPngRef.current;
    if (prepared?.signature === currentExportSignature) {
      downloadPreparedPng(prepared);
      return;
    }

    exportGenerationRef.current += 1;
    exportingRef.current = true;
    setExporting(true);
    setExportError('');

    try {
      const signature = currentExportSignature;
      const blob = await renderPng(nodes);
      const png = preparePng(blob, signature);
      downloadPreparedPng(png);
    } catch (error) {
      console.error('Falha ao exportar PNG', error);
      setExportError('Não foi possível gerar o PNG. Tente novamente.');
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  };

  const minimapColor = useCallback((node: IdeaNode) => node.data.color, []);
  const stats = useMemo(() => `${nodes.length} ${nodes.length === 1 ? 'nó' : 'nós'} · ${edges.length} ${edges.length === 1 ? 'conexão' : 'conexões'}`, [nodes.length, edges.length]);

  return (
    <main className="canvas-shell">
      <header className="canvas-topbar">
        <div className="canvas-title">
          <button className="toolbar-icon" type="button" onClick={onBack} aria-label="Voltar para Minhas Teias"><ArrowLeft size={17} /></button>
          <span className="brand-mark compact"><Network size={15} /></span>
          <div><strong>{weave.name}</strong><small>{stats}</small></div>
        </div>
        <form className="canvas-search" onSubmit={runSearch}>
          <Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na teia" aria-label="Buscar na teia" />
        </form>
        <div className="canvas-actions">
          <span className={`save-state${saved ? ' saved' : ''}`}><Check size={12} /> {saved ? 'Salvo' : 'Salvando'}</span>
          <button className="toolbar-button" type="button" onClick={() => downloadJson(`${weave.name}.json`, weave)}><Download size={15} /> JSON</button>
          <button className="toolbar-button" type="button" onClick={exportImage} disabled={exporting || refreshingExport}><ImageDown size={15} /> {exporting ? 'Gerando…' : refreshingExport ? 'Atualizando…' : 'PNG'}</button>
        </div>
      </header>

      <section className="canvas-body">
        <aside className="node-palette" aria-label="Adicionar nós">
          <p>Adicionar</p>
          {(Object.keys(TYPE_META) as IdeaType[]).map((type) => (
            <button key={type} type="button" onClick={() => addNode(type)} title={`Adicionar ${TYPE_META[type].label}`}>
              <span style={{ background: TYPE_META[type].color }} />{TYPE_META[type].label}
            </button>
          ))}
          <div className="palette-divider" />
          <button type="button" onClick={() => setSnap((value) => !value)} className={snap ? 'is-active' : ''}><Grid3X3 size={14} /> Snap {snap ? 'on' : 'off'}</button>
          <button type="button" onClick={() => fitView({ padding: .25, duration: 450 })}><Focus size={14} /> Enquadrar</button>
        </aside>

        <div className="flow-wrap" ref={wrapperRef}>
          <ReactFlow<IdeaNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={(event) => { if (event.detail === 2) addNode('ideia', event.clientX, event.clientY); }}
            snapToGrid={snap}
            snapGrid={[20, 20]}
            minZoom={.18}
            maxZoom={2.2}
            multiSelectionKeyCode="Shift"
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            fitViewOptions={{ padding: .25 }}
            defaultEdgeOptions={{ type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#2a3037" gap={24} size={1} variant={BackgroundVariant.Dots} />
            <MiniMap nodeColor={minimapColor} maskColor="rgba(8,10,12,.72)" pannable zoomable />
          </ReactFlow>
          {exportError && <div className="canvas-export-error" role="alert">{exportError}</div>}
          <div className="canvas-hint"><span>N</span> novo nó <i /> duplo clique cria <i /> arraste os pontos para conectar <i /> <span>Shift</span> multisseleção</div>
        </div>

        <aside className={`inspector${selectedNode ? ' has-selection' : ''}`}>
          {selectedNode ? (
            <>
              <header><div><p>Propriedades</p><strong>Editar nó</strong></div><button className="toolbar-icon" type="button" onClick={() => setNodes((current) => current.map((node) => ({ ...node, selected: false })))} aria-label="Fechar painel"><X size={16} /></button></header>
              <div className="inspector-scroll">
                <label>Título<input value={selectedNode.data.title} onChange={(event) => updateSelected({ title: event.target.value })} /></label>
                <label>Descrição<textarea rows={4} value={selectedNode.data.description} onChange={(event) => updateSelected({ description: event.target.value })} placeholder="Contexto, hipótese ou próximo passo…" /></label>
                <div className="field-row">
                  <label>Tipo<select value={selectedNode.data.type} onChange={(event) => { const type = event.target.value as IdeaType; updateSelected({ type, color: TYPE_META[type].color }); }}>{(Object.keys(TYPE_META) as IdeaType[]).map((type) => <option value={type} key={type}>{TYPE_META[type].label}</option>)}</select></label>
                  <label>Status<select value={selectedNode.data.status} onChange={(event) => updateSelected({ status: event.target.value as IdeaStatus })}>{(Object.keys(STATUS_META) as IdeaStatus[]).map((status) => <option value={status} key={status}>{STATUS_META[status].label}</option>)}</select></label>
                </div>
                <fieldset><legend>Cor</legend><div className="color-options">{colors.map((color) => <button key={color} type="button" onClick={() => updateSelected({ color })} className={selectedNode.data.color === color ? 'selected' : ''} style={{ background: color }} aria-label={`Usar cor ${color}`} />)}</div></fieldset>
                <label>Tags<input value={selectedNode.data.tags.join(', ')} onChange={(event) => updateSelected({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder="vendas, urgente, pesquisa" /></label>
                <label>Link<div className="input-with-icon"><Link2 size={14} /><input type="url" value={selectedNode.data.url} onChange={(event) => updateSelected({ url: event.target.value })} placeholder="https://…" /></div></label>
                {selectedNode.data.url && <a className="visit-link" href={selectedNode.data.url} target="_blank" rel="noreferrer">Abrir link <ExternalLink size={13} /></a>}
              </div>
              <footer className="inspector-footer">
                <button type="button" onClick={duplicateSelected}><Copy size={14} /> Duplicar</button>
                <button className="danger" type="button" onClick={deleteSelected}><Trash2 size={14} /> Excluir</button>
              </footer>
            </>
          ) : (
            <div className="inspector-empty"><span><Plus size={20} /></span><strong>Selecione um nó</strong><p>Edite título, tipo, status, tags e contexto sem sair do fluxo.</p></div>
          )}
        </aside>
      </section>
    </main>
  );
}

export function CanvasView(props: Props) {
  return <ReactFlowProvider><CanvasInner {...props} /></ReactFlowProvider>;
}
