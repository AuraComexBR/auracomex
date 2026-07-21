import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Package, Pencil, AlertTriangle } from 'lucide-react';

// Module-level cache for NCM descriptions (code -> description)
const ncmDescCache = new Map<string, string>();

async function fetchNcmDescription(code: string): Promise<string> {
  if (!code) return '';
  const cleanCode = code.replace(/\D/g, '');
  if (ncmDescCache.has(cleanCode)) return ncmDescCache.get(cleanCode)!;

  try {
    let res = await fetch(`https://brasilapi.com.br/api/ncm/v1/${cleanCode}`);
    if (res.ok) {
      const data = await res.json();
      let desc = (data.descricao || '').replace(/<[^>]*>/g, '').replace(/^[- ]+/, '').trim();

      // If description is generic "Outras" or "Outros", try to get more context from the search endpoint
      // for 4-digit or 6-digit codes which might have better names in a list
      if (desc.toLowerCase() === 'outras' || desc.toLowerCase() === 'outros') {
        const searchRes = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${cleanCode}`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          // Look for a version of this code that might have more text
          const detailedMatch = searchData.find((d: any) =>
            d.codigo.replace(/\D/g, '') === cleanCode &&
            d.descricao.length > desc.length
          );
          if (detailedMatch) {
            desc = detailedMatch.descricao.replace(/<[^>]*>/g, '').replace(/^[- ]+/, '').trim();
          }
        }
      }

      ncmDescCache.set(cleanCode, desc);
      return desc;
    }

    const searchRes = await fetch(`https://brasilapi.com.br/api/ncm/v1?search=${cleanCode}`);
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data && Array.isArray(data) && data.length > 0) {
        const match = data.find((d: any) => d.codigo.replace(/\D/g, '') === cleanCode);
        if (match) {
          const desc = (match.descricao || '').replace(/<[^>]*>/g, '').replace(/^[- ]+/, '').trim();
          ncmDescCache.set(cleanCode, desc);
          return desc;
        }
      }
    }

    return '';
  } catch {
    return '';
  }
}

async function fetchNcmHierarchy(code: string): Promise<string> {
  const digits = code.replace(/\D/g, '');
  if (digits.length < 2) return '';

  const levels: string[] = [];
  if (digits.length >= 2) levels.push(digits.slice(0, 2));
  if (digits.length >= 4) levels.push(digits.slice(0, 4));
  if (digits.length >= 6) levels.push(digits.slice(0, 6));
  if (digits.length >= 8) levels.push(digits.slice(0, 8));
  if (!levels.includes(digits)) levels.push(digits);

  const unique = Array.from(new Set(levels)).sort((a, b) => a.length - b.length);
  const results = await Promise.all(unique.map(fetchNcmDescription));

  const parts = results.filter(Boolean);

  const dedup: string[] = [];
  const genericTerms = ['outras', 'outros', '- outras', '- outros', '-- outras', '-- outros'];

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const isGeneric = genericTerms.includes(p.toLowerCase());

    // Only add generic terms if it is the very last part of a multi-part hierarchy
    // or if we have no other choice. This avoids "Outras › Outras".
    if (isGeneric) {
      if (i === parts.length - 1 && dedup.length > 0) {
        // Keep it as the specific final classification
        if (dedup[dedup.length - 1].toLowerCase() !== p.toLowerCase()) {
          dedup.push(p);
        }
      }
      // Otherwise skip generic intermediate levels
      continue;
    }

    if (dedup.length === 0 || dedup[dedup.length - 1].toLowerCase() !== p.toLowerCase()) {
      dedup.push(p);
    }
  }

  return dedup.join(' › ');
}

interface CargoItem {
  id?: string | null;
  container_type: string;
  container_qty: number;
  container_number: string;
  weight_kg: string;
  volume_cbm: string;
  chargeable_weight: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  packages: string;
  ncm_code: string;
  commodity: string;
  dangerous_goods: boolean;
  vehicle_type: string;
  cargo_value: string;
  cargo_value_currency: string;
  notes: string;
}

interface ModeFieldsProps {
  mode: string;
  items: CargoItem[];
  onChange: (items: CargoItem[]) => void;
  readOnly?: boolean;
}

const CONTAINER_TYPES = ['20GP', '20HC', '40GP', '40HC', '40NOR', '20RF', '40RF', '20OT', '40OT', '20FR', '40FR'];
const VEHICLE_TYPES = ['Truck', 'Carreta', 'Bitrem', 'Rodotrem', 'Sider', 'Baú', 'Graneleiro'];

