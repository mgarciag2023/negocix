import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Lista de cidades brasileiras mais comuns (expandível)
const brazilianCities = [
  // Capitais e grandes cidades
  "São Paulo, SP", "Rio de Janeiro, RJ", "Brasília, DF", "Salvador, BA",
  "Fortaleza, CE", "Belo Horizonte, MG", "Manaus, AM", "Curitiba, PR",
  "Recife, PE", "Porto Alegre, RS", "Belém, PA", "Goiânia, GO",
  "Guarulhos, SP", "Campinas, SP", "São Luís, MA", "São Gonçalo, RJ",
  "Maceió, AL", "Duque de Caxias, RJ", "Natal, RN", "Teresina, PI",
  "Campo Grande, MS", "São Bernardo do Campo, SP", "João Pessoa, PB",
  "Santo André, SP", "Osasco, SP", "Ribeirão Preto, SP", "Jaboatão dos Guararapes, PE",
  "Sorocaba, SP", "Uberlândia, MG", "Contagem, MG", "Aracaju, SE",
  "Feira de Santana, BA", "Cuiabá, MT", "Joinville, SC", "Juiz de Fora, MG",
  "Londrina, PR", "Aparecida de Goiânia, GO", "Ananindeua, PA", "Niterói, RJ",
  "Porto Velho, RO", "Campos dos Goytacazes, RJ", "Serra, ES", "Caxias do Sul, RS",
  "São José dos Pinhais, PR", "Moji das Cruzes, SP", "Betim, MG", "Belford Roxo, RJ",
  "Santos, SP", "Diadema, SP", "Florianópolis, SC", "Macapá, AP",
  "Boa Vista, RR", "Rio Branco, AC", "Palmas, TO", "Vitória, ES",
  // Cidades médias importantes
  "Blumenau, SC", "Jaraguá do Sul, SC", "Itajaí, SC", "Balneário Camboriú, SC",
  "Chapecó, SC", "Lages, SC", "Criciúma, SC", "Brusque, SC",
  "São José, SC", "Penha, SC", "Barra Velha, SC", "Navegantes, SC",
  "Piçarras, SC", "Gaspar, SC", "Indaial, SC", "Pomerode, SC",
  "Maringá, PR", "Cascavel, PR", "Ponta Grossa, PR", "Foz do Iguaçu, PR",
  "Umuarama, PR", "Paranaguá, PR", "Toledo, PR", "Guarapuava, PR",
  "Pelotas, RS", "Canoas, RS", "Santa Maria, RS", "Gravataí, RS",
  "Viamão, RS", "Novo Hamburgo, RS", "São Leopoldo, RS", "Passo Fundo, RS",
  "Piracicaba, SP", "São José do Rio Preto, SP", "Jundiaí, SP", "Bauru, SP",
  "Franca, SP", "Taubaté, SP", "Limeira, SP", "Presidente Prudente, SP",
  "Marília, SP", "Araraquara, SP", "São Carlos, SP", "Americana, SP",
  // Regiões e áreas metropolitanas
  "Vale do Itajaí, SC", "Grande São Paulo, SP", "Grande Rio, RJ",
  "Grande BH, MG", "Grande Curitiba, PR", "Grande Porto Alegre, RS",
  "Região Metropolitana de Campinas, SP", "ABC Paulista, SP",
  "Litoral Norte de SC", "Litoral de São Paulo, SP", "Serra Gaúcha, RS"
];

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CityAutocomplete({
  value,
  onChange,
  placeholder = "Digite o nome da cidade...",
  className,
  disabled
}: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (value.length >= 2) {
      const searchTerm = value.toLowerCase().trim();
      const filtered = brazilianCities
        .filter(city => {
          const cityLower = city.toLowerCase();
          // Prioritize cities that start with the term, then include those that contain it
          return cityLower.startsWith(searchTerm) || cityLower.includes(searchTerm);
        })
        .sort((a, b) => {
          const aLower = a.toLowerCase();
          const bLower = b.toLowerCase();
          // Prioritize cities that START with the search term
          const aStarts = aLower.startsWith(searchTerm);
          const bStarts = bLower.startsWith(searchTerm);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.localeCompare(b, 'pt-BR');
        })
        .slice(0, 15); // Limit to 15 suggestions
      
      setSuggestions(filtered);
      setIsOpen(true); // Always open when typing 2+ chars to show "no results" message
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
    setHighlightedIndex(-1);
  }, [value]);

  const handleSelect = (city: string) => {
    onChange(city);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => value.length >= 2 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        translate="no"
      />
      
      {isOpen && value.length >= 2 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.length > 0 ? (
            suggestions.map((city, index) => (
              <li
                key={city}
                onClick={() => handleSelect(city)}
                className={cn(
                  "px-3 py-2 cursor-pointer text-sm transition-colors",
                  index === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted"
                )}
              >
                {city}
              </li>
            ))
          ) : (
            <li className="px-3 py-3 text-sm text-muted-foreground text-center">
              Nenhuma cidade encontrada para "{value}"
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
