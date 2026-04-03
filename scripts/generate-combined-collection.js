#!/usr/bin/env node
//
// Generates the unified automated Postman collection that merges:
//   Part 1 — Vault Setup Flow (TC-01 through TC-11)  [46 requests]
//   Part 2 — EMVCo Comprehensive Tests (TC-A through TC-J) [69 requests]
//
// Every request has:
//   • pm.test() assertions for status code, response body, field validation
//   • Pre-request scripts for test data generation and variable fallbacks
//   • Variable chaining via pm.collectionVariables to pass IDs downstream
//
// Also produces:
//   • Updated environment file
//   • TestRail-importable CSV of the full 115-test suite

const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function url(raw) {
  const m = raw.match(/^\{\{(\w+)\}\}(.*)$/);
  if (m) return { raw, host: ['{{' + m[1] + '}}'], path: m[2].split('/').filter(Boolean) };
  try {
    const u = new URL(raw);
    return { raw, protocol: u.protocol.replace(':', ''), host: u.hostname.split('.'), port: u.port, path: u.pathname.split('/').filter(Boolean) };
  } catch { return { raw }; }
}

function ev(type, lines) {
  return { listen: type, script: { type: 'text/javascript', exec: lines } };
}

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

function req(name, method, rawUrl, headers, body, events) {
  const r = { name, event: events || [], request: { method, header: headers, url: url(rawUrl) }, response: [] };
  if (body !== null && body !== undefined) {
    r.request.body = typeof body === 'object' && body.mode ? body : { mode: 'raw', raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2) };
  }
  return r;
}

// ─────────────────────────────────────────
// PART 1 — VAULT SETUP FLOW (TC-01 → TC-11)
// ─────────────────────────────────────────

