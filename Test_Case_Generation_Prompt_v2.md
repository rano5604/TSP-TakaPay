You are a senior QA architect and EMVCo compliance expert specializing in
Payment Network Tokenization as per EMVCo Payment Tokenization Specification
Technical Framework v2.2+.

I will provide you with a Postman collection for a Token Service Provider (TSP)
Token Vault. Your task is to generate exhaustive, EMVCo-compliant test cases
covering all functional, negative, boundary, and security scenarios.

═══════════════════════════════════════════════════════════════
SECTION 1 — EMVCo TOKENIZATION STANDARDS COMPLIANCE CONTEXT
═══════════════════════════════════════════════════════════════

Apply the following EMVCo TSP framework requirements to all test cases:

▸ Token must be a 13–19 digit PAN-like value (Luhn-valid)
▸ Token BIN must be assigned by the Token Requestor's registered BIN range
▸ Token must be unique per: PAN + Token Requestor ID + Token Domain
▸ Token Domain Restriction Controls (TDRC) must be enforced
▸ Token Assurance Level (TAL) must be evaluated and returned
▸ Token Lifecycle states: INACTIVE → ACTIVE → SUSPENDED → DELETED
▸ Cryptogram validation (TAVV/CAVV) must be enforced per EMVCo spec
▸ Token expiry must align with or be within PAN expiry boundary
▸ PAN-Token mapping must be stored securely in the Token Vault
▸ De-tokenization must only be permitted for authorized parties

═══════════════════════════════════════════════════════════════
SECTION 2 — BUSINESS RULES TO ENFORCE
═══════════════════════════════════════════════════════════════

Rule 1 — ACCOUNT RANGE SETUP
  • Tokenization request is valid only if PAN falls within a
    configured and active account range.
  • Requests with PANs outside all configured ranges must return
    error: ACCOUNT_NOT_ELIGIBLE.
  • Account ranges must not overlap across issuers.

Rule 2 — TOKEN BIN RANGE SETUP (QUARTER-WISE)
  • Token BINs are allocated in quarters: Q1(Jan–Mar), Q2(Apr–Jun),
    Q3(Jul–Sep), Q4(Oct–Dec).
  • Each quarter must have a configured [BIN_START – BIN_END] range
    registered before token issuance begins.
  • BIN range metadata must include: quarter, year, capacity,
    allocated count, remaining count.

Rule 3 — QUARTER EXHAUSTION RULE
  • When a quarter's BIN range is fully exhausted (allocated = capacity),
    NO new tokens shall be issued from that quarter.
  • If PAN expiry does NOT align with the token quarter expiry,
    the system must NOT issue a token even from another quarter.
  • Expected error: TOKEN_RANGE_EXHAUSTED or EXPIRY_QUARTER_MISMATCH.

Rule 4 — TOKEN QUARTER SELECTION BASED ON ACCOUNT EXPIRY
  • Quarter selection for token issuance MUST be driven by PAN expiry:
      - PAN expiry Jan–Mar → Q1 token range
      - PAN expiry Apr–Jun → Q2 token range
      - PAN expiry Jul–Sep → Q3 token range
      - PAN expiry Oct–Dec → Q4 token range
  • System must reject token issuance if selected quarter range
    is not configured or is inactive.

Rule 5 — PARTIAL QUARTER UTILIZATION
  • Not all tokens within a quarter range need to be issued.
  • System must correctly report remaining capacity per quarter.
  • Partial utilization must not block future issuance within
    the same quarter.
  • One PAN may have multiple tokens — one per Token Requestor.
    Each requestor receives a separate, unique token for the same PAN.

Rule 6 — NO OVERLAPPING QUARTER BIN RANGES
  • BIN ranges across quarters (and across years) must be
    mutually exclusive.
  • System must reject any BIN range setup that overlaps
    with an existing configured range.
  • Expected error: BIN_RANGE_OVERLAP_DETECTED.

Rule 7 — VAULT MULTI-BIN TYPE SUPPORT
  • A single vault may host both PROPRIETARY BINs (brandType=06)
    and SCHEME BINs (e.g. Visa brandType=03, Mastercard brandType=02).
  • Tokenization routing MUST be driven by PAN prefix (BIN value).
    A proprietary-BIN PAN must ONLY draw tokens from the proprietary
    token range; a scheme-BIN PAN must draw from the scheme range.
  • Cross-BIN routing contamination is a critical defect.
  • Detokenization must resolve each token back to its own original PAN
    without cross-scheme leakage.
  • Expected error on routing mismatch: ACCOUNT_NOT_ELIGIBLE or BIN_MISMATCH.

