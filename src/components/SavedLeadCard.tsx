import { useState } from 'react';
import { MapPin, Phone, Calendar, Clock, MessageSquare, Trash2, Edit2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { SavedLead, LeadStage } from '@/hooks/useSavedLeads';
import { format, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SavedLeadCardProps {
  lead: SavedLead;
  onUpdate: (id: string, updates: Partial<SavedLead>) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const stageLabels: Record<LeadStage, { label: string; color: string }> = {
  interested: { label: 'Interessado', color: 'bg-blue-100 text-blue-700' },
  in_conversation: { label: 'Em conversa', color: 'bg-purple-100 text-purple-700' },
  follow_up_pending: { label: 'Follow-up pendente', color: 'bg-yellow-100 text-yellow-700' },
  in_negotiation: { label: 'Em negociação', color: 'bg-orange-100 text-orange-700' },
  closed_won: { label: 'Fechado (ganho)', color: 'bg-success text-success-foreground' },
  closed_lost: { label: 'Fechado (perdido)', color: 'bg-destructive/10 text-destructive' },
};

const SavedLeadCard = ({ lead, onUpdate, onDelete }: SavedLeadCardProps) => {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(lead.notes || '');
  const [nextFollowUp, setNextFollowUp] = useState(lead.next_follow_up_date || '');

  const handleSaveNotes = async () => {
    const success = await onUpdate(lead.id, { notes });
    if (success) setIsEditingNotes(false);
  };

  const handleStageChange = async (stage: LeadStage) => {
    await onUpdate(lead.id, { 
      lead_stage: stage,
      last_contact_date: new Date().toISOString(),
    });
  };

  const handleFollowUpChange = async (date: string) => {
    setNextFollowUp(date);
    await onUpdate(lead.id, { next_follow_up_date: date || null });
  };

  const isFollowUpOverdue = lead.next_follow_up_date && isPast(parseISO(lead.next_follow_up_date));

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return null;
    }
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground truncate">{lead.name}</h3>
          <Badge variant="secondary" className="text-xs mt-1">{lead.category}</Badge>
        </div>
        
        <div className="flex items-center gap-1">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
            lead.match_score >= 85 ? 'bg-success text-success-foreground' :
            lead.match_score >= 70 ? 'bg-primary text-primary-foreground' :
            'bg-muted text-muted-foreground'
          }`}>
            {lead.match_score}
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover lead?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O lead será removido permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(lead.id)}>
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Contact Info */}
      <div className="space-y-1 mb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{lead.address}</span>
        </div>
        <div className="flex items-center gap-1">
          <Phone className="h-3 w-3" />
          <a href={`tel:${lead.phone}`} className="text-primary hover:underline">{lead.phone}</a>
        </div>
      </div>

      {/* Stage Selector */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground block mb-1">Status do Lead</label>
        <Select value={lead.lead_stage} onValueChange={handleStageChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(stageLabels).map(([stage, { label }]) => (
              <SelectItem key={stage} value={stage} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        {lead.first_contact_date && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>1º contato: {formatDate(lead.first_contact_date)?.split(' às')[0]}</span>
          </div>
        )}
        {lead.last_contact_date && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Último: {formatDate(lead.last_contact_date)?.split(' às')[0]}</span>
          </div>
        )}
      </div>

      {/* Follow-up Date */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground block mb-1">Próximo follow-up</label>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={nextFollowUp ? nextFollowUp.split('T')[0] : ''}
            onChange={(e) => handleFollowUpChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="h-8 text-xs"
          />
          {isFollowUpOverdue && (
            <Badge variant="destructive" className="text-xs">
              Vencido
            </Badge>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Anotações
          </label>
          {!isEditingNotes ? (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setIsEditingNotes(true)}>
              <Edit2 className="h-3 w-3 mr-1" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setIsEditingNotes(false); setNotes(lead.notes || ''); }}>
                <X className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-primary" onClick={handleSaveNotes}>
                <Save className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        {isEditingNotes ? (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Adicione suas anotações sobre este lead..."
            className="text-xs min-h-[60px]"
          />
        ) : (
          <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2 min-h-[40px]">
            {lead.notes || 'Sem anotações'}
          </p>
        )}
      </div>

      {/* Saved date */}
      <div className="text-[10px] text-muted-foreground mt-2 text-right">
        Salvo em {formatDate(lead.saved_at)}
      </div>
    </Card>
  );
};

export default SavedLeadCard;
