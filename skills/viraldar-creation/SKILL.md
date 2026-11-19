---
name: viraldar-creation
license: Apache-2.0 (LICENSE et NOTICE à la racine du dépôt viraldar-agent)
description: Méthode de création de contenu TikTok avec le MCP viraldar, de zéro à une stratégie exécutée — comprendre le produit et sa cible, trouver dans la base viraldar les formats prouvés de sa niche (petits comptes viraux, outliers, posts où l'on demande le nom de l'app), décortiquer chaque post modèle (hook, plans, cadence, polices, orientation, voix), en reprendre la mécanique exacte avec son propre contenu, produire un carrousel ou un montage (voix off comprise) et le comparer au modèle, l'envoyer en brouillon TikTok, planifier la cadence sur un ou plusieurs comptes, produire les créneaux de son planning viraldar d'après sa stratégie, mesurer et itérer. À déclencher dès que l'utilisateur veut des idées de vidéos ou de diaporamas TikTok, une stratégie de contenu, des accroches, un calendrier de publication, faire connaître son app ou son produit sur TikTok, reproduire un post viral, ou qu'il utilise un outil viraldar (recherche dans la base, recommandés, À reproduire, stratégie, planning, idées, carrousel, montage, brouillon TikTok), ou demande « qu'est-ce que je dois produire aujourd'hui ». Triggers aussi en anglais (TikTok content strategy, hooks, slideshow, UGC, app marketing, voiceover).
---

# viraldar — de zéro à une stratégie de contenu exécutée

Ce que viraldar apporte face aux outils à « presets » (Higgsfield et autres) : **des formats prouvés par les chiffres**
d'une base de posts TikTok relevés dans la niche de l'utilisateur, pas des modèles génériques. Chaque proposition que tu
fais s'appuie sur des posts réels de la base, cités avec leurs chiffres. Une idée sans post derrière est une hypothèse,
et tu le dis.

**On copie un format qui a marché, exactement.** Le format, c'est la mécanique mesurée sur la vidéo : la forme du
hook, le nombre de plans et leur durée, les fonds, les polices, les couleurs, l'orientation, la voix, les stickers.
Son contenu (les phrases, l'idée, l'histoire, la liste, la chute) peut se reprendre aussi, tel quel ou presque, quand
il colle au produit ; seuls les **médias** du créateur ne se republient pas (sa vidéo, ses images, sa voix, sa
personne : TikTok ne recommande pas un contenu ré-uploadé). Une mécanique « adaptée » (plus lente, redressée en 9:16, sans voix, une police à la place de deux)
n'est plus le format qui a marché. D'où la règle qui commande tout le reste : **décortiquer chaque modèle avant
d'écrire une ligne.**

**Angle ou format ?** L'**angle**, c'est ce qu'on vend et à qui (pour qui, quel désir ou quelle douleur, quelle
promesse) ; le **format**, c'est le contenant : une **structure** (hook, plans ou slides, cadence, visuel, voix, et le
**support**, diaporama ou vidéo), un **déclencheur** (l'émotion qu'elle provoque : identification, révélation,
aspiration, défi, indignation, attendrissement, nostalgie…) et des **variables** (ce qui change d'un post à l'autre).
Un format porte un angle quand son déclencheur ne dépend pas de son sujet ; s'il en dépend (le chien d'une vidéo
attendrissante), le **sujet est soudé** et le format ne sort pas de sa niche. Grille complète, exemples et test des
commentaires : `references/formats.md`, « Angle ou format ». C'est une grille de lecture : la lecture est la tienne,
le chiffre (n, médianes) tranche. Dans viraldar, les champs « format » (stratégie, idées, planning) désignent le
**support** : dis « support » quand c'est de lui qu'il s'agit ; la série visée et le déclencheur visé ont leurs champs
(`format_vise`, `declencheur_vise` ; `declencheur` d'un angle). La lecture de ses posts (support, série, déclencheur,
sujet soudé, variables, angle) se fait **chez lui, par toi**, et s'enregistre validée par lui (`lire_mes_posts`) :
`references/lire-un-post.md`. Le déclencheur est un texte libre court, jamais une liste fermée.

Parle la langue de l'utilisateur. Travaille dans son dossier (`~/viraldar/<projet>/` par défaut) : tout ce que tu
décides s'écrit dans des fichiers qu'il peut relire (`fiche.md`, `modeles/`, `briefs/`, `calendrier.md`, `journal.md`).

Références, à charger quand l'étape le demande (pas toutes d'un coup) :

| fichier | quand |
|---|---|
| `references/decortiquer.md` | étape 3 et avant chaque créneau : la fiche de mécanique d'un modèle |
| `references/lire-les-stats.md` | dès que tu cites un chiffre viraldar (étapes 2, 3, 8) |
| `references/lire-un-post.md` | étape 8 et l'historique : lire ses posts (support, série, déclencheur, sujet soudé, variables, angle), le bilan croisé et le profil d'engagement |
| `references/accroches.md` | étapes 3-4, le catalogue d'accroches |
| `references/formats.md` | étapes 2-5 : angle ou format (la grille), les formats, quand les choisir, comment les produire avec nos outils |
| `references/brief.md` | étape 4, le gabarit de brief à remplir avant de produire |
| `references/production.md` | étapes 4, 5 et 8 : écrire, voix off, format et zone sûre, rendre, comparer, contrôler, varier (le process rodé, avec ses chiffres) |
| `references/calendrier.md` | étape 7, cadence et plusieurs comptes |
| `references/sources.md` | si l'utilisateur demande d'où vient une règle |

---

## Les outils du MCP viraldar