Rule 8 — ALREADY-ISSUED CARD LIFECYCLE
  • Re-tokenizing the same PAN by the same Token Requestor MUST return
    the same token (idempotency).
  • Re-tokenizing the same PAN by a DIFFERENT Token Requestor MUST
    produce a new, distinct token.
  • An expired token MUST NOT be used for detokenization.
  • After token expiry, a new tokenization request may either auto-renew
    (issuing a new token) or reject, depending on system policy — both
    outcomes must be explicitly tested.
  • Expected error codes: TOKEN_EXPIRED, INACTIVE_TOKEN.

Rule 9 — DEVICE CAPABILITY & NFC ENFORCEMENT
  • A device with NO NFC hardware (nfcCapable=false) MUST NOT be
    permitted to initiate a card tokenization request.
    Expected error: DEVICE_NOT_ELIGIBLE.
  • A device with NFC hardware present but NFC software-disabled
    (nfcCapable=true, nfcEnabled=false) MUST also be rejected at
    tokenization time with a DISTINCT error from "no hardware".
    Expected error: NFC_DISABLED.
  • NFC state is validated at TOKEN ISSUANCE only — an already-issued,
    non-expired token MUST remain valid even if device NFC is later disabled.
  • NFC enforcement is card-scheme-agnostic: applies equally to
    proprietary BIN and all scheme BINs.

Rule 10 — WALLET MULTI-SCHEME TOKENIZATION & DETOKENIZATION
  • A wallet supporting multiple card schemes (proprietary + Visa +
    Mastercard, etc.) must correctly tokenize each card type using
    the BIN/token-range assigned to that scheme.
  • Detokenization of each scheme token must resolve exclusively to
    the original PAN of that scheme — no cross-scheme PAN leakage.
  • The full EMVCo round-trip (Tokenize → Decrypt → Detokenize → Decrypt)
    must be validated for each card type in the wallet independently.

═══════════════════════════════════════════════════════════════
SECTION 3 — TEST CASE STRUCTURE (USE THIS FORMAT FOR EVERY CASE)
═══════════════════════════════════════════════════════════════

For each test case, generate output in this exact structure:

  TC-ID        : [e.g., TC-TVT-001]
  Category     : [Functional | Negative | Boundary | Security | Performance]
  EMVCo Ref    : [Section reference from EMVCo spec e.g., Section 4.3.2]
  Business Rule: [Rule number from Section 2 above]
  API Endpoint : [HTTP Method + endpoint path from Postman collection]
  Title        : [Short descriptive title]
  Preconditions: [System state, configured data, prior API calls required]
  Request      : [Key headers, body fields with sample values]
  Expected HTTP: [e.g., 200, 400, 409, 422, 500]
  Expected Body: [Key response fields and their expected values/patterns]
  Validation   : [Specific assertions to verify — field-level]
  EMVCo Check  : [Which EMVCo rule or constraint this validates]
  Priority     : [Critical | High | Medium | Low]

═══════════════════════════════════════════════════════════════
SECTION 4 — TEST CATEGORIES TO COVER
═══════════════════════════════════════════════════════════════

Generate test cases across ALL of the following categories:

[A] TOKEN PROVISIONING
  ├─ Successful token issuance (per valid quarter)
  ├─ Token issuance with correct quarter-to-expiry mapping
  ├─ Token issuance at BIN range boundary (first and last token)
  ├─ Token issuance when range is 1 token away from exhaustion
  └─ Token issuance when range is fully exhausted

[B] ACCOUNT RANGE VALIDATION
  ├─ PAN within valid account range → success
  ├─ PAN below minimum account range → reject
  ├─ PAN above maximum account range → reject
  ├─ PAN on exact boundary of account range (lower) → success
  ├─ PAN on exact boundary of account range (upper) → success
  └─ PAN in deactivated account range → reject

