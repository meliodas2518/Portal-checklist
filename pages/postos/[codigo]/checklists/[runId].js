// pages/postos/[codigo]/checklists/[runId].js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../../../../lib/firebaseClient";
import { requireAuth } from "../../../../lib/authGuard";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "");

function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

const CORES = { bom: "ok", regular: "warn", ruim: "bad", nada: "na" };

export default function ChecklistDetalhe() {
  const router = useRouter();
  const { codigo, runId } = router.query;

  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [ok, setOk] = useState(false);

  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  const [signedUrls, setSignedUrls] = useState({});
  const [loadingFotos, setLoadingFotos] = useState(false);
  const [erroFotos, setErroFotos] = useState("");

  useEffect(() => {
    const unsub = requireAuth(router, setUser);
    return () => unsub?.();
  }, [router]);

  // permissão
  useEffect(() => {
    if (!user || !codigo) return;

    (async () => {
      const usnap = await getDoc(doc(db, "usuarios", user.uid));
      if (!usnap.exists()) {
        alert("Usuário sem perfil no Firestore.");
        router.replace("/login");
        return;
      }

      const u = usnap.data();
      setRole(u.rolePortal || null);

      if (u.rolePortal === "super_admin") {
        setOk(true);
        return;
      }

      const permitidos = Array.isArray(u.postosPermitidos) ? u.postosPermitidos : [];
      const allowed = permitidos.map(String).includes(String(codigo));

      if (!allowed) {
        alert("Você não tem acesso a este posto.");
        router.replace("/");
        return;
      }

      setOk(true);
    })();
  }, [user, codigo, router]);

  // carrega checklist
  useEffect(() => {
    if (!ok || !codigo || !runId) return;

    (async () => {
      setLoading(true);

      const ref = doc(db, "postos", String(codigo), "checklists", String(runId));
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        alert("Checklist não encontrado.");
        router.replace(`/postos/${codigo}`);
        return;
      }

      setDados({ id: snap.id, ...snap.data() });
      setLoading(false);
    })();
  }, [ok, codigo, runId, router]);

  const allFileIds = useMemo(() => {
    const itensObj = dados?.itens || {};
    const itens = Object.values(itensObj);

    const ids = [];
    for (const it of itens) {
      const fotos = Array.isArray(it?.fotos) ? it.fotos : [];
      for (const id of fotos) if (id) ids.push(String(id));
    }
    return [...new Set(ids)];
  }, [dados]);

  const carregarSignedUrls = async () => {
    setErroFotos("");

    if (!ok || !dados) return;
    if (!BACKEND_URL) {
      setErroFotos("NEXT_PUBLIC_BACKEND_URL não configurado no portal.");
      setSignedUrls({});
      return;
    }
    if (allFileIds.length === 0) {
      setSignedUrls({});
      return;
    }

    try {
      setLoadingFotos(true);

      if (!auth.currentUser) {
        setErroFotos("Usuário não autenticado no portal.");
        return;
      }

      const token = await auth.currentUser.getIdToken(true);

      const resp = await fetch(`${BACKEND_URL}/signed-urls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileIds: allFileIds }),
      });

      const json = await resp.json().catch(() => null);

      if (!resp.ok) {
        console.log("signed-urls erro:", resp.status, json);
        setErroFotos(json?.error || `Falha no /signed-urls (HTTP ${resp.status})`);
        setSignedUrls({});
        return;
      }

      setSignedUrls(json?.urls || {});
      if ((json?.urls && Object.keys(json.urls).length === 0) && allFileIds.length > 0) {
        setErroFotos(
          "Nenhuma URL assinada retornou. Pode ser CORS/SIGNING_SECRET ou falta metadata em driveFiles/{fileId}."
        );
      }
    } catch (e) {
      console.log("signed-urls exception:", e);
      setErroFotos(e?.message || "Erro ao buscar signed urls.");
      setSignedUrls({});
    } finally {
      setLoadingFotos(false);
    }
  };

  useEffect(() => {
    carregarSignedUrls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, dados, allFileIds.join("|")]);

  const sair = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const itens = useMemo(() => Object.values(dados?.itens || {}), [dados]);

  const dtIni = toDate(dados?.iniciadoEm);
  const dtFim = toDate(dados?.finalizadoEm);

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>
            {dados?.tipo === "diario" ? "📋 Checklist Diário" : "📅 Checklist Mensal"} •{" "}
            {dados?.data || "—"}
          </h2>
          <small className="muted">
            Posto: {dados?.nomePosto || dados?.codigoPosto || codigo} • Responsável:{" "}
            {dados?.usuario || "—"} • {role || "sem rolePortal"}
          </small>
        </div>
        <div className="row">
          <button className="btn2" onClick={() => router.push(`/postos/${codigo}`)}>
            Voltar
          </button>
          <button className="btn" onClick={sair}>
            Sair
          </button>
        </div>
      </div>

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="muted">Início</div>
                <div style={{ fontWeight: 900 }}>
                  {dtIni ? dtIni.toLocaleString("pt-BR") : "—"}
                </div>
              </div>
              <div>
                <div className="muted">Encerramento</div>
                <div style={{ fontWeight: 900 }}>
                  {dtFim ? dtFim.toLocaleString("pt-BR") : "—"}
                </div>
              </div>
              <div>
                <div className="muted">Código</div>
                <div style={{ fontWeight: 900 }}>{dados?.codigoPosto || codigo}</div>
              </div>
            </div>

            {allFileIds.length > 0 && (
              <div style={{ marginTop: 10 }} className="row">
                <div className="muted" style={{ flex: 1 }}>
                  {loadingFotos
                    ? "Carregando fotos..."
                    : BACKEND_URL
                    ? `Fotos detectadas: ${allFileIds.length} • URLs retornadas: ${Object.keys(signedUrls || {}).length}`
                    : "NEXT_PUBLIC_BACKEND_URL não configurado."}
                  {erroFotos ? <div className="toast err" style={{ marginTop: 10 }}>{erroFotos}</div> : null}
                </div>

                <button className="btn btnBlue" onClick={carregarSignedUrls} disabled={loadingFotos}>
                  🔄 Recarregar fotos
                </button>
              </div>
            )}
          </div>

          {itens.length === 0 ? (
            <p>Sem itens.</p>
          ) : (
            <div className="stack">
              {itens.map((it, idx) => {
                const st = it.status || "nada";
                const fotos = Array.isArray(it.fotos) ? it.fotos.map(String) : [];

                return (
                  <div className="card" key={`${idx}_${it.label || "item"}`}>
                    <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 900, fontSize: 15 }}>{it.label || "-"}</div>
                        {it.comentario ? (
                          <div className="muted" style={{ marginTop: 6 }}>
                            📝 {it.comentario}
                          </div>
                        ) : null}
                        {it.vencimento ? (
                          <div className="muted" style={{ marginTop: 4 }}>
                            ⏳ Venc.: {it.vencimento}
                          </div>
                        ) : null}
                      </div>

                      <div className={`status ${CORES[st] || "na"}`}>
                        {st === "bom"
                          ? "✅ Bom"
                          : st === "regular"
                          ? "⚠️ Regular"
                          : st === "ruim"
                          ? "❌ Ruim"
                          : "➖ N/A"}
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      {fotos.length === 0 ? (
                        <div className="muted">Sem fotos</div>
                      ) : (
                        <div className="photos">
                          {fotos.map((fileId) => {
                            const url = signedUrls?.[fileId];

                            if (!url) {
                              return (
                                <div key={fileId} className="muted" style={{ fontSize: 12 }}>
                                  Foto indisponível (sem URL) • {fileId}
                                </div>
                              );
                            }

                            return (
                              <img
                                key={fileId}
                                className="photo"
                                src={url}
                                alt="foto"
                                loading="lazy"
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
