# Sources (consultées le 10/11/2026)

Ce qui vient de TikTok ou de la loi est une règle ; ce qui vient de praticiens ou d'éditeurs d'outils est une
anecdote ou une pratique, souvent intéressée, jamais vérifiée de façon indépendante : le skill les présente comme telles.

## TikTok (officiel)

- Creative best practices for performance ads — 9:16, ≥ 720p, proposition dans les 3 premières secondes, accroche dans
  les 6 premières, 5-10 mots par seconde à l'écran, sous-titres, style natif « pas trop léché », personnes à l'écran,
  3-5 créations nettement différentes à tester, renouveler quand la diffusion baisse.
  https://ads.tiktok.com/help/article/creative-best-practices?lang=en
- Community Guidelines — Integrity & authenticity : plusieurs comptes permis mais pas pour tromper ou contourner les
  règles ; faux engagement et spam interdits ; label obligatoire pour un contenu IA ou fortement retouché réaliste.
  https://www.tiktok.com/community-guidelines/en/integrity-authenticity
- Content Posting API — Photo post : jusqu'à 35 photos, `MEDIA_UPLOAD` envoie dans la boîte de réception (app ≥ 31.8),
  titre 90 caractères, description 4 000, `is_aigc`, client non audité limité au privé.
  https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
- Content Posting API — Upload video : au plus 5 envois en attente sur 24 h (`spam_risk_too_many_pending_share`),
  6 requêtes par minute, l'utilisateur termine la publication depuis la notification.
  https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
  https://developers.tiktok.com/doc/content-posting-api-get-started-upload-content/
- Mention de contenu commercial (« Contenu promotionnel » / « Partenariat rémunéré »).
  https://ads.tiktok.com/resources/help/article/how-to-turn-on-the-commercial-content-disclosure-setting-in-tiktok?lang=en
  https://ads.tiktok.com/business/en/blog/shedding-light-on-our-new-branded-content-policy

## Loi (France)

- Loi n° 2023-451 du 9 juin 2023 (influence commerciale) : « Publicité » ou « Collaboration commerciale » visible
  pendant toute la promotion ; « Image retouchée » ; « Image virtuelle » pour un visage ou une silhouette générés par IA.
  https://www.vie-publique.fr/loi/288793-loi-influenceurs-proposition-de-loi-delaporte-vojetta
  https://www.twobirds.com/en/insights/2023/france/promulgation-de-la-loi-visant-a-encadrer-l-influence-commerciale

## Relevés en production (oct.-nov. 2026)

Mesures faites par le propriétaire de viraldar sur ses propres comptes (niche citations, développement personnel) et
sur des comptes publics de cette niche, en production quotidienne. Une niche, des n petits : des repères, pas des lois.

- **Zones sûres** (`modeles/zones-sures.json`) : captures de deux téléphones Android (945 × 2048 le 26/09, 1080 × 2340
  le 15/10), description longue, le pire des deux gardé ; carrousel 3:4 sans description (29/10) ; aperçu du
  gestionnaire de publicités TikTok (17/10). Le centrage de l'image entre la barre d'état et le panneau de description
  vérifié à 1 px près sur la capture du 15/10.
- **Réglages de l'éditeur de texte TikTok** (police, graisse, corps, interligne, pavés, étiquette rouge) relevés sur des
  carrousels de la niche et reproduits dans le modèle `natif`.
- **Règle de lecture** des textes posés en vidéo : 0,25 s par mot, 2,5 s au moins (règle de production).
- **Apprentissages chiffrés** (`production.md` § 2 et § 6) : visites du store quasi nulles quand le produit n'est qu'un
  logo de fin (n = 26 jours) ; dérivés de gagnants autour de × 1,3 (n = 13) ; progression après 8 h (n = 12) ; carrousel
  contre vidéo selon le compte et la niche (n = 10 par branche ; n = 160 posts de 3 comptes) ; légendes et hashtags
  (n = 53 et n = 160) ; ouvertures sur écran noir et letterboxage (n = 15 par compte).
