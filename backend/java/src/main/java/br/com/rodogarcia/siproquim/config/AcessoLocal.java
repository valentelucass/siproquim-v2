package br.com.rodogarcia.siproquim.config;

import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.util.Base64;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class AcessoLocal implements WebMvcConfigurer {
  private final byte[] token;
  private final String origem;
  @Value("${siproquim.versao}") private String versao;
  @Value("${siproquim.desktop:false}") private boolean desktop;

  public AcessoLocal(
      @Value("${siproquim.token}") String configurado,
      @Value("${siproquim.dados}") String caminho,
      @Value("${siproquim.origem-ui}") String origem)
      throws IOException {
    this.origem = origem;
    Path pasta = Path.of(caminho).toAbsolutePath().normalize();
    if (configurado.isBlank()) {
      Files.createDirectories(pasta);
      Path arquivo = pasta.resolve("api.token");
      if (!Files.exists(arquivo)) {
        byte[] aleatorio = new byte[32];
        new SecureRandom().nextBytes(aleatorio);
        try {
          Files.writeString(
              arquivo,
              Base64.getUrlEncoder().withoutPadding().encodeToString(aleatorio),
              StandardOpenOption.CREATE_NEW);
        } catch (FileAlreadyExistsException existente) {
          /* Outra instância inicializou o perfil. */
        }
      }
      configurado = Files.readString(arquivo).strip();
    }
    if (configurado.length() < 16)
      throw new IllegalStateException("O token local precisa de pelo menos 16 caracteres.");
    token = configurado.getBytes(StandardCharsets.UTF_8);
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry
        .addMapping("/api/**")
        .allowedOrigins(origem)
        .allowedMethods("GET", "POST", "PATCH", "OPTIONS")
        .allowedHeaders("Content-Type", "X-Siproquim-Token")
        .exposedHeaders("Content-Disposition");
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry
        .addInterceptor(
            new HandlerInterceptor() {
              @Override
              public boolean preHandle(
                  HttpServletRequest req, HttpServletResponse res, Object handler)
                  throws IOException {
                res.setHeader("X-Siproquim-Versao", versao);
                if (org.springframework.web.cors.CorsUtils.isPreFlightRequest(req)) return true;
                String host = req.getHeader("Host");
                String origemPedido = req.getHeader("Origin");
                if (desktop && !req.getRequestURI().startsWith("/api/desktop/")
                    && ("127.0.0.1:" + req.getLocalPort()).equals(host)
                    && "local".equals(req.getHeader("X-Siproquim-UI"))
                    && (origemPedido == null || origemPedido.equals("http://" + host))
                    && !"cross-site".equals(req.getHeader("Sec-Fetch-Site"))) return true;
                String valor = req.getHeader("X-Siproquim-Token");
                if (valor != null
                    && MessageDigest.isEqual(token, valor.getBytes(StandardCharsets.UTF_8)))
                  return true;
                res.sendError(401);
                return false;
              }
            })
        .addPathPatterns("/api/**")
        .excludePathPatterns("/api/saude");
  }
}
