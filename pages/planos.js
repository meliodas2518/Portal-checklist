// pages/planos.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, getDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebaseClient";
import { requireAuth } from "../lib/authGuard";

const BACKEND_URL = "https://backend-checklist-z3sr.onrender.com";

const PLANOS_UI = [
  {
    key: "teste 7 dias",
    nome: "Teste grátis",
    preco: "7 dias grátis",
    acessos: "1 acesso",
    descricao: "Disponível uma única vez por conta",
    cor: "#0ea5e9",
  },
  {
    key: "mensal",
    nome: "Mensal",
    preco: "R$ 24,99",
    acessos: "1 acesso",
    descricao: "Ideal para começar",
    cor: "#2563eb",
  },
  {
    key: "trimestral",
    nome: "Trimestral",
    preco: "R$ 64,99",
    acessos: "1 acesso",
    descricao: "Economia por 3 meses",
    cor: "#7c3aed",
  },
  {
    key: "anual",
    nome: "Anual",
    preco: "R$ 149,99",
    acessos: "1 acesso",
    descricao: "Melhor custo-benefício",
    destaque: true,
    selo: "Mais escolhido",
    cor: "#16a34a",
  },
  {
    key: "anual_plus",
    nome: "Anual Plus",
    preco: "R$ 189,99",
    acessos: "2 acessos",
    descricao: "Perfeito para equipe",
    selo: "2 usuários",
    cor: "#ea580c",
  },
  {
    key: "personalizado",
    nome: "Plano Personalizado",
    preco: "Sob consulta",
    acessos: "Múltiplos postos e acessos",
    descricao: "Monte um plano sob medida para sua operação",
    selo: "Contato comercial",
    cor: "#0891b2",
  },
];

