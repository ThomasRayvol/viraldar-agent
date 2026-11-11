---
name: viraldar-creation
license: Apache-2.0 (LICENSE et NOTICE à la racine du dépôt viraldar-agent)
description: Méthode de création de contenu TikTok avec le MCP viraldar, de zéro à une stratégie exécutée — comprendre le produit et sa cible, trouver dans la base viraldar les formats prouvés de sa niche (petits comptes viraux, outliers, posts où l'on demande le nom de l'app), décortiquer un post gagnant, l'adapter sans le copier, produire un carrousel ou un montage, l'envoyer en brouillon TikTok, planifier la cadence sur un ou plusieurs comptes, mesurer et itérer. À déclencher dès que l'utilisateur veut des idées de vidéos ou de diaporamas TikTok, une stratégie de contenu, des accroches, un calendrier de publication, faire connaître son app ou son produit sur TikTok, reproduire un post viral, ou qu'il utilise un outil viraldar (recherche dans la base, recommandés, À reproduire, carrousel, montage, brouillon TikTok). Triggers aussi en anglais (TikTok content strategy, hooks, slideshow, UGC, app marketing).
---

# viraldar — de zéro à une stratégie de contenu exécutée

Ce que viraldar apporte face aux outils à « presets » (Higgsfield et autres) : **des formats prouvés par les chiffres**
d'une base de posts TikTok relevés dans la niche de l'utilisateur, pas des modèles génériques. Chaque proposition que tu
fais s'appuie sur des posts réels de la base, cités avec leurs chiffres. Une idée sans post derrière est une hypothèse,
et tu le dis.

Parle la langue de l'utilisateur. Travaille dans son dossier (`~/viraldar/<projet>/` par défaut) : tout ce que tu
décides s'écrit dans des fichiers qu'il peut relire (`fiche.md`, `briefs/`, `calendrier.md`, `journal.md`).

Références, à charger quand l'étape le demande (pas toutes d'un coup) :

| fichier | quand |
|---|---|
| `references/lire-les-stats.md` | dès que tu cites un chiffre viraldar (étapes 2, 3, 8) |
| `references/decortiquer.md` | étape 3, la grille d'analyse d'un post |
| `references/accroches.md` | étapes 3-4, le catalogue d'accroches |
| `references/formats.md` | étapes 2-5, les formats, quand les choisir, comment les produire avec nos outils |
| `references/brief.md` | étape 4, le gabarit de brief à remplir avant de produire |
| `references/production.md` | étapes 4, 5 et 8 : écrire un carrousel, choisir format et zone sûre, rendre, contrôler, varier et apprendre (le process rodé, avec ses chiffres) |
| `references/calendrier.md` | étape 7, cadence et plusieurs comptes |
| `references/sources.md` | si l'utilisateur demande d'où vient une règle |

---

## Les outils du MCP viraldar

