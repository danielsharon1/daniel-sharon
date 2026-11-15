---
name: plant-search
description: Search and compare Israeli plant listings by name, image, price and radius using authorized sources.
---

# Plant search skill

When the user requests a plant search, resolve species and synonyms, collect city/radius/price constraints, call the PlantFinder API when configured, and return grounded offers with source links and retrieval timestamps. If no API is configured, explain that live results are unavailable. Never invent offers or imply unverified distances. Distinguish unknown location and stale listings.

## Claude Code usage
Use the existing application API and shared types. Do not treat a prompt-only search as evidence of live listings. When no backend is running, clearly report the missing connection.
