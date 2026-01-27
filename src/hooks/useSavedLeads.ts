import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export type ContactStatus = 'not_contacted' | 'message_sent' | 'conversation_started';
export type InterestStatus = 'pending' | 'interested' | 'not_interested';
export type LeadStage = 'interested' | 'in_conversation' | 'follow_up_pending' | 'in_negotiation' | 'closed_won' | 'closed_lost';

export interface SavedLead {
  id: string;
  lead_id: string;
  name: string;
  address: string;
  phone: string;
  email?: string | null;
  instagram?: string | null;
  website?: string | null;
  responsible?: string | null;
  match_score: number;
  reasons: string[];
  revenue?: string | null;
  opened_date?: string | null;
  category: string;
  employee_count?: string | null;
  company_size?: string | null;
  has_whatsapp?: boolean;
  contact_status: ContactStatus;
  interest_status: InterestStatus;
  lead_stage: LeadStage;
  first_contact_date?: string | null;
  last_contact_date?: string | null;
  next_follow_up_date?: string | null;
  saved_at: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type SortOption = 'newest' | 'oldest' | 'alpha_asc' | 'alpha_desc';

const STORAGE_KEY = 'savedLeads_data';
const SORT_KEY = 'savedLeads_sortBy';
const NOTIFIED_KEY = 'savedLeads_notifiedToday';

const getStoredLeads = (): SavedLead[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const setStoredLeads = (leads: SavedLead[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
};

// Check if we already notified today to avoid spam
const hasNotifiedToday = (): boolean => {
  const today = new Date().toDateString();
  return localStorage.getItem(NOTIFIED_KEY) === today;
};

const markNotifiedToday = () => {
  localStorage.setItem(NOTIFIED_KEY, new Date().toDateString());
};

export const useSavedLeads = () => {
  const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    return (localStorage.getItem(SORT_KEY) as SortOption) || 'newest';
  });

  // Load leads from localStorage
  const fetchSavedLeads = useCallback(() => {
    setLoading(true);
    try {
      const leads = getStoredLeads();
      setSavedLeads(leads);
    } catch (error) {
      console.error('Error fetching saved leads:', error);
      toast.error('Erro ao carregar leads salvos');
    } finally {
      setLoading(false);
    }
  }, []);

  // Check for follow-up notifications on mount
  useEffect(() => {
    fetchSavedLeads();
  }, [fetchSavedLeads]);

  // Check follow-ups after leads are loaded
  useEffect(() => {
    if (loading || savedLeads.length === 0) return;
    if (hasNotifiedToday()) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayFollowUps = savedLeads.filter(lead => {
      if (!lead.next_follow_up_date) return false;
      const followUpDate = new Date(lead.next_follow_up_date);
      followUpDate.setHours(0, 0, 0, 0);
      return followUpDate.getTime() === today.getTime();
    });

    const overdueFollowUps = savedLeads.filter(lead => {
      if (!lead.next_follow_up_date) return false;
      const followUpDate = new Date(lead.next_follow_up_date);
      followUpDate.setHours(0, 0, 0, 0);
      return followUpDate.getTime() < today.getTime();
    });

    if (todayFollowUps.length > 0) {
      const names = todayFollowUps.map(l => l.name).slice(0, 3).join(', ');
      const extra = todayFollowUps.length > 3 ? ` e mais ${todayFollowUps.length - 3}` : '';
      toast.info(`📅 Hoje é dia de follow-up: ${names}${extra}`, {
        duration: 8000,
      });
    }

    if (overdueFollowUps.length > 0) {
      toast.warning(`⚠️ Você tem ${overdueFollowUps.length} follow-up(s) vencido(s)`, {
        duration: 6000,
      });
    }

    if (todayFollowUps.length > 0 || overdueFollowUps.length > 0) {
      markNotifiedToday();
    }
  }, [savedLeads, loading]);

  useEffect(() => {
    localStorage.setItem(SORT_KEY, sortBy);
  }, [sortBy]);

  const saveLead = useCallback((lead: {
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
  }) => {
    try {
      const currentLeads = getStoredLeads();
      
      // Check if already exists
      if (currentLeads.some(l => l.lead_id === lead.id)) {
        toast.info('Este lead já está salvo');
        return false;
      }

      const now = new Date().toISOString();
      const newLead: SavedLead = {
        id: crypto.randomUUID(),
        lead_id: lead.id,
        name: lead.name,
        address: lead.address,
        phone: lead.phone,
        email: lead.email || null,
        instagram: lead.instagram || null,
        website: lead.website || null,
        responsible: lead.responsible || null,
        match_score: lead.matchScore,
        reasons: lead.reasons,
        revenue: lead.revenue || null,
        opened_date: lead.openedDate || null,
        category: lead.category,
        employee_count: lead.employeeCount || null,
        company_size: lead.companySize || null,
        has_whatsapp: lead.hasWhatsApp || false,
        contact_status: 'conversation_started',
        interest_status: 'interested',
        lead_stage: 'interested',
        first_contact_date: null,
        last_contact_date: null,
        next_follow_up_date: null,
        saved_at: now,
        notes: null,
        created_at: now,
        updated_at: now,
      };

      const updatedLeads = [...currentLeads, newLead];
      setStoredLeads(updatedLeads);
      setSavedLeads(updatedLeads);
      
      toast.success('Lead salvo com sucesso!');
      return true;
    } catch (error) {
      console.error('Error saving lead:', error);
      toast.error('Erro ao salvar lead');
      return false;
    }
  }, []);

  const updateLead = useCallback((id: string, updates: Partial<SavedLead>) => {
    try {
      const currentLeads = getStoredLeads();
      const updatedLeads = currentLeads.map(lead => 
        lead.id === id ? { ...lead, ...updates, updated_at: new Date().toISOString() } : lead
      );
      
      setStoredLeads(updatedLeads);
      setSavedLeads(updatedLeads);
      return true;
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Erro ao atualizar lead');
      return false;
    }
  }, []);

  const deleteLead = useCallback((id: string) => {
    try {
      const currentLeads = getStoredLeads();
      const updatedLeads = currentLeads.filter(lead => lead.id !== id);
      
      setStoredLeads(updatedLeads);
      setSavedLeads(updatedLeads);
      toast.success('Lead removido');
      return true;
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast.error('Erro ao remover lead');
      return false;
    }
  }, []);

  const isLeadSaved = useCallback((leadId: string) => {
    return savedLeads.some(lead => lead.lead_id === leadId);
  }, [savedLeads]);

  const getSortedLeads = useCallback(() => {
    const sorted = [...savedLeads];
    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.saved_at).getTime() - new Date(b.saved_at).getTime());
      case 'alpha_asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'alpha_desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return sorted;
    }
  }, [savedLeads, sortBy]);

  return {
    savedLeads,
    loading,
    saveLead,
    updateLead,
    deleteLead,
    isLeadSaved,
    refetch: fetchSavedLeads,
    sortBy,
    setSortBy,
    getSortedLeads,
  };
};
