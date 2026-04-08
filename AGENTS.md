# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This repository contains **Postman API test collections** for the TSP-TakaPay (Token Service Provider) platform. There is no application source code — only API test artifacts targeting three external backend microservices (RGM, TVM, Crypto Utility) on a private network (`10.88.250.40`).

### Running tests

Tests are run with [Newman](https://github.com/postmanlabs/newman) (Postman CLI):

```bash
npm test                    # Run full test suite (TSP_TestCases_postman_collection.json)
npm run test:happy-path     # Run happy-path flow only (TSP.postman_collection.json)
npm run test:html-report    # Run full suite and generate HTML report in reports/
```

### Important caveats

- **Backend services are external.** The API endpoints (`10.88.250.40` ports 40010/40020/40029) are on a private network and **not reachable from Cloud Agent VMs**. Newman will parse and attempt all requests but they will fail with connection errors (`ECONNRESET` / `ESOCKETTIMEDOUT`).
- **No lint or build step.** This repo has no source code to lint or build. Newman collection parsing is the closest equivalent to a "build" validation.
- **No `package-lock.json` in main branch.** The `package.json` and Newman dependencies are added as part of the dev environment setup. Run `npm install` to restore them.
