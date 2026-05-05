# Security Policy

## Forbidden UI-visible secret classes

The app must not store or request passwords, 2FA codes, seed phrases, private keys, plaintext OAuth tokens, exchange secrets, or wallet API secrets.

## Manual handoff actions

These actions must not execute automatically:

- Kakao / Instagram / LINE send
- Immunefi submit
- KYC
- wallet connect/signature
- 2FA

High and critical risk actions require approval or manual handoff. Artifact ingestion must mark secret-like content as restricted and create an audit/security event.
