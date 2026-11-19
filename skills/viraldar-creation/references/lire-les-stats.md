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

## Les paliers de vues sur TikTok (lecture absolue d'un post)

Le ressenti du propriétaire de viraldar, tiré de sa pratique (18/11/2026). Ce n'est **pas** une règle mesurée sur la
base : donne-le comme un repère d'expérience, à côté de la lecture relative (la médiane de ses posts, ci-dessous), qui
reste la référence. Un post se lit à 48 h ; un bon post croît encore après.

| vues (à 48 h) | ce que ça dit | quoi faire |
|---|---|---|
| **~250** | personne ne s'arrête : l'accroche ne retient pas, la qualité ne suffit pas, rien ne donne envie de regarder | refaire l'accroche et l'image ; ne rien conclure sur l'angle |
| **~700** | un début d'intérêt, pas assez pour que TikTok pousse le post plus loin | renforcer l'accroche |
| **1 000 à 1 200** | même cas, avec une exécution un peu plus propre | renforcer l'accroche, puis l'exécution |
| **~5 000** | l'accroche commence à intéresser | garder l'accroche, travailler l'exécution |
| **~7 000** | même cas, mais l'exécution laisse à désirer : il reste un écart à combler | combler l'écart d'exécution (comparer au modèle) |
| **10 000 à 20 000** | un post de bonne qualité ; itérer dessus devrait reproduire ces résultats | itérer : des variations, une chose à la fois |
| **100 000 et plus** | une accroche forte, un post bien filmé et bien exécuté | itérer sur ce post |

**Ce que ça veut dire** : **sous 10 000 vues**, tout se joue sur ce qu'on maîtrise : l'accroche, l'exécution, la
qualité de l'image, ce qui fait qu'un post se regarde. **Au-dessus**, les posts se ressemblent : tous sont bien filmés
et bien faits, même ceux qui ont l'air simples ; l'écart entre 100 000 et un million tient surtout au hasard de
l'algorithme. N'en tire pas de leçon sur l'angle.

Avec la **note d'exécution** (1 à 5) : un post sous 10 000 vues noté 4 ou 5 mérite une relecture honnête de la note
(comparer au modèle) avant de conclure que l'angle n'attire pas ; noté 1 ou 2, il est non concluant, on refait
l'exécution.

## Ses propres posts (étape 8)

- Juge à **48 h** (comme viraldar, qui ne compte dans la médiane d'un compte que les posts de plus de 48 h) puis à 7 j.
- Sa référence est **la médiane de ses posts** (avec n), pas la base : un compte neuf à 300 vues médianes (n = 6) qui
  fait 3 000 vues a un outlier de 10, c'est un signal.
- Un post à ≥ 3 × sa médiane : refaire la même mécanique. ≥ 10 × : en faire la série principale.
- Pour décider d'un format, ≥ 3 posts du format ; d'une accroche, ≥ 2 posts par variante. En dessous, « trop tôt ».
- Conversion : demande ce qu'il mesure (installations du jour, inscriptions, code promo, « comment nous as-tu
  connus »). Sans mesure de conversion, prends les commentaires qui demandent le nom de l'app et les visites du profil.
