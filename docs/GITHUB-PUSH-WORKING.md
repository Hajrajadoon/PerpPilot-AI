# Push PerpPilot to GitHub (uses the GitHub CLI login you already have)

This is the same method that works for your DocuMind project. It reads your login from `gh` and sends it only for this one push, so no credential helper is involved.

## Step 0: one-time cleanup of the ignore file
In PowerShell:
```powershell
cd C:\Users\user\PerpPilot-AI
Get-Content .\gitignore-additions.txt | Add-Content .\.gitignore
git rm --cached gitignore-additions.txt
Remove-Item .\gitignore-additions.txt
```

## Step 1: check that no secret is included
```powershell
git add .
git status --short
```
Read the list.
- `backend/.env` must NOT appear (`backend/.env.example` is fine).
- Nothing under `Temp/` may appear.
- No `.zip` files.

If anything like that appears, stop and send me the list.

## Step 2: commit
```powershell
git commit -m "PerpPilot AI: linked-bot real orders, live market state, error boundaries, README"
```

## Step 3: push
```powershell
gh auth status
$token = gh auth token
$pair = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$token"))
git -c "http.extraheader=AUTHORIZATION: basic $pair" push origin main
Remove-Variable token, pair
```
`gh auth status` should say you are logged in to github.com as `Hajrajadoon`. If it says you are not, run `gh auth login`, choose GitHub.com, HTTPS and a web browser, and then repeat Step 3.

## Step 4: check the result
Open https://github.com/Hajrajadoon/PerpPilot-AI and confirm that:
- the README shows the logo and the diagrams
- the `feedback/` and `docs/` folders exist
- there is no `.env` file anywhere
- Settings, General: the repository is Public

## If the push is rejected
A message like "rejected" or "non-fast-forward" means GitHub already has a commit your computer does not. Do not force the push. Send me the exact message.
