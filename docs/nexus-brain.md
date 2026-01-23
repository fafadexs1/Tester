# Nexus Brain (Agent Block)

This build introduces a plug-and-play agent block with a modern memory system and smarter tool routing.

## What is new

- Memory Lattice: layered memory (semantic, episodic, procedural) with ranked retrieval.
- Memory Compiler: LLM-backed extraction of durable facts with a safety filter for sensitive data.
- Tool Shortlisting: auto-selects the most relevant tools per prompt to reduce noise.
- Target Handles: model/tools/memory connections are now stored in flow connections.

## Memory Lattice (how it works)

- Semantic memory: stable facts and preferences.
- Episodic memory: short, time-bound summaries of interactions.
- Procedural memory: repeated tool usage patterns (ready for future extensions).
- Retrieval: relevance + importance + recency scoring.

## Zero-config defaults

If no memory node is connected:

- Provider: Postgres
- Scope: session
- Retention: 14 days
- Max items: 60
- Min importance: 0.35

## How to use

1) Drag "Memory Config" into the canvas.
2) Connect its output to the Agent's "Memory" handle.
3) Choose provider + scope.
4) (Optional) Set a scope key variable for user-level memory, e.g. `{{user_id}}`.

## Optional drivers

- Redis: install `redis` and set `REDIS_URL` or a connection string.
- MariaDB: install `mysql2` and set `MARIADB_URL` or a connection string.

## Data safety

- Sensitive tokens (passwords, keys, IDs) are filtered out before storing.
- Episodic memory is time-bound by default.

## Next ideas

- Vector search (pgvector) and hybrid retrieval.
- Procedural memory from tool traces.
- Multi-tenant memory policies per workspace.
