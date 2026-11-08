import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BarChart3, Calculator, Leaf, ScanLine, BookOpen } from 'lucide-react';
import OwnerAnalyticsPage from './OwnerAnalyticsPage';
import OwnerCostingPage from './OwnerCostingPage';
import OwnerWastageYieldPage from './OwnerWastageYieldPage';
import OwnerTraceabilityPage from './OwnerTraceabilityPage';
import '../../styles/owner-workspace.css';
import '../../styles/owner-reports.css';
const reports = [
  { key: 'sales', title: 'Sales & profitability', label: 'Business performance', description: 'Follow revenue, order trends, tax, and operating costs over your chosen period.', detail: 'Revenue · Expenses · GST · Profit', Icon: BarChart3, Component: OwnerAnalyticsPage },
  { key: 'costing', title: 'Recipe costing & margins', label: 'Product economics', description: 'Understand the cost of every recipe, from ingredients to the final selling price.', detail: 'Cost per item · Margin · Markup', Icon: Calculator, Component: OwnerCostingPage },
  { key: 'wastage', title: 'Wastage & yield', label: 'Kitchen efficiency', description: 'Review recorded losses and keep an accountable record of ingredient and finished-product waste.', detail: 'Recorded losses · Stock deductions · Audit trail', Icon: Leaf, Component: OwnerWastageYieldPage },
  { key: 'traceability', title: 'Batch traceability', label: 'From supplier to customer', description: 'Look up a supplier lot or production batch and follow its recorded journey through your bakery.', detail: 'Supplier lots · Batches · Orders · Recall CSV', Icon: ScanLine, Component: OwnerTraceabilityPage },
];
export default function OwnerReportsWorkspacePage() {
  const [params] = useSearchParams();
  const selected = reports.find(report => report.key === params.get('report'));
  if (selected) { const Component = selected.Component; return <div className={`owner-workspace ow-report-detail ow-report-${selected.key}`}><div className="ow-report-breadcrumb"><Link to="/owner/reports"><ArrowLeft size={15} />Report library</Link><span>/</span><span>{selected.title}</span></div><Component /></div>; }
  return <div className="owner-workspace ow-report-library"><header className="ow-library-intro"><div><div className="ow-eyebrow">The business notebook</div><h1>Know your bakery.<br /><em>Grow with confidence.</em></h1><p>Four perspectives on your business. Open a report to explore the details.</p></div><div className="ow-library-stamp"><BookOpen size={42} strokeWidth={1} /><span>CRUMB &amp; CO.</span><small>Reports &amp; records</small></div></header><div className="ow-report-grid">{reports.map(({ key, title, label, description, detail, Icon }, index) => <Link key={key} to={`/owner/reports?report=${key}`} className={`ow-report-tile ow-report-tile-${key}`}><div className="ow-report-tile-top"><span className="ow-report-tile-icon"><Icon size={27} strokeWidth={1.4} /></span><span className="ow-report-number">0{index + 1}</span></div><div className="ow-eyebrow">{label}</div><h2>{title}</h2><p>{description}</p><footer><span>{detail}</span><ArrowUpRight size={20} /></footer></Link>)}</div><p className="ow-library-note">Reports use your saved business records. Missing historical cost data is identified within each report.</p></div>;
}
