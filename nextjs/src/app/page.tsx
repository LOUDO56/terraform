"use client";

import { useEffect, useRef, useState } from "react";

type FileItem = {
  key: string;
  size: number;
  lastModified: string | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadFiles() {
    try {
      const res = await fetch("/api/files");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erreur");
      setFiles(data.files ?? []);
    } catch (e) {
      setStatus({ msg: `Impossible de lister les fichiers: ${String(e)}`, ok: false });
    }
  }

  useEffect(() => {
    loadFiles();
  }, []);

  async function handleUpload() {
    const input = inputRef.current;
    if (!input || !input.files || input.files.length === 0) {
      setStatus({ msg: "Aucun fichier sélectionné.", ok: false });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const form = new FormData();
      Array.from(input.files).forEach((f) => form.append("files", f));
      const res = await fetch("/api/files", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erreur");
      const names = (data.uploaded ?? [])
        .map((u: { name: string; size: number }) => `${u.name} (${formatSize(u.size)})`)
        .join(", ");
      setStatus({ msg: `Uploadé: ${names}`, ok: true });
      input.value = "";
      await loadFiles();
    } catch (e) {
      setStatus({ msg: `Echec upload: ${String(e)}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    const confirmed = window.confirm(
      "Restaurer va recopier le contenu du bucket FROID vers le bucket CHAUD (écrasement des fichiers de même nom). Continuer ?"
    );
    if (!confirmed) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/restore", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erreur");
      setStatus({
        msg: `Restauré ${data.restored?.length ?? 0} objet(s) depuis le froid.`,
        ok: true,
      });
      await loadFiles();
    } catch (e) {
      setStatus({ msg: `Echec restauration: ${String(e)}`, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>S3 Platform — stockage chaud / froid</h1>
      <p className="muted">
        Upload vers le bucket chaud, réplication automatique vers le froid,
        restauration à la demande.
      </p>

      <section>
        <h2>Upload</h2>
        <div className="row">
          <input ref={inputRef} type="file" multiple />
          <button onClick={handleUpload} disabled={busy}>
            Upload
          </button>
        </div>
      </section>

      <section>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Fichiers (bucket chaud)</h2>
          <div className="row">
            <button className="secondary" onClick={loadFiles} disabled={busy}>
              Rafraîchir
            </button>
            <button className="danger" onClick={handleRestore} disabled={busy}>
              Restaurer depuis le froid
            </button>
          </div>
        </div>
        {files.length === 0 ? (
          <p className="muted">Aucun fichier.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Taille</th>
                <th>Modifié le</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.key}>
                  <td>{f.key}</td>
                  <td>{formatSize(f.size)}</td>
                  <td className="muted">
                    {f.lastModified ? new Date(f.lastModified).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {status && (
        <div className={`status ${status.ok ? "ok" : "err"}`}>{status.msg}</div>
      )}
    </main>
  );
}
