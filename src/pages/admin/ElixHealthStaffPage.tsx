import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import SectionCard from '../../components/ui/SectionCard';
import { fetchAllAdmins } from '../../lib/admins';
import type { Admin } from '../../types/admin';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export default function ElixHealthStaffPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<Admin[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchAllAdmins();
    if (fetchError) {
      setError(fetchError.message);
      setStaff([]);
    } else {
      setStaff(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className='elixhealth-status'>
        <Loader2 size={18} className='spin' aria-hidden /> Loading staff…
      </p>
    );
  }

  if (error) {
    return (
      <p className='auth-error' role='alert'>
        {error}
      </p>
    );
  }

  return (
    <SectionCard title='Staff (admins)' subtitle={`${staff.length} admin account(s)`}>
      <div className='elixhealth-table-wrap'>
        <table className='elixhealth-table'>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Auth linked</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id}>
                <td>{member.full_name}</td>
                <td>{member.email}</td>
                <td>{member.is_active ? 'Active' : 'Inactive'}</td>
                <td>{member.auth_user_id ? 'Yes' : 'No'}</td>
                <td>{formatDate(member.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {staff.length === 0 ? <p className='muted'>No staff accounts.</p> : null}
      </div>
    </SectionCard>
  );
}