| famille | outil | ce qu'il fait |
|---|---|---|
| session | `qui_suis_je` / `connexion` / `deconnexion` | le **connecteur** se connecte dans les réglages de Claude (Connecteurs → viraldar), sans ces outils ; s'il dit que la connexion a pris fin, l'utilisateur la refait là. Le **module création** a sa propre session, qui ne sert qu'à `relever_mes_posts` et aux brouillons : `connexion` rend tout de suite un lien (et essaie de l'ouvrir) ; montre-le à l'utilisateur, qui l'ouvre dans le navigateur où il est connecté et autorise ; puis `connexion` avec `attendre: true` (1 min au plus, rappelle-le tant qu'il n'a pas fini). « Injoignable (réseau) » n'est pas une déconnexion : réessaie plus tard, sans `connexion` |
| accueil | `bienvenue` | ce que viraldar permet, en quelques lignes, avec des exemples de demandes ; au premier usage d'un client, le premier outil appelé te demande de le présenter |
| création | `ma_machine` | ce qui est installé sur l'ordinateur pour fabriquer (Chrome, ffmpeg, yt-dlp, Whisper, Remotion), à quoi sert chacun et la commande à taper pour ce qui manque ; **à appeler avant la première fabrication** |
| base | `mes_produits` / `choisir_produit` | un compte viraldar peut avoir plusieurs produits (chacun sa fiche, sa stratégie, ses mots-clés, ses posts gardés, ses idées, son planning et ses comptes TikTok) ; les outils portent sur le produit actif (`qui_suis_je` le dit) |
| base | `infos_base` | langues, règles chiffrées, date d'export ; hors quota |
| base | `chercher_posts` | recherche dans la base (mots-clés `mots_cles` / `mes_mots_cles`, mots libres, langue, format, publié depuis, vues, outlier, likes ≥ 2 %, 📲), 24 par page |
| base | `petits_comptes_viraux` | les « petits comptes viraux » (règles plus bas), pour ses mots-clés, des mots-clés ou une langue |
| base | `post` | un post : chiffres, compte, médiane du compte et son n, texte, hashtags, format, durée, 📲 (`detail: true` pour tout) |
| base | `formats_similaires` | posts proches d'un post donné (hashtags, durée) |
| base | `mots_cles` | le vocabulaire de la base (nos mots-clés de recherche TikTok et les hashtags répandus, ~7 000 termes), chaque terme avec ses posts : `commence_par` (sans rien : les plus fournis), `contient` (les termes qui contiennent un texte) et `voisins_de` / `voisins_de_mes_mots` (ceux qui reviennent sur les mêmes posts, avec leur lift) ; pour trouver les mots-clés cohérents avec son produit ; hors quota |
| base | `compte` | un compte de la base (concurrent, modèle) : abonnés, médiane de ses posts avec son n, ses posts du plus au-dessus de sa médiane au moins ; un compte absent est noté pour que viraldar le relève (jamais de recherche TikTok) |
| base | `mes_mots_cles` / `modifier_mes_mots_cles` | lire ou modifier les mots-clés de son produit : le filtre de sa niche (les thèmes ont disparu en 0.5.0) |
| base | `trier_post` / `noter_post` | garder un post (→ À reproduire), le passer ou le retirer ; noter le format et la raison |
| base | `a_reproduire` | sa liste À reproduire, avec ses notes |
| base | `ma_fiche` | sa fiche produit (produit, clients, problèmes, positionnement, angles) et son profil, dont **qui filme** |
| base | `ma_strategie` | sa stratégie : objectif (critère de conversion, cible, échéance), **angles** (pour qui, douleur, promesse, preuves, accroches, hypothèse, statut, part visée, avec leurs idées, créneaux et publiés), rythme, à éviter ; puis les repères calculés de sa niche |
| base | `modifier_ma_strategie` / `ecrire_angle` | modifier l'objectif, le rythme, ce qu'il faut éviter ; créer ou modifier un angle — **seulement avec son accord**, la version d'avant est gardée |
| base | `mon_planning` | ses plans, comptes et créneaux (aujourd'hui + 7 jours par défaut ; `a_produire` : ce qui reste à produire), chacun avec son modèle (post gardé) et/ou son idée (brief) |
| base | `maj_creneaux` | fait avancer des créneaux : statut, titre, légende, format, modèle, idée liée, **angle** ; une fois publié, son lien TikTok et sa note d'exécution (1 à 5, fixée par lui) |
| base | `modifier_plan` / `supprimer_plan` | modifier un plan (nom, début, fin, posts par jour, heures, comptes ajoutés ou retirés) ou le supprimer — **avec son accord** : sans `confirmer: true` rien ne part, la réponse dit quels créneaux partiraient ; les relevés des posts publiés restent dans l'historique, les idées dans la Bibliothèque. Créer un plan se fait sur le site (Planning → Nouveau plan) |
| mesure | `relever_mes_posts` | (sur sa machine, yt-dlp) relève les vues de ses posts publiés, **sur ses seuls comptes déclarés pour le produit**, les rattache aux créneaux publiés et garde **tous** les autres comme son historique (avant viraldar, hors planning) : la médiane de chaque compte dès le premier jour |
| mesure | `mes_posts` / `classer_mes_posts` | son historique (posts sans créneau) avec légende, chiffres et verdict ; tu **proposes** l'angle de chaque post, **il valide** (seuls les rattachements validés comptent dans `bilan`) |
| mesure | `noter_resultats` / `noter_execution` / `noter_conversions` | ses chiffres d'un post (s'il les donne), la **note d'exécution 1 à 5** qu'il fixe, ses conversions d'une période avec son critère |
| mesure | `bilan` | verdict de chaque post (indice ÷ médiane du compte, avec n), lecture de chaque angle **croisée avec l'exécution**, conversions, relevés dus — seuils arbitrés le 19/11/2026 (gagnant × 10, au-dessus × 2,7, en dessous × 0,5, à 48 h) |
| base | `mes_idees` / `ecrire_idee` | ses idées à produire (Bibliothèque → Créer) : lire, créer, modifier le brief, le statut et l'angle |
| modèle | `modele_decortiquer` | la vidéo d'un modèle analysée sur sa machine (avec son accord) : planche d'images, coupes détectées, nombre et durée des plans, orientation, transcription horodatée si Whisper est installé |
| création | `carrousel_modeles` / `carrousel_rendre` / `carrousel_apercu` | modèles HTML (citation, liste, notes, contraste, ecran, revelation, natif = texte de l'éditeur TikTok sur photo) → images au `format` du modèle (9:16, 3:4, 4:5, 1:1…) ; le texte est posé et **vérifié** dans la zone sûre du cas `zone` (`description` par défaut, `sans_description`, `pub`) ; **regarde toujours l'aperçu** |
| création | `montage_infos`, `montage_format_tiktok`, `montage_decouper`, `montage_assembler`, `montage_diaporama`, `montage_texte`, `montage_couverture` | montage ffmpeg : au `format` du modèle (9:16, 16:9, 4:3, 1:1, 2,35:1), découpe, enchaînement en **coupe franche** (le défaut) avec une **durée par plan** (`duree` ou `images` par plan, `dureePlan` / `imagesParPlan` pour une cadence commune), mouvement sur image fixe (`mouvement`, `amplitude`), diaporama vidéo, voix posée sur le montage (`dureeSurMusique` : le montage dure autant que la voix), texte à l'écran et sous-titres (SRT ou segments) dans la zone sûre, avec temps de lecture contrôlé et planche de contrôle, couverture |
| création | `montage_comparaison` | **modèle \| nous** côte à côte : planche d'images (`<slug>-comparaison.jpg`) et vidéo (`<slug>-comparaison.mp4`, son au choix) ; à livrer à chaque rendu |
| création | `remotion_detecter` / `remotion_modeles` / `remotion_rendre` | Remotion **seulement si l'utilisateur l'a** (`remotion_detecter` te dit de lui demander) ; au premier rendu, Remotion télécharge son navigateur (~100 Mo) : demande-lui avant de passer `telechargerNavigateur: true` |
| publication | `comptes_tiktok` | ses comptes TikTok reliés à viraldar et leurs droits |
| publication | `envoyer_brouillon_video` / `envoyer_brouillon_photos` | envoie dans la boîte de réception TikTok de l'utilisateur ; **il publie lui-même depuis l'app** |
| publication | `statut_brouillon` | état d'un envoi |

**Connecteur et module création** : la base, les mots-clés, la stratégie, le planning, les idées et la mesure
(`noter_*`, `bilan`) viennent du connecteur viraldar (`https://mcp.viraldar.rayvol.net/mcp`, ajouté dans Claude) ; la
fabrication (`ma_machine`, `carrousel_*`, `montage_*`, `modele_decortiquer`, `montage_comparaison`, `remotion_*`,
`relever_mes_posts`, brouillon vidéo) vient du module création, installé à part sur l'ordinateur (depuis la 0.6.0, il ne
porte plus la base par défaut). Si les outils de l'un ou de l'autre ne sont pas dans ta liste, dis ce qu'ils apportent et
qu'il les ajoute depuis viraldar → Agentique ; n'improvise pas à leur place. Les deux gardent chacun leur produit actif :
s'il en a plusieurs, donne le produit à `relever_mes_posts` (`produit`).

