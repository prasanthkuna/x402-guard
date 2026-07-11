# Publishing x402-guard

## Verify locally

```powershell
cd x402-guard
npm install
npm run build
npm run test
cd packages\middleware-go; go test ./...
```

## Push to GitHub

```powershell
git add .
git commit -m "feat: initial x402-guard — fail-closed policy for x402 agent payments"
gh repo create prasanthkuna/x402-guard --public --source=. --remote=origin --push
```

If the repo already exists:

```powershell
git remote add origin https://github.com/prasanthkuna/x402-guard.git
git branch -M main
git push -u origin main
```

## npm (after GitHub)

1. Create npm org `@x402-guard` at https://www.npmjs.com/org/create
2. Add repo secret `NPM_TOKEN` (Automation token with publish scope)
3. Tag release — workflow `.github/workflows/release.yml` publishes all packages:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

Or publish manually:

```powershell
npm login
npm publish -w @x402-guard/core --access public
npm publish -w @x402-guard/policy --access public
npm publish -w @x402-guard/receipts --access public
npm publish -w @x402-guard/middleware --access public
```

## Sibling repos

Open `C:\Users\PrashanthKuna\agentpay.code-workspace` for railguard-new + coinbase + x402-guard together.

`railguard-new/sdk` uses `file:../../x402-guard/packages/*` — CI checks out both repos as siblings.