// Max payload weight (kg) and internal volume (cbm) per container type
const CONTAINER_SPECS: Record<string, { maxWeight: number; maxVolume: number }> = {
  '20GP':  { maxWeight: 21770, maxVolume: 33.2 },
  '20HC':  { maxWeight: 21570, maxVolume: 37.4 },
  '40GP':  { maxWeight: 26680, maxVolume: 67.7 },
  '40HC':  { maxWeight: 26480, maxVolume: 76.3 },
  '40NOR': { maxWeight: 26280, maxVolume: 67.7 },
  '20RF':  { maxWeight: 21250, maxVolume: 28.3 },
  '40RF':  { maxWeight: 26080, maxVolume: 59.3 },
  '20OT':  { maxWeight: 21750, maxVolume: 32.0 },
  '40OT':  { maxWeight: 26630, maxVolume: 65.0 },
  '20FR':  { maxWeight: 21750, maxVolume: 32.0 },
  '40FR':  { maxWeight: 39200, maxVolume: 62.0 },
};

export const emptyCargoItem: CargoItem = {
  id: null,
  container_type: '20GP',
  container_qty: 1,
  container_number: '',
  weight_kg: '',
  volume_cbm: '',
  chargeable_weight: '',
  length_cm: '',
  width_cm: '',
  height_cm: '',
  packages: '',
  ncm_code: '',
  commodity: '',
  dangerous_goods: false,
  vehicle_type: '',
  cargo_value: '',
  cargo_value_currency: 'USD',
  notes: '',
};

function NcmField({ value, description, onCodeChange, disabled }: { value: string; description: string; onCodeChange: (code: string, desc: string) => void, disabled?: boolean }) {
  const { t } = useLanguage();
  const [ncmInput, setNcmInput] = useState(value);
  const [ncmDesc, setNcmDesc] = useState(description);
  const [loading, setLoading] = useState(false);
  const lastFetchedRef = useRef<string>(value && description ? value : '');

  useEffect(() => {
    setNcmInput(value);
    setNcmDesc(description);
    if (value && description) {
      lastFetchedRef.current = value;
    }
  }, [value, description]);

  useEffect(() => {
    if (ncmInput.length < 4) {
      setNcmDesc('');
      return;
    }
    // Skip if we already fetched this exact code and have a description
    if (lastFetchedRef.current === ncmInput && ncmDesc) {
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const desc = await fetchNcmHierarchy(ncmInput);
        if (desc) {
          setNcmDesc(desc);
          onCodeChange(ncmInput, desc);
        } else {
          setNcmDesc('');
          onCodeChange(ncmInput, '');
        }
        lastFetchedRef.current = ncmInput;
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [ncmInput, ncmDesc]);

  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('quotes.ncm_code')}</Label>
      <Input
        placeholder="0000.00.00"
        value={ncmInput}
        onChange={(e) => {
          setNcmInput(e.target.value);
          onCodeChange(e.target.value, ncmDesc);
        }}
        disabled={disabled}
      />
      {loading && <p className="text-xs text-muted-foreground">{t('common.loading')}</p>}
      {!loading && ncmDesc && (
        <p className="text-xs text-muted-foreground line-clamp-2" title={ncmDesc}>{ncmDesc}</p>
      )}
    </div>
  );
}

export function calcItemCbm(item: CargoItem): number {
  const l = parseFloat(item.length_cm) || 0;
  const w = parseFloat(item.width_cm) || 0;
  const h = parseFloat(item.height_cm) || 0;
  const pkgs = parseInt(item.packages) || 1;
  if (l > 0 && w > 0 && h > 0) return (l * w * h / 1_000_000) * pkgs;
  // No fallback - return 0 so the field stays editable for manual input
  return 0;
}

/** Returns the effective volume: computed from dimensions or manual fallback */
export function getEffectiveVolume(item: CargoItem): number {
  const computed = calcItemCbm(item);
  if (computed > 0) return computed;
  return parseFloat(item.volume_cbm) || 0;
}

/** Total weight for an item: weight_per_volume × packages (when packages >= 2) */
export function calcItemWeight(item: CargoItem): number {
  const w = parseFloat(item.weight_kg) || 0;
  const pkgs = parseInt(item.packages) || 1;
  return pkgs >= 2 ? w * pkgs : w;
}

export function calcChargeableWeight(items: CargoItem[], mode: string): number {
  const totalWeight = items.reduce((s, i) => s + calcItemWeight(i), 0);
  const totalCbm = items.reduce((s, i) => s + getEffectiveVolume(i), 0);
  return calcChargeableWeightFromTotals(totalWeight, totalCbm, mode);
}

/** Same formula as calcChargeableWeight, but from pre-aggregated totals
 *  (used when weight comes from another source, e.g. the Cost Estimate). */
