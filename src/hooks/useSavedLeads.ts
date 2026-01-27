import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

export const useSavedLeads = () => {
  const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    return (localStorage.getItem('savedLeads_sortBy') as SortOption) || 'newest';
  });

  const fetchSavedLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_leads')
        .select('*');
      
      if (error) throw error;
      
      // Type assertion since Supabase types may not be updated yet
      setSavedLeads((data as unknown as SavedLead[]) || []);
    } catch (error) {
      console.error('Error fetching saved leads:', error);
      toast.error('Erro ao carregar leads salvos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedLeads();
  }, [fetchSavedLeads]);

  useEffect(() => {
    localStorage.setItem('savedLeads_sortBy', sortBy);
  }, [sortBy]);

  const saveLead = useCallback(async (lead: {
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
      const { error } = await supabase
        .from('saved_leads')
        .insert({
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
          contact_status: 'conversation_started' as ContactStatus,
          interest_status: 'interested' as InterestStatus,
          lead_stage: 'interested' as LeadStage,
        });
      
      if (error) {
        if (error.code === '23505') {
          toast.info('Este lead já está salvo');
          return false;
        }
        throw error;
      }
      
      toast.success('Lead salvo com sucesso!');
      await fetchSavedLeads();
      return true;
    } catch (error) {
      console.error('Error saving lead:', error);
      toast.error('Erro ao salvar lead');
      return false;
    }
  }, [fetchSavedLeads]);

  const updateLead = useCallback(async (id: string, updates: Partial<SavedLead>) => {
    try {
      const { error } = await supabase
        .from('saved_leads')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
      
      setSavedLeads(prev => 
        prev.map(lead => lead.id === id ? { ...lead, ...updates } : lead)
      );
      return true;
    } catch (error) {
      console.error('Error updating lead:', error);
      toast.error('Erro ao atualizar lead');
      return false;
    }
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setSavedLeads(prev => prev.filter(lead => lead.id !== id));
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
