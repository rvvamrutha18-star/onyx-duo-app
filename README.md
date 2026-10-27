## ONYX DUO
### Verifiable Aviation Supply Chains. Accountable Component Lifecycles.

**Track:** Solana Agent Registry  
**Domain:** Aerospace · Supply-Chain Traceability · Digital Provenance  
**Stack:** Next.js · Express · PostgreSQL · Prisma · Solana Devnet

> **A component's history can be recorded. But can it be trusted?**
>
> In aviation, a missing certificate, an unverified maintenance record, or a falsified component history can undermine the confidence required to make critical airworthiness decisions. ONYX DUO is designed to make component histories traceable, lifecycle decisions accountable, and recorded evidence independently verifiable.

---

## 1. The Problem

Aircraft components can pass through manufacturers, suppliers, maintenance facilities, refurbishers, and operators over their service lives.

Yet the evidence describing that journey may be distributed across disconnected databases, documents, and maintenance records.

This creates three critical challenges:

- **Fragmented provenance:** Establishing a component's complete history becomes difficult when records are scattered across organisations.
- **Unverified evidence:** A document's existence does not establish its authenticity, and a component's recorded identity does not automatically prove its physical origin.
- **Weak lifecycle accountability:** Without consistent validation and traceable decisions, suspicious records or invalid lifecycle transitions can escape detection.

For safety-critical aviation, knowing what a record says is not enough. Organisations need ways to examine where evidence came from, whether it has changed, and whether a component's recorded history follows the required rules.

## 2. Our Solution

ONYX DUO is an aviation supply-chain traceability prototype designed to maintain a component's digital identity and lifecycle history while supporting compliance checks and cryptographic verification.

Each component can be represented by a digital record associated with its identifying information, supporting documentation, inspection results, maintenance events, and audit history.

The system is designed around five capabilities:

1. **Component identity:** Associate a component with a persistent digital record.
2. **Lifecycle traceability:** Record relevant events, including inspections, maintenance, refurbishment, and changes in ownership or custody.
3. **Compliance validation:** Evaluate lifecycle operations against defined rules before accepting permitted transitions.
4. **Tamper-evident auditability:** Link audit records using cryptographic hashes and verify digital signatures where applicable.
5. **Blockchain anchoring:** Support anchoring selected evidence on Solana Devnet, allowing submitted transaction signatures to be checked independently when the integration is configured and verified.

The objective is not to replace physical inspections, certified maintenance procedures, or regulatory approval. It is to strengthen the digital evidence and accountability surrounding component histories.

## 3. How It Works

```text
Component Registration
        |
        v
Digital Component Identity
        |
        v
Lifecycle Event Submission
        |
        v
Validation and Compliance Engine
        |
        +---- Invalid operation
        |          |
        |          v
        |      Reject operation
        |
        +---- Valid operation
                   |
                   v
           Record Lifecycle Event
                   |
                   v
          Cryptographic Audit Trail
                   |
                   v
       Optional Solana Devnet Anchoring
                   |
                   v
       Evidence and Transaction Verification
```

The architecture separates application records from blockchain evidence. PostgreSQL stores application data, while Solana anchoring is intended to provide an independently inspectable reference for selected records.

A blockchain transaction can demonstrate that particular data was submitted and anchored. It cannot, by itself, prove that the original physical component or the information supplied about it was genuine.

## 4. Architecture

ONYX DUO follows a layered web application architecture.

| Layer | Technology | Responsibility |
|---|---|---|
| Presentation | Next.js 14, React, TypeScript, Tailwind CSS | Dashboard, component registry, lifecycle views, and user interactions |
| API | Express, TypeScript, Zod | Request handling, input validation, and application endpoints |
| Business logic | Lifecycle state machine, compliance engine, RBAC | Lifecycle rules, compliance decisions, and role-based permissions |
| Persistence | PostgreSQL, Prisma | Structured records, database access, and schema management |
| Cryptographic and blockchain integration | TweetNaCl, Solana Web3.js, SPL Token | Signature verification, audit integrity, and optional on-chain operations |

### Data flow

1. A user initiates an operation through the web interface.
2. The frontend sends a request to the Express API.
3. The backend validates the request and applies the relevant business rules.
4. Permitted operations interact with the persistence layer and audit mechanisms.
5. Where configured, selected evidence can be submitted for Solana Devnet anchoring.
6. The application exposes the resulting records and verification status.

The Solana Agent Registry integration is currently an adapter boundary, not a completed live registration workflow.

## 5. Core Features

### Component Registry

