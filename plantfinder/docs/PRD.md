# PlantFinder PRD

## Audience and problem
Israeli plant buyers currently search multiple nurseries, stores and local listings manually; plant names vary, sizes differ and location/price information is inconsistent.

## Core experience
Search via text or photo; normalize synonyms; compare listings with source, image, price in ILS, size, seller, location, distance when verified, availability when verified, retrieval timestamp and direct URL. Filter by max price, radius, seller type and species/variety. Sort by price, distance and freshness. Support Hebrew RTL and English.

## Delivery scope
Responsive web app, Chrome Manifest V3 extension, shared API, source adapters, optional accounts/saved searches, privacy/security controls, automated tests, operational docs. Initial market Israel.

## First benchmark
Query Monstera deliciosa (מונסטרה), Netanya, radius 25km, max 150 ILS, all supported sources. Distinguish exact matches, location unknown and outside radius; no fabricated offers.

## Non-goals for initial release
Guaranteed Facebook Marketplace coverage, scraping behind authentication, unsupported stock guarantees, automatic purchase, unverified distance estimates.

## Success metrics
At least 3 authorized source adapters, >=90% live source URLs, >=85% price accuracy, >=90% species accuracy in labeled sample; 20 repeat queries without critical failures. Record baseline latency and set achievable SLO after real-source testing.
