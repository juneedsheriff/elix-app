import SectionCard from '../../components/ui/SectionCard';

export default function CmsAuditPage() {
  return (
    <SectionCard title='CMS and audit center' subtitle='Manage healthcare content, legal pages, and audit trails'>
      <ul className='list'>
        <li>
          <strong>CMS</strong>
          <span>Blogs, FAQ, health articles, and campaign notifications.</span>
        </li>
        <li>
          <strong>Audit logs</strong>
          <span>Immutable event streams for HIPAA/GDPR and SOC2 controls.</span>
        </li>
      </ul>
    </SectionCard>
  );
}
