import { useState, useEffect, useCallback } from 'react';
import { Progress, Modal, Button } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { PageTour, PageTourButton, TOUR_KEYS, tourStorageKey, areToursDismissedForProfile } from './AppTour';
import { CongratModal } from './CongratModal';
import {
  getPersonalGoals, createUserGoal, updateUserGoal, deleteUserGoal,
  isMonetaryGoal, type PersonalGoal,
} from '../data/personalGoals';
import {
  getTaskCategoriesForProfile, getTaskStatus, isTaskActiveForDate, getTodayKey,
} from '../data/profiles';
import { getGoalTaskBreakdown, getGoalWeekProgressPercent, getGoalWeekBreakdown } from '../data/goalProgressUtils';
import { getUserTasks, createUserTask, orphanUserTasksForGoal, deleteUserTask, isTaskScheduledForDate } from '../data/userTasks';
import { attachResourcesToNewTask } from '../data/taskResources';
import { ManageGoalModal } from './ManageGoalModal';
import { C } from '../data/colors';
import type { Profile } from '../data/profiles';

function getWeekDays(): Array<{ label: string; short: string; dateKey: string; isToday: boolean }> {
  const now = new Date();
  const todayKey = getTodayKey();
  // Start from Monday of current week
  const dayOfWeek = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${day}`;
    return { label: DAY_NAMES[i], short: DAY_NAMES[i], dateKey, isToday: dateKey === todayKey };
  });
}

interface Props {
  profile: Profile;
  onNavigateTasks?: () => void;
  /** Prefer All Tasks tab (Goals "See all tasks" link). */
  onNavigateAllTasks?: () => void;
}


function suggestTasksForGoal(goal: PersonalGoal): Array<{ label: string; timeOfDay: 'morning' | 'evening' }> {
  const text = `${goal.title} ${goal.deepWhy ?? ''}`.toLowerCase();
  const checks = [
    {
      keywords: ['save', 'money', 'budget', 'fund', 'financial', '₱', '$', 'peso', 'income', 'expense'],
      tasks: [
        { label: 'Review monthly budget', timeOfDay: 'morning' as const },
        { label: 'Track daily expenses', timeOfDay: 'evening' as const },
        { label: 'Transfer savings to fund', timeOfDay: 'morning' as const },
        { label: 'Cut one unnecessary subscription', timeOfDay: 'morning' as const },
        { label: 'Look for extra income opportunity', timeOfDay: 'evening' as const },
      ],
    },
    {
      keywords: ['health', 'exercise', 'workout', 'fit', 'gym', 'run', 'walk', 'diet', 'weight', 'lose'],
      tasks: [
        { label: 'Morning workout session', timeOfDay: 'morning' as const },
        { label: 'Drink 8 glasses of water', timeOfDay: 'morning' as const },
        { label: 'Prepare a healthy meal', timeOfDay: 'morning' as const },
        { label: 'Take a 30-min walk', timeOfDay: 'evening' as const },
        { label: 'Track calories for the day', timeOfDay: 'evening' as const },
      ],
    },
    {
      keywords: ['learn', 'study', 'course', 'skill', 'read', 'book', 'language', 'coding', 'certificate'],
      tasks: [
        { label: 'Complete one lesson or chapter', timeOfDay: 'morning' as const },
        { label: 'Practice for 30 minutes', timeOfDay: 'morning' as const },
        { label: 'Review notes from yesterday', timeOfDay: 'evening' as const },
        { label: 'Watch one tutorial video', timeOfDay: 'morning' as const },
        { label: 'Apply something learned today', timeOfDay: 'evening' as const },
      ],
    },
    {
      keywords: ['family', 'relationship', 'friend', 'connect', 'social', 'bond', 'love', 'quality time'],
      tasks: [
        { label: 'Call or message someone important', timeOfDay: 'morning' as const },
        { label: 'Plan a family activity', timeOfDay: 'morning' as const },
        { label: 'Have a device-free hour together', timeOfDay: 'evening' as const },
        { label: 'Write a gratitude note', timeOfDay: 'evening' as const },
        { label: 'Prepare a meal for family', timeOfDay: 'morning' as const },
      ],
    },
    {
      keywords: ['business', 'hustle', 'startup', 'client', 'project', 'freelance', 'product', 'market'],
      tasks: [
        { label: 'Reach out to one potential client', timeOfDay: 'morning' as const },
        { label: 'Work on product for 1 hour', timeOfDay: 'morning' as const },
        { label: 'Review business metrics', timeOfDay: 'evening' as const },
        { label: 'Post on social media', timeOfDay: 'morning' as const },
        { label: 'Follow up with a prospect', timeOfDay: 'morning' as const },
      ],
    },
    {
      keywords: ['stress', 'peace', 'mindful', 'meditat', 'sleep', 'rest', 'relax', 'mental', 'anxiety'],
      tasks: [
        { label: '10-minute morning meditation', timeOfDay: 'morning' as const },
        { label: 'Journal thoughts before bed', timeOfDay: 'evening' as const },
        { label: 'Take a tech break for 30 min', timeOfDay: 'evening' as const },
        { label: 'Go for a mindful walk', timeOfDay: 'morning' as const },
        { label: 'Practice deep breathing', timeOfDay: 'morning' as const },
      ],
    },
  ];
  for (const check of checks) {
    if (check.keywords.some(k => text.includes(k))) return check.tasks.slice(0, 5);
  }
  return [
    { label: 'Work on this goal for 30 minutes', timeOfDay: 'morning' as const },
    { label: 'Identify the next step forward', timeOfDay: 'morning' as const },
    { label: "Reflect on today's progress", timeOfDay: 'evening' as const },
  ];
}

const ACCENT_COLORS = ['#3da9fc', '#2cb67d', '#7c3aed', '#ef4565', '#f5a623', '#094067', '#e85d04', '#90b4ce'];
function goalAccent(goalId: string) {
  return ACCENT_COLORS[Math.abs(goalId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % ACCENT_COLORS.length];
}

export function GoalsPage({ profile, onNavigateTasks, onNavigateAllTasks }: Props) {
  const [goals, setGoals] = useState<PersonalGoal[]>(() => getPersonalGoals(profile.id));
  const [manageGoalOpen, setManageGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PersonalGoal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PersonalGoal | null>(null);
  const [goalDeleteTaskMode, setGoalDeleteTaskMode] = useState<'detach' | 'delete_tasks'>('detach');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedGoalIds, setSelectedGoalIds] = useState<Set<string>>(new Set());
  const [suggestionGoal, setSuggestionGoal] = useState<PersonalGoal | null>(null);
  const [suggestionTasks, setSuggestionTasks] = useState<Array<{ label: string; timeOfDay: 'morning' | 'evening' }>>([]);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
  const [showTour, setShowTour] = useState(false);
  const [congratGoal, setCongratGoal] = useState<PersonalGoal | null>(null);
  const [pendingSuggestionGoal, setPendingSuggestionGoal] = useState<PersonalGoal | null>(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const loadGoals = useCallback(() => {
    setGoals(getPersonalGoals(profile.id));
    setRefreshTick(n => n + 1);
  }, [profile.id]);

  useEffect(() => {
    loadGoals();
    const handler = () => loadGoals();
    window.addEventListener('arbol-goals-updated', handler);
    window.addEventListener('arbol-tasks-updated', handler);
    return () => {
      window.removeEventListener('arbol-goals-updated', handler);
      window.removeEventListener('arbol-tasks-updated', handler);
    };
  }, [loadGoals]);

  // Auto-start goals tour on first visit to this page
  useEffect(() => {
    if (areToursDismissedForProfile(profile.id)) return;
    if (!localStorage.getItem(tourStorageKey(TOUR_KEYS.goals, profile.id))) {
      const t = setTimeout(() => setShowTour(true), 700);
      return () => clearTimeout(t);
    }
  }, [profile.id]);

  const handleSaveGoal = (data: { title: string; deepWhy: string }) => {
    if (editingGoal) {
      updateUserGoal(profile.id, editingGoal.id, { title: data.title, deepWhy: data.deepWhy });
      setManageGoalOpen(false);
      setEditingGoal(null);
      loadGoals();
      try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
    } else {
      const newGoal = createUserGoal(profile.id, { title: data.title, deepWhy: data.deepWhy });
      setManageGoalOpen(false);
      setEditingGoal(null);
      loadGoals();
      try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
      // Show congrat modal first; suggestion modal opens after it closes
      setCongratGoal(newGoal);
      setPendingSuggestionGoal(newGoal);
      setSuggestionTasks(suggestTasksForGoal(newGoal));
      setAddedSuggestions(new Set());
    }
  };

  const handleDeleteGoal = () => {
    if (!deleteTarget) return;
    if (goalDeleteTaskMode === 'delete_tasks') {
      getUserTasks(profile.id)
        .filter(t => t.goalId === deleteTarget.id)
        .forEach(t => deleteUserTask(profile.id, t.id));
    } else {
      orphanUserTasksForGoal(profile.id, deleteTarget.id);
    }
    deleteUserGoal(profile.id, deleteTarget.id);
    setDeleteTarget(null);
    loadGoals();
    try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
    try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch {}
  };

  const deleteGoalsByIds = (ids: string[], taskMode: 'detach' | 'delete_tasks') => {
    ids.forEach(goalId => {
      if (taskMode === 'delete_tasks') {
        getUserTasks(profile.id).filter(t => t.goalId === goalId).forEach(t => deleteUserTask(profile.id, t.id));
      } else {
        orphanUserTasksForGoal(profile.id, goalId);
      }
      deleteUserGoal(profile.id, goalId);
    });
    setSelectedGoalIds(new Set());
    setSelectMode(false);
    loadGoals();
    try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
    try { window.dispatchEvent(new CustomEvent('arbol-tasks-updated')); } catch {}
  };

  const closeSuggestions = () => {
    setSuggestionGoal(null);
    setSuggestionTasks([]);
    setAddedSuggestions(new Set());
    loadGoals();
    try { window.dispatchEvent(new CustomEvent('arbol-goals-updated')); } catch {}
  };

  const goToLinkedTasks = onNavigateAllTasks ?? onNavigateTasks;

  return (
    <div style={{ padding: 'max(20px, calc(env(safe-area-inset-top, 0px) + 16px)) 16px 100px', background: C.bg, minHeight: '100dvh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.headline }}>My Goals</h2>
          <p style={{ margin: '4px 0 0', color: C.body, fontSize: 13 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <PageTourButton onClick={() => setShowTour(true)} />
      </div>
      <p style={{ margin: '0 0 22px', color: C.secondary, fontSize: 13, lineHeight: 1.5 }}>
        Define where you want to go. Your tasks will follow.
      </p>

      {goals.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled
            title="AI-assisted goal creation from a brain dump is coming soon. For now, add goals manually."
            style={{
              padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${C.border}`,
              background: C.bgAlt, color: C.secondary, fontSize: 12, fontWeight: 600, cursor: 'not-allowed',
            }}
          >
            ✨ AI assist · coming soon
          </button>
          <button type="button" onClick={() => { setSelectMode(m => !m); setSelectedGoalIds(new Set()); }} style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${C.border}`, background: selectMode ? `${C.primary}15` : C.bgCard, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            {selectMode ? 'Cancel select' : 'Select goals'}
          </button>
          {selectMode && selectedGoalIds.size > 0 && (
            <>
              <button type="button" onClick={() => deleteGoalsByIds([...selectedGoalIds], 'detach')} style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${C.border}`, background: C.bgCard, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Delete & detach tasks ({selectedGoalIds.size})
              </button>
              <button type="button" onClick={() => deleteGoalsByIds([...selectedGoalIds], 'delete_tasks')} style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${C.tertiary}40`, background: `${C.tertiary}10`, color: C.tertiary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Delete goals + tasks ({selectedGoalIds.size})
              </button>
            </>
          )}
        </div>
      )}

      {goals.length === 0 ? (
        <div data-tour-id="goals-section" style={{
          background: C.bgCard, border: `1.5px dashed ${C.border}`,
          borderRadius: 20, padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🎯</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: C.headline, marginBottom: 8 }}>No goals yet</div>
          <div style={{ color: C.body, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            Set your first goal and build daily tasks around it. Start with something meaningful. AI brain-dump assist is coming soon.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <button
              data-tour-id="goals-add-btn"
              onClick={() => { setEditingGoal(null); setManageGoalOpen(true); }}
              style={{
                background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
                border: 'none', borderRadius: 12, padding: '12px 24px',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}
            >
              <PlusOutlined /> Add a goal
            </button>
            <div style={{ fontSize: 12, color: C.secondary, maxWidth: 280, lineHeight: 1.45 }}>
              Feature coming: paste a brain dump and get suggested goals and tasks.
            </div>
          </div>
        </div>
      ) : (
        <div data-tour-id="goals-section" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {goals.map((goal, idx) => (
            <div key={goal.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selectedGoalIds.has(goal.id)}
                  onChange={() => setSelectedGoalIds(prev => {
                    const next = new Set(prev);
                    if (next.has(goal.id)) next.delete(goal.id);
                    else next.add(goal.id);
                    return next;
                  })}
                  style={{ marginTop: 18, width: 18, height: 18, flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1 }}>
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  profileId={profile.id}
                  refreshTick={refreshTick}
                  isFirst={idx === 0}
                  onEdit={() => { setEditingGoal(goal); setManageGoalOpen(true); }}
                  onDelete={() => { setGoalDeleteTaskMode('detach'); setDeleteTarget(goal); }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link to Tasks */}
      {goals.length > 0 && goToLinkedTasks && (
        <div
          onClick={goToLinkedTasks}
          style={{
            marginTop: 24, background: `linear-gradient(135deg, ${C.headline}, #1a6da8)`,
            borderRadius: 14, padding: '14px 18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 4px 16px rgba(9,64,103,0.18)',
          }}
        >
          <span style={{ fontSize: 20 }}>✅</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>View My Tasks</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 }}>
              See all tasks linked to your goals
            </div>
          </div>
          <ArrowRightOutlined style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }} />
        </div>
      )}

      <ManageGoalModal
        open={manageGoalOpen}
        goal={editingGoal}
        onSave={handleSaveGoal}
        onCancel={() => { setManageGoalOpen(false); setEditingGoal(null); }}
      />

      {/* FAB — add goals manually; AI assist shown as coming soon */}
      <>
        {fabMenuOpen && (
          <div
            onClick={() => setFabMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 47, background: 'rgba(9,64,103,0.18)' }}
          />
        )}
        {fabMenuOpen && (
          <div style={{
            position: 'fixed', bottom: 'calc(132px + env(safe-area-inset-bottom, 0px))', right: 20, zIndex: 49,
            display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch',
          }}>
            <button
              type="button"
              onClick={() => { setFabMenuOpen(false); setEditingGoal(null); setManageGoalOpen(true); }}
              style={{
                padding: '10px 16px', borderRadius: 12, border: `1.5px solid ${C.border}`,
                background: C.bgCard, fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left',
                boxShadow: C.shadow,
              }}
            >
              Add goal
            </button>
            <div
              title="AI brain-dump assist is coming soon. Add goals manually for now."
              style={{
                padding: '10px 16px', borderRadius: 12, border: `1.5px solid ${C.border}`,
                background: C.bgAlt, color: C.secondary, fontWeight: 600, fontSize: 12, lineHeight: 1.4,
                opacity: 0.9,
              }}
            >
              ✨ AI assist · feature coming
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 4 }}>
                Paste a brain dump and get suggested goals. Not available yet.
              </div>
            </div>
          </div>
        )}
        <button
          data-tour-id="goals-add-btn"
          onClick={() => setFabMenuOpen(m => !m)}
          style={{
            position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px) + 12px)', right: 20, zIndex: 48,
            width: 52, height: 52, borderRadius: '50%',
            background: `linear-gradient(135deg, #ef4565, #f5a623)`,
            border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 24px #ef456540',
          }}
          title="Add a new goal"
        >
          <PlusOutlined />
        </button>
      </>

      <Modal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onOk={handleDeleteGoal}
        okText="Delete Goal"
        okButtonProps={{ danger: true }}
        title="Delete this goal?"
        centered
        width="min(400px, calc(100vw - 24px))"
      >
        <p style={{ color: C.body, marginBottom: 12 }}>
          <strong>"{deleteTarget?.title}"</strong> will be removed.
        </p>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 13, color: C.body }}>
          <input type="radio" checked={goalDeleteTaskMode === 'detach'} onChange={() => setGoalDeleteTaskMode('detach')} />
          Detach linked user tasks (they become routines)
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13, color: C.body }}>
          <input type="radio" checked={goalDeleteTaskMode === 'delete_tasks'} onChange={() => setGoalDeleteTaskMode('delete_tasks')} />
          Delete linked user-created tasks too
        </label>
      </Modal>

      {/* Congratulatory modal - shown immediately after goal creation */}
      {congratGoal && (
        <CongratModal
          open={!!congratGoal}
          type="goal"
          title={congratGoal.title}
          rows={[
            ...(congratGoal.deepWhy ? [{ icon: '💭', label: 'Your why', value: congratGoal.deepWhy }] : []),
            { icon: '📋', label: 'Next step', value: 'Add tasks to make it happen' },
          ]}
          onClose={() => {
            const sg = pendingSuggestionGoal;
            setCongratGoal(null);
            setPendingSuggestionGoal(null);
            if (sg) setSuggestionGoal(sg);
          }}
        />
      )}

      {/* Task Suggestion Modal - shown after creating a new goal */}
      <Modal
        open={!!suggestionGoal}
        onCancel={closeSuggestions}
        footer={null} centered title={null}
        width="min(400px, calc(100vw - 24px))"
        styles={{
          content: { borderRadius: 20, padding: 0, overflow: 'hidden' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        {suggestionGoal && (
          <>
            <div style={{ height: 5, background: `linear-gradient(90deg, ${goalAccent(suggestionGoal.id)}, #3da9fc)` }} />
            <div style={{ padding: '22px 24px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Goal created! 🎯
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: C.headline }}>
                Suggested tasks for your goal
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: C.body, lineHeight: 1.5 }}>
                Here are some tasks to help you achieve <strong>"{suggestionGoal.title}"</strong>. Tap + to add any you like.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {suggestionTasks.map((s, i) => {
                  const added = addedSuggestions.has(s.label);
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 12,
                      background: added ? `${C.primary}10` : C.bgAlt,
                      border: `1.5px solid ${added ? C.primary : C.border}`,
                      transition: 'all 0.2s',
                    }}>
                      <span style={{ fontSize: 12, flexShrink: 0 }}>{s.timeOfDay === 'morning' ? '☀️' : '🌙'}</span>
                      <span style={{
                        flex: 1, fontSize: 13, lineHeight: 1.4,
                        color: added ? C.secondary : C.headline,
                        textDecoration: added ? 'line-through' : 'none',
                      }}>
                        {s.label}
                      </span>
                      <button
                        onClick={() => {
                          if (added) return;
                          const created = createUserTask(profile.id, { label: s.label, timeOfDay: s.timeOfDay, type: 'goal', goalId: suggestionGoal.id });
                          void attachResourcesToNewTask(profile.id, created.id, created.label, suggestionGoal.title);
                          setAddedSuggestions(prev => new Set([...prev, s.label]));
                        }}
                        style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: added ? `${C.primary}20` : `${C.primary}15`,
                          border: `1px solid ${C.primary}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: added ? 'default' : 'pointer',
                          color: C.primary, fontSize: added ? 14 : 18, fontWeight: 700,
                          transition: 'all 0.15s',
                        }}
                        title={added ? 'Added' : 'Add task'}
                      >
                        {added ? '✓' : '+'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <Button
                block type="primary"
                onClick={closeSuggestions}
                style={{
                  borderRadius: 12, height: 46,
                  background: `linear-gradient(135deg, ${C.primary}, #1a6da8)`,
                  border: 'none', fontWeight: 700,
                }}
              >
                Done
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Goals Page Tour */}
      <PageTour
        open={showTour}
        onClose={() => setShowTour(false)}
        storageKey={tourStorageKey(TOUR_KEYS.goals, profile.id)}
        profileId={profile.id}
        pageLabel="Goals"
        doneEmoji="🎯"
        doneMessage="You're ready to set and track goals. A goal without tasks is just a wish - add tasks to make it real!"
        onInteract={() => { setEditingGoal(null); setManageGoalOpen(true); }}
        interactLabel="Create a goal now →"
        steps={[
          {
            title: '🎯 Your Goals',
            description: 'Each goal card shows your target, today\'s progress, and task breakdown by status - done, in-progress, or not started.',
            targetId: 'goals-section',
            placement: 'bottom',
          },
          {
            title: '📊 Task Progress',
            description: 'This section shows how many tasks are done, in-progress, and not started today for this goal.',
            targetId: 'goals-task-breakdown',
            placement: 'bottom',
          },
          {
            title: '✨ Add a Goal',
            description: 'Tap the + button to create a goal. Be specific - "Save ₱50k by December" beats "save more money." Tap the button below to try it now!',
            targetId: 'goals-add-btn',
            placement: 'left',
          },
        ]}
      />
    </div>
  );
}