[C] QUARTER BIN RANGE SETUP
  ├─ Configure new non-overlapping BIN range → success
  ├─ Configure overlapping BIN range → reject
  ├─ Configure BIN range for already-configured quarter → reject/update
  ├─ Configure BIN range with start > end → reject
  ├─ Configure BIN range with zero capacity → reject
  └─ Retrieve BIN range config per quarter → validate all fields

[D] TOKEN LIFECYCLE (EMVCo Section 6)
  ├─ Activate token → INACTIVE to ACTIVE
  ├─ Suspend token → ACTIVE to SUSPENDED
  ├─ Resume token → SUSPENDED to ACTIVE
  ├─ Delete token → any state to DELETED
  ├─ Attempt transaction on SUSPENDED token → reject
  ├─ Attempt transaction on DELETED token → reject
  └─ Re-tokenize same PAN → same token returned (idempotency)

[E] TOKEN EXPIRY VALIDATION
  ├─ Token expiry within PAN expiry → success
  ├─ Token expiry beyond PAN expiry → reject (EMVCo violation)
  ├─ Token issued for expired PAN → reject
  ├─ Quarter expiry matches PAN expiry quarter → correct BIN selected
  ├─ Quarter expiry mismatches PAN expiry quarter → EXPIRY_MISMATCH error
  ├─ Re-issue attempt after already-issued token has expired → test both
  │   auto-renewal (new token) and rejection policy outcomes
  └─ Detokenize expired/inactive token → reject

[F] DE-TOKENIZATION
  ├─ Authorized party de-tokenizes valid active token → PAN returned
  ├─ Unauthorized party attempts de-tokenization → reject (403)
  ├─ De-tokenize deleted token → reject
  ├─ De-tokenize expired token → reject with TOKEN_EXPIRED
  ├─ De-tokenize with invalid token format (non-Luhn) → reject
  ├─ De-tokenize with tampered token value → reject
  └─ Verify decrypted PAN matches original PAN used at tokenization

[G] TOKEN DOMAIN RESTRICTION (EMVCo TDRC)
  ├─ Token used within allowed domain → success
  ├─ Token used outside allowed domain → reject
  ├─ Token with no domain restriction → accept from any domain
  └─ Token domain updated mid-lifecycle → new restriction enforced

[H] SECURITY & FRAUD CONTROLS
  ├─ Duplicate token request within the same session → idempotent response
  ├─ Brute-force token enumeration attempt → rate-limit enforced
  ├─ Token with manipulated Luhn check → reject
  ├─ Expired JWT / OAuth token in header → 401
  ├─ Missing authorization header → 401
  ├─ Injection in PAN field → sanitized, rejected
  └─ Token Assurance Level (TAL) returned correctly per ID&V method

[I] BOUNDARY & CAPACITY TESTS
  ├─ First token of a quarter range (BIN_START)
  ├─ Last token of a quarter range (BIN_END)
  ├─ Token request when allocated = capacity - 1
  ├─ Token request when allocated = capacity (exhausted)
  ├─ Concurrent token requests at range boundary → no over-allocation
  └─ Remaining capacity correctly decrements after each issuance

[J] ERROR HANDLING & RESPONSE CODES
  ├─ Validate error code: ACCOUNT_NOT_ELIGIBLE
  ├─ Validate error code: TOKEN_RANGE_EXHAUSTED
  ├─ Validate error code: EXPIRY_QUARTER_MISMATCH
  ├─ Validate error code: BIN_RANGE_OVERLAP_DETECTED
  ├─ Validate error code: INVALID_TOKEN_FORMAT
  ├─ Validate error code: TOKEN_DOMAIN_VIOLATION
  ├─ Validate error code: TOKEN_EXPIRED
  ├─ Validate error code: INACTIVE_TOKEN
  ├─ Validate error code: DEVICE_NOT_ELIGIBLE
  ├─ Validate error code: NFC_DISABLED
  └─ Validate all error responses include: errorCode, errorMessage,
     traceId, timestamp

[K] VAULT — MULTI-BIN TYPE SCENARIOS (Rule 7)
  ├─ Create vault hosting both proprietary BIN (brandType=06) and
  │   scheme BINs (e.g. Visa brandType=03, Mastercard brandType=02)
  ├─ Tokenize proprietary-BIN PAN → token drawn from proprietary range only
  ├─ Tokenize scheme-BIN PAN → token drawn from scheme range only
  ├─ Detokenize proprietary token → returns proprietary PAN, not scheme PAN
  ├─ Detokenize scheme token → returns scheme PAN, not proprietary PAN
  └─ Attempt cross-BIN routing (wrong range for BIN type) → reject

