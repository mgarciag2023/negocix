import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Building, Building2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { customerTypes, countries, brazilianStates } from "@/data/searchConstants";
import { cnaes as cnaeList } from "@/data/cnaes";


import { useToast } from "@/hooks/use-toast";

const Configuration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [products, setProducts] = useState("");
  const [country, setCountry] = useState("BR");
  const [customCountry, setCustomCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [companySizes, setCompanySizes] = useState<string[]>([]);
  const [revenueRange, setRevenueRange] = useState("all");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [ecommerceType, setEcommerceType] = useState("");
  const [businessType, setBusinessType] = useState("all"); // all, matriz, filial
  const [digitalPresence, setDigitalPresence] = useState("all"); // all, no-site, basic-site, structured-site
  const [digitalActivity, setDigitalActivity] = useState("all"); // all, low, basic, active
  const [customerSearch, setCustomerSearch] = useState(""); // Search filter for customer types
  const [visibleCount, setVisibleCount] = useState(100); // Limit rendered items for performance
  const [searchMode, setSearchMode] = useState<"segment" | "cnae">("segment");
  const [selectedCnaes, setSelectedCnaes] = useState<string[]>([]);
  const [cnaeSearch, setCnaeSearch] = useState("");
  const [cnaeVisibleCount, setCnaeVisibleCount] = useState(100);


  // Fuzzy search: remove accents, match all words independently
  const normalizeText = (text: string) =>
    text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const matchesSearch = (customer: string, search: string) => {
    if (!search) return true;
    const normalized = normalizeText(customer);
    const words = normalizeText(search).split(/\s+/).filter(Boolean);
    return words.every(word => normalized.includes(word));
  };
  // whatsappOnly removed - was filtering out too many leads
  // receitaFederalOnly removed

  // customerTypes, countries, brazilianStates imported from @/data/searchConstants

  const handleCustomerToggle = (customer: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customer)
        ? prev.filter(c => c !== customer)
        : [...prev, customer]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine final country
    const finalCountry = country === "OTHER" ? customCountry : country;

    // Nationwide search (Brasil inteiro)
    const isNationwide = country === "BR" && state === "ALL_BR";
    const effectiveState = isNationwide ? "" : state;
    const effectiveCity = isNationwide ? "" : city;
    
    // Build region string based on filled fields
    let region = "";
    if (isNationwide) {
      region = "";
    } else if (country === "BR") {
      if (effectiveCity && effectiveState) {
        region = `${effectiveCity}, ${effectiveState}`;
      } else if (effectiveState) {
        region = effectiveState;
      } else if (effectiveCity) {
        region = effectiveCity;
      }
    } else {
      region = city || state || "";
    }
    
    if (!products) {
      toast({
        title: "Informe os produtos que você vende",
        description: "Preencha o campo de produtos para que possamos encontrar os melhores leads.",
        variant: "destructive",
      });
      return;
    }

    if (searchMode === "segment" && selectedCustomers.length === 0) {
      toast({
        title: "Selecione pelo menos um tipo de cliente",
        description: "Escolha os segmentos OU mude para busca por CNAE.",
        variant: "destructive",
      });
      return;
    }

    if (searchMode === "cnae" && selectedCnaes.length === 0) {
      toast({
        title: "Selecione pelo menos um CNAE",
        description: "Escolha um ou mais CNAEs OU mude para busca por segmento.",
        variant: "destructive",
      });
      return;
    }


    if (country === "OTHER" && !customCountry) {
      toast({
        title: "Informe o país de busca",
        description: "Digite o nome do país onde deseja buscar leads.",
        variant: "destructive",
      });
      return;
    }

    if (!isNationwide && !state && !city) {
      toast({
        title: "Informe a localização da busca",
        description: 'Selecione um estado, digite uma cidade ou escolha "Brasil inteiro".',
        variant: "destructive",
      });
      return;
    }

    // Validate: only ONE city allowed (commas/slashes/semicolons not supported)
    if (effectiveCity && /[,;/]| e | & /i.test(effectiveCity.trim())) {
      toast({
        title: "Apenas uma cidade por busca",
        description: "Digite somente uma cidade no campo. Para buscar em várias cidades, faça uma pesquisa por estado ou repita a busca para cada cidade.",
        variant: "destructive",
      });
      return;
    }

    // Check if search config actually changed
    const previousConfigStr = localStorage.getItem('leadSearchConfig');
    const newSearchConfig = {
      category,
      products,
      searchMode,
      selectedCustomers: searchMode === "segment" ? selectedCustomers : [],
      selectedCnaes: searchMode === "cnae" ? selectedCnaes : [],
      region,
      state: effectiveState,
      city: effectiveCity,
      nationwide: isNationwide,
      neighborhood: neighborhood.trim(),
      country: finalCountry,
      companySizes: companySizes.length > 0 ? companySizes : ['all'],
      revenueRange,
      businessType,
      digitalPresence,
      digitalActivity,
      ecommerceType: selectedCustomers.includes("E-commerce") ? ecommerceType : "",
      whatsappOnly: false,
      receitaFederalOnly: false,
    };

    
    const newConfigStr = JSON.stringify(newSearchConfig);
    
    // Only clear cached leads if the search configuration actually changed
    if (previousConfigStr !== newConfigStr) {
      console.log('🔄 Search config changed, clearing cache');
      localStorage.removeItem('cachedLeads');
      localStorage.removeItem('cacheTimestamp');
    } else {
      console.log('✅ Same search config, keeping cache');
    }
    
    // Save search configuration to localStorage
    localStorage.setItem('leadSearchConfig', newConfigStr);

    toast({
      title: "Busca configurada!",
      description: "Procurando leads compatíveis...",
    });

    // Clear saved scroll position so new search starts at the top
    sessionStorage.removeItem('results_scroll_position');

    setTimeout(() => {
      navigate("/resultados");
    }, 1000);
  };

  return (
    <div className="bg-background" lang="pt-BR">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6 md:py-8 pb-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Configure Sua Busca</h1>
            <p className="text-muted-foreground text-base md:text-lg">
              Preencha os dados abaixo para encontrar os leads perfeitos para seu negócio
            </p>
          </div>

          <form onSubmit={handleSubmit} translate="no">
            <Card className="p-4 md:p-8 shadow-card">
              <div className="space-y-6 md:space-y-8">


                {/* Products */}
                <div>
                  <Label htmlFor="products" className="text-base font-semibold" translate="no">
                    Produtos específicos que vendo: *
                  </Label>
                    <Input
                      id="products"
                      value={products}
                      onChange={(e) => setProducts(e.target.value)}
                      placeholder='Ex: "Refrigerantes, sucos, energéticos"'
                      className="mt-2"
                      translate="no"
                    />
                </div>

                {/* Modo de busca: Segmento OU CNAE */}
                <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
                  <Label className="text-base font-semibold mb-2 block" translate="no">
                    Como deseja buscar? *
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Escolha <strong>apenas um</strong> método: ou por <strong>segmento</strong>, ou por <strong>CNAE</strong>.
                    Combinar os dois não é permitido (gera resultados ruins).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={searchMode === "segment" ? "default" : "outline"}
                      onClick={() => { setSearchMode("segment"); setSelectedCnaes([]); }}
                      className="gap-2"
                    >
                      Por Segmento
                    </Button>
                    <Button
                      type="button"
                      variant={searchMode === "cnae" ? "default" : "outline"}
                      onClick={() => { setSearchMode("cnae"); setSelectedCustomers([]); }}
                      className="gap-2"
                    >
                      Por CNAE
                    </Button>
                  </div>
                </div>

                {/* Customer Types - Com campo de pesquisa */}
                {searchMode === "segment" && (
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Clientes que quero encontrar: *
                  </Label>
                  
                  {/* Search field */}
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setVisibleCount(100);
                      }}
                      placeholder="Pesquisar tipo de estabelecimento..."
                      className="pl-10"
                      translate="no"
                    />
                  </div>
                  
                  {/* Selected count */}
                  {selectedCustomers.length > 0 && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {selectedCustomers.length} selecionado{selectedCustomers.length > 1 ? 's' : ''}
                      {customerSearch && ` (mostrando resultados para "${customerSearch}")`}
                    </p>
                  )}
                  
                  {(() => {
                    const uniqueCustomerTypes = Array.from(
                      new Map(
                        customerTypes.map((customer) => {
                          const trimmedCustomer = customer.trim();
                          const dedupKey = normalizeText(trimmedCustomer).replace(/\s+/g, " ");
                          return [dedupKey, trimmedCustomer] as const;
                        })
                      ).values()
                    );
                    const sorted = [...uniqueCustomerTypes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
                    const filtered = sorted.filter((customer) => matchesSearch(customer, customerSearch));
                    const displayItems = filtered.slice(0, customerSearch ? 200 : visibleCount);
                    const hasMore = filtered.length > displayItems.length;
                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 max-h-[400px] overflow-y-auto pr-2" translate="no">
                          {displayItems.map((customer) => (
                            <div key={customer} className="flex flex-col" translate="no">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={customer}
                                  checked={selectedCustomers.includes(customer)}
                                  onCheckedChange={() => handleCustomerToggle(customer)}
                                  translate="no"
                                />
                                <label
                                  htmlFor={customer}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                  translate="no"
                                >
                                  {customer}
                                </label>
                              </div>
                              {customer === "E-commerce" && selectedCustomers.includes("E-commerce") && (
                                <Input
                                  value={ecommerceType}
                                  onChange={(e) => setEcommerceType(e.target.value)}
                                  placeholder="Especifique o tipo (ex: Moda, Eletrônicos...)"
                                  className="mt-2 ml-6 max-w-[200px]"
                                  translate="no"
                                />
                              )}
                            </div>
                          ))}
                          {filtered.length === 0 && (
                            <p className="text-muted-foreground text-sm col-span-full py-4 text-center">
                              Nenhum tipo de estabelecimento encontrado para "{customerSearch}"
                            </p>
                          )}
                        </div>
                        {hasMore && !customerSearch && (
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-3 w-full"
                            onClick={() => setVisibleCount(prev => prev + 200)}
                          >
                            Mostrar mais ({filtered.length - displayItems.length} restantes)
                          </Button>
                        )}
                        {hasMore && customerSearch && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            Mostrando {displayItems.length} de {filtered.length} resultados. Refine sua busca para ver mais.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
                )}

                {/* CNAE picker */}
                {searchMode === "cnae" && (
                <div>
                  <Label className="text-base font-semibold mb-2 block" translate="no">
                    CNAE(s) que quero encontrar: *
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Digite código (ex: 4711301) ou descrição para filtrar a lista oficial do IBGE ({cnaeList.length} CNAEs).
                  </p>

                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={cnaeSearch}
                      onChange={(e) => { setCnaeSearch(e.target.value); setCnaeVisibleCount(100); }}
                      placeholder="Buscar CNAE por código ou descrição..."
                      className="pl-10"
                      translate="no"
                    />
                  </div>

                  {selectedCnaes.length > 0 && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {selectedCnaes.length} CNAE{selectedCnaes.length > 1 ? "s" : ""} selecionado{selectedCnaes.length > 1 ? "s" : ""}
                    </p>
                  )}

                  {(() => {
                    const q = normalizeText(cnaeSearch.trim()).toLowerCase();
                    const filtered = q
                      ? cnaeList.filter((c) => c.code.includes(q.replace(/\D/g, "")) || normalizeText(c.description).toLowerCase().includes(q))
                      : cnaeList;
                    const displayItems = filtered.slice(0, cnaeSearch ? 300 : cnaeVisibleCount);
                    const hasMore = filtered.length > displayItems.length;
                    return (
                      <>
                        <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2" translate="no">
                          {displayItems.map((c) => (
                            <div key={c.code} className="flex items-start space-x-2">
                              <Checkbox
                                id={`cnae-${c.code}`}
                                checked={selectedCnaes.includes(c.code)}
                                onCheckedChange={() => setSelectedCnaes((prev) => prev.includes(c.code) ? prev.filter(x => x !== c.code) : [...prev, c.code])}
                              />
                              <label htmlFor={`cnae-${c.code}`} className="text-sm leading-tight cursor-pointer">
                                <span className="font-mono text-primary">{c.code}</span>
                                <span className="text-muted-foreground"> — {c.description}</span>
                              </label>
                            </div>
                          ))}
                          {filtered.length === 0 && (
                            <p className="text-muted-foreground text-sm py-4 text-center">
                              Nenhum CNAE encontrado para "{cnaeSearch}"
                            </p>
                          )}
                        </div>
                        {hasMore && !cnaeSearch && (
                          <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setCnaeVisibleCount(prev => prev + 200)}>
                            Mostrar mais ({filtered.length - displayItems.length} restantes)
                          </Button>
                        )}
                        {hasMore && cnaeSearch && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            Mostrando {displayItems.length} de {filtered.length}. Refine a busca para ver mais.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
                )}



                {/* Tipo de Empresa (Matriz/Filial) */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Tipo de estabelecimento:
                  </Label>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant={businessType === "all" ? "default" : "outline"}
                      onClick={() => setBusinessType("all")}
                      className="gap-2"
                    >
                      <Building className="h-4 w-4" />
                      Todos
                    </Button>
                    <Button
                      type="button"
                      variant={businessType === "matriz" ? "default" : "outline"}
                      onClick={() => setBusinessType("matriz")}
                      className="gap-2"
                    >
                      <Building2 className="h-4 w-4" />
                      Apenas Matriz
                    </Button>
                    <Button
                      type="button"
                      variant={businessType === "filial" ? "default" : "outline"}
                      onClick={() => setBusinessType("filial")}
                      className="gap-2"
                    >
                      <Building className="h-4 w-4" />
                      Apenas Filiais
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Selecione se deseja ver matriz, filiais ou ambos
                  </p>
                </div>

                {/* WhatsApp Filter */}


                {/* Country */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="country" className="text-base font-semibold" translate="no">
                      País: *
                    </Label>
                    <Select value={country} onValueChange={(val) => { setCountry(val); if (val !== "OTHER") setCustomCountry(""); setState(""); setCity(""); }}>
                      <SelectTrigger className="mt-2" id="country" translate="no">
                        <SelectValue placeholder="Selecione o país" translate="no" />
                      </SelectTrigger>
                      <SelectContent sideOffset={5} translate="no">
                        {countries.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {country === "OTHER" && (
                    <div>
                      <Label htmlFor="customCountry" className="text-base font-semibold" translate="no">
                        Nome do País: *
                      </Label>
                      <Input
                        id="customCountry"
                        value={customCountry}
                        onChange={(e) => setCustomCountry(e.target.value)}
                        placeholder="Ex: Austrália"
                        className="mt-2"
                        translate="no"
                      />
                    </div>
                  )}

                  {/* Estado */}
                  <div>
                    <Label htmlFor="state" className="text-base font-semibold" translate="no">
                      Estado: {country === "BR" ? "*" : "(opcional)"}
                    </Label>
                    {country === "BR" ? (
                      <Select value={state} onValueChange={(v) => { setState(v); if (v === "ALL_BR") setCity(""); }}>
                        <SelectTrigger className="mt-2" id="state" translate="no">
                          <SelectValue placeholder="Selecione o estado" translate="no" />
                        </SelectTrigger>
                        <SelectContent sideOffset={5} translate="no">
                          <SelectItem value="ALL_BR">🇧🇷 Brasil inteiro (todos os estados)</SelectItem>
                          {brazilianStates.map((st) => (
                            <SelectItem key={st} value={st}>{st}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="Ex: California, Ontario..."
                        className="mt-2"
                        translate="no"
                      />
                    )}
                    {state === "ALL_BR" && (
                      <p className="text-xs text-warning mt-2">
                        ⚠️ Busca nacional pode demorar mais e retornar resultados mais variados. O campo de cidade será ignorado.
                      </p>
                    )}
                  </div>


                  {/* Cidade com Autocomplete */}
                  <div>
                    <Label htmlFor="city" className="text-base font-semibold" translate="no">
                      Cidade: (opcional)
                    </Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex: São Paulo"
                      className="mt-2"
                      translate="no"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Digite apenas <strong>uma cidade</strong>. Para buscar em várias, deixe em branco e pesquise pelo estado inteiro.
                    </p>
                  </div>
                </div>

                {/* Bairro - Beta */}
                <div>
                  <Label htmlFor="neighborhood" className="text-base font-semibold flex items-center gap-2" translate="no">
                    Bairro: (opcional)
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
                      Beta — em testes
                    </span>
                  </Label>
                  <Input
                    id="neighborhood"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Ex: Centro, Armação..."
                    className="mt-2"
                    translate="no"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Filtra leads pelo bairro informado. <strong>Funcionalidade experimental</strong> — pode não capturar todas as variações de grafia do bairro.
                  </p>
                </div>

                {/* Company Size - Multiple Selection */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Tamanho do cliente:
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox 
                        id="size-all" 
                        checked={companySizes.length === 0 || companySizes.includes('all')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCompanySizes([]);
                          }
                        }}
                      />
                      <Label htmlFor="size-all" className="font-normal cursor-pointer" translate="no">
                        Todos os tamanhos
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox 
                        id="size-small" 
                        checked={companySizes.includes('small')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCompanySizes(prev => [...prev.filter(s => s !== 'all'), 'small']);
                          } else {
                            setCompanySizes(prev => prev.filter(s => s !== 'small'));
                          }
                        }}
                      />
                      <Label htmlFor="size-small" className="font-normal cursor-pointer" translate="no">
                        Pequeno (até 10 funcionários)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox 
                        id="size-medium" 
                        checked={companySizes.includes('medium')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCompanySizes(prev => [...prev.filter(s => s !== 'all'), 'medium']);
                          } else {
                            setCompanySizes(prev => prev.filter(s => s !== 'medium'));
                          }
                        }}
                      />
                      <Label htmlFor="size-medium" className="font-normal cursor-pointer" translate="no">
                        Médio (11-50 funcionários)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <Checkbox 
                        id="size-large" 
                        checked={companySizes.includes('large')}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setCompanySizes(prev => [...prev.filter(s => s !== 'all'), 'large']);
                          } else {
                            setCompanySizes(prev => prev.filter(s => s !== 'large'));
                          }
                        }}
                      />
                      <Label htmlFor="size-large" className="font-normal cursor-pointer" translate="no">
                        Grande (+50 funcionários)
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Revenue Range */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Faixa de faturamento:
                  </Label>
                  <RadioGroup value={revenueRange} onValueChange={setRevenueRange}>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="micro" id="micro" />
                      <Label htmlFor="micro" className="font-normal cursor-pointer" translate="no">
                        Microempresa (até R$ 360 mil/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="small-business" id="small-business" />
                      <Label htmlFor="small-business" className="font-normal cursor-pointer" translate="no">
                        Pequena empresa (R$ 360 mil - R$ 4,8 milhões/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="medium-business" id="medium-business" />
                      <Label htmlFor="medium-business" className="font-normal cursor-pointer" translate="no">
                        Média empresa (R$ 4,8M - R$ 300M/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="large-business" id="large-business" />
                      <Label htmlFor="large-business" className="font-normal cursor-pointer" translate="no">
                        Grande empresa (+R$ 300M/ano)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="all" id="all-revenue" />
                      <Label htmlFor="all-revenue" className="font-normal cursor-pointer" translate="no">
                        Todas as faixas
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Digital Presence (Website) */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Presença Digital (Site):
                  </Label>
                  <RadioGroup value={digitalPresence} onValueChange={setDigitalPresence}>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="no-site" id="no-site" />
                      <Label htmlFor="no-site" className="font-normal cursor-pointer" translate="no">
                        Não possui site
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="basic-site" id="basic-site" />
                      <Label htmlFor="basic-site" className="font-normal cursor-pointer" translate="no">
                        Possui site básico / institucional
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="structured-site" id="structured-site" />
                      <Label htmlFor="structured-site" className="font-normal cursor-pointer" translate="no">
                        Possui site estruturado
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="all" id="all-presence" />
                      <Label htmlFor="all-presence" className="font-normal cursor-pointer" translate="no">
                        Todos
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground mt-2">
                    Filtre empresas pela presença de site institucional
                  </p>
                </div>

                {/* Digital Activity Level */}
                <div>
                  <Label className="text-base font-semibold mb-4 block" translate="no">
                    Nível de Atividade Digital:
                  </Label>
                  <RadioGroup value={digitalActivity} onValueChange={setDigitalActivity}>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="low" id="low-activity" />
                      <Label htmlFor="low-activity" className="font-normal cursor-pointer" translate="no">
                        Baixa ou inexistente
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="basic" id="basic-activity" />
                      <Label htmlFor="basic-activity" className="font-normal cursor-pointer" translate="no">
                        Básica
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="active" id="active-activity" />
                      <Label htmlFor="active-activity" className="font-normal cursor-pointer" translate="no">
                        Ativa
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2" translate="no">
                      <RadioGroupItem value="all" id="all-activity" />
                      <Label htmlFor="all-activity" className="font-normal cursor-pointer" translate="no">
                        Todos os níveis
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground mt-2">
                    Filtre pelo nível de engajamento digital da empresa
                  </p>
                </div>

                {/* Submit */}
                <Button type="submit" className="w-full gap-2 text-base py-6" size="lg">
                  <Search className="h-5 w-5" />
                  Buscar Leads
                </Button>
              </div>
            </Card>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Configuration;