**Avant de fabriquer** : `ma_machine`, puis explique à l'utilisateur ce qui manque **pour sa demande** (sans ffmpeg, pas de
vidéo ; sans Whisper, on décortique les plans mais pas les paroles ; sans yt-dlp, il donne lui-même le fichier du modèle),
demande-lui ce qu'il veut installer et attends : c'est lui qui tape les commandes, viraldar n'installe rien. Ne lance pas
un travail qui échouera faute d'un programme.

Pas d'outil de synthèse vocale : la voix off vient de l'utilisateur ou d'un service qu'il choisit (`production.md`,
« Voix off »).

**Fichiers** : les outils ne lisent que les médias du **dossier de travail** (`~/viraldar` par défaut), sauf si
l'utilisateur a élargi la lecture. `connexion` et `qui_suis_je` disent où en est ce réglage. Dès l'étape 1, demande où
sont ses médias, ses polices et sa banque de contenus ; s'ils sont ailleurs, ou qu'un fichier est refusé, propose-lui
les deux voies que dit le message : les copier dans le dossier de travail, ou élargir **lui-même** la lecture (réglage
« lecture » / `VIRALDAR_LECTURE`, puis redémarrer Claude Code). Ne change jamais ce réglage à sa place.

**Jamais de recherche TikTok lancée par toi ou l'utilisateur** : la base est relevée par viraldar. Si sa niche y est
absente ou maigre, dis-le et propose qu'il le signale (sa fiche produit sert à relever sa niche) ; ne va pas chercher
sur tiktok.com à la place. Récupérer la vidéo d'**un** modèle déjà choisi, par son URL, pour l'analyser n'est pas une
recherche (étape 3).

**Quota** : la base sert ~600 posts distincts par compte et par jour, 30 appels par minute. Sois sobre : filtre côté
outil (mots-clés, langue, type, récence) plutôt que de feuilleter des pages ; 2 à 4 pages suffisent pour une étape.

**Calcul** : un traitement lourd à la fois (transcription Whisper, rendu Remotion, encodage long), même avec plusieurs
modèles ou plusieurs agents : neuf Whisper lancés ensemble ont fait tomber une machine (mémoire saturée). Mets les
modèles en file et traite-les l'un après l'autre.

---

## Le parcours

Chaque étape finit par un livrable écrit et une question à l'utilisateur. Ne saute pas l'étape 1 ; les autres peuvent se
raccourcir s'il arrive avec un besoin précis (« décortique ce post », « fais-moi un carrousel de ce brief »), jamais
l'étape 3 avant de produire.

### 1. Comprendre le produit, la cible et les ressources

S'il veut fabriquer (vidéo, carrousel, analyse d'un modèle), `ma_machine` dès cette étape : ce que la machine permet
borne les formats autant que « qui filme ».

**Sa stratégie** (`ma_strategie`) : explique-lui, s'il ne les connaît pas, les trois gestes qui la font vivre — **tester
des angles** (un par post, une seule chose qui change), **juger l'exécution** (chaque post publié noté de 1 à 5 : un
angle ne s'abandonne que sur des posts bien exécutés), **boucler** (relevés, conversions, `bilan`, décision, planning).
Un indé qui n'a jamais fait de marketing les découvre ici ; ne les saute pas. S'il confond l'angle (ce qu'il vend et à
qui) et le format (le contenant), donne-lui la grille « Angle ou format » (plus haut) avant l'étape 2.

Vérifie d'abord le produit actif (`qui_suis_je` ou `mes_produits`) : s'il y en a plusieurs et que la demande en vise
un autre, `choisir_produit` avant toute lecture ou production, et dis-le à l'utilisateur.

Lis `ma_fiche` et `ma_strategie`. Si la fiche existe, résume-la en 5 lignes et demande ce qui a changé ; si une
stratégie est rédigée, elle fixe déjà les formats, la cadence et les premiers posts : pars d'elle plutôt que de refaire
les étapes 2 et 7. Sinon, pose **en un seul message**, au plus 7 questions :

