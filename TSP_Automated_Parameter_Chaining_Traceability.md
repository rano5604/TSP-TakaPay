# TSP Automated Parameter Chaining Traceability

Source collection: `TSP.postman_collection.json` from `main`.
Automated collection: `TSP_Automated_Parameter_Chaining.postman_collection.json`.
Prompt used: `Test_Case_Generation_Prompt_v2.md`.

## Automation scope

The automated collection keeps the same 17-request sequence as the source collection, starting from vault creation. It adds:

- Collection-level auto data seeding guarded by `_autoDataSeeded`.
- Unique custodians in the required `cust_<timestamp>_A/B` format.
- Random 8-digit BIN generation where the first digit is 4-9.
- Luhn-valid 16-digit PAN generation using the generated BIN as the prefix.
- Unique 4-digit issuer code per run.
- Pre-request guard on Prepare Tokenization to fail fast when `generatedPan` does not start with `generatedBinValue`.
- Dynamic `X-TV-ID` header chaining from vault creation to TVM requests.
- Dynamic `X-TSP-TR-ID` header chaining from token requestor creation to tokenization.
- Response extraction for vault, certificate, transport key, encrypted key, KCV, issuer, BIN, requestor, tokenization, MAC, and detokenization outputs.

## Source-order traceability matrix

| Step | TC-ID | Source request | Business rule / EMVCo focus | Endpoint | Chained outputs / automated headers |
|---:|---|---|---|---|---|
| 01 | TC-TVT-001 | Valut Creation | Vault setup prerequisite; Rule 7 foundation | POST `/rgm/api/vaults` | `vaultId`, `tvId` for `X-TV-ID` |
| 02 | TC-GTK-001 | Generate Transport Key | Key management / secure transport key setup | GET `/api/generate-transport-key` | `generatedTransportKey`, `activeTransportKey` |
| 03 | TC-CRT-001 | Get Certificate | Key wrapping prerequisite | GET `/tvm/api/vault/certificate` | Uses `X-TV-ID`; stores `vaultCertificate` |
| 04 | TC-ENC-001 | Encrypt The Key | Key wrapping / KCV validation | POST `/api/v1/encrypt/transport-key` | `encryptedTransportKey`, `kcv` |
| 05 | TC-ISS-001 | Issuer Creation | Issuer setup for account range and token rules | POST `/tvm/api/issuer` | Uses `X-TV-ID`; stores `issuerId` |
| 06 | TC-BIN-001 | BIN Creation | Rule 1, Rule 7 BIN routing setup | POST `/tvm/api/bin/single` | Uses `X-TV-ID`; stores `binId` |
| 07 | TC-ACR-001 | Account Range Creation | Rule 1 account range validation | POST `/tvm/api/account-range` | Uses `X-TV-ID`; stores `accountRangeId`; validates PAN/BIN linkage |
| 08 | TC-TRQ-001 | Token Requester Creation | Requestor setup for token uniqueness/domain | POST `/tvm/api/token-requestor` | Uses `X-TV-ID`; stores `tokenRequestorId`, `trId` |
| 09 | TC-TUS-001 | Token Use Set-up | Rule 7/10 domain setup and merchant controls | POST `/tvm/api/token-requestor/token-use/setup` | Uses `X-TV-ID`, `tokenRequestorId` |
| 10 | TC-TLS-001 | Token Life Set-Up | EMVCo lifecycle / expiry boundaries | POST `/tvm/api/token-life/authorization` | Uses `X-TV-ID`, `issuerId`, `tokenRequestorId` |
| 11 | TC-TRS-001 | Token Range Set-Up | Rules 2-4 quarter range setup and expiry alignment | POST `/tvm/api/token-range` | Uses `X-TV-ID`; stores token range setup state |
| 12 | TC-PTR-001 | Prepare-Tokenization-Request Copy | Token provisioning, Rule 1 PAN eligibility | POST `/api/mocker/encrypt/card-holder-data` | Stores `toTokenizeCipherText`, device data, `toTokenizeMac` |
| 13 | TC-TOK-001 | Tokenize Copy | Token issuance, TAL/TDRC inputs | POST `/api/tokens/tokenize` | Uses `X-TSP-TR-ID`; stores `tokenizedCipherText`, `tokenizedMac`, token if returned |
| 14 | TC-DEC-001 | Tokenized-CipherText-Decryption Copy | Token cryptogram/decryption verification | POST `/api/decryption` | Extracts `provisionedToken`, `provisionedTokenExpiry` when present |
| 15 | TC-MAC-001 | Tokenized-Mac-Validation Copy | Cryptographic integrity validation | POST `/api/validate-mac` | Validates tokenized MAC response |
| 16 | TC-DTK-001 | TVM-Detokenize-Issuer-Verify-Mode Copy | Authorized detokenization / TDRC | POST `/tvm/api/tokens/de-tokenize/issuer` | Uses `X-TV-ID`; stores `detokenizationCipherText` |
| 17 | TC-DDC-001 | Detokenization-CipherText-Decryption Copy | Round-trip PAN recovery | POST `/api/decryption` | Verifies decrypted PAN against generated PAN when returned |

## Compliance gaps still outside the source flow

The source collection is a happy-path provisioning and round-trip flow. The prompt also calls for negative, boundary, security, lifecycle, capacity, NFC/device, and multi-scheme wallet scenarios. Those are not represented as source endpoints in this strict sequence collection and should stay in the broader generated suites (`TSP_Automated_TestCases*.postman_collection.json`) or be added as separate negative-flow folders so the source-sequence chain remains deterministic.
