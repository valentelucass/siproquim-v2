import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Download, RefreshCw } from "lucide-react";
import { Tooltip } from "@astryxdesign/core/Tooltip";
import { Btn, Modal } from "./Forms";
import { ler } from "./api";
import { registrarVersaoApi } from "./diagnostico";
import { version } from "../package.json";

export function Atualizacao({ ocupado }: { ocupado: boolean }) {
  const [instalada, setInstalada] = useState(version);
  const [disponivel, setDisponivel] = useState("");
  const [aberto, abrir] = useState(false);
  const [checando, checar] = useState(false);
  const [instalando, instalar] = useState(false);
  const [mensagem, informar] = useState("");
  const [falhou, setFalhou] = useState(false);
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
      const estado = await ler<{instalada: string; disponivel: string | null}>("/atualizacoes");
      if (estado.instalada) {
        setInstalada(estado.instalada);
        registrarVersaoApi(estado.instalada);
      }
      setDisponivel(estado.disponivel || "");
      if (!estado.disponivel || consultaManual.current || estado.disponivel !== anunciado.current) {
        setFalhou(false);
        informar("");
      }
      if (estado.disponivel && estado.disponivel !== anunciado.current) {
        anunciado.current = estado.disponivel;
        informar("");
        abrir(true);
      } else if (consultaManual.current) informar(estado.disponivel ? "" : "Você já está usando a versão mais recente.");
    } catch {
      if (consultaManual.current) {
        setFalhou(true);
        informar("Não foi possível consultar as atualizações. Confira sua conexão e tente novamente.");
      }
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
    setFalhou(false);
    informar("");
    try {
      const r = await ler<{caminho: string; iniciado: boolean}>("/atualizacoes/" + disponivel, {method: "POST"});
      informar(r.iniciado ? "O instalador foi aberto. Ao concluir, o SIPROQUIM volta a abrir. Você também pode usar o atalho."
        : "Instalador verificado. Abra o arquivo em " + r.caminho);
    } catch (e) {
      setFalhou(true);
      informar(e instanceof Error ? e.message : "O download falhou. Tente novamente.");
    } finally {
      emDownload.current = false;
      instalar(false);
    }
  }

  const ocupadoAgora = instalando || checando;
  const tituloEstado = instalando ? "Preparando o instalador" : checando ? "Consultando a versão"
    : falhou ? "Atenção à atualização" : disponivel ? "Nova versão " + disponivel : "Sistema atualizado";
  const Icone = ocupadoAgora ? RefreshCw : falhou ? CircleAlert : disponivel ? Download : CircleCheck;
  return <>
    <Tooltip content={disponivel ? "Abrir a atualização disponível" : "Verificar se há uma nova versão do sistema"}>
      <button className={"versao-app" + (disponivel ? " disponivel" : "")}
        onClick={() => { abrir(true); if (!disponivel) { informar(""); void consultar(true); } }}>
        {disponivel ? <Download size={14} /> : <RefreshCw size={13} />}
        {disponivel ? "Atualizar para " + disponivel : "Versão " + instalada}
      </button>
    </Tooltip>
    {aberto && !ocupado && <Modal titulo={disponivel ? "Atualização disponível" : "Atualizações do sistema"} close={() => !instalando && abrir(false)}>
      <div className="update-dialog">
        <div className="update-body">
          <div className="update-status" role="status">
            <span className="update-icon" data-tom={falhou ? "aviso" : disponivel || ocupadoAgora ? "info" : "ok"}>
              <Icone size={22} aria-hidden="true" />
            </span>
            <div><strong>{tituloEstado}</strong><p>{instalando ? "Baixando e verificando o instalador…" : checando ? "Procurando a última versão publicada…" : mensagem ||
              (disponivel ? "Salve a correção que estiver digitando antes de atualizar. Seus lotes e o histórico ficam no computador." : "Você já está usando a versão mais recente.")}</p></div>
          </div>
          <div className="update-version"><span>Versão instalada</span><strong>{instalada}</strong></div>
        </div>
        <div className="actions update-actions">
          <Btn label={disponivel ? "Agora não" : "Fechar"} variant="ghost" onClick={() => abrir(false)} isDisabled={instalando} />
          {disponivel ? <Btn label="Atualizar agora" icon={<Download size={16}/>} onClick={baixar} isDisabled={instalando} />
            : <Btn label="Verificar novamente" onClick={() => void consultar(true)} isDisabled={checando} />}
        </div>
      </div>
    </Modal>}
  </>;
}
