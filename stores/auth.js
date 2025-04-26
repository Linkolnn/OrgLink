import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isAuthenticated: false,
    user: null,
    token: null
  }),
  
  getters: {
    isAdmin: (state) => {
      const hasAdminRole = state.user && state.user.role === 'admin';
      return hasAdminRole;
    }
  },
  
  actions: {
    async checkAuth() {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          this.isAuthenticated = false;
          this.user = null;
          return false;
        }
        
        this.token = token;
        
        const response = await $fetch('http://localhost:5000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response) {
          this.user = response;
          this.isAuthenticated = true;
          return true;
        }
        
        return false;
      } catch (error) {
        this.logout();
        return false;
      }
    },
    
    setUser(userData) {
      this.user = userData;
      this.isAuthenticated = true;
    },
    
    setToken(token) {
      this.token = token;
      localStorage.setItem('token', token);
    },
    
    setAuthenticated(status) {
      this.isAuthenticated = status;
    },
    
    logout() {
      this.isAuthenticated = false;
      this.user = null;
      this.token = null;
      localStorage.removeItem('token');
    },
  },
});