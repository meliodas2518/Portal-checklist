// pages/analise-combustivel.js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { doc, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebaseClient";
import { requireAuth } from "../lib/authGuard";

const ARQUIVOS_COMBUSTIVEL = {
  "ETANOL": "etanol.json",
  "GASOLINA COMUM": "gasolina_comum.json",
  "GASOLINA ADITIVADA": "gasolina_aditivada.json",
  "DIESEL S500": "diesel_s500.json",
  "DIESEL S10": "diesel_s10.json",
};

const OBSERVACOES = {
  "GASOLINA COMUM": "Realizar análise com proveta de 1000ml.\nCor: Exceto azul. Massa específica a 20°C: Acima de 715 kg/m³ Teor de etanol: 32%.",
  "GASOLINA ADITIVADA": "Realizar análise com proveta de 1000ml.\nCor: Exceto azul. Massa específica a 20°C: Acima de 715 kg/m³ Teor de etanol: 32%.",
  "DIESEL S500": "Cor: Deve ser vermelha.\nMassa específica a 20°C: 815–865 kg/m³.",
  "DIESEL S10": "Cor: de incolor a amarelada.\nMassa específica a 20°C: 815–853 kg/m³.",
  "ETANOL": "Cor: Incolor, não poderá ser azul ou laranja.\nMassa específica a 20°C: 802,90–811,20 kg/m³\nTeor alcoólico: 92,5–95,4 %mm.",
};

const cacheDados = {};

async function carregarDados(combustivel) {
  if (cacheDados[combustivel]) return cacheDados[combustivel];
  const arquivo = ARQUIVOS_COMBUSTIVEL[combustivel];
  const resp = await fetch(`/data/${arquivo}`);
  if (!resp.ok) throw new Error(`Falha ao carregar tabela de ${combustivel}`);
  const dados = await resp.json();
  cacheDados[combustivel] = dados;
  return dados;
}