1. Que vends-tu (app, produit, service) et son lien ?
2. Pour qui, précisément (âge, situation, moment où ils en ont besoin) ? Dans quelle(s) langue(s) ?
3. Quel problème soulage-t-il, dit avec les mots de tes clients ?
4. Le compte TikTok (le @, ou « je pars de zéro ») ; compte personnel ou Entreprise ?
5. Qui peut filmer : toi face caméra, quelqu'un d'autre, personne (sans visage) ? Une voix (la tienne, une voix de
   synthèse, aucune) ? Combien de temps par semaine ?
6. As-tu une **base de contenus vérifiés** (citations sourcées de ton app, fiches, FAQ, avis clients) ? Où sont tes
   médias et tes polices ?
7. Objectif mesurable : téléchargements, inscriptions, ventes, abonnés ? Comment le mesures-tu ?

**Qui filme** (`ma_fiche`, `ma_strategie` : `sans_visage`, `moi`, `createurs`) borne tout le reste : un modèle que ses
ressources ne permettent pas de reproduire tel quel n'est pas un modèle pour lui. Sa base de contenus vérifiés, quand
elle existe, est **la** source du texte (citations, chiffres, affirmations).

Puis `mes_mots_cles` : vérifie que ses mots-clés collent à sa niche. Pour en trouver : `mots_cles` avec `contient` sur les mots de sa fiche (produit, problème, concurrents, formats qu'il veut produire), puis `voisins_de` des meilleurs (un `lift` élevé = propre à sa niche ; écarte les homonymes et les termes d'une autre langue que son public). Propose une liste courte, chaque terme avec son nombre de posts et sa raison ; `modifier_mes_mots_cles` seulement avec son accord.

**Livrable** : `fiche.md` — produit, cible, 3 à 5 douleurs dans les mots du client, ressources de production (visage,
voix, temps, captures de l'app, médias, polices), base de contenus vérifiés (chemin), objectif et mesure, mots-clés retenus.

### 2. Trouver les formats prouvés de sa niche

Commence par `petits_comptes_viraux` sur ses mots-clés (`mes_mots_cles: true`) et sa langue : ce sont les posts qui prouvent qu'**un petit compte** peut y
percer (≤ 50 k abonnés, ≥ 300 k vues, ≥ 20 × ses abonnés). Puis `chercher_posts` avec ses mots (douleurs, usages, nom des
concurrents) et les filtres : publié ≤ 90 jours, likes ≥ 2 %, outlier élevé ; un passage avec 📲 seul.

Charge `references/formats.md` (« Angle ou format »). Regroupe les posts en **formats**, pas en sujets : même
**structure** (type d'accroche, plans ou slides, cadence, visuel, voix, support) **et** même **déclencheur** (l'émotion
qu'elle provoque, lue dans les commentaires plus que dans la légende). Deux posts de même structure qui ne déclenchent
pas la même chose sont deux formats. Pour chaque format, un tableau :

| format (structure · déclencheur) | sujet soudé ? | n posts | n qui passent les critères | vues médianes (n) | outlier médian (n) | 📲 | angles qu'il peut porter | exemples (id) |
|---|---|---|---|---|---|---|---|---|

Règles (détail dans `references/lire-les-stats.md`) :
- **fiable** = au moins 3 posts du format passent les critères (≥ 100 k vues, ≤ 90 jours, likes ≥ 2 %). Moins = « à tester ».
- toute médiane ou moyenne s'écrit avec son n : « 420 k vues médianes (n = 7) ».
- préfère les formats portés par **plusieurs comptes** : 5 posts d'un seul compte prouvent ce compte, pas le format.
- un post 📲 (on demande le nom de l'app dans les commentaires) vaut plus qu'un post vu deux fois plus sans 📲.
- un post de la base à moins de 2 % de likes est souvent une vidéo poussée en pub (`post` le marque « pub ? ») : pas un
  modèle. Cette règle vaut pour les posts des autres, jamais pour ceux de l'utilisateur (il sait s'il a payé).
- **faisable tel quel** avec ses ressources, sinon écarté : face caméra, duo de podcast, conférence filmée ne sont pas
  des modèles pour un profil sans visage. On n'« adapte » pas un format infaisable, on en choisit un autre.
- **sujet soudé** hors de la niche de son produit : écarté (une vidéo de chien attendrit par le chien ; sans chien,
  plus rien). Une **preuve** soudée (le corps d'une transformation) ne se garde que s'il a une preuve visible
  équivalente pour son produit.
- **un angle à porter** : pour chaque format retenu, dis quel angle de sa stratégie (`ma_strategie`) il peut porter et
  pourquoi, par **le test des commentaires** : son produit à la place du sujet du modèle, lirait-on les mêmes réactions
  (« c'est moi », « je savais pas », « il faut que je m'y mette ») ? Le déclencheur du format doit être celui de l'angle
  (un angle d'aspiration ne se porte pas avec un format d'attendrissement). Un format qui ne porte aucun de ses angles
  n'est pas pour lui, quels que soient ses chiffres.

Propose 3 formats au plus, classés, avec pour chacun pourquoi il convient à **son** produit, à **ses** ressources et à
**quel angle**. C'est une lecture, pas une mesure : le chiffre tranche (fiable, médianes avec n, puis ses propres
résultats). Demande-lui lequel tester d'abord. `trier_post` (garder) les posts modèles, avec en note « format ·
déclencheur · soudé ou non » et l'angle visé ; l'hypothèse de l'angle (`ecrire_angle`, avec son accord) peut dire par
quel déclencheur on compte le porter.

**Livrable** : section « Formats » de `fiche.md`.

### 3. Décortiquer chaque modèle, avant d'écrire

Charge `references/decortiquer.md`. Pour **chaque** modèle (et 2 autres posts du même format quand il y en a, pour
séparer le format de ce qui tient à ce post) :

1. `post` (`detail: true`) : chiffres, légende, son, durée ou nombre de slides. La légende et les notes ne disent pas ce
   qu'il y a **dans** la vidéo : une note « citation + origine » peut décrire la légende, un « il a décrit ma vie » un mème.
2. **Voir la vidéo.** Demande à l'utilisateur s'il accepte que tu la récupères par son URL pour l'analyser sur sa
   machine ; avec son accord, `modele_decortiquer` (planche, coupes, cadence, orientation, transcription si Whisper est
   installé ; pour un diaporama, toutes ses images et leur texte : lis-les toutes, pas seulement la couverture). La vidéo reste dans `modeles/<id>/`, ne sert qu'à l'analyse et à la comparaison : elle n'entre jamais
   dans un montage, n'est jamais envoyée ni republiée. Sans son accord (ou sans l'outil) : il ouvre le post et te
   donne des captures (début, chaque changement de plan, fin) et la transcription de la voix, ou te les décrit.
3. Remplis la **fiche de mécanique** : hook transcrit mot pour mot, nombre de plans, durée d'un plan, fonds, polices et
   couleurs par rôle, orientation et ratio, voix (oui / non, type, débit), son, stickers, place du produit, puis son
   **déclencheur**, ses **variables**, si le sujet est **soudé** et les angles qu'il peut porter (test des
   commentaires). « ? » pour ce que tu ne sais pas, jamais une supposition.
