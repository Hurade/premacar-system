import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isExplicitOptOutText } from './opt-out.ts';

test('detects an explicit refusal with context and polite wording', () => {
  assert.equal(
    isExplicitOptOutText('Boa tarde Cris. Entendi. Mas no momento não tenho interesse no serviço. Obrigado'),
    true,
  );
  assert.equal(isExplicitOptOutText('Não tenho mais interesse, obrigado'), true);
});

test('detects direct requests to stop contact', () => {
  assert.equal(isExplicitOptOutText('Não quero mais receber mensagens'), true);
  assert.equal(isExplicitOptOutText('Por favor, pare de me mandar mensagens'), true);
  assert.equal(isExplicitOptOutText('Me tire da lista'), true);
});

test('does not classify a refusal followed by renewed interest as opt-out', () => {
  assert.equal(
    isExplicitOptOutText('No momento não tenho interesse, mas quero entender como funciona'),
    false,
  );
});

test('does not classify an alternate contact number as opt-out', () => {
  assert.equal(
    isExplicitOptOutText('Se eu não responder, entre em contato por esse outro número por favor'),
    false,
  );
});
