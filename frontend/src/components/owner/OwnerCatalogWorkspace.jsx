import React, { useState } from 'react';
import { BookOpen, Plus, Search, ChefHat, Clock3, Flame, Scale, ArrowUpRight, Pencil, Trash2, Package, Leaf, Layers, Check, Truck, Image as ImageIcon, AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { PageHeader, MetricStrip, Notice, EmptyState, SectionHeader, StatusBadge, money, quantity } from './OwnerUI';
import '../../styles/owner-catalog.css';

function ProductPhoto({ src, name, className = '' }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`oc-photo ${className}`}>
      {src && !failed ? (
        <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="oc-photo-fallback">
          <ImageIcon size={30} />
          <span>{name}</span>
        </div>
      )}
    </div>
  );
}

export default function OwnerCatalogWorkspace({ model: m }) {
  const product = m.products.find(p => Number(p.id) === Number(m.curRecipe.product_id));
  const categories = [...new Set(m.products.map(p => p.category_name).filter(Boolean))];
  const [category, setCategory] = useState('');

  const costs = [
    ['Ingredients', m.totalRawCost, '#ad642e'],
    ['Labour', m.laborCost, '#c69963'],
    ['Power', m.powerCost, '#e3be83'],
    ['Packaging', m.packagingCost, '#8d9d7e'],
    ['Other', m.otherOverheadCost, '#b99a9d']
  ];

  const chooseRecipe = (recipe) => {
    m.setSelectedRecipe(recipe);
    m.setDesiredProductionQty('');
    if (m.setCalcMode) m.setCalcMode('WEIGHT');
    if (m.setTargetWeightInput) {
      const bw = Number(recipe.batch_output_weight) || (Number(recipe.standard_batch_weight_g)) || 1000;
      if (bw >= 1000) {
        m.setTargetWeightInput(String(bw / 1000));
        m.setTargetWeightUnit('kg');
      } else {
        m.setTargetWeightInput(String(bw));
        m.setTargetWeightUnit('g');
      }
    }
  };

  // Safe formatting helpers
  const fmtWeight = (g) => {
    const num = Number(g) || 0;
    if (num >= 1000) {
      return `${(num / 1000).toFixed(2).replace(/\.00$/, '')} kg`;
    }
    return `${Math.round(num)} g`;
  };

  return (
    <>
      <PageHeader
        eyebrow="The bakery collection"
        title="Products & recipes"
        description="Your menu, master formulas, weight-based scaling, pack management, and production costing."
      >
        <button className="ow-button" onClick={() => m.setShowAddRecipeModal(true)}>
          <BookOpen size={16} /> Add recipe
        </button>
        <button className="ow-button ow-button-primary" onClick={() => m.setShowAddProductModal(true)}>
          <Plus size={16} /> New product
        </button>
      </PageHeader>

      <Notice>{m.notification}</Notice>
      <Notice error>{m.catalogError}</Notice>

      <MetricStrip items={[
        { label: 'Products on menu', value: m.products.length, note: 'Saved bakery collection', icon: Package },
        { label: 'Master formulas', value: m.recipes.length, note: `${m.recipes.filter(r => r.is_active_formula).length} active production formulas`, icon: BookOpen },
        { label: 'Menu categories', value: categories.length, note: 'Across active collection', icon: Layers },
        { label: 'Eggless products', value: m.products.filter(p => p.is_eggless).length, note: '100% pure veg offerings', icon: Leaf },
      ]} />

      <div className="ow-toolbar">
        <div className="ow-tabs" role="tablist" aria-label="Catalog views">
          {[
            ['RECIPES', 'Recipe book', m.recipes.length],
            ['PRODUCTS', 'Product collection', m.products.length]
          ].map(([key, label, count]) => (
            <button
              key={key}
              role="tab"
              aria-selected={m.activeTab === key}
              onClick={() => m.setActiveTab(key)}
            >
              {label}
              <span>{count}</span>
            </button>
          ))}
        </div>
        <span className="oc-helper">
          <ChefHat size={16} /> Scaled for your kitchen. Costed with healthy margins.
        </span>
      </div>

      {m.activeTab === 'RECIPES' ? (
        m.recipes.length ? (
          <div className="oc-workspace">
            {/* Sidebar Recipe List */}
            <aside className="oc-book ow-panel">
              <SectionHeader title="The recipe book" subtitle="Choose a formula to inspect or scale" />
              <label className="ow-search">
                <Search size={16} />
                <input
                  aria-label="Search recipes"
                  placeholder="Find a recipe…"
                  value={m.recipeSearch}
                  onChange={e => m.setRecipeSearch(e.target.value)}
                />
              </label>
              <div className="oc-recipe-list">
                {m.filteredRecipes.map(recipe => {
                  const item = m.products.find(p => Number(p.id) === Number(recipe.product_id));
                  return (
                    <button
                      key={recipe.id}
                      className="oc-recipe-item"
                      aria-pressed={recipe.id === m.curRecipe.id}
                      onClick={() => chooseRecipe(recipe)}
                    >
                      <ProductPhoto
                        key={item?.image_url || recipe.id}
                        src={item?.image_url}
                        name={recipe.product_name}
                      />
                      <div>
                        <strong>{recipe.recipe_name || recipe.product_name}</strong>
                        <small>
                          {recipe.category || item?.category_name || 'Recipe'} · {quantity(recipe.yield_quantity || recipe.batch_yield_units)} {recipe.yield_unit || 'units'}
                          {recipe.batch_output_weight ? ` (${fmtWeight(recipe.batch_output_weight)})` : ''}
                        </small>
                        <span>
                          {money(recipe.selling_price_per_pack || recipe.selling_price)}
                          <small> {recipe.selling_unit === 'per_pack' ? '/ pack' : '/ unit'}</small>
                        </span>
                      </div>
                      {recipe.is_active_formula && (
                        <Check size={14} className="oc-active-check" aria-label="Active formula" />
                      )}
                    </button>
                  );
                })}
                {!m.filteredRecipes.length && (
                  <EmptyState title="No recipes found">Try another product name.</EmptyState>
                )}
              </div>
            </aside>

            {/* Recipe Detail View */}
            <div className="oc-detail">
              {/* Recipe Cover Card */}
              <section className="oc-recipe-cover">
                <ProductPhoto
                  key={product?.image_url || m.curRecipe.id}
                  src={product?.image_url}
                  name={m.curRecipe.product_name}
                />
                <div className="oc-cover-copy">
                  <div className="ow-eyebrow">{product?.category_name || m.curRecipe.category || 'Master formula'}</div>
                  <h2>{m.curTitle}</h2>
                  <div className="oc-cover-badges">
                    <StatusBadge
                      value={m.curRecipe.is_active_formula ? 'Production formula' : 'Alternative formula'}
                      tone={m.curRecipe.is_active_formula ? 'success' : 'neutral'}
                    />
                    {product?.is_eggless && (
                      <span className="oc-diet">
                        <Leaf size={12} /> Eggless
                      </span>
                    )}
                    {m.curRecipe.selling_unit && (
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                        Sold: {m.curRecipe.selling_unit.replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="oc-recipe-facts">
                    <span>
                      <Scale size={15} /> Standard Batch: {m.standardYield} {m.curYieldUnit}
                    </span>
                    <span>
                      <Scale size={15} /> Batch Weight: {fmtWeight(m.standardBatchWeightGrams)}
                    </span>
                    {m.curRecipe.items_per_pack > 1 && (
                      <span>
                        <Package size={15} /> {m.curRecipe.items_per_pack} pcs / pack · {m.curRecipe.packs_per_batch || Math.round(m.standardYield / m.curRecipe.items_per_pack)} packs / batch
                      </span>
                    )}
                    {m.curRecipe.weight_per_piece_g && (
                      <span>
                        {m.curRecipe.weight_per_piece_g}g / piece
                      </span>
                    )}
                    {m.curRecipe.net_weight_per_pack_g && (
                      <span>
                        {m.curRecipe.net_weight_per_pack_g}g / pack
                      </span>
                    )}
                    <span>
                      <Clock3 size={15} /> {m.prepMins}m prep
                    </span>
                    <span>
                      <Flame size={15} /> {m.bakeMins}m bake
                    </span>
                  </div>

                  <div className="ow-actions">
                    <button className="ow-button" onClick={() => m.setShowEditFactorsModal(true)}>
                      <Pencil size={13} /> Edit recipe, packaging & pricing
                    </button>
                    {!m.curRecipe.is_active_formula && (
                      <button className="ow-button" onClick={m.activateRecipe}>
                        Use for production
                      </button>
                    )}
                    <button
                      className="ow-icon-button"
                      aria-label="Delete selected recipe"
                      onClick={() => m.handleDeleteRecipe(m.curRecipe.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </section>

              {/* BATCH CALCULATOR & WEIGHT-BASED PRODUCTION SCALER */}
              <section className="ow-panel">
                <div className="oc-scale-bar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '10px', padding: '14px 18px', background: '#fbf6ed', borderBottom: '1px solid var(--ow-line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <span className="ow-eyebrow" style={{ marginBottom: '2px', display: 'block' }}>Production batch calculator</span>
                      <h3 style={{ margin: 0, fontSize: '18px', lineHeight: 1.2 }}>Plan & scale your next bake</h3>
                      <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#78716C' }}>Dynamically scale all ingredient requirements by target weight, pack count, or batch pieces.</p>
                    </div>

                    {/* Mode Selector Tabs */}
                    <div style={{ display: 'flex', gap: '4px', backgroundColor: '#EDE3D2', padding: '3px', borderRadius: '7px' }}>
                      {[
                        ['WEIGHT', 'By Weight (g/kg)'],
                        ['PACKS', 'By Packs'],
                        ['PIECES', 'By Pieces']
                      ].map(([modeKey, label]) => (
                        <button
                          key={modeKey}
                          type="button"
                          onClick={() => m.setCalcMode(modeKey)}
                          style={{
                            padding: '5px 11px',
                            borderRadius: '5px',
                            border: 'none',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            backgroundColor: m.calcMode === modeKey ? '#AD642E' : 'transparent',
                            color: m.calcMode === modeKey ? '#FFFFFF' : '#654B33',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calculator Inputs based on Mode */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px 14px', backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E4D5BF' }}>
                    {m.calcMode === 'WEIGHT' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#44403C' }}>
                          Target Production Weight:
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            aria-label="Target production weight"
                            type="number"
                            min="0.01"
                            step="any"
                            value={m.targetWeightInput}
                            onChange={e => m.setTargetWeightInput(e.target.value)}
                            style={{
                              width: '84px',
                              padding: '6px 8px',
                              border: '2px solid #C25E00',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 800,
                              color: '#80481E'
                            }}
                          />
                          <select
                            value={m.targetWeightUnit}
                            onChange={e => m.setTargetWeightUnit(e.target.value)}
                            style={{
                              padding: '6px 8px',
                              border: '1px solid #D6D3D1',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              backgroundColor: '#FAFAF9'
                            }}
                          >
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                          </select>
                        </div>

                        {/* Quick Presets for Weight */}
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', color: '#78716C' }}>Presets:</span>
                          {[
                            { label: '500g', g: 500 },
                            { label: '750g', g: 750 },
                            { label: '1 kg', g: 1000 },
                            { label: '1.5 kg', g: 1500 },
                            { label: '2 kg', g: 2000 },
                            { label: 'Std Batch', g: m.standardBatchWeightGrams }
                          ].map(preset => (
                            <button
                              key={preset.label}
                              type="button"
                              className="ow-button"
                              onClick={() => {
                                if (preset.g >= 1000) {
                                  m.setTargetWeightInput(String(preset.g / 1000));
                                  m.setTargetWeightUnit('kg');
                                } else {
                                  m.setTargetWeightInput(String(preset.g));
                                  m.setTargetWeightUnit('g');
                                }
                              }}
                              style={{
                                padding: '3px 8px',
                                minHeight: 'auto',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                backgroundColor: Math.round(m.targetWeightGrams) === Math.round(preset.g) ? '#FEF3C7' : '#FFFFFF',
                                borderColor: Math.round(m.targetWeightGrams) === Math.round(preset.g) ? '#C25E00' : '#D6D3D1',
                                color: Math.round(m.targetWeightGrams) === Math.round(preset.g) ? '#92400E' : '#44403C'
                              }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {m.calcMode === 'PACKS' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#44403C' }}>
                          Required Finished Packs:
                        </span>
                        <input
                          aria-label="Required finished packs"
                          type="number"
                          min="1"
                          step="1"
                          value={m.targetPacksInput}
                          onChange={e => m.setTargetPacksInput(e.target.value)}
                          style={{
                            width: '75px',
                            padding: '6px 8px',
                            border: '2px solid #C25E00',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 800,
                            color: '#80481E'
                          }}
                        />
                        <span style={{ fontSize: '11px', color: '#78716C' }}>
                          packs @ {m.curRecipe.items_per_pack || 1} pcs / pack = <strong>{Math.round(m.actualProductionQty)} individual items</strong> ({m.scalingFactor.toFixed(2)}× standard batches)
                        </span>
                      </div>
                    )}

                    {m.calcMode === 'PIECES' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#44403C' }}>
                          Required Production Items:
                        </span>
                        <input
                          aria-label="Required production items"
                          type="number"
                          min="1"
                          step="1"
                          value={m.desiredProductionQty}
                          onChange={e => m.setDesiredProductionQty(e.target.value)}
                          style={{
                            width: '75px',
                            padding: '6px 8px',
                            border: '2px solid #C25E00',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: 800,
                            color: '#80481E'
                          }}
                        />
                        <span style={{ fontSize: '11px', color: '#78716C' }}>
                          {m.curYieldUnit} ({m.scalingFactor.toFixed(2)}× standard batch)
                        </span>

                        <div className="oc-multipliers">
                          {[0.5, 1, 2, 4].map(n => (
                            <button
                              className="ow-button"
                              key={n}
                              aria-pressed={m.scalingFactor === n}
                              onClick={() => m.setDesiredProductionQty(m.standardYield * n)}
                              style={{ padding: '3px 8px', minHeight: 'auto', fontSize: '11px' }}
                            >
                              {n}×
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Formula Calculation Banner */}
                    <div style={{
                      backgroundColor: '#FFF7ED',
                      border: '1px solid #FFEDD5',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#9A3412',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Info size={14} color="#EA580C" />
                      <span>
                        <strong>Scaling Factor = {m.scalingFactor.toFixed(3)}×</strong> (Scaled Qty = Original Qty × {m.scalingFactor.toFixed(3)})
                      </span>
                    </div>
                  </div>

                  {/* BATCH WEIGHT & YIELD OVERVIEW STRIP */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '8px 12px',
                    backgroundColor: '#FAF5EE',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #EFE4D3',
                    fontSize: '11px',
                    height: 'auto',
                    minHeight: '0',
                    alignItems: 'start'
                  }}>
                    <div>
                      <span style={{ color: '#78716C', display: 'block', fontSize: '10px', lineHeight: 1.2 }}>Std Batch Weight:</span>
                      <strong style={{ color: '#44403C', fontSize: '13px', lineHeight: 1.2 }}>{fmtWeight(m.standardBatchWeightGrams)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#78716C', display: 'block', fontSize: '10px', lineHeight: 1.2 }}>Target Production Weight:</span>
                      <strong style={{ color: '#C25E00', fontSize: '13px', lineHeight: 1.2 }}>{fmtWeight(m.targetWeightGrams)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#78716C', display: 'block', fontSize: '10px', lineHeight: 1.2 }}>Raw Ingredient Input:</span>
                      <strong style={{ color: '#44403C', fontSize: '13px', lineHeight: 1.2 }}>{fmtWeight(m.totalRawInputWeightGrams)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#78716C', display: 'block', fontSize: '10px', lineHeight: 1.2 }}>Expected Yield:</span>
                      <strong style={{ color: '#15803D', fontSize: '13px', lineHeight: 1.2 }}>{m.yieldPercentage}%</strong>
                    </div>
                    <div>
                      <span style={{ color: '#78716C', display: 'block', fontSize: '10px', lineHeight: 1.2 }}>Moisture / Trimming Loss:</span>
                      <strong style={{ color: '#B45309', fontSize: '13px', lineHeight: 1.2 }}>{fmtWeight(m.wastageWeightGrams)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#78716C', display: 'block', fontSize: '10px', lineHeight: 1.2 }}>Sellable Finished Weight:</span>
                      <strong style={{ color: '#047857', fontSize: '13px', lineHeight: 1.2 }}>{fmtWeight(m.sellableWeightGrams)}</strong>
                    </div>
                  </div>
                </div>

                {/* DYNAMIC SCALED INGREDIENTS TABLE WITH INVENTORY AVAILABILITY CHECK */}
                <div className="ow-table-wrap">
                  <table className="ow-table ow-responsive-table">
                    <thead>
                      <tr>
                        <th>Ingredient Name</th>
                        <th>Original Qty</th>
                        <th>Scaled Qty</th>
                        <th>Unit</th>
                        <th>Available Stock</th>
                        <th>Required Stock</th>
                        <th>Ingredient Cost</th>
                        <th style={{ textAlign: 'center' }}>Availability Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.ingredientsList.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#78716C', fontStyle: 'italic', fontSize: '13px' }}>
                            No raw ingredients configured for this recipe formula. Click &ldquo;Edit recipe, packaging &amp; pricing&rdquo; to add formula ingredients.
                          </td>
                        </tr>
                      ) : (
                        m.ingredientsList.map((ing, i) => {
                        const status = ing.availability_status || 'IN_STOCK';
                        return (
                          <tr key={i}>
                            <td data-label="Ingredient">
                              <strong>{ing.ingredient}</strong>
                              <small style={{ display: 'block', color: '#78716C', fontSize: '10px' }}>
                                Bakers %: {ing.bakers_pct}
                              </small>
                            </td>
                            <td data-label="Original">{quantity(ing.standard_qty)} {ing.unit}</td>
                            <td data-label="Scaled">
                              <strong className="oc-accent" style={{ fontSize: '13px', color: '#C25E00' }}>
                                {quantity(ing.scaled_qty)} {ing.unit}
                              </strong>
                            </td>
                            <td data-label="Unit">{ing.unit}</td>
                            <td data-label="Available Stock">
                              {quantity(ing.stock_qty)} {ing.stock_unit}
                            </td>
                            <td data-label="Required Stock">
                              {quantity(ing.required_stock)} {ing.stock_unit}
                            </td>
                            <td data-label="Cost" className="ow-numeric">
                              <strong>{money(ing.line_cost)}</strong>
                              <small style={{ display: 'block', color: '#78716C', fontSize: '10px' }}>
                                {ing.display_unit_cost}
                              </small>
                            </td>
                            <td data-label="Status" style={{ textAlign: 'center' }}>
                              {status === 'IN_STOCK' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', backgroundColor: '#DCFCE7', color: '#166534', fontSize: '11px', fontWeight: 700 }}>
                                  <CheckCircle size={12} /> In Stock
                                </span>
                              )}
                              {status === 'LOW_STOCK' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '11px', fontWeight: 700 }}>
                                  <AlertTriangle size={12} /> Low Stock
                                </span>
                              )}
                              {status === 'OUT_OF_STOCK' && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '9999px', backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: '11px', fontWeight: 700 }}>
                                  <AlertCircle size={12} /> Out of Stock
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="6">
                          Total Raw Ingredients · Scaled for {fmtWeight(m.targetWeightGrams)} ({quantity(m.actualProductionQty)} {m.curYieldUnit})
                        </td>
                        <td className="ow-numeric" style={{ fontSize: '14px', fontWeight: 800 }}>
                          {money(m.totalRawCost)}
                        </td>
                        <td style={{ fontSize: '10px', color: '#78716C', textAlign: 'center' }}>
                          Verified against pantry
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div style={{ padding: '10px 18px', backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB', fontSize: '11px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={14} />
                  <span>
                    Stock availability checked for preview. Real pantry inventory deduction occurs strictly once when an authorized production batch is launched.
                  </span>
                </div>
              </section>

              {/* ECONOMICS, MULTI-LEVEL COSTING & PRICING STUDIO */}
              <div className="oc-economics">
                {/* Cost Breakdown Card */}
                <section className="ow-panel">
                  <SectionHeader
                    title="Production cost breakdown"
                    subtitle={`Multi-level expenses scaled for ${fmtWeight(m.targetWeightGrams)} (${quantity(m.actualProductionQty)} ${m.curYieldUnit})`}
                  />
                  <div className="oc-cost-body">
                    <div className="oc-cost-total">
                      <span>Total production cost</span>
                      <strong>{money(m.totalProductionCost)}</strong>
                    </div>

                    <div className="oc-cost-bar" aria-label="Production cost composition">
                      {costs.map(([label, value, color]) =>
                        value > 0 && (
                          <span
                            key={label}
                            title={`${label}: ${money(value)}`}
                            style={{
                              width: `${(value / (m.totalProductionCost || 1)) * 100}%`,
                              background: color
                            }}
                          />
                        )
                      )}
                    </div>

                    {costs.map(([label, value, color]) => (
                      <div className="oc-cost-line" key={label}>
                        <span>
                          <i style={{ background: color }} />
                          {label}
                        </span>
                        <strong>{money(value)}</strong>
                      </div>
                    ))}

                    {/* Multi-Level Cost Indicators */}
                    <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                      <div style={{ backgroundColor: '#F5EFEB', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#78716C', display: 'block' }}>Cost / Piece</span>
                        <strong style={{ fontSize: '14px', color: '#7A3E1D' }}>{money(m.costPerPiece)}</strong>
                      </div>

                      {m.curRecipe.items_per_pack > 1 && (
                        <div style={{ backgroundColor: '#F5EFEB', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#78716C', display: 'block' }}>Cost / Pack ({m.curRecipe.items_per_pack} pcs)</span>
                          <strong style={{ fontSize: '14px', color: '#7A3E1D' }}>{money(m.costPerPack)}</strong>
                        </div>
                      )}

                      {m.targetWeightGrams > 0 && (
                        <>
                          <div style={{ backgroundColor: '#F5EFEB', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#78716C', display: 'block' }}>Cost / 100g</span>
                            <strong style={{ fontSize: '14px', color: '#7A3E1D' }}>{money(m.costPer100g)}</strong>
                          </div>
                          <div style={{ backgroundColor: '#F5EFEB', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#78716C', display: 'block' }}>Cost / kg</span>
                            <strong style={{ fontSize: '14px', color: '#7A3E1D' }}>{money(m.costPerKg)}</strong>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </section>

                {/* Healthy Margins & Pricing Studio */}
                <section className="oc-pricing">
                  <div className="ow-eyebrow">Pricing studio & margins</div>
                  <h3>A healthy margin, every bake.</h3>

                  <div className="oc-price-preview">
                    <span>Gross margin</span>
                    <strong className={m.grossMarginPct < 0 ? 'oc-loss' : ''}>
                      {m.grossMarginPct.toFixed(1)}<small>%</small>
                    </strong>
                    <p>
                      {money(m.profitPerUnit)} gross profit per {m.isPackBased ? 'pack' : 'selling unit'} · excludes GST
                    </p>
                  </div>

                  <div className="ow-key-value">
                    <span>Markup on cost</span>
                    <strong>{m.markupPct.toFixed(1)}% (Markup = Profit ÷ Cost)</strong>
                  </div>

                  <div className="ow-key-value">
                    <span>Total batch revenue</span>
                    <strong>{money(m.totalRevenue)}</strong>
                  </div>

                  <div className="ow-key-value">
                    <span>Total batch profit</span>
                    <strong style={{ color: m.totalBatchProfit >= 0 ? '#15803D' : '#DC2626' }}>
                      {money(m.totalBatchProfit)}
                    </strong>
                  </div>

                  <div className="ow-key-value">
                    <span>Break-even cost per unit</span>
                    <strong>{money(m.isPackBased ? m.costPerPack : m.costPerPiece)}</strong>
                  </div>

                  <div className="oc-price-form">
                    <label className="ow-field">
                      Selling price before GST ({m.isPackBased ? 'per pack' : 'per piece'})
                      <input
                        aria-label="Recipe selling price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={m.editingPrice}
                        onChange={e => m.setEditingPrice(e.target.value)}
                      />
                    </label>
                    <button
                      className="ow-button ow-button-primary"
                      disabled={m.isUpdatingPrice}
                      onClick={m.handleQuickSavePrice}
                    >
                      {m.isUpdatingPrice ? 'Saving…' : 'Save price'}
                    </button>
                  </div>

                  <p className="oc-tax">
                    GST {Number(m.curRecipe.gst_rate || 0)}% · Customer price {money(m.curSellingPrice * (1 + Number(m.curRecipe.gst_rate || 0) / 100))}
                  </p>

                  <details className="oc-target">
                    <summary>Target margin calculator</summary>
                    <label className="ow-field">
                      Target gross margin (%)
                      <input
                        type="number"
                        min="0"
                        max="99.9"
                        step="0.1"
                        value={m.targetMarginInput}
                        onChange={e => m.setTargetMarginInput(e.target.value)}
                      />
                    </label>
                    <p>
                      Suggested price <strong>{money(m.recommendedSellingPriceRounded)}</strong> per item
                    </p>
                    <button className="ow-button" onClick={m.handleApplyRecommendedPrice}>
                      Use suggested price <ArrowUpRight size={14} />
                    </button>
                    <small>Applies to the price field. Click "Save price" to commit.</small>
                  </details>
                </section>
              </div>

              {/* Instructions */}
              <section className="ow-panel">
                <SectionHeader title="From the recipe notebook" subtitle="Preparation & baking instructions" />
                <p className="oc-instructions">
                  {m.curRecipe.instructions || 'No instructions saved. Add preparation steps using Edit recipe, packaging & pricing.'}
                </p>
              </section>
            </div>
          </div>
        ) : (
          <section className="ow-panel">
            <EmptyState
              title="Start your recipe book"
              action={
                <button className="ow-button ow-button-primary" onClick={() => m.setShowAddRecipeModal(true)}>
                  Add your first recipe
                </button>
              }
            >
              Connect a product to its ingredients, packaging specs, and production costs.
            </EmptyState>
          </section>
        )
      ) : (
        /* PRODUCT COLLECTION TAB */
        <>
          <div className="oc-collection-toolbar">
            <label className="ow-search">
              <Search size={16} />
              <input
                aria-label="Search products"
                placeholder="Search your collection…"
                value={m.productSearch}
                onChange={e => m.setProductSearch(e.target.value)}
              />
            </label>
            <select
              className="ow-select"
              aria-label="Product category"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map(name => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="oc-product-grid">
            {m.filteredProducts.filter(p => !category || p.category_name === category).map(p => {
              const formula = m.recipes.find(r => Number(r.product_id) === Number(p.id) && r.is_active_formula) || m.recipes.find(r => Number(r.product_id) === Number(p.id));
              const isPack = p.selling_unit === 'per_pack' || (p.items_per_pack && p.items_per_pack > 1);
              return (
                <article className="oc-product-card" key={p.id}>
                  <div className="oc-product-image">
                    <ProductPhoto src={p.image_url} name={p.name} />
                    <span className="oc-product-category">
                      {p.category_name || m.categories.find(c => c.id === p.category_id)?.name || 'Uncategorised'}
                    </span>
                    {p.is_eggless && (
                      <span className="oc-product-leaf" title="Eggless">
                        <Leaf size={15} />
                      </span>
                    )}
                  </div>
                  <div className="oc-product-copy">
                    <h2>{p.name}</h2>
                    <p>{p.description || 'No product description saved.'}</p>
                    <div className="oc-product-meta">
                      <span>
                        <Clock3 size={13} />
                        {p.shelf_life_days == null ? 'Shelf life not set' : `${p.shelf_life_days} day shelf life`}
                      </span>
                      <span>
                        <Truck size={13} />
                        {p.delivery_fee !== null && p.delivery_fee !== undefined
                          ? (Number(p.delivery_fee) === 0 ? 'Free Delivery' : `Delivery: ${money(p.delivery_fee)}`)
                          : 'Std Delivery (₹50)'}
                      </span>
                      <StatusBadge value={p.is_available === false || p.is_available === 0 ? 'Unavailable' : 'Available'} />
                    </div>

                    {/* Packaging note */}
                    {isPack && (
                      <div style={{ fontSize: '11px', color: '#92400E', backgroundColor: '#FEF3C7', padding: '3px 8px', borderRadius: '4px', marginBottom: '8px', display: 'inline-block' }}>
                        Pack of {p.items_per_pack || 1} {p.net_weight_per_pack_g ? `(${p.net_weight_per_pack_g}g)` : ''}
                      </div>
                    )}

                    <div className="oc-product-footer">
                      {m.editingProductId === p.id ? (
                        <div className="oc-inline-price" style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <label style={{ fontSize: '11px', display: 'flex', flexDirection: 'column' }}>
                              Price (₹)
                              <input
                                aria-label={`Price for ${p.name}`}
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={m.tempProductPrice}
                                onChange={e => m.setTempProductPrice(e.target.value)}
                              />
                            </label>
                            <label style={{ fontSize: '11px', display: 'flex', flexDirection: 'column' }}>
                              Delivery (₹)
                              <input
                                aria-label={`Delivery fee for ${p.name}`}
                                placeholder="50 (std)"
                                type="number"
                                min="0"
                                step="1"
                                value={m.tempProductDeliveryFee}
                                onChange={e => m.setTempProductDeliveryFee(e.target.value)}
                              />
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button className="ow-button" onClick={() => m.handleSaveProductPrice(p.id)}>Save</button>
                            <button className="ow-button" onClick={() => m.setEditingProductId(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <small>SELLING PRICE · EXCL. GST</small>
                            <strong>{money(p.selling_price_per_pack || p.base_price || p.price)}</strong>
                            {isPack && <span style={{ fontSize: '10px', color: '#78716C' }}> per pack</span>}
                          </div>
                          <button
                            className="ow-icon-button"
                            aria-label={`Edit price & delivery fee for ${p.name}`}
                            onClick={() => {
                              m.setEditingProductId(p.id);
                              m.setTempProductPrice(p.selling_price_per_pack || p.base_price || p.price || '');
                              m.setTempProductDeliveryFee(p.delivery_fee !== null && p.delivery_fee !== undefined ? String(p.delivery_fee) : '');
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="oc-card-actions">
                      <button
                        className="ow-text-link"
                        onClick={() => {
                          if (formula) {
                            chooseRecipe(formula);
                            m.setActiveTab('RECIPES');
                          } else {
                            m.setNewRecipeForm(prev => ({ ...prev, product_id: String(p.id) }));
                            m.setShowAddRecipeModal(true);
                          }
                        }}
                      >
                        {formula ? 'Open recipe' : 'Create recipe'}
                        <ArrowUpRight size={14} />
                      </button>
                      <button
                        className="oc-archive"
                        onClick={() => m.handleDeleteProduct(p.id)}
                        aria-label={`Archive ${p.name}`}
                      >
                        <Trash2 size={13} /> Archive
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {!m.filteredProducts.filter(p => !category || p.category_name === category).length && (
            <EmptyState title="No products match">Try another category or search.</EmptyState>
          )}
        </>
      )}

      {/* Bulk Recipe Costing Updater */}
      <details className="oc-bulk ow-panel">
        <summary>
          <Layers size={17} />
          <span>
            Update costing across recipes
            <small>Apply a shared rate to a selection of formulas</small>
          </span>
          <Plus size={16} />
        </summary>
        <div className="oc-bulk-body">
          <label className="ow-field">
            Select recipes
            <select
              multiple
              aria-label="Recipes for bulk update"
              value={m.bulkIds}
              onChange={e => m.setBulkIds([...e.target.selectedOptions].map(o => o.value))}
            >
              {m.recipes.map(r => (
                <option key={r.id} value={String(r.id)}>
                  {r.recipe_name || r.product_name}
                </option>
              ))}
            </select>
            <small>Use Ctrl / Command to select more than one.</small>
          </label>

          <label className="ow-field">
            Cost component
            <select
              aria-label="Bulk costing field"
              value={m.bulkField}
              onChange={e => m.setBulkField(e.target.value)}
            >
              {[
                ['labour_cost_per_min', 'Labour / minute'],
                ['power_cost_per_min', 'Power / minute'],
                ['packaging_cost_per_unit', 'Packaging / item'],
                ['packaging_cost_per_pack', 'Packaging / pack'],
                ['other_cost', 'Other / batch'],
                ['gst_rate', 'GST (%)']
              ].map(([key, label]) => (
                <option value={key} key={key}>{label}</option>
              ))}
            </select>
          </label>

          <label className="ow-field">
            New value
            <input
              aria-label="New bulk value"
              type="number"
              min="0"
              step="any"
              value={m.bulkValue}
              onChange={e => m.setBulkValue(e.target.value)}
            />
          </label>

          <button
            className="ow-button ow-button-primary"
            disabled={!m.bulkIds.length || m.bulkValue === '' || m.submitting}
            onClick={m.applyBulk}
          >
            Review & apply ({m.bulkIds.length})
          </button>
        </div>
      </details>
    </>
  );
}