4. **Faisable avec ses ressources ?** Si non (visage, lieu, objet, voix qu'il n'a pas), dis-le et propose un autre
   modèle faisable (`a_reproduire`, `petits_comptes_viraux` filtrés), au lieu d'adapter celui-ci.

**Livrable** : `modeles/<id>/mecanique.md`, avec ce qui est **le format** (à reprendre exactement : structure et
déclencheur), **les variables** (ce que son contenu remplace), **le contenu** (texte, idée : repris ou réécrit, au choix
de l'utilisateur) et **les médias** du créateur (à refaire avec les siens), montré à l'utilisateur avant le brief. Le
brief (étape 4) recopie le déclencheur et l'angle qu'il porte.

### 4. Reprendre la mécanique, et le contenu s'il colle

Charge `references/brief.md` et `references/accroches.md`. On reprend la **mécanique exacte** de la fiche (forme du
hook, nombre et durée des plans, fonds, polices, couleurs, orientation, voix, stickers, place du produit). Le texte et
l'idée du modèle se reprennent quand ils collent au produit (même liste, même histoire, mêmes phrases), sinon ils se
réécrivent depuis `fiche.md` et sa base de contenus vérifiés ; demande-lui ce qu'il préfère. Les images, la vidéo et
la voix sont les siennes.

- **Le hook garde la forme exacte du modèle** : même syntaxe, même longueur, même ponctuation et même casse. Une formule
  générique se reprend telle quelle (« Tu connais Schopenhauer ? » → « Tu connais <auteur> ? ») ; seul ce qui est propre
  au créateur change. Propose 2-3 variantes qui gardent cette forme ; d'autres types d'accroche se testent plus tard,
  une à la fois (étape 8).
- Le produit apparaît là où il apparaît dans le modèle, montré en train de servir, pas récité.
- Texte tiré de sa base de contenus vérifiés quand elle existe ; une phrase qui n'en vient pas est marquée « hors base »
  et validée par lui. Une citation est exacte au mot près, avec sa source.
- Côte à côte (étape 5, `montage_comparaison`), on doit reconnaître **le même format** ; les images, la voix et les
  séquences sont les siennes, aucune n'est tirée du fichier du modèle.

**Livrable** : un brief par post, `briefs/AAAA-MM-JJ-<format>-<n>.md`, avec la fiche de mécanique recopiée et le texte
plan par plan (ou slide par slide), validé par l'utilisateur **avant** de produire.

### 5. Produire et comparer

Charge `references/formats.md` (section production du format choisi) et `references/production.md` (§ 3 à 7).

- **Format, orientation et zone d'abord** : le ratio du modèle (`format` des outils : 9:16, 3:4, 4:5, 1:1, 16:9, 4:3,
  2,35:1) et, d'après la publication prévue (une légende ? une pub ?), la `zone` (`production.md` § 4). Un modèle en
  paysage se rend en paysage, pas recadré en 9:16.
- **Cadence** : le nombre de plans et la durée d'un plan du modèle, en coupe franche s'il coupe franc (pas de fondu
  par défaut). Un montage trois fois plus lent que son modèle n'est plus le même format.
- **Diaporama** : `carrousel_modeles` → le modèle le plus proche (texte sur photo, capture, liste…) → `carrousel_rendre`
  avec le texte validé et ses images (photos, captures de l'app). Rends, regarde `carrousel_apercu`, corrige jusqu'à
  zéro avertissement de zone.
- **Vidéo** : ses plans filmés ou ses images, assemblés par les outils `montage_*` à la cadence du modèle ; texte et
  sous-titres par `montage_texte` (avec `zone`) ; regarde la planche `-controle.jpg`. Avant de proposer Remotion,
  **demande-lui s'il l'a** ; sinon ffmpeg, sans le présenter comme un manque.
- **Voix off** si le modèle en a une (`production.md` § 3) : sa voix ou une voix de synthèse sous licence, horodatée,
  posée dans le fichier ; les sous-titres en suivent l'horodatage.
- **Son** : pas de musique dans le fichier. Le son (tendance ou celui du modèle) s'ajoute dans l'app TikTok au moment de
  publier ; un compte **Entreprise** n'a droit qu'aux sons de la bibliothèque commerciale.
- **Comparer** : `montage_comparaison` (modèle | nous) à chaque rendu, livré avec le rendu. C'est sur elle que
  l'utilisateur juge : un écart de mécanique visible se corrige avant de lui demander son avis.
- Passe les listes de contrôle ci-dessous avant de montrer le résultat.

**Livrable** : les fichiers dans `production/<id-du-brief>/`, avec `<slug>-comparaison.jpg` (et `.mp4` pour une vidéo),
montrés à l'utilisateur.

### 6. Envoyer en brouillon TikTok

Seulement quand l'utilisateur a dit « oui, envoie ». Rappelle-lui avant :
- le brouillon arrive dans sa **boîte de réception TikTok** ; il ouvre la notification, ajoute le son, vérifie la
  légende, coche « Contenu promotionnel » (mention de contenu commercial) si c'est sa marque ou un partenariat, et publie
  lui-même ; le post direct viendra plus tard ;
- TikTok refuse plus de **5 envois en attente sur 24 h** : il faut publier (ou supprimer) les brouillons pour en
  envoyer d'autres ; les diaporamas demandent une app TikTok récente.

`envoyer_brouillon_video`, puis `statut_brouillon`. Pour un diaporama : `envoyer_brouillon_photos` avec `fichiers`, les
images de `carrousel_rendre` dans l'ordre (JPEG ou WebP, 35 au plus ; elles passent quelques secondes en transit chez
viraldar, le temps que TikTok les télécharge, puis sont effacées). Rends le carrousel en `"sortie": "jpeg"` : TikTok
refuse le PNG. Un diaporama garde son titre et sa description ; une vidéo arrive en
brouillon sans légende : donne-lui la légende du brief à coller. Jamais la comparaison : elle contient le modèle.
Si l'outil renvoie une erreur (quota, jeton, compte restreint), dis-la telle quelle et n'essaie pas de la contourner.

