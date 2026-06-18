import UploadRecordsVault from '../../components/Records/UploadRecordsVault';
import type { ScreenPageProps } from '../types';

export default function UploadRecordsPage({ userId, dbConnected, onNavigate }: ScreenPageProps) {
  return (
    <UploadRecordsVault configured={dbConnected} userId={userId ?? null} onNavigate={onNavigate} />
  );
}
