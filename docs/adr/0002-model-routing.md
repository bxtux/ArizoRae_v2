# ADR 0002 — Routage des modèles Claude par workflow

Statut : accepté
Date : 2026-04-21

## Contexte

Chaque workflow IA a un profil coût/qualité différent. Utiliser Opus partout coûte 5× à 15× plus cher que nécessaire. Le user a défini un routage précis dans le cahier des charges.

## Décision

Table de routage dure dans `agent-worker/app/sdk_client.py` (dict constant). Toute modification passe par une PR et une mise à jour de cet ADR.

| Workflow | Modèle | Justification |
|---|---|---|
| `/init` (onboarding) | `claude-opus-4-7` | One-shot, complexe, extraction CV + génération BULLET/FACTS |
| `/recherche` initiale | `claude-opus-4-7` | Sélection jobboards + scoring initial, qualité critique |
| scraper_gen | `claude-sonnet-4-6` | Code Python standard, sonnet suffit |
| scraper_demo | `claude-haiku-4-5` | Exécution simple + formatting |
| scraper_adapt | `claude-sonnet-4-6` | Édition ciblée de code |
| `/analyse` | `claude-sonnet-4-6` | Analyse textuelle, répétée fréquemment |
| `/cv`, `/lettre` | `claude-sonnet-4-6` | Génération documents, sélection > invention |
| mark_applied | `claude-haiku-4-5` | Simple toggle + audit log |
| `/entretien` | `claude-opus-4-7` | Préparation approfondie, one-shot par offre |
| chat (défaut) | `claude-haiku-4-5` | Réponses courtes |
| chat (escalade) | `claude-sonnet-4-6` | Détecté par classificateur : si user demande action complexe (adapter scraper, analyser, etc.) |

## Alternatives considérées

- **Tout en Sonnet** : simple mais perd qualité sur `/init` et `/entretien`, surcoûte sur chat et démo scraper.
- **Routage dynamique par complexité détectée** : rejeté car overhead et imprévisibilité coûts.

## Conséquences

- Ajouter un workflow → ajouter une entrée dans la table + le workflow handler.
- Tests unitaires sur `sdk_client.py` vérifient que chaque workflow mappe bien au modèle attendu.
- Escalade chat : simple heuristique keyword-based dans `chat.py`, pas de classifieur IA (autrement on paie pour décider).
