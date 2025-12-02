import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Loader2, MessageSquare, Sparkles, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";

const CreateApproach = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [generatedApproach, setGeneratedApproach] = useState("");
  
  const [formData, setFormData] = useState({
    sellerName: "",
    brandName: "",
    products: "",
    benefits: "",
    targetSegment: "",
    leadName: "",
    additionalInfo: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateApproach = async () => {
    if (!formData.products && !formData.brandName) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, informe pelo menos o produto ou a marca que você representa.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedApproach("");

    try {
      const { data, error } = await supabase.functions.invoke("generate-approach", {
        body: formData,
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setGeneratedApproach(data.approach);
      toast({
        title: "Abordagem criada!",
        description: "Sua abordagem profissional foi gerada com sucesso.",
      });
    } catch (error: any) {
      console.error("Error generating approach:", error);
      toast({
        title: "Erro ao gerar abordagem",
        description: error.message || "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedApproach);
    toast({
      title: "Copiado!",
      description: "Abordagem copiada para a área de transferência.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            Criar Abordagem Profissional
          </h1>
          <p className="text-muted-foreground mt-2">
            Responda as perguntas e a IA criará uma abordagem personalizada para você enviar aos seus clientes.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Informações da Abordagem
              </CardTitle>
              <CardDescription>
                Quanto mais detalhes você fornecer, melhor será a abordagem gerada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sellerName">Seu Nome</Label>
                  <Input
                    id="sellerName"
                    placeholder="Ex: João Silva"
                    value={formData.sellerName}
                    onChange={(e) => handleInputChange("sellerName", e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="brandName">Marca que Representa</Label>
                  <Input
                    id="brandName"
                    placeholder="Ex: Produtos XYZ"
                    value={formData.brandName}
                    onChange={(e) => handleInputChange("brandName", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="products">O que você quer vender? *</Label>
                <Input
                  id="products"
                  placeholder="Ex: Queijos artesanais, frios premium, laticínios"
                  value={formData.products}
                  onChange={(e) => handleInputChange("products", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="benefits">Benefícios do seu produto</Label>
                <Textarea
                  id="benefits"
                  placeholder="Ex: Preços competitivos, entrega rápida, produtos frescos, suporte dedicado..."
                  value={formData.benefits}
                  onChange={(e) => handleInputChange("benefits", e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="targetSegment">Segmento do Cliente</Label>
                  <Input
                    id="targetSegment"
                    placeholder="Ex: Restaurantes, Pizzarias, Supermercados"
                    value={formData.targetSegment}
                    onChange={(e) => handleInputChange("targetSegment", e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="leadName">Nome do Lead/Empresa</Label>
                  <Input
                    id="leadName"
                    placeholder="Ex: Restaurante Sabor & Arte"
                    value={formData.leadName}
                    onChange={(e) => handleInputChange("leadName", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalInfo">Informações Adicionais (opcional)</Label>
                <Textarea
                  id="additionalInfo"
                  placeholder="Ex: Promoção especial, primeiro pedido com desconto, algo específico sobre o cliente..."
                  value={formData.additionalInfo}
                  onChange={(e) => handleInputChange("additionalInfo", e.target.value)}
                  rows={2}
                />
              </div>

              <Button 
                onClick={generateApproach} 
                disabled={isLoading}
                className="w-full bg-gradient-primary hover:opacity-90"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Gerando abordagem...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Gerar Abordagem com IA
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result */}
          <Card className={generatedApproach ? "border-primary/50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Abordagem Gerada
                </span>
                {generatedApproach && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={generateApproach} disabled={isLoading}>
                      <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={copyToClipboard}>
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar
                    </Button>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                {generatedApproach 
                  ? "Sua abordagem está pronta! Copie e envie para seu cliente."
                  : "Preencha o formulário e clique em gerar para criar sua abordagem."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <p className="text-center">A IA está criando a melhor abordagem para você...</p>
                </div>
              ) : generatedApproach ? (
                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm md:text-base leading-relaxed">
                  {generatedApproach}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-center">Sua abordagem aparecerá aqui</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default CreateApproach;
