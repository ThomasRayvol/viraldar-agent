# Produire et contrôler — le process rodé

Ce process vient d'une production quotidienne réelle : plusieurs comptes, 3 à 4 posts par jour et par compte, en
octobre-novembre 2026. Les chiffres cités ont été mesurés sur ces comptes ou sur des comptes publics de leur niche. Ils
valent pour **une** niche (citations, développement personnel) : présente-les comme des repères, avec leur n, jamais
comme des lois. Charge cette référence aux étapes 4 (écrire), 5 (produire) et 8 (itérer).

---

## 1. Le texte d'abord, validé mot pour mot

- **Le texte se relit en texte**, avant toute image : propose slide par slide (ou plan par plan) dans la conversation,
  l'utilisateur corrige, puis tu recopies **mot pour mot** dans le JSON (retours à la ligne compris). Ne réécris pas en
  rendant : une correction de texte repasse par lui.
- **L'hypothèse s'écrit avant** de publier, dans le brief : ce qu'on attend, avec un seuil, et ce qu'on conclura dans
  chaque sens (« ≥ 2 × sa médiane : on garde ce type d'accroche ; < 1 × : on l'abandonne »). Classé après coup, un post
  devient une histoire qu'on se raconte.
- **Rien d'éditorial ne se décide au rendu.** Le choix du format, de la zone sûre, des images et du nombre de slides est
  dans le brief ; le JSON de `carrousel_rendre` n'en est que la traduction.

## 2. Écrire un carrousel qui donne envie de glisser

1. **Un fil d'un bout à l'autre** : un seul objet ou une seule scène porte le carrousel ; la dernière slide répond à la
   première.
2. **Chaque slide sauf la dernière finit sur une question ou une promesse, et la suivante y répond** (« Il en tire une
   conclusion que personne ne cite. » → « La voici : »). Une slide complète en elle-même ne donne aucune raison de passer
   à la suivante.
3. **L'accroche annonce la structure** : « 3 choses que… », « la suite de la phrase », « la n°3 va te… ». Le spectateur
   sait qu'il y a quelque chose plus loin, et combien.
4. **Concret, une émotion avouable par slide** (gêne, petite vanité, mauvaise foi) : des chiffres, des objets, une scène.
   Jamais « ça ne m'avançait pas ».
5. **On raconte, on n'enseigne pas** : pas de ❌ ✅ dans une histoire ; ils appartiennent aux listes de conseils.
6. **Un carrousel, une seule catégorie**, décidée avant d'écrire (récit, problème/solution, liste) : en réécrivant on
   glisse de l'une à l'autre sans s'en apercevoir, et la comparaison ne veut plus rien dire.

**Longueur.** Récit : 3 slides, 4 au plus ; une slide qu'on peut retirer sans que l'histoire boite est retirée. Liste
numérotée : 8 à 12 slides (couverture : étiquette, titre chiffré, « >>> », promesse sur un numéro ; une slide par
élément) ; une slide de relance vers 40 % de la liste (« Mais ce n'est pas la plus forte. ») et la réponse promise en
avant-dernier sont **à éprouver** (pratique rapportée, pas encore mesurée).

**Le produit dans l'histoire, pas après elle.** Sur un compte relevé, des posts à 10 000 – 20 000 vues n'amenaient presque
aucune recherche de l'app dans le store (0 à 4 par jour, n = 26 jours) : ils se suffisaient à eux-mêmes et le logo de
fin s'oubliait. Donc :
- le produit arrive comme **la suite de l'histoire**, en slide 2 ou 3, et il est **nommé là où il entre** (« une app
  m'envoie une phrase par jour… »), pas seulement sur la dernière slide ;
- on montre **ce qu'il a changé**, petit et précis (« j'ai compris pourquoi ma mère… »), jamais un slogan (« des phrases
  qui changent ta vie ») ni le mot abstrait (« prise de conscience ») ;
- une capture montre **ce dont le post vient de parler**, jamais un autre écran ;
- le nom s'écrit sur une slide **et dans la légende**, en disant que c'est une app : sans lien en bio, la recherche
  dans le store est le seul chemin.

**Un appel à l'action, un seul** : commenter ou partager d'abord, enregistrer pour une liste ou des conseils ; le like
passe après.

**La voix** : orale et courte (« j'ai lâché »), l'auto-dérision plutôt que la leçon. Le registre mème (« comment je me
sens quand… ») s'écrit en bas de casse, sans point final. Une citation reste **exacte au mot près, avec sa source** : c'est
la seule chose qu'on ne rend jamais « plus drôle » ; une phrase fausse ou déformée n'apparaît que comme l'objet qu'on
corrige, à côté de la version juste.

**Avant de valider, trois questions.** Si je ne lis que la slide 1, ai-je envie de la suite ? Une slide pourrait-elle
être retirée ? La dernière répond-elle à la première ?

## 3. Choisir le format et la zone sûre

TikTok met une image à la largeur de l'écran et la **centre** en hauteur. Avec une description (légende), il la centre
entre la barre d'état et le haut du panneau de description : une image 9:16 perd alors le haut et le bas (visible de
14 % à 86 % de sa hauteur avec une description longue), et ne s'affiche entière que si l'on ouvre la description. Les
zones sont des relevés sur de vrais téléphones, dans `modeles/zones-sures.json` (`carrousel_modeles` les rend, avec
leur source).