function BreakdownPills({ b, accent }: { b: TaskBreakdown; accent: string }) {
  if (b.total === 0) return <span style={{ fontSize: 11, color: C.secondary }}>No tasks</span>;
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {b.done > 0 && (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${accent}18`, color: accent }}>
          ● {b.done} done
        </span>
      )}
      {b.inprogress > 0 && (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#f5a62318', color: '#f5a623' }}>
          ◑ {b.inprogress} in progress
        </span>
      )}
      {b.notStarted > 0 && (
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: C.bgAlt, color: C.secondary }}>
          ○ {b.notStarted} not started
        </span>
      )}
    </div>
  );
}

function GoalCard({
  goal, profileId, onEdit, onDelete, isFirst, refreshTick: _refreshTick,
}: {
  goal: PersonalGoal;
  profileId: string;
  onEdit: () => void;
  onDelete: () => void;
  isFirst?: boolean;
  refreshTick?: number;
}) {
  const [weekOpen, setWeekOpen] = useState(false);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set([getTodayKey()]));
  const monetary = isMonetaryGoal(goal);
  const accentColor = goalAccent(goal.id);
  const todayKey = getTodayKey();
  const todayBreakdown = getGoalTaskBreakdown(profileId, goal.id, todayKey);
  const weekBreakdown = getGoalWeekBreakdown(profileId, goal.id, todayKey);
  const weekPct = getGoalWeekProgressPercent(profileId, goal, todayKey);
  const weekDays = getWeekDays();

  const toggleDay = (dateKey: string) => {
    setOpenDays(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  return (
    <div
      {...(isFirst ? { 'data-tour-id': 'goals-goal-card' } : {})}
      style={{
        background: C.bgCard,
        border: `1.5px solid ${accentColor}30`,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: C.shadow,
      }}
    >
      <div style={{ height: 4, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}55)` }} />
      <div style={{ padding: '18px 18px 16px' }}>

        {/* Goal header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: `${accentColor}18`, border: `1.5px solid ${accentColor}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            🎯
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.headline, lineHeight: 1.3, wordBreak: 'break-word' }}>
              {goal.title}
            </div>
            {monetary && (
              <div style={{ fontSize: 11, color: C.secondary, marginTop: 3 }}>
                {goal.unit}{goal.currentValue.toLocaleString()} / {goal.unit}{goal.targetValue.toLocaleString()}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={onEdit} style={{
              background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8,
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: C.secondary, fontSize: 13,
            }} title="Edit goal"><EditOutlined /></button>
            <button onClick={onDelete} style={{
              background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8,
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: C.secondary, fontSize: 13,
            }} title="Delete goal"><DeleteOutlined /></button>
          </div>
        </div>

        {/* Deep why */}
        {goal.deepWhy && (
          <div style={{
            background: `${accentColor}08`, borderLeft: `3px solid ${accentColor}50`,
            borderRadius: '0 10px 10px 0', padding: '8px 12px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
              Why this matters
            </div>
            <div style={{ fontSize: 13, color: C.body, fontStyle: 'italic', lineHeight: 1.5 }}>
              "{goal.deepWhy}"
            </div>
          </div>
        )}

        {/* Week-to-date progress bar + today's status breakdown */}
        <div data-tour-id="goals-task-breakdown" style={{
          background: `${accentColor}06`, border: `1px solid ${accentColor}20`,
          borderRadius: 12, padding: '12px 14px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              This week
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: accentColor }}>{weekPct}%</span>
          </div>
          <Progress
            percent={weekPct}
            showInfo={false}
            size={['100%', 7]}
            strokeColor={{ '0%': accentColor, '100%': `${accentColor}80` }}
            railColor={C.bgAlt}
          />
          <div style={{ marginTop: 8, fontSize: 11, color: C.secondary }}>
            Week so far: {weekBreakdown.done}/{weekBreakdown.total || 0} task completions
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.secondary, marginBottom: 6 }}>Today</div>
            <BreakdownPills b={todayBreakdown} accent={accentColor} />
          </div>
        </div>

        {/* Weekly breakdown - collapsible */}
        <button
          onClick={() => setWeekOpen(o => !o)}
          style={{
            width: '100%', background: 'none', border: `1px solid ${accentColor}25`,
            borderRadius: 10, padding: '8px 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${accentColor}08`; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: accentColor }}>📅 This week</span>
          <span style={{ fontSize: 13, color: accentColor, transform: weekOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', display: 'inline-block' }}>⌄</span>
        </button>

        {weekOpen && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {weekDays.map(day => {
              const b = getGoalTaskBreakdown(profileId, goal.id, day.dateKey);
              const isOpen = openDays.has(day.dateKey);
              const dayPct = b.total > 0 ? Math.round((b.done / b.total) * 100) : 0;
              const isToday = day.isToday;
              return (
                <div key={day.dateKey} style={{
                  borderRadius: 10,
                  border: `1px solid ${isToday ? accentColor + '40' : C.border}`,
                  background: isToday ? `${accentColor}06` : C.bgAlt,
                  overflow: 'hidden',
                }}>
                  <button
                    onClick={() => toggleDay(day.dateKey)}
                    style={{
                      width: '100%', background: 'none', border: 'none',
                      padding: '8px 12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <span style={{
                      fontSize: 11, fontWeight: 700, minWidth: 30, textAlign: 'left',
                      color: isToday ? accentColor : C.body,
                    }}>
                      {day.label}
                    </span>
                    {isToday && (
                      <span style={{ fontSize: 9, fontWeight: 800, background: accentColor, color: '#fff', borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase' }}>
                        Today
                      </span>
                    )}
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: C.border, overflow: 'hidden' }}>
                      <div style={{ width: `${dayPct}%`, height: '100%', background: accentColor, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: isToday ? accentColor : C.secondary, minWidth: 30, textAlign: 'right' }}>
                      {b.total > 0 ? `${b.done}/${b.total}` : '-'}
                    </span>
                    <span style={{ fontSize: 12, color: C.secondary, transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s', display: 'inline-block' }}>⌄</span>
                  </button>
                  {isOpen && b.total > 0 && (
                    <div style={{ padding: '4px 12px 10px 50px' }}>
                      <BreakdownPills b={b} accent={accentColor} />
                    </div>
                  )}
                  {isOpen && b.total === 0 && (
                    <div style={{ padding: '4px 12px 10px 50px' }}>
                      <span style={{ fontSize: 11, color: C.secondary }}>No tasks linked to this goal</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
