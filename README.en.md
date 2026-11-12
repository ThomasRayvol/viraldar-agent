# viraldar for your agent

*[Version française](README.md)*

Plug your Claude into **viraldar**: it searches a database of viral TikTok posts collected in your niche (mostly from
small accounts, with their numbers), explains why they worked, then builds your carousels and video edits **on your
own computer**, following a proven content method. It also reads your viraldar strategy and schedule: it knows what
to make, for which account and when, and moves slots forward up to "ready" (you publish). Nothing you create is sent
to viraldar.

This folder holds three things, built from the same code:

- a local **MCP server** (`js/index.js`, Node 22+): the database, your strategy and schedule, carousels, video editing;
- the **skill** `viraldar-creation` (`skills/`): the method your agent follows, also served by the MCP server (tool
  `methode`, prompt `methode_viraldar`) for clients that do not read skills;
- packaging for **Claude Code** (plugin) and **Claude Desktop** (`.mcpb` extension).

You need a viraldar account (free during testing): https://viraldar.rayvol.net. Tool names and outputs are in
French; your agent answers in your language.

## Install

### Claude Code (plugin: MCP server and skill in one step)

```sh
claude plugin marketplace add ThomasRayvol/viraldar-agent
claude plugin install viraldar@viraldar
```

Or inside Claude Code: `/plugin marketplace add ThomasRayvol/viraldar-agent`, then `/plugin install viraldar@viraldar`.
Claude Code installs the
dependencies itself (from `package-lock.json`, no install scripts). Optional settings:
`claude plugin configure viraldar@viraldar` (working folder, tool families, extra readable folders).
It also installs from the git URL: `claude plugin marketplace add https://github.com/ThomasRayvol/viraldar-agent.git`.

### Claude Desktop (extension)

Download `viraldar.mcpb` (the repository's Releases page), open it (double-click) and click "Install". Claude Desktop ships Node: nothing else to
install. In the extension settings: working folder, tool families and extra readable folders. The method is served by the extension (tool
`methode`); to have it trigger on its own, also add the skill (`viraldar-creation.zip`) in Settings → Capabilities.

### Other MCP clients

```json
{ "mcpServers": { "viraldar": { "command": "node", "args": ["/path/to/viraldar-agent/js/index.js"] } } }
```

after `npm ci --omit=dev` in the folder. (An npm package for `npx -y viraldar-mcp` is not published yet.)

### Also needed

- **Chrome, Chromium, Edge or Brave** for carousels (otherwise `npx playwright install chromium`);
- **ffmpeg** for videos, optional (`brew install ffmpeg`, `winget install Gyan.FFmpeg`, `apt install ffmpeg`).

## Sign in

Tell your agent "connect to viraldar". It opens **viraldar.rayvol.net/agent** in your browser; you sign in (Google,
or email and password) and authorize the agent. **Your password never goes through the agent.** The agent gets its
own session, separate from your browser's, stored in `~/.config/viraldar/session.json` (readable by you only).
`deconnexion` revokes it. Every connected agent is listed on viraldar.rayvol.net under
the **Ton agent** tab, where you can revoke it: the agent can no longer renew its session and asks you to
reconnect it (within 30 minutes at most).

## Settings

| variable | default | |
|---|---|---|
| `VIRALDAR_DOSSIER` | `~/viraldar` | where carousels and edits go; only videos in this folder can be sent as TikTok drafts |
| `VIRALDAR_OUTILS` | `base,carrousel,montage` | tool families to load (`publication`, `remotion`, or `tout` for all): every tool costs agent context |
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
