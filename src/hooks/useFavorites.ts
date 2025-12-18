import { useState, useEffect, useCallback } from 'react';

export interface FavoriteLead {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  instagram?: string;
  website?: string | null;
  responsible?: string;
  matchScore: number;
  reasons: string[];
  revenue?: string;
  openedDate?: string;
  category: string;
  employeeCount?: string;
  companySize?: string;
  hasWhatsApp?: boolean;
}

const FAVORITES_KEY = 'leadfinder_favorites';

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<FavoriteLead[]>([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        setFavorites(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites: FavoriteLead[]) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }, []);

  const addFavorite = useCallback((lead: FavoriteLead) => {
    setFavorites((prev) => {
      if (prev.some((f) => f.id === lead.id)) {
        return prev;
      }
      const newFavorites = [...prev, lead];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const removeFavorite = useCallback((leadId: string) => {
    setFavorites((prev) => {
      const newFavorites = prev.filter((f) => f.id !== leadId);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const isFavorite = useCallback((leadId: string) => {
    return favorites.some((f) => f.id === leadId);
  }, [favorites]);

  const toggleFavorite = useCallback((lead: FavoriteLead) => {
    if (isFavorite(lead.id)) {
      removeFavorite(lead.id);
      return false;
    } else {
      addFavorite(lead);
      return true;
    }
  }, [isFavorite, removeFavorite, addFavorite]);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
  };
};
