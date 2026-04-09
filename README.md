# Virtual Bookshop Web

Frontend dashboard for the Virtual Bookshop API.

## Stack

- React 19
- TypeScript
- Vite

This setup is a strong default for your use case: fast startup, simple deployment, and easy API integration while still feeling modern.

## API Requirements

The app expects the backend API to be running locally and available at:

- http://localhost:3000

The frontend calls the backend directly at `http://localhost:3000`.
Backend CORS should allow `http://localhost:5173` during local development.

Swagger docs:

- http://localhost:3000/api-docs/

To target a different backend URL, set:

- VITE_API_BASE_URL

You now have a local env file in the project root:

- .env

Current default:

- VITE_API_BASE_URL=http://localhost:3000

Example:

```powershell
$env:VITE_API_BASE_URL="http://localhost:4000"; npm run dev
```

Customer reservation hours behavior:

- Must be positive.
- If omitted, defaults to 24 hours in the UI.
- Backend is the source of truth for max reservation-hours limits.

## Run Locally

```powershell
npm install
npm run dev
```

Open:

- http://localhost:5173

## Build

```powershell
npm run build
npm run preview
```

## Deployment (Render)

This app uses React Router with browser history. To support page refresh on nested routes (for example `/admin/catalog`), Render must rewrite all paths to `index.html`.

If deploying via blueprint, this repository already includes `render.yaml` with the required rewrite:

```yaml
routes:
	- type: rewrite
		source: /*
		destination: /index.html
```

If your Render service was created manually (without blueprint):

1. Open your service in the Render dashboard.
2. Go to Redirects/Rewrites.
3. Add a rewrite rule: source `/*` -> destination `/index.html` (Rewrite/200).

Without this rewrite, direct URL entry or browser refresh on nested pages will return a 404.

## Current Features

- Route-based pages using React Router
- Server-state caching and invalidation via TanStack Query
- Overview dashboard with health and high-level stats
- Catalog page with filter/sort table and schema-validated create form
- Reservation page with user-friendly line-item form (add/remove books)
- Admin stock page for direct stock updates and restock request creation

## Routes

- /
- /catalog
- /reservations
- /admin/stock

## Suggested Upgrade Paths

If you want to grow this into a larger production app, consider adding:

- React Router for dedicated pages
- TanStack Query for caching and request state
- Zod for request and response validation
- Playwright for end-to-end UI tests