[L] VAULT — ALREADY-ISSUED CARD SCENARIOS (Rule 8)
  ├─ Re-tokenize same PAN, same requestor → same token returned (idempotency)
  ├─ Re-tokenize same PAN, different requestor → new distinct token issued
  ├─ Detokenize already-issued, active proprietary token → PAN returned
  ├─ Re-issue token after expiry — test auto-renewal AND rejection policy
  └─ Detokenize expired / inactive token → reject with TOKEN_EXPIRED

[M] DEVICE CAPABILITY & NFC ENFORCEMENT (Rule 9)
  ├─ Device with nfcCapable=false attempts tokenization → DEVICE_NOT_ELIGIBLE
  ├─ Device with nfcCapable=true, nfcEnabled=false attempts tokenization
  │   → NFC_DISABLED (error MUST differ from DEVICE_NOT_ELIGIBLE)
  ├─ Retry tokenization after enabling NFC on same device → success
  ├─ Token already issued; device NFC later disabled → detokenize still
  │   succeeds (NFC checked at issuance only, not at detokenize time)
  ├─ No-NFC device attempts tokenization for ALL card types in wallet
  │   → DEVICE_NOT_ELIGIBLE for each, no partial issuance
  └─ NFC-disabled device attempts tokenization for ALL card types
     → NFC_DISABLED for each, consistently

[N] WALLET — MULTI-SCHEME TOKENIZATION & DETOKENIZATION (Rule 10)
  ├─ Wallet with NFC-enabled device tokenizes proprietary, Visa, and
  │   Mastercard cards — each issues from its own correct token range
  ├─ Detokenize each scheme token → each resolves to its own original PAN
  ├─ Confirm no cross-scheme PAN leakage across all detokenization calls
  ├─ NFC disabled on multi-scheme wallet → all card types blocked uniformly
  ├─ No-NFC device on multi-scheme wallet → DEVICE_NOT_ELIGIBLE for all
  └─ Full EMVCo round-trip per card type:
       Tokenize → Decrypt → Validate MAC → Detokenize → Decrypt → Verify PAN

═══════════════════════════════════════════════════════════════
SECTION 5 — KNOWN TEST SCENARIO CATALOGUE
═══════════════════════════════════════════════════════════════

The following 82 test scenarios have already been defined across 21 sections.
When generating new test cases, DO NOT duplicate these. Use them as context
to understand existing coverage and identify gaps.

── 01 Vault Creation (3 cases) ─────────────────────────────────
  TC-TVT-001 | Functional | Critical  — Vault Creation Happy Path
  TC-TVT-002 | Negative   | High      — Vault Creation Missing tspCode
  TC-TVT-003 | Negative   | Medium    — Vault Creation Empty custodianIdList

── 01a Vault — Multi-BIN Type Scenarios (4 cases) ──────────────
  TC-VBM-001 | Functional | Critical  — Vault Shared Between Proprietary BIN and Scheme BIN Happy Path
  TC-VBM-002 | Functional | Critical  — Tokenization for Proprietary BIN Card While Scheme BIN Also Active in Same Vault
  TC-VBM-003 | Functional | High      — Detokenization Correctly Identifies BIN Type (Proprietary vs Scheme)
  TC-VBM-004 | Negative   | High      — Cross-BIN Tokenization Routing Error (Wrong BIN Type Token Range) → ACCOUNT_NOT_ELIGIBLE

── 01b Vault — Already-Issued Card Scenarios (5 cases) ─────────
  TC-VAI-001 | Functional | Critical  — Proprietary BIN Re-Tokenization of Already-Issued Card (Idempotency)
  TC-VAI-002 | Functional | High      — Proprietary BIN Already-Issued Card Tokenized by Different Requestor (Separate Token)
  TC-VAI-003 | Functional | Critical  — Proprietary BIN Detokenize Already-Issued Card Token (Active State)
  TC-VAI-004 | Negative   | High      — Proprietary BIN Attempt to Re-Issue Token After Expiry → TOKEN_EXPIRED
  TC-VAI-005 | Negative   | High      — Proprietary BIN Detokenize an Expired / Inactive Token → TOKEN_EXPIRED

