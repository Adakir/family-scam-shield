import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecentCheck = {
  id: string;
  preview: string;
  level: 'safe' | 'caution' | 'danger';
  createdAt: string;
};

export type TrustedContact = {
  name: string;
  phone: string;
  enabled: boolean;
};

const CHECKS_KEY = '@family-scam-shield/recent-checks';
const CONTACT_KEY = '@family-scam-shield/trusted-contact';

export async function loadRecentChecks(): Promise<RecentCheck[]> {
  const stored = await AsyncStorage.getItem(CHECKS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as RecentCheck[];
  } catch {
    return [];
  }
}

export async function saveRecentCheck(check: RecentCheck) {
  const checks = await loadRecentChecks();
  await AsyncStorage.setItem(CHECKS_KEY, JSON.stringify([check, ...checks].slice(0, 4)));
}

export async function loadTrustedContact(): Promise<TrustedContact> {
  const stored = await AsyncStorage.getItem(CONTACT_KEY);
  if (!stored) return { name: '', phone: '', enabled: false };
  try {
    return JSON.parse(stored) as TrustedContact;
  } catch {
    return { name: '', phone: '', enabled: false };
  }
}

export async function saveTrustedContact(contact: TrustedContact) {
  await AsyncStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
}