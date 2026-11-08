import React, { useState, useEffect, useMemo } from 'react';
import ownerService from '../../services/ownerService';
import api from '../../services/api';
import { Dialog } from '../../components/owner/OwnerUI';
import OwnerCatalogWorkspace from '../../components/owner/OwnerCatalogWorkspace';
import { ChefHat, Plus, Trash2, ImageIcon, Package, Scale, Calculator, ArrowRight } from 'lucide-react';

const PRESET_BAKERY_IMAGES = [
  { name: 'Country Sourdough', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600' },
  { name: 'Butter Croissant', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600' },
  { name: 'Pain au Chocolat', url: 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?w=600' },
  { name: 'Chocolate Truffle Cake', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600' },
  { name: 'Basque Cheesecake', url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600' },
  { name: 'Rosemary Focaccia', url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600' },
  { name: 'Multigrain Loaf', url: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600' },
  { name: 'Masala Savory Puff', url: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600' },
];

/**
 * Packaging & Selling Configuration Editor Sub-Component
 * Reused across Add Product, Add Recipe, and Edit Factors modals.
 */
function PackagingConfigFields({ values, onChange }) {
  const [reversePacks, setReversePacks] = useState('');

  const handleField = (field, val) => {
    const updated = { ...values, [field]: val };
    const itemsPerPack = parseInt(field === 'items_per_pack' ? val : updated.items_per_pack, 10) || 1;
    const packsPerBatch = parseInt(field === 'packs_per_batch' ? val : updated.packs_per_batch, 10) || 1;
    const wtPerPiece = parseFloat(field === 'weight_per_piece_g' ? val : updated.weight_per_piece_g) || 0;
    const sellPricePack = parseFloat(field === 'selling_price_per_pack' ? val : updated.selling_price_per_pack) || 0;

    if (field === 'items_per_pack' || field === 'packs_per_batch') {
      const totPieces = itemsPerPack * packsPerBatch;
      updated.total_pieces_per_batch = totPieces;
      updated.batch_yield_units = totPieces;
      if (wtPerPiece > 0) {
        updated.net_weight_per_pack_g = itemsPerPack * wtPerPiece;
        updated.batch_output_weight = totPieces * wtPerPiece;
        updated.standard_batch_weight_g = totPieces * wtPerPiece;
      }
      if (sellPricePack > 0 && itemsPerPack > 0) {
        updated.selling_price_per_piece = (sellPricePack / itemsPerPack).toFixed(2);
      }
    } else if (field === 'weight_per_piece_g') {
      if (wtPerPiece > 0) {
        updated.net_weight_per_pack_g = itemsPerPack * wtPerPiece;
        const tot = parseInt(updated.total_pieces_per_batch || (itemsPerPack * packsPerBatch), 10);
        updated.batch_output_weight = tot * wtPerPiece;
        updated.standard_batch_weight_g = tot * wtPerPiece;
        updated.standard_unit_weight_grams = wtPerPiece;
      }
    } else if (field === 'selling_price_per_pack') {
      if (sellPricePack > 0 && itemsPerPack > 0) {
        updated.selling_price_per_piece = (sellPricePack / itemsPerPack).toFixed(2);
      }
    }
    onChange(updated);
  };

  const itemsPerPack = parseInt(values.items_per_pack, 10) || 1;
  const packsPerBatch = parseInt(values.packs_per_batch, 10) || 1;
  const totalPieces = parseInt(values.total_pieces_per_batch || (itemsPerPack * packsPerBatch), 10);
  const wtPerPiece = parseFloat(values.weight_per_piece_g) || 0;
  const netWeightPack = wtPerPiece > 0 ? (itemsPerPack * wtPerPiece) : (parseFloat(values.net_weight_per_pack_g) || 0);
  const batchTotalWeight = wtPerPiece > 0 ? (totalPieces * wtPerPiece) : (parseFloat(values.batch_output_weight) || 0);
  const pricePack = parseFloat(values.selling_price_per_pack) || 0;
  const pricePiece = itemsPerPack > 0 && pricePack > 0 ? (pricePack / itemsPerPack) : (parseFloat(values.selling_price_per_piece) || 0);
  const totalRevenue = packsPerBatch * pricePack;

  // Reverse calculation: entered target packs -> total items required & required batches
  const revPacksNum = parseFloat(reversePacks);
  const revTotalItems = revPacksNum > 0 ? (revPacksNum * itemsPerPack) : 0;
  const revBatches = (totalPieces > 0 && revTotalItems > 0) ? (revTotalItems / totalPieces).toFixed(2) : 0;

  return (
    <div style={{ backgroundColor: '#FDFBF7', border: '1px solid #E8DEC8', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '13px', fontWeight: 800, color: '#78350F', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Package size={16} color="#B45309" />
          Packaging &amp; Selling Configuration
        </label>
        <span style={{ fontSize: '11px', color: '#92400E', fontWeight: 600 }}>
          For cookies, nankhatai, snacks, cakes &amp; pastries
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {/* Selling Unit */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Selling Unit *
          </label>
          <select
            value={values.selling_unit || 'per_piece'}
            onChange={e => handleField('selling_unit', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
          >
            <option value="per_piece">Per Piece (Croissant, Puff)</option>
            <option value="per_pack">Per Pack (Biscuits, Nankhatai)</option>
            <option value="per_kg">Per Kilogram (Cakes, Loaves)</option>
            <option value="per_100g">Per 100 Grams</option>
            <option value="custom">Custom Unit</option>
          </select>
        </div>

        {/* Items per Pack */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Items per Pack
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={values.items_per_pack ?? 1}
            onChange={e => handleField('items_per_pack', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
          />
        </div>

        {/* Packs per Batch */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Packs per Batch
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={values.packs_per_batch ?? 1}
            onChange={e => handleField('packs_per_batch', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
          />
        </div>

        {/* Total Pieces per Batch (Auto) */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Total Pieces / Batch
          </label>
          <input
            type="number"
            readOnly
            value={totalPieces}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F3F4F6', fontSize: '12px', fontWeight: 700, color: '#374151', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {/* Weight per Piece (Optional) */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Weight per Piece (g)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 20"
            value={values.weight_per_piece_g ?? ''}
            onChange={e => handleField('weight_per_piece_g', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
          />
        </div>

        {/* Net Weight per Pack (Auto) */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Net Weight / Pack (g)
          </label>
          <input
            type="number"
            readOnly
            value={netWeightPack > 0 ? netWeightPack : ''}
            placeholder="Auto-calculated"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F3F4F6', fontSize: '12px', fontWeight: 700, color: '#374151', boxSizing: 'border-box' }}
          />
        </div>

        {/* Standard Batch Output Weight (g) */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Std Batch Output Weight (g)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={batchTotalWeight > 0 ? batchTotalWeight : (values.batch_output_weight || '')}
            onChange={e => handleField('batch_output_weight', e.target.value)}
            placeholder="e.g. 960"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', fontWeight: 700, color: '#B45309', boxSizing: 'border-box' }}
          />
        </div>

        {/* Packaging Cost per Pack */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Packaging Cost / Pack (₹)
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="e.g. 5.00"
            value={values.packaging_cost_per_pack ?? ''}
            onChange={e => handleField('packaging_cost_per_pack', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {/* Selling Price per Pack */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Selling Price / Pack (₹)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 150"
            value={values.selling_price_per_pack ?? ''}
            onChange={e => handleField('selling_price_per_pack', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', fontWeight: 700, color: '#059669', boxSizing: 'border-box' }}
          />
        </div>

        {/* Selling Price per Piece (Auto) */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Selling Price / Piece (₹)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Auto-calculated"
            value={pricePiece > 0 ? Number(pricePiece).toFixed(2) : ''}
            onChange={e => handleField('selling_price_per_piece', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F3F4F6', fontSize: '12px', fontWeight: 700, color: '#059669', boxSizing: 'border-box' }}
          />
        </div>

        {/* Expected Yield & Wastage */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Expected Yield %
          </label>
          <input
            type="number"
            min="10"
            max="100"
            value={values.expected_yield_percent ?? 100}
            onChange={e => handleField('expected_yield_percent', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#57534E', marginBottom: '4px' }}>
            Production Wastage %
          </label>
          <input
            type="number"
            min="0"
            max="90"
            value={values.production_wastage_percent ?? 0}
            onChange={e => handleField('production_wastage_percent', e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Dynamic Example & Calculations Banner */}
      <div style={{ backgroundColor: '#FEF3C7', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FDE68A', fontSize: '12px', color: '#92400E', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <span>
          📊 <strong>Batch Summary:</strong> {totalPieces} pieces ({itemsPerPack} / pack) = <strong>{packsPerBatch} packs</strong>
        </span>
        {netWeightPack > 0 && (
          <span>
            ⚖️ <strong>Pack Weight:</strong> {netWeightPack}g (Batch: {batchTotalWeight}g)
          </span>
        )}
        {pricePack > 0 && (
          <span>
            💰 <strong>Batch Revenue:</strong> ₹{totalRevenue} (@ ₹{pricePack}/pack · ₹{Number(pricePiece).toFixed(2)}/piece)
          </span>
        )}
      </div>

      {/* Reverse Batch Calculator Helper */}
      <div style={{ backgroundColor: '#F0FDF4', padding: '12px 14px', borderRadius: '8px', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calculator size={15} color="#166534" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
            Reverse Batch Calculator:
          </span>
          <span style={{ fontSize: '11px', color: '#15803D' }}>
            Desired Packs:
          </span>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 5"
            value={reversePacks}
            onChange={e => setReversePacks(e.target.value)}
            style={{ width: '70px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #86EFAC', fontSize: '12px', fontWeight: 700 }}
          />
        </div>

        {revPacksNum > 0 && (
          <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>
            Requires <strong>{revTotalItems} items</strong> ({revBatches} batches needed).
          </div>
        )}
      </div>
    </div>
  );
}

const OwnerProductsRecipesPage = () => {
  const [catalogError, setCatalogError] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [activeTab, setActiveTab] = useState('RECIPES'); // 'RECIPES' | 'PRODUCTS'

  // Calculator State
  const [calcMode, setCalcMode] = useState('WEIGHT'); // 'WEIGHT' | 'PACKS' | 'PIECES'
  const [targetWeightInput, setTargetWeightInput] = useState('1');
  const [targetWeightUnit, setTargetWeightUnit] = useState('kg'); // 'kg' | 'g'
  const [targetPacksInput, setTargetPacksInput] = useState('1');
  const [desiredProductionQty, setDesiredProductionQty] = useState('');
  const [targetMarginInput, setTargetMarginInput] = useState(30);

  const [recipeSearch, setRecipeSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [notification, setNotification] = useState('');
  const [bulkIds, setBulkIds] = useState([]);
  const [bulkField, setBulkField] = useState('labour_cost_per_min');
  const [bulkValue, setBulkValue] = useState('');

  // Add Product & Master Recipe Modal State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newProductForm, setNewProductForm] = useState({
    name: '',
    category_id: 1,
    base_price: '220',
    delivery_fee: '',
    shelf_life_days: 3,
    is_eggless: true,
    description: '',
    image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
    batch_yield_units: 12,
    yield_unit: 'pcs',
    prep_time_mins: 45,
    bake_time_mins: 25,
    oven_temp_c: 210,
    labour_cost_per_min: '2.50',
    power_cost_per_min: '1.20',
    packaging_cost_per_unit: '10.00',
    instructions: '',
    // Packaging & Selling Configuration
    selling_unit: 'per_piece',
    items_per_pack: 1,
    packs_per_batch: 12,
    total_pieces_per_batch: 12,
    weight_per_piece_g: '',
    net_weight_per_pack_g: '',
    packaging_cost_per_pack: '',
    selling_price_per_pack: '',
    selling_price_per_piece: '220',
    standard_batch_weight_g: '',
    batch_output_weight: '',
    batch_output_weight_unit: 'g',
    expected_yield_percent: 100,
    production_wastage_percent: 0,
    ingredients: [
      { raw_material_id: '', quantity: '', unit: 'kg' }
    ]
  });

  const [newRecipeForm, setNewRecipeForm] = useState({
    product_id: '',
    recipe_name: '',
    batch_yield_units: 12,
    yield_unit: 'pcs',
    prep_time_mins: 60,
    bake_time_mins: 25,
    oven_temp_c: 200,
    labour_cost_per_min: '2.50',
    power_cost_per_min: '1.20',
    packaging_cost_per_unit: '10.00',
    instructions: '',
    // Packaging & Selling Configuration
    selling_unit: 'per_piece',
    items_per_pack: 1,
    packs_per_batch: 12,
    total_pieces_per_batch: 12,
    weight_per_piece_g: '',
    net_weight_per_pack_g: '',
    packaging_cost_per_pack: '',
    selling_price_per_pack: '',
    selling_price_per_piece: '',
    standard_batch_weight_g: '',
    batch_output_weight: '',
    batch_output_weight_unit: 'g',
    expected_yield_percent: 100,
    production_wastage_percent: 0,
    ingredients: [
      { raw_material_id: '', quantity: '', unit: 'kg' }
    ]
  });

  // Owner Selling Price & Recipe Cost Factors Controls
  const [editingPrice, setEditingPrice] = useState('');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [showEditFactorsModal, setShowEditFactorsModal] = useState(false);
  const [factorsForm, setFactorsForm] = useState({
    recipe_name: '',
    batch_yield_units: 12,
    prep_time_mins: 45,
    bake_time_mins: 25,
    other_cost: 0,
    gst_rate: 0,
    delivery_fee: '',
    instructions: '',
    ingredients: [],
    selling_price: 280,
    labour_cost_per_min: 2.50,
    power_cost_per_min: 1.20,
    packaging_cost_per_unit: 10.00,
    // Packaging configuration
    selling_unit: 'per_piece',
    items_per_pack: 1,
    packs_per_batch: 12,
    total_pieces_per_batch: 12,
    weight_per_piece_g: '',
    net_weight_per_pack_g: '',
    packaging_cost_per_pack: '',
    selling_price_per_pack: '',
    selling_price_per_piece: '',
    standard_batch_weight_g: '',
    batch_output_weight: '',
    batch_output_weight_unit: 'g',
    expected_yield_percent: 100,
    production_wastage_percent: 0
  });

  // Inline editing product price & delivery fee in Tab 2
  const [editingProductId, setEditingProductId] = useState(null);
  const [tempProductPrice, setTempProductPrice] = useState('');
  const [tempProductDeliveryFee, setTempProductDeliveryFee] = useState('');

  const loadCatalog = async () => {
    try {
      setLoading(true);
      setCatalogError('');
      const [prodRes, recRes, ingRes, categoryRes] = await Promise.all([
        ownerService.getProducts(),
        ownerService.getRecipes(),
        ownerService.getInventory(),
        api.get('/categories')
      ]);

      const prodList = Array.isArray(prodRes?.data) ? prodRes.data : (Array.isArray(prodRes) ? prodRes : []);
      const recList = Array.isArray(recRes?.data) ? recRes.data : (Array.isArray(recRes) ? recRes : []);
      const matList = Array.isArray(ingRes?.data) ? ingRes.data : (Array.isArray(ingRes) ? ingRes : []);
      setCategories(Array.isArray(categoryRes?.data) ? categoryRes.data : (Array.isArray(categoryRes) ? categoryRes : []));
      setProducts(prodList);
      setRecipes(recList);
      setRawMaterials(matList);

      if (recList.length > 0) {
        if (!selectedRecipe) {
          setSelectedRecipe(recList[0]);
        } else {
          const match = recList.find(r => r.id === selectedRecipe.id);
          if (match) setSelectedRecipe(match);
        }
      }
    } catch (err) {
      setCatalogError(err.message || 'Could not load your catalog. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Handlers for Add Product Ingredient Rows
  const handleAddProductIngRow = () => {
    setNewProductForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { raw_material_id: '', quantity: '', unit: 'kg' }]
    }));
  };

  const handleRemoveProductIngRow = (idx) => {
    setNewProductForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx)
    }));
  };

  // Handlers for Add Recipe Modal
  const handleAddRecipeIngRow = () => {
    setNewRecipeForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { raw_material_id: '', quantity: '', unit: 'kg' }]
    }));
  };

  const handleRemoveRecipeIngRow = (idx) => {
    setNewRecipeForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx)
    }));
  };

  // Submit New Product & Master Recipe
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProductForm.name.trim() || !newProductForm.base_price) {
      alert('Please enter a product name and base price.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanedIngredients = newProductForm.ingredients
        .filter(ing => ing.raw_material_id && ing.quantity && parseFloat(ing.quantity) > 0)
        .map(ing => ({
          raw_material_id: parseInt(ing.raw_material_id, 10),
          quantity: parseFloat(ing.quantity),
          unit: ing.unit || 'kg'
        }));

      const payload = {
        name: newProductForm.name.trim(),
        category_id: parseInt(newProductForm.category_id, 10) || 1,
        base_price: parseFloat(newProductForm.base_price),
        delivery_fee: (newProductForm.delivery_fee !== '' && newProductForm.delivery_fee !== null && newProductForm.delivery_fee !== undefined)
          ? parseFloat(newProductForm.delivery_fee)
          : null,
        description: newProductForm.description.trim() || `Freshly crafted artisanal ${newProductForm.name.trim()} made with premium ingredients.`,
        image_url: newProductForm.image_url.trim() || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
        is_eggless: newProductForm.is_eggless ? 1 : 0,
        shelf_life_days: parseInt(newProductForm.shelf_life_days, 10) || 3,
        // Packaging configuration
        selling_unit: newProductForm.selling_unit || 'per_piece',
        items_per_pack: parseInt(newProductForm.items_per_pack, 10) || 1,
        packs_per_batch: parseInt(newProductForm.packs_per_batch, 10) || 1,
        total_pieces_per_batch: parseInt(newProductForm.total_pieces_per_batch, 10) || parseInt(newProductForm.batch_yield_units, 10) || 12,
        weight_per_piece_g: newProductForm.weight_per_piece_g ? parseFloat(newProductForm.weight_per_piece_g) : null,
        net_weight_per_pack_g: newProductForm.net_weight_per_pack_g ? parseFloat(newProductForm.net_weight_per_pack_g) : null,
        packaging_cost_per_pack: newProductForm.packaging_cost_per_pack ? parseFloat(newProductForm.packaging_cost_per_pack) : null,
        selling_price_per_pack: newProductForm.selling_price_per_pack ? parseFloat(newProductForm.selling_price_per_pack) : null,
        selling_price_per_piece: newProductForm.selling_price_per_piece ? parseFloat(newProductForm.selling_price_per_piece) : parseFloat(newProductForm.base_price),
        standard_batch_weight_g: newProductForm.batch_output_weight ? parseFloat(newProductForm.batch_output_weight) : null,
        recipe: {
          recipe_name: `${newProductForm.name.trim()} Master Formula`,
          batch_yield_units: parseInt(newProductForm.batch_yield_units, 10) || 12,
          yield_unit: newProductForm.yield_unit || 'pcs',
          prep_time_mins: parseInt(newProductForm.prep_time_mins, 10) || 45,
          bake_time_mins: parseInt(newProductForm.bake_time_mins, 10) || 25,
          oven_temp_c: parseInt(newProductForm.oven_temp_c, 10) || 210,
          labour_cost_per_min: parseFloat(newProductForm.labour_cost_per_min) || 2.50,
          power_cost_per_min: parseFloat(newProductForm.power_cost_per_min) || 1.20,
          packaging_cost_per_unit: parseFloat(newProductForm.packaging_cost_per_unit) || 10.00,
          instructions: newProductForm.instructions.trim() || 'Follow standard artisanal bakery procedure. Autolyse, mix, proof, shape, and bake with steam.',
          // Packaging configuration
          selling_unit: newProductForm.selling_unit || 'per_piece',
          items_per_pack: parseInt(newProductForm.items_per_pack, 10) || 1,
          packs_per_batch: parseInt(newProductForm.packs_per_batch, 10) || 1,
          total_pieces_per_batch: parseInt(newProductForm.total_pieces_per_batch, 10) || parseInt(newProductForm.batch_yield_units, 10) || 12,
          weight_per_piece_g: newProductForm.weight_per_piece_g ? parseFloat(newProductForm.weight_per_piece_g) : null,
          net_weight_per_pack_g: newProductForm.net_weight_per_pack_g ? parseFloat(newProductForm.net_weight_per_pack_g) : null,
          packaging_cost_per_pack: newProductForm.packaging_cost_per_pack ? parseFloat(newProductForm.packaging_cost_per_pack) : null,
          selling_price_per_pack: newProductForm.selling_price_per_pack ? parseFloat(newProductForm.selling_price_per_pack) : null,
          selling_price_per_piece: newProductForm.selling_price_per_piece ? parseFloat(newProductForm.selling_price_per_piece) : parseFloat(newProductForm.base_price),
          batch_output_weight: newProductForm.batch_output_weight ? parseFloat(newProductForm.batch_output_weight) : null,
          batch_output_weight_unit: newProductForm.batch_output_weight_unit || 'g',
          standard_unit_weight_grams: newProductForm.weight_per_piece_g ? parseFloat(newProductForm.weight_per_piece_g) : null,
          expected_yield_percent: parseFloat(newProductForm.expected_yield_percent) || 100,
          production_wastage_percent: parseFloat(newProductForm.production_wastage_percent) || 0,
          ingredients: cleanedIngredients
        }
      };

      await ownerService.createProductWithRecipe(payload);
      setNotification(`✓ "${payload.name}" and its Master Formula were created! It is now immediately available in Customer Storefront, Staff KDS Floor, and Owner Portal.`);
      setTimeout(() => setNotification(''), 5000);

      setShowAddProductModal(false);
      await loadCatalog();
    } catch (err) {
      alert(err.message || 'Failed to create product and formula.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Standalone Master Recipe
  const handleCreateRecipe = async (e) => {
    e.preventDefault();
    if (!newRecipeForm.product_id || !newRecipeForm.recipe_name.trim()) {
      alert('Please select a product and enter a formula name.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanedIngredients = newRecipeForm.ingredients
        .filter(ing => ing.raw_material_id && ing.quantity && parseFloat(ing.quantity) > 0)
        .map(ing => ({
          raw_material_id: parseInt(ing.raw_material_id, 10),
          quantity: parseFloat(ing.quantity),
          unit: ing.unit
        }));

      const payload = {
        product_id: parseInt(newRecipeForm.product_id, 10),
        recipe_name: newRecipeForm.recipe_name.trim(),
        batch_yield_units: parseInt(newRecipeForm.batch_yield_units, 10) || 12,
        yield_unit: newRecipeForm.yield_unit || 'pcs',
        prep_time_mins: parseInt(newRecipeForm.prep_time_mins, 10) || 60,
        bake_time_mins: parseInt(newRecipeForm.bake_time_mins, 10) || 25,
        oven_temp_c: parseInt(newRecipeForm.oven_temp_c, 10) || 200,
        labour_cost_per_min: Number(newRecipeForm.labour_cost_per_min),
        power_cost_per_min: Number(newRecipeForm.power_cost_per_min),
        packaging_cost_per_unit: Number(newRecipeForm.packaging_cost_per_unit),
        instructions: newRecipeForm.instructions.trim(),
        // Packaging configuration
        selling_unit: newRecipeForm.selling_unit || 'per_piece',
        items_per_pack: parseInt(newRecipeForm.items_per_pack, 10) || 1,
        packs_per_batch: parseInt(newRecipeForm.packs_per_batch, 10) || 1,
        total_pieces_per_batch: parseInt(newRecipeForm.total_pieces_per_batch, 10) || parseInt(newRecipeForm.batch_yield_units, 10) || 12,
        weight_per_piece_g: newRecipeForm.weight_per_piece_g ? parseFloat(newRecipeForm.weight_per_piece_g) : null,
        net_weight_per_pack_g: newRecipeForm.net_weight_per_pack_g ? parseFloat(newRecipeForm.net_weight_per_pack_g) : null,
        packaging_cost_per_pack: newRecipeForm.packaging_cost_per_pack ? parseFloat(newRecipeForm.packaging_cost_per_pack) : null,
        selling_price_per_pack: newRecipeForm.selling_price_per_pack ? parseFloat(newRecipeForm.selling_price_per_pack) : null,
        selling_price_per_piece: newRecipeForm.selling_price_per_piece ? parseFloat(newRecipeForm.selling_price_per_piece) : null,
        batch_output_weight: newRecipeForm.batch_output_weight ? parseFloat(newRecipeForm.batch_output_weight) : null,
        batch_output_weight_unit: newRecipeForm.batch_output_weight_unit || 'g',
        standard_unit_weight_grams: newRecipeForm.weight_per_piece_g ? parseFloat(newRecipeForm.weight_per_piece_g) : null,
        expected_yield_percent: parseFloat(newRecipeForm.expected_yield_percent) || 100,
        production_wastage_percent: parseFloat(newRecipeForm.production_wastage_percent) || 0,
        ingredients: cleanedIngredients
      };

      await api.post('/api/recipes', payload);
      setNotification(`✓ Master Formula "${payload.recipe_name}" created & published to kitchen floor!`);
      setTimeout(() => setNotification(''), 4000);

      setShowAddRecipeModal(false);
      await loadCatalog();
    } catch (err) {
      alert(err.message || 'Failed to save master recipe.');
    } finally {
      setSubmitting(false);
    }
  };

  const curRecipe = useMemo(() => selectedRecipe || recipes[0] || { ingredients: [], selling_price: 0, yield_quantity: 1 }, [selectedRecipe, recipes]);
  const curTitle = curRecipe.recipe_name || curRecipe.product_name || curRecipe.name || 'Master Formula';
  const standardYield = Math.max(1, parseInt(curRecipe.yield_quantity || curRecipe.batch_yield_units || curRecipe.yield_units, 10) || 4);
  const curYieldUnit = curRecipe.yield_unit || 'pcs';

  const prepMins = parseInt(curRecipe.prep_time_minutes ?? curRecipe.prep_time_mins ?? 0, 10);
  const bakeMins = parseInt(curRecipe.bake_time_minutes ?? curRecipe.bake_time_mins ?? 0, 10);
  const overheadRatePerBatch = Number(curRecipe.other_cost || 0);

  const rawIngredients = Array.isArray(curRecipe.ingredients) && curRecipe.ingredients.length > 0
    ? curRecipe.ingredients
    : [];

  const primaryFlourWeight = parseFloat(rawIngredients[0]?.quantity || rawIngredients[0]?.base_qty || 1);

  // Standard finished batch weight in grams
  const standardBatchWeightGrams = useMemo(() => {
    if (curRecipe.batch_output_weight) {
      const bw = parseFloat(curRecipe.batch_output_weight);
      const u = (curRecipe.batch_output_weight_unit || 'g').toLowerCase();
      return u === 'kg' ? bw * 1000 : bw;
    }
    if (curRecipe.standard_batch_weight_g) {
      return parseFloat(curRecipe.standard_batch_weight_g);
    }
    if (curRecipe.weight_per_piece_g && (curRecipe.total_pieces_per_batch || standardYield)) {
      return parseFloat(curRecipe.weight_per_piece_g) * parseFloat(curRecipe.total_pieces_per_batch || standardYield);
    }
    if (curRecipe.standard_unit_weight_grams) {
      return parseFloat(curRecipe.standard_unit_weight_grams) * standardYield;
    }
    if (curYieldUnit.toLowerCase() === 'kg') {
      return standardYield * 1000;
    }
    if (curYieldUnit.toLowerCase() === 'g') {
      return standardYield;
    }
    // Sum of measurable ingredients if available
    const rawSum = rawIngredients.reduce((acc, it) => {
      const q = parseFloat(it.quantity || it.base_qty || 0);
      const u = (it.unit || '').toLowerCase().trim();
      if (['g', 'gm', 'gram', 'grams', 'ml'].includes(u)) return acc + q;
      if (['kg', 'l', 'litre'].includes(u)) return acc + (q * 1000);
      return acc;
    }, 0);
    return rawSum > 0 ? rawSum : 1000;
  }, [curRecipe, standardYield, curYieldUnit, rawIngredients]);

  // Standard raw input measurable weight in grams
  const standardRawInputWeightGrams = useMemo(() => {
    return rawIngredients.reduce((acc, it) => {
      const q = parseFloat(it.quantity || it.base_qty || 0);
      const u = (it.unit || '').toLowerCase().trim();
      if (['g', 'gm', 'gram', 'grams', 'ml', 'milliliter', 'milliliters'].includes(u)) return acc + q;
      if (['kg', 'kgs', 'kilogram', 'l', 'liter', 'liters', 'litre', 'litres'].includes(u)) return acc + (q * 1000);
      return acc;
    }, 0);
  }, [rawIngredients]);

  // Target weight in grams based on calcMode
  const targetWeightGrams = useMemo(() => {
    if (calcMode === 'WEIGHT') {
      const entered = parseFloat(targetWeightInput);
      if (entered > 0) {
        return targetWeightUnit === 'kg' ? entered * 1000 : entered;
      }
      return standardBatchWeightGrams;
    }
    if (calcMode === 'PACKS') {
      const packs = parseFloat(targetPacksInput) > 0 ? parseFloat(targetPacksInput) : 1;
      const stdPacks = Math.max(1, parseFloat(curRecipe.packs_per_batch || 1));
      return (packs / stdPacks) * standardBatchWeightGrams;
    }
    // PIECES
    const pieces = parseFloat(desiredProductionQty) > 0 ? parseFloat(desiredProductionQty) : standardYield;
    return (pieces / standardYield) * standardBatchWeightGrams;
  }, [calcMode, targetWeightInput, targetWeightUnit, targetPacksInput, desiredProductionQty, standardBatchWeightGrams, standardYield, curRecipe]);

  // Formula: Scaling Factor = Required Finished Weight / Standard Finished Batch Weight
  const scalingFactor = useMemo(() => {
    if (calcMode === 'WEIGHT') {
      return standardBatchWeightGrams > 0 ? (targetWeightGrams / standardBatchWeightGrams) : 1;
    }
    if (calcMode === 'PACKS') {
      const stdPacks = Math.max(1, parseFloat(curRecipe.packs_per_batch || 1));
      const enteredPacks = parseFloat(targetPacksInput) > 0 ? parseFloat(targetPacksInput) : stdPacks;
      return enteredPacks / stdPacks;
    }
    // PIECES
    const enteredPieces = parseFloat(desiredProductionQty) > 0 ? parseFloat(desiredProductionQty) : standardYield;
    return standardYield > 0 ? enteredPieces / standardYield : 1;
  }, [calcMode, standardBatchWeightGrams, targetWeightGrams, curRecipe, targetPacksInput, desiredProductionQty, standardYield]);

  const actualProductionQty = useMemo(() => {
    return Math.max(0.1, standardYield * scalingFactor);
  }, [standardYield, scalingFactor]);

  const actualPacksProduced = useMemo(() => {
    const stdPacks = Math.max(1, parseFloat(curRecipe.packs_per_batch || 1));
    return stdPacks * scalingFactor;
  }, [curRecipe, scalingFactor]);

  // Batch weight & yield metrics
  const totalRawInputWeightGrams = standardRawInputWeightGrams * scalingFactor;
  const expectedYieldPercent = Number(curRecipe.expected_yield_percent ?? 100);
  const productionWastagePercent = Number(curRecipe.production_wastage_percent ?? Math.max(0, 100 - expectedYieldPercent));
  const expectedFinishedWeightGrams = targetWeightGrams;
  const wastageWeightGrams = Math.max(0, totalRawInputWeightGrams > 0 ? (totalRawInputWeightGrams - expectedFinishedWeightGrams) : (expectedFinishedWeightGrams * (productionWastagePercent / 100)));
  const yieldPercentage = totalRawInputWeightGrams > 0 ? Math.round((expectedFinishedWeightGrams / totalRawInputWeightGrams) * 1000) / 10 : expectedYieldPercent;
  const sellableWeightGrams = expectedFinishedWeightGrams;

  // Scaled ingredients table with live inventory availability check
  const ingredientsList = rawIngredients.map((it, idx) => {
    const name = it.name || it.ingredient_name || it.ingredient || `Material #${it.raw_material_id || idx + 1}`;
    const baseQty = parseFloat(it.quantity || it.base_qty || it.quantity_required || 0);
    // Scaled Ingredient Quantity = Original Ingredient Quantity × Scaling Factor
    const scaledQty = baseQty * scalingFactor;
    const recipeUnit = (it.unit || 'g').trim();

    // Match with raw materials inventory for stock and lot pricing
    const matchedMat = rawMaterials.find(m => m.id === Number(it.raw_material_id || it.id)) || {};
    const stockQty = parseFloat(matchedMat.current_stock ?? 0);
    const lotUnit = (it.raw_unit || matchedMat.unit || (recipeUnit.toLowerCase() === 'g' ? 'kg' : recipeUnit)).trim();
    const stockUnit = (matchedMat.unit || lotUnit || recipeUnit).trim();
    const lotPrice = parseFloat(
      matchedMat.lot_unit_cost !== undefined
        ? matchedMat.lot_unit_cost
        : (matchedMat.cost_per_unit !== undefined
            ? matchedMat.cost_per_unit
            : (it.unit_cost !== undefined ? it.unit_cost : 0))
    );

    // Convert recipe scaled quantity to lot units
    const rU = recipeUnit.toLowerCase();
    const lU = lotUnit.toLowerCase();
    let unitMultiplier = 1.0;
    if (rU === 'g' && lU === 'kg') unitMultiplier = 0.001;
    else if (rU === 'kg' && lU === 'g') unitMultiplier = 1000.0;
    else if (rU === 'ml' && (lU === 'l' || lU === 'litre' || lU === 'liter')) unitMultiplier = 0.001;
    else if ((rU === 'l' || rU === 'litre' || rU === 'liter') && lU === 'ml') unitMultiplier = 1000.0;

    const qtyInLotUnits = scaledQty * unitMultiplier;
    const lineCost = Math.round((it.cost != null ? Number(it.cost) * scalingFactor : qtyInLotUnits * lotPrice) * 100) / 100;

    // Convert recipe scaled quantity to stock units for inventory check
    const sU = stockUnit.toLowerCase();
    let stockMultiplier = 1.0;
    if (rU === 'g' && sU === 'kg') stockMultiplier = 0.001;
    else if (rU === 'kg' && sU === 'g') stockMultiplier = 1000.0;
    else if (rU === 'ml' && (sU === 'l' || sU === 'litre' || sU === 'liter')) stockMultiplier = 0.001;
    else if ((rU === 'l' || rU === 'litre' || rU === 'liter') && sU === 'ml') stockMultiplier = 1000.0;

    const requiredInStockUnits = scaledQty * stockMultiplier;
    let availabilityStatus = 'IN_STOCK';
    if (stockQty < requiredInStockUnits) {
      availabilityStatus = stockQty <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK';
    }

    const bakersPct = it.bakers_pct || (idx === 0 ? '100%' : `${Math.round((baseQty / (primaryFlourWeight || 1)) * 100)}%`);

    return {
      ingredient: name,
      raw_material_id: it.raw_material_id,
      bakers_pct: bakersPct,
      standard_qty: baseQty,
      scaled_qty: scaledQty,
      unit: recipeUnit,
      lot_unit: lotUnit,
      lot_unit_cost: lotPrice.toFixed(2),
      display_unit_cost: `₹${lotPrice.toFixed(2)} / ${lotUnit}`,
      line_cost: lineCost,
      stock_qty: stockQty,
      stock_unit: stockUnit,
      required_stock: requiredInStockUnits,
      availability_status: availabilityStatus
    };
  });

  const totalRawCost = Math.round(ingredientsList.reduce((sum, item) => sum + item.line_cost, 0) * 100) / 100;
  const laborCost = Math.round(Number(curRecipe.labour_cost || 0) * scalingFactor * 100) / 100;
  const powerCost = Math.round(Number(curRecipe.power_cost || 0) * scalingFactor * 100) / 100;

  // Packaging cost: handles pack-based vs unit-based
  const isPackBased = curRecipe.selling_unit === 'per_pack' || (curRecipe.packaging_cost_per_pack && Number(curRecipe.packaging_cost_per_pack) > 0);
  const packagingRatePerPack = parseFloat(curRecipe.packaging_cost_per_pack || 0);
  const packagingRatePerUnit = parseFloat(curRecipe.packaging_cost_per_unit || 0);
  const packagingCost = Math.round(
    (isPackBased && packagingRatePerPack > 0
      ? (actualPacksProduced * packagingRatePerPack)
      : (actualProductionQty * packagingRatePerUnit)) * 100
  ) / 100;

  const otherOverheadCost = Math.round((overheadRatePerBatch * scalingFactor) * 100) / 100;
  const totalProductionCost = Math.round((totalRawCost + laborCost + powerCost + packagingCost + otherOverheadCost) * 100) / 100;

  // Multi-level costs
  const costPerPiece = actualProductionQty > 0 ? Math.round((totalProductionCost / actualProductionQty) * 100) / 100 : 0;
  const costPerPack = actualPacksProduced > 0 ? Math.round((totalProductionCost / actualPacksProduced) * 100) / 100 : (costPerPiece * (curRecipe.items_per_pack || 1));
  const costPerKg = targetWeightGrams > 0 ? Math.round(((totalProductionCost / targetWeightGrams) * 1000) * 100) / 100 : 0;
  const costPer100g = Math.round((costPerKg / 10) * 100) / 100;
  const costPerUnit = costPerPiece;

  // Selling prices
  const curSellingPrice = Math.max(0, editingPrice === '' ? Number(curRecipe.selling_price ?? curRecipe.base_price ?? 0) : Number(editingPrice));
  const sellingPricePerPack = curRecipe.selling_price_per_pack ? Number(curRecipe.selling_price_per_pack) : (isPackBased ? curSellingPrice : (curSellingPrice * (curRecipe.items_per_pack || 1)));
  const sellingPricePerPiece = isPackBased && curRecipe.items_per_pack ? (sellingPricePerPack / curRecipe.items_per_pack) : curSellingPrice;

  // Revenue & Profit
  const totalRevenue = Math.round((isPackBased ? (sellingPricePerPack * actualPacksProduced) : (curSellingPrice * actualProductionQty)) * 100) / 100;
  const applicableSellingPrice = isPackBased ? sellingPricePerPack : curSellingPrice;
  const applicableCost = isPackBased ? costPerPack : costPerPiece;
  const profitPerUnit = Math.round((applicableSellingPrice - applicableCost) * 100) / 100;
  const totalBatchProfit = Math.round((totalRevenue - totalProductionCost) * 100) / 100;

  // Gross Margin % = (Gross Profit / Selling Revenue) * 100
  const grossMarginPct = applicableSellingPrice > 0 
    ? Math.round(((applicableSellingPrice - applicableCost) / applicableSellingPrice) * 1000) / 10 
    : 0;

  // Markup % = (Gross Profit / Applicable Cost) * 100
  const markupPct = applicableCost > 0 
    ? Math.round(((applicableSellingPrice - applicableCost) / applicableCost) * 1000) / 10 
    : 0;

  // Target Profit Margin Calculator
  const targetMarginNum = Math.min(99.9, Math.max(0, targetMarginInput === '' ? 30 : Number(targetMarginInput)));
  const recommendedSellingPrice = (100 - targetMarginNum) > 0 
    ? Math.round((applicableCost / (1 - (targetMarginNum / 100))) * 100) / 100 
    : applicableCost;
  const recommendedSellingPriceRounded = Math.ceil(recommendedSellingPrice);

  useEffect(() => {
    if (curRecipe.id) {
      const price = curRecipe.selling_price ?? curRecipe.base_price ?? 0;
      setEditingPrice(price);
      const stdYield = parseInt(curRecipe.yield_quantity || curRecipe.batch_yield_units || curRecipe.yield_units, 10) || 4;
      setDesiredProductionQty(stdYield);
      const matchedProd = products.find(p => Number(p.id) === Number(curRecipe.product_id));

      const sUnit = curRecipe.selling_unit || matchedProd?.selling_unit || 'per_piece';
      const itemsPack = curRecipe.items_per_pack || matchedProd?.items_per_pack || 1;
      const packsBatch = curRecipe.packs_per_batch || matchedProd?.packs_per_batch || (stdYield > 0 && itemsPack > 0 ? Math.max(1, Math.round(stdYield / itemsPack)) : 1);
      const totPieces = curRecipe.total_pieces_per_batch || matchedProd?.total_pieces_per_batch || stdYield;
      const wtPiece = curRecipe.weight_per_piece_g ?? matchedProd?.weight_per_piece_g ?? curRecipe.standard_unit_weight_grams ?? '';
      const netPack = curRecipe.net_weight_per_pack_g ?? matchedProd?.net_weight_per_pack_g ?? (wtPiece ? Number(wtPiece) * itemsPack : '');
      const packCost = curRecipe.packaging_cost_per_pack ?? matchedProd?.packaging_cost_per_pack ?? '';
      const sPricePack = curRecipe.selling_price_per_pack ?? matchedProd?.selling_price_per_pack ?? (sUnit === 'per_pack' ? price : (price * itemsPack));
      const sPricePiece = curRecipe.selling_price_per_piece ?? matchedProd?.selling_price_per_piece ?? (itemsPack > 0 ? (sPricePack / itemsPack) : price);
      const bOutputWeight = curRecipe.batch_output_weight ?? curRecipe.standard_batch_weight_g ?? matchedProd?.standard_batch_weight_g ?? (wtPiece ? Number(wtPiece) * totPieces : '');
      const bOutputWeightUnit = curRecipe.batch_output_weight_unit || 'g';

      setFactorsForm({
        recipe_name: curRecipe.recipe_name || curRecipe.product_name,
        batch_yield_units: stdYield,
        prep_time_mins: curRecipe.prep_time_mins ?? 0,
        bake_time_mins: curRecipe.bake_time_mins ?? 0,
        other_cost: curRecipe.other_cost ?? 0,
        gst_rate: curRecipe.gst_rate ?? 0,
        delivery_fee: (matchedProd?.delivery_fee !== null && matchedProd?.delivery_fee !== undefined) ? String(matchedProd.delivery_fee) : '',
        instructions: curRecipe.instructions || '',
        ingredients: (curRecipe.ingredients || []).map(i => ({ raw_material_id: i.raw_material_id, quantity: i.quantity, unit: i.unit })),
        selling_price: price,
        labour_cost_per_min: curRecipe.labour_cost_per_min !== undefined ? curRecipe.labour_cost_per_min : 2.50,
        power_cost_per_min: curRecipe.power_cost_per_min !== undefined ? curRecipe.power_cost_per_min : 1.20,
        packaging_cost_per_unit: curRecipe.packaging_cost_per_unit !== undefined ? curRecipe.packaging_cost_per_unit : 10.00,
        // Packaging configuration
        selling_unit: sUnit,
        items_per_pack: itemsPack,
        packs_per_batch: packsBatch,
        total_pieces_per_batch: totPieces,
        weight_per_piece_g: wtPiece,
        net_weight_per_pack_g: netPack,
        packaging_cost_per_pack: packCost,
        selling_price_per_pack: sPricePack,
        selling_price_per_piece: sPricePiece,
        standard_batch_weight_g: bOutputWeight,
        batch_output_weight: bOutputWeight,
        batch_output_weight_unit: bOutputWeightUnit,
        expected_yield_percent: curRecipe.expected_yield_percent ?? 100,
        production_wastage_percent: curRecipe.production_wastage_percent ?? 0
      });

      // Default target weight in calculator
      if (bOutputWeight) {
        const numWeight = parseFloat(bOutputWeight);
        if (numWeight >= 1000) {
          setTargetWeightInput(String(numWeight / 1000));
          setTargetWeightUnit('kg');
        } else {
          setTargetWeightInput(String(numWeight));
          setTargetWeightUnit('g');
        }
      } else {
        setTargetWeightInput('1');
        setTargetWeightUnit('kg');
      }
      setTargetPacksInput(String(packsBatch));
    }
  }, [curRecipe, products]);

  const handleApplyRecommendedPrice = () => {
    setEditingPrice(recommendedSellingPriceRounded);
    setNotification(`Applied recommended selling price ₹${recommendedSellingPriceRounded} (target ${targetMarginNum}% margin). Click "Save price" to commit.`);
    setTimeout(() => setNotification(''), 4000);
  };

  const handleDeleteRecipe = async (recipeId) => {
    if (!window.confirm(`Are you sure you want to delete the recipe for "${curTitle}"?`)) return;
    try {
      await ownerService.deleteRecipe(recipeId);
      setNotification(`✓ Recipe deleted successfully.`);
      setTimeout(() => setNotification(''), 4000);
      setSelectedRecipe(null);
      await loadCatalog();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete recipe');
    }
  };

  const handleDeleteProduct = async (productId) => {
    const prod = products.find(p => p.id === productId);
    if (!window.confirm(`Are you sure you want to archive "${prod?.name || 'this product'}"?`)) return;
    try {
      await ownerService.deleteProduct(productId);
      setNotification(`✓ Product archived.`);
      setTimeout(() => setNotification(''), 4000);
      await loadCatalog();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to archive product');
    }
  };

  const handleQuickSavePrice = async () => {
    const priceVal = parseFloat(editingPrice);
    if (!priceVal || priceVal <= 0) {
      alert('Please enter a valid selling price.');
      return;
    }
    setIsUpdatingPrice(true);
    try {
      await ownerService.updateRecipe(curRecipe.id, {
        selling_price: priceVal,
        selling_price_per_pack: isPackBased ? priceVal : (priceVal * (curRecipe.items_per_pack || 1)),
        selling_price_per_piece: isPackBased && curRecipe.items_per_pack ? (priceVal / curRecipe.items_per_pack) : priceVal
      });
      if (curRecipe.product_id) {
        await ownerService.updateProduct(curRecipe.product_id, {
          base_price: priceVal,
          selling_price_per_pack: isPackBased ? priceVal : (priceVal * (curRecipe.items_per_pack || 1)),
          selling_price_per_piece: isPackBased && curRecipe.items_per_pack ? (priceVal / curRecipe.items_per_pack) : priceVal
        });
      }
      setNotification(`✓ Selling price ₹${priceVal} saved!`);
      setTimeout(() => setNotification(''), 4000);
      await loadCatalog();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update price');
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const handleSaveRecipeFactors = async (e) => {
    e.preventDefault();
    setIsUpdatingPrice(true);
    try {
      const payload = {
        ...factorsForm,
        selling_price: parseFloat(factorsForm.selling_price) || parseFloat(editingPrice) || curSellingPrice,
        labour_cost_per_min: parseFloat(factorsForm.labour_cost_per_min),
        power_cost_per_min: parseFloat(factorsForm.power_cost_per_min),
        packaging_cost_per_unit: parseFloat(factorsForm.packaging_cost_per_unit),
        packaging_cost_per_pack: factorsForm.packaging_cost_per_pack ? parseFloat(factorsForm.packaging_cost_per_pack) : null,
        selling_price_per_pack: factorsForm.selling_price_per_pack ? parseFloat(factorsForm.selling_price_per_pack) : null,
        selling_price_per_piece: factorsForm.selling_price_per_piece ? parseFloat(factorsForm.selling_price_per_piece) : null,
        batch_output_weight: factorsForm.batch_output_weight ? parseFloat(factorsForm.batch_output_weight) : null,
        standard_batch_weight_g: factorsForm.batch_output_weight ? parseFloat(factorsForm.batch_output_weight) : null,
        weight_per_piece_g: factorsForm.weight_per_piece_g ? parseFloat(factorsForm.weight_per_piece_g) : null,
        net_weight_per_pack_g: factorsForm.net_weight_per_pack_g ? parseFloat(factorsForm.net_weight_per_pack_g) : null,
        items_per_pack: parseInt(factorsForm.items_per_pack, 10) || 1,
        packs_per_batch: parseInt(factorsForm.packs_per_batch, 10) || 1,
        total_pieces_per_batch: parseInt(factorsForm.total_pieces_per_batch, 10) || parseInt(factorsForm.batch_yield_units, 10) || 12,
        expected_yield_percent: parseFloat(factorsForm.expected_yield_percent) || 100,
        production_wastage_percent: parseFloat(factorsForm.production_wastage_percent) || 0
      };
      await ownerService.updateRecipe(curRecipe.id, payload);

      if (curRecipe.product_id) {
        const delFeeVal = (factorsForm.delivery_fee !== '' && factorsForm.delivery_fee !== null && factorsForm.delivery_fee !== undefined)
          ? parseFloat(factorsForm.delivery_fee)
          : null;
        await ownerService.updateProduct(curRecipe.product_id, {
          delivery_fee: delFeeVal,
          base_price: payload.selling_price,
          selling_unit: payload.selling_unit,
          items_per_pack: payload.items_per_pack,
          packs_per_batch: payload.packs_per_batch,
          total_pieces_per_batch: payload.total_pieces_per_batch,
          weight_per_piece_g: payload.weight_per_piece_g,
          net_weight_per_pack_g: payload.net_weight_per_pack_g,
          packaging_cost_per_pack: payload.packaging_cost_per_pack,
          selling_price_per_pack: payload.selling_price_per_pack,
          selling_price_per_piece: payload.selling_price_per_piece,
          standard_batch_weight_g: payload.standard_batch_weight_g
        });
      }

      setNotification(`✓ Formula, packaging specs, & pricing updated for "${curTitle}"!`);
      setTimeout(() => setNotification(''), 4000);
      setShowEditFactorsModal(false);
      await loadCatalog();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update recipe');
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const handleSaveProductPrice = async (productId) => {
    const priceVal = parseFloat(tempProductPrice);
    if (!priceVal || priceVal <= 0) {
      alert('Please enter a valid price.');
      return;
    }
    const delFeeVal = (tempProductDeliveryFee !== '' && tempProductDeliveryFee !== null && tempProductDeliveryFee !== undefined)
      ? parseFloat(tempProductDeliveryFee)
      : null;
    try {
      await ownerService.updateProduct(productId, { base_price: priceVal, delivery_fee: delFeeVal });
      setNotification(`✓ Product selling price and delivery fee updated!`);
      setTimeout(() => setNotification(''), 4000);
      setEditingProductId(null);
      await loadCatalog();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update price');
    }
  };

  // Filtered recipe list
  const filteredRecipes = recipes.filter(r => {
    const t = (r.recipe_name || r.product_name || r.name || '').toLowerCase();
    const c = (r.category || '').toLowerCase();
    const q = recipeSearch.toLowerCase();
    return !q || t.includes(q) || c.includes(q);
  });

  // Filtered product catalog
  const filteredProducts = products.filter(p => {
    const n = (p.name || '').toLowerCase();
    const c = (p.category_name || p.category || '').toLowerCase();
    const q = productSearch.toLowerCase();
    return !q || n.includes(q) || c.includes(q);
  });

  if (loading) return <p role="status">Loading stored products and recipes...</p>;

  return (
    <div className="owner-workspace oc-page">
      <OwnerCatalogWorkspace model={{
        products,
        recipes,
        categories,
        curRecipe,
        curTitle,
        standardYield,
        curYieldUnit,
        prepMins,
        bakeMins,
        // Weight-based calculator props
        calcMode,
        setCalcMode,
        targetWeightInput,
        setTargetWeightInput,
        targetWeightUnit,
        setTargetWeightUnit,
        targetPacksInput,
        setTargetPacksInput,
        desiredProductionQty,
        setDesiredProductionQty,
        standardBatchWeightGrams,
        targetWeightGrams,
        scalingFactor,
        actualProductionQty,
        actualPacksProduced,
        totalRawInputWeightGrams,
        wastageWeightGrams,
        yieldPercentage,
        sellableWeightGrams,
        ingredientsList,
        // Economics & Multi-level costing
        totalRawCost,
        laborCost,
        powerCost,
        packagingCost,
        otherOverheadCost,
        totalProductionCost,
        costPerUnit,
        costPerPiece,
        costPerPack,
        costPer100g,
        costPerKg,
        isPackBased,
        curSellingPrice,
        sellingPricePerPack,
        sellingPricePerPiece,
        totalRevenue,
        profitPerUnit,
        totalBatchProfit,
        grossMarginPct,
        markupPct,
        targetMarginInput,
        setTargetMarginInput,
        recommendedSellingPriceRounded,
        editingPrice,
        setEditingPrice,
        isUpdatingPrice,
        handleQuickSavePrice,
        handleApplyRecommendedPrice,
        notification,
        catalogError,
        activeTab,
        setActiveTab,
        recipeSearch,
        setRecipeSearch,
        filteredRecipes,
        productSearch,
        setProductSearch,
        filteredProducts,
        setSelectedRecipe,
        setShowAddProductModal,
        setShowAddRecipeModal,
        setShowEditFactorsModal,
        handleDeleteRecipe,
        handleDeleteProduct,
        editingProductId,
        setEditingProductId,
        tempProductPrice,
        setTempProductPrice,
        tempProductDeliveryFee,
        setTempProductDeliveryFee,
        handleSaveProductPrice,
        setNewRecipeForm,
        bulkIds,
        setBulkIds,
        bulkField,
        setBulkField,
        bulkValue,
        setBulkValue,
        submitting,
        activateRecipe: async () => {
          try {
            await ownerService.updateRecipe(curRecipe.id, { make_active: true });
            await loadCatalog();
            setNotification('Production formula updated.');
          } catch (error) {
            setCatalogError(error.message);
          }
        },
        applyBulk: async () => {
          if (!window.confirm(`Update ${bulkField} to ${bulkValue} for ${bulkIds.length} selected recipes?`)) return;
          setSubmitting(true);
          try {
            await api.post('/recipes/bulk', { ids: bulkIds.map(Number), changes: { [bulkField]: Number(bulkValue) } });
            await loadCatalog();
            setNotification('Selected recipes updated.');
          } catch (error) {
            setCatalogError(error.message);
          } finally {
            setSubmitting(false);
          }
        }
      }} />

      {/* ========================================================== */}
      {/* MODAL 1: ADD NEW PRODUCT & AUTOMATIC MASTER RECIPE BUILDER */}
      {/* ========================================================== */}
      {showAddProductModal && (
        <Dialog wide title="New product &amp; recipe" description="Build a menu item with its master formula, packaging specs, and production rates." onClose={() => setShowAddProductModal(false)}>
          <form className="oc-editor-form" onSubmit={handleCreateProduct} style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Basic Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artisanal Nankhatai Biscuits"
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                  Category *
                </label>
                <select
                  value={newProductForm.category_id}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, category_id: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                  Base Selling Price (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="150"
                  value={newProductForm.base_price}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, base_price: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', fontWeight: 700, color: '#059669', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                  Delivery Fee (₹) <span style={{ fontWeight: 400, color: '#78716C', fontSize: '11px' }}>(Optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="50 (std)"
                  value={newProductForm.delivery_fee}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, delivery_fee: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Description & Dietary */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Traditional melt-in-mouth spiced cardamom shortbread baked with pure ghee."
                  value={newProductForm.description}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#15803D' }}>
                  <input
                    type="checkbox"
                    checked={newProductForm.is_eggless}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, is_eggless: e.target.checked }))}
                  />
                  <span>Eggless (Pure Veg)</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#78716C' }}>Shelf:</span>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={newProductForm.shelf_life_days}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, shelf_life_days: e.target.value }))}
                    style={{ width: '50px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '12px' }}
                  />
                  <span style={{ fontSize: '11px', color: '#78716C' }}>days</span>
                </div>
              </div>
            </div>

            {/* Image selection */}
            <div style={{ backgroundColor: '#FAF9F6', padding: '14px', borderRadius: '12px', border: '1px solid #E7E5E4' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <img
                  src={newProductForm.image_url}
                  alt="Preview"
                  style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '2px solid #C25E00' }}
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600'; }}
                />
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Image URL..."
                    value={newProductForm.image_url}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, image_url: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {PRESET_BAKERY_IMAGES.slice(0, 5).map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setNewProductForm(prev => ({ ...prev, image_url: preset.url }))}
                        style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid #D6D3D1', fontSize: '10px', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* PACKAGING & SELLING CONFIGURATION */}
            <PackagingConfigFields
              values={newProductForm}
              onChange={updated => setNewProductForm(prev => ({ ...prev, ...updated }))}
            />

            {/* MASTER RECIPE INGREDIENTS */}
            <div style={{ backgroundColor: '#FAF9F6', padding: '16px', borderRadius: '12px', border: '1px solid #E7E5E4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#1C1917', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ChefHat size={15} color="#C25E00" />
                    Ingredients &amp; Quantities per Standard Batch
                  </label>
                  <span style={{ fontSize: '11px', color: '#78716C' }}>Linked to live pantry stock</span>
                </div>

                <button
                  type="button"
                  onClick={handleAddProductIngRow}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #C25E00', backgroundColor: '#FFFFFF', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#C25E00', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={14} /> Add Ingredient
                </button>
              </div>

              {/* Yield & Oven Parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78716C', marginBottom: '4px' }}>
                    Batch Yield Units
                  </label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="number"
                      min="1"
                      value={newProductForm.batch_yield_units}
                      onChange={(e) => setNewProductForm(prev => ({ ...prev, batch_yield_units: e.target.value }))}
                      style={{ width: '60%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '12px' }}
                    />
                    <input
                      type="text"
                      value={newProductForm.yield_unit}
                      onChange={(e) => setNewProductForm(prev => ({ ...prev, yield_unit: e.target.value }))}
                      style={{ width: '40%', padding: '6px 6px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '12px', fontWeight: 600 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78716C', marginBottom: '4px' }}>
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProductForm.prep_time_mins}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, prep_time_mins: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78716C', marginBottom: '4px' }}>
                    Bake Time (min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProductForm.bake_time_mins}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, bake_time_mins: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78716C', marginBottom: '4px' }}>
                    Oven Temp (°C)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="350"
                    value={newProductForm.oven_temp_c}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, oven_temp_c: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Costing Factors: Labour, Power & Packaging */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px', backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E7E5E4' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Labour Rate (₹ / min)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newProductForm.labour_cost_per_min}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, labour_cost_per_min: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Power Rate (₹ / min)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newProductForm.power_cost_per_min}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, power_cost_per_min: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Packaging Cost (₹ / unit)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={newProductForm.packaging_cost_per_unit}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, packaging_cost_per_unit: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Ingredient Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {newProductForm.ingredients.map((ing, idx) => {
                  const selMat = rawMaterials.find(m => m.id === parseInt(ing.raw_material_id, 10));
                  const estCost = selMat && ing.quantity ? (parseFloat(ing.quantity) * parseFloat(selMat.cost_per_unit || 50)).toFixed(1) : 0;

                  return (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select
                        value={ing.raw_material_id}
                        onChange={(e) => {
                          const val = e.target.value;
                          const m = rawMaterials.find(item => item.id === parseInt(val, 10));
                          setNewProductForm(prev => ({
                            ...prev,
                            ingredients: prev.ingredients.map((it, i) =>
                              i === idx ? { ...it, raw_material_id: val, unit: m ? m.unit : it.unit } : it
                            )
                          }));
                        }}
                        style={{ flex: 2, padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                      >
                        <option value="">-- Choose Raw Material --</option>
                        {rawMaterials.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} (Stock: {m.current_stock} {m.unit} • ₹{m.cost_per_unit || 50}/{m.unit})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="any"
                        placeholder="Quantity"
                        value={ing.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewProductForm(prev => ({
                            ...prev,
                            ingredients: prev.ingredients.map((it, i) =>
                              i === idx ? { ...it, quantity: val } : it
                            )
                          }));
                        }}
                        style={{ width: '90px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px' }}
                      />

                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#C25E00', minWidth: '35px' }}>
                        {ing.unit || selMat?.unit || 'kg'}
                      </span>

                      <span style={{ fontSize: '11px', color: '#78716C', minWidth: '70px', textAlign: 'right' }}>
                        ₹{estCost}
                      </span>

                      {newProductForm.ingredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveProductIngRow(idx)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Instructions */}
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78716C', marginBottom: '4px' }}>
                  Baking Procedure Instructions
                </label>
                <textarea
                  rows="2"
                  value={newProductForm.instructions}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, instructions: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #D6D3D1', backgroundColor: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#44403C' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#C25E00', color: '#FFFFFF', fontSize: '13px', fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, boxShadow: '0 4px 12px rgba(194, 94, 0, 0.3)' }}
              >
                {submitting ? 'Publishing Product & Formula...' : 'Publish Product & Auto-Add Recipe'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ========================================================== */}
      {/* MODAL 2: ADD MASTER RECIPE ONLY */}
      {/* ========================================================== */}
      {showAddRecipeModal && (
        <Dialog wide title="Add a master recipe" description="Connect ingredients, packaging configuration, and production rates to an existing product." onClose={() => setShowAddRecipeModal(false)}>
          <form className="oc-editor-form" onSubmit={handleCreateRecipe} style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                  Select Menu Product *
                </label>
                <select
                  value={newRecipeForm.product_id}
                  onChange={(e) => {
                    const selProd = products.find(p => p.id === parseInt(e.target.value, 10));
                    setNewRecipeForm(prev => ({
                      ...prev,
                      product_id: e.target.value,
                      recipe_name: selProd ? `${selProd.name} Standard Formula` : prev.recipe_name,
                      selling_unit: selProd?.selling_unit || prev.selling_unit,
                      items_per_pack: selProd?.items_per_pack || prev.items_per_pack,
                      packs_per_batch: selProd?.packs_per_batch || prev.packs_per_batch,
                      total_pieces_per_batch: selProd?.total_pieces_per_batch || prev.total_pieces_per_batch,
                      weight_per_piece_g: selProd?.weight_per_piece_g || prev.weight_per_piece_g,
                      net_weight_per_pack_g: selProd?.net_weight_per_pack_g || prev.net_weight_per_pack_g,
                      packaging_cost_per_pack: selProd?.packaging_cost_per_pack || prev.packaging_cost_per_pack,
                      selling_price_per_pack: selProd?.selling_price_per_pack || prev.selling_price_per_pack,
                      selling_price_per_piece: selProd?.selling_price_per_piece || selProd?.base_price || prev.selling_price_per_piece,
                      batch_output_weight: selProd?.standard_batch_weight_g || prev.batch_output_weight
                    }));
                  }}
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px' }}
                >
                  <option value="">-- Choose Menu Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (₹{p.price || p.base_price})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                  Formula Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artisanal Sourdough Master"
                  value={newRecipeForm.recipe_name}
                  onChange={(e) => setNewRecipeForm(prev => ({ ...prev, recipe_name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Yield & Baking Parameters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78716C', marginBottom: '4px' }}>Yield</label>
                <input
                  type="number"
                  min="1"
                  value={newRecipeForm.batch_yield_units}
                  onChange={(e) => setNewRecipeForm(prev => ({ ...prev, batch_yield_units: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78716C', marginBottom: '4px' }}>Prep Time (min)</label>
                <input
                  type="number"
                  min="0"
                  value={newRecipeForm.prep_time_mins}
                  onChange={(e) => setNewRecipeForm(prev => ({ ...prev, prep_time_mins: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78716C', marginBottom: '4px' }}>Bake Time (min)</label>
                <input
                  type="number"
                  min="0"
                  value={newRecipeForm.bake_time_mins}
                  onChange={(e) => setNewRecipeForm(prev => ({ ...prev, bake_time_mins: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78716C', marginBottom: '4px' }}>Oven Temp (°C)</label>
                <input
                  type="number"
                  min="50"
                  max="350"
                  value={newRecipeForm.oven_temp_c}
                  onChange={(e) => setNewRecipeForm(prev => ({ ...prev, oven_temp_c: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* PACKAGING & SELLING CONFIGURATION */}
            <PackagingConfigFields
              values={newRecipeForm}
              onChange={updated => setNewRecipeForm(prev => ({ ...prev, ...updated }))}
            />

            {/* Costing Factors */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', backgroundColor: '#FAF9F6', padding: '12px', borderRadius: '8px', border: '1px solid #E7E5E4' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Labour Rate (₹ / min)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={newRecipeForm.labour_cost_per_min}
                  onChange={(e) => setNewRecipeForm(prev => ({ ...prev, labour_cost_per_min: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Power Rate (₹ / min)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={newRecipeForm.power_cost_per_min}
                  onChange={(e) => setNewRecipeForm(prev => ({ ...prev, power_cost_per_min: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Packaging Cost (₹ / unit)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={newRecipeForm.packaging_cost_per_unit}
                  onChange={(e) => setNewRecipeForm(prev => ({ ...prev, packaging_cost_per_unit: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Dynamic Recipe Ingredients List */}
            <div style={{ backgroundColor: '#FAF9F6', padding: '16px', borderRadius: '12px', border: '1px solid #E7E5E4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#1C1917', textTransform: 'uppercase' }}>
                  Ingredients &amp; Quantities per Batch
                </label>
                <button
                  type="button"
                  onClick={handleAddRecipeIngRow}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #D6D3D1', backgroundColor: '#FFFFFF', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#C25E00' }}
                >
                  + Add Ingredient
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {newRecipeForm.ingredients.map((ing, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select
                      value={ing.raw_material_id}
                      onChange={(e) => {
                        const val = e.target.value;
                        const mat = rawMaterials.find(m => m.id === parseInt(val, 10));
                        setNewRecipeForm(prev => ({
                          ...prev,
                          ingredients: prev.ingredients.map((item, i) =>
                            i === idx ? { ...item, raw_material_id: val, unit: mat ? mat.unit : item.unit } : item
                          )
                        }));
                      }}
                      style={{ flex: 2, padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                    >
                      <option value="">-- Choose Raw Ingredient --</option>
                      {rawMaterials.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Stock: {m.current_stock} {m.unit})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="any"
                      placeholder="Quantity"
                      value={ing.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewRecipeForm(prev => ({
                          ...prev,
                          ingredients: prev.ingredients.map((item, i) =>
                            i === idx ? { ...item, quantity: val } : item
                          )
                        }));
                      }}
                      style={{ width: '100px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px' }}
                    />

                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#C25E00', minWidth: '35px' }}>
                      {ing.unit || 'kg'}
                    </span>

                    {newRecipeForm.ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipeIngRow(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '4px' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                Baking Method &amp; Instructions
              </label>
              <textarea
                rows="3"
                placeholder="e.g. Autolyse 45m. Bulk fermentation 4h with 3 stretch-and-folds. Retard overnight at 4°C. Bake with heavy steam at 235°C for 25m."
                value={newRecipeForm.instructions}
                onChange={(e) => setNewRecipeForm(prev => ({ ...prev, instructions: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowAddRecipeModal(false)}
                style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #D6D3D1', backgroundColor: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#C25E00', color: '#FFFFFF', fontSize: '13px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
              >
                {submitting ? 'Saving Formula...' : 'Save & Publish Formula'}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {/* ========================================================== */}
      {/* MODAL 3: EDIT COST FACTORS, PACKAGING & SELLING PRICE */}
      {/* ========================================================== */}
      {showEditFactorsModal && (
        <Dialog wide title="Edit recipe, packaging &amp; pricing" description="Update master formula, packaging dimensions, production rates, and profit margins." onClose={() => setShowEditFactorsModal(false)}>
          <form className="oc-editor-form" onSubmit={handleSaveRecipeFactors} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '80vh', overflowY: 'auto', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'grid', gap: 4 }}>
                Formula Name
                <input required type="text" value={factorsForm.recipe_name ?? ''} onChange={e => setFactorsForm({ ...factorsForm, recipe_name: e.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                Batch Yield Items
                <input required type="number" min="1" step="1" value={factorsForm.batch_yield_units ?? ''} onChange={e => setFactorsForm({ ...factorsForm, batch_yield_units: e.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                Prep Time (min)
                <input required type="number" min="0" value={factorsForm.prep_time_mins ?? ''} onChange={e => setFactorsForm({ ...factorsForm, prep_time_mins: e.target.value })} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                Bake Time (min)
                <input required type="number" min="0" value={factorsForm.bake_time_mins ?? ''} onChange={e => setFactorsForm({ ...factorsForm, bake_time_mins: e.target.value })} />
              </label>
            </div>

            {/* Packaging & Selling Configuration Section */}
            <PackagingConfigFields
              values={factorsForm}
              onChange={updated => setFactorsForm(prev => ({ ...prev, ...updated }))}
            />

            {/* Ingredients Per Batch */}
            <fieldset>
              <legend>Ingredients per batch</legend>
              {(factorsForm.ingredients || []).map((item, index) => (
                <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                  <select
                    aria-label="Ingredient"
                    required
                    value={item.raw_material_id}
                    onChange={e => setFactorsForm({
                      ...factorsForm,
                      ingredients: factorsForm.ingredients.map((row, i) => i === index ? { ...row, raw_material_id: Number(e.target.value) } : row)
                    })}
                    style={{ flex: 2 }}
                  >
                    <option value="">Choose ingredient</option>
                    {rawMaterials.map(m => (
                      <option key={m.id} value={m.id}>{m.name} (Stock: {m.current_stock} {m.unit})</option>
                    ))}
                  </select>
                  <input
                    aria-label="Ingredient quantity"
                    required
                    type="number"
                    min="0.000001"
                    step="any"
                    style={{ width: 100 }}
                    value={item.quantity}
                    onChange={e => setFactorsForm({
                      ...factorsForm,
                      ingredients: factorsForm.ingredients.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row)
                    })}
                  />
                  <select
                    aria-label="Ingredient unit"
                    value={item.unit}
                    onChange={e => setFactorsForm({
                      ...factorsForm,
                      ingredients: factorsForm.ingredients.map((row, i) => i === index ? { ...row, unit: e.target.value } : row)
                    })}
                  >
                    {['g', 'kg', 'ml', 'L', 'pcs'].map(unit => (
                      <option key={unit}>{unit}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setFactorsForm({ ...factorsForm, ingredients: factorsForm.ingredients.filter((_, i) => i !== index) })}>
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setFactorsForm({ ...factorsForm, ingredients: [...(factorsForm.ingredients || []), { raw_material_id: '', quantity: '', unit: 'kg' }] })}
              >
                + Add ingredient
              </button>
            </fieldset>

            <label>
              Instructions
              <textarea value={factorsForm.instructions || ''} onChange={e => setFactorsForm({ ...factorsForm, instructions: e.target.value })} />
            </label>

            {/* Pricing & Cost Rates */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Selling Price (₹ per unit) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={factorsForm.selling_price}
                  onChange={(e) => setFactorsForm({ ...factorsForm, selling_price: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '15px', fontWeight: 700, color: '#059669', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Delivery Fee (₹) <span style={{ fontWeight: 400, color: '#78716C', fontSize: '11px' }}>(Optional)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Standard (₹50)"
                  value={factorsForm.delivery_fee ?? ''}
                  onChange={(e) => setFactorsForm({ ...factorsForm, delivery_fee: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Labour Cost (₹ / min) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  value={factorsForm.labour_cost_per_min}
                  onChange={(e) => setFactorsForm({ ...factorsForm, labour_cost_per_min: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Power Cost (₹ / min) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  required
                  value={factorsForm.power_cost_per_min}
                  onChange={(e) => setFactorsForm({ ...factorsForm, power_cost_per_min: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Packaging Cost (₹ / item) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={factorsForm.packaging_cost_per_unit}
                  onChange={(e) => setFactorsForm({ ...factorsForm, packaging_cost_per_unit: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  GST (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={factorsForm.gst_rate ?? 0}
                  onChange={(e) => setFactorsForm({ ...factorsForm, gst_rate: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ backgroundColor: '#F0FDF4', padding: '12px', borderRadius: '8px', border: '1px solid #BBF7D0', fontSize: '12px', color: '#166534' }}>
              💡 Margin % will recalculate dynamically: <strong>Gross Margin % = ((Selling Price - Unit Cost) / Selling Price) × 100</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setShowEditFactorsModal(false)}
                style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #D6D3D1', backgroundColor: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingPrice}
                style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#C25E00', color: '#FFFFFF', fontSize: '13px', fontWeight: 700, cursor: isUpdatingPrice ? 'not-allowed' : 'pointer' }}
              >
                {isUpdatingPrice ? 'Saving Rates...' : 'Save & Recalculate'}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};

export default OwnerProductsRecipesPage;
