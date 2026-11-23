import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { Btn, Modal } from "./Forms";
import { ler } from "./api";
import { version } from "../package.json";

export function Atualizacao({ ocupado }: { ocupado: boolean }) {
  const [disponivel, setDisponivel] = useState("");
  const [aberto, abrir] = useState(false);
  const [checando, checar] = useState(false);
  const [instalando, instalar] = useState(false);
  const [mensagem, informar] = useState("");
  const anunciado = useRef("");
  const consultando = useRef(false);
  const consultaManual = useRef(false);
  const ultima = useRef(0);
  const emDownload = useRef(false);

  const consultar = useCallback(async (manual = false) => {
    if (manual) consultaManual.current = true;
    if (consultando.current || emDownload.current) return;
    consultando.current = true;
    checar(true);
    ultima.current = Date.now();
    try {
      const estado = await ler<{disponivel: string | null}>("/atualizacoes");
      setDisponivel(estado.disponivel || "");
      if (estado.disponivel && estado.disponivel !== anunciado.current) {
        anunciado.current = estado.disponivel;
        informar("");
        abrir(true);
      } else if (consultaManual.current) informar(estado.disponivel ? "" : "Você já está usando a versão mais recente.");
    } catch {
      if (consultaManual.current) informar("Não foi possível consultar as atualizações. Confira sua conexão e tente novamente.");
    } finally {
      consultando.current = false;
      consultaManual.current = false;
      checar(false);
    }
  }, []);

  useEffect(() => {
    void consultar();
    const timer = window.setInterval(() => { if (!document.hidden) void consultar(); }, 5 * 60_000);
    const voltar = () => { if (!document.hidden && Date.now() - ultima.current >= 60_000) void consultar(); };
    window.addEventListener("focus", voltar);
    document.addEventListener("visibilitychange", voltar);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", voltar);
      document.removeEventListener("visibilitychange", voltar);
    };
  }, [consultar]);

  async function baixar() {
    if (emDownload.current) return;
    emDownload.current = true;
    instalar(true);
    informar("");
    try {
      const r = await ler<{caminho: string; iniciado: boolean}>("/atualizacoes/" + disponivel, {method: "POST"});
      informar(r.iniciado ? "O instalador foi aberto. Ao concluir, o SIPROQUIM volta a abrir. Você também pode usar o atalho."
        : "Instalador verificado. Abra o arquivo em " + r.caminho);
    } catch (e) {
      informar(e instanceof Error ? e.message : "O download falhou. Tente novamente.");
    } finally {
      emDownload.current = false;
      instalar(false);
    }
  }

  return <>
    <Tooltip content={disponivel ? "Abrir a atualização disponível" : "Verificar se há uma nova versão do sistema"}>
      <button className={"versao-app" + (disponivel ? " disponivel" : "")}
        onClick={() => { abrir(true); if (!disponivel) { informar(""); void consultar(true); } }}>
        {disponivel ? <Download size={14} /> : <RefreshCw size={13} />}
        {disponivel ? "Atualizar para " + disponivel : "Versão " + version}
      </button>
    </Tooltip>
    {aberto && !ocupado && <Modal titulo={disponivel ? "Atualização disponível" : "Atualizações do sistema"} close={() => !instalando && abrir(false)}>
      <div className="modalform">
        <p>{disponivel ? `A versão ${disponivel} está disponível. Você está usando a ${version}.` : "Versão instalada " + version + "."}</p>
        {disponivel && <p>Salve a correção que estiver digitando antes de atualizar. Os lotes e o histórico ficam no computador.</p>}
        <p role="status" hidden={!mensagem && !instalando && !checando}>{instalando ? "Baixando e verificando o instalador…" : mensagem || "Consultando a versão publicada…"}</p>
        <div className="actions">
          <Btn label={disponivel ? "Agora não" : "Fechar"} variant="ghost" onClick={() => abrir(false)} isDisabled={instalando} />
          {disponivel ? <Btn label="Atualizar agora" icon={<Download size={16}/>} onClick={baixar} isDisabled={instalando} />
            : <Btn label="Verificar novamente" onClick={() => void consultar(true)} isDisabled={checando} />}
        </div>
      </div>
    </Modal>}
  </>;
}