**Livrable** : la ligne du post dans `calendrier.md` passe à « en brouillon ».

### 7. Planifier la cadence et les comptes

Charge `references/calendrier.md`. Fixe avec l'utilisateur, d'après le temps qu'il a (étape 1) :
- une cadence tenable (1 par jour bat 3 par jour pendant une semaine puis rien) ;
- la rotation : 1 format principal + 1 format en test, 2-3 variantes d'accroche par format ;
- plusieurs comptes seulement s'il le demande et s'il peut les tenir : chacun avec une identité vraie et distincte
  (angle, voix, public), jamais pour se faire passer pour des clients indépendants ni pour gonfler l'engagement.

**Les angles dans le planning** (stratégie v2) : sa stratégie liste ses angles (`ma_strategie`). Par défaut, **c'est toi
qui les répartis** dans les créneaux à créer (`maj_creneaux` avec `angle`) :
- tant qu'aucun angle n'a gagné, chaque post est un **essai** : un angle à tester, une seule chose qui change d'un post
  à l'autre (l'angle, ou l'accroche, jamais les deux), chaque angle essayé sur au moins 3 posts avant de conclure ;
- dès qu'un angle a gagné : deux essais pour une **sécurité** (l'angle gagnant, ou la variation d'un post gagnant) ;
- respecte les parts visées quand il y en a, et les angles qu'il impose : il peut tester l'angle qu'il veut, comme il
  veut ; dis-lui la répartition (« cette semaine : 4 posts sur l'angle A, 3 sur B ») avant de l'écrire ;
- une idée ou un brief porte aussi son angle (`ecrire_idee` avec `angle`). Une idée de post (« la routine du soir en
  3 étapes ») n'est pas un angle : elle **sert** un angle (une cible et sa douleur) et vit dans la Bibliothèque.
Un angle nouveau, ou modifié, passe par lui (`ecrire_angle`) ; ne réécris jamais sa stratégie sans son accord.

**Les points « à savoir » du planning qui viennent de sa stratégie** (`mon_planning`, et la réponse de `maj_creneaux`) ;
jamais bloquants, mais tu les lui dis et tu proposes quoi faire :
- **angle abandonné** sur des créneaux à venir : propose un angle en cours à la place ; s'il veut vraiment le
  reprendre, c'est `ecrire_angle` (statut « à tester ») avec son accord, pas un créneau qui le contredit en silence ;
- **angle d'un autre produit** : tu t'es trompé de produit (`qui_suis_je`) ou d'angle ; corrige le créneau ;
- **part d'un angle loin de sa part visée** (plus de 20 points d'écart, sur 10 créneaux avec angle au moins) :
  rééquilibre les créneaux à créer, ou demande-lui si la part visée doit changer (il a peut-être décidé de pousser un
  angle qui marche) ;
- **cadence au-dessus du rythme** de sa stratégie : dis-le ; c'est à lui de choisir entre alléger le plan et changer
  le rythme (`modifier_ma_strategie`) ;
- **format hors stratégie** : un modèle d'un **support** (diaporama, vidéo…) qu'aucun angle en cours ne retient ;
  garde-le seulement s'il le veut.

**Livrable** : `calendrier.md` sur 2 semaines. S'il a un plan sur viraldar (`mon_planning`), c'est **son**
calendrier : ne tiens pas un `calendrier.md` en double, travaille depuis le planning (section suivante). Les plans se
créent et se suppriment sur le site (Planning → Nouveau plan), pas par toi.

### 8. Mesurer et itérer

