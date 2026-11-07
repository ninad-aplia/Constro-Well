# Constro Well — Final MVP Deployment

**Status:** deployment-ready in the repository; no cloud account credentials exist in this environment, so no public URL has been created yet.

## Recommended zero-cost arrangement

| Piece | Provider | Plan | Why |
|---|---|---|---|
| Next.js app | Render | Free web service (0.1 CPU / 512 MB) | Docker/Node hosting, HTTPS, health checks, free while evaluating |
| PostgreSQL | Neon | Free | Permanent free plan, managed Postgres, scale-to-zero, no card |
| Repository | GitHub | Existing repo | Render deploys from it |

Checked provider terms on 2026-11-08:
- Render Free web services spin down after 15 idle minutes (about one minute cold start), have 750 free instance hours/month, and are intended for previews/hobby use.
- **Render Free Postgres expires 30 days after creation**, so do not use it for a client demo that must persist. Neon Free does not expire; it scales to zero after 5 idle minutes and includes 1 GB storage / 100 CU-hours per project.
- For an always-on client demo, use Render Starter ($7/month compute) and Neon Free/Launch. Creating paid resources requires owner approval.

## 1. Create the database (Neon)

1. Sign in at <https://neon.com> and create a project in the region closest to the demo audience.
2. Copy the **pooled** PostgreSQL connection string for the `main` branch. Do not paste it into this repository or a chat.
3. Apply the existing migrations from `app/` only:
   ```bash
   cd app
   DATABASE_URL="<neon pooled connection string>" npx prisma migrate deploy
   ```
   Never use `prisma db push`, `prisma migrate reset`, or `prisma migrate dev` against the cloud database.

## 2. Seed demo data (optional, explicit approval required)

`npm run db:seed` creates demo accounts, catalogue, offers and orders. It must only run against a database that is meant to be a demo and only with owner approval:
```bash
cd app
DATABASE_URL="<neon connection string>" DEMO_PASSWORD="<demo password>" npm run db:seed
```
Do not seed an existing client database. If demo data is not wanted, skip this step; the catalogue will be empty until sellers add products through the application.

## 3. Deploy the app (Render)

1. Push this branch to GitHub **only after owner approval**.
2. In Render, choose **New → Blueprint** and select the repository. The committed `render.yaml` creates a Node web service in `app/`.
3. Set these environment variables in the Render dashboard:
   - `DATABASE_URL` — the Neon pooled connection string.
   - `APP_ORIGIN` — the Render public URL, e.g. `https://constro-well.onrender.com` (set after the first deploy and redeploy).
   - `OTP_ENCRYPTION_KEY` — Render generates a random value from `render.yaml`. **Keep it stable**; changing it makes existing customer OTP ciphertext unreadable. If setting it manually, use a fresh 32-byte base64 value, never the local development key.
   - `NODE_ENV=production` and `NODE_VERSION=22` are set by the blueprint.
4. Deploy. The build runs:
   ```text
   npm ci && npx prisma generate && npm run build
   npm start
   ```
5. Verify `https://<service>/api/health` returns `{"status":"ok","database":"ok"}`. The health endpoint now checks PostgreSQL.

## 4. HTTPS and cookies

- Render terminates TLS and serves HTTPS automatically.
- `APP_ORIGIN` must exactly match the public HTTPS origin so state-changing requests pass the origin check.
- Session cookies are `Secure` automatically because `NODE_ENV=production`.

## 5. Required environment checklist

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Neon pooled URL; secret |
| `APP_ORIGIN` | Yes | Public HTTPS origin |
| `OTP_ENCRYPTION_KEY` | Yes | 32-byte base64; stable across deploys; secret |
| `NODE_ENV` | Yes | `production` |
| `NODE_VERSION` | Yes on Render | `22` |
| `DEMO_PASSWORD` | Seed only | Never needed at runtime |
| `SESSION_SECRET` | Not read by current code | Reserved |

Never commit `.env`, connection strings, or generated keys.

## 6. Post-deployment smoke test

1. Open the public URL; confirm the homepage and catalogue load.
2. Register a disposable customer; add offers from two sellers; complete checkout.
3. Log in as a seller, accept/pack/dispatch the shipment.
4. Log in as a driver, complete delivery with the customer OTP.
5. Confirm the customer order shows the delivered state.
6. Confirm `/api/health` still reports `database: ok`.
7. Restart the Render service and confirm orders/messages persist (they live in Neon, not the container).

## 7. Owner actions still required

- Approve pushing this branch to GitHub.
- Create/authorise the Render and Neon accounts (or provide an existing deployment target).
- Approve any paid plan. The zero-cost path is Render Free + Neon Free; Render Free has cold starts and is not a production SLA.
- Approve whether demo seed data should be loaded.
- Set `DATABASE_URL`, `APP_ORIGIN` and (if not using Render-generated) `OTP_ENCRYPTION_KEY` in the host dashboard.
- Run `prisma migrate deploy` once against the managed database.