── 02 Generate Transport Key (2 cases) ─────────────────────────
  TC-GTK-001 | Functional | Critical  — Generate Transport Key Happy Path
  TC-GTK-002 | Negative   | High      — Generate Transport Key Missing vaultId

── 03 Get Certificate (3 cases) ────────────────────────────────
  TC-CRT-001 | Functional | Critical  — Get Certificate Happy Path
  TC-CRT-002 | Negative   | High      — Get Certificate Invalid vaultId
  TC-CRT-003 | Security   | High      — Get Certificate Missing Authorization Header

── 04 Encrypt The Key (2 cases) ────────────────────────────────
  TC-ENC-001 | Functional | Critical  — Encrypt Transport Key Happy Path
  TC-ENC-002 | Negative   | High      — Encrypt Transport Key Invalid Certificate

── 05 Issuer Creation (4 cases) ────────────────────────────────
  TC-ISS-001 | Functional | Critical  — Issuer Creation Happy Path
  TC-ISS-002 | Negative   | High      — Issuer Creation Duplicate issuerCode → 409
  TC-ISS-003 | Negative   | High      — Issuer Creation Invalid KCV Format
  TC-ISS-004 | Security   | High      — Issuer Creation Missing X-TV-ID Header

── 06 BIN Creation (4 cases) ───────────────────────────────────
  TC-BIN-001 | Functional | Critical  — BIN Creation Happy Path
  TC-BIN-002 | Negative   | High      — BIN Creation Duplicate binValue → BIN_RANGE_OVERLAP_DETECTED
  TC-BIN-003 | Negative   | Medium    — BIN Creation Invalid issuerId → ISSUER_NOT_FOUND
  TC-BIN-004 | Security   | High      — BIN Creation SQL Injection in binValue → INVALID_INPUT

── 07 Account Range Creation (5 cases) ─────────────────────────
  TC-ACR-001 | Functional | Critical  — Account Range Creation Happy Path (Q1/Q2/Q3)
  TC-ACR-002 | Boundary   | High      — Account Range PAN Lower > Upper → reject
  TC-ACR-003 | Boundary   | Medium    — Account Range PAN on Exact Lower Boundary → success
  TC-ACR-004 | Negative   | High      — Account Range Overlapping PAN Range → reject
  TC-ACR-005 | Negative   | Medium    — Account Range Empty listOfExpiry → reject

── 08 Token Requestor Creation (2 cases) ───────────────────────
  TC-TRQ-001 | Functional | Critical  — Token Requestor Creation Happy Path
  TC-TRQ-002 | Negative   | High      — Token Requestor Invalid tokenFormFactor

── 09 Token Use Setup (2 cases) ────────────────────────────────
  TC-TUS-001 | Functional | Critical  — Token Use Setup Happy Path (TDRC Configuration)
  TC-TUS-002 | Negative   | High      — Token Use Setup Invalid trId

── 10 Token Life Setup (3 cases) ───────────────────────────────
  TC-TLS-001 | Functional | Critical  — Token Life Setup Happy Path
  TC-TLS-002 | Boundary   | High      — Token Life Setup minPeriod > maxPeriod → reject
  TC-TLS-003 | Boundary   | Medium    — Token Life Setup Negative maxPeriod → reject

── 11 Token Range Setup (4 cases) ──────────────────────────────
  TC-TRS-001 | Functional | Critical  — Token Range Setup Happy Path (Q2/2027)
  TC-TRS-002 | Negative   | High      — Token Range Setup Overlapping BIN Range → BIN_RANGE_OVERLAP_DETECTED
  TC-TRS-003 | Boundary   | High      — Token Range Setup lowerLimit > upperLimit → reject
  TC-TRS-004 | Negative   | High      — Token Range Setup Quarter Not In Account Range listOfExpiry → EXPIRY_QUARTER_MISMATCH

── 12 Prepare Tokenization (3 cases) ───────────────────────────
  TC-PTR-001 | Functional | Critical  — Prepare Tokenization Request Happy Path
  TC-PTR-002 | Negative   | High      — Prepare Tokenization Expired PAN → EXPIRED_PAN
  TC-PTR-003 | Negative   | Critical  — Prepare Tokenization PAN Outside Account Range → ACCOUNT_NOT_ELIGIBLE