- **Formation d'éditeurs d'apps** (2026, rapportée, hors niche) : ~200 vues = l'accroche a échoué, on ne change qu'elle ;
  ~1 000 vues = l'accroche tient, le décrochage est en slide 2 ; 5-10 k = format validé ; deux accroches presque
  identiques jusqu'à × 50 d'écart ; ne jamais reposter le fichier exact. Entrée « à éprouver ».

## Praticiens et études de cas (anecdotes)

- Stronger Mobile (app de musculation) : 725 posts en 295 jours, 98 % des meilleurs posts sont des diaporamas ; slide 1
  = selfie + accroche de tension (« Grand-père avait raison ») ; slide 2-3 = la révélation qui montre l'app ; après un
  succès, même accroche et images voisines ; les « app name? » en commentaires entretiennent la curiosité.
  https://shortimize.com/blog/the-slideshow-strategy-that-generated-700000-users-in-275-days
- « Larry » (skill OpenClaw d'Oliver Henry) : diaporamas de 6 slides (accroche, problème, révélation, réaction, CTA,
  suivre), une même description de scène pour toutes les images, texte posé après la génération, envoi en brouillon puis
  son tendance ajouté à la main, accroche « [quelqu'un] doutait, alors je lui ai montré », boucle de diagnostic
  vues × conversions.
  https://www.stack-junkie.com/blog/how-to-automate-tiktok-marketing-with-openclaw-larry-skill-deep-dive
- Rayz AI : POV sans visage (clip de 2,5-3 s + texte POV puis capture de l'app), plusieurs comptes réutilisés d'une app à
  l'autre. À noter : les clips venaient d'autres créateurs — c'est précisément ce que le skill interdit.
  https://www.shortimize.com/blog/from-zero-to-80k-mrr-in-75-days-how-rayz-ai-mastered-tiktok-marketing
- Cal AI : une douzaine de comptes de marque (diaporamas, sans visage, face caméra) et des centaines de créateurs ; les
  meilleures vidéos parlaient à peine de l'app.
  https://stormy.ai/blog/cal-ai-tiktok-marketing-playbook
  https://blog.funnelfox.com/cal-ai-influencer-marketing/
- Contre-exemple : campagnes de faux UGC non déclarées (app Tea), contenus retirés après signalement à TikTok et à la FTC.
  https://indicator.media/p/crying-girls-will-make-you-rich-how-marketers-trick-users-with-mass-produced-organic-content-ugc-und

## Accroches, formats, diaporamas

- Accroche en trois couches (image, texte, voix), écart de curiosité tenu par la suite, lisible sans le son.
  https://www.opus.pro/blog/tiktok-hook-formulas
  https://captions.ai/blog/video-hooks-how-to-write-a-scroll-stopping-opening
- Diaporamas : 35 images au plus, 5-10 conseillées, une idée par slide, gros texte, « enregistre » pour les listes.
  https://ttcalculator.net/learn/tiktok-photo-carousel-engagement/
  https://metricool.com/tiktok-slideshow/
- Script UGC d'app : accroche, problème, découverte, résultat, CTA doux ; montrer le produit fonctionner à l'écran.
  https://magichour.ai/blog/how-to-make-ugc-style-video-ads
  https://www.rocketshiphq.com/how-to-create-ugc-ads-mobile-apps/
- Zones sûres (pas de chiffre officiel pour l'organique ; écarts entre sources, surtout en bas : 250 à 660 px) — d'où
  des marges prudentes et la vérification sur l'aperçu.
  https://www.socialync.io/tools/safe-zones/tiktok
  https://adaptlypost.com/blog/social-media-safe-zones-2026-complete-guide

## Outils à presets (pour situer viraldar)

- Higgsfield : presets en un clic (effets, mouvements de caméra), « Marketing Studio » (format → catégorie → style →
  produit → description de la scène), 5-10 accroches testées en clips courts avant le script complet, un format gagnant
  décliné en série. Des modèles génériques, non prouvés dans la niche : viraldar part, lui, des posts qui ont marché.
  https://higgsfield.ai/blog/ai-content-for-tiktok-2026
  https://creatify.ai/review/higgsfield-ai
