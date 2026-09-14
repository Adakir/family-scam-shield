export type RiskLevel = 'safe' | 'caution' | 'danger';

export type ScamAnalysis = {
  level: RiskLevel;
  title: string;
  summary: string;
  action: string;
  reasons: string[];
};

const urgencyWords = [
  'urgent',
  'immediately',
  'suspended',
  'expires',
  'final notice',
  'within 24 hours',
  'act now',
];

const moneyWords = [
  'gift card',
  'bitcoin',
  'crypto',
  'wire transfer',
  'payment',
  'refund',
  'prize',
  'claim',
];

const accountWords = [
  'verify your account',
  'confirm your identity',
  'password',
  'security alert',
  'login',
  'one-time code',
  'otp',
];

function containsUrl(value: string) {
  return /(https?:\/\/|www\.|bit\.ly\/|tinyurl\.com\/)/i.test(value);
}

function hasUnusualUrl(value: string) {
  return /(bit\.ly|tinyurl|t\.co|goo\.gl|[a-z0-9-]+\.(?:top|click|support|vip|live|shop)\b)/i.test(
    value,
  );
}

export function analyzeMessage(rawValue: string): ScamAnalysis {
  const value = rawValue.trim();
  const normalized = value.toLowerCase();
  const reasons: string[] = [];
  let signals = 0;

  if (urgencyWords.some((word) => normalized.includes(word))) {
    signals += 1;
    reasons.push('It creates pressure to act quickly.');
  }
  if (moneyWords.some((word) => normalized.includes(word))) {
    signals += 2;
    reasons.push('It asks for money, a prize claim, or a hard-to-reverse payment.');
  }
  if (accountWords.some((word) => normalized.includes(word))) {
    signals += 1;
    reasons.push('It asks for account details, a password, or a verification code.');
  }
  if (containsUrl(value)) {
    signals += 1;
    reasons.push(
      hasUnusualUrl(value)
        ? 'The link uses a shortened or unusual web address.'
        : 'The message asks you to open a link before you can verify who sent it.',
    );
  }
  if (/[A-Z]{4,}/.test(value)) {
    signals += 1;
    reasons.push('The message uses unusual all-caps language.');
  }

  if (signals >= 3) {
    return {
      level: 'danger',
      title: 'This looks like a scam',
      summary: 'Do not click the link, reply, or send money. Contact the company using a number you already trust.',
      action: 'Don’t click',
      reasons,
    };
  }

  if (signals >= 1) {
    return {
      level: 'caution',
      title: 'Be careful with this message',
      summary: 'There are a few warning signs. Verify the sender another way before taking any action.',
      action: 'Verify first',
      reasons,
    };
  }

  return {
    level: 'safe',
    title: 'No obvious warning signs',
    summary: 'We did not spot a common scam pattern. Still, only open links and share information when you recognize the sender.',
    action: 'Looks okay',
    reasons: ['No urgency, payment request, or suspicious link pattern was detected.'],
  };
}