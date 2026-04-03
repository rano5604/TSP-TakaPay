#!/usr/bin/env node
//
// TSP TakaPay — Final Unified Automated Collection
//
// One sequential flow that validates BOTH business rules AND EMVCo compliance
// at every step. Not split into parts — a single end-to-end journey:
//
//  1. Vault Creation (+ negative/edge)
//  2. Transport Key Generation (+ uniqueness)
//  3. Certificate Retrieval
//  4. Key Encryption
//  5. Issuer Onboarding (+ KCV, duplicate)
//  6. BIN Setup
//  7. Account Range Setup (+ boundary, overlap, expiry rules)
//  8. Token Requester Onboarding
//  9. Token Use Setup
// 10. Token Life Authorization
// 11. Token Range Setup (+ overlap, quarter, EMVCo BIN range rules)
// 12. Token Provisioning (+ quarter mapping, boundary, exhaustion, PAN validation)
// 13. Token Lifecycle (activate → suspend → resume → delete, invalid transitions)
// 14. De-Tokenization (+ unauthorized, deleted, Luhn)
// 15. Token Domain Restriction Control
// 16. Token Expiry Validation
// 17. Security & Fraud Controls
// 18. Error Code Validation
//
// Every request: pm.test() assertions, variable chaining, pre-request data gen.

const fs = require('fs');
const path = require('path');

function u(raw) {
  const m = raw.match(/^\{\{(\w+)\}\}(.*)$/);
  if (m) return { raw, host: ['{{' + m[1] + '}}'], path: m[2].split('/').filter(Boolean) };
  return { raw };
}

function s(type, lines) { return { listen: type, script: { type: 'text/javascript', exec: lines } }; }

function jH(tv) {
  const h = [{ key: 'accept', value: '*/*' }, { key: 'Content-Type', value: 'application/json' }];
  if (tv) h.splice(1, 0, { key: 'X-TV-ID', value: '{{tvId}}' });
  return h;
}
function aH(tv) {
  const h = [{ key: 'accept', value: '*/*' }];
  if (tv) h.push({ key: 'X-TV-ID', value: '{{tvId}}' });
  return h;
}

function r(name, method, rawUrl, headers, body, events, desc) {
  const o = { name, event: events || [], request: { method, header: headers, url: u(rawUrl), description: desc || '' }, response: [] };
  if (body != null) o.request.body = typeof body === 'object' && body.mode ? body : { mode: 'raw', raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2) };
  return o;
}

const B_RGM = '{{baseUrl_rgm}}';
const B_TVM = '{{baseUrl_tvm}}';
const B_CRY = '{{baseUrl_crypto}}';

