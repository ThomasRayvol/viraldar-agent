# viraldar pour ton agent

*[English version](README.en.md)*

Branche ton Claude sur **viraldar** : il cherche dans une base de posts TikTok viraux relevés dans ta niche (surtout
de petits comptes, avec leurs chiffres), te dit pourquoi ils ont marché, puis fabrique tes carrousels et tes montages
**sur ton ordinateur**, en suivant une méthode de création éprouvée. Rien de ce que tu crées n'est envoyé chez
viraldar.

Ce dossier contient trois choses, construites depuis le même code :

- un **serveur MCP** local (`js/index.js`, Node 22 ou plus) : la base, les carrousels, le montage ;
- le **skill** `viraldar-creation` (`skills/`) : la méthode que suit ton agent, aussi servie par le MCP (outil
  `methode`, prompt `methode_viraldar`) pour les clients qui ne lisent pas les skills ;
- l'emballage pour **Claude Code** (plugin) et **Claude Desktop** (extension `.mcpb`).

Il te faut un compte viraldar (gratuit pendant les tests) : https://viraldar.rayvol.net.

## Installer

### Claude Code (plugin : MCP et skill d'un coup)

```sh
claude plugin marketplace add ThomasRayvol/viraldar-agent
claude plugin install viraldar@viraldar
```