| publication prévue | `zone` | format conseillé |
|---|---|---|
| carrousel avec légende (le cas courant) | `description` | **3:4** si l'image compte (visage, objet) : presque entière sous la légende ; 9:16 si elle doit remplir l'écran, en gardant le sujet dans la zone |
| carrousel sans légende | `sans_description` | 9:16 ou celui du post modèle |
| vidéo (avec légende) | `description` | 9:16 |
| publicité (Spark, in-feed) | `pub` | 9:16 ; rien en bas à droite (colonne d'icônes) |

- Le cas `description` retire aussi la bande des avatars « aimé par » (à gauche, de 45 à 69 % de la hauteur) : le
  texte est centré sur l'**axe de la zone**, pas de l'image, parce que la colonne de boutons mange la droite.
- La plupart des comptes de carrousels à texte relevés sont en 3:4 à 4:5 (rapport hauteur/largeur médian 1,25 à 1,41,
  n = 46 premières vues de 3 comptes) : ils ne perdent rien sous une légende longue.
- Les légendes relevées : 5 hashtags en médiane sur 3 comptes d'une niche (n = 160 posts) ; les comptes de carrousels
  de citations écrivent 140 à 260 caractères (n = 53). Aucun lien mesuré entre longueur de légende et vues.

## 4. Rendre

- **`natif`** pour l'allure d'un post et pas d'une pub : photo plein cadre nette, texte de l'éditeur de TikTok (pavés
  blancs par ligne, ou blanc à liseré noir). Les réglages viennent de l'éditeur : TikTok Sans graisse 560, 54 à 60 px
  sur 1080, pavés aux coins arrondis, étiquette rouge pour un nom.
- **Une série se reconnaît** : même `position` du bloc sur toutes les slides, même style, et un `etalonnage` commun
  (`theme.etalonnage`) qui fait d'images disparates une série. Pour un récit, une seule photo peut porter les trois
  slides (nette, puis floutée sous le texte, puis resserrée).
- **Une citation trop longue ne se rapetisse pas** : coupe-la (« … ») ou répartis-la sur deux slides. `carrousel_rendre`
  prévient sous 36 px (≈ 13 pt sur un téléphone).
- **Vidéo** : un texte posé reste au moins **0,25 s par mot, et 2,5 s** (`montage_texte` prévient) ; pas de texte en bas
  en même temps que des sous-titres en bas.
- **Pas de musique dans le fichier** : le son se pose dans l'app (un post envoyé par API a son audio figé).

## 5. Contrôler avant de montrer

- [ ] `carrousel_rendre` : aucun avertissement « zone sûre », « réduit » ni « coupé ». `zone_verifiee: true` veut dire
      que chaque ligne de texte rendue est dans la zone du cas choisi.
- [ ] **Regarde la planche** : `carrousel_apercu` (carrousel) ou `<vidéo>-controle.jpg` rendue par `montage_texte`
      (une image par texte). En rouge, ce que TikTok recouvre ; en vert, la zone du texte. Aucun texte dans le rouge, et
      le sujet de l'image (visage, objet, capture) hors des bandes rognées.
- [ ] Une image d'une vidéo faite ailleurs se vérifie aussi : `montage_couverture` à l'instant voulu, puis
      `carrousel_apercu` avec `chemins` et `zone`.
- [ ] Le texte rendu relu contre le texte validé, mot pour mot ; la citation et sa source exactes.
- [ ] Les trois questions du § 2.
- [ ] **Jamais le même fichier sur deux comptes**, jamais deux fois le même post : au moins un élément varie.
- [ ] Métadonnées : les outils n'en écrivent aucune (images neuves, `-map_metadata -1`) ; une photo de l'utilisateur
      envoyée telle quelle, hors outils, garde les siennes (GPS compris).

## 6. Varier et apprendre

- **Une seule chose change à la fois** entre deux posts qu'on compare (l'accroche d'abord). Trois changements ensemble
  (durée, intro, rythme) et le résultat ne dit plus lequel a compté.
- **Une variante de gagnant** (même accroche, même format, autre contenu) **s'attend autour de × 1,3, pas × 2** : sur un
  compte relevé, 13 dérivés de posts gagnants (≥ 2 × la médiane) : 2 ont regagné, 11 sont retombés ; les deux qui
  tiennent étaient restés sur le compte d'origine. Elle tient un créneau « sûr » au-dessus de la norme, elle ne promet
  pas un second succès.
- **Ce qui a porté un gagnant n'est pas toujours la formule** : un post à × 14,5 dont on a changé la citation (même
  compte) puis le compte (même texte) est retombé à × 1,0 et × 1,3. D'où les dérivés à un seul changement : s'ils gagnent
  aussi, c'est l'accroche ; s'ils retombent, c'était autre chose.
- **L'indice d'un post** = ses vues ÷ la médiane des posts **mûrs** du même type (carrousel ou vidéo) du **même compte**.
  Un post jeune peut déclarer un gagnant, jamais un perdant. Sur les comptes relevés, un post ne progressait presque plus
  après 8 h (+ 4 % de vues en médiane entre un relevé à 6-30 h et un relevé après 72 h, + 11 % au plus, n = 12) : un premier verdict à 8 h est possible,
  le jugement reste à 48 h et 7 j (`lire-les-stats.md`).
- **Les leçons s'écrivent** (`journal.md`) : une règle, les posts pour et contre, et un statut — à éprouver, pressentie,
  confirmée (≥ 3 posts mûrs pour, aucun contre). Une méthode lue ailleurs (formation, vidéo) entre « à éprouver » et
  n'avance qu'avec ses propres posts. Toute nouvelle proposition commence par relire les leçons et dit laquelle elle
  applique ou met à l'épreuve.
- **Une mesure dans sa niche bat une méthode rapportée d'ailleurs.** Sur un compte, le carrousel faisait 2,4 fois les vues
  de la vidéo (704 contre 293 vues médianes, n = 10 par branche) ; chez trois comptes voisins à forte audience, 154 posts
  sur 160 étaient des vidéos. La règle « le carrousel gagne » décrivait un créneau, pas la plateforme : vérifie dans la
  base avant de l'appliquer.
