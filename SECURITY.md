# Sécurité / Security

## Signaler une faille / Reporting a vulnerability

Écris à l'adresse de contact indiquée sur https://viraldar.rayvol.net (pas d'issue publique pour une faille).
Réponse sous 7 jours. / Email the contact address listed on https://viraldar.rayvol.net (no public issue for a
vulnerability). Answer within 7 days.

## Ce que fait ce serveur / What this server does

| | |
|---|---|
| Réseau / Network | l'API Supabase de viraldar (avec ta session) ; les images que tu donnes par URL (https/http publiques seulement : aucune adresse locale ni privée) ; l'adresse d'envoi de TikTok (`*.tiktokapis.com`) pour un brouillon vidéo |
| Fichiers lus / Files read | les médias que tu désignes (images vérifiées par leur contenu, vidéos, sons, `.srt`, polices), **dans le dossier de travail seulement par défaut** ; `VIRALDAR_LECTURE` l'élargit (dossiers en plus, ou `partout`) par ton choix explicite ; jamais dans un dossier caché / only in the working folder by default; `VIRALDAR_LECTURE` widens it, by your explicit choice; never in a hidden folder |
| Fichiers écrits / Files written | le dossier de travail (`~/viraldar`) ; la session (`~/.config/viraldar/session.json`, 600) ; `src/viraldar/` et `public/viraldar-medias/` d'un projet Remotion que tu désignes |
| Programmes lancés / Processes | ffmpeg/ffprobe, un Chrome/Chromium headless (sans réseau, sans script, CSP `default-src 'none'`), le CLI Remotion de ton projet ; toujours sans shell |
| Écoute / Listening | 127.0.0.1, port libre, pendant la connexion seulement (10 min au plus), une requête avec un `state` aléatoire de 256 bits et l'origine du site |

## La session / The session

`~/.config/viraldar/session.json` contient le jeton de rafraîchissement de la session de l'agent. Qui le lit agit en
ton nom sur viraldar (lecture de la base dans ton quota, tes listes, tes brouillons TikTok si tu as relié un compte),
sans pouvoir lire ton mot de passe. Il est créé en 600 (dossier 700), resserré à chaque démarrage. `deconnexion`
révoque la session côté viraldar et efface le fichier. Si tu penses qu'il a été copié : `deconnexion`, puis
`connexion` : le jeton copié ne se rafraîchit plus (le jeton d'accès en cours expire dans l'heure).

The file holds the agent session's refresh token: whoever reads it can act as you on viraldar (database within your
quota, your lists, your TikTok drafts if linked), not read your password. Mode 600, re-tightened at startup;
`deconnexion` revokes it server-side.

## Injection de prompt / Prompt injection

Les descriptions, sons et commentaires des posts sont du texte public écrit par des inconnus. Le serveur les rend entre
`⟦ ⟧`, sur une ligne, sans caractères de contrôle, avec la consigne de les traiter comme des données. Les garde-fous
ci-dessus (lecture, écriture, envoi, réseau) tiennent même si l'agent est trompé : aucun outil ne lit hors du dossier de travail
(sauf si tu as élargi la lecture) ni un fichier caché, n'envoie un fichier hors du dossier de travail, ni n'atteint une adresse locale.

Post texts are written by strangers and are returned between `⟦ ⟧`, flagged as data. The file, network and upload
limits above hold even if the agent is fooled.

## Chaîne d'approvisionnement / Supply chain

Dépendances épinglées à la version exacte, `package-lock.json` versionné, aucun script d'installation (`.npmrc` :
`ignore-scripts`), outils de construction à part (`outils/`). `js/` est compilé depuis `src/` ; `npm run verifier`
contrôle qu'ils coïncident.
