# Encore

*The songs, films and places that still bring them back.*

Encore is a care-team agent for dementia and elder care. It turns a family's memory of what someone loved into familiar, culturally grounded activities, using [Qloo](https://www.qloo.com/)'s taste graph, and it learns from how each person responds. Encore supports engagement and person-centered activities; it is not a medical tool.

> Work in progress for the Qloo Agentic Hackathon. This README will grow with the product.

## Run it locally

Requirements: Node.js 22.19 or newer, and a Qloo hackathon API key.

```bash
npm install --global @qloo/qloo-harness            # Qloo's official harness (provides `qloo mcp`)
qloo config set base-url https://hackathon.api.qloo.com   # hackathon keys don't work against production
cp .env.example .env                                 # then fill in QLOO_API_KEY and GROQ_API_KEY
npm install
npm run dev                                          # http://localhost:8080/api/health
npm test
```

## Run it with Docker

```bash
docker build -t encore .
docker run -p 8080:8080 --env-file .env encore
```

Encore needs a long-running server: Qloo's harness runs as a local MCP process, so serverless platforms are not supported.

## Health checks

| Endpoint | Checks | Uses Qloo quota |
|---|---|---|
| `/api/health` | The server is running | No |
| `/api/health/qloo` | The Qloo harness is connected and the credential is present | No |
| `/api/health/qloo/live` | One real, cached Qloo request succeeds | Once, then cached |

## Feasibility findings

See [docs/spike.md](docs/spike.md) for the day-one Qloo findings and the music-era fix.

## License

[MIT](LICENSE)
