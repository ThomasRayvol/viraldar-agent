# Apprendre des retouches — le fichier `lecons.md` de l'utilisateur

viraldar apprend, utilisateur par utilisateur, sa façon de juger : chaque retour qu'il fait en revue devient une leçon
écrite, que tout agent qui produit pour lui relit **avant** d'écrire un brief ou de rendre une image. Sans ce fichier,
les mêmes défauts reviennent à chaque lot : sur une production réelle de 36 diaporamas en 4 jours (novembre 2026), le
même défaut d'écran revenait sur 26 posts, parce que chaque agent copiait le gabarit de la veille et ses défauts.

Charge cette référence avant de produire (étapes 4-5, « Travailler depuis le planning ») et à la fin de chaque revue.

---

## 1. Le fichier

`lecons.md`, à la racine de son dossier de travail (`~/viraldar/<projet>/lecons.md`), un par produit. Il est à lui :
il le relit, le corrige, le raye. S'il n'existe pas, crée-le vide à la première revue : il ne se remplit que de **ses** retours. Le skill n'y met aucune
règle d'avance ; quand une de ses leçons contredit une règle du skill, **sa leçon prime**.

Une leçon, c'est :

```
### L7. L'ordre d'une liste se dit en une phrase, notée dans le brief.   [vue 4 fois · script]
- Pourquoi : « pourquoi les choses vont dans cet ordre-là plutôt que dans un autre ? » (revue du 21/11)
- Exemple : « du plus ludique au plus savant »
- Posts : 2026-11-22-compte-a-8, 2026-11-22-compte-b-1, 2026-11-23-compte-a-9
```

- **Un numéro stable** (L1, L2…) : on s'y réfère dans les rapports et les messages d'erreur.
- **La règle en une phrase**, à l'impératif ou au présent, applicable sans relire le reste.
- **Pourquoi, dans ses mots** (citation exacte, avec la date). C'est ce qui permet de juger un cas limite.
- **Le compteur** (combien de fois le défaut est revenu) et **le contrôle** : `script` (un contrôle chiffré peut
  l'attraper : zone sûre, taille, contraste, nombre de slides, typographie) ou `œil`.
- **Les exceptions qu'il a données**, écrites dans la règle (« sauf si le modèle lui-même ne la respecte pas »).

Classe les leçons par coût (compteur × retouches qu'elles ont demandées) : celles du haut sont lues en premier.

## 2. Avant de produire

- **Lis `lecons.md` en entier** avant le premier brief d'un lot. Si tu délègues un post à un autre agent, donne-lui le
  chemin du fichier et exige qu'il le lise : il ne le connaît pas.
- Le brief dit, pour chaque leçon `œil` qui touche le post, comment il la tient (« L5 émotion : calme au modèle → une plage
  vide à l'aube »).
- Les leçons `script` se vérifient par un contrôle chiffré, pas à l'œil. Quand elles s'accumulent, propose-lui un
  **contrôle bloquant** : le script de rendu note ce qu'il a posé (boîtes de texte, contraste, écran du produit…) et un
  script de vérification, lancé automatiquement avant `montage_comparaison` (hook PreToolUse de Claude Code, avec son
  accord), refuse la comparaison tant qu'une leçon chiffrée échoue, en citant son numéro. Un post fautif n'arrive
  plus jusqu'à sa revue.
- **Le rapport de fin de post** (le tien, ou celui de l'agent délégué) porte une ligne par leçon touchée :
  `L3 ok` / `L5 ok (slide 2 : plage à l'aube)` / `L9 non : <raison>`. L'utilisateur ne relit que les « non ».

## 3. À la fin de chaque revue

Ses retours arrivent dans la conversation, contenu par contenu. Une fois les retouches faites :

1. Pour chaque retour, cherche la leçon qui le couvre. Elle existe : **+1 au compteur**, ajoute le post et, si ses mots
   précisent la règle, la citation. Elle n'existe pas : **écris-la**.
2. **Un retour qui en contredit un ancien** : ne garde pas les deux. Demande-lui laquelle prime et écris l'exception.
3. **Un défaut qui vient d'un outil ou d'un gabarit copié** (un réglage par défaut, une fonction recopiée de post en post)
   se corrige dans l'outil ou le gabarit, une fois. La leçon le note (« corrigé dans <fichier> le <date> »).
4. Dis-lui en une ligne ce qui a changé dans `lecons.md` (« +1 à L1 et L3, nouvelle L12 : le titre jamais sur un
   visage »). Il ne relit pas le fichier à chaque fois : la ligne suffit.

Une leçon qui ne revient pas reste : elle a peut-être cessé de revenir **parce qu'**elle est écrite.
