# viraldar for your agent

*[Version française](README.md)*

Plug your Claude into **viraldar**: it searches a database of viral TikTok posts collected in your niche (mostly from
small accounts, with their numbers), explains why they worked, keeps your strategy (goal, marketing angles, measurement)
and schedule with you, then builds your carousels and video edits **on your own computer**, following a proven content
method. Nothing you create is sent to viraldar.

viraldar plugs in as two parts:

| | what | how |
|---|---|---|
| **the connector** (required) | the database, your keywords, kept posts, product sheet, strategy, schedule, ideas, measurement | a URL to add in Claude: `https://mcp.viraldar.rayvol.net/mcp` |
| **the creation module** (optional) | carousels, video edits, model video analysis, comparison, your own post stats, TikTok drafts | this folder: a local MCP server (`js/index.js`, Node 22+) |

This folder also holds the **skill** `viraldar-creation` (`skills/`): the method your agent follows, also served by the
MCP server (tool `methode`, prompt `methode_viraldar`), and packaging for **Claude Code** (plugin: connector, creation
module and skill in one step) and **Claude Desktop** (`.mcpb` extension of the creation module).

You need a viraldar account (free during testing): https://viraldar.rayvol.net. Step-by-step instructions are in the
app, **Agentique** tab. Tool names and outputs are in French; your agent answers in your language.

## Install

### 1. The connector

- **Claude Desktop, claude.ai, Claude on your phone**: Settings → Connectors → Add custom connector →
  `https://mcp.viraldar.rayvol.net/mcp`. Claude opens viraldar in your browser: sign in and authorize.
- **Claude Code**: the plugin below adds it; without the plugin:
  `claude mcp add --transport http viraldar https://mcp.viraldar.rayvol.net/mcp`, then `/mcp` to sign in.

### 2. The creation module (to build on your computer)

**Claude Code** (plugin: connector, creation module and skill in one step):

```sh
claude plugin marketplace add ThomasRayvol/viraldar-agent
claude plugin install viraldar@viraldar
```

Or inside Claude Code: `/plugin marketplace add ThomasRayvol/viraldar-agent`, then `/plugin install viraldar@viraldar`.
Claude Code installs the dependencies itself (from `package-lock.json`, no install scripts). Optional settings:
`claude plugin configure viraldar@viraldar` (working folder, tool families, extra readable folders).
It also installs from the git URL: `claude plugin marketplace add https://github.com/ThomasRayvol/viraldar-agent.git`.

**Updating**: `claude plugin marketplace update viraldar`, then `claude plugin update viraldar@viraldar`, then **quit
and restart Claude Code** (every window). `/mcp` is not enough: it restarts the server of the old, still cached
version, and the new tools do not show up. Same after changing a setting (`claude plugin configure`). viraldar →
Agentique lists every connected agent with its version.

**Claude Desktop** ("viraldar création" extension): download `viraldar.mcpb` (the repository's Releases page), open it
(double-click) and click "Install". Claude Desktop ships Node: nothing else to install. In the extension settings:
working folder, tool families and extra readable folders. The method is served by the extension (tool `methode`); to
have it trigger on its own, also add the skill (`viraldar-creation.zip`) in Settings → Capabilities.

**Other MCP clients**:

```json
{ "mcpServers": { "viraldar-creation": { "command": "node", "args": ["/path/to/viraldar-agent/js/index.js"] } } }
```

after `npm ci --omit=dev` in the folder. (An npm package for `npx -y viraldar-mcp` is not published yet.)

**Without the connector**: the creation module can carry the database itself, `VIRALDAR_OUTILS=base,carrousel,montage`
("tool families" setting), as before 0.6.0.

### Also needed

Ask your agent "what's missing on my machine?": the `ma_machine` tool checks what is installed, says what each program
is for and gives the command to type for your system. viraldar installs nothing itself.

- **Chrome, Chromium, Edge or Brave** for carousels (otherwise `npx playwright install chromium`);
- **ffmpeg** for videos, optional (`brew install ffmpeg`, `winget install Gyan.FFmpeg`, `apt install ffmpeg`).

## Sign in

**The connector** signs in from Claude (Settings → Connectors → viraldar): Claude opens viraldar.rayvol.net/agent, you
sign in (Google, or email and password) and authorize. **Your password never goes through Claude.**

**The creation module** only needs a session for `relever_mes_posts` (it reads your declared accounts and records their
views, including your posts from before viraldar) and TikTok drafts. Those tools say "not connected"; your agent then calls `connexion` and gives you a
**viraldar.rayvol.net/agent** link (it also tries to open it): open it in the browser of your choice. If your browser
asks for access to devices on your local network, allow it: that is your agent, on your machine (127.0.0.1). The agent
gets its own session, stored in `~/.config/viraldar/session.json` (readable by you only); `deconnexion` revokes it.

Every connection (connector or module) is listed on viraldar.rayvol.net under the **Agentique** tab, where you can
revoke it: it can no longer renew (within 30 minutes at most). Signing out of the website does not disconnect your
agents.

## Settings

| variable | default | |
|---|---|---|
| `VIRALDAR_DOSSIER` | `~/viraldar` | where carousels and edits go; only videos in this folder can be sent as TikTok drafts |
| `VIRALDAR_OUTILS` | `carrousel,montage` | tool families to load (`publication`, `remotion`, `base` — the database locally, without the connector —, or `tout` for all): every tool costs agent context |
| `VIRALDAR_LECTURE` | — (strict) | empty: tools read **only the working folder** (copy your media there). To widen it, **your choice**: extra folders (`:`-separated, `;` on Windows), or `partout` (the whole disk except hidden folders) |
| `VIRALDAR_CHROMIUM` | — | browser path |
| `VIRALDAR_FFMPEG` | — | ffmpeg path |
| `VIRALDAR_REMOTION` | — | path to your own Remotion project (Remotion is neither shipped nor licensed here) |
| `VIRALDAR_SESSION` | `~/.config/viraldar/session.json` | |

## Security in short

Details in [SECURITY.md](SECURITY.md).

- The database is read with **your** session and **your** quotas (600 distinct posts per day, 30 calls per minute,
  shared with the website); no tool searches TikTok or stores posts on your machine.
- Post texts (descriptions, comments) are written by strangers: they reach the agent between `⟦ ⟧`, flagged as
  data, never as instructions.
- Tools only read media files (images checked by content), **only in the working folder by default**
  (`VIRALDAR_LECTURE` widens it, by your choice), never inside hidden folders (`~/.ssh`, `~/.config`…);
  they only write to the working folder; ffmpeg and Chromium run without a shell, without free-form filter
  parameters, and Chromium without network or scripts.

## Develop

```sh
npm ci            # server dependencies
npm run outils    # TypeScript and mcpb, kept apart (outils/)
npm run dev       # run from src/ (Node ≥ 22.18, type stripping)
npm run construire && npm run verifier   # js/ is committed: the plugin installs from git
npm run paquet    # construit/viraldar.mcpb
```

## License

Apache-2.0: the code, the templates and the skill (see [LICENSE](LICENSE) and [NOTICE](NOTICE)). The viraldar
database (posts, statistics, lists) is not part of it: it stays behind an account and its terms. Fonts in
`modeles/carrousel/polices/` are under the OFL (licenses alongside).
