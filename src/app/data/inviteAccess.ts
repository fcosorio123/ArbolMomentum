/**
 * Account invite redeem — opens the invited profile from an email CTA.
 */
import { supabase } from '/utils/supabase/client';
import { syncCustomProfilesFromCloud, upsertCustomProfilesFromRoster } from './customProfiles';
import { restoreFromCloud } from './cloudBackup';
import { getProfileById, type Profile } from './profiles';
import { saveProfileEmail } from './profileContact';
import { isCustomProfileId } from './profileRoster';

const FN = 'make-server-5d90ddf5';

export function readInviteTokenFromUrl(href = typeof window !== 'undefined' ? window.location.href : ''): string | null {
  try {
    const url = new URL(href);
    const token = url.searchParams.get('invite')?.trim();
    return token || null;
  } catch {
    return null;
  }
}

export function clearInviteFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('invite')) return;
    url.searchParams.delete('invite');
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', next);
  } catch {
    /* ignore */
  }
}

export async function redeemInviteToken(token: string): Promise<{
  ok: boolean;
  reason?: string;
  profile?: Profile;
}> {
  const cleaned = token.trim();
  if (!cleaned) return { ok: false, reason: 'missing_token' };

  const { data, error } = await supabase.functions.invoke(`${FN}/redeem-invite`, {
    method: 'POST',
    body: { token: cleaned },
  });

  if (error) {
    return { ok: false, reason: error.message || 'network_error' };
  }
  if (!data?.ok || !data.profileId) {
    return { ok: false, reason: String(data?.reason ?? 'invalid_invite') };
  }

  const profileId = String(data.profileId);
  const profileName = typeof data.profileName === 'string' && data.profileName.trim()
    ? data.profileName.trim()
    : 'My Profile';

  await syncCustomProfilesFromCloud();

  // Ensure custom profiles exist locally even if roster sync lagged.
  if (isCustomProfileId(profileId) && !getProfileById(profileId)) {
    upsertCustomProfilesFromRoster([{
      id: profileId,
      name: profileName,
      tagline: `${profileName} · Custom profile`,
      avatar: '🌱',
      streak: 0,
      bestStreak: 0,
      weeklyStreak: 0,
      bestWeeklyStreak: 0,
      monthlyStreak: 0,
      bestMonthlyStreak: 0,
      role: 'Custom',
      joinedWeek: 1,
      completionRate: 0,
      bio: '',
      profileType: 'fresh',
      createdAt: Date.now(),
    }]);
  }

  await restoreFromCloud(profileId);

  if (typeof data.email === 'string' && data.email.trim()) {
    saveProfileEmail(profileId, data.email.trim(), { sendWelcome: false, profileName });
  }

  let profile = getProfileById(profileId);
  if (!profile) {
    await syncCustomProfilesFromCloud();
    profile = getProfileById(profileId);
  }
  if (!profile) {
    return { ok: false, reason: 'profile_unavailable' };
  }

  return { ok: true, profile };
}