| famille | outil | ce qu'il fait |
|---|---|---|
| session | `qui_suis_je` / `connexion` / `deconnexion` | état de la session viraldar ; sans session, rien ne marche : lance `connexion` (elle ouvre le navigateur, l'utilisateur autorise) |
| base | `infos_base` | thèmes (avec leur nombre de posts), langues, règles ; hors quota : commence par là |
| base | `chercher_posts` | recherche dans la base (mots, thèmes, `mes_themes`, langue, format, publié depuis, vues, outlier, likes ≥ 2 %, 📲), 24 par page |
| base | `petits_comptes_viraux` | les « petits comptes viraux » (règles plus bas), pour ses thèmes, des thèmes ou une langue |
| base | `post` | un post : chiffres, compte, médiane du compte et son n, texte, hashtags, format, durée, 📲 (`detail: true` pour tout) |
| base | `formats_similaires` | posts proches d'un post donné (hashtags, durée) |
| base | `mes_themes` / `modifier_mes_themes` | lire ou modifier ses thèmes (étiquettes suivies) |
| base | `trier_post` / `noter_post` | garder un post (→ À reproduire), le passer ou le retirer ; noter le format et la raison |
| base | `a_reproduire` | sa liste À reproduire, avec ses notes |
| base | `ma_fiche` | sa fiche produit (produit, clients, problèmes, positionnement, angles) |
| création | `carrousel_modeles` / `carrousel_rendre` / `carrousel_apercu` | modèles HTML (citation, liste, notes, contraste, ecran, revelation, natif = texte de l'éditeur TikTok sur photo) → images 9:16, 3:4 ou 4:5 ; le texte est posé et **vérifié** dans la zone sûre du cas `zone` (`description` par défaut, `sans_description`, `pub`) ; **regarde toujours l'aperçu** avant de proposer |
| création | `montage_infos`, `montage_format_tiktok`, `montage_decouper`, `montage_assembler`, `montage_diaporama`, `montage_texte`, `montage_couverture` | montage ffmpeg : mise au format 9:16, découpe, enchaînement, diaporama vidéo, texte à l'écran et sous-titres (SRT ou segments) dans la zone sûre du cas `zone`, avec temps de lecture contrôlé et planche de contrôle, couverture |
| création | `remotion_detecter` / `remotion_modeles` / `remotion_rendre` | Remotion **seulement si l'utilisateur l'a** (`remotion_detecter` te dit de lui demander) |
| publication | `comptes_tiktok` | ses comptes TikTok reliés à viraldar et leurs droits |
| publication | `envoyer_brouillon_video` / `envoyer_brouillon_photos` | envoie dans la boîte de réception TikTok de l'utilisateur ; **il publie lui-même depuis l'app** |
| publication | `statut_brouillon` | état d'un envoi |

Pas d'outil de transcription ni de coupe des silences : les sous-titres viennent d'un SRT ou de segments que tu écris.

**Fichiers** : les outils ne lisent que les médias du **dossier de travail** (`~/viraldar` par défaut). Un fichier
refusé ailleurs : demande à l'utilisateur de l'y copier. Élargir la lecture (`VIRALDAR_LECTURE`) est **son** choix,
dans les réglages : ne le change jamais toi-même.

**Jamais de recherche TikTok lancée par toi ou l'utilisateur** : la base est relevée par viraldar. Si sa niche y est
absente ou maigre, dis-le et propose qu'il le signale (sa fiche produit sert à relever sa niche) ; ne va pas chercher
sur tiktok.com à la place.

**Quota** : la base sert ~600 posts distincts par compte et par jour, 30 appels par minute. Sois sobre : filtre côté
outil (thèmes, langue, type, récence) plutôt que de feuilleter des pages ; 2 à 4 pages suffisent pour une étape.

---

## Le parcours

Chaque étape finit par un livrable écrit et une question à l'utilisateur. Ne saute pas l'étape 1 ; les autres peuvent se
raccourcir s'il arrive avec un besoin précis (« décortique ce post », « fais-moi un carrousel de ce brief »).

### 1. Comprendre le produit et la cible

Lis `ma_fiche`. Si elle existe, résume-la en 5 lignes et demande ce qui a changé. Sinon, pose **en un seul message**,
au plus 6 questions :

1. Que vends-tu (app, produit, service) et son lien ?
2. Pour qui, précisément (âge, situation, moment où ils en ont besoin) ? Dans quelle(s) langue(s) ?
3. Quel problème soulage-t-il, dit avec les mots de tes clients ?
4. Le compte TikTok (le @, ou « je pars de zéro ») ; compte personnel ou Entreprise ?
5. Qui peut filmer : toi face caméra, quelqu'un d'autre, personne (sans visage) ? Combien de temps par semaine ?
6. Objectif mesurable : téléchargements, inscriptions, ventes, abonnés ? Comment le mesures-tu (lien, code, question
   « comment nous as-tu connus ») ?

Puis `mes_themes` : vérifie que ses thèmes collent à sa niche ; propose d'en ajouter ou d'en retirer (avec son accord).

**Livrable** : `fiche.md` — produit, cible, 3 à 5 douleurs dans les mots du client, ressources de production (visage,
temps, voix, captures de l'app), objectif et mesure, thèmes viraldar retenus.

### 2. Trouver les formats prouvés de sa niche

Commence par `petits_comptes_viraux` sur ses thèmes et sa langue : ce sont les posts qui prouvent qu'**un petit compte** peut y
percer (≤ 50 k abonnés, ≥ 300 k vues, ≥ 20 × ses abonnés). Puis `chercher_posts` avec ses mots (douleurs, usages, nom des
concurrents) et les filtres : publié ≤ 90 jours, likes ≥ 2 %, outlier élevé ; un passage avec 📲 seul.

Regroupe les posts en **formats** (même mécanique : type d'accroche + structure + support), pas en sujets. Pour chaque
format, un tableau :

| format | n posts | n qui passent les critères | vues médianes (n) | outlier médian (n) | 📲 | exemples (id) |
|---|---|---|---|---|---|---|

Règles (détail dans `references/lire-les-stats.md`) :
- **fiable** = au moins 3 posts du format passent les critères (≥ 100 k vues, ≤ 90 jours, likes ≥ 2 %). Moins = « à tester ».
- toute médiane ou moyenne s'écrit avec son n : « 420 k vues médianes (n = 7) ».
- préfère les formats portés par **plusieurs comptes** : 5 posts d'un seul compte prouvent ce compte, pas le format.
- un post 📲 (on demande le nom de l'app dans les commentaires) vaut plus qu'un post vu deux fois plus sans 📲.

Propose 3 formats au plus, classés, avec pour chacun pourquoi il convient à **son** produit et à **ses** ressources
(un format face caméra ne sert à rien à qui ne veut pas se montrer). Demande-lui lequel tester d'abord.
`trier_post` (garder) les posts modèles, avec en note le format et la raison.

**Livrable** : section « Formats » de `fiche.md`.

### 3. Décortiquer un post gagnant

Charge `references/decortiquer.md`. Prends `post` du post modèle (et 2 autres du même format, pour séparer ce qui
fait le format de ce qui tient à ce post).

Tu ne vois pas la vidéo : la base donne les chiffres, le texte, les hashtags, le son, le type et le nombre de slides ou
la durée, et des extraits de commentaires. Pour le reste, **demande à l'utilisateur** d'ouvrir le post
(`tiktok.com/@compte/video/id`) et de te donner 3 captures (première image, milieu, dernière) ou de te décrire les
3 premières secondes. Ne télécharge pas la vidéo. Remplis la grille ; marque « ? » ce que tu ne sais pas plutôt que de
le deviner.

**Livrable** : la grille remplie, dans `briefs/<format>-modele.md`, avec ce qui est **le format** (à garder) et ce qui
est **le contenu** du créateur (à ne pas reprendre).

### 4. Adapter sans copier

Charge `references/brief.md` et `references/accroches.md`. On garde la **mécanique** (type d'accroche, structure,
rythme, place du produit, support) ; on change **tout le contenu** : le texte, les images, la voix, l'histoire, viennent
du produit et des douleurs de `fiche.md`.

- Écris 5 accroches de types différents pour la même idée ; l'utilisateur en garde 2-3 (on testera les variantes).
- Le produit apparaît là où il apparaît dans le modèle (souvent la slide de « révélation », 2e ou 3e tiers), montré en
  train de servir, pas récité. Les meilleurs posts d'app parlent peu de l'app.
- Test de non-copie : si on posait les deux posts côte à côte, un spectateur dirait-il « c'est le même » ? Si oui,
  recommence. Aucune phrase, image, voix ou montage repris du modèle.

**Livrable** : un brief par post, `briefs/AAAA-MM-JJ-<format>-<n>.md`, validé par l'utilisateur **avant** de produire.

### 5. Produire

Charge `references/formats.md` (section production du format choisi) et `references/production.md` (§ 3 à 5).

- **Format et zone d'abord** : d'après la publication prévue (une légende ? une pub ?), choisis `zone` et le format
  (`production.md` § 3) et note-les dans le brief. Avec une légende, une image 9:16 perd son haut et son bas.

- **Diaporama** : `carrousel_modeles` → choisis un modèle proche du modèle étudié (texte sur photo, capture d'écran,
  liste…) → `carrousel_rendre` avec le texte slide par slide du brief et les images de l'utilisateur (photos, captures de
  l'app). `natif` donne l'allure d'un post (texte de l'éditeur TikTok sur photo). Rends, regarde `carrousel_apercu`,
  corrige jusqu'à zéro avertissement de zone.
- **Vidéo** : l'utilisateur filme d'après la liste de plans du brief (ou fournit captures d'écran / enregistrements de
  l'app) ; les outils `montage_*` assemblent, posent le texte à l'écran et les sous-titres (`montage_texte`, avec `zone`) ;
  regarde la planche `-controle.jpg` qu'il rend. Avant de proposer Remotion, **demande-lui
  s'il l'a** (sa licence, son installation) ; sinon ffmpeg, sans le mentionner comme un manque.
- **Son** : ne mets pas de musique dans le fichier. Le son (tendance ou celui du modèle) s'ajoute dans l'app TikTok au
  moment de publier le brouillon ; un compte **Entreprise** n'a droit qu'aux sons de la bibliothèque commerciale.
- Passe les listes de contrôle « Accroche », « Lisibilité et zones sûres », « CTA » et « Conformité » ci-dessous avant de
  montrer le résultat.

**Livrable** : les fichiers dans `production/<id-du-brief>/`, montrés à l'utilisateur.

### 6. Envoyer en brouillon TikTok

Seulement quand l'utilisateur a dit « oui, envoie ». Rappelle-lui avant :
- le brouillon arrive dans sa **boîte de réception TikTok** ; il ouvre la notification, ajoute le son, vérifie la
  légende, coche « Contenu promotionnel » (mention de contenu commercial) si c'est sa marque ou un partenariat, et publie
  lui-même ; le post direct viendra plus tard ;
- TikTok refuse plus de **5 envois en attente sur 24 h** : il faut publier (ou supprimer) les brouillons pour en
  envoyer d'autres ; les diaporamas demandent une app TikTok récente.

`envoyer_brouillon_video`, puis `statut_brouillon`. Pour un diaporama : `envoyer_brouillon_photos` ne prend que des
images **déjà en ligne** (JPEG ou WebP, sur un domaine vérifié par l'app) ; avec des fichiers locaux, fais-en une vidéo
(`montage_diaporama` sur les images de `carrousel_rendre`, puis `envoyer_brouillon_video`), ou laisse l'utilisateur les
poster depuis son téléphone. Rends le carrousel en `"sortie": "jpeg"` : TikTok refuse le PNG. Une vidéo arrive en
brouillon sans légende : donne-lui la légende du brief à coller.
Si l'outil renvoie une erreur (quota, jeton, compte restreint), dis-la telle quelle et n'essaie pas de la contourner.

**Livrable** : la ligne du post dans `calendrier.md` passe à « en brouillon ».

### 7. Planifier la cadence et les comptes

Charge `references/calendrier.md`. Fixe avec l'utilisateur, d'après le temps qu'il a (étape 1) :
- une cadence tenable (1 par jour bat 3 par jour pendant une semaine puis rien) ;
- la rotation : 1 format principal + 1 format en test, 2-3 variantes d'accroche par format ;
- plusieurs comptes seulement s'il le demande et s'il peut les tenir : chacun avec une identité vraie et distincte
  (angle, voix, public), jamais pour se faire passer pour des clients indépendants ni pour gonfler l'engagement.

**Livrable** : `calendrier.md` sur 2 semaines.

### 8. Mesurer et itérer

Charge `references/lire-les-stats.md` (section « ses propres posts »). Juge un post **à 48 h** et à 7 jours, jamais
avant. Demande à l'utilisateur ses chiffres (vues, likes, commentaires, partages, enregistrements, abonnés gagnés) et
ceux de son objectif (téléchargements, inscriptions, ventes) ; note-les dans `journal.md`.

Diagnostic, par format (après ≥ 3 posts du format, sinon « trop tôt ») :

| | conversions hautes | conversions basses |
|---|---|---|
| **vues hautes** | décliner : plus de variantes, plus de cadence, un 2e compte | refaire le CTA et la place du produit |
| **vues basses** | refaire l'accroche (slide 1, 3 premières secondes) | changer de format |

« Haut » et « bas » se lisent par rapport à **la médiane de ses propres posts** (avec son n), pas aux chiffres de la
base. Note aussi les commentaires qui demandent le nom de l'app (c'est le 📲 de son compte). Après un succès (≥ 3 × sa
médiane), refais la même accroche et la même mécanique avec un autre contenu avant de changer quoi que ce soit, **une
seule chose à la fois** ; attends-toi à ce que la variante retombe vers × 1,3 (`production.md` § 6) : c'est normal, ce
n'est pas un échec. Écris les leçons (pour, contre, statut) dans `journal.md`.
Chaque semaine : une ligne de bilan, ce qu'on garde, ce qu'on arrête, le prochain test ; reviens à l'étape 2 pour
chercher un nouveau format quand un format baisse sur 3 posts de suite.

---

## Listes de contrôle

**Accroche (avant de produire)**
- [ ] Elle tient dans les 1-3 premières secondes / la slide 1 : 3 à 10 mots, lisible sans le son.
- [ ] Trois couches cohérentes : l'image arrête le défilement, le texte promet, la voix (s'il y en a) ouvre une question.
- [ ] Elle parle à une personne précise (« si tu te réveilles déjà fatiguée ») plutôt qu'à tout le monde.
- [ ] Elle crée un écart (curiosité, contradiction, enjeu) que la suite **tient** : pas de promesse trompeuse.
- [ ] Son type est noté dans le brief (catalogue `references/accroches.md`), pour mesurer par type.

**Lisibilité et zones sûres** (relevés sur de vrais téléphones, `modeles/zones-sures.json` ; `production.md` § 3)
- [ ] Le bon cas de `zone` : `description` dès que le post a une légende (vidéo comprise) — texte entre y 403 et 1382 et
      x 86 et 907 sur 1080 × 1920, et rien à gauche de x 173 entre y 864 et 1325 (avatars « aimé par ») ;
      `sans_description` pour un carrousel sans légende ; `pub` pour une publicité.
- [ ] Zéro avertissement « zone sûre » au rendu, et la planche regardée : aucun texte dans le rouge, le sujet de l'image
      hors des bandes rognées. L'interface change : vérifie aussi sur l'aperçu du brouillon.
- [ ] Texte ≥ 48 px de haut (accroche ≥ 64 px), contraste fort (contour ou bandeau), 2-3 lignes au plus par écran.
- [ ] Vidéo : un texte reste ≥ 0,25 s par mot et ≥ 2,5 s ; sous-titres si l'on parle, jamais au même endroit qu'un texte.
- [ ] Diaporama : une idée par slide ; le nombre du modèle d'abord (récit : 3-4, une slide retirable est retirée ;
      liste : 8-12) ; chaque slide sauf la dernière finit sur une question ou une promesse.
- [ ] Vertical 9:16, ≥ 720p ; le texte n'est pas collé aux bords.

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
      retouchés « Image retouchée ».
- [ ] **Rien de protégé repris** : ni la vidéo, ni les images, ni la voix, ni le texte du modèle, ni une musique
      ajoutée au fichier ; pas de logo ou de personne réelle sans droit.
- [ ] **Vrai** : pas de faux témoignage, de faux client, de résultat inventé (« j'ai perdu 10 kg ») ; les affirmations
      de santé (santé mentale, sommeil, nutrition) restent prudentes et ne promettent pas de guérir.
- [ ] Plusieurs comptes : chacun tenu par une vraie personne ou une marque déclarée ; pas d'engagement croisé artificiel.

---

## Ce que tu ne fais pas

- **Inventer un chiffre.** Tout chiffre vient d'un outil viraldar ou de l'utilisateur, avec sa source et son n. Les
  chiffres de praticiens cités dans les références sont des anecdotes, présentées comme telles.
- **Copier un post.** On reprend une mécanique, jamais un contenu.
- **Publier ou envoyer sans accord.** Aucun brouillon envoyé sans un « oui » explicite pour ce post-là ; aucune
  modification de ses thèmes ou de sa liste À reproduire sans le lui dire.
- **Lancer une recherche TikTok**, télécharger des vidéos ou aspirer la base (pas de pagination systématique).
- **Contourner une limite** (quota viraldar, 5 brouillons en attente, erreur TikTok, compte restreint).
- **Promettre la viralité.** Un format fiable augmente les chances ; on le dit en ces termes.
- **Imposer Remotion** ou un outil payant : demande ce qu'il a.
