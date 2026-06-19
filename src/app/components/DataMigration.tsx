import { useState } from 'react';
import { Button, Progress, Modal } from 'antd';
import { UploadOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { supabase } from '/utils/supabase/client';
import { PROFILES } from '../data/profiles';
import { C } from '../data/colors';

interface MigrationResult {
  taskCompletions: number;
  taskDeletions: number;
  goalProgress: number;
  feedback: number;
  deviceRecords: number;
  eventLogs: number;
  errors: string[];
}

export function DataMigration({ onClose }: { onClose: () => void }) {
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [currentStep, setCurrentStep] = useState('');

  const migrateData = async () => {
    setMigrating(true);
    setProgress(0);

    const results: MigrationResult = {
      taskCompletions: 0,
      taskDeletions: 0,
      goalProgress: 0,
      feedback: 0,
      deviceRecords: 0,
      eventLogs: 0,
      errors: [],
    };

    try {
      // Step 1: Migrate Task Completions (30%)
      setCurrentStep('Migrating task completions...');
      setProgress(10);

      const taskCompletions = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('task-') && !key.includes('task-del-')) {
          const parts = key.split('-');
          if (parts.length === 4) {
            const [_, profileId, taskId, date] = parts;
            const status = localStorage.getItem(key) as 'inprogress' | 'done' | null;
            if (status) {
              taskCompletions.push({
                profile_id: profileId,
                task_id: taskId,
                date,
                status,
              });
            }
          }
        }
      }

      if (taskCompletions.length > 0) {
        const { error } = await supabase
          .from('task_completions')
          .upsert(taskCompletions, { onConflict: 'profile_id,task_id,date' });

        if (error) {
          results.errors.push(`Task completions: ${error.message}`);
        } else {
          results.taskCompletions = taskCompletions.length;
        }
      }
      setProgress(30);

      // Step 2: Migrate Task Deletions (40%)
      setCurrentStep('Migrating task deletions...');

      const taskDeletions = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('task-del-')) {
          const parts = key.split('-');
          if (parts.length === 5) {
            const [_, __, profileId, taskId, date] = parts;
            taskDeletions.push({
              profile_id: profileId,
              task_id: taskId,
              date,
            });
          }
        }
      }

      if (taskDeletions.length > 0) {
        const { error } = await supabase
          .from('task_deletions')
          .upsert(taskDeletions, { onConflict: 'profile_id,task_id,date' });

        if (error) {
          results.errors.push(`Task deletions: ${error.message}`);
        } else {
          results.taskDeletions = taskDeletions.length;
        }
      }
      setProgress(40);

      // Step 3: Migrate Goal Progress (60%)
      setCurrentStep('Migrating goal progress...');

      const goalProgressLogs = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('arbol-goal-progress-')) {
          try {
            const log = JSON.parse(localStorage.getItem(key)!);
            goalProgressLogs.push({
              id: log.id,
              profile_id: log.profileId,
              goal_id: log.goalId,
              task_completed: log.taskCompleted,
              amount_logged: log.amountLogged,
              notes: log.notes,
              milestone_hit: log.milestoneHit,
              created_at: new Date(log.timestamp).toISOString(),
            });
          } catch {}
        }
      }

      if (goalProgressLogs.length > 0) {
        const { error } = await supabase
          .from('goal_progress')
          .upsert(goalProgressLogs, { onConflict: 'id' });

        if (error) {
          results.errors.push(`Goal progress: ${error.message}`);
        } else {
          results.goalProgress = goalProgressLogs.length;
        }
      }
      setProgress(60);

      // Step 4: Migrate Feedback (75%)
      setCurrentStep('Migrating feedback...');

      const feedbackEntries = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('arbol-feedback-')) {
          try {
            const entries = JSON.parse(localStorage.getItem(key)!);
            entries.forEach((entry: any) => {
              feedbackEntries.push({
                profile_id: entry.profileId,
                rating: entry.rating,
                what_worked: entry.whatWorked,
                what_didnt: entry.whatDidnt,
                suggestion: entry.suggestion,
                date: entry.date,
                created_at: new Date(entry.timestamp).toISOString(),
              });
            });
          } catch {}
        }
      }

      if (feedbackEntries.length > 0) {
        const { error } = await supabase.from('feedback').insert(feedbackEntries);

        if (error) {
          results.errors.push(`Feedback: ${error.message}`);
        } else {
          results.feedback = feedbackEntries.length;
        }
      }
      setProgress(75);

      // Step 5: Migrate Device Records (85%)
      setCurrentStep('Migrating device records...');

      const deviceRecords = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('arbol-device-')) {
          try {
            const record = JSON.parse(localStorage.getItem(key)!);
            deviceRecords.push({
              profile_id: record.profileId,
              os: record.os,
              browser: record.browser,
              is_pwa: record.isPwa,
              push_supported: record.pushSupported,
              badge_supported: record.badgeSupported,
              notif_permission: record.notifPermission,
              last_notif_sent: record.lastNotifSent,
              last_updated: record.lastUpdated ? new Date(record.lastUpdated).toISOString() : new Date().toISOString(),
            });
          } catch {}
        }
      }

      if (deviceRecords.length > 0) {
        const { error } = await supabase
          .from('device_records')
          .upsert(deviceRecords, { onConflict: 'profile_id' });

        if (error) {
          results.errors.push(`Device records: ${error.message}`);
        } else {
          results.deviceRecords = deviceRecords.length;
        }
      }
      setProgress(85);

      // Step 6: Migrate Event Logs (100%)
      setCurrentStep('Migrating event logs...');

      const eventLogs = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('arbol-events-')) {
          try {
            const events = JSON.parse(localStorage.getItem(key)!);
            events.forEach((event: any) => {
              eventLogs.push({
                profile_id: event.profileId,
                event: event.event,
                metadata: event.data || event.metadata,
                created_at: new Date(event.timestamp).toISOString(),
              });
            });
          } catch {}
        }
      }

      if (eventLogs.length > 0) {
        // Insert in batches to avoid payload size limits
        const batchSize = 100;
        for (let i = 0; i < eventLogs.length; i += batchSize) {
          const batch = eventLogs.slice(i, i + batchSize);
          const { error } = await supabase.from('event_logs').insert(batch);
          if (error) {
            results.errors.push(`Event logs batch ${i / batchSize + 1}: ${error.message}`);
            break;
          } else {
            results.eventLogs += batch.length;
          }
        }
      }
      setProgress(100);

      setCurrentStep('Migration complete!');
      setResult(results);

    } catch (error: any) {
      results.errors.push(`Fatal error: ${error.message}`);
      setResult(results);
    } finally {
      setMigrating(false);
    }
  };

  const totalMigrated = result
    ? result.taskCompletions + result.taskDeletions + result.goalProgress +
      result.feedback + result.deviceRecords + result.eventLogs
    : 0;

  return (
    <Modal
      open={true}
      onCancel={onClose}
      footer={null}
      width={600}
      centered
      styles={{
        content: { borderRadius: 20, padding: 0 },
      }}
    >
      <div style={{ padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.headline }}>
            Data Migration
          </h2>
          <p style={{ color: C.body, fontSize: 14, margin: '8px 0 0' }}>
            Import localStorage data to Supabase
          </p>
        </div>

        {!migrating && !result && (
          <div>
            <div style={{
              background: `${C.primary}08`, border: `1.5px solid ${C.primary}30`,
              borderRadius: 12, padding: 16, marginBottom: 24,
            }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, color: C.headline }}>
                What will be migrated:
              </h3>
              <ul style={{ margin: 0, paddingLeft: 24, color: C.body, fontSize: 14 }}>
                <li>Task completions and deletions</li>
                <li>Personal goal progress logs</li>
                <li>User feedback submissions</li>
                <li>Device and browser information</li>
                <li>App usage event logs</li>
              </ul>
            </div>

            <div style={{
              background: `${C.streak}15`, border: `1.5px solid ${C.streak}`,
              borderRadius: 12, padding: 16, marginBottom: 24,
            }}>
              <strong style={{ color: C.streak }}>⚠️ Important:</strong>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: C.body }}>
                This will import data from ALL profiles in localStorage. Duplicate data will be skipped automatically.
              </p>
            </div>

            <Button
              type="primary"
              size="large"
              block
              icon={<UploadOutlined />}
              onClick={migrateData}
              style={{
                height: 48, fontSize: 16, borderRadius: 12,
                background: `linear-gradient(135deg, ${C.primary} 0%, ${C.headline} 100%)`,
                border: 'none',
              }}
            >
              Start Migration
            </Button>
          </div>
        )}

        {migrating && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <Progress
                percent={progress}
                strokeColor={{ '0%': C.primary, '100%': C.headline }}
                status="active"
              />
              <p style={{ textAlign: 'center', marginTop: 12, color: C.body, fontSize: 14 }}>
                {currentStep}
              </p>
            </div>
          </div>
        )}

        {result && (
          <div>
            <div style={{
              background: result.errors.length > 0 ? `${C.streak}15` : `#22c55e15`,
              border: `1.5px solid ${result.errors.length > 0 ? C.streak : '#22c55e'}`,
              borderRadius: 12, padding: 20, marginBottom: 20, textAlign: 'center',
            }}>
              {result.errors.length === 0 ? (
                <>
                  <CheckCircleOutlined style={{ fontSize: 48, color: '#22c55e', marginBottom: 12 }} />
                  <h3 style={{ margin: 0, fontSize: 18, color: '#22c55e' }}>
                    Migration Successful!
                  </h3>
                  <p style={{ margin: '8px 0 0', fontSize: 16, fontWeight: 700, color: C.headline }}>
                    {totalMigrated} records migrated
                  </p>
                </>
              ) : (
                <>
                  <WarningOutlined style={{ fontSize: 48, color: C.streak, marginBottom: 12 }} />
                  <h3 style={{ margin: 0, fontSize: 18, color: C.streak }}>
                    Migration Completed with Warnings
                  </h3>
                  <p style={{ margin: '8px 0 0', fontSize: 16, fontWeight: 700, color: C.headline }}>
                    {totalMigrated} records migrated
                  </p>
                </>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 14, color: C.secondary, marginBottom: 12 }}>Migration Details:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Task Completions', count: result.taskCompletions },
                  { label: 'Task Deletions', count: result.taskDeletions },
                  { label: 'Goal Progress', count: result.goalProgress },
                  { label: 'Feedback', count: result.feedback },
                  { label: 'Device Records', count: result.deviceRecords },
                  { label: 'Event Logs', count: result.eventLogs },
                ].map(item => (
                  <div key={item.label} style={{
                    background: C.bgAlt, padding: 12, borderRadius: 8,
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.headline }}>{item.count}</div>
                    <div style={{ fontSize: 11, color: C.secondary }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div style={{
                background: `${C.tertiary}10`, border: `1px solid ${C.tertiary}`,
                borderRadius: 8, padding: 12, marginBottom: 20,
              }}>
                <h4 style={{ fontSize: 13, color: C.tertiary, margin: '0 0 8px' }}>Errors:</h4>
                {result.errors.map((err, idx) => (
                  <p key={idx} style={{ fontSize: 12, color: C.body, margin: '4px 0' }}>• {err}</p>
                ))}
              </div>
            )}

            <Button
              type="primary"
              size="large"
              block
              onClick={onClose}
              style={{
                height: 48, fontSize: 16, borderRadius: 12,
                background: C.primary,
                border: 'none',
              }}
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
