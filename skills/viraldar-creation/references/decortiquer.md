# Décortiquer un modèle

But : mesurer **la mécanique** (ce qui se reprend exactement) et la séparer du **contenu** (le texte et l'idée, qui
peuvent se reprendre aussi) et des **médias** du créateur (ce qui se refait). Chaque modèle se décortique **avant** d'écrire : relevé le 12/11/2026, douze textes écrits sans avoir vu
les modèles ratèrent la moitié des mécaniques (voix off, paysage, mème, cadence) et durent être refaits deux fois.
Quand le format compte d'autres posts, décortique-en 2 de plus : ce qui est commun aux trois est le format.

## D'où viennent les informations

| source | donne |
|---|---|
| `post` (`detail: true`) | vues, likes, commentaires, partages, enregistrements, outlier (avec médiane et n du compte), vues ÷ abonnés, type (vidéo / diaporama), nombre de slides ou durée, son, légende, hashtags, extraits de commentaires « demande l'app » |
| `formats_similaires` | 2-5 posts voisins pour vérifier que la mécanique se répète |
| `modele_decortiquer` | **avec l'accord de l'utilisateur**, le post récupéré par son URL et analysé sur sa machine. Vidéo : planche d'images, coupes détectées, nombre de plans et durée moyenne d'un plan, orientation et ratio, transcription horodatée si Whisper est installé. **Diaporama : toutes ses images**, numérotées, une planche, le son et le texte de chaque image par OCR local si tesseract est installé — lis-les toutes, dans l'ordre, pas seulement la couverture |
| l'utilisateur | sans l'outil ou sans accord : captures (début, chaque changement de plan, fin), la voix transcrite ou décrite, ce qu'il voit et entend |

**La vidéo du modèle** : on la récupère seulement si l'utilisateur l'accepte, pour une analyse locale. Elle reste dans
`modeles/<id>/`, sert à la fiche et à `montage_comparaison`, n'entre jamais dans un montage, n'est jamais envoyée ni
republiée, et se supprime quand le post est produit si l'utilisateur le souhaite. Une transcription (Whisper) à la
fois : plusieurs en parallèle saturent la mémoire.

**La légende n'est pas la vidéo.** La légende, les hashtags et les notes du créneau (souvent tirées des mots-clés)
décrivent mal ce qu'on voit : une note « citation + origine » où l'origine n'est que dans la légende, un « il a décrit
ma vie » qui était un mème « me psychoanalysing people who did me wrong ». La fiche se remplit d'après la vidéo, et
dit à part ce qui est dans la légende.

## La fiche de mécanique

`modeles/<id>/mecanique.md`, un par modèle :

```
POST        : @compte · id · lien
CHIFFRES    : vues · outlier (médiane du compte, n) · vues ÷ abonnés · likes % (< 2 % : pub ?) · 📲 oui/non/non mesuré
FAISABLE    : oui / non avec ses ressources (qui filme : …) — non → proposer un autre modèle, ne pas adapter
SUPPORT     : vidéo (durée) | diaporama (n slides) · face caméra | sans visage | texte seul | capture | mème | plans filmés
ORIENTATION : ratio (9:16, 3:4, 4:5, 1:1, 16:9, 4:3, 2,35:1) · bandes noires ? · où se pose le texte (image, bandes)
HOOK        : texte à l'écran mot pour mot, casse et ponctuation comprises (« … ») · voix mot pour mot (« … »)
              · image à 0 s · durée avant la 1re coupe · type (catalogue accroches.md)
PLANS       : nombre de plans · durée d'un plan (médiane, et la plus courte / la plus longue) · transitions (coupe franche,
              fondu, zoom) · le montage suit-il le rythme du son ?
STRUCTURE   : plan par plan (vidéo) ou slide par slide : 1. accroche  2. …  n. fin — rôle de chaque partie
              (problème, tension, révélation, preuve, réaction, chute, CTA)
FONDS       : combien de fonds différents, de quelle nature (photo, vidéo d'ambiance, aplat, capture), changent-ils à
              chaque plan ?
TEXTE       : polices PAR RÔLE (hook, corps, nom d'auteur…) : famille (serif, sans, manuscrite, éditeur TikTok),
              graisse, casse · couleurs (texte, contour, bandeau) · taille et place · lignes par écran · mots par écran
VOIX        : aucune | voix off | parlée à l'écran · type (grave, chuchotée, synthèse TikTok…) · débit (mots/s) · ton
              · transcription horodatée · ce qu'elle dit par rapport au texte (la même chose, autre chose)
SON         : tendance / original / aucun ; rôle (ambiance, rythme des coupes, chute)
STICKERS    : emojis, flèches, bulles, étiquettes : lesquels, où, quand
PRODUIT     : apparaît-il ? où (slide, seconde) ? comment (montré en usage, nommé, logo, capture) ? combien de temps ?
CTA         : lequel, où, explicite ou implicite (« c'est quoi l'appli » dans les commentaires)
LÉGENDE     : ce qui est dans la légende et pas dans la vidéo
COMMENTAIRES : de quoi parlent les extraits (demande de l'app, « c'est moi », désaccord) → ce qui fait réagir
DÉCLENCHEUR : l'émotion que la structure provoque (identification, révélation, aspiration, défi, indignation,
              attendrissement, nostalgie…), lue dans les commentaires plus que dans la légende
VARIABLES   : ce qui change d'un post à l'autre du format (la scène, la phrase, l'image, la liste)
SOUDÉ ?     : non (le déclencheur tient avec un autre sujet) | oui : quoi (le chien, le corps…) → hors de cette niche,
              pas un modèle ; preuve soudée → seulement avec une preuve visible équivalente pour le produit
ANGLES      : les angles de sa stratégie que ce format peut porter (même déclencheur), avec le test des commentaires :
              son produit à la place du sujet, les mêmes réactions ?
POURQUOI ÇA MARCHE (hypothèses, 3 au plus) : …
? INCONNU   : ce qu'on ne sait pas (ne pas deviner)
```

