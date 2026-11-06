# Sinais cripto — painel

Página do painel pessoal de sinais cripto. **Só código: nenhum dado está neste repositório.**

- Os dados (`painel/dados.json`) ficam num repositório privado e são gerados todos os dias pelo GitHub Actions.
- A página lê-os pela API do GitHub com uma chave só de leitura, guardada apenas no browser de quem a usa.
- Todo o texto vindo dos dados é mostrado como texto (nunca HTML); a página só corre o seu próprio código
  (`Content-Security-Policy`) e só fala com `api.github.com`.
- Sem bibliotecas nem passos de construção: `index.html`, `estilo.css`, `app.js`, `sw.js`, `manifest.json`.

## Testar localmente

```
python -m http.server 5196 --bind 127.0.0.1
```

Abrir `http://localhost:5196/?exemplo=real` (ou `simulacao`, `comprar`, `vender`, `espera`, `veto`, `travao`,
`hostil`, `antigo`, `incompleto`; `&semrede=1` simula falta de rede). Os ficheiros em `exemplos/` são dados de
demonstração; o modo `?exemplo=` só funciona em `localhost`.
