// apps/web/app/page.tsx
import { getFeatures } from '@/lib/api';
import FeaturesDashboard from './features-dashboard';

export default async function Page() {
  const features = await getFeatures();

  return <FeaturesDashboard features={features} />;
}