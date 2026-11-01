const userRepository = require('../models/userRepository');
const addressRepository = require('../models/addressRepository');
const { sanitizeUser } = require('../utils/security');

class CustomerService {
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error('Customer profile not found.');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }
    return sanitizeUser(user);
  }

  async updateProfile(userId, updates) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error('Customer not found.');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Role cannot be changed by customer
    if (updates.role !== undefined && updates.role !== user.role) {
      const err = new Error('Forbidden: Modifying user role is strictly prohibited.');
      err.code = 'ROLE_IMMUTABLE';
      err.statusCode = 403;
      throw err;
    }

    // Business assignment cannot be changed
    if (updates.business_id !== undefined && Number(updates.business_id) !== Number(user.business_id)) {
      const err = new Error('Forbidden: Modifying business association is strictly prohibited.');
      err.code = 'BUSINESS_IMMUTABLE';
      err.statusCode = 403;
      throw err;
    }

    // User ID cannot be modified
    if (updates.id !== undefined && Number(updates.id) !== Number(user.id)) {
      const err = new Error('Forbidden: User ID cannot be modified.');
      err.code = 'ID_IMMUTABLE';
      err.statusCode = 403;
      throw err;
    }

    // Validation
    const sanitizedUpdates = {};
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || !updates.name.trim()) {
        const err = new Error('Name cannot be empty.');
        err.code = 'VALIDATION_ERROR';
        err.statusCode = 400;
        throw err;
      }
      sanitizedUpdates.name = updates.name.trim();
    }

    if (updates.phone !== undefined) {
      if (typeof updates.phone !== 'string' || updates.phone.trim().length < 8) {
        const err = new Error('A valid phone number is required.');
        err.code = 'VALIDATION_ERROR';
        err.statusCode = 400;
        throw err;
      }
      sanitizedUpdates.phone = updates.phone.trim();
    }

    const updatedUser = await userRepository.update(userId, sanitizedUpdates);
    return sanitizeUser(updatedUser || user);
  }

  async getAddresses(userId, businessId) {
    return addressRepository.getByUserId(userId, businessId);
  }

  async createAddress(userId, businessId, addressData) {
    if (
      !addressData.address_line1 ||
      !addressData.address_line1.trim() ||
      !addressData.city ||
      !addressData.city.trim() ||
      !addressData.postal_code ||
      !addressData.postal_code.trim() ||
      !addressData.contact_phone ||
      !addressData.contact_phone.trim()
    ) {
      const err = new Error('Street address, city, postal code, and contact phone are required.');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    return addressRepository.create({
      business_id: businessId,
      user_id: userId,
      label: addressData.label ? addressData.label.trim() : 'Home',
      address_line1: addressData.address_line1.trim(),
      address_line2: addressData.address_line2 ? addressData.address_line2.trim() : null,
      city: addressData.city.trim(),
      postal_code: addressData.postal_code.trim(),
      contact_phone: addressData.contact_phone.trim(),
      is_default: Boolean(addressData.is_default),
    });
  }

  async updateAddress(userId, businessId, addressId, updates) {
    const existing = await addressRepository.getById(addressId, userId, businessId);
    if (!existing) {
      const err = new Error('Address not found or unauthorized.');
      err.code = 'ADDRESS_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (updates.address_line1 !== undefined && (!updates.address_line1 || !updates.address_line1.trim())) {
      const err = new Error('Street address cannot be empty.');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    if (updates.city !== undefined && (!updates.city || !updates.city.trim())) {
      const err = new Error('City cannot be empty.');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    if (updates.postal_code !== undefined && (!updates.postal_code || !updates.postal_code.trim())) {
      const err = new Error('Postal code cannot be empty.');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    if (updates.contact_phone !== undefined && (!updates.contact_phone || !updates.contact_phone.trim())) {
      const err = new Error('Contact phone cannot be empty.');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      throw err;
    }

    const cleanUpdates = {};
    if (updates.label !== undefined) cleanUpdates.label = updates.label.trim();
    if (updates.address_line1 !== undefined) cleanUpdates.address_line1 = updates.address_line1.trim();
    if (updates.address_line2 !== undefined) cleanUpdates.address_line2 = updates.address_line2 ? updates.address_line2.trim() : null;
    if (updates.city !== undefined) cleanUpdates.city = updates.city.trim();
    if (updates.postal_code !== undefined) cleanUpdates.postal_code = updates.postal_code.trim();
    if (updates.contact_phone !== undefined) cleanUpdates.contact_phone = updates.contact_phone.trim();
    if (updates.is_default !== undefined) cleanUpdates.is_default = Boolean(updates.is_default);

    const updated = await addressRepository.update(addressId, userId, businessId, cleanUpdates);
    return updated;
  }

  async setDefaultAddress(userId, businessId, addressId) {
    const existing = await addressRepository.getById(addressId, userId, businessId);
    if (!existing) {
      const err = new Error('Address not found or unauthorized.');
      err.code = 'ADDRESS_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return addressRepository.setDefault(addressId, userId, businessId);
  }

  async deleteAddress(userId, businessId, addressId) {
    const existing = await addressRepository.getById(addressId, userId, businessId);
    if (!existing) {
      const err = new Error('Address not found or unauthorized.');
      err.code = 'ADDRESS_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const deleted = await addressRepository.delete(addressId, userId, businessId);
    if (!deleted) {
      const err = new Error('Address not found or unauthorized.');
      err.code = 'ADDRESS_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }
    return { success: true, message: 'Address removed successfully.' };
  }
}

module.exports = new CustomerService();
