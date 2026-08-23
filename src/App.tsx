import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Copy, Download, Ellipsis, FileUp, Network, Pencil, Plus, Trash2, X } from 'lucide-react';
import { CanvasView } from './CanvasView';
import { createWeave, downloadJson, duplicateWeave, loadData, saveData } from './storage';
import type { AppData, Weave } from './types';

type DialogState = { kind: 'create'; name: string } | { kind: 'rename'; id: string; name: string } | { kind: 'delete'; id: string; name: string } | null;

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'ontem' : `há ${days} dias`;
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const activeWeave = data.weaves.find((weave) => weave.id === activeId);

  useEffect(() => saveData(data), [data]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const updateWeave = (next: Weave) => setData((current) => ({ ...current, weaves: current.weaves.map((weave) => weave.id === next.id ? next : weave) }));

  const submitDialog = () => {
    if (!dialog) return;
    if (dialog.kind === 'create') {
      const name = dialog.name.trim() || 'Teia sem título';
      const weave = createWeave(name);
      setData((current) => ({ ...current, weaves: [weave, ...current.weaves] }));
      setDialog(null);
      setActiveId(weave.id);
      return;
    }
    if (dialog.kind === 'rename') {
      const name = dialog.name.trim();
      if (name) setData((current) => ({ ...current, weaves: current.weaves.map((weave) => weave.id === dialog.id ? { ...weave, name, updatedAt: new Date().toISOString() } : weave) }));
      setDialog(null);
      return;
    }
    setData((current) => ({ ...current, weaves: current.weaves.filter((weave) => weave.id !== dialog.id) }));
    setDialog(null);
    setNotice('Teia excluída deste dispositivo.');
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as AppData | Weave;
      const incoming = 'version' in parsed && parsed.version === 2 ? parsed.weaves : [parsed as Weave];
      if (!incoming.length || incoming.some((weave) => !weave.name || !Array.isArray(weave.nodes) || !Array.isArray(weave.edges))) throw new Error('Arquivo inválido');
      const copies = incoming.map((weave) => ({ ...duplicateWeave(weave), name: `${weave.name} — importada` }));
      setData((current) => ({ ...current, weaves: [...copies, ...current.weaves] }));
      setNotice(`${copies.length} ${copies.length === 1 ? 'teia importada' : 'teias importadas'}.`);
    } catch {
      setNotice('Não foi possível importar: arquivo incompatível.');
    }
    event.target.value = '';
  };

  if (activeWeave) return <CanvasView key={activeWeave.id} weave={activeWeave} onBack={() => setActiveId(null)} onChange={updateWeave} />;

  return (
    <main className="home-shell" onClick={() => menuId && setMenuId(null)}>
      <nav className="brandbar">
        <a className="brand" href="#" aria-label="Teia de Ideias — início"><span className="brand-mark"><Network size={18} /></span><span>Teia de Ideias</span></a>
        <div className="home-nav-actions">
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
          <button type="button" onClick={(event) => { event.stopPropagation(); fileInput.current?.click(); }}><FileUp size={14} /> Importar</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); downloadJson('teia-de-ideias-backup.json', data); }}><Download size={14} /> Backup</button>
          <span className="local-note">Salvo neste dispositivo</span>
        </div>
      </nav>

      <section className="home-content">
        <header className="home-heading">
          <div><p className="eyebrow">Seu espaço de pensamento</p><h1>Minhas Teias</h1><p className="lede">Ideias ganham clareza quando você enxerga como elas se conectam.</p></div>
          <button className="primary-button" type="button" onClick={() => setDialog({ kind: 'create', name: '' })}><Plus size={17} /> Nova teia</button>
        </header>

        {data.weaves.length ? (
          <div className="weave-grid">
            {data.weaves.map((weave) => {
              const accent = weave.nodes[0]?.data.color ?? '#f2c46d';
              return (
                <article className="weave-card" key={weave.id} style={{ '--accent': accent } as React.CSSProperties} onDoubleClick={() => setActiveId(weave.id)}>
                  <div className="card-topline">
                    <span className="weave-glyph"><i /><i /><i /><i /></span>
                    <div className="card-menu-wrap">
                      <button className="icon-button" type="button" aria-label={`Opções de ${weave.name}`} onClick={(event) => { event.stopPropagation(); setMenuId(menuId === weave.id ? null : weave.id); }}><Ellipsis size={18} /></button>
                      {menuId === weave.id && (
                        <div className="card-menu" onClick={(event) => event.stopPropagation()}>
                          <button type="button" onClick={() => { setDialog({ kind: 'rename', id: weave.id, name: weave.name }); setMenuId(null); }}><Pencil size={14} /> Renomear</button>
                          <button type="button" onClick={() => { const copy = duplicateWeave(weave); setData((current) => ({ ...current, weaves: [copy, ...current.weaves] })); setMenuId(null); setNotice('Teia duplicada.'); }}><Copy size={14} /> Duplicar</button>
                          <button type="button" onClick={() => downloadJson(`${weave.name}.json`, weave)}><Download size={14} /> Exportar JSON</button>
                          <button className="danger" type="button" onClick={() => { setDialog({ kind: 'delete', id: weave.id, name: weave.name }); setMenuId(null); }}><Trash2 size={14} /> Excluir</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="card-copy"><h2>{weave.name}</h2><p>{weave.nodes.length} {weave.nodes.length === 1 ? 'nó' : 'nós'} · Editada {relativeDate(weave.updatedAt)}</p></div>
                  <button className="open-button" type="button" onClick={() => setActiveId(weave.id)}>Abrir teia <ArrowUpRight size={15} /></button>
                </article>
              );
            })}
            <button className="new-weave-card" type="button" onClick={() => setDialog({ kind: 'create', name: '' })}><span><Plus size={20} /></span><strong>Criar uma nova teia</strong><small>Comece com um espaço em branco</small></button>
          </div>
        ) : (
          <div className="empty-home"><span><Network size={26} /></span><h2>Seu primeiro pensamento começa aqui.</h2><p>Crie uma teia para conectar ideias, decisões e próximos passos.</p><button className="primary-button" type="button" onClick={() => setDialog({ kind: 'create', name: '' })}><Plus size={17} /> Criar primeira teia</button></div>
        )}
      </section>

      {dialog && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setDialog(null)}>
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><p>{dialog.kind === 'delete' ? 'Confirmação' : 'Organizar teia'}</p><h2 id="dialog-title">{dialog.kind === 'create' ? 'Criar nova teia' : dialog.kind === 'rename' ? 'Renomear teia' : 'Excluir esta teia?'}</h2></div><button className="toolbar-icon" type="button" onClick={() => setDialog(null)} aria-label="Fechar"><X size={17} /></button></header>
            {dialog.kind === 'delete' ? <p className="dialog-message">“{dialog.name}” e todo o seu conteúdo serão removidos deste navegador. Esta ação não pode ser desfeita.</p> : <label>Nome<input autoFocus value={dialog.name} onChange={(event) => setDialog({ ...dialog, name: event.target.value })} onKeyDown={(event) => event.key === 'Enter' && submitDialog()} placeholder="Ex.: Projeto novo" /></label>}
            <footer><button className="secondary-button" type="button" onClick={() => setDialog(null)}>Cancelar</button><button className={dialog.kind === 'delete' ? 'danger-button' : 'primary-button'} type="button" onClick={submitDialog}>{dialog.kind === 'create' ? 'Criar teia' : dialog.kind === 'rename' ? 'Salvar nome' : 'Excluir teia'}</button></footer>
          </section>
        </div>
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
