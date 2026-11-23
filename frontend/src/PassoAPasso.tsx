import { useLayoutEffect, useRef, type MouseEvent } from "react";
import { Button } from "@astryxdesign/core/Button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { etapas } from "./roteiro";

const margem = 10;
const distancia = 16;
const limitar = (valor: number, minimo: number, maximo: number) =>
  Math.max(minimo, Math.min(valor, maximo));

function posicionarBalao(
  balao: HTMLElement,
  texto: HTMLElement,
  marca: DOMRect,
) {
  const tela = document.documentElement.clientWidth;
  const espaco = {
    abaixo: innerHeight - marca.bottom - distancia - margem,
    acima: marca.top - distancia - margem,
    direita: tela - marca.right - distancia - margem,
    esquerda: marca.left - distancia - margem,
  };
  const largura = balao.offsetWidth;
  const alturaNatural =
    balao.offsetHeight + texto.scrollHeight - texto.clientHeight;
  const lados = ["abaixo", "acima", "direita", "esquerda"] as const;
  const vertical = (lado: (typeof lados)[number]) =>
    lado === "abaixo" || lado === "acima";
  const lado =
    lados.find((l) => espaco[l] >= (vertical(l) ? alturaNatural : largura)) ??
    (espaco.abaixo >= espaco.acima ? "abaixo" : "acima");

  balao.style.setProperty(
    "--altura-disponivel",
    (vertical(lado) ? espaco[lado] : innerHeight - 2 * margem) + "px",
  );
  const altura = balao.offsetHeight;
  const meioX = marca.left + marca.width / 2;
  const meioY = marca.top + marca.height / 2;
  let x = limitar(meioX - largura / 2, margem, tela - largura - margem);
  let y = limitar(meioY - altura / 2, margem, innerHeight - altura - margem);
  switch (lado) {
    case "abaixo":
      y = marca.bottom + distancia;
      break;
    case "acima":
      y = marca.top - distancia - altura;
      break;
    case "direita":
      x = marca.right + distancia;
      break;
    case "esquerda":
      x = marca.left - distancia - largura;
      break;
  }
  const ponta = vertical(lado) ? meioX - x : meioY - y;
  const extensao = vertical(lado) ? largura : altura;
  balao.style.setProperty(
    "--posicao-seta",
    limitar(ponta, 14, extensao - 14) + "px",
  );
  balao.style.left = x + "px";
  balao.style.top = y + "px";
  balao.dataset.lado = lado;
}

