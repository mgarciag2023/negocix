import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  country?: string; // ISO country code (e.g., "BR", "US", "PT")
}

interface NominatimResult {
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
}

export default function CityAutocomplete({
  value,
  onChange,
  placeholder = "Digite o nome da cidade...",
  className,
  disabled,
  country
}: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCities = useCallback(async (searchTerm: string) => {
    if (searchTerm.length < 1) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    
    try {
      // Build the API URL with country filter if provided
      const countryCode = country && country !== "BR" ? country : "";
      const countryParam = countryCode ? `&countrycodes=${countryCode.toLowerCase()}` : "";
      
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchTerm)}&format=json&addressdetails=1&limit=15&featuretype=city${countryParam}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'pt-BR,pt,en',
          'User-Agent': 'LeadFinderApp/1.0'
        }
      });
      
      if (!response.ok) throw new Error('API error');
      
      const data: NominatimResult[] = await response.json();
      
      // Extract city names with state/country info
      const cities = data
        .map(item => {
          const cityName = item.address.city || item.address.town || item.address.village || item.address.municipality;
          const state = item.address.state;
          const countryName = item.address.country;
          
          if (cityName) {
            if (state && countryName) {
              return `${cityName}, ${state}, ${countryName}`;
            } else if (state) {
              return `${cityName}, ${state}`;
            } else if (countryName) {
              return `${cityName}, ${countryName}`;
            }
            return cityName;
          }
          
          // Fallback: extract from display_name
          const parts = item.display_name.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            return `${parts[0]}, ${parts[1]}`;
          }
          return parts[0];
        })
        .filter((city, index, self) => city && self.indexOf(city) === index) // Remove duplicates
        .slice(0, 15);
      
      setSuggestions(cities);
      setIsOpen(true);
    } catch (error) {
      console.error('Error fetching cities:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [country]);

  useEffect(() => {
    // Debounce the API call
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (value.length >= 1) {
      debounceRef.current = setTimeout(() => {
        fetchCities(value);
      }, 100); // 100ms debounce for faster response
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
    
    setHighlightedIndex(-1);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, fetchCities]);

  const handleSelect = (city: string) => {
    onChange(city);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

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
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 1 && suggestions.length > 0 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          translate="no"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      
      {isOpen && value.length >= 1 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {isLoading ? (
            <li className="px-3 py-3 text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando cidades...
            </li>
          ) : suggestions.length > 0 ? (
            suggestions.map((city, index) => (
              <li
                key={`${city}-${index}`}
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