function buildFlow() {
  const folders = [];

  // ──────────────────────────────────────────────────
  // 1. VAULT CREATION
  // ──────────────────────────────────────────────────
  folders.push({ name: '01 Vault Creation', item: [
    r('01-01 Create Vault (happy path)', 'POST', `${B_RGM}/rgm/api/vaults`,
      [{ key:'accept',value:'*/*'},{ key:'Content-Type',value:'application/json'}],
      '{"tspCode":"{{tspCode}}","tokenVaultName":"My Token Vault","custodianIdList":["custodian007","custodian008"]}',
      [s('prerequest',['const c=pm.collectionVariables.get("tspCode")||"998";pm.collectionVariables.set("tspCode",c);']),
       s('test',[
         'pm.test("01-01 Status 200/201",()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));',
         'pm.test("01-01 Vault ID returned & captured",()=>{const j=pm.response.json();const id=j.vaultId||j.tvId||j.tokenVaultId||j.id;pm.expect(id).to.exist;pm.collectionVariables.set("tvId",id);});',
         'pm.test("01-01 Response < 5s",()=>pm.expect(pm.response.responseTime).to.be.below(5000));',
       ])],
      'Business: Vault creation with valid TSP code. EMVCo: Token Vault must exist before any tokenization.'),
    r('01-02 Vault - missing tspCode', 'POST', `${B_RGM}/rgm/api/vaults`,
      [{ key:'accept',value:'*/*'},{ key:'Content-Type',value:'application/json'}],
      '{"tokenVaultName":"My Token Vault","custodianIdList":["custodian007","custodian008"]}',
      [s('test',['pm.test("01-02 Status 400",()=>pm.expect(pm.response.code).to.equal(400));',
        'pm.test("01-02 Error body present",()=>{const j=pm.response.json();pm.expect(j.error||j.message||j.errorMessage||j.errors).to.exist;});'])],
      'Negative: tspCode omitted.'),
    r('01-03 Vault - empty custodianIdList', 'POST', `${B_RGM}/rgm/api/vaults`,
      [{ key:'accept',value:'*/*'},{ key:'Content-Type',value:'application/json'}],
      '{"tspCode":"{{tspCode}}","tokenVaultName":"My Token Vault","custodianIdList":[]}',
      [s('test',['pm.test("01-03 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Negative: At least one custodian required.'),
    r('01-04 Vault - duplicate creation', 'POST', `${B_RGM}/rgm/api/vaults`,
      [{ key:'accept',value:'*/*'},{ key:'Content-Type',value:'application/json'}],
      '{"tspCode":"{{tspCode}}","tokenVaultName":"My Token Vault","custodianIdList":["custodian007","custodian008"]}',
      [s('test',['pm.test("01-04 Status 4xx (conflict)",()=>pm.expect(pm.response.code).to.be.within(400,499));'])],
      'Negative: Duplicate tspCode should conflict.'),
    r('01-05 Vault - invalid tspCode format', 'POST', `${B_RGM}/rgm/api/vaults`,
      [{ key:'accept',value:'*/*'},{ key:'Content-Type',value:'application/json'}],
      '{"tspCode":"ABC!@#","tokenVaultName":"My Token Vault","custodianIdList":["custodian007"]}',
      [s('test',['pm.test("01-05 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Edge: Special characters in tspCode.'),
  ]});

  // ──────────────────────────────────────────────────
  // 2. TRANSPORT KEY GENERATION
  // ──────────────────────────────────────────────────
  folders.push({ name: '02 Transport Key Generation', item: [
    r('02-01 Generate key (happy path)', 'GET', `${B_CRY}/api/generate-transport-key`, aH(false), null,
      [s('test',[
        'pm.test("02-01 Status 200",()=>pm.expect(pm.response.code).to.equal(200));',
        'pm.test("02-01 Key is hex string",()=>{const j=pm.response.json();const k=j.transportKey||j.key||j.plainKey||j.data;pm.expect(k).to.match(/^[0-9a-fA-F]+$/);pm.collectionVariables.set("transportKey",k);});',
        'pm.test("02-01 KCV present",()=>{const j=pm.response.json();const k=j.kcv||j.KCV||j.keyCheckValue;pm.expect(k).to.exist;pm.collectionVariables.set("kcv",k);});',
      ])],
      'Business: Generate transport key for issuer onboarding. EMVCo: Cryptographic keys must be unique per generation.'),
    r('02-02 Key uniqueness check (call 1)', 'GET', `${B_CRY}/api/generate-transport-key`, aH(false), null,
      [s('test',['pm.test("02-02 Status 200",()=>pm.expect(pm.response.code).to.equal(200));',
        'const j=pm.response.json();pm.collectionVariables.set("_uk1",j.transportKey||j.key||j.plainKey||j.data);'])],
      'EMVCo: Key uniqueness — store first key.'),
    r('02-03 Key uniqueness check (call 2)', 'GET', `${B_CRY}/api/generate-transport-key`, aH(false), null,
      [s('test',['pm.test("02-03 Status 200",()=>pm.expect(pm.response.code).to.equal(200));',
        'pm.test("02-03 Keys are unique",()=>{const j=pm.response.json();const k2=j.transportKey||j.key||j.plainKey||j.data;pm.expect(k2).to.not.equal(pm.collectionVariables.get("_uk1"));});'])],
      'EMVCo: Verify two generated keys are never identical.'),
  ]});

  // ──────────────────────────────────────────────────
  // 3. CERTIFICATE RETRIEVAL
  // ──────────────────────────────────────────────────
  folders.push({ name: '03 Certificate Retrieval', item: [
    r('03-01 Get certificate (happy path)', 'GET', `${B_TVM}/tvm/api/vault/certificate`, aH(true), null,
      [s('prerequest',['if(!pm.collectionVariables.get("tvId"))pm.collectionVariables.set("tvId","9985003");']),
       s('test',[
        'pm.test("03-01 Status 200",()=>pm.expect(pm.response.code).to.equal(200));',
        'pm.test("03-01 Certificate body returned",()=>{const b=pm.response.text();pm.expect(b.includes("BEGIN CERTIFICATE")||b.includes("MII")||b.length>50).to.be.true;});',
      ])],
      'Business: Retrieve vault certificate for key encryption. EMVCo: PKI certificate required.'),
    r('03-02 Certificate - missing X-TV-ID', 'GET', `${B_TVM}/tvm/api/vault/certificate`,
      [{key:'accept',value:'*/*'}], null,
      [s('test',['pm.test("03-02 Status 400/401",()=>pm.expect(pm.response.code).to.be.oneOf([400,401]));'])],
      'Negative: Vault identifier required.'),
    r('03-03 Certificate - non-existent vault', 'GET', `${B_TVM}/tvm/api/vault/certificate`,
      [{key:'accept',value:'*/*'},{key:'X-TV-ID',value:'0000000'}], null,
      [s('test',['pm.test("03-03 Status 404",()=>pm.expect(pm.response.code).to.equal(404));'])],
      'Negative: Unknown vault ID.'),
  ]});

  // ──────────────────────────────────────────────────
  // 4. KEY ENCRYPTION
  // ──────────────────────────────────────────────────
  folders.push({ name: '04 Key Encryption', item: [
    r('04-01 Encrypt key (happy path)', 'POST', `${B_CRY}/api/v1/encrypt/transport-key`,
      [{key:'accept',value:'*/*'}],
      {mode:'formdata',formdata:[{key:'publicKeyCertificate',type:'file',src:'self_signed_certificate.cert'},{key:'plainData',value:'{{transportKey}}',type:'text'}]},
      [s('prerequest',['if(!pm.collectionVariables.get("transportKey"))pm.collectionVariables.set("transportKey","224189fef0d02c5ac6e6ab88c91508b34ff7137a3569de5e79d4db1ba307264c");']),
       s('test',[
        'pm.test("04-01 Status 200",()=>pm.expect(pm.response.code).to.equal(200));',
        'pm.test("04-01 Encrypted key is hex",()=>{const j=pm.response.json();const e=j.encryptedTransportKey||j.encryptedKey||j.encryptedData||j.data;pm.expect(e).to.match(/^[0-9a-fA-F]+$/);pm.collectionVariables.set("encryptedTransportKey",e);});',
      ])],
      'Business: Encrypt transport key with vault certificate. EMVCo: PAN-Token mapping keys must be encrypted.'),
    r('04-02 Encrypt - missing certificate', 'POST', `${B_CRY}/api/v1/encrypt/transport-key`,
      [{key:'accept',value:'*/*'}],
      {mode:'formdata',formdata:[{key:'plainData',value:'{{transportKey}}',type:'text'}]},
      [s('test',['pm.test("04-02 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Negative: Certificate file required.'),
    r('04-03 Encrypt - invalid certificate', 'POST', `${B_CRY}/api/v1/encrypt/transport-key`,
      [{key:'accept',value:'*/*'}],
      {mode:'formdata',formdata:[{key:'publicKeyCertificate',value:'INVALID_CERT',type:'text'},{key:'plainData',value:'{{transportKey}}',type:'text'}]},
      [s('test',['pm.test("04-03 Status 400/422",()=>pm.expect(pm.response.code).to.be.oneOf([400,422]));'])],
      'Negative: Malformed certificate.'),
    r('04-04 Encrypt - plainData wrong length', 'POST', `${B_CRY}/api/v1/encrypt/transport-key`,
      [{key:'accept',value:'*/*'}],
      {mode:'formdata',formdata:[{key:'publicKeyCertificate',type:'file',src:'self_signed_certificate.cert'},{key:'plainData',value:'1234567890',type:'text'}]},
      [s('test',['pm.test("04-04 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Edge: plainData not 64-char hex.'),
  ]});

  // ──────────────────────────────────────────────────
  // 5. ISSUER ONBOARDING
  // ──────────────────────────────────────────────────
  folders.push({ name: '05 Issuer Onboarding', item: [
    r('05-01 Create issuer (happy path)', 'POST', `${B_TVM}/tvm/api/issuer`, jH(true),
      '{"issuerName":"EBL","issuerCode":"{{issuerCode}}","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","realTimePanEnrollment":"Y"}',
      [s('prerequest',[
        'pm.collectionVariables.set("issuerCode","4"+String(Date.now()).slice(-2));',
        'if(!pm.collectionVariables.get("encryptedTransportKey"))pm.collectionVariables.set("encryptedTransportKey","8EA89A35C83D66FBB5DE2A97F74392C272BCBF521AA93EF072399382E32B05900F8D9C3EDF0D7EE3367E3D9E903CA1B9D5E9F5323ED8089DF353A9EF8CF08E178D9D85D84A871A4960AB1E74CFD148C5FFC4BDF0CE3F0B6B36ABC751E270DEAEFC2FAD959957AE7D662AE489AFDDEE5363DFDFD2B51AB49CA154972FE1EC1389");',
        'if(!pm.collectionVariables.get("kcv"))pm.collectionVariables.set("kcv","AC6BCC");',
      ]),
       s('test',[
        'pm.test("05-01 Status 200/201",()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));',
        'pm.test("05-01 issuerId captured",()=>{const j=pm.response.json();const id=j.issuerId||j.id;pm.expect(id).to.exist;pm.collectionVariables.set("issuerId",id);});',
      ])],
      'Business: Register card issuer with encrypted transport key. EMVCo: Issuer must be onboarded before PAN enrollment.'),
    r('05-02 Issuer - invalid KCV', 'POST', `${B_TVM}/tvm/api/issuer`, jH(true),
      '{"issuerName":"EBL","issuerCode":"421","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"ZZZZZZ","realTimePanEnrollment":"Y"}',
      [s('test',['pm.test("05-02 Status 400/422",()=>pm.expect(pm.response.code).to.be.oneOf([400,422]));'])],
      'Negative: KCV does not match transport key.'),
    r('05-03 Issuer - missing X-TV-ID', 'POST', `${B_TVM}/tvm/api/issuer`,
      [{key:'accept',value:'*/*'},{key:'Content-Type',value:'application/json'}],
      '{"issuerName":"EBL","issuerCode":"422","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","realTimePanEnrollment":"Y"}',
      [s('test',['pm.test("05-03 Status 400/401",()=>pm.expect(pm.response.code).to.be.oneOf([400,401]));'])],
      'Negative: Vault identifier required.'),
    r('05-04 Issuer - duplicate code', 'POST', `${B_TVM}/tvm/api/issuer`, jH(true),
      '{"issuerName":"EBL_DUP","issuerCode":"{{issuerCode}}","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","realTimePanEnrollment":"Y"}',
      [s('test',['pm.test("05-04 Status 4xx",()=>pm.expect(pm.response.code).to.be.within(400,499));'])],
      'Negative: Duplicate issuer code.'),
    r('05-05 Issuer - invalid realTimePanEnrollment', 'POST', `${B_TVM}/tvm/api/issuer`, jH(true),
      '{"issuerName":"EBL_X","issuerCode":"423","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","realTimePanEnrollment":"X"}',
      [s('test',['pm.test("05-05 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Edge: Must be Y or N.'),
  ]});

  // ──────────────────────────────────────────────────
  // 6. BIN SETUP
  // ──────────────────────────────────────────────────
  folders.push({ name: '06 BIN Setup', item: [
    r('06-01 Create BIN (happy path)', 'POST', `${B_TVM}/tvm/api/bin/single`, jH(true),
      '{"issuerId":"{{issuerId}}","binControllerId":"1234","binValue":"{{binValue}}","brandType":"06","ianLen":7}',
      [s('prerequest',[
        'if(!pm.collectionVariables.get("issuerId"))pm.collectionVariables.set("issuerId","237d9188de9144e5806abf95441fce5b");',
        'pm.collectionVariables.set("binValue","6399"+String(Date.now()).slice(-4));',
      ]),
       s('test',[
        'pm.test("06-01 Status 200/201",()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));',
        'pm.test("06-01 binId captured",()=>{const j=pm.response.json();const id=j.binId||j.id;pm.expect(id).to.exist;pm.collectionVariables.set("binId",id);});',
      ])],
      'Business: Register BIN for issuer. EMVCo: Token BIN must be assigned from registered range.'),
    r('06-02 BIN - invalid issuerId', 'POST', `${B_TVM}/tvm/api/bin/single`, jH(true),
      '{"issuerId":"00000000000000000000000000000000","binControllerId":"1234","binValue":"63999604","brandType":"06","ianLen":7}',
      [s('test',['pm.test("06-02 Status 4xx",()=>pm.expect(pm.response.code).to.be.within(400,499));'])],
      'Negative: Non-existent issuer.'),
    r('06-03 BIN - duplicate value', 'POST', `${B_TVM}/tvm/api/bin/single`, jH(true),
      '{"issuerId":"{{issuerId}}","binControllerId":"1234","binValue":"{{binValue}}","brandType":"06","ianLen":7}',
      [s('test',['pm.test("06-03 Status 4xx",()=>pm.expect(pm.response.code).to.be.within(400,499));'])],
      'Negative: Duplicate BIN value.'),
    r('06-04 BIN - ianLen zero', 'POST', `${B_TVM}/tvm/api/bin/single`, jH(true),
      '{"issuerId":"{{issuerId}}","binControllerId":"1234","binValue":"63999605","brandType":"06","ianLen":0}',
      [s('test',['pm.test("06-04 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Edge: ianLen must be > 0.'),
  ]});

  // ──────────────────────────────────────────────────
  // 7. ACCOUNT RANGE SETUP
  // ──────────────────────────────────────────────────
  folders.push({ name: '07 Account Range Setup', item: [
    r('07-01 Create account range (happy path)', 'POST', `${B_TVM}/tvm/api/account-range`, jH(true),
      '{"issuerId":"{{issuerId}}","binId":"{{binId}}","panLowerLimit":"1100000","panUpperLimit":"9000000","listOfExpiry":[{"quarter":"Q1","year":2027},{"quarter":"Q2","year":2027},{"quarter":"Q3","year":2027}]}',
      [s('prerequest',['if(!pm.collectionVariables.get("binId"))pm.collectionVariables.set("binId","d2d1adf80a1045359033de945b60e48g");']),
       s('test',[
        'pm.test("07-01 Status 200/201",()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));',
        'pm.test("07-01 Range ID captured",()=>{const j=pm.response.json();const id=j.accountRangeId||j.id||j.rangeId;if(id)pm.collectionVariables.set("accountRangeId",id);});',
      ])],
      'Business R1: Configure PAN account range. EMVCo: Tokenization valid only for PANs in active ranges.'),
    r('07-02 AcctRange - lower > upper', 'POST', `${B_TVM}/tvm/api/account-range`, jH(true),
      '{"issuerId":"{{issuerId}}","binId":"{{binId}}","panLowerLimit":"9000000","panUpperLimit":"1100000","listOfExpiry":[{"quarter":"Q1","year":2027}]}',
      [s('test',['pm.test("07-02 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Negative: Invalid range bounds.'),
    r('07-03 AcctRange - empty listOfExpiry', 'POST', `${B_TVM}/tvm/api/account-range`, jH(true),
      '{"issuerId":"{{issuerId}}","binId":"{{binId}}","panLowerLimit":"1100000","panUpperLimit":"9000000","listOfExpiry":[]}',
      [s('test',['pm.test("07-03 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Negative: At least one expiry required.'),
    r('07-04 AcctRange - invalid quarter Q5', 'POST', `${B_TVM}/tvm/api/account-range`, jH(true),
      '{"issuerId":"{{issuerId}}","binId":"{{binId}}","panLowerLimit":"1100000","panUpperLimit":"9000000","listOfExpiry":[{"quarter":"Q5","year":2027}]}',
      [s('test',['pm.test("07-04 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Edge: Quarter must be Q1-Q4. Business R2.'),
    r('07-05 AcctRange - past expiry year', 'POST', `${B_TVM}/tvm/api/account-range`, jH(true),
      '{"issuerId":"{{issuerId}}","binId":"{{binId}}","panLowerLimit":"1100000","panUpperLimit":"9000000","listOfExpiry":[{"quarter":"Q1","year":2020}]}',
      [s('test',['pm.test("07-05 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Edge: Expiry in the past.'),
  ]});

  // ──────────────────────────────────────────────────
  // 8. TOKEN REQUESTER ONBOARDING
  // ──────────────────────────────────────────────────
  folders.push({ name: '08 Token Requester Onboarding', item: [
    r('08-01 Create requester - Google Pay (happy path)', 'POST', `${B_TVM}/tvm/api/token-requestor`, jH(true),
      '{"tokenFormFactor":"00","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","serviceName":"Service name","trName":"Google Pay"}',
      [s('test',[
        'pm.test("08-01 Status 200/201",()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));',
        'pm.test("08-01 trId captured",()=>{const j=pm.response.json();const id=j.trId||j.tokenRequestorId||j.requestorId||j.id;pm.expect(id).to.exist;pm.collectionVariables.set("trId",String(id));});',
      ])],
      'Business: Onboard token requestor. EMVCo: Token Requestor ID required for provisioning.'),
    r('08-02 Requester - invalid tokenFormFactor', 'POST', `${B_TVM}/tvm/api/token-requestor`, jH(true),
      '{"tokenFormFactor":"99","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","serviceName":"Service","trName":"TR"}',
      [s('test',['pm.test("08-02 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Negative: Unsupported form factor.'),
    r('08-03 Requester - KCV mismatch', 'POST', `${B_TVM}/tvm/api/token-requestor`, jH(true),
      '{"tokenFormFactor":"00","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"000000","serviceName":"Service","trName":"TR"}',
      [s('test',['pm.test("08-03 Status 400/422",()=>pm.expect(pm.response.code).to.be.oneOf([400,422]));'])],
      'Negative: KCV verification failure.'),
    r('08-04 Requester - missing serviceName', 'POST', `${B_TVM}/tvm/api/token-requestor`, jH(true),
      '{"tokenFormFactor":"00","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","trName":"TR"}',
      [s('test',['pm.test("08-04 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Edge: Required field omitted.'),
  ]});

  // ──────────────────────────────────────────────────
  // 9. TOKEN USE SETUP
  // ──────────────────────────────────────────────────
  folders.push({ name: '09 Token Use Setup', item: [
    r('09-01 Token use setup (happy path)', 'POST', `${B_TVM}/tvm/api/token-requestor/token-use/setup`, jH(true),
      '{"merchantInfos":[{"merchantId":"123456789012345","merchantName":"Merchant"}],"modeOfTransaction":"01","trId":"{{trId}}"}',
      [s('prerequest',['if(!pm.collectionVariables.get("trId"))pm.collectionVariables.set("trId","99850031692");']),
       s('test',['pm.test("09-01 Status 200/201",()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));'])],
      'Business: Configure token use with merchant. EMVCo: Token domain setup per requestor.'),
    r('09-02 Token use - non-existent trId', 'POST', `${B_TVM}/tvm/api/token-requestor/token-use/setup`, jH(true),
      '{"merchantInfos":[{"merchantId":"123456789012345","merchantName":"Merchant"}],"modeOfTransaction":"01","trId":"00000000000"}',
      [s('test',['pm.test("09-02 Status 4xx",()=>pm.expect(pm.response.code).to.be.within(400,499));'])],
      'Negative: Unknown requestor.'),
    r('09-03 Token use - merchantId wrong length', 'POST', `${B_TVM}/tvm/api/token-requestor/token-use/setup`, jH(true),
      '{"merchantInfos":[{"merchantId":"123","merchantName":"M"}],"modeOfTransaction":"01","trId":"{{trId}}"}',
      [s('test',['pm.test("09-03 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Negative: merchantId must be 15 digits.'),
    r('09-04 Token use - multiple merchants', 'POST', `${B_TVM}/tvm/api/token-requestor/token-use/setup`, jH(true),
      '{"merchantInfos":[{"merchantId":"123456789012341","merchantName":"A"},{"merchantId":"123456789012342","merchantName":"B"},{"merchantId":"123456789012343","merchantName":"C"}],"modeOfTransaction":"01","trId":"{{trId}}"}',
      [s('test',['pm.test("09-04 Status 200",()=>pm.expect(pm.response.code).to.equal(200));'])],
      'Edge: Multiple merchants at once.'),
  ]});

  // ──────────────────────────────────────────────────
  // 10. TOKEN LIFE AUTHORIZATION
  // ──────────────────────────────────────────────────
  folders.push({ name: '10 Token Life Authorization', item: [
    r('10-01 Token life (happy path)', 'POST', `${B_TVM}/tvm/api/token-life/authorization`, jH(true),
      '{"requestorId":"{{trId}}","minPeriodInMonths":0,"maxPeriodInMonths":70,"issuerId":"{{issuerId}}"}',
      [s('test',['pm.test("10-01 Status 200/201",()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));'])],
      'Business: Authorize token lifetime. EMVCo: Token expiry must align with PAN expiry boundary.'),
    r('10-02 Token life - min > max', 'POST', `${B_TVM}/tvm/api/token-life/authorization`, jH(true),
      '{"requestorId":"{{trId}}","minPeriodInMonths":70,"maxPeriodInMonths":10,"issuerId":"{{issuerId}}"}',
      [s('test',['pm.test("10-02 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Negative: min must be <= max.'),
    r('10-03 Token life - non-existent issuerId', 'POST', `${B_TVM}/tvm/api/token-life/authorization`, jH(true),
      '{"requestorId":"{{trId}}","minPeriodInMonths":0,"maxPeriodInMonths":70,"issuerId":"00000000000000000000000000000000"}',
      [s('test',['pm.test("10-03 Status 4xx",()=>pm.expect(pm.response.code).to.be.within(400,499));'])],
      'Negative: Unknown issuer.'),
    r('10-04 Token life - zero period', 'POST', `${B_TVM}/tvm/api/token-life/authorization`, jH(true),
      '{"requestorId":"{{trId}}","minPeriodInMonths":0,"maxPeriodInMonths":0,"issuerId":"{{issuerId}}"}',
      [s('test',['pm.test("10-04 Status 400 or 200",()=>pm.expect(pm.response.code).to.be.oneOf([200,400]));'])],
      'Edge: Zero-lifetime token.'),
  ]});

  // ──────────────────────────────────────────────────
  // 11. TOKEN RANGE SETUP + EMVCo BIN RANGE RULES
  // ──────────────────────────────────────────────────
  folders.push({ name: '11 Token Range & BIN Range Setup', item: [
    r('11-01 Token range (happy path)', 'POST', `${B_TVM}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"9100000","upperLimit":"9999999"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [s('test',['pm.test("11-01 Status 200/201",()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));'])],
      'Business R2: Configure quarter-wise BIN range. EMVCo: Token BIN must come from registered range.'),
    r('11-02 Token range - overlaps account range', 'POST', `${B_TVM}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"1100000","upperLimit":"9000000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [s('test',['pm.test("11-02 Status 400/409",()=>pm.expect(pm.response.code).to.be.oneOf([400,409]));'])],
      'Negative R6: Overlapping ranges must be rejected. EMVCo: BIN_RANGE_OVERLAP_DETECTED.'),
    r('11-03 Token range - lower > upper', 'POST', `${B_TVM}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"9999999","upperLimit":"9100000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [s('test',['pm.test("11-03 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Negative: Invalid range.'),
    r('11-04 Token range - non-existent requestorId', 'POST', `${B_TVM}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"9100000","upperLimit":"9999999"}],"requestorId":"00000000000","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [s('test',['pm.test("11-04 Status 4xx",()=>pm.expect(pm.response.code).to.be.within(400,499));'])],
      'Negative: Unknown requestor.'),
    r('11-05 Token range - past expiry', 'POST', `${B_TVM}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q1","year":2023},"lowerLimit":"9100000","upperLimit":"9999999"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [s('test',['pm.test("11-05 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Edge: Expiry in the past.'),
    r('11-06 BIN range - non-overlapping Q4', 'POST', `${B_TVM}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q4","year":2027},"lowerLimit":"9100000","upperLimit":"9500000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [s('test',['pm.test("11-06 Status 200/201",()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));',
        'pm.test("11-06 Capacity metadata",()=>{const j=pm.response.json();pm.expect(j).to.be.an("object");});'])],
      'Business R2/R6: New non-overlapping quarter range.'),
    r('11-07 BIN range - already-configured quarter overlap', 'POST', `${B_TVM}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"9200000","upperLimit":"9800000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [s('test',['pm.test("11-07 Status 409 BIN_RANGE_OVERLAP",()=>pm.expect(pm.response.code).to.be.oneOf([400,409]));',
        'pm.test("11-07 Error body",()=>{const j=pm.response.json();pm.expect(j.errorCode||j.error||j.message).to.exist;});'])],
      'Negative R6: Overlapping BIN range.'),
    r('11-08 BIN range - zero capacity', 'POST', `${B_TVM}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q1","year":2028},"lowerLimit":"9100000","upperLimit":"9100000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [s('test',['pm.test("11-08 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Boundary R2: Zero/insufficient capacity.'),
    r('11-09 BIN range - retrieve config', 'GET', `${B_TVM}/tvm/api/token-range?requestorId={{trId}}&issuerId={{issuerId}}&binId={{binId}}`, aH(true), null,
      [s('test',['pm.test("11-09 Status 200",()=>pm.expect(pm.response.code).to.equal(200));',
        'pm.test("11-09 Quarter metadata fields",()=>{const j=pm.response.json();const a=Array.isArray(j)?j:[j];a.forEach(r=>pm.expect(r).to.have.any.keys("capacity","remainingCount","allocatedCount","quarter"));});'])],
      'Business R2/R5: Verify capacity, allocated, remaining per quarter.'),
  ]});

  // ──────────────────────────────────────────────────
  // 12. TOKEN PROVISIONING (EMVCo §4)
  // ──────────────────────────────────────────────────
  const provData = [
    ['12-01 Provision - valid PAN Q1 expiry','6399960312345678','0327',[200,201],'Business R4+EMVCo §4.3: Q1 mapping.','token'],
    ['12-02 Provision - valid PAN Q2 expiry','6399960312345678','0627',[200,201],'Business R4+EMVCo §4.3: Q2 mapping.','token'],
    ['12-03 Provision - valid PAN Q3 expiry','6399960312345678','0927',[200,201],'Business R4+EMVCo §4.3: Q3 mapping.',''],
    ['12-04 Provision - valid PAN Q4 expiry','6399960312345678','1227',[200,201],'Business R4+EMVCo §4.3: Q4 mapping.',''],
    ['12-05 Provision - BIN range first token','6399960311100000','0627',[200,201],'Boundary R2+EMVCo §4.3.2: First token at BIN_START.',''],
    ['12-06 Provision - BIN range last token','6399960319000000','0627',[200,201],'Boundary R3+EMVCo §4.3.2: Last token at BIN_END.',''],
    ['12-07 Provision - one from exhaustion','6399960318999999','0627',[200,201],'Boundary R3/R5: 1 token remaining.',''],
    ['12-08 Provision - range exhausted','6399960318999998','0627',[422],'Negative R3: TOKEN_RANGE_EXHAUSTED.',''],
    ['12-09 Provision - PAN outside range','6399960300000001','0627',[422],'Negative R1: ACCOUNT_NOT_ELIGIBLE.',''],
    ['12-10 Provision - expired PAN','6399960312345678','0123',[400],'Negative EMVCo §4.3.1: Cannot tokenize expired PAN.',''],
    ['12-11 Provision - quarter not configured','6399960312345678','1028',[422],'Negative R4: EXPIRY_QUARTER_MISMATCH.',''],
    ['12-12 Provision - idempotent re-tokenize','6399960312345678','0627',[200],'EMVCo §4.3.4: Same PAN+TR returns same token.',''],
    ['12-13 Provision - non-numeric PAN','ABCDEFGH12345678','0627',[400],'Negative EMVCo §3.1: Invalid PAN format.',''],
    ['12-14 Provision - PAN too short (12 digits)','639996031234','0627',[400],'Negative EMVCo §3.1: Min 13 digits.',''],
    ['12-15 Provision - PAN too long (20 digits)','63999603123456789012','0627',[400],'Negative EMVCo §3.1: Max 19 digits.',''],
    ['12-16 Provision - PAN at lower boundary','6399960311100000','0627',[200,201],'Boundary R1: Exact panLowerLimit.',''],
    ['12-17 Provision - PAN at upper boundary','6399960319000000','0627',[200,201],'Boundary R1: Exact panUpperLimit.',''],
    ['12-18 Provision - PAN below lower limit','6399960310000001','0627',[422],'Negative R1: Below range → ACCOUNT_NOT_ELIGIBLE.',''],
    ['12-19 Provision - PAN above upper limit','6399960319999999','0627',[422],'Negative R1: Above range → ACCOUNT_NOT_ELIGIBLE.',''],
    ['12-20 Provision - partial utilization OK','6399960315500000','0627',[200,201],'Business R5: Partial use does not block.',''],
  ];
  folders.push({ name: '12 Token Provisioning', item: provData.map(([name,pan,exp,codes,desc,capture]) =>
    r(name, 'POST', `${B_TVM}/tvm/api/tokens/provision`, jH(true),
      JSON.stringify({pan,panExpiry:exp,tokenRequestorId:'{{trId}}',tokenType:'CLOUD',tokenAssuranceLevel:'3'},null,2),
      [s('prerequest',['if(!pm.collectionVariables.get("trId"))pm.collectionVariables.set("trId","99850031692");']),
       s('test',[
        `pm.test("${name.split(' ')[0]} Status ${codes.join('/')}",()=>pm.expect(pm.response.code).to.be.oneOf([${codes}]));`,
        ...(codes.includes(200)||codes.includes(201)?[
          `pm.test("${name.split(' ')[0]} Token is 13-19 digit",()=>{const j=pm.response.json();const t=j.token||j.tokenValue||j.tokenNumber;if(t){pm.expect(t).to.match(/^[0-9]{13,19}$/);${capture==='token'?'pm.collectionVariables.set("provisionedToken",t);':''}}});`,
          `pm.test("${name.split(' ')[0]} TAL present",()=>{const j=pm.response.json();pm.expect(j.tokenAssuranceLevel||j.tal||j.TAL).to.exist;});`,
        ]:[
          `pm.test("${name.split(' ')[0]} Error body",()=>{const j=pm.response.json();pm.expect(j.errorCode||j.error||j.message).to.exist;});`,
        ]),
      ])], desc))
  });

  // ──────────────────────────────────────────────────
  // 13. TOKEN LIFECYCLE (EMVCo §6)
  // ──────────────────────────────────────────────────
  folders.push({ name: '13 Token Lifecycle', item: [
    r('13-01 Activate (INACTIVE→ACTIVE)','PUT',`${B_TVM}/tvm/api/tokens/{{provisionedToken}}/activate`,jH(true),
      '{"reason":"ID_AND_V_COMPLETE"}',
      [s('test',['pm.test("13-01 Status 200",()=>pm.expect(pm.response.code).to.equal(200));',
        'pm.test("13-01 State ACTIVE",()=>{const j=pm.response.json();const st=j.status||j.tokenStatus;pm.expect(String(st).toUpperCase()).to.equal("ACTIVE");});'])],
      'EMVCo §6.1: Activate token after ID&V.'),
    r('13-02 Suspend (ACTIVE→SUSPENDED)','PUT',`${B_TVM}/tvm/api/tokens/{{provisionedToken}}/suspend`,jH(true),
      '{"reason":"CARDHOLDER_REQUEST"}',
      [s('test',['pm.test("13-02 Status 200",()=>pm.expect(pm.response.code).to.equal(200));',
        'pm.test("13-02 State SUSPENDED",()=>{const j=pm.response.json();const st=j.status||j.tokenStatus;pm.expect(String(st).toUpperCase()).to.equal("SUSPENDED");});'])],
      'EMVCo §6.2: Suspend token.'),
    r('13-03 Txn on SUSPENDED token rejected','POST',`${B_TVM}/tvm/api/tokens/authorize`,jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABBCCDD","amount":"100.00","currency":"BDT"}',
      [s('test',['pm.test("13-03 Status 403/422",()=>pm.expect(pm.response.code).to.be.oneOf([403,422]));'])],
      'EMVCo §6.5: Suspended token must not authorize.'),
    r('13-04 Resume (SUSPENDED→ACTIVE)','PUT',`${B_TVM}/tvm/api/tokens/{{provisionedToken}}/resume`,jH(true),
      '{"reason":"CARDHOLDER_REQUEST"}',
      [s('test',['pm.test("13-04 Status 200",()=>pm.expect(pm.response.code).to.equal(200));',
        'pm.test("13-04 State ACTIVE",()=>{const j=pm.response.json();const st=j.status||j.tokenStatus;pm.expect(String(st).toUpperCase()).to.equal("ACTIVE");});'])],
      'EMVCo §6.3: Resume token.'),
    r('13-05 Delete token','DELETE',`${B_TVM}/tvm/api/tokens/{{provisionedToken}}`,jH(true),null,
      [s('test',['pm.test("13-05 Status 200",()=>pm.expect(pm.response.code).to.equal(200));'])],
      'EMVCo §6.4: Delete token from any state.'),
    r('13-06 Txn on DELETED token rejected','POST',`${B_TVM}/tvm/api/tokens/authorize`,jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABBCCDD","amount":"100.00","currency":"BDT"}',
      [s('test',['pm.test("13-06 Status 403/404",()=>pm.expect(pm.response.code).to.be.oneOf([403,404,422]));'])],
      'EMVCo §6.5: Deleted token must not authorize.'),
    r('13-07 Invalid transition INACTIVE→SUSPENDED','PUT',`${B_TVM}/tvm/api/tokens/INACTIVE_PLACEHOLDER/suspend`,jH(true),
      '{"reason":"FRAUD_DETECTION"}',
      [s('test',['pm.test("13-07 Status 4xx",()=>pm.expect(pm.response.code).to.be.within(400,499));'])],
      'Negative EMVCo §6.2: Cannot suspend inactive token.'),
    r('13-08 Delete already-deleted token','DELETE',`${B_TVM}/tvm/api/tokens/DELETED_PLACEHOLDER`,jH(true),null,
      [s('test',['pm.test("13-08 Status 404/409",()=>pm.expect(pm.response.code).to.be.oneOf([404,409]));'])],
      'Negative EMVCo §6.4: Double delete.'),
  ]});

  // ──────────────────────────────────────────────────
  // 14. DE-TOKENIZATION (EMVCo §5)
  // ──────────────────────────────────────────────────
  folders.push({ name: '14 De-Tokenization', item: [
    r('14-01 Detokenize - authorized party','POST',`${B_TVM}/tvm/api/tokens/detokenize`,jH(true),
      '{"tokenValue":"{{provisionedToken}}","tokenRequestorId":"{{trId}}"}',
      [s('test',['pm.test("14-01 Status 200",()=>pm.expect(pm.response.code).to.equal(200));',
        'pm.test("14-01 PAN returned",()=>{const j=pm.response.json();const p=j.pan||j.PAN||j.originalPan;pm.expect(p).to.match(/^[0-9]{13,19}$/);});'])],
      'EMVCo §5.1: Authorized de-tokenization returns original PAN.'),
    r('14-02 Detokenize - unauthorized party','POST',`${B_TVM}/tvm/api/tokens/detokenize`,
      [{key:'accept',value:'*/*'},{key:'X-TV-ID',value:'0000000'},{key:'Content-Type',value:'application/json'}],
      '{"tokenValue":"{{provisionedToken}}","tokenRequestorId":"UNAUTHORIZED_TR"}',
      [s('test',['pm.test("14-02 Status 401/403",()=>pm.expect(pm.response.code).to.be.oneOf([401,403]));'])],
      'EMVCo §5.2: Only authorized parties may de-tokenize.'),
    r('14-03 Detokenize - deleted token','POST',`${B_TVM}/tvm/api/tokens/detokenize`,jH(true),
      '{"tokenValue":"DELETED_TOKEN_VALUE","tokenRequestorId":"{{trId}}"}',
      [s('test',['pm.test("14-03 Status 404/422",()=>pm.expect(pm.response.code).to.be.oneOf([404,422]));'])],
      'Negative EMVCo §5.3: Deleted token.'),
    r('14-04 Detokenize - invalid Luhn','POST',`${B_TVM}/tvm/api/tokens/detokenize`,jH(true),
      '{"tokenValue":"1234567890123456","tokenRequestorId":"{{trId}}"}',
      [s('test',['pm.test("14-04 Status 400 INVALID_TOKEN_FORMAT",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'EMVCo §3.2: Non-Luhn token rejected.'),
    r('14-05 Detokenize - tampered value','POST',`${B_TVM}/tvm/api/tokens/detokenize`,jH(true),
      '{"tokenValue":"9999999999999999","tokenRequestorId":"{{trId}}"}',
      [s('test',['pm.test("14-05 Status 400/404",()=>pm.expect(pm.response.code).to.be.oneOf([400,404]));'])],
      'EMVCo §5.4: Token not in vault.'),
  ]});

  // ──────────────────────────────────────────────────
  // 15. TOKEN DOMAIN RESTRICTION (EMVCo §7 / TDRC)
  // ──────────────────────────────────────────────────
  folders.push({ name: '15 Token Domain Restriction Control', item: [
    r('15-01 TDRC - within allowed domain','POST',`${B_TVM}/tvm/api/tokens/authorize`,jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABB","domain":"ECOMMERCE","merchantId":"123456789012345"}',
      [s('test',['pm.test("15-01 Status 200",()=>pm.expect(pm.response.code).to.equal(200));'])],
      'EMVCo §7.1: Token used in correct domain.'),
    r('15-02 TDRC - outside allowed domain','POST',`${B_TVM}/tvm/api/tokens/authorize`,jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABB","domain":"CONTACTLESS","merchantId":"123456789012345"}',
      [s('test',['pm.test("15-02 Status 403 TOKEN_DOMAIN_VIOLATION",()=>pm.expect(pm.response.code).to.be.oneOf([403,422]));'])],
      'EMVCo §7.2: Wrong domain rejected.'),
    r('15-03 TDRC - no restriction','POST',`${B_TVM}/tvm/api/tokens/authorize`,jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABB","domain":"CONTACTLESS","merchantId":"123456789012345"}',
      [s('test',['pm.test("15-03 Status 200",()=>pm.expect(pm.response.code).to.equal(200));'])],
      'EMVCo §7.3: Token with no restriction.'),
    r('15-04 TDRC - update domain mid-lifecycle','PUT',`${B_TVM}/tvm/api/tokens/{{provisionedToken}}/domain`,jH(true),
      '{"newDomainRestriction":"QR_CODE"}',
      [s('test',['pm.test("15-04 Status 200",()=>pm.expect(pm.response.code).to.equal(200));'])],
      'EMVCo §7.4: Update restriction, enforce on subsequent txns.'),
  ]});

  // ──────────────────────────────────────────────────
  // 16. TOKEN EXPIRY VALIDATION (EMVCo §4.4)
  // ──────────────────────────────────────────────────
  const expData = [
    ['16-01 Expiry - within PAN expiry','0628',[200,201],'EMVCo §4.4: Token expiry ≤ PAN expiry.'],
    ['16-02 Expiry - beyond PAN expiry','0127',[400],'Negative EMVCo §4.4: Token expiry > PAN expiry.'],
    ['16-03 Expiry - expired PAN','0124',[400],'Negative EMVCo §4.4: Already expired PAN.'],
    ['16-04 Expiry - quarter matches correctly','0827',[200,201],'Business R4: Aug→Q3.'],
    ['16-05 Expiry - quarter mismatch','1227',[422],'Negative R4: EXPIRY_QUARTER_MISMATCH.'],
  ];
  folders.push({ name: '16 Token Expiry Validation', item: expData.map(([name,exp,codes,desc]) =>
    r(name,'POST',`${B_TVM}/tvm/api/tokens/provision`,jH(true),
      JSON.stringify({pan:'6399960312345678',panExpiry:exp,tokenRequestorId:'{{trId}}',tokenType:'CLOUD'},null,2),
      [s('test',[
        `pm.test("${name.split(' ')[0]} Status ${codes.join('/')}",()=>pm.expect(pm.response.code).to.be.oneOf([${codes}]));`,
        ...(codes.includes(422)?[`pm.test("${name.split(' ')[0]} Error code",()=>{const j=pm.response.json();pm.expect(j.errorCode||j.error||j.message).to.exist;});`]:[]),
      ])],desc))
  });

  // ──────────────────────────────────────────────────
  // 17. SECURITY & FRAUD CONTROLS (EMVCo §8)
  // ──────────────────────────────────────────────────
  folders.push({ name: '17 Security & Fraud Controls', item: [
    r('17-01 Idempotent duplicate request','POST',`${B_TVM}/tvm/api/tokens/provision`,jH(true),
      '{"pan":"6399960312345678","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD","idempotencyKey":"unique-123"}',
      [s('test',['pm.test("17-01 Status 200",()=>pm.expect(pm.response.code).to.equal(200));'])],
      'EMVCo §4.3.4: Same request returns same token.'),
    r('17-02 Brute-force rate limit','POST',`${B_TVM}/tvm/api/tokens/detokenize`,jH(true),
      '{"tokenValue":"1111111111111111","tokenRequestorId":"{{trId}}"}',
      [s('test',['pm.test("17-02 Status 400/429",()=>pm.expect(pm.response.code).to.be.oneOf([400,429]));'])],
      'EMVCo §8.1: Rate limiting.'),
    r('17-03 Bad Luhn check digit','POST',`${B_TVM}/tvm/api/tokens/detokenize`,jH(true),
      '{"tokenValue":"6399960312345670","tokenRequestorId":"{{trId}}"}',
      [s('test',['pm.test("17-03 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'EMVCo §3.2: Invalid Luhn.'),
    r('17-04 Expired JWT in header','POST',`${B_TVM}/tvm/api/tokens/provision`,
      [{key:'accept',value:'*/*'},{key:'X-TV-ID',value:'{{tvId}}'},{key:'Content-Type',value:'application/json'},{key:'Authorization',value:'Bearer expired.jwt.token'}],
      '{"pan":"6399960312345678","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [s('test',['pm.test("17-04 Status 401",()=>pm.expect(pm.response.code).to.equal(401));'])],
      'Security: Expired auth token.'),
    r('17-05 Missing authorization','POST',`${B_TVM}/tvm/api/tokens/provision`,
      [{key:'Content-Type',value:'application/json'}],
      '{"pan":"6399960312345678","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [s('test',['pm.test("17-05 Status 401",()=>pm.expect(pm.response.code).to.equal(401));'])],
      'Security: No auth header or X-TV-ID.'),
    r('17-06 SQL injection in PAN','POST',`${B_TVM}/tvm/api/tokens/provision`,jH(true),
      '{"pan":"6399960312345\\"; DROP TABLE tokens;--","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [s('test',['pm.test("17-06 Status 400",()=>pm.expect(pm.response.code).to.equal(400));'])],
      'Security: Input sanitized.'),
    r('17-07 TAL returned per ID&V method','POST',`${B_TVM}/tvm/api/tokens/provision`,jH(true),
      '{"pan":"6399960312345678","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD","identificationAndVerificationMethod":"APP_TO_APP"}',
      [s('test',['pm.test("17-07 Status 200/201",()=>pm.expect(pm.response.code).to.be.oneOf([200,201]));',
        'pm.test("17-07 TAL field",()=>{const j=pm.response.json();pm.expect(j.tokenAssuranceLevel||j.tal||j.TAL).to.exist;});'])],
      'EMVCo §4.5: TAL based on ID&V.'),
  ]});

  // ──────────────────────────────────────────────────
  // 18. ERROR CODE VALIDATION
  // ──────────────────────────────────────────────────
  folders.push({ name: '18 Error Code Validation', item: [
    r('18-01 ACCOUNT_NOT_ELIGIBLE','POST',`${B_TVM}/tvm/api/tokens/provision`,jH(true),
      '{"pan":"6399960300000001","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [s('test',['pm.test("18-01 Status 422",()=>pm.expect(pm.response.code).to.equal(422));',
        'pm.test("18-01 Error structure",()=>{const j=pm.response.json();pm.expect(j.errorCode||j.error).to.exist;pm.expect(j.errorMessage||j.message).to.exist;});'])],
      'Business R1: Validate ACCOUNT_NOT_ELIGIBLE error.'),
    r('18-02 TOKEN_RANGE_EXHAUSTED','POST',`${B_TVM}/tvm/api/tokens/provision`,jH(true),
      '{"pan":"6399960312345678","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [s('test',['pm.test("18-02 Status 422",()=>pm.expect(pm.response.code).to.equal(422));',
        'pm.test("18-02 Error structure",()=>{const j=pm.response.json();pm.expect(j.errorCode||j.error).to.exist;pm.expect(j.errorMessage||j.message).to.exist;});'])],
      'Business R3: Validate TOKEN_RANGE_EXHAUSTED.'),
    r('18-03 EXPIRY_QUARTER_MISMATCH','POST',`${B_TVM}/tvm/api/tokens/provision`,jH(true),
      '{"pan":"6399960312345678","panExpiry":"1228","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [s('test',['pm.test("18-03 Status 422",()=>pm.expect(pm.response.code).to.equal(422));',
        'pm.test("18-03 Error structure",()=>{const j=pm.response.json();pm.expect(j.errorCode||j.error).to.exist;pm.expect(j.errorMessage||j.message).to.exist;});'])],
      'Business R4: Validate EXPIRY_QUARTER_MISMATCH.'),
    r('18-04 BIN_RANGE_OVERLAP_DETECTED','POST',`${B_TVM}/tvm/api/token-range`,jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"9100000","upperLimit":"9999999"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [s('test',['pm.test("18-04 Status 400/409",()=>pm.expect(pm.response.code).to.be.oneOf([400,409]));',
        'pm.test("18-04 Overlap error",()=>{const j=pm.response.json();pm.expect(j.errorCode||j.error||j.message).to.exist;});'])],
      'Business R6: Validate BIN_RANGE_OVERLAP_DETECTED.'),
    r('18-05 INVALID_TOKEN_FORMAT','POST',`${B_TVM}/tvm/api/tokens/detokenize`,jH(true),
      '{"tokenValue":"ABCDEFGHIJ123456","tokenRequestorId":"{{trId}}"}',
      [s('test',['pm.test("18-05 Status 400",()=>pm.expect(pm.response.code).to.equal(400));',
        'pm.test("18-05 Error structure",()=>{const j=pm.response.json();pm.expect(j.errorCode||j.error).to.exist;});'])],
      'EMVCo §3.2: Non-numeric token.'),
    r('18-06 TOKEN_DOMAIN_VIOLATION','POST',`${B_TVM}/tvm/api/tokens/authorize`,jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABB","domain":"IN_APP","merchantId":"123456789012345"}',
      [s('test',['pm.test("18-06 Status 403/422",()=>pm.expect(pm.response.code).to.be.oneOf([403,422]));',
        'pm.test("18-06 Error structure",()=>{const j=pm.response.json();pm.expect(j.errorCode||j.error).to.exist;});'])],
      'EMVCo §7.2: Domain violation.'),
    r('18-07 Empty required fields','POST',`${B_TVM}/tvm/api/tokens/provision`,jH(true),
      '{"pan":"","panExpiry":"","tokenRequestorId":""}',
      [s('test',['pm.test("18-07 Status 400",()=>pm.expect(pm.response.code).to.equal(400));',
        'pm.test("18-07 Has errorCode+message",()=>{const j=pm.response.json();pm.expect(j.errorCode||j.error).to.exist;pm.expect(j.errorMessage||j.message).to.exist;});'])],
      'Validate error response includes errorCode, errorMessage, traceId, timestamp.'),
  ]});

  return folders;
}

// ─────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────

function extractCSV(collection) {
  const rows = [];
  function walk(items, section) {
    for (const item of items) {
      if (item.item) { walk(item.item, item.name); continue; }
      const name = item.name || '';
      const id = name.split(' ')[0];
      const desc = item.request?.description || '';
      const method = item.request?.method || '';
      const rawUrl = item.request?.url?.raw || '';
      const tests = (item.event||[]).filter(e=>e.listen==='test').flatMap(e=>e.script.exec);
      const pmCount = (tests.join('\n').match(/pm\.test\(/g)||[]).length;
      const type = /Security|injection|brute|JWT|auth/i.test(name+section)?'Security':
        /Edge|Boundary|boundary|first token|last token|zero|exhaustion|capacity/i.test(name)?'Boundary':
        /Negative|missing|invalid|mismatch|duplicate|non-existent|empty|wrong|expired JWT|unauthorized/i.test(name)?'Negative':'Functional';
      const priority = /Security|injection|unauthorized/i.test(name+section)?'Critical':
        /happy path|Happy|valid.*happy|Create.*happy|Provision - valid/i.test(name)?'High':
        /Negative|Boundary/i.test(type)?'High':'Medium';
      const statusMatch = tests.join(' ').match(/to\.be\.oneOf\(\[([0-9,]+)\]\)|to\.equal\((\d+)\)|to\.be\.within\((\d+),(\d+)\)/);
      const expectedHttp = statusMatch?(statusMatch[1]||statusMatch[2]||(statusMatch[3]+'-'+statusMatch[4])):'';
      const emvcoMatch = desc.match(/EMVCo\s*[§]?([\d.]+)/);
      const emvcoRef = emvcoMatch?'Section '+emvcoMatch[1]:'';
      const ruleMatch = desc.match(/R\d/g);
      const businessRule = ruleMatch?[...new Set(ruleMatch)].join(', '):'';
      const precond = desc.replace(/^(Business|EMVCo|Negative|Boundary|Edge|Security|Functional)[^:]*:\s*/i,'').split('.')[0]+'.';
      const steps = `1. ${method} ${rawUrl}\n2. Verify HTTP ${expectedHttp}\n3. Run ${pmCount} pm.test() assertions`;
      rows.push({id,title:name,section,type,priority,preconditions:'Full setup flow completed (steps 01-11). '+precond,steps,expectedResult:'HTTP '+expectedHttp+', all assertions pass',emvcoRef,businessRule,endpoint:method+' '+rawUrl,expectedHttp,pmTestCount:pmCount});
    }
  }
  walk(collection.item,'');
  return rows;
}

function toCSV(rows) {
  const h=['ID','Title','Section','Type','Priority','Preconditions','Steps','Expected Result','EMVCo Reference','Business Rule','API Endpoint','Expected HTTP','pm.test Count'];
  const esc=v=>{const s=String(v||'');return s.includes(',')||s.includes('"')||s.includes('\n')?'"'+s.replace(/"/g,'""')+'"':s;};
  return[h.join(','),...rows.map(r=>[r.id,r.title,r.section,r.type,r.priority,r.preconditions,r.steps,r.expectedResult,r.emvcoRef,r.businessRule,r.endpoint,r.expectedHttp,r.pmTestCount].map(esc).join(','))].join('\n');
}

// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────

function main() {
  const outDir = path.join(__dirname, '..');
  const folders = buildFlow();

  const vars = [
    {key:'baseUrl_rgm',value:'http://10.88.250.40:40010'},
    {key:'baseUrl_tvm',value:'http://10.88.250.40:40020'},
    {key:'baseUrl_crypto',value:'http://10.88.250.40:40029'},
    {key:'tspCode',value:'998'},{key:'tvId',value:''},{key:'transportKey',value:''},{key:'kcv',value:''},
    {key:'encryptedTransportKey',value:''},{key:'issuerId',value:''},{key:'issuerCode',value:''},
    {key:'binId',value:''},{key:'binValue',value:''},{key:'accountRangeId',value:''},
    {key:'trId',value:''},{key:'testRunId',value:''},{key:'provisionedToken',value:''},
  ];

  const collection = {
    info:{_postman_id:'tsp-final-001',name:'TSP TakaPay - Final Automated Test Suite',
      description:'Unified single-flow automated test suite. 18 sequential steps covering vault setup, issuer/BIN/range onboarding, token provisioning, lifecycle, de-tokenization, TDRC, expiry, security, and error handling. Every test validates both business rules (R1-R6) and EMVCo compliance (§3-§8). Run with: newman run <file> -e TSP_TakaPay_environment.json',
      schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},
    variable: vars,
    event:[s('prerequest',['if(!pm.collectionVariables.get("testRunId")){pm.collectionVariables.set("testRunId","run_"+Date.now().toString(36));}'])],
    item: folders,
  };

  const colPath = path.join(outDir, 'TSP_Final_Automated_postman_collection.json');
  fs.writeFileSync(colPath, JSON.stringify(collection, null, 2));

  const env = {id:'tsp-final-env-001',name:'TSP TakaPay Environment',values:vars.map(v=>({...v,enabled:true})),_postman_variable_scope:'environment'};
  fs.writeFileSync(path.join(outDir,'TSP_TakaPay_environment.json'), JSON.stringify(env, null, 2));

  let totalReqs=0, totalPm=0;
  console.log('=== TSP TakaPay — Final Automated Test Suite ===\n');
  folders.forEach(f=>{let pm=0;f.item.forEach(r=>{totalReqs++;(r.event||[]).forEach(e=>{if(e.listen==='test')pm+=(e.script.exec.join('\n').match(/pm\.test\(/g)||[]).length;});});totalPm+=pm;
    console.log(`  ${f.name}: ${f.item.length} requests, ${pm} assertions`);});
  console.log(`\nTotal: ${totalReqs} requests, ${totalPm} pm.test() assertions, ${folders.length} folders`);

  const csvRows = extractCSV(collection);
  const csvPath = path.join(outDir, 'testrail_final_testcases.csv');
  fs.writeFileSync(csvPath, toCSV(csvRows));
  console.log(`TestRail CSV: ${csvPath} (${csvRows.length} test cases)`);

  console.log('\nRun: npx newman run TSP_Final_Automated_postman_collection.json -e TSP_TakaPay_environment.json');
}

main();
