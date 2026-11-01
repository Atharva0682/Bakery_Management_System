/**
 * Application Constants — Crumb&Co. Bakery
 * Sourced directly from Figma design text & mock data
 */

export const BRAND = {
  name: 'Crumb&Co.',
  shortName: 'C',
  tagline: 'Authentic & Handcrafted',
  subtitle: 'Freshly Baked, Delivered with Love',
  description:
    'Smart, warm, and handcrafted Indian bakery experience. Freshness in every single bite, straight from our traditional clay and deck ovens to your home.',
  phone: '+91 98765 43210',
  email: 'order@crumbandco.in',
  address: 'Bandra West, Mumbai',
  fssai: '12245087001234',
  copyrightYear: 2025,
};

export const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Menu', path: '/menu' },
  { label: 'Orders', path: '/orders' },
  { label: 'Cart', path: '/cart', showBadge: true },
];

export const CATEGORIES = [
  { id: 'all', name: 'All', icon: 'Sparkles' },
  { id: 'cakes', name: 'Cakes', icon: 'Cake' },
  { id: 'pastries', name: 'Pastries', icon: 'Croissant' },
  { id: 'breads', name: 'Breads', icon: 'Wheat' },
  { id: 'cookies', name: 'Cookies', icon: 'Cookie' },
  { id: 'savory', name: 'Savory', icon: 'Pizza' },
  { id: 'beverages', name: 'Beverages', icon: 'Coffee' },
];

export const ORDER_STAGES = [
  'Order Placed',
  'Accepted',
  'In Production',
  'Packaged',
  'Out for Delivery',
  'Delivered',
];
