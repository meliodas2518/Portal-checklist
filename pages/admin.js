// pages/admin.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebaseClient";
import { requireAuth } from "../lib/authGuard";

export default function Admin() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [ok, setOk] = useState(false);

  // criar novo login portal
const [novoNome, setNovoNome] = useState("");
const [novoEmail, setNovoEmail] = useState("");
const [novaSenha, setNovaSenha] = useState("");
const [novoRolePortal, setNovoRolePortal] = useState("admin");
const [novosPostos, setNovosPostos] = useState("");
const [portalOnly, setPortalOnly] = useState(true);
const [loadingCriar, setLoadingCriar] = useState(false);

// editar acesso existente
const [uid, setUid] = useState("");
const [rolePortal, setRolePortal] = useState("admin");
const [postos, setPostos] = useState("");
const [loadingEditar, setLoadingEditar] = useState(false);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    const unsub = requireAuth(router, setUser);
    return () => unsub?.();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const usnap = await getDoc(doc(db, "usuarios", user.uid));
      const role = usnap.exists() ? usnap.data()?.rolePortal : null;

      if (role !== "super_admin") {
        alert("Somente super_admin.");
        router.replace("/");
        return;
      }
      setOk(true);
    })();
  }, [user, router]);

  const sair = async () => {
    await signOut(auth);
    router.replace("/login");
  };
  const criarNovoLogin = async () => {
  if (loadingCriar) return;

  try {
    setLoadingCriar(true);

    if (!BACKEND_URL) {
      throw new Error("NEXT_PUBLIC_BACKEND_URL não configurado no portal.");
    }

    if (!novoNome.trim() || !novoEmail.trim() || !novaSenha.trim()) {
      throw new Error("Preencha nome, e-mail e senha.");
    }

    if (!auth.currentUser) {
      throw new Error("Sessão inválida. Faça login novamente.");
    }

    const listaPostos = novosPostos
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const token = await auth.currentUser.getIdToken(true);

    const payload = {
      nome: novoNome.trim(),
      email: novoEmail.trim(),
      senha: novaSenha,
      rolePortal: novoRolePortal,
      postosPermitidos: novoRolePortal === "super_admin" ? [] : listaPostos,
      portalOnly,
    };

    const resp = await fetch(`${BACKEND_URL}/portal/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    let json = null;
    try {
      json = await resp.json();
    } catch {}

    if (!resp.ok) {
      throw new Error(json?.error || `Falha ao criar usuário (${resp.status})`);
    }

    alert(`Login criado com sucesso ✅\nUID: ${json?.uid || "-"}`);

    setNovoNome("");
    setNovoEmail("");
    setNovaSenha("");
    setNovoRolePortal("admin");
    setNovosPostos("");
    setPortalOnly(true);
  } catch (e) {
    alert(e?.message || "Erro ao criar login");
  } finally {
    setLoadingCriar(false);
  }
};
  const salvar = async () => {
    if (loadingEditar) return;

    try {
      setLoadingEditar(true);

      if (!BACKEND_URL) {
        throw new Error(
          "NEXT_PUBLIC_BACKEND_URL não configurado no .env (portal)."
        );
      }

      if (!uid.trim()) {
        alert("Informe o UID");
        return;
      }

      if (!auth.currentUser) {
        throw new Error("Sessão inválida. Faça login novamente.");
      }

      const lista = postos
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const token = await auth.currentUser.getIdToken(true);

      const payload = {
        targetUid: uid.trim(),
        rolePortal,
        postosPermitidos: rolePortal === "super_admin" ? [] : lista,
      };

      const resp = await fetch(`${BACKEND_URL}/portal/set-access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // nem todo erro vem como JSON
      let json = null;
      try {
        json = await resp.json();
      } catch {}

      if (!resp.ok) {
        throw new Error(json?.error || `Falha ao salvar (${resp.status})`);
      }

      alert("Acesso atualizado ✅");
    } catch (e) {
      alert(e?.message || "Erro ao salvar");
    } finally {
      setLoadingEditar(false);
    }
  };

  if (!ok) return <div className="container"><p>Carregando...</p></div>;

  return (
  <div className="container">
    <div className="topbar">
      <div>
        <h2 style={{ margin: 0 }}>Admin do Portal</h2>
        <small className="muted">{user?.email}</small>
      </div>
      <div className="row">
        <button className="btn2" onClick={() => router.push("/")}>
          Voltar
        </button>
        <button className="btn" onClick={sair}>
          Sair
        </button>
      </div>
    </div>

    <div className="card" style={{ maxWidth: 560, marginBottom: 20 }}>
      <p className="muted">
        Aqui você cria um novo login para acessar o portal, sem precisar abrir o Firestore.
      </p>

      <label className="label">Nome</label>
      <input
        className="input"
        value={novoNome}
        onChange={(e) => setNovoNome(e.target.value)}
        placeholder="Ex.: Jorge"
      />

      <label className="label">E-mail</label>
      <input
        className="input"
        value={novoEmail}
        onChange={(e) => setNovoEmail(e.target.value)}
        placeholder="jorge.portal@gmail.com"
      />

      <label className="label">Senha</label>
      <input
        className="input"
        type="text"
        value={novaSenha}
        onChange={(e) => setNovaSenha(e.target.value)}
        placeholder="Defina uma senha"
      />

      <label className="label">Role</label>
      <select
        className="input"
        value={novoRolePortal}
        onChange={(e) => setNovoRolePortal(e.target.value)}
      >
        <option value="admin">admin</option>
        <option value="super_admin">super_admin</option>
      </select>

      <label className="label">
        Postos permitidos — separados por vírgula
      </label>
      <input
        className="input"
        placeholder="4067, 5269, 7195"
        value={novosPostos}
        onChange={(e) => setNovosPostos(e.target.value)}
        disabled={novoRolePortal === "super_admin"}
      />

      <label
        className="label"
        style={{ display: "flex", alignItems: "center", gap: 8 }}
      >
        <input
          type="checkbox"
          checked={portalOnly}
          onChange={(e) => setPortalOnly(e.target.checked)}
        />
        Somente portal
      </label>

      <button className="btn" onClick={criarNovoLogin} disabled={loadingCriar}>
        {loadingCriar ? "Criando..." : "Criar login"}
      </button>
    </div>

    <div className="card" style={{ maxWidth: 560 }}>
      <p className="muted">
        Aqui você define <b>rolePortal</b> e <b>postosPermitidos</b> em{" "}
        <code>usuarios/{"{uid}"}</code>.
      </p>

      <label className="label">UID do usuário (documento em usuarios)</label>
      <input
        className="input"
        value={uid}
        onChange={(e) => setUid(e.target.value)}
      />

      <label className="label">Role</label>
      <select
        className="input"
        value={rolePortal}
        onChange={(e) => setRolePortal(e.target.value)}
      >
        <option value="admin">admin</option>
        <option value="super_admin">super_admin</option>
      </select>

      <label className="label">
        Postos permitidos (somente admin) — separados por vírgula
      </label>
      <input
        className="input"
        placeholder="2883, 4067, 5473"
        value={postos}
        onChange={(e) => setPostos(e.target.value)}
        disabled={rolePortal === "super_admin"}
      />

      <button className="btn" onClick={salvar} disabled={loadingEditar}>
        {loadingEditar ? "Salvando..." : "Salvar"}
      </button>
    </div>
  </div>
);
}
