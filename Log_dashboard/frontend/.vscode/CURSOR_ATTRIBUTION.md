# Disattivare l'attribuzione Cursor (una tantum)

L'IDE non espone questa opzione in `settings.json`. Apri **Cursor Settings** (non VS Code):

1. `Cmd+Shift+P` → **Cursor Settings**
2. **Agents → Attribution**
3. Disattiva **Commit Attribution** e **PR Attribution**
4. Riavvia Cursor

La CLI usa `~/.cursor/cli-config.json` (attribution disattivata).

## Hook git (dopo ogni clone)

Per evitare `Co-authored-by: Cursor` nei commit fatti dall’agent:

```bash
cp scripts/git-hooks/prepare-commit-msg .git/hooks/prepare-commit-msg
chmod +x .git/hooks/prepare-commit-msg
```

## Push su GitHub

```bash
gh auth login
git push -u origin main
```