Ou dans Claude Code : `/plugin install viraldar --marketplace ThomasRayvol/viraldar-agent`. Claude Code installe lui-même
les dépendances (d'après `package-lock.json`, sans script). Réglages facultatifs :
`claude plugin configure viraldar@viraldar` (dossier de travail, familles d'outils, lecture de fichiers en plus).
On peut aussi l'installer par l'URL git : `claude plugin marketplace add https://github.com/ThomasRayvol/viraldar-agent.git`.

### Claude Desktop (extension)

Télécharge `viraldar.mcpb` (page Releases du dépôt), ouvre-le (double-clic) et clique sur « Installer ». Claude Desktop fournit Node : rien
d'autre à installer. Dans les réglages de l'extension : le dossier de travail, les familles d'outils et la lecture de fichiers en plus. La méthode est
servie par l'extension (outil `methode`) ; pour qu'elle se déclenche seule, ajoute aussi le skill
(`viraldar-creation.zip`) dans Réglages → Capacités.

### Autres clients MCP

```json
{ "mcpServers": { "viraldar": { "command": "node", "args": ["/chemin/vers/viraldar-agent/js/index.js"] } } }
```

après `npm ci --omit=dev` dans le dossier. (Un paquet npm, pour `npx -y viraldar-mcp`, n'est pas encore publié.)

### Ce qu'il faut en plus

- **Chrome, Chromium, Edge ou Brave** pour les carrousels (sinon `npx playwright install chromium`) ;
- **ffmpeg** pour les vidéos, facultatif (`brew install ffmpeg`, `winget install Gyan.FFmpeg`, `apt install ffmpeg`).

## Se connecter

Dis à ton agent « connecte-toi à viraldar ». Il ouvre **viraldar.rayvol.net/agent** dans ton navigateur ; tu te
connectes (Google, ou e-mail et mot de passe) et autorises l'agent. **Ton mot de passe ne passe jamais par l'agent.**
L'agent reçoit une session à lui, distincte de celle de ton navigateur, gardée dans `~/.config/viraldar/session.json`
(lisible par toi seul). `deconnexion` la révoque.

## Réglages

| variable | défaut | |
|---|---|---|
| `VIRALDAR_DOSSIER` | `~/viraldar` | où ranger carrousels et montages ; seules les vidéos de ce dossier peuvent partir en brouillon TikTok |
| `VIRALDAR_OUTILS` | `base,carrousel,montage` | familles d'outils chargées (`publication`, `remotion`, ou `tout`) : chaque outil pèse sur le contexte de l'agent |
| `VIRALDAR_LECTURE` | — (lecture stricte) | vide : les outils ne lisent **que le dossier de travail** (copie-y tes médias). Pour élargir, **ton choix** : des dossiers en plus (séparés par `:`, `;` sous Windows), ou `partout` (tout le disque, sauf les dossiers cachés) |
| `VIRALDAR_CHROMIUM` | — | chemin du navigateur |
| `VIRALDAR_FFMPEG` | — | chemin de ffmpeg |
| `VIRALDAR_REMOTION` | — | chemin d'un projet Remotion (le tien : ni fourni ni sous licence ici) |
| `VIRALDAR_SESSION` | `~/.config/viraldar/session.json` | |
| `VIRALDAR_SUPABASE_URL`, `VIRALDAR_SUPABASE_ANON_KEY`, `VIRALDAR_SITE_URL`, `VIRALDAR_ORIGINES_AGENT` | ceux de viraldar | pour les essais seulement |

## Sécurité, en bref

Le détail est dans [SECURITY.md](SECURITY.md).

- La base se lit avec **ta** session et **tes** quotas (600 posts distincts par jour, 30 appels par minute, partagés
  avec le site) ; aucun outil ne cherche sur TikTok ni ne garde de post sur ta machine.
- Les textes des posts (descriptions, commentaires) sont écrits par des inconnus : ils arrivent à l'agent entre
  `⟦ ⟧`, marqués comme des données, jamais comme des consignes.
- Les outils ne lisent que des médias (vérifiés par leur contenu pour les images), **par défaut dans le dossier de
  travail seulement** (`VIRALDAR_LECTURE` l'élargit, par ton choix), et jamais dans un dossier caché (`~/.ssh`,
  `~/.config`…) ; ils n'écrivent que dans le dossier de travail ; ffmpeg et Chromium sont lancés sans shell,
  sans paramètre libre dans les filtres, et Chromium sans réseau ni script.

## Développer

```sh
npm ci            # dépendances du serveur
npm run outils    # TypeScript et mcpb, à part (outils/)
npm run dev       # le serveur depuis src/ (Node ≥ 22.18, type stripping)
npm run construire && npm run verifier   # js/ est versionné : le plugin s'installe depuis git
npm run paquet    # construit/viraldar.mcpb
```

## Licence

Apache-2.0 : le code, les modèles et le skill (voir [LICENSE](LICENSE) et [NOTICE](NOTICE)). La base viraldar (posts,
statistiques, listes) n'en fait pas partie : elle reste derrière un compte et ses conditions. Les polices de
`modeles/carrousel/polices/` sont sous OFL (licences à côté).

---

# Référence des outils

## Chercher dans la base

Seulement dans la base déjà relevée par viraldar : aucun outil ne lance de recherche sur TikTok. Les quotas du site
s'appliquent (600 posts distincts par jour, 30 appels par minute) ; un post revu le même jour ne recompte pas.

| outil | ce qu'il fait |
|---|---|
| `infos_base` | thèmes (clés et nombre de posts), langues, règles, date d'export ; mots fréquents d'un thème |
| `chercher_posts` | recherche par mots, thèmes, langue, vues, outlier, date, taille du compte, format, 📲, avec tri |
| `petits_comptes_viraux` | les recommandés : comptes ≤ 50 k abonnés, ≥ 300 k vues et ≥ 20 × les abonnés |
| `post` | toutes les stats d'un post (id ou URL) |
| `formats_similaires` | posts aux hashtags communs et à la durée proche d'un post |
| `mes_themes` / `modifier_mes_themes` | lire ou changer Mes thèmes |
| `trier_post` / `noter_post` | garder, passer, retirer un post ; noter ce qu'on en reprend |
| `a_reproduire` | tous les posts gardés, avec leur note |
| `ma_fiche` | l'accueil et la fiche produit |

## Brouillons TikTok

Famille `publication` (`VIRALDAR_OUTILS`), pas chargée par défaut : l'app TikTok de viraldar attend sa validation. Il faut avoir relié son compte TikTok sur viraldar.rayvol.net. Les vidéos partent en brouillon : l'utilisateur les
finit dans l'app TikTok.

| outil | ce qu'il fait |
|---|---|
| `comptes_tiktok` | les comptes TikTok reliés |
| `envoyer_brouillon_video` | envoie une vidéo du dossier de travail (mp4, mov, webm) |
| `envoyer_brouillon_photos` | envoie un carrousel d'images déjà en ligne (URL publiques) |
| `statut_brouillon` | où en est un envoi |

## Montage

Module `src/creation/montage.ts`. Les outils **exécutent** ; le choix des plans, des textes et du rythme revient
à l'agent de l'utilisateur. Tout ce qui sort va dans `<dossier de travail>/montages/` (`~/viraldar/montages/` par
défaut), nommé `<nom>-<date-heure>`, sans métadonnées (`-map_metadata -1`, bitexact).

**ffmpeg** (et ffprobe) : cherché dans `VIRALDAR_FFMPEG` (chemin de ffmpeg), sinon le PATH. S'il manque, chaque
outil le dit et donne la commande d'installation de l'OS (brew, winget `Gyan.FFmpeg`, apt/dnf/pacman). Les textes
passent par libass (filtre `ass`), présent dans les versions courantes.

| outil | ce qu'il fait |
|---|---|
| `montage_infos` | durée, taille, ratio, i/s, codecs, son ; écarts au format TikTok. Sans fichier : état de ffmpeg |
| `montage_format_tiktok` | 1080×1920 9:16, H.264 High + AAC 48 kHz, 30 i/s, MP4 faststart ; `recadrer`, `flou` (fond flouté), `bandes`, `auto` ; découpe possible |
| `montage_decouper` | un passage, taille inchangée (ré-encodé, précis) |
| `montage_assembler` | plans vidéo ou image bout à bout, mis au 9:16 ; fondus `xfade` (fade, slideleft…) ; musique mixée |
| `montage_diaporama` | images (PNG d'un carrousel) → vidéo, durée par image, fondus, piste audio |
| `montage_texte` | accroches (haut, centre, bas ou `y`) et sous-titres (SRT ou segments), contour ou boîte façon TikTok, dans la zone sûre du cas `zone` ; prévient si un texte reste moins de 0,25 s par mot (2,5 s au moins) ou s'il tombe sur les sous-titres ; rend `<sortie>-controle.jpg` (une image par texte, zones tracées) si un Chromium est là (`controle: false` pour s'en passer) |
| `montage_couverture` | une image (jpg/png) à l'instant donné |
| `remotion_detecter` | trouve le projet Remotion de l'utilisateur, sinon dit à l'agent de **lui demander** |
| `remotion_modeles` | décrit nos compositions types, les copie dans `<projet>/src/viraldar/` |
| `remotion_rendre` | `remotion render` dans son projet, props JSON ; les fichiers locaux cités sont copiés dans `public/viraldar-medias/` |

**Zones sûres** : celles de `modeles/zones-sures.json` (voir plus bas), cas `description` par défaut ; centrage sur
l'axe de la zone. Les compositions Remotion les lisent aussi : `remotion_modeles` écrit
`<projet>/src/viraldar/zones-sures.ts` à chaque appel, et chaque composition prend une prop `zone`.

**Remotion** : ni fourni ni installé ici (licence payante au-delà de 3 personnes : c'est à l'utilisateur).
`VIRALDAR_REMOTION` peut donner le chemin de son projet. Les compositions types (`modeles/montage/remotion/`) :
`ViraldarTexteSurVideo` (textes animés sur vidéo, image ou fond), `ViraldarListeDefile` (titre et liste qui
défile), `ViraldarCitation` (citation mot à mot, puis l'auteur) ; 1080×1920, 30 i/s, durée tirée des props
(`props-exemples.json`). Vérifiées avec Remotion 4.0.542. Le CLI est lancé par `node` (pas de `npx`, pas de shell).

Limites : les emoji ne sont pas rendus par libass (ils le sont par Remotion) ; pas de transcription automatique
(les sous-titres viennent d'un SRT ou de segments fournis par l'agent).

## Zones sûres et formats

Un seul fichier, `modeles/zones-sures.json`, lu par `src/creation/zones.ts` (carrousels, montage, aperçu) et copié dans
le projet Remotion. Les zones sont en fractions de l'écran 9:16, par cas, chacune avec sa source et sa date ; elles
viennent de relevés sur de vrais téléphones (oct. 2026), pas de guides :

| cas | quand | texte entre (sur 1080×1920) | à éviter |
|---|---|---|---|
| `description` (défaut) | post avec légende, carrousel ou vidéo | x 86–907, y 403–1382 | avatars « aimé par » : x < 173 entre y 864 et 1325 |
| `sans_description` | carrousel sans légende | x 76–929, y 384–1536 | — |
| `pub` | publicité in-feed / Spark | x 60–1020, y 248–1233 | colonne de la pub : x > 768 sous y 822 |

Mécanisme mesuré : TikTok met l'image à la largeur de l'écran et la centre en hauteur ; avec une légende, entre la barre
d'état et le panneau de description (une image 9:16 y perd son haut et son bas). `zonePour(l, h, cas)` reporte une zone
sur n'importe quelle taille d'image ; `verifier(boites, zone)` dit ce qui en sort. On ne change une valeur qu'avec un
nouveau relevé, en gardant le pire.

`src/creation/apercu.ts` (navigateur et planche contact) est partagé par `carrousel_apercu` et la planche de contrôle
de `montage_texte`.

## Carrousels

Module `src/creation/carrousel.ts`, modèles dans `modeles/carrousel/`. Le texte et les choix créatifs viennent de
l'agent de l'utilisateur ; l'outil **rend** : un JSON décrit les diapositives, un Chromium headless (playwright-core)
en fait une image par diapositive dans `<dossier de travail>/carrousels/<nom>/` (`01.png`, `02.png`…, plus
`carrousel.json`, l'entrée, pour retoucher et relancer).

| outil | ce qu'il fait |
|---|---|
| `carrousel_modeles` | les modèles : à quoi chacun sert, les champs qu'il lit, son thème, un exemple de JSON complet |
| `carrousel_rendre` | rend le carrousel ; renvoie les chemins et des avertissements (texte coupé ou trop réduit, image introuvable) |
| `carrousel_apercu` | planche contact de toutes les diapositives en une image (renvoyée à l'agent, gardée dans `apercu.jpg`), zones couvertes par TikTok en rouge |

**Modèles** : `citation` (phrase sur photo floutée ou fond uni, Lora italique), `liste` (« X choses que… », couverture
puis un grand numéro par diapositive), `notes` (app de notes, ou carnet manuscrit avec `variante: "papier"`),
`contraste` (mythe / réalité, avant / après, deux moitiés empilées), `ecran` (capture d'app, ou interface dessinée :
cartes à cocher, bulle), `revelation` (accroche et tension, la réponse sur la dernière diapositive), `natif` (le texte
de l'éditeur de TikTok sur une photo plein cadre nette : `variante` `bandeau` — un pavé blanc par ligne —, `contour` ou
`bandeau_noir` ; l'auteur en étiquette rouge, `numero` en pastille, `position` haut / centre / bas ; réglages relevés
sur l'éditeur : TikTok Sans 560, 54-60 px, interligne 1,22-1,32).

**Format JSON** (le détail et un exemple par modèle : `carrousel_modeles`) :

```json
{
  "nom": "5-habitudes-anxiete", "modele": "liste", "format": "4:5", "sortie": "png",
  "signature": "@moncompte", "numerotation": true,
  "theme": { "fond": "#F3EEE6", "texte": "#1A1A1A", "accent": "#E4572E", "police_titre": "archivo" },
  "diapositives": [
    { "etiquette": "santé mentale", "titre": "5 habitudes qui calment l'anxiété" },
    { "titre": "Écrire ce qui tourne en boucle", "texte": "Sur papier, pas dans ta tête. **5 lignes** suffisent." },
    { "numero": false, "titre": "Enregistre pour la prochaine fois 🤍" }
  ]
}
```

Champs d'une diapositive : `etiquette`, `titre`, `texte`, `liste` (`[ ]` / `[x]` = cases, `*` = carte en vedette),
`citation`, `auteur`, `date`, `numero`, `image` (chemin local ou URL), `image_large`, `avant` / `apres`
(`{ etiquette, texte, image, note }`), `note`, `fond`, `position` (natif). Dans les textes : `**gras**`, `==surligné==`,
`\n`. Polices : `archivo`, `lora`, `caveat`, `tiktok` (TikTok Sans). `theme.etalonnage` (`sombre`, `chaud`, `froid`,
`noir_et_blanc`, `sepia`, `doux`) : un traitement commun à toutes les photos, pour qu'elles fassent série.
Apostrophes courbes et espaces fines insécables du français posées d'office.

- **Formats** : `9:16` (1080×1920, plein écran, par défaut), `3:4` (1080×1440, presque entier sous une légende) et
  `4:5` (1080×1350, toujours entier). TikTok prend 1 à 35 images par post photo (limite de l'API Content Posting), d'où
  35 diapositives au plus.
- **Sortie** : PNG par défaut ; `"sortie": "jpeg"` pour un envoi en brouillon par l'API, qui n'accepte que JPEG et
  WebP (1080p, 20 Mo par image). Aucune métadonnée : PNG sans bloc texte ni EXIF, JPEG avec le seul profil sRGB.
- **Zones sûres** : `"zone"` = `description` (défaut), `sans_description` ou `pub`, reportée sur le format (l'image
  s'affiche à la largeur de l'écran, centrée en hauteur). Le texte est posé dedans (il rétrécit jusqu'à 55 % s'il
  déborde), puis **chaque ligne rendue est vérifiée** contre la zone et ses parties à éviter : l'outil prévient
  (`zone_verifiee`), comme sous 36 px (≈ 13 pt sur un téléphone) ou si le texte reste coupé. `carrousel_apercu` trace
  la zone (rouge : recouvert par TikTok, vert : zone du texte) sur des images de toute taille, y compris une image
  tirée d'une vidéo.
- **Rien du réseau au rendu** : polices (Archivo, Lora, Caveat, OFL, dans `modeles/carrousel/polices/`) et images
  embarquées dans la page, toute requête de la page coupée. Une image donnée par URL est téléchargée par le MCP.
- **Navigateur** : `VIRALDAR_CHROMIUM` (ou `CHROME_PATH`), sinon Chrome, Chromium, Edge ou Brave aux emplacements
  habituels de Linux, macOS et Windows, sinon le Chromium de Playwright. S'il n'y en a aucun, l'outil dit d'installer
  Google Chrome ou de lancer `npx playwright install chromium`.

Limites : pas d'autre police que les quatre embarquées (les emoji viennent de la police emoji du système) ; le texte
de droite à gauche n'est pas soigné ; une capture d'écran plus haute que le cadre est rognée par le bas ; un
navigateur est lancé à chaque appel (~1 s par diapositive).

## Le skill de création

`skills/viraldar-creation/SKILL.md` : la méthode que suit l'agent de l'utilisateur, de la fiche produit à l'itération (base viraldar →
formats prouvés → brief → production → brouillon → mesure). Ses références, chargées à l'étape qui les demande :
`lire-les-stats`, `decortiquer`, `accroches`, `formats`, `brief`, `production` (écrire un carrousel, choisir format et
zone sûre, rendre, contrôler, varier et apprendre : le process rodé en production, avec ses chiffres et leur n),
`calendrier`, `sources`. Les noms d'outils y sont ceux du code.
