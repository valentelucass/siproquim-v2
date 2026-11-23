package br.com.rodogarcia.siproquim.controller;

import br.com.rodogarcia.siproquim.model.Registros.*;
import br.com.rodogarcia.siproquim.repository.*;
import br.com.rodogarcia.siproquim.service.*;
import java.io.IOException;
import java.util.*;
import org.springframework.http.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class LoteController {
  private final LoteService servico;
  private final LoteRepository repo;
  private final MemoriaRepository memoria;
  private final LegadoService legado;
  private final DownloadsService downloads;

  public LoteController(
      LoteService servico, LoteRepository repo, MemoriaRepository memoria, LegadoService legado, DownloadsService downloads) {
    this.servico = servico;
    this.repo = repo;
    this.memoria = memoria;
    this.legado = legado;
    this.downloads = downloads;
  }

  @GetMapping("/saude")
  public Map<String, String> saude() {
    return Map.of("status", "ok");
  }

  @GetMapping(value = "/filiais", produces = MediaType.APPLICATION_JSON_VALUE)
  public ClassPathResource filiais() {
    return new ClassPathResource("filiais.json");
  }

  @GetMapping("/lotes")
  public List<Resumo> listar() {
    return repo.listar();
  }

  public record SemMovimento(String cnpj, String competencia, String evidencia) {}

  @PostMapping("/lotes/sem-movimento")
  public LoteService.Resultado semMovimento(@RequestBody SemMovimento r) {
    return servico.semMovimento(r.cnpj(), r.competencia(), r.evidencia());
  }

  @PostMapping(value = "/lotes", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public LoteService.Resultado importar(
      @RequestParam String cnpj,
      @RequestParam String competencia,
      @RequestParam MultipartFile arquivo)
      throws IOException {
    return servico.importar(
        cnpj,
        competencia,
        Objects.toString(arquivo.getOriginalFilename(), "relatorio.pdf"),
        arquivo.getBytes());
  }

  @GetMapping("/lotes/{id}")
  public LoteService.Resultado obter(@PathVariable String id) {
    return servico.consultar(id);
  }

  @PatchMapping("/lotes/{id}/operacoes")
  public LoteService.Resultado alterar(@PathVariable String id, @RequestBody Correcao r) {
    return servico.corrigir(id, r);
  }

  public record Versao(long versao) {}

  @GetMapping(value = "/lotes/{id}/previa-txt", produces = "text/plain;charset=UTF-8")
  public byte[] previa(@PathVariable String id) {
    return servico.previa(id);
  }

  @PostMapping("/lotes/{id}/exportar")
  public LoteService.Resultado exportar(@PathVariable String id, @RequestBody Versao v) {
    return servico.exportar(id, v.versao());
  }

  @PostMapping("/lotes/{id}/processamento")
  public LoteService.Resultado processado(@PathVariable String id, @RequestBody Acao a) {
    return servico.processado(id, a);
  }

  @PostMapping(value = "/lotes/{id}/recibo", consumes = MediaType.APPLICATION_JSON_VALUE)
  public LoteService.Resultado recibo(@PathVariable String id, @RequestBody Recibo r) {
    return servico.registrarRecibo(id, r);
  }

  @PostMapping(value = "/lotes/{id}/recibo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public LoteService.Resultado anexarRecibo(
      @PathVariable String id,
      @RequestParam long versao,
      @RequestParam String protocolo,
      @RequestParam String dataProtocolo,
      @RequestParam String evidencia,
      @RequestParam String cnpj,
      @RequestParam String competencia,
      @RequestParam MultipartFile arquivo)
      throws IOException {
    return servico.anexarRecibo(
        id,
        new Recibo(versao, protocolo, dataProtocolo, evidencia),
        cnpj,
        competencia,
        arquivo.getBytes());
  }

  @GetMapping(value = "/lotes/{id}/recibo/{versao}", produces = MediaType.APPLICATION_PDF_VALUE)
  public byte[] reciboArquivado(@PathVariable String id, @PathVariable long versao) {
    return repo.recibo(id, versao);
  }

  @PostMapping("/lotes/{id}/reabrir")
  public LoteService.Resultado reabrir(@PathVariable String id, @RequestBody Acao a) {
    return servico.reabrir(id, a);
  }

  @GetMapping("/lotes/{id}/historico")
  public List<Evento> historico(@PathVariable String id) {
    return repo.historico(id);
  }

  @GetMapping(value = "/lotes/{id}/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
  public byte[] pdf(@PathVariable String id) {
    return repo.arquivo(id, true);
  }

  @GetMapping("/lotes/{id}/txt")
  public ResponseEntity<byte[]> txt(
      @PathVariable String id, @RequestParam(required = false) Long versaoEnviada) {
    var arquivo = arquivoTxt(id, versaoEnviada);
    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(arquivo.nome()).build().toString())
        .body(arquivo.bytes());
  }

  @PostMapping("/lotes/{id}/salvar-txt")
  public DownloadsService.Salvo salvarTxt(@PathVariable String id,
      @RequestParam(required = false) Long versaoEnviada) throws IOException {
    var arquivo = arquivoTxt(id, versaoEnviada);
    return downloads.salvar(arquivo.nome(), arquivo.bytes());
  }

  private record ArquivoTxt(String nome, byte[] bytes) {}

  private ArquivoTxt arquivoTxt(String id, Long versaoEnviada) {
    var l = repo.obter(id);
    var mes = Formato.competencia(l.competencia());
    String nome = "M" + mes.getYear() + Formato.MESES.get(mes.getMonthValue() - 1) + l.cnpj() + ".txt";
    return new ArquivoTxt(nome, versaoEnviada == null ? repo.arquivo(id, false) : repo.enviado(id, versaoEnviada));
  }

  @PostMapping(value = "/memoria/importar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public LoteService.ImportacaoMemoria aprender(
      @RequestParam MultipartFile arquivo, @RequestParam String evidencia) throws IOException {
    return servico.aprender(arquivo.getBytes(), evidencia);
  }

  @PostMapping(value = "/memoria/importar-v1", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public LegadoService.Migracao migrar(
      @RequestParam MultipartFile arquivo, @RequestParam String evidencia) throws IOException {
    return legado.importar(arquivo.getBytes(), evidencia);
  }

  @GetMapping("/memoria")
  public List<MemoriaRepository.Sugestao> sugestoes(
      @RequestParam String filial,
      @RequestParam String papel,
      @RequestParam String nome,
      @RequestParam(defaultValue = "false") boolean incluirLegado) {
    if (!Formato.documento(filial, false))
      throw Falha.dados("Informe o CNPJ da filial para consultar sugestões.");
    return memoria.consultar(Formato.digitos(filial), papel, nome, incluirLegado);
  }
}
