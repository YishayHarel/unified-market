## Git Command Log (Local)

This repository includes a simple wrapper that logs every git command you run.

### What it does
- Logs timestamp, working directory, and the full command.
- Writes to `.git-commands.log` at the repo root.
- The log file is in `.gitignore` so it stays private.

### How to use it
Run git commands through the wrapper:

```bash
bash ./scripts/gitw status
bash ./scripts/gitw add .
bash ./scripts/gitw commit -m "message"
```

### Optional: make it automatic with an alias
Add this to your `~/.zshrc`:

```bash
alias git='bash /Users/yishayharel/unified-market/unified-market/scripts/gitw'
```

Then restart your terminal or run:

```bash
source ~/.zshrc
```

### Notes
- Avoid logging secrets. Do not pass API keys directly in git commands.
- The log file is local only and not tracked by git.
