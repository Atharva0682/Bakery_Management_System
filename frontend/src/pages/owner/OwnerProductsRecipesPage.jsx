import React, { useState, useEffect, useMemo } from 'react';
import ownerService from '../../services/ownerService';
import api from '../../services/api';
import { Dialog } from '../../components/owner/OwnerUI';
import OwnerCatalogWorkspace from '../../components/owner/OwnerCatalogWorkspace';
import { ChefHat, Plus, Trash2, ImageIcon } from 'lucide-react';

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


const OwnerProductsRecipesPage = () => {
  const [catalogError, setCatalogError] = useState('');
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [activeTab, setActiveTab] = useState('RECIPES'); // 'RECIPES' | 'PRODUCTS'
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
    ingredients: [
      { raw_material_id: '', quantity: '', unit: 'kg' }
    ]
  });

  // Owner Selling Price & Recipe Cost Factors Controls
  const [editingPrice, setEditingPrice] = useState('');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [showEditFactorsModal, setShowEditFactorsModal] = useState(false);
  const [factorsForm, setFactorsForm] = useState({
    selling_price: 280,
    labour_cost_per_min: 2.50,
    power_cost_per_min: 1.20,
    packaging_cost_per_unit: 10.00
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
          // re-sync selected recipe
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
          ingredients: cleanedIngredients
        }
      };

      await ownerService.createProductWithRecipe(payload);
      setNotification(`✓ "${payload.name}" and its Master Formula were created! It is now immediately available in Customer Storefront, Staff KDS Floor, and Owner Portal.`);
      setTimeout(() => setNotification(''), 5000);

      setShowAddProductModal(false);
      setNewProductForm({
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
        instructions: '',
        ingredients: [
          { raw_material_id: '1', quantity: '1.5', unit: 'kg' },
          { raw_material_id: '3', quantity: '0.4', unit: 'kg' }
        ]
      });

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
        ingredients: cleanedIngredients
      };

      await api.post('/api/recipes', payload);
      setNotification(`✓ Master Formula "${payload.recipe_name}" created & published to kitchen floor!`);
      setTimeout(() => setNotification(''), 4000);

      setShowAddRecipeModal(false);
      setNewRecipeForm({
        product_id: '',
        recipe_name: '',
        batch_yield_units: 12,
        yield_unit: 'pcs',
        prep_time_mins: 60,
        bake_time_mins: 25,
        oven_temp_c: 200,
        instructions: '',
        ingredients: [{ raw_material_id: '', quantity: '', unit: 'kg' }]
      });

      await loadCatalog();
    } catch (err) {
      alert(err.message || 'Failed to save master recipe.');
    } finally {
      setSubmitting(false);
    }
  };

  // Fallback BOM for display if empty
  const curRecipe = useMemo(() => selectedRecipe || recipes[0] || { ingredients: [], selling_price: 0, yield_quantity: 1 }, [selectedRecipe, recipes]);

  const curTitle = curRecipe.recipe_name || curRecipe.product_name || curRecipe.name || 'Master Formula';
  const standardYield = Math.max(1, parseInt(curRecipe.yield_quantity || curRecipe.batch_yield_units || curRecipe.yield_units, 10) || 4);
  const curYieldUnit = curRecipe.yield_unit || 'loaves';

  // Desired production quantity (defaults to standard batch yield if not specified)
  const actualProductionQty = Math.max(0.1, parseFloat(desiredProductionQty) > 0 ? parseFloat(desiredProductionQty) : standardYield);
  // Scaling factor = Desired production quantity ÷ Standard batch yield
  const scalingFactor = standardYield > 0 ? actualProductionQty / standardYield : 1;

  const prepMins = parseInt(curRecipe.prep_time_minutes ?? curRecipe.prep_time_mins ?? 0, 10);
  const bakeMins = parseInt(curRecipe.bake_time_minutes ?? curRecipe.bake_time_mins ?? 0, 10);


  const packagingRatePerUnit = parseFloat(curRecipe.packaging_cost_per_unit !== undefined ? curRecipe.packaging_cost_per_unit : 0);
  const overheadRatePerBatch = Number(curRecipe.other_cost || 0);

  // Normalize ingredients array
  const rawIngredients = Array.isArray(curRecipe.ingredients) && curRecipe.ingredients.length > 0
    ? curRecipe.ingredients
    : [];

  const primaryFlourWeight = parseFloat(rawIngredients[0]?.quantity || rawIngredients[0]?.base_qty || 1);

  const ingredientsList = rawIngredients.map((it, idx) => {
    const name = it.name || it.ingredient_name || it.ingredient || `Material #${it.raw_material_id || idx + 1}`;
    const baseQty = parseFloat(it.quantity || it.base_qty || it.quantity_required || 0);
    // Formula: Required quantity = Recipe quantity per batch × Desired production quantity ÷ Standard batch yield
    const scaledQty = baseQty * scalingFactor;
    const recipeUnit = (it.unit || 'g').trim();

    // Match with raw materials inventory for accurate lot unit and lot pricing
    const matchedMat = rawMaterials.find(m => m.id === Number(it.raw_material_id || it.id)) || {};
    const lotUnit = (it.raw_unit || matchedMat.unit || (recipeUnit.toLowerCase() === 'g' ? 'kg' : recipeUnit)).trim();
    const lotPrice = parseFloat(
      matchedMat.lot_unit_cost !== undefined
        ? matchedMat.lot_unit_cost
        : (matchedMat.cost_per_unit !== undefined
            ? matchedMat.cost_per_unit
            : (it.unit_cost !== undefined ? it.unit_cost : 0))
    );

    // Unit Conversion: Convert recipe unit quantity into lot pricing unit (g -> kg, ml -> L, etc.)
    const rU = recipeUnit.toLowerCase();
    const lU = lotUnit.toLowerCase();
    let unitMultiplier = 1.0;
    if (rU === 'g' && lU === 'kg') unitMultiplier = 0.001;
    else if (rU === 'kg' && lU === 'g') unitMultiplier = 1000.0;
    else if (rU === 'ml' && (lU === 'l' || lU === 'litre' || lU === 'liter')) unitMultiplier = 0.001;
    else if ((rU === 'l' || rU === 'litre' || rU === 'liter') && lU === 'ml') unitMultiplier = 1000.0;

    const qtyInLotUnits = scaledQty * unitMultiplier;
    const lineCost = Math.round((it.cost != null ? Number(it.cost) * scalingFactor : qtyInLotUnits * lotPrice) * 100) / 100;

    const bakersPct = it.bakers_pct || (idx === 0 ? '100%' : `${Math.round((baseQty / (primaryFlourWeight || 1)) * 100)}%`);

    return {
      ingredient: name,
      bakers_pct: bakersPct,
      standard_qty: baseQty,
      scaled_qty: scaledQty,
      unit: recipeUnit,
      lot_unit: lotUnit,
      lot_unit_cost: lotPrice.toFixed(2),
      display_unit_cost: `₹${lotPrice.toFixed(2)} / ${lotUnit}`,
      line_cost: lineCost
    };
  });

  const totalRawCost = Math.round(Number(curRecipe.raw_material_cost || 0) * scalingFactor * 100) / 100;
  // Requirement 6: Dynamic Calculated Labour Cost replaces previous hardcoded labour cost
  const laborCost = Math.round(Number(curRecipe.labour_cost || 0) * scalingFactor * 100) / 100;
  const powerCost = Math.round(Number(curRecipe.power_cost || 0) * scalingFactor * 100) / 100;
  const packagingCost = Math.round((actualProductionQty * packagingRatePerUnit) * 100) / 100;
  const otherOverheadCost = Math.round((overheadRatePerBatch * scalingFactor) * 100) / 100;

  // Total Batch Production Cost = Total Raw Material Cost + Calculated Labour Cost + Existing Power Cost + Existing Packaging Cost + Other Existing Production Costs
  const totalProductionCost = Math.round((totalRawCost + laborCost + powerCost + packagingCost + otherOverheadCost) * 100) / 100;
  // Production Cost Per Piece = Total Batch Production Cost ÷ Desired Production Quantity
  const costPerUnit = actualProductionQty > 0 ? Math.round((totalProductionCost / actualProductionQty) * 100) / 100 : 0;

  const curSellingPrice = Math.max(0, editingPrice === '' ? Number(curRecipe.selling_price ?? curRecipe.base_price ?? 0) : Number(editingPrice));
  const totalRevenue = Math.round((curSellingPrice * actualProductionQty) * 100) / 100;
  const profitPerUnit = Math.round((curSellingPrice - costPerUnit) * 100) / 100;
  const totalBatchProfit = Math.round((totalRevenue - totalProductionCost) * 100) / 100;

  const grossMarginPct = curSellingPrice > 0 
    ? Math.round(((curSellingPrice - costPerUnit) / curSellingPrice) * 1000) / 10 
    : 0;

  const markupPct = costPerUnit > 0 
    ? Math.round(((curSellingPrice - costPerUnit) / costPerUnit) * 1000) / 10 
    : 0;


  // Target Profit Margin Calculator
  const targetMarginNum = Math.min(99.9, Math.max(0, targetMarginInput === '' ? 30 : Number(targetMarginInput)));
  const recommendedSellingPrice = (100 - targetMarginNum) > 0 
    ? Math.round((costPerUnit / (1 - (targetMarginNum / 100))) * 100) / 100 
    : costPerUnit;
  const recommendedSellingPriceRounded = Math.ceil(recommendedSellingPrice);

  useEffect(() => {
    if (curRecipe.id) {
      const price = curRecipe.selling_price ?? curRecipe.base_price ?? 0;
      setEditingPrice(price);
      const stdYield = parseInt(curRecipe.yield_quantity || curRecipe.batch_yield_units || curRecipe.yield_units, 10) || 4;
      setDesiredProductionQty(stdYield);
      const matchedProd = products.find(p => Number(p.id) === Number(curRecipe.product_id));
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
        packaging_cost_per_unit: curRecipe.packaging_cost_per_unit !== undefined ? curRecipe.packaging_cost_per_unit : 10.00
      });

    }
  }, [curRecipe, products]);

  const handleApplyRecommendedPrice = () => {
    setEditingPrice(recommendedSellingPriceRounded);
    setNotification(`Applied recommended selling price ₹${recommendedSellingPriceRounded} (target ${targetMarginNum}% margin). Click "Save Price" to commit.`);
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
    if (!window.confirm(`Archive product "${prod?.name || 'this product'}" from the menu? Historical records will be preserved.`)) return;
    try {
      await ownerService.deleteProduct(productId);
      setNotification(`✓ Product archived successfully.`);
      setTimeout(() => setNotification(''), 4000);
      await loadCatalog();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete product');
    }
  };

  const handleQuickSavePrice = async () => {
    if (!curRecipe || !curRecipe.id) return;
    const priceVal = parseFloat(editingPrice);
    if (!priceVal || priceVal <= 0) {
      alert('Please enter a valid selling price.');
      return;
    }
    setIsUpdatingPrice(true);
    try {
      await ownerService.updateRecipe(curRecipe.id, {
        selling_price: priceVal
      });

      // Persist newly calculated margin & selling price permanently



      // Immediately update local recipe state so the recipe cards update automatically
      setRecipes(prev => prev.map(r => (r.id === curRecipe.id ? { ...r, selling_price: priceVal, margin_percent: grossMarginPct } : r)));
      setSelectedRecipe(prev => (prev ? { ...prev, selling_price: priceVal, margin_percent: grossMarginPct } : prev));

      setNotification(`✓ Selling price saved at ₹${priceVal}! Margin updated to ${grossMarginPct > 0 ? '+' : ''}${grossMarginPct.toFixed(1)}%.`);
      setTimeout(() => setNotification(''), 4000);
      await loadCatalog();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update selling price');
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  const handleSaveRecipeFactors = async (e) => {
    if (e) e.preventDefault();
    if (!curRecipe || !curRecipe.id) return;
    setIsUpdatingPrice(true);
    try {
      const payload = {
        ...factorsForm,
        selling_price: parseFloat(factorsForm.selling_price) || parseFloat(editingPrice) || curSellingPrice,
        labour_cost_per_min: parseFloat(factorsForm.labour_cost_per_min),
        power_cost_per_min: parseFloat(factorsForm.power_cost_per_min),
        packaging_cost_per_unit: parseFloat(factorsForm.packaging_cost_per_unit)
      };
      await ownerService.updateRecipe(curRecipe.id, payload);

      if (curRecipe.product_id) {
        const delFeeVal = (factorsForm.delivery_fee !== '' && factorsForm.delivery_fee !== null && factorsForm.delivery_fee !== undefined)
          ? parseFloat(factorsForm.delivery_fee)
          : null;
        await ownerService.updateProduct(curRecipe.product_id, {
          delivery_fee: delFeeVal,
          base_price: payload.selling_price
        });
      }

      setRecipes(prev => prev.map(r => (r.id === curRecipe.id ? { ...r, selling_price: payload.selling_price || r.selling_price, margin_percent: grossMarginPct } : r)));
      setSelectedRecipe(prev => (prev ? { ...prev, selling_price: payload.selling_price || prev.selling_price, margin_percent: grossMarginPct } : prev));

      setNotification(`✓ Costing rates & selling price updated for "${curTitle}"! Margin recalculated.`);
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
      <OwnerCatalogWorkspace model={{ products, recipes, categories, curRecipe, curTitle, standardYield, curYieldUnit, prepMins, bakeMins, actualProductionQty, scalingFactor, ingredientsList, totalRawCost, laborCost, powerCost, packagingCost, otherOverheadCost, totalProductionCost, costPerUnit, curSellingPrice, totalRevenue, profitPerUnit, totalBatchProfit, grossMarginPct, markupPct, recommendedSellingPriceRounded, desiredProductionQty, setDesiredProductionQty, targetMarginInput, setTargetMarginInput, editingPrice, setEditingPrice, isUpdatingPrice, handleQuickSavePrice, handleApplyRecommendedPrice, notification, catalogError, activeTab, setActiveTab, recipeSearch, setRecipeSearch, filteredRecipes, productSearch, setProductSearch, filteredProducts, setSelectedRecipe, setShowAddProductModal, setShowAddRecipeModal, setShowEditFactorsModal, handleDeleteRecipe, handleDeleteProduct, editingProductId, setEditingProductId, tempProductPrice, setTempProductPrice, tempProductDeliveryFee, setTempProductDeliveryFee, handleSaveProductPrice, setNewRecipeForm, bulkIds, setBulkIds, bulkField, setBulkField, bulkValue, setBulkValue, submitting,
        activateRecipe: async () => {
          try { await ownerService.updateRecipe(curRecipe.id, { make_active: true }); await loadCatalog(); setNotification('Production formula updated.'); }
          catch (error) { setCatalogError(error.message); }
        },
        applyBulk: async () => {
          if (!window.confirm(`Update ${bulkField} to ${bulkValue} for ${bulkIds.length} selected recipes?`)) return;
          setSubmitting(true);
          try { await api.post('/recipes/bulk', { ids: bulkIds.map(Number), changes: { [bulkField]: Number(bulkValue) } }); await loadCatalog(); setNotification('Selected recipes updated.'); }
          catch (error) { setCatalogError(error.message); } finally { setSubmitting(false); }
        }
      }} />
      {/* ========================================================== */}
      {/* MODAL 1: ADD NEW PRODUCT & AUTOMATIC MASTER RECIPE BUILDER */}
      {/* ========================================================== */}
      {showAddProductModal && <Dialog wide title="New product & recipe" description="Build a menu item with its master formula." onClose={() => setShowAddProductModal(false)}>
<form className="oc-editor-form" onSubmit={handleCreateProduct} style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Product Basic Info Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pistachio Cardamom Croissant Twist"
                    value={newProductForm.name}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D6D3D1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                    Category *
                  </label>
                  <select
                    value={newProductForm.category_id}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, category_id: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D6D3D1',
                      fontSize: '13px',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '6px' }}>
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="220"
                    value={newProductForm.base_price}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, base_price: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D6D3D1',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#059669',
                      boxSizing: 'border-box'
                    }}
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
                    placeholder="Standard (₹50)"
                    value={newProductForm.delivery_fee}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, delivery_fee: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D6D3D1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: '10px', color: '#78716C', display: 'block', marginTop: '3px' }}>
                    Blank = ₹50, 0 = free
                  </span>
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
                    placeholder="Flaky 84% butter pastry laminated with Sicilian pistachio praline and green cardamom."
                    value={newProductForm.description}
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, description: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #D6D3D1',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
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
                      max="30"
                      value={newProductForm.shelf_life_days}
                      onChange={(e) => setNewProductForm(prev => ({ ...prev, shelf_life_days: e.target.value }))}
                      style={{ width: '50px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '12px' }}
                    />
                    <span style={{ fontSize: '11px', color: '#78716C' }}>days</span>
                  </div>
                </div>
              </div>

              {/* IMAGE SELECTION & PRESET CAROUSEL */}
              <div style={{ backgroundColor: '#FAF9F6', padding: '16px', borderRadius: '12px', border: '1px solid #E7E5E4' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#1C1917', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ImageIcon size={14} color="#C25E00" />
                    Product Image (Custom URL or Choose From Artisanal Gallery)
                  </label>
                  <span style={{ fontSize: '11px', color: '#78716C' }}>High-res photos boost customer orders</span>
                </div>

                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <img
                    src={newProductForm.image_url}
                    alt="Preview"
                    style={{ width: '70px', height: '70px', borderRadius: '10px', objectFit: 'cover', border: '2px solid #C25E00' }}
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600'; }}
                  />
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Paste image URL here..."
                      value={newProductForm.image_url}
                      onChange={(e) => setNewProductForm(prev => ({ ...prev, image_url: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid #D6D3D1',
                        fontSize: '12px',
                        boxSizing: 'border-box'
                      }}
                    />
                    {/* Preset Badges */}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: '#78716C', alignSelf: 'center' }}>Quick Presets:</span>
                      {PRESET_BAKERY_IMAGES.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setNewProductForm(prev => ({ ...prev, image_url: preset.url }))}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: newProductForm.image_url === preset.url ? '1px solid #C25E00' : '1px solid #D6D3D1',
                            backgroundColor: newProductForm.image_url === preset.url ? '#FEF3C7' : '#FFFFFF',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: newProductForm.image_url === preset.url ? '#92400E' : '#44403C'
                          }}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* MASTER RECIPE & BILL OF MATERIALS (BOM) FORMULATION */}
              <div style={{ backgroundColor: '#FAF9F6', padding: '16px', borderRadius: '12px', border: '1px solid #E7E5E4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#1C1917', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ChefHat size={15} color="#C25E00" />
                      Auto-Created Master Recipe & Baking Specs
                    </label>
                    <span style={{ fontSize: '11px', color: '#78716C' }}>Links directly to pantry inventory lots for real-time stock deductions</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddProductIngRow}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: '1px solid #C25E00',
                      backgroundColor: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: '#C25E00',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} /> Add Ingredient
                  </button>
                </div>

                {/* Yield & Oven Parameters */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#78716C', marginBottom: '4px' }}>
                      Batch Yield
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
                      Packaging (₹ / unit)
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
                          style={{
                            flex: 2,
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #D6D3D1',
                            fontSize: '12px',
                            backgroundColor: '#FFFFFF'
                          }}
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
                          step="0.01"
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
                          style={{
                            width: '90px',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #D6D3D1',
                            fontSize: '12px'
                          }}
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
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#DC2626',
                              padding: '4px'
                            }}
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
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #D6D3D1',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    border: '1px solid #D6D3D1',
                    backgroundColor: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#44403C'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#C25E00',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1,
                    boxShadow: '0 4px 12px rgba(194, 94, 0, 0.3)'
                  }}
                >
                  {submitting ? 'Publishing Product & Formula...' : 'Publish Product & Auto-Add Recipe'}
                </button>
              </div>
            </form>
      </Dialog>}

      {/* ========================================================== */}
      {/* MODAL 2: ADD MASTER RECIPE ONLY (EXISTING MODAL) */}
      {/* ========================================================== */}
      {showAddRecipeModal && <Dialog wide title="Add a master recipe" description="Connect ingredients and production rates to an existing product." onClose={() => setShowAddRecipeModal(false)}>
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
                        recipe_name: selProd ? `${selProd.name} Standard Formula` : prev.recipe_name
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

              {/* Costing Factors: Labour, Power & Packaging */}
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
                    Packaging (₹ / unit)
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
                    Ingredients & Quantities per Batch
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
                        step="0.01"
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
                  Baking Method & Temperature Instructions
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Autolyse 45m. Bulk fermentation 4h with 3 stretch-and-folds. Retard overnight at 4°C. Bake with heavy steam at 235°C for 25m."
                  value={newRecipeForm.instructions}
                  onChange={(e) => setNewRecipeForm(prev => ({ ...prev, instructions: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
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
      </Dialog>}

      {/* ========================================================== */}
      {/* MODAL 3: EDIT COST FACTORS & SELLING PRICE */}
      {/* ========================================================== */}
      {showEditFactorsModal && <Dialog wide title="Edit recipe & pricing" description="Update the formula and the costs used by your kitchen." onClose={() => setShowEditFactorsModal(false)}>
<form className="oc-editor-form" onSubmit={handleSaveRecipeFactors} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                ['recipe_name', 'Recipe name', 'text'],
                ['batch_yield_units', 'Saleable items per batch', 'number'],
                ['prep_time_mins', 'Active labour minutes per batch', 'number'],
                ['bake_time_mins', 'Powered oven minutes per batch', 'number'],
                ['other_cost', 'Other cost per batch', 'number'],
                ['gst_rate', 'Configured product GST (%)', 'number']
              ].map(([key, label, type]) => <label key={key} style={{ display: 'grid', gap: 4 }}>
                {label}<input required type={type} min={key === 'batch_yield_units' ? 1 : 0} max={key === 'gst_rate' ? 100 : undefined} step={key === 'batch_yield_units' ? 1 : 'any'} value={factorsForm[key] ?? ''} onChange={e => setFactorsForm({ ...factorsForm, [key]: e.target.value })} />
              </label>)}
              <fieldset><legend>Ingredients per batch</legend>
                {(factorsForm.ingredients || []).map((item, index) => <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  <select aria-label="Ingredient" required value={item.raw_material_id} onChange={e => setFactorsForm({ ...factorsForm, ingredients: factorsForm.ingredients.map((row, i) => i === index ? { ...row, raw_material_id: Number(e.target.value) } : row) })}>
                    <option value="">Choose ingredient</option>{rawMaterials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input aria-label="Ingredient quantity" required type="number" min="0.000001" step="any" style={{ width: 100 }} value={item.quantity} onChange={e => setFactorsForm({ ...factorsForm, ingredients: factorsForm.ingredients.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row) })} />
                  <select aria-label="Ingredient unit" value={item.unit} onChange={e => setFactorsForm({ ...factorsForm, ingredients: factorsForm.ingredients.map((row, i) => i === index ? { ...row, unit: e.target.value } : row) })}>
                    {['g', 'kg', 'ml', 'L', 'pcs'].map(unit => <option key={unit}>{unit}</option>)}
                  </select>
                  <button type="button" onClick={() => setFactorsForm({ ...factorsForm, ingredients: factorsForm.ingredients.filter((_, i) => i !== index) })}>Remove</button>
                </div>)}
                <button type="button" onClick={() => setFactorsForm({ ...factorsForm, ingredients: [...(factorsForm.ingredients || []), { raw_material_id: '', quantity: '', unit: 'kg' }] })}>Add ingredient</button>
              </fieldset>
              <label>Instructions<textarea value={factorsForm.instructions || ''} onChange={e => setFactorsForm({ ...factorsForm, instructions: e.target.value })} /></label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Selling Price (₹ per unit) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={factorsForm.selling_price}
                    onChange={(e) => setFactorsForm({ ...factorsForm, selling_price: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '15px', fontWeight: 700, color: '#059669', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                    Custom Delivery Fee (₹) <span style={{ fontWeight: 400, color: '#78716C', fontSize: '11px' }}>(Optional)</span>
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
                  <span style={{ fontSize: '10px', color: '#78716C', display: 'block', marginTop: '2px' }}>Leave blank for ₹50 standard, or 0 for free delivery</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <span style={{ fontSize: '11px', color: '#78716C' }}>Applied to active labour minutes per batch</span>
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
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                  <span style={{ fontSize: '11px', color: '#78716C' }}>Applied to powered oven minutes per batch</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#44403C', marginBottom: '4px' }}>
                  Packaging Cost (₹ per nos / unit) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={factorsForm.packaging_cost_per_unit}
                  onChange={(e) => setFactorsForm({ ...factorsForm, packaging_cost_per_unit: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
                />
                <span style={{ fontSize: '11px', color: '#78716C' }}>Kraft boxes, bakery liners, and seals</span>
              </div>

              <div style={{ backgroundColor: '#F0FDF4', padding: '12px', borderRadius: '8px', border: '1px solid #BBF7D0', fontSize: '12px', color: '#166534' }}>
                💡 Margin % will recalculate dynamically: <strong>Margin = ((Selling Price - Unit Cost) / Selling Price) × 100</strong>
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
      </Dialog>}
    </div>
  );
};
export default OwnerProductsRecipesPage;