# Pushing to GitHub (Windows PowerShell)

Your commit is already saved locally. GitHub rejected the push because Git has no login.
Pick ONE method.

## Method A: GitHub CLI (easiest)
```
winget install --id GitHub.cli
```
Close and reopen the terminal, then:
```
gh auth login
```
Choose: GitHub.com, HTTPS, "Yes" to authenticate Git, "Login with a web browser".
Copy the 8-character code, press Enter, paste it in the browser page, and approve.
Then:
```
git push -u origin main
```

## Method B: Personal access token
1. github.com, click your profile photo, Settings.
2. Developer settings, Personal access tokens, Tokens (classic), Generate new token (classic).
3. Name: perppilot. Expiration: 7 days. Tick the box `repo`. Generate.
4. Copy the token now (it is shown once).
5. In the terminal run `git push`. When asked for Username type `Hajrajadoon`. When asked for Password paste the TOKEN (not your GitHub password).

If it fails again with old credentials: Windows Start menu, search "Credential Manager", Windows Credentials, remove any entry starting with `git:https://github.com`, then run `git push` again.

Never paste the token into chat or into a file in the repo. Delete the token on GitHub after the hackathon.

## Check the remote
```
git remote -v
```
It should show `https://github.com/Hajrajadoon/PerpPilot-AI.git`. The repository must exist on GitHub and be public.

## Remove clutter that was committed
```
git rm --cached frontend/src/App.jsx.backup-day3 frontend/src/App.jsx.backup-layout
git rm --cached frontend/src/components/PerpTradingPanel.before-voucher.jsx frontend/src/components/PerpTradingPanel.jsx.backup frontend/src/components/PerpTradingPanel.jsx.backup-layout frontend/src/components/PerpTradingPanel.jsx.backup-rpc-fix frontend/src/components/WalletConnect.jsx.status-backup2
git rm --cached frontend/read-account-test.mjs
```
Then append the lines from `gitignore-additions.txt` to the end of your `.gitignore`, and:
```
git add .
git commit -m "Remove backup files"
git push
```
