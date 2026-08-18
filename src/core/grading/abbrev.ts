/** 雙向等價的縮寫對照。判分時兩邊都展開成 canonical form 再比對。 */
const PAIRS: [string, string][] = [
  ['st', 'street'], ['rd', 'road'], ['ave', 'avenue'], ['av', 'avenue'],
  ['dr', 'drive'], ['ln', 'lane'], ['sq', 'square'], ['cres', 'crescent'],
  ['mt', 'mount'], ['apt', 'apartment'], ['dept', 'department'],
  ['uni', 'university'], ['info', 'information'], ['no', 'number'],
  ['mon', 'monday'], ['tue', 'tuesday'], ['tues', 'tuesday'],
  ['wed', 'wednesday'], ['thu', 'thursday'], ['thur', 'thursday'],
  ['thurs', 'thursday'], ['fri', 'friday'], ['sat', 'saturday'], ['sun', 'sunday'],
  ['jan', 'january'], ['feb', 'february'], ['mar', 'march'], ['apr', 'april'],
  ['jun', 'june'], ['jul', 'july'], ['aug', 'august'], ['sep', 'september'],
  ['sept', 'september'], ['oct', 'october'], ['nov', 'november'], ['dec', 'december']
];

const TO_CANON = new Map<string, string>();
for (const [short, long] of PAIRS) {
  TO_CANON.set(short, long);
  TO_CANON.set(long, long);
}

export function canonToken(token: string): string {
  return TO_CANON.get(token) ?? token;
}
