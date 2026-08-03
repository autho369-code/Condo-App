import TasksRail from '@/components/workspace/tasks-rail';
import { loadActionCenterAttention } from '@/lib/navigation/action-center-attention';
import { createClient } from '@/lib/supabase/server';

export type ActionCenterShellProps = {
  isStaff: boolean;
  isFinanceStaff: boolean;
  isAdmin: boolean;
};

export default async function ActionCenterShell(props: ActionCenterShellProps) {
  const supabase = await createClient();
  const attention = await loadActionCenterAttention(supabase as any, {
    isFinanceStaff: props.isFinanceStaff,
  });

  return <TasksRail {...props} attention={attention} />;
}
