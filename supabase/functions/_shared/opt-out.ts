function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function isExplicitOptOutText(value: string): boolean {
  const text = normalizeText(value);
  if (!text) return false;

  const interestDecline = /\bnao tenho (?:mais )?interesse\b/.exec(text);
  if (interestDecline?.index !== undefined) {
    const afterDecline = text.slice(interestDecline.index + interestDecline[0].length);
    const positiveContinuation =
      /\b(?:mas|porem|contudo)\b.{0,80}\b(?:quero saber|quero entender|quero conhecer|gostaria de saber|gostaria de conhecer|tenho interesse|me interessa|me conte|me conta|me fale|me fala|me explique|pode me enviar|poderia me enviar)\b/;

    return !positiveContinuation.test(afterDecline);
  }

  const explicitStopPatterns = [
    /\bnao quero (?:mais )?(?:receber(?: mais)? mensagens?|mensagens?|contato|ser contatad[oa]|ser procurad[oa])\b/,
    /\b(?:pare|para) de me (?:enviar|mandar|ligar|contatar|procurar)\b/,
    /\bnao me (?:envie|mande|ligue|contate|chame|procure)\b/,
    /\bme (?:tire|tira|remova|retire) (?:da|dessa) lista\b/,
    /\bme descadastre\b/,
  ];

  return explicitStopPatterns.some((pattern) => pattern.test(text));
}
