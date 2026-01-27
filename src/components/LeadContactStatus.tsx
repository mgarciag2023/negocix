import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { MessageSquare, Send, MessageCircle, ThumbsUp, ThumbsDown, Save, ChevronDown } from 'lucide-react';
import { ContactStatus, InterestStatus } from '@/hooks/useSavedLeads';

interface LeadContactStatusProps {
  leadId: string;
  contactStatus: ContactStatus;
  interestStatus: InterestStatus;
  onContactStatusChange: (status: ContactStatus) => void;
  onInterestStatusChange: (status: InterestStatus) => void;
  onSaveLead: () => void;
  canSave: boolean;
}

const contactStatusLabels: Record<ContactStatus, { label: string; icon: React.ReactNode; color: string }> = {
  not_contacted: { label: 'Não contatado', icon: <MessageSquare className="h-3 w-3" />, color: 'bg-muted text-muted-foreground' },
  message_sent: { label: 'Mensagem enviada', icon: <Send className="h-3 w-3" />, color: 'bg-blue-100 text-blue-700' },
  conversation_started: { label: 'Conversa iniciada', icon: <MessageCircle className="h-3 w-3" />, color: 'bg-green-100 text-green-700' },
};

const interestStatusLabels: Record<InterestStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: 'Pendente', icon: null, color: 'bg-muted text-muted-foreground' },
  interested: { label: 'Interessado', icon: <ThumbsUp className="h-3 w-3" />, color: 'bg-success text-success-foreground' },
  not_interested: { label: 'Não interessado', icon: <ThumbsDown className="h-3 w-3" />, color: 'bg-destructive/10 text-destructive' },
};

const LeadContactStatus = ({
  contactStatus,
  interestStatus,
  onContactStatusChange,
  onInterestStatusChange,
  onSaveLead,
  canSave,
}: LeadContactStatusProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentContactStatus = contactStatusLabels[contactStatus];
  const canClassifyInterest = contactStatus === 'conversation_started';

  return (
    <div className="flex flex-col gap-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8">
            <span className="flex items-center gap-1.5">
              {currentContactStatus.icon}
              {currentContactStatus.label}
            </span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs">Status de Contato</DropdownMenuLabel>
          {Object.entries(contactStatusLabels).map(([status, { label, icon }]) => (
            <DropdownMenuItem
              key={status}
              onClick={() => {
                onContactStatusChange(status as ContactStatus);
                if (status !== 'conversation_started') {
                  onInterestStatusChange('pending');
                }
              }}
              className="text-xs"
            >
              <span className="flex items-center gap-2">
                {icon}
                {label}
              </span>
              {contactStatus === status && <span className="ml-auto">✓</span>}
            </DropdownMenuItem>
          ))}
          
          {canClassifyInterest && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Classificar Interesse</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onInterestStatusChange('interested')}
                className="text-xs text-green-600"
              >
                <ThumbsUp className="h-3 w-3 mr-2" />
                Demonstrou interesse
                {interestStatus === 'interested' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onInterestStatusChange('not_interested')}
                className="text-xs text-destructive"
              >
                <ThumbsDown className="h-3 w-3 mr-2" />
                Não demonstrou interesse
                {interestStatus === 'not_interested' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Interest badge when classified */}
      {canClassifyInterest && interestStatus !== 'pending' && (
        <Badge className={`${interestStatusLabels[interestStatus].color} text-xs justify-center`}>
          {interestStatusLabels[interestStatus].icon}
          <span className="ml-1">{interestStatusLabels[interestStatus].label}</span>
        </Badge>
      )}

      {/* Save button - only when interested */}
      {canSave && interestStatus === 'interested' && (
        <Button
          size="sm"
          className="w-full h-8 text-xs bg-primary"
          onClick={onSaveLead}
        >
          <Save className="h-3 w-3 mr-1" />
          Salvar Lead Interessado
        </Button>
      )}
    </div>
  );
};

export default LeadContactStatus;
