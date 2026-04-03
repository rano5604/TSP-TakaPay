#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const BASE_URL_RGM = 'http://10.88.250.40:40010';
const BASE_URL_TVM = 'http://10.88.250.40:40020';
const BASE_URL_CRYPTO = 'http://10.88.250.40:40029';
const DEFAULT_TV_ID = '9985003';

function urlObj(raw) {
  const u = new URL(raw);
  return {
    raw,
    protocol: u.protocol.replace(':', ''),
    host: u.hostname.split('.'),
    port: u.port,
    path: u.pathname.split('/').filter(Boolean),
  };
}

function jsonHeaders(includeTvId = true) {
  const h = [
    { key: 'accept', value: '*/*' },
    { key: 'Content-Type', value: 'application/json' },
  ];
  if (includeTvId) h.splice(1, 0, { key: 'X-TV-ID', value: DEFAULT_TV_ID });
  return h;
}

function acceptHeaders(includeTvId = false) {
  const h = [{ key: 'accept', value: '*/*' }];
  if (includeTvId) h.push({ key: 'X-TV-ID', value: DEFAULT_TV_ID });
  return h;
}

function req(method, url, headers, body, description) {
  const r = { method, header: headers, url: urlObj(url), description };
  if (body) {
    if (typeof body === 'string') {
      r.body = { mode: 'raw', raw: body };
    } else {
      r.body = body;
    }
  }
  return r;
}

function tc(name, method, url, headers, body, description) {
  return { name, request: req(method, url, headers, body, description), response: [] };
}

