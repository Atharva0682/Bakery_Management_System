import React, { useEffect, useState } from 'react';
import ownerService from '../../services/ownerService';
import { PageHeader, Notice, EmptyState, money, quantity } from '../../components/owner/OwnerUI';

const amount = value => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtWeight = (g) => {
  const num = Number(g) || 0;
  if (num <= 0) return '—';
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2).replace(/\.00$/, '')} kg`;
  }
  return `${Math.round(num)} g`;
};

export default function OwnerCostingPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    ownerService.getCostingAndMargins()
      .then(rows => {
        if (active) setItems(Array.isArray(rows) ? rows : (rows?.data || []));
      })
      .catch(err => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="owner-workspace ow-costing-report">
      <PageHeader
        eyebrow="Product economics"
        title="Recipe costing &amp; margins"
        description="Multi-level production costs, packaging expenses, and healthy margin audits across your bakery collection."
      />

      <Notice error>{error}</Notice>

      <div className="ow-costing-intro">
        <div>
          <span>THE MULTI-LEVEL COST LEDGER</span>
          <h2>Every gram, piece &amp; pack counts.</h2>
          <p>Live inventory rates and multi-level production expenses calculated for every batch, selling pack, and kilogram.</p>
        </div>
        <div>
          <strong>{loading ? '—' : items.length}</strong>
          <span>saved formulas</span>
        </div>
      </div>

      <section className="ow-panel">
        <div className="ow-table-wrap">
          <table className="ow-table ow-responsive-table">
            <thead>
              <tr>
                <th>Product / Formula</th>
                <th>Selling Unit</th>
                <th>Batch Weight</th>
                <th>Batch Yield</th>
                <th>Ingredients</th>
                <th>Labour</th>
                <th>Power</th>
                <th>Packaging</th>
                <th>Other</th>
                <th>Total Batch Cost</th>
                <th>Cost / Piece</th>
                <th>Cost / Pack</th>
                <th>Cost / kg</th>
                <th>Selling Price</th>
                <th>Gross Profit</th>
                <th>Margin %</th>
                <th>Markup %</th>
              </tr>
            </thead>
            <tbody>
              {items.map(row => {
                const sUnit = (row.selling_unit || 'per_piece').replace('_', ' ');
                const isPack = row.selling_unit === 'per_pack' || (row.items_per_pack && row.items_per_pack > 1);
                const bWeight = row.batch_output_weight_g || row.batch_output_weight || row.standard_batch_weight_g;
                const costPiece = row.cost_per_piece ?? row.unit_cost;
                const costPack = row.cost_per_pack ?? (isPack && row.items_per_pack ? (Number(costPiece) * row.items_per_pack) : null);
                const costKg = row.cost_per_kg ?? (bWeight > 0 ? (Number(row.total_production_cost || row.total_cost) / bWeight) * 1000 : null);
                const profitUnit = row.gross_profit_per_selling_unit ?? row.profit_margin;
                const sPrice = row.selling_price_per_pack ?? row.selling_price;

                return (
                  <tr key={row.id}>
                    <td data-label="Formula">
                      <strong>{row.product_name}</strong>
                      <small style={{ display: 'block', color: '#78716C' }}>{row.recipe_name}</small>
                    </td>
                    <td data-label="Selling Unit">
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F3F4F6' }}>
                        {sUnit}
                      </span>
                    </td>
                    <td data-label="Batch Weight">
                      {fmtWeight(bWeight)}
                    </td>
                    <td data-label="Batch Yield">
                      {quantity(row.yield_quantity || row.batch_yield_units)} {row.yield_unit || 'pcs'}
                      {isPack && row.items_per_pack && (
                        <small style={{ display: 'block', color: '#B45309', fontSize: '10px' }}>
                          ({row.items_per_pack} / pack)
                        </small>
                      )}
                    </td>
                    <td data-label="Ingredients" className="ow-numeric">{money(row.raw_material_cost)}</td>
                    <td data-label="Labour" className="ow-numeric">{money(row.labour_cost)}</td>
                    <td data-label="Power" className="ow-numeric">{money(row.power_cost)}</td>
                    <td data-label="Packaging" className="ow-numeric">{money(row.packaging_cost)}</td>
                    <td data-label="Other" className="ow-numeric">{money(row.other_cost)}</td>
                    <td data-label="Total Batch Cost" className="ow-numeric" style={{ fontWeight: 800 }}>
                      {money(row.total_production_cost ?? row.total_cost)}
                    </td>
                    <td data-label="Cost / Piece" className="ow-numeric">
                      {money(costPiece)}
                    </td>
                    <td data-label="Cost / Pack" className="ow-numeric">
                      {costPack !== null && costPack !== undefined ? money(costPack) : '—'}
                    </td>
                    <td data-label="Cost / kg" className="ow-numeric">
                      {costKg !== null && costKg !== undefined ? money(costKg) : '—'}
                    </td>
                    <td data-label="Selling Price" className="ow-numeric" style={{ fontWeight: 700, color: '#059669' }}>
                      {money(sPrice)}
                      <small style={{ display: 'block', color: '#78716C', fontSize: '10px' }}>
                        {isPack ? 'per pack' : 'per unit'}
                      </small>
                    </td>
                    <td data-label="Gross Profit" className="ow-numeric" style={{ fontWeight: 700, color: Number(profitUnit) >= 0 ? '#15803D' : '#DC2626' }}>
                      {money(profitUnit)}
                    </td>
                    <td data-label="Margin %">
                      <span className={`ow-margin-tag ${Number(row.margin_percent) < 0 ? 'ow-margin-loss' : ''}`}>
                        {amount(row.margin_percent)}%
                      </span>
                    </td>
                    <td data-label="Markup %">
                      {row.markup_percent === null || row.markup_percent === undefined ? 'Unavailable' : `${amount(row.markup_percent)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading ? (
          <EmptyState title="Loading saved recipe costs…" />
        ) : !items.length && (
          <EmptyState title="No recipes saved">Add a master recipe from Products &amp; Recipes.</EmptyState>
        )}
      </section>

      <p className="ow-library-note">
        Costing formulas adhere strictly to: Gross Profit = Selling Revenue − Applicable Cost; Gross Margin % = (Gross Profit ÷ Selling Revenue) × 100; Markup % = (Gross Profit ÷ Applicable Cost) × 100.
      </p>
    </div>
  );
}
