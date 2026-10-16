# pi-cache-ext

A [Pi](https://github.com/earendil-works/pi) extension that creates a persistent, commit-bound structural cache for Ansible repositories. It pre-indexes playbooks, roles, tasks, handlers, templates, and variable keys into prompt context, drastically cutting LLM token usage and eliminating redundant file exploration turns.

---

## Why pi-cache-ext?

When coding agents investigate or modify Ansible infrastructure repositories, they frequently spend 5–10 initial turns running `ls`, `read`, and `grep` across dozens of YAML files just to understand:
- Which roles are included in a playbook?
- What tasks and modules are defined in a role?
- Which handlers exist?
- What configuration variables are declared?

This burns tens of thousands of tokens per session and pushes conversations toward context compaction.

`pi-cache-ext` solves this by:
1. **Commit-Bound Caching**: Checks `git rev-parse HEAD` and `git status`. If unchanged, it loads the cached state from `.pi/ansible-cache.json` instantly without re-parsing disk files.
2. **Structural Indexing**: Extracts plays, role tasks, modules, handlers, templates, files, and variable names into a dense, token-optimized summary.
3. **Secret Safe**: Never indexes variable values or secret lookup expressions. Only variable names and keys are recorded.
4. **Prompt Injection & Guideline**: Injects `<ansible_repo_cache>` into the agent's system prompt along with a guideline preventing unnecessary `read` exploration calls.
5. **Prompt Caching Friendly**: Stable prefix structure makes it eligible for provider prompt caching (up to 90% cost reduction on Anthropic and OpenAI).

---

## Repository Structure

```text
pi_cache_ext/
├── src/
│   ├── index.ts          # Pi extension registration & command handlers
│   ├── git.ts            # Git HEAD, status hash, and repo detection
│   ├── extractor.ts      # YAML structural parser (safe, secret-redacting)
│   ├── cache.ts          # Persistent cache IO (.pi/ansible-cache.json)
│   ├── formatter.ts      # Token-dense markdown formatter
│   └── types.ts          # Cache schema and summary interfaces
├── extensions/
│   └── ansible-cache.ts  # Extension entrypoint for Pi
├── tests/
│   └── extractor.test.ts # Unit tests
├── package.json
└── tsconfig.json
```

---

## Installation

### Method 1: Install as a Pi package from GitHub

```bash
pi install git:github.com/panisko/pi_cache_ext.git
```

### Method 2: Project-level extension

Copy or symlink `extensions/ansible-cache.ts` (or the compiled output) into your Ansible project's `.pi/extensions/` directory:

```bash
mkdir -p .pi/extensions
cp -r /path/to/pi_cache_ext/extensions/* .pi/extensions/
```

### Method 3: Local package link

In your project directory or global Pi configuration:

```bash
pi install /path/to/pi_cache_ext
```

---

## Commands

Inside a Pi session within any Ansible repository:

- `/ansible-cache`: Display current cache status (hit/miss, commit sha, role count, playbook count, cache size).
- `/ansible-cache rebuild`: Force re-scan of the repository and update `.pi/ansible-cache.json`.
- `/ansible-cache clear`: Remove the cached file.

---

## In-Repo Caching

The generated cache lives at `.pi/ansible-cache.json`.

You can optionally commit `.pi/ansible-cache.json` to your repository:
- Team members and CI agents pulling the latest commit will get an instant warm cache hit on turn 1.
- If uncommitted files are changed, `pi-cache-ext` automatically detects working tree modifications via `git status` and refreshes dirty components.

---

## Development & Testing

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run unit tests
npm test
```

---

## License

MIT
