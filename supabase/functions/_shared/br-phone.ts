export function brPhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  if (!digits.startsWith('55')) return [digits];

  const rest = digits.slice(2);
  if (rest.length === 11 && rest[2] === '9') {
    return [digits, '55' + rest.slice(0, 2) + rest.slice(3)];
  }
  if (rest.length === 10) {
    return [digits, '55' + rest.slice(0, 2) + '9' + rest.slice(2)];
  }
  return [digits];
}
