package br.com.rodogarcia.siproquim.service;

import static org.junit.jupiter.api.Assertions.*;
import java.io.*;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.Test;

class AtualizacoesTest {
  @Test void comparaVersoesNumericamente() {
    assertTrue(Atualizacoes.maisNova("2.10.0", "2.9.9"));
    assertFalse(Atualizacoes.maisNova("2.0.0", "2.0.0"));
    assertFalse(Atualizacoes.maisNova("1.9.9", "2.0.0"));
  }
  @Test void rejeitaAlteracaoDoManifestoEDoInstalador() throws Exception {
    byte[] conteudo = {3,5,9};
    String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(conteudo));
    var chaves = KeyPairGenerator.getInstance("RSA").generateKeyPair();
    var sig = Signature.getInstance("SHA256withRSA");
    sig.initSign(chaves.getPrivate());
    sig.update(("2.1.0\n" + hash + "\n").getBytes(StandardCharsets.UTF_8));
    String assinatura = Base64.getEncoder().encodeToString(sig.sign());
    Atualizacoes.autenticar(new Atualizacoes.Manifesto("2.1.0",hash,assinatura),chaves.getPublic());
    assertThrows(SignatureException.class, () -> Atualizacoes.autenticar(
        new Atualizacoes.Manifesto("2.2.0",hash,assinatura),chaves.getPublic()));
    var out = new ByteArrayOutputStream();
    Atualizacoes.verificarPacote(new ByteArrayInputStream(conteudo), out, hash);
    assertArrayEquals(conteudo,out.toByteArray());
    assertThrows(SignatureException.class, () -> Atualizacoes.verificarPacote(
        new ByteArrayInputStream(new byte[]{2}),out,hash));
  }
}
