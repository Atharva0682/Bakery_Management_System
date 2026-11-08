const catalogService = require('../services/catalogService');
const { successResponse, errorResponse } = require('../utils/response');

const catalogRepository = require('../models/catalogRepository');

class CatalogController {
  async getCategories(req, res) {
    try {
      const data = await catalogService.getCategories(req.businessId);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'CATALOG_ERROR', err.message, err.statusCode || 400);
    }
  }

  async getProducts(req, res) {
    try {
      const data = await catalogService.getProducts({
        businessId: req.businessId,
        categoryId: req.query.categoryId,
        search: req.query.search,
      });
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'CATALOG_ERROR', err.message, err.statusCode || 400);
    }
  }

  async getProductDetails(req, res) {
    try {
      const data = await catalogService.getProductDetails(req.params.id, req.businessId);
      return successResponse(res, data, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'PRODUCT_ERROR', err.message, err.statusCode || 404);
    }
  }

  async updateProduct(req, res) {
    try {
      const bId = req.user?.business_id || req.businessId || 1;
      const updated = await catalogRepository.updateProduct(req.params.id, req.body, bId);
      if (!updated) {
        return errorResponse(res, 'PRODUCT_NOT_FOUND', 'Product not found', 404);
      }
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'PRODUCT_UPDATE_ERROR', err.message, err.statusCode || 400);
    }
  }

  async createProduct(req, res) {
    try {
      const bId = req.user?.business_id || req.businessId || 1;
      const {
        name,
        category_id,
        base_price,
        description,
        image_url,
        is_eggless,
        shelf_life_days,
        recipe
      } = req.body;

      if (!name || !name.trim()) {
        return errorResponse(res, 'VALIDATION_ERROR', 'Product name is required', 400);
      }

      const db = require('../config/db');
      const { product, createdRecipe } = await db.transaction(async () => {
        const product = await catalogRepository.createProduct({ ...req.body, business_id: bId });
        const createdRecipe = recipe ? await require('../models/recipeRepository').createRecipe({ ...recipe,
          business_id: bId, product_id: product.id, recipe_name: recipe.recipe_name || `${product.name} Master Formula` }) : null;
        return { product, createdRecipe };
      });

      return successResponse(res, { product, recipe: createdRecipe }, 201);
    } catch (err) {
      return errorResponse(res, err.code || 'PRODUCT_CREATE_ERROR', err.message, err.statusCode || 400);
    }
  }

  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const bId = req.user?.business_id || 1;
      const updated = await catalogRepository.updateProduct(id, req.body, bId);
      if (!updated) {
        return errorResponse(res, 'PRODUCT_NOT_FOUND', `Product #${id} not found`, 404);
      }
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'PRODUCT_UPDATE_ERROR', err.message, err.statusCode || 400);
    }
  }

  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const bId = req.user?.business_id || 1;
      const result = await catalogRepository.deleteProduct(id, bId);
      return successResponse(res, result, 200);
    } catch (err) {
      return errorResponse(res, err.code || 'PRODUCT_DELETE_ERROR', err.message, err.statusCode || 400);
    }
  }
}

module.exports = new CatalogController();