function generateEMVCoTestCases() {
  const items = [];

  // ═══════════════════════════════════════════════════════════
  // CATEGORY A — TOKEN PROVISIONING
  // ═══════════════════════════════════════════════════════════
  items.push({
    name: 'TC-A Token Provisioning',
    item: [
      tc(
        'TC-TVT-001 Token Provisioning - Valid PAN in Q1 range',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0327',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'POSITIVE: Provision a token for a valid PAN with Q1 expiry (Mar 2027). EMVCo Ref: Section 4.3. Business Rule: R1, R4. Expected: HTTP 200/201, token (13-19 digit Luhn-valid), TAL returned, token expiry within PAN expiry boundary.'
      ),
      tc(
        'TC-TVT-002 Token Provisioning - Valid PAN in Q2 range',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'POSITIVE: Provision token with Q2 expiry (Jun 2027). EMVCo Ref: Section 4.3. Business Rule: R4. Expected: HTTP 200/201, token issued from Q2 BIN range.'
      ),
      tc(
        'TC-TVT-003 Token Provisioning - Valid PAN in Q3 range',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0927',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'POSITIVE: Provision token with Q3 expiry (Sep 2027). EMVCo Ref: Section 4.3. Business Rule: R4. Expected: HTTP 200/201, token from Q3 BIN range.'
      ),
      tc(
        'TC-TVT-004 Token Provisioning - Valid PAN in Q4 range',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '1227',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'POSITIVE: Provision token with Q4 expiry (Dec 2027). EMVCo Ref: Section 4.3. Business Rule: R4. Expected: HTTP 200/201, token from Q4 BIN range.'
      ),
      tc(
        'TC-TVT-005 Token Provisioning - BIN range boundary first token',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960311000001',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'BOUNDARY: First token at BIN_START of quarter range. EMVCo Ref: Section 4.3.2. Business Rule: R2. Expected: HTTP 200/201, token value starts at configured BIN_START.'
      ),
      tc(
        'TC-TVT-006 Token Provisioning - BIN range boundary last token',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960319000000',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'BOUNDARY: Last token at BIN_END of quarter range (capacity-1 already allocated). EMVCo Ref: Section 4.3.2. Business Rule: R2, R3. Expected: HTTP 200/201, token at BIN_END.'
      ),
      tc(
        'TC-TVT-007 Token Provisioning - Range one away from exhaustion',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960318999999',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'BOUNDARY: Quarter range has exactly 1 token remaining. EMVCo Ref: Section 4.3.2. Business Rule: R3, R5. Expected: HTTP 200/201, last token issued, remaining capacity = 0 after.'
      ),
      tc(
        'TC-TVT-008 Token Provisioning - Range fully exhausted',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960318999998',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'NEGATIVE: Quarter BIN range fully exhausted (allocated = capacity). EMVCo Ref: Section 4.3.2. Business Rule: R3. Expected: HTTP 422, error: TOKEN_RANGE_EXHAUSTED.'
      ),
      tc(
        'TC-TVT-009 Token Provisioning - PAN outside account range',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960300000001',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'NEGATIVE: PAN suffix below configured account range lower limit. EMVCo Ref: Section 4.2. Business Rule: R1. Expected: HTTP 422, error: ACCOUNT_NOT_ELIGIBLE.'
      ),
      tc(
        'TC-TVT-010 Token Provisioning - Expired PAN',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0123',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'NEGATIVE: PAN expiry 01/2023 is in the past. EMVCo Ref: Section 4.3.1. Expected: HTTP 400, error: PAN expired, cannot issue token.'
      ),
      tc(
        'TC-TVT-011 Token Provisioning - Quarter not configured',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '1028',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'NEGATIVE: PAN expiry maps to Q4 2028 but no token range configured for that quarter/year. EMVCo Ref: Section 4.3. Business Rule: R4. Expected: HTTP 422, error: EXPIRY_QUARTER_MISMATCH or no range configured.'
      ),
      tc(
        'TC-TVT-012 Token Provisioning - Re-tokenize same PAN (idempotency)',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'FUNCTIONAL: Same PAN + same Token Requestor ID + same domain. EMVCo Ref: Section 4.3.4. Expected: HTTP 200, same token returned (idempotent), no new token allocated.'
      ),
      tc(
        'TC-TVT-013 Token Provisioning - Invalid PAN format (non-numeric)',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: 'ABCDEFGH12345678',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'NEGATIVE: PAN contains non-numeric characters. EMVCo Ref: Section 3.1. Expected: HTTP 400, invalid PAN format.'
      ),
      tc(
        'TC-TVT-014 Token Provisioning - PAN too short (12 digits)',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '639996031234',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'NEGATIVE: PAN length 12 digits (min 13 per EMVCo). EMVCo Ref: Section 3.1. Expected: HTTP 400, PAN length invalid.'
      ),
      tc(
        'TC-TVT-015 Token Provisioning - PAN too long (20 digits)',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '63999603123456789012',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          tokenAssuranceLevel: '3',
        }, null, 2),
        'NEGATIVE: PAN length 20 digits (max 19 per EMVCo). EMVCo Ref: Section 3.1. Expected: HTTP 400, PAN length invalid.'
      ),
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // CATEGORY B — ACCOUNT RANGE VALIDATION
  // ═══════════════════════════════════════════════════════════
  items.push({
    name: 'TC-B Account Range Validation',
    item: [
      tc(
        'TC-TVT-016 Account Range - PAN within valid range',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960315000000',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'POSITIVE: PAN suffix 5000000 within range [1100000-9000000]. Business Rule: R1. Expected: HTTP 200/201, token issued.'
      ),
      tc(
        'TC-TVT-017 Account Range - PAN at lower boundary',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960311100000',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'BOUNDARY: PAN suffix exactly at panLowerLimit (1100000). Business Rule: R1. Expected: HTTP 200/201, accepted (inclusive boundary).'
      ),
      tc(
        'TC-TVT-018 Account Range - PAN at upper boundary',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960319000000',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'BOUNDARY: PAN suffix exactly at panUpperLimit (9000000). Business Rule: R1. Expected: HTTP 200/201, accepted (inclusive boundary).'
      ),
      tc(
        'TC-TVT-019 Account Range - PAN below lower limit',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960310000001',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'NEGATIVE: PAN suffix 0000001 below panLowerLimit 1100000. Business Rule: R1. Expected: HTTP 422, error: ACCOUNT_NOT_ELIGIBLE.'
      ),
      tc(
        'TC-TVT-020 Account Range - PAN above upper limit',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960319999999',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'NEGATIVE: PAN suffix 9999999 above panUpperLimit 9000000. Business Rule: R1. Expected: HTTP 422, error: ACCOUNT_NOT_ELIGIBLE.'
      ),
      tc(
        'TC-TVT-021 Account Range - PAN in deactivated range',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960315000000',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'NEGATIVE: Account range has been deactivated. Business Rule: R1. Precondition: Deactivate the account range first. Expected: HTTP 422, error: ACCOUNT_NOT_ELIGIBLE.'
      ),
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // CATEGORY C — QUARTER BIN RANGE SETUP
  // ═══════════════════════════════════════════════════════════
  items.push({
    name: 'TC-C Quarter BIN Range Setup',
    item: [
      tc(
        'TC-TVT-022 BIN Range - Configure non-overlapping Q4 range',
        'POST',
        `${BASE_URL_TVM}/tvm/api/token-range`,
        jsonHeaders(),
        JSON.stringify({
          tokenRangeSetupList: [
            { expiry: { quarter: 'Q4', year: 2027 }, lowerLimit: '9100000', upperLimit: '9500000' },
          ],
          requestorId: '99850031692',
          issuerId: '237d9188de9144e5806abf95441fce5b',
          binId: 'd2d1adf80a1045359033de945b60e48g',
        }, null, 2),
        'POSITIVE: New non-overlapping BIN range for Q4 2027. Business Rule: R2, R6. Expected: HTTP 200/201, range created with capacity metadata.'
      ),
      tc(
        'TC-TVT-023 BIN Range - Overlapping range rejected',
        'POST',
        `${BASE_URL_TVM}/tvm/api/token-range`,
        jsonHeaders(),
        JSON.stringify({
          tokenRangeSetupList: [
            { expiry: { quarter: 'Q2', year: 2027 }, lowerLimit: '9200000', upperLimit: '9800000' },
          ],
          requestorId: '99850031692',
          issuerId: '237d9188de9144e5806abf95441fce5b',
          binId: 'd2d1adf80a1045359033de945b60e48g',
        }, null, 2),
        'NEGATIVE: Range [9200000-9800000] overlaps existing Q2 range [9100000-9999999]. Business Rule: R6. Expected: HTTP 409, error: BIN_RANGE_OVERLAP_DETECTED.'
      ),
      tc(
        'TC-TVT-024 BIN Range - Already-configured quarter',
        'POST',
        `${BASE_URL_TVM}/tvm/api/token-range`,
        jsonHeaders(),
        JSON.stringify({
          tokenRangeSetupList: [
            { expiry: { quarter: 'Q2', year: 2027 }, lowerLimit: '8000000', upperLimit: '8500000' },
          ],
          requestorId: '99850031692',
          issuerId: '237d9188de9144e5806abf95441fce5b',
          binId: 'd2d1adf80a1045359033de945b60e48g',
        }, null, 2),
        'NEGATIVE: Q2 2027 already has a configured range. Business Rule: R2. Expected: HTTP 409, error: quarter already configured or BIN_RANGE_OVERLAP_DETECTED.'
      ),
      tc(
        'TC-TVT-025 BIN Range - Start > End rejected',
        'POST',
        `${BASE_URL_TVM}/tvm/api/token-range`,
        jsonHeaders(),
        JSON.stringify({
          tokenRangeSetupList: [
            { expiry: { quarter: 'Q1', year: 2028 }, lowerLimit: '9500000', upperLimit: '9100000' },
          ],
          requestorId: '99850031692',
          issuerId: '237d9188de9144e5806abf95441fce5b',
          binId: 'd2d1adf80a1045359033de945b60e48g',
        }, null, 2),
        'NEGATIVE: lowerLimit > upperLimit. Business Rule: R2. Expected: HTTP 400, invalid range: start > end.'
      ),
      tc(
        'TC-TVT-026 BIN Range - Zero capacity rejected',
        'POST',
        `${BASE_URL_TVM}/tvm/api/token-range`,
        jsonHeaders(),
        JSON.stringify({
          tokenRangeSetupList: [
            { expiry: { quarter: 'Q1', year: 2028 }, lowerLimit: '9100000', upperLimit: '9100000' },
          ],
          requestorId: '99850031692',
          issuerId: '237d9188de9144e5806abf95441fce5b',
          binId: 'd2d1adf80a1045359033de945b60e48g',
        }, null, 2),
        'BOUNDARY: lowerLimit == upperLimit (capacity=1 or 0). Business Rule: R2. Expected: HTTP 400, zero or insufficient capacity.'
      ),
      tc(
        'TC-TVT-027 BIN Range - Retrieve config per quarter',
        'GET',
        `${BASE_URL_TVM}/tvm/api/token-range?requestorId=99850031692&issuerId=237d9188de9144e5806abf95441fce5b&binId=d2d1adf80a1045359033de945b60e48g`,
        [...acceptHeaders(true)],
        null,
        'POSITIVE: Retrieve BIN range config. Business Rule: R2. Expected: HTTP 200, response includes quarter, year, capacity, allocatedCount, remainingCount per range.'
      ),
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // CATEGORY D — TOKEN LIFECYCLE (EMVCo Section 6)
  // ═══════════════════════════════════════════════════════════
  items.push({
    name: 'TC-D Token Lifecycle',
    item: [
      tc(
        'TC-TVT-028 Lifecycle - Activate token (INACTIVE -> ACTIVE)',
        'PUT',
        `${BASE_URL_TVM}/tvm/api/tokens/{tokenId}/activate`,
        jsonHeaders(),
        JSON.stringify({ tokenId: '{tokenId}', reason: 'ID_AND_V_COMPLETE' }, null, 2),
        'POSITIVE: Activate a provisioned (INACTIVE) token. EMVCo Ref: Section 6.1. Expected: HTTP 200, status changes to ACTIVE.'
      ),
      tc(
        'TC-TVT-029 Lifecycle - Suspend token (ACTIVE -> SUSPENDED)',
        'PUT',
        `${BASE_URL_TVM}/tvm/api/tokens/{tokenId}/suspend`,
        jsonHeaders(),
        JSON.stringify({ tokenId: '{tokenId}', reason: 'CARDHOLDER_REQUEST' }, null, 2),
        'POSITIVE: Suspend an active token. EMVCo Ref: Section 6.2. Expected: HTTP 200, status changes to SUSPENDED.'
      ),
      tc(
        'TC-TVT-030 Lifecycle - Resume token (SUSPENDED -> ACTIVE)',
        'PUT',
        `${BASE_URL_TVM}/tvm/api/tokens/{tokenId}/resume`,
        jsonHeaders(),
        JSON.stringify({ tokenId: '{tokenId}', reason: 'CARDHOLDER_REQUEST' }, null, 2),
        'POSITIVE: Resume a suspended token. EMVCo Ref: Section 6.3. Expected: HTTP 200, status changes back to ACTIVE.'
      ),
      tc(
        'TC-TVT-031 Lifecycle - Delete token (any state -> DELETED)',
        'DELETE',
        `${BASE_URL_TVM}/tvm/api/tokens/{tokenId}`,
        jsonHeaders(),
        null,
        'POSITIVE: Delete a token from any state. EMVCo Ref: Section 6.4. Expected: HTTP 200, status changes to DELETED, token cannot be used.'
      ),
      tc(
        'TC-TVT-032 Lifecycle - Transaction on SUSPENDED token rejected',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/authorize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '{suspended_token}',
          cryptogram: '{tavv_cryptogram}',
          amount: '100.00',
          currency: 'BDT',
        }, null, 2),
        'NEGATIVE: Attempt payment authorization with SUSPENDED token. EMVCo Ref: Section 6.5. Expected: HTTP 403, error: token is suspended.'
      ),
      tc(
        'TC-TVT-033 Lifecycle - Transaction on DELETED token rejected',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/authorize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '{deleted_token}',
          cryptogram: '{tavv_cryptogram}',
          amount: '100.00',
          currency: 'BDT',
        }, null, 2),
        'NEGATIVE: Attempt payment authorization with DELETED token. EMVCo Ref: Section 6.5. Expected: HTTP 403, error: token is deleted.'
      ),
      tc(
        'TC-TVT-034 Lifecycle - Invalid state transition (INACTIVE -> SUSPENDED)',
        'PUT',
        `${BASE_URL_TVM}/tvm/api/tokens/{tokenId}/suspend`,
        jsonHeaders(),
        JSON.stringify({ tokenId: '{inactive_tokenId}', reason: 'FRAUD_DETECTION' }, null, 2),
        'NEGATIVE: Cannot suspend a token that is still INACTIVE. EMVCo Ref: Section 6.2. Expected: HTTP 400, invalid state transition.'
      ),
      tc(
        'TC-TVT-035 Lifecycle - Delete already deleted token',
        'DELETE',
        `${BASE_URL_TVM}/tvm/api/tokens/{deleted_tokenId}`,
        jsonHeaders(),
        null,
        'NEGATIVE: Attempt to delete an already deleted token. EMVCo Ref: Section 6.4. Expected: HTTP 404 or 409, token already deleted.'
      ),
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // CATEGORY E — TOKEN EXPIRY VALIDATION
  // ═══════════════════════════════════════════════════════════
  items.push({
    name: 'TC-E Token Expiry Validation',
    item: [
      tc(
        'TC-TVT-036 Expiry - Token expiry within PAN expiry',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0628',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'POSITIVE: PAN expiry Jun 2028, token assigned to Q2 2028 range. EMVCo Ref: Section 4.4. Expected: HTTP 200, token expiry <= PAN expiry.'
      ),
      tc(
        'TC-TVT-037 Expiry - Token expiry beyond PAN expiry rejected',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0127',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          forceTokenExpiry: '0627',
        }, null, 2),
        'NEGATIVE: Forced token expiry (Jun 2027) beyond PAN expiry (Jan 2027). EMVCo Ref: Section 4.4. Expected: HTTP 400, EMVCo violation: token expiry cannot exceed PAN expiry.'
      ),
      tc(
        'TC-TVT-038 Expiry - Provision for already expired PAN',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0124',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'NEGATIVE: PAN expiry Jan 2024 is already past. EMVCo Ref: Section 4.4. Expected: HTTP 400, cannot tokenize expired PAN.'
      ),
      tc(
        'TC-TVT-039 Expiry - Quarter matches PAN expiry correctly',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0827',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'POSITIVE: PAN expiry Aug 2027 maps to Q3. Business Rule: R4. Expected: HTTP 200, token issued from Q3 2027 BIN range.'
      ),
      tc(
        'TC-TVT-040 Expiry - Quarter mismatch error',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '1227',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'NEGATIVE: PAN expiry Dec 2027 maps to Q4 but Q4 2027 range not configured. Business Rule: R4. Expected: HTTP 422, error: EXPIRY_QUARTER_MISMATCH.'
      ),
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // CATEGORY F — DE-TOKENIZATION
  // ═══════════════════════════════════════════════════════════
  items.push({
    name: 'TC-F De-Tokenization',
    item: [
      tc(
        'TC-TVT-041 De-tokenize - Authorized party valid active token',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/detokenize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '{active_token}',
          tokenRequestorId: '99850031692',
        }, null, 2),
        'POSITIVE: Authorized party de-tokenizes an active token. EMVCo Ref: Section 5.1. Expected: HTTP 200, original PAN returned.'
      ),
      tc(
        'TC-TVT-042 De-tokenize - Unauthorized party rejected',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/detokenize`,
        [{ key: 'accept', value: '*/*' }, { key: 'X-TV-ID', value: '0000000' }, { key: 'Content-Type', value: 'application/json' }],
        JSON.stringify({
          tokenValue: '{active_token}',
          tokenRequestorId: 'UNAUTHORIZED_TR',
        }, null, 2),
        'NEGATIVE: Unauthorized party attempts de-tokenization. EMVCo Ref: Section 5.2. Expected: HTTP 403, de-tokenization not permitted.'
      ),
      tc(
        'TC-TVT-043 De-tokenize - Deleted token rejected',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/detokenize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '{deleted_token}',
          tokenRequestorId: '99850031692',
        }, null, 2),
        'NEGATIVE: De-tokenize a deleted token. EMVCo Ref: Section 5.3. Expected: HTTP 404 or 422, token not found or deleted.'
      ),
      tc(
        'TC-TVT-044 De-tokenize - Invalid token format (non-Luhn)',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/detokenize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '1234567890123456',
          tokenRequestorId: '99850031692',
        }, null, 2),
        'NEGATIVE: Token value fails Luhn check. EMVCo Ref: Section 3.2. Expected: HTTP 400, error: INVALID_TOKEN_FORMAT.'
      ),
      tc(
        'TC-TVT-045 De-tokenize - Tampered token value',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/detokenize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '9999999999999999',
          tokenRequestorId: '99850031692',
        }, null, 2),
        'NEGATIVE: Token value does not exist in vault. EMVCo Ref: Section 5.4. Expected: HTTP 404, token not found in vault.'
      ),
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // CATEGORY G — TOKEN DOMAIN RESTRICTION (EMVCo TDRC)
  // ═══════════════════════════════════════════════════════════
  items.push({
    name: 'TC-G Token Domain Restriction Control',
    item: [
      tc(
        'TC-TVT-046 TDRC - Token used within allowed domain',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/authorize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '{token_with_domain}',
          cryptogram: '{tavv}',
          domain: 'ECOMMERCE',
          merchantId: '123456789012345',
        }, null, 2),
        'POSITIVE: Token with ECOMMERCE domain used for e-commerce transaction. EMVCo Ref: Section 7.1. Expected: HTTP 200, authorization approved.'
      ),
      tc(
        'TC-TVT-047 TDRC - Token used outside allowed domain rejected',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/authorize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '{token_ecommerce_only}',
          cryptogram: '{tavv}',
          domain: 'CONTACTLESS',
          merchantId: '123456789012345',
        }, null, 2),
        'NEGATIVE: Token restricted to ECOMMERCE used for CONTACTLESS. EMVCo Ref: Section 7.2. Expected: HTTP 403, error: TOKEN_DOMAIN_VIOLATION.'
      ),
      tc(
        'TC-TVT-048 TDRC - Token with no domain restriction',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/authorize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '{token_no_domain_restriction}',
          cryptogram: '{tavv}',
          domain: 'CONTACTLESS',
          merchantId: '123456789012345',
        }, null, 2),
        'POSITIVE: Token with no domain restriction used in any domain. EMVCo Ref: Section 7.3. Expected: HTTP 200, authorization approved.'
      ),
      tc(
        'TC-TVT-049 TDRC - Domain updated mid-lifecycle',
        'PUT',
        `${BASE_URL_TVM}/tvm/api/tokens/{tokenId}/domain`,
        jsonHeaders(),
        JSON.stringify({
          tokenId: '{tokenId}',
          newDomainRestriction: 'QR_CODE',
        }, null, 2),
        'POSITIVE: Update domain restriction on an active token. EMVCo Ref: Section 7.4. Expected: HTTP 200, new restriction enforced on subsequent transactions.'
      ),
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // CATEGORY H — SECURITY & FRAUD CONTROLS
  // ═══════════════════════════════════════════════════════════
  items.push({
    name: 'TC-H Security and Fraud Controls',
    item: [
      tc(
        'TC-TVT-050 Security - Duplicate token request idempotent',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          idempotencyKey: 'unique-request-123',
        }, null, 2),
        'FUNCTIONAL: Duplicate request with same idempotencyKey. EMVCo Ref: Section 4.3.4. Expected: HTTP 200, same token returned, no new allocation.'
      ),
      tc(
        'TC-TVT-051 Security - Brute-force token enumeration rate limited',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/detokenize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '1111111111111111',
          tokenRequestorId: '99850031692',
        }, null, 2),
        'SECURITY: Rapidly send 100+ de-tokenization attempts with random token values. EMVCo Ref: Section 8.1. Expected: HTTP 429 after threshold, rate limiting enforced.'
      ),
      tc(
        'TC-TVT-052 Security - Manipulated Luhn check rejected',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/detokenize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '6399960312345670',
          tokenRequestorId: '99850031692',
        }, null, 2),
        'SECURITY: Token with bad Luhn check digit. EMVCo Ref: Section 3.2. Expected: HTTP 400, error: INVALID_TOKEN_FORMAT.'
      ),
      tc(
        'TC-TVT-053 Security - Expired JWT/OAuth in header',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        [
          { key: 'accept', value: '*/*' },
          { key: 'X-TV-ID', value: DEFAULT_TV_ID },
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer expired.jwt.token' },
        ],
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'SECURITY: Expired JWT token in Authorization header. Expected: HTTP 401, unauthorized.'
      ),
      tc(
        'TC-TVT-054 Security - Missing authorization header',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        [{ key: 'Content-Type', value: 'application/json' }],
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'SECURITY: No Authorization header and no X-TV-ID. Expected: HTTP 401, missing credentials.'
      ),
      tc(
        'TC-TVT-055 Security - SQL injection in PAN field',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: "6399960312345'; DROP TABLE tokens;--",
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'SECURITY: SQL injection attempt in PAN field. Expected: HTTP 400, input sanitized and rejected, no DB impact.'
      ),
      tc(
        'TC-TVT-056 Security - Token Assurance Level returned',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          identificationAndVerificationMethod: 'APP_TO_APP',
        }, null, 2),
        'FUNCTIONAL: TAL correctly calculated based on ID&V method. EMVCo Ref: Section 4.5. Expected: HTTP 200, tokenAssuranceLevel field present with appropriate level.'
      ),
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // CATEGORY I — BOUNDARY & CAPACITY TESTS
  // ═══════════════════════════════════════════════════════════
  items.push({
    name: 'TC-I Boundary and Capacity Tests',
    item: [
      tc(
        'TC-TVT-057 Boundary - First token of quarter range',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960311100000',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'BOUNDARY: First-ever token issuance from a fresh Q2 range. Business Rule: R2. Expected: HTTP 200, token at BIN_START, remaining = capacity - 1.'
      ),
      tc(
        'TC-TVT-058 Boundary - Last token of quarter range',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960319000000',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'BOUNDARY: Last token when allocated = capacity - 1. Business Rule: R3. Expected: HTTP 200, token at BIN_END, remaining = 0 after.'
      ),
      tc(
        'TC-TVT-059 Boundary - Allocated = capacity (exhausted)',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960319000001',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'NEGATIVE: Request when allocated = capacity. Business Rule: R3. Expected: HTTP 422, error: TOKEN_RANGE_EXHAUSTED.'
      ),
      tc(
        'TC-TVT-060 Boundary - Concurrent requests at range boundary',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960315000000',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
          concurrencyTest: true,
        }, null, 2),
        'PERFORMANCE: Send 10 concurrent provision requests when only 5 tokens remain. Business Rule: R3. Expected: Exactly 5 succeed, 5 return TOKEN_RANGE_EXHAUSTED. No over-allocation.'
      ),
      tc(
        'TC-TVT-061 Boundary - Remaining capacity decrements correctly',
        'GET',
        `${BASE_URL_TVM}/tvm/api/token-range?requestorId=99850031692&issuerId=237d9188de9144e5806abf95441fce5b&binId=d2d1adf80a1045359033de945b60e48g`,
        [...acceptHeaders(true)],
        null,
        'FUNCTIONAL: After issuing N tokens, verify remainingCount = capacity - N. Business Rule: R5. Expected: HTTP 200, remainingCount field accurately reflects allocation.'
      ),
      tc(
        'TC-TVT-062 Boundary - Partial utilization does not block future issuance',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960315500000',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'POSITIVE: Quarter range partially used (e.g., 50%). Business Rule: R5. Expected: HTTP 200, token issued successfully from remaining capacity.'
      ),
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // CATEGORY J — ERROR HANDLING & RESPONSE CODES
  // ═══════════════════════════════════════════════════════════
  items.push({
    name: 'TC-J Error Handling and Response Codes',
    item: [
      tc(
        'TC-TVT-063 Error - ACCOUNT_NOT_ELIGIBLE',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960300000001',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'NEGATIVE: Validate error code ACCOUNT_NOT_ELIGIBLE and response structure. Business Rule: R1. Expected: HTTP 422, body contains errorCode, errorMessage, traceId, timestamp.'
      ),
      tc(
        'TC-TVT-064 Error - TOKEN_RANGE_EXHAUSTED',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '0627',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'NEGATIVE: Validate error code TOKEN_RANGE_EXHAUSTED. Business Rule: R3. Precondition: Exhaust the Q2 range. Expected: HTTP 422, body contains errorCode, errorMessage, traceId, timestamp.'
      ),
      tc(
        'TC-TVT-065 Error - EXPIRY_QUARTER_MISMATCH',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({
          pan: '6399960312345678',
          panExpiry: '1228',
          tokenRequestorId: '99850031692',
          tokenType: 'CLOUD',
        }, null, 2),
        'NEGATIVE: Validate error code EXPIRY_QUARTER_MISMATCH. Business Rule: R4. Expected: HTTP 422, body contains errorCode, errorMessage, traceId, timestamp.'
      ),
      tc(
        'TC-TVT-066 Error - BIN_RANGE_OVERLAP_DETECTED',
        'POST',
        `${BASE_URL_TVM}/tvm/api/token-range`,
        jsonHeaders(),
        JSON.stringify({
          tokenRangeSetupList: [
            { expiry: { quarter: 'Q2', year: 2027 }, lowerLimit: '9100000', upperLimit: '9999999' },
          ],
          requestorId: '99850031692',
          issuerId: '237d9188de9144e5806abf95441fce5b',
          binId: 'd2d1adf80a1045359033de945b60e48g',
        }, null, 2),
        'NEGATIVE: Validate error code BIN_RANGE_OVERLAP_DETECTED. Business Rule: R6. Expected: HTTP 409, body contains errorCode, errorMessage, traceId, timestamp.'
      ),
      tc(
        'TC-TVT-067 Error - INVALID_TOKEN_FORMAT',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/detokenize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: 'ABCDEFGHIJ123456',
          tokenRequestorId: '99850031692',
        }, null, 2),
        'NEGATIVE: Validate error code INVALID_TOKEN_FORMAT. EMVCo Ref: Section 3.2. Expected: HTTP 400, body contains errorCode, errorMessage, traceId, timestamp.'
      ),
      tc(
        'TC-TVT-068 Error - TOKEN_DOMAIN_VIOLATION',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/authorize`,
        jsonHeaders(),
        JSON.stringify({
          tokenValue: '{ecommerce_token}',
          cryptogram: '{tavv}',
          domain: 'IN_APP',
          merchantId: '123456789012345',
        }, null, 2),
        'NEGATIVE: Validate error code TOKEN_DOMAIN_VIOLATION. EMVCo Ref: Section 7.2. Expected: HTTP 403, body contains errorCode, errorMessage, traceId, timestamp.'
      ),
      tc(
        'TC-TVT-069 Error - Response structure validation',
        'POST',
        `${BASE_URL_TVM}/tvm/api/tokens/provision`,
        jsonHeaders(),
        JSON.stringify({ pan: '', panExpiry: '', tokenRequestorId: '' }, null, 2),
        'NEGATIVE: Empty required fields. Expected: HTTP 400, response body MUST contain: errorCode (string), errorMessage (string), traceId (UUID), timestamp (ISO-8601).'
      ),
    ],
  });

  return items;
}

function buildPostmanCollection(emvcoItems) {
  return {
    info: {
      _postman_id: 'tc-tsp-emvco-comprehensive-001',
      name: 'TSP - EMVCo Comprehensive Test Cases',
      description:
        'Comprehensive EMVCo-compliant test cases for TSP TakaPay Token Vault covering: [A] Token Provisioning, [B] Account Range Validation, [C] Quarter BIN Range Setup, [D] Token Lifecycle, [E] Token Expiry Validation, [F] De-Tokenization, [G] Token Domain Restriction, [H] Security & Fraud Controls, [I] Boundary & Capacity Tests, [J] Error Handling & Response Codes. Generated per EMVCo Payment Tokenization Specification v2.2+.',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: emvcoItems,
  };
}

function extractTestCasesForCSV(collection) {
  const rows = [];

  function walk(items, section) {
    for (const item of items) {
      if (item.item) {
        walk(item.item, item.name);
      } else {
        const desc = item.request?.description || '';
        const name = item.name || '';
        const method = item.request?.method || '';
        const url = item.request?.url?.raw || '';

        const categoryMatch = desc.match(/^(POSITIVE|NEGATIVE|BOUNDARY|EDGE CASE|FUNCTIONAL|SECURITY|PERFORMANCE):/);
        const type = categoryMatch ? categoryMatch[1] : 'Functional';

        const emvcoMatch = desc.match(/EMVCo Ref:\s*(Section\s*[\d.]+)/);
        const emvcoRef = emvcoMatch ? emvcoMatch[1] : '';

        const ruleMatch = desc.match(/Business Rule:\s*(R\d+(?:,\s*R\d+)*)/);
        const businessRule = ruleMatch ? ruleMatch[1] : '';

        const expectedHttpMatch = desc.match(/Expected:\s*HTTP\s*(\d+(?:\/\d+)?)/);
        const expectedHttp = expectedHttpMatch ? expectedHttpMatch[1] : '';

        const expectedIdx = desc.indexOf('Expected:');
        const expectedResult = expectedIdx >= 0 ? desc.substring(expectedIdx + 9).trim() : desc;

        const precondIdx = desc.indexOf('Precondition:');
        let preconditions = '';
        if (precondIdx >= 0) {
          const afterPrecond = desc.substring(precondIdx + 13);
          const dotIdx = afterPrecond.indexOf('.');
          preconditions = dotIdx >= 0 ? afterPrecond.substring(0, dotIdx + 1).trim() : afterPrecond.trim();
        }

        let priority = 'Medium';
        if (/SECURITY|NEGATIVE.*unauthorized|NEGATIVE.*injection/i.test(desc)) priority = 'Critical';
        else if (/POSITIVE|happy path/i.test(name)) priority = 'High';
        else if (/BOUNDARY|PERFORMANCE/i.test(type)) priority = 'High';
        else if (/EDGE CASE/i.test(type)) priority = 'Medium';
        else if (/NEGATIVE/i.test(type)) priority = 'High';

        const body = item.request?.body?.raw || '';
        const steps = `1. Send ${method} request to ${url}\n` +
          (body ? `2. Request body: ${body.substring(0, 200)}${body.length > 200 ? '...' : ''}\n` : '') +
          `${body ? '3' : '2'}. Verify HTTP response code ${expectedHttp}\n` +
          `${body ? '4' : '3'}. Validate response body structure and fields`;

        rows.push({
          id: name.split(' ')[0] || '',
          title: name,
          section,
          type,
          priority,
          preconditions: preconditions || 'Vault created, issuer onboarded, BIN and account ranges configured.',
          steps,
          expectedResult,
          emvcoRef,
          businessRule,
          endpoint: `${method} ${url}`,
          expectedHttp,
        });
      }
    }
  }

  walk(collection.item, 'Root');
  return rows;
}

function toCSV(rows) {
  const headers = [
    'ID',
    'Title',
    'Section',
    'Type',
    'Priority',
    'Preconditions',
    'Steps',
    'Expected Result',
    'EMVCo Reference',
    'Business Rule',
    'API Endpoint',
    'Expected HTTP',
  ];

  function escape(val) {
    const s = String(val || '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id, r.title, r.section, r.type, r.priority,
        r.preconditions, r.steps, r.expectedResult,
        r.emvcoRef, r.businessRule, r.endpoint, r.expectedHttp,
      ]
        .map(escape)
        .join(',')
    );
  }
  return lines.join('\n');
}

function main() {
  const outDir = path.join(__dirname, '..');

  console.log('Reading existing collections...');
  const existingTestCases = JSON.parse(
    fs.readFileSync(path.join(outDir, 'TSP_TestCases_postman_collection.json'), 'utf8')
  );
  const happyPath = JSON.parse(
    fs.readFileSync(path.join(outDir, 'TSP.postman_collection.json'), 'utf8')
  );

  console.log('Generating EMVCo comprehensive test cases...');
  const emvcoItems = generateEMVCoTestCases();
  const emvcoCollection = buildPostmanCollection(emvcoItems);

  const emvcoPath = path.join(outDir, 'TSP_EMVCo_TestCases_postman_collection.json');
  fs.writeFileSync(emvcoPath, JSON.stringify(emvcoCollection, null, 2));
  console.log(`  -> Written: ${emvcoPath}`);

  console.log('Generating TestRail CSV...');

  const existingRows = extractTestCasesForCSV(existingTestCases);
  const emvcoRows = extractTestCasesForCSV(emvcoCollection);

  const existingCSV = toCSV(existingRows);
  const existingCSVPath = path.join(outDir, 'testrail_existing_testcases.csv');
  fs.writeFileSync(existingCSVPath, existingCSV);
  console.log(`  -> Written: ${existingCSVPath} (${existingRows.length} test cases)`);

  const emvcoCSV = toCSV(emvcoRows);
  const emvcoCSVPath = path.join(outDir, 'testrail_emvco_testcases.csv');
  fs.writeFileSync(emvcoCSVPath, emvcoCSV);
  console.log(`  -> Written: ${emvcoCSVPath} (${emvcoRows.length} test cases)`);

  const allRows = [...existingRows, ...emvcoRows];
  const allCSV = toCSV(allRows);
  const allCSVPath = path.join(outDir, 'testrail_all_testcases.csv');
  fs.writeFileSync(allCSVPath, allCSV);
  console.log(`  -> Written: ${allCSVPath} (${allRows.length} total test cases)`);

  console.log('\n=== SUMMARY ===');
  console.log(`Existing test cases (vault setup flow): ${existingRows.length}`);
  console.log(`New EMVCo test cases (categories A-J):  ${emvcoRows.length}`);
  console.log(`Total test cases:                       ${allRows.length}`);
  console.log('\nCategories covered:');
  const sections = new Set(emvcoRows.map((r) => r.section));
  for (const s of sections) {
    const count = emvcoRows.filter((r) => r.section === s).length;
    console.log(`  ${s}: ${count} test cases`);
  }
  console.log('\nTraceability Matrix (EMVCo):');
  console.log('TC-ID | Business Rule | EMVCo Ref | Endpoint | Priority');
  console.log('-'.repeat(80));
  for (const r of emvcoRows.filter((r) => r.emvcoRef || r.businessRule)) {
    console.log(
      `${r.id.padEnd(14)} | ${(r.businessRule || '-').padEnd(13)} | ${(r.emvcoRef || '-').padEnd(14)} | ${r.endpoint.substring(0, 30).padEnd(30)} | ${r.priority}`
    );
  }

  console.log('\n=== EMVCo COMPLIANCE GAPS ===');
  console.log('The following endpoints are implied by EMVCo spec but NOT in the original collection:');
  console.log('  1. POST /tvm/api/tokens/provision      - Token provisioning');
  console.log('  2. PUT  /tvm/api/tokens/{id}/activate   - Token activation');
  console.log('  3. PUT  /tvm/api/tokens/{id}/suspend    - Token suspension');
  console.log('  4. PUT  /tvm/api/tokens/{id}/resume     - Token resume');
  console.log('  5. DELETE /tvm/api/tokens/{id}           - Token deletion');
  console.log('  6. POST /tvm/api/tokens/detokenize      - De-tokenization');
  console.log('  7. POST /tvm/api/tokens/authorize       - Transaction authorization');
  console.log('  8. PUT  /tvm/api/tokens/{id}/domain     - Domain restriction update');
  console.log('  9. GET  /tvm/api/token-range (query)    - BIN range retrieval');
}

main();
