# Lire les chiffres viraldar

Règle d'or : **toute moyenne ou médiane s'affiche avec son n**, et tout chiffre dit d'où il vient (outil viraldar,
utilisateur, source citée). Préfère la médiane à la moyenne : un post à 20 M de vues fausse une moyenne de 10 posts.

## Les mesures d'un post (renvoyées par `post` et `chercher_posts`)

| mesure | définition | ce qu'elle dit | piège |
|---|---|---|---|
| **vues** | relevées au passage de viraldar | la portée | un vieux post a eu le temps d'accumuler ; regarde `publie` / `age_j` |
| **outlier** | vues ÷ médiane des posts de plus de 48 h du **même compte** (`mediane_compte`, `n_compte`) | le post a fait beaucoup mieux que d'habitude pour ce compte : c'est le **format** qui a porté, pas l'audience | n_compte < 5 : la médiane est fragile, dis-le |
| **vues ÷ abonnés** (`ratio_abonnes`) | abonnés relevés le jour de la recherche, comptés au moins 1 000 | le post a été poussé bien au-delà de l'audience du compte : reproductible par un **petit compte** | le compte a pu grossir *grâce* à ce post : le ratio est alors sous-estimé, pas surestimé |
| **taux de likes** (`taux_likes`) | likes ÷ vues | < 2 % : souvent une vidéo poussée en publicité, la portée ne prouve pas le format | |
| **📲 demande l'app** (`demande_app`) | ≥ 2 % des commentaires lus **et** ≥ 2 commentaires demandent le nom de l'app | l'indice de conversion le plus direct | ne porte que sur les commentaires lus (`commentaires_lus`, ~100 par post ≥ 300 k vues) ; un post non lu n'est pas « sans 📲 », il est « non mesuré » |
| **enregistrements, partages** | | contenu utile (liste, conseil) ou qui parle à quelqu'un | à comparer entre posts du même type seulement |
| **type, slides, durée, son** | vidéo ou diaporama (photo), nombre de slides, durée | le support à reproduire | |

## Les critères (constantes de viraldar, ne les change pas)

- **Critères** (champ `valide`) : ≥ 100 k vues, publié il y a ≤ 90 jours, likes ≥ 2 % des vues.
- **Format fiable** : au moins **3 posts** du format passent les critères. 1-2 : « prometteur, à tester ».
- **Recommandés / petits comptes viraux** : compte ≤ 50 k abonnés, post ≥ 300 k vues et ≥ 20 × les abonnés ; classés
  par vues ÷ abonnés ; 2 posts au plus par compte ; les 100 premiers.

## Comment l'écrire

- Bien : « Le format "ce que je ne savais pas à 25 ans" est fiable : 6 posts passent les critères sur 9 relevés,
  4 comptes, 610 k vues médianes (n = 9), outlier médian 14 (n = 9), 2 posts 📲. »
- Mal : « Ce format fait en moyenne 600 k vues. » (pas de n, moyenne, pas de source)
- Un format porté par un seul compte : « 5 posts, tous de @x : ça prouve @x, pas encore le format. »
- Quand la base ne trouve rien : « 0 post dans la base pour ces mots » ; ne comble pas avec ta mémoire de TikTok.

## Ses propres posts (étape 8)

- Juge à **48 h** (comme viraldar, qui ne compte dans la médiane d'un compte que les posts de plus de 48 h) puis à 7 j.
- Sa référence est **la médiane de ses posts** (avec n), pas la base : un compte neuf à 300 vues médianes (n = 6) qui
  fait 3 000 vues a un outlier de 10, c'est un signal.
- Un post à ≥ 3 × sa médiane : refaire la même mécanique. ≥ 10 × : en faire la série principale.
- Pour décider d'un format, ≥ 3 posts du format ; d'une accroche, ≥ 2 posts par variante. En dessous, « trop tôt ».
- Conversion : demande ce qu'il mesure (installations du jour, inscriptions, code promo, « comment nous as-tu
  connus »). Sans mesure de conversion, prends les commentaires qui demandent le nom de l'app et les visites du profil.
