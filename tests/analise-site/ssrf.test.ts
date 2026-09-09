import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validarUrlPublica,
  ErroSSRF,
  ehIpInterno,
  ehHostProibido,
} from "../../lib/analise-site/ssrf";

const resolverPublico = async () => [{ address: "93.184.216.34", family: 4 }];

test("ehIpInterno: reconhece faixas privadas / reservadas / metadata", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "172.16.0.1",
    "172.31.255.255",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
  ]) {
    assert.equal(ehIpInterno(ip), true, `deveria ser interno: ${ip}`);
  }
  for (const ip of ["8.8.8.8", "93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(ehIpInterno(ip), false, `deveria ser publico: ${ip}`);
  }
});

test("ehHostProibido", () => {
  for (const h of ["localhost", "foo.local", "x.internal", "metadata.google.internal", "a.lan"]) {
    assert.equal(ehHostProibido(h), true, h);
  }
  assert.equal(ehHostProibido("example.com"), false);
});

test("validarUrlPublica: rejeita esquema nao-http", async () => {
  await assert.rejects(
    () => validarUrlPublica("ftp://example.com/", { resolver: resolverPublico }),
    ErroSSRF,
  );
  await assert.rejects(
    () => validarUrlPublica("file:///etc/passwd", { resolver: resolverPublico }),
    ErroSSRF,
  );
});

test("validarUrlPublica: rejeita IP interno literal (v4 e v6)", async () => {
  await assert.rejects(() => validarUrlPublica("http://127.0.0.1/"), ErroSSRF);
  await assert.rejects(() => validarUrlPublica("http://169.254.169.254/latest/"), ErroSSRF);
  await assert.rejects(() => validarUrlPublica("http://[::1]/"), ErroSSRF);
  await assert.rejects(() => validarUrlPublica("http://192.168.15.1/"), ErroSSRF);
});

test("validarUrlPublica: rejeita host interno por nome", async () => {
  await assert.rejects(() => validarUrlPublica("http://localhost:3000/"), ErroSSRF);
  await assert.rejects(
    () => validarUrlPublica("https://metadata.google.internal/"),
    ErroSSRF,
  );
});

test("validarUrlPublica: rejeita dominio que RESOLVE para IP interno (rebind)", async () => {
  await assert.rejects(
    () =>
      validarUrlPublica("http://evil.example/", {
        resolver: async () => [{ address: "10.0.0.9", family: 4 }],
      }),
    ErroSSRF,
  );
});

test("validarUrlPublica: rejeita credenciais embutidas", async () => {
  await assert.rejects(
    () => validarUrlPublica("http://user:senha@example.com/", { resolver: resolverPublico }),
    ErroSSRF,
  );
});

test("validarUrlPublica: aceita URL publica normal e devolve os IPs", async () => {
  const r = await validarUrlPublica("https://example.com/pagina", { resolver: resolverPublico });
  assert.equal(r.url.hostname, "example.com");
  assert.deepEqual(r.ips, ["93.184.216.34"]);
});