export function calcChargeableWeightFromTotals(totalWeight: number, totalCbm: number, mode: string): number {
  if (mode === 'air') {
    return Math.max(totalWeight, totalCbm * 1_000_000 / 6000);
  }
  // Ocean LCL: 1 cbm = 1000 kg
  if (mode === 'ocean_lcl') {
    return Math.max(totalWeight, totalCbm * 1000);
  }
  return totalWeight;
}

function itemTitle(item: CargoItem, mode: string): string {
  if (mode === 'ocean_fcl' || mode === 'multimodal') {
    const qty = item.container_qty || 1;
    return `${qty}x ${item.container_type || '20GP'}`;
  }
  if (mode === 'road' && item.vehicle_type) return item.vehicle_type;
  return item.commodity || 'Item sem descrição';
}

function itemSubtitle(item: CargoItem, mode: string): string {
  const parts: string[] = [];
  const weight = calcItemWeight(item);
  if (weight > 0) parts.push(`${weight.toLocaleString('pt-BR')} kg`);
  const cbm = getEffectiveVolume(item);
  if (cbm > 0) parts.push(`${cbm.toFixed(3)} m³`);
  if (item.packages) parts.push(`${item.packages} vol.`);
  if (item.cargo_value) parts.push(`${item.cargo_value_currency || 'USD'} ${item.cargo_value}`);
  if (mode !== 'ocean_fcl' && mode !== 'multimodal' && item.ncm_code) parts.push(`NCM ${item.ncm_code}`);
  return parts.length > 0 ? parts.join(' · ') : 'Sem detalhes preenchidos';
}