export function PassoAPasso({
  indice,
  ir,
  fechar,
  exemplo,
}: {
  indice: number;
  ir: (n: number) => void;
  fechar: () => void;
  exemplo: boolean;
}) {
  const etapa = etapas[indice];
  const ultimo = indice === etapas.length - 1;
  const marca = useRef<HTMLButtonElement>(null);
  const balao = useRef<HTMLElement>(null);
  const instrucao = useRef<HTMLDivElement>(null);
  const avancarBtn = useRef<HTMLButtonElement>(null);
  const sair = useRef(fechar);
  sair.current = fechar;

  useLayoutEffect(() => {
    avancarBtn.current?.focus({ preventScroll: true });
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        sair.current();
      }
      if (e.repeat && (e.key === "Enter" || e.key === " ")) e.preventDefault();
    }
    document.addEventListener("keydown", tecla, true);
    return () => document.removeEventListener("keydown", tecla, true);
  }, []);

  useLayoutEffect(() => {
    const botao = marca.current!;
    const painel = balao.current!;
    botao.hidden = true;
    let alvo: HTMLElement | null = null;
    let recentralizar = false;
    let raf = 0;
    const tamanho = new ResizeObserver(agendar);
    function semAlvo() {
      botao.hidden = true;
      delete painel.dataset.lado;
      painel.style.removeProperty("top");
      painel.style.removeProperty("left");
      painel.style.removeProperty("--altura-disponivel");
    }
    function medir() {
      const el = document.querySelector<HTMLElement>(etapa.alvo);
      if (!el || !el.getClientRects().length) {
        semAlvo();
        return;
      }
      if (el !== alvo) {
        if (alvo) tamanho.unobserve(alvo);
        alvo = el;
        tamanho.observe(el);
        recentralizar = true;
      }
      if (recentralizar) {
        recentralizar = false;
        if (el.closest("header"))
          window.scrollTo({ top: 0, behavior: "instant" });
        el.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "instant",
        });
      }
      const r = el.getBoundingClientRect();
      const area = el.closest(".issues")?.getBoundingClientRect();
      const top = Math.max(2, r.top - 2, area?.top ?? 0);
      const left = Math.max(2, r.left - 2);
      const width =
        Math.min(document.documentElement.clientWidth - 2, r.right + 2) - left;
      const height =
        Math.min(
          window.innerHeight - 2,
          r.bottom + 2,
          area?.bottom ?? Infinity,
        ) - top;
      if (width < 4 || height < 4) {
        semAlvo();
        return;
      }
      botao.hidden = false;
      Object.assign(botao.style, {
        top: top + "px",
        left: left + "px",
        width: width + "px",
        height: height + "px",
      });
      posicionarBalao(
        painel,
        instrucao.current!,
        botao.getBoundingClientRect(),
      );
    }
    function agendar() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(medir);
    }
    function redimensionar() {
      recentralizar = true;
      agendar();
    }
    const mudancas = new MutationObserver(agendar);
    mudancas.observe(document.getElementById("principal")!, {
      subtree: true,
      childList: true,
    });
    tamanho.observe(painel);
    window.addEventListener("resize", redimensionar);
    document.addEventListener("scroll", agendar, true);
    document.addEventListener("transitionend", agendar);
    medir();
    agendar();
    return () => {
      cancelAnimationFrame(raf);
      mudancas.disconnect();
      tamanho.disconnect();
      document.removeEventListener("scroll", agendar, true);
      document.removeEventListener("transitionend", agendar);
      window.removeEventListener("resize", redimensionar);
    };
  }, [etapa]);

  function avancar(e: MouseEvent) {
    if (e.detail > 1) return;
    if (ultimo) fechar();
    else ir(indice + 1);
  }
  return (
    <>
      <section ref={balao} className="roteiro-balao" aria-label="Passo a passo">
        <span className="roteiro-seta" aria-hidden="true" />
        <div className="roteiro-cabecalho">
          <small>
            Passo {indice + 1} de {etapas.length}
            {exemplo && " · Lote de exemplo"}
          </small>
          <Button
            label="Sair do passo a passo"
            tooltip="Sair e retomar o trabalho"
            variant="ghost"
            isIconOnly
            size="sm"
            icon={<X size={16} />}
            onClick={fechar}
          />
        </div>
        <div
          ref={instrucao}
          aria-live="polite"
          aria-atomic="true"
          className="roteiro-instrucao"
        >
          <h2>{etapa.titulo}</h2>
          <p id="roteiro-orientacao">{etapa.texto}</p>
        </div>
        <div className="roteiro-acoes">
          <Button
            label="Voltar"
            variant="ghost"
            size="sm"
            icon={<ChevronLeft size={15} />}
            isDisabled={indice === 0}
            onClick={(e) => {
              if (e.detail <= 1) ir(indice - 1);
            }}
          />
          <Button
            ref={avancarBtn}
            label={ultimo ? "Concluir" : "Avançar"}
            variant="primary"
            size="sm"
            endContent={<ChevronRight size={15} />}
            onClick={avancar}
          />
        </div>
      </section>
      <button
        type="button"
        ref={marca}
        className="roteiro-marca"
        hidden
        aria-label={"Local destacado • " + etapa.titulo}
        aria-describedby="roteiro-orientacao"
        onClick={avancar}
      />
    </>
  );
}
