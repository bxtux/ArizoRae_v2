import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import OnboardingClient from './OnboardingClient';

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <OnboardingClient />;
}
