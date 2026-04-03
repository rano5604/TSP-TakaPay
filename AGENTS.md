# AGENTS.md

## Cursor Cloud specific instructions

### Repository overview
This is a **documentation-only repository** for **TSP-TakaPay**, a Token Service Provider (TSP) Token Vault system implementing EMVCo Payment Tokenization. The repo contains no application source code — only Postman API collections and a QA test case generation prompt.

### Contents
- `TSP.postman_collection.json` — Main Postman collection with 17 API endpoints (Vault, Issuer, BIN, Account Range, Token Requestor, Tokenization, De-tokenization)
- `TSP_TestCases_postman_collection.json` — Comprehensive test cases collection (positive/negative/edge cases)
- `Test Case Generation Prompt` — Prompt template for generating EMVCo-compliant QA test cases

### Development tooling
- **Newman** (Postman CLI runner) is installed globally via npm. Use it to validate and run the Postman collections from the command line.
- Run the main collection: `newman run TSP.postman_collection.json`
- Run the test cases collection: `newman run TSP_TestCases_postman_collection.json`
- Use `--timeout-request <ms>` to control per-request timeouts (e.g., `--timeout-request 5000`)

### Important caveats
- All backend API services (RGM on `:40010`, TVM on `:40020`, Crypto/Mocker on `:40029`, Tokenization on `:41001`) are hosted on **private internal IPs** (`10.88.250.40`, `10.15.20.100`, `10.15.20.130`) and are **not reachable** from this cloud environment. Newman runs will show `ESOCKETTIMEDOUT` for all requests — this is expected.
- Some requests reference a Postman environment variable `{{mocker-dev}}` that must be set when running with a real environment file.
- The `Encrypt The Key` request references a local certificate file path that won't exist in the cloud VM.
- There is no source code to lint, build, or unit-test. The only "testing" available is running the Postman collections via Newman.
