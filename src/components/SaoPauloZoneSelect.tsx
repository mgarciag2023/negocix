import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { saoPauloZones } from '../../supabase/functions/_shared/sao-paulo-zones';

export default function SaoPauloZoneSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div>
    <Label htmlFor="sao-paulo-zone">Zona de São Paulo</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id="sao-paulo-zone" className="mt-2"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as zonas</SelectItem>
        {saoPauloZones.map(zone => <SelectItem key={zone.value} value={zone.value}>{zone.label}</SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}