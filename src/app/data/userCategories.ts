import { scheduleSave } from './cloudBackup';

export interface UserCategory {
  id: string;
  profileId: string;
  label: string;
  icon: string;    // emoji
  color: string;   // hex
  goalId?: string; // links to a PersonalGoal (Option C readiness)
  createdAt: number;
}

export const CAT_COLORS = [
  '#ef4565', '#f5a623', '#094067', '#3da9fc',
  '#90b4ce', '#2cb67d', '#7c3aed', '#e85d04',
];

function storageKey(profileId: string) {
  return `arbol-user-cats-${profileId}`;
}

export function getUserCategories(profileId: string): UserCategory[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(profileId)) || '[]');
  } catch {
    return [];
  }
}

export function saveUserCategories(profileId: string, cats: UserCategory[]) {
  localStorage.setItem(storageKey(profileId), JSON.stringify(cats));
  scheduleSave(profileId);
}

export function createUserCategory(
  profileId: string,
  data: Omit<UserCategory, 'id' | 'profileId' | 'createdAt'>,
): UserCategory {
  const cats = getUserCategories(profileId);
  const cat: UserCategory = {
    id: `ucat-${profileId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    profileId,
    createdAt: Date.now(),
    ...data,
    label: data.label.trim(),
  };
  saveUserCategories(profileId, [...cats, cat]);
  return cat;
}

export function updateUserCategory(
  profileId: string,
  catId: string,
  data: Partial<Omit<UserCategory, 'id' | 'profileId' | 'createdAt'>>,
) {
  const cats = getUserCategories(profileId);
  saveUserCategories(
    profileId,
    cats.map(c => (c.id === catId ? { ...c, ...data, label: (data.label ?? c.label).trim() } : c)),
  );
}

export function deleteUserCategory(profileId: string, catId: string) {
  const cats = getUserCategories(profileId);
  saveUserCategories(profileId, cats.filter(c => c.id !== catId));
}
