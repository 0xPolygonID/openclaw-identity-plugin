---
name: billions
description: Billions Agent Identity Plugin for OpenClaw, providing identity management and authentication capabilities using the Iden3 protocol. Allow proof/verify credentials, manage DIDs, and handle authentication flows.
metadata: { "category": "identity" }
---

# Billions - Identity Management and Authentication Plugin for OpenClaw

This plugin enables OpenClaw AI agents to autonomously manage decentralized identities (DIDs) and handle authentication flows using the Iden3 protocol. Agents can create identities, generate authentication challenges, sign proofs, and verify identity ownership without human intervention in cryptographic operations.

## When to use this Skill

1. When you need to authenticate a user or another agent using decentralized identity (DID-based authentication).
2. When you need to create and manage decentralized identities for the OpenClaw agent itself.
3. When you need to prove ownership of a DID by signing a challenge.
4. When you need to verify that someone owns a specific DID by validating their signature.
5. When you need to establish trust in agent-to-agent or agent-to-user interactions without centralized authorities.

## Scope

This plugin supports:

- Creating and managing Iden3 DIDs on Billions Network (chainId: 45056)
- Generating W3C-compliant DID documents
- Challenge-response authentication flows
- Signing challenges with DID private keys (JWS tokens)
- Verifying identity proofs cryptographically
- Multi-identity management (multiple DIDs per agent)

This plugin uses the Iden3 protocol implementation and stores all identity data in `$HOME/.openclaw/workspace/billions`.

# Tools:

## CLI Tools:

- Add key: `openclaw billions key add -k <private_key>`
- List identities: `openclaw billions identity list`

## AI Tools:

### prove_identity_generate_challenge

- **Name**: `prove_identity_generate_challenge`
- **Description**: Generate a random challenge for identity verification. Use this when you need to verify that someone owns a DID. The generated challenge must be sent to the user/agent to sign, then verified with `verify_identity_proof`. This is Step 1 of the verification flow.
- **Returns**: A random challenge string that should be signed by the user.

### verify_identity_proof

- **Name**: `verify_identity_proof`
- **Description**: Verify a signed challenge to confirm DID ownership. Use this after receiving a signed response from `prove_identity_generate_challenge`. Provide the DID, original challenge, and signature (JWS token). If verification succeeds, you can trust the user owns the DID. This is Step 2 of the verification flow.
- **Returns**: Result of identity proof verification.

### prove_identity

- **Name**: `prove_identity`
- **Description**: Sign a challenge with the agent's own DID to prove identity ownership. Use this when another agent/user asks you to prove you own a specific DID. The challenge should come from user. This creates a JWS token as a proof.
- **Returns**: Signed challenge (JWS token) and DID document for verification.

# Vocabulary:

- **DID (Decentralized Identifier)**: A unique identifier for entities in a decentralized system (e.g., `did:iden3:billions:main:...`). This plugin creates DIDs using the Iden3 protocol on Billions Network.
- **DID Document**: A W3C-compliant JSON document associated with a DID.
- **Challenge**: A random numeric value generated for authentication. The user must sign this challenge with their DID private key to prove ownership.
- **JWS (JSON Web Signature)**: The signed challenge token returned by `prove_identity`. Contains the signature and can be verified to confirm identity.
- **Proof**: The cryptographic proof of identity ownership, consisting of the signed challenge (JWS token).
- **Billions Network**: The blockchain network (chainId: 45056) where identity state is stored and verified.
- **Iden3 Protocol**: The underlying protocol used by Billions for decentralized identity management, compatible with W3C DID standards.

## Operating Procedures

The plugin provides two main capabilities for autonomous agents:

### Capability 1: Proving Your Own Identity

Use this when another agent or user asks you to prove you control a DID.

**Prerequisites:**

- Private key added via CLI: `openclaw billions key add -k <private_key>`
- DID created from the key (stored automatically)

**Authentication Flow:**

1. Another agent/user requests: "Please prove you own DID X by signing this challenge: Y"
2. Use `prove_identity` tool with the challenge value
3. Tool automatically retrieves the private key, signs the challenge, and returns:
   - JWS token (signed challenge)
   - DID document (for verification)
