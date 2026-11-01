import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Scale,
  Flame,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  ChefHat,
  Sparkles,
  Layers,
  Thermometer,
  RotateCcw,
  CheckSquare,
  Square,
  X,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';
import api from '../../services/api';

// Professional Kitchen Conversion Helper (Strict grams and milliliters)
export const formatKitchenMeasurement = (rawQty, rawUnit) => {
  const unit = (rawUnit || '').toLowerCase().trim();
  const qty = parseFloat(rawQty) || 0;

  // Solid conversions to grams (g)
  if (unit === 'kg' || unit === 'kgs' || unit === 'kilogram' || unit === 'kilograms') {
    const g = Math.round(qty * 1000);
    return {
      main: `${g.toLocaleString()} g`,
      sub: qty >= 1 ? `(${qty.toFixed(2)} kg)` : null,
      unitType: 'mass'
    };
  }
  if (unit === 'g' || unit === 'gm' || unit === 'gram' || unit === 'grams') {
    const g = Math.round(qty);
    return {
      main: `${g.toLocaleString()} g`,
      sub: g >= 1000 ? `(${(g / 1000).toFixed(2)} kg)` : null,
      unitType: 'mass'
    };
  }

  // Liquid conversions to milliliters (ml)
  if (unit === 'l' || unit === 'liter' || unit === 'liters' || unit === 'litre' || unit === 'litres') {
    const ml = Math.round(qty * 1000);
    return {
      main: `${ml.toLocaleString()} ml`,
      sub: qty >= 1 ? `(${qty.toFixed(2)} L)` : null,
      unitType: 'volume'
    };
  }
  if (unit === 'ml' || unit === 'milliliter' || unit === 'milliliters') {
    const ml = Math.round(qty);
    return {
      main: `${ml.toLocaleString()} ml`,
      sub: ml >= 1000 ? `(${(ml / 1000).toFixed(2)} L)` : null,
      unitType: 'volume'
    };
  }

  return {
    main: `${Number.isInteger(qty) ? qty : qty.toFixed(1)} ${rawUnit || 'units'}`,
    sub: null,
    unitType: 'count'
  };
};

const StaffRecipesPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const orderProductId = searchParams.get('productId');
  const orderQty = searchParams.get('orderQty');
  const orderNo = searchParams.get('orderNo');
  const orderId = searchParams.get('orderId');

  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [scaleMultiplier, setScaleMultiplier] = useState(1);
  const [notification, setNotification] = useState('');

  // Restock Modal State
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [selectedIngredientForRestock, setSelectedIngredientForRestock] = useState(null);
  const [restockAmount, setRestockAmount] = useState('10');
  const [restocking, setRestocking] = useState(false);

  const handleOpenRestock = (ing) => {
    setSelectedIngredientForRestock(ing);
    setRestockAmount('10');
    setRestockModalOpen(true);
  };

  const handleConfirmRestock = async (e) => {
    e.preventDefault();
    if (!selectedIngredientForRestock || !restockAmount || parseFloat(restockAmount) <= 0) {
      alert('Please enter a valid positive restock quantity.');
      return;
    }
    setRestocking(true);
    try {
      await api.post(`/ingredients/${selectedIngredientForRestock.raw_material_id}/restock`, {
        amount: parseFloat(restockAmount)
      });
      setNotification(`Restocked +${restockAmount} ${selectedIngredientForRestock.unit} of ${selectedIngredientForRestock.name}! Live inventory updated.`);
      setTimeout(() => setNotification(''), 4000);
      setRestockModalOpen(false);
      fetchRecipesAndCatalog();
    } catch (err) {
      alert(err.message || 'Failed to restock ingredient.');
    } finally {
      setRestocking(false);
    }
  };

  const fetchRecipesAndCatalog = async () => {
    setLoading(true);
    try {
      const [recRes, prodRes, ingRes] = await Promise.all([
        api.get('/api/recipes').catch(() => ({ data: { data: [] } })),
        api.get('/api/products').catch(() => ({ data: { data: [] } })),
        api.get('/api/ingredients').catch(() => ({ data: { data: [] } }))
      ]);

      const recList = recRes.data?.data || recRes.data || [];
      const prodList = prodRes.data?.data || prodRes.data || [];
      const matList = ingRes.data?.data || ingRes.data || [];

      setRecipes(recList);
      setProducts(prodList);
      setRawMaterials(matList);
    } catch (err) {
      console.error('Failed to load recipes data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipesAndCatalog();
  }, []);

  // When navigated from an active order, auto-scale recipe to the exact ordered quantity
  useEffect(() => {
    if (recipes.length > 0 && orderProductId) {
      const pId = parseInt(orderProductId, 10);
      const matched = recipes.find(r => r.product_id === pId || r.id === pId);
      if (matched && orderQty) {
        const baseYield = matched.batch_yield_units || matched.yield_quantity || 1;
        const targetMultiplier = Math.max(0.05, parseFloat((parseFloat(orderQty) / baseYield).toFixed(2)));
        setScaleMultiplier(targetMultiplier);
      }
    }
  }, [recipes, orderProductId, orderQty]);

  const handleAddIngredientRow = () => {
    setNewRecipeForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { raw_material_id: '', quantity: '', unit: 'kg' }]
    }));
  };

  const handleRemoveIngredientRow = (idx) => {
    setNewRecipeForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx)
    }));
  };

  const handleCreateRecipe = async (e) => {
    e.preventDefault();
    if (!newRecipeForm.product_id || !newRecipeForm.recipe_name.trim()) {
      alert('Please select a product and enter a recipe name.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanedIngredients = newRecipeForm.ingredients
        .filter(i => i.raw_material_id && i.quantity)
        .map(i => ({
          raw_material_id: Number(i.raw_material_id),
          quantity: parseFloat(i.quantity),
          unit: i.unit || 'kg'
        }));

      await api.post('/api/recipes', {
        product_id: Number(newRecipeForm.product_id),
        recipe_name: newRecipeForm.recipe_name.trim(),
        batch_yield_units: Number(newRecipeForm.batch_yield_units) || 1,
        yield_unit: newRecipeForm.yield_unit || 'pcs',
        prep_time_mins: Number(newRecipeForm.prep_time_mins) || 60,
        bake_time_mins: Number(newRecipeForm.bake_time_mins) || 25,
        oven_temp_c: Number(newRecipeForm.oven_temp_c) || 200,
        instructions: newRecipeForm.instructions.trim(),
        ingredients: cleanedIngredients
      });

      setNotification(`Recipe "${newRecipeForm.recipe_name}" created successfully!`);
      setTimeout(() => setNotification(''), 4000);
      setShowAddModal(false);
      fetchRecipesAndCatalog();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to create recipe');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter recipes
  const categories = ['ALL', ...new Set(recipes.map(r => r.category).filter(Boolean))];
  const filteredRecipes = recipes.filter(r => {
    const matchesCat = selectedCategory === 'ALL' || r.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      (r.recipe_name && r.recipe_name.toLowerCase().includes(q)) ||
      (r.product_name && r.product_name.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast Alert */}
      {notification && (
        <div style={{
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#065F46',
          padding: '12px 18px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} color="#059669" />
          <span>{notification}</span>
        </div>
      )}

      {/* ACTIVE CUSTOMER ORDER BANNER (Triggered when redirected from Staff Orders) */}
      {orderNo && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '2px solid #F59E0B',
          borderRadius: '16px',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 14px rgba(217, 119, 6, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: '#C25E00',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(194, 94, 0, 0.3)'
            }}>
              <ChefHat size={26} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                LIVE CUSTOMER ORDER #{orderNo} • FORMULA SCALING
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#1C1917', margin: '2px 0 0' }}>
                Baking Formula scaled for {orderQty} ordered units
              </h2>
              <p style={{ fontSize: '12px', color: '#78716C', margin: '4px 0 0' }}>
                Ingredients below are converted to <strong>grams (g)</strong> and <strong>milliliters (ml)</strong> for precision kitchen scale weighing.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {orderId && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.patch(`/orders/${orderId}/status`, {
                      status: 'Baking',
                      comment: `Baker measured ingredients (${orderQty} units) and started baking in oven`
                    });
                    setNotification(`✓ Order #${orderNo} status marked as "Baking"!`);
                    setTimeout(() => setNotification(''), 4000);
                  } catch (e) {
                    alert('Order updated to Baking!');
                  }
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#C25E00',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(194, 94, 0, 0.3)'
                }}
              >
                <Flame size={16} />
                <span>Confirm & Start Baking Order #{orderNo}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/staff/tasks')}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid #D6D3D1',
                backgroundColor: '#FFFFFF',
                color: '#44403C',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={15} />
              <span>Back to Orders Queue</span>
            </button>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid #E7E5E4',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#B45309'
          }}>
            <BookOpen size={24} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '24px', fontWeight: 'bold', color: '#1C1917', margin: 0 }}>
              Master Recipes & Baking Formulas
            </h1>
            <p style={{ fontSize: '13px', color: '#78716C', margin: '4px 0 0' }}>
              Confidential baker formulas with scaled hydration, exact ingredient grams, deck oven temperatures, and folding steps.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Scale Multiplier Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#F5F5F4',
            borderRadius: '10px',
            padding: '3px',
            border: '1px solid #E7E5E4'
          }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#78716C', padding: '0 8px' }}>
              Scale:
            </span>
            {[1, 2, 5, 10].map(mult => (
              <button
                key={mult}
                type="button"
                onClick={() => setScaleMultiplier(mult)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  backgroundColor: scaleMultiplier === mult ? '#C25E00' : 'transparent',
                  color: scaleMultiplier === mult ? '#FFFFFF' : '#44403C',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {mult}x
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              backgroundColor: '#5A3825',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} />
            <span>Add New Formula</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        padding: '16px',
        border: '1px solid #E7E5E4',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', flex: 1 }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: selectedCategory === cat ? '1px solid #C25E00' : '1px solid #E7E5E4',
                backgroundColor: selectedCategory === cat ? '#FFFBEB' : '#FAFAF9',
                color: selectedCategory === cat ? '#B45309' : '#57534E',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={15} color="#A8A29E" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input
            type="text"
            placeholder="Search formula or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px 8px 32px',
              borderRadius: '8px',
              border: '1px solid #D6D3D1',
              fontSize: '12px',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Recipe Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#78716C' }}>
          <ChefHat size={36} className="animate-bounce" style={{ margin: '0 auto 12px' }} />
          <div>Loading confidential bakery formulas...</div>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '48px',
          textAlign: 'center',
          border: '1px solid #E7E5E4'
        }}>
          <BookOpen size={36} color="#A8A29E" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1C1917', marginBottom: '6px' }}>No Recipes Found</h3>
          <p style={{ fontSize: '13px', color: '#78716C', margin: 0 }}>Try clearing your search or add a new recipe formula.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
          {filteredRecipes.map(recipe => {
            const scaledYield = (recipe.yield_quantity || 1) * scaleMultiplier;
            return (
              <div
                key={recipe.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E7E5E4',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Recipe Card Header */}
                <div style={{
                  padding: '18px 20px',
                  borderBottom: '1px solid #F5F5F4',
                  backgroundColor: '#FAF9F6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start'
                }}>
                  <div>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      color: '#B45309',
                      backgroundColor: '#FEF3C7',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {recipe.category || 'Bakery Standard'}
                    </span>
                    <h3 style={{
                      fontFamily: 'Georgia, serif',
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#1C1917',
                      margin: '6px 0 2px'
                    }}>
                      {recipe.recipe_name}
                    </h3>
                    <div style={{ fontSize: '12px', color: '#78716C' }}>
                      For product: <strong>{recipe.product_name}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#E0F2FE',
                      color: '#0369A1',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700
                    }}>
                      <Scale size={13} />
                      <span>{scaledYield} {recipe.yield_unit}</span>
                    </div>
                    {scaleMultiplier > 1 && (
                      <div style={{ fontSize: '10px', color: '#0369A1', marginTop: '2px', fontWeight: 600 }}>
                        Scaled {scaleMultiplier}x
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Metrics Bar */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  borderBottom: '1px solid #F5F5F4',
                  backgroundColor: '#FFFFFF',
                  padding: '12px 20px',
                  textAlign: 'center',
                  fontSize: '12px'
                }}>
                  <div style={{ borderRight: '1px solid #F5F5F4' }}>
                    <div style={{ color: '#A8A29E', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                      <Clock size={12} /> Prep Time
                    </div>
                    <strong style={{ color: '#1C1917' }}>{recipe.prep_time_minutes} mins</strong>
                  </div>

                  <div style={{ borderRight: '1px solid #F5F5F4' }}>
                    <div style={{ color: '#A8A29E', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                      <Flame size={12} /> Bake Time
                    </div>
                    <strong style={{ color: '#1C1917' }}>{recipe.bake_time_minutes} mins</strong>
                  </div>

                  <div>
                    <div style={{ color: '#A8A29E', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                      <Thermometer size={12} /> Deck Temp
                    </div>
                    <strong style={{ color: '#C25E00' }}>{recipe.oven_temp_c || 200}°C</strong>
                  </div>
                </div>

                {/* Ingredients List */}
                <div style={{ padding: '16px 20px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#44403C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Scaled Formula Ingredients ({scaleMultiplier}x Batch):
                    </div>
                    <span style={{ fontSize: '11px', color: '#92400E', fontWeight: 700, backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '4px' }}>
                      ⚖️ Scale in grams (g) & milliliters (ml)
                    </span>
                  </div>

                  {recipe.ingredients && recipe.ingredients.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {recipe.ingredients.map((ing, idx) => {
                        const baseQty = parseFloat(ing.quantity) || 0;
                        const scaledQty = (baseQty * scaleMultiplier);
                        const currentStock = typeof ing.current_stock === 'number' ? ing.current_stock : 0;
                        const isSufficient = currentStock >= scaledQty;
                        const percentAvailable = scaledQty > 0 ? Math.min(100, Math.round((currentStock / scaledQty) * 100)) : 100;

                        // Precise grams & milliliters calculation
                        const neededMeasure = formatKitchenMeasurement(scaledQty, ing.unit);
                        const stockMeasure = formatKitchenMeasurement(currentStock, ing.unit);

                        return (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '5px',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              backgroundColor: isSufficient ? (idx % 2 === 0 ? '#FAF9F6' : '#FFFFFF') : '#FEF2F2',
                              border: isSufficient ? '1px solid #F5F5F4' : '1px solid #FECACA',
                              fontSize: '12px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                              <span style={{ color: '#292524', fontWeight: 700, fontSize: '13px' }}>
                                {ing.name || ing.ingredient_name}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontWeight: 800, color: '#C25E00', fontSize: '14px' }}>
                                  {neededMeasure.main}
                                </span>
                                {neededMeasure.sub && (
                                  <span style={{ fontSize: '11px', color: '#78716C', fontWeight: 500 }}>
                                    {neededMeasure.sub}
                                  </span>
                                )}
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#0369A1', backgroundColor: '#E0F2FE', padding: '1px 6px', borderRadius: '4px' }}>
                                  needed
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', marginTop: '2px', flexWrap: 'wrap', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#78716C' }}>
                                  Pantry Stock: <strong>{stockMeasure.main}</strong> {stockMeasure.sub && <span style={{ opacity: 0.85 }}>{stockMeasure.sub}</span>}
                                </span>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  backgroundColor: isSufficient ? '#DCFCE7' : '#FEE2E2',
                                  color: isSufficient ? '#15803D' : '#B91C1C'
                                }}>
                                  {percentAvailable}% available {isSufficient ? '✓' : '⚠️ Low Stock'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleOpenRestock(ing)}
                                style={{
                                  backgroundColor: isSufficient ? '#F3F4F6' : '#DC2626',
                                  color: isSufficient ? '#374151' : '#FFFFFF',
                                  border: isSufficient ? '1px solid #D1D5DB' : 'none',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                title="Request or restock this ingredient"
                              >
                                <Plus size={12} />
                                <span>{isSufficient ? 'Add Stock' : 'Order More'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#A8A29E', fontStyle: 'italic' }}>
                      Formula ratios recorded on deck sheet.
                    </div>
                  )}

                  {/* Step-by-Step Instructions */}
                  {recipe.instructions && (
                    <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #F5F5F4' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                        Baking Method & Technique:
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#44403C',
                        lineHeight: 1.5,
                        backgroundColor: '#FFFBEB',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #FEF3C7'
                      }}>
                        {recipe.instructions}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Recipe Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000,
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '620px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ChefHat size={22} color="#C25E00" />
                <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 700, color: '#1C1917', margin: 0 }}>
                  Create Master Recipe Formula
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716C' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRecipe}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Select Bakery Product *
                  </label>
                  <select
                    required
                    value={newRecipeForm.product_id}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const prod = products.find(p => p.id === Number(pid));
                      setNewRecipeForm(prev => ({
                        ...prev,
                        product_id: pid,
                        recipe_name: prod ? `${prod.name} Formula` : prev.recipe_name
                      }));
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D6D3D1',
                      fontSize: '13px'
                    }}
                  >
                    <option value="">-- Choose Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Recipe Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newRecipeForm.recipe_name}
                    onChange={(e) => setNewRecipeForm({ ...newRecipeForm, recipe_name: e.target.value })}
                    placeholder="e.g. Traditional Baguette Poolish Formula"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D6D3D1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Batch Yield
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newRecipeForm.batch_yield_units}
                    onChange={(e) => setNewRecipeForm({ ...newRecipeForm, batch_yield_units: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Yield Unit
                  </label>
                  <input
                    type="text"
                    value={newRecipeForm.yield_unit}
                    onChange={(e) => setNewRecipeForm({ ...newRecipeForm, yield_unit: e.target.value })}
                    placeholder="pcs / loaves"
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Bake Mins
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newRecipeForm.bake_time_mins}
                    onChange={(e) => setNewRecipeForm({ ...newRecipeForm, bake_time_mins: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Oven Temp (°C)
                  </label>
                  <input
                    type="number"
                    value={newRecipeForm.oven_temp_c}
                    onChange={(e) => setNewRecipeForm({ ...newRecipeForm, oven_temp_c: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Ingredients Builder */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#44403C' }}>
                    Ingredients & Weights
                  </label>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#C25E00',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    + Add Ingredient
                  </button>
                </div>

                {newRecipeForm.ingredients.map((ing, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <select
                      value={ing.raw_material_id}
                      onChange={(e) => {
                        const val = e.target.value;
                        const mat = rawMaterials.find(m => m.id === Number(val));
                        const copy = [...newRecipeForm.ingredients];
                        copy[idx] = { ...copy[idx], raw_material_id: val, unit: mat?.unit || 'kg' };
                        setNewRecipeForm({ ...newRecipeForm, ingredients: copy });
                      }}
                      style={{ flex: 2, padding: '7px 10px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px' }}
                    >
                      <option value="">-- Choose Raw Material --</option>
                      {rawMaterials.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.001"
                      placeholder="Qty"
                      value={ing.quantity}
                      onChange={(e) => {
                        const copy = [...newRecipeForm.ingredients];
                        copy[idx] = { ...copy[idx], quantity: e.target.value };
                        setNewRecipeForm({ ...newRecipeForm, ingredients: copy });
                      }}
                      style={{ width: '80px', padding: '7px 8px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px' }}
                    />

                    <span style={{ fontSize: '12px', color: '#78716C', width: '35px' }}>{ing.unit || 'kg'}</span>

                    {newRecipeForm.ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveIngredientRow(idx)}
                        style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Step by step instructions */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Step-by-Step Baking Method & Technique
                </label>
                <textarea
                  rows={4}
                  value={newRecipeForm.instructions}
                  onChange={(e) => setNewRecipeForm({ ...newRecipeForm, instructions: e.target.value })}
                  placeholder="1. Autolyse flour and water for 45 mins. 2. Fold in starter and salt. 3. Ferment with folds. 4. Bake at deck temp with steam."
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #D6D3D1',
                    fontSize: '12px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #D6D3D1',
                    backgroundColor: '#FAFAF9',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#C25E00',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? 'Saving Formula...' : 'Save & Publish Formula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Restock Ingredient Modal */}
      {restockModalOpen && selectedIngredientForRestock && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#C25E00', textTransform: 'uppercase' }}>
                  Floor Stock Replenishment
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1C1917', margin: '2px 0 0' }}>
                  Restock {selectedIngredientForRestock.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRestockModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#78716C' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmRestock}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#78716C', marginBottom: '6px' }}>
                  Current In-Stock Quantity: <strong>{selectedIngredientForRestock.current_stock || 0} {selectedIngredientForRestock.unit}</strong>
                </div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1C1917', marginBottom: '4px' }}>
                  Quantity to Add ({selectedIngredientForRestock.unit}) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #D6D3D1',
                    fontSize: '14px',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                  placeholder="e.g. 25"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRestockModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #D6D3D1',
                    backgroundColor: '#FAF9F6',
                    color: '#44403C',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restocking}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#C25E00',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: restocking ? 'not-allowed' : 'pointer'
                  }}
                >
                  {restocking ? 'Updating Stock...' : 'Confirm Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffRecipesPage;
