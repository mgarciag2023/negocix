import { useState } from 'react';
import { Users, ArrowUpDown, Filter, Search, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useSavedLeads, LeadStage, SortOption } from '@/hooks/useSavedLeads';
import SavedLeadCard from '@/components/SavedLeadCard';
import { Link } from 'react-router-dom';

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: '🆕 Mais recentes' },
  { value: 'oldest', label: '🕒 Mais antigos' },
  { value: 'alpha_asc', label: '🔤 A → Z' },
  { value: 'alpha_desc', label: '🔠 Z → A' },
];

const stageOptions: { value: LeadStage | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'interested', label: 'Interessado' },
  { value: 'in_conversation', label: 'Em conversa' },
  { value: 'follow_up_pending', label: 'Follow-up pendente' },
  { value: 'in_negotiation', label: 'Em negociação' },
  { value: 'closed_won', label: 'Fechado (ganho)' },
  { value: 'closed_lost', label: 'Fechado (perdido)' },
];

const SavedLeads = () => {
  const { loading, updateLead, deleteLead, sortBy, setSortBy, getSortedLeads } = useSavedLeads();
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  const sortedLeads = getSortedLeads();

  // Apply filters
  const filteredLeads = sortedLeads.filter(lead => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!lead.name.toLowerCase().includes(query) && 
          !lead.category.toLowerCase().includes(query) &&
          !lead.address.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    // Stage filter
    if (stageFilter !== 'all' && lead.lead_stage !== stageFilter) {
      return false;
    }
    
    // Overdue filter
    if (showOverdueOnly) {
      if (!lead.next_follow_up_date) return false;
      const followUpDate = new Date(lead.next_follow_up_date);
      if (followUpDate >= new Date()) return false;
    }
    
    return true;
  });

  const overdueCount = sortedLeads.filter(lead => {
    if (!lead.next_follow_up_date) return false;
    return new Date(lead.next_follow_up_date) < new Date();
  }).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Leads Salvos</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            {sortedLeads.length > 0 
              ? `${sortedLeads.length} lead${sortedLeads.length > 1 ? 's' : ''} interessado${sortedLeads.length > 1 ? 's' : ''}`
              : 'Leads que demonstraram interesse'
            }
            {overdueCount > 0 && (
              <span className="text-destructive ml-2">
                • {overdueCount} follow-up{overdueCount > 1 ? 's' : ''} vencido{overdueCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, categoria ou endereço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-full md:w-[180px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Stage Filter */}
          <Select value={stageFilter} onValueChange={(value: LeadStage | 'all') => setStageFilter(value)}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {stageOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* More Filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full md:w-auto">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
                {showOverdueOnly && <span className="ml-1 text-xs bg-destructive text-destructive-foreground rounded-full px-1.5">1</span>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Filtros Avançados</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={showOverdueOnly}
                onCheckedChange={setShowOverdueOnly}
              >
                Apenas follow-ups vencidos
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted mb-6">
              <Users className="h-12 w-12 text-muted-foreground" />
            </div>
            {sortedLeads.length === 0 ? (
              <>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Nenhum lead salvo ainda
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md text-sm">
                  Quando você encontrar leads interessados durante a prospecção, eles aparecerão aqui
                </p>
                <Button asChild>
                  <Link to="/configuracao">
                    Buscar Leads
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Nenhum lead encontrado
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md text-sm">
                  Tente ajustar os filtros de busca
                </p>
                <Button variant="outline" onClick={() => { setSearchQuery(''); setStageFilter('all'); setShowOverdueOnly(false); }}>
                  Limpar Filtros
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredLeads.map((lead) => (
              <SavedLeadCard
                key={lead.id}
                lead={lead}
                onUpdate={updateLead}
                onDelete={deleteLead}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default SavedLeads;
