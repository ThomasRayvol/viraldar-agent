# Lire un post : support, série, déclencheur, sujet soudé, variables, angle

Les mêmes mots partout : la stratégie (l'angle et son déclencheur attendu), l'idée et le créneau (la série et le
déclencheur visés), les posts publiés (la lecture). Le bilan peut alors dire **quoi** a marché, pas seulement combien.

**La lecture est la tienne, sur la machine de l'utilisateur.** viraldar ne lit rien : ni IA, ni OCR, ni image gardée.
Tu regardes, tu proposes, **l'utilisateur valide** ; seule la lecture validée compte dans `bilan`.

## Les champs

| champ | ce que c'est | comment le lire |
|---|---|---|
| support | diaporama ou vidéo — un fait | `relever_mes_posts` le relève (`supports`) ; sinon ce que tu vois |
| série (format) | la structure reconnaissable, en quelques mots : « ma psy m'a dit », « dialogue sur un tableau », « visage + texte : situation → « Pourtant… » → citation » | la couverture et les premières secondes ; **les mêmes mots** pour tous les posts de la série |
| déclencheur | l'émotion que la structure provoque, en **texte libre court** | l'accroche, les commentaires, les ratios (ci-dessous) |
| sujet soudé | oui / partiel / non : le moteur tient-il si on change le sujet ? | en comparant les posts de la série (`formats.md`, « Angle ou format ») |
| variables | ce qui change d'un post à l'autre de la série (« la phrase, l'auteur ») | en comparant la série |
| angle | pour qui, quelle douleur ou quel désir, quelle promesse | les angles de `ma_strategie` |

**Le déclencheur est une liste ouverte.** Des mots qui reviennent, à prendre comme suggestions : identification,
révélation, aspiration, défi, indignation, humour (humour noir…), attendrissement, nostalgie, tristesse. Si aucun ne
dit juste, écris le tien, court. Garde **les mêmes mots** pour le même déclencheur : le bilan regroupe le texte en
minuscules, espaces normalisés (« Révélation » et « révélation » font un ; « révélation » et « une révélation » font deux).

## L'ordre : du plus objectif au plus interprété

1. **Le support** et **les chiffres** : vues, indice (vues ÷ médiane du compte), engagement (ci-dessous).
2. **Le post entier, et la légende.** Sur sa machine : `modele_decortiquer` avec l'URL du post. Une vidéo : une
   planche, la cadence, la transcription si un Whisper est installé. Un **diaporama : toutes ses images**, téléchargées
   dans le dossier de travail, montrées une par une et numérotées, avec le texte de chacune par un OCR local si
   tesseract est installé (`ma_machine` ; le pack français lit les accents). **Lis toutes les images, dans l'ordre** —
   l'accroche (image 1), le développement, la chute, l'appel à l'action — jamais la seule couverture : la série et le
   déclencheur se lisent sur l'ensemble (sur un diaporama d'Apolline, l'image 1 pose « Mes parents ont mis papi en
   EHPAD… Pourtant… », la 2 le conte des Grimm, la 3 la morale et l'appel « Envoie-le à quelqu'un… »). L'OCR est une
   aide : vérifie sur l'image. Ce texte **n'est enregistré nulle part**, seule ta lecture courte l'est. Avec le seul
   connecteur (claude.ai, téléphone), tu n'as que la légende (`mes_posts`) : dis-le, propose moins, et demande-lui ce
   qu'il y a sur les images.
3. **La série** : regroupe les posts qui ont la même structure. Une légende dont la 1re ligne revient est un indice,
   pas une preuve (la légende dit rarement la scène).
4. **Le déclencheur** : l'accroche, puis ce que disent les commentaires (« c'est moi », « je savais pas »…), puis les
   ratios — beaucoup d'**enregistrements** : utile, ou révélation qu'on veut garder ; beaucoup de **partages** :
   identification, humour, indignation (on l'envoie à quelqu'un) ; des likes sans le reste : aspiration légère.
5. **Sujet soudé et variables** : seulement une fois la série reconnue, en comparant ses posts.
6. **L'angle** en dernier : le plus interprété.

## Quoi lire d'abord

Pas tout l'historique d'un coup. `mes_posts` avec le filtre `a_lire` donne l'ordre : **ses gagnants et ses posts
au-dessus de la médiane**, puis **autant de posts sous la médiane, dans les mêmes séries**. Le contraste fait la leçon :
sur un compte du pilote, les 3 meilleurs et les 3 pires avaient le même support et la même série ; seul le déclencheur
changeait (indignation, défi, humour noir en haut ; tristesse en bas). Sans la grille, on aurait conclu « cette série
marche une fois sur deux ».

## Proposer, faire valider, enregistrer

1. Montre ta lecture **en tableau** (post, indice, engagement, support, série, déclencheur, soudé, variables, angle),
   avec ce qui la fonde en une phrase quand c'est discutable.
2. `lire_mes_posts` avec `valide: false` pour la proposition (il la retrouve « à valider »), ou directement
   `valide: true` pour ce qu'il a approuvé. Valider une proposition sans la réécrire : les mêmes posts, `valide: true`,
   sans autre champ.
3. Ce qu'il corrige, tu l'enregistres comme il le dit.

## Le prévu avec les mêmes mots

- l'angle : son **déclencheur attendu** (`ecrire_angle`, `declencheur`) ;
- l'idée et le créneau : la **série visée** et le **déclencheur visé** (`ecrire_idee`, `maj_creneaux` : `format_vise`,
  `declencheur_vise`) ; un créneau qui reçoit une idée reprend son visé.

Une fois le post publié et lu, `bilan` compare **visé / obtenu** : l'accroche a-t-elle provoqué le déclencheur visé ?
C'est sur quoi juger l'exécution (`noter_execution`), en plus de la comparaison modèle | nous.

## Lire le bilan croisé

`bilan` (lecture croisée) regroupe les posts mûrs **dont la lecture est validée** : par série, par déclencheur, par
support, par sujet soudé, par angle × déclencheur ; chaque ligne avec son n.

- **Vues** : l'indice médian (vues ÷ médiane du compte) et les verdicts (gagnant ≥ × 10, au-dessus ≥ × 2,7, en dessous
  < × 0,5 ; arbitrés).
- **Engagement** : (likes + enregistrements + partages) ÷ vues, rapporté à la médiane du même taux sur le compte
  (× 1 = d'habitude ; fort ≥ × 1,8, faible < × 0,5 ; proposé le 19/11/2026, à arbitrer), et les trois taux médians.
  L'engagement dit si la série, le déclencheur et l'angle ont **touché la cible**, sans le biais des vues achetées : les
  vues s'achètent, l'engagement beaucoup moins.
- **Vues sans engagement** : au-dessus en vues, engagement faible. Vues poussées (pub) ou audience hors cible ; ne pas
  le reproduire sans comprendre d'où viennent les vues.
- **Engagement sans vues** : sous la médiane en vues, engagement habituel ou fort. Ceux qui le voient sont touchés ;
  c'est l'accroche ou la diffusion qui manque, pas forcément le déclencheur.
- Peu de posts par groupe (n = 3 contre 3) : **un indice, pas une règle**. Un groupe se juge comme un angle, sur 3
  posts mûrs au moins, et l'âge du compte se mêle aux premiers posts.

Les critères d'évaluation d'un post : ses champs (série, déclencheur, soudé, variables, angle) + l'indice des vues +
l'engagement + la note d'exécution.