Charge `references/lire-les-stats.md` (section « ses propres posts »). La boucle vit dans viraldar (stratégie v2), plus
dans un `journal.md` :
0. **son historique, dès le premier jour** : `relever_mes_posts` avec `posts: 200` relève tout ce qu'il a déjà publié sur
   ses comptes (et le support des plus vus) ; **lis ses posts** (`references/lire-un-post.md`) : `mes_posts` avec le
   filtre `a_lire` donne l'ordre (gagnants, au-dessus, puis sous la médiane dans les mêmes séries) ; regarde chaque post
   ici (couverture, planche, légende, chiffres), propose support, série, déclencheur, sujet soudé, variables et angle
   (un angle de sa stratégie, ou un angle nouveau pour un groupe qui n'entre dans aucun), **montre-lui la proposition
   en tableau**, puis `lire_mes_posts` avec `valide: true` pour ce qu'il approuve (`classer_mes_posts` reste pour
   l'angle seul). `bilan` lit alors ce que chaque angle a déjà donné, séparé de ce qu'il produit avec viraldar, et la
   lecture croisée (série, déclencheur, angle × déclencheur, avec l'engagement) ; sans note d'exécution, un angle de
   l'historique sous sa médiane est « à retester », jamais « il n'attire pas » ;
1. un post publié passe à « publié » dans son planning avec son lien TikTok (`maj_creneaux`, `lien`) et son angle ; ce
   qu'il visait (série, déclencheur : `format_vise`, `declencheur_vise`) se pose dès l'idée ou le créneau, et sa lecture
   une fois publié (`lire_mes_posts`) : le bilan compare visé / obtenu ;
2. **relevés à 8 h, 48 h et 7 jours** : `relever_mes_posts` sur sa machine (ses comptes seulement), sinon ses chiffres et
   `noter_resultats` ; un post se juge à 48 h (un bon post croît encore après), à 8 h il peut seulement être déclaré gagnant ;
3. **la note d'exécution** de chaque post publié (`noter_execution`, 1 à 5 et un commentaire) : propose-la d'après la
   comparaison modèle | nous, **c'est lui qui la fixe** ; sans elle, on confond « l'angle n'attire pas » et « la copie
   n'était pas au niveau » ;
4. **ses conversions**, avec son critère (`noter_conversions`) : c'est ce qui compte pour lui ; par compte s'il a un lien
   par compte (jeton de campagne App Store, UTM Google Play, code promo) ;
5. **`bilan`** : verdict par post, lecture par angle (il porte / il n'attire pas / non concluant car mal exécuté / trop
   tôt), lecture croisée (par série, déclencheur, angle, support, angle × déclencheur ; vues ET profil d'engagement —
   likes, commentaires, enregistrements, partages, chacun rapporté à son compte et au même support —, chaque chiffre
   avec son n ; dis-le en phrases, jamais « pub » sur ses posts : il sait s'il a payé), conversions ; décide avec lui (garder, refaire l'exécution, abandonner l'angle : `ecrire_angle`), puis remets
   au planning. Les seuils du bilan sont arbitrés (19/11/2026).

Diagnostic, par format (après ≥ 3 posts du format, sinon « trop tôt ») :

| | conversions hautes | conversions basses |
|---|---|---|
| **vues hautes** | décliner : plus de variantes, plus de cadence, un 2e compte | refaire le CTA et la place du produit |
| **vues basses** | refaire l'accroche (slide 1, 3 premières secondes) ; d'abord vérifier sur la comparaison que la mécanique était bien celle du modèle | changer de format |

Avant de conclure « changer de format » ou « l'angle n'attire pas », vérifie le **déclencheur** : les commentaires de
ses posts disent-ils les mêmes réactions que sous le modèle ? Si non, la forme a été gardée et le moteur perdu (sujet
soudé, ou déclencheur qui n'est pas celui de l'angle) : c'est le choix du format qu'il faut revoir, pas l'angle.

« Haut » et « bas » se lisent par rapport à **la médiane de ses propres posts** (avec son n), pas aux chiffres de la
base. Lis aussi chaque post sur **les paliers de vues** (`lire-les-stats.md`) et dis-les à l'utilisateur : sous
10 000 vues, c'est l'accroche et l'exécution qui manquent (on les retravaille avant de juger l'angle) ; au-dessus,
la qualité est là et l'écart tient surtout à l'algorithme. Note aussi les commentaires qui demandent le nom de l'app (c'est le 📲 de son compte). Après un succès (≥ 3 × sa
médiane), refais la même accroche et la même mécanique avec un autre contenu avant de changer quoi que ce soit, **une
seule chose à la fois** ; attends-toi à ce que la variante retombe vers × 1,3 (`production.md` § 8) : c'est normal, ce
n'est pas un échec. Écris les leçons (pour, contre, statut) dans `journal.md`.
Chaque semaine : une ligne de bilan, ce qu'on garde, ce qu'on arrête, le prochain test ; reviens à l'étape 2 pour
chercher un nouveau format quand un format baisse sur 3 posts de suite.

---

## Travailler depuis le planning

Quand l'utilisateur a un plan sur viraldar (page Planning), c'est lui qui dit quoi produire, pour quel compte et pour
quand. Un créneau = un contenu, à une heure, sur un compte. Son statut suit le flux : **à créer → en production → prêt**
(c'est ton travail), puis **en brouillon → publié** (c'est le sien).

1. **Lire et vérifier.** `ma_fiche` (qui filme), `ma_strategie` (formats retenus, piliers, cadence, ce qu'il faut
   éviter), puis `mon_planning` avec `a_produire: true`. Un créneau « à créer » est un contenu qui **n'existe pas
   encore** : son modèle (le post gardé, `M1`…) dit quoi reproduire, l'idée (`I1`…) donne le brief s'il y en a un.
   **Avant de produire quoi que ce soit**, relève et montre-lui en un tableau ce qui cloche dans le lot :
   - un modèle **infaisable** avec ses ressources (face caméra, duo, conférence filmée pour un profil sans visage) ;
   - un modèle « pub ? » (likes < 2 %) ;
   - un **doublon** : même modèle, même phrase ou même auteur cité **le même jour sur plusieurs comptes** ; un même
     auteur qui revient sans cesse (4 fois en 2 jours a été relevé comme une répétition) ;
   - un écart avec la stratégie (format, cadence).
   Pour chacun, propose un remplaçant (`a_reproduire`, `mes_idees`) ; tu le lies avec `maj_creneaux` (`post`, `idee`)
   **après son accord**. Un créneau sans modèle ni idée : même chose.
2. **Décortiquer chaque modèle du lot** (étape 3) **avant** d'écrire un seul texte : `modeles/<id>/mecanique.md`,
   montré à l'utilisateur. Un modèle qui s'avère infaisable à ce stade se remplace, il ne s'adapte pas.
3. **Choisir le lot avec lui.** Dis ce que tu vas produire (« les 4 créneaux de demain : 3 diaporamas d'après M1 en 3:4,
   1 vidéo paysage en voix off d'après M2 ») et attends son « oui ».
4. **Passer « en production »** les créneaux que tu commences (`maj_creneaux`, en lot), avec leur `titre` et leur
   `format` précis. Écris le brief (étape 4) : dans `briefs/` et, pour qu'il le retrouve sur le site, dans l'idée
   (`ecrire_idee` : nouvelle idée avec `post`, `compte_cible` et `brief`, puis `maj_creneaux` avec `idee`).
5. **Produire et comparer** (étape 5), dans `production/<date>-<compte>-<créneau>/` ; montre le rendu **et** la
   comparaison, corrige.
6. **Passer « prêt »** quand les fichiers sont finis **et validés par lui**, avec la `legende` prête à coller (TikTok
   ne garde pas la légende d'un brouillon vidéo : elle se copie depuis le Planning). Dis-lui où sont les fichiers et ce
   qu'il lui reste à faire : ajouter le son, cocher « Contenu promotionnel », publier à l'heure prévue.
7. **T'arrêter là.** Tu ne publies pas et tu n'envoies rien en brouillon depuis le planning. Tu ne passes un créneau
   « en brouillon » ou « publié » que si l'utilisateur te dit l'avoir fait lui-même (un créneau publié publie aussi son
   idée). Un créneau passé et non produit : signale-le, propose de le produire ou qu'il le déplace sur le site ; ne
   change jamais une heure toi-même.

Aucun fichier ni média ne part chez viraldar : le planning ne garde que du texte (titres, légendes, briefs) et des
références ; les fichiers restent dans le dossier de travail.

---

## Listes de contrôle

**Fidélité au modèle (à chaque rendu)**
- [ ] La comparaison `montage_comparaison` (modèle | nous) est rendue et livrée avec le rendu.
- [ ] Même orientation et même ratio que le modèle (bandes noires comprises s'il en a).
- [ ] Même nombre de plans ou de slides, même durée d'un plan, mêmes transitions (coupe franche si le modèle coupe franc).
- [ ] Hook : même forme que le hook transcrit (syntaxe, longueur, ponctuation, casse), même place, même durée à l'écran.
- [ ] Mêmes fonds (nombre et nature), polices et couleurs **par rôle** (le hook n'a pas forcément la police du corps).
- [ ] Voix : présente si le modèle en a une, même type et même débit ; stickers et emojis là où le modèle en met.
- [ ] Aucun élément du contenu du modèle (phrase, image, voix, séquence) dans le nôtre.

**Accroche (avant de produire)**
- [ ] Elle tient dans les 1-3 premières secondes / la slide 1 : lisible sans le son.
- [ ] Trois couches cohérentes : l'image arrête le défilement, le texte promet, la voix (s'il y en a) ouvre une question.
- [ ] Elle crée un écart (curiosité, contradiction, enjeu) que la suite **tient** : pas de promesse trompeuse.
- [ ] Son type est noté dans le brief (catalogue `references/accroches.md`), pour mesurer par type.

**Lisibilité et zones sûres** (relevés sur de vrais téléphones, `modeles/zones-sures.json` ; `production.md` § 4)
- [ ] Le bon cas de `zone` : `description` dès que le post a une légende (vidéo comprise) — texte entre y 403 et 1382 et
      x 86 et 907 sur 1080 × 1920, et rien à gauche de x 173 entre y 864 et 1325 (avatars « aimé par ») ;
      `sans_description` pour un carrousel sans légende ; `pub` pour une publicité.
- [ ] Zéro avertissement « zone sûre » au rendu, et la planche regardée : aucun texte dans le rouge, le sujet de l'image
      hors des bandes rognées. L'interface change : vérifie aussi sur l'aperçu du brouillon.
- [ ] Texte ≥ 48 px de haut (accroche ≥ 64 px), contraste fort (contour ou bandeau), 2-3 lignes au plus par écran.
- [ ] Vidéo : un texte reste ≥ 0,25 s par mot et ≥ 2,5 s, sauf si le modèle est plus rapide (alors sa cadence) ;
      sous-titres si l'on parle, jamais au même endroit qu'un texte.
- [ ] Diaporama : une idée par slide ; le nombre du modèle ; chaque slide sauf la dernière finit sur une question ou
      une promesse.
- [ ] ≥ 720p ; le texte n'est pas collé aux bords.

**CTA**
- [ ] Un seul, adapté à l'objectif (enregistrer, commenter, suivre, « lien en bio », chercher le nom de l'app).
- [ ] Placé là où le modèle le place (souvent l'avant-dernière slide ou les 2 dernières secondes), discret.
- [ ] Le nom du produit est lisible là où on le montre (pour que « c'est quoi l'appli ? » ait une réponse).

**Conformité**
- [ ] **Mention de contenu commercial** : « Contenu promotionnel » dans TikTok quand on promeut sa propre marque,
      « Partenariat rémunéré » pour un tiers ; en France, « Publicité » ou « Collaboration commerciale » visible pendant
      toute la promotion quand un créateur est rémunéré.
- [ ] **IA** : toute image ou vidéo générée ou fortement retouchée qui paraît réelle porte le label « contenu généré par
      l'IA » ; en France, un visage ou une silhouette générés par IA portent « Image virtuelle », un visage ou une silhouette
      retouchés « Image retouchée ». Une voix de synthèse réaliste : label IA aussi.
- [ ] **Aucun média du modèle republié** : ni sa vidéo, ni ses images, ni sa voix (son texte peut être repris), ni une
      musique ajoutée au fichier ; pas de logo, de personne réelle ou de voix clonée sans droit ; la voix de synthèse a une
      licence commerciale.
- [ ] **Vrai** : citations et chiffres tirés de sa base vérifiée ou sourcés ; pas de faux témoignage, de faux client, de
      résultat inventé ; les affirmations de santé (santé mentale, sommeil, nutrition) restent prudentes.
- [ ] Plusieurs comptes : chacun tenu par une vraie personne ou une marque déclarée ; pas d'engagement croisé artificiel ;
      jamais le même contenu sur deux comptes le même jour.

---

## Ce que tu ne fais pas

- **Inventer un chiffre.** Tout chiffre vient d'un outil viraldar ou de l'utilisateur, avec sa source et son n. Les
  chiffres de praticiens cités dans les références sont des anecdotes, présentées comme telles.
- **Écrire avant d'avoir décortiqué le modèle**, ou « adapter » sa mécanique (cadence, orientation, voix, polices).
- **Adapter un modèle infaisable** avec ses ressources : on en propose un autre.
- **Republier les médias d'un post** (sa vidéo, même recadrée, ses images, sa voix) : on les refait avec les siens.
- **Récupérer la vidéo d'un modèle sans son accord**, la monter, l'envoyer ou la republier : elle sert à l'analyse et
  à la comparaison, sur sa machine.
- **Publier ou envoyer sans accord.** Aucun brouillon envoyé sans un « oui » explicite pour ce post-là ; aucune
  modification de ses mots-clés ou de sa liste À reproduire sans le lui dire ; aucun créneau marqué « en brouillon » ou
  « publié » qu'il n'a pas publié lui-même.
- **Lancer une recherche TikTok** ou aspirer la base (pas de pagination systématique).
- **Lancer des traitements lourds en parallèle** (Whisper, rendus) : un à la fois.
- **Contourner une limite** (quota viraldar, 5 brouillons en attente, erreur TikTok, compte restreint, licence d'une
  voix, réglage de lecture).
- **Promettre la viralité.** Un format fiable augmente les chances ; on le dit en ces termes.
- **Imposer Remotion** ou un outil payant : demande ce qu'il a.
