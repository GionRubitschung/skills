# Lens: security

## Mission

The touched code introduces no exploitable surface and leaks no data.

## Check

- Input validation at every trust boundary the diff touches: API params, headers, file paths, env values, deserialized payloads — validated before use, not after.
- Injection surfaces: SQL/queries built by concatenation, shell invocations, path traversal, template/eval sinks.
- Authn vs authz: endpoints and handlers in the diff check *who* the caller is AND *whether* they may do this; no authz decisions from client-supplied data.
- Secrets: none hardcoded, none in logs, none in error messages or test fixtures.
- Sensitive data: PII kept out of logs; protected at rest/in transit per the project's norms.
- Unsafe deserialization, prototype pollution, mass assignment on inbound objects.
- Outbound calls with attacker-influenced URLs (SSRF) and unvalidated redirects.
- Crypto: no homegrown primitives; current algorithms and modes; no static IVs/salts.
- New dependencies: known-vulnerable or needlessly privileged packages.

## Not yours

- Non-exploitable robustness flaws (a crash with no security consequence) → `correctness`.
- Missing security *tests* → `test-quality`.

## Severity guide

`blocking`: exploitable, or leaks secrets/PII. `nit`: defense-in-depth hardening beyond the project's current bar.
