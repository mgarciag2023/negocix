import { useState, useEffect, useCallback } from 'react';

export type ContactStatus = 'not_contacted' | 'message_sent' | 'conversation_started';
export type InterestStatus = 'pending' | 'interested' | 'not_interested';

interface LeadContactState {
  contactStatus: ContactStatus;
  interestStatus: InterestStatus;
}

const CONTACT_STATES_KEY = 'leadfinder_contact_states';

export const useLeadContactState = () => {
  const [contactStates, setContactStates] = useState<Record<string, LeadContactState>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONTACT_STATES_KEY);
      if (stored) {
        setContactStates(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading contact states:', error);
    }
  }, []);

  const saveStates = useCallback((newStates: Record<string, LeadContactState>) => {
    try {
      localStorage.setItem(CONTACT_STATES_KEY, JSON.stringify(newStates));
      setContactStates(newStates);
    } catch (error) {
      console.error('Error saving contact states:', error);
    }
  }, []);

  const getContactState = useCallback((leadId: string): LeadContactState => {
    return contactStates[leadId] || { contactStatus: 'not_contacted', interestStatus: 'pending' };
  }, [contactStates]);

  const setContactStatus = useCallback((leadId: string, status: ContactStatus) => {
    const current = contactStates[leadId] || { contactStatus: 'not_contacted', interestStatus: 'pending' };
    const newStates = {
      ...contactStates,
      [leadId]: {
        ...current,
        contactStatus: status,
        // Reset interest if moving away from conversation_started
        interestStatus: status !== 'conversation_started' ? 'pending' as InterestStatus : current.interestStatus,
      },
    };
    saveStates(newStates);
  }, [contactStates, saveStates]);

  const setInterestStatus = useCallback((leadId: string, status: InterestStatus) => {
    const current = contactStates[leadId] || { contactStatus: 'not_contacted', interestStatus: 'pending' };
    const newStates = {
      ...contactStates,
      [leadId]: {
        ...current,
        interestStatus: status,
      },
    };
    saveStates(newStates);
  }, [contactStates, saveStates]);

  return {
    getContactState,
    setContactStatus,
    setInterestStatus,
  };
};
