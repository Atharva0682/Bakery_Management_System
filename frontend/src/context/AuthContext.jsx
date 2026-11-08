import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';
import { useBusiness } from './BusinessContext';

const AuthContext = createContext();

const DEFAULT_BUSINESS_SLUG = import.meta.env.VITE_DEFAULT_BUSINESS_SLUG || 'crumbandco';

/**
 * Storage key mapping per portal scope
 */
export const PORTAL_SCOPES = {
  OWNER: 'owner',
  STAFF: 'staff',
  CUSTOMER: 'customer',
};

export const getStorageKey = (scope) => {
  switch (scope) {
    case 'owner':
      return 'crumb_token_owner';
    case 'staff':
      return 'crumb_token_staff';
    case 'customer':
    default:
      return 'crumb_token_customer';
  }
};

export const getUserStorageKey = (scope) => {
  switch (scope) {
    case 'owner':
      return 'crumb_user_owner';
    case 'staff':
      return 'crumb_user_staff';
    case 'customer':
    default:
      return 'crumb_user_customer';
  }
};

/**
 * Helper to determine portal scope from URL pathname
 */
export const getPortalScopeFromPath = (pathname = '') => {
  const path = (pathname || '').toLowerCase();
  if (path.startsWith('/owner')) return 'owner';
  if (path.startsWith('/staff')) return 'staff';
  return 'customer';
};

/**
 * Helper to determine target portal scope from verified backend user role
 */
export const getScopeFromRole = (role = '') => {
  const r = (role || '').toLowerCase();
  if (r === 'owner' || r === 'manager') return 'owner';
  if (r === 'baker' || r === 'staff') return 'staff';
  return 'customer';
};

/**
 * Safely decodes non-sensitive JWT claims without external library
 */
const decodeTokenPayload = (token) => {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const jsonStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
};

/**
 * One-time migration: segregate legacy un-scoped crumb_token into role-specific key
 */
const migrateLegacyToken = () => {
  try {
    const legacyToken = localStorage.getItem('crumb_token');
    if (!legacyToken) return;

    const payload = decodeTokenPayload(legacyToken);
    if (payload?.role) {
      const scope = getScopeFromRole(payload.role);
      const targetKey = getStorageKey(scope);
      if (!localStorage.getItem(targetKey)) {
        localStorage.setItem(targetKey, legacyToken);
      }
    }
    // Remove ambiguous shared key to prevent cross-account pollution
    localStorage.removeItem('crumb_token');
  } catch (e) {
    console.warn('[AuthContext] Legacy token migration notice:', e);
  }
};

// Run migration immediately on module load
if (typeof window !== 'undefined') {
  migrateLegacyToken();
}

/**
 * Helper to extract initials from name (e.g. Priya Sharma -> PS)
 */
const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