## Mécanique ou contenu ?

| à reprendre exactement (mécanique) | contenu (texte : repris ou réécrit ; médias : refaits) |
|---|---|
| la forme du hook : syntaxe, longueur, ponctuation, casse ; une formule générique (« Tu connais X ? ») telle quelle | ce que le hook dit de propre au créateur |
| le nombre de plans ou de slides, la durée d'un plan, les transitions | les plans eux-mêmes, les images, la personne |
| l'orientation et le ratio, la place du texte | — |
| le nombre et la nature des fonds | les fonds eux-mêmes (ses photos, ses vidéos, une banque libre de droits) |
| les polices et couleurs par rôle (familles proches si la police exacte n'est pas libre) | — |
| la présence, le type et le débit de la voix | la voix (la sienne ou une voix de synthèse sous licence) et ce qu'elle dit |
| les stickers, leur place et leur moment | — |
| le rôle de chaque partie et leur ordre, la chute | l'histoire, les exemples, les chiffres, les citations |
| la place et la manière de montrer le produit | le produit (le sien) |
| le ton (1re personne, liste, POV, mème) | les phrases, les blagues |
| le déclencheur (l'émotion que provoque la structure) | le sujet, sauf s'il est soudé : alors il fait partie de la mécanique, et le modèle ne sort pas de sa niche |

Un élément qui n'apparaît que dans 1 des 3 posts du format est du contenu, pas de la mécanique.

## Pièges relevés

- **Redresser en 9:16** : 6 modèles sur 12 d'un lot étaient en 16:9, 4:3, 2,35:1 ou presque carrés. Le paysage avec
  bandes noires fait partie du format ; le recadrer en plein écran en fait un autre.
- **Ralentir** : un montage de 6 plans de 1,85 s contre 23 plans de 0,48 s dans le modèle ; 3 à 4 fois trop lent, ce
  n'est plus le même rythme. Compte les plans et mesure-les.
- **Uniformiser les polices** : le hook a souvent sa propre police (manuscrite, serif) ; une seule police partout
  efface le contraste qui le fait lire.
- **Oublier la voix** : 6 modèles sur 9 analysés avaient une voix ; des sous-titres seuls ne la remplacent pas.
- **Changer la scène sans raison** : un fond unique d'un bout à l'autre, ou un fond par plan, c'est de la mécanique.
- **Le letterboxage** : une vidéo 16:9 dans un cadre 9:16 a des bandes noires qui mangent jusqu'aux deux tiers de
  l'image ; à l'œil, elle « ouvre sur du noir ». Dans un relevé, 7 « ouvertures noires » sur 15 n'étaient que du
  letterboxage.
- **Lire un diaporama par sa couverture** : la couverture pose l'accroche, le reste du diaporama porte la série (la
  structure image par image), le déclencheur (souvent dans la chute) et l'appel à l'action. `modele_decortiquer` rend
  toutes les images : lis-les toutes, dans l'ordre, et note le rôle de chacune dans la fiche.
- **Croire qu'un mème se raconte** : un mème (« me psychoanalysing… ») tient à son image et à son décalage ; il se
  reprend avec une image du même registre, pas en texte sur fond.
- **La taille servie n'est pas la taille montée** : TikTok rogne une image sous la légende (`production.md` § 4) ; une
  capture d'écran du post ne montre pas toute l'image. Le ratio se mesure sur la vidéo (`modele_decortiquer`).
- **Une règle qui marche dans un créneau ne franchit pas toujours la frontière** : ce qui est commun à 3 posts **de la
  même niche** est le format ; ce qui vient d'ailleurs reste une hypothèse.
