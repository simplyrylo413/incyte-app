import { WorkoutConsole } from '@/components/screens/WorkoutConsole';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ movementId: 'default' }];
}

export default function WorkoutPage() {
  return <WorkoutConsole />;
}