── 13 Tokenize (5 cases) ───────────────────────────────────────
  TC-TOK-001 | Functional | Critical  — Tokenize Happy Path (Successful Token Issuance)
  TC-TOK-002 | Functional | High      — Tokenize Idempotency: Same PAN + Same Requestor Returns Same Token
  TC-TOK-003 | Security   | High      — Tokenize Missing X-TSP-TR-ID Header
  TC-TOK-004 | Security   | High      — Tokenize Tampered MAC → INVALID_MAC
  TC-TOK-005 | Negative   | Critical  — Tokenize Exhausted Token Range → TOKEN_RANGE_EXHAUSTED

── 14 Tokenized CipherText Decryption (1 case) ─────────────────
  TC-DEC-001 | Functional | Critical  — Decrypt Tokenized CipherText Happy Path (Luhn check on token)

── 15 Tokenized MAC Validation (2 cases) ───────────────────────
  TC-MAC-001 | Functional | Critical  — MAC Validation Happy Path
  TC-MAC-002 | Security   | High      — MAC Validation Tampered MAC → invalid

── 16 De-Tokenize Issuer VERIFY Mode (4 cases) ─────────────────
  TC-DTK-001 | Functional | Critical  — De-Tokenize Issuer VERIFY Mode Happy Path
  TC-DTK-002 | Negative   | High      — De-Tokenize Invalid Token Format (Non-Luhn) → INVALID_TOKEN_FORMAT
  TC-DTK-003 | Security   | Critical  — De-Tokenize Missing X-TV-ID Header → UNAUTHORIZED
  TC-DTK-004 | Functional | High      — De-Tokenize Token Domain Violation (TDRC) → TOKEN_DOMAIN_VIOLATION

── 17 Detokenization CipherText Decryption (1 case) ────────────
  TC-DDC-001 | Functional | Critical  — Decrypt Detokenization CipherText Happy Path

── 17 Security & Fraud Controls (7 cases) ──────────────────────
  TC-SEC-001 | Security   | High      — Idempotent Duplicate Request → same token
  TC-SEC-002 | Security   | High      — Brute-Force Rate Limit → 429
  TC-SEC-003 | Security   | High      — Bad Luhn Check Digit → reject
  TC-SEC-004 | Security   | High      — Expired JWT in Header → 401
  TC-SEC-005 | Security   | High      — Missing Authorization → 401
  TC-SEC-006 | Security   | High      — SQL Injection in PAN → sanitized, reject
  TC-SEC-007 | Security   | High      — TAL Returned Correctly per ID&V Method

── 18 Error Code Validation (7 cases) ──────────────────────────
  TC-ERR-001 | Functional | High      — Validate ACCOUNT_NOT_ELIGIBLE (R1)
  TC-ERR-002 | Functional | High      — Validate TOKEN_RANGE_EXHAUSTED (R3)
  TC-ERR-003 | Negative   | High      — Validate EXPIRY_QUARTER_MISMATCH (R4)
  TC-ERR-004 | Functional | High      — Validate BIN_RANGE_OVERLAP_DETECTED (R6)
  TC-ERR-005 | Negative   | High      — Validate INVALID_TOKEN_FORMAT
  TC-ERR-006 | Functional | High      — Validate TOKEN_DOMAIN_VIOLATION
  TC-ERR-007 | Negative   | High      — Validate Empty Required Fields error structure

── 19 Wallet Token Request — Device & NFC Scenarios (9 cases) ──
  TC-WNF-001 | Functional | Critical  — Device Without NFC Capability Cannot Initiate Tokenization → DEVICE_NOT_ELIGIBLE
  TC-WNF-002 | Functional | Critical  — Device Has NFC Hardware But NFC Is Disabled → NFC_DISABLED
  TC-WNF-003 | Functional | High      — NFC Enabled Mid-Session: Retry After Enabling NFC Succeeds
  TC-WNF-004 | Functional | Medium    — NFC Disabled During Active Token Lifecycle → Token Remains Valid
  TC-WNF-005 | Functional | Critical  — Multi-Scheme Wallet Proprietary BIN Card Tokenization
  TC-WNF-006 | Functional | Critical  — Multi-Scheme Wallet Detokenization Returns Correct PAN Per Scheme
  TC-WNF-007 | Functional | High      — Multi-Scheme Wallet NFC Disabled: All Card Types Blocked → NFC_DISABLED
  TC-WNF-008 | Negative   | High      — No-NFC Device Attempts All Card Types → DEVICE_NOT_ELIGIBLE for each
  TC-WNF-009 | Functional | Critical  — EMVCo Full Round-Trip: Tokenize + Detokenize, Multi-Scheme, NFC Enabled