export default function AnaliseCombustivel() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [autorizado, setAutorizado] = useState(null); // null = ainda checando

  const [combustivel, setCombustivel] = useState("GASOLINA COMUM");
  const [temperatura, setTemperatura] = useState("");
  const [densidade, setDensidade] = useState("");
  const [resultado, setResultado] = useState(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const unsub = requireAuth(router, setUser);
    return () => unsub?.();
  }, [router]);

  // verifica em tempo real se o módulo "analise" está liberado pra esse usuário
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "usuarios", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setAutorizado(false);
        return;
      }
      const data = snap.data();
      const liberado = data?.rolePortal === "super_admin" || data?.modulos?.analise === true;
      setAutorizado(liberado);
      if (!liberado) {
        alert("Você não tem acesso ao módulo de Análise de Combustível.");
        router.replace("/");
      }
    });
    return () => unsub();
  }, [user, router]);

  const sair = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  const buscarResultado = async () => {
    const temp = parseFloat(temperatura);
    const dens = parseFloat(densidade);

    if (isNaN(temp) || isNaN(dens)) {
      alert("Informe valores numéricos válidos para temperatura e densidade.");
      return;
    }

    setBuscando(true);
    try {
      const dados = await carregarDados(combustivel);
      const encontrado = dados.find(
        (item) => item["TEMP. (°C)"] === temp && item["DENS. OBS. (kg/m³)"] === dens
      );

      if (encontrado) {
        setResultado(encontrado);
      } else {
        setResultado({
          "DENS. 20°C (kg/m³)": "---",
          "CONFORME / NÃO CONFORME": "DADOS NÃO ENCONTRADOS",
        });
      }
    } catch (err) {
      console.error(err);
      alert("Não foi possível carregar a tabela de referência. Tente novamente.");
    } finally {
      setBuscando(false);
    }
  };

  const statusCor = (status) =>
    status === "CONFORME" ? "#2e7d32" : status === "NÃO CONFORME" ? "#c62828" : "#000";

  const statusIcone = (status) =>
    status === "CONFORME" ? "✅" : status === "NÃO CONFORME" ? "❌" : "⚠️";

  // enquanto não confirmamos a liberação do módulo, não renderiza o formulário
  if (autorizado !== true) {
    return (
      <div className="container">
        <div className="card cardPad">
          <p className="helper">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="pageTitle">
        <div>
          <h1 className="h1">⛽ Análise de Combustível</h1>
          <div className="sub">{user?.email || "—"}</div>
        </div>

        <div className="topActions">
          <button className="btn2" onClick={() => router.push("/")}>⬅ Voltar</button>
          <button className="btn btnRed" onClick={sair}>⎋ Sair</button>
        </div>
      </div>

      <div className="card cardPad">
        <label className="rotulo">Tipo de Combustível</label>
        <select
          className="campo"
          value={combustivel}
          onChange={(e) => {
            setCombustivel(e.target.value);
            setResultado(null);
          }}
        >
          {Object.keys(ARQUIVOS_COMBUSTIVEL).map((tipo) => (
            <option key={tipo} value={tipo}>{tipo}</option>
          ))}
        </select>

        <label className="rotulo">Observações</label>
        <p className="observacoes">{OBSERVACOES[combustivel]}</p>

        <label className="rotulo">🌡️ Temperatura (°C)</label>
        <input
          className="campo"
          type="number"
          step="0.1"
          placeholder="Ex: 10.5"
          value={temperatura}
          onChange={(e) => setTemperatura(e.target.value)}
        />

        <label className="rotulo">⚖️ Densidade Observada (kg/m³)</label>
        <input
          className="campo"
          type="number"
          step="0.1"
          placeholder="Ex: 800.0"
          value={densidade}
          onChange={(e) => setDensidade(e.target.value)}
        />

        <button className="botaoBuscar" onClick={buscarResultado} disabled={buscando}>
          {buscando ? "Buscando..." : "🔍 Buscar Resultado"}
        </button>

        {resultado && (
          <div className="resultadoContainer">
            <p className="resultado">
              Densidade 20°C: {resultado["DENS. 20°C (kg/m³)"]} kg/m³
            </p>

            {resultado["GRAU ALCOÓLICO (°INPM)"] !== undefined && (
              <p className="resultado">
                Grau Alcoólico (°INPM): {resultado["GRAU ALCOÓLICO (°INPM)"]}
              </p>
            )}

            <p
              className="resultado"
              style={{ color: statusCor(resultado["CONFORME / NÃO CONFORME"]), fontWeight: "bold" }}
            >
              Status: {resultado["CONFORME / NÃO CONFORME"]} {statusIcone(resultado["CONFORME / NÃO CONFORME"])}
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .rotulo {
          display: block;
          font-weight: bold;
          color: #bfc4c5;
          margin-top: 16px;
          margin-bottom: 6px;
          font-size: 14px;
        }
        .campo {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #ccc;
          background: #fff;
          color: #000;
          font-size: 15px;
        }
        .observacoes {
          background: #fff;
          color: #222;
          padding: 14px;
          border-radius: 8px;
          border: 1px solid #ccc;
          font-style: italic;
          white-space: pre-line;
          margin: 0;
          font-size: 14px;
        }
        .botaoBuscar {
          display: block;
          margin: 26px auto 0;
          background: #00607f;
          color: #fff;
          border: none;
          padding: 14px 28px;
          border-radius: 25px;
          font-weight: bold;
          font-size: 15px;
          cursor: pointer;
          min-width: 220px;
        }
        .botaoBuscar:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .resultadoContainer {
          margin-top: 24px;
          background: #f0f0f0;
          padding: 20px;
          border-radius: 10px;
          border: 1px solid #ccc;
        }
        .resultado {
          color: #000;
          font-size: 16px;
          margin: 6px 0;
        }
        @media (max-width: 400px) {
          .botaoBuscar {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}