export default function Planos() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingPlano, setLoadingPlano] = useState(null);
  const [planoPersonalizadoAtivo, setPlanoPersonalizadoAtivo] = useState(false);
  const [whatsappPersonalizado, setWhatsappPersonalizado] = useState("5577988516266");

  useEffect(() => {
    const unsub = requireAuth(router, setUser);
    return () => unsub?.();
  }, [router]);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "app_config", "planos"));
        if (!snap.exists()) return;
        const data = snap.data() || {};
        setPlanoPersonalizadoAtivo(data?.planoPersonalizadoAtivo === true);
        if (data?.whatsappPlanoPersonalizado) {
          setWhatsappPersonalizado(String(data.whatsappPlanoPersonalizado));
        }
      } catch (e) {
        console.log("Erro ao carregar config de planos:", e);
      }
    })();
  }, []);

  const sair = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const iniciarPagamento = async (plano) => {
    try {
      const u = auth.currentUser;
      if (!u?.uid || !u?.email) {
        alert("Você precisa estar logado para assinar um plano.");
        return;
      }

      setLoadingPlano(plano);

      // Plano personalizado -> WhatsApp
      if (plano === "personalizado") {
        if (!planoPersonalizadoAtivo) {
          alert("O plano personalizado ainda não está disponível.");
          return;
        }
        const texto = encodeURIComponent(
          "Olá! Quero solicitar um plano personalizado para o app.\n\n" +
            "Meu interesse é:\n" +
            "- Quantidade de postos:\n" +
            "- Quantidade de acessos:\n" +
            "- Módulos desejados: Análise / Checklist / Ambos\n\n" +
            "Pode me passar uma proposta?"
        );
        window.open(`https://wa.me/${whatsappPersonalizado}?text=${texto}`, "_blank");
        return;
      }

      // Teste grátis
      if (plano === "teste 7 dias") {
        const idToken = await u.getIdToken();
        const res = await fetch(`${BACKEND_URL}/trial/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
        });

        let data = null;
        try { data = await res.json(); } catch {}

        if (!res.ok) {
          throw new Error(data?.error || `Erro ao ativar teste grátis (HTTP ${res.status})`);
        }

        alert("Teste grátis ativado! Seu acesso foi liberado por 7 dias.");
        router.push("/");
        return;
      }

      // Planos pagos
      const res = await fetch(`${BACKEND_URL}/mp/create-preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano, uid: u.uid, email: u.email }),
      });

      let data = null;
      try { data = await res.json(); } catch {}

      if (!res.ok) {
        throw new Error(data?.error || `Erro ao iniciar pagamento (HTTP ${res.status})`);
      }

      const checkoutUrl = data?.init_point || data?.sandbox_init_point;
      if (!checkoutUrl) {
        throw new Error("Link de pagamento não retornou do backend.");
      }

      window.open(checkoutUrl, "_blank");
    } catch (err) {
      alert(err?.message || "Falha ao iniciar pagamento.");
    } finally {
      setLoadingPlano(null);
    }
  };

  return (
    <div className="container">
      <div className="pageTitle">
        <div>
          <h1 className="h1">Escolha seu plano</h1>
          <div className="sub">Assine ou renove seu acesso ao portal e ao app</div>
        </div>

        <div className="topActions">
          <button className="btn2" onClick={() => router.push("/")}>⬅ Voltar</button>
          <button className="btn btnRed" onClick={sair}>⎋ Sair</button>
        </div>
      </div>

      <div className="planosGrid">
        {PLANOS_UI.map((p) => {
          const carregando = loadingPlano === p.key;
          const personalizadoBloqueado = p.key === "personalizado" && !planoPersonalizadoAtivo;

          return (
            <div
              key={p.key}
              className={`planoCard ${p.destaque ? "planoDestaque" : ""}`}
              style={{ borderColor: p.destaque ? p.cor : "rgba(255,255,255,0.12)" }}
            >
              <div className="planoHeader">
                <div>
                  <div className="planoNome">{p.nome}</div>
                  <div className="planoDescricao">{p.descricao}</div>
                </div>
                {p.selo && (
                  <span className="planoSelo" style={{ background: p.cor }}>{p.selo}</span>
                )}
              </div>

              <div className="planoPrecoArea">
                <div className="planoPreco">{p.preco}</div>
                <div className="planoAcessos">{p.acessos}</div>
              </div>

              <button
                className="planoBotao"
                style={{ background: personalizadoBloqueado ? "#475569" : p.cor }}
                onClick={() => iniciarPagamento(p.key)}
                disabled={!!loadingPlano}
              >
                {carregando
                  ? (p.key === "personalizado" ? "Abrindo WhatsApp..." : "Abrindo checkout...")
                  : p.key === "personalizado"
                    ? (planoPersonalizadoAtivo ? "Solicitar proposta" : "Em breve")
                    : "Assinar agora"}
              </button>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .planosGrid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 18px;
          margin-top: 20px;
        }
        .planoCard {
          background: rgba(15, 23, 42, 0.82);
          border-radius: 18px;
          padding: 22px;
          border: 1.5px solid rgba(255, 255, 255, 0.12);
        }
        .planoDestaque {
          background: rgba(15, 23, 42, 0.92);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
        }
        .planoHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          gap: 10px;
        }
        .planoNome {
          color: #fff;
          font-size: 20px;
          font-weight: 900;
        }
        .planoDescricao {
          color: #94a3b8;
          font-size: 13px;
          margin-top: 4px;
        }
        .planoSelo {
          padding: 5px 10px;
          border-radius: 999px;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }
        .planoPrecoArea {
          text-align: center;
          margin-bottom: 18px;
        }
        .planoPreco {
          color: #fff;
          font-size: 26px;
          font-weight: 900;
        }
        .planoAcessos {
          color: #cbd5e1;
          font-size: 13px;
          margin-top: 4px;
        }
        .planoBotao {
          width: 100%;
          border: none;
          border-radius: 12px;
          padding: 13px;
          color: #fff;
          font-weight: 900;
          font-size: 15px;
          cursor: pointer;
        }
        .planoBotao:disabled {
          opacity: 0.6;
          cursor: default;
        }
      `}</style>
    </div>
  );
}