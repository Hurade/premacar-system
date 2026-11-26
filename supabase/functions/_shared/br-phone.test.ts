import assert from 'node:assert/strict';
import { test } from 'node:test';
import { brPhoneVariants } from './br-phone.ts';

test('matches Brazilian mobile numbers with or without the ninth digit', () => {
  assert.deepEqual(brPhoneVariants('554998175557'), [
    '554998175557',
    '5549998175557',
  ]);
  assert.deepEqual(brPhoneVariants('5549998175557'), [
    '5549998175557',
    '554998175557',
  ]);
});

test('strips formatting and leaves non-Brazilian numbers unchanged', () => {
  assert.deepEqual(brPhoneVariants('+55 (49) 99817-5557'), [
    '5549998175557',
    '554998175557',
  ]);
  assert.deepEqual(brPhoneVariants('+1 (202) 555-0100'), ['12025550100']);
});