export const AuthProvider = ({ children }) => {
  const { slug } = useBusiness();
  const location = useLocation();

  // Active portal determined dynamically by URL route
  const currentScope = useMemo(
    () => getPortalScopeFromPath(location.pathname),
    [location.pathname]
  );

  // Isolated multi-portal session state
  const [sessions, setSessions] = useState(() => ({
    owner: {
      token: localStorage.getItem('crumb_token_owner') || null,
      user: null,
      business: null,
      isLoading: !!localStorage.getItem('crumb_token_owner'),
    },
    staff: {
      token: localStorage.getItem('crumb_token_staff') || null,
      user: null,
      business: null,
      isLoading: !!localStorage.getItem('crumb_token_staff'),
    },
    customer: {
      token: localStorage.getItem('crumb_token_customer') || null,
      user: null,
      business: null,
      isLoading: !!localStorage.getItem('crumb_token_customer'),
    },
  }));

  const [serverTimeOffset, setServerTimeOffset] = useState(0);

  const syncServerTime = (serverTimeStr) => {
    if (serverTimeStr) {
      const serverMs = new Date(serverTimeStr).getTime();
      if (!isNaN(serverMs)) {
        setServerTimeOffset(serverMs - Date.now());
      }
    }
  };

  const getServerTime = () => {
    return new Date(Date.now() + serverTimeOffset);
  };

  /**
   * Validates a token against backend /api/auth/me and returns formatted profile
   */
  const verifyTokenWithServer = useCallback(async (token) => {
    if (!token) return null;
    try {
      const res = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res && res.success && res.data?.user) {
        if (res.data.server_time) {
          syncServerTime(res.data.server_time);
        }
        const authUser = res.data.user;
        return {
          user: {
            ...authUser,
            initials: getInitials(authUser.name),
            crumbPoints: authUser.crumbPoints || 50,
          },
          business: res.data.business || null,
        };
      }
      return null;
    } catch (err) {
      return null;
    }
  }, []);

  /**
   * Refreshes a specific portal's session from the server
   */
  const refreshScopeSession = useCallback(
    async (scope) => {
      const storageKey = getStorageKey(scope);
      const token = localStorage.getItem(storageKey);

      if (!token) {
        setSessions((prev) => ({
          ...prev,
          [scope]: { token: null, user: null, business: null, isLoading: false },
        }));
        return null;
      }

      setSessions((prev) => ({
        ...prev,
        [scope]: { ...prev[scope], isLoading: true },
      }));

      const verification = await verifyTokenWithServer(token);
      if (verification) {
        setSessions((prev) => ({
          ...prev,
          [scope]: {
            token,
            user: verification.user,
            business: verification.business,
            isLoading: false,
          },
        }));
        return verification.user;
      } else {
        // Token invalid or expired - clear only this specific portal's token
        localStorage.removeItem(storageKey);
        localStorage.removeItem(getUserStorageKey(scope));
        setSessions((prev) => ({
          ...prev,
          [scope]: { token: null, user: null, business: null, isLoading: false },
        }));
        return null;
      }
    },
    [verifyTokenWithServer]
  );

  /**
   * On mount and when portal scope changes:
   * Ensure active portal's session is verified first, followed by others in background.
   */
  useEffect(() => {
    let isMounted = true;

    const initSessions = async () => {
      const scopes = ['owner', 'staff', 'customer'];
      // Prioritize current active portal first
      const orderedScopes = [
        currentScope,
        ...scopes.filter((s) => s !== currentScope),
      ];

      for (const scope of orderedScopes) {
        const token = localStorage.getItem(getStorageKey(scope));
        if (token) {
          const verification = await verifyTokenWithServer(token);
          if (isMounted) {
            if (verification) {
              setSessions((prev) => ({
                ...prev,
                [scope]: {
                  token,
                  user: verification.user,
                  business: verification.business,
                  isLoading: false,
                },
              }));
            } else {
              localStorage.removeItem(getStorageKey(scope));
              localStorage.removeItem(getUserStorageKey(scope));
              setSessions((prev) => ({
                ...prev,
                [scope]: { token: null, user: null, business: null, isLoading: false },
              }));
            }
          }
        } else if (isMounted) {
          setSessions((prev) => ({
            ...prev,
            [scope]: { ...prev[scope], isLoading: false },
          }));
        }
      }
    };

    initSessions();

    return () => {
      isMounted = false;
    };
  }, [currentScope, verifyTokenWithServer]);

  /**
   * Multi-tab synchronization & 401 session invalidation event listener
   * Strictly respects scope isolation so other portals are never affected!
   */
  useEffect(() => {
    const handleAuthInvalid = (e) => {
      const targetScope = e.detail?.scope || currentScope;
      setSessions((prev) => ({
        ...prev,
        [targetScope]: { token: null, user: null, business: null, isLoading: false },
      }));
      localStorage.removeItem(getStorageKey(targetScope));
      localStorage.removeItem(getUserStorageKey(targetScope));
    };

    const handleStorageChange = (e) => {
      if (e.key === 'crumb_token_owner') {
        if (!e.newValue) {
          setSessions((prev) => ({
            ...prev,
            owner: { token: null, user: null, business: null, isLoading: false },
          }));
        } else if (e.newValue !== sessions.owner.token) {
          refreshScopeSession('owner');
        }
      } else if (e.key === 'crumb_token_staff') {
        if (!e.newValue) {
          setSessions((prev) => ({
            ...prev,
            staff: { token: null, user: null, business: null, isLoading: false },
          }));
        } else if (e.newValue !== sessions.staff.token) {
          refreshScopeSession('staff');
        }
      } else if (e.key === 'crumb_token_customer') {
        if (!e.newValue) {
          setSessions((prev) => ({
            ...prev,
            customer: { token: null, user: null, business: null, isLoading: false },
          }));
        } else if (e.newValue !== sessions.customer.token) {
          refreshScopeSession('customer');
        }
      }
    };

    window.addEventListener('crumb-auth-invalid', handleAuthInvalid);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('crumb-auth-invalid', handleAuthInvalid);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentScope, refreshScopeSession, sessions.owner.token, sessions.staff.token, sessions.customer.token]);

  /**
   * Log in user (customer, worker, or owner) against backend auth API
   * Stores credentials strictly into the target role's portal session!
   */
  const login = async (identifier, password, businessSlug = null) => {
    const targetSlug = businessSlug || slug || DEFAULT_BUSINESS_SLUG;
    try {
      const res = await api.post('/auth/login', {
        identifier: identifier?.trim(),
        password,
        businessSlug: targetSlug,
      });

      if (res && res.success && res.data) {
        if (res.data.server_time) {
          syncServerTime(res.data.server_time);
        }
        const { token: jwtToken, user: authUser, business: authBusiness } = res.data;
        const verifiedRole = authUser.role;
        const targetScope = getScopeFromRole(verifiedRole);

        const formattedUser = {
          ...authUser,
          initials: getInitials(authUser.name),
          crumbPoints: authUser.crumbPoints || 50,
        };

        // Save strictly to the verified role's scoped storage key
        localStorage.setItem(getStorageKey(targetScope), jwtToken);
        localStorage.setItem(getUserStorageKey(targetScope), JSON.stringify(formattedUser));

        setSessions((prev) => ({
          ...prev,
          [targetScope]: {
            token: jwtToken,
            user: formattedUser,
            business: authBusiness || null,
            isLoading: false,
          },
        }));

        return {
          success: true,
          user: formattedUser,
          role: verifiedRole,
          targetScope,
          isOutsideShift: authUser.is_outside_shift,
        };
      }
      return { success: false, message: 'Invalid response from authentication service.' };
    } catch (err) {
      return {
        success: false,
        code: err.code || 'LOGIN_FAILED',
        message: err.message || 'Invalid email/phone or password.',
      };
    }
  };

  /**
   * Register a new customer under the current active business tenant
   */
  const register = async ({ name, email, phone, password, businessSlug = null }) => {
    const targetSlug = businessSlug || slug || DEFAULT_BUSINESS_SLUG;
    try {
      const res = await api.post('/auth/register', {
        name: name?.trim(),
        email: email ? email.trim() : undefined,
        phone: phone?.trim(),
        password,
        businessSlug: targetSlug,
      });

      if (res && res.success && res.data) {
        const { token: jwtToken, user: authUser, business: authBusiness } = res.data;
        const formattedUser = {
          ...authUser,
          initials: getInitials(authUser.name),
          crumbPoints: 50,
        };

        localStorage.setItem('crumb_token_customer', jwtToken);
        localStorage.setItem('crumb_user_customer', JSON.stringify(formattedUser));

        setSessions((prev) => ({
          ...prev,
          customer: {
            token: jwtToken,
            user: formattedUser,
            business: authBusiness || null,
            isLoading: false,
          },
        }));

        return { success: true, user: formattedUser };
      }
      return { success: false, message: 'Invalid response from registration service.' };
    } catch (err) {
      return {
        success: false,
        code: err.code || 'REGISTRATION_FAILED',
        message: err.message || 'Unable to create account.',
      };
    }
  };

  /**
   * Terminate user session strictly for the current (or specified) portal scope!
   * Signing out Customer will NEVER sign out Owner or Baker, and vice versa!
   */
  const logout = (targetScope = null) => {
    const scopeToLogout = targetScope || currentScope;
    const storageKey = getStorageKey(scopeToLogout);
    const userKey = getUserStorageKey(scopeToLogout);

    localStorage.removeItem(storageKey);
    localStorage.removeItem(userKey);
    if (scopeToLogout === 'customer') {
      localStorage.removeItem('crumb_token'); // clean legacy fallback
    }

    setSessions((prev) => ({
      ...prev,
      [scopeToLogout]: {
        token: null,
        user: null,
        business: null,
        isLoading: false,
      },
    }));

    window.dispatchEvent(
      new CustomEvent('crumb-auth-invalid', {
        detail: { scope: scopeToLogout, reason: 'EXPLICIT_LOGOUT' },
      })
    );
  };

  /**
   * Update active user in session state
   */
  const updateUser = (updatedFields, targetScope = null) => {
    const scope = targetScope || currentScope;
    setSessions((prev) => {
      const current = prev[scope];
      if (!current.user) return prev;
      const nextUser = { ...current.user, ...updatedFields };
      if (updatedFields.name) {
        nextUser.initials = getInitials(updatedFields.name);
      }
      localStorage.setItem(getUserStorageKey(scope), JSON.stringify(nextUser));
      return {
        ...prev,
        [scope]: { ...current, user: nextUser },
      };
    });
  };

  // Derive active session values based on current active route
  const activeSession = sessions[currentScope] || sessions.customer;
  const activeUser = activeSession.user;
  const activeToken = activeSession.token;
  const activeBusiness = activeSession.business;

  return (
    <AuthContext.Provider
      value={{
        // Active portal route session (used seamlessly by all existing components)
        user: activeUser,
        token: activeToken,
        business: activeBusiness,
        isAuthenticated: !!activeUser && !!activeToken,
        isLoading: activeSession.isLoading,
        role: activeUser?.role || (currentScope === 'customer' ? 'customer' : currentScope),
        businessId: activeUser?.business_id || activeBusiness?.id || null,
        portalScope: currentScope,

        // Specific isolated portal sessions (for cross-checking or portals switcher)
        ownerUser: sessions.owner.user,
        staffUser: sessions.staff.user,
        customerUser: sessions.customer.user,
        isOwnerAuthenticated: !!sessions.owner.user && !!sessions.owner.token,
        isStaffAuthenticated: !!sessions.staff.user && !!sessions.staff.token,
        isCustomerAuthenticated: !!sessions.customer.user && !!sessions.customer.token,

        // Actions
        serverTimeOffset,
        getServerTime,
        refreshAuthUser: () => refreshScopeSession(currentScope),
        refreshScope: refreshScopeSession,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
