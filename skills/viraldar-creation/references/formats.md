# Catalogue de formats

Un **format** = une mécanique reproductible (type d'accroche + structure + support), indépendante du sujet. Ce
catalogue sert à **nommer** ce que tu trouves dans la base et à savoir le **produire** ; il ne prouve rien. Avant de
proposer un format, cherche-le dans la base (`chercher_posts` avec le type vidéo/diaporama, `petits_comptes_viraux`,
`formats_similaires`) et dis s'il est fiable (≥ 3 posts qui passent les critères) dans **sa** niche.

Ressources : **V** = visage de l'utilisateur, **C** = captures / enregistrements de l'app, **P** = photos (les siennes,
ou générées avec label IA), **T** = texte seul. Temps = ordre de grandeur pour un post, une fois le brief validé.

---

## Diaporamas (photo mode) — le point de départ par défaut pour une app

Pourquoi d'abord : peu coûteux (pas de tournage), se décline vite, et des praticiens d'apps rapportent que l'essentiel
de leurs succès en vient (anecdotes, voir sources). TikTok accepte jusqu'à 35 images ; vise 5-8.

### D1 · Tension → révélation (« la slide qui libère »)
- **Mécanique** : slide 1 = photo d'une personne dans une situation + accroche de tension (A3, A4, A1) ; slide 2 ou 3 =
  la révélation qui montre le produit en usage et clôt l'histoire ; éventuellement 1-2 slides de contexte.
- **Quand** : produit qui « débloque » un moment précis (sommeil, discipline, angoisse, salle de sport). Ressources V ou P + C.
- **Produire** : `carrousel_rendre`, modèle `natif` (photo nette + texte de l'éditeur TikTok, `position: "haut"` sur toute la
  série) pour l'allure d'un post, `revelation` (accroche, puis la réponse avec la vignette de l’app) ou `ecran` pour
  montrer l’app en usage. Texte court, en haut de la zone sûre, bandeau ou contour ; 3:4 avec `zone: "description"`
  garde la photo presque entière sous la légende.
- **CTA** : implicite ; le nom de l'app lisible sur la capture suffit à provoquer « c'est quoi l'appli ? ».

### D2 · Récit en 6 slides
- **Mécanique** : 1 accroche · 2 problème · 3 révélation (produit) · 4 réaction / résultat · 5 CTA · 6 « suis pour la suite ».
  Une même scène (lieu, lumière, personne) sur toutes les slides.
- **Quand** : avant/après visible (décoration, forme, routine, organisation). P (même série de photos) + C.
- **Produire** : `carrousel_rendre` avec un seul modèle décliné (`carrousel_modeles` les liste : citation, liste, notes, contraste, ecran, revelation, natif) ;
  même `position` et même `theme.etalonnage` sur toutes les slides ; pour des images générées, une seule description de
  scène réutilisée pour les 6 images (cohérence) et le label IA.

### D3 · Liste utile
- **Mécanique** : slide 1 = A7 (« 5 habitudes qui… ») ; une idée par slide ; le produit = un des éléments (pas le 1er,
  souvent le dernier ou l'avant-dernier) ; dernière slide « enregistre pour plus tard ».
- **Quand** : niches de conseils (dev perso, études, santé). Fait des **enregistrements**. T + P.
- **Produire** : `carrousel_rendre`, modèle `liste`, ou `natif` (couverture : `etiquette`, titre chiffré, `texte: ">>>"` ;
  puis `numero: "N°1"`… une slide par élément) ; ≤ 25 mots par slide. Une liste longue (8-12) gagne une slide de relance
  vers 40 % (à éprouver, `production.md` § 2).

### D4 · Citation / texte sur fond
- **Mécanique** : 1 à 6 slides de texte (citation, prise de conscience, « ce que j'aurais voulu savoir », A8) sur fond
  d'ambiance ; ton intime à la 1re personne.
- **Quand** : niches citations, poésie, santé mentale, rupture ; compte sans visage. T + P.
- **Produire** : `carrousel_rendre`, modèle `citation`, ou `natif` (l'auteur prend l'étiquette rouge) ; texte original
  ou citation exacte et sourcée (jamais une citation d'auteur vivant recopiée en masse sans attribution). Produit : dans
  l'histoire (slide 2-3) plutôt qu'en logo de fin (`production.md` § 2).

### D5 · Capture d'écran (« screenshot »)
- **Mécanique** : fausse conversation, note du téléphone, liste dans l'app, écran de l'app avec une annotation.
- **Quand** : app dont l'écran parle seul (journal, suivi d'habitude, gamification). C + T.
- **Produire** : `carrousel_rendre`, modèle `notes` (variante app ou papier) ou `ecran` ; les captures viennent de **son** app.
  Une fausse conversation doit se lire comme une mise en scène, pas comme un vrai témoignage.

---

## Vidéos

### V1 · POV sans visage
- **Mécanique** : 2-3 s de plan d'ambiance (mains, chambre, rue) + texte POV (A1), puis la capture d'écran de l'app en
  usage ; 7-15 s ; boucle.
- **Quand** : pas de visage, peu de temps. C + plans tournés par l'utilisateur (ou banque d'images libre de droits).
- **Produire** : les outils `montage_*` : plan 1 (2,5 s, texte POV en surimpression) → enregistrement d'écran (5-10 s) → retour
  au plan 1 pour la boucle. **Jamais** de clip d'un autre créateur, même recadré (pratique rapportée chez certains
  growth-hackers d'apps : c'est une reprise de contenu protégé).

### V2 · Démonstration d'app / « green screen »
- **Mécanique** : la personne (ou une voix off) devant l'écran de l'app ; accroche A10, A4 ou A9 ; on voit le geste qui
  résout le problème dans les 5 premières secondes ; 15-30 s.
- **Quand** : la valeur se voit à l'écran. V (ou voix) + C.
- **Produire** : l'utilisateur filme face caméra sur fond neutre ou enregistre sa voix ; les outils `montage_*` incruste
  l'enregistrement d'écran, sous-titres, texte d'accroche.

### V3 · Face caméra / storytime
- **Mécanique** : la personne raconte (A8, A6, A2), coupes toutes les 1-3 s, sous-titres ; le produit arrive comme
  « ce qui m'a aidée », pas comme une pub ; 20-45 s.
- **Quand** : fondateur ou personne qui accepte de se montrer ; niches santé mentale, dev perso. V.
- **Produire** : liste de plans dans le brief ; les outils `montage_*` (les silences se coupent avec `montage_decouper` et `montage_assembler`) ajoutent sous-titres et texte d'accroche.

### V4 · Avant / après
- **Mécanique** : l'état « avant » (0-2 s) → l'état « après » ; transition sur le temps fort du son.
- **Quand** : changement visible et **réel** (routine, écran, chambre, carnet). P/V.
- **Produire** : les outils `montage_*` : deux plans, transition coupée, texte « avant / après » ; aussi faisable en D2.

### V5 · Réponse à un commentaire
- **Mécanique** : bulle du commentaire (« c'est quoi l'appli ? ») + réponse en démonstration (A12).
- **Quand** : après un post 📲 de l'utilisateur. Le meilleur 2e post après un succès.
- **Produire** : la bulle s'ajoute dans l'app TikTok au moment de publier le brouillon ; les outils `montage_*` pour le reste.

### V6 · UGC de créateurs
- **Mécanique** : un créateur filme l'un des formats ci-dessus pour le produit.
- **Quand** : l'utilisateur a un budget créateurs. Brief = le même gabarit.
- **Conformité** : rémunéré → « Partenariat rémunéré » dans TikTok et, en France, « Publicité » / « Collaboration
  commerciale » visible ; le créateur utilise vraiment le produit ; pas de faux témoignage ni de faux résultat.

---

## Choisir

1. Ce qui est **fiable dans sa niche** (base) passe avant tout le reste.
2. Puis ce que ses **ressources** permettent (pas de V → D1-D5, V1).
3. Puis ce qui montre le produit **en usage** le plus tôt possible sans ressembler à une pub.
4. Un format principal + un format en test ; on ne change de format principal qu'après ≥ 3 posts mesurés.

## Spécifications de sortie

- Vidéo : vertical 1080 × 1920 (9:16), ≥ 720p, MP4 H.264. Diaporama : 9:16, 3:4 (1080 × 1440) ou 4:5 (1080 × 1350),
  d'après le modèle de la base et la légende prévue (`production.md` § 3).
- Zones sûres par cas (`description`, `sans_description`, `pub`) et lisibilité : liste de contrôle du SKILL.md.
- Pas de musique dans le fichier : le son s'ajoute dans l'app (compte Entreprise : bibliothèque commerciale seulement).
- Image générée ou fortement retouchée qui paraît réelle : label IA dans TikTok (« Image virtuelle » en France pour un
  visage ou une silhouette).