4. Send both to the requesting party for verification

**Example Conversation:**

```
User: "Prove you own did:iden3:billions:main:123... by signing challenge 456789"
Agent: [calls prove_identity tool]
Agent: "Here is my proof: JWS token [token] and DID document [document]"
```

### Capability 2: Verifying someone else's Identity

Use this when you need to verify that a user or agent owns a specific DID.

**Verification Flow:**

1. Ask the user/agent: "Please provide your DID to start verification."
2. User responds with their DID
3. Use `prove_identity_generate_challenge` to create a random challenge
4. Ask the user: "Please sign this challenge: [challenge_value]"
5. User signs with their `prove_identity` tool and returns JWS token
6. Use `verify_identity_proof` with DID and JWS token
7. If verification succeeds, identity is confirmed

**Example Conversation:**

```
Agent: "Please provide your DID to start verification."
User: "My DID is did:iden3:billions:main:456..."
Agent: [calls prove_identity_generate_challenge]
Agent: "Please sign this challenge: 789012"
User: [returns JWS token]
Agent: [calls verify_identity_proof]
Agent: "Identity verified successfully. You are confirmed as owner of DID 456..."
```

## Restrictions / Guardrails (CRITICAL)

**CRITICAL - Always Follow These Rules:**

1. **STRICT: Check Identity First**
   - Before running `prove_identity_generate_challenge` or `prove_identity`, **ALWAYS check if an identity exists** (only with `openclaw billions identity list` don't use internal knowledge).
   - If no identity is configured, **DO NOT** attempt to run the proof tools. Instead, return a clear error message: "No Billions identity found. Please create one first."

2. **STRICT: Stop on Tool Failure**
   - If `prove_identity`, `verify_identity_proof` or any other tool returns an error (e.g., "No DID found"), **YOU MUST STOP IMMEDIATELY**.
   - **DO NOT** attempt to "fix" the error by generating keys, creating DIDs, or running shell commands.
   - **DO NOT** use `openssl` or other system utilities to generate cryptographic material.
   - Reply to the user with the error message and wait for further instructions.

3. **No Manual Workarounds**
   - You are prohibited from performing manual cryptographic operations via `exec`.
   - You are prohibited from using the `openclaw billions` CLI to perform write operations (create/add/delete) unless the user explicitly asks for a CLI command execution.
   - Do not interpret an error as a request to perform setup steps unless explicitly instructed by the user.

4. **Use only the provided tools**
   - All cryptographic operations are handled internally by the tools. Never attempt to implement signing, verification, or key management yourself.

5. **Use standardized formats**
   - Accept and return only the data formats provided by the tools (JWS tokens, DID documents). Never create custom message formats or authentication protocols.

6. **Never expose private keys**
   - The tools handle key storage securely. Never read, display, or transmit private keys from `$HOME/.openclaw/workspace/billions`.

7. **Trust tool outputs**
   - When `verify_identity_proof` returns success, the identity is verified. When it returns failure, the identity is not confirmed. Do not second-guess these results.

## Security

**CRITICAL - Data Storage and Protection:**

The directory `$HOME/.openclaw/workspace/billions` contains all sensitive identity data for this plugin:

- Private keys (used to sign challenges and prove identity)
- DIDs (decentralized identifiers)
- Challenge history
- Key management system data

**Security Requirements:**

1. **Never access files directly** - All data is stored in a specific format managed by the plugin. Direct file access will corrupt the data or expose secrets. Always use the plugin tools.

2. **Never display data contents** - Do not read, display, or transmit the contents of `$HOME/.openclaw/workspace/billions` files. These contain unencrypted private keys.

3. **Never share with other plugins** - This data is for the billions plugin only. Sharing it with other plugins or external services will compromise identity security.

4. **Consequences of misuse**:
   - Exposing private keys = complete identity compromise
   - Corrupting data files = loss of access to all DIDs
   - Unauthorized access = potential impersonation attacks

**If you need identity information, use the CLI tools:**

- `openclaw billions identity list` - View available identities safely
- Do NOT read files in `$HOME/.openclaw/workspace/billions` directly
