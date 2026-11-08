const recipeRepository = require('../models/recipeRepository');
const { successResponse, errorResponse } = require('../utils/response');

class RecipeController {
  async getAllRecipes(req, res) {
    try {
      const businessId = req.user?.business_id || 1;
      const recipes = await recipeRepository.getAllRecipes(businessId);
      return successResponse(res, recipes, 200);
    } catch (err) {
      return errorResponse(res, 'RECIPES_ERROR', err.message, 500);
    }
  }

  async createRecipe(req, res) {
    try {
      const businessId = req.user?.business_id || 1;
      const created = await recipeRepository.createRecipe({ ...req.body, business_id: businessId });

      return successResponse(res, created, 201);
    } catch (err) {
      return errorResponse(res, 'CREATE_RECIPE_ERROR', err.message, 400);
    }
  }

  async updateRecipe(req, res) {
    try {
      const updated = await recipeRepository.updateRecipe(req.params.id, req.body, req.user.business_id);
      return successResponse(res, updated, 200);
    } catch (err) {
      return errorResponse(res, 'UPDATE_RECIPE_ERROR', err.message, 400);
    }
  }

  async scaleRecipe(req, res) {
    try {
      const businessId = req.user?.business_id || 1;
      const scaled = await recipeRepository.scaleRecipeForProduction(req.params.id, req.body, businessId);
      return successResponse(res, scaled, 200);
    } catch (err) {
      return errorResponse(res, 'SCALE_RECIPE_ERROR', err.message, 400);
    }
  }

  async deleteRecipe(req, res) {
    try {
      const businessId = req.user?.business_id || 1;
      const result = await recipeRepository.deleteRecipe(req.params.id, businessId);
      return successResponse(res, result, 200);
    } catch (err) {
      return errorResponse(res, 'DELETE_RECIPE_ERROR', err.message, 400);
    }
  }
}

module.exports = new RecipeController();