═══════════════════════════════════════════════════════════════
SECTION 6 — KNOWN ERROR CODES CATALOGUE
═══════════════════════════════════════════════════════════════

Use these error codes consistently across all generated test cases:

  ACCOUNT_NOT_ELIGIBLE      — PAN not within any configured active account range
  TOKEN_RANGE_EXHAUSTED     — Quarter BIN range fully allocated (allocated = capacity)
  EXPIRY_QUARTER_MISMATCH   — Token quarter does not match PAN expiry quarter
  BIN_RANGE_OVERLAP_DETECTED — Proposed BIN range overlaps an existing configured range
  INVALID_TOKEN_FORMAT      — Token fails Luhn check or is non-numeric
  TOKEN_DOMAIN_VIOLATION    — Token used outside TDRC-configured merchant/domain
  TOKEN_EXPIRED             — Token has passed its expiry date / is in EXPIRED state
  INACTIVE_TOKEN            — Token is in SUSPENDED or DELETED state
  EXPIRED_PAN               — PAN expiry date is in the past
  ISSUER_NOT_FOUND          — Referenced issuerId does not exist
  INVALID_MAC               — Message Authentication Code validation failure
  MISSING_FIELD             — Required request field absent
  MISSING_HEADER            — Required HTTP header absent (X-TV-ID, X-TSP-TR-ID)
  UNAUTHORIZED              — Caller not authorized for the requested operation
  INVALID_INPUT             — Input failed format/type validation (e.g. injection payload)
  DEVICE_NOT_ELIGIBLE       — Device hardware lacks NFC capability
  NFC_DISABLED              — Device has NFC hardware but NFC is software-disabled
  BIN_MISMATCH              — PAN BIN does not match the target token range's BIN type

═══════════════════════════════════════════════════════════════
SECTION 7 — POSTMAN COLLECTION INSTRUCTIONS
═══════════════════════════════════════════════════════════════

When I share the Postman collection:

1. Map each API request to one or more test categories in Section 4.
2. Identify the request/response schema for each endpoint.
3. Generate Postman test scripts (pm.test) for automated assertion.
4. Flag any endpoint that appears to be missing based on EMVCo
   required operations (provisioning, lifecycle, de-tokenization,
   device capability checks).
5. Suggest additional endpoints if gaps are found.
6. Output a Test Case Traceability Matrix mapping:
   TC-ID → Business Rule → EMVCo Section → API Endpoint

For TEST DATA AUTOMATION, apply the following generation rules:
  • Custodian IDs: generate as cust_<timestamp>_A/B (unique per run)
  • BIN value: 8-digit, first digit 4–9, random per run
  • PAN: 16-digit, MUST start with the generated BIN value (8-digit prefix),
    remaining 7 digits random, final digit = Luhn check digit
  • issuerCode: 4-digit random, unique per run
  • Seed all generated values in a collection-level pre-request script
    using a _autoDataSeeded flag to prevent re-seeding mid-run
  • Validate PAN-BIN linkage in a pre-request guard on the Prepare
    Tokenization step — throw if pan.startsWith(bin) === false

═══════════════════════════════════════════════════════════════
SECTION 8 — OUTPUT FORMAT REQUESTED
═══════════════════════════════════════════════════════════════

Please provide:
  ✅ Full test case list using TC structure from Section 3
     — Do NOT regenerate the 82 cases listed in Section 5
     — DO generate any gaps not covered by Section 5
  ✅ Postman pm.test() script snippets for critical test cases
  ✅ Traceability Matrix (TC-ID | Rule | EMVCo Ref | Endpoint | Priority)
  ✅ List of any EMVCo compliance gaps found in the collection
  ✅ Recommended additional test cases beyond the collection scope

Now, here is my Postman collection: [PASTE YOUR POSTMAN COLLECTION JSON HERE]
