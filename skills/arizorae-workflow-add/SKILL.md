---
name: arizorae-workflow-add
description: "Ajouter un nouveau workflow IA à ArizoRAE (ex: /reseau pour relance réseau, /salaire pour négociation). Utilise ce skill quand on doit étendre les capacités du système avec un nouveau handler agent-worker, routing modèle, endpoint portal, et UI associée."
---

# Ajouter un nouveau workflow IA

## Pré-requis

- Nom du workflow (ex: `salaire`)
- Verbe métier clair (à quoi il sert)
- Modèle cible (opus / sonnet / haiku) décidé
- Inputs attendus et output attendu

## Checklist

### 1. Décision architecturale

Si le workflow change la logique métier du skill rae-generic, mettre à jour le `SKILL.md` du skill (upstream) ou créer un skill dédié. Ne pas fork le skill.

### 2. ADR si non trivial

Si le workflow introduit un nouveau mode (streaming, batch, multi-user) ou un nouveau modèle : écrire un ADR dans `docs/adr/`.

### 3. Ajouter au routing

Éditer `agent-worker/app/sdk_client.py` :
```python
WORKFLOW_MODELS["salaire"] = "claude-sonnet-4-6"
```
Mettre à jour `docs/adr/0002-model-routing.md` (tableau).

### 4. Créer le handler

`agent-worker/app/workflows/salaire.py` :
```python
async def run(user_id: UUID, offer_id: UUID, target: str) -> SalaireResult:
    job = await db.start_ai_job(user_id, workflow="salaire", model=WORKFLOW_MODELS["salaire"])
    try:
        api_key, which = quota.pick_api_key(user_id)
        system = sdk_client.build_cached_system(user_id)
        response = await sdk_client.call(...)
        await db.finish_ai_job(job.id, response.usage, status="done")
        return SalaireResult(...)
    except Exception as e:
        await db.finish_ai_job(job.id, None, status="error", error=str(e))
        raise
```

Respecter le pattern de `agent-worker/CLAUDE.md` (sans dévier).

### 5. Route FastAPI

`agent-worker/app/main.py` :
```python
@app.post("/workflows/salaire")
async def workflow_salaire(body: SalaireInput, _=Depends(auth_secret)):
    return await salaire.run(body.user_id, body.offer_id, body.target)
```

### 6. Endpoint portal

`portal/src/app/api/workflows/salaire/route.ts` :
- Vérifie auth user (session NextAuth).
- Appelle `agentClient.post('/workflows/salaire', ...)`.
- Retourne résultat (ou SSE stream).

### 7. UI

Ajouter un bouton/action dans la page pertinente (`offer-card` pour un workflow par offre, `settings` pour un workflow global).

### 8. Tests

- `agent-worker/tests/test_workflow_salaire.py` : mock SDK, vérifie model routing, cache_control, quota tracking.
- `portal/tests/e2e/salaire.spec.ts` : parcours user complet.

### 9. Documentation

- Mettre à jour `docs/GLOSSARY.md` si nouveaux termes métier.
- Mettre à jour `docs/ROADMAP.md` si le workflow est planifié dans un milestone.
- Si le workflow utilise un nouveau fichier MD dans `users_datas/<uid>/` : documenter dans `docs/adr/0004-user-data-layout.md`.

## Garde-fous

- Jamais appeler l'API Anthropic hors de `sdk_client.call()` (sinon pas de cache, pas de tracking, pas de quota).
- Jamais exposer `agent-worker` directement au client (toujours via Next API route).
- Jamais ajouter un workflow qui ignore le skill rae-generic : le skill est la source de vérité métier.

## Modèle

Ce méta-skill est appliqué manuellement (lecture humaine) ou par Claude Code lors d'un changement de codebase — pas invoqué par l'agent-worker en runtime.