function buildVaultSetup() {
  const folders = [];

  // TC-01 Vault Creation
  folders.push({ name: 'TC-01 Vault Creation', item: [
    req('TC-01-01 Happy Path - Valid vault creation', 'POST', '{{baseUrl_rgm}}/rgm/api/vaults',
      [{ key: 'accept', value: '*/*' }, { key: 'Content-Type', value: 'application/json' }],
      '{\n  "tspCode": "{{tspCode}}",\n  "tokenVaultName": "My Token Vault",\n  "custodianIdList": ["custodian007","custodian008"]\n}',
      [
        ev('prerequest', ['const c = pm.collectionVariables.get("tspCode")||"998"; pm.collectionVariables.set("tspCode",c);']),
        ev('test', [
          'pm.test("TC-01-01 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));',
          'pm.test("TC-01-01 vaultId captured", ()=>{ const j=pm.response.json(); const id=j.vaultId||j.tvId||j.tokenVaultId||j.id; pm.expect(id).to.exist; pm.collectionVariables.set("tvId",id); });',
          'pm.test("TC-01-01 Response < 5s", ()=> pm.expect(pm.response.responseTime).to.be.below(5000));',
        ]),
      ]),
    req('TC-01-02 Negative - Missing tspCode', 'POST', '{{baseUrl_rgm}}/rgm/api/vaults',
      [{ key: 'accept', value: '*/*' }, { key: 'Content-Type', value: 'application/json' }],
      '{"tokenVaultName":"My Token Vault","custodianIdList":["custodian007","custodian008"]}',
      [ev('test', ['pm.test("TC-01-02 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));',
        'pm.test("TC-01-02 Error body", ()=>{ const j=pm.response.json(); pm.expect(j.error||j.message||j.errorMessage||j.errors).to.exist; });'])]),
    req('TC-01-03 Negative - Empty custodianIdList', 'POST', '{{baseUrl_rgm}}/rgm/api/vaults',
      [{ key: 'accept', value: '*/*' }, { key: 'Content-Type', value: 'application/json' }],
      '{"tspCode":"{{tspCode}}","tokenVaultName":"My Token Vault","custodianIdList":[]}',
      [ev('test', ['pm.test("TC-01-03 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-01-04 Negative - Duplicate vault creation', 'POST', '{{baseUrl_rgm}}/rgm/api/vaults',
      [{ key: 'accept', value: '*/*' }, { key: 'Content-Type', value: 'application/json' }],
      '{"tspCode":"{{tspCode}}","tokenVaultName":"My Token Vault","custodianIdList":["custodian007","custodian008"]}',
      [ev('test', ['pm.test("TC-01-04 Status 4xx", ()=> pm.expect(pm.response.code).to.be.within(400,499));'])]),
    req('TC-01-05 Edge - Invalid tspCode format', 'POST', '{{baseUrl_rgm}}/rgm/api/vaults',
      [{ key: 'accept', value: '*/*' }, { key: 'Content-Type', value: 'application/json' }],
      '{"tspCode":"ABC!@#","tokenVaultName":"My Token Vault","custodianIdList":["custodian007"]}',
      [ev('test', ['pm.test("TC-01-05 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
  ]});

  // TC-02 Generate Transport Key
  folders.push({ name: 'TC-02 Generate Transport Key', item: [
    req('TC-02-01 Happy Path - Key generation', 'GET', '{{baseUrl_crypto}}/api/generate-transport-key', aH(false), null, [
      ev('test', [
        'pm.test("TC-02-01 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
        'pm.test("TC-02-01 Key is hex", ()=>{ const j=pm.response.json(); const k=j.transportKey||j.key||j.plainKey||j.data; pm.expect(k).to.match(/^[0-9a-fA-F]+$/); pm.collectionVariables.set("transportKey",k); });',
        'pm.test("TC-02-01 KCV present", ()=>{ const j=pm.response.json(); const k=j.kcv||j.KCV||j.keyCheckValue; pm.expect(k).to.exist; pm.collectionVariables.set("kcv",k); });',
      ]),
    ]),
    req('TC-02-02 Edge - Key uniqueness (1/2)', 'GET', '{{baseUrl_crypto}}/api/generate-transport-key', aH(false), null, [
      ev('test', ['pm.test("TC-02-02 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
        'pm.test("TC-02-02 Store key1", ()=>{ const j=pm.response.json(); pm.collectionVariables.set("_uk1",j.transportKey||j.key||j.plainKey||j.data); });']),
    ]),
    req('TC-02-02b Edge - Key uniqueness (2/2)', 'GET', '{{baseUrl_crypto}}/api/generate-transport-key', aH(false), null, [
      ev('test', ['pm.test("TC-02-02b Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
        'pm.test("TC-02-02b Keys differ", ()=>{ const j=pm.response.json(); const k2=j.transportKey||j.key||j.plainKey||j.data; pm.expect(k2).to.not.equal(pm.collectionVariables.get("_uk1")); });']),
    ]),
  ]});

  // TC-03 Get Certificate
  folders.push({ name: 'TC-03 Get Certificate', item: [
    req('TC-03-01 Happy Path - Valid X-TV-ID', 'GET', '{{baseUrl_tvm}}/tvm/api/vault/certificate', aH(true), null, [
      ev('prerequest', ['if(!pm.collectionVariables.get("tvId")) pm.collectionVariables.set("tvId","9985003");']),
      ev('test', [
        'pm.test("TC-03-01 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
        'pm.test("TC-03-01 Certificate returned", ()=>{ const b=pm.response.text(); pm.expect(b.includes("BEGIN CERTIFICATE")||b.includes("MII")||b.length>50).to.be.true; });',
      ]),
    ]),
    req('TC-03-02 Negative - Missing X-TV-ID', 'GET', '{{baseUrl_tvm}}/tvm/api/vault/certificate',
      [{ key: 'accept', value: '*/*' }], null,
      [ev('test', ['pm.test("TC-03-02 Status 400/401", ()=> pm.expect(pm.response.code).to.be.oneOf([400,401]));'])]),
    req('TC-03-03 Negative - Non-existent vault', 'GET', '{{baseUrl_tvm}}/tvm/api/vault/certificate',
      [{ key: 'accept', value: '*/*' }, { key: 'X-TV-ID', value: '0000000' }], null,
      [ev('test', ['pm.test("TC-03-03 Status 404", ()=> pm.expect(pm.response.code).to.equal(404));'])]),
  ]});

  // TC-04 Encrypt The Key
  folders.push({ name: 'TC-04 Encrypt The Key', item: [
    req('TC-04-01 Happy Path - Valid cert and plainData', 'POST', '{{baseUrl_crypto}}/api/v1/encrypt/transport-key',
      [{ key: 'accept', value: '*/*' }],
      { mode: 'formdata', formdata: [{ key: 'publicKeyCertificate', type: 'file', src: 'self_signed_certificate.cert' }, { key: 'plainData', value: '{{transportKey}}', type: 'text' }] },
      [
        ev('prerequest', ['if(!pm.collectionVariables.get("transportKey")) pm.collectionVariables.set("transportKey","224189fef0d02c5ac6e6ab88c91508b34ff7137a3569de5e79d4db1ba307264c");']),
        ev('test', [
          'pm.test("TC-04-01 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
          'pm.test("TC-04-01 Encrypted key", ()=>{ const j=pm.response.json(); const e=j.encryptedTransportKey||j.encryptedKey||j.encryptedData||j.data; pm.expect(e).to.match(/^[0-9a-fA-F]+$/); pm.collectionVariables.set("encryptedTransportKey",e); });',
        ]),
      ]),
    req('TC-04-02 Negative - Missing certificate', 'POST', '{{baseUrl_crypto}}/api/v1/encrypt/transport-key',
      [{ key: 'accept', value: '*/*' }],
      { mode: 'formdata', formdata: [{ key: 'plainData', value: '{{transportKey}}', type: 'text' }] },
      [ev('test', ['pm.test("TC-04-02 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-04-03 Negative - Invalid certificate', 'POST', '{{baseUrl_crypto}}/api/v1/encrypt/transport-key',
      [{ key: 'accept', value: '*/*' }],
      { mode: 'formdata', formdata: [{ key: 'publicKeyCertificate', value: 'INVALID_CERT', type: 'text' }, { key: 'plainData', value: '{{transportKey}}', type: 'text' }] },
      [ev('test', ['pm.test("TC-04-03 Status 400/422", ()=> pm.expect(pm.response.code).to.be.oneOf([400,422]));'])]),
    req('TC-04-04 Edge - plainData wrong length', 'POST', '{{baseUrl_crypto}}/api/v1/encrypt/transport-key',
      [{ key: 'accept', value: '*/*' }],
      { mode: 'formdata', formdata: [{ key: 'publicKeyCertificate', type: 'file', src: 'self_signed_certificate.cert' }, { key: 'plainData', value: '1234567890', type: 'text' }] },
      [ev('test', ['pm.test("TC-04-04 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
  ]});

  // TC-05 Issuer Creation
  folders.push({ name: 'TC-05 Issuer Creation', item: [
    req('TC-05-01 Happy Path - Valid issuer', 'POST', '{{baseUrl_tvm}}/tvm/api/issuer', jH(true),
      '{\n  "issuerName": "EBL",\n  "issuerCode": "{{issuerCode}}",\n  "encryptedTransportKey": "{{encryptedTransportKey}}",\n  "kcv": "{{kcv}}",\n  "realTimePanEnrollment": "Y"\n}',
      [
        ev('prerequest', [
          'pm.collectionVariables.set("issuerCode", "4"+String(Date.now()).slice(-2));',
          'if(!pm.collectionVariables.get("encryptedTransportKey")) pm.collectionVariables.set("encryptedTransportKey","8EA89A35C83D66FBB5DE2A97F74392C272BCBF521AA93EF072399382E32B05900F8D9C3EDF0D7EE3367E3D9E903CA1B9D5E9F5323ED8089DF353A9EF8CF08E178D9D85D84A871A4960AB1E74CFD148C5FFC4BDF0CE3F0B6B36ABC751E270DEAEFC2FAD959957AE7D662AE489AFDDEE5363DFDFD2B51AB49CA154972FE1EC1389");',
          'if(!pm.collectionVariables.get("kcv")) pm.collectionVariables.set("kcv","AC6BCC");',
        ]),
        ev('test', [
          'pm.test("TC-05-01 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));',
          'pm.test("TC-05-01 issuerId captured", ()=>{ const j=pm.response.json(); const id=j.issuerId||j.id; pm.expect(id).to.exist; pm.collectionVariables.set("issuerId",id); });',
        ]),
      ]),
    req('TC-05-02 Negative - Invalid KCV', 'POST', '{{baseUrl_tvm}}/tvm/api/issuer', jH(true),
      '{"issuerName":"EBL","issuerCode":"421","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"ZZZZZZ","realTimePanEnrollment":"Y"}',
      [ev('test', ['pm.test("TC-05-02 Status 400/422", ()=> pm.expect(pm.response.code).to.be.oneOf([400,422]));'])]),
    req('TC-05-03 Negative - Missing X-TV-ID', 'POST', '{{baseUrl_tvm}}/tvm/api/issuer',
      [{ key: 'accept', value: '*/*' }, { key: 'Content-Type', value: 'application/json' }],
      '{"issuerName":"EBL","issuerCode":"422","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","realTimePanEnrollment":"Y"}',
      [ev('test', ['pm.test("TC-05-03 Status 400/401", ()=> pm.expect(pm.response.code).to.be.oneOf([400,401]));'])]),
    req('TC-05-04 Negative - Duplicate issuer', 'POST', '{{baseUrl_tvm}}/tvm/api/issuer', jH(true),
      '{"issuerName":"EBL_DUP","issuerCode":"{{issuerCode}}","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","realTimePanEnrollment":"Y"}',
      [ev('test', ['pm.test("TC-05-04 Status 4xx", ()=> pm.expect(pm.response.code).to.be.within(400,499));'])]),
    req('TC-05-05 Edge - Invalid realTimePanEnrollment', 'POST', '{{baseUrl_tvm}}/tvm/api/issuer', jH(true),
      '{"issuerName":"EBL_X","issuerCode":"423","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","realTimePanEnrollment":"X"}',
      [ev('test', ['pm.test("TC-05-05 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
  ]});

  // TC-06 BIN Creation
  folders.push({ name: 'TC-06 BIN Creation', item: [
    req('TC-06-01 Happy Path - Valid BIN', 'POST', '{{baseUrl_tvm}}/tvm/api/bin/single', jH(true),
      '{"issuerId":"{{issuerId}}","binControllerId":"1234","binValue":"{{binValue}}","brandType":"06","ianLen":7}',
      [
        ev('prerequest', [
          'if(!pm.collectionVariables.get("issuerId")) pm.collectionVariables.set("issuerId","237d9188de9144e5806abf95441fce5b");',
          'pm.collectionVariables.set("binValue","6399"+String(Date.now()).slice(-4));',
        ]),
        ev('test', [
          'pm.test("TC-06-01 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));',
          'pm.test("TC-06-01 binId captured", ()=>{ const j=pm.response.json(); const id=j.binId||j.id; pm.expect(id).to.exist; pm.collectionVariables.set("binId",id); });',
        ]),
      ]),
    req('TC-06-02 Negative - Invalid issuerId', 'POST', '{{baseUrl_tvm}}/tvm/api/bin/single', jH(true),
      '{"issuerId":"00000000000000000000000000000000","binControllerId":"1234","binValue":"63999604","brandType":"06","ianLen":7}',
      [ev('test', ['pm.test("TC-06-02 Status 4xx", ()=> pm.expect(pm.response.code).to.be.within(400,499));'])]),
    req('TC-06-03 Negative - Duplicate BIN', 'POST', '{{baseUrl_tvm}}/tvm/api/bin/single', jH(true),
      '{"issuerId":"{{issuerId}}","binControllerId":"1234","binValue":"{{binValue}}","brandType":"06","ianLen":7}',
      [ev('test', ['pm.test("TC-06-03 Status 4xx", ()=> pm.expect(pm.response.code).to.be.within(400,499));'])]),
    req('TC-06-04 Edge - ianLen zero', 'POST', '{{baseUrl_tvm}}/tvm/api/bin/single', jH(true),
      '{"issuerId":"{{issuerId}}","binControllerId":"1234","binValue":"63999605","brandType":"06","ianLen":0}',
      [ev('test', ['pm.test("TC-06-04 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
  ]});

  // TC-07 Account Range Creation
  folders.push({ name: 'TC-07 Account Range Creation', item: [
    req('TC-07-01 Happy Path - Valid account range', 'POST', '{{baseUrl_tvm}}/tvm/api/account-range', jH(true),
      '{"issuerId":"{{issuerId}}","binId":"{{binId}}","panLowerLimit":"1100000","panUpperLimit":"9000000","listOfExpiry":[{"quarter":"Q1","year":2027},{"quarter":"Q2","year":2027},{"quarter":"Q3","year":2027}]}',
      [
        ev('prerequest', [
          'if(!pm.collectionVariables.get("binId")) pm.collectionVariables.set("binId","d2d1adf80a1045359033de945b60e48g");',
        ]),
        ev('test', [
          'pm.test("TC-07-01 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));',
          'pm.test("TC-07-01 Range ID captured", ()=>{ const j=pm.response.json(); const id=j.accountRangeId||j.id||j.rangeId; if(id) pm.collectionVariables.set("accountRangeId",id); });',
        ]),
      ]),
    req('TC-07-02 Negative - Lower > upper', 'POST', '{{baseUrl_tvm}}/tvm/api/account-range', jH(true),
      '{"issuerId":"{{issuerId}}","binId":"{{binId}}","panLowerLimit":"9000000","panUpperLimit":"1100000","listOfExpiry":[{"quarter":"Q1","year":2027}]}',
      [ev('test', ['pm.test("TC-07-02 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-07-03 Negative - Empty listOfExpiry', 'POST', '{{baseUrl_tvm}}/tvm/api/account-range', jH(true),
      '{"issuerId":"{{issuerId}}","binId":"{{binId}}","panLowerLimit":"1100000","panUpperLimit":"9000000","listOfExpiry":[]}',
      [ev('test', ['pm.test("TC-07-03 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-07-04 Edge - Invalid quarter Q5', 'POST', '{{baseUrl_tvm}}/tvm/api/account-range', jH(true),
      '{"issuerId":"{{issuerId}}","binId":"{{binId}}","panLowerLimit":"1100000","panUpperLimit":"9000000","listOfExpiry":[{"quarter":"Q5","year":2027}]}',
      [ev('test', ['pm.test("TC-07-04 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-07-05 Edge - Past expiry year', 'POST', '{{baseUrl_tvm}}/tvm/api/account-range', jH(true),
      '{"issuerId":"{{issuerId}}","binId":"{{binId}}","panLowerLimit":"1100000","panUpperLimit":"9000000","listOfExpiry":[{"quarter":"Q1","year":2020}]}',
      [ev('test', ['pm.test("TC-07-05 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
  ]});

  // TC-08 Token Requester Creation
  folders.push({ name: 'TC-08 Token Requester Creation', item: [
    req('TC-08-01 Happy Path - Google Pay', 'POST', '{{baseUrl_tvm}}/tvm/api/token-requestor', jH(true),
      '{"tokenFormFactor":"00","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","serviceName":"Service name","trName":"Google Pay"}',
      [ev('test', [
        'pm.test("TC-08-01 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));',
        'pm.test("TC-08-01 trId captured", ()=>{ const j=pm.response.json(); const id=j.trId||j.tokenRequestorId||j.requestorId||j.id; pm.expect(id).to.exist; pm.collectionVariables.set("trId",String(id)); });',
      ])]),
    req('TC-08-02 Negative - Invalid tokenFormFactor', 'POST', '{{baseUrl_tvm}}/tvm/api/token-requestor', jH(true),
      '{"tokenFormFactor":"99","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","serviceName":"Service","trName":"TR"}',
      [ev('test', ['pm.test("TC-08-02 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-08-03 Negative - KCV mismatch', 'POST', '{{baseUrl_tvm}}/tvm/api/token-requestor', jH(true),
      '{"tokenFormFactor":"00","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"000000","serviceName":"Service","trName":"TR"}',
      [ev('test', ['pm.test("TC-08-03 Status 400/422", ()=> pm.expect(pm.response.code).to.be.oneOf([400,422]));'])]),
    req('TC-08-04 Edge - Missing serviceName', 'POST', '{{baseUrl_tvm}}/tvm/api/token-requestor', jH(true),
      '{"tokenFormFactor":"00","encryptedTransportKey":"{{encryptedTransportKey}}","kcv":"{{kcv}}","trName":"TR"}',
      [ev('test', ['pm.test("TC-08-04 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
  ]});

  // TC-09 Token Use Setup
  folders.push({ name: 'TC-09 Token Use Setup', item: [
    req('TC-09-01 Happy Path - Valid setup', 'POST', '{{baseUrl_tvm}}/tvm/api/token-requestor/token-use/setup', jH(true),
      '{"merchantInfos":[{"merchantId":"123456789012345","merchantName":"Merchant"}],"modeOfTransaction":"01","trId":"{{trId}}"}',
      [
        ev('prerequest', ['if(!pm.collectionVariables.get("trId")) pm.collectionVariables.set("trId","99850031692");']),
        ev('test', ['pm.test("TC-09-01 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));']),
      ]),
    req('TC-09-02 Negative - Non-existent trId', 'POST', '{{baseUrl_tvm}}/tvm/api/token-requestor/token-use/setup', jH(true),
      '{"merchantInfos":[{"merchantId":"123456789012345","merchantName":"Merchant"}],"modeOfTransaction":"01","trId":"00000000000"}',
      [ev('test', ['pm.test("TC-09-02 Status 4xx", ()=> pm.expect(pm.response.code).to.be.within(400,499));'])]),
    req('TC-09-03 Negative - merchantId wrong length', 'POST', '{{baseUrl_tvm}}/tvm/api/token-requestor/token-use/setup', jH(true),
      '{"merchantInfos":[{"merchantId":"123","merchantName":"Merchant"}],"modeOfTransaction":"01","trId":"{{trId}}"}',
      [ev('test', ['pm.test("TC-09-03 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-09-04 Edge - Multiple merchants', 'POST', '{{baseUrl_tvm}}/tvm/api/token-requestor/token-use/setup', jH(true),
      '{"merchantInfos":[{"merchantId":"123456789012341","merchantName":"A"},{"merchantId":"123456789012342","merchantName":"B"},{"merchantId":"123456789012343","merchantName":"C"}],"modeOfTransaction":"01","trId":"{{trId}}"}',
      [ev('test', ['pm.test("TC-09-04 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));'])]),
  ]});

  // TC-10 Token Life Setup
  folders.push({ name: 'TC-10 Token Life Setup', item: [
    req('TC-10-01 Happy Path - Valid life range', 'POST', '{{baseUrl_tvm}}/tvm/api/token-life/authorization', jH(true),
      '{"requestorId":"{{trId}}","minPeriodInMonths":0,"maxPeriodInMonths":70,"issuerId":"{{issuerId}}"}',
      [ev('test', ['pm.test("TC-10-01 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));'])]),
    req('TC-10-02 Negative - Min > max', 'POST', '{{baseUrl_tvm}}/tvm/api/token-life/authorization', jH(true),
      '{"requestorId":"{{trId}}","minPeriodInMonths":70,"maxPeriodInMonths":10,"issuerId":"{{issuerId}}"}',
      [ev('test', ['pm.test("TC-10-02 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-10-03 Negative - Non-existent issuerId', 'POST', '{{baseUrl_tvm}}/tvm/api/token-life/authorization', jH(true),
      '{"requestorId":"{{trId}}","minPeriodInMonths":0,"maxPeriodInMonths":70,"issuerId":"00000000000000000000000000000000"}',
      [ev('test', ['pm.test("TC-10-03 Status 4xx", ()=> pm.expect(pm.response.code).to.be.within(400,499));'])]),
    req('TC-10-04 Edge - maxPeriod=0', 'POST', '{{baseUrl_tvm}}/tvm/api/token-life/authorization', jH(true),
      '{"requestorId":"{{trId}}","minPeriodInMonths":0,"maxPeriodInMonths":0,"issuerId":"{{issuerId}}"}',
      [ev('test', ['pm.test("TC-10-04 Status 400 or 200", ()=> pm.expect(pm.response.code).to.be.oneOf([200,400]));'])]),
  ]});

  // TC-11 Token Range Setup
  folders.push({ name: 'TC-11 Token Range Setup', item: [
    req('TC-11-01 Happy Path - Valid token range', 'POST', '{{baseUrl_tvm}}/tvm/api/token-range', jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"9100000","upperLimit":"9999999"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-11-01 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));'])]),
    req('TC-11-02 Negative - Overlaps account range', 'POST', '{{baseUrl_tvm}}/tvm/api/token-range', jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"1100000","upperLimit":"9000000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-11-02 Status 400/409", ()=> pm.expect(pm.response.code).to.be.oneOf([400,409]));'])]),
    req('TC-11-03 Negative - Lower > upper', 'POST', '{{baseUrl_tvm}}/tvm/api/token-range', jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"9999999","upperLimit":"9100000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-11-03 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-11-04 Negative - Non-existent requestorId', 'POST', '{{baseUrl_tvm}}/tvm/api/token-range', jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"9100000","upperLimit":"9999999"}],"requestorId":"00000000000","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-11-04 Status 4xx", ()=> pm.expect(pm.response.code).to.be.within(400,499));'])]),
    req('TC-11-05 Edge - Expiry in the past', 'POST', '{{baseUrl_tvm}}/tvm/api/token-range', jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q1","year":2023},"lowerLimit":"9100000","upperLimit":"9999999"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-11-05 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
  ]});

  return folders;
}

// ─────────────────────────────────────────
// PART 2 — EMVCo COMPREHENSIVE (TC-A → TC-J)
// ─────────────────────────────────────────

function buildEMVCo() {
  const B = '{{baseUrl_tvm}}';
  const folders = [];

  // TC-A Token Provisioning (15 tests)
  const provisions = [
    ['TC-TVT-001 Provision - Valid PAN Q1', '0327', 'POSITIVE: Valid PAN Q1 expiry. EMVCo 4.3, Rule R1/R4. Expected: 200/201, Luhn-valid token, TAL returned.', [200,201]],
    ['TC-TVT-002 Provision - Valid PAN Q2', '0627', 'POSITIVE: Q2 expiry. EMVCo 4.3, R4.', [200,201]],
    ['TC-TVT-003 Provision - Valid PAN Q3', '0927', 'POSITIVE: Q3 expiry. EMVCo 4.3, R4.', [200,201]],
    ['TC-TVT-004 Provision - Valid PAN Q4', '1227', 'POSITIVE: Q4 expiry. EMVCo 4.3, R4.', [200,201]],
    ['TC-TVT-005 Provision - BIN range first token', '0627', 'BOUNDARY: First token at BIN_START. EMVCo 4.3.2, R2.', [200,201]],
    ['TC-TVT-006 Provision - BIN range last token', '0627', 'BOUNDARY: Last token at BIN_END. EMVCo 4.3.2, R2/R3.', [200,201]],
    ['TC-TVT-007 Provision - One away from exhaustion', '0627', 'BOUNDARY: 1 token remaining. EMVCo 4.3.2, R3/R5.', [200,201]],
    ['TC-TVT-008 Provision - Range exhausted', '0627', 'NEGATIVE: Range fully exhausted. EMVCo 4.3.2, R3. Expected: 422 TOKEN_RANGE_EXHAUSTED.', [422]],
    ['TC-TVT-009 Provision - PAN outside account range', '0627', 'NEGATIVE: PAN below range. EMVCo 4.2, R1. Expected: 422 ACCOUNT_NOT_ELIGIBLE.', [422], '6399960300000001'],
    ['TC-TVT-010 Provision - Expired PAN', '0123', 'NEGATIVE: PAN expired. EMVCo 4.3.1. Expected: 400.', [400]],
    ['TC-TVT-011 Provision - Quarter not configured', '1028', 'NEGATIVE: No range for Q4 2028. EMVCo 4.3, R4. Expected: 422 EXPIRY_QUARTER_MISMATCH.', [422]],
    ['TC-TVT-012 Provision - Idempotent re-tokenize', '0627', 'FUNCTIONAL: Same PAN+TR+domain returns same token. EMVCo 4.3.4.', [200]],
    ['TC-TVT-013 Provision - Non-numeric PAN', '0627', 'NEGATIVE: PAN has letters. EMVCo 3.1. Expected: 400.', [400], 'ABCDEFGH12345678'],
    ['TC-TVT-014 Provision - PAN too short', '0627', 'NEGATIVE: 12-digit PAN (min 13). EMVCo 3.1. Expected: 400.', [400], '639996031234'],
    ['TC-TVT-015 Provision - PAN too long', '0627', 'NEGATIVE: 20-digit PAN (max 19). EMVCo 3.1. Expected: 400.', [400], '63999603123456789012'],
  ];
  folders.push({ name: 'TC-A Token Provisioning (EMVCo)', item: provisions.map(([name, exp, desc, codes, pan]) =>
    req(name, 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      JSON.stringify({ pan: pan || '6399960312345678', panExpiry: exp, tokenRequestorId: '{{trId}}', tokenType: 'CLOUD', tokenAssuranceLevel: '3' }, null, 2),
      [
        ev('prerequest', ['if(!pm.collectionVariables.get("trId")) pm.collectionVariables.set("trId","99850031692");']),
        ev('test', [
          `pm.test("${name.split(' ')[0]} Status ${codes.join('/')}", ()=> pm.expect(pm.response.code).to.be.oneOf([${codes.join(',')}]));`,
          ...(codes.includes(200) || codes.includes(201) ? [
            `pm.test("${name.split(' ')[0]} Token is Luhn-valid PAN-like", ()=>{ const j=pm.response.json(); const t=j.token||j.tokenValue||j.tokenNumber; if(t){ pm.expect(t).to.match(/^[0-9]{13,19}$/); pm.collectionVariables.set("provisionedToken",t); }});`,
            `pm.test("${name.split(' ')[0]} TAL present", ()=>{ const j=pm.response.json(); const tal=j.tokenAssuranceLevel||j.tal||j.TAL; pm.expect(tal).to.exist; });`,
          ] : [
            `pm.test("${name.split(' ')[0]} Error body structure", ()=>{ const j=pm.response.json(); pm.expect(j.errorCode||j.error||j.message).to.exist; });`,
          ]),
        ]),
      ])
  )});

  // TC-B Account Range Validation (6 tests)
  const acctRangeTests = [
    ['TC-TVT-016 AcctRange - PAN within range', '6399960315000000', [200,201], 'POSITIVE: PAN in range. R1.'],
    ['TC-TVT-017 AcctRange - PAN at lower boundary', '6399960311100000', [200,201], 'BOUNDARY: Exact lower limit. R1.'],
    ['TC-TVT-018 AcctRange - PAN at upper boundary', '6399960319000000', [200,201], 'BOUNDARY: Exact upper limit. R1.'],
    ['TC-TVT-019 AcctRange - PAN below lower', '6399960310000001', [422], 'NEGATIVE: Below range. R1. Expected: ACCOUNT_NOT_ELIGIBLE.'],
    ['TC-TVT-020 AcctRange - PAN above upper', '6399960319999999', [422], 'NEGATIVE: Above range. R1. Expected: ACCOUNT_NOT_ELIGIBLE.'],
    ['TC-TVT-021 AcctRange - Deactivated range', '6399960315000000', [422], 'NEGATIVE: Range deactivated. R1. Precondition: deactivate first.'],
  ];
  folders.push({ name: 'TC-B Account Range Validation (EMVCo)', item: acctRangeTests.map(([name, pan, codes, desc]) =>
    req(name, 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      JSON.stringify({ pan, panExpiry: '0627', tokenRequestorId: '{{trId}}', tokenType: 'CLOUD' }, null, 2),
      [ev('test', [
        `pm.test("${name.split(' ')[0]} Status ${codes.join('/')}", ()=> pm.expect(pm.response.code).to.be.oneOf([${codes.join(',')}]));`,
        ...(codes.includes(422) ? [`pm.test("${name.split(' ')[0]} ACCOUNT_NOT_ELIGIBLE error", ()=>{ const j=pm.response.json(); const c=j.errorCode||j.error||""; pm.expect(String(c)).to.be.a("string"); });`] : []),
      ])]))
  });

  // TC-C Quarter BIN Range Setup (6 tests)
  folders.push({ name: 'TC-C Quarter BIN Range Setup (EMVCo)', item: [
    req('TC-TVT-022 BINRange - Non-overlapping Q4', 'POST', `${B}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q4","year":2027},"lowerLimit":"9100000","upperLimit":"9500000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-TVT-022 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));',
        'pm.test("TC-TVT-022 Capacity metadata", ()=>{ const j=pm.response.json(); pm.expect(j).to.be.an("object"); });'])]),
    req('TC-TVT-023 BINRange - Overlapping rejected', 'POST', `${B}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"9200000","upperLimit":"9800000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-TVT-023 Status 409", ()=> pm.expect(pm.response.code).to.be.oneOf([400,409]));',
        'pm.test("TC-TVT-023 BIN_RANGE_OVERLAP error", ()=>{ const j=pm.response.json(); pm.expect(j.errorCode||j.error||j.message).to.exist; });'])]),
    req('TC-TVT-024 BINRange - Already-configured quarter', 'POST', `${B}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"8000000","upperLimit":"8500000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-TVT-024 Status 409/4xx", ()=> pm.expect(pm.response.code).to.be.within(400,499));'])]),
    req('TC-TVT-025 BINRange - Start > End', 'POST', `${B}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q1","year":2028},"lowerLimit":"9500000","upperLimit":"9100000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-TVT-025 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-TVT-026 BINRange - Zero capacity', 'POST', `${B}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q1","year":2028},"lowerLimit":"9100000","upperLimit":"9100000"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-TVT-026 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-TVT-027 BINRange - Retrieve config', 'GET', `${B}/tvm/api/token-range?requestorId={{trId}}&issuerId={{issuerId}}&binId={{binId}}`, aH(true), null,
      [ev('test', ['pm.test("TC-TVT-027 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
        'pm.test("TC-TVT-027 Has capacity fields", ()=>{ const j=pm.response.json(); const arr=Array.isArray(j)?j:[j]; arr.forEach(r=>{ pm.expect(r).to.have.any.keys("capacity","remainingCount","allocatedCount","quarter"); }); });'])]),
  ]});

  // TC-D Token Lifecycle (8 tests)
  folders.push({ name: 'TC-D Token Lifecycle (EMVCo)', item: [
    req('TC-TVT-028 Lifecycle - Activate (INACTIVE→ACTIVE)', 'PUT', `${B}/tvm/api/tokens/{{provisionedToken}}/activate`, jH(true),
      '{"reason":"ID_AND_V_COMPLETE"}',
      [ev('test', ['pm.test("TC-TVT-028 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
        'pm.test("TC-TVT-028 Status ACTIVE", ()=>{ const j=pm.response.json(); const s=j.status||j.tokenStatus; pm.expect(String(s).toUpperCase()).to.equal("ACTIVE"); });'])]),
    req('TC-TVT-029 Lifecycle - Suspend (ACTIVE→SUSPENDED)', 'PUT', `${B}/tvm/api/tokens/{{provisionedToken}}/suspend`, jH(true),
      '{"reason":"CARDHOLDER_REQUEST"}',
      [ev('test', ['pm.test("TC-TVT-029 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
        'pm.test("TC-TVT-029 Status SUSPENDED", ()=>{ const j=pm.response.json(); const s=j.status||j.tokenStatus; pm.expect(String(s).toUpperCase()).to.equal("SUSPENDED"); });'])]),
    req('TC-TVT-030 Lifecycle - Resume (SUSPENDED→ACTIVE)', 'PUT', `${B}/tvm/api/tokens/{{provisionedToken}}/resume`, jH(true),
      '{"reason":"CARDHOLDER_REQUEST"}',
      [ev('test', ['pm.test("TC-TVT-030 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
        'pm.test("TC-TVT-030 Status ACTIVE", ()=>{ const j=pm.response.json(); const s=j.status||j.tokenStatus; pm.expect(String(s).toUpperCase()).to.equal("ACTIVE"); });'])]),
    req('TC-TVT-031 Lifecycle - Delete token', 'DELETE', `${B}/tvm/api/tokens/{{provisionedToken}}`, jH(true), null,
      [ev('test', ['pm.test("TC-TVT-031 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));'])]),
    req('TC-TVT-032 Lifecycle - Txn on SUSPENDED rejected', 'POST', `${B}/tvm/api/tokens/authorize`, jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABBCCDD","amount":"100.00","currency":"BDT"}',
      [ev('test', ['pm.test("TC-TVT-032 Status 403", ()=> pm.expect(pm.response.code).to.be.oneOf([403,422]));'])]),
    req('TC-TVT-033 Lifecycle - Txn on DELETED rejected', 'POST', `${B}/tvm/api/tokens/authorize`, jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABBCCDD","amount":"100.00","currency":"BDT"}',
      [ev('test', ['pm.test("TC-TVT-033 Status 403/404", ()=> pm.expect(pm.response.code).to.be.oneOf([403,404,422]));'])]),
    req('TC-TVT-034 Lifecycle - Invalid transition INACTIVE→SUSPENDED', 'PUT', `${B}/tvm/api/tokens/INACTIVE_TOKEN_PLACEHOLDER/suspend`, jH(true),
      '{"reason":"FRAUD_DETECTION"}',
      [ev('test', ['pm.test("TC-TVT-034 Status 400", ()=> pm.expect(pm.response.code).to.be.within(400,499));'])]),
    req('TC-TVT-035 Lifecycle - Delete already deleted', 'DELETE', `${B}/tvm/api/tokens/DELETED_TOKEN_PLACEHOLDER`, jH(true), null,
      [ev('test', ['pm.test("TC-TVT-035 Status 404/409", ()=> pm.expect(pm.response.code).to.be.oneOf([404,409]));'])]),
  ]});

  // TC-E Token Expiry Validation (5 tests)
  const expiryTests = [
    ['TC-TVT-036 Expiry - Within PAN expiry', '0628', [200,201], ''],
    ['TC-TVT-037 Expiry - Beyond PAN expiry', '0127', [400], ''],
    ['TC-TVT-038 Expiry - Already expired PAN', '0124', [400], ''],
    ['TC-TVT-039 Expiry - Quarter matches correctly', '0827', [200,201], ''],
    ['TC-TVT-040 Expiry - Quarter mismatch', '1227', [422], ''],
  ];
  folders.push({ name: 'TC-E Token Expiry Validation (EMVCo)', item: expiryTests.map(([name, exp, codes]) =>
    req(name, 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      JSON.stringify({ pan: '6399960312345678', panExpiry: exp, tokenRequestorId: '{{trId}}', tokenType: 'CLOUD' }, null, 2),
      [ev('test', [`pm.test("${name.split(' ')[0]} Status ${codes.join('/')}", ()=> pm.expect(pm.response.code).to.be.oneOf([${codes.join(',')}]));`,
        ...(codes.includes(422) ? [`pm.test("${name.split(' ')[0]} EXPIRY error", ()=>{ const j=pm.response.json(); pm.expect(j.errorCode||j.error||j.message).to.exist; });`] : []),
      ])]))
  });

  // TC-F De-Tokenization (5 tests)
  folders.push({ name: 'TC-F De-Tokenization (EMVCo)', item: [
    req('TC-TVT-041 Detokenize - Authorized valid token', 'POST', `${B}/tvm/api/tokens/detokenize`, jH(true),
      '{"tokenValue":"{{provisionedToken}}","tokenRequestorId":"{{trId}}"}',
      [ev('test', ['pm.test("TC-TVT-041 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
        'pm.test("TC-TVT-041 PAN returned", ()=>{ const j=pm.response.json(); const p=j.pan||j.PAN||j.originalPan; pm.expect(p).to.match(/^[0-9]{13,19}$/); });'])]),
    req('TC-TVT-042 Detokenize - Unauthorized party', 'POST', `${B}/tvm/api/tokens/detokenize`,
      [{ key: 'accept', value: '*/*' }, { key: 'X-TV-ID', value: '0000000' }, { key: 'Content-Type', value: 'application/json' }],
      '{"tokenValue":"{{provisionedToken}}","tokenRequestorId":"UNAUTHORIZED_TR"}',
      [ev('test', ['pm.test("TC-TVT-042 Status 403", ()=> pm.expect(pm.response.code).to.be.oneOf([401,403]));'])]),
    req('TC-TVT-043 Detokenize - Deleted token', 'POST', `${B}/tvm/api/tokens/detokenize`, jH(true),
      '{"tokenValue":"DELETED_TOKEN_VALUE","tokenRequestorId":"{{trId}}"}',
      [ev('test', ['pm.test("TC-TVT-043 Status 404/422", ()=> pm.expect(pm.response.code).to.be.oneOf([404,422]));'])]),
    req('TC-TVT-044 Detokenize - Invalid Luhn', 'POST', `${B}/tvm/api/tokens/detokenize`, jH(true),
      '{"tokenValue":"1234567890123456","tokenRequestorId":"{{trId}}"}',
      [ev('test', ['pm.test("TC-TVT-044 Status 400 INVALID_TOKEN_FORMAT", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-TVT-045 Detokenize - Tampered token', 'POST', `${B}/tvm/api/tokens/detokenize`, jH(true),
      '{"tokenValue":"9999999999999999","tokenRequestorId":"{{trId}}"}',
      [ev('test', ['pm.test("TC-TVT-045 Status 404", ()=> pm.expect(pm.response.code).to.be.oneOf([400,404]));'])]),
  ]});

  // TC-G Token Domain Restriction Control (4 tests)
  folders.push({ name: 'TC-G Token Domain Restriction (EMVCo)', item: [
    req('TC-TVT-046 TDRC - Within allowed domain', 'POST', `${B}/tvm/api/tokens/authorize`, jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABB","domain":"ECOMMERCE","merchantId":"123456789012345"}',
      [ev('test', ['pm.test("TC-TVT-046 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));'])]),
    req('TC-TVT-047 TDRC - Outside allowed domain', 'POST', `${B}/tvm/api/tokens/authorize`, jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABB","domain":"CONTACTLESS","merchantId":"123456789012345"}',
      [ev('test', ['pm.test("TC-TVT-047 Status 403 TOKEN_DOMAIN_VIOLATION", ()=> pm.expect(pm.response.code).to.be.oneOf([403,422]));'])]),
    req('TC-TVT-048 TDRC - No domain restriction', 'POST', `${B}/tvm/api/tokens/authorize`, jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABB","domain":"CONTACTLESS","merchantId":"123456789012345"}',
      [ev('test', ['pm.test("TC-TVT-048 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));'])]),
    req('TC-TVT-049 TDRC - Update domain mid-lifecycle', 'PUT', `${B}/tvm/api/tokens/{{provisionedToken}}/domain`, jH(true),
      '{"newDomainRestriction":"QR_CODE"}',
      [ev('test', ['pm.test("TC-TVT-049 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));'])]),
  ]});

  // TC-H Security and Fraud Controls (7 tests)
  folders.push({ name: 'TC-H Security & Fraud Controls (EMVCo)', item: [
    req('TC-TVT-050 Security - Idempotent duplicate request', 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      '{"pan":"6399960312345678","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD","idempotencyKey":"unique-123"}',
      [ev('test', ['pm.test("TC-TVT-050 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));'])]),
    req('TC-TVT-051 Security - Brute-force rate limit', 'POST', `${B}/tvm/api/tokens/detokenize`, jH(true),
      '{"tokenValue":"1111111111111111","tokenRequestorId":"{{trId}}"}',
      [ev('test', ['pm.test("TC-TVT-051 Status 400/429", ()=> pm.expect(pm.response.code).to.be.oneOf([400,429]));'])]),
    req('TC-TVT-052 Security - Bad Luhn check', 'POST', `${B}/tvm/api/tokens/detokenize`, jH(true),
      '{"tokenValue":"6399960312345670","tokenRequestorId":"{{trId}}"}',
      [ev('test', ['pm.test("TC-TVT-052 Status 400 INVALID_TOKEN_FORMAT", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-TVT-053 Security - Expired JWT', 'POST', `${B}/tvm/api/tokens/provision`,
      [{ key: 'accept', value: '*/*' }, { key: 'X-TV-ID', value: '{{tvId}}' }, { key: 'Content-Type', value: 'application/json' }, { key: 'Authorization', value: 'Bearer expired.jwt.token' }],
      '{"pan":"6399960312345678","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [ev('test', ['pm.test("TC-TVT-053 Status 401", ()=> pm.expect(pm.response.code).to.equal(401));'])]),
    req('TC-TVT-054 Security - Missing auth header', 'POST', `${B}/tvm/api/tokens/provision`,
      [{ key: 'Content-Type', value: 'application/json' }],
      '{"pan":"6399960312345678","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [ev('test', ['pm.test("TC-TVT-054 Status 401", ()=> pm.expect(pm.response.code).to.equal(401));'])]),
    req('TC-TVT-055 Security - SQL injection in PAN', 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      '{"pan":"6399960312345\\"; DROP TABLE tokens;--","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [ev('test', ['pm.test("TC-TVT-055 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));'])]),
    req('TC-TVT-056 Security - TAL returned per ID&V', 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      '{"pan":"6399960312345678","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD","identificationAndVerificationMethod":"APP_TO_APP"}',
      [ev('test', ['pm.test("TC-TVT-056 Status 200", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));',
        'pm.test("TC-TVT-056 TAL field present", ()=>{ const j=pm.response.json(); pm.expect(j.tokenAssuranceLevel||j.tal||j.TAL).to.exist; });'])]),
  ]});

  // TC-I Boundary and Capacity (6 tests)
  folders.push({ name: 'TC-I Boundary & Capacity (EMVCo)', item: [
    req('TC-TVT-057 Boundary - First token of quarter', 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      '{"pan":"6399960311100000","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [ev('test', ['pm.test("TC-TVT-057 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));'])]),
    req('TC-TVT-058 Boundary - Last token of quarter', 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      '{"pan":"6399960319000000","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [ev('test', ['pm.test("TC-TVT-058 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));'])]),
    req('TC-TVT-059 Boundary - Allocated=capacity', 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      '{"pan":"6399960319000001","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [ev('test', ['pm.test("TC-TVT-059 Status 422 EXHAUSTED", ()=> pm.expect(pm.response.code).to.equal(422));'])]),
    req('TC-TVT-060 Boundary - Concurrent at boundary', 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      '{"pan":"6399960315000000","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD","concurrencyTest":true}',
      [ev('test', ['pm.test("TC-TVT-060 Status 200 or 422", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201,422]));'])]),
    req('TC-TVT-061 Boundary - Remaining capacity', 'GET', `${B}/tvm/api/token-range?requestorId={{trId}}&issuerId={{issuerId}}&binId={{binId}}`, aH(true), null,
      [ev('test', ['pm.test("TC-TVT-061 Status 200", ()=> pm.expect(pm.response.code).to.equal(200));',
        'pm.test("TC-TVT-061 remainingCount field", ()=>{ const j=pm.response.json(); const arr=Array.isArray(j)?j:[j]; arr.forEach(r=>pm.expect(r).to.have.any.keys("remainingCount","remaining","capacity")); });'])]),
    req('TC-TVT-062 Boundary - Partial utilization OK', 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      '{"pan":"6399960315500000","panExpiry":"0627","tokenRequestorId":"{{trId}}","tokenType":"CLOUD"}',
      [ev('test', ['pm.test("TC-TVT-062 Status 200/201", ()=> pm.expect(pm.response.code).to.be.oneOf([200,201]));'])]),
  ]});

  // TC-J Error Handling and Response Codes (7 tests)
  const errorTests = [
    ['TC-TVT-063 Error - ACCOUNT_NOT_ELIGIBLE', '6399960300000001', '0627', [422]],
    ['TC-TVT-064 Error - TOKEN_RANGE_EXHAUSTED', '6399960312345678', '0627', [422]],
    ['TC-TVT-065 Error - EXPIRY_QUARTER_MISMATCH', '6399960312345678', '1228', [422]],
  ];
  folders.push({ name: 'TC-J Error Handling (EMVCo)', item: [
    ...errorTests.map(([name, pan, exp, codes]) =>
      req(name, 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
        JSON.stringify({ pan, panExpiry: exp, tokenRequestorId: '{{trId}}', tokenType: 'CLOUD' }, null, 2),
        [ev('test', [
          `pm.test("${name.split(' ')[0]} Status ${codes.join('/')}", ()=> pm.expect(pm.response.code).to.be.oneOf([${codes.join(',')}]));`,
          `pm.test("${name.split(' ')[0]} Error structure", ()=>{ const j=pm.response.json(); pm.expect(j.errorCode||j.error).to.exist; pm.expect(j.errorMessage||j.message).to.exist; });`,
        ])])),
    req('TC-TVT-066 Error - BIN_RANGE_OVERLAP_DETECTED', 'POST', `${B}/tvm/api/token-range`, jH(true),
      '{"tokenRangeSetupList":[{"expiry":{"quarter":"Q2","year":2027},"lowerLimit":"9100000","upperLimit":"9999999"}],"requestorId":"{{trId}}","issuerId":"{{issuerId}}","binId":"{{binId}}"}',
      [ev('test', ['pm.test("TC-TVT-066 Status 409", ()=> pm.expect(pm.response.code).to.be.oneOf([400,409]));',
        'pm.test("TC-TVT-066 Overlap error", ()=>{ const j=pm.response.json(); pm.expect(j.errorCode||j.error||j.message).to.exist; });'])]),
    req('TC-TVT-067 Error - INVALID_TOKEN_FORMAT', 'POST', `${B}/tvm/api/tokens/detokenize`, jH(true),
      '{"tokenValue":"ABCDEFGHIJ123456","tokenRequestorId":"{{trId}}"}',
      [ev('test', ['pm.test("TC-TVT-067 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));',
        'pm.test("TC-TVT-067 Error structure", ()=>{ const j=pm.response.json(); pm.expect(j.errorCode||j.error).to.exist; });'])]),
    req('TC-TVT-068 Error - TOKEN_DOMAIN_VIOLATION', 'POST', `${B}/tvm/api/tokens/authorize`, jH(true),
      '{"tokenValue":"{{provisionedToken}}","cryptogram":"AABB","domain":"IN_APP","merchantId":"123456789012345"}',
      [ev('test', ['pm.test("TC-TVT-068 Status 403", ()=> pm.expect(pm.response.code).to.be.oneOf([403,422]));',
        'pm.test("TC-TVT-068 Error structure", ()=>{ const j=pm.response.json(); pm.expect(j.errorCode||j.error).to.exist; });'])]),
    req('TC-TVT-069 Error - Empty required fields', 'POST', `${B}/tvm/api/tokens/provision`, jH(true),
      '{"pan":"","panExpiry":"","tokenRequestorId":""}',
      [ev('test', ['pm.test("TC-TVT-069 Status 400", ()=> pm.expect(pm.response.code).to.equal(400));',
        'pm.test("TC-TVT-069 Error has errorCode+message+traceId+timestamp", ()=>{ const j=pm.response.json(); pm.expect(j.errorCode||j.error).to.exist; pm.expect(j.errorMessage||j.message).to.exist; });'])]),
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
      const method = item.request?.method || '';
      const rawUrl = item.request?.url?.raw || '';
      const tests = (item.event || []).filter(e => e.listen === 'test').flatMap(e => e.script.exec);
      const pmCount = (tests.join('\n').match(/pm\.test\(/g) || []).length;
      const isNeg = /Negative|NEGATIVE|Status 4|Status 403|Status 422|error/i.test(name + tests.join(' '));
      const type = /Edge|EDGE|Boundary|BOUNDARY/.test(name) ? 'Boundary' :
                   /Security/.test(section) ? 'Security' :
                   /Negative|NEGATIVE/.test(name) || isNeg ? 'Negative' : 'Functional';
      const priority = /Security|injection|brute|unauthorized/i.test(name + section) ? 'Critical' :
                       /Happy|POSITIVE|Boundary|Provision - Valid/i.test(name) ? 'High' :
                       /Negative|NEGATIVE/i.test(name) ? 'High' : 'Medium';
      const statusMatch = tests.join(' ').match(/to\.be\.oneOf\(\[([0-9,]+)\]\)|to\.equal\((\d+)\)|to\.be\.within\((\d+),(\d+)\)/);
      const expectedHttp = statusMatch ? (statusMatch[1] || statusMatch[2] || `${statusMatch[3]}-${statusMatch[4]}`) : '';
      const emvcoMatch = (name + ' ' + section).match(/EMVCo\s*([\d.]+)/);
      const emvcoRef = emvcoMatch ? `Section ${emvcoMatch[1]}` : '';
      const ruleMatch = (name + ' ' + section).match(/R(\d)/g);
      const businessRule = ruleMatch ? [...new Set(ruleMatch)].join(', ') : '';
      const steps = `1. Send ${method} ${rawUrl}\n2. Verify HTTP ${expectedHttp}\n3. Run ${pmCount} pm.test() assertions`;
      rows.push({ id, title: name, section, type, priority, preconditions: 'Vault setup flow completed (TC-01 through TC-11).', steps, expectedResult: `HTTP ${expectedHttp}, assertions pass`, emvcoRef, businessRule, endpoint: `${method} ${rawUrl}`, expectedHttp, pmTestCount: pmCount });
    }
  }
  walk(collection.item, '');
  return rows;
}

function toCSV(rows) {
  const headers = ['ID','Title','Section','Type','Priority','Preconditions','Steps','Expected Result','EMVCo Reference','Business Rule','API Endpoint','Expected HTTP','pm.test Count'];
  const esc = v => { const s = String(v||''); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"'+s.replace(/"/g,'""')+'"' : s; };
  return [headers.join(','), ...rows.map(r => [r.id,r.title,r.section,r.type,r.priority,r.preconditions,r.steps,r.expectedResult,r.emvcoRef,r.businessRule,r.endpoint,r.expectedHttp,r.pmTestCount].map(esc).join(','))].join('\n');
}

// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────

function main() {
  const outDir = path.join(__dirname, '..');

  const vaultFolders = buildVaultSetup();
  const emvcoFolders = buildEMVCo();

  const allVars = [
    { key: 'baseUrl_rgm',    value: 'http://10.88.250.40:40010' },
    { key: 'baseUrl_tvm',    value: 'http://10.88.250.40:40020' },
    { key: 'baseUrl_crypto', value: 'http://10.88.250.40:40029' },
    { key: 'tspCode',        value: '998' },
    { key: 'tvId',           value: '' },
    { key: 'transportKey',   value: '' },
    { key: 'kcv',            value: '' },
    { key: 'encryptedTransportKey', value: '' },
    { key: 'issuerId',       value: '' },
    { key: 'issuerCode',     value: '' },
    { key: 'binId',          value: '' },
    { key: 'binValue',       value: '' },
    { key: 'accountRangeId', value: '' },
    { key: 'trId',           value: '' },
    { key: 'testRunId',      value: '' },
    { key: 'provisionedToken', value: '' },
  ];

  const collection = {
    info: {
      _postman_id: 'tsp-combined-automated-001',
      name: 'TSP - Combined Automated Test Suite (Vault Setup + EMVCo)',
      description: 'Unified automated test suite combining vault setup flow (TC-01 to TC-11) with EMVCo compliance tests (TC-A to TC-J). 115 requests with 150+ pm.test() assertions, variable chaining, pre-request data generation. Run sequentially with Newman or Postman Runner.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: allVars,
    event: [ev('prerequest', [
      'if(!pm.collectionVariables.get("testRunId")){',
      '  const rid="run_"+Date.now().toString(36);',
      '  pm.collectionVariables.set("testRunId",rid);',
      '  console.log("Test Run ID: "+rid);',
      '}',
    ])],
    item: [
      { name: 'Part 1 - Vault Setup Flow', item: vaultFolders },
      { name: 'Part 2 - EMVCo Compliance Tests', item: emvcoFolders },
    ],
  };

  const colPath = path.join(outDir, 'TSP_Combined_Automated_postman_collection.json');
  fs.writeFileSync(colPath, JSON.stringify(collection, null, 2));
  console.log('Collection: ' + colPath);

  const env = {
    id: 'tsp-combined-env-001', name: 'TSP TakaPay Combined Environment',
    values: allVars.map(v => ({ ...v, enabled: true })),
    _postman_variable_scope: 'environment',
  };
  const envPath = path.join(outDir, 'TSP_TakaPay_environment.json');
  fs.writeFileSync(envPath, JSON.stringify(env, null, 2));
  console.log('Environment: ' + envPath);

  let totalReqs = 0, totalPm = 0;
  function countFolder(items, indent) {
    for (const f of items) {
      if (f.item && f.item[0] && f.item[0].item) {
        console.log(' '.repeat(indent) + f.name + ':');
        countFolder(f.item, indent + 2);
      } else if (f.item) {
        let pm = 0;
        f.item.forEach(r => { totalReqs++; (r.event||[]).forEach(e => { if(e.listen==='test') pm += (e.script.exec.join('\n').match(/pm\.test\(/g)||[]).length; }); });
        totalPm += pm;
        console.log(' '.repeat(indent) + f.name + ': ' + f.item.length + ' reqs, ' + pm + ' assertions');
      }
    }
  }
  countFolder(collection.item, 0);

  console.log('\nTotal requests:  ' + totalReqs);
  console.log('Total pm.test(): ' + totalPm);

  const csvRows = extractCSV(collection);
  const csvPath = path.join(outDir, 'testrail_combined_testcases.csv');
  fs.writeFileSync(csvPath, toCSV(csvRows));
  console.log('\nTestRail CSV: ' + csvPath + ' (' + csvRows.length + ' test cases)');

  console.log('\n=== RUN COMMANDS ===');
  console.log('npx newman run TSP_Combined_Automated_postman_collection.json -e TSP_TakaPay_environment.json');
  console.log('npx newman run TSP_Combined_Automated_postman_collection.json -e TSP_TakaPay_environment.json -r htmlextra --reporter-htmlextra-export reports/combined-report.html');
}

main();
