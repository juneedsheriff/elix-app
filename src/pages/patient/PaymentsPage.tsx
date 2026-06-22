import MetricCard from '../../components/ui/MetricCard';
import SectionCard from '../../components/ui/SectionCard';

export default function PaymentsPage() {
  return (
    <div className='screen-grid'>
      <SectionCard title='Global payments' subtitle='Stripe + Razorpay with wallet, coupons, and subscriptions'>
        <div className='metrics-grid'>
          <MetricCard title='Last payment' value='$140' subtitle='Visa ending 2242' />
          <MetricCard title='Wallet credits' value='$75' subtitle='Referral + loyalty bonus' />
          <MetricCard title='Active plan' value='Family Plus' subtitle='4 members, AI copilot included' />
          <MetricCard title='Discounts' value='3 coupons' subtitle='2 expiring this month' />
        </div>
      </SectionCard>
      <SectionCard title='Billing history'>
        <ul className='list'>
          <li>
            <strong>CONSULT-2026-0912</strong>
            <span>Neurology doctor consultation • Paid via Stripe</span>
          </li>
          <li>
            <strong>SUB-2026-0044</strong>
            <span>Quarterly subscription • Paid via Razorpay</span>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
