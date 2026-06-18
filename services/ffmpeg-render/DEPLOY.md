# Deploy do microserviço FFmpeg (Andromeda)

## Secrets no Cloudflare Worker (app principal)

Configure no painel Cloudflare → Workers → Settings → Variables:

| Secret | Obrigatório para |
|--------|------------------|
| `FFMPEG_SERVICE_URL` | Export `texto_animado` e montagem final de `clipes_texto` |
| `FFMPEG_SERVICE_SECRET` | Autenticação Bearer no microserviço |
| `ELEVENLABS_API_KEY` | Narração automática no export |
| `NANOBANANA_API_KEY` | Clipes IA (recomendado para `clipes_texto`) |
| `PEXELS_API_KEY` | Fallback de clipes se NanoBanana falhar |
| `AGENT_MEDIA_API_KEY` | UGC talking head quando `estilo_producao = ugc_avatar` |

## Deploy deste serviço (Render / Railway / VPS)

```bash
cd services/ffmpeg-render
npm install
# Env: FFMPEG_SERVICE_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORT
node server.mjs
```

Endpoints:

- `GET /health` — health check
- `POST /render` — texto animado (fundo + legendas + áudio)
- `POST /render-clipes` — concatena clipes + legendas + áudio

Header: `Authorization: Bearer <FFMPEG_SERVICE_SECRET>`

Após deploy, atualize `FFMPEG_SERVICE_URL` no Worker para a URL pública (ex. `https://ffmpeg-seu-app.onrender.com`).

## Smoke test

```bash
curl https://SEU-FFMPEG/health
# esperado: {"ok":true,"endpoints":["/render","/render-clipes"]}
```
