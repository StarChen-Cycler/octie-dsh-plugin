# Troubleshooting Guide

This guide covers common issues and their solutions when using Octie.

## Table of Contents

- [Installation Issues](#installation-issues)
- [CLI Command Errors](#cli-command-errors)
- [File Permission Issues](#file-permission-issues)
- [Graph Issues](#graph-issues)
- [Import/Export Issues](#importexport-issues)
- [Performance Issues](#performance-issues)
- [Web UI Issues](#web-ui-issues)
- [Data Recovery](#data-recovery)

## Installation Issues

### "octie: command not found"

**Problem**: After installing, the `octie` command is not recognized.

**Solutions**:

1. **Global installation not in PATH**:
   ```bash
   # Reinstall globally
   npm install -g octie-cli

   # Verify npm global bin path is in PATH
   npm config get prefix
   # Add to PATH if needed (add to ~/.bashrc or ~/.zshrc)
   export PATH="$(npm config get prefix)/bin:$PATH"
   ```

2. **Windows PATH issue**:
   ```powershell
   # Check npm global path
   npm config get prefix

   # Add to System PATH via System Properties > Environment Variables
   ```

3. **Use npx instead**:
   ```bash
   npx octie --help
   ```

### "Cannot find module" errors

**Problem**: Module not found when running octie.

**Solutions**:

```bash
# Clear npm cache
npm cache clean --force

# Reinstall
npm uninstall -g octie-cli
npm install -g octie-cli

# Or for local development
cd octie
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Node.js version issues

**Problem**: Octie requires Node.js >= 20.0.0.

**Solutions**:

```bash
# Check current version
node --version

# Use nvm to switch versions
nvm install 20
nvm use 20

# Or install Node.js 20+ from nodejs.org
```

### DSH plugin installs as a plain dependency ("declares no dsh.bundle")

**Problem**: After `dsh plugin --profile web add octie-cli`, DSH prints:

```
dsh: warning: octie-cli declares no dsh.bundle — installed as a plain dependency, not a profile layer
```

and the Octie task panel / tools never activate. You may also see `404` on
`/api/octie/*` (see [the Web UI section](#ds-panel-404s-on-apioctie)).

**Cause**: A **stale global `octie-cli` (< 1.2.0)** shadows the profile-local
install. DSH resolves bundles **installation-anchor first** (the global
`node_modules`, then the profile directory). If an older `octie-cli` sits in the
global tree — from before it declared `dsh.bundle` — DSH reads *that* manifest,
finds no `dsh.bundle`, and treats the package as a plain library even though the
correct 1.2.0 is installed in the profile.

**Solution**:

```bash
# 1. Remove the stale global (and any global < 1.2.0)
npm uninstall -g octie-cli

# 2. Re-run the plugin add so DSH reconciles the bundle layer
dsh plugin --profile web add octie-cli

# 3. Confirm it is now a layer, not a plain dependency
dsh --profile web --dump-config | grep -i octie
#   should show:  - id: octie-dsh / name: octie-cli
```

### Correct way to install/update both the CLI and the DSH plugin

Octie ships as **two parallel interfaces over the same task-graph store**: the
standalone `octie` CLI and the `octie-cli` DSH bundle plugin. They share the npm
package name but are installed differently — and **both must be ≥ 1.2.0**.

```bash
# ── Standalone CLI (terminal + octie serve web UI) ──────────────
npm install -g octie-cli@1.2.0     # or: npm update -g octie-cli

# ── DSH bundle plugin (agent drives the graph in-session) ──────
dsh plugin --profile web add octie-cli
dsh plugin --profile web update octie-cli    # to bump later

# Restart DSH after install/update, then pick "Octie 任务图模式".
```

**Keep them version-aligned.** If the global CLI is ever *older* than the
version that first declared `dsh.bundle` (1.2.0), it will shadow the DSH plugin
and silently disable it (see the pitfall above). Update the global CLI whenever
you update the plugin:

```bash
npm update -g octie-cli && dsh plugin --profile web update octie-cli
```

## CLI Command Errors

### "Project not initialized"

**Problem**: Running commands in a directory without `.octie/` folder.

**Solution**:

```bash
# Initialize project first
octie init

# Or specify project path
octie list --project /path/to/project
```

### "Task not found: xxx"

**Problem**: Referenced task ID doesn't exist.

**Solutions**:

1. **Verify task ID**:
   ```bash
   # List all tasks to find correct ID
   octie list
   ```

2. **Task was deleted**:
   ```bash
   # Check if task exists
   octie get <task-id>
   ```

### "Invalid task data: Title is required"

**Problem**: Missing required fields when creating a task.

**Solution**:

```bash
# Use interactive mode for guided input
octie create --interactive

# Or provide all required fields
octie create \
  --title "Your task title" \
  --description "Description with at least 50 characters explaining what this task does" \
  --success-criterion "Measurable criterion 1" \
  --success-criterion "Measurable criterion 2" \
  --deliverable "Expected output file or artifact"
```

### "AtomicTaskViolationError: Title is too vague"

**Problem**: Task title doesn't meet atomic task requirements.

**Solutions**:

```bash
# ❌ Bad: Vague titles
octie create --title "Fix stuff"
octie create --title "Do things"
octie create --title "Various updates"

# ✅ Good: Specific titles with action verbs
octie create --title "Implement login endpoint"
octie create --title "Fix NPE in AuthService"
octie create --title "Add password validation to signup"
```

### "Status transition not allowed"

**Problem**: Invalid status change (e.g., completed -> not_started).

**Solution**:

Valid status transitions:
- `not_started` → `pending`, `in_progress`
- `pending` → `in_progress`, `blocked`
- `in_progress` → `completed`, `blocked`
- `blocked` → `in_progress`, `pending`
- `completed` → (no outgoing transitions)

```bash
# If you need to "undo" a completion, delete and recreate the task
octie delete <task-id> --force
octie create --interactive
```

## File Permission Issues

### "Permission denied" writing to .octie/

**Problem**: Cannot write to project directory.

**Solutions**:

```bash
# Check permissions
ls -la .octie/

# Fix permissions (Unix/macOS)
chmod -R u+rw .octie/

# Fix ownership
chown -R $(whoami) .octie/
```

### "EACCES" errors on global install

**Problem**: Cannot write to npm global directory.

**Solutions**:

```bash
# Option 1: Use nvm (recommended)
# nvm handles permissions correctly

# Option 2: Change npm prefix
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
# Add to ~/.bashrc or ~/.zshrc:
export PATH=~/.npm-global/bin:$PATH

# Option 3: Use sudo (not recommended)
sudo npm install -g octie-cli
```

## Graph Issues

### "Circular dependency detected"

**Problem**: Graph contains cycles, preventing topological sort.

**Solutions**:

1. **View cycle details**:
   ```bash
   octie graph cycles
   ```

2. **Find affected tasks**:
   ```bash
   octie graph cycles --verbose
   ```

3. **Break the cycle**:
   ```bash
   # Remove one edge from the cycle
   octie update <task-id> --remove-blocker <blocker-id>

   # Or use graph validation
   octie graph validate
   ```

4. **Understand the cycle**:
   - Cycles mean task A depends on B, B depends on C, C depends on A
   - This is logically impossible to complete
   - Remove the least critical dependency

### "Self-loop detected"

**Problem**: Task depends on itself.

**Solution**:

```bash
# Remove self-reference
octie update <task-id> --remove-blocker <task-id>
octie update <task-id> --remove-dependency <task-id>
```

### "Orphan tasks found"

**Problem**: Tasks with no connections to other tasks.

**Analysis**:
- Orphans aren't always problems
- They might be standalone tasks
- Or they might be missing connections

**Solution**:

```bash
# View orphans
octie graph validate

# Connect if needed
octie update <orphan-id> --add-blocker <parent-id>
```

## Import/Export Issues

### "Invalid JSON in import file"

**Problem**: Imported file has malformed JSON.

**Solutions**:

1. **Validate JSON syntax**:
   ```bash
   # Use a JSON validator
   cat import.json | python -m json.tool > /dev/null

   # Or use jq
   jq . import.json
   ```

2. **Check for common issues**:
   - Trailing commas
   - Missing quotes around keys
   - Single quotes instead of double quotes
   - Unescaped special characters

### "Missing required fields in imported task"

**Problem**: Imported tasks don't have required fields.

**Solution**:

Ensure imported tasks have:
- `title` (1-200 chars)
- `description` (50-10000 chars)
- `success_criteria` (array with at least 1 item)
- `deliverables` (array with at least 1 item)

```json
{
  "title": "Task title",
  "description": "Task description with enough detail (min 50 chars)",
  "success_criteria": [{"id": "...", "text": "...", "completed": false}],
  "deliverables": [{"id": "...", "text": "...", "completed": false}]
}
```

### "File path does not exist"

**Problem**: Export path directory doesn't exist.

**Solution**:

```bash
# Create directory first
mkdir -p /path/to/output

# Then export
octie export --output /path/to/output/tasks.md
```

## Performance Issues

### Slow task listing with many tasks

**Problem**: `octie list` is slow with 1000+ tasks.

**Solutions**:

1. **Use filters**:
   ```bash
   # Filter by status (uses indexes)
   octie list --status pending

   # Filter by priority
   octie list --priority top
   ```

2. **Limit output**:
   ```bash
   # Use JSON output and pipe to jq
   octie list --format json | jq '.[0:10]'
   ```

3. **Use search**:
   ```bash
   octie list --search "keyword"
   ```

### Slow graph operations

**Problem**: Graph algorithms taking too long.

**Analysis**:
- Topological sort: O(V + E)
- Cycle detection: O(V + E)
- Traversal: O(V + E)

**Solutions**:

1. **Check for cycles**:
   ```bash
   octie graph cycles
   ```
   Cycles can cause issues in some algorithms.

2. **Validate graph structure**:
   ```bash
   octie graph validate
   ```

### Large file size

**Problem**: `.octie/project.json` is very large.

**Solutions**:

1. **Archive completed tasks**:
   ```bash
   # Export completed tasks to archive
   octie export --status completed --output archive.md

   # Delete completed tasks
   octie list --status completed --format json | jq '.[].id' | xargs -I {} octie delete {} --force
   ```

2. **Use JSON output and compress**:
   ```bash
   octie export --format json | gzip > tasks.json.gz
   ```

## Web UI Issues

### "Port 3456 already in use"

**Problem**: Default port is occupied.

**Solution**:

```bash
# Use different port
octie serve --port 3001

# Or kill process using port
# macOS/Linux
lsof -i :3456
kill -9 <PID>

# Windows
netstat -ano | findstr :3456
taskkill /PID <PID> /F
```

### "Cannot connect to API"

**Problem**: Web UI can't reach the API server.

**Solutions**:

1. **Check server is running**:
   ```bash
   curl http://localhost:3456/health
   ```

2. **Check CORS settings**:
   - Server allows `*` origin by default
   - Check browser console for CORS errors

3. **Firewall issues**:
   ```bash
   # Allow port through firewall
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /path/to/node

   # Linux
   sudo ufw allow 3456
   ```

### DSH panel 404s on `/api/octie/*`

**Problem**: In the DSH web app, the Octie panel's XHR requests to
`/api/octie/projects`, `/api/octie/events`, etc. return `404 Not Found`, and the
panel fails to load (`client.js:59` — cannot reach the events stream).

**Cause**: The Octie Node half probes the optional `webServer` service with a
**strict** `ctx.get('webServer')`. Cordis's strict lookup only returns a service
whose providing fiber is *already active*; the DSH webserver activates late in
the composition, so the probe yields `undefined` even when the server is
present. The `if (webServer !== undefined && …)` guard then silently skips all
five `/api/octie/*` route registrations, and the SPA fallback answers `404`.

**Solution**: Fixed in `plugin/index.mjs` (non-strict lookup,
`ctx.get('webServer', false)`). Upgrade the plugin:

```bash
dsh plugin --profile web update octie-cli
# then restart dsh web and refresh the panel
```

### The bundled "Octie 任务图模式" preset is stale after an update

**Problem**: After `dsh plugin --profile web update octie-cli`, the local copy of
the bundled agent preset (`$DSH_HOME/.agent-presets/octie/`) still runs the OLD
template. The plugin pre-provisions the preset on first install and **never
overwrites it afterwards** (by design: a provisioned preset is user data).

**Cause**: Preset templates are copy-once. The bundled skill and tools update
with the package; the provisioned preset files do not.

**Solution (recommended, v1.2.2+)**: Open **Settings → Octie 预设维护**. The
card compares the local copy against the bundled template (`templateVersion`
stamp + SHA-256 drift check) and offers two buttons when an update is
available: **更新到 vN** (overwrite with the bundled template — your explicit
consent is the only thing that ever overwrites) and **保持当前** (dismiss; the
card stays quiet for that template version and re-prompts on the next bump).
If you edited the local copy, the card warns that updating will overwrite your
changes.

**Manual fallback**: delete the provisioned copy and restart DSH — the plugin
re-provisions the current template on load:

```bash
rm -rf "$DSH_HOME/.agent-presets/octie"   # Windows: rmdir /s /q %DSH_HOME%\.agent-presets\octie
dsh --profile web                          # restart → re-provision
```

## Data Recovery

### "Project file corrupted"

**Problem**: `project.json` is corrupted or malformed.

**Solutions**:

1. **Restore from backup**:
   ```bash
   # List available backups
   ls -la .octie/*.bak

   # Restore latest backup
   cp .octie/project.json.bak .octie/project.json
   ```

2. **Manual repair**:
   ```bash
   # Validate JSON
   cat .octie/project.json | python -m json.tool > /dev/null

   # Find the error location
   python -m json.tool .octie/project.json > /dev/null 2>&1
   ```

3. **Start fresh**:
   ```bash
   # Backup corrupted file
   mv .octie .octie.corrupted

   # Reinitialize
   octie init
   ```

### Lost tasks after crash

**Problem**: Tasks were lost during a system crash.

**Solutions**:

1. **Check for temp files**:
   ```bash
   ls -la .octie/*.tmp*
   ```

2. **Check backups**:
   ```bash
   ls -la .octie/*.bak*
   ```

3. **Use git if available**:
   ```bash
   git checkout .octie/project.json
   ```

### Reset project

**Problem**: Want to completely reset the project.

**Solution**:

```bash
# WARNING: This deletes all data!

# Backup first
cp -r .octie .octie.backup

# Remove project
rm -rf .octie

# Reinitialize
octie init
```

---

## Getting Help

If your issue isn't covered here:

1. **Check existing issues**: https://github.com/anthropics/octie/issues
2. **Create a new issue** with:
   - Octie version (`octie --version`)
   - Node.js version (`node --version`)
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior

---

*Troubleshooting Guide Version: 1.0.0*
*Last Updated: 2026-02-16*