export function ModeFields({ mode, items, onChange, readOnly }: ModeFieldsProps) {
  const { t } = useLanguage();
  const [formOpen, setFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<CargoItem>({ ...emptyCargoItem });

  const patchDraft = (patch: Partial<CargoItem>) => setDraft((d) => ({ ...d, ...patch }));

  const openAddDialog = () => {
    if (readOnly) return;
    setDraft({ ...emptyCargoItem });
    setEditingIndex(null);
    setFormOpen(true);
  };

  const openEditDialog = (idx: number) => {
    if (readOnly) return;
    setDraft({ ...items[idx] });
    setEditingIndex(idx);
    setFormOpen(true);
  };

  const handleSave = () => {
    if (editingIndex === null) {
      onChange([...items, draft]);
    } else {
      onChange(items.map((it, i) => (i === editingIndex ? draft : it)));
    }
    setFormOpen(false);
  };

  const removeItem = (index: number) => {
    if (readOnly) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const showContainers = mode === 'ocean_fcl' || mode === 'multimodal';
  const showDimensions = mode !== 'ocean_fcl';
  const showVehicle = mode === 'road';

  const totalCbm = items.reduce((s, i) => s + getEffectiveVolume(i), 0);
  const totalWeight = items.reduce((s, i) => s + calcItemWeight(i), 0);
  const totalChargeable = calcChargeableWeight(items, mode);

  if (formOpen) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <span className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
            <Package className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{editingIndex === null ? 'Adicionar Carga' : 'Editar Carga'}</p>
            <p className="text-xs text-muted-foreground">Preencha os dados físicos da carga usados para cotar o frete.</p>
          </div>
        </div>

        <div className="space-y-3.5">
          {/* Container */}
          {showContainers && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('quotes.container_type')}</Label>
              <div className="grid grid-cols-2 gap-3">
                <Select value={draft.container_type} onValueChange={(v) => patchDraft({ container_type: v })}>
                  <SelectTrigger><SelectValue placeholder="20GP" /></SelectTrigger>
                  <SelectContent>
                    {CONTAINER_TYPES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  inputMode="numeric"
                  placeholder="Quantidade"
                  value={draft.container_qty}
                  onChange={(e) => patchDraft({ container_qty: parseInt(e.target.value) || 1 })}
                />
              </div>
              {CONTAINER_SPECS[draft.container_type] && (
                <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1.5 flex gap-4">
                  <span>⚖️ Máx: <strong>{CONTAINER_SPECS[draft.container_type].maxWeight.toLocaleString()} kg</strong></span>
                  <span>📦 Máx: <strong>{CONTAINER_SPECS[draft.container_type].maxVolume} m³</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Weight, Volume & Cargo Value */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {(parseInt(draft.packages) || 0) >= 2
                  ? `${t('quotes.weight_kg')} por Volume`
                  : t('quotes.weight_kg')}
              </Label>
              <Input
                inputMode="decimal"
                placeholder={showContainers && CONTAINER_SPECS[draft.container_type] ? `Máx ${CONTAINER_SPECS[draft.container_type].maxWeight.toLocaleString()}` : '0'}
                value={draft.weight_kg}
                onChange={(e) => patchDraft({ weight_kg: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('quotes.volume_cbm')}</Label>
              {(() => {
                const computed = calcItemCbm(draft);
                const displayValue = computed > 0 ? computed.toFixed(4) : draft.volume_cbm;
                const isComputed = computed > 0;
                return (
                  <Input
                    inputMode="decimal"
                    placeholder="0"
                    value={displayValue}
                    readOnly={isComputed}
                    className={isComputed ? 'bg-muted/50' : ''}
                    onChange={(e) => {
                      if (!isComputed) patchDraft({ volume_cbm: e.target.value });
                    }}
                  />
                );
              })()}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Valor da Carga</Label>
              <div className="flex gap-1.5">
                <Select value={draft.cargo_value_currency || 'USD'} onValueChange={(v) => patchDraft({ cargo_value_currency: v })}>
                  <SelectTrigger className="w-20 shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['USD', 'BRL', 'EUR', 'GBP', 'CNY'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input inputMode="decimal" placeholder="0.00" value={draft.cargo_value} onChange={(e) => patchDraft({ cargo_value: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Dimensions – LCL, Air, Road, Multimodal */}
          {showDimensions && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dimensões (cm)</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input inputMode="decimal" placeholder={t('quotes.length_cm')} value={draft.length_cm} onChange={(e) => patchDraft({ length_cm: e.target.value })} />
                <Input inputMode="decimal" placeholder={t('quotes.width_cm')} value={draft.width_cm} onChange={(e) => patchDraft({ width_cm: e.target.value })} />
                <Input inputMode="decimal" placeholder={t('quotes.height_cm')} value={draft.height_cm} onChange={(e) => patchDraft({ height_cm: e.target.value })} />
              </div>
            </div>
          )}

          {/* Vehicle type & Packages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {showVehicle && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('quotes.vehicle_type')}</Label>
                <Select value={draft.vehicle_type} onValueChange={(v) => patchDraft({ vehicle_type: v })}>
                  <SelectTrigger><SelectValue placeholder={t('quotes.vehicle_type')} /></SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {mode !== 'ocean_fcl' && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('quotes.packages')}</Label>
                <Input inputMode="numeric" placeholder="0" value={draft.packages} onChange={(e) => patchDraft({ packages: e.target.value })} />
              </div>
            )}
          </div>

          {/* NCM */}
          <NcmField
            value={draft.ncm_code}
            description={draft.commodity}
            onCodeChange={(code, desc) => patchDraft({ ncm_code: code, commodity: desc })}
          />

          {/* Dangerous goods */}
          <label className="flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer select-none hover:bg-accent/40 transition-colors">
            <Checkbox
              checked={draft.dangerous_goods}
              onCheckedChange={(v) => patchDraft({ dangerous_goods: !!v })}
            />
            <span className="text-sm">{t('quotes.dangerous_goods')}</span>
          </label>

          {/* Notes / Observações */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Observações</Label>
            <Input placeholder="Detalhes adicionais da carga..." value={draft.notes} onChange={(e) => patchDraft({ notes: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-between pt-1 border-t mt-4 pt-3">
          <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
          <Button type="button" onClick={handleSave}>
            {editingIndex === null ? 'Adicionar' : 'Salvar'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add item button — no topo, mesmo padrão do botão "Adicionar Taxa" */}
      {!readOnly && (
        <Button type="button" size="sm" className="gap-2" onClick={openAddDialog}>
          <Plus className="w-4 h-4" /> Adicionar Carga
        </Button>
      )}

      {/* Lista organizada dos itens */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
            Nenhuma carga adicionada ainda. Clique em "Adicionar Carga" acima para começar.
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/50">
              <button
                type="button"
                onClick={() => openEditDialog(idx)}
                disabled={readOnly}
                className="flex-1 min-w-0 flex items-center gap-3 text-left disabled:cursor-default"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium truncate">{itemTitle(item, mode)}</p>
                    {item.dangerous_goods && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-destructive/40 text-destructive gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> IMO
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{itemSubtitle(item, mode)}</p>
                </div>
              </button>
              {!readOnly && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(idx)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      {items.length > 0 && (
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t('quotes.totals')}</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>{t('quotes.weight_kg')}: <strong className="font-mono">{totalWeight.toFixed(2)}</strong></span>
            <span>{t('quotes.total_cbm')}: <strong className="font-mono">{totalCbm.toFixed(4)}</strong> m³</span>
            {(mode === 'air' || mode === 'ocean_lcl') && (
              <span>{t('quotes.total_chargeable')}: <strong className="font-mono">{totalChargeable.toFixed(2)}</strong> kg</span>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export type { CargoItem };
