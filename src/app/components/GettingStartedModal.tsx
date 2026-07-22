import { Modal, Button } from 'antd';
import { C } from '../data/colors';
import { ACCENT_MODAL_STYLES, ModalAccentBar } from '../styles/modalChrome';
import { trackEvent } from '../data/deviceAnalytics';
import {
  markGettingStartedCompleted,
  markGettingStartedDismissed,
  noteGettingStartedShown,
  ONBOARDING_TOUR_VERSION,
} from '../data/productOnboarding';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  profileId: string;
  onCreateGoal: () => void;
  onCreateTask: () => void;
  onTakeTour: () => void;
  onDismiss: () => void;
}

export function GettingStartedModal({
  open, profileId, onCreateGoal, onCreateTask, onTakeTour, onDismiss,
}: Props) {
  useEffect(() => {
    if (open) noteGettingStartedShown(profileId);
  }, [open, profileId]);

  const dismiss = () => {
    markGettingStartedDismissed(profileId);
    onDismiss();
  };

  const chooseGoal = () => {
    trackEvent(profileId, 'onboarding_create_goal_clicked', { tourVersion: ONBOARDING_TOUR_VERSION });
    markGettingStartedCompleted(profileId);
    onCreateGoal();
  };

  const chooseTask = () => {
    trackEvent(profileId, 'onboarding_create_task_clicked', { tourVersion: ONBOARDING_TOUR_VERSION });
    markGettingStartedCompleted(profileId);
    onCreateTask();
  };

  const chooseTour = () => {
    trackEvent(profileId, 'onboarding_tour_started', {
      tourVersion: ONBOARDING_TOUR_VERSION,
      entryPage: 'getting_started',
    });
    markGettingStartedCompleted(profileId);
    onTakeTour();
  };

  return (
    <Modal
      open={open}
      onCancel={dismiss}
      footer={null}
      centered
      title={null}
      width="min(420px, calc(100vw - 24px))"
      destroyOnClose
      styles={ACCENT_MODAL_STYLES}
      aria-labelledby="getting-started-title"
    >
      <ModalAccentBar gradient={`linear-gradient(90deg, ${C.primary}, #8E1533)`} />
      <div style={{ padding: '18px 22px 22px' }}>
        <h2 id="getting-started-title" style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: C.headline }}>
          Let’s build your first plan
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.5, color: C.body }}>
          Start by adding a goal you want to reach or a task you need to get done. You can create it
          manually or use AI Assist to turn your thoughts into editable options - nothing saves until you confirm.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button
            type="primary"
            block
            onClick={chooseGoal}
            style={{
              height: 48, borderRadius: 12, fontWeight: 700, border: 'none',
              background: `linear-gradient(135deg, ${C.primary}, ${C.primaryPressed})`,
            }}
          >
            Create a goal
          </Button>
          <Button
            block
            onClick={chooseTask}
            style={{ height: 48, borderRadius: 12, fontWeight: 700 }}
          >
            Create a task
          </Button>
          <Button
            type="link"
            block
            onClick={chooseTour}
            style={{ height: 44, fontWeight: 600, color: C.primary }}
          >
            Take a quick tour
          </Button>
          <button
            type="button"
            onClick={dismiss}
            style={{
              border: 'none', background: 'none', color: C.secondary, fontSize: 13,
              cursor: 'pointer', padding: '8px 0', minHeight: 44,
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </Modal>
  );
}