Maintain digital component records and provide a central interface for examining their recorded information and lifecycle status.

### Lifecycle Management

Represent component lifecycle states and validate proposed transitions against the implemented state machine.

### Compliance Engine

Apply a set of 11 implemented compliance rules to supported operations. The corresponding unit tests reportedly passed in the original sandbox harness; they must be rerun in the target environment.

### Cryptographic Audit Trail

Use hash-linked audit records to help detect changes to recorded history. Digital signature verification supports checking whether signed data is valid for the corresponding public key.

### Solana Devnet Integration

The codebase includes a Solana memo anchoring path and Token-2022 minting code. Actual end-to-end execution has not yet been verified.

When real blockchain operations are not configured, the application is intended to distinguish simulated behaviour from confirmed on-chain activity.

### Role-Based Access Control

An implemented RBAC matrix defines role-based permissions within the application. Effective enforcement must be verified across the actual API routes and workflows.

### Demonstration Interface

The Next.js frontend provides an interface for exploring component records, lifecycle operations, compliance, audit activity, and related system functionality.

> **Verification principle:** Implemented code, passing tests, simulated responses, and confirmed blockchain transactions are different evidence categories. ONYX DUO is designed to distinguish them rather than present them as interchangeable.

## 6. Implementation Status

ONYX DUO is an active prototype. The following table describes the status reported by the development team, not a claim that every feature has been independently verified in a running environment.

| Component | Reported status |
|---|---|
| Lifecycle state machine | Implemented |
| Compliance engine: 11 rules | Implemented; 25 unit tests reportedly pass across the tested core |
| Audit hash-chain | Implemented; runtime verification pending |
| RBAC matrix | Implemented; end-to-end enforcement pending |
| Express API and Next.js frontend | Code implemented; full build and runtime integration unverified |
| Prisma schema and SQL migration | Written; database migration not yet verified |
| Ed25519 signature verification | Implemented; target-environment tests pending |
| Solana memo anchoring | Code implemented; real transactions unverified |
| Token-2022 minting | Code implemented; minting flow unverified |
| Solana Agent Registry | Adapter boundary only; live registration returns HTTP 501 |
| State Compression and Anchor program | Not implemented |
| Solana Wallet Adapter UI | Not implemented |
| IPFS or cloud file storage | Abstraction only; file hashes and metadata are stored, not file bytes |
| Development login | Intended for demonstration; blocked in production |

**Current limitation:** The complete application has not yet been compiled, run, and verified end-to-end. Build failures, integration issues, and configuration changes may need to be resolved before a reliable demonstration.

The project does not claim production readiness or completed live Solana Agent Registry registration.

## 7. Technology Stack

**Frontend**
- Next.js 14 with App Router
- React
- TypeScript
- Tailwind CSS
- lucide-react

**Backend**
- Node.js
- Express
- TypeScript
- Zod
- Prisma ORM

**Data and security**
- PostgreSQL
- JWT-based authentication
- Role-based access control
- TweetNaCl for Ed25519 signature verification
- Cryptographic hash-linked audit records

**Blockchain**
- Solana Web3.js
- SPL Token / Token-2022
- Solana Devnet for optional blockchain operations

## 8. Getting Started

### Prerequisites

- Node.js and npm
- Git
- PostgreSQL 16 or Docker Desktop
- PowerShell on Windows

The commands below describe the intended local setup. Because the complete application has not yet been tested end-to-end, successful installation and execution must be confirmed on the target machine.

### Step 1: Obtain the repository

```powershell
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd onyx-duo
```

If the source code is already on your machine, navigate to the project directory instead.

### Step 2: Start PostgreSQL

Using Docker, if the repository's Compose configuration is present:

```powershell
docker compose up -d
```

Configure the database credentials and connection string in `backend/.env`. Use the actual values required by your Compose configuration or PostgreSQL installation.

Example:

```ini
DATABASE_URL="postgresql://onyx:YOUR_PASSWORD@localhost:5432/onyx_duo"
JWT_SECRET="YOUR_GENERATED_RANDOM_SECRET"
```

Generate a strong random JWT secret locally. Never commit `.env` files or private keys.

### Step 3: Configure and start the backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `.env` and configure the database connection and JWT secret.

Then generate the Prisma client:

```powershell
npx prisma generate
```

**Database migration:** Review `prisma/schema.prisma`, the migration files, and the database state before applying migrations. The existing SQL migration was hand-written and has not been executed against PostgreSQL. Use a disposable development database for initial verification.

If the migration history is valid and the database is ready:

```powershell
npx prisma migrate deploy
npm run seed
npm run dev
```

The expected API address is:

`http://localhost:4000/api`

Check the health endpoint:

`http://localhost:4000/api/health`

A successful response such as `{"ok":true}` confirms that the health endpoint responds. It does not establish that database operations, authentication, or blockchain integration work.

### Step 4: Start the frontend

Open a second PowerShell window:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Configure any required frontend environment variables before launching the application.

The expected website address is:

`http://localhost:3000`

Both frontend and backend must be running for the intended full-stack workflow.

### Step 5: Run checks

From the backend directory:

```powershell
npm test
```

Inspect the scripts in each `package.json` and run the available build, lint, and TypeScript checks. For example, if the scripts exist:

```powershell
npm run build
npm run lint
```

Run the corresponding checks in both `backend` and `frontend` where applicable. Do not interpret a passing lint command as proof that the complete application works.

## 9. Optional: Solana Devnet

Real blockchain testing is optional and should begin only after the local application is functioning.

The intended integration requires Devnet mode, a throwaway development keypair, sufficient Devnet SOL, and the appropriate environment configuration.

Example configuration:

```ini
SOLANA_MODE=devnet
SOLANA_PAYER_SECRET_KEY=<THROWAWAY_DEVNET_KEYPAIR>
```

Use the format expected by the implementation and keep the key outside version control. Never use a production wallet or disclose a seed phrase.

After configuration, verify that the application submits an actual transaction, receives its transaction signature, and exposes that signature for independent inspection using the Solana Explorer configured for Devnet.

A changed interface badge is not sufficient evidence of a successful transaction.

The Agent Registry workflow remains incomplete and must not be represented as live registration.

## 10. Demonstration Scenario

A useful demonstration should follow one component through a verifiable workflow.

1. **Identify:** Open a component record and inspect its recorded identity and supporting metadata.
2. **Examine:** Review the available lifecycle history and associated audit evidence.
3. **Validate:** Submit a supported lifecycle operation and demonstrate the compliance engine's decision.
4. **Reject:** Attempt an invalid transition and show whether the backend rejects it.
5. **Verify:** Examine the audit record and demonstrate the applicable hash or digital-signature verification.
6. **Inspect blockchain evidence:** If real Devnet anchoring has been verified, open the actual transaction on Solana Explorer. Otherwise, explicitly demonstrate the simulated mode.

The demonstration should use a clearly labelled sample component and distinguish synthetic demonstration data from externally verified evidence.

## 11. Security and Trust Boundaries

ONYX DUO is a prototype, not a certified aviation maintenance or airworthiness system.

Its trust model has important limits:

- **Cryptographic integrity is not physical authenticity.** A valid hash or signature does not independently prove that a component is genuine.
- **Blockchain immutability is not truthfulness.** Incorrect information can still be recorded and anchored.
- **Digital identity requires governance.** Reliable provenance depends on trustworthy identities, authorised signers, and suitable verification procedures.
- **Permissions require enforcement.** The presence of an RBAC matrix does not alone establish secure access control.
- **Sensitive data must be protected.** Private keys, credentials, and production secrets must never be committed to Git.
- **Evidence availability matters.** The current storage abstraction does not store document bytes in IPFS or cloud storage.

Production deployment would require further security testing, operational controls, access-management review, data-governance procedures, and appropriate aviation-domain validation.

## 12. Project Roadmap

The next engineering priorities are:

- [ ] Compile and run the frontend and backend successfully.
- [ ] Verify database migrations and persistence against PostgreSQL.
- [ ] Test authentication, permissions, and lifecycle operations end-to-end.
- [ ] Verify audit-chain integrity and digital-signature behaviour.
- [ ] Demonstrate a genuine Solana Devnet transaction.
- [ ] Complete and test the Solana Agent Registry integration.
- [ ] Add integration tests and reproducible demonstration data.
- [ ] Evaluate document storage, key management, and production security requirements.

## 13. Why ONYX DUO?

ONYX DUO approaches aviation traceability as more than a record-keeping interface.

It combines lifecycle-aware application logic, compliance checks, cryptographic evidence, and a path toward independently verifiable blockchain anchoring.

The central idea is straightforward:

**Every component should have an examinable history. Every accepted transition should be accountable. Every verification claim should have evidence behind it.**

ONYX DUO is a prototype exploring how those principles can be applied to aviation supply chains.

---

**Built for:** Solana Agent Registry hackathon track  
**Project:** ONYX DUO  
**Status:** Prototype under development